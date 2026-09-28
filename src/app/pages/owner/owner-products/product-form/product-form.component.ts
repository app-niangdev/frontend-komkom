import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../../core/owner/catalog.service';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { ProductDetail, ProductPayload, ProductUnit } from '../../../../core/owner/catalog.model';
import { OwnerCategory } from '../../../../core/owner/owner.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

type ImageSource = 'upload' | 'url';

const DEFAULT_UNIT = 'piece';

/**
 * Création / modification d'une fiche produit : informations, prix et unités de vente,
 * suivi par numéro de série (IMEI) et image. Le stock n'est pas saisi ici (approvisionnements).
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './product-form.component.scss']
})
export class ProductFormComponent implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly ownerService = inject(OwnerService);
  private readonly context = inject(StoreContextService);

  /** null = nouveau produit. */
  readonly productId = input<number | null>(null);
  /** Boutique d'un nouveau produit. */
  readonly storeId = input<number | null>(null);
  readonly saved = output<ProductDetail>();
  readonly closed = output<void>();

  protected readonly formatNumber = formatNumber;
  protected money = (value: number) => formatMoney(value, 'XOF');

  protected readonly product = signal<ProductDetail | null>(null);
  protected readonly isReady = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly categories = signal<OwnerCategory[]>([]);

  protected name = '';
  protected categoryId: number | null = null;
  protected description = '';
  protected alertThreshold: number | null = 5;
  protected readonly requireSerial = signal(false);
  protected units: ProductUnit[] = [this.newUnit(true)];

  protected readonly imageSource = signal<ImageSource>('upload');
  protected imageUrl = '';
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly removeImage = signal(false);
  private objectUrl: string | null = null;

  protected readonly showNewCategory = signal(false);
  protected newCategoryName = '';
  protected readonly isCreatingCategory = signal(false);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly isEdit = computed(() => this.productId() !== null);
  protected readonly effectiveStoreId = computed(() => this.product()?.store?.id ?? this.storeId());
  protected readonly storeName = computed(
    () => this.product()?.store?.name ?? this.context.stores().find((s) => s.id === this.storeId())?.name ?? ''
  );
  protected readonly usesMeasurements = computed(() => {
    const product = this.product();
    if (product) {
      return product.uses_measurements;
    }
    return this.context.stores().find((s) => s.id === this.storeId())?.uses_measurements ?? true;
  });
  /** Une seule unité (à la pièce) : boutique sans mesures, ou produit suivi par numéro de série. */
  protected readonly singleUnit = computed(() => !this.usesMeasurements() || this.requireSerial());

  /** Le stock est compté dans l'unité de base et selon le suivi S/N : ces choix se figent dès qu'il y a du stock. */
  protected readonly hasStock = computed(() => (this.product()?.stock ?? 0) > 0);
  protected readonly serialLocked = computed(() => {
    const p = this.product();
    return !!p && (p.stock > 0 || (p.require_serial_number && (p.serials?.in_stock ?? 0) + (p.serials?.sold ?? 0) > 0));
  });

  ngOnInit(): void {
    const storeId = this.effectiveStoreId();
    const id = this.productId();
    if (id === null) {
      if (storeId) {
        this.loadCategories(storeId);
      }
      this.isReady.set(true);
      return;
    }
    this.catalog.product(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.name = p.name;
        this.categoryId = p.category_id;
        this.description = p.description ?? '';
        this.alertThreshold = p.alert_threshold;
        this.requireSerial.set(p.require_serial_number);
        this.units = p.units.length ? p.units.map((u) => ({ ...u })) : [this.newUnit(true)];
        this.imagePreview.set(p.image_url);
        if (p.store) {
          this.loadCategories(p.store.id);
        }
        this.isReady.set(true);
      },
      error: (err: HttpErrorResponse) => this.loadError.set(extractErrorMessage(err))
    });
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  get baseUnit(): ProductUnit {
    return this.units.find((u) => u.is_base_unit) ?? this.units[0];
  }

  // --- Unités ------------------------------------------------------------------------

  addUnit(): void {
    this.units = [...this.units, this.newUnit(false)];
  }

  removeUnit(unit: ProductUnit): void {
    if (!unit.is_base_unit) {
      this.units = this.units.filter((u) => u !== unit);
    }
  }

  setBase(unit: ProductUnit): void {
    if (this.hasStock()) {
      return;
    }
    this.units = this.units.map((u) => ({ ...u, is_base_unit: u === unit, conversion_factor: u === unit ? 1 : u.conversion_factor }));
  }

  /** Prix de l'unité ramené à l'unité de base, pour repérer un prix incohérent. */
  perBase(unit: ProductUnit): number | null {
    return unit.conversion_factor > 0 ? Math.round(unit.price / unit.conversion_factor) : null;
  }

  onSerialChange(value: boolean): void {
    this.requireSerial.set(value);
  }

  // --- Catégorie ---------------------------------------------------------------------

  createCategory(): void {
    const storeId = this.effectiveStoreId();
    const name = this.newCategoryName.trim();
    if (!storeId || name.length < 2 || this.isCreatingCategory()) {
      return;
    }
    this.isCreatingCategory.set(true);
    this.catalog.quickCategory(storeId, name).subscribe({
      next: (c) => {
        this.isCreatingCategory.set(false);
        if (!this.categories().some((x) => x.id === c.id)) {
          this.categories.set([...this.categories(), { id: c.id, name: c.name, store_name: null }].sort((a, b) => a.name.localeCompare(b.name)));
        }
        this.categoryId = c.id;
        this.newCategoryName = '';
        this.showNewCategory.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isCreatingCategory.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }

  // --- Image -------------------------------------------------------------------------

  setImageSource(source: ImageSource): void {
    this.imageSource.set(source);
    this.imageFile.set(null);
    this.imageUrl = '';
    this.revokeObjectUrl();
    this.imagePreview.set(this.removeImage() ? null : (this.product()?.image_url ?? null));
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      return;
    }
    this.imageFile.set(file);
    this.removeImage.set(false);
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.imagePreview.set(this.objectUrl);
  }

  onRemoveImage(): void {
    this.imageFile.set(null);
    this.imageUrl = '';
    this.removeImage.set(true);
    this.revokeObjectUrl();
    this.imagePreview.set(null);
  }

  // --- Enregistrement ----------------------------------------------------------------

  /** Contrôles avant envoi (le serveur refait les siens). */
  validationError(): string | null {
    if (!this.name.trim()) {
      return 'Le nom du produit est obligatoire.';
    }
    const units = this.payloadUnits();
    if (units.some((u) => !u.name.trim())) {
      return 'Chaque unité doit avoir un nom.';
    }
    if (units.some((u) => u.price === null || u.price === undefined || Number(u.price) < 0 || Number.isNaN(Number(u.price)))) {
      return 'Chaque unité doit avoir un prix positif ou nul.';
    }
    if (units.some((u) => !(Number(u.conversion_factor) > 0))) {
      return 'Le facteur de conversion doit être supérieur à zéro.';
    }
    const names = units.map((u) => u.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      return 'Deux unités portent le même nom.';
    }
    return null;
  }

  submit(): void {
    const error = this.validationError();
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    const storeId = this.effectiveStoreId();
    if (!this.isEdit() && !storeId) {
      this.errorMessage.set('Choisissez la boutique du produit.');
      return;
    }
    if (this.isSubmitting()) {
      return;
    }

    const payload: ProductPayload = {
      store_id: this.isEdit() ? undefined : storeId!,
      name: this.name.trim(),
      category_id: this.categoryId,
      description: this.description.trim() || null,
      alert_threshold: Math.max(0, Math.round(Number(this.alertThreshold) || 0)),
      require_serial_number: this.requireSerial(),
      units: this.payloadUnits(),
      remove_image: this.removeImage()
    };
    if (this.imageSource() === 'upload') {
      payload.image = this.imageFile();
    } else if (this.imageUrl.trim()) {
      payload.image_url = this.imageUrl.trim();
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const id = this.productId();
    const request = id === null ? this.catalog.createProduct(payload) : this.catalog.updateProduct(id, payload);
    request.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.saved.emit(res.data);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      }
    });
  }

  /** Une seule unité à la pièce quand il le faut, l'unité de base au facteur 1. */
  private payloadUnits(): ProductUnit[] {
    if (this.singleUnit()) {
      const base = this.baseUnit;
      return [{ ...base, name: this.usesMeasurements() ? base.name.trim() || DEFAULT_UNIT : DEFAULT_UNIT, conversion_factor: 1, is_base_unit: true }];
    }
    return this.units.map((u) => ({
      ...u,
      name: u.name.trim(),
      price: Math.round(Number(u.price)),
      conversion_factor: u.is_base_unit ? 1 : Number(u.conversion_factor)
    }));
  }

  private loadCategories(storeId: number): void {
    this.ownerService.categories(storeId).subscribe({ next: (c) => this.categories.set(c) });
  }

  private newUnit(isBase: boolean): ProductUnit {
    return { id: null, name: isBase ? DEFAULT_UNIT : '', price: 0, conversion_factor: 1, is_base_unit: isBase };
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
