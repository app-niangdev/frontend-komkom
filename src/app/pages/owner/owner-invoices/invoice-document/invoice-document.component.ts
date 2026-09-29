import { Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvoicePayment, OwnerInvoiceDetail } from '../../../../core/owner/pos.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { formatIsoDate } from '../../../../shared/utils/date.util';
import { PAYMENT_TYPE_LABELS } from '../../owner-labels.util';
import { printElement } from './print-document.util';

/** Facture A4, ticket de caisse (rouleau 80 ou 58 mm) ou reçu d'un paiement. */
export type DocumentKind = 'invoice' | 'ticket' | 'receipt';

/**
 * Documents imprimables d'une facture. Le composant n'est jamais affiché à l'écran :
 * `print()` envoie le document à l'imprimante.
 */
@Component({
  selector: 'app-invoice-document',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice-document.component.html',
  styleUrl: './invoice-document.component.scss'
})
export class InvoiceDocumentComponent {
  readonly invoice = input.required<OwnerInvoiceDetail>();
  readonly currency = input('XOF');
  readonly kind = input<DocumentKind>('invoice');
  /** Paiement concerné par un reçu (le dernier par défaut). */
  readonly paymentId = input<number | null>(null);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('doc');

  protected readonly paymentTypes = PAYMENT_TYPE_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;
  protected money = (value: number) => formatMoney(value, this.currency());

  protected readonly payment = computed<InvoicePayment | null>(() => {
    const payments = this.invoice().payments;
    return payments.find((p) => p.id === this.paymentId()) ?? payments[payments.length - 1] ?? null;
  });

  /** Déjà payé avant ce reçu, puis reste dû juste après : un reçu ancien reste exact. */
  protected readonly receiptFigures = computed(() => {
    const payments = this.invoice().payments;
    const current = this.payment();
    const index = current ? payments.findIndex((p) => p.id === current.id) : -1;
    const paidBefore = payments.slice(0, Math.max(index, 0)).reduce((sum, p) => sum + p.amount, 0);
    const paidAfter = paidBefore + (current?.amount ?? 0);
    return { paidBefore, paidAfter, remaining: Math.max(0, this.invoice().amount_total - paidAfter) };
  });

  /** Rouleau de l'imprimante ticket de la boutique (réglage « Mes boutiques »). */
  protected readonly ticketWidth = computed<58 | 80>(() => (this.invoice().issuer.ticket_width === 58 ? 58 : 80));

  protected readonly title = computed(() => {
    const inv = this.invoice();
    return { invoice: `Facture ${inv.number}`, ticket: `Ticket ${inv.sale.number ?? inv.number}`, receipt: `Reçu ${inv.number}` }[this.kind()];
  });

  print(): void {
    const format = this.kind() === 'invoice' ? 'a4' : this.ticketWidth() === 58 ? 'ticket58' : 'ticket80';
    printElement(this.root().nativeElement, format, this.title());
  }
}
