export interface Category {
  id: number;
  name: string;
  description: string;
  tenant_id: number;
}

export interface CategoryPayload {
  name: string;
  description: string;
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
