import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SubscriptionNoticeService, describeStatus } from '../../auth/subscription-notice.service';
import { SubscriptionStatus } from '../../models/auth.model';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, NavbarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  protected readonly subscriptionNotice = inject(SubscriptionNoticeService);

  protected bannerText(alerts: SubscriptionStatus[]): string {
    if (alerts.length === 1) {
      return `Abonnement de « ${alerts[0].store_name} » : ${describeStatus(alerts[0])}.`;
    }
    return `${alerts.length} boutiques ont un abonnement expiré ou proche de l'échéance.`;
  }

  protected isCritical(alerts: SubscriptionStatus[]): boolean {
    return alerts.some((a) => a.state === 'expired' || a.state === 'none');
  }
}
