import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

export interface ConfirmOptions {
  title: string;
  text?: string;
  icon?: SweetAlertIcon;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** Options d'une saisie de texte obligatoire (cf. prompt()). */
export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  /** Message affiché si la saisie est vide. */
  requiredMessage?: string;
}

/**
 * Service de notification basé sur SweetAlert2,
 * configuré aux couleurs et au design de KomKom.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly brandPrimary = '#5b4fe5';
  private readonly brandAccent = '#d97706';
  private readonly brandDanger = '#dc2626';
  private readonly brandSuccess = '#16a34a';

  private readonly baseClass = {
    popup: 'kk-swal',
    title: 'kk-swal__title',
    htmlContainer: 'kk-swal__html',
    confirmButton: 'kk-swal__btn kk-swal__btn--primary',
    cancelButton: 'kk-swal__btn kk-swal__btn--ghost',
    icon: 'kk-swal__icon',
    actions: 'kk-swal__actions'
  } as const;

  success(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: 'OK',
      confirmButtonColor: this.brandPrimary,
      iconColor: this.brandSuccess,
      customClass: this.baseClass,
      buttonsStyling: false
    });
  }

  /**
   * Succès qui se ferme automatiquement au bout de 4 secondes si l'utilisateur
   * ne l'a pas fermé lui-même — pour les actions non bloquantes.
   */
  successAutoClose(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonText: 'OK',
      confirmButtonColor: this.brandPrimary,
      iconColor: this.brandSuccess,
      customClass: this.baseClass,
      buttonsStyling: false,
      timer: 4000,
      timerProgressBar: true
    });
  }

  error(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'Fermer',
      confirmButtonColor: this.brandDanger,
      iconColor: this.brandDanger,
      customClass: this.baseClass,
      buttonsStyling: false
    });
  }

  warning(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonText: 'Compris',
      confirmButtonColor: this.brandAccent,
      iconColor: this.brandAccent,
      customClass: this.baseClass,
      buttonsStyling: false
    });
  }

  /** Avertissement au contenu HTML — le HTML doit être échappé par l'appelant. */
  warningHtml(title: string, html: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'warning',
      title,
      html,
      confirmButtonText: 'Compris',
      confirmButtonColor: this.brandAccent,
      iconColor: this.brandAccent,
      customClass: this.baseClass,
      buttonsStyling: false
    });
  }

  info(title: string, text?: string): Promise<SweetAlertResult> {
    return Swal.fire({
      icon: 'info',
      title,
      text,
      confirmButtonText: 'OK',
      confirmButtonColor: this.brandPrimary,
      iconColor: this.brandPrimary,
      customClass: this.baseClass,
      buttonsStyling: false
    });
  }

  /** Boîte de confirmation (oui / non). Résout `true` si confirmé. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const isDanger = options.danger ?? false;
    const result = await Swal.fire({
      icon: options.icon ?? (isDanger ? 'warning' : 'question'),
      title: options.title,
      text: options.text,
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Confirmer',
      cancelButtonText: options.cancelText ?? 'Annuler',
      confirmButtonColor: isDanger ? this.brandDanger : this.brandPrimary,
      reverseButtons: true,
      focusCancel: isDanger,
      customClass: {
        ...this.baseClass,
        confirmButton: isDanger
          ? 'kk-swal__btn kk-swal__btn--danger'
          : 'kk-swal__btn kk-swal__btn--primary'
      },
      buttonsStyling: false
    });
    return result.isConfirmed;
  }

  /**
   * Demande une saisie de texte obligatoire (motif, commentaire…).
   * Résout la valeur saisie, ou `null` si l'utilisateur annule.
   */
  async prompt(options: PromptOptions): Promise<string | null> {
    const isDanger = options.danger ?? false;
    const result = await Swal.fire({
      icon: options.icon ?? (isDanger ? 'warning' : 'question'),
      title: options.title,
      text: options.text,
      input: 'textarea',
      inputPlaceholder: options.placeholder ?? '',
      inputAttributes: { 'aria-label': options.title },
      inputValidator: (value) =>
        value?.trim() ? null : (options.requiredMessage ?? 'Ce champ est obligatoire.'),
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Confirmer',
      cancelButtonText: options.cancelText ?? 'Annuler',
      reverseButtons: true,
      focusCancel: isDanger,
      customClass: {
        ...this.baseClass,
        confirmButton: isDanger
          ? 'kk-swal__btn kk-swal__btn--danger'
          : 'kk-swal__btn kk-swal__btn--primary'
      },
      buttonsStyling: false
    });

    return result.isConfirmed ? (result.value as string).trim() : null;
  }

  /** Toast discret en haut à droite (auto-close). */
  toast(title: string, icon: SweetAlertIcon = 'success'): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 2800,
      timerProgressBar: true,
      customClass: {
        popup: 'kk-swal__toast'
      }
    });
  }

  /** Affiche un loader (à fermer manuellement avec close()). */
  loading(title = 'Traitement en cours…'): void {
    Swal.fire({
      title,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
      customClass: this.baseClass
    });
  }

  close(): void {
    Swal.close();
  }
}
