export interface UserRole {
  id: number;
  name: string;
  label: string;
}

export interface UserListItem {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone_one: string;
  status: boolean;
  role_id: number;
  role?: UserRole | null;
  tenant_id: number | null;
}

export interface User extends UserListItem {
  username: string | null;
  phone_two: string | null;
  address: string | null;
}

export interface UserPayload {
  first_name: string;
  last_name: string;
  username?: string | null;
  email?: string | null;
  phone_one: string;
  phone_two?: string | null;
  address?: string | null;
  role_id: number;
  tenant_id?: number | null;
  status?: boolean;
}
