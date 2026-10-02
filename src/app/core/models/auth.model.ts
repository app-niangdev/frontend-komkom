export interface Menu {
  id: number;
  code: string;
  title: string;
  type: string;
  classes: string | null;
  url: string;
  icon: string;
  breadcrumbs: boolean;
  position: number;
}

export interface AuthUser {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  role_id: number;
  status: boolean;
  /** Mot de passe temporaire : changement imposé avant d'utiliser l'application. */
  must_change_password?: boolean;
  /** Langue d'affichage enregistrée sur le compte (null : jamais choisie). */
  locale?: 'fr' | 'ar' | null;
  role: { id: number; name: string };
  phone_number_one?: string | null;
  phone_number_two?: string | null;
  address?: string | null;
  image_url?: string | null;
}

export interface CompanySummary {
  id: number;
  name?: string;
  short_name?: string;
  logo_url?: string | null;
}

export type SubscriptionState = 'active' | 'expiring' | 'expired' | 'none';

/** État d'abonnement d'une boutique, calculé par le backend (SubscriptionService). */
export interface SubscriptionStatus {
  store_id: number;
  store_name: string;
  company_name: string | null;
  state: SubscriptionState;
  plan: string | null;
  starts_at: string | null;
  /** Fin de la période couverte en continu (renouvellements inclus). */
  ends_at: string | null;
  /** Jours restants (négatif si expiré, null sans abonnement). */
  days_left: number | null;
}

/** Corps d'une réponse 403 code SUBSCRIPTION_EXPIRED. */
export interface SubscriptionExpiredError {
  code: 'SUBSCRIPTION_EXPIRED';
  message: string;
  subscriptions: SubscriptionStatus[];
}

export interface AuthenticateResponse {
  isAuthenticated: boolean;
  user: AuthUser;
  menus: Menu[];
  subscription_alerts?: SubscriptionStatus[];
  subscription_warning_days?: number;
  company?: CompanySummary | null;
  stores?: unknown[];
  store?: unknown;
  owner?: unknown;
  manager?: unknown;
  seller?: unknown;
}

export interface AuthActionResponse {
  status: boolean;
  message?: string;
  code?: 'OTP_REQUIRED' | 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'SUBSCRIPTION_EXPIRED';
  attempts_left?: number;
  isDisabled?: boolean;
  data?: {
    challenge_token?: string;
    expires_in?: number;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface VerifyLoginOtpPayload {
  challenge_token: string;
  code: string;
  remember_me?: boolean;
}

export interface ApiMessageResponse {
  status?: boolean;
  message: string;
}
