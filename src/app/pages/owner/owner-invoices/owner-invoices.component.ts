import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PosService } from '../../../core/owner/pos.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { InvoiceFilter, InvoiceStatus, OwnerInvoice, OwnerInvoicesQuery, OwnerInvoicesResponse } from '../../../core/owner/pos.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { PeriodFilterComponent, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '../owner-labels.util';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';

interface InvoiceKpi {
  label: string;
  icon: string;
  value: string;
  hint?: string;
  tone?: 'due';
}

/** Factures & reçus : suivi de la période, reste à encaisser, encaissement et impression. */
@Component({
  selector: 'app-owner-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PeriodFilterComponent, StoreBlockedComponent, InvoiceDetailComponent],
  templateUrl: './owner-invoices.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-invoices.component.scss']
})
export class OwnerInvoicesComponent {
  private readonly posService = inject(PosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly context = inject(StoreContextService);

  protected readonly statusLabels = PAYMENT_STATUS_LABELS;
  protected readonly statuses = Object.keys(PAYMENT_STATUS_LABELS) as InvoiceStatus[];
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  private readonly range = signal<PeriodRange | null>(null);
  protected status: InvoiceFilter = '';
  protected search = '';

  protected readonly result = signal<OwnerInvoicesResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Facture ouverte, éventuellement directement sur l'encaissement. */
  protected readonly selected = signal<{ id: number; pay: boolean } | null>(null);

  protected readonly moneyFormatter = computed(() => {
    const currency = this.result()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });
  protected money = (value: number) => this.moneyFormatter()(value);

  protected readonly kpis = computed<InvoiceKpi[]>(() => {
    const s = this.result()?.summary;
    if (!s) {
      return [];
    }
    const money = this.moneyFormatter();
    const byType = Object.entries(s.collected_by_type)
      .filter(([, total]) => (total ?? 0) > 0)
      .map(([type, total]) => `${PAYMENT_TYPE_LABELS[type] ?? type} ${formatNumber(total ?? 0)}`)
      .join(' · ');
    return [
      { label: 'Facturé', icon: 'bi-receipt', value: money(s.invoiced), hint: `${formatNumber(s.invoices_count)} facture(s) sur la période` },
      { label: 'Encaissé sur la période', icon: 'bi-wallet2', value: money(s.collected), hint: byType || undefined },
      {
        label: 'Reste à encaisser',
        icon: 'bi-hourglass-split',
        value: money(s.outstanding),
        hint: s.open_count > 0 ? `${formatNumber(s.open_count)} facture(s) ouverte(s), toutes périodes` : 'Aucune facture en attente',
        tone: s.outstanding > 0 ? 'due' : undefined
      }
    ];
  });

  constructor() {
    const open = Number(this.route.snapshot.queryParamMap.get('open'));
    if (open) {
      this.selected.set({ id: open, pay: false });
    }

    effect(() => {
      const range = this.range();
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!range || !this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.result.set(null) : this.load(1)));
    }, { allowSignalWrites: true });
  }

  onRange(range: PeriodRange): void {
    this.range.set(range);
  }

  applyFilters(): void {
    this.load(1);
  }

  hasFilters(): boolean {
    return !!(this.status || this.search);
  }

  resetFilters(): void {
    this.status = '';
    this.search = '';
    this.load(1);
  }

  showDue(): void {
    this.status = 'due';
    this.load(1);
  }

  open(invoice: OwnerInvoice, pay = false): void {
    this.selected.set({ id: invoice.id, pay });
  }

  closeDetail(): void {
    this.selected.set(null);
    // Retire ?open= pour qu'un rechargement ne rouvre pas la facture
    if (this.route.snapshot.queryParamMap.has('open')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  goToPage(page: number): void {
    this.load(page);
  }

  reload(): void {
    this.load(this.result()?.meta.current_page ?? 1);
  }

  private load(page: number): void {
    const range = this.range();
    if (!range) {
      return;
    }
    const query: OwnerInvoicesQuery = {
      store_id: this.context.selectedId(),
      start: range.start,
      end: range.end,
      status: this.status,
      search: this.search,
      page
    };
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.posService.invoices(query).subscribe({
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
