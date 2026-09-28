import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OwnerService } from '../../../core/owner/owner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatMoney } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

type SupplyRef = { id: number; order_number: string; total_amount: number; supplier: { name: string } | null };

/**
 * Réception et annulation d'un approvisionnement, avec confirmation et retour utilisateur.
 * Résout `true` quand l'action a abouti (la vue appelante recharge alors ses données).
 */
@Injectable({ providedIn: 'root' })
export class SupplyActionsService {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);

  async receive(supply: SupplyRef, currency: string): Promise<boolean> {
    const confirmed = await this.notification.confirm({
      title: `Réceptionner ${supply.order_number} ?`,
      text: `Les quantités entrent en stock immédiatement (${formatMoney(supply.total_amount, currency)} de ${supply.supplier?.name ?? 'ce fournisseur'}). Vérifiez la marchandise livrée avant de confirmer.`,
      icon: 'question',
      confirmText: 'Réceptionner',
      cancelText: 'Pas encore'
    });
    return confirmed && this.run(() => this.ownerService.receiveSupply(supply.id));
  }

  async cancel(supply: SupplyRef): Promise<boolean> {
    const confirmed = await this.notification.confirm({
      title: `Annuler ${supply.order_number} ?`,
      text: 'Le stock ne change pas et les numéros de série réservés sont libérés. Un approvisionnement annulé ne peut plus être modifié.',
      confirmText: 'Annuler l\'approvisionnement',
      cancelText: 'Garder',
      danger: true
    });
    return confirmed && this.run(() => this.ownerService.cancelSupply(supply.id));
  }

  private async run(request: () => ReturnType<OwnerService['receiveSupply']>): Promise<boolean> {
    this.notification.loading();
    try {
      const res = await firstValueFrom(request());
      this.notification.close();
      this.notification.toast(res.message, 'success');
      return true;
    } catch (err) {
      this.notification.close();
      this.notification.error('Action impossible', extractErrorMessage(err as HttpErrorResponse));
      return false;
    }
  }
}
