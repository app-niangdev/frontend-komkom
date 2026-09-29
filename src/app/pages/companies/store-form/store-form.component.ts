import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CompanyService } from '../../../core/services/company.service';
import { Company, Store, StorePayload } from '../../../core/models/company.model';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

type StoreFormState = Omit<StorePayload, 'company_id' | 'logo' | 'primary_color' | 'secondary_color'> & {
  primary_color: string;
  secondary_color: string;
};

/** Modale de création / modification d'une boutique rattachée à une entreprise. */
@Component({
  selector: 'app-store-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './store-form.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss']
})
export class StoreFormComponent implements OnInit, OnDestroy {
  private readonly companyService = inject(CompanyService);

  readonly company = input.required<Company>();
  /** Boutique à modifier, ou null pour une création. */
  readonly store = input<Store | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected form!: StoreFormState;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly logoFile = signal<File | null>(null);
  protected readonly logoPreviewUrl = signal<string | null>(null);
  private objectUrl: string | null = null;

  ngOnInit(): void {
    const company = this.company();
    const store = this.store();

    this.form = {
      name: store?.name ?? '',
      slogan: store?.slogan ?? '',
      address: store?.address ?? '',
      phone_one: store?.phone_one ?? '',
      phone_two: store?.phone_two ?? '',
      phone_three: store?.phone_three ?? '',
      email: store?.email ?? '',
      uses_measurements: store?.uses_measurements ?? true,
      uses_serial_numbers: store?.uses_serial_numbers ?? true,
      ticket_width: store?.ticket_width ?? 80,
      use_company_logo: store?.use_company_logo ?? true,
      use_company_colors: store?.use_company_colors ?? true,
      primary_color: store?.primary_color ?? company.primary_color ?? '#0d6efd',
      secondary_color: store?.secondary_color ?? company.secondary_color ?? '#6c757d'
    };

    // logo_url vaut déjà le logo de la société quand use_company_logo est actif
    this.logoPreviewUrl.set(store && !store.use_company_logo ? store.logo_url : null);
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      return;
    }

    this.logoFile.set(file);
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.logoPreviewUrl.set(this.objectUrl);
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const f = this.form;
    const payload: StorePayload = {
      company_id: this.company().id,
      name: f.name,
      slogan: f.slogan || null,
      address: f.address,
      phone_one: f.phone_one,
      phone_two: f.phone_two || null,
      phone_three: f.phone_three || null,
      email: f.email || null,
      uses_measurements: f.uses_measurements,
      uses_serial_numbers: f.uses_serial_numbers,
      ticket_width: f.ticket_width,
      use_company_logo: f.use_company_logo,
      use_company_colors: f.use_company_colors,
      primary_color: f.use_company_colors ? null : f.primary_color,
      secondary_color: f.use_company_colors ? null : f.secondary_color,
      logo: f.use_company_logo ? null : this.logoFile()
    };

    const store = this.store();
    const request = store
      ? this.companyService.updateStore(store.id, payload)
      : this.companyService.createStore(payload);

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

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }
}
