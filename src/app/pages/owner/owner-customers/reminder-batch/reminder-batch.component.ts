import { Component, HostListener, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OwnerService } from '../../../../core/owner/owner.service';
import { OwnerCustomer, ReminderBlocker, ReminderResult } from '../../../../core/owner/owner.model';
import { formatMoney } from '../../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { REMINDER_BLOCKER_LABELS } from '../reminder.util';

type Phase = 'loading' | 'preview' | 'running' | 'done';

interface Outcome {
  customer: OwnerCustomer;
  status: 'sent' | 'skipped' | 'failed';
  message: string;
}

/** Pause entre deux envois : le numéro d'envoi est commun à toutes les boutiques, on évite les rafales. */
const PAUSE_MS = 2500;
/** Échecs d'affilée au-delà desquels on arrête le lot (le service est sans doute en panne). */
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Relance groupée des débiteurs sur WhatsApp : aperçu (qui sera relancé, qui est ignoré et
 * pourquoi), envoi client par client avec progression, puis bilan nominatif des échecs.
 */
@Component({
  selector: 'app-reminder-batch',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reminder-batch.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './reminder-batch.component.scss']
})
export class ReminderBatchComponent implements OnInit, OnDestroy {
  private readonly ownerService = inject(OwnerService);

  readonly storeId = input.required<number | null>();
  /** Fermeture ; `true` si au moins une relance est partie (liste à recharger). */
  readonly closed = output<boolean>();

  protected readonly phase = signal<Phase>('loading');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly cooldownHours = signal(24);

  /** Clients relancés par ce lot, et débiteurs en attente du lot suivant. */
  protected readonly targets = signal<OwnerCustomer[]>([]);
  protected readonly deferred = signal(0);
  /** Débiteurs écartés avant l'envoi, regroupés par motif. */
  protected readonly excluded = signal<{ blocker: ReminderBlocker; label: string; customers: OwnerCustomer[] }[]>([]);

  /** Clients du passage en cours (lot complet, ou seulement les échecs lors d'un nouvel essai). */
  protected readonly queue = signal<OwnerCustomer[]>([]);
  protected readonly processed = signal(0);
  protected readonly current = signal<OwnerCustomer | null>(null);
  protected readonly outcomes = signal<Outcome[]>([]);
  /** Motif de l'arrêt anticipé (panne du service, arrêt demandé). */
  protected readonly stopReason = signal<string | null>(null);

  protected readonly sent = computed(() => this.outcomes().filter((o) => o.status === 'sent'));
  protected readonly failed = computed(() => this.outcomes().filter((o) => o.status === 'failed'));
  protected readonly skipped = computed(() => this.outcomes().filter((o) => o.status === 'skipped'));
  /** Clients du passage que l'arrêt anticipé a laissés sans tentative. */
  protected readonly notAttempted = computed(() => this.queue().slice(this.processed()));
  /** Ce qu'un nouvel essai reprend : les échecs, puis les clients non tentés. */
  protected readonly retryable = computed(() => [...this.failed().map((o) => o.customer), ...this.notAttempted()]);
  protected readonly targetsTotal = computed(() => this.targets().reduce((sum, c) => sum + c.balance_due, 0));
  protected readonly progress = computed(() => (this.queue().length ? Math.round((this.processed() / this.queue().length) * 100) : 0));

  private stopRequested = false;
  private wakeUp: (() => void) | null = null;

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.ownerService.reminderTargets(this.storeId()).subscribe({
      next: (res) => {
        this.currency.set(res.currency);
        this.cooldownHours.set(res.cooldown_hours);

        const sendable = res.data.filter((c) => !c.reminder.blocker);
        this.targets.set(sendable.slice(0, res.batch_size));
        this.deferred.set(Math.max(0, sendable.length - res.batch_size));
        this.excluded.set(
          (['no_phone', 'recent', 'disabled'] as ReminderBlocker[])
            .map((blocker) => ({
              blocker,
              label: blocker === 'recent' ? `Déjà relancés depuis moins de ${res.cooldown_hours} h` : REMINDER_BLOCKER_LABELS[blocker],
              customers: res.data.filter((c) => c.reminder.blocker === blocker)
            }))
            .filter((group) => group.customers.length > 0)
        );
        this.phase.set('preview');
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(extractErrorMessage(err));
        this.phase.set('preview');
      }
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  start(): void {
    this.outcomes.set([]);
    void this.run(this.targets());
  }

  retry(): void {
    const again = this.retryable();
    this.outcomes.update((list) => list.filter((o) => o.status !== 'failed'));
    void this.run(again);
  }

  /** Arrête après l'envoi en cours (ce qui est déjà parti le reste). */
  stop(): void {
    this.stopRequested = true;
    this.wakeUp?.();
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.phase() !== 'running') {
      this.closed.emit(this.sent().length > 0);
    }
  }

  private async run(customers: OwnerCustomer[]): Promise<void> {
    this.queue.set(customers);
    this.processed.set(0);
    this.stopReason.set(null);
    this.stopRequested = false;
    this.phase.set('running');

    let consecutiveFailures = 0;
    for (const customer of customers) {
      this.current.set(customer);
      const { outcome, fatal } = await this.send(customer);
      this.outcomes.update((list) => [...list, outcome]);
      this.processed.update((n) => n + 1);

      consecutiveFailures = outcome.status === 'failed' ? consecutiveFailures + 1 : 0;
      const last = this.processed() === customers.length;
      if (fatal || (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !last)) {
        this.stopReason.set(fatal ? outcome.message : `${MAX_CONSECUTIVE_FAILURES} envois ont échoué d'affilée : le lot a été arrêté.`);
        break;
      }
      if (last) {
        break;
      }
      await this.pause();
      if (this.stopRequested) {
        this.stopReason.set('Envoi arrêté à votre demande.');
        break;
      }
    }

    this.current.set(null);
    this.phase.set('done');
  }

  private async send(customer: OwnerCustomer): Promise<{ outcome: Outcome; fatal: boolean }> {
    try {
      const res = await firstValueFrom(this.ownerService.remindCustomer(customer.id));
      return { outcome: { customer, status: 'sent', message: res.message }, fatal: false };
    } catch (e) {
      const err = e as HttpErrorResponse;
      const body = err.error as Partial<ReminderResult> | null;
      if (err.status === 422 && body?.status === 'skipped') {
        return { outcome: { customer, status: 'skipped', message: body.message ?? '' }, fatal: false };
      }
      if (err.status === 502 && body?.status === 'failed') {
        return { outcome: { customer, status: 'failed', message: body.message ?? '' }, fatal: !!body.fatal };
      }
      // Réseau coupé, session expirée, trop de requêtes… : rien ne sert d'insister sur les suivants
      const message =
        err.status === 0
          ? 'Connexion perdue : vérifiez votre réseau.'
          : err.status === 429
            ? 'Trop d\'envois en peu de temps : patientez une minute.'
            : extractErrorMessage(err);
      return { outcome: { customer, status: 'failed', message }, fatal: err.status !== 404 };
    }
  }

  /** Pause entre deux envois, interrompue par « Arrêter ». */
  private pause(): Promise<void> {
    if (this.stopRequested) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wakeUp = null;
        resolve();
      };
      const timer = setTimeout(done, PAUSE_MS);
      this.wakeUp = done;
    });
  }
}
