import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell/shell.component';
import { AuthLayoutComponent } from './pages/auth/auth-layout/auth-layout.component';
import { adminGuard, authGuard, guestGuard, landingGuard, managerGuard, menuChildGuard, ownerGuard, sellerGuard } from './core/auth/auth.guard';

/** Saisie en cours (approvisionnement, panier de caisse) : confirmation avant de la perdre. */
const formLeaveGuard = (component: { confirmLeave(): Promise<boolean> }) => component.confirmLeave();


/**
 * Écrans de gestion d'une boutique, communs au propriétaire (/owner, toutes ses boutiques)
 * et au gérant (/manager, sa seule boutique).
 */
const storeSpaceRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/owner/owner-dashboard/owner-dashboard.component').then((m) => m.OwnerDashboardComponent),
    data: { title: 'page.dashboard' }
  },
  {
    path: 'sales',
    loadComponent: () =>
      import('./pages/owner/owner-sales/owner-sales.component').then((m) => m.OwnerSalesComponent),
    data: { title: 'page.sales' }
  },
  {
    path: 'sales/new',
    loadComponent: () => import('./pages/owner/owner-pos/owner-pos.component').then((m) => m.OwnerPosComponent),
    canDeactivate: [formLeaveGuard],
    data: { title: 'page.newSale' }
  },
  {
    path: 'invoices',
    loadComponent: () =>
      import('./pages/owner/owner-invoices/owner-invoices.component').then((m) => m.OwnerInvoicesComponent),
    data: { title: 'page.invoices' }
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/owner/owner-products/owner-products.component').then((m) => m.OwnerProductsComponent),
    data: { title: 'page.products' }
  },
  {
    path: 'payments',
    loadComponent: () => import('./pages/owner/owner-payments/owner-payments.component').then((m) => m.OwnerPaymentsComponent),
    data: { title: 'page.payments' }
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./pages/owner/owner-categories/owner-categories.component').then((m) => m.OwnerCategoriesComponent),
    data: { title: 'page.categories' }
  },
  {
    path: 'serials',
    loadComponent: () => import('./pages/owner/owner-serials/owner-serials.component').then((m) => m.OwnerSerialsComponent),
    data: { title: 'page.serials' }
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./pages/owner/owner-customers/owner-customers.component').then((m) => m.OwnerCustomersComponent),
    data: { title: 'page.customers' }
  },
  {
    path: 'expenses',
    loadComponent: () =>
      import('./pages/owner/owner-expenses/owner-expenses.component').then((m) => m.OwnerExpensesComponent),
    data: { title: 'page.expenses' }
  },
  {
    path: 'procurements',
    loadComponent: () =>
      import('./pages/owner/owner-procurements/owner-procurements.component').then((m) => m.OwnerProcurementsComponent),
    data: { title: 'page.procurements' }
  },
  {
    path: 'procurements/new',
    loadComponent: () =>
      import('./pages/owner/owner-procurements/procurement-form/procurement-form.component').then((m) => m.ProcurementFormComponent),
    canDeactivate: [formLeaveGuard],
    data: { title: 'page.newProcurement' }
  },
  {
    path: 'procurements/scan',
    loadComponent: () =>
      import('./pages/owner/owner-procurements/procurement-form/procurement-form.component').then((m) => m.ProcurementFormComponent),
    canDeactivate: [formLeaveGuard],
    data: { title: 'page.scanProcurement', scanner: true }
  },
  {
    path: 'procurements/:id/edit',
    loadComponent: () =>
      import('./pages/owner/owner-procurements/procurement-form/procurement-form.component').then((m) => m.ProcurementFormComponent),
    canDeactivate: [formLeaveGuard],
    data: { title: 'page.editProcurement' }
  },
  {
    path: 'suppliers',
    loadComponent: () =>
      import('./pages/owner/owner-suppliers/owner-suppliers.component').then((m) => m.OwnerSuppliersComponent),
    data: { title: 'page.suppliers' }
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/owner/owner-team/owner-team.component').then((m) => m.OwnerTeamComponent),
    data: { title: 'page.team' }
  }
];

/**
 * Espace vendeur (/seller) : les mêmes écrans, limités à ses ventes, ses factures et ses
 * encaissements ; catalogue et catégories en consultation (voir StoreContextService.isSeller).
 */
const SELLER_PATHS = ['', 'dashboard', 'sales', 'sales/new', 'invoices', 'payments', 'products', 'categories', 'customers'];
const sellerRoutes: Routes = storeSpaceRoutes.filter((r) => SELLER_PATHS.includes(r.path ?? ''));

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./pages/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent
          )
      },
      {
        path: 'verify-otp',
        loadComponent: () =>
          import('./pages/auth/otp-verification/otp-verification.component').then(
            (m) => m.OtpVerificationComponent
          )
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./pages/auth/reset-password/reset-password.component').then(
            (m) => m.ResetPasswordComponent
          )
      }
    ]
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [menuChildGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        canActivate: [landingGuard],
        data: { title: 'page.dashboard' }
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./pages/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
            data: { title: 'page.stats' }
          },
          {
            path: 'companies',
            loadComponent: () =>
              import('./pages/companies/company-list/company-list.component').then(
                (m) => m.CompanyListComponent
              ),
            data: { title: 'page.companies' }
          },
          {
            path: 'companies/detail',
            loadComponent: () =>
              import('./pages/companies/company-detail/company-detail.component').then(
                (m) => m.CompanyDetailComponent
              ),
            data: { title: 'page.company' }
          },
          {
            path: 'subscriptions',
            loadComponent: () =>
              import('./pages/admin-subscriptions/admin-subscriptions.component').then(
                (m) => m.AdminSubscriptionsComponent
              ),
            data: { title: 'page.subscriptions' }
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./pages/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
            data: { title: 'page.users' }
          }
        ]
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
        data: { title: 'page.profile' }
      },
      {
        path: 'owner',
        canActivate: [ownerGuard],
        children: [
          ...storeSpaceRoutes,
          {
            path: 'stores',
            loadComponent: () =>
              import('./pages/owner/owner-stores/owner-stores.component').then((m) => m.OwnerStoresComponent),
            data: { title: 'page.stores' }
          },
          {
            path: 'company',
            loadComponent: () =>
              import('./pages/owner/owner-company/owner-company.component').then((m) => m.OwnerCompanyComponent),
            data: { title: 'page.myCompany' }
          }
        ]
      },
      {
        path: 'manager',
        canActivate: [managerGuard],
        children: storeSpaceRoutes
      },
      {
        path: 'seller',
        canActivate: [sellerGuard],
        children: sellerRoutes
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
