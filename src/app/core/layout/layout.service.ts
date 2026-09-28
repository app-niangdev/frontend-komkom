import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isMobileSidebarOpen = signal(false);
  readonly isSidebarCollapsed = signal(false);

  toggleSidebar(): void {
    if (window.innerWidth < 992) {
      this.isMobileSidebarOpen.update((v) => !v);
    } else {
      this.isSidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }
}
