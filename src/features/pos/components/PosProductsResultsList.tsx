import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { CurrencyCode } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import {
  formatQuantityWithUnit,
  getStockStatusPresentation,
} from '../../inventory/utils/quantityUtils'
import { getUnitLabel } from '../../products/utils/validation'
import type { PosCatalogProductItem } from '../types'

export interface PosProductsResultsListProps {
  activeResults: PosCatalogProductItem[]
  matchedInactiveProducts: PosCatalogProductItem[]
  totalActiveCatalogCount: number
  catalogCurrency: CurrencyCode
  hasActiveFilters: boolean
  onAddProduct: (item: PosCatalogProductItem) => void
  onClearFilters: () => void
  onGoToProducts: () => void
  onGoToInventory: () => void
}

export function PosProductsResultsList({
  activeResults,
  matchedInactiveProducts,
  totalActiveCatalogCount,
  catalogCurrency,
  hasActiveFilters,
  onAddProduct,
  onClearFilters,
  onGoToProducts,
  onGoToInventory,
}: PosProductsResultsListProps) {
  if (totalActiveCatalogCount === 0) {
    return (
      <EmptyState
        title="No hay productos activos en el catálogo"
        description="Esta organización aún no cuenta con productos activos para la venta. Registra o activa productos en el Catálogo e inicializa sus existencias en Inventario."
        action={
          <div className="empty-state-actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onGoToProducts}
            >
              Ir a Productos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGoToInventory}
            >
              Ir a Inventario
            </Button>
          </div>
        }
      />
    )
  }

  return (
    <div className="pos-results-container">
      {matchedInactiveProducts.length > 0 ? (
        <div
          className="settings-alert settings-alert--warning"
          role="status"
          aria-live="polite"
        >
          <div className="settings-alert__content">
            <strong>
              {matchedInactiveProducts.length === 1
                ? '1 producto coincidente se encuentra inactivo'
                : `${matchedInactiveProducts.length} productos coincidentes se encuentran inactivos`}
            </strong>
            <p>
              Los artículos inactivos no pueden agregarse a nuevas ventas:{' '}
              {matchedInactiveProducts
                .map((m) => `${m.product.name} (${m.product.sku})`)
                .join(', ')}
              . Puedes reactivarlos desde el módulo de Productos.
            </p>
          </div>
        </div>
      ) : null}

      {activeResults.length === 0 ? (
        <EmptyState
          title="Sin productos activos que coincidan con la búsqueda"
          description="Verifica el nombre, SKU o código de barras ingresado (incluyendo ceros iniciales) o cambia el filtro de categoría."
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
              >
                Limpiar búsqueda y filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className="pos-products-list"
          aria-label="Productos disponibles para Punto de Venta"
        >
          {activeResults.map((item) => {
            const { product } = item
            const formattedPrice = formatCentsWithHistoricalCurrency(
              item.unitPriceCents,
              catalogCurrency,
            )
            const unitLabel = getUnitLabel(product.unit)
            const stockPresentation = getStockStatusPresentation(
              item.stockStatus,
            )
            const stockBadgeVariant = stockPresentation.badgeVariant
            const stockStatusLabel = stockPresentation.label

            return (
              <li
                key={product.id}
                className={`pos-product-row ${
                  !item.canSell ? 'pos-product-row--disabled' : ''
                }`}
              >
                <div className="pos-product-row__main">
                  <div className="pos-product-row__header">
                    <span className="pos-product-row__name">
                      {product.name}
                    </span>
                    <Badge variant="neutral">
                      {item.categoryName ?? 'Sin categoría'}
                    </Badge>
                    {item.inCartQuantity > 0 ? (
                      <Badge variant="brand">
                        En carrito:{' '}
                        {formatQuantityWithUnit(
                          item.inCartQuantity,
                          product.unit,
                        )}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="pos-product-row__codes">
                    <span>
                      SKU: <code>{product.sku}</code>
                    </span>
                    {product.barcodes.length > 0 ? (
                      <span>
                        Código(s):{' '}
                        {product.barcodes.map((code, idx) => (
                          <span key={code}>
                            {idx > 0 ? ', ' : ''}
                            <code>{code}</code>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">Sin código de barras</span>
                    )}
                  </div>

                  <div className="pos-product-row__stock-row">
                    <Badge variant={stockBadgeVariant}>
                      {stockStatusLabel}
                    </Badge>
                    <span className="pos-product-row__stock-detail">
                      {item.isInitialized && item.registeredQuantity !== null ? (
                        <>
                          Existencia:{' '}
                          <strong>
                            {formatQuantityWithUnit(
                              item.registeredQuantity,
                              product.unit,
                            )}
                          </strong>
                          {item.inCartQuantity > 0 &&
                          item.remainingAvailableQuantity !== null ? (
                            <>
                              {' '}
                              · Restante para agregar:{' '}
                              <strong>
                                {formatQuantityWithUnit(
                                  item.remainingAvailableQuantity,
                                  product.unit,
                                )}
                              </strong>
                            </>
                          ) : null}
                        </>
                      ) : (
                        'Inventario sin inicializar en esta sucursal'
                      )}
                    </span>
                  </div>

                  {!item.canSell && item.blockReason ? (
                    <p className="pos-product-row__block-reason">
                      No vendible: {item.blockReason}
                    </p>
                  ) : null}
                </div>

                <div className="pos-product-row__side">
                  <div className="pos-product-row__price-box">
                    <span className="pos-product-row__price">
                      {formattedPrice}
                    </span>
                    <span className="pos-product-row__unit">
                      por {unitLabel.toLowerCase()} ({catalogCurrency})
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant={item.canSell ? 'primary' : 'outline'}
                    size="sm"
                    disabled={!item.canSell}
                    onClick={() => onAddProduct(item)}
                  >
                    {item.canSell ? '+ Agregar' : 'No disponible'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
