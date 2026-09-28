import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse, PaginatedResponse } from '../models/category.model';
import { Product, ProductPayload } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;

  list(perPage: number, search: string): Observable<PaginatedResponse<Product>> {
    const params = new HttpParams().set('per_page', perPage).set('search', search);

    return this.http.get<PaginatedResponse<Product>>(`${this.apiUrl}/list`, { params });
  }

  find(id: number): Observable<ApiItemResponse<Product>> {
    return this.http.get<ApiItemResponse<Product>>(`${this.apiUrl}/show/${id}`);
  }

  create(payload: ProductPayload): Observable<ApiItemResponse<Product>> {
    return this.http.post<ApiItemResponse<Product>>(`${this.apiUrl}/add`, this.toFormData(payload));
  }

  update(id: number, payload: Partial<ProductPayload>): Observable<ApiItemResponse<Product>> {
    const formData = this.toFormData(payload);
    formData.set('_method', 'PUT');

    return this.http.post<ApiItemResponse<Product>>(`${this.apiUrl}/update/${id}`, formData);
  }

  toggleAvailability(id: number): Observable<ApiItemResponse<Product>> {
    return this.http.put<ApiItemResponse<Product>>(`${this.apiUrl}/toggle-availability/${id}`, {});
  }

  delete(id: number): Observable<ApiItemResponse<null>> {
    return this.http.delete<ApiItemResponse<null>>(`${this.apiUrl}/delete/${id}`);
  }

  private toFormData(payload: Partial<ProductPayload>): FormData {
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
