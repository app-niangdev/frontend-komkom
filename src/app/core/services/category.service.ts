import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse, Category, CategoryPayload, PaginatedResponse } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  list(perPage: number, search: string): Observable<PaginatedResponse<Category>> {
    const params = new HttpParams().set('per_page', perPage).set('search', search);

    return this.http.get<PaginatedResponse<Category>>(`${this.apiUrl}/list`, { params });
  }

  find(id: number): Observable<ApiItemResponse<Category>> {
    return this.http.get<ApiItemResponse<Category>>(`${this.apiUrl}/show/${id}`);
  }

  create(payload: CategoryPayload): Observable<ApiItemResponse<Category>> {
    return this.http.post<ApiItemResponse<Category>>(`${this.apiUrl}/add`, payload);
  }

  update(id: number, payload: CategoryPayload): Observable<ApiItemResponse<Category>> {
    return this.http.put<ApiItemResponse<Category>>(`${this.apiUrl}/update/${id}`, payload);
  }

  delete(id: number): Observable<ApiItemResponse<null>> {
    return this.http.delete<ApiItemResponse<null>>(`${this.apiUrl}/delete/${id}`);
  }
}
