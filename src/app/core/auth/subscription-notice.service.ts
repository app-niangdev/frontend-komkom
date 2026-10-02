import { Injectable, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../i18n/language.service';
import { NotificationService } from '../services/notification.service';
import { SubscriptionExpiredError, SubscriptionStatus } from '../models/auth.model';

/**
 * État d'abonnement côté interface :
 * - `expired` : détails affichés sur l'écran de connexion quand l'accès est refusé ;
 * - `alerts`  : échéances proches / boutiques expirées renvoyées par /authenticate.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionNoticeService {
  private readonly notification = inject(NotificationService);
  private readonly language = inject(LanguageService);

  private readonly expiredSig = signal<SubscriptionExpiredError | null>(null);
  private readonly alertsSig = signal<SubscriptionStatus[]>([]);
  private readonly bannerDismissedSig = signal(false);

  readonly expired = this.expiredSig.asReadonly();
  readonly alerts = this.alertsSig.asReadonly();
  readonly showBanner = computed(() => this.alertsSig().length > 0 && !this.bannerDismissedSig());

  static isExpiredError(body: unknown): body is SubscriptionExpiredError {
    return (body as SubscriptionExpiredError | null)?.code === 'SUBSCRIPTION_EXPIRED';
  }

  setExpired(error: SubscriptionExpiredError): void {
    this.expiredSig.set(error);
  }

  clearExpired(): void {
    this.expiredSig.set(null);
  }

  setAlerts(alerts: SubscriptionStatus[]): void {
    this.alertsSig.set(alerts);
  }

  dismissBanner(): void {
    this.bannerDismissedSig.set(true);
  }

  reset(): void {
    this.alertsSig.set([]);
    this.bannerDismissedSig.set(false);
  }

  /** Alerte affichée une fois, juste après la connexion. */
  showLoginAlert(): void {
    const alerts = this.alertsSig();
    if (alerts.length === 0) {
      return;
    }

    const title = this.language.t(
      alerts.length === 1 && alerts[0].state === 'expiring'
        ? 'subscription.alertTitleExpiring'
        : 'subscription.alertTitle'
    );

    const items = alerts
      .map((a) => `<li><strong>${escapeHtml(a.store_name)}</strong> : ${escapeHtml(this.describe(a))}</li>`)
      .join('');

    this.notification.warningHtml(
      title,
      `<ul class="subscription-alert-list">${items}</ul>` +
        `<p>${escapeHtml(this.language.t('subscription.alertHelp'))}</p>`
    );
  }

  /** Libellé lisible d'un état d'abonnement, dans la langue affichée. */
  readonly describe = (status: SubscriptionStatus): string => {
    const date = status.ends_at ? formatDate(status.ends_at) : null;

    switch (status.state) {
      case 'none':
        return this.language.t('subscription.none');
      case 'expired':
        return this.language.plural('subscription.expired', Math.abs(status.days_left ?? 0), { date });
      case 'expiring': {
        const days = status.days_left ?? 0;
        if (days === 0) {
          return this.language.t('subscription.expiresToday', { date });
        }
        return this.language.plural('subscription.expiring', days, { date });
      }
      default:
        return this.language.t('subscription.active', { date });
    }
  };
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
