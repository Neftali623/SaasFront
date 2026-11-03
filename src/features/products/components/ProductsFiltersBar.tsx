import { useId } from 'react'
import { Button } from '../../../components/ui/Button'
import type {
  ProductCatalogFilters,
  ProductCategory,
  StatusFilterValue,
} from '../types'

export interface ProductsFiltersBarProps {
  filters: ProductCatalogFilters
  categories: ProductCategory[]
  totalCatalogCount: number
  filteredCount: number
  pageStartIndex: number
  pageEndIndex: number
  onChangeSearch: (value: string) => void
  onChangeCategory: (value: string) => void
  onChangeStatus: (value: StatusFilterValue) => void
  onResetFilters: () => void
}

export function ProductsFiltersBar({
  filters,
  categories,
  totalCatalogCount,
  filteredCount,
  pageStartIndex,
  pageEndIndex,
  onChangeSearch,
  onChangeCategory,
  onChangeStatus,
  onResetFilters,
}: ProductsFiltersBarProps) {
  const searchId = useId()
  const categoryId = useId()
  const statusId = useId()

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.categoryFilter !== 'all' ||
    filters.statusFilter !== 'all'

  return (
    <section
      className="products-filters-card"
      aria-label="Búsqueda y filtros del catálogo de productos"
    >
      <div className="products-filters-grid">
        <div className="products-filters-grid__search">
          <label htmlFor={searchId} className="ui-input__label">
            Buscar por nombre, SKU o código de barras
          </label>
          <input
            id={searchId}
            type="search"
            className="ui-input__control"
            value={filters.searchQuery}
            onChange={(event) => onChangeSearch(event.target.value)}
            placeholder="Ej. Cuaderno, PAP-BON-500 o 0075010553108"
          />
        </div>

        <div className="ui-select-field">
          <label htmlFor={categoryId} className="ui-input__label">
            Categoría
          </label>
          <select
            id={categoryId}
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
          <label htmlFor={statusId} className="ui-input__label">
            Estado del producto
          </label>
          <select
            id={statusId}
            className="ui-select-field__control"
            value={filters.statusFilter}
            onChange={(event) =>
              onChangeStatus(event.target.value as StatusFilterValue)
            }
          >
            <option value="all">Todos (activos e inactivos)</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
        </div>
      </div>

      <div className="products-filters-footer">
        <p className="products-filters-footer__summary" aria-live="polite">
          {filteredCount === 0 ? (
            <>
              <strong>0 resultados</strong> de {totalCatalogCount}{' '}
              {totalCatalogCount === 1
                ? 'producto registrado'
                : 'productos registrados'}
            </>
          ) : (
            <>
              Mostrando{' '}
              <strong>
                {pageStartIndex}–{pageEndIndex}
              </strong>{' '}
              de <strong>{filteredCount}</strong>{' '}
              {filteredCount === 1 ? 'producto' : 'productos'}
              {hasActiveFilters
                ? ` (filtrado de ${totalCatalogCount} en total)`
                : ''}
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

