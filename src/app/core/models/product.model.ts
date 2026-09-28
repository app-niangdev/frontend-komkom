export interface Product {
  id: number;
  name: string;
  description: string | null;
  available: boolean;
  unit_price: string;
  image_url: string | null;
  tenant_id: number;
  category_id: number;
}

export interface ProductPayload {
  name: string;
  description: string | null;
  unit_price: number;
  image_url?: string | null;
  image?: File | null;
  remove_image?: boolean;
  category_id: number;
}
