import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { OwnerSupplier, OwnerSupplierFile } from '../../../../core/owner/owner.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { SUPPLY_STATUS_LABELS } from '../../owner-labels.util';

/** Fiche fournisseur : contact, chiffres clés, derniers approvisionnements et produits achetés. */
@Component({
  selector: 'app-supplier-file',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './supplier-file.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './supplier-file.component.scss']
})
export class SupplierFileComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  protected readonly context = inject(StoreContextService);

  readonly supplierId = input.required<number>();
  readonly closed = output<void>();
  readonly edit = output<OwnerSupplier>();
  readonly remove = output<OwnerSupplier>();

  protected readonly statusLabels = SUPPLY_STATUS_LABELS;
  protected readonly formatNumber = formatNumber;

  protected readonly supplier = signal<OwnerSupplierFile | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly errorMessage = signal<string | null>(null);

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.ownerService.supplier(this.supplierId()).subscribe({
      next: (res) => {
        this.supplier.set(res.data);
        this.currency.set(res.currency);
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(extractErrorMessage(err))
    });
  }

  /** Lien WhatsApp, seulement pour un numéro au format international (+221..., 00221...). */
  whatsapp(phone: string): string | null {
    const trimmed = phone.trim();
    if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) {
      return null;
    }
    return 'https://wa.me/' + trimmed.replace(/\D/g, '').replace(/^00/, '');
  }
}
