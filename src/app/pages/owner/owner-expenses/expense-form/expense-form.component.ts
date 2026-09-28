import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { ExpensePayload, OwnerExpense } from '../../../../core/owner/owner.model';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { todayIso } from '../../../../shared/utils/date.util';

/** Intitulés proposés à la saisie (l'utilisateur reste libre d'en taper un autre). */
const COMMON_TITLES = ['Loyer', 'Électricité', 'Eau', 'Internet', 'Transport', 'Salaires', 'Fournitures', 'Entretien', 'Impôts et taxes'];

/** Modale d'ajout / modification d'une dépense. */
@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="closed.emit()"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
      <div class="modal__header">
        <h3 id="expense-form-title">{{ expense() ? 'Modifier la dépense' : 'Nouvelle dépense' }}</h3>
        <button type="button" class="icon-btn" title="Fermer" (click)="closed.emit()"><i class="bi bi-x-lg"></i></button>
      </div>

      <div class="alert alert--error" *ngIf="errorMessage()">{{ errorMessage() }}</div>

      <form #expenseForm="ngForm" (ngSubmit)="expenseForm.valid && submit()" novalidate>
        <div class="form-grid">
          <div class="field field--full">
            <label class="field__label" for="e_title">Intitulé *</label>
            <input id="e_title" class="field__input" [(ngModel)]="form.title" name="title" required maxlength="255" list="expense-titles" autocomplete="off" />
            <datalist id="expense-titles">
              <option *ngFor="let t of titles" [value]="t"></option>
            </datalist>
            <span class="text-muted form-hint-inline">Gardez le même intitulé pour une même charge : elles seront regroupées dans les postes.</span>
          </div>
          <div class="field">
            <label class="field__label" for="e_amount">Montant (XOF) *</label>
            <input id="e_amount" type="number" class="field__input" [(ngModel)]="form.amount" name="amount" required min="1" step="1" inputmode="numeric" />
          </div>
          <div class="field">
            <label class="field__label" for="e_date">Date *</label>
            <input id="e_date" type="date" class="field__input" [(ngModel)]="form.expense_date" name="expense_date" required [max]="today" />
          </div>
          <div class="field field--full">
            <label class="field__label" for="e_store">Boutique *</label>
            <select id="e_store" class="field__input" [(ngModel)]="form.store_id" name="store_id" required>
              <option [ngValue]="null" disabled>Choisir une boutique</option>
              <option *ngFor="let s of context.stores()" [ngValue]="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="field field--full">
            <label class="field__label" for="e_desc">Détail</label>
            <textarea id="e_desc" rows="2" class="field__input" [(ngModel)]="form.description" name="description" maxlength="1000" placeholder="Fournisseur, référence de facture..."></textarea>
          </div>
        </div>

        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" (click)="closed.emit()">Annuler</button>
          <button type="submit" class="btn btn--primary" [disabled]="isSubmitting() || expenseForm.invalid">
            {{ isSubmitting() ? 'Enregistrement...' : expense() ? 'Enregistrer' : 'Ajouter la dépense' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      textarea.field__input {
        resize: vertical;
        font-family: inherit;
      }
    `
  ],
  styleUrls: ['../../../../../styles/_admin-crud.scss']
})
export class ExpenseFormComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  protected readonly context = inject(StoreContextService);

  /** Dépense à modifier, ou null pour un ajout. */
  readonly expense = input<OwnerExpense | null>(null);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly titles = COMMON_TITLES;
  protected readonly today = todayIso();
  protected form: ExpensePayload = { store_id: null, title: '', description: '', amount: null, expense_date: todayIso() };
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const e = this.expense();
    this.form = e
      ? { store_id: e.store?.id ?? null, title: e.title, description: e.description ?? '', amount: e.amount, expense_date: e.date }
      : { store_id: this.context.selectedId(), title: '', description: '', amount: null, expense_date: this.today };
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: ExpensePayload = {
      ...this.form,
      title: this.form.title.trim(),
      description: this.form.description?.trim() || null,
      amount: Math.round(Number(this.form.amount))
    };
    const e = this.expense();
    const request = e ? this.ownerService.updateExpense(e.id, payload) : this.ownerService.createExpense(payload);

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
