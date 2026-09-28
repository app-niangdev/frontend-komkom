import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { copyText } from '../../utils/storefront.util';

/** Lien public de la vitrine d'une boutique (lecture seule : seul l'administrateur l'active). */
@Component({
  selector: 'app-storefront-link',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './storefront-link.component.html',
  styleUrl: './storefront-link.component.scss'
})
export class StorefrontLinkComponent {
  private readonly notification = inject(NotificationService);

  readonly storefront = input.required<{ enabled: boolean; online: boolean; url: string | null }>();

  /** Lien sans le protocole, plus lisible. */
  protected readonly label = computed(() => this.storefront().url?.replace(/^https?:\/\//, '') ?? '');

  /** Partage du lien sur WhatsApp (statut, groupes, clients). */
  protected readonly shareUrl = computed(() => {
    const url = this.storefront().url;
    return url ? `https://wa.me/?text=${encodeURIComponent('Découvrez nos produits en stock : ' + url)}` : null;
  });

  async copy(): Promise<void> {
    const url = this.storefront().url;
    if (url && (await copyText(url))) {
      this.notification.toast('Lien de la vitrine copié', 'success');
    }
  }
}
