import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../core/owner/catalog.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerSerial, OwnerSerialsResponse, SerialStatus } from '../../../core/owner/catalog.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { NotificationService } from '../../../core/services/notification.service';
import { formatNumber } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  in_stock: 'En stock',
  sold: 'Vendu',
  pending: 'À réceptionner'
};

/**
 * IMEI / numéros de série : chaque appareil de la boutique, son entrée (approvisionnement),
 * sa vente éventuelle, et la correction d'un numéro mal saisi.
 */
@Component({
  selector: 'app-owner-serials',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StoreBlockedComponent],
  templateUrl: './owner-serials.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './owner-serials.component.scss']
})
export class OwnerSerialsComponent {
  private readonly catalog = inject(CatalogService);
  private readonly notification = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly context = inject(StoreContextService);

  protected readonly statusLabels = SERIAL_STATUS_LABELS;
  protected readonly statuses = Object.keys(SERIAL_STATUS_LABELS) as SerialStatus[];
  protected readonly formatNumber = formatNumber;

  protected search = '';
  protected status: SerialStatus | '' = '';
  /** Filtre produit venu de la fiche produit (?product=ID). */
  protected readonly productId = signal<number | null>(Number(this.route.snapshot.queryParamMap.get('product')) || null);

  protected readonly result = signal<OwnerSerialsResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly editing = signal<OwnerSerial | null>(null);
  protected draft = '';
  protected readonly isSaving = signal(false);
  protected readonly editError = signal<string | null>(null);

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

  /** Nom du produit filtré, lu sur les résultats. */
  productName(): string | null {
    const id = this.productId();
    return id ? (this.result()?.data.find((s) => s.product?.id === id)?.product?.name ?? 'ce produit') : null;
  }

  clearProduct(): void {
    this.productId.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    this.load(1);
  }

  toggleStatus(status: SerialStatus): void {
    this.status = this.status === status ? '' : status;
    this.load(1);
  }

  hasFilters(): boolean {
    return !!(this.search || this.status);
  }

  resetFilters(): void {
    this.search = '';
    this.status = '';
    this.load(1);
  }

  goToPage(page: number): void {
    this.load(page);
  }

  async copy(serial: OwnerSerial): Promise<void> {
    try {
      await navigator.clipboard.writeText(serial.serial_number);
      this.notification.toast('Numéro copié', 'success');
    } catch {
      // Presse-papiers indisponible : rien à faire
    }
  }

  openEdit(serial: OwnerSerial): void {
    this.draft = serial.serial_number;
    this.editError.set(null);
    this.editing.set(serial);
  }

  saveEdit(): void {
    const serial = this.editing();
    const value = this.draft.trim();
    if (!serial || this.isSaving()) {
      return;
    }
    if (value.length < 4) {
      this.editError.set('Le numéro doit contenir au moins 4 caractères.');
      return;
    }
    if (value === serial.serial_number) {
      this.editing.set(null);
      return;
    }
    this.isSaving.set(true);
    this.editError.set(null);
    this.catalog.updateSerial(serial.id, value).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.editing.set(null);
        this.notification.toast(res.message, 'success');
        const r = this.result();
        if (r) {
          this.result.set({ ...r, data: r.data.map((s) => (s.id === serial.id ? res.data : s)) });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.editError.set(extractErrorMessage(err));
      }
    });
  }

  protected load(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.catalog
      .serials({ store_id: this.context.selectedId(), search: this.search, status: this.status, product_id: this.productId(), page })
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
