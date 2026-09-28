import { AuthUser } from './auth.model';

export interface ProfileUser extends AuthUser {
  gender: 'male' | 'female' | null;
  email_verified_at: string | null;
}

/** Réponse de GET /profile : le compte connecté et son rattachement. */
export interface Profile {
  user: ProfileUser;
  company: { id: number; name: string; logo_url: string | null } | null;
  store: { id: number; name: string } | null;
  /** Nombre de boutiques (propriétaire uniquement). */
  stores_count: number | null;
  member_since: string | null;
}

export interface ContactsPayload {
  phone_number_one: string;
  phone_number_two: string | null;
  address: string;
}

export interface PasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}
