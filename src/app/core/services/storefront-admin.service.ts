import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StoreStorefront } from '../models/company.model';

/** Vitrines publiques des boutiques : activation et lien, réservés à l'administrateur. */
@Injectable({ providedIn: 'root' })
export class StorefrontAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/storefronts`;

  list(companyId: number): Observable<StoreStorefront[]> {
    const params = new HttpParams().set('company_id', companyId);
    return this.http.get<{ data: StoreStorefront[] }>(this.url, { params }).pipe(map((res) => res.data));
  }

  /** Lien proposé (ou actuel) et adresse de la vitrine, pour l'aperçu. */
  suggest(storeId: number): Observable<{ slug: string; base_url: string }> {
    return this.http
      .get<{ data: { slug: string; base_url: string } }>(`${this.url}/${storeId}/suggest`)
      .pipe(map((res) => res.data));
  }

  update(storeId: number, payload: { enabled: boolean; slug: string | null }): Observable<{ message: string; data: StoreStorefront }> {
    return this.http.put<{ message: string; data: StoreStorefront }>(`${this.url}/${storeId}`, payload);
  }
}
