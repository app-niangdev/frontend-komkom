import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkAuthStatus().pipe(
    map((isAuthenticated) => isAuthenticated || router.createUrlTree(['/auth/login']))
  );
};

export const menuChildGuard: CanActivateChildFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const path = state.url.split('?')[0];
  if (authService.canAccessPath(path)) {
    return true;
  }

  return router.createUrlTree([authService.landingUrl()]);
};

/**
 * /dashboard est la route par défaut : si le rôle n'a pas de menu /dashboard
 * (ex. Admin -> /admin/dashboard, Owner -> /stores), on le renvoie vers son premier menu.
 */
export const landingGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const landing = authService.landingUrl();
  return landing === '/dashboard' ? true : router.createUrlTree([landing]);
};

/** Réserve un espace à un rôle ; les autres sont renvoyés vers leur premier menu. */
function roleGuard(role: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.ensureCurrentUser().pipe(
      map((user) => {
        if (!user) {
          return router.createUrlTree(['/auth/login']);
        }

        return user.role?.name === role ? true : router.createUrlTree([authService.landingUrl()]);
      })
    );
  };
}

export const adminGuard = roleGuard('Admin');
export const ownerGuard = roleGuard('Owner');
export const managerGuard = roleGuard('Manager');
export const sellerGuard = roleGuard('Seller');

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkAuthStatus().pipe(
    map((isAuthenticated) => (isAuthenticated ? router.createUrlTree([authService.landingUrl()]) : true))
  );
};
