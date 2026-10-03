import { PageMeta } from '../models/company.model';

/** Brouillon et envoyé restent modifiables ; accepté et refusé sont figés. */
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';

export interface OwnerQuote {
  id: number;
  number: string;
  date: string;
  store: { id: number; name: string } | null;
  customer: string | null;
  customer_id: number;
  author: string | null;
  status: QuoteStatus;
  total_amount: number;
  valid_until: string | null;
  /** Indication seulement : la validité dépassée ne change pas le statut. */
  validity_passed: boolean;
  decided_at: string | null;
  editable: boolean;
}

export interface QuoteLine {
  id: number;
  product_id: number | null;
  unit_of_measure_id: number | null;
  designation: string;
  unit_name: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface OwnerQuoteDetail extends OwnerQuote {
  customer_phone: string | null;
  notes: string | null;
  gross_amount: number;
  discount: number;
  sent_at: string | null;
  source_number: string | null;
  items: QuoteLine[];
  whatsapp_available: boolean;
}

export interface OwnerQuotesQuery {
  store_id: number | null;
  status: QuoteStatus | '';
  search: string;
  page: number;
}

export interface OwnerQuotesResponse {
  data: OwnerQuote[];
  meta: PageMeta;
  summary: Record<QuoteStatus, { count: number; total: number }>;
  currency: string;
}

export interface QuotePayload {
  store_id?: number;
  customer: { mode: 'existing' | 'new'; id?: number | null; name?: string; phone?: string };
  items: {
    product_id: number | null;
    unit_of_measure_id: number | null;
    designation: string;
    unit_name: string | null;
    quantity: number;
    unit_price: number;
  }[];
  discount: number;
  valid_until: string | null;
  notes: string | null;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé'
};
