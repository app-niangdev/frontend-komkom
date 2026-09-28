import { KpiValue } from '../../core/models/admin-stats.model';
import { PaymentStatus, SaleStatus, SupplyStatus } from '../../core/owner/owner.model';

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  pending: 'En attente',
  confirmed: 'Validée',
  cancelled: 'Annulée'
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  no_paid: 'Non payée',
  partial: 'Partielle',
  paid: 'Payée',
  cancelled: 'Annulée'
};

export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, string> = {
  pending: 'À réceptionner',
  received: 'Reçu',
  cancelled: 'Annulé'
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  OM: 'Orange Money',
  other: 'Autre'
};

export interface KpiDelta {
  text: string;
  direction: 'up' | 'down' | 'flat';
  /** Une hausse est-elle une bonne nouvelle ? (faux pour les dépenses) */
  good: boolean;
}

/** Évolution vs période précédente ; le sens est porté par la flèche et le texte, pas la seule couleur. */
export function kpiDelta(kpi: KpiValue, upIsGood = true): KpiDelta | null {
  if (kpi.previous === 0) {
    return kpi.value === 0 ? null : { text: 'Nouveau sur la période', direction: 'up', good: upIsGood };
  }
  const rounded = Math.round(((kpi.value - kpi.previous) / kpi.previous) * 100);
  if (rounded === 0) {
    return { text: 'Stable', direction: 'flat', good: true };
  }
  const direction = rounded > 0 ? 'up' : 'down';
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded} %`,
    direction,
    good: (direction === 'up') === upIsGood
  };
}
