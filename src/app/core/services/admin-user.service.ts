import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUser, AdminUserFilters, AdminUserPayload, Role } from '../models/admin-user.model';
import { MessageResponse, PagedResponse } from '../models/company.model';

/** Gestion des utilisateurs côté administrateur (API /user/*). */
@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/user`;

  list(page: number, perPage: number, filters: AdminUserFilters): Observable<PagedResponse<AdminUser>> {
    let params = new HttpParams().set('page', page).set('per_page', perPage);
    if (filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.role_id) {
      params = params.set('role_id', filters.role_id);
    }
    if (filters.company_id) {
      params = params.set('company_id', filters.company_id);
    }
    if (filters.status !== '') {
      params = params.set('status', filters.status);
    }

    return this.http.get<PagedResponse<AdminUser>>(`${this.apiUrl}/list`, { params });
  }

  roles(): Observable<Role[]> {
    return this.http.get<{ data: Role[] }>(`${environment.apiUrl}/roles`).pipe(map((res) => res.data));
  }

  create(payload: AdminUserPayload): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/add`, payload);
  }

  update(id: number, payload: AdminUserPayload): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/update/${id}`, payload);
  }

  toggleStatus(id: number): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(`${this.apiUrl}/disable/${id}`);
  }

  delete(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/delete/${id}`);
  }
}
