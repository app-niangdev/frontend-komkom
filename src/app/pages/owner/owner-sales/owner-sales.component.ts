import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  OwnerSale,
  OwnerSalesQuery,
  OwnerSalesResponse,
  PaymentStatus,
  SaleSort,
  SaleStatus
} from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { PeriodFilterComponent, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { TimeSeriesChartComponent } from '../../../shared/components/time-series-chart/time-series-chart.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { ExportFormat, saveBlob } from '../../../shared/utils/download.util';
import { KpiDelta, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, SALE_STATUS_LABELS, kpiDelta } from '../owner-labels.util';
import { OwnerSaleDetailComponent } from './owner-sale-detail/owner-sale-detail.component';

interface SalesKpi {
  label: string;
  icon: string;
  value: string;
  hint?: string;
  delta?: KpiDelta | null;
  tone?: 'due' | 'muted';
}

@Component({
  selector: 'app-owner-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodFilterComponent, StoreBlockedComponent, TimeSeriesChartComponent, OwnerSaleDetailComponent],
  templateUrl: './owner-sales.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-sales.component.scss']
})
export class OwnerSalesComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly saleStatusLabels = SALE_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly paymentTypes = PAYMENT_TYPE_LABELS;
  protected readonly saleStatuses = Object.keys(SALE_STATUS_LABELS) as SaleStatus[];
  protected readonly paymentStatuses = Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[];
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  private readonly range = signal<PeriodRange | null>(null);
  protected status: SaleStatus | '' = '';
  protected paymentStatus: PaymentStatus | 'due' | '' = '';
  protected search = '';
  protected sort: SaleSort = 'recent';

  protected readonly result = signal<OwnerSalesResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isExporting = signal<ExportFormat | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedSale = signal<OwnerSale | null>(null);

  protected readonly moneyFormatter = computed(() => {
    const currency = this.result()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });
  protected money = (value: number) => this.moneyFormatter()(value);

  protected readonly kpis = computed<SalesKpi[]>(() => {
    const s = this.result()?.summary;
    if (!s) {
      return [];
    }
    const money = this.moneyFormatter();
    const rate = s.revenue.value > 0 ? Math.round((s.collected / s.revenue.value) * 100) : null;
    return [
      { label: "Chiffre d'affaires", icon: 'bi-cash-coin', value: money(s.revenue.value), delta: kpiDelta(s.revenue) },
      { label: 'Ventes validées', icon: 'bi-cart-check', value: formatNumber(s.sales_count.value), delta: kpiDelta(s.sales_count) },
      { label: 'Panier moyen', icon: 'bi-basket', value: money(s.average_basket.value), delta: kpiDelta(s.average_basket) },
      {
        label: 'Encaissé',
        icon: 'bi-wallet2',
        value: money(s.collected),
        hint: rate !== null ? `${rate} % du chiffre d'affaires` : undefined
      },
      { label: 'Reste à encaisser', icon: 'bi-hourglass-split', value: money(s.outstanding), tone: s.outstanding > 0 ? 'due' : undefined },
      {
        label: 'Annulées',
        icon: 'bi-x-circle',
        value: formatNumber(s.cancelled_count),
        hint: s.cancelled_count > 0 ? money(s.cancelled_amount) : undefined,
        tone: 'muted'
      }
    ];
  });

  protected readonly sellerMax = computed(() => Math.max(1, ...(this.result()?.by_seller ?? []).map((x) => x.revenue)));
  protected readonly paymentTotal = computed(() => (this.result()?.by_payment_type ?? []).reduce((sum, p) => sum + p.total, 0));

  constructor() {
    // La boutique (barre du haut) et la période relancent la recherche depuis la page 1
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
    return !!(this.status || this.paymentStatus || this.search);
  }

  resetFilters(): void {
    this.status = '';
    this.paymentStatus = '';
    this.search = '';
    this.load(1);
  }

  /** Raccourci depuis l'indicateur « Reste à encaisser ». */
  showUnpaid(): void {
    this.status = 'confirmed';
    this.paymentStatus = 'due';
    this.load(1);
  }

  goToPage(page: number): void {
    const meta = this.result()?.meta;
    if (meta && page >= 1 && page <= meta.last_page) {
      this.load(page);
    }
  }

  exportFile(format: ExportFormat): void {
    const query = this.query(1);
    if (!query || this.isExporting()) {
      return;
    }
    this.isExporting.set(format);

    this.ownerService.exportSales(query, format).subscribe({
      next: (blob) => {
        this.isExporting.set(null);
        saveBlob(blob, `ventes_${query.start}_${query.end}.${format}`);
      },
      error: () => {
        this.isExporting.set(null);
        this.notification.toast("L'export a échoué. Réessayez.", 'error');
      }
    });
  }


  load(page: number): void {
    const query = this.query(page);
    if (!query) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService.sales(query).subscribe({
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

  private query(page: number): OwnerSalesQuery | null {
    const range = this.range();
    if (!range) {
      return null;
    }
    return {
      store_id: this.context.selectedId(),
      start: range.start,
      end: range.end,
      status: this.status,
      payment_status: this.paymentStatus,
      search: this.search,
      sort: this.sort,
      page
    };
  }
}
