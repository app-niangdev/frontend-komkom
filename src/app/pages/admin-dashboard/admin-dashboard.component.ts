import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminStatsService } from '../../core/services/admin-stats.service';
import { CompanyService } from '../../core/services/company.service';
import { AdminStats, KpiValue } from '../../core/models/admin-stats.model';
import { SubscriptionState } from '../../core/models/auth.model';
import { Company } from '../../core/models/company.model';
import { SubscriptionNoticeService } from '../../core/auth/subscription-notice.service';
import { TimeSeriesChartComponent } from '../../shared/components/time-series-chart/time-series-chart.component';
import { addDays, formatIsoDate, todayIso } from '../../shared/utils/date.util';
import { formatCompact, formatMoney, formatNumber } from '../../shared/utils/format.util';
import { extractErrorMessage } from '../../shared/utils/http-error.util';
import { STATE_ICONS, STATE_LABELS } from '../admin-subscriptions/subscription-state.util';

type PresetKey = '7d' | '30d' | '90d' | 'month' | 'last_month' | 'year' | '12m' | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
}

const PRESETS: Preset[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: '90d', label: '90 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'last_month', label: 'Mois dernier' },
  { key: 'year', label: 'Cette année' },
  { key: '12m', label: '12 mois' },
  { key: 'custom', label: 'Personnalisé' }
];

interface KpiTile {
  label: string;
  icon: string;
  value: string;
  hint?: string;
  delta: { text: string; direction: 'up' | 'down' | 'flat' } | null;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TimeSeriesChartComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['../../../styles/_admin-crud.scss', '../../../styles/_dashboard.scss', './admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private readonly statsService = inject(AdminStatsService);
  private readonly companyService = inject(CompanyService);

  protected readonly presets = PRESETS;
  protected readonly stateLabels = STATE_LABELS;
  protected readonly stateIcons = STATE_ICONS;
  protected readonly stateOrder: SubscriptionState[] = ['active', 'expiring', 'expired', 'none'];
  protected readonly describeStatus = inject(SubscriptionNoticeService).describe;
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly formatNumber = formatNumber;

  protected readonly preset = signal<PresetKey>('30d');
  protected customStart = addDays(todayIso(), -29);
  protected customEnd = todayIso();
  protected companyId: number | null = null;

  protected readonly companies = signal<Company[]>([]);
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly moneyFormatter = computed(() => {
    const currency = this.stats()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });

  protected readonly kpiTiles = computed<KpiTile[]>(() => {
    const s = this.stats();
    if (!s) {
      return [];
    }
    const k = s.kpis;
    const money = this.moneyFormatter();
    return [
      {
        label: 'Revenus des abonnements',
        icon: 'bi-credit-card-2-front',
        value: money(k.subscription_revenue.value),
        hint: `${formatNumber(k.paid_subscriptions.value)} abonnement(s) payant(s) saisi(s)`,
        delta: this.delta(k.subscription_revenue)
      },
      {
        label: "Chiffre d'affaires des boutiques",
        icon: 'bi-cart-check',
        value: money(k.sales_revenue.value),
        hint: `${formatNumber(k.sales_count.value)} vente(s) validée(s)`,
        delta: this.delta(k.sales_revenue)
      },
      {
        label: 'Nouvelles entreprises',
        icon: 'bi-building',
        value: formatNumber(k.new_companies.value),
        delta: this.delta(k.new_companies)
      },
      {
        label: 'Nouvelles boutiques',
        icon: 'bi-shop',
        value: formatNumber(k.new_stores.value),
        delta: this.delta(k.new_stores)
      },
      {
        label: 'Nouveaux utilisateurs',
        icon: 'bi-people',
        value: formatNumber(k.new_users.value),
        delta: this.delta(k.new_users)
      }
    ];
  });

  protected readonly topMax = computed(() => Math.max(1, ...(this.stats()?.top_companies ?? []).map((c) => c.revenue)));

  protected readonly statesTotal = computed(() => {
    const counts = this.stats()?.subscription_states.counts;
    return counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  });

  ngOnInit(): void {
    this.companyService.list(1, 100, '').subscribe({ next: (res) => this.companies.set(res.data) });
    this.load();
  }

  selectPreset(key: PresetKey): void {
    this.preset.set(key);
    if (key === 'custom') {
      // On part de la période affichée pour l'ajuster
      const period = this.stats()?.period;
      if (period) {
        this.customStart = period.start;
        this.customEnd = period.end;
      }
      return;
    }
    this.load();
  }

  applyCustomRange(): void {
    if (this.customStart && this.customEnd && this.customStart <= this.customEnd) {
      this.load();
    }
  }

  load(): void {
    const { start, end } = this.range();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.statsService.get({ start, end, company_id: this.companyId }).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }

  compact(value: number): string {
    return formatCompact(value);
  }

  private range(): { start: string; end: string } {
    const today = todayIso();
    const [y, m] = today.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;

    switch (this.preset()) {
      case '7d':
        return { start: addDays(today, -6), end: today };
      case '90d':
        return { start: addDays(today, -89), end: today };
      case 'month':
        return { start: monthStart, end: today };
      case 'last_month': {
        const lastMonthEnd = addDays(monthStart, -1);
        return { start: `${lastMonthEnd.slice(0, 7)}-01`, end: lastMonthEnd };
      }
      case 'year':
        return { start: `${y}-01-01`, end: today };
      case '12m':
        return { start: addDays(today, -364), end: today };
      case 'custom':
        return { start: this.customStart, end: this.customEnd };
      default:
        return { start: addDays(today, -29), end: today };
    }
  }

  /** Évolution vs période précédente ; le sens (flèche + texte) ne repose jamais sur la seule couleur. */
  private delta(kpi: KpiValue): KpiTile['delta'] {
    if (kpi.previous === 0) {
      return kpi.value === 0 ? null : { text: 'Nouveau sur la période', direction: 'up' };
    }
    const pct = ((kpi.value - kpi.previous) / kpi.previous) * 100;
    const rounded = Math.round(pct);
    if (rounded === 0) {
      return { text: 'Stable', direction: 'flat' };
    }
    return {
      text: `${rounded > 0 ? '+' : ''}${rounded} %`,
      direction: rounded > 0 ? 'up' : 'down'
    };
  }
}
