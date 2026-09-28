import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PosService } from '../../../core/owner/pos.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerPaymentsQuery, OwnerPaymentsResponse, PaymentOrigin, PaymentType } from '../../../core/owner/pos.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { NotificationService } from '../../../core/services/notification.service';
import { PeriodFilterComponent, PeriodPreset, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { TimeSeriesChartComponent } from '../../../shared/components/time-series-chart/time-series-chart.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { addDays, formatIsoDate, todayIso } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { ExportFormat, saveBlob } from '../../../shared/utils/download.util';
import { KpiDelta, PAYMENT_TYPE_LABELS, kpiDelta } from '../owner-labels.util';
import { InvoiceDetailComponent, PAYMENT_METHODS } from '../owner-invoices/invoice-detail/invoice-detail.component';

const PERIODS: PeriodPreset[] = ['today', 'yesterday', 'week', 'month', 'year', 'custom'];

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Paiements : l'argent encaissé sur la période, compté le jour où il est reçu.
 * Un reste dû réglé un mois après la vente compte donc le jour du règlement.
 */
@Component({
  selector: 'app-owner-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodFilterComponent, StoreBlockedComponent, TimeSeriesChartComponent, InvoiceDetailComponent],
  templateUrl: './owner-payments.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-payments.component.scss']
})
export class OwnerPaymentsComponent {
  private readonly posService = inject(PosService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly periods = PERIODS;
  protected readonly methods = PAYMENT_METHODS;
  protected readonly typeLabels = PAYMENT_TYPE_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  private readonly range = signal<PeriodRange | null>(null);
  protected type: PaymentType | '' = '';
  protected origin: PaymentOrigin | '' = '';
  protected search = '';

  protected readonly result = signal<OwnerPaymentsResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isExporting = signal<ExportFormat | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly openInvoice = signal<number | null>(null);

  protected readonly moneyFormatter = computed(() => {
    const currency = this.result()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });
  protected money = (value: number) => this.moneyFormatter()(value);

  /** « Aujourd'hui », « Hier », un jour précis ou un intervalle. */
  protected readonly periodLabel = computed(() => {
    const p = this.result()?.period;
    if (!p) {
      return '';
    }
    if (p.start === p.end) {
      const today = todayIso();
      const day = longDay.format(new Date(`${p.start}T00:00:00Z`));
      return p.start === today ? `Aujourd'hui, ${day}` : p.start === addDays(today, -1) ? `Hier, ${day}` : day.charAt(0).toUpperCase() + day.slice(1);
    }
    return `Du ${formatIsoDate(p.start)} au ${formatIsoDate(p.end)} (${p.days} jours)`;
  });

  protected readonly previousLabel = computed(() => {
    const p = this.result()?.period;
    if (!p) {
      return '';
    }
    return p.days === 1 ? `la veille (${formatIsoDate(p.previous_start)})` : `la période précédente (${formatIsoDate(p.previous_start)} – ${formatIsoDate(p.previous_end)})`;
  });

  protected readonly delta = computed<KpiDelta | null>(() => {
    const s = this.result()?.summary;
    return s ? kpiDelta(s.total) : null;
  });

  /** Répartition par moyen de paiement : les 4 moyens, même à zéro, avec leur part. */
  protected readonly byType = computed(() => {
    const r = this.result();
    if (!r) {
      return [];
    }
    const total = r.summary.total.value;
    return this.methods.map((m) => {
      const row = r.by_type.find((t) => t.type === m.value);
      const amount = row?.total ?? 0;
      return { ...m, amount, count: row?.count ?? 0, share: total > 0 ? Math.round((amount / total) * 100) : 0 };
    });
  });

  protected readonly cashierMax = computed(() => Math.max(1, ...(this.result()?.by_cashier ?? []).map((c) => c.total)));

  constructor() {
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
    return !!(this.type || this.origin || this.search);
  }

  resetFilters(): void {
    this.type = '';
    this.origin = '';
    this.search = '';
    this.load(1);
  }

  /** Filtre rapide depuis une tuile (re-cliquer pour retirer). */
  toggleOrigin(origin: PaymentOrigin): void {
    this.origin = this.origin === origin ? '' : origin;
    this.load(1);
  }

  toggleType(type: PaymentType): void {
    this.type = this.type === type ? '' : type;
    this.load(1);
  }

  goToPage(page: number): void {
    this.load(page);
  }

  exportFile(format: ExportFormat): void {
    const query = this.query(1);
    if (!query || this.isExporting()) {
      return;
    }
    this.isExporting.set(format);

    this.posService.exportPayments(query, format).subscribe({
      next: (blob) => {
        this.isExporting.set(null);
        saveBlob(blob, `encaissements_${query.start}_${query.end}.${format}`);
      },
      error: () => {
        this.isExporting.set(null);
        this.notification.toast("L'export a échoué. Réessayez.", 'error');
      }
    });
  }


  /** Un paiement vient d'être ajouté depuis la facture ouverte : les chiffres changent. */
  reload(): void {
    this.load(this.result()?.meta.current_page ?? 1);
  }

  private load(page: number): void {
    const query = this.query(page);
    if (!query) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.posService.payments(query).subscribe({
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

  private query(page: number): OwnerPaymentsQuery | null {
    const range = this.range();
    if (!range) {
      return null;
    }
    return {
      store_id: this.context.selectedId(),
      start: range.start,
      end: range.end,
      type: this.type,
      origin: this.origin,
      search: this.search,
      page
    };
  }
}
