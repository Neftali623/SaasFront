import { useId, useRef, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { formatQuantityWithUnit } from '../../inventory/utils/quantityUtils'
import type { ProductCategory } from '../../products/types'
import type { BarcodeScanResult } from '../types'

export interface PosScannerAndSearchBarProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (categoryId: string) => void
  categories: ProductCategory[]
  onScanBarcode: (rawBarcode: string) => void
  lastScanResult: BarcodeScanResult | null
  onDismissScanResult: () => void
  isCheckoutActive: boolean
  totalActiveCatalogCount: number
  filteredActiveCount: number
}

export function PosScannerAndSearchBar({
  searchQuery,
  onSearchQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  onScanBarcode,
  lastScanResult,
  onDismissScanResult,
  isCheckoutActive,
  totalActiveCatalogCount,
  filteredActiveCount,
}: PosScannerAndSearchBarProps) {
  const scanInputId = useId()
  const searchInputId = useId()
  const categorySelectId = useId()
  const scanInputRef = useRef<HTMLInputElement | null>(null)
  const [scanCodeInput, setScanCodeInput] = useState('')

  const triggerBarcodeScan = () => {
    if (isCheckoutActive) {
      return
    }
    const raw = scanCodeInput
    onScanBarcode(raw)
    setScanCodeInput('')
    // Mantiene el foco en el campo de escaneo para permitir ráfagas de lector USB HID
    scanInputRef.current?.focus()
  }

  const handleScanKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      triggerBarcodeScan()
    }
  }

  const hasActiveFilters =
    searchQuery.trim().length > 0 || categoryFilter !== 'all'

  return (
    <div className="pos-scanner-search-panel">
      <div className="pos-scanner-box">
        <div className="pos-scanner-box__header">
          <label htmlFor={scanInputId} className="pos-scanner-box__label">
            Escaneo de código de barras (USB HID / manual)
          </label>
          <Badge variant={isCheckoutActive ? 'neutral' : 'brand'}>
            {isCheckoutActive
              ? 'Escaneo en pausa durante cobro'
              : 'Listo para lector o Enter'}
          </Badge>
        </div>

        <div className="pos-scanner-box__controls">
          <input
            ref={scanInputRef}
            id={scanInputId}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            className="form-input pos-scanner-box__input"
            placeholder="Escanea o escribe el código exacto (ej. 0075010553108) y presiona Enter..."
            value={scanCodeInput}
            disabled={isCheckoutActive}
            onChange={(event) => setScanCodeInput(event.target.value)}
            onKeyDown={handleScanKeyDown}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isCheckoutActive || !scanCodeInput.trim()}
            onClick={triggerBarcodeScan}
          >
            Agregar código
          </Button>
        </div>

        <p className="pos-scanner-box__hint">
          Conserva ceros iniciales como texto. Si el producto ya está en el
          carrito, incrementa su cantidad respetando la existencia disponible.
        </p>

        {lastScanResult ? (
          <div
            className={`pos-scan-feedback ${
              lastScanResult.ok
                ? 'pos-scan-feedback--success'
                : 'pos-scan-feedback--error'
            }`}
            role={lastScanResult.ok ? 'status' : 'alert'}
            aria-live="polite"
          >
            <div className="pos-scan-feedback__body">
              {lastScanResult.ok ? (
                <>
                  <strong>
                    Código <code>{lastScanResult.code}</code> agregado:
                  </strong>{' '}
                  {lastScanResult.productName} ({lastScanResult.sku}) · +
                  {formatQuantityWithUnit(
                    lastScanResult.addedQuantity,
                    lastScanResult.unit,
                  )}{' '}
                  (En carrito:{' '}
                  {formatQuantityWithUnit(
                    lastScanResult.newCartQuantity,
                    lastScanResult.unit,
                  )}
                  )
                </>
              ) : (
                <>
                  <strong>
                    No se agregó{' '}
                    {lastScanResult.code ? (
                      <code>{lastScanResult.code}</code>
                    ) : (
                      'el código'
                    )}
                    :
                  </strong>{' '}
                  {lastScanResult.message}
                </>
              )}
            </div>
            <button
              type="button"
              className="pos-scan-feedback__dismiss"
              onClick={onDismissScanResult}
              aria-label="Cerrar aviso de escaneo"
            >
              Cerrar
            </button>
          </div>
        ) : null}
      </div>

      <div className="pos-search-filters">
        <div className="pos-search-filters__field pos-search-filters__field--grow">
          <label htmlFor={searchInputId} className="form-label">
            Buscar producto por nombre, SKU o código
          </label>
          <input
            id={searchInputId}
            type="search"
            autoComplete="off"
            className="form-input"
            placeholder="Ej. Café, Aceite, 00750, SKU..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </div>

        <div className="pos-search-filters__field">
          <label htmlFor={categorySelectId} className="form-label">
            Categoría
          </label>
          <select
            id={categorySelectId}
            className="form-select"
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
            <option value="uncategorized">Sin categoría</option>
          </select>
        </div>

        <div className="pos-search-filters__meta">
          <span className="pos-search-filters__count">
            Mostrando <strong>{filteredActiveCount}</strong> de{' '}
            <strong>{totalActiveCatalogCount}</strong> productos activos
          </span>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchQueryChange('')
                onCategoryFilterChange('all')
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

