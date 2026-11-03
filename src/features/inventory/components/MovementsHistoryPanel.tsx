import { useId, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { OrganizationPreferences } from '../../../types'
import { getTimezoneShortLabel } from '../../settings/formatters'
import type {
  EnrichedInventoryItem,
  HistoryPeriodFilter,
  InventoryMovement,
  InventoryMovementType,
  MovementHistoryFilters,
} from '../types'
import {
  formatDateTimeInOrganizationTimezone,
  formatQuantityWithUnit,
  formatSignedQuantityWithUnit,
  getMovementTypePresentation,
  isMovementWithinPeriod,
  sortMovementsDeterministically,
} from '../utils/quantityUtils'

const HISTORY_PAGE_SIZE = 8

export interface MovementsHistoryPanelProps {
  organizationName: string
  branchName: string
  preferences: OrganizationPreferences
  items: EnrichedInventoryItem[]
  movements: InventoryMovement[]
  initialProductId: string
  onBackToStockList: () => void
  onOpenMovementForProduct: (
    mode: 'initial' | 'manual_in' | 'manual_out' | 'count',
    productId: string,
  ) => void
}

export function MovementsHistoryPanel({
  organizationName,
  branchName,
  preferences,
  items,
  movements,
  initialProductId,
  onBackToStockList,
  onOpenMovementForProduct,
}: MovementsHistoryPanelProps) {
  const productSelectId = useId()
  const typeSelectId = useId()
  const periodSelectId = useId()

  const [filters, setFilters] = useState<MovementHistoryFilters>({
    productId: initialProductId || 'all',
    movementType: 'all',
    period: 'all',
  })
  const [requestedPage, setRequestedPage] = useState<number>(1)

  const itemsByProductId = useMemo(() => {
    const map = new Map<string, EnrichedInventoryItem>()
    for (const item of items) {
      map.set(item.productId, item)
    }
    return map
  }, [items])

  const selectedProductItem = useMemo(() => {
    if (filters.productId === 'all') {
      return null
    }
    return itemsByProductId.get(filters.productId) ?? null
  }, [filters.productId, itemsByProductId])

  const sortedMovements = useMemo(
    () => sortMovementsDeterministically(movements),
    [movements],
  )

  const filteredMovements = useMemo(() => {
    return sortedMovements.filter((mov) => {
      if (
        filters.productId !== 'all' &&
        mov.productId !== filters.productId
      ) {
        return false
      }

      if (
        filters.movementType !== 'all' &&
        mov.type !== filters.movementType
      ) {
        return false
      }

      if (
        !isMovementWithinPeriod(
          mov.createdAt,
          filters.period,
          preferences.timezone,
        )
      ) {
        return false
      }

      return true
    })
  }, [sortedMovements, filters, preferences.timezone])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMovements.length / HISTORY_PAGE_SIZE),
  )
  const safeCurrentPage = Math.min(Math.max(1, requestedPage), totalPages)

  const paginatedMovements = useMemo(() => {
    const start = (safeCurrentPage - 1) * HISTORY_PAGE_SIZE
    return filteredMovements.slice(start, start + HISTORY_PAGE_SIZE)
  }, [filteredMovements, safeCurrentPage])

  const hasActiveFilters =
    filters.productId !== 'all' ||
    filters.movementType !== 'all' ||
    filters.period !== 'all'

  const resetFilters = () => {
    setFilters({
      productId: 'all',
      movementType: 'all',
      period: 'all',
    })
    setRequestedPage(1)
  }

  const timezoneShort = getTimezoneShortLabel(preferences.timezone)

  return (
    <Card
      as="section"
      padding="lg"
      title={
        selectedProductItem
          ? `Historial por producto: ${selectedProductItem.productName}`
          : `Historial general de movimientos · ${organizationName}`
      }
      subtitle={`Bitácora inmutable de entradas, salidas, inicializaciones y conteos en ${branchName}. Zona horaria activa: ${timezoneShort}.`}
      headerAction={
        <div className="page-header-actions-group">
          {selectedProductItem ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilters((prev) => ({ ...prev, productId: 'all' }))
                setRequestedPage(1)
              }}
            >
              Ver historial general
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBackToStockList}
          >
            Volver a existencias
          </Button>
        </div>
      }
    >
      <div className="product-form-stack">
        {/* Resumen del producto cuando se consulta el historial individual */}
        {selectedProductItem ? (
          <div
            className="inventory-product-history-summary"
            role="region"
            aria-label={`Resumen de existencias de ${selectedProductItem.productName}`}
          >
            <div className="inventory-product-history-summary__info">
              <div className="inventory-product-history-summary__head">
                <strong>{selectedProductItem.productName}</strong>
                <code>SKU: {selectedProductItem.sku}</code>
                {selectedProductItem.productStatus === 'inactive' ? (
                  <Badge variant="neutral">Producto inactivo</Badge>
                ) : (
                  <Badge variant="success">Producto activo</Badge>
                )}
              </div>
              <p className="inventory-product-history-summary__meta">
                Saldo actual:{' '}
                <strong>
                  {selectedProductItem.isInitialized &&
                  selectedProductItem.quantity !== null
                    ? formatQuantityWithUnit(
                        selectedProductItem.quantity,
                        selectedProductItem.unit,
                      )
                    : 'Sin inicializar'}
                </strong>{' '}
                · Mínimo:{' '}
                <strong>
                  {!selectedProductItem.isInitialized
                    ? '—'
                    : selectedProductItem.minStock === null
                      ? 'Sin mínimo'
                      : formatQuantityWithUnit(
                          selectedProductItem.minStock,
                          selectedProductItem.unit,
                        )}
                </strong>
              </p>
            </div>
            <div className="inventory-product-history-summary__actions">
              {!selectedProductItem.isInitialized ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    onOpenMovementForProduct(
                      'initial',
                      selectedProductItem.productId,
                    )
                  }
                >
                  Inicializar existencias
                </Button>
              ) : (
                <>
                  {selectedProductItem.productStatus === 'active' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onOpenMovementForProduct(
                          'manual_in',
                          selectedProductItem.productId,
                        )
                      }
                    >
                      + Entrada
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onOpenMovementForProduct(
                        'manual_out',
                        selectedProductItem.productId,
                      )
                    }
                  >
                    - Salida
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onOpenMovementForProduct(
                        'count',
                        selectedProductItem.productId,
                      )
                    }
                  >
                    Conteo físico
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Barra de filtros del historial */}
        <div
          className="products-filters-card"
          role="region"
          aria-label="Filtros del historial de movimientos"
        >
          <div className="products-filters-grid">
            <div className="ui-select-field">
              <label htmlFor={productSelectId} className="ui-input__label">
                Filtrar por producto
              </label>
              <select
                id={productSelectId}
                className="ui-select-field__control"
                value={filters.productId}
                onChange={(event) => {
                  setFilters((prev) => ({
                    ...prev,
                    productId: event.target.value,
                  }))
                  setRequestedPage(1)
                }}
              >
                <option value="all">
                  Todos los productos ({items.length})
                </option>
                {items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.productName} ({item.sku})
                    {item.productStatus === 'inactive' ? ' [Inactivo]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="ui-select-field">
              <label htmlFor={typeSelectId} className="ui-input__label">
                Tipo de movimiento
              </label>
              <select
                id={typeSelectId}
                className="ui-select-field__control"
                value={filters.movementType}
                onChange={(event) => {
                  setFilters((prev) => ({
                    ...prev,
                    movementType: event.target.value as
                      | 'all'
                      | InventoryMovementType,
                  }))
                  setRequestedPage(1)
                }}
              >
                <option value="all">Todos los tipos</option>
                <option value="initial">Existencia inicial</option>
                <option value="manual_in">Entrada manual (+)</option>
                <option value="manual_out">Salida manual (-)</option>
                <option value="sale_out">Salida por venta (POS)</option>
                <option value="sale_return_in">Reingreso por devolución/cancelación (POS)</option>
                <option value="count_adjustment">Ajuste por conteo</option>
              </select>
            </div>

            <div className="ui-select-field">
              <label htmlFor={periodSelectId} className="ui-input__label">
                Periodo ({timezoneShort})
              </label>
              <select
                id={periodSelectId}
                className="ui-select-field__control"
                value={filters.period}
                onChange={(event) => {
                  setFilters((prev) => ({
                    ...prev,
                    period: event.target.value as HistoryPeriodFilter,
                  }))
                  setRequestedPage(1)
                }}
              >
                <option value="all">Todo el historial</option>
                <option value="today">Hoy</option>
                <option value="last_7_days">Últimos 7 días</option>
                <option value="last_30_days">Últimos 30 días</option>
              </select>
            </div>
          </div>

          <div className="products-filters-footer">
            <p className="products-filters-count" role="status">
              Mostrando <strong>{filteredMovements.length}</strong> de{' '}
              <strong>{movements.length}</strong> movimientos registrados. Los
              movimientos son inmutables; cualquier corrección debe realizarse
              mediante una nueva entrada, salida o conteo físico.
            </p>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Limpiar filtros de historial
              </Button>
            ) : null}
          </div>
        </div>

        {/* Tabla de movimientos */}
        {filteredMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos para los filtros seleccionados"
            description={
              selectedProductItem && !selectedProductItem.isInitialized
                ? `El producto "${selectedProductItem.productName}" aún está sin inicializar y no registra movimientos.`
                : 'No se encontraron movimientos con los criterios actuales.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Mostrar todos los movimientos
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="products-table-card">
            <div className="products-table-wrapper">
              <table className="products-table inventory-history-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora ({timezoneShort})</th>
                    <th scope="col">Producto</th>
                    <th scope="col">Tipo</th>
                    <th scope="col" className="products-table__num-col">
                      Variación
                    </th>
                    <th scope="col" className="products-table__num-col">
                      Saldo anterior → posterior
                    </th>
                    <th scope="col">Motivo y referencia</th>
                    <th scope="col">Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.map((mov) => {
                    const productItem = itemsByProductId.get(mov.productId)
                    const unit = productItem?.unit ?? 'pieza'
                    const typeMeta = getMovementTypePresentation(mov.type)
                    const formattedDate = formatDateTimeInOrganizationTimezone(
                      mov.createdAt,
                      preferences.timezone,
                      preferences.dateFormat,
                    )

                    return (
                      <tr key={mov.id}>
                        <td data-label="Fecha y hora">
                          <div className="inventory-history-date">
                            <strong>{formattedDate.dateLabel}</strong>
                            <span className="inventory-history-date__time">
                              {formattedDate.timeLabel} · Sec. #{mov.sequence}
                            </span>
                          </div>
                        </td>

                        <td data-label="Producto">
                          <div className="product-cell-main">
                            <span className="product-cell-main__name">
                              {productItem?.productName ??
                                `Producto (${mov.productId})`}
                            </span>
                            <div className="product-cell-main__meta">
                              <code className="product-cell-main__sku">
                                {productItem?.sku ?? mov.productId}
                              </code>
                              {productItem?.productStatus === 'inactive' ? (
                                <Badge variant="neutral">Inactivo</Badge>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td data-label="Tipo">
                          <Badge variant={typeMeta.badgeVariant}>
                            {typeMeta.label}
                          </Badge>
                        </td>

                        <td
                          data-label="Variación"
                          className="products-table__num-col"
                        >
                          <strong
                            className={`inventory-delta-value ${
                              mov.delta > 0
                                ? 'inventory-delta-value--positive'
                                : mov.delta < 0
                                  ? 'inventory-delta-value--negative'
                                  : ''
                            }`}
                          >
                            {mov.type === 'initial'
                              ? formatQuantityWithUnit(mov.delta, unit)
                              : formatSignedQuantityWithUnit(mov.delta, unit)}
                          </strong>
                        </td>

                        <td
                          data-label="Saldo anterior → posterior"
                          className="products-table__num-col"
                        >
                          <span className="inventory-balance-transition">
                            <span className="inventory-balance-transition__prev">
                              {mov.previousQuantity === null
                                ? 'Sin inicializar'
                                : formatQuantityWithUnit(
                                    mov.previousQuantity,
                                    unit,
                                  )}
                            </span>
                            <span aria-hidden="true"> → </span>
                            <strong className="inventory-balance-transition__next">
                              {formatQuantityWithUnit(mov.newQuantity, unit)}
                            </strong>
                          </span>
                        </td>

                        <td data-label="Motivo y referencia">
                          <div className="inventory-reason-cell">
                            <p className="inventory-reason-cell__text">
                              {mov.reason}
                            </p>
                            {mov.reference ? (
                              <span className="inventory-reason-cell__ref">
                                Ref: <code>{mov.reference}</code>
                              </span>
                            ) : (
                              <span className="product-cell-muted">
                                Sin referencia
                              </span>
                            )}
                          </div>
                        </td>

                        <td data-label="Responsable">
                          <span className="inventory-operator-name">
                            {mov.operatorName}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <nav
                className="products-pagination"
                aria-label="Paginación del historial de movimientos"
              >
                <span className="products-pagination__info">
                  Página <strong>{safeCurrentPage}</strong> de{' '}
                  <strong>{totalPages}</strong>
                </span>
                <div className="products-pagination__controls">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setRequestedPage(safeCurrentPage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setRequestedPage(safeCurrentPage + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  )
}

