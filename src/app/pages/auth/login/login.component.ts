import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
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

const BLOCK_STORAGE_KEY = 'login_blocked_until';

/** « 45 s », « 4 min 05 s », « 1 h 02 min » */
function formatWait(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h} h ${String(m).padStart(2, '0')} min`;
  }
  if (m > 0) {
    return `${m} min ${String(s).padStart(2, '0')} s`;
  }
  return `${s} s`;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
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

  /** Trop de tentatives : secondes d'attente restantes (décompte), 0 = connexion possible. */
  protected readonly waitSeconds = signal(0);
  protected readonly isBlocked = computed(() => this.waitSeconds() > 0);
  protected readonly waitLabel = computed(() => formatWait(this.waitSeconds()));
  private blockedUntil = 0;
  private blockTimer?: ReturnType<typeof setInterval>;

  constructor() {
    // Rechargement de la page pendant un blocage : le décompte reprend
    try {
      const saved = Number(sessionStorage.getItem(BLOCK_STORAGE_KEY));
      if (saved > Date.now()) {
        this.startBlock(saved);
      }
    } catch {
      // Stockage indisponible : le serveur renverra le délai à la prochaine tentative
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.blockTimer);
  }

  /** Blocage jusqu'à `until` (timestamp ms) : décompte à la seconde, bouton désactivé. */
  private startBlock(until: number): void {
    this.blockedUntil = until;
    this.errorMessage.set(null);
    try {
      sessionStorage.setItem(BLOCK_STORAGE_KEY, String(until));
    } catch {
      // ignoré
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((this.blockedUntil - Date.now()) / 1000));
      this.waitSeconds.set(left);
      if (left === 0) {
        clearInterval(this.blockTimer);
        try {
          sessionStorage.removeItem(BLOCK_STORAGE_KEY);
        } catch {
          // ignoré
        }
        this.notice.set('Vous pouvez de nouveau essayer de vous connecter.');
      }
    };
    clearInterval(this.blockTimer);
    tick();
    this.blockTimer = setInterval(tick, 1000);
  }

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
    if (!this.email || !this.password || this.isSubmitting() || this.isBlocked()) {
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
          // Trop de tentatives (blocage de l'IP, ou limite de requêtes) : délai en secondes
          if (err.status === 429) {
            const seconds = Number(body?.retry_after ?? err.headers?.get('Retry-After')) || 60;
            this.startBlock(Date.now() + seconds * 1000);
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
