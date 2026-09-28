import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from '../../../core/services/admin-user.service';
import { CompanyService } from '../../../core/services/company.service';
import { AdminUser, AdminUserPayload, Role } from '../../../core/models/admin-user.model';
import { Company, Store } from '../../../core/models/company.model';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { ROLE_LABELS, storeOf } from '../user-display.util';

/** Rôles rattachés à une boutique (profil manager / seller côté backend). */
const STORE_ROLES = ['Manager', 'Seller'];

/** Modale de création / modification d'un utilisateur (hors propriétaires, gérés via les entreprises). */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss']
})
export class UserFormComponent implements OnInit {
  private readonly userService = inject(AdminUserService);
  private readonly companyService = inject(CompanyService);

  /** Utilisateur à modifier, ou null pour une création. */
  readonly user = input<AdminUser | null>(null);
  readonly roles = input.required<Role[]>();
  readonly companies = input.required<Company[]>();
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected form: AdminUserPayload = {
    first_name: '',
    last_name: '',
    email: '',
    role_id: 0,
    phone_number_one: '',
    phone_number_two: '',
    address: '',
    gender: 'male',
    store_id: null
  };
  protected companyId: number | null = null;
  protected readonly roleLabels = ROLE_LABELS;

  protected readonly stores = signal<Store[]>([]);
  protected readonly isLoadingStores = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Les propriétaires se créent avec leur entreprise : pas proposés ici. */
  protected readonly creatableRoles = computed(() => this.roles().filter((r) => r.name !== 'Owner'));

  ngOnInit(): void {
    const user = this.user();
    if (!user) {
      this.form.role_id = this.creatableRoles().find((r) => r.name === 'Seller')?.id ?? 0;
      return;
    }

    const store = storeOf(user);
    this.form = {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role_id: user.role_id,
      phone_number_one: user.phone_number_one ?? '',
      phone_number_two: user.phone_number_two ?? '',
      address: user.address ?? '',
      gender: user.gender ?? 'male',
      store_id: store?.id ?? null
    };

    if (store) {
      this.companyId = store.company_id;
      this.loadStores(store.company_id);
    }
  }

  needsStore(): boolean {
    const role = this.roles().find((r) => r.id === Number(this.form.role_id));
    return !!role && STORE_ROLES.includes(role.name);
  }

  onCompanyChange(companyId: number | null): void {
    this.companyId = companyId;
    this.form.store_id = null;
    this.stores.set([]);
    if (companyId) {
      this.loadStores(companyId);
    }
  }

  private loadStores(companyId: number): void {
    this.isLoadingStores.set(true);
    this.companyService.listStores(companyId, 1, 100, '').subscribe({
      next: (res) => {
        this.stores.set(res.data);
        this.isLoadingStores.set(false);
      },
      error: () => {
        this.stores.set([]);
        this.isLoadingStores.set(false);
      }
    });
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: AdminUserPayload = {
      ...this.form,
      role_id: Number(this.form.role_id),
      phone_number_two: this.form.phone_number_two || null,
      store_id: this.needsStore() ? this.form.store_id : null
    };

    const user = this.user();
    const request = user ? this.userService.update(user.id, payload) : this.userService.create(payload);

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
