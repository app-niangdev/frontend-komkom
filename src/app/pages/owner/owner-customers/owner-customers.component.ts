import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CustomerSegment, CustomerSort, OwnerCustomer, OwnerCustomersResponse } from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { CustomerFormComponent } from './customer-form/customer-form.component';
import { CustomerFileComponent } from './customer-file/customer-file.component';

const SORT_OPTIONS: { key: CustomerSort; label: string }[] = [
  { key: 'purchases', label: 'Meilleurs clients' },
  { key: 'debt', label: 'Plus gros reste dû' },
  { key: 'recent', label: 'Achat le plus récent' },
  { key: 'name', label: 'Nom (A → Z)' }
];

@Component({
  selector: 'app-owner-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, StoreBlockedComponent, CustomerFormComponent, CustomerFileComponent],
  templateUrl: './owner-customers.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-customers.component.scss']
})
export class OwnerCustomersComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  protected search = '';
  protected segment: CustomerSegment | '' = '';
  protected sort: CustomerSort = 'purchases';

  protected readonly result = signal<OwnerCustomersResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Client dont la fiche est ouverte. */
  protected readonly fileId = signal<number | null>(null);
  /** Formulaire : undefined = fermé, null = ajout, client = modification. */
  protected readonly formCustomer = signal<OwnerCustomer | null | undefined>(undefined);

  protected money = (value: number) => formatMoney(value, this.result()?.currency ?? 'XOF');

  constructor() {
    effect(() => {
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.result.set(null) : this.load(1)));
    }, { allowSignalWrites: true });
  }

  /** Les compteurs servent de filtres rapides (re-cliquer pour retirer). */
  toggleSegment(segment: CustomerSegment): void {
    this.segment = this.segment === segment ? '' : segment;
    // « À relancer » trie par reste dû ; on revient au tri par défaut en quittant ce filtre
    if (segment === 'debtors') {
      this.sort = this.segment ? 'debt' : 'purchases';
    }
    this.load(1);
  }

  hasFilters(): boolean {
    return !!(this.search || this.segment);
  }

  resetFilters(): void {
    this.search = '';
    this.segment = '';
    this.sort = 'purchases';
    this.load(1);
  }

  goToPage(page: number): void {
    const meta = this.result()?.meta;
    if (meta && page >= 1 && page <= meta.last_page) {
      this.load(page);
    }
  }

  /** Depuis la fiche : on bascule sur le formulaire du même client. */
  editFromFile(): void {
    const id = this.fileId();
    const customer = this.result()?.data.find((c) => c.id === id);
    this.fileId.set(null);
    if (customer) {
      this.formCustomer.set(customer);
    }
  }

  onSaved(message: string): void {
    this.formCustomer.set(undefined);
    this.notification.toast(message, 'success');
    this.load(this.result()?.meta.current_page ?? 1);
  }

  async askDelete(customer: OwnerCustomer): Promise<void> {
    if (customer.sales_count > 0) {
      return;
    }
    const confirmed = await this.notification.confirm({
      title: `Supprimer ${customer.name} ?`,
      text: 'Ce client n\'a aucun achat enregistré. Cette action est définitive.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.ownerService.deleteCustomer(customer.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        const r = this.result();
        const page = r && r.data.length === 1 ? Math.max(1, r.meta.current_page - 1) : r?.meta.current_page ?? 1;
        this.load(page);
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  load(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService
      .customers(this.context.selectedId(), { search: this.search, segment: this.segment, sort: this.sort }, page)
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
