import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreContextService } from '../store-context.service';
import { OwnerStoreOption } from '../owner.model';

/** Sélecteur de boutique de la barre du haut (propriétaire) : filtre toutes les pages de l'espace. */
@Component({
  selector: 'app-store-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-switcher.component.html',
  styleUrl: './store-switcher.component.scss'
})
export class StoreSwitcherComponent {
  protected readonly context = inject(StoreContextService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  choose(storeId: number | null): void {
    this.context.select(storeId);
    this.isOpen.set(false);
  }

  isBlocked(store: OwnerStoreOption): boolean {
    return store.subscription.state === 'expired' || store.subscription.state === 'none';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }
}
