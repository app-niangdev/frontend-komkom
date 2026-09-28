import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse } from '../models/tenant.model';
import { UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/roles`;

  list(): Observable<ApiItemResponse<UserRole[]>> {
    return this.http.get<ApiItemResponse<UserRole[]>>(`${this.apiUrl}/list`);
  }
}
