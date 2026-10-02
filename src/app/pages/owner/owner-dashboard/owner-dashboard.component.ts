import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerDashboard } from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { TimeSeriesChartComponent } from '../../../shared/components/time-series-chart/time-series-chart.component';
import { PeriodFilterComponent, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { SubscriptionNoticeService } from '../../../core/auth/subscription-notice.service';
import { KpiDelta, kpiDelta } from '../owner-labels.util';

interface KpiTile {
  label: string;
  icon: string;
  value: string;
  hint?: string;
  delta: KpiDelta | null;
}

import { StorefrontLinkComponent } from '../../../shared/components/storefront-link/storefront-link.component';
@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule, TimeSeriesChartComponent, PeriodFilterComponent, StoreBlockedComponent, StorefrontLinkComponent],
  templateUrl: './owner-dashboard.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-dashboard.component.scss']
})
export class OwnerDashboardComponent {
  private readonly ownerService = inject(OwnerService);
  protected readonly context = inject(StoreContextService);

  protected readonly formatIsoDate = formatIsoDate;
  protected readonly formatNumber = formatNumber;
  protected readonly describeStatus = inject(SubscriptionNoticeService).describe;

  private readonly range = signal<PeriodRange | null>(null);
  protected readonly data = signal<OwnerDashboard | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly money = computed(() => {
    const currency = this.data()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });

  protected readonly tiles = computed<KpiTile[]>(() => {
    const d = this.data();
    if (!d) {
      return [];
    }
    const k = d.kpis;
    const money = this.money();
    // Vendeur : ses propres chiffres, sans les dépenses de la boutique
    const seller = this.context.isSeller();
    const tiles: KpiTile[] = [
      { label: seller ? 'Mon chiffre d\'affaires' : "Chiffre d'affaires", icon: 'bi-cash-coin', value: money(k.sales_revenue.value), delta: kpiDelta(k.sales_revenue) },
      { label: seller ? 'Mes ventes validées' : 'Ventes validées', icon: 'bi-cart-check', value: formatNumber(k.sales_count.value), delta: kpiDelta(k.sales_count) },
      { label: 'Panier moyen', icon: 'bi-basket', value: money(k.average_basket.value), delta: kpiDelta(k.average_basket) },
      { label: seller ? 'Mes encaissements' : 'Encaissements', icon: 'bi-wallet2', value: money(k.cash_in.value), hint: seller ? 'Paiements que vous avez reçus' : 'Paiements reçus sur la période', delta: kpiDelta(k.cash_in) }
    ];
    if (!seller) {
      tiles.push({ label: 'Dépenses', icon: 'bi-receipt', value: money(k.expenses.value), delta: kpiDelta(k.expenses, false) });
    }
    return tiles;
  });

  protected readonly scopeLabel = computed(() => this.context.selectedStore()?.name ?? 'Toutes les boutiques');
  protected readonly byStoreMax = computed(() => Math.max(1, ...(this.data()?.by_store ?? []).map((s) => s.revenue)));
  protected readonly topMax = computed(() => Math.max(1, ...(this.data()?.top_products ?? []).map((p) => p.revenue)));

  constructor() {
    // Rechargement à chaque changement de boutique (barre du haut) ou de période
    effect(() => {
      const range = this.range();
      const storeId = this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!range || !this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.data.set(null) : this.load(storeId, range)));
    }, { allowSignalWrites: true });
  }

  onRange(range: PeriodRange): void {
    this.range.set(range);
  }

  openStore(storeId: number): void {
    this.context.select(storeId);
  }

  private load(storeId: number | null, range: PeriodRange): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService.dashboard(storeId, range.start, range.end).subscribe({
      next: (data) => {
        this.data.set(data);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }
}
