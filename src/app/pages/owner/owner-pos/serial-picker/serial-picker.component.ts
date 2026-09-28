import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PosService } from '../../../../core/owner/pos.service';
import { PosProduct } from '../../../../core/owner/pos.model';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';

/** Choix des numéros de série vendus : cases à cocher, ou saisie / douchette + Entrée. */
@Component({
  selector: 'app-serial-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './serial-picker.component.html',
  styleUrls: ['../../../../../styles/_admin-crud.scss', './serial-picker.component.scss']
})
export class SerialPickerComponent implements OnInit {
  private readonly posService = inject(PosService);

  readonly storeId = input.required<number>();
  readonly product = input.required<PosProduct>();
  readonly initial = input<string[]>([]);
  /** Liste finale (vide = retirer le produit du panier). */
  readonly picked = output<string[]>();
  readonly closed = output<void>();

  protected readonly available = signal<string[]>([]);
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);
  protected filter = '';

  ngOnInit(): void {
    this.selected.set(new Set(this.initial()));
    this.posService.serials(this.storeId(), this.product().id).subscribe({
      next: (serials) => {
        this.available.set(serials);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(extractErrorMessage(err));
        this.isLoading.set(false);
      }
    });
  }

  filtered(): string[] {
    const term = this.filter.trim().toLowerCase();
    return term ? this.available().filter((s) => s.toLowerCase().includes(term)) : this.available();
  }

  toggle(serial: string): void {
    const next = new Set(this.selected());
    if (next.has(serial)) {
      next.delete(serial);
    } else {
      next.add(serial);
    }
    this.selected.set(next);
  }

  /** Numéro scanné : coché s'il est disponible, sinon signalé. */
  onEnter(): void {
    const serial = this.filter.trim();
    if (!serial) {
      return;
    }
    const match = this.available().find((s) => s.toLowerCase() === serial.toLowerCase());
    if (!match) {
      this.scanError.set(`« ${serial} » n'est pas disponible à la vente pour ce produit.`);
      return;
    }
    this.scanError.set(null);
    if (!this.selected().has(match)) {
      this.toggle(match);
    }
    this.filter = '';
  }

  confirm(): void {
    // Ordre d'affichage conservé
    this.picked.emit(this.available().filter((s) => this.selected().has(s)));
  }
}
