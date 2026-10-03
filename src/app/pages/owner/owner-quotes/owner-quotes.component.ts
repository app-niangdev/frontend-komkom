import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { QuoteService } from '../../../core/owner/quote.service';
import { OwnerQuote, OwnerQuotesResponse, QUOTE_STATUS_LABELS, QuoteStatus } from '../../../core/owner/quote.model';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { QuoteDetailComponent } from './quote-detail/quote-detail.component';

/** Devis : suivi par statut (brouillon, envoyé, accepté, refusé), recherche et détail. */
@Component({
  selector: 'app-owner-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, StoreBlockedComponent, QuoteDetailComponent],
  templateUrl: './owner-quotes.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './owner-quotes.component.scss']
})
export class OwnerQuotesComponent {
  private readonly quoteService = inject(QuoteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly context = inject(StoreContextService);

  protected readonly statusLabels = QUOTE_STATUS_LABELS;
  protected readonly statuses = Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[];
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  protected status: QuoteStatus | '' = '';
  protected search = '';

  protected readonly result = signal<OwnerQuotesResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedId = signal<number | null>(null);

  private readonly currency = computed(() => this.result()?.currency ?? 'XOF');
  protected money = (value: number) => formatMoney(value, this.currency());

  constructor() {
    const open = Number(this.route.snapshot.queryParamMap.get('open'));
    if (open) {
      this.selectedId.set(open);
    }

    effect(() => {
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.result.set(null) : this.load(1)));
    }, { allowSignalWrites: true });
  }

  async create(): Promise<void> {
    if (await this.context.ensureStore('créer le devis')) {
      this.router.navigate([this.context.base() + '/quotes/new']);
    }
  }

  filterStatus(status: QuoteStatus): void {
    this.status = this.status === status ? '' : status;
    this.load(1);
  }

  applyFilters(): void {
    this.load(1);
  }

  hasFilters(): boolean {
    return !!(this.status || this.search);
  }

  resetFilters(): void {
    this.status = '';
    this.search = '';
    this.load(1);
  }

  open(quote: OwnerQuote): void {
    this.selectedId.set(quote.id);
  }

  closeDetail(): void {
    this.selectedId.set(null);
    // Retire ?open= pour qu'un rechargement ne rouvre pas le devis
    if (this.route.snapshot.queryParamMap.has('open')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  goToPage(page: number): void {
    this.load(page);
  }

  reload(): void {
    this.load(this.result()?.meta.current_page ?? 1);
  }

  private load(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.quoteService
      .list({ store_id: this.context.selectedId(), status: this.status, search: this.search, page })
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
}
