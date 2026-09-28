import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../core/owner/catalog.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import { OwnerCategoriesResponse, OwnerCategoryOverview } from '../../../core/owner/catalog.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { NotificationService } from '../../../core/services/notification.service';
import { formatNumber } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

/** Catégories de la boutique : nombre de produits, alertes de stock, création, modification, suppression. */
@Component({
  selector: 'app-owner-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StoreBlockedComponent],
  templateUrl: './owner-categories.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './owner-categories.component.scss']
})
export class OwnerCategoriesComponent {
  private readonly catalog = inject(CatalogService);
  private readonly notification = inject(NotificationService);
  protected readonly context = inject(StoreContextService);

  protected readonly formatNumber = formatNumber;
  protected search = '';

  protected readonly result = signal<OwnerCategoriesResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Formulaire (création / modification)
  protected readonly editing = signal<OwnerCategoryOverview | 'new' | null>(null);
  protected formName = '';
  protected formDescription = '';
  protected readonly isSaving = signal(false);
  protected readonly formError = signal<string | null>(null);

  // Suppression d'une catégorie qui contient des produits
  protected readonly deleting = signal<OwnerCategoryOverview | null>(null);
  protected moveTo: number | 'none' | null = null;
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  /** Autres catégories de la même boutique, pour accueillir les produits. */
  protected readonly moveTargets = computed(() => {
    const cat = this.deleting();
    return cat ? (this.result()?.data ?? []).filter((c) => c.id !== cat.id && c.store.id === cat.store.id) : [];
  });

  constructor() {
    effect(() => {
      this.context.selectedId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => (blocked ? this.result.set(null) : this.load()));
    }, { allowSignalWrites: true });
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.catalog.categories(this.context.selectedId(), this.search).subscribe({
      next: (res) => {
        this.result.set(res);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }

  clearSearch(): void {
    this.search = '';
    this.load();
  }

  openCreate(): void {
    if (!this.context.selectedId()) {
      return;
    }
    this.formName = '';
    this.formDescription = '';
    this.formError.set(null);
    this.editing.set('new');
  }

  openEdit(category: OwnerCategoryOverview): void {
    this.formName = category.name;
    this.formDescription = category.description ?? '';
    this.formError.set(null);
    this.editing.set(category);
  }

  save(): void {
    const target = this.editing();
    const name = this.formName.trim();
    if (!target || this.isSaving()) {
      return;
    }
    if (name.length < 2) {
      this.formError.set('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    const payload = { name, description: this.formDescription.trim() || null };
    const request =
      target === 'new'
        ? this.catalog.createCategory({ ...payload, store_id: this.context.selectedId()! })
        : this.catalog.updateCategory(target.id, payload);

    this.isSaving.set(true);
    this.formError.set(null);
    request.subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.editing.set(null);
        this.notification.toast(res.message, 'success');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.formError.set(extractErrorMessage(err));
      }
    });
  }

  async remove(category: OwnerCategoryOverview): Promise<void> {
    if (category.products > 0) {
      // Il faut choisir où vont les produits
      this.moveTo = null;
      this.deleteError.set(null);
      this.deleting.set(category);
      return;
    }
    const ok = await this.notification.confirm({
      title: `Supprimer « ${category.name} » ?`,
      text: 'Cette catégorie ne contient aucun produit.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });
    if (ok) {
      this.runDelete(category, null);
    }
  }

  confirmDelete(): void {
    const category = this.deleting();
    if (!category || this.moveTo === null || this.isDeleting()) {
      return;
    }
    this.runDelete(category, this.moveTo);
  }

  private runDelete(category: OwnerCategoryOverview, moveTo: number | 'none' | null): void {
    this.isDeleting.set(true);
    this.deleteError.set(null);
    this.catalog.deleteCategory(category.id, moveTo).subscribe({
      next: (res) => {
        this.isDeleting.set(false);
        this.deleting.set(null);
        this.notification.toast(res.message, 'success');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.isDeleting.set(false);
        const message = extractErrorMessage(err);
        if (this.deleting()) {
          this.deleteError.set(message);
        } else {
          this.notification.error('Suppression impossible', message);
        }
      }
    });
  }
}
