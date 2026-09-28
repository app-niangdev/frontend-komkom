import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService } from '../../core/services/admin-user.service';
import { CompanyService } from '../../core/services/company.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { AdminUser, AdminUserFilters, Role } from '../../core/models/admin-user.model';
import { Company } from '../../core/models/company.model';
import { extractErrorMessage } from '../../shared/utils/http-error.util';
import { UserFormComponent } from './user-form/user-form.component';
import { ROLE_LABELS, companyNameOf, initialsOf, storeOf } from './user-display.util';

const PER_PAGE = 15;

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, UserFormComponent],
  templateUrl: './admin-users.component.html',
  styleUrls: ['../../../styles/_admin-crud.scss']
})
export class AdminUsersComponent implements OnInit {
  private readonly userService = inject(AdminUserService);
  private readonly companyService = inject(CompanyService);
  private readonly notification = inject(NotificationService);
  private readonly authService = inject(AuthService);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly storeOf = storeOf;
  protected readonly companyNameOf = companyNameOf;
  protected readonly initialsOf = initialsOf;

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected filters: AdminUserFilters = { search: '', role_id: null, company_id: null, status: '' };

  protected readonly isFormOpen = signal(false);
  /** Utilisateur en cours de modification (null = création). */
  protected readonly editingUser = signal<AdminUser | null>(null);

  private readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  ngOnInit(): void {
    this.loadUsers();
    this.userService.roles().subscribe({ next: (roles) => this.roles.set(roles) });
    // Référentiel pour le filtre et le rattachement des gestionnaires / vendeurs
    this.companyService.list(1, 100, '').subscribe({ next: (res) => this.companies.set(res.data) });
  }

  loadUsers(page = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.userService.list(page, PER_PAGE, this.filters).subscribe({
      next: (res) => {
        this.users.set(res.data);
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

  applyFilters(): void {
    this.loadUsers(1);
  }

  hasActiveFilters(): boolean {
    const f = this.filters;
    return !!(f.search || f.role_id || f.company_id || f.status !== '');
  }

  resetFilters(): void {
    this.filters = { search: '', role_id: null, company_id: null, status: '' };
    this.loadUsers(1);
  }

  isSelf(user: AdminUser): boolean {
    return user.id === this.currentUserId();
  }

  openCreateForm(): void {
    this.editingUser.set(null);
    this.isFormOpen.set(true);
  }

  openEditForm(user: AdminUser): void {
    this.editingUser.set(user);
    this.isFormOpen.set(true);
  }

  onSaved(message: string): void {
    this.isFormOpen.set(false);
    this.notification.toast(message, 'success');
    this.loadUsers(this.editingUser() ? this.currentPage() : 1);
  }

  async toggleStatus(user: AdminUser): Promise<void> {
    const isDisabling = user.status;

    const confirmed = await this.notification.confirm({
      title: isDisabling ? 'Désactiver cet utilisateur ?' : 'Réactiver cet utilisateur ?',
      text: isDisabling
        ? `${user.full_name} ne pourra plus se connecter tant que son compte n'aura pas été réactivé.`
        : `${user.full_name} pourra de nouveau se connecter.`,
      confirmText: isDisabling ? 'Désactiver' : 'Réactiver',
      cancelText: 'Annuler',
      danger: isDisabling
    });

    if (!confirmed) {
      return;
    }

    this.userService.toggleStatus(user.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.loadUsers(this.currentPage());
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  async askDelete(user: AdminUser): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer cet utilisateur ?',
      text: `${user.full_name} sera supprimé. Un utilisateur ayant déjà des ventes, dépenses, approvisionnements ou paiements ne peut pas être supprimé : désactivez-le plutôt.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.userService.delete(user.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        const page = this.users().length === 1 ? Math.max(1, this.currentPage() - 1) : this.currentPage();
        this.loadUsers(page);
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) {
      return;
    }
    this.loadUsers(page);
  }
}
