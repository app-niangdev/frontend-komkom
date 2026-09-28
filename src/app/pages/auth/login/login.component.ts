import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { OtpStateService } from '../../../core/auth/otp-state.service';
import {
  SubscriptionNoticeService,
  describeStatus,
  formatDate
} from '../../../core/auth/subscription-notice.service';
import { AuthActionResponse, SubscriptionStatus } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly otpState = inject(OtpStateService);
  private readonly router = inject(Router);
  protected readonly subscriptionNotice = inject(SubscriptionNoticeService);
  protected readonly formatDate = formatDate;

  protected email = '';
  protected password = '';
  protected rememberMe = false;

  protected readonly isPasswordVisible = signal(false);
  protected readonly capsLockOn = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Message transmis par la page précédente (ex. mot de passe modifié). */
  protected readonly notice = signal<string | null>(history.state?.notice ?? null);

  statusLabel(status: SubscriptionStatus): string {
    const label = describeStatus(status);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  detectCapsLock(event: KeyboardEvent): void {
    this.capsLockOn.set(event.getModifierState?.('CapsLock') ?? false);
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible.update((v) => !v);
  }

  onSubmit(): void {
    this.email = this.email.trim();
    if (!this.email || !this.password || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.notice.set(null);
    this.subscriptionNotice.clearExpired();

    this.authService
      .login({
        email: this.email,
        password: this.password,
        remember_me: this.rememberMe
      })
      .subscribe({
        next: (response: AuthActionResponse) => {
          if (response.code === 'OTP_REQUIRED') {
            this.isSubmitting.set(false);
            this.otpState.set({
              challengeToken: response.data?.challenge_token ?? '',
              expiresIn: response.data?.expires_in ?? 300,
              rememberMe: this.rememberMe
            });
            this.router.navigateByUrl('/auth/verify-otp');
            return;
          }

          this.authService.completeLoginAfterCookie().subscribe({
            next: () => {
              this.isSubmitting.set(false);
              this.router.navigateByUrl(this.authService.landingUrl());
              this.subscriptionNotice.showLoginAlert();
            },
            error: () => {
              this.isSubmitting.set(false);
              this.errorMessage.set('Connexion réussie mais impossible de charger votre session.');
            }
          });
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          const body = err.error;
          if (SubscriptionNoticeService.isExpiredError(body)) {
            this.subscriptionNotice.setExpired(body);
            return;
          }
          if (body?.code === 'ACCOUNT_DISABLED' || body?.isDisabled) {
            this.errorMessage.set(body?.message ?? 'Votre compte a été suspendu.');
            return;
          }
          if (typeof body?.attempts_left === 'number') {
            this.errorMessage.set(
              `${body?.message ?? 'Identifiants incorrects.'} (tentatives restantes : ${body.attempts_left})`
            );
            return;
          }
          this.errorMessage.set(body?.message ?? 'Identifiants incorrects.');
        }
      });
  }
}
