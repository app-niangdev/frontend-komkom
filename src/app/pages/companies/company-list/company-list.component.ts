import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CompanyService } from '../../../core/services/company.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Company } from '../../../core/models/company.model';
import { CompanyFormComponent } from '../company-form/company-form.component';
import { extractErrorMessage } from '../../../shared/utils/http-error.util';

const PER_PAGE = 12;

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CompanyFormComponent],
  templateUrl: './company-list.component.html',
  styleUrls: ['../../../../styles/_admin-crud.scss']
})
export class CompanyListComponent implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly companies = signal<Company[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);
  protected search = '';

  protected readonly isFormOpen = signal(false);
  /** Entreprise en cours de modification (null = création). */
  protected readonly editingCompany = signal<Company | null>(null);

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(page = 1): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.companyService.list(page, PER_PAGE, this.search.trim()).subscribe({
      next: (res) => {
        this.companies.set(res.data);
        this.currentPage.set(res.meta.current_page);
        this.lastPage.set(res.meta.last_page);
        this.total.set(res.meta.total);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Impossible de charger les entreprises.');
      }
    });
  }

  onSearch(): void {
    this.loadCompanies(1);
  }

  /** Couleur de marque de l'entreprise, pour l'initiale quand il n'y a pas de logo. */
  accent(company: Company): string {
    return company.primary_color || '#5b4fe5';
  }

  openCompany(company: Company): void {
    // L'id passe par history.state pour ne pas apparaître dans l'URL
    this.router.navigate(['/admin/companies/detail'], { state: { companyId: company.id } });
  }

  openCreateForm(): void {
    this.editingCompany.set(null);
    this.isFormOpen.set(true);
  }

  openEditForm(company: Company, event: Event): void {
    event.stopPropagation();
    this.editingCompany.set(company);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
  }

  onSaved(message: string): void {
    this.isFormOpen.set(false);
    this.notification.toast(message, 'success');
    this.loadCompanies(this.editingCompany() ? this.currentPage() : 1);
  }

  async askDelete(company: Company, event: Event): Promise<void> {
    event.stopPropagation();

    const confirmed = await this.notification.confirm({
      title: 'Supprimer cette entreprise ?',
      text: `« ${company.name} » et ses ${company.stores_count} boutique(s) seront supprimées, et tous ses utilisateurs seront désactivés.`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) {
      return;
    }

    this.companyService.delete(company.id).subscribe({
      next: (res) => {
        this.notification.toast(res.message, 'success');
        const page = this.companies().length === 1 ? Math.max(1, this.currentPage() - 1) : this.currentPage();
        this.loadCompanies(page);
      },
      error: (err: HttpErrorResponse) => this.notification.toast(extractErrorMessage(err), 'error')
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) {
      return;
    }
    this.loadCompanies(page);
  }
}
