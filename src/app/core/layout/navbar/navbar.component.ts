import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { LayoutService } from '../layout.service';
import { AuthService } from '../../auth/auth.service';
import { NotificationService } from '../../services/notification.service';
import { StoreContextService } from '../../owner/store-context.service';
import { StoreSwitcherComponent } from '../../owner/store-switcher/store-switcher.component';
import { LANG_NAMES, LanguageService } from '../../i18n/language.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, StoreSwitcherComponent, TranslocoPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly authService = inject(AuthService);
  protected readonly storeContext = inject(StoreContextService);
  protected readonly language = inject(LanguageService);
  protected readonly langNames = LANG_NAMES;
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isProfileMenuOpen = signal(false);

  /** Clé de traduction du titre de la page (data.title de la route). */
  protected readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.resolveTitle())
    ),
    { initialValue: this.resolveTitle() }
  );

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((v) => !v);
  }

  async logout(): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: this.language.t('nav.logout'),
      text: this.language.t('nav.logoutText'),
      confirmText: this.language.t('nav.logoutConfirm'),
      cancelText: this.language.t('nav.logoutCancel'),
      icon: 'question'
    });

    if (!confirmed) {
      return;
    }

    this.authService.logout();
    this.notification.toast(this.language.t('nav.loggedOut'), 'info');
  }

  /** Bascule vers l'autre langue ; le choix est enregistré sur le compte. */
  async switchLanguage(): Promise<void> {
    this.isProfileMenuOpen.set(false);
    try {
      await this.language.choose(this.language.otherLang());
    } catch {
      this.notification.toast(this.language.t('language.saveFailed'), 'warning');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.navbar__profile')) {
      this.isProfileMenuOpen.set(false);
    }
  }

  private resolveTitle(): string {
    let current: ActivatedRoute | null = this.route.firstChild;
    while (current?.firstChild) {
      current = current.firstChild;
    }
    const data = current?.snapshot?.data;
    return (data && data['title']) || 'page.dashboard';
  }
}
