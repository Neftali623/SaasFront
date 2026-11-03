import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { defaultCashRepository } from '../../cash/services/cashRepository'
import type { CashSession, CashSessionComputedTotals } from '../../cash/types'
import {
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import { getBranchForOrganization } from '../../inventory/utils/mockInventory'
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import { CancelExpenseModal } from '../components/CancelExpenseModal'
import { ExpenseCategoriesManagerModal } from '../components/ExpenseCategoriesManagerModal'
import { ExpenseDetailModal } from '../components/ExpenseDetailModal'
import { ExpenseFormModal } from '../components/ExpenseFormModal'
import { ExpensesTable } from '../components/ExpensesTable'
import { defaultExpensesRepository } from '../services/expensesRepository'
import type {
  CancelExpensePayload,
  CreateExpensePayload,
  ExpenseFilters,
  ExpenseRecord,
  OrganizationExpensesData,
} from '../types'

export function ExpensesPage() {
  const { activeOrganization } = useDemoOrganization()
  const preferences = activeOrganization.preferences

  const orgId = activeOrganization.id
  const branchInfo = getBranchForOrganization(
    activeOrganization.id,
    activeOrganization.branchName,
  )
  const branchId = branchInfo.id
  const operatorName = 'Operador de Demostración'

  // Estado de los gastos
  const [expensesData, setExpensesData] = useState<OrganizationExpensesData>(() =>
    defaultExpensesRepository.load(orgId, branchId),
  )

  // Estado de la sesión de caja activa
  const [, setReloadCounter] = useState(0)

  // Filtros
  const [filters, setFilters] = useState<ExpenseFilters>({
    period: 'all',
    category: '',
    method: 'all',
    status: 'all',
    searchQuery: '',
  })

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false)
  const [detailExpense, setDetailExpense] = useState<ExpenseRecord | null>(null)
  const [cancellingExpense, setCancellingExpense] = useState<ExpenseRecord | null>(
    null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Recarga sincronizada al persistir mutaciones
  const reloadData = () => {
    const freshExpenses = defaultExpensesRepository.load(orgId, branchId)
    setExpensesData(freshExpenses)
    setReloadCounter((v) => v + 1)
  }

  // Consulta de caja activa derivada (reactiva a cashVersion y orgId)
  const cashDataOutcome = defaultCashRepository.load(orgId, branchId)
  const openSession: CashSession | null =
    cashDataOutcome.cashData.sessions.find((s) => s.status === 'open') ?? null

  const openSessionTotals: CashSessionComputedTotals | null = openSession
    ? calculateSessionComputedTotals(openSession, cashDataOutcome.cashData.movements)
    : null

  // Métricas calculadas para los KPI cards
  const activeExpenses = expensesData.expenses.filter((e) => e.status === 'active')
  const cancelledExpenses = expensesData.expenses.filter(
    (e) => e.status === 'cancelled',
  )

  const totalActiveCents = activeExpenses.reduce((sum, e) => sum + e.amountCents, 0)
  const cashActiveCents = activeExpenses
    .filter((e) => e.paymentMethod === 'cash')
    .reduce((sum, e) => sum + e.amountCents, 0)
  const nonCashActiveCents = activeExpenses
    .filter((e) => e.paymentMethod !== 'cash')
    .reduce((sum, e) => sum + e.amountCents, 0)
  const cancelledCents = cancelledExpenses.reduce(
    (sum, e) => sum + e.amountCents,
    0,
  )

  // Handler: Crear gasto
  const handleCreateExpense = (payload: CreateExpensePayload) => {
    setIsSubmitting(true)
    setActionFeedback(null)
    const result = defaultExpensesRepository.createExpense({
      organizationId: orgId,
      branchId,
      branchName: activeOrganization.name,
      payload,
    })

    setIsSubmitting(false)

    if (!result.ok) {
      setActionFeedback({
        type: 'error',
        message: result.error,
      })
      return
    }

    reloadData()
    setIsFormModalOpen(false)
    setActionFeedback({
      type: 'success',
      message: `Gasto ${result.expense.folio} registrado correctamente.`,
    })
  }

  // Handler: Anular gasto
  const handleConfirmCancelExpense = (payload: CancelExpensePayload) => {
    setIsSubmitting(true)
    setActionFeedback(null)

    const result = defaultExpensesRepository.cancelExpense({
      organizationId: orgId,
      branchId,
      payload,
    })

    setIsSubmitting(false)

    if (!result.ok) {
      setActionFeedback({
        type: 'error',
        message: result.error,
      })
      return
    }

    reloadData()
    setCancellingExpense(null)
    if (detailExpense?.id === payload.expenseId) {
      setDetailExpense(result.expense)
    }

    setActionFeedback({
      type: 'success',
      message: `Gasto ${result.expense.folio} anulado con éxito. Se registró la trazabilidad correspondiente.`,
    })
  }

  // Handler: Categorías
  const handleSaveCategory = (params: {
    id?: string
    name: string
  }) => {
    let res: { ok: true; category?: unknown } | { ok: false; error: string }
    if (params.id) {
      res = defaultExpensesRepository.updateCategory(
        orgId,
        branchId,
        params.id,
        params.name,
      )
    } else {
      res = defaultExpensesRepository.createCategory(orgId, branchId, params.name)
    }

    if (res.ok) {
      reloadData()
      return { ok: true as const }
    }
    return { ok: false as const, error: res.error }
  }

  const handleToggleCategoryStatus = (categoryId: string) => {
    const res = defaultExpensesRepository.toggleCategoryActive(
      orgId,
      branchId,
      categoryId,
    )
    if (res.ok) {
      reloadData()
      return { ok: true as const }
    }
    return { ok: false as const, error: res.error }
  }

  return (
    <div className="expenses-page-layout">
      {/* Encabezado de página */}
      <div className="page-header page-header--split">
        <div>
          <div className="page-header__title-row">
            <h1 className="page-title">
              Gastos operativos &middot; {activeOrganization.name}
            </h1>
            <Badge variant="neutral">Módulo operativo</Badge>
          </div>
          <p className="page-description">
            Control clasificado de egresos, vinculación atómica con caja física
            y trazabilidad completa de desembolsos.
          </p>
        </div>

        <div className="page-header__actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCategoriesModalOpen(true)}
          >
            Categorías ({expensesData.categories.length})
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setActionFeedback(null)
              setIsFormModalOpen(true)
            }}
          >
            + Registrar gasto
          </Button>
        </div>
      </div>

      {/* Banner de estado de caja */}
      <div
        className={`cash-status-banner ${
          openSession ? 'cash-status-banner--open' : 'cash-status-banner--closed'
        }`}
      >
        <div className="cash-status-banner__info">
          <strong className="cash-status-banner__title">
            {openSession
              ? `Sesión de caja activa en ${activeOrganization.name}`
              : 'Sin sesión de caja abierta'}
          </strong>
          <span className="cash-status-banner__desc">
            {openSession
              ? `Efectivo en caja disponible para desembolsos: ${formatCentsWithHistoricalCurrency(
                  openSessionTotals?.expectedBalanceCents ?? 0,
                  openSession.currency,
                )}`
              : 'Los gastos con método efectivo requieren abrir un turno en el módulo de Caja.'}
          </span>
        </div>
        <Badge variant={openSession ? 'success' : 'warning'}>
          {openSession ? 'Caja abierta' : 'Caja cerrada'}
        </Badge>
      </div>

      {/* Mensajes de feedback general */}
      {actionFeedback && (
        <div
          className={`form-feedback form-feedback--${actionFeedback.type}`}
          role="status"
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Tarjetas KPI de resumen */}
      <div className="stats-grid stats-grid--4">
        <Card className="kpi-card">
          <span className="kpi-card__label">Gastos netos activos</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              totalActiveCents,
              preferences.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            {activeExpenses.length} registro(s) vigentes
          </span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Desembolsos en efectivo</span>
          <strong className="kpi-card__value text-warning">
            {formatCentsWithHistoricalCurrency(
              cashActiveCents,
              preferences.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Impacto en sesión de caja</span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Tarjeta y transferencia</span>
          <strong className="kpi-card__value">
            {formatCentsWithHistoricalCurrency(
              nonCashActiveCents,
              preferences.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">Pagos no físicos registrados</span>
        </Card>

        <Card className="kpi-card">
          <span className="kpi-card__label">Gastos anulados</span>
          <strong className="kpi-card__value text-muted">
            {formatCentsWithHistoricalCurrency(
              cancelledCents,
              preferences.currency,
            )}
          </strong>
          <span className="kpi-card__subtext">
            {cancelledExpenses.length} registro(s) cancelados
          </span>
        </Card>
      </div>

      {/* Listado de gastos */}
      <Card className="expenses-table-card">
        <div className="expenses-table-card__header">
          <h2 className="expenses-table-card__title">Historial de gastos</h2>
        </div>

        <ExpensesTable
          expenses={expensesData.expenses}
          categories={expensesData.categories}
          filters={filters}
          preferences={preferences}
          onFiltersChange={setFilters}
          onViewDetail={(exp) => setDetailExpense(exp)}
          onRequestCancel={(exp) => setCancellingExpense(exp)}
        />
      </Card>

      {/* Modal: Nuevo gasto */}
      {isFormModalOpen && (
        <ExpenseFormModal
          organizationId={orgId}
          branchName={activeOrganization.name}
          currency={preferences.currency}
          categories={expensesData.categories}
          openSession={openSession}
          openSessionTotals={openSessionTotals}
          operatorName={operatorName}
          isSubmitting={isSubmitting}
          onSubmit={handleCreateExpense}
          onClose={() => setIsFormModalOpen(false)}
          onManageCategories={() => {
            setIsFormModalOpen(false)
            setIsCategoriesModalOpen(true)
          }}
        />
      )}

      {/* Modal: Administrar categorías */}
      <ExpenseCategoriesManagerModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={expensesData.categories}
        onSaveCategory={handleSaveCategory}
        onToggleCategoryStatus={handleToggleCategoryStatus}
      />

      {/* Modal: Detalle de gasto */}
      {detailExpense && (
        <ExpenseDetailModal
          expense={detailExpense}
          preferences={preferences}
          onClose={() => setDetailExpense(null)}
          onCancelExpense={(exp) => {
            setDetailExpense(null)
            setCancellingExpense(exp)
          }}
        />
      )}

      {/* Modal: Anular gasto */}
      {cancellingExpense && (
        <CancelExpenseModal
          expense={cancellingExpense}
          openSession={openSession}
          operatorName={operatorName}
          isSubmitting={isSubmitting}
          onClose={() => setCancellingExpense(null)}
          onConfirmCancel={handleConfirmCancelExpense}
        />
      )}
    </div>
  )
}
