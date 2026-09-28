import { Component, Input, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageInfo } from '../../../core/models/page-info.model';

@Component({
  selector: 'app-page-placeholder',
  standalone: true,
  templateUrl: './page-placeholder.component.html',
  styleUrl: './page-placeholder.component.scss'
})
export class PagePlaceholderComponent {
  @Input() page!: PageInfo;

  private readonly route = inject(ActivatedRoute);

  protected get pageInfo(): PageInfo {
    return this.page ?? (this.route.snapshot.data['page'] as PageInfo);
  }
}
