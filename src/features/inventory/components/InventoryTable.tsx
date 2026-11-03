import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { getUnitLabel } from '../../products/utils/validation'
import type { EnrichedInventoryItem } from '../types'
import {
  formatQuantityWithUnit,
  getStockStatusPresentation,
  isDivisibleUnit,
} from '../utils/quantityUtils'

export interface InventoryTableProps {
  items: EnrichedInventoryItem[]
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onInitializeItem: (item: EnrichedInventoryItem) => void
  onManualEntry: (item: EnrichedInventoryItem) => void
  onManualExit: (item: EnrichedInventoryItem) => void
  onPhysicalCount: (item: EnrichedInventoryItem) => void
  onConfigureMinStock: (item: EnrichedInventoryItem) => void
  onViewProductHistory: (item: EnrichedInventoryItem) => void
}

export function InventoryTable({
  items,
  currentPage,
  totalPages,
  onPageChange,
  onInitializeItem,
  onManualEntry,
  onManualExit,
  onPhysicalCount,
  onConfigureMinStock,
  onViewProductHistory,
}: InventoryTableProps) {
  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  )

  return (
    <div className="products-table-card">
      <div className="products-table-wrapper">
        <table className="products-table inventory-table">
          <thead>
            <tr>
              <th scope="col">Producto y SKU</th>
              <th scope="col">Categoría</th>
              <th scope="col">Unidad</th>
              <th scope="col" className="products-table__num-col">
                Existencia actual
              </th>
              <th scope="col" className="products-table__num-col">
                Mínimo
              </th>
              <th scope="col">Estado</th>
              <th scope="col" className="products-table__actions-col">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const statusMeta = getStockStatusPresentation(item.stockStatus)
              const unitLabel = getUnitLabel(item.unit)
              const divisible = isDivisibleUnit(item.unit)

              return (
                <tr
                  key={item.productId}
                  className={
                    item.productStatus === 'inactive'
                      ? 'products-table__row--inactive'
                      : ''
                  }
                >
                  <td data-label="Producto y SKU">
                    <div className="product-cell-main">
                      <span className="product-cell-main__name">
                        {item.productName}
                      </span>
                      <div className="product-cell-main__meta">
                        <code className="product-cell-main__sku">
                          SKU: {item.sku}
                        </code>
                        {item.productStatus === 'inactive' ? (
                          <Badge variant="neutral">Producto inactivo</Badge>
                        ) : null}
                      </div>
                      {item.productStatus === 'inactive' ? (
                        <p className="inventory-inactive-rule-hint">
                          Sin nuevas entradas. Admite salida o conteo para
                          ajustar saldo residual.
                        </p>
                      ) : null}
                    </div>
                  </td>

                  <td data-label="Categoría">
                    {item.categoryName ? (
                      <div className="product-cell-category">
                        <span>{item.categoryName}</span>
                        {item.categoryIsInactive ? (
                          <Badge variant="warning">Categoría inactiva</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="product-cell-muted">Sin categoría</span>
                    )}
                  </td>

                  <td data-label="Unidad">
                    <div className="inventory-unit-cell">
                      <strong>{unitLabel}</strong>
                      <span className="inventory-unit-cell__sub">
                        {divisible ? 'Decimal (≤3 dec.)' : 'Entera'}
                      </span>
                    </div>
                  </td>

                  <td
                    data-label="Existencia actual"
                    className="products-table__num-col"
                  >
                    {!item.isInitialized || item.quantity === null ? (
                      <span className="product-cell-muted">
                        Sin inicializar
                      </span>
                    ) : (
                      <strong
                        className={`inventory-qty-value ${
                          item.quantity === 0
                            ? 'inventory-qty-value--zero'
                            : item.stockStatus === 'low_stock'
                              ? 'inventory-qty-value--low'
                              : ''
                        }`}
                      >
                        {formatQuantityWithUnit(item.quantity, item.unit)}
                      </strong>
                    )}
                  </td>

                  <td
                    data-label="Mínimo"
                    className="products-table__num-col"
                  >
                    {!item.isInitialized ? (
                      <span className="product-cell-muted">—</span>
                    ) : item.minStock === null ? (
                      <span
                        className="inventory-min-badge inventory-min-badge--none"
                        title="No tiene stock mínimo configurado"
                      >
                        Sin mínimo
                      </span>
                    ) : item.minStock === 0 ? (
                      <div className="inventory-min-cell">
                        <strong>
                          {formatQuantityWithUnit(0, item.unit)}
                        </strong>
                        <span className="inventory-min-cell__zero-tag">
                          Mínimo en 0
                        </span>
                      </div>
                    ) : (
                      <span className="inventory-min-value">
                        {formatQuantityWithUnit(item.minStock, item.unit)}
                      </span>
                    )}
                  </td>

                  <td data-label="Estado">
                    <div className="inventory-status-stack">
                      <Badge variant={statusMeta.badgeVariant}>
                        {statusMeta.label}
                      </Badge>
                      {item.stockStatus === 'out_of_stock' &&
                      item.minStock !== null &&
                      item.minStock > 0 &&
                      item.productStatus === 'active' ? (
                        <span className="inventory-status-subnote">
                          Requiere reabastecer (mín.{' '}
                          {formatQuantityWithUnit(item.minStock, item.unit)})
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td
                    data-label="Acciones"
                    className="products-table__actions-col"
                  >
                    <div className="product-row-actions inventory-row-actions">
                      {!item.isInitialized ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onInitializeItem(item)}
                          aria-label={`Inicializar existencias de ${item.productName}`}
                        >
                          Inicializar
                        </Button>
                      ) : (
                        <>
                          {item.productStatus === 'active' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onManualEntry(item)}
                              aria-label={`Registrar entrada manual de ${item.productName}`}
                            >
                              + Entrada
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onManualExit(item)}
                            aria-label={`Registrar salida manual de ${item.productName}`}
                          >
                            - Salida
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPhysicalCount(item)}
                            aria-label={`Ajustar por conteo físico ${item.productName}`}
                          >
                            Conteo
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onConfigureMinStock(item)}
                            aria-label={`Configurar mínimo de ${item.productName}`}
                          >
                            Mínimo
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewProductHistory(item)}
                        aria-label={`Ver historial de movimientos de ${item.productName}`}
                      >
                        Historial ({item.movementsCount})
                      </Button>
                    </div>
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
          aria-label="Paginación de existencias de inventario"
        >
          <span className="products-pagination__info">
            Página <strong>{currentPage}</strong> de{' '}
            <strong>{totalPages}</strong>
          </span>

          <div className="products-pagination__controls">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              Anterior
            </Button>

            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                className={`products-pagination__page-btn ${
                  page === currentPage
                    ? 'products-pagination__page-btn--active'
                    : ''
                }`}
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                aria-label={`Ir a la página ${page}`}
              >
                {page}
              </button>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

