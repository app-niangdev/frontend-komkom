import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminStats, AdminStatsQuery } from '../models/admin-stats.model';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly http = inject(HttpClient);

  get(query: AdminStatsQuery): Observable<AdminStats> {
    let params = new HttpParams().set('start', query.start).set('end', query.end);
    if (query.company_id) {
      params = params.set('company_id', query.company_id);
    }
    return this.http.get<AdminStats>(`${environment.apiUrl}/admin/stats`, { params });
  }
}
