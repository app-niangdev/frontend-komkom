import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SubscriptionService } from '../../core/services/subscription.service';
import { CompanyService } from '../../core/services/company.service';
import { NotificationService } from '../../core/services/notification.service';
import { SubscriptionState } from '../../core/models/auth.model';
import { Company } from '../../core/models/company.model';
import {
  StoreStatusFilters,
  StoreSubscriptionStatus,
  SubscriptionCounts
} from '../../core/models/subscription.model';
import { formatIsoDate } from '../../shared/utils/date.util';
import { SubscriptionHistoryComponent } from './subscription-history/subscription-history.component';
import { SubscriptionFormComponent } from './subscription-form/subscription-form.component';
import { STATE_ICONS, STATE_LABELS, remainingLabel } from './subscription-state.util';

const PER_PAGE = 15;

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, SubscriptionHistoryComponent, SubscriptionFormComponent],
  templateUrl: './admin-subscriptions.component.html',
  styleUrls: ['../../../styles/_admin-crud.scss', './admin-subscriptions.component.scss']
})
export class AdminSubscriptionsComponent implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly companyService = inject(CompanyService);
  private readonly notification = inject(NotificationService);

  protected readonly stateLabels = STATE_LABELS;
  protected readonly stateIcons = STATE_ICONS;
  protected readonly remainingLabel = remainingLabel;
  protected readonly formatIsoDate = formatIsoDate;
  /** Ordre d'affichage des compteurs : du plus urgent au plus serein. */
  protected readonly stateOrder: SubscriptionState[] = ['expired', 'none', 'expiring', 'active'];

  protected readonly rows = signal<StoreSubscriptionStatus[]>([]);
  protected readonly counts = signal<SubscriptionCounts>({ active: 0, expiring: 0, expired: 0, none: 0 });
  protected readonly companies = signal<Company[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected filters: StoreStatusFilters = { search: '', company_id: null, state: '' };

  /** Boutique dont on consulte l'historique. */
  protected readonly historyStore = signal<StoreSubscriptionStatus | null>(null);
  /** Boutique à renouveler directement depuis le tableau. */
  protected readonly renewStore = signal<StoreSubscriptionStatus | null>(null);

  ngOnInit(): void {
    this.load();
    this.companyService.list(1, 100, '').subscribe({ next: (res) => this.companies.set(res.data) });
  }

  load(page = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.subscriptionService.storeStatuses(page, PER_PAGE, this.filters).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.counts.set(res.counts);
        this.currentPage.set(res.meta.current_page);
        this.lastPage.set(res.meta.last_page);
        this.total.set(res.meta.total);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Impossible de charger les abonnements.');
      }
    });
  }

  applyFilters(): void {
    this.load(1);
  }

  /** Les compteurs servent aussi de filtre rapide (re-cliquer pour retirer le filtre). */
  toggleState(state: SubscriptionState): void {
    this.filters.state = this.filters.state === state ? '' : state;
    this.load(1);
  }

  hasActiveFilters(): boolean {
    return !!(this.filters.search || this.filters.company_id || this.filters.state);
  }

  resetFilters(): void {
    this.filters = { search: '', company_id: null, state: '' };
    this.load(1);
  }

  onRenewed(message: string): void {
    this.renewStore.set(null);
    this.notification.toast(message, 'success');
    this.load(this.currentPage());
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) {
      return;
    }
    this.load(page);
  }
}
