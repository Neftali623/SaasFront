import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { OrganizationPreferences } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import type {
  ExpenseCategory,
  ExpenseFilters,
  ExpenseMethodFilter,
  ExpensePaymentMethod,
  ExpensePeriodFilter,
  ExpenseRecord,
  ExpenseStatusFilter,
} from '../types'

export interface ExpensesTableProps {
  expenses: ExpenseRecord[]
  categories: ExpenseCategory[]
  filters: ExpenseFilters
  preferences: OrganizationPreferences
  onFiltersChange: (newFilters: ExpenseFilters) => void
  onViewDetail: (expense: ExpenseRecord) => void
  onRequestCancel: (expense: ExpenseRecord) => void
}

const ITEMS_PER_PAGE = 10

export function ExpensesTable({
  expenses,
  categories,
  filters,
  preferences,
  onFiltersChange,
  onViewDetail,
  onRequestCancel,
}: ExpensesTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Filtrado reactivo en memoria
  const filtered = expenses.filter((exp) => {
    // Búsqueda por texto libre
    if (filters.searchQuery?.trim()) {
      const q = filters.searchQuery.trim().toLowerCase()
      const matchFolio = exp.folio.toLowerCase().includes(q)
      const matchConcept = exp.concept.toLowerCase().includes(q)
      const matchOperator = exp.registeredBy.toLowerCase().includes(q)
      const matchCategory = exp.categoryName.toLowerCase().includes(q)
      const matchRef = exp.externalReference?.toLowerCase().includes(q) ?? false
      if (
        !matchFolio &&
        !matchConcept &&
        !matchOperator &&
        !matchCategory &&
        !matchRef
      ) {
        return false
      }
    }

    // Filtro por categoría
    if (filters.category && exp.categoryId !== filters.category) {
      return false
    }

    // Filtro por método de pago
    if (filters.method && filters.method !== 'all' && exp.paymentMethod !== filters.method) {
      return false
    }

    // Filtro por estado
    if (filters.status && filters.status !== 'all' && exp.status !== filters.status) {
      return false
    }

    // Filtro por período
    if (filters.period && filters.period !== 'all') {
      const expDate = exp.expenseDate
      const today = new Date().toISOString().split('T')[0]
      if (filters.period === 'today' && expDate !== today) {
        return false
      }
      if (filters.period === 'last_7_days') {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        if (expDate < d.toISOString().split('T')[0]) return false
      }
      if (filters.period === 'last_30_days') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        if (expDate < d.toISOString().split('T')[0]) return false
      }
    }

    return true
  })

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE
  const paginatedItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const handleSearchChange = (val: string) => {
    setCurrentPage(1)
    onFiltersChange({ ...filters, searchQuery: val })
  }

  const handleCategoryChange = (val: string) => {
    setCurrentPage(1)
    onFiltersChange({ ...filters, category: val })
  }

  const handleMethodChange = (val: string) => {
    setCurrentPage(1)
    onFiltersChange({
      ...filters,
      method: val as ExpenseMethodFilter,
    })
  }

  const handleStatusChange = (val: string) => {
    setCurrentPage(1)
    onFiltersChange({
      ...filters,
      status: val as ExpenseStatusFilter,
    })
  }

  const handlePeriodChange = (val: string) => {
    setCurrentPage(1)
    onFiltersChange({
      ...filters,
      period: val as ExpensePeriodFilter,
    })
  }

  const getPaymentMethodBadge = (method: ExpensePaymentMethod) => {
    switch (method) {
      case 'cash':
        return <Badge variant="warning">Efectivo (Caja)</Badge>
      case 'card':
        return <Badge variant="neutral">Tarjeta</Badge>
      case 'transfer':
        return <Badge variant="neutral">Transferencia</Badge>
    }
  }

  return (
    <div className="expenses-table-container">
      {/* Barra de filtros */}
      <div className="expenses-filters-bar">
        <div className="expenses-filters-bar__search">
          <Input
            label="Buscar por folio, concepto, categoría o referencia"
            id="expenses-search"
            type="search"
            placeholder="Ej. GAS-0001, Papelería, Operador..."
            value={filters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="expenses-filters-bar__selects">
          <div className="filter-group">
            <label htmlFor="filter-period" className="form-label form-label--sm">
              Período
            </label>
            <select
              id="filter-period"
              className="ui-input ui-input--select"
              value={filters.period}
              onChange={(e) => handlePeriodChange(e.target.value)}
            >
              <option value="all">Todo el historial</option>
              <option value="today">Hoy</option>
              <option value="last_7_days">Últimos 7 días</option>
              <option value="last_30_days">Últimos 30 días</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-cat" className="form-label form-label--sm">
              Categoría
            </label>
            <select
              id="filter-cat"
              className="ui-input ui-input--select"
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-method" className="form-label form-label--sm">
              Método
            </label>
            <select
              id="filter-method"
              className="ui-input ui-input--select"
              value={filters.method}
              onChange={(e) => handleMethodChange(e.target.value)}
            >
              <option value="all">Todos los métodos</option>
              <option value="cash">Efectivo en caja</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-status" className="form-label form-label--sm">
              Estado
            </label>
            <select
              id="filter-status"
              className="ui-input ui-input--select"
              value={filters.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="cancelled">Anulado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contador y metadatos */}
      <div className="expenses-table__summary-bar">
        <span className="expenses-table__counter">
          Mostrando {filtered.length} gasto(s) registrado(s)
        </span>
      </div>

      {/* Tabla responsive */}
      <div className="ui-table-responsive-wrapper">
        <table className="ui-table expenses-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Fecha efectiva</th>
              <th>Concepto y Categoría</th>
              <th>Método</th>
              <th className="ui-table__cell--numeric">Monto</th>
              <th>Estado</th>
              <th>Registrado por</th>
              <th className="ui-table__cell--actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="ui-table__empty-cell">
                  No se encontraron gastos que coincidan con los filtros
                  seleccionados.
                </td>
              </tr>
            ) : (
              paginatedItems.map((exp) => {
                const isCancelled = exp.status === 'cancelled'
                const formattedDate = formatDateTimeInOrganizationTimezone(
                  exp.createdAt,
                  preferences.timezone,
                  preferences.dateFormat,
                )

                return (
                  <tr
                    key={exp.id}
                    className={`expense-row ${
                      isCancelled ? 'expense-row--cancelled' : ''
                    }`}
                  >
                    <td>
                      <button
                        type="button"
                        className="expenses-folio-btn"
                        onClick={() => onViewDetail(exp)}
                        title="Ver detalle completo"
                      >
                        {exp.folio}
                      </button>
                    </td>
                    <td>
                      <div className="expense-date-cell">
                        <strong>{exp.expenseDate}</strong>
                        <small className="text-muted">{formattedDate.fullLabel}</small>
                      </div>
                    </td>
                    <td>
                      <div className="expense-concept-cell">
                        <strong className="expense-concept-cell__title">
                          {exp.concept}
                        </strong>
                        <span className="expense-concept-cell__cat">
                          {exp.categoryName}
                        </span>
                        {exp.attachment && (
                          <span
                            className="expense-concept-cell__badge"
                            title={`Comprobante adjunto: ${exp.attachment.fileName}`}
                          >
                            📎 Con comprobante
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{getPaymentMethodBadge(exp.paymentMethod)}</td>
                    <td className="ui-table__cell--numeric">
                      <span
                        className={`expense-amount ${
                          isCancelled ? 'expense-amount--cancelled' : ''
                        }`}
                      >
                        {formatCentsWithHistoricalCurrency(
                          exp.amountCents,
                          exp.currency,
                        )}
                      </span>
                    </td>
                    <td>
                      <Badge variant={isCancelled ? 'danger' : 'success'}>
                        {isCancelled ? 'Anulado' : 'Activo'}
                      </Badge>
                    </td>
                    <td>
                      <small>{exp.registeredBy}</small>
                    </td>
                    <td className="ui-table__cell--actions">
                      <div className="expenses-action-btns">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onViewDetail(exp)}
                        >
                          Ver detalle
                        </Button>
                        {!isCancelled && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="ui-btn--danger-ghost"
                            onClick={() => onRequestCancel(exp)}
                          >
                            Anular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="pagination-bar__info">
            Página {safePage} de {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
