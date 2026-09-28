import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  input,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Granularity, SeriesPoint } from '../../../core/models/admin-stats.model';
import { bucketAxisLabel, bucketLongLabel, formatCompact, formatNumber } from '../../utils/format.util';

const HEIGHT = 240;
const MARGIN = { top: 14, right: 12, bottom: 30, left: 52 };
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;

interface Tick {
  value: number;
  y: number;
  label: string;
}

/**
 * Série temporelle unique en SVG (colonnes ou aire), sans dépendance :
 * infobulle au survol / au clavier (flèches), graduations arrondies, vue tableau.
 */
@Component({
  selector: 'app-time-series-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-series-chart.component.html',
  styleUrl: './time-series-chart.component.scss'
})
export class TimeSeriesChartComponent implements AfterViewInit, OnDestroy {
  readonly points = input.required<SeriesPoint[]>();
  readonly granularity = input.required<Granularity>();
  readonly kind = input<'column' | 'area'>('column');
  /** Nom de la série (lecteurs d'écran, en-tête du tableau). */
  readonly label = input.required<string>();
  readonly formatValue = input<(value: number) => string>(formatNumber);
  /** Rechargement en cours : le graphique garde son rendu, estompé. */
  readonly loading = input(false);

  private readonly frame = viewChild.required<ElementRef<HTMLDivElement>>('frame');
  private resizeObserver?: ResizeObserver;

  protected readonly height = HEIGHT;
  protected readonly margin = MARGIN;
  protected readonly width = signal(640);
  protected readonly activeIndex = signal<number | null>(null);
  protected readonly showTable = signal(false);

  protected readonly plotWidth = computed(() => Math.max(40, this.width() - MARGIN.left - MARGIN.right));
  protected readonly plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  protected readonly baselineY = MARGIN.top + this.plotHeight;

  protected readonly isEmpty = computed(() => this.points().every((p) => p.value === 0));

  /** Échelle « propre » : 4 graduations environ, pas de 1 / 2 / 2,5 / 5 × 10^n. */
  protected readonly scale = computed(() => {
    const max = Math.max(0, ...this.points().map((p) => p.value));
    if (max === 0) {
      return { max: 1, step: 1 };
    }
    const rough = max / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
    return { max: Math.ceil(max / step) * step, step };
  });

  protected readonly ticks = computed<Tick[]>(() => {
    const { max, step } = this.scale();
    if (this.isEmpty()) {
      return [{ value: 0, y: this.baselineY, label: '0' }];
    }
    const ticks: Tick[] = [];
    for (let v = 0; v <= max + step / 2; v += step) {
      ticks.push({ value: v, y: this.y(v), label: formatCompact(v) });
    }
    return ticks;
  });

  protected readonly band = computed(() => this.plotWidth() / Math.max(1, this.points().length));

  protected readonly bars = computed(() => {
    const band = this.band();
    const barWidth = Math.max(1, Math.min(MAX_BAR_WIDTH, band - BAR_GAP, band * 0.72));
    return this.points().map((p, i) => {
      const cx = this.x(i);
      const top = this.y(p.value);
      return { path: roundedTopBar(cx - barWidth / 2, top, barWidth, this.baselineY), hasValue: p.value > 0 };
    });
  });

  protected readonly linePath = computed(() =>
    this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${this.x(i).toFixed(1)},${this.y(p.value).toFixed(1)}`)
      .join(' ')
  );

  protected readonly areaPath = computed(() => {
    const n = this.points().length;
    if (n === 0) {
      return '';
    }
    return `${this.linePath()} L${this.x(n - 1).toFixed(1)},${this.baselineY} L${this.x(0).toFixed(1)},${this.baselineY} Z`;
  });

  /** Libellés d'abscisse espacés d'au moins ~72px, le premier toujours présent. */
  protected readonly xLabels = computed(() => {
    const points = this.points();
    const maxLabels = Math.max(2, Math.floor(this.plotWidth() / 72));
    const every = Math.max(1, Math.ceil(points.length / maxLabels));
    return points
      .map((p, i) => ({ i, x: this.x(i), text: bucketAxisLabel(p.bucket, this.granularity()) }))
      .filter(({ i }) => i % every === 0);
  });

  protected readonly tooltip = computed(() => {
    const i = this.activeIndex();
    const point = i === null ? null : this.points()[i];
    if (i === null || !point) {
      return null;
    }
    const x = this.x(i);
    const tooltipWidth = 180;
    const left = Math.min(Math.max(x - tooltipWidth / 2, 0), this.width() - tooltipWidth);
    return {
      left,
      x,
      y: this.y(point.value),
      value: this.formatValue()(point.value),
      label: bucketLongLabel(point.bucket, this.granularity())
    };
  });

  protected readonly tableRows = computed(() =>
    this.points().map((p) => ({
      label: bucketLongLabel(p.bucket, this.granularity()),
      value: this.formatValue()(p.value)
    }))
  );

  ngAfterViewInit(): void {
    const element = this.frame().nativeElement;
    this.width.set(element.clientWidth || 640);
    this.resizeObserver = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) {
        this.width.set(w);
      }
    });
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /** Le curseur désigne l'intervalle le plus proche : pas besoin de viser la marque. */
  onPointerMove(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const scaleX = this.width() / rect.width;
    const plotX = (event.clientX - rect.left) * scaleX - MARGIN.left;
    const n = this.points().length;
    if (n === 0) {
      return;
    }
    const i = Math.floor(plotX / this.band());
    this.activeIndex.set(Math.min(n - 1, Math.max(0, i)));
  }

  onKeydown(event: KeyboardEvent): void {
    const n = this.points().length;
    if (n === 0) {
      return;
    }
    const current = this.activeIndex() ?? -1;
    const moves: Record<string, number> = {
      ArrowRight: Math.min(n - 1, current + 1),
      ArrowLeft: Math.max(0, current - 1),
      Home: 0,
      End: n - 1
    };
    if (event.key in moves) {
      event.preventDefault();
      this.activeIndex.set(moves[event.key]);
    } else if (event.key === 'Escape') {
      this.activeIndex.set(null);
    }
  }

  onFocus(): void {
    if (this.activeIndex() === null && this.points().length > 0) {
      this.activeIndex.set(this.points().length - 1);
    }
  }

  private x(i: number): number {
    return MARGIN.left + this.band() * (i + 0.5);
  }

  private y(value: number): number {
    return MARGIN.top + this.plotHeight - (value / this.scale().max) * this.plotHeight;
  }
}

/** Colonne à extrémité arrondie (4px) et base carrée, posée sur la ligne de base. */
function roundedTopBar(x: number, top: number, width: number, baseline: number): string {
  const height = baseline - top;
  if (height <= 0) {
    return '';
  }
  const r = Math.min(4, width / 2, height);
  return [
    `M${x},${baseline}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${baseline}`,
    'Z'
  ].join(' ');
}
