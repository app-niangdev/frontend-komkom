import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoryService } from '../../core/services/category.service';
import { NotificationService } from '../../core/services/notification.service';
import { Category, CategoryPayload } from '../../core/models/category.model';

const PER_PAGE = 10;

interface CategoryFormState {
  name: string;
  description: string;
}

function emptyForm(): CategoryFormState {
  return { name: '', description: '' };
}

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss'
})
export class CategoriesComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly notification = inject(NotificationService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected search = '';

  protected readonly isFormOpen = signal(false);
  protected readonly editingCategoryId = signal<number | null>(null);
  protected form: CategoryFormState = emptyForm();

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(page = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.categoryService.list(PER_PAGE, this.search).subscribe({
      next: (res) => {
        this.categories.set(res.payload);
        this.currentPage.set(res.meta.current_page);
        this.lastPage.set(res.meta.last_page);
        this.total.set(res.meta.total);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Impossible de charger les catégories.');
      }
    });
  }

  onSearch(): void {
    this.loadCategories(1);
  }

  openCreateForm(): void {
    this.form = emptyForm();
    this.editingCategoryId.set(null);
    this.errorMessage.set(null);
    this.isFormOpen.set(true);
  }

  openEditForm(category: Category): void {
    this.form = { name: category.name, description: category.description };
    this.editingCategoryId.set(category.id);
    this.errorMessage.set(null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.errorMessage.set(null);
  }

  submitForm(): void {
    if (!this.form.name.trim() || !this.form.description.trim() || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: CategoryPayload = {
      name: this.form.name.trim(),
      description: this.form.description.trim()
    };

    const editingId = this.editingCategoryId();
    const request = editingId
      ? this.categoryService.update(editingId, payload)
      : this.categoryService.create(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isFormOpen.set(false);
        this.notification.toast(
          editingId ? 'Catégorie modifiée avec succès.' : 'Catégorie créée avec succès.',
          'success'
        );
        this.loadCategories(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  async askDelete(category: Category): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer cette catégorie ?',
      text: `« ${category.name} » sera supprimée. Vous pourrez la restaurer si besoin.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.notification.toast('Catégorie supprimée avec succès.', 'success');
        this.loadCategories(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.notification.toast(err.error?.message ?? 'Une erreur est survenue.', 'error');
      }
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) {
      return;
    }
    this.loadCategories(page);
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const errors = err.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      if (firstKey && Array.isArray(errors[firstKey])) {
        return errors[firstKey][0];
      }
    }
    return err.error?.message ?? 'Une erreur est survenue.';
  }
}
