import { SubscriptionState, SubscriptionStatus } from './auth.model';
import { PageMeta } from './company.model';

/** Ligne de la vue d'ensemble : état calculé d'une boutique. */
export interface StoreSubscriptionStatus extends SubscriptionStatus {
  store_active: boolean;
  company_id: number;
}

export type SubscriptionCounts = Record<SubscriptionState, number>;

export interface StoreStatusesResponse {
  data: StoreSubscriptionStatus[];
  meta: PageMeta;
  counts: SubscriptionCounts;
}

export interface StoreStatusFilters {
  search: string;
  company_id: number | null;
  state: SubscriptionState | '';
}

/** Abonnement enregistré (période [starts_at ; ends_at], bornes incluses). */
export interface Subscription {
  id: number;
  store_id: number;
  plan: string;
  amount: string;
  currency: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  creator?: { id: number; full_name: string } | null;
}

export interface StoreSubscriptionHistory {
  status: SubscriptionStatus;
  data: Subscription[];
}

export interface SubscriptionPayload {
  store_id: number;
  plan: string;
  amount: number;
  currency: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
}
