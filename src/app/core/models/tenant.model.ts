export interface Tenant {
  id: number;
  name: string;
  code_website: string;
  slogan: string | null;
  description: string | null;
  phone_other: string | null;
  phone_call: string | null;
  phone_whatsapp: string | null;
  logo_url: string | null;
  snap: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  color_code: string | null;
  short_name: string | null;
  state: boolean;
}

export interface TenantPayload {
  name: string;
  code_website: string;
  slogan?: string | null;
  description?: string | null;
  phone_other?: string | null;
  phone_call?: string | null;
  phone_whatsapp?: string | null;
  color_code?: string | null;
  short_name?: string | null;
  user_id?: number | null;
  logo?: File | null;
  remove_logo?: boolean;
}

export interface PaginatedMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginatedResponse<T> {
  status: number;
  message: string;
  payload: T[];
  meta: PaginatedMeta;
}

export interface ApiItemResponse<T> {
  status: number;
  message: string;
  payload: T;
}
