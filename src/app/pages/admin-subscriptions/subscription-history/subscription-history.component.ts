import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SubscriptionStatus } from '../../../core/models/auth.model';
import { Subscription } from '../../../core/models/subscription.model';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { formatIsoDate, todayIso } from '../../../shared/utils/date.util';
import { SubscriptionFormComponent } from '../subscription-form/subscription-form.component';
import { STATE_LABELS, remainingLabel } from '../subscription-state.util';

/** Modale : état et historique des abonnements d'une boutique, avec ajout / modification / suppression. */
@Component({
  selector: 'app-subscription-history',
  standalone: true,
  imports: [CommonModule, SubscriptionFormComponent],
  templateUrl: './subscription-history.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './subscription-history.component.scss']
})
export class SubscriptionHistoryComponent implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly notification = inject(NotificationService);

  readonly store = input.required<SubscriptionStatus>();
  /** Émis après chaque modification, pour rafraîchir la vue d'ensemble. */
  readonly changed = output<void>();
  readonly closed = output<void>();

  protected readonly stateLabels = STATE_LABELS;
  protected readonly remainingLabel = remainingLabel;
  protected readonly formatIsoDate = formatIsoDate;
  private readonly today = todayIso();

  protected readonly status = signal<SubscriptionStatus | null>(null);
  protected readonly subscriptions = signal<Subscription[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<Subscription | null>(null);

  ngOnInit(): void {
    this.status.set(this.store());
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.subscriptionService.history(this.store().store_id).subscribe({
      next: (res) => {
        this.status.set(res.status);
        this.subscriptions.set(res.data);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? "Impossible de charger l'historique.");
      }
    });
  }

  /** Position de la période par rapport à aujourd'hui. */
  periodTag(sub: Subscription): 'current' | 'upcoming' | 'past' {
    if (sub.starts_at.slice(0, 10) > this.today) {
      return 'upcoming';
    }
    return sub.ends_at.slice(0, 10) < this.today ? 'past' : 'current';
  }

  openCreate(): void {
    this.editing.set(null);
    this.isFormOpen.set(true);
  }

  openEdit(sub: Subscription): void {
    this.editing.set(sub);
    this.isFormOpen.set(true);
  }

  onSaved(message: string): void {
    this.isFormOpen.set(false);
    this.notification.toast(message, 'success');
    this.load();
    this.changed.emit();
  }

  async askDelete(sub: Subscription): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer cet abonnement ?',
      text: `« ${sub.plan} » du ${formatIsoDate(sub.starts_at)} au ${formatIsoDate(sub.ends_at)}. Si cette période couvre aujourd'hui, la boutique peut devenir inaccessible.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.subscriptionService.delete(sub.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.load();
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }
}
