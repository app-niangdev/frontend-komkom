import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerStoreOverview } from '../../../core/owner/owner.model';
import { PeriodFilterComponent, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { describeStatus } from '../../../core/auth/subscription-notice.service';
import { STATE_LABELS } from '../../admin-subscriptions/subscription-state.util';
import { StorefrontLinkComponent } from '../../../shared/components/storefront-link/storefront-link.component';

/** « Mes boutiques » : chaque boutique de l'entreprise avec ses indicateurs sur la période. */
@Component({
  selector: 'app-owner-stores',
  standalone: true,
  imports: [CommonModule, PeriodFilterComponent, StorefrontLinkComponent],
  templateUrl: './owner-stores.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-stores.component.scss']
})
export class OwnerStoresComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly router = inject(Router);
  private readonly context = inject(StoreContextService);

  protected readonly stateLabels = STATE_LABELS;
  protected readonly describeStatus = describeStatus;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly money = (value: number) => formatMoney(value, 'XOF');

  protected readonly stores = signal<OwnerStoreOverview[]>([]);
  protected readonly range = signal<PeriodRange | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly totals = computed(() => {
    const open = this.stores().filter((s) => !this.isBlocked(s));
    return {
      revenue: open.reduce((sum, s) => sum + s.sales_revenue, 0),
      sales: open.reduce((sum, s) => sum + s.sales_count, 0),
      receivables: open.reduce((sum, s) => sum + s.receivables, 0)
    };
  });

  onRange(range: PeriodRange): void {
    this.range.set(range);
    this.load();
  }

  isBlocked(store: OwnerStoreOverview): boolean {
    return store.subscription.state === 'expired' || store.subscription.state === 'none';
  }

  /** Entre dans la boutique : le sélecteur global bascule et on ouvre la page demandée. */
  open(store: OwnerStoreOverview, page: 'dashboard' | 'sales'): void {
    this.context.select(store.id);
    this.router.navigateByUrl(`/owner/${page}`);
  }

  private load(): void {
    const range = this.range();
    if (!range) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService.stores(range.start, range.end).subscribe({
      next: (stores) => {
        this.stores.set(stores);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }
}
