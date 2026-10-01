import { Granularity, KpiValue, SeriesPoint } from '../models/admin-stats.model';
import { SubscriptionStatus } from '../models/auth.model';
import { PageMeta } from '../models/company.model';

/** Boutique proposée dans le sélecteur de la barre du haut. */
export interface OwnerStoreOption {
  id: number;
  name: string;
  active: boolean;
  /** Vente au poids / au volume et unités multiples ; sinon tout se vend à la pièce. */
  uses_measurements: boolean;
  /** Suivi des produits par numéro de série (IMEI) ; sinon menus et options IMEI masqués. */
  uses_serial_numbers: boolean;
  subscription: SubscriptionStatus;
}

export interface OwnerStoreOverview {
  id: number;
  name: string;
  address: string;
  phone_one: string;
  active: boolean;
  uses_serial_numbers: boolean;
  /** Rouleau de l'imprimante ticket (mm). */
  ticket_width: 58 | 80;
  logo_url: string | null;
  primary_color: string | null;
  subscription: SubscriptionStatus;
  sales_revenue: number;
  sales_count: number;
  products_count: number;
  low_stock_count: number;
  receivables: number;
  team_count: number;
  /** Vitrine publique (lecture seule : activée par l'administrateur). */
  storefront: { enabled: boolean; online: boolean; url: string | null };
}

export interface OwnerDashboard {
  period: {
    start: string;
    end: string;
    days: number;
    granularity: Granularity;
    previous_start: string;
    previous_end: string;
  };
  currency: string;
  store: { id: number; name: string } | null;
  /** Vitrine de la boutique affichée (null pour « toutes les boutiques » ou un vendeur). */
  storefront: { enabled: boolean; online: boolean; url: string | null } | null;
  /** Boutiques exclues de « Toutes les boutiques » (abonnement expiré). */
  excluded_stores: SubscriptionStatus[];
  kpis: {
    sales_revenue: KpiValue;
    sales_count: KpiValue;
    average_basket: KpiValue;
    cash_in: KpiValue;
    expenses: KpiValue;
  };
  receivables: { amount: number; invoices: number };
  series: { sales_revenue: SeriesPoint[] };
  top_products: { id: number; name: string; unit: string; quantity: number; revenue: number }[];
  by_store: { store_id: number; store_name: string; sales_count: number; revenue: number }[];
  low_stock: {
    count: number;
    items: { id: number; name: string; store_name: string; quantity: number; alert_threshold: number; unit: string }[];
  };
}

export type SaleStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'no_paid' | 'partial' | 'paid' | 'cancelled';

export interface OwnerSale {
  id: number;
  sale_number: string;
  date: string;
  store: { id: number; name: string } | null;
  seller: string | null;
  customer: string;
  total_amount: number;
  status: SaleStatus;
  payment_status: PaymentStatus;
  invoice: { number: string; amount_paid: number; balance: number } | null;
}

export interface OwnerSaleDetail extends OwnerSale {
  gross_amount: number;
  discount: number;
  customer_phone: string | null;
  items: {
    id: number;
    product: string;
    unit: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    serial_numbers: string[];
  }[];
  payments: { id: number; date: string; amount: number; type: string; user: string | null }[];
}

export interface OwnerSalesResponse {
  data: OwnerSale[];
  meta: PageMeta;
  /** Analyses de la période (indépendantes des filtres statut / paiement). */
  summary: {
    revenue: KpiValue;
    sales_count: KpiValue;
    average_basket: KpiValue;
    collected: number;
    outstanding: number;
    cancelled_count: number;
    cancelled_amount: number;
    pending_count: number;
  };
  series: SeriesPoint[];
  by_seller: { id: number; name: string; sales_count: number; revenue: number }[];
  by_payment_type: { type: string; count: number; total: number }[];
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

export type SaleSort = 'recent' | 'amount';

export interface OwnerSalesQuery {
  store_id: number | null;
  start: string;
  end: string;
  status: SaleStatus | '';
  /** 'due' = à encaisser (partielle ou non payée). */
  payment_status: PaymentStatus | 'due' | '';
  search: string;
  sort: SaleSort;
  page: number;
}

// --- Produits & stock ------------------------------------------------------------

export type StockState = 'out' | 'low' | 'ok';

export interface OwnerProduct {
  id: number;
  name: string;
  image_url: string | null;
  store: { id: number; name: string } | null;
  category: string | null;
  base_unit: string;
  quantity: number;
  alert_threshold: number;
  stock_state: StockState;
  price: number | null;
  stock_value: number;
  require_serial_number: boolean;
  units: { name: string; price: number; factor: number }[];
}

export interface OwnerProductsResponse {
  data: OwnerProduct[];
  meta: PageMeta;
  summary: { products: number; out: number; low: number; stock_value: number };
  currency: string;
}

export interface OwnerCategory {
  id: number;
  name: string;
  store_name: string | null;
}

// --- Clients -------------------------------------------------------------------------

export interface OwnerCustomer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  store: { id: number; name: string } | null;
  sales_count: number;
  total_purchases: number;
  balance_due: number;
  open_invoices: number;
  last_purchase_at: string | null;
  reminder: CustomerReminderState;
}

/** Ce qui empêche de relancer un client sur WhatsApp. */
export type ReminderBlocker = 'disabled' | 'no_phone' | 'no_debt' | 'recent';

export interface CustomerReminderState {
  /** null = le client peut être relancé maintenant. */
  blocker: ReminderBlocker | null;
  /** Dernière relance envoyée (date ISO). */
  last_at: string | null;
}

/** Débiteurs du périmètre, du plus gros reste dû au plus petit (GET /customers/reminder-targets). */
export interface ReminderTargetsResponse {
  data: OwnerCustomer[];
  /** Nombre de clients relancés par lot. */
  batch_size: number;
  /** Délai minimal entre deux relances d'un même client. */
  cooldown_hours: number;
  currency: string;
}

/** Réponse de POST /customers/{id}/remind (200 envoyée, 422 ignorée, 502 échec). */
export interface ReminderResult {
  status: 'sent' | 'skipped' | 'failed';
  reason: string | null;
  message: string;
  /** Le service WhatsApp est en panne : inutile de poursuivre un lot. */
  fatal: boolean;
  last_at: string | null;
}

export type CustomerSegment = 'debtors' | 'buyers' | 'inactive';
export type CustomerSort = 'purchases' | 'debt' | 'recent' | 'name';

export interface OwnerCustomersResponse {
  data: OwnerCustomer[];
  meta: PageMeta;
  summary: { customers: number; debtors: number; total_due: number; total_purchases: number; inactive: number };
  currency: string;
  /** Au moins une boutique du périmètre peut relancer ses clients sur WhatsApp. */
  reminders_enabled: boolean;
}

export interface OwnerCustomerInvoice {
  id: number;
  number: string;
  date: string;
  amount_total: number;
  amount_paid: number;
  balance: number;
  age_days: number;
}

/** Fiche client (GET /owner/customers/{id}) : `open_invoices` y est la liste des factures non soldées. */
export type OwnerCustomerFile = Omit<OwnerCustomer, 'open_invoices'> & {
  average_basket: number;
  first_purchase_at: string | null;
  created_at: string | null;
  sales: {
    id: number;
    sale_number: string;
    date: string;
    total_amount: number;
    status: SaleStatus;
    payment_status: PaymentStatus;
    balance: number;
  }[];
  open_invoices: OwnerCustomerInvoice[];
};

export interface CustomerPayload {
  name: string;
  phone: string;
  email: string | null;
  address: string;
  store_id: number | null;
}

// --- Dépenses ------------------------------------------------------------------------

export interface OwnerExpense {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  date: string;
  store: { id: number; name: string } | null;
  user: string | null;
}

export type ExpenseSort = 'recent' | 'amount';

export interface OwnerExpensesResponse {
  data: OwnerExpense[];
  meta: PageMeta;
  summary: {
    total: number;
    previous_total: number;
    count: number;
    daily_average: number;
    largest: number;
    /** Postes : dépenses regroupées par intitulé. */
    by_title: { title: string; total: number; count: number }[];
    by_store: { store_id: number; store_name: string; total: number; count: number }[];
  };
  period: {
    start: string;
    end: string;
    days: number;
    previous_start: string;
    previous_end: string;
    granularity: Granularity;
  };
  series: SeriesPoint[];
  currency: string;
}

export interface ExpensePayload {
  store_id: number | null;
  title: string;
  description: string | null;
  amount: number | null;
  expense_date: string;
}

// --- Mon entreprise ----------------------------------------------------------------

export interface OwnerCompany {
  id: number;
  name: string;
  short_name: string;
  slogan: string | null;
  head_office_address: string;
  email: string;
  phone_one: string;
  phone_two: string | null;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  stores_count: number;
}

// --- Équipe --------------------------------------------------------------------------

export type TeamRole = 'Manager' | 'Seller';

export interface TeamMember {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number_one: string;
  phone_number_two: string | null;
  address: string;
  gender: 'male' | 'female';
  status: boolean;
  /** Mot de passe fixé par un responsable, pas encore changé par le membre. */
  must_change_password: boolean;
  role: TeamRole;
  store: { id: number; name: string } | null;
  image_url: string | null;
  /** Ventes enregistrées (annulées comprises). */
  sales_count: number;
  /** Faux pour un gérant face à un autre gestionnaire : consultation seule. */
  can_manage: boolean;
  /** Supprimable tant qu'aucune vente n'a été enregistrée. */
  can_delete: boolean;
}

export interface TeamMemberPayload {
  role: TeamRole;
  store_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number_one: string;
  phone_number_two: string | null;
  address: string;
  gender: 'male' | 'female';
}

export type OwnerCompanyPayload = Omit<OwnerCompany, 'id' | 'logo_url' | 'stores_count'> & {
  logo?: File | null;
  remove_logo?: boolean;
};

// --- Approvisionnements ----------------------------------------------------------

export type SupplyStatus = 'pending' | 'received' | 'cancelled';
export type SupplySort = 'recent' | 'amount';

export interface OwnerSupply {
  id: number;
  order_number: string;
  /** Date de saisie (ISO 8601). */
  date: string;
  status: SupplyStatus;
  total_amount: number;
  lines_count: number;
  store: { id: number; name: string } | null;
  supplier: { id: number; name: string; phone: string } | null;
  user: string | null;
  received_at: string | null;
}

export interface OwnerSupplyLine {
  id: number;
  product_id: number;
  product: string;
  product_deleted: boolean;
  unit: string | null;
  require_serial_number: boolean;
  current_stock: number | null;
  quantity: number;
  purchase_price: number;
  total: number;
  serial_numbers: string[];
}

export interface OwnerSupplyDetail extends Omit<OwnerSupply, 'supplier'> {
  supplier: { id: number; name: string; phone: string; phone_two: string | null; email: string | null; address: string } | null;
  uses_measurements: boolean;
  received_by: string | null;
  updated_at: string | null;
  lines: OwnerSupplyLine[];
}

export interface OwnerSuppliesResponse {
  data: OwnerSupply[];
  meta: PageMeta;
  summary: {
    /** Montant des approvisionnements reçus sur la période. */
    received: KpiValue;
    received_count: KpiValue;
    /** Reste à réceptionner, toutes dates confondues. */
    pending: { count: number; amount: number; oldest: string | null };
    status_counts: Record<SupplyStatus | 'all', number>;
    cancelled_amount: number;
    by_supplier: { id: number; name: string; count: number; total: number }[];
    top_products: { id: number; name: string; unit: string; quantity: number; total: number }[];
  };
  series: SeriesPoint[];
  period: {
    start: string;
    end: string;
    days: number;
    previous_start: string;
    previous_end: string;
    granularity: Granularity;
  };
  currency: string;
  excluded_stores: SubscriptionStatus[];
}

export interface OwnerSuppliesQuery {
  start: string;
  end: string;
  status: SupplyStatus | '';
  supplier_id: number | null;
  search: string;
  sort: SupplySort;
}

export interface OwnerSupplier {
  id: number;
  name: string;
  phone: string;
  phone_two: string | null;
  email: string | null;
  address: string;
  store: { id: number; name: string } | null;
  received_count: number;
  received_total: number;
  /** Approvisionnements en attente de réception. */
  pending_count: number;
  pending_amount: number;
  last_supply_at: string | null;
}

export type SupplierSort = 'name' | 'purchases' | 'recent';

export interface OwnerSuppliersResponse {
  data: OwnerSupplier[];
  summary: {
    count: number;
    /** Livrés dans les 90 derniers jours. */
    active: number;
    received_total: number;
    pending_count: number;
    pending_amount: number;
  };
  currency: string;
}

/** Fiche fournisseur (GET /owner/suppliers/{id}). */
export interface OwnerSupplierFile extends OwnerSupplier {
  first_supply_at: string | null;
  average_amount: number;
  recent_supplies: { id: number; order_number: string; date: string; status: SupplyStatus; total_amount: number; lines_count: number }[];
  top_products: { id: number; name: string; unit: string; quantity: number; total: number; last_at: string }[];
}

export interface SupplierPayload {
  /** Uniquement à la création. */
  store_id?: number;
  name: string;
  phone_one: string;
  phone_two: string | null;
  email: string | null;
  address: string | null;
}

/** Produit proposé dans le formulaire d'approvisionnement. */
export interface SupplyProduct {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  alert_threshold: number;
  stock_state: StockState;
  require_serial_number: boolean;
  last_purchase_price: number | null;
}

/** N° de série déjà enregistré dans la boutique (contrôle au scan). */
export interface SerialConflict {
  serial_number: string;
  product_id: number;
  product: string | null;
  status: 'in_stock' | 'sold' | 'pending';
  order_number: string | null;
}

export interface SupplyPayload {
  /** Uniquement à la création. */
  store_id?: number;
  supplier_id: number;
  /** Réceptionner immédiatement (entrée en stock). */
  receive: boolean;
  line_items: { product_id: number; quantity: number; purchase_price: number; serial_numbers?: string[] }[];
}
