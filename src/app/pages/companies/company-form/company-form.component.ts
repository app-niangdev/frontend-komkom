import { Component, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgModelGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CompanyService } from '../../../core/services/company.service';
import { Company, CompanyPayload } from '../../../core/models/company.model';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

function emptyForm(): CompanyPayload {
  return {
    name: '',
    short_name: '',
    slogan: '',
    head_office_address: '',
    email_company: '',
    phone_one: '',
    phone_two: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number_one: '',
    phone_number_two: '',
    address: '',
    gender: 'male'
  };
}

interface Step {
  title: string;
  icon: string;
}

const STEPS: Step[] = [
  { title: 'Entreprise', icon: 'bi-building' },
  { title: 'Propriétaire', icon: 'bi-person-badge' },
  { title: 'Récapitulatif', icon: 'bi-check2-circle' }
];

/** Champs du propriétaire : une erreur de validation sur l'un d'eux ramène à l'étape 2. */
const OWNER_FIELDS = ['first_name', 'last_name', 'email', 'phone_number_one', 'phone_number_two', 'address', 'gender'];

const OWNER_STEP = 1;
const REVIEW_STEP = STEPS.length - 1;

/** Modale de création / modification d'une entreprise et de son propriétaire, en 3 étapes. */
@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-form.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './company-form.component.scss']
})
export class CompanyFormComponent implements OnInit {
  private readonly companyService = inject(CompanyService);

  /** Entreprise à modifier, ou null pour une création. */
  readonly company = input<Company | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();

  private readonly companyGroup = viewChild.required<NgModelGroup>('companyGroup');
  private readonly ownerGroup = viewChild.required<NgModelGroup>('ownerGroup');

  protected readonly steps = STEPS;
  protected readonly reviewStep = REVIEW_STEP;
  protected readonly step = signal(0);
  /** Étape la plus avancée atteinte : on peut revenir librement sur les précédentes. */
  protected readonly furthestStep = signal(0);
  protected readonly isLastStep = computed(() => this.step() === REVIEW_STEP);

  protected form: CompanyPayload = emptyForm();
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const company = this.company();
    if (!company) {
      return;
    }

    const user = company.owner?.user;
    this.form = {
      name: company.name,
      short_name: company.short_name,
      slogan: company.slogan ?? '',
      head_office_address: company.head_office_address ?? '',
      email_company: company.email,
      phone_one: company.phone_one,
      phone_two: company.phone_two ?? '',
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      phone_number_one: user?.phone_number_one ?? '',
      phone_number_two: user?.phone_number_two ?? '',
      address: user?.address ?? '',
      gender: user?.gender ?? 'male'
    };
    // En modification, toutes les étapes sont déjà renseignées
    this.furthestStep.set(REVIEW_STEP);
  }

  /** Entrée dans un champ : étape suivante, ou enregistrement depuis le récapitulatif. */
  onSubmit(): void {
    if (this.isLastStep()) {
      this.submit();
    } else {
      this.next();
    }
  }

  next(): void {
    const current = this.step();
    if (!this.isStepValid(current)) {
      this.groupFor(current)?.control.markAllAsTouched();
      return;
    }
    this.goTo(current + 1);
  }

  previous(): void {
    this.goTo(Math.max(0, this.step() - 1));
  }

  canReach(index: number): boolean {
    return index <= this.furthestStep() && (index <= this.step() || this.stepsValidBefore(index));
  }

  goTo(index: number): void {
    this.errorMessage.set(null);
    this.step.set(index);
    this.furthestStep.update((max) => Math.max(max, index));
  }

  isStepValid(index: number): boolean {
    const group = this.groupFor(index);
    return group ? !!group.valid : true;
  }

  genderLabel(): string {
    return this.form.gender === 'female' ? 'Femme' : 'Homme';
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // Sécurité : une étape redevenue invalide (retour arrière) bloque l'envoi
    const invalidStep = [0, OWNER_STEP].find((i) => !this.isStepValid(i));
    if (invalidStep !== undefined) {
      this.goTo(invalidStep);
      this.groupFor(invalidStep)?.control.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: CompanyPayload = {
      ...this.form,
      slogan: this.form.slogan || null,
      phone_two: this.form.phone_two || null,
      phone_number_two: this.form.phone_number_two || null
    };

    const company = this.company();
    const request = company
      ? this.companyService.update(company.id, payload)
      : this.companyService.create(payload);

    request.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.saved.emit(res.message);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        // Erreur de validation : on ramène l'utilisateur à l'étape du champ fautif
        const firstField = Object.keys(err.error?.errors ?? {})[0];
        if (firstField) {
          this.step.set(OWNER_FIELDS.includes(firstField) ? OWNER_STEP : 0);
        }
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }

  private stepsValidBefore(index: number): boolean {
    for (let i = 0; i < index; i++) {
      if (!this.isStepValid(i)) {
        return false;
      }
    }
    return true;
  }

  private groupFor(index: number): NgModelGroup | null {
    if (index === 0) {
      return this.companyGroup();
    }
    return index === OWNER_STEP ? this.ownerGroup() : null;
  }
}
