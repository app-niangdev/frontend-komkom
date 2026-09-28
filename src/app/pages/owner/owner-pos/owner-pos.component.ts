import { Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { PosService } from '../../../core/owner/pos.service';
import { StoreContextService } from '../../../core/owner/store-context.service';
import {
  CheckoutPayload,
  CheckoutResult,
  CustomerMode,
  OwnerInvoiceDetail,
  PaymentType,
  PosCustomer,
  PosProduct,
  PosUnit
} from '../../../core/owner/pos.model';
import { StoreBlockedComponent } from '../../../core/owner/store-blocked/store-blocked.component';
import { NotificationService } from '../../../core/services/notification.service';
import { formatMoney, formatNumber } from '../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';
import { PAYMENT_METHODS } from '../owner-invoices/invoice-detail/invoice-detail.component';
import { InvoiceDocumentComponent } from '../owner-invoices/invoice-document/invoice-document.component';
import { SerialPickerComponent } from './serial-picker/serial-picker.component';

interface CartLine {
  product: PosProduct;
  unit: PosUnit;
  quantity: number;
  unitPrice: number;
  serials: string[];
}

/**
 * Caisse : catalogue de la boutique, panier, client (anonyme, existant ou nouveau), remise
 * et encaissement. Un client identifié peut payer une partie seulement : le reste est dû sur sa facture.
 */
@Component({
  selector: 'app-owner-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StoreBlockedComponent, SerialPickerComponent, InvoiceDocumentComponent],
  templateUrl: './owner-pos.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss', './owner-pos.component.scss']
})
export class OwnerPosComponent {
  private readonly posService = inject(PosService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly context = inject(StoreContextService);

  protected readonly methods = PAYMENT_METHODS;
  protected readonly formatNumber = formatNumber;

  // --- Catalogue ---------------------------------------------------------------------
  protected search = '';
  protected readonly categoryId = signal<number | null>(null);
  protected readonly products = signal<PosProduct[]>([]);
  protected readonly categories = signal<{ id: number; name: string }[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly isLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly usesMeasurements = signal(true);
  protected readonly currency = signal('XOF');
  private readonly search$ = new Subject<string>();

  // --- Panier ------------------------------------------------------------------------
  protected readonly lines = signal<CartLine[]>([]);
  /** Ligne ajoutée ou modifiée à l'instant : mise en évidence et amenée à l'écran. */
  protected readonly flashKey = signal<string | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly serialProduct = signal<PosProduct | null>(null);
  protected discount: number | null = null;

  // --- Client ------------------------------------------------------------------------
  protected readonly customerMode = signal<CustomerMode>('anonymous');
  protected customerSearch = '';
  private readonly customerSearch$ = new Subject<string>();
  protected readonly customerResults = signal<PosCustomer[]>([]);
  protected readonly customer = signal<PosCustomer | null>(null);
  protected newCustomer = { name: '', phone: '' };

  // --- Paiement ----------------------------------------------------------------------
  protected paymentType: PaymentType = 'cash';
  /** Espèces d'un client anonyme : somme remise, pour calculer la monnaie. */
  protected cashGiven: number | null = null;
  /** Client identifié : montant payé maintenant (le reste est dû). */
  protected paidNow: number | null = null;
  private paidNowTouched = false;

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly done = signal<CheckoutResult | null>(null);
  protected readonly doneInvoice = signal<OwnerInvoiceDetail | null>(null);
  private readonly ticketRef = viewChild(InvoiceDocumentComponent);

  protected readonly storeId = computed(() => this.context.selectedId());
  protected money = (value: number) => formatMoney(value, this.currency());

  protected readonly subtotal = computed(() => this.lines().reduce((sum, l) => sum + Math.round(l.quantity * l.unitPrice), 0));
  protected readonly itemCount = computed(() => this.lines().reduce((sum, l) => sum + l.quantity, 0));

  constructor() {
    this.search$
      .pipe(
        debounceTime(250),
        switchMap(() => this.fetchProducts(1)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    this.customerSearch$
      .pipe(
        debounceTime(250),
        switchMap((term) => {
          const storeId = this.storeId();
          return storeId ? this.posService.customers(storeId, term).pipe(catchError(() => of([]))) : of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((customers) => this.customerResults.set(customers));

    // Changement de boutique (propriétaire) : nouveau catalogue, panier vidé
    effect(() => {
      const storeId = this.storeId();
      const blocked = this.context.selectedIsBlocked();
      if (!this.context.loaded()) {
        return;
      }
      untracked(() => {
        this.resetSale();
        this.categoryId.set(null);
        this.products.set([]);
        if (storeId && !blocked) {
          this.fetchProducts(1).subscribe();
        }
      });
    }, { allowSignalWrites: true });
  }

  /**
   * Hauteur du panier = espace visible sous son bord haut réel (sous l'en-tête de page en haut
   * de l'écran, sous la barre de navigation une fois collé) : le bouton d'encaissement reste à l'écran.
   */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected fitCart(): void {
    if (this.fitFrame) {
      return;
    }
    this.fitFrame = requestAnimationFrame(() => {
      this.fitFrame = 0;
      const cart = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('.pos__cart');
      if (!cart) {
        return;
      }
      const top = Math.max(cart.getBoundingClientRect().top, 0);
      cart.style.setProperty('--cart-height', `${Math.max(360, window.innerHeight - top - 16)}px`);
    });
  }
  private fitFrame = 0;

  /** Barre mobile : amène le panier (sous le catalogue) à l'écran. */
  protected scrollToCart(): void {
    (this.host.nativeElement as HTMLElement).querySelector('.pos__cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  total(): number {
    return Math.max(0, this.subtotal() - this.discountValue());
  }

  discountValue(): number {
    return Math.max(0, Math.round(Number(this.discount) || 0));
  }

  /** Montant réellement encaissé à la validation. */
  amountPaid(): number {
    if (this.customerMode() === 'anonymous') {
      return this.total();
    }
    const value = this.paidNowTouched ? Math.round(Number(this.paidNow) || 0) : this.total();
    return Math.min(Math.max(0, value), this.total());
  }

  change(): number {
    return this.paymentType === 'cash' && this.cashGiven ? Math.max(0, Math.round(this.cashGiven) - this.total()) : 0;
  }

  /** Raison qui empêche d'encaisser, affichée sous le bouton. */
  blocker(): string | null {
    if (this.lines().length === 0) {
      return 'Ajoutez des articles au panier.';
    }
    if (this.discountValue() > this.subtotal()) {
      return 'La remise dépasse le montant des articles.';
    }
    const mode = this.customerMode();
    if (mode === 'existing' && !this.customer()) {
      return 'Choisissez le client.';
    }
    if (mode === 'new' && (this.newCustomer.name.trim().length < 2 || !/^\+?[0-9 ]{9,15}$/.test(this.newCustomer.phone.trim()))) {
      return 'Renseignez le nom et le téléphone (9 chiffres ou plus) du nouveau client.';
    }
    if (mode === 'anonymous' && this.paymentType === 'cash' && this.cashGiven && this.cashGiven < this.total()) {
      return `Somme reçue insuffisante : il manque ${this.money(this.total() - Math.round(this.cashGiven))}.`;
    }
    if (mode !== 'anonymous' && this.paidNowTouched && Number(this.paidNow) > this.total()) {
      return 'Le montant payé dépasse le total.';
    }
    return null;
  }

  // --- Catalogue ---------------------------------------------------------------------

  onSearch(): void {
    this.search$.next(this.search);
  }

  /** Entrée dans la recherche (douchette code-barres, par ex.) : un seul résultat -> ajouté au panier. */
  onSearchEnter(): void {
    const storeId = this.storeId();
    if (!storeId || !this.search.trim()) {
      return;
    }
    this.posService.products(storeId, { search: this.search, category_id: this.categoryId() }).subscribe((res) => {
      this.products.set(res.data);
      if (res.data.length === 1) {
        this.add(res.data[0]);
        this.search = '';
        this.fetchProducts(1).subscribe();
      }
    });
  }

  selectCategory(id: number | null): void {
    this.categoryId.set(id);
    this.fetchProducts(1).subscribe();
  }

  goToPage(page: number): void {
    this.fetchProducts(page).subscribe();
  }

  /** Stock restant affiché sur la fiche, en tenant compte du panier. */
  remaining(product: PosProduct): number {
    const inCart = this.lines()
      .filter((l) => l.product.id === product.id)
      .reduce((sum, l) => sum + l.quantity * l.unit.factor, 0);
    return Math.max(0, product.stock - inCart);
  }

  price(product: PosProduct): number {
    return product.units[0]?.price ?? 0;
  }

  // --- Panier ------------------------------------------------------------------------

  add(product: PosProduct): void {
    if (product.require_serial_number) {
      this.serialProduct.set(product);
      return;
    }
    const unit = product.units[0];
    if (!unit || this.remaining(product) < unit.factor) {
      this.notification.toast(`« ${product.name} » : stock épuisé`, 'warning');
      return;
    }
    const lines = this.lines();
    const existing = lines.find((l) => l.product.id === product.id && l.unit.id === unit.id);
    if (existing) {
      this.setQuantity(existing, existing.quantity + 1);
    } else {
      this.lines.set([...lines, { product, unit, quantity: 1, unitPrice: unit.price, serials: [] }]);
      this.resetPaidNow();
    }
    this.reveal(`${product.id}:${unit.id}`);
  }

  onSerialsPicked(serials: string[]): void {
    const product = this.serialProduct();
    this.serialProduct.set(null);
    if (!product) {
      return;
    }
    const others = this.lines().filter((l) => l.product.id !== product.id);
    if (serials.length === 0) {
      this.lines.set(others);
    } else {
      const current = this.lines().find((l) => l.product.id === product.id);
      const unit = product.units.find((u) => u.is_base) ?? product.units[0];
      this.lines.set([
        ...others,
        { product, unit, quantity: serials.length, unitPrice: current?.unitPrice ?? unit.price, serials }
      ]);
      this.reveal(`${product.id}:${unit.id}`);
    }
    this.resetPaidNow();
  }

  lineKey(line: CartLine): string {
    return `${line.product.id}:${line.unit.id}`;
  }

  trackLine = (_: number, line: CartLine) => this.lineKey(line);

  serialsInCart(product: PosProduct): string[] {
    return this.lines().find((l) => l.product.id === product.id)?.serials ?? [];
  }

  editSerials(line: CartLine): void {
    this.serialProduct.set(line.product);
  }

  setQuantity(line: CartLine, value: number | null): void {
    let quantity = Number(value) || 0;
    if (!this.usesMeasurements()) {
      quantity = Math.floor(quantity);
    }
    quantity = Math.round(quantity * 1000) / 1000;
    if (quantity <= 0) {
      this.remove(line);
      return;
    }
    const otherUse = this.lines()
      .filter((l) => l !== line && l.product.id === line.product.id)
      .reduce((sum, l) => sum + l.quantity * l.unit.factor, 0);
    const max = Math.floor(((line.product.stock - otherUse) / line.unit.factor) * 1000) / 1000;
    if (quantity > max) {
      this.notification.toast(`Stock insuffisant : il reste ${formatNumber(Math.max(0, max))} ${line.unit.name} de « ${line.product.name} »`, 'warning');
      quantity = max;
      if (quantity <= 0) {
        this.remove(line);
        return;
      }
    }
    this.replace(line, { ...line, quantity });
  }

  setUnit(line: CartLine, unitId: number | null): void {
    const unit = line.product.units.find((u) => u.id === unitId);
    if (!unit) {
      return;
    }
    if (this.lines().some((l) => l !== line && l.product.id === line.product.id && l.unit.id === unit.id)) {
      this.notification.toast(`« ${line.product.name} » est déjà au panier dans cette unité`, 'warning');
      return;
    }
    this.replace(line, { ...line, unit, unitPrice: unit.price });
    // Revalide la quantité dans la nouvelle unité
    const updated = this.lines().find((l) => l.product.id === line.product.id && l.unit.id === unit.id);
    if (updated) {
      this.setQuantity(updated, updated.quantity);
    }
  }

  setPrice(line: CartLine, value: number | null): void {
    this.replace(line, { ...line, unitPrice: Math.max(0, Math.round(Number(value) || 0)) });
  }

  remove(line: CartLine): void {
    this.lines.set(this.lines().filter((l) => l !== line));
    this.resetPaidNow();
  }

  async clearCart(): Promise<void> {
    if (this.lines().length === 0) {
      return;
    }
    const ok = await this.notification.confirm({ title: 'Vider le panier ?', confirmText: 'Vider', cancelText: 'Annuler', danger: true });
    if (ok) {
      this.resetSale();
    }
  }

  // --- Client ------------------------------------------------------------------------

  setCustomerMode(mode: CustomerMode): void {
    this.customerMode.set(mode);
    this.submitError.set(null);
    this.resetPaidNow();
    if (mode === 'existing' && this.customerResults().length === 0) {
      this.customerSearch$.next('');
    }
  }

  onCustomerSearch(): void {
    this.customer.set(null);
    this.customerSearch$.next(this.customerSearch);
  }

  pickCustomer(customer: PosCustomer): void {
    this.customer.set(customer);
    this.customerSearch = customer.name;
  }

  onPaidNowChange(value: number | null): void {
    this.paidNowTouched = true;
    this.paidNow = value;
  }

  setPaidNow(value: number): void {
    this.paidNowTouched = true;
    this.paidNow = value;
  }

  // --- Encaissement ------------------------------------------------------------------

  checkout(): void {
    const storeId = this.storeId();
    if (!storeId || this.isSubmitting() || this.blocker()) {
      return;
    }
    const mode = this.customerMode();
    const payload: CheckoutPayload = {
      store_id: storeId,
      customer:
        mode === 'existing'
          ? { mode, id: this.customer()?.id }
          : mode === 'new'
            ? { mode, name: this.newCustomer.name.trim(), phone: this.newCustomer.phone.trim() }
            : { mode },
      items: this.lines().map((l) => ({
        product_id: l.product.id,
        unit_of_measure_id: l.unit.id,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        serial_numbers: l.product.require_serial_number ? l.serials : undefined
      })),
      discount: this.discountValue(),
      payment: { amount: this.amountPaid(), payment_type: this.paymentType }
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.posService.checkout(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.done.set(res.data);
        this.doneInvoice.set(null);
        // Document prêt pour l'impression du ticket
        this.posService.invoice(res.data.invoice_id).subscribe({ next: (r) => this.doneInvoice.set(r.data) });
        this.fetchProducts(this.page()).subscribe();
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.submitError.set(extractErrorMessage(err));
        // Stock ou numéros de série modifiés entre-temps : catalogue à jour
        this.fetchProducts(this.page()).subscribe();
      }
    });
  }

  printTicket(): void {
    this.ticketRef()?.print();
  }

  viewInvoice(): void {
    const done = this.done();
    if (done) {
      this.router.navigate([this.context.base() + '/invoices'], { queryParams: { open: done.invoice_id } });
    }
  }

  newSale(): void {
    this.done.set(null);
    this.doneInvoice.set(null);
    this.resetSale();
  }

  /** Garde de sortie : panier en cours non encaissé. */
  async confirmLeave(): Promise<boolean> {
    if (this.lines().length === 0 || this.done()) {
      return true;
    }
    return this.notification.confirm({
      title: 'Quitter la caisse ?',
      text: 'Le panier en cours n\'a pas été encaissé et sera perdu.',
      confirmText: 'Quitter',
      cancelText: 'Rester',
      danger: true
    });
  }

  private resetSale(): void {
    this.lines.set([]);
    this.discount = null;
    this.customerMode.set('anonymous');
    this.customer.set(null);
    this.customerSearch = '';
    this.customerResults.set([]);
    this.newCustomer = { name: '', phone: '' };
    this.paymentType = 'cash';
    this.cashGiven = null;
    this.resetPaidNow();
    this.submitError.set(null);
  }

  /** Fait défiler la liste jusqu'à la ligne et la met brièvement en évidence. */
  private reveal(key: string): void {
    this.fitCart();
    this.flashKey.set(key);
    if (this.flashTimer) {
      clearTimeout(this.flashTimer);
    }
    this.flashTimer = setTimeout(() => this.flashKey.set(null), 900);
    // Défilement de la liste seule (scrollIntoView ferait aussi bouger la page et le catalogue)
    setTimeout(() => {
      const root = this.host.nativeElement as HTMLElement;
      const list = root.querySelector<HTMLElement>('.cart__lines');
      const line = root.querySelector<HTMLElement>(`[data-line="${key}"]`);
      if (!list || !line) {
        return;
      }
      const top = line.offsetTop;
      const bottom = top + line.offsetHeight;
      if (top < list.scrollTop) {
        list.scrollTo({ top, behavior: 'smooth' });
      } else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTo({ top: bottom - list.clientHeight, behavior: 'smooth' });
      }
    });
  }

  private resetPaidNow(): void {
    this.paidNow = null;
    this.paidNowTouched = false;
  }

  private replace(line: CartLine, next: CartLine): void {
    this.lines.set(this.lines().map((l) => (l === line ? next : l)));
    this.resetPaidNow();
  }

  private fetchProducts(page: number) {
    const storeId = this.storeId();
    if (!storeId) {
      return of(null);
    }
    this.isLoading.set(true);
    this.loadError.set(null);
    return this.posService.products(storeId, { search: this.search, category_id: this.categoryId() }, page).pipe(
      catchError((err: HttpErrorResponse) => {
        this.loadError.set(extractErrorMessage(err));
        this.isLoading.set(false);
        return of(null);
      }),
      switchMap((res) => {
        if (res) {
          this.products.set(res.data);
          this.categories.set(res.categories);
          this.page.set(res.meta.current_page);
          this.lastPage.set(res.meta.last_page);
          this.usesMeasurements.set(res.uses_measurements);
          this.currency.set(res.currency);
          this.syncCartStock(res.data);
          this.isLoading.set(false);
        }
        return of(res);
      })
    );
  }

  /** Stock rafraîchi : les lignes du panier gardent la référence produit à jour. */
  private syncCartStock(products: PosProduct[]): void {
    const byId = new Map(products.map((p) => [p.id, p]));
    if (this.lines().some((l) => byId.has(l.product.id))) {
      this.lines.set(this.lines().map((l) => (byId.has(l.product.id) ? { ...l, product: byId.get(l.product.id)! } : l)));
    }
  }
}
