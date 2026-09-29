import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { ContactsPayload, Profile } from '../../core/models/profile.model';
import { RoleName } from '../../core/models/admin-user.model';
import { extractErrorMessage } from '../../shared/utils/http-error.util';
import { formatIsoDate } from '../../shared/utils/date.util';
import { ROLE_LABELS } from '../admin-users/user-display.util';

interface PasswordRule {
  label: string;
  ok: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['../../../styles/_admin-crud.scss', './profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly notification = inject(NotificationService);

  protected readonly formatIsoDate = formatIsoDate;

  protected readonly profile = signal<Profile | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // --- Coordonnées
  protected contacts: ContactsPayload = { phone_number_one: '', phone_number_two: '', address: '' };
  private savedContacts: ContactsPayload = { ...this.contacts };
  protected readonly isSavingContacts = signal(false);
  protected readonly contactsError = signal<string | null>(null);

  // --- Mot de passe
  protected currentPassword = '';
  protected newPassword = '';
  protected confirmation = '';
  protected readonly showPasswords = signal(false);
  protected readonly isSavingPassword = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  /** Mot de passe temporaire donné par un responsable : à changer avant d'utiliser l'application. */
  protected readonly mustChangePassword = computed(() => !!this.authService.currentUser()?.must_change_password);

  protected readonly roleLabel = computed(() => {
    const name = this.profile()?.user.role?.name as RoleName | undefined;
    return name ? ROLE_LABELS[name] ?? name : '';
  });

  protected readonly initials = computed(() => {
    const u = this.profile()?.user;
    return u ? `${u.first_name.charAt(0)}${u.last_name.charAt(0)}`.toUpperCase() : '';
  });

  ngOnInit(): void {
    this.profileService.get().subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.loadError.set(extractErrorMessage(err));
      }
    });
  }

  // --- Coordonnées ----------------------------------------------------------

  contactsChanged(): boolean {
    const a = this.contacts;
    const b = this.savedContacts;
    return (
      a.phone_number_one.trim() !== b.phone_number_one ||
      (a.phone_number_two ?? '').trim() !== (b.phone_number_two ?? '') ||
      a.address.trim() !== b.address
    );
  }

  resetContacts(form: NgForm): void {
    this.contacts = { ...this.savedContacts };
    this.contactsError.set(null);
    form.resetForm(this.contacts);
  }

  saveContacts(form: NgForm): void {
    if (form.invalid || !this.contactsChanged() || this.isSavingContacts()) {
      form.control.markAllAsTouched();
      return;
    }

    this.isSavingContacts.set(true);
    this.contactsError.set(null);

    this.profileService
      .updateContacts({
        phone_number_one: this.contacts.phone_number_one.trim(),
        phone_number_two: this.contacts.phone_number_two?.trim() || null,
        address: this.contacts.address.trim()
      })
      .subscribe({
        next: (res) => {
          this.isSavingContacts.set(false);
          this.applyProfile(res.data);
          this.authService.updateCurrentUser(res.data.user);
          this.notification.toast(res.message, 'success');
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingContacts.set(false);
          this.contactsError.set(extractErrorMessage(err));
        }
      });
  }

  // --- Mot de passe ------------------------------------------------------------

  /** Règles affichées en direct ; ce sont les mêmes que celles du backend. */
  protected passwordRules(): PasswordRule[] {
    const p = this.newPassword;
    return [
      { label: '8 caractères minimum', ok: p.length >= 8 },
      { label: 'Au moins une lettre', ok: /[A-Za-z]/.test(p) },
      { label: 'Au moins un chiffre', ok: /[0-9]/.test(p) },
      { label: "Différent du mot de passe actuel", ok: p.length > 0 && p !== this.currentPassword },
      { label: 'Confirmation identique', ok: p.length > 0 && p === this.confirmation }
    ];
  }

  canSubmitPassword(): boolean {
    return !!this.currentPassword && this.passwordRules().every((r) => r.ok) && !this.isSavingPassword();
  }

  async savePassword(): Promise<void> {
    if (!this.canSubmitPassword()) {
      return;
    }

    const confirmed = await this.notification.confirm({
      title: 'Changer le mot de passe ?',
      text: 'Vous serez déconnecté de tous vos appareils et devrez vous reconnecter avec le nouveau mot de passe.',
      confirmText: 'Changer le mot de passe',
      cancelText: 'Annuler'
    });

    if (!confirmed) {
      return;
    }

    this.isSavingPassword.set(true);
    this.passwordError.set(null);

    this.profileService
      .updatePassword({
        current_password: this.currentPassword,
        new_password: this.newPassword,
        new_password_confirmation: this.confirmation
      })
      .subscribe({
        next: (res) => {
          this.isSavingPassword.set(false);
          // Le serveur a fermé toutes les sessions : retour à l'écran de connexion
          this.authService.endSession(res.message);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingPassword.set(false);
          this.passwordError.set(extractErrorMessage(err));
        }
      });
  }

  private applyProfile(profile: Profile): void {
    this.profile.set(profile);
    this.savedContacts = {
      phone_number_one: profile.user.phone_number_one ?? '',
      phone_number_two: profile.user.phone_number_two ?? '',
      address: profile.user.address ?? ''
    };
    this.contacts = { ...this.savedContacts };
  }
}
