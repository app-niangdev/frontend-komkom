import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { SubscriptionNoticeService } from './subscription-notice.service';
import {
  ApiMessageResponse,
  AuthActionResponse,
  AuthUser,
  AuthenticateResponse,
  LoginPayload,
  Menu,
  VerifyLoginOtpPayload
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly subscriptionNotice = inject(SubscriptionNoticeService);

  private readonly apiUrl = environment.apiUrl;

  private readonly currentUserSig = signal<AuthUser | null>(null);
  private readonly menusSig = signal<Menu[]>([]);
  private readonly authenticatedSig = signal(false);
  private readonly companySig = signal<{ short_name: string; logo_url: string } | null>(null);

  private authCheck$?: Observable<boolean>;
  private authCheckComplete = false;

  readonly currentUser = this.currentUserSig.asReadonly();
  readonly menus = this.menusSig.asReadonly();
  readonly company = this.companySig.asReadonly();
  readonly isAuthenticated = computed(() => this.authenticatedSig());

  login(payload: LoginPayload): Observable<AuthActionResponse> {
    this.invalidateAuthCheck();
    return this.http.post<AuthActionResponse>(`${this.apiUrl}/login`, {
      email: payload.email,
      password: payload.password,
      remember_me: payload.remember_me ?? false
    });
  }

  verifyLoginOtp(payload: VerifyLoginOtpPayload): Observable<AuthActionResponse> {
    this.invalidateAuthCheck();
    return this.http.post<AuthActionResponse>(`${this.apiUrl}/login/verify-otp`, payload);
  }

  resendLoginOtp(challengeToken: string): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiUrl}/login/resend-otp`, {
      challenge_token: challengeToken
    });
  }

  refresh(): Observable<{ status: boolean }> {
    return this.http.post<{ status: boolean }>(`${this.apiUrl}/refresh`, {});
  }

  /**
   * Charge l'utilisateur, les menus et le contexte métier depuis le backend (cookie HttpOnly).
   */
  loadSession(): Observable<AuthenticateResponse> {
    return this.http.get<AuthenticateResponse>(`${this.apiUrl}/authenticate`).pipe(
      tap((response) => this.applyAuthenticatedSession(response))
    );
  }

  checkAuthStatus(): Observable<boolean> {
    if (this.authCheck$) {
      return this.authCheck$;
    }

    this.authCheck$ = this.loadSession().pipe(
      map(() => true),
      catchError(() => {
        this.clearSessionState();
        return of(false);
      }),
      finalize(() => {
        this.authCheckComplete = true;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.authCheck$;
  }

  hasAuthCheckCompleted(): boolean {
    return this.authCheckComplete;
  }

  ensureCurrentUser(): Observable<AuthUser | null> {
    const current = this.currentUserSig();
    if (current) {
      return of(current);
    }

    return this.loadSession().pipe(
      map((res) => res.user),
      catchError(() => of(null))
    );
  }

  reloadMenus(): Observable<Menu[]> {
    return this.http.get<Menu[]>(`${this.apiUrl}/menus`).pipe(
      tap((menus) => this.menusSig.set(menus))
    );
  }

  canAccessPath(path: string): boolean {
    const normalized = this.normalizePath(path);
    const alwaysAllowed = ['/dashboard', '/profile'];
    if (alwaysAllowed.includes(normalized)) {
      return true;
    }

    return this.menusSig().some((menu) => {
      const menuPath = this.normalizePath(menu.url);
      return normalized === menuPath || normalized.startsWith(`${menuPath}/`);
    });
  }

  landingUrl(): string {
    const menus = [...this.menusSig()].sort((a, b) => a.position - b.position);
    return menus[0]?.url ?? '/dashboard';
  }

  /** Met à jour l'utilisateur affiché (navbar, profil) après une modification de son compte. */
  updateCurrentUser(user: AuthUser): void {
    this.currentUserSig.set(user);
  }

  /**
   * Fin de session décidée par le serveur (ex. changement de mot de passe : cookie déjà supprimé).
   * Le message est affiché sur l'écran de connexion.
   */
  endSession(notice: string): void {
    this.clearSessionState();
    this.markUnauthenticated();
    this.router.navigateByUrl('/auth/login', { state: { notice } });
  }

  forgotPassword(email: string): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(
    email: string,
    token: string,
    password: string,
    passwordConfirmation: string
  ): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiUrl}/reset-password`, {
      email,
      token,
      password,
      password_confirmation: passwordConfirmation
    });
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  clearSession(): void {
    this.clearSessionState();
    // On mémorise l'état « non authentifié » : les guards ne relancent pas /authenticate
    // (sinon boucle infinie /authenticate -> 401 -> /refresh -> échec -> redirection -> ...).
    this.markUnauthenticated();
    // Au premier chargement (lien reçu par e-mail…), router.url vaut encore « / » tant que la
    // navigation n'est pas terminée : on regarde aussi l'URL visée et celle du navigateur.
    const targets = [
      this.router.url,
      this.router.getCurrentNavigation()?.finalUrl?.toString() ?? '',
      window.location.pathname
    ];
    if (!targets.some((url) => url.startsWith('/auth'))) {
      this.router.navigateByUrl('/auth/login');
    }
  }

  completeLoginAfterCookie(): Observable<void> {
    return this.loadSession().pipe(map(() => undefined));
  }

  private applyAuthenticatedSession(response: AuthenticateResponse): void {
    if (!response.isAuthenticated || !response.user) {
      this.clearSessionState();
      return;
    }

    this.currentUserSig.set(response.user);
    this.menusSig.set(response.menus ?? []);
    this.authenticatedSig.set(true);
    this.subscriptionNotice.setAlerts(response.subscription_alerts ?? []);

    if (response.company?.short_name) {
      this.companySig.set({
        short_name: response.company.short_name,
        logo_url: response.company.logo_url ?? ''
      });
    }
  }

  private clearSessionState(): void {
    this.currentUserSig.set(null);
    this.menusSig.set([]);
    this.companySig.set(null);
    this.authenticatedSig.set(false);
    this.subscriptionNotice.reset();
  }

  private markUnauthenticated(): void {
    this.authCheck$ = of(false);
    this.authCheckComplete = true;
  }

  private invalidateAuthCheck(): void {
    this.authCheck$ = undefined;
    this.authCheckComplete = false;
  }

  private normalizePath(path: string): string {
    const trimmed = path.split('?')[0];
    if (!trimmed || trimmed === '/') {
      return '/dashboard';
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
