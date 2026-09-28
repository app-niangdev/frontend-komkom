import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CompanyService } from '../../../core/services/company.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Company, Store, StoreStorefront } from '../../../core/models/company.model';
import { StorefrontAdminService } from '../../../core/services/storefront-admin.service';
import { CompanyFormComponent } from '../company-form/company-form.component';
import { StoreFormComponent } from '../store-form/store-form.component';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { copyText } from '../../../shared/utils/storefront.util';
import { StorefrontSettingsComponent } from '../storefront-settings/storefront-settings.component';

const PER_PAGE = 10;

@Component({
  selector: 'app-company-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CompanyFormComponent, StoreFormComponent, StorefrontSettingsComponent],
  templateUrl: './company-detail.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './company-detail.component.scss']
})
export class CompanyDetailComponent implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly storefrontService = inject(StorefrontAdminService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  private companyId = 0;

  protected readonly company = signal<Company | null>(null);
  protected readonly isLoadingCompany = signal(true);
  protected readonly companyError = signal<string | null>(null);

  protected readonly stores = signal<Store[]>([]);
  protected readonly isLoadingStores = signal(false);
  protected readonly storesError = signal<string | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected search = '';

  protected readonly isCompanyFormOpen = signal(false);
  protected readonly isStoreFormOpen = signal(false);
  /** Boutique en cours de modification (null = création). */
  protected readonly editingStore = signal<Store | null>(null);

  /** Vitrines publiques des boutiques de l'entreprise, par id de boutique. */
  protected readonly storefronts = signal<Map<number, StoreStorefront>>(new Map());
  protected readonly storefrontStore = signal<StoreStorefront | null>(null);

  ngOnInit(): void {
    // Id transmis via history.state par la liste (conservé par le navigateur au rechargement)
    const companyId = Number(history.state?.companyId);
    if (!companyId) {
      this.router.navigateByUrl('/admin/companies');
      return;
    }

    this.companyId = companyId;
    this.loadCompany();
    this.loadStores();
    this.loadStorefronts();
  }

  loadCompany(): void {
    this.isLoadingCompany.set(true);
    this.companyError.set(null);

    this.companyService.find(this.companyId).subscribe({
      next: (company) => {
        this.company.set(company);
        this.isLoadingCompany.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoadingCompany.set(false);
        this.companyError.set(err.error?.message ?? "Impossible de charger l'entreprise.");
      }
    });
  }

  loadStores(page = 1): void {
    this.isLoadingStores.set(true);
    this.storesError.set(null);

    this.companyService.listStores(this.companyId, page, PER_PAGE, this.search.trim()).subscribe({
      next: (res) => {
        this.stores.set(res.data);
        this.currentPage.set(res.meta.current_page);
        this.lastPage.set(res.meta.last_page);
        this.total.set(res.meta.total);
        this.isLoadingStores.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoadingStores.set(false);
        this.storesError.set(err.error?.message ?? 'Impossible de charger les boutiques.');
      }
    });
  }

  /** État des vitrines (dépend du téléphone, de l'activation et de l'abonnement : rechargé après chaque changement). */
  loadStorefronts(): void {
    this.storefrontService.list(this.companyId).subscribe({
      next: (list) => this.storefronts.set(new Map(list.map((s) => [s.id, s]))),
      error: () => this.storefronts.set(new Map())
    });
  }

  storefrontOf(store: Store): StoreStorefront | undefined {
    return this.storefronts().get(store.id);
  }

  openStorefront(store: Store): void {
    const storefront = this.storefrontOf(store);
    if (storefront) {
      this.storefrontStore.set(storefront);
    }
  }

  onStorefrontSaved(event: { store: StoreStorefront; message: string }): void {
    this.storefrontStore.set(null);
    this.notification.toast(event.message, 'success');
    this.storefronts.update((map) => new Map(map).set(event.store.id, event.store));
  }

  async copyStorefrontLink(url: string): Promise<void> {
    if (await copyText(url)) {
      this.notification.toast('Lien de la vitrine copié', 'success');
    }
  }

  onSearch(): void {
    this.loadStores(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) {
      return;
    }
    this.loadStores(page);
  }

  // --- Entreprise --------------------------------------------------------

  onCompanySaved(message: string): void {
    this.isCompanyFormOpen.set(false);
    this.notification.toast(message, 'success');
    this.loadCompany();
  }

  async askDeleteCompany(): Promise<void> {
    const company = this.company();
    if (!company) {
      return;
    }

    const confirmed = await this.notification.confirm({
      title: 'Supprimer cette entreprise ?',
      text: `« ${company.name} » et ses ${company.stores_count} boutique(s) seront supprimées, et tous ses utilisateurs seront désactivés.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.companyService.delete(company.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.router.navigateByUrl('/admin/companies');
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  // --- Boutiques ---------------------------------------------------------

  openCreateStore(): void {
    this.editingStore.set(null);
    this.isStoreFormOpen.set(true);
  }

  openEditStore(store: Store): void {
    this.editingStore.set(store);
    this.isStoreFormOpen.set(true);
  }

  onStoreSaved(message: string): void {
    const isEdit = this.editingStore() !== null;
    this.isStoreFormOpen.set(false);
    this.notification.toast(message, 'success');
    this.loadStores(isEdit ? this.currentPage() : 1);
    this.loadStorefronts();
    if (!isEdit) {
      this.loadCompany(); // met à jour stores_count
    }
  }

  async toggleStore(store: Store): Promise<void> {
    const isDisabling = store.active;

    const confirmed = await this.notification.confirm({
      title: isDisabling ? 'Désactiver cette boutique ?' : 'Réactiver cette boutique ?',
      text: isDisabling
        ? `« ${store.name} » ne sera plus accessible tant qu'elle n'aura pas été réactivée.`
        : `« ${store.name} » redeviendra accessible.`,
      confirmText: isDisabling ? 'Désactiver' : 'Réactiver',
      cancelText: 'Annuler',
      danger: isDisabling
    });

    if (!confirmed) {
      return;
    }

    this.companyService.toggleStoreStatus(store.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.loadStores(this.currentPage());
        this.loadStorefronts();
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  async askDeleteStore(store: Store): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer cette boutique ?',
      text: `« ${store.name} » sera supprimée. Une boutique contenant des produits, ventes, clients ou utilisateurs ne peut pas être supprimée.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.companyService.deleteStore(store.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        const page = this.stores().length === 1 ? Math.max(1, this.currentPage() - 1) : this.currentPage();
        this.loadStores(page);
        this.loadCompany();
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }
}
