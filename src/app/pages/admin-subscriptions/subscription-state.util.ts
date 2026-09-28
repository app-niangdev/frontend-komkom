import { SubscriptionState, SubscriptionStatus } from '../../core/models/auth.model';

export const STATE_LABELS: Record<SubscriptionState, string> = {
  active: 'Actif',
  expiring: 'Bientôt échu',
  expired: 'Expiré',
  none: 'Aucun abonnement'
};

export const STATE_ICONS: Record<SubscriptionState, string> = {
  active: 'bi-check-circle',
  expiring: 'bi-hourglass-split',
  expired: 'bi-x-circle',
  none: 'bi-dash-circle'
};

/** Libellé court des jours restants pour le tableau. */
export function remainingLabel(status: SubscriptionStatus): string {
  const days = status.days_left;
  if (days === null) {
    return '—';
  }
  if (days < 0) {
    const n = Math.abs(days);
    return `Expiré depuis ${n} j`;
  }
  if (days === 0) {
    return "Expire aujourd'hui";
  }
  return `${days} j restant${days > 1 ? 's' : ''}`;
}
