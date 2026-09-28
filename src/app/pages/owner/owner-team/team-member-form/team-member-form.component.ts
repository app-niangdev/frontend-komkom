import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { TeamMember, TeamMemberPayload } from '../../../../core/owner/owner.model';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

/** Modale d'ajout / modification d'un gestionnaire ou d'un vendeur. */
@Component({
  selector: 'app-team-member-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-member-form.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss']
})
export class TeamMemberFormComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  protected readonly context = inject(StoreContextService);

  /** Membre à modifier, ou null pour un ajout. */
  readonly member = input<TeamMember | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected form: TeamMemberPayload = {
    role: 'Seller',
    store_id: null,
    first_name: '',
    last_name: '',
    email: '',
    phone_number_one: '',
    phone_number_two: '',
    address: '',
    gender: 'male'
  };
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const m = this.member();
    if (!m) {
      // Par défaut : la boutique affichée dans le sélecteur
      this.form.store_id = this.context.selectedId();
      return;
    }
    this.form = {
      role: m.role,
      store_id: m.store?.id ?? null,
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email,
      phone_number_one: m.phone_number_one ?? '',
      phone_number_two: m.phone_number_two ?? '',
      address: m.address ?? '',
      gender: m.gender ?? 'male'
    };
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: TeamMemberPayload = { ...this.form, phone_number_two: this.form.phone_number_two || null };
    const m = this.member();
    const request = m ? this.ownerService.updateMember(m.id, payload) : this.ownerService.createMember(payload);

    request.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.saved.emit(res.message);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }
}
