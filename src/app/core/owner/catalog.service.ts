import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { storeSpaceApiUrl } from './owner.service';
import {
  CategoryPayload,
  OwnerCategoriesResponse,
  OwnerSerial,
  OwnerSerialsQuery,
  OwnerSerialsResponse,
  ProductDetail,
  ProductPayload
} from './catalog.model';

/** Gestion du catalogue (fiches produit, catégories) et des numéros de série / IMEI, dans l'espace courant. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private get apiUrl(): string {
    return storeSpaceApiUrl(this.authService);
  }

  product(id: number): Observable<ProductDetail> {
    return this.http.get<{ data: ProductDetail }>(`${this.apiUrl}/products/${id}`).pipe(map((r) => r.data));
  }

  createProduct(payload: ProductPayload): Observable<{ message: string; data: ProductDetail }> {
    return this.http.post<{ message: string; data: ProductDetail }>(`${this.apiUrl}/products`, this.toFormData(payload));
  }

  /** POST multipart : l'image peut accompagner la modification. */
  updateProduct(id: number, payload: ProductPayload): Observable<{ message: string; data: ProductDetail }> {
    return this.http.post<{ message: string; data: ProductDetail }>(`${this.apiUrl}/products/${id}`, this.toFormData(payload));
  }

  deleteProduct(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/products/${id}`);
  }

  categories(storeId: number | null, search: string): Observable<OwnerCategoriesResponse> {
    let params = new HttpParams();
    if (storeId) {
      params = params.set('store_id', storeId);
    }
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<OwnerCategoriesResponse>(`${this.apiUrl}/categories/overview`, { params });
  }

  createCategory(payload: CategoryPayload): Observable<{ message: string; data: { id: number; name: string } }> {
    return this.http.post<{ message: string; data: { id: number; name: string } }>(`${this.apiUrl}/categories`, payload);
  }

  updateCategory(id: number, payload: CategoryPayload): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/categories/${id}`, payload);
  }

  /** `moveTo` : catégorie qui reçoit les produits, ou « none » pour les laisser sans catégorie. */
  deleteCategory(id: number, moveTo: number | 'none' | null): Observable<{ message: string }> {
    const params = moveTo === null ? new HttpParams() : new HttpParams().set('move_to', moveTo);
    return this.http.delete<{ message: string }>(`${this.apiUrl}/categories/${id}`, { params });
  }

  /** Création rapide depuis la fiche produit : une catégorie du même nom est réutilisée. */
  quickCategory(storeId: number, name: string): Observable<{ id: number; name: string }> {
    return this.http
      .post<{ data: { id: number; name: string } }>(`${this.apiUrl}/categories/quick`, { store_id: storeId, name })
      .pipe(map((r) => r.data));
  }

  serials(query: OwnerSerialsQuery, perPage = 20): Observable<OwnerSerialsResponse> {
    let params = new HttpParams().set('page', query.page).set('perPage', perPage);
    if (query.store_id) {
      params = params.set('store_id', query.store_id);
    }
    if (query.search.trim()) {
      params = params.set('search', query.search.trim());
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.product_id) {
      params = params.set('product_id', query.product_id);
    }
    return this.http.get<OwnerSerialsResponse>(`${this.apiUrl}/serials`, { params });
  }

  updateSerial(id: number, serialNumber: string): Observable<{ message: string; data: OwnerSerial }> {
    return this.http.put<{ message: string; data: OwnerSerial }>(`${this.apiUrl}/serials/${id}`, { serial_number: serialNumber });
  }

  /** Multipart : unités en champs indexés (units[0][name]...), booléens en 1/0. */
  private toFormData(payload: ProductPayload): FormData {
    const form = new FormData();
    const set = (key: string, value: unknown) => {
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
    };

    set('store_id', payload.store_id);
    set('name', payload.name);
    set('category_id', payload.category_id);
    set('description', payload.description);
    set('alert_threshold', payload.alert_threshold);
    set('require_serial_number', payload.require_serial_number);
    payload.units.forEach((unit, i) => {
      set(`units[${i}][id]`, unit.id);
      set(`units[${i}][name]`, unit.name);
      set(`units[${i}][price]`, unit.price);
      set(`units[${i}][conversion_factor]`, unit.conversion_factor);
      set(`units[${i}][is_base_unit]`, unit.is_base_unit);
    });
    set('image', payload.image);
    set('image_url', payload.image_url);
    set('remove_image', payload.remove_image);
    return form;
  }
}
