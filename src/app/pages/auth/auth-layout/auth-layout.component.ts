import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANG_NAMES, LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TranslocoPipe],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {
  protected readonly language = inject(LanguageService);
  protected readonly langNames = LANG_NAMES;
  protected readonly year = new Date().getFullYear();

  protected readonly features = [
    { icon: 'bi-cart-check', title: 'auth.layout.features.posTitle', desc: 'auth.layout.features.posDesc' },
    { icon: 'bi-box-seam', title: 'auth.layout.features.stockTitle', desc: 'auth.layout.features.stockDesc' },
    { icon: 'bi-graph-up-arrow', title: 'auth.layout.features.statsTitle', desc: 'auth.layout.features.statsDesc' },
    { icon: 'bi-shield-check', title: 'auth.layout.features.rolesTitle', desc: 'auth.layout.features.rolesDesc' }
  ];
}
