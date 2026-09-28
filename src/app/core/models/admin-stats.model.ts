import { SubscriptionState, SubscriptionStatus } from './auth.model';

export type Granularity = 'day' | 'week' | 'month';

export interface KpiValue {
  value: number;
  /** Même indicateur sur la période précédente de même durée. */
  previous: number;
}

export interface SeriesPoint {
  /** Début de l'intervalle (YYYY-MM-DD). */
  bucket: string;
  value: number;
}

export interface AdminStats {
  period: {
    start: string;
    end: string;
    days: number;
    granularity: Granularity;
    previous_start: string;
    previous_end: string;
  };
  currency: string;
  kpis: {
    subscription_revenue: KpiValue;
    paid_subscriptions: KpiValue;
    sales_revenue: KpiValue;
    sales_count: KpiValue;
    new_companies: KpiValue;
    new_stores: KpiValue;
    new_users: KpiValue;
  };
  series: {
    subscription_revenue: SeriesPoint[];
    sales_revenue: SeriesPoint[];
  };
  top_companies: { id: number; name: string; sales_count: number; revenue: number }[];
  subscription_states: {
    counts: Record<SubscriptionState, number>;
    attention: SubscriptionStatus[];
  };
}

export interface AdminStatsQuery {
  start: string;
  end: string;
  company_id: number | null;
}
