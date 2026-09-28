import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addDays, todayIso } from '../../utils/date.util';

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'week'
  | '7d'
  | '30d'
  | '90d'
  | 'month'
  | 'last_month'
  | 'year'
  | '12m'
  | 'custom';

export interface PeriodRange {
  start: string;
  end: string;
}

const LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  week: 'Cette semaine',
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
  month: 'Ce mois',
  last_month: 'Mois dernier',
  year: 'Cette année',
  '12m': '12 mois',
  custom: 'Personnalisé'
};

/** Préréglages affichés par défaut (tableaux de bord, analyses). */
export const DEFAULT_PRESETS: PeriodPreset[] = ['7d', '30d', '90d', 'month', 'last_month', 'year', '12m', 'custom'];

/** Calcule les bornes (incluses) d'un préréglage de période. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>): PeriodRange {
  const today = todayIso();
  const [y, m] = today.split('-').map(Number);
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;

  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const yesterday = addDays(today, -1);
      return { start: yesterday, end: yesterday };
    }
    case 'week': {
      // Semaine du lundi au jour courant
      const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { start: addDays(today, -weekday), end: today };
    }
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
    default:
      return { start: addDays(today, -29), end: today };
  }
}

/**
 * Filtre de période : préréglages + plage personnalisée.
 * Émet la plage retenue (au démarrage puis à chaque changement).
 */
@Component({
  selector: 'app-period-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './period-filter.component.html',
  styleUrl: './period-filter.component.scss'
})
export class PeriodFilterComponent implements OnInit {
  readonly initial = input<Exclude<PeriodPreset, 'custom'>>('30d');
  /** Préréglages proposés, dans l'ordre d'affichage. */
  readonly options = input<PeriodPreset[]>(DEFAULT_PRESETS);
  readonly rangeChange = output<PeriodRange>();

  protected readonly presets = computed(() => this.options().map((key) => ({ key, label: LABELS[key] })));
  protected readonly preset = signal<PeriodPreset>('30d');
  protected customStart = '';
  protected customEnd = '';
  private current: PeriodRange = presetRange('30d');

  ngOnInit(): void {
    this.preset.set(this.initial());
    this.current = presetRange(this.initial());
    this.rangeChange.emit(this.current);
  }

  select(key: PeriodPreset): void {
    this.preset.set(key);
    if (key === 'custom') {
      // On part de la période affichée pour l'ajuster
      this.customStart = this.current.start;
      this.customEnd = this.current.end;
      return;
    }
    this.current = presetRange(key);
    this.rangeChange.emit(this.current);
  }

  applyCustom(): void {
    if (this.customStart && this.customEnd && this.customStart <= this.customEnd) {
      this.current = { start: this.customStart, end: this.customEnd };
      this.rangeChange.emit(this.current);
    }
  }
}
