import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessageResponse } from '../models/company.model';
import {
  StoreStatusFilters,
  StoreStatusesResponse,
  StoreSubscriptionHistory,
  SubscriptionPayload
} from '../models/subscription.model';

/** Gestion des abonnements des boutiques (API /subscription/*, réservée à l'administrateur). */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/subscription`;

  storeStatuses(page: number, perPage: number, filters: StoreStatusFilters): Observable<StoreStatusesResponse> {
    let params = new HttpParams().set('page', page).set('perPage', perPage);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.company_id) {
      params = params.set('company_id', filters.company_id);
    }
    if (filters.state) {
      params = params.set('state', filters.state);
    }

    return this.http.get<StoreStatusesResponse>(`${this.apiUrl}/stores`, { params });
  }

  history(storeId: number): Observable<StoreSubscriptionHistory> {
    return this.http.get<StoreSubscriptionHistory>(`${this.apiUrl}/store/${storeId}`);
  }

  create(payload: SubscriptionPayload): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/add`, payload);
  }

  update(id: number, payload: SubscriptionPayload): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/update/${id}`, payload);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/delete/${id}`);
  }
}
