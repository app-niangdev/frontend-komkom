import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QuoteService } from '../../../../core/owner/quote.service';
import { OwnerQuoteDetail, QUOTE_STATUS_LABELS } from '../../../../core/owner/quote.model';
import { StoreContextService } from '../../../../core/owner/store-context.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatMoney, formatNumber } from '../../../../shared/utils/format.util';
import { formatIsoDate } from '../../../../shared/utils/date.util';
import { extractErrorMessage } from '../../../../shared/utils/http-error.util';
import { saveBlob } from '../../../../shared/utils/download.util';

/**
 * Détail d'un devis et ses actions : PDF, WhatsApp, réponse du client, modification, copie.
 * Accepté ou refusé : contenu figé, mais le devis peut encore être envoyé et dupliqué.
 */
@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quote-detail.component.html',
  styleUrls: [
    '../../../../../styles/_admin-crud.scss',
    '../../owner-sales/owner-sale-detail/owner-sale-detail.component.scss',
    '../owner-quotes.component.scss',
    './quote-detail.component.scss'
  ]
})
export class QuoteDetailComponent implements OnInit {
  private readonly quoteService = inject(QuoteService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly context = inject(StoreContextService);

  readonly quoteId = input.required<number>();
  readonly closed = output<void>();
  /** Statut ou contenu modifié : la liste doit être rechargée. */
  readonly changed = output<void>();

  protected readonly statusLabels = QUOTE_STATUS_LABELS;
  protected readonly formatNumber = formatNumber;
  protected readonly formatIsoDate = formatIsoDate;

  protected readonly quote = signal<OwnerQuoteDetail | null>(null);
  protected readonly currency = signal('XOF');
  protected readonly loadError = signal<string | null>(null);
  /** Action en cours (désactive les boutons). */
  protected readonly busy = signal<string | null>(null);

  protected money = (value: number) => formatMoney(value, this.currency());

  ngOnInit(): void {
    this.load();
  }

  protected edit(): void {
    this.router.navigate([this.context.base() + '/quotes', this.quoteId(), 'edit']);
  }

  protected downloadPdf(): void {
    const q = this.quote();
    if (!q || this.busy()) {
      return;
    }
    this.busy.set('pdf');
    this.quoteService.pdf(q.id).subscribe({
      next: (blob) => {
        this.busy.set(null);
        saveBlob(blob, `Devis-${q.number}.pdf`);
      },
      error: () => {
        this.busy.set(null);
        this.notification.error('Téléchargement impossible', 'Le PDF du devis n\'a pas pu être généré.');
      }
    });
  }

  protected sendWhatsapp(): void {
    this.run('whatsapp', this.quoteService.sendWhatsapp(this.quoteId()));
  }

  protected async markSent(): Promise<void> {
    const ok = await this.notification.confirm({
      title: 'Marquer comme envoyé ?',
      text: 'À utiliser si vous avez transmis le devis autrement que par WhatsApp (en main propre, par e-mail...). Il reste modifiable.',
      confirmText: 'Marquer comme envoyé'
    });
    if (ok) {
      this.run('sent', this.quoteService.markSent(this.quoteId()));
    }
  }

  protected async decide(decision: 'accepted' | 'refused'): Promise<void> {
    const accepted = decision === 'accepted';
    const ok = await this.notification.confirm({
      title: accepted ? 'Le client accepte le devis ?' : 'Le client refuse le devis ?',
      text: 'Ce choix est définitif : le devis ne pourra plus être modifié, mais vous pourrez toujours l\'envoyer ou le dupliquer.',
      confirmText: accepted ? 'Oui, accepté' : 'Oui, refusé',
      danger: !accepted
    });
    if (ok) {
      this.run(decision, this.quoteService.decide(this.quoteId(), decision));
    }
  }

  protected async duplicate(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set('duplicate');
    this.quoteService.duplicate(this.quoteId()).subscribe({
      next: (res) => {
        this.busy.set(null);
        this.notification.toast(res.message, 'success');
        this.changed.emit();
        // La copie sert à faire une nouvelle version : on l'ouvre directement en modification
        this.router.navigate([this.context.base() + '/quotes', res.data.id, 'edit']);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.notification.error('Copie impossible', extractErrorMessage(err));
      }
    });
  }

  protected async remove(): Promise<void> {
    const q = this.quote();
    if (!q) {
      return;
    }
    const ok = await this.notification.confirm({
      title: `Supprimer le devis ${q.number} ?`,
      text: 'Le devis sera retiré de la liste.',
      confirmText: 'Supprimer',
      danger: true
    });
    if (!ok) {
      return;
    }
    this.busy.set('delete');
    this.quoteService.delete(q.id).subscribe({
      next: (res) => {
        this.busy.set(null);
        this.notification.toast(res.message, 'success');
        this.changed.emit();
        this.closed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.notification.error('Suppression impossible', extractErrorMessage(err));
      }
    });
  }

  private run(action: string, request: Observable<{ message: string }>): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(action);
    request.subscribe({
      next: (res) => {
        this.busy.set(null);
        this.notification.toast(res.message, 'success');
        this.changed.emit();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.notification.error('Action impossible', extractErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.quoteService.get(this.quoteId()).subscribe({
      next: (res) => {
        this.quote.set(res.data);
        this.currency.set(res.currency);
      },
      error: (err: HttpErrorResponse) => this.loadError.set(extractErrorMessage(err))
    });
  }
}
