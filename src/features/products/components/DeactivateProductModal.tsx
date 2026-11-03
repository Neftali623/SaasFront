import { useEffect, useId, useRef } from 'react'
import { Button } from '../../../components/ui/Button'
import type { Product } from '../types'

export interface DeactivateProductModalProps {
  product: Product
  onConfirmDeactivate: () => void
  onCancel: () => void
}

export function DeactivateProductModal({
  product,
  onConfirmDeactivate,
  onCancel,
}: DeactivateProductModalProps) {
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    confirmButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) {
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <h2 id={titleId} className="modal-dialog__title">
          ¿Desactivar "{product.name}"?
        </h2>
        <div id={descId} className="modal-dialog__description">
          <p>
            El producto <strong>{product.name}</strong> (SKU:{' '}
            <code>{product.sku}</code>) cambiará a estado{' '}
            <strong>Inactivo</strong>:
          </p>
          <ul className="modal-bullet-list">
            <li>
              Impedirá su selección en nuevas ventas cuando se conecte el módulo
              de Punto de venta.
            </li>
            <li>
              Se conservará su registro histórico y podrás reactivarlo cuando lo
              necesites.
            </li>
            <li>
              Su SKU y sus códigos asociados (
              {product.barcodes.length > 0
                ? product.barcodes.join(', ')
                : 'sin códigos'}
              ) seguirán reservados en esta organización para evitar colisiones.
            </li>
          </ul>
        </div>

        <div className="modal-dialog__actions">
          <Button
            ref={confirmButtonRef}
            variant="secondary"
            onClick={onConfirmDeactivate}
          >
            Confirmar desactivación
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

