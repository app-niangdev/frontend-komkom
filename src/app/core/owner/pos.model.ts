import { SubscriptionStatus } from '../models/auth.model';
import { Granularity, KpiValue, SeriesPoint } from '../models/admin-stats.model';
import { PageMeta } from '../models/company.model';

export type PaymentType = 'cash' | 'wave' | 'OM' | 'other';
export type InvoiceStatus = 'no_paid' | 'partial' | 'paid' | 'cancelled';

/** Unité de vente d'un produit ; `factor` = équivalent en unité de base. `id` null : produit sans unité enregistrée. */
export interface PosUnit {
  id: number | null;
  name: string;
  price: number;
  factor: number;
  is_base: boolean;
}

export interface PosProduct {
  id: number;
  name: string;
  image_url: string | null;
  category_id: number | null;
  category: string | null;
  base_unit: string;
  /** Stock en unité de base. */
  stock: number;
  stock_state: 'out' | 'low' | 'ok';
  require_serial_number: boolean;
  units: PosUnit[];
}

export interface PosProductsResponse {
  data: PosProduct[];
  meta: PageMeta;
  categories: { id: number; name: string }[];
  uses_measurements: boolean;
  currency: string;
}

export interface PosCustomer {
  id: number;
  name: string;
  phone: string;
  balance_due: number;
}

export type CustomerMode = 'anonymous' | 'existing' | 'new';

export interface CheckoutPayload {
  store_id: number;
  customer: { mode: CustomerMode; id?: number | null; name?: string; phone?: string };
  items: {
    product_id: number;
    unit_of_measure_id: number | null;
    quantity: number;
    unit_price: number;
    serial_numbers?: string[];
  }[];
  discount: number;
  payment: { amount: number; payment_type: PaymentType };
}

export interface CheckoutResult {
  sale_id: number;
  sale_number: string;
  invoice_id: number;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  /** Facture envoyée au client sur WhatsApp (boutique où l'envoi est activé, client avec téléphone). */
  whatsapp_sent?: boolean;
}

export interface OwnerInvoice {
  id: number;
  number: string;
  date: string;
  store: { id: number; name: string } | null;
  customer: string;
  customer_id: number | null;
  sale_number: string | null;
  seller: string | null;
  amount_total: number;
  amount_paid: number;
  balance: number;
  status: InvoiceStatus;
}

export interface InvoicePayment {
  id: number;
  date: string;
  recorded_at: string | null;
  amount: number;
  type: PaymentType;
  user: string | null;
}

export interface OwnerInvoiceDetail extends OwnerInvoice {
  customer_phone: string | null;
  sale: { id: number | null; number: string | null; date: string | null; status: string | null; gross_amount: number; discount: number };
  items: {
    id: number;
    product: string;
    unit: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    serial_numbers: string[];
  }[];
  payments: InvoicePayment[];
  /** En-tête des documents imprimés (boutique émettrice). */
  issuer: {
    name: string | null;
    company: string | null;
    slogan: string | null;
    address: string | null;
    phones: string[];
    email: string | null;
    logo_url: string | null;
    color: string | null;
    /** Rouleau de l'imprimante ticket de la boutique (mm). */
    ticket_width: 58 | 80;
  };
}

export type InvoiceFilter = InvoiceStatus | 'due' | '';

export interface OwnerInvoicesQuery {
  store_id: number | null;
  start: string;
  end: string;
  status: InvoiceFilter;
  search: string;
  page: number;
}

export interface OwnerInvoicesResponse {
  data: OwnerInvoice[];
  meta: PageMeta;
  summary: {
    /** Factures émises sur la période (hors annulées). */
    invoiced: number;
    invoices_count: number;
    invoiced_paid: number;
    /** Paiements reçus sur la période, quelle que soit la date de la facture. */
    collected: number;
    collected_by_type: Partial<Record<PaymentType, number>>;
    /** Reste dû aujourd'hui, toutes périodes confondues. */
    outstanding: number;
    open_count: number;
  };
  currency: string;
  excluded_stores: SubscriptionStatus[];
}

// --- Encaissements -----------------------------------------------------------------------

/** « À la vente » : reçu le jour de la facture ; « règlement » : reçu un jour suivant (dette soldée plus tard). */
export type PaymentOrigin = 'at_sale' | 'debt';

export interface OwnerPayment {
  id: number;
  /** Jour où l'argent a été reçu : c'est lui qui compte dans la période. */
  date: string;
  recorded_at: string | null;
  amount: number;
  type: PaymentType;
  origin: PaymentOrigin;
  invoice: { id: number | null; number: string; date: string; amount_total: number | null; balance: number };
  sale_number: string | null;
  customer: string;
  customer_phone: string | null;
  store: { id: number; name: string } | null;
  cashier: string | null;
}

export interface OwnerPaymentsQuery {
  store_id: number | null;
  start: string;
  end: string;
  type: PaymentType | '';
  origin: PaymentOrigin | '';
  search: string;
  page: number;
}

export interface OwnerPaymentsResponse {
  data: OwnerPayment[];
  meta: PageMeta;
  summary: {
    total: KpiValue;
    count: number;
    at_sale: number;
    debt: number;
    debt_count: number;
    debt_customers: number;
  };
  by_type: { type: PaymentType; count: number; total: number }[];
  by_cashier: { id: number; name: string; count: number; total: number }[];
  series: SeriesPoint[];
  period: {
    start: string;
    end: string;
    days: number;
    granularity: Granularity;
    previous_start: string;
    previous_end: string;
  };
  currency: string;
  excluded_stores: SubscriptionStatus[];
}
