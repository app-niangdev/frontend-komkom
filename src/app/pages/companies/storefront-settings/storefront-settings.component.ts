import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { StoreStorefront } from '../../../core/models/company.model';
import { StorefrontAdminService } from '../../../core/services/storefront-admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { copyText, formatWhatsapp, toSlug } from '../../../shared/utils/storefront.util';

/**
 * Réglage de la vitrine publique d'une boutique (administrateur) : activation et lien.
 * Le numéro WhatsApp des commandes est le téléphone principal de la boutique.
 */
@Component({
  selector: 'app-storefront-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './storefront-settings.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './storefront-settings.component.scss']
})
export class StorefrontSettingsComponent implements OnInit {
  private readonly service = inject(StorefrontAdminService);
  private readonly notification = inject(NotificationService);

  readonly store = input.required<StoreStorefront>();
  readonly saved = output<{ store: StoreStorefront; message: string }>();
  readonly closed = output<void>();

  protected readonly formatWhatsapp = formatWhatsapp;

  protected enabled = false;
  protected slug = '';
  protected suggested = '';
  protected readonly baseUrl = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const status = this.store().storefront;
    this.enabled = status.enabled;
    this.slug = status.slug ?? '';
    this.service.suggest(this.store().id).subscribe({
      next: ({ slug, base_url }) => {
        this.suggested = slug;
        this.baseUrl.set(base_url);
        if (!this.slug) {
          this.slug = slug;
        }
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(extractErrorMessage(err));
        this.isLoading.set(false);
      }
    });
  }

  get cleanSlug(): string {
    return this.slug.replace(/-+$/, '');
  }

  get previewUrl(): string {
    return `${this.baseUrl()}/${this.cleanSlug || '…'}`;
  }

  get slugError(): string | null {
    const slug = this.cleanSlug;
    if (!slug) {
      return 'Le lien est obligatoire.';
    }
    return slug.length < 3 ? 'Le lien doit faire au moins 3 caractères.' : null;
  }

  /** Activer sans numéro WhatsApp valide est refusé : les commandes n'arriveraient nulle part. */
  get blockedByPhone(): boolean {
    return this.enabled && !this.store().storefront.whatsapp;
  }

  onSlugInput(value: string): void {
    this.slug = toSlug(value);
  }

  useSuggestion(): void {
    this.slug = this.suggested;
  }

  async copyPreview(): Promise<void> {
    if (await copyText(this.previewUrl)) {
      this.notification.toast('Lien copié', 'success');
    }
  }

  async submit(): Promise<void> {
    if (this.isSubmitting() || this.slugError || this.blockedByPhone) {
      return;
    }
    const current = this.store().storefront;
    if (current.enabled && !this.enabled) {
      const ok = await this.notification.confirm({
        title: 'Désactiver la vitrine ?',
        text: `Le lien ${current.url} ne fonctionnera plus pour les clients de « ${this.store().name} ». Il sera conservé en cas de réactivation.`,
        confirmText: 'Désactiver',
        cancelText: 'Annuler',
        danger: true
      });
      if (!ok) {
        return;
      }
    } else if (current.enabled && current.slug && this.cleanSlug !== current.slug) {
      const ok = await this.notification.confirm({
        title: 'Changer le lien ?',
        text: `L'ancien lien ${current.url} ne fonctionnera plus : ceux qui l'ont reçu (QR code, statut WhatsApp…) tomberont sur une page introuvable.`,
        confirmText: 'Changer le lien',
        cancelText: 'Garder l\'ancien'
      });
      if (!ok) {
        return;
      }
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.service.update(this.store().id, { enabled: this.enabled, slug: this.cleanSlug }).subscribe({
      next: (res) => this.saved.emit({ store: res.data, message: res.message }),
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }
}
