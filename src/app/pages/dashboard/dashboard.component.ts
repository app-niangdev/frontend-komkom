import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface KpiCard {
  label: string;
  value: string;
  trend: string;
  trendType: 'up' | 'down' | 'neutral';
}

interface Transaction {
  client: string;
  status: 'complete' | 'en-cours';
  amount: string;
  date: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  protected readonly kpis: KpiCard[] = [
    { label: 'Ventes totales', value: '12 450,00 €', trend: '↑ 12% vs mois dernier', trendType: 'up' },
    { label: 'Nouveaux clients', value: '842', trend: '↑ 5% vs mois dernier', trendType: 'up' },
    { label: 'Taux de conversion', value: '3,2%', trend: '↓ 0,4% vs mois dernier', trendType: 'down' },
    { label: 'Produits actifs', value: '1 205', trend: 'Stable', trendType: 'neutral' }
  ];

  protected readonly transactions: Transaction[] = [
    { client: 'Sophie Dubois', status: 'complete', amount: '145,00 €', date: 'Il y a 2h' },
    { client: 'Marc Lefebvre', status: 'en-cours', amount: '89,90 €', date: 'Il y a 5h' }
  ];
}
