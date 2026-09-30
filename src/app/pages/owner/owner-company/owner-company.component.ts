import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../core/owner/owner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { OwnerCompany, OwnerCompanyPayload } from '../../../core/owner/owner.model';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

type CompanyForm = Omit<OwnerCompanyPayload, 'logo' | 'remove_logo'>;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** « Mon entreprise » : informations, logo et couleurs de l'entreprise du propriétaire. */
@Component({
  selector: 'app-owner-company',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-company.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './owner-company.component.scss']
})
export class OwnerCompanyComponent implements OnInit, OnDestroy {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  private readonly authService = inject(AuthService);

  protected readonly company = signal<OwnerCompany | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected form: CompanyForm = this.toForm(null);
  private saved: CompanyForm = this.toForm(null);

  protected readonly logoFile = signal<File | null>(null);
  protected readonly logoPreview = signal<string | null>(null);
  protected readonly removeLogo = signal(false);
  private objectUrl: string | null = null;

  ngOnInit(): void {
    this.ownerService.company().subscribe({
      next: (company) => {
        this.apply(company);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }

  hasChanges(): boolean {
    return (
      JSON.stringify(this.normalize(this.form)) !== JSON.stringify(this.normalize(this.saved)) ||
      !!this.logoFile() ||
      this.removeLogo()
    );
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.errorMessage.set('Le logo doit être au format JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.errorMessage.set('Le logo ne doit pas dépasser 2 Mo.');
      return;
    }
    this.errorMessage.set(null);
    this.logoFile.set(file);
    this.removeLogo.set(false);
    this.revoke();
    this.objectUrl = URL.createObjectURL(file);
    this.logoPreview.set(this.objectUrl);
  }

  onRemoveLogo(): void {
    this.logoFile.set(null);
    this.removeLogo.set(!!this.company()?.logo_url);
    this.revoke();
    this.logoPreview.set(null);
  }

  reset(form: NgForm): void {
    this.form = { ...this.saved };
    form.resetForm(this.form);
    this.errorMessage.set(null);
    this.logoFile.set(null);
    this.removeLogo.set(false);
    this.revoke();
    this.logoPreview.set(this.company()?.logo_url ?? null);
  }

  save(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    if (!this.hasChanges() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const f = this.normalize(this.form);
    this.ownerService
      .updateCompany({
        ...f,
        slogan: f.slogan || null,
        phone_two: f.phone_two || null,
        logo: this.logoFile(),
        remove_logo: this.removeLogo()
      })
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.apply(res.data);
          this.authService.updateCompany(res.data);
          form.resetForm(this.form);
          this.notification.toast(res.message, 'success');
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.errorMessage.set(extractErrorMessage(err));
        }
      });
  }

  private apply(company: OwnerCompany): void {
    this.company.set(company);
    this.saved = this.toForm(company);
    this.form = { ...this.saved };
    this.logoFile.set(null);
    this.removeLogo.set(false);
    this.revoke();
    this.logoPreview.set(company.logo_url);
  }

  private toForm(company: OwnerCompany | null): CompanyForm {
    return {
      name: company?.name ?? '',
      short_name: company?.short_name ?? '',
      slogan: company?.slogan ?? '',
      head_office_address: company?.head_office_address ?? '',
      email: company?.email ?? '',
      phone_one: company?.phone_one ?? '',
      phone_two: company?.phone_two ?? '',
      primary_color: company?.primary_color ?? '#0d6efd',
      secondary_color: company?.secondary_color ?? '#6c757d'
    };
  }

  private normalize(form: CompanyForm): CompanyForm {
    return {
      ...form,
      name: form.name.trim(),
      short_name: form.short_name.trim(),
      slogan: (form.slogan ?? '').trim(),
      head_office_address: form.head_office_address.trim(),
      email: form.email.trim(),
      phone_one: form.phone_one.trim(),
      phone_two: (form.phone_two ?? '').trim()
    };
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.revoke();
  }
}
