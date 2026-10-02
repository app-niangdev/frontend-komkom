import { APP_INITIALIZER, ApplicationConfig, inject, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';

import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { APP_LANGS, LanguageService, TranslationLoader } from './core/i18n/language.service';

// Formats français disponibles pour les pipes (ex. number: '1.0-2' : 'fr')
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: [...APP_LANGS],
        defaultLang: 'fr',
        fallbackLang: 'fr',
        // Texte pas encore traduit en arabe : affiché en français plutôt qu'en clé technique
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslationLoader
    }),
    // Les traductions sont chargées avant le premier affichage : pas de clé visible à l'écran
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const language = inject(LanguageService);
        return () => language.init();
      }
    }
  ]
};
