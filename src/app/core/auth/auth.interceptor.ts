import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SubscriptionNoticeService } from './subscription-notice.service';

const AUTH_ENDPOINTS = ['/login', '/refresh', '/forgot-password', '/reset-password'];

let isRefreshing = false;
const refreshDone$ = new BehaviorSubject<boolean | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const subscriptionNotice = inject(SubscriptionNoticeService);

  const isAuthEndpoint = AUTH_ENDPOINTS.some((segment) => req.url.includes(segment));
  const withCredentialsReq = req.clone({ withCredentials: true });

  return next(withCredentialsReq).pipe(
    catchError((error: unknown) => {
      // Abonnement expiré pendant la session : déconnexion et détails sur l'écran de connexion.
      // /login et /login/verify-otp gèrent eux-mêmes ce cas.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        SubscriptionNoticeService.isExpiredError(error.error) &&
        !req.url.includes('/login')
      ) {
        if (!subscriptionNotice.expired()) {
          subscriptionNotice.setExpired(error.error);
          authService.logout();
        }
        return throwError(() => error);
      }

      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        return refreshDone$.pipe(
          filter((done): done is boolean => done !== null),
          take(1),
          switchMap((success) => {
            if (!success) {
              return throwError(() => error);
            }
            return next(withCredentialsReq);
          })
        );
      }

      isRefreshing = true;
      refreshDone$.next(null);

      return authService.refresh().pipe(
        catchError((refreshError) => {
          isRefreshing = false;
          refreshDone$.next(false);
          authService.clearSession();
          return throwError(() => refreshError);
        }),
        switchMap(() => {
          isRefreshing = false;
          refreshDone$.next(true);
          return next(withCredentialsReq);
        })
      );
    })
  );
};
