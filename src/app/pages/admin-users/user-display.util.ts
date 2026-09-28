import { AdminUser, RoleName } from '../../core/models/admin-user.model';

export const ROLE_LABELS: Record<RoleName, string> = {
  Admin: 'Administrateur',
  Owner: 'Propriétaire',
  Manager: 'Gestionnaire',
  Seller: 'Vendeur'
};

/** Boutique d'un gestionnaire ou d'un vendeur. */
export function storeOf(user: AdminUser) {
  return user.manager?.store ?? user.seller?.store ?? null;
}

/** Entreprise de rattachement : directe pour un propriétaire, via la boutique sinon. */
export function companyNameOf(user: AdminUser): string | null {
  return user.company?.name ?? storeOf(user)?.company?.name ?? null;
}

export function initialsOf(user: AdminUser): string {
  return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
}
