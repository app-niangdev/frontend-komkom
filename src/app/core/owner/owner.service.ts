import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import {
  OwnerCategory,
  OwnerCompany,
  OwnerCompanyPayload,
  CustomerPayload,
  CustomerSegment,
  CustomerSort,
  OwnerCustomer,
  OwnerCustomerFile,
  OwnerCustomersResponse,
  OwnerDashboard,
  ExpensePayload,
  ExpenseSort,
  OwnerExpense,
  OwnerExpensesResponse,
  OwnerProductsResponse,
  OwnerSaleDetail,
  OwnerSalesQuery,
  OwnerSalesResponse,
  OwnerStoreOption,
  OwnerStoreOverview,
  StockState,
  OwnerSuppliesQuery,
  OwnerSuppliesResponse,
  OwnerSupplier,
  OwnerSupplierFile,
  OwnerSuppliersResponse,
  SupplierSort,
  OwnerSupplyDetail,
  SupplierPayload,
  SerialConflict,
  SupplyPayload,
  SupplyProduct,
  TeamMember,
  TeamMemberPayload,
  TeamRole
} from './owner.model';

const SPACES: Record<string, string> = { Manager: 'manager', Seller: 'seller' };

/** Préfixe d'API de l'espace courant : /manager pour un gérant, /seller pour un vendeur, /owner sinon. */
export function storeSpaceApiUrl(authService: AuthService): string {
  const space = SPACES[authService.currentUser()?.role?.name ?? ''] ?? 'owner';
  return `${environment.apiUrl}/${space}`;
}

/**
 * API de l'espace propriétaire (/owner/*) : données limitées aux boutiques de son entreprise.
 * Un gérant appelle les mêmes modules sous /manager/*, limités à sa boutique.
 */
@Injectable({ providedIn: 'root' })
export class OwnerService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private get apiUrl(): string {
    return storeSpaceApiUrl(this.authService);
  }

  storeOptions(): Observable<OwnerStoreOption[]> {
    return this.http.get<{ data: OwnerStoreOption[] }>(`${this.apiUrl}/store-options`).pipe(map((r) => r.data));
  }

  updateStoreSettings(
    storeId: number,
    settings: { uses_serial_numbers?: boolean; ticket_width?: 58 | 80 }
  ): Observable<{ message: string; uses_serial_numbers: boolean; ticket_width: 58 | 80 }> {
    return this.http.patch<{ message: string; uses_serial_numbers: boolean; ticket_width: 58 | 80 }>(`${this.apiUrl}/stores/${storeId}/settings`, settings);
  }

  stores(start: string, end: string): Observable<OwnerStoreOverview[]> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<{ data: OwnerStoreOverview[] }>(`${this.apiUrl}/stores`, { params }).pipe(map((r) => r.data));
  }

  dashboard(storeId: number | null, start: string, end: string): Observable<OwnerDashboard> {
    const params = this.scoped(storeId).set('start', start).set('end', end);
    return this.http.get<OwnerDashboard>(`${this.apiUrl}/dashboard`, { params });
  }

  sales(query: OwnerSalesQuery, perPage = 15): Observable<OwnerSalesResponse> {
    const params = this.salesParams(query).set('page', query.page).set('perPage', perPage);
    return this.http.get<OwnerSalesResponse>(`${this.apiUrl}/sales`, { params });
  }

  /** Export des ventes filtrées : CSV (tableur) ou PDF (rapport imprimable). */
  exportSales(query: OwnerSalesQuery, format: 'csv' | 'pdf' = 'csv'): Observable<Blob> {
    const path = format === 'pdf' ? 'sales/export-pdf' : 'sales/export';
    return this.http.get(`${this.apiUrl}/${path}`, { params: this.salesParams(query), responseType: 'blob' });
  }

  private salesParams(query: OwnerSalesQuery): HttpParams {
    let params = this.scoped(query.store_id).set('start', query.start).set('end', query.end).set('sort', query.sort);
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.payment_status) {
      params = params.set('payment_status', query.payment_status);
    }
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    return params;
  }

  sale(id: number): Observable<{ data: OwnerSaleDetail; currency: string }> {
    return this.http.get<{ data: OwnerSaleDetail; currency: string }>(`${this.apiUrl}/sales/${id}`);
  }

  products(
    storeId: number | null,
    filters: { search: string; category_id: number | null; stock: StockState | '' },
    page: number
  ): Observable<OwnerProductsResponse> {
    // 24 : multiple de 8, 6, 4, 3 et 2 → lignes complètes quelle que soit la largeur de la grille
    let params = this.scoped(storeId).set('page', page).set('perPage', 24);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.category_id) {
      params = params.set('category_id', filters.category_id);
    }
    if (filters.stock) {
      params = params.set('stock', filters.stock);
    }
    return this.http.get<OwnerProductsResponse>(`${this.apiUrl}/products`, { params });
  }

  categories(storeId: number | null): Observable<OwnerCategory[]> {
    return this.http
      .get<{ data: OwnerCategory[] }>(`${this.apiUrl}/categories`, { params: this.scoped(storeId) })
      .pipe(map((r) => r.data));
  }

  customers(
    storeId: number | null,
    filters: { search: string; segment: CustomerSegment | ''; sort: CustomerSort },
    page: number
  ): Observable<OwnerCustomersResponse> {
    let params = this.scoped(storeId).set('page', page).set('perPage', 20).set('sort', filters.sort);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.segment) {
      params = params.set('segment', filters.segment);
    }
    return this.http.get<OwnerCustomersResponse>(`${this.apiUrl}/customers`, { params });
  }

  customer(id: number): Observable<{ data: OwnerCustomerFile; currency: string }> {
    return this.http.get<{ data: OwnerCustomerFile; currency: string }>(`${this.apiUrl}/customers/${id}`);
  }

  createCustomer(payload: CustomerPayload): Observable<{ message: string; data: OwnerCustomer }> {
    return this.http.post<{ message: string; data: OwnerCustomer }>(`${this.apiUrl}/customers`, payload);
  }

  updateCustomer(id: number, payload: CustomerPayload): Observable<{ message: string; data: OwnerCustomer }> {
    return this.http.put<{ message: string; data: OwnerCustomer }>(`${this.apiUrl}/customers/${id}`, payload);
  }

  deleteCustomer(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/customers/${id}`);
  }

  expenses(
    storeId: number | null,
    range: { start: string; end: string },
    filters: { search: string; sort: ExpenseSort },
    page: number
  ): Observable<OwnerExpensesResponse> {
    let params = this.scoped(storeId)
      .set('page', page)
      .set('perPage', 20)
      .set('start', range.start)
      .set('end', range.end)
      .set('sort', filters.sort);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    return this.http.get<OwnerExpensesResponse>(`${this.apiUrl}/expenses`, { params });
  }

  createExpense(payload: ExpensePayload): Observable<{ message: string; data: OwnerExpense }> {
    return this.http.post<{ message: string; data: OwnerExpense }>(`${this.apiUrl}/expenses`, payload);
  }

  updateExpense(id: number, payload: ExpensePayload): Observable<{ message: string; data: OwnerExpense }> {
    return this.http.put<{ message: string; data: OwnerExpense }>(`${this.apiUrl}/expenses/${id}`, payload);
  }

  deleteExpense(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/expenses/${id}`);
  }

  supplies(storeId: number | null, query: OwnerSuppliesQuery, page: number): Observable<OwnerSuppliesResponse> {
    let params = this.scoped(storeId)
      .set('page', page)
      .set('perPage', 20)
      .set('start', query.start)
      .set('end', query.end)
      .set('sort', query.sort);
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.supplier_id) {
      params = params.set('supplier_id', query.supplier_id);
    }
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    return this.http.get<OwnerSuppliesResponse>(`${this.apiUrl}/supplies`, { params });
  }

  supply(id: number): Observable<{ data: OwnerSupplyDetail; currency: string }> {
    return this.http.get<{ data: OwnerSupplyDetail; currency: string }>(`${this.apiUrl}/supplies/${id}`);
  }

  createSupply(payload: SupplyPayload): Observable<{ message: string; data: OwnerSupplyDetail }> {
    return this.http.post<{ message: string; data: OwnerSupplyDetail }>(`${this.apiUrl}/supplies`, payload);
  }

  updateSupply(id: number, payload: SupplyPayload): Observable<{ message: string; data: OwnerSupplyDetail }> {
    return this.http.put<{ message: string; data: OwnerSupplyDetail }>(`${this.apiUrl}/supplies/${id}`, payload);
  }

  /** Réception : entrée en stock. */
  receiveSupply(id: number): Observable<{ message: string; data: OwnerSupplyDetail }> {
    return this.http.post<{ message: string; data: OwnerSupplyDetail }>(`${this.apiUrl}/supplies/${id}/receive`, {});
  }

  cancelSupply(id: number): Observable<{ message: string; data: OwnerSupplyDetail }> {
    return this.http.post<{ message: string; data: OwnerSupplyDetail }>(`${this.apiUrl}/supplies/${id}/cancel`, {});
  }

  /** Annuaire des fournisseurs avec leurs statistiques d'achat. */
  supplierDirectory(storeId: number | null, filters: { search?: string; sort?: SupplierSort } = {}): Observable<OwnerSuppliersResponse> {
    let params = this.scoped(storeId).set('sort', filters.sort ?? 'name');
    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }
    return this.http.get<OwnerSuppliersResponse>(`${this.apiUrl}/suppliers`, { params });
  }

  /** Liste simple (sélecteurs). */
  suppliers(storeId: number | null, search = ''): Observable<OwnerSupplier[]> {
    return this.supplierDirectory(storeId, { search }).pipe(map((r) => r.data));
  }

  supplier(id: number): Observable<{ data: OwnerSupplierFile; currency: string }> {
    return this.http.get<{ data: OwnerSupplierFile; currency: string }>(`${this.apiUrl}/suppliers/${id}`);
  }

  createSupplier(payload: SupplierPayload): Observable<{ message: string; data: OwnerSupplier }> {
    return this.http.post<{ message: string; data: OwnerSupplier }>(`${this.apiUrl}/suppliers`, payload);
  }

  updateSupplier(id: number, payload: SupplierPayload): Observable<{ message: string; data: OwnerSupplier }> {
    return this.http.put<{ message: string; data: OwnerSupplier }>(`${this.apiUrl}/suppliers/${id}`, payload);
  }

  deleteSupplier(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/suppliers/${id}`);
  }

  /** N° de série déjà enregistrés dans la boutique ; `supplyId` = approvisionnement modifié (ignoré). */
  checkSupplySerials(storeId: number, serials: string[], supplyId: number | null): Observable<{ data: SerialConflict[] }> {
    return this.http.post<{ data: SerialConflict[] }>(`${this.apiUrl}/supply-serials/check`, {
      store_id: storeId,
      supply_id: supplyId,
      serials
    });
  }

  /** Produits d'une boutique à approvisionner ; `restock` = rupture ou stock faible uniquement. */
  supplyProducts(
    storeId: number,
    filters: { search?: string; restock?: boolean }
  ): Observable<{ data: SupplyProduct[]; uses_measurements: boolean }> {
    let params = new HttpParams().set('store_id', storeId);
    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.restock) {
      params = params.set('restock', 1);
    }
    return this.http.get<{ data: SupplyProduct[]; uses_measurements: boolean }>(`${this.apiUrl}/supply-products`, { params });
  }

  company(): Observable<OwnerCompany> {
    return this.http.get<{ data: OwnerCompany }>(`${this.apiUrl}/company`).pipe(map((r) => r.data));
  }

  /** Multipart (logo éventuel). */
  updateCompany(payload: OwnerCompanyPayload): Observable<{ message: string; data: OwnerCompany }> {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      if (typeof value === 'boolean') {
        form.set(key, value ? '1' : '0');
      } else if (value instanceof File) {
        form.set(key, value);
      } else {
        form.set(key, String(value));
      }
    });
    return this.http.post<{ message: string; data: OwnerCompany }>(`${this.apiUrl}/company`, form);
  }

  team(storeId: number | null, filters: { search: string; role: TeamRole | ''; status: '' | '1' | '0' }): Observable<TeamMember[]> {
    let params = this.scoped(storeId);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.role) {
      params = params.set('role', filters.role);
    }
    if (filters.status) {
      params = params.set('status', filters.status);
    }
    return this.http.get<{ data: TeamMember[] }>(`${this.apiUrl}/team`, { params }).pipe(map((r) => r.data));
  }

  createMember(payload: TeamMemberPayload): Observable<{ message: string; data: TeamMember }> {
    return this.http.post<{ message: string; data: TeamMember }>(`${this.apiUrl}/team`, payload);
  }

  updateMember(id: number, payload: TeamMemberPayload): Observable<{ message: string; data: TeamMember }> {
    return this.http.put<{ message: string; data: TeamMember }>(`${this.apiUrl}/team/${id}`, payload);
  }

  toggleMember(id: number): Observable<{ message: string; data: TeamMember }> {
    return this.http.patch<{ message: string; data: TeamMember }>(`${this.apiUrl}/team/${id}/status`, {});
  }

  /** « password » : renvoie le mot de passe temporaire (affiché une seule fois) ; « link » : e-mail envoyé. */
  resetMemberAccess(
    id: number,
    method: 'password' | 'link'
  ): Observable<{ message: string; temporary_password?: string; login?: string }> {
    return this.http.post<{ message: string; temporary_password?: string; login?: string }>(`${this.apiUrl}/team/${id}/reset-access`, { method });
  }

  deleteMember(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/team/${id}`);
  }

  /** Paramètre de boutique : absent = toutes les boutiques couvertes. */
  private scoped(storeId: number | null): HttpParams {
    const params = new HttpParams();
    return storeId ? params.set('store_id', storeId) : params;
  }
}
