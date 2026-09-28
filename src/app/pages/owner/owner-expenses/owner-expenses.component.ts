import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ExpenseSort, OwnerExpense, OwnerExpensesResponse } from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { PeriodFilterComponent, PeriodRange } from '../../../shared/components/period-filter/period-filter.component';
import { TimeSeriesChartComponent } from '../../../shared/components/time-series-chart/time-series-chart.component';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { formatIsoDate } from '../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { kpiDelta } from '../owner-labels.util';
import { ExpenseFormComponent } from './expense-form/expense-form.component';

@Component({
  selector: 'app-owner-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodFilterComponent, StoreBlockedComponent, TimeSeriesChartComponent, ExpenseFormComponent],
  templateUrl: './owner-expenses.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss', './owner-expenses.component.scss']
})
export class OwnerExpensesComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  private readonly range = signal<PeriodRange | null>(null);
  protected search = '';
  protected sort: ExpenseSort = 'recent';

  protected readonly result = signal<OwnerExpensesResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Formulaire : undefined = fermé, null = ajout, dépense = modification. */
  protected readonly formExpense = signal<OwnerExpense | null | undefined>(undefined);

  protected readonly moneyFormatter = computed(() => {
    const currency = this.result()?.currency ?? 'XOF';
    return (value: number) => formatMoney(value, currency);
  });
  protected money = (value: number) => this.moneyFormatter()(value);

  /** Une hausse des dépenses n'est pas une bonne nouvelle. */
  protected readonly delta = computed(() => {
    const s = this.result()?.summary;
    return s ? kpiDelta({ value: s.total, previous: s.previous_total }, false) : null;
  });

  protected readonly titleMax = computed(() => Math.max(1, ...(this.result()?.summary.by_title ?? []).map((t) => t.total)));
  protected readonly storeMax = computed(() => Math.max(1, ...(this.result()?.summary.by_store ?? []).map((s) => s.total)));

  constructor() {
    effect(() => {
      const range = this.range();
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!range || !this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.result.set(null) : this.load(1)));
    }, { allowSignalWrites: true });
  }

  onRange(range: PeriodRange): void {
    this.range.set(range);
  }

  /** Clic sur un poste : filtre la liste sur cet intitulé. */
  filterTitle(title: string): void {
    this.search = this.search === title ? '' : title;
    this.load(1);
  }

  goToPage(page: number): void {
    const meta = this.result()?.meta;
    if (meta && page >= 1 && page <= meta.last_page) {
      this.load(page);
    }
  }

  onSaved(message: string): void {
    this.formExpense.set(undefined);
    this.notification.toast(message, 'success');
    this.load(this.result()?.meta.current_page ?? 1);
  }

  async askDelete(expense: OwnerExpense): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer cette dépense ?',
      text: `« ${expense.title} » de ${this.money(expense.amount)} du ${formatIsoDate(expense.date)}. Cette action est définitive.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.ownerService.deleteExpense(expense.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        const r = this.result();
        const page = r && r.data.length === 1 ? Math.max(1, r.meta.current_page - 1) : r?.meta.current_page ?? 1;
        this.load(page);
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  load(page: number): void {
    const range = this.range();
    if (!range) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService
      .expenses(this.context.selectedId(), range, { search: this.search, sort: this.sort }, page)
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
