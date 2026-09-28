import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { OwnerSupplier, SupplierPayload } from '../../../../core/owner/owner.model';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

/**
 * Modale d'ajout / modification d'un fournisseur.
 * `storeId` fixe la boutique (saisie d'un approvisionnement) ; sinon elle se choisit à la création.
 */
@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" [class.modal-backdrop--stacked]="stacked()" (click)="closed.emit()"></div>
    <div class="modal" [class.modal--stacked]="stacked()" role="dialog" aria-modal="true" aria-labelledby="supplier-form-title">
      <div class="modal__header">
        <h3 id="supplier-form-title">{{ supplier() ? 'Modifier le fournisseur' : 'Nouveau fournisseur' }}</h3>
        <button type="button" class="icon-btn" title="Fermer" (click)="closed.emit()"><i class="bi bi-x-lg"></i></button>
      </div>
      <p class="form-hint" *ngIf="fixedStoreName() as name">Rattaché à la boutique « {{ name }} ».</p>

      <div class="alert alert--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>

      <form #supplierForm="ngForm" (ngSubmit)="supplierForm.valid && submit()" novalidate>
        <div class="form-grid">
          <div class="field field--full" *ngIf="!fixedStoreName()">
            <label class="field__label" for="sq_store">Boutique *</label>
            <select id="sq_store" class="field__input" [(ngModel)]="form.store_id" name="store_id" required>
              <option [ngValue]="null" disabled>Choisir une boutique</option>
              <option *ngFor="let s of stores()" [ngValue]="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="field field--full">
            <label class="field__label" for="sq_name">Nom *</label>
            <input id="sq_name" class="field__input" [(ngModel)]="form.name" name="name" required maxlength="255" autocomplete="off" />
          </div>
          <div class="field">
            <label class="field__label" for="sq_phone">Téléphone *</label>
            <input id="sq_phone" type="tel" class="field__input" [(ngModel)]="form.phone_one" name="phone_one" required maxlength="20" />
          </div>
          <div class="field">
            <label class="field__label" for="sq_phone2">Autre téléphone</label>
            <input id="sq_phone2" type="tel" class="field__input" [(ngModel)]="form.phone_two" name="phone_two" maxlength="20" />
          </div>
          <div class="field field--full">
            <label class="field__label" for="sq_email">E-mail</label>
            <input id="sq_email" type="email" class="field__input" [(ngModel)]="form.email" name="email" maxlength="255" email />
          </div>
          <div class="field field--full">
            <label class="field__label" for="sq_address">Adresse</label>
            <input id="sq_address" class="field__input" [(ngModel)]="form.address" name="address" maxlength="255" placeholder="Quartier, ville..." />
          </div>
        </div>

        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn btn--primary" [disabled]="isSubmitting() || supplierForm.invalid">
            {{ isSubmitting() ? 'Enregistrement...' : supplier() ? 'Enregistrer' : 'Ajouter le fournisseur' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styleUrls: ['../../../../../styles/_admin-crud.scss']
})
export class SupplierFormComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  private readonly context = inject(StoreContextService);

  /** Fournisseur à modifier, ou null pour un ajout. */
  readonly supplier = input<OwnerSupplier | null>(null);
  /** Boutique imposée (ajout depuis un approvisionnement). */
  readonly storeId = input<number | null>(null);
  /** Affichée au-dessus d'une autre modale. */
  readonly stacked = input(false);
  readonly saved = output<{ supplier: OwnerSupplier; message: string }>();
  readonly closed = output<void>();

  protected form = { store_id: null as number | null, name: '', phone_one: '', phone_two: '', email: '', address: '' };
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Boutiques où l'on peut créer : abonnement en cours. */
  protected readonly stores = computed(() =>
    this.context.stores().filter((s) => s.subscription.state !== 'expired' && s.subscription.state !== 'none')
  );

  /** La boutique n'est pas modifiable : imposée, ou déjà fixée pour un fournisseur existant. */
  protected readonly fixedStoreName = computed(() => {
    const existing = this.supplier();
    if (existing) {
      return existing.store?.name ?? '—';
    }
    const id = this.storeId();
    return id ? this.context.stores().find((s) => s.id === id)?.name ?? '—' : null;
  });

  ngOnInit(): void {
    const s = this.supplier();
    const selected = this.context.selectedId();
    this.form = s
      ? { store_id: s.store?.id ?? null, name: s.name, phone_one: s.phone, phone_two: s.phone_two ?? '', email: s.email ?? '', address: s.address ?? '' }
      : {
          store_id: this.storeId() ?? (this.stores().some((st) => st.id === selected) ? selected : this.stores().length === 1 ? this.stores()[0].id : null),
          name: '',
          phone_one: '',
          phone_two: '',
          email: '',
          address: ''
        };
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: SupplierPayload = {
      name: this.form.name.trim(),
      phone_one: this.form.phone_one.trim(),
      phone_two: this.form.phone_two.trim() || null,
      email: this.form.email.trim() || null,
      address: this.form.address.trim() || null
    };
    const existing = this.supplier();
    const request = existing
      ? this.ownerService.updateSupplier(existing.id, payload)
      : this.ownerService.createSupplier({ ...payload, store_id: this.form.store_id ?? undefined });

    request.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.saved.emit({ supplier: res.data, message: res.message });
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }
}
