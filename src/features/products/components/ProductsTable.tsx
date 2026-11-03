import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { CurrencyCode } from '../../../types'
import { formatAmountByCurrency } from '../../settings/formatters'
import type { Product, ProductCategory } from '../types'
import { getUnitLabel } from '../utils/validation'

export interface ProductsTableProps {
  products: Product[]
  categoriesById: Map<string, ProductCategory>
  currency: CurrencyCode
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onEditProduct: (product: Product) => void
  onViewInventory: (product: Product) => void
  onRequestDeactivate: (product: Product) => void
  onReactivateProduct: (product: Product) => void
}

export function ProductsTable({
  products,
  categoriesById,
  currency,
  currentPage,
  totalPages,
  onPageChange,
  onEditProduct,
  onViewInventory,
  onRequestDeactivate,
  onReactivateProduct,
}: ProductsTableProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div className="products-table-card">
      <div className="products-table-wrapper">
        <table className="products-table">
          <thead>
            <tr>
              <th scope="col">Producto y SKU</th>
              <th scope="col">Categoría</th>
              <th scope="col">Códigos asociados</th>
              <th scope="col">Unidad</th>
              <th scope="col" className="products-table__num-col">
                Precio venta
              </th>
              <th scope="col" className="products-table__num-col">
                Costo (vista demo)
              </th>
              <th scope="col">Estado</th>
              <th scope="col" className="products-table__actions-col">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const category = product.categoryId
                ? categoriesById.get(product.categoryId)
                : undefined
              const primaryBarcode = product.barcodes[0]
              const extraBarcodesCount = Math.max(
                0,
                product.barcodes.length - 1,
              )

              return (
                <tr
                  key={product.id}
                  className={
                    product.status === 'inactive'
                      ? 'products-table__row--inactive'
                      : ''
                  }
                >
                  <td data-label="Producto y SKU">
                    <div className="product-cell-main">
                      <span className="product-cell-main__name">
                        {product.name}
                      </span>
                      <div className="product-cell-main__meta">
                        <code className="product-cell-main__sku">
                          SKU: {product.sku}
                        </code>
                      </div>
                      {product.description ? (
                        <p className="product-cell-main__desc">
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  <td data-label="Categoría">
                    {category ? (
                      <div className="product-cell-category">
                        <span>{category.name}</span>
                        {category.status === 'inactive' ? (
                          <Badge variant="warning">Categoría inactiva</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="product-cell-muted">Sin categoría</span>
                    )}
                  </td>

                  <td data-label="Códigos asociados">
                    {primaryBarcode ? (
                      <div
                        className="product-cell-barcodes"
                        title={product.barcodes.join(', ')}
                      >
                        <code className="product-cell-barcodes__code">
                          {primaryBarcode}
                        </code>
                        {extraBarcodesCount > 0 ? (
                          <Badge variant="neutral">
                            +{extraBarcodesCount} más
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="product-cell-muted">Sin códigos</span>
                    )}
                  </td>

                  <td data-label="Unidad">{getUnitLabel(product.unit)}</td>

                  <td
                    data-label="Precio venta"
                    className="products-table__num-col"
                  >
                    <strong className="product-cell-price">
                      {formatAmountByCurrency(product.salePrice, currency)}
                    </strong>
                  </td>

                  <td
                    data-label="Costo (vista demo)"
                    className="products-table__num-col"
                  >
                    {product.cost === null ? (
                      <span className="product-cell-muted">No registrado</span>
                    ) : (
                      <span className="product-cell-cost">
                        {formatAmountByCurrency(product.cost, currency)}
                      </span>
                    )}
                  </td>

                  <td data-label="Estado">
                    <Badge
                      variant={
                        product.status === 'active' ? 'success' : 'neutral'
                      }
                    >
                      {product.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>

                  <td
                    data-label="Acciones"
                    className="products-table__actions-col"
                  >
                    <div className="product-row-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewInventory(product)}
                        aria-label={`Ver inventario de ${product.name}`}
                      >
                        Inventario
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                        aria-label={`Editar ${product.name}`}
                      >
                        Editar
                      </Button>
                      {product.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestDeactivate(product)}
                          aria-label={`Desactivar ${product.name}`}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onReactivateProduct(product)}
                          aria-label={`Reactivar ${product.name}`}
                        >
                          Reactivar
                        </Button>
                      )}
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
          aria-label="Paginación del catálogo de productos"
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

