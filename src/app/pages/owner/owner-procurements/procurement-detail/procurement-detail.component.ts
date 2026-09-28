import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnerService } from '../../../../core/owner/owner.service';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { OwnerSupplyDetail } from '../../../../core/owner/owner.model';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { SUPPLY_STATUS_LABELS } from '../../owner-labels.util';
import { SupplyActionsService } from '../supply-actions.service';

/** Détail d'un approvisionnement : fournisseur, lignes, numéros de série, suivi, actions. */
@Component({
  selector: 'app-procurement-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './procurement-detail.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './procurement-detail.component.scss']
})
export class ProcurementDetailComponent implements OnInit {
  private readonly ownerService = inject(OwnerService);
  protected readonly context = inject(StoreContextService);
  private readonly actions = inject(SupplyActionsService);

  readonly supplyId = input.required<number>();
  readonly closed = output<void>();
  /** L'approvisionnement a changé de statut : la liste doit se recharger. */
  readonly changed = output<void>();

  protected readonly statusLabels = SUPPLY_STATUS_LABELS;
  protected readonly formatNumber = formatNumber;

  protected readonly supply = signal<OwnerSupplyDetail | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** Lignes dont la liste des numéros de série est dépliée. */
  protected readonly openSerials = signal<Set<number>>(new Set());

  protected readonly unitsCount = computed(() => (this.supply()?.lines ?? []).reduce((sum, l) => sum + l.quantity, 0));

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.load();
  }

  toggleSerials(lineId: number): void {
    const next = new Set(this.openSerials());
    next.has(lineId) ? next.delete(lineId) : next.add(lineId);
    this.openSerials.set(next);
  }

  async receive(): Promise<void> {
    const s = this.supply();
    if (!s || this.busy()) {
      return;
    }
    this.busy.set(true);
    if (await this.actions.receive(s, this.currency())) {
      this.changed.emit();
      this.load();
    }
    this.busy.set(false);
  }

  async cancel(): Promise<void> {
    const s = this.supply();
    if (!s || this.busy()) {
      return;
    }
    this.busy.set(true);
    if (await this.actions.cancel(s)) {
      this.changed.emit();
      this.load();
    }
    this.busy.set(false);
  }

  /** Impression du bon : seule la modale est imprimée (cf. body.is-printing-supply). */
  print(): void {
    document.body.classList.add('is-printing-supply');
    window.addEventListener('afterprint', () => document.body.classList.remove('is-printing-supply'), { once: true });
    window.print();
  }

  private load(): void {
    this.ownerService.supply(this.supplyId()).subscribe({
      next: (res) => {
        this.supply.set(res.data);
        this.currency.set(res.currency);
      },
      error: (err: HttpErrorResponse) => this.errorMessage.set(extractErrorMessage(err))
    });
  }
}
