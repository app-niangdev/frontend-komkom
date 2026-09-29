import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { TeamMember } from '../../../../core/owner/owner.model';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

type ResetMethod = 'password' | 'link';

/**
 * Réinitialisation de l'accès d'un membre : mot de passe temporaire (affiché une seule fois,
 * à changer à la première connexion) ou lien envoyé par e-mail.
 */
@Component({
  selector: 'app-reset-access-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reset-access-dialog.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './reset-access-dialog.component.scss']
})
export class ResetAccessDialogComponent {
  private readonly ownerService = inject(OwnerService);

  readonly member = input.required<TeamMember>();
  /** Fermeture ; `true` si l'accès a été réinitialisé (liste à recharger). */
  readonly closed = output<boolean>();

  protected readonly method = signal<ResetMethod>('password');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<{ message: string; temporaryPassword: string | null; login: string | null } | null>(null);
  protected readonly copied = signal(false);

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.isSubmitting()) {
      this.closed.emit(this.result() !== null);
    }
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.ownerService.resetMemberAccess(this.member().id, this.method()).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.result.set({ message: res.message, temporaryPassword: res.temporary_password ?? null, login: res.login ?? null });
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.status === 429 ? 'Trop de tentatives : patientez une minute.' : extractErrorMessage(err));
      }
    });
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Presse-papiers indisponible (http, permissions) : le mot de passe reste affiché et sélectionnable
    }
  }
}
