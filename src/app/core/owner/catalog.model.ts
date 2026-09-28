import { SubscriptionStatus } from '../models/auth.model';
import { PageMeta } from '../models/company.model';

/** Unité de vente ; `conversion_factor` = équivalent en unité de base (1 pour la base). */
export interface ProductUnit {
  id: number | null;
  name: string;
  price: number;
  conversion_factor: number;
  is_base_unit: boolean;
}

/** Fiche produit complète (formulaire de modification). */
export interface ProductDetail {
  id: number;
  name: string;
  description: string | null;
  store: { id: number; name: string } | null;
  category_id: number | null;
  category: string | null;
  image_url: string | null;
  alert_threshold: number;
  require_serial_number: boolean;
  base_unit: string;
  stock: number;
  uses_measurements: boolean;
  units: ProductUnit[];
  /** Produits suivis par numéro de série uniquement. */
  serials: { in_stock: number; sold: number } | null;
}

export interface ProductPayload {
  /** Uniquement à la création. */
  store_id?: number;
  name: string;
  category_id: number | null;
  description: string | null;
  alert_threshold: number;
  require_serial_number: boolean;
  units: ProductUnit[];
  image?: File | null;
  image_url?: string | null;
  remove_image?: boolean;
}

export type SerialStatus = 'in_stock' | 'sold' | 'pending';

export interface OwnerSerial {
  id: number;
  serial_number: string;
  status: SerialStatus;
  product: { id: number; name: string } | null;
  store: { id: number; name: string } | null;
  entered_at: string | null;
  supply: { id: number; order_number: string; supplier: string | null } | null;
  sale: { id: number; number: string; date: string | null; customer: string | null } | null;
}

export interface OwnerSerialsQuery {
  store_id: number | null;
  search: string;
  status: SerialStatus | '';
  product_id: number | null;
  page: number;
}

export interface OwnerSerialsResponse {
  data: OwnerSerial[];
  meta: PageMeta;
  summary: Record<SerialStatus, number>;
  excluded_stores: SubscriptionStatus[];
}

// --- Catégories --------------------------------------------------------------------------

export interface OwnerCategoryOverview {
  id: number;
  name: string;
  description: string | null;
  store: { id: number; name: string };
  products: number;
  out_of_stock: number;
  low_stock: number;
}

export interface OwnerCategoriesResponse {
  data: OwnerCategoryOverview[];
  summary: { categories: number; products: number; uncategorized: number; empty: number };
  excluded_stores: SubscriptionStatus[];
}

export interface CategoryPayload {
  /** Uniquement à la création. */
  store_id?: number;
  name: string;
  description: string | null;
}
