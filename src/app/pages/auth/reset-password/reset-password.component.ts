import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected password = '';
  protected passwordConfirmation = '';

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Lien ouvert sans jeton ou sans e-mail (copié incomplet, ancien format) : on propose d'en redemander un. */
  protected readonly linkInvalid = !this.email || !this.token;

  onSubmit(): void {
    if (this.linkInvalid || this.isSubmitting()) {
      return;
    }
    if (this.password.length < 8) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (this.password !== this.passwordConfirmation) {
      this.errorMessage.set('Les deux mots de passe ne correspondent pas.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService
      .resetPassword(this.email, this.token, this.password, this.passwordConfirmation)
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.router.navigateByUrl('/auth/login', { state: { notice: res.message } });
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
