import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../core/services/user.service';
import { RoleService } from '../../core/services/role.service';
import { TenantService } from '../../core/services/tenant.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { UserListItem, UserPayload, UserRole } from '../../core/models/user.model';
import { Tenant } from '../../core/models/tenant.model';

const PER_PAGE = 10;

interface UserFormState {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone_one: string;
  phone_two: string;
  address: string;
  role_id: number | null;
  tenant_id: number | null;
}

function emptyForm(): UserFormState {
  return {
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone_one: '',
    phone_two: '',
    address: '',
    role_id: null,
    tenant_id: null
  };
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly tenantService = inject(TenantService);
  private readonly notification = inject(NotificationService);
  private readonly authService = inject(AuthService);

  protected readonly users = signal<UserListItem[]>([]);
  protected readonly roles = signal<UserRole[]>([]);
  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected search = '';
  protected searchRole = '';

  protected readonly isFormOpen = signal(false);
  protected readonly editingUserId = signal<number | null>(null);
  protected form: UserFormState = emptyForm();

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.loadTenants();
  }

  loadUsers(page = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.userService.list(PER_PAGE, this.search, this.searchRole).subscribe({
      next: (res) => {
        this.users.set(res.payload);
        this.currentPage.set(res.meta.current_page);
        this.lastPage.set(res.meta.last_page);
        this.total.set(res.meta.total);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Impossible de charger les utilisateurs.');
      }
    });
  }

  loadRoles(): void {
    this.roleService.list().subscribe({
      next: (res) => this.roles.set(res.payload),
      error: () => this.roles.set([])
    });
  }

  loadTenants(): void {
    this.tenantService.list(100, '').subscribe({
      next: (res) => this.tenants.set(res.payload),
      error: () => this.tenants.set([])
    });
  }

  onSearch(): void {
    this.loadUsers(1);
  }

  roleName(roleId: number): string {
    return this.roles().find((r) => r.id === roleId)?.label ?? '-';
  }

  tenantName(tenantId: number | null): string {
    if (!tenantId) {
      return '-';
    }
    return this.tenants().find((t) => t.id === tenantId)?.name ?? '-';
  }

  isAdminRole(roleId: number | null): boolean {
    if (roleId === null) {
      return false;
    }
    return this.roles().find((r) => r.id === roleId)?.name === 'ADMIN';
  }

  isSelf(user: UserListItem): boolean {
    return this.authService.currentUser()?.id === user.id;
  }

  openCreateForm(): void {
    this.form = emptyForm();
    this.editingUserId.set(null);
    this.errorMessage.set(null);
    this.isFormOpen.set(true);
  }

  openEditForm(user: UserListItem): void {
    this.form = {
      first_name: user.first_name,
      last_name: user.last_name,
      username: '',
      email: user.email ?? '',
      phone_one: user.phone_one,
      phone_two: '',
      address: '',
      role_id: user.role_id,
      tenant_id: user.tenant_id
    };
    this.editingUserId.set(user.id);
    this.errorMessage.set(null);
    this.isFormOpen.set(true);

    this.userService.find(user.id).subscribe({
      next: (res) => {
        this.form = {
          first_name: res.payload.first_name,
          last_name: res.payload.last_name,
          username: res.payload.username ?? '',
          email: res.payload.email ?? '',
          phone_one: res.payload.phone_one,
          phone_two: res.payload.phone_two ?? '',
          address: res.payload.address ?? '',
          role_id: res.payload.role_id,
          tenant_id: res.payload.tenant_id
        };
      }
    });
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.errorMessage.set(null);
  }

  submitForm(): void {
    if (!this.form.first_name || !this.form.last_name || !this.form.phone_one || !this.form.role_id) {
      return;
    }
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: UserPayload = {
      first_name: this.form.first_name,
      last_name: this.form.last_name,
      username: this.form.username || null,
      email: this.form.email || null,
      phone_one: this.form.phone_one,
      phone_two: this.form.phone_two || null,
      address: this.form.address || null,
      role_id: this.form.role_id,
      tenant_id: this.isAdminRole(this.form.role_id) ? null : this.form.tenant_id
    };

    const editingId = this.editingUserId();
    const request = editingId ? this.userService.update(editingId, payload) : this.userService.create(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isFormOpen.set(false);
        this.notification.toast(editingId ? 'Utilisateur modifié avec succès.' : 'Utilisateur créé avec succès.', 'success');
        this.loadUsers(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  async toggleActive(user: UserListItem): Promise<void> {
    const isDisabling = user.status;

    const confirmed = await this.notification.confirm({
      title: isDisabling ? 'Désactiver cet utilisateur ?' : 'Réactiver cet utilisateur ?',
      text: isDisabling
        ? `« ${user.full_name} » ne pourra plus se connecter tant qu'il n'aura pas été réactivé.`
        : `« ${user.full_name} » redeviendra accessible.`,
      confirmText: isDisabling ? 'Désactiver' : 'Réactiver',
      cancelText: 'Annuler',
      danger: isDisabling
    });

    if (!confirmed) {
      return;
    }

    this.userService.toggleStatus(user.id).subscribe({
      next: (res) => {
        this.notification.toast(
          res.payload.status ? 'Utilisateur activé avec succès.' : 'Utilisateur désactivé avec succès.',
          'success'
        );
        this.loadUsers(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.notification.toast(err.error?.message ?? 'Une erreur est survenue.', 'error');
      }
    });
  }

  async askDelete(user: UserListItem): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer cet utilisateur ?',
      text: `« ${user.full_name} » sera supprimé définitivement. Cette action est irréversible.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.userService.forceDelete(user.id).subscribe({
      next: () => {
        this.notification.toast('Utilisateur supprimé définitivement.', 'success');
        this.loadUsers(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.notification.toast(err.error?.message ?? 'Une erreur est survenue.', 'error');
      }
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) {
      return;
    }
    this.loadUsers(page);
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const errors = err.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      if (firstKey && Array.isArray(errors[firstKey])) {
        return errors[firstKey][0];
      }
    }
    return err.error?.message ?? 'Une erreur est survenue.';
  }
}
