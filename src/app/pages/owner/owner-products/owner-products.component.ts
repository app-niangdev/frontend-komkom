import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../core/owner/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerCategory, OwnerProduct, OwnerProductsResponse, StockState } from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { ProductFormComponent } from './product-form/product-form.component';

const STOCK_LABELS: Record<StockState, string> = {
  out: 'Rupture',
  low: 'Stock bas',
  ok: 'En stock'
};

@Component({
  selector: 'app-owner-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StoreBlockedComponent, ProductFormComponent],
  templateUrl: './owner-products.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-products.component.scss']
})
export class OwnerProductsComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly catalog = inject(CatalogService);
  private readonly notification = inject(NotificationService);
  /** Filtre catégorie venu de la page Catégories (?category=ID), appliqué au premier chargement. */
  private initialCategory: number | null = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('category')) || null;
  protected readonly context = inject(StoreContextService);

  protected readonly stockLabels = STOCK_LABELS;
  protected readonly stockStates = Object.keys(STOCK_LABELS) as StockState[];
  protected readonly formatNumber = formatNumber;

  protected search = '';
  protected categoryId: number | null = null;
  protected stock: StockState | '' = '';

  protected readonly result = signal<OwnerProductsResponse | null>(null);
  protected readonly categories = signal<OwnerCategory[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Formulaire ouvert : `id` null = nouveau produit. */
  protected readonly editing = signal<{ id: number | null } | null>(null);

  protected money = (value: number) => formatMoney(value, this.result()?.currency ?? 'XOF');

  constructor() {
    // Changement de boutique : les catégories changent aussi, on repart de zéro
    effect(() => {
      const storeId = this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => {
        this.categoryId = this.initialCategory;
        this.initialCategory = null;
        if (blocked) {
          this.result.set(null);
          return;
        }
        this.ownerService.categories(storeId).subscribe({ next: (c) => this.categories.set(c) });
        this.load(1);
      });
    }, { allowSignalWrites: true });
  }

  async openCreate(): Promise<void> {
    if (await this.context.ensureStore('ajouter ce produit')) {
      this.editing.set({ id: null });
    }
  }

  openEdit(product: OwnerProduct): void {
    this.editing.set({ id: product.id });
  }

  onSaved(): void {
    const creating = this.editing()?.id === null;
    this.editing.set(null);
    this.notification.toast(creating ? 'Produit créé.' : 'Produit mis à jour.', 'success');
    this.load(creating ? 1 : (this.result()?.meta.current_page ?? 1));
    // Une catégorie a pu être créée depuis le formulaire
    this.ownerService.categories(this.context.selectedId()).subscribe({ next: (c) => this.categories.set(c) });
  }

  async remove(product: OwnerProduct): Promise<void> {
    const ok = await this.notification.confirm({
      title: `Supprimer « ${product.name} » ?`,
      text: 'Le produit disparaît du catalogue et de la caisse ; les ventes et approvisionnements passés restent consultables.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });
    if (!ok) {
      return;
    }
    this.catalog.deleteProduct(product.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.load(this.result()?.meta.current_page ?? 1);
      },
      error: (err: HttpErrorResponse) => this.notification.error('Suppression impossible', extractErrorMessage(err))
    });
  }

  /** Filtre rapide depuis les compteurs (re-cliquer pour retirer). */
  toggleStock(state: StockState): void {
    this.stock = this.stock === state ? '' : state;
    this.load(1);
  }

  hasFilters(): boolean {
    return !!(this.search || this.categoryId || this.stock);
  }

  resetFilters(): void {
    this.search = '';
    this.categoryId = null;
    this.stock = '';
    this.load(1);
  }

  goToPage(page: number): void {
    const meta = this.result()?.meta;
    if (meta && page >= 1 && page <= meta.last_page) {
      this.load(page);
    }
  }

  load(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService
      .products(this.context.selectedId(), { search: this.search, category_id: this.categoryId, stock: this.stock }, page)
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.isLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          this.errorMessage.set(extractErrorMessage(err));
        }
      });
  }
}
