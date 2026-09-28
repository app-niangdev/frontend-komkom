import { Gender } from './company.model';

export type RoleName = 'Admin' | 'Owner' | 'Manager' | 'Seller';

export interface Role {
  id: number;
  name: RoleName;
}

interface StoreRef {
  id: number;
  name: string;
  company_id: number;
  company?: { id: number; name: string } | null;
}

/** Utilisateur tel que renvoyé par GET /user/list (relations role, company, manager/seller.store.company). */
export interface AdminUser {
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
  role_id: number;
  image_url: string | null;
  role: Role;
  company: { id: number; name: string } | null;
  manager: { id: number; store_id: number; store: StoreRef | null } | null;
  seller: { id: number; store_id: number; store: StoreRef | null } | null;
}

export interface AdminUserFilters {
  search: string;
  role_id: number | null;
  company_id: number | null;
  status: '' | '1' | '0';
}

export interface AdminUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  role_id: number;
  phone_number_one: string;
  phone_number_two: string | null;
  address: string;
  gender: Gender;
  store_id: number | null;
}
