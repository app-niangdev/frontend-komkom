import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerSupplier, OwnerSuppliersResponse, SupplierSort } from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { NotificationService } from '../../../core/services/notification.service';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { SupplierFileComponent } from './supplier-file/supplier-file.component';
import { SupplierFormComponent } from './supplier-form/supplier-form.component';

const INACTIVE_AFTER_DAYS = 90;

/** Annuaire des fournisseurs : contacts, historique d'achats et gestion. */
@Component({
  selector: 'app-owner-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StoreBlockedComponent, SupplierFormComponent, SupplierFileComponent],
  templateUrl: './owner-suppliers.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-suppliers.component.scss']
})
export class OwnerSuppliersComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly formatNumber = formatNumber;

  protected search = '';
  protected sort: SupplierSort = 'name';

  protected readonly result = signal<OwnerSuppliersResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Formulaire : undefined = fermé, null = ajout, fournisseur = modification. */
  protected readonly formSupplier = signal<OwnerSupplier | null | undefined>(undefined);
  protected readonly fileId = signal<number | null>(null);

  protected readonly moneyFormatter = computed(() => {
    const currency = this.result()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });
  protected money = (value: number) => this.moneyFormatter()(value);

  constructor() {
    effect(() => {
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.result.set(null) : this.load()));
    }, { allowSignalWrites: true });
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.ownerService.supplierDirectory(this.context.selectedId(), { search: this.search, sort: this.sort }).subscribe({
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

  resetSearch(): void {
    this.search = '';
    this.load();
  }

  /** Aucune livraison reçue depuis plus de 90 jours. */
  isInactive(s: OwnerSupplier): boolean {
    if (!s.last_supply_at) {
      return false;
    }
    return Date.now() - new Date(s.last_supply_at).getTime() > INACTIVE_AFTER_DAYS * 86_400_000;
  }

  edit(supplier: OwnerSupplier, event?: Event): void {
    event?.stopPropagation();
    this.fileId.set(null);
    this.formSupplier.set(supplier);
  }

  onSaved(event: { supplier: OwnerSupplier; message: string }): void {
    const wasEdit = !!this.formSupplier();
    this.formSupplier.set(undefined);
    this.notification.toast(event.message, 'success');
    this.load();
    // Après modification, on revient sur la fiche
    if (wasEdit) {
      this.fileId.set(event.supplier.id);
    }
  }

  async askDelete(supplier: OwnerSupplier, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (supplier.pending_count > 0) {
      await this.notification.warning(
        'Suppression impossible pour le moment',
        `« ${supplier.name} » a ${supplier.pending_count} approvisionnement(s) en attente (${this.money(supplier.pending_amount)}). Réceptionnez-les ou annulez-les d'abord.`
      );
      return;
    }
    const confirmed = await this.notification.confirm({
      title: `Supprimer « ${supplier.name} » ?`,
      text:
        supplier.received_count > 0
          ? `Il ne sera plus proposé pour les nouveaux approvisionnements. Ses ${supplier.received_count} livraison(s) passée(s) restent consultables.`
          : 'Il ne sera plus proposé pour les nouveaux approvisionnements.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.ownerService.deleteSupplier(supplier.id).subscribe({
      next: (res) => {
        this.fileId.set(null);
        this.notification.toast(res.message, 'success');
        this.load();
      },
      error: (err: HttpErrorResponse) => this.notification.error('Suppression impossible', extractErrorMessage(err))
    });
  }
}
