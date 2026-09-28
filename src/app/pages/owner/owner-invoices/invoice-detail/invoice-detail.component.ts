import { Component, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PosService } from '../../../../core/owner/pos.service';
import { OwnerInvoiceDetail, PaymentType } from '../../../../core/owner/pos.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { formatIsoDate, todayIso } from '../../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '../../owner-labels.util';
import { DocumentKind, InvoiceDocumentComponent } from '../invoice-document/invoice-document.component';

export const PAYMENT_METHODS: { value: PaymentType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Espèces', icon: 'bi-cash-coin' },
  { value: 'wave', label: 'Wave', icon: 'bi-phone' },
  { value: 'OM', label: 'Orange Money', icon: 'bi-phone-fill' },
  { value: 'other', label: 'Autre', icon: 'bi-three-dots' }
];

/** Détail d'une facture : articles, paiements, encaissement du reste dû et impressions. */
@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, InvoiceDocumentComponent],
  templateUrl: './invoice-detail.component.html',
  styleUrls: [
    '../../../../../styles/_admin-crud.scss',
    '../../owner-sales/owner-sale-detail/owner-sale-detail.component.scss',
    './invoice-detail.component.scss'
  ]
})
export class InvoiceDetailComponent implements OnInit {
  private readonly posService = inject(PosService);
  private readonly notification = inject(NotificationService);

  readonly invoiceId = input.required<number>();
  /** Ouvre directement le formulaire d'encaissement. */
  readonly startWithPayment = input(false);
  readonly closed = output<void>();
  /** Un paiement a été enregistré : la liste doit être rechargée. */
  readonly changed = output<void>();

  private readonly documentRef = viewChild(InvoiceDocumentComponent);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly statusLabels = PAYMENT_STATUS_LABELS;
  protected readonly paymentTypes = PAYMENT_TYPE_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly today = todayIso();
  protected readonly Math = Math;

  protected readonly invoice = signal<OwnerInvoiceDetail | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly loadError = signal<string | null>(null);

  protected readonly showPayment = signal(false);
  protected amount: number | null = null;
  protected paymentType: PaymentType = 'cash';
  protected paymentDate = this.today;
  protected readonly isSubmitting = signal(false);
  protected readonly paymentError = signal<string | null>(null);

  protected readonly documentKind = signal<DocumentKind>('invoice');
  protected readonly receiptPaymentId = signal<number | null>(null);

  protected readonly canPay = computed(() => {
    const inv = this.invoice();
    return !!inv && inv.status !== 'cancelled' && inv.balance > 0;
  });

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.load(this.startWithPayment());
  }

  protected openPayment(): void {
    const inv = this.invoice();
    if (!inv) {
      return;
    }
    this.amount = inv.balance;
    this.paymentType = 'cash';
    this.paymentDate = this.today;
    this.paymentError.set(null);
    this.showPayment.set(true);
  }

  protected submitPayment(): void {
    const inv = this.invoice();
    if (!inv || this.isSubmitting()) {
      return;
    }
    const amount = Math.round(Number(this.amount));
    if (!amount || amount < 1) {
      this.paymentError.set('Saisissez le montant reçu.');
      return;
    }
    if (amount > inv.balance) {
      this.paymentError.set(`Le montant dépasse le reste à payer (${this.money(inv.balance)}).`);
      return;
    }

    this.isSubmitting.set(true);
    this.paymentError.set(null);
    this.posService.pay(inv.id, { amount, payment_type: this.paymentType, date: this.paymentDate }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.showPayment.set(false);
        this.notification.successAutoClose(res.message);
        this.changed.emit();
        this.load(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.paymentError.set(extractErrorMessage(err));
      }
    });
  }

  protected print(kind: DocumentKind, paymentId: number | null = null): void {
    this.documentKind.set(kind);
    this.receiptPaymentId.set(paymentId);
    // Laisse le document se mettre à jour avant de l'imprimer
    setTimeout(() => this.documentRef()?.print());
  }

  private load(thenPay: boolean): void {
    this.posService.invoice(this.invoiceId()).subscribe({
      next: (res) => {
        this.invoice.set(res.data);
        this.currency.set(res.currency);
        if (thenPay && this.canPay()) {
          this.openPayment();
        }
      },
      error: (err: HttpErrorResponse) => this.loadError.set(extractErrorMessage(err))
    });
  }
}
