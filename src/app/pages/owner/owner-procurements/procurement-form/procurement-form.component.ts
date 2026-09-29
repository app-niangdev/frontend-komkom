import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, finalize, of, switchMap, tap } from 'rxjs';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { OwnerSupplier, SerialConflict, SupplyPayload, SupplyProduct } from '../../../../core/owner/owner.model';
import { BarcodeScannerService } from '../../../../core/services/barcode-scanner.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { SupplierFormComponent } from '../../owner-suppliers/supplier-form/supplier-form.component';

interface FormLine {
  product: SupplyProduct;
  /** Ignorée pour un produit à numéro de série : la quantité est le nombre de n° saisis. */
  quantity: number | null;
  purchase_price: number | null;
  serials: string[];
  serialDraft: string;
  serialError: string | null;
  /** Mode scanner : nombre de n° de série annoncé (bon de livraison) ; null = non contrôlé. */
  expected: number | null;
}

interface ScanFeedback {
  ok: boolean;
  text: string;
}

/** Séparateurs acceptés quand on colle une liste de numéros de série. */
const SERIAL_SEPARATORS = /[\n\r,;\t]+/;

const SERIAL_STATUS: Record<SerialConflict['status'], string> = {
  in_stock: 'en stock',
  sold: 'vendu',
  pending: 'livraison en attente'
};

/**
 * Saisie / modification d'un approvisionnement : boutique, fournisseur, produits livrés
 * (avec numéros de série scannés ou collés), puis enregistrement en attente ou réception immédiate.
 *
 * Mode scanner (route `procurements/scan`, ou bouton « Mode scanner ») : un lecteur code-barres
 * remplit les n° de série de la ligne active depuis n'importe où sur la page, avec quantité
 * attendue par produit, passage automatique à la ligne suivante et contrôle immédiat des doublons.
 */
@Component({
  selector: 'app-procurement-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SupplierFormComponent],
  templateUrl: './procurement-form.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './procurement-form.component.scss']
})
export class ProcurementFormComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  private readonly notification = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scanner = inject(BarcodeScannerService);
  protected readonly context = inject(StoreContextService);

  protected readonly formatNumber = formatNumber;
  protected money = (value: number) => formatMoney(value, 'XOF');

  protected supplyId: number | null = null;
  protected readonly orderNumber = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isReady = signal(false);

  protected storeId: number | null = null;
  protected supplierId: number | null = null;
  protected lines: FormLine[] = [];
  protected readonly usesMeasurements = signal(true);

  protected readonly suppliers = signal<OwnerSupplier[]>([]);
  protected readonly restock = signal<SupplyProduct[]>([]);
  protected readonly showSupplierForm = signal(false);

  protected productSearch = '';
  private readonly search$ = new Subject<string>();
  protected readonly results = signal<SupplyProduct[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchOpen = signal(false);
  protected activeResult = 0;
  /** Ligne mise en évidence après un ajout (produit déjà présent, par ex.). */
  protected readonly highlight = signal<number | null>(null);

  protected readonly scannerMode = signal(this.route.snapshot.data['scanner'] === true);
  /** Ligne qui reçoit les scans (id produit). */
  protected readonly activeScanId = signal<number | null>(null);
  protected scanDraft = '';
  protected readonly lastScan = signal<ScanFeedback | null>(null);
  protected soundOn = this.scanner.soundEnabled;
  /** Contrôles serveur des n° de série en cours. */
  protected readonly verifying = signal(0);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private dirty = false;
  private saved = false;
  /** Pré-sélection depuis la fiche fournisseur : ?store=ID&supplier=ID */
  private readonly presetStoreId = Number(this.route.snapshot.queryParamMap.get('store')) || null;
  private presetSupplierId = Number(this.route.snapshot.queryParamMap.get('supplier')) || null;

  /** Boutiques où l'on peut saisir : abonnement en cours. */
  protected readonly stores = computed(() =>
    this.context.stores().filter((s) => s.subscription.state !== 'expired' && s.subscription.state !== 'none')
  );

  constructor() {
    // Nouvelle saisie : boutique du sélecteur, ou la seule boutique disponible
    // (attend le chargement des boutiques en cas d'accès direct à la page)
    effect(() => {
      if (!this.context.loaded() || this.route.snapshot.paramMap.get('id')) {
        return;
      }
      untracked(() => {
        if (this.isReady()) {
          return;
        }
        const stores = this.stores();
        const selected = stores.some((s) => s.id === this.presetStoreId) ? this.presetStoreId : this.context.selectedId();
        const initial = stores.some((s) => s.id === selected) ? selected : stores.length === 1 ? stores[0].id : null;
        if (initial) {
          this.applyStore(initial);
        }
        this.isReady.set(true);
      });
    }, { allowSignalWrites: true });
  }

  get isEdit(): boolean {
    return this.supplyId !== null;
  }

  get storeName(): string {
    return this.context.stores().find((s) => s.id === this.storeId)?.name ?? '';
  }

  /** Le mode scanner ne sert qu'aux numéros de série : proposé seulement si la boutique en utilise. */
  get storeUsesSerials(): boolean {
    const store = this.context.stores().find((s) => s.id === this.storeId);
    return store ? store.uses_serial_numbers : this.context.usesSerials();
  }

  get supplier(): OwnerSupplier | null {
    return this.suppliers().find((s) => s.id === this.supplierId) ?? null;
  }

  /** Produits en rupture / stock faible pas encore dans la liste. */
  get restockToAdd(): SupplyProduct[] {
    return this.restock().filter((p) => !this.lines.some((l) => l.product.id === p.id));
  }

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(250),
        tap(() => this.searching.set(true)),
        switchMap((term) =>
          this.storeId
            ? this.ownerService.supplyProducts(this.storeId, { search: term }).pipe(catchError(() => of({ data: [], uses_measurements: true })))
            : of({ data: [], uses_measurements: true })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.results.set(res.data);
        this.activeResult = 0;
        this.searching.set(false);
      });

    this.scanner.scan$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((code) => this.applyScan(code));
    this.destroyRef.onDestroy(() => this.scanner.disable());
    if (this.scannerMode()) {
      this.scanner.enable();
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.supplyId = id;
      this.loadSupply(id);
    }
  }

  // --- Boutique & fournisseur ------------------------------------------------------

  async changeStore(storeId: number | null): Promise<void> {
    const previous = this.storeId;
    if (storeId === previous) {
      return;
    }
    if (this.lines.length > 0) {
      const ok = await this.notification.confirm({
        title: 'Changer de boutique ?',
        text: 'Les produits et le fournisseur dépendent de la boutique : la liste saisie sera vidée.',
        confirmText: 'Changer',
        cancelText: 'Garder'
      });
      if (!ok) {
        // Le <select> a déjà changé : on le remet sur l'ancienne valeur
        this.storeId = null;
        setTimeout(() => (this.storeId = previous));
        return;
      }
    }
    this.lines = [];
    this.applyStore(storeId);
  }

  private applyStore(storeId: number | null): void {
    this.storeId = storeId;
    this.supplierId = null;
    this.activeScanId.set(null);
    this.lastScan.set(null);
    this.suppliers.set([]);
    this.restock.set([]);
    this.results.set([]);
    this.productSearch = '';
    if (!storeId) {
      return;
    }
    if (this.scannerMode() && !this.storeUsesSerials) {
      this.toggleScannerMode();
    }
    this.loadSuppliers();
    this.ownerService.supplyProducts(storeId, { restock: true }).subscribe({
      next: (res) => {
        this.restock.set(res.data);
        this.usesMeasurements.set(res.uses_measurements);
      }
    });
  }

  private loadSuppliers(): void {
    if (!this.storeId) {
      return;
    }
    this.ownerService.suppliers(this.storeId).subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers);
        if (this.presetSupplierId && suppliers.some((s) => s.id === this.presetSupplierId)) {
          this.supplierId = this.presetSupplierId;
          this.presetSupplierId = null;
        } else if (!this.supplierId && suppliers.length === 1) {
          this.supplierId = suppliers[0].id;
        }
      }
    });
  }

  onSupplierCreated(event: { supplier: OwnerSupplier; message: string }): void {
    this.showSupplierForm.set(false);
    this.notification.toast(event.message, 'success');
    this.suppliers.set([...this.suppliers(), event.supplier].sort((a, b) => a.name.localeCompare(b.name)));
    this.supplierId = event.supplier.id;
    this.markDirty();
  }

  // --- Recherche et ajout de produits -------------------------------------------------

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

  isInLines(productId: number): boolean {
    return this.lines.some((l) => l.product.id === productId);
  }

  addProduct(product: SupplyProduct, quantity?: number): void {
    const existing = this.lines.find((l) => l.product.id === product.id);
    if (existing) {
      this.flash(product.id);
      this.focusLine(product);
    } else {
      this.lines = [
        ...this.lines,
        {
          product,
          quantity: product.require_serial_number ? null : quantity ?? 1,
          purchase_price: product.last_purchase_price,
          serials: [],
          serialDraft: '',
          serialError: null,
          expected: null
        }
      ];
      this.markDirty();
      if (product.require_serial_number && this.scannerMode()) {
        this.activeScanId.set(product.id);
      }
      this.flash(product.id);
      this.focusLine(product);
    }
    this.productSearch = '';
    this.searchOpen.set(false);
    this.search$.next('');
  }

  /** Ajoute les produits en rupture / sous le seuil, avec une quantité suggérée (2 × seuil d'alerte). */
  addRestock(): void {
    const toAdd = this.restockToAdd;
    toAdd.forEach((p) => this.addProduct(p, Math.max(1, Math.ceil(p.alert_threshold * 2 - Math.max(0, p.quantity)))));
    this.notification.toast(`${toAdd.length} produit(s) à réapprovisionner ajouté(s) : ajustez les quantités.`, 'info');
  }

  removeLine(line: FormLine): void {
    this.lines = this.lines.filter((l) => l !== line);
    if (this.activeScanId() === line.product.id) {
      this.activeScanId.set(this.nextScanLine()?.product.id ?? null);
    }
    this.markDirty();
  }

  // --- Numéros de série (scanner = saisie + Entrée) -----------------------------------

  onSerialKeydown(event: KeyboardEvent, line: FormLine): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addSerials(line, line.serialDraft);
    }
  }

  /** Coller une liste (une par ligne, ou séparée par virgules) ajoute tous les numéros d'un coup. */
  onSerialPaste(event: ClipboardEvent, line: FormLine): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (SERIAL_SEPARATORS.test(text.trim())) {
      event.preventDefault();
      this.addSerials(line, text);
    }
  }

  /**
   * Ajoute des n° à une ligne : refuse ceux déjà saisis (sur n'importe quelle ligne : un IMEI
   * identifie un seul appareil) et ceux au-delà de la quantité attendue, puis vérifie les
   * autres côté serveur. Renvoie le nombre de n° ajoutés.
   */
  addSerials(line: FormLine, raw: string): number {
    const incoming = raw.split(SERIAL_SEPARATORS).map((s) => s.trim()).filter(Boolean);
    const duplicates: string[] = [];
    const added: string[] = [];
    let overflow = 0;
    for (const serial of incoming) {
      const holder = this.lineHolding(serial);
      if (holder) {
        duplicates.push(holder === line ? serial : `${serial} (${holder.product.name})`);
      } else if (this.isComplete(line)) {
        overflow++;
      } else {
        line.serials = [...line.serials, serial];
        added.push(serial);
      }
    }
    line.serialDraft = '';
    const errors: string[] = [];
    if (duplicates.length) {
      errors.push(`Déjà saisi : ${duplicates.join(', ')}`);
    }
    if (overflow) {
      errors.push(`${overflow} n° ignoré(s) : les ${line.expected} attendus sont déjà scannés.`);
    }
    line.serialError = errors.length ? errors.join(' · ') : null;
    if (added.length) {
      this.markDirty();
      this.verifySerials(line, added);
    }
    return added.length;
  }

  /** Ligne qui contient déjà ce n° (casse ignorée). */
  private lineHolding(serial: string): FormLine | undefined {
    const needle = serial.toLowerCase();
    return this.lines.find((l) => l.serials.some((s) => s.toLowerCase() === needle));
  }

  /** Contrôle immédiat : retire les n° déjà enregistrés dans la boutique (stock, ventes, autres livraisons). */
  private verifySerials(line: FormLine, serials: string[]): void {
    if (!this.storeId) {
      return;
    }
    this.verifying.update((n) => n + 1);
    this.ownerService
      .checkSupplySerials(this.storeId, serials, this.supplyId)
      .pipe(finalize(() => this.verifying.update((n) => n - 1)))
      .subscribe({
        next: ({ data }) => {
          if (data.length === 0 || !this.lines.includes(line)) {
            return;
          }
          const taken = new Set(data.map((c) => c.serial_number.toLowerCase()));
          line.serials = line.serials.filter((s) => !taken.has(s.toLowerCase()));
          const detail = data
            .map((c) => `${c.serial_number} (${c.product ?? 'produit supprimé'}, ${SERIAL_STATUS[c.status]}${c.order_number ? ' ' + c.order_number : ''})`)
            .join(', ');
          line.serialError = `Déjà enregistré dans la boutique, retiré : ${detail}`;
          if (this.scannerMode()) {
            this.feedback(false, `${data.length > 1 ? data.length + ' n° déjà enregistrés' : data[0].serial_number + ' déjà enregistré'} — retiré de « ${line.product.name} »`);
            if (!this.activeScanId()) {
              this.activeScanId.set(line.product.id);
            }
          }
        },
        // Contrôle indisponible : le serveur refusera les doublons à l'enregistrement
        error: () => undefined
      });
  }

  removeSerial(line: FormLine, serial: string): void {
    line.serials = line.serials.filter((s) => s !== serial);
    line.serialError = null;
    this.markDirty();
  }

  clearSerials(line: FormLine): void {
    line.serials = [];
    line.serialError = null;
    this.markDirty();
  }

  // --- Mode scanner -------------------------------------------------------------------

  toggleScannerMode(): void {
    const on = !this.scannerMode();
    this.scannerMode.set(on);
    this.lastScan.set(null);
    if (on) {
      this.scanner.enable();
      this.activeScanId.set(this.nextScanLine()?.product.id ?? null);
      this.focusScanInput();
    } else {
      this.scanner.disable();
      this.activeScanId.set(null);
    }
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.scanner.soundEnabled = this.soundOn;
  }

  get serialLines(): FormLine[] {
    return this.lines.filter((l) => l.product.require_serial_number);
  }

  get activeScanLine(): FormLine | null {
    return this.serialLines.find((l) => l.product.id === this.activeScanId()) ?? null;
  }

  get scannedCount(): number {
    return this.serialLines.reduce((sum, l) => sum + l.serials.length, 0);
  }

  /** Total attendu, seulement si chaque ligne à n° de série a sa quantité attendue. */
  get expectedCount(): number | null {
    const lines = this.serialLines;
    return lines.length && lines.every((l) => l.expected) ? lines.reduce((sum, l) => sum + (l.expected ?? 0), 0) : null;
  }

  isComplete(line: FormLine): boolean {
    return line.expected !== null && line.expected > 0 && line.serials.length >= line.expected;
  }

  /** Avancement d'une ligne en % (quantité attendue renseignée). */
  progress(line: FormLine): number {
    return line.expected ? Math.min(100, Math.round((line.serials.length / line.expected) * 100)) : 0;
  }

  setActiveScanLine(productId: number | null): void {
    this.activeScanId.set(productId);
    this.focusScanInput();
  }

  onScanKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.scanner.emit(this.scanDraft);
      this.scanDraft = '';
    }
  }

  /** Coller une liste dans le poste de scan : tout va sur la ligne active. */
  onScanPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (SERIAL_SEPARATORS.test(text.trim())) {
      event.preventDefault();
      this.applyScan(text);
    }
  }

  /** Entrée dans « Attendu » : retour au poste de scan. */
  onExpectedKeydown(event: KeyboardEvent, line: FormLine): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.setActiveScanLine(line.product.id);
    }
  }

  onExpectedChange(line: FormLine, value: number | null): void {
    const expected = value === null || (value as unknown) === '' ? null : Math.max(0, Math.trunc(Number(value)));
    line.expected = expected || null;
    this.markDirty();
  }

  /** Un code lu par le lecteur (partout sur la page ou dans le poste de scan). */
  applyScan(code: string): void {
    if (!this.scannerMode()) {
      return;
    }
    const target = this.scanTarget();
    if (!target) {
      this.feedback(
        false,
        this.serialLines.length === 0
          ? 'Ajoutez d\'abord un produit suivi par n° de série (IMEI) pour scanner.'
          : 'Toutes les quantités attendues sont atteintes : augmentez « Attendu » ou ajoutez un produit.'
      );
      this.focusScanInput();
      return;
    }

    const added = this.addSerials(target, code);
    if (added === 0) {
      this.feedback(false, target.serialError ?? 'Numéro non ajouté.');
    } else {
      const count = target.expected ? `${target.serials.length}/${target.expected}` : `${target.serials.length}`;
      const label = added > 1 ? `${added} n° ajoutés` : `${code.trim()} ajouté`;
      this.feedback(true, `${label} — ${target.product.name} (${count})`);
      this.flash(target.product.id);
      if (this.isComplete(target)) {
        const next = this.nextScanLine(target);
        this.activeScanId.set(next?.product.id ?? target.product.id);
        if (next) {
          this.notification.toast(`« ${target.product.name} » complet. Suite : « ${next.product.name} ».`, 'success');
        }
      }
    }
    this.focusScanInput();
  }

  /** Ligne active si elle peut encore recevoir, sinon la première ligne incomplète. */
  private scanTarget(): FormLine | null {
    const active = this.activeScanLine;
    if (active && !this.isComplete(active)) {
      return active;
    }
    const next = this.nextScanLine(active ?? undefined);
    if (next) {
      this.activeScanId.set(next.product.id);
    }
    return next;
  }

  /** Prochaine ligne à n° de série incomplète, en partant de `after` (et en bouclant). */
  private nextScanLine(after?: FormLine): FormLine | null {
    const lines = this.serialLines;
    const start = after ? lines.indexOf(after) + 1 : 0;
    const ordered = [...lines.slice(start), ...lines.slice(0, start)];
    return ordered.find((l) => l !== after && !this.isComplete(l)) ?? null;
  }

  private feedback(ok: boolean, text: string): void {
    this.lastScan.set({ ok, text });
    this.scanner.beep(ok);
  }

  /** Tout de suite si le champ existe (scan qui suit aussitôt), sinon après le rendu. */
  private focusScanInput(): void {
    const input = document.getElementById('scan-station') as HTMLInputElement | null;
    if (input && !input.disabled) {
      input.focus();
    } else {
      setTimeout(() => document.getElementById('scan-station')?.focus());
    }
  }

  // --- Calculs ------------------------------------------------------------------------

  quantityOf(line: FormLine): number {
    return line.product.require_serial_number ? line.serials.length : Number(line.quantity) || 0;
  }

  lineTotal(line: FormLine): number {
    return Math.round(this.quantityOf(line) * (Number(line.purchase_price) || 0));
  }

  get total(): number {
    return this.lines.reduce((sum, l) => sum + this.lineTotal(l), 0);
  }

  get unitsCount(): number {
    return this.lines.reduce((sum, l) => sum + this.quantityOf(l), 0);
  }

  integerOnly(line: FormLine): boolean {
    return line.product.require_serial_number || !this.usesMeasurements();
  }

  lineIssue(line: FormLine): string | null {
    const qty = this.quantityOf(line);
    if (line.product.require_serial_number && qty === 0) {
      return 'Scannez ou saisissez au moins un numéro de série.';
    }
    if (line.product.require_serial_number && this.scannerMode() && line.expected && qty !== line.expected) {
      return qty < line.expected
        ? `${qty} n° scanné(s) sur ${line.expected} attendu(s) : il en manque ${line.expected - qty}.`
        : `${qty} n° scanné(s) pour ${line.expected} attendu(s) : retirez-en ${qty - line.expected} ou corrigez « Attendu ».`;
    }
    if (qty <= 0) {
      return 'Quantité à renseigner.';
    }
    if (this.integerOnly(line) && !Number.isInteger(qty)) {
      return 'La quantité doit être un nombre entier.';
    }
    if (line.purchase_price === null || line.purchase_price === undefined || (line.purchase_price as unknown) === '' || Number(line.purchase_price) < 0) {
      return 'Prix d\'achat à renseigner.';
    }
    return null;
  }

  /** Ce qui empêche l'enregistrement, affiché dans le récapitulatif. */
  get issues(): string[] {
    const issues: string[] = [];
    if (!this.storeId) {
      issues.push('Choisissez la boutique livrée.');
    }
    if (!this.supplierId) {
      issues.push('Choisissez le fournisseur.');
    }
    if (this.lines.length === 0) {
      issues.push('Ajoutez au moins un produit.');
    }
    const invalid = this.lines.filter((l) => this.lineIssue(l)).length;
    if (invalid > 0) {
      issues.push(`${invalid} ligne(s) incomplète(s).`);
    }
    if (this.verifying() > 0) {
      issues.push('Vérification des numéros de série en cours...');
    }
    return issues;
  }

  priceDiffers(line: FormLine): boolean {
    const last = line.product.last_purchase_price;
    return last !== null && line.purchase_price !== null && Number(line.purchase_price) !== last;
  }

  // --- Enregistrement -----------------------------------------------------------------

  async submit(receive: boolean): Promise<void> {
    if (this.isSubmitting() || this.issues.length > 0 || !this.storeId || !this.supplierId) {
      return;
    }
    if (receive) {
      const ok = await this.notification.confirm({
        title: 'Réceptionner maintenant ?',
        text: `${formatNumber(this.unitsCount)} unité(s) entreront en stock dans « ${this.storeName} » (${this.money(this.total)}). Vérifiez la marchandise livrée avant de confirmer.`,
        confirmText: 'Enregistrer et réceptionner',
        cancelText: 'Revenir'
      });
      if (!ok) {
        return;
      }
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const payload: SupplyPayload = {
      supplier_id: this.supplierId,
      receive,
      line_items: this.lines.map((l) => ({
        product_id: l.product.id,
        quantity: this.quantityOf(l),
        purchase_price: Math.round(Number(l.purchase_price)),
        ...(l.product.require_serial_number ? { serial_numbers: l.serials } : {})
      }))
    };
    const request = this.supplyId
      ? this.ownerService.updateSupply(this.supplyId, payload)
      : this.ownerService.createSupply({ ...payload, store_id: this.storeId });

    request.subscribe({
      next: (res) => {
        this.saved = true;
        this.notification.toast(res.message, 'success');
        this.router.navigate([this.context.base() + '/procurements'], { queryParams: { open: res.data.id } });
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
      text: 'La saisie en cours de cet approvisionnement sera perdue.',
      confirmText: 'Quitter',
      cancelText: 'Rester',
      danger: true
    });
  }

  markDirty(): void {
    this.dirty = true;
  }

  // --- Chargement (modification) ------------------------------------------------------

  private loadSupply(id: number): void {
    this.ownerService.supply(id).subscribe({
      next: ({ data }) => {
        if (data.status !== 'pending') {
          this.loadError.set(`L'approvisionnement ${data.order_number} est ${data.status === 'received' ? 'déjà réceptionné' : 'annulé'} : il ne peut plus être modifié.`);
          return;
        }
        this.orderNumber.set(data.order_number);
        this.applyStore(data.store?.id ?? null);
        this.usesMeasurements.set(data.uses_measurements);
        this.supplierId = data.supplier?.id ?? null;
        this.lines = data.lines.map((l) => ({
          product: {
            id: l.product_id,
            name: l.product,
            unit: l.unit ?? '',
            quantity: l.current_stock ?? 0,
            alert_threshold: 0,
            stock_state: 'ok',
            require_serial_number: l.require_serial_number,
            last_purchase_price: null
          },
          quantity: l.require_serial_number ? null : l.quantity,
          purchase_price: l.purchase_price,
          serials: [...l.serial_numbers],
          serialDraft: '',
          serialError: null,
          expected: null
        }));
        if (this.scannerMode()) {
          this.activeScanId.set(this.nextScanLine()?.product.id ?? null);
        }
        this.isReady.set(true);
      },
      error: (err: HttpErrorResponse) => this.loadError.set(extractErrorMessage(err))
    });
  }

  private flash(productId: number): void {
    this.highlight.set(productId);
    setTimeout(() => this.highlight() === productId && this.highlight.set(null), 1600);
  }

  private focusLine(product: SupplyProduct): void {
    if (product.require_serial_number && this.scannerMode()) {
      this.focusScanInput();
      return;
    }
    const target = product.require_serial_number ? `serial-${product.id}` : `qty-${product.id}`;
    setTimeout(() => {
      const el = document.getElementById(target) as HTMLInputElement | null;
      el?.focus();
      el?.select?.();
    });
  }
}
