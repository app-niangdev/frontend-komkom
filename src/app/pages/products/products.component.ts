import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product, ProductPayload } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';

const PER_PAGE = 10;

type ImageSource = 'upload' | 'url';

interface ProductFormState {
  name: string;
  description: string;
  unit_price: number | null;
  image_url: string;
  category_id: number | null;
}

function emptyForm(): ProductFormState {
  return { name: '', description: '', unit_price: null, image_url: '', category_id: null };
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly notification = inject(NotificationService);

  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected search = '';

  protected readonly isFormOpen = signal(false);
  protected readonly editingProductId = signal<number | null>(null);
  protected form: ProductFormState = emptyForm();

  protected readonly imageSource = signal<ImageSource>('upload');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreviewUrl = signal<string | null>(null);
  protected readonly removeImage = signal(false);
  private objectUrl: string | null = null;

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  loadProducts(page = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.productService.list(PER_PAGE, this.search).subscribe({
      next: (res) => {
        this.products.set(res.payload);
        this.currentPage.set(res.meta.current_page);
        this.lastPage.set(res.meta.last_page);
        this.total.set(res.meta.total);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Impossible de charger les produits.');
      }
    });
  }

  loadCategories(): void {
    this.categoryService.list(100, '').subscribe({
      next: (res) => this.categories.set(res.payload)
    });
  }

  categoryName(categoryId: number): string {
    return this.categories().find((c) => c.id === categoryId)?.name ?? '—';
  }

  formatPrice(price: string | number): string {
    const amount = Math.round(Number(price));
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  onSearch(): void {
    this.loadProducts(1);
  }

  openCreateForm(): void {
    this.form = emptyForm();
    this.editingProductId.set(null);
    this.errorMessage.set(null);
    this.resetImageState(null);
    this.isFormOpen.set(true);
  }

  openEditForm(product: Product): void {
    this.form = {
      name: product.name,
      description: product.description ?? '',
      unit_price: Number(product.unit_price),
      image_url: product.image_url ?? '',
      category_id: product.category_id
    };
    this.editingProductId.set(product.id);
    this.errorMessage.set(null);
    this.imageSource.set(product.image_url ? 'url' : 'upload');
    this.resetImageState(product.image_url);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.errorMessage.set(null);
  }

  setImageSource(source: ImageSource): void {
    this.imageSource.set(source);
    this.imageFile.set(null);
    this.removeImage.set(false);
    this.revokeObjectUrl();

    if (source === 'upload') {
      this.form.image_url = '';
      this.imagePreviewUrl.set(null);
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.imageFile.set(file);
    this.removeImage.set(false);
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.imagePreviewUrl.set(this.objectUrl);
  }

  onRemoveImage(): void {
    this.imageFile.set(null);
    this.removeImage.set(true);
    this.revokeObjectUrl();
    this.imagePreviewUrl.set(null);
  }

  private resetImageState(currentImageUrl: string | null): void {
    this.imageFile.set(null);
    this.removeImage.set(false);
    this.revokeObjectUrl();
    this.imagePreviewUrl.set(this.imageSource() === 'url' ? null : currentImageUrl);
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  submitForm(): void {
    if (
      !this.form.name.trim() ||
      this.form.unit_price === null ||
      !this.form.category_id ||
      this.isSubmitting()
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const payload: ProductPayload = {
      name: this.form.name.trim(),
      description: this.form.description.trim() || null,
      unit_price: this.form.unit_price,
      category_id: this.form.category_id
    };

    if (this.imageSource() === 'upload') {
      payload.image = this.imageFile();
      payload.remove_image = this.removeImage();
    } else {
      payload.image_url = this.form.image_url.trim() || null;
    }

    const editingId = this.editingProductId();
    const request = editingId
      ? this.productService.update(editingId, payload)
      : this.productService.create(payload);

    request.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.isFormOpen.set(false);
        this.notification.toast(
          editingId ? 'Produit modifié avec succès.' : 'Produit créé avec succès.',
          'success'
        );
        this.loadProducts(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.extractErrorMessage(err));
      }
    });
  }

  toggleAvailability(product: Product): void {
    this.productService.toggleAvailability(product.id).subscribe({
      next: (res) => {
        this.products.update((list) =>
          list.map((p) => (p.id === product.id ? res.payload : p))
        );
        this.notification.toast(res.message, 'success');
      },
      error: (err: HttpErrorResponse) => {
        this.notification.toast(err.error?.message ?? 'Une erreur est survenue.', 'error');
      }
    });
  }

  async askDelete(product: Product): Promise<void> {
    const confirmed = await this.notification.confirm({
      title: 'Supprimer ce produit ?',
      text: `« ${product.name} » sera supprimé. Vous pourrez le restaurer si besoin.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.notification.toast('Produit supprimé avec succès.', 'success');
        this.loadProducts(this.currentPage());
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
    this.loadProducts(page);
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
