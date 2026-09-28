import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Company,
  CompanyPayload,
  MessageResponse,
  PagedResponse,
  Store,
  StorePayload
} from '../models/company.model';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly companyUrl = `${environment.apiUrl}/company`;
  private readonly storeUrl = `${environment.apiUrl}/store`;

  // --- Entreprises -------------------------------------------------------

  list(page: number, perPage: number, search: string): Observable<PagedResponse<Company>> {
    const params = new HttpParams().set('page', page).set('perPage', perPage).set('search', search);
    return this.http.get<PagedResponse<Company>>(`${this.companyUrl}/list`, { params });
  }

  find(id: number): Observable<Company> {
    return this.http
      .get<{ success: boolean; data: Company }>(`${this.companyUrl}/show/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: CompanyPayload): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.companyUrl}/add`, payload);
  }

  update(id: number, payload: CompanyPayload): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.companyUrl}/update/${id}`, payload);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.companyUrl}/delete/${id}`);
  }

  // --- Boutiques d'une entreprise -----------------------------------------

  listStores(companyId: number, page: number, perPage: number, search: string): Observable<PagedResponse<Store>> {
    const params = new HttpParams().set('page', page).set('perPage', perPage).set('search', search);
    return this.http.get<PagedResponse<Store>>(`${this.storeUrl}/list/${companyId}`, { params });
  }

  createStore(payload: StorePayload): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.storeUrl}/add`, this.toFormData(payload));
  }

  /** Multipart + _method=PUT pour permettre l'envoi du logo. */
  updateStore(id: number, payload: StorePayload): Observable<MessageResponse> {
    const formData = this.toFormData(payload);
    formData.set('_method', 'PUT');
    return this.http.post<MessageResponse>(`${this.storeUrl}/update/${id}`, formData);
  }

  toggleStoreStatus(id: number): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(`${this.storeUrl}/change-status/${id}`);
  }

  deleteStore(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.storeUrl}/delete/${id}`);
  }

  private toFormData(payload: StorePayload): FormData {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      if (typeof value === 'boolean') {
        formData.set(key, value ? '1' : '0');
      } else if (value instanceof File) {
        formData.set(key, value);
      } else {
        formData.set(key, String(value));
      }
    });

    return formData;
  }
}
