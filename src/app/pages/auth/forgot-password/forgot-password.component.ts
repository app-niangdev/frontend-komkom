import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);

  protected email = '';
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Adresse à laquelle le lien vient d'être envoyé (écran de confirmation). */
  protected readonly sentTo = signal<string | null>(null);

  /** « Renvoyer » / « Changer d'adresse » : retour au formulaire. */
  retry(): void {
    this.sentTo.set(null);
  }

  onSubmit(): void {
    if (!this.email || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.sentTo.set(this.email.trim());
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err.status === 429 ? 'Trop de tentatives : patientez une minute avant de réessayer.' : extractErrorMessage(err)
        );
      }
    });
  }
}
