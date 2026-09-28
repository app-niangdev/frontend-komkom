import { HttpErrorResponse } from '@angular/common/http';

/** Premier message de validation Laravel (422), sinon le message global de l'API. */
export function extractErrorMessage(err: HttpErrorResponse): string {
  const errors = err.error?.errors;
  if (errors && typeof errors === 'object') {
    const firstKey = Object.keys(errors)[0];
    if (firstKey && Array.isArray(errors[firstKey])) {
      return errors[firstKey][0];
    }
  }
  return err.error?.message ?? 'Une erreur est survenue.';
}
