import { Granularity } from '../../core/models/admin-stats.model';

const integerFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return integerFormat.format(value);
}

/** 12 900 -> « 12,9 k » : graduations d'axe et valeurs de tuiles. */
export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

export function formatMoney(value: number, currency: string): string {
  return `${integerFormat.format(value)} ${currency}`;
}

function utcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const longMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fullDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Libellé court d'un intervalle, pour l'axe des abscisses. */
export function bucketAxisLabel(bucket: string, granularity: Granularity): string {
  return granularity === 'month' ? shortMonth.format(utcDate(bucket)) : shortDay.format(utcDate(bucket));
}

/** Libellé complet d'un intervalle, pour l'infobulle et le tableau. */
export function bucketLongLabel(bucket: string, granularity: Granularity): string {
  switch (granularity) {
    case 'month': {
      const label = longMonth.format(utcDate(bucket));
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    case 'week':
      return `Semaine du ${fullDay.format(utcDate(bucket))}`;
    default: {
      const label = longDay.format(utcDate(bucket));
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
}
