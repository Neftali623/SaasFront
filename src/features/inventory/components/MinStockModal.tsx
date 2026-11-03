import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { getUnitLabel } from '../../products/utils/validation'
import type { EnrichedInventoryItem } from '../types'
import {
  formatQuantityNumber,
  formatQuantityWithUnit,
  getUnitPrecisionRuleDescription,
  parseStrictQuantityInput,
} from '../utils/quantityUtils'

export interface MinStockModalProps {
  item: EnrichedInventoryItem
  organizationName: string
  branchName: string
  onSaveMinStock: (
    productId: string,
    minStock: number | null,
  ) => { ok: boolean; error?: string }
  onClose: () => void
}

export function MinStockModal({
  item,
  organizationName,
  branchName,
  onSaveMinStock,
  onClose,
}: MinStockModalProps) {
  const unitLabel = getUnitLabel(item.unit)

  const [minStockInput, setMinStockInput] = useState<string>(() =>
    item.minStock === null
      ? ''
      : formatQuantityNumber(item.minStock, item.unit).replace(/,/g, ''),
  )
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(undefined)

    const parsed = parseStrictQuantityInput(minStockInput, item.unit, {
      allowZero: true,
      allowEmptyAsNull: true,
      fieldLabel: 'existencia mínima',
    })

    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const outcome = onSaveMinStock(item.productId, parsed.value)
    if (!outcome.ok) {
      setError(
        outcome.error ??
          'No se pudo actualizar el mínimo de stock. Tus datos se conservaron.',
      )
      return
    }

    onClose()
  }

  const handleClearMinimum = () => {
    setError(undefined)
    const outcome = onSaveMinStock(item.productId, null)
    if (!outcome.ok) {
      setError(
        outcome.error ?? 'No se pudo quitar el mínimo configurado.',
      )
      return
    }
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="min-stock-modal-title"
      aria-describedby="min-stock-modal-desc"
    >
      <div className="modal-dialog">
        <div className="modal-dialog__header">
          <Badge variant="brand">Umbral de reabastecimiento</Badge>
          <h2 id="min-stock-modal-title" className="modal-dialog__title">
            Configurar stock mínimo: &ldquo;{item.productName}&rdquo;
          </h2>
        </div>

        <p id="min-stock-modal-desc" className="modal-dialog__desc">
          Define el mínimo de existencias para{' '}
          <strong>{item.productName}</strong> (SKU: <code>{item.sku}</code>) en{' '}
          <strong>{organizationName}</strong> ({branchName}).
        </p>

        <div className="modal-dialog__notes">
          <p className="inventory-precision-banner">
            {getUnitPrecisionRuleDescription(item.unit)}
          </p>
          <ul className="deactivate-impact-list">
            <li>
              Existencia actual registrada:{' '}
              <strong>
                {formatQuantityWithUnit(item.quantity ?? 0, item.unit)}
              </strong>
              .
            </li>
            <li>
              <strong>Sin mínimo (campo vacío)</strong>: el artículo no genera
              alertas de reabastecimiento.
            </li>
            <li>
              <strong>Mínimo en cero (0)</strong>: registra explícitamente un
              umbral <code>0 {unitLabel}</code> (distinto de no tener mínimo).
            </li>
            <li>
              Cambiar o quitar el mínimo actualiza las alertas inmediatamente y{' '}
              <strong>no crea un movimiento de existencias</strong> en el
              historial.
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="product-form-stack" noValidate>
          <Input
            label={`Stock mínimo (${unitLabel})`}
            inputMode="decimal"
            autoFocus
            value={minStockInput}
            onChange={(event) => {
              setMinStockInput(event.target.value)
              if (error) {
                setError(undefined)
              }
            }}
            placeholder={`Vacío para Sin mínimo, o ej. 0, 5, 12`}
            helpText={`Actualmente: ${
              item.minStock === null
                ? 'Sin mínimo configurado'
                : item.minStock === 0
                  ? `0 ${unitLabel} (Mínimo configurado en cero)`
                  : formatQuantityWithUnit(item.minStock, item.unit)
            }`}
            error={error}
          />

          <div className="modal-dialog__actions">
            <Button type="submit" variant="primary">
              Guardar mínimo
            </Button>
            {item.minStock !== null ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleClearMinimum}
              >
                Quitar mínimo (dejar Sin mínimo)
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
