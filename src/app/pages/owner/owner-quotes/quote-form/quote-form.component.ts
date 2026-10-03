import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { PosService } from '../../../../core/owner/pos.service';
import { PosCustomer, PosProduct, PosUnit } from '../../../../core/owner/pos.model';
import { QuoteService } from '../../../../core/owner/quote.service';
import { QuotePayload } from '../../../../core/owner/quote.model';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { addDays, todayIso } from '../../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

/** Ligne du devis : produit suggéré (copie de son nom, unité et prix) ou ligne libre. */
interface FormLine {
  key: number;
  productId: number | null;
  /** Unités de vente du produit suggéré ; vide pour une ligne libre ou un devis rechargé. */
  units: PosUnit[];
  unitId: number | null;
  designation: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
}

const VALIDITY_DAYS = 30;
const PHONE_PATTERN = /^\+?[0-9 ]{9,15}$/;

/**
 * Saisie d'un devis : client, lignes (produits de la boutique suggérés ou texte libre), remise,
 * validité et remarques. Le catalogue n'est que lu : aucun stock ni produit n'est modifié.
 */
@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quote-form.component.html',
  styleUrls: [
    '../../../../../styles/_admin-crud.scss',
    '../../owner-procurements/procurement-form/procurement-form.component.scss',
    './quote-form.component.scss'
  ]
})
export class QuoteFormComponent implements OnInit {
  private readonly posService = inject(PosService);
  private readonly quoteService = inject(QuoteService);
  private readonly notification = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly context = inject(StoreContextService);

  protected readonly formatNumber = formatNumber;
  protected readonly today = todayIso();

  protected quoteId: number | null = null;
  protected readonly quoteNumber = signal<string | null>(null);
  protected readonly isReady = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly currency = signal('XOF');

  protected storeId: number | null = null;

  // Client
  protected customerMode: 'existing' | 'new' = 'existing';
  protected customerSearch = '';
  private readonly customerSearch$ = new Subject<string>();
  protected readonly customerResults = signal<PosCustomer[]>([]);
  protected readonly customer = signal<Pick<PosCustomer, 'id' | 'name' | 'phone'> | null>(null);
  protected newCustomer = { name: '', phone: '' };

  // Produits suggérés
  protected productSearch = '';
  private readonly search$ = new Subject<string>();
  protected readonly results = signal<PosProduct[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchOpen = signal(false);
  protected activeResult = 0;

  protected lines: FormLine[] = [];
  private nextKey = 1;
  protected readonly highlight = signal<number | null>(null);

  protected discount: number | null = null;
  protected validUntil: string | null = addDays(this.today, VALIDITY_DAYS);
  protected notes = '';

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private dirty = false;
  private saved = false;

  /** Boutiques où l'on peut saisir : abonnement en cours. */
  protected readonly stores = computed(() =>
    this.context.stores().filter((s) => s.subscription.state !== 'expired' && s.subscription.state !== 'none')
  );

  protected money = (value: number) => formatMoney(value, this.currency());

  constructor() {
    // Nouveau devis : boutique du sélecteur, ou la seule boutique disponible
    effect(() => {
      if (!this.context.loaded() || this.route.snapshot.paramMap.get('id')) {
        return;
      }
      untracked(() => {
        if (this.isReady()) {
          return;
        }
        const stores = this.stores();
        const selected = this.context.selectedId();
        this.storeId = stores.some((s) => s.id === selected) ? selected : stores.length === 1 ? stores[0].id : null;
        this.isReady.set(true);
      });
    }, { allowSignalWrites: true });
  }

  get isEdit(): boolean {
    return this.quoteId !== null;
  }

  get storeName(): string {
    return this.context.stores().find((s) => s.id === this.storeId)?.name ?? '';
  }

  get subtotal(): number {
    return this.lines.reduce((sum, l) => sum + this.lineTotal(l), 0);
  }

  get discountValue(): number {
    return Math.max(0, Math.round(Number(this.discount) || 0));
  }

  get total(): number {
    return Math.max(0, this.subtotal - this.discountValue);
  }

  get customerLabel(): string {
    if (this.customerMode === 'new') {
      return this.newCustomer.name.trim() || '—';
    }
    return this.customer()?.name ?? '—';
  }

  /** Ce qui empêche d'enregistrer, dans l'ordre de saisie. */
  get issues(): string[] {
    const issues: string[] = [];
    if (!this.storeId) {
      issues.push('Choisissez la boutique.');
    }
    if (this.customerMode === 'existing' && !this.customer()) {
      issues.push('Choisissez le client.');
    }
    if (this.customerMode === 'new' && (this.newCustomer.name.trim().length < 2 || !PHONE_PATTERN.test(this.newCustomer.phone.trim()))) {
      issues.push('Saisissez le nom et le téléphone (9 à 15 chiffres) du nouveau client.');
    }
    if (this.lines.length === 0) {
      issues.push('Ajoutez au moins une ligne.');
    }
    this.lines.forEach((l, i) => {
      if (!l.designation.trim()) {
        issues.push(`Ligne ${i + 1} : saisissez une désignation.`);
      } else if (!(l.quantity > 0)) {
        issues.push(`Ligne ${i + 1} : la quantité doit être supérieure à zéro.`);
      } else if (!(l.unitPrice >= 0)) {
        issues.push(`Ligne ${i + 1} : prix unitaire invalide.`);
      }
    });
    if (this.discountValue > this.subtotal) {
      issues.push('La remise dépasse le sous-total.');
    }
    return issues;
  }

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(250),
        tap(() => this.searching.set(true)),
        switchMap((term) =>
          this.storeId
            ? this.posService.products(this.storeId, { search: term, category_id: null }).pipe(
                tap((res) => this.currency.set(res.currency)),
                map((res) => res.data),
                catchError(() => of([] as PosProduct[]))
              )
            : of([] as PosProduct[])
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((products) => {
        this.results.set(products);
        this.activeResult = 0;
        this.searching.set(false);
      });

    this.customerSearch$
      .pipe(
        debounceTime(250),
        switchMap((term) => (this.storeId ? this.posService.customers(this.storeId, term).pipe(catchError(() => of([]))) : of([]))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((customers) => this.customerResults.set(customers));

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.quoteId = id;
      this.loadQuote(id);
    }
  }

  // --- Boutique et client -------------------------------------------------------------

  async changeStore(storeId: number | null): Promise<void> {
    const previous = this.storeId;
    if (storeId === previous) {
      return;
    }
    if (this.lines.some((l) => l.productId) || this.customer()) {
      const ok = await this.notification.confirm({
        title: 'Changer de boutique ?',
        text: 'Le client et les produits choisis appartiennent à l\'autre boutique : ils seront retirés (les lignes libres sont gardées).',
        confirmText: 'Changer',
        cancelText: 'Annuler'
      });
      if (!ok) {
        this.storeId = null;
        setTimeout(() => (this.storeId = previous));
        return;
      }
    }
    this.storeId = storeId;
    this.lines = this.lines.filter((l) => !l.productId);
    this.customer.set(null);
    this.customerSearch = '';
    this.customerResults.set([]);
    this.results.set([]);
    this.markDirty();
  }

  setCustomerMode(mode: 'existing' | 'new'): void {
    this.customerMode = mode;
    this.markDirty();
    if (mode === 'existing' && this.customerResults().length === 0) {
      this.customerSearch$.next('');
    }
  }

  onCustomerSearch(): void {
    this.customer.set(null);
    this.customerSearch$.next(this.customerSearch);
  }

  openCustomerSearch(): void {
    if (!this.customer() && this.customerResults().length === 0) {
      this.customerSearch$.next(this.customerSearch);
    }
  }

  pickCustomer(customer: PosCustomer): void {
    this.customer.set(customer);
    this.customerSearch = customer.name;
    this.markDirty();
  }

  // --- Produits suggérés ----------------------------------------------------------------

  onSearch(term: string): void {
    this.searchOpen.set(true);
    this.search$.next(term.trim());
  }

  openSearch(): void {
    this.searchOpen.set(true);
    if (this.results().length === 0) {
      this.search$.next(this.productSearch.trim());
    }
  }

  closeSearchSoon(): void {
    // Laisse le temps au clic sur un résultat d'être pris en compte
    setTimeout(() => this.searchOpen.set(false), 150);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.results();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeResult = Math.min(results.length - 1, this.activeResult + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeResult = Math.max(0, this.activeResult - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[this.activeResult]) {
        this.addProduct(results[this.activeResult]);
      }
    } else if (event.key === 'Escape') {
      this.searchOpen.set(false);
    }
  }

  /** Copie le nom, l'unité et le prix catalogue du produit dans une nouvelle ligne. */
  addProduct(product: PosProduct): void {
    const unit = product.units[0] ?? null;
    this.pushLine({
      productId: product.id,
      units: product.units,
      unitId: unit?.id ?? null,
      designation: product.name,
      unitName: unit?.name ?? product.base_unit,
      quantity: 1,
      unitPrice: unit?.price ?? 0
    });
    this.productSearch = '';
    this.searchOpen.set(false);
  }

  addFreeLine(): void {
    this.pushLine({ productId: null, units: [], unitId: null, designation: '', unitName: '', quantity: 1, unitPrice: 0 });
    // Place le curseur dans la désignation de la nouvelle ligne
    const key = this.nextKey - 1;
    setTimeout(() => document.getElementById('qd-' + key)?.focus());
  }

  removeLine(line: FormLine): void {
    this.lines = this.lines.filter((l) => l !== line);
    this.markDirty();
  }

  /** Changement d'unité d'un produit suggéré : reprend le prix catalogue de cette unité. */
  setUnit(line: FormLine, unitId: number | null): void {
    const unit = line.units.find((u) => u.id === unitId);
    if (!unit) {
      return;
    }
    line.unitId = unit.id;
    line.unitName = unit.name;
    line.unitPrice = unit.price;
    this.markDirty();
  }

  lineTotal(line: FormLine): number {
    return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
  }

  isInLines(productId: number): boolean {
    return this.lines.some((l) => l.productId === productId);
  }

  trackLine(_: number, line: FormLine): number {
    return line.key;
  }

  // --- Enregistrement -----------------------------------------------------------------

  submit(): void {
    if (this.isSubmitting() || this.issues.length > 0 || !this.storeId) {
      return;
    }
    const payload: QuotePayload = {
      customer:
        this.customerMode === 'existing'
          ? { mode: 'existing', id: this.customer()?.id }
          : { mode: 'new', name: this.newCustomer.name.trim(), phone: this.newCustomer.phone.trim() },
      items: this.lines.map((l) => ({
        product_id: l.productId,
        unit_of_measure_id: l.unitId,
        designation: l.designation.trim(),
        unit_name: l.unitName.trim() || null,
        quantity: Number(l.quantity),
        unit_price: Math.round(Number(l.unitPrice))
      })),
      discount: this.discountValue,
      valid_until: this.validUntil || null,
      notes: this.notes.trim() || null
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const request = this.quoteId
      ? this.quoteService.update(this.quoteId, payload)
      : this.quoteService.create({ ...payload, store_id: this.storeId });
    request.subscribe({
      next: (res) => {
        this.saved = true;
        this.notification.toast(res.message, 'success');
        this.router.navigate([this.context.base() + '/quotes'], { queryParams: { open: res.data.id } });
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  /** Garde de sortie : confirmation si la saisie n'est pas enregistrée. */
  async confirmLeave(): Promise<boolean> {
    if (!this.dirty || this.saved) {
      return true;
    }
    return this.notification.confirm({
      title: 'Quitter sans enregistrer ?',
      text: 'La saisie en cours de ce devis sera perdue.',
      confirmText: 'Quitter',
      cancelText: 'Rester',
      danger: true
    });
  }

  markDirty(): void {
    this.dirty = true;
  }

  private pushLine(line: Omit<FormLine, 'key'>): void {
    const key = this.nextKey++;
    this.lines = [...this.lines, { key, ...line }];
    this.markDirty();
    this.highlight.set(key);
    setTimeout(() => this.highlight() === key && this.highlight.set(null), 1200);
  }

  private loadQuote(id: number): void {
    this.quoteService.get(id).subscribe({
      next: ({ data, currency }) => {
        if (!data.editable) {
          this.loadError.set(`Le devis ${data.number} est ${data.status === 'accepted' ? 'accepté' : 'refusé'} : il ne peut plus être modifié. Dupliquez-le pour en faire une nouvelle version.`);
          return;
        }
        this.currency.set(currency);
        this.quoteNumber.set(data.number);
        this.storeId = data.store?.id ?? null;
        this.customer.set({ id: data.customer_id, name: data.customer ?? '', phone: data.customer_phone ?? '' });
        this.customerSearch = data.customer ?? '';
        this.lines = data.items.map((item) => ({
          key: this.nextKey++,
          productId: item.product_id,
          units: [],
          unitId: item.unit_of_measure_id,
          designation: item.designation,
          unitName: item.unit_name ?? '',
          quantity: item.quantity,
          unitPrice: item.unit_price
        }));
        this.discount = data.discount || null;
        this.validUntil = data.valid_until;
        this.notes = data.notes ?? '';
        this.isReady.set(true);
      },
      error: (err: HttpErrorResponse) => this.loadError.set(extractErrorMessage(err))
    });
  }
}
