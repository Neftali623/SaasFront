import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { DemoLoginPage } from '../features/auth/DemoLoginPage'
import { CashPage } from '../features/cash/pages/CashPage'
import { DashboardSummaryPage } from '../features/dashboard/DashboardSummaryPage'
import { NotFoundPage } from '../features/dashboard/NotFoundPage'
import { PendingModulePage } from '../features/dashboard/PendingModulePage'
import { ExpensesPage } from '../features/expenses/pages/ExpensesPage'
import { InventoryPage } from '../features/inventory/pages/InventoryPage'
import { OrganizationSelectPage } from '../features/organizations/OrganizationSelectPage'
import { PosPage } from '../features/pos/pages/PosPage'
import { SalesHistoryPage } from '../features/pos/pages/SalesHistoryPage'
import { ProductsCatalogPage } from '../features/products/pages/ProductsCatalogPage'
import { ReportsPage } from '../features/reports/pages/ReportsPage'
import { OrganizationSettingsPage } from '../features/settings/OrganizationSettingsPage'
import { APP_ROUTES, PANEL_NAV_ITEMS } from './navigation'

const pendingNavItems = PANEL_NAV_ITEMS.filter(
  (item) => item.status === 'pending',
)

export function AppRouter() {
  return (
    <Routes>
      <Route path={APP_ROUTES.root} element={<Navigate to={APP_ROUTES.login} replace />} />
      <Route path={APP_ROUTES.login} element={<DemoLoginPage />} />
      <Route path={APP_ROUTES.organizations} element={<OrganizationSelectPage />} />

      <Route path={APP_ROUTES.panelRoot} element={<AppLayout />}>
        <Route index element={<Navigate to={APP_ROUTES.summary} replace />} />
        <Route path={APP_ROUTES.summary} element={<DashboardSummaryPage />} />
        <Route path={APP_ROUTES.pos} element={<PosPage />} />
        <Route path={APP_ROUTES.sales} element={<SalesHistoryPage />} />
        <Route path={APP_ROUTES.products} element={<ProductsCatalogPage />} />
        <Route path={APP_ROUTES.inventory} element={<InventoryPage />} />
        <Route path={APP_ROUTES.cash} element={<CashPage />} />
        <Route path={APP_ROUTES.expenses} element={<ExpensesPage />} />
        <Route path={APP_ROUTES.reports} element={<ReportsPage />} />
        <Route path={APP_ROUTES.settings} element={<OrganizationSettingsPage />} />
        {pendingNavItems.map((item) => (
          <Route
            key={item.id}
            path={item.path}
            element={<PendingModulePage />}
          />
        ))}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
