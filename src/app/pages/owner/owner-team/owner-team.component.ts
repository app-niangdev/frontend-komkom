import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TeamMember, TeamRole } from '../../../core/owner/owner.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { TeamMemberFormComponent } from './team-member-form/team-member-form.component';
import { ResetAccessDialogComponent } from './reset-access-dialog/reset-access-dialog.component';

const ROLE_LABELS: Record<TeamRole, string> = { Manager: 'Gestionnaire', Seller: 'Vendeur' };

@Component({
  selector: 'app-owner-team',
  standalone: true,
  imports: [CommonModule, FormsModule, StoreBlockedComponent, TeamMemberFormComponent, ResetAccessDialogComponent],
  templateUrl: './owner-team.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', '../../../../styles/_dashboard.scss']
})
export class OwnerTeamComponent {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly roleLabels = ROLE_LABELS;

  protected search = '';
  protected role: TeamRole | '' = '';
  protected status: '' | '1' | '0' = '';

  protected readonly members = signal<TeamMember[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly isFormOpen = signal(false);
  protected readonly editing = signal<TeamMember | null>(null);

  protected readonly counts = computed(() => {
    const list = this.members();
    return {
      managers: list.filter((m) => m.role === 'Manager').length,
      sellers: list.filter((m) => m.role === 'Seller').length,
      inactive: list.filter((m) => !m.status).length
    };
  });

  constructor() {
    effect(() => {
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.members.set([]) : this.load()));
    }, { allowSignalWrites: true });
  }

  hasFilters(): boolean {
    return !!(this.search || this.role || this.status);
  }

  resetFilters(): void {
    this.search = '';
    this.role = '';
    this.status = '';
    this.load();
  }

  initials(m: TeamMember): string {
    return `${m.first_name.charAt(0)}${m.last_name.charAt(0)}`.toUpperCase();
  }

  /** Membre dont on réinitialise l'accès (fenêtre ouverte). */
  protected readonly resetting = signal<TeamMember | null>(null);

  onResetClosed(done: boolean): void {
    this.resetting.set(null);
    if (done) {
      this.load();
    }
  }

  openCreate(): void {
    this.editing.set(null);
    this.isFormOpen.set(true);
  }

  openEdit(m: TeamMember): void {
    this.editing.set(m);
    this.isFormOpen.set(true);
  }

  onSaved(message: string): void {
    this.isFormOpen.set(false);
    this.notification.toast(message, 'success');
    this.load();
    this.context.refresh(); // compte d'équipe des boutiques
  }

  async remove(m: TeamMember): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: `Supprimer ${m.full_name} ?`,
      text: 'Le compte est supprimé et son accès coupé. Possible uniquement tant qu\'aucune vente n\'a été enregistrée.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.ownerService.deleteMember(m.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.members.update((list) => list.filter((x) => x.id !== m.id));
        this.context.refresh();
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  async toggle(m: TeamMember): Promise<void> {
    const disabling = m.status;
    const confirmed = await this.notification.confirm({
      title: disabling ? `Désactiver ${m.full_name} ?` : `Réactiver ${m.full_name} ?`,
      text: disabling
        ? 'Son accès est coupé immédiatement, y compris sur les appareils où il est connecté.'
        : 'Il pourra de nouveau se connecter.',
      confirmText: disabling ? 'Désactiver' : 'Réactiver',
      cancelText: 'Annuler',
      danger: disabling
    });
    if (!confirmed) {
      return;
    }

    this.ownerService.toggleMember(m.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        this.members.update((list) => list.map((x) => (x.id === m.id ? res.data : x)));
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.ownerService
      .team(this.context.selectedId(), { search: this.search, role: this.role, status: this.status })
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.isLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          this.errorMessage.set(extractErrorMessage(err));
        }
      });
  }
}
