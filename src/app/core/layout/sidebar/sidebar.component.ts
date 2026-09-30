import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../layout.service';
import { NavItem } from '../../models/nav-item.model';
import { AuthService } from '../../auth/auth.service';
import { StoreContextService } from '../../owner/store-context.service';

const FALLBACK_ICON = 'bi-dot';

/** Écrans propres aux numéros de série : masqués quand la boutique n'en utilise pas. */
const SERIAL_ROUTES = [/\/serials$/, /\/procurements\/scan$/];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  protected readonly layout = inject(LayoutService);
  private readonly authService = inject(AuthService);
  private readonly context = inject(StoreContextService);

  /** Admin : « Komkom » ; propriétaire, gérant, vendeur : nom abrégé de leur entreprise. */
  protected readonly brandName = computed(() => {
    if (this.authService.currentUser()?.role?.name === 'Admin') {
      return 'Komkom';
    }
    return this.authService.company()?.short_name?.trim() || 'Komkom';
  });

  protected readonly navItems = computed<NavItem[]>(() => {
    const usesSerials = this.context.usesSerials();
    const menus = [...this.authService.menus()]
      .filter((menu) => usesSerials || !SERIAL_ROUTES.some((pattern) => pattern.test(menu.url)))
      .sort((a, b) => a.position - b.position);
    return menus.map((menu) => ({
      label: menu.title,
      icon: menu.icon || FALLBACK_ICON,
      route: menu.url,
      // « Ventes » (/sales) ne doit pas rester actif sur « Nouvelle vente » (/sales/new)
      exact: menus.some((other) => other !== menu && other.url.startsWith(`${menu.url}/`))
    }));
  });

  onNavigate(): void {
    this.layout.closeMobileSidebar();
  }
}
