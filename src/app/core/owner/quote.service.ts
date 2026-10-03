import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { storeSpaceApiUrl } from './owner.service';
import { OwnerQuoteDetail, OwnerQuotesQuery, OwnerQuotesResponse, QuotePayload } from './quote.model';

type Saved = { message: string; data: { id: number; number: string } };

/** Devis d'une boutique, dans l'espace courant (/owner ou /manager). */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private get apiUrl(): string {
    return `${storeSpaceApiUrl(this.authService)}/quotes`;
  }

  list(query: OwnerQuotesQuery, perPage = 15): Observable<OwnerQuotesResponse> {
    let params = new HttpParams().set('page', query.page).set('perPage', perPage);
    if (query.store_id) {
      params = params.set('store_id', query.store_id);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    return this.http.get<OwnerQuotesResponse>(this.apiUrl, { params });
  }

  get(id: number): Observable<{ data: OwnerQuoteDetail; currency: string }> {
    return this.http.get<{ data: OwnerQuoteDetail; currency: string }>(`${this.apiUrl}/${id}`);
  }

  create(payload: QuotePayload): Observable<Saved> {
    return this.http.post<Saved>(this.apiUrl, payload);
  }

  update(id: number, payload: QuotePayload): Observable<Saved> {
    return this.http.put<Saved>(`${this.apiUrl}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  duplicate(id: number): Observable<Saved> {
    return this.http.post<Saved>(`${this.apiUrl}/${id}/duplicate`, {});
  }

  markSent(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/mark-sent`, {});
  }

  decide(id: number, decision: 'accepted' | 'refused'): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/decision`, { decision });
  }

  sendWhatsapp(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/whatsapp`, {});
  }

  pdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, { responseType: 'blob' });
  }
}
