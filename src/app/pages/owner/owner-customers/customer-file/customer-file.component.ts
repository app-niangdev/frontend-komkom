import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { OwnerCustomerFile } from '../../../../core/owner/owner.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { formatIsoDate } from '../../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { PAYMENT_STATUS_LABELS, SALE_STATUS_LABELS } from '../../owner-labels.util';
import { OwnerSaleDetailComponent } from '../../owner-sales/owner-sale-detail/owner-sale-detail.component';
import { reminderHint } from '../reminder.util';

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
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  readonly customerId = input.required<number>();
  readonly edit = output<void>();
  /** Une relance WhatsApp vient d'être envoyée (liste à recharger). */
  readonly reminded = output<void>();
  readonly closed = output<void>();

  protected readonly saleStatusLabels = SALE_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly reminderHint = reminderHint;

  protected readonly file = signal<OwnerCustomerFile | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly errorMessage = signal<string | null>(null);
  /** Vente ouverte depuis l'historique (détail empilé au-dessus de la fiche). */
  protected readonly openedSaleId = signal<number | null>(null);
  protected readonly isReminding = signal(false);

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.load();
  }

  async remind(): Promise<void> {
    const file = this.file();
    if (!file || file.reminder.blocker || this.isReminding()) {
      return;
    }
    const confirmed = await this.notification.confirm({
      title: `Relancer ${file.name} ?`,
      text: `Un message WhatsApp lui rappellera qu'il lui reste ${this.money(file.balance_due)} à régler, avec ses factures non soldées.`,
      confirmText: 'Envoyer la relance',
      cancelText: 'Annuler'
    });
    if (!confirmed) {
      return;
    }

    this.isReminding.set(true);
    this.ownerService.remindCustomer(file.id).subscribe({
      next: (res) => {
        this.isReminding.set(false);
        this.notification.toast(res.message, 'success');
        this.reminded.emit();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.isReminding.set(false);
        this.notification.error('Relance non envoyée', extractErrorMessage(err));
        this.load();
      }
    });
  }

  private load(): void {
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
