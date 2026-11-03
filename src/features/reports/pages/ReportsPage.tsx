import { useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { defaultCashRepository } from '../../cash/services/cashRepository'
import { defaultExpensesRepository } from '../../expenses/services/expensesRepository'
import { getBranchForOrganization } from '../../inventory/utils/mockInventory'
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import { defaultPosSalesCoordinator } from '../../pos/services/posSalesCoordinator'
import { CashReportView } from '../components/CashReportView'
import { ExpensesReportView } from '../components/ExpensesReportView'
import { ProductsSoldReportView } from '../components/ProductsSoldReportView'
import { SalesReportView } from '../components/SalesReportView'
import {
  calculateCashReport,
  calculateExpensesReport,
  calculateProductsSoldReport,
  calculateSalesReport,
} from '../services/reportsCalculator'
import type { ReportFilterParams, ReportPeriod } from '../types'

type ActiveReportTab = 'sales' | 'products' | 'expenses' | 'cash'

export function ReportsPage() {
  const { activeOrganization } = useDemoOrganization()
  const preferences = activeOrganization.preferences

  const orgId = activeOrganization.id
  const branchInfo = getBranchForOrganization(
    activeOrganization.id,
    activeOrganization.branchName,
  )
  const branchId = branchInfo.id
  const operatorName = 'Operador de Demostración'

  const [activeTab, setActiveTab] = useState<ActiveReportTab>('sales')
  const [period, setPeriod] = useState<ReportPeriod>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Carga reactiva de los repositorios de origen
  const salesData = useMemo(() => {
    return defaultPosSalesCoordinator.loadWorkspace(orgId, branchId).salesData
  }, [orgId, branchId])

  const expensesData = useMemo(() => {
    return defaultExpensesRepository.load(orgId, branchId)
  }, [orgId, branchId])

  const cashData = useMemo(() => {
    return defaultCashRepository.load(orgId, branchId).cashData
  }, [orgId, branchId])

  // Parámetros de filtro consolidados
  const filterParams: ReportFilterParams = useMemo(() => {
    return {
      period,
      dateFrom: period === 'custom' ? customFrom || undefined : undefined,
      dateTo: period === 'custom' ? customTo || undefined : undefined,
    }
  }, [period, customFrom, customTo])

  // Cálculos puros y exactos de los 4 reportes
  const salesReportSummary = useMemo(() => {
    return calculateSalesReport(
      salesData.sales,
      filterParams,
      preferences.currency,
    )
  }, [salesData.sales, filterParams, preferences.currency])

  const productsReportSummary = useMemo(() => {
    return calculateProductsSoldReport(
      salesData.sales,
      filterParams,
      preferences.currency,
    )
  }, [salesData.sales, filterParams, preferences.currency])

  const expensesReportSummary = useMemo(() => {
    return calculateExpensesReport(
      expensesData.expenses,
      expensesData.categories,
      filterParams,
      preferences.currency,
    )
  }, [
    expensesData.expenses,
    expensesData.categories,
    filterParams,
    preferences.currency,
  ])

  const cashReportSummary = useMemo(() => {
    return calculateCashReport(
      cashData.sessions,
      cashData.movements,
      filterParams,
      preferences.currency,
    )
  }, [cashData.sessions, cashData.movements, filterParams, preferences.currency])

  return (
    <div className="reports-page-layout">
      {/* Encabezado */}
      <div className="page-header page-header--split">
        <div>
          <div className="page-header__title-row">
            <h1 className="page-title">
              Reportes operativos &middot; {activeOrganization.name}
            </h1>
            <Badge variant="neutral">Corte de negocio</Badge>
          </div>
          <p className="page-description">
            Consulta consolidada de ventas, desplazamiento de inventario, egresos
            operativos y corte de arqueo de caja con trazabilidad atómica.
          </p>
        </div>
      </div>

      {/* Barra de Filtro de Período Global */}
      <Card className="reports-period-filter-card">
        <div className="reports-period-filter-card__body">
          <div className="period-buttons-group" role="group" aria-label="Período de reporte">
            <button
              type="button"
              className={`period-btn ${period === 'today' ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod('today')}
            >
              Hoy
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'yesterday' ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod('yesterday')}
            >
              Ayer
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'this_week' ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod('this_week')}
            >
              Esta semana
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'this_month' ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod('this_month')}
            >
              Este mes
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'all' ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod('all')}
            >
              Todo el historial
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'custom' ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod('custom')}
            >
              Rango de fechas
            </button>
          </div>

          {period === 'custom' && (
            <div className="period-custom-inputs">
              <Input
                label="Fecha inicial"
                id="report-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                label="Fecha final"
                id="report-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Pestañas de selección de reporte */}
      <div className="reports-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sales'}
          className={`reports-tab-btn ${
            activeTab === 'sales' ? 'reports-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('sales')}
        >
          🧾 Ventas y cobranza ({salesReportSummary.salesCount})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'products'}
          className={`reports-tab-btn ${
            activeTab === 'products' ? 'reports-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('products')}
        >
          📦 Productos vendidos ({productsReportSummary.items.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'expenses'}
          className={`reports-tab-btn ${
            activeTab === 'expenses' ? 'reports-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('expenses')}
        >
          💸 Gastos operativos ({expensesReportSummary.expensesCount})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cash'}
          className={`reports-tab-btn ${
            activeTab === 'cash' ? 'reports-tab-btn--active' : ''
          }`}
          onClick={() => setActiveTab('cash')}
        >
          💵 Caja y arqueo ({cashReportSummary.totalSessions})
        </button>
      </div>

      {/* Contenido del reporte activo */}
      <div className="reports-tab-content">
        {activeTab === 'sales' && (
          <SalesReportView
            summary={salesReportSummary}
            organizationName={activeOrganization.name}
            branchName={activeOrganization.name}
            operatorName={operatorName}
            preferences={preferences}
          />
        )}

        {activeTab === 'products' && (
          <ProductsSoldReportView
            summary={productsReportSummary}
            organizationName={activeOrganization.name}
            branchName={activeOrganization.name}
            operatorName={operatorName}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesReportView
            summary={expensesReportSummary}
            organizationName={activeOrganization.name}
            branchName={activeOrganization.name}
            operatorName={operatorName}
            preferences={preferences}
          />
        )}

        {activeTab === 'cash' && (
          <CashReportView
            summary={cashReportSummary}
            organizationName={activeOrganization.name}
            branchName={activeOrganization.name}
            operatorName={operatorName}
            preferences={preferences}
          />
        )}
      </div>
    </div>
  )
}
