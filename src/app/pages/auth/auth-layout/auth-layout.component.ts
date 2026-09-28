import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {
  protected readonly year = new Date().getFullYear();

  protected readonly features = [
    {
      icon: 'bi-cart-check',
      title: 'Caisse rapide',
      desc: 'Ventes, factures, tickets et paiements partiels en quelques clics.'
    },
    {
      icon: 'bi-box-seam',
      title: 'Stock multi-boutiques',
      desc: 'Approvisionnements, unités de mesure et suivi des IMEI / numéros de série.'
    },
    {
      icon: 'bi-graph-up-arrow',
      title: 'Pilotage en temps réel',
      desc: "Chiffre d'affaires, encaissements, dépenses et rapports PDF."
    },
    {
      icon: 'bi-shield-check',
      title: 'Accès par rôle',
      desc: 'Propriétaire, gérant et vendeur : chacun voit ce qui le concerne.'
    }
  ];
}
