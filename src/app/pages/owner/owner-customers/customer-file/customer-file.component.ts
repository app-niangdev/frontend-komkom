import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { OwnerCustomerFile } from '../../../../core/owner/owner.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { formatIsoDate } from '../../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { PAYMENT_STATUS_LABELS, SALE_STATUS_LABELS } from '../../owner-labels.util';
import { OwnerSaleDetailComponent } from '../../owner-sales/owner-sale-detail/owner-sale-detail.component';

/** Fiche client : coordonnées, indicateurs, factures non soldées et historique d'achats. */
@Component({
  selector: 'app-customer-file',
  standalone: true,
  imports: [CommonModule, OwnerSaleDetailComponent],
  templateUrl: './customer-file.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './customer-file.component.scss']
})
export class CustomerFileComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);

  readonly customerId = input.required<number>();
  readonly edit = output<void>();
  readonly closed = output<void>();

  protected readonly saleStatusLabels = SALE_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  protected readonly file = signal<OwnerCustomerFile | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly errorMessage = signal<string | null>(null);
  /** Vente ouverte depuis l'historique (détail empilé au-dessus de la fiche). */
  protected readonly openedSaleId = signal<number | null>(null);

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.ownerService.customer(this.customerId()).subscribe({
      next: (res) => {
        this.file.set(res.data);
        this.currency.set(res.currency);
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(extractErrorMessage(err))
    });
  }

  /** Lien d'appel / WhatsApp : chiffres uniquement. */
  protected phoneDigits(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }
}
