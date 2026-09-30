import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { storeSpaceApiUrl } from './owner.service';
import {
  CheckoutPayload,
  CheckoutResult,
  OwnerInvoiceDetail,
  OwnerInvoicesQuery,
  OwnerInvoicesResponse,
  OwnerPaymentsQuery,
  OwnerPaymentsResponse,
  PaymentType,
  PosCustomer,
  PosProductsResponse
} from './pos.model';

/** Caisse (nouvelle vente) et factures d'une boutique, dans l'espace courant (/owner ou /manager). */
@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private get apiUrl(): string {
    return storeSpaceApiUrl(this.authService);
  }

  products(storeId: number, filters: { search: string; category_id: number | null }, page = 1): Observable<PosProductsResponse> {
    let params = new HttpParams().set('store_id', storeId).set('page', page).set('perPage', 24);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.category_id) {
      params = params.set('category_id', filters.category_id);
    }
    return this.http.get<PosProductsResponse>(`${this.apiUrl}/pos/products`, { params });
  }

  serials(storeId: number, productId: number): Observable<string[]> {
    const params = new HttpParams().set('store_id', storeId);
    return this.http
      .get<{ data: string[] }>(`${this.apiUrl}/pos/products/${productId}/serials`, { params })
      .pipe(map((r) => r.data));
  }

  customers(storeId: number, search: string): Observable<PosCustomer[]> {
    let params = new HttpParams().set('store_id', storeId);
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<{ data: PosCustomer[] }>(`${this.apiUrl}/pos/customers`, { params }).pipe(map((r) => r.data));
  }

  checkout(payload: CheckoutPayload): Observable<{ message: string; data: CheckoutResult }> {
    return this.http.post<{ message: string; data: CheckoutResult }>(`${this.apiUrl}/sales`, payload);
  }

  invoices(query: OwnerInvoicesQuery, perPage = 15): Observable<OwnerInvoicesResponse> {
    let params = new HttpParams().set('start', query.start).set('end', query.end).set('page', query.page).set('perPage', perPage);
    if (query.store_id) {
      params = params.set('store_id', query.store_id);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    return this.http.get<OwnerInvoicesResponse>(`${this.apiUrl}/invoices`, { params });
  }

  invoice(id: number): Observable<{ data: OwnerInvoiceDetail; currency: string }> {
    return this.http.get<{ data: OwnerInvoiceDetail; currency: string }>(`${this.apiUrl}/invoices/${id}`);
  }

  pay(id: number, payload: { amount: number; payment_type: PaymentType; date: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/invoices/${id}/payments`, payload);
  }

  /** Envoi de la facture au client sur WhatsApp. */
  sendWhatsapp(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/invoices/${id}/whatsapp`, {});
  }

  payments(query: OwnerPaymentsQuery, perPage = 20): Observable<OwnerPaymentsResponse> {
    const params = this.paymentParams(query).set('page', query.page).set('perPage', perPage);
    return this.http.get<OwnerPaymentsResponse>(`${this.apiUrl}/payments`, { params });
  }

  /** Export des paiements filtrés : CSV (tableur) ou PDF (rapport / clôture de caisse). */
  exportPayments(query: OwnerPaymentsQuery, format: 'csv' | 'pdf' = 'csv'): Observable<Blob> {
    const path = format === 'pdf' ? 'payments/export-pdf' : 'payments/export';
    return this.http.get(`${this.apiUrl}/${path}`, { params: this.paymentParams(query), responseType: 'blob' });
  }

  private paymentParams(query: OwnerPaymentsQuery): HttpParams {
    let params = new HttpParams().set('start', query.start).set('end', query.end);
    if (query.store_id) {
      params = params.set('store_id', query.store_id);
    }
    if (query.type) {
      params = params.set('type', query.type);
    }
    if (query.origin) {
      params = params.set('origin', query.origin);
    }
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    return params;
  }
}
