import { Injectable } from '@angular/core';

const STORAGE_KEY = 'login_otp_challenge';

export interface LoginOtpState {
  challengeToken: string;
  rememberMe: boolean;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class OtpStateService {
  set(state: LoginOtpState): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  get(): LoginOtpState | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LoginOtpState) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
