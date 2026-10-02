import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SubscriptionNoticeService } from '../../auth/subscription-notice.service';
import { LanguageService } from '../../i18n/language.service';
import { SubscriptionStatus } from '../../models/auth.model';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent, TranslocoPipe],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  protected readonly subscriptionNotice = inject(SubscriptionNoticeService);
  private readonly language = inject(LanguageService);

  protected bannerText(alerts: SubscriptionStatus[]): string {
    if (alerts.length === 1) {
      return this.language.t('subscription.bannerOne', {
        store: alerts[0].store_name,
        status: this.subscriptionNotice.describe(alerts[0])
      });
    }
    return this.language.plural('subscription.bannerMany', alerts.length);
  }

  protected isCritical(alerts: SubscriptionStatus[]): boolean {
    return alerts.some((a) => a.state === 'expired' || a.state === 'none');
  }
}
