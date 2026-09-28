import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContactsPayload, PasswordPayload, Profile } from '../models/profile.model';
import { MessageResponse } from '../models/company.model';

/** Profil du compte connecté (API /profile/*). */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/profile`;

  get(): Observable<Profile> {
    return this.http.get<Profile>(this.apiUrl);
  }

  updateContacts(payload: ContactsPayload): Observable<MessageResponse & { data: Profile }> {
    return this.http.put<MessageResponse & { data: Profile }>(`${this.apiUrl}/contacts`, payload);
  }

  /** Ferme toutes les sessions du compte : une reconnexion est nécessaire ensuite. */
  updatePassword(payload: PasswordPayload): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/password`, payload);
  }
}
