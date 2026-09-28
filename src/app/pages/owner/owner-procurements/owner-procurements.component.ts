import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import {
  OwnerSuppliesResponse,
  OwnerSupplier,
  OwnerSupply,
  SupplySort,
  SupplyStatus
} from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { PeriodFilterComponent, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { TimeSeriesChartComponent } from '../../../shared/components/time-series-chart/time-series-chart.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { SUPPLY_STATUS_LABELS, kpiDelta } from '../owner-labels.util';
import { ProcurementDetailComponent } from './procurement-detail/procurement-detail.component';
import { SupplyActionsService } from './supply-actions.service';

const STATUS_TABS: { key: SupplyStatus | ''; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'pending', label: 'À réceptionner' },
  { key: 'received', label: 'Reçus' },
  { key: 'cancelled', label: 'Annulés' }
];

/** Approvisionnements : achats reçus sur la période, reste à réceptionner, fournisseurs et détail. */
@Component({
  selector: 'app-owner-procurements',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PeriodFilterComponent,
    StoreBlockedComponent,
    TimeSeriesChartComponent,
    ProcurementDetailComponent
  ],
  templateUrl: './owner-procurements.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-procurements.component.scss']
})
export class OwnerProcurementsComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly actions = inject(SupplyActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly context = inject(StoreContextService);

  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly statusLabels = SUPPLY_STATUS_LABELS;
  protected readonly statusTabs = STATUS_TABS;

  private readonly range = signal<PeriodRange | null>(null);
  protected status: SupplyStatus | '' = '';
  protected supplierId: number | null = null;
  protected search = '';
  protected sort: SupplySort = 'recent';

  protected readonly result = signal<OwnerSuppliesResponse | null>(null);
  protected readonly suppliers = signal<OwnerSupplier[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly detailId = signal<number | null>(null);
  protected readonly busyId = signal<number | null>(null);
  private lastStoreId: number | null | undefined = undefined;

  protected readonly moneyFormatter = computed(() => {
    const currency = this.result()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });
  protected money = (value: number) => this.moneyFormatter()(value);

  protected readonly receivedDelta = computed(() => {
    const s = this.result()?.summary;
    return s ? kpiDelta(s.received) : null;
  });
  protected readonly countDelta = computed(() => {
    const s = this.result()?.summary;
    return s ? kpiDelta(s.received_count) : null;
  });

  protected readonly supplierMax = computed(() => Math.max(1, ...(this.result()?.summary.by_supplier ?? []).map((s) => s.total)));
  protected readonly productMax = computed(() => Math.max(1, ...(this.result()?.summary.top_products ?? []).map((p) => p.total)));

  /** Le plus ancien approvisionnement en attente précède la période affichée. */
  protected readonly pendingOutsidePeriod = computed(() => {
    const r = this.result();
    return !!r?.summary.pending.oldest && r.summary.pending.oldest.slice(0, 10) < r.period.start;
  });

  constructor() {
    // Ouverture directe d'un détail (retour du formulaire : ?open=ID)
    const open = Number(this.route.snapshot.queryParamMap.get('open'));
    if (open) {
      this.detailId.set(open);
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }

    effect(() => {
      const range = this.range();
      const storeId = this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!range || !this.context.loaded()) {
        return;
      }
      untracked(() => {
        if (blocked) {
          this.result.set(null);
          return;
        }
        // Les fournisseurs dépendent de la boutique : changement de boutique = filtre fournisseur retiré
        if (storeId !== this.lastStoreId) {
          this.lastStoreId = storeId;
          this.supplierId = null;
          this.loadSuppliers();
        }
        this.load(1);
      });
    }, { allowSignalWrites: true });
  }

  onRange(range: PeriodRange): void {
    this.range.set(range);
  }

  setStatus(status: SupplyStatus | ''): void {
    this.status = status;
    this.load(1);
  }

  /** Filtre la liste sur un fournisseur (clic dans le classement). */
  filterSupplier(id: number): void {
    this.supplierId = this.supplierId === id ? null : id;
    this.load(1);
  }

  resetFilters(): void {
    this.search = '';
    this.supplierId = null;
    this.status = '';
    this.load(1);
  }

  get filtersActive(): boolean {
    return !!(this.search || this.supplierId || this.status);
  }

  goToPage(page: number): void {
    const meta = this.result()?.meta;
    if (meta && page >= 1 && page <= meta.last_page) {
      this.load(page);
    }
  }

  async receive(supply: OwnerSupply, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.busyId()) {
      return;
    }
    this.busyId.set(supply.id);
    if (await this.actions.receive(supply, this.result()?.currency ?? 'XOF')) {
      this.reload();
    }
    this.busyId.set(null);
  }

  async cancel(supply: OwnerSupply, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.busyId()) {
      return;
    }
    this.busyId.set(supply.id);
    if (await this.actions.cancel(supply)) {
      this.reload();
    }
    this.busyId.set(null);
  }

  reload(): void {
    this.load(this.result()?.meta.current_page ?? 1);
    this.loadSuppliers();
  }

  load(page: number): void {
    const range = this.range();
    if (!range) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService
      .supplies(
        this.context.selectedId(),
        { ...range, status: this.status, supplier_id: this.supplierId, search: this.search, sort: this.sort },
        page
      )
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.isLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          this.errorMessage.set(extractErrorMessage(err));
        }
      });
  }

  private loadSuppliers(): void {
    this.ownerService.suppliers(this.context.selectedId()).subscribe({
      next: (suppliers) => this.suppliers.set(suppliers),
      error: () => this.suppliers.set([])
    });
  }
}
