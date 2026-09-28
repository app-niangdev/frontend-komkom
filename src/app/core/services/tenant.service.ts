import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse, PaginatedResponse, Tenant, TenantPayload } from '../models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tenants`;

  list(perPage: number, search: string): Observable<PaginatedResponse<Tenant>> {
    const params = new HttpParams().set('per_page', perPage).set('search', search);

    return this.http.get<PaginatedResponse<Tenant>>(`${this.apiUrl}/list`, { params });
  }

  find(id: number): Observable<ApiItemResponse<Tenant>> {
    return this.http.get<ApiItemResponse<Tenant>>(`${this.apiUrl}/show/${id}`);
  }

  create(payload: TenantPayload): Observable<ApiItemResponse<Tenant>> {
    return this.http.post<ApiItemResponse<Tenant>>(`${this.apiUrl}/add`, this.toFormData(payload));
  }

  update(id: number, payload: Partial<TenantPayload>): Observable<ApiItemResponse<Tenant>> {
    const formData = this.toFormData(payload);
    formData.set('_method', 'PUT');

    return this.http.post<ApiItemResponse<Tenant>>(`${this.apiUrl}/update/${id}`, formData);
  }

  toggleStatus(id: number): Observable<ApiItemResponse<Tenant>> {
    return this.http.put<ApiItemResponse<Tenant>>(`${this.apiUrl}/toggle-status/${id}`, {});
  }

  forceDelete(id: number): Observable<ApiItemResponse<null>> {
    return this.http.delete<ApiItemResponse<null>>(`${this.apiUrl}/destroy/${id}/force`);
  }

  private toFormData(payload: Partial<TenantPayload>): FormData {
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
