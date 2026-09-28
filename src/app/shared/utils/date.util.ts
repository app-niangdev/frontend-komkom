/**
 * Manipulation de dates « calendrier » au format ISO (YYYY-MM-DD), sans fuseau horaire :
 * les calculs se font en UTC pour éviter les décalages d'un jour.
 */

export function todayIso(): string {
  const now = new Date();
  return toIso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/**
 * Fin d'une période de `months` mois commençant le `startIso` (bornes incluses) :
 * du 15/01 pour 1 mois -> 14/02. Le jour est borné à la fin du mois (31/01 + 1 mois -> 28/02).
 */
export function periodEnd(startIso: string, months: number): string {
  const start = parseIso(startIso);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  if (start.getUTCDate() > lastDay) {
    // Mois cible plus court : la période s'arrête à son dernier jour
    target.setUTCDate(lastDay);
    return toIso(target);
  }
  target.setUTCDate(start.getUTCDate());
  return addDays(toIso(target), -1);
}

/** Nombre de jours couverts par [start ; end], bornes incluses. */
export function daysBetweenInclusive(startIso: string, endIso: string): number {
  return Math.round((parseIso(endIso).getTime() - parseIso(startIso).getTime()) / 86_400_000) + 1;
}

export function formatIsoDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
