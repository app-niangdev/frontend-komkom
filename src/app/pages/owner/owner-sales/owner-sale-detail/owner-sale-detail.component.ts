import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { OwnerSaleDetail } from '../../../../core/owner/owner.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { formatIsoDate } from '../../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, SALE_STATUS_LABELS } from '../../owner-labels.util';

/** Détail d'une vente (lecture seule) : articles, montants, paiements reçus. */
@Component({
  selector: 'app-owner-sale-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owner-sale-detail.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './owner-sale-detail.component.scss']
})
export class OwnerSaleDetailComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);

  readonly saleId = input.required<number>();
  readonly closed = output<void>();

  protected readonly saleStatusLabels = SALE_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly paymentTypes = PAYMENT_TYPE_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  protected readonly sale = signal<OwnerSaleDetail | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly errorMessage = signal<string | null>(null);

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.ownerService.sale(this.saleId()).subscribe({
      next: (res) => {
        this.sale.set(res.data);
        this.currency.set(res.currency);
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(extractErrorMessage(err))
    });
  }
}
