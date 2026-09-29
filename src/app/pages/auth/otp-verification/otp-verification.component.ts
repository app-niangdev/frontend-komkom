import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChildren,
  computed,
  inject,
  signal,
  QueryList,
  AfterViewInit,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { OtpStateService } from '../../../core/auth/otp-state.service';
import { SubscriptionNoticeService } from '../../../core/auth/subscription-notice.service';

const OTP_LENGTH = 6;
const RESEND_DELAY_SECONDS = 42;

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './otp-verification.component.html',
  styleUrl: './otp-verification.component.scss'
})
export class OtpVerificationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('digitInput') private digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private readonly authService = inject(AuthService);
  private readonly otpState = inject(OtpStateService);
  private readonly router = inject(Router);
  private readonly subscriptionNotice = inject(SubscriptionNoticeService);

  protected readonly length = OTP_LENGTH;
  protected readonly positions = Array.from({ length: OTP_LENGTH }, (_, i) => i);
  protected readonly trackPosition = (_: number, i: number) => i;
  protected readonly digits = signal<string[]>(Array(OTP_LENGTH).fill(''));
  protected readonly isComplete = computed(() => this.digits().every((d) => d !== ''));
  protected readonly remainingSeconds = signal(RESEND_DELAY_SECONDS);
  protected readonly canResend = computed(() => this.remainingSeconds() === 0);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly formattedTimer = computed(() => {
    const s = this.remainingSeconds();
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  private challengeToken = '';
  private rememberMe = false;
  private timerId?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const state = this.otpState.get();
    if (!state?.challengeToken) {
      this.router.navigateByUrl('/auth/login');
      return;
    }

    this.challengeToken = state.challengeToken;
    this.rememberMe = state.rememberMe;
  }

  ngAfterViewInit(): void {
    this.startTimer();
    this.focusInput(0);
  }

  ngOnDestroy(): void {
    clearInterval(this.timerId);
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.replace(/\D/g, '');

    // Plusieurs chiffres d'un coup (remplissage automatique du code reçu, saisie rapide) : on les répartit
    if (typed.length > 1) {
      this.fillFrom(index, typed);
      return;
    }

    this.digits.update((current) => {
      const next = [...current];
      next[index] = typed;
      return next;
    });
    input.value = typed;

    if (typed && index < OTP_LENGTH - 1) {
      this.focusInput(index + 1);
    }
    this.submitIfComplete();
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.focusInput(index - 1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '') ?? '';
    if (pasted) {
      this.fillFrom(0, pasted);
    }
  }

  /** Répartit des chiffres dans les cases à partir de `start`, puis valide si le code est complet. */
  private fillFrom(start: number, value: string): void {
    const next = [...this.digits()];
    const chars = value.slice(0, OTP_LENGTH - start);
    for (let i = 0; i < chars.length; i++) {
      next[start + i] = chars[i];
    }
    this.digits.set(next);
    this.syncInputValues(next);
    this.focusInput(Math.min(start + chars.length, OTP_LENGTH - 1));
    this.submitIfComplete();
  }

  /** Validation automatique dès le 6e chiffre (le bouton reste pour réessayer). */
  private submitIfComplete(): void {
    if (this.isComplete() && !this.isSubmitting()) {
      this.onSubmit();
    }
  }

  onSubmit(): void {
    if (!this.isComplete() || this.isSubmitting() || !this.challengeToken) {
      return;
    }

    const code = this.digits().join('');
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService
      .verifyLoginOtp({
        challenge_token: this.challengeToken,
        code,
        remember_me: this.rememberMe
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.otpState.clear();
          this.authService.completeLoginAfterCookie().subscribe({
            next: () => {
              this.router.navigateByUrl(this.authService.landingUrl());
              this.subscriptionNotice.showLoginAlert();
            },
            error: () => {
              this.errorMessage.set('Code accepté mais impossible de charger votre session.');
            }
          });
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (SubscriptionNoticeService.isExpiredError(err.error)) {
            // Détails affichés par l'écran de connexion
            this.subscriptionNotice.setExpired(err.error);
            this.otpState.clear();
            this.router.navigateByUrl('/auth/login');
            return;
          }
          this.errorMessage.set(err.error?.message ?? 'Code de vérification incorrect.');
          // Code refusé : on vide les cases pour une nouvelle saisie
          const empty = Array(OTP_LENGTH).fill('');
          this.digits.set(empty);
          this.syncInputValues(empty);
          this.focusInput(0);
        }
      });
  }

  onResend(): void {
    if (!this.canResend() || !this.challengeToken) {
      return;
    }

    this.errorMessage.set(null);
    this.authService.resendLoginOtp(this.challengeToken).subscribe({
      next: () => {
        this.remainingSeconds.set(RESEND_DELAY_SECONDS);
        this.startTimer();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Une erreur est survenue.');
      }
    });
  }

  private startTimer(): void {
    clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.remainingSeconds.update((s) => (s > 0 ? s - 1 : 0));
      if (this.remainingSeconds() === 0) {
        clearInterval(this.timerId);
      }
    }, 1000);
  }

  private focusInput(index: number): void {
    queueMicrotask(() => this.digitInputs.get(index)?.nativeElement.focus());
  }

  private syncInputValues(values: string[]): void {
    this.digitInputs.forEach((ref, i) => {
      ref.nativeElement.value = values[i] ?? '';
    });
  }
}
