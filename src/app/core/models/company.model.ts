export type Gender = 'male' | 'female';

export interface CompanyOwnerUser {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number_one: string;
  phone_number_two: string | null;
  address: string;
  gender: Gender;
  status: boolean;
}

export interface Company {
  id: number;
  name: string;
  short_name: string;
  slogan: string | null;
  head_office_address: string;
  email: string;
  phone_one: string;
  phone_two: string | null;
  owner_id: number;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  stores_count: number;
  owner: { id: number; user_id: number; user: CompanyOwnerUser | null } | null;
}

/** Payload attendu par /company/add et /company/update/{id} (propriétaire + entreprise). */
export interface CompanyPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number_one: string;
  phone_number_two: string | null;
  address: string;
  gender: Gender;
  name: string;
  short_name: string;
  slogan: string | null;
  head_office_address: string;
  email_company: string;
  phone_one: string;
  phone_two: string | null;
}

export interface Store {
  id: number;
  company_id: number;
  name: string;
  slogan: string | null;
  address: string;
  phone_one: string;
  phone_two: string | null;
  phone_three: string | null;
  email: string | null;
  active: boolean;
  uses_measurements: boolean;
  uses_serial_numbers: boolean;
  ticket_width: 58 | 80;
  whatsapp_invoices_enabled?: boolean;
  use_company_logo: boolean;
  use_company_colors: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  effective_primary_color: string | null;
  effective_secondary_color: string | null;
  nb_products: number;
  nb_sales: number;
  nb_managers: number;
  nb_suppliers: number;
}

export interface StorePayload {
  company_id: number;
  name: string;
  slogan: string | null;
  address: string;
  phone_one: string;
  phone_two: string | null;
  phone_three: string | null;
  email: string | null;
  uses_measurements: boolean;
  uses_serial_numbers: boolean;
  ticket_width: 58 | 80;
  whatsapp_invoices_enabled?: boolean;
  use_company_logo: boolean;
  use_company_colors: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  logo?: File | null;
}

export interface PageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PagedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface MessageResponse {
  success?: boolean;
  status?: boolean;
  message: string;
}

/** Vitrine publique d'une boutique (activée par l'administrateur). */
export interface StorefrontStatus {
  enabled: boolean;
  /** Réellement visible : activée, boutique active et abonnement en cours. */
  online: boolean;
  slug: string | null;
  url: string | null;
  /** Numéro WhatsApp tiré du téléphone principal (null s'il n'est pas valide). */
  whatsapp: string | null;
  enabled_at: string | null;
  /** Ce qui empêche (ou empêcherait) la vitrine d'être en ligne. */
  issues: string[];
}

export interface StoreStorefront {
  id: number;
  name: string;
  phone_one: string;
  active: boolean;
  storefront: StorefrontStatus;
}
