import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AppLang = 'fr' | 'ar';

export const APP_LANGS: readonly AppLang[] = ['fr', 'ar'];

/** Nom de chaque langue, écrit dans cette langue (sélecteur). */
export const LANG_NAMES: Record<AppLang, string> = { fr: 'Français', ar: 'العربية' };

const RTL_LANGS: readonly AppLang[] = ['ar'];
const STORAGE_KEY = 'kk_lang';

/** Valeurs insérées dans une traduction ({{nom}}). */
type Params = Record<string, unknown>;

function isAppLang(value: unknown): value is AppLang {
  return APP_LANGS.includes(value as AppLang);
}

/** Fichiers de traduction : un fichier par langue, téléchargé seulement s'il est utilisé. */
@Injectable({ providedIn: 'root' })
export class TranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    const file = lang === 'ar' ? import('../../i18n/ar.json') : import('../../i18n/fr.json');
    return from(file).pipe(map((module) => module.default as Translation));
  }
}

/**
 * Langue de l'interface : français ou arabe (affichage de droite à gauche).
 * Le choix est gardé sur l'appareil et, une fois connecté, sur le compte.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private readonly langSig = signal<AppLang>('fr');
  /** Un compte est connecté : un changement de langue est enregistré dessus. */
  private accountLinked = false;
  /** Langue changée sur l'écran de connexion : elle l'emporte sur celle du compte. */
  private chosenBeforeLogin = false;

  readonly lang = this.langSig.asReadonly();
  readonly isRtl = computed(() => RTL_LANGS.includes(this.langSig()));
  /** Langue proposée par le sélecteur (deux langues : on bascule de l'une à l'autre). */
  readonly otherLang = computed<AppLang>(() => (this.langSig() === 'fr' ? 'ar' : 'fr'));

  /** Au démarrage : langue gardée sur l'appareil, sinon celle du navigateur. */
  init(): Promise<void> {
    return this.apply(this.storedLang() ?? this.browserLang());
  }

  /** Choix de l'utilisateur (sélecteur de langue). */
  async choose(lang: AppLang): Promise<void> {
    await this.apply(lang);
    this.store(lang);

    if (this.accountLinked) {
      await this.saveToAccount(lang);
    } else {
      this.chosenBeforeLogin = true;
    }
  }

  /** Session ouverte : la langue du compte s'applique, sauf choix fait juste avant la connexion. */
  syncWithAccount(accountLocale: string | null | undefined): void {
    this.accountLinked = true;

    if (this.chosenBeforeLogin) {
      this.chosenBeforeLogin = false;
      if (accountLocale !== this.langSig()) {
        this.saveToAccount(this.langSig()).catch(() => undefined);
      }
      return;
    }

    if (isAppLang(accountLocale) && accountLocale !== this.langSig()) {
      this.apply(accountLocale).then(() => this.store(accountLocale));
    }
  }

  /** Session fermée : l'écran de connexion garde la langue en cours. */
  unlinkAccount(): void {
    this.accountLinked = false;
  }

  /** Traduction immédiate, pour les textes construits dans le code (alertes, messages). */
  t(key: string, params?: Params): string {
    this.langSig(); // relu par les computed au changement de langue
    return this.transloco.translate(key, params);
  }

  /** Traduction si elle existe, sinon le libellé fourni (ex. menus venant de la base). */
  tOr(key: string, fallback: string): string {
    const value = this.transloco.getTranslation(this.langSig())[key];
    return typeof value === 'string' ? value : fallback;
  }

  /**
   * Phrase accordée en nombre : la clé porte une variante par forme plurielle de la langue
   * (`one`, `other` en français ; `zero`, `one`, `two`, `few`, `many`, `other` en arabe).
   */
  plural(key: string, count: number, params: Params = {}): string {
    const lang = this.langSig();
    const translation = this.transloco.getTranslation(lang);
    const form = new Intl.PluralRules(lang).select(count);
    const variant = `${key}.${form}` in translation ? form : 'other';
    return this.transloco.translate(`${key}.${variant}`, { ...params, count });
  }

  private async apply(lang: AppLang): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    this.langSig.set(lang);

    const root = this.document.documentElement;
    root.lang = lang;
    root.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
  }

  private saveToAccount(lang: AppLang): Promise<unknown> {
    return firstValueFrom(this.http.put(`${environment.apiUrl}/profile/locale`, { locale: lang }));
  }

  private storedLang(): AppLang | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return isAppLang(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  private browserLang(): AppLang {
    return this.document.defaultView?.navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'fr';
  }

  private store(lang: AppLang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Stockage indisponible : la langue du compte sera reprise à la prochaine connexion
    }
  }
}
