import { CustomerReminderState, ReminderBlocker } from '../../../core/owner/owner.model';
import { formatIsoDate } from '../../../shared/utils/date.util';

export const REMINDER_BLOCKER_LABELS: Record<ReminderBlocker, string> = {
  disabled: 'Envois WhatsApp non activés pour cette boutique',
  no_phone: 'Numéro de téléphone absent ou invalide',
  no_debt: 'Ce client ne doit rien',
  recent: 'Déjà relancé récemment'
};

/** Pourquoi le bouton « Relancer » est grisé (info-bulle), ou son libellé quand il est actif. */
export function reminderHint(reminder: CustomerReminderState): string {
  if (reminder.blocker === 'recent' && reminder.last_at) {
    return `Déjà relancé le ${formatIsoDate(reminder.last_at)}`;
  }
  return reminder.blocker ? REMINDER_BLOCKER_LABELS[reminder.blocker] : 'Relancer sur WhatsApp';
}
