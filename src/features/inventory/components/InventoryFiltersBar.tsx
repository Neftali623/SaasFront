import { useId } from 'react'
import { Button } from '../../../components/ui/Button'
import type { ProductCategory, ProductStatus } from '../../products/types'
import type {
  InventoryListFilters,
  InventoryStatusFilterValue,
} from '../types'

export interface InventoryFiltersBarProps {
  filters: InventoryListFilters
  categories: ProductCategory[]
  totalCatalogCount: number
  filteredCount: number
  pageStartIndex: number
  pageEndIndex: number
  onChangeSearch: (query: string) => void
  onChangeCategory: (categoryId: string) => void
  onChangeProductStatus: (status: 'all' | ProductStatus) => void
  onChangeStockStatus: (status: InventoryStatusFilterValue) => void
  onResetFilters: () => void
}

export function InventoryFiltersBar({
  filters,
  categories,
  totalCatalogCount,
  filteredCount,
  pageStartIndex,
  pageEndIndex,
  onChangeSearch,
  onChangeCategory,
  onChangeProductStatus,
  onChangeStockStatus,
  onResetFilters,
}: InventoryFiltersBarProps) {
  const searchInputId = useId()
  const categorySelectId = useId()
  const prodStatusSelectId = useId()
  const stockStatusSelectId = useId()

  const hasActiveFilters =
    filters.searchQuery.trim().length > 0 ||
    filters.categoryFilter !== 'all' ||
    filters.productStatusFilter !== 'all' ||
    filters.stockStatusFilter !== 'all'

  return (
    <section
      className="products-filters-card"
      aria-label="Búsqueda y filtros de existencias"
    >
      <div className="inventory-filters-grid">
        <div className="products-filters-search">
          <label htmlFor={searchInputId} className="ui-input__label">
            Buscar por nombre, SKU o código
          </label>
          <input
            id={searchInputId}
            type="search"
            className="ui-input__control"
            value={filters.searchQuery}
            onChange={(event) => onChangeSearch(event.target.value)}
            placeholder="Ej. Hojas bond, PAP-BON-500 o 0075010553108..."
          />
        </div>

        <div className="ui-select-field">
          <label htmlFor={categorySelectId} className="ui-input__label">
            Categoría
          </label>
          <select
            id={categorySelectId}
            className="ui-select-field__control"
            value={filters.categoryFilter}
            onChange={(event) => onChangeCategory(event.target.value)}
          >
            <option value="all">Todas las categorías</option>
            <option value="uncategorized">Sin categoría asignada</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
                {cat.status === 'inactive' ? ' (Inactiva)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-select-field">
          <label htmlFor={prodStatusSelectId} className="ui-input__label">
            Estado del producto
          </label>
          <select
            id={prodStatusSelectId}
            className="ui-select-field__control"
            value={filters.productStatusFilter}
            onChange={(event) =>
              onChangeProductStatus(
                event.target.value as 'all' | ProductStatus,
              )
            }
          >
            <option value="all">Todos (activos e inactivos)</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
        </div>

        <div className="ui-select-field">
          <label htmlFor={stockStatusSelectId} className="ui-input__label">
            Estado de inventario
          </label>
          <select
            id={stockStatusSelectId}
            className="ui-select-field__control"
            value={filters.stockStatusFilter}
            onChange={(event) =>
              onChangeStockStatus(
                event.target.value as InventoryStatusFilterValue,
              )
            }
          >
            <option value="all">Todos los estados de stock</option>
            <option value="available">Disponible</option>
            <option value="low_stock">Bajo mínimo</option>
            <option value="out_of_stock">Sin existencias (0)</option>
            <option value="uninitialized">Sin inicializar</option>
            <option value="no_min">Sin mínimo configurado</option>
          </select>
        </div>
      </div>

      <div className="products-filters-footer">
        <p className="products-filters-count" role="status" aria-live="polite">
          {filteredCount === 0 ? (
            <>
              Mostrando <strong>0</strong> de{' '}
              <strong>{totalCatalogCount}</strong> artículos del catálogo
            </>
          ) : (
            <>
              Mostrando{' '}
              <strong>
                {pageStartIndex}–{pageEndIndex}
              </strong>{' '}
              de <strong>{filteredCount}</strong>{' '}
              {filteredCount === 1 ? 'artículo' : 'artículos'}
              {hasActiveFilters ? ` (total: ${totalCatalogCount})` : ''}
            </>
          )}
        </p>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </section>
  )
}

