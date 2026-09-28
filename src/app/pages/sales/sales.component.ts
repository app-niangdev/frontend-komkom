import { Component } from '@angular/core';
import { PagePlaceholderComponent } from '../../shared/components/page-placeholder/page-placeholder.component';
import { PageInfo } from '../../core/models/page-info.model';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [PagePlaceholderComponent],
  template: `<app-page-placeholder [page]="page"></app-page-placeholder>`
})
export class SalesComponent {
  protected readonly page: PageInfo = {
    title: 'Ventes',
    description: 'Suivez vos commandes, transactions et revenus au fil du temps.',
    icon: 'bi-cart-fill'
  };
}
