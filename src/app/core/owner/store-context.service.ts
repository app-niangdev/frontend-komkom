import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { OwnerService } from './owner.service';
import { OwnerStoreOption } from './owner.model';

const STORAGE_PREFIX = 'owner.selectedStore.';

/**
 * Boutique courante de l'espace propriétaire (sélecteur de la barre du haut).
 * `null` = toutes les boutiques. Le choix est mémorisé par compte dans le navigateur.
 *
 * Un gérant ou un vendeur n'a qu'une boutique : elle est sélectionnée d'office et ne peut pas
 * changer, ce qui masque les colonnes « Boutique » et pré-remplit les formulaires des écrans partagés.
 * Le vendeur ne voit en plus que ses propres ventes, factures et encaissements (filtré par l'API).
 */
@Injectable({ providedIn: 'root' })
export class StoreContextService {
  private readonly authService = inject(AuthService);
  private readonly ownerService = inject(OwnerService);

  private readonly storesSig = signal<OwnerStoreOption[]>([]);
  private readonly selectedIdSig = signal<number | null>(null);
  private readonly loadedSig = signal(false);
  private loadedForUser: number | null = null;

  readonly stores = this.storesSig.asReadonly();
  readonly selectedId = this.selectedIdSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();

  readonly isOwner = computed(() => this.authService.currentUser()?.role?.name === 'Owner');
  readonly isManager = computed(() => this.authService.currentUser()?.role?.name === 'Manager');
  readonly isSeller = computed(() => this.authService.currentUser()?.role?.name === 'Seller');
  /** Gérant ou vendeur : une seule boutique, imposée. */
  readonly isStoreStaff = computed(() => this.isManager() || this.isSeller());

  /** Préfixe des routes de l'espace courant, pour les liens des écrans partagés. */
  readonly base = computed(() => (this.isManager() ? '/manager' : this.isSeller() ? '/seller' : '/owner'));

  readonly selectedStore = computed(() => this.storesSig().find((s) => s.id === this.selectedIdSig()) ?? null);

  /** Boutique choisie dont l'abonnement n'est plus en cours : ses données sont inaccessibles. */
  readonly selectedIsBlocked = computed(() => {
    const store = this.selectedStore();
    return !!store && (store.subscription.state === 'expired' || store.subscription.state === 'none');
  });

  constructor() {
    // Chargement (ou rechargement) des boutiques quand un propriétaire, un gérant ou un vendeur se connecte
    effect(
      () => {
        const user = this.authService.currentUser();
        const role = user?.role?.name;
        if (user && (role === 'Owner' || role === 'Manager' || role === 'Seller') && this.loadedForUser !== user.id) {
          this.loadedForUser = user.id;
          this.storesSig.set([]);
          this.loadedSig.set(false);
          if (role === 'Owner') {
            this.restoreSelection(user.id);
          } else {
            this.selectedIdSig.set(null);
          }
          this.refresh();
        } else if (!user) {
          this.loadedForUser = null;
          this.storesSig.set([]);
          this.selectedIdSig.set(null);
          this.loadedSig.set(false);
        }
      },
      { allowSignalWrites: true }
    );
  }

  refresh(): void {
    this.ownerService.storeOptions().subscribe({
      next: (stores) => {
        this.storesSig.set(stores);
        if (this.isStoreStaff()) {
          this.selectedIdSig.set(stores[0]?.id ?? null);
          this.loadedSig.set(true);
          return;
        }
        // Boutique mémorisée qui n'existe plus : retour à « Toutes les boutiques »
        if (this.selectedIdSig() !== null && !stores.some((s) => s.id === this.selectedIdSig())) {
          this.select(null);
        }
        this.loadedSig.set(true);
      },
      error: () => this.loadedSig.set(true)
    });
  }

  select(storeId: number | null): void {
    if (this.isStoreStaff()) {
      return;
    }
    this.selectedIdSig.set(storeId);
    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      return;
    }
    try {
      if (storeId === null) {
        localStorage.removeItem(STORAGE_PREFIX + userId);
      } else {
        localStorage.setItem(STORAGE_PREFIX + userId, String(storeId));
      }
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la session en cours
    }
  }

  private restoreSelection(userId: number): void {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + userId);
      this.selectedIdSig.set(saved ? Number(saved) : null);
    } catch {
      this.selectedIdSig.set(null);
    }
  }
}
