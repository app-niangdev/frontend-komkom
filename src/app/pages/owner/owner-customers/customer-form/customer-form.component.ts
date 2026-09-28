import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { CustomerPayload, OwnerCustomer } from '../../../../core/owner/owner.model';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

/** Modale d'ajout / modification d'un client. */
@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop modal-backdrop--stacked" (click)="closed.emit()"></div>
    <div class="modal modal--stacked" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
      <div class="modal__header">
        <h3 id="customer-form-title">{{ customer() ? 'Modifier le client' : 'Nouveau client' }}</h3>
        <button type="button" class="icon-btn" title="Fermer" (click)="closed.emit()"><i class="bi bi-x-lg"></i></button>
      </div>

      <div class="alert alert--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>

      <form #customerForm="ngForm" (ngSubmit)="customerForm.valid && submit()" novalidate>
        <div class="form-grid">
          <div class="field field--full">
            <label class="field__label" for="c_name">Nom complet *</label>
            <input id="c_name" class="field__input" [(ngModel)]="form.name" name="name" required maxlength="255" autocomplete="off" />
          </div>
          <div class="field">
            <label class="field__label" for="c_phone">Téléphone *</label>
            <input id="c_phone" type="tel" class="field__input" [(ngModel)]="form.phone" name="phone" required maxlength="20" />
          </div>
          <div class="field">
            <label class="field__label" for="c_email">Email</label>
            <input id="c_email" type="email" class="field__input" [(ngModel)]="form.email" name="email" email maxlength="255" />
          </div>
          <div class="field field--full">
            <label class="field__label" for="c_address">Adresse *</label>
            <input id="c_address" class="field__input" [(ngModel)]="form.address" name="address" required maxlength="255" />
          </div>
          <div class="field field--full">
            <label class="field__label" for="c_store">Boutique *</label>
            <select id="c_store" class="field__input" [(ngModel)]="form.store_id" name="store_id" required [disabled]="storeLocked()">
              <option [ngValue]="null" disabled>Choisir une boutique</option>
              <option *ngFor="let s of context.stores()" [ngValue]="s.id">{{ s.name }}</option>
            </select>
            <span class="text-muted form-hint-inline" *ngIf="storeLocked()">
              Ce client a déjà des achats : il reste rattaché à sa boutique.
            </span>
          </div>
        </div>

        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn btn--primary" [disabled]="isSubmitting() || customerForm.invalid">
            {{ isSubmitting() ? 'Enregistrement...' : customer() ? 'Enregistrer' : 'Ajouter le client' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styleUrls: ['../../../../../styles/_admin-crud.scss']
})
export class CustomerFormComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  protected readonly context = inject(StoreContextService);

  /** Client à modifier, ou null pour un ajout. */
  readonly customer = input<OwnerCustomer | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected form: CustomerPayload = { name: '', phone: '', email: '', address: '', store_id: null };
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** La boutique d'un client qui a déjà acheté ne change plus (même règle que le serveur). */
  protected storeLocked(): boolean {
    return (this.customer()?.sales_count ?? 0) > 0;
  }

  ngOnInit(): void {
    const c = this.customer();
    this.form = c
      ? { name: c.name, phone: c.phone, email: c.email ?? '', address: c.address, store_id: c.store?.id ?? null }
      : { name: '', phone: '', email: '', address: '', store_id: this.context.selectedId() };
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: CustomerPayload = {
      ...this.form,
      name: this.form.name.trim(),
      phone: this.form.phone.trim(),
      email: this.form.email?.trim() || null,
      address: this.form.address.trim()
    };
    const c = this.customer();
    const request = c ? this.ownerService.updateCustomer(c.id, payload) : this.ownerService.createCustomer(payload);

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
