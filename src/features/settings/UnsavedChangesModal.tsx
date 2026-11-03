import { useEffect, useId, useRef } from 'react'
import { Button } from '../../components/ui/Button'

export interface UnsavedChangesModalProps {
  currentOrgName: string
  targetOrgName: string
  onSaveAndSwitch: () => void
  onDiscardAndSwitch: () => void
  onCancelSwitch: () => void
}

export function UnsavedChangesModal({
  currentOrgName,
  targetOrgName,
  onSaveAndSwitch,
  onDiscardAndSwitch,
  onCancelSwitch,
}: UnsavedChangesModalProps) {
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const primaryActionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    primaryActionRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelSwitch()
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
  }, [onCancelSwitch])

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
          Cambios sin guardar en {currentOrgName}
        </h2>
        <p id={descId} className="modal-dialog__description">
          Estás intentando cambiar a la organización{' '}
          <strong>{targetOrgName}</strong> mientras tienes ajustes pendientes en{' '}
          <strong>{currentOrgName}</strong>. Elige qué deseas hacer antes de
          cambiar de negocio para evitar perder o mezclar configuraciones.
        </p>

        <div className="modal-dialog__actions">
          <Button
            ref={primaryActionRef}
            variant="primary"
            onClick={onSaveAndSwitch}
          >
            Guardar en {currentOrgName} y cambiar
          </Button>
          <Button variant="outline" onClick={onDiscardAndSwitch}>
            Descartar cambios y cambiar
          </Button>
          <Button variant="ghost" onClick={onCancelSwitch}>
            Seguir editando
          </Button>
        </div>
      </div>
    </div>
  )
}

