import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionStatus } from '../../../core/models/auth.model';
import { Subscription, SubscriptionPayload } from '../../../core/models/subscription.model';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { addDays, daysBetweenInclusive, formatIsoDate, periodEnd, todayIso } from '../../../shared/utils/date.util';

interface Duration {
  months: number;
  plan: string;
}

const DURATIONS: Duration[] = [
  { months: 1, plan: 'Mensuel' },
  { months: 3, plan: 'Trimestriel' },
  { months: 6, plan: 'Semestriel' },
  { months: 12, plan: 'Annuel' }
];

/** Modale d'ajout (renouvellement) ou de modification d'un abonnement de boutique. */
@Component({
  selector: 'app-subscription-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-form.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './subscription-form.component.scss']
})
export class SubscriptionFormComponent implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);

  /** Boutique concernée, avec son état actuel (sert à proposer la date de reprise). */
  readonly store = input.required<SubscriptionStatus>();
  /** Abonnement à modifier, ou null pour un nouvel abonnement. */
  readonly subscription = input<Subscription | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly durations = DURATIONS;
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly selectedMonths = signal<number | null>(1);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected form: Omit<SubscriptionPayload, 'store_id'> = {
    plan: 'Mensuel',
    amount: 0,
    currency: 'XOF',
    starts_at: todayIso(),
    ends_at: todayIso(),
    notes: ''
  };

  ngOnInit(): void {
    const existing = this.subscription();
    if (existing) {
      this.form = {
        plan: existing.plan,
        amount: Number(existing.amount),
        currency: existing.currency,
        starts_at: existing.starts_at.slice(0, 10),
        ends_at: existing.ends_at.slice(0, 10),
        notes: existing.notes ?? ''
      };
      this.selectedMonths.set(null);
      return;
    }

    // Renouvellement : on enchaîne sur la période en cours, sinon on repart d'aujourd'hui
    const store = this.store();
    const stillCovered = (store.state === 'active' || store.state === 'expiring') && store.ends_at;
    this.form.starts_at = stillCovered ? addDays(store.ends_at!, 1) : todayIso();
    this.applyDuration(DURATIONS[0]);
  }

  applyDuration(duration: Duration): void {
    this.selectedMonths.set(duration.months);
    this.form.plan = duration.plan;
    this.form.ends_at = periodEnd(this.form.starts_at, duration.months);
  }

  onStartChange(value: string): void {
    this.form.starts_at = value;
    const months = this.selectedMonths();
    if (months && value) {
      this.form.ends_at = periodEnd(value, months);
    }
  }

  onEndChange(value: string): void {
    this.form.ends_at = value;
    this.selectedMonths.set(null); // période personnalisée
  }

  coveredDays(): number | null {
    const { starts_at, ends_at } = this.form;
    if (!starts_at || !ends_at || ends_at < starts_at) {
      return null;
    }
    return daysBetweenInclusive(starts_at, ends_at);
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: SubscriptionPayload = {
      ...this.form,
      store_id: this.store().store_id,
      amount: Number(this.form.amount) || 0,
      notes: this.form.notes || null
    };

    const existing = this.subscription();
    const request = existing
      ? this.subscriptionService.update(existing.id, payload)
      : this.subscriptionService.create(payload);

    request.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.saved.emit(res.message);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }
}
