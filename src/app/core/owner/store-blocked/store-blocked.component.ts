import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreContextService } from '../store-context.service';
import { describeStatus } from '../../auth/subscription-notice.service';

/** Affiché à la place des données quand la boutique choisie n'a plus d'abonnement en cours. */
@Component({
  selector: 'app-store-blocked',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card blocked" *ngIf="context.selectedStore() as store" role="alert">
      <span class="blocked__icon"><i class="bi bi-lock"></i></span>
      <div>
        <h3>Les données de « {{ store.name }} » sont inaccessibles</h3>
        <p>Abonnement {{ statusText() }}. Contactez l'administrateur de la plateforme pour le renouveler.</p>
        <button type="button" class="blocked__action" *ngIf="!context.isStoreStaff()" (click)="context.select(null)">
          <i class="bi bi-grid"></i> Voir toutes les boutiques
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .blocked {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        border: 1px solid rgba(220, 38, 38, 0.25);
      }
      .blocked__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: rgba(220, 38, 38, 0.08);
        color: #dc2626;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      h3 {
        margin: 0 0 0.3rem;
        font-size: 1rem;
        font-weight: 700;
        color: #1a1f35;
      }
      p {
        margin: 0 0 0.85rem;
        font-size: 0.87rem;
        color: #6b7086;
      }
      .blocked__action {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 0.9rem;
        border: 1px solid #e8e9f0;
        border-radius: 10px;
        background: #fff;
        font: inherit;
        font-size: 0.85rem;
        font-weight: 600;
        color: #1a1f35;
        cursor: pointer;
      }
      .blocked__action:hover {
        border-color: #5b4fe5;
        color: #5b4fe5;
      }
    `
  ]
})
export class StoreBlockedComponent {
  protected readonly context = inject(StoreContextService);

  protected readonly statusText = computed(() => {
    const store = this.context.selectedStore();
    return store ? describeStatus(store.subscription) : '';
  });
}
