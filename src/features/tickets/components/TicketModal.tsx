import { useEffect, useId, useRef, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { defaultTicketSnapshotService } from '../services/ticketSnapshotService'
import type { TicketPrintState, TicketSnapshot } from '../types'
import { TicketViewer } from './TicketViewer'

export interface TicketModalProps {
  isOpen?: boolean
  snapshot: TicketSnapshot | null
  isReprint?: boolean
  operatorName?: string
  organizationId?: string
  onClose: () => void
  onReprintLogged?: (updated: TicketSnapshot) => void
}

export function TicketModal({
  isOpen = true,
  snapshot,
  isReprint = false,
  operatorName,
  organizationId,
  onClose,
  onReprintLogged,
}: TicketModalProps) {
  const titleId = useId()
  const printButtonRef = useRef<HTMLButtonElement | null>(null)
  const [printState, setPrintState] = useState<TicketPrintState>('idle')
  const [reprintedSnapshot, setReprintedSnapshot] = useState<TicketSnapshot | null>(null)
  const currentSnapshot = reprintedSnapshot ?? snapshot

  // Enfocar el botón de impresión al abrir el modal
  useEffect(() => {
    if (isOpen) {
      printButtonRef.current?.focus()
    }
  }, [isOpen])

  // Manejo de teclado (Escape)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !currentSnapshot) {
    return null
  }

  const effectiveOperator =
    operatorName || currentSnapshot.operatorName || 'Operador de turno'

  const handlePrint = () => {
    setPrintState('preparing')

    // Si es una reimpresión de una venta existente, registrar en la bitácora de auditoría
    if (isReprint && !currentSnapshot.id.startsWith('mock-')) {
      const targetOrg = organizationId || currentSnapshot.organizationId
      const updated = defaultTicketSnapshotService.registerTicketReprint({
        organizationId: targetOrg,
        ticketId: currentSnapshot.id,
        operatorName: effectiveOperator,
        reason: 'Reimpresión solicitada desde historial/detalle de venta',
      })
      if (updated) {
        setReprintedSnapshot(updated)
        onReprintLogged?.(updated)
      }
    }

    // Preparar el DOM para la salida de impresión monocromática limpia
    document.body.classList.add('ticket-print-active')

    // Breve pausa para asegurar renderizado y recursos antes del diálogo de impresión nativo
    setTimeout(() => {
      setPrintState('dialog_opened')
      try {
        window.print()
      } catch (err) {
        console.warn('[TicketModal] Error al invocar window.print():', err)
        setPrintState('error')
      } finally {
        document.body.classList.remove('ticket-print-active')
      }
    }, 120)
  }

  const is58mm = currentSnapshot.configSnapshot.paperWidth === '58mm'

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog ticket-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ticket-dialog__header">
          <div>
            <h2 id={titleId} className="modal-dialog__title">
              {isReprint ? 'Reimpresión de comprobante' : 'Comprobante de compra'}
            </h2>
            <p className="modal-dialog__description">
              {currentSnapshot.ticketFolio} · Perfil térmico {is58mm ? '58 mm' : '80 mm'} ({currentSnapshot.configSnapshot.templateKind})
            </p>
          </div>

          <div className="ticket-dialog__badges">
            {isReprint ? (
              <Badge variant="warning">Copia / Reimpresión</Badge>
            ) : (
              <Badge variant="brand">{currentSnapshot.currency}</Badge>
            )}
          </div>
        </div>

        {/* Contenedor scrolleable del ticket */}
        <div className="ticket-dialog__preview-container">
          <div className="ticket-dialog__preview-stage">
            <TicketViewer
              snapshot={currentSnapshot}
              isReprint={isReprint}
              reprintOperator={operatorName}
            />
          </div>
        </div>

        {printState === 'error' ? (
          <p className="form-error" role="alert">
            No se pudo abrir el diálogo de impresión del navegador. Verifica los permisos de ventanas emergentes o imprime manualmente con Ctrl+P.
          </p>
        ) : null}

        <p className="ticket-dialog__help-text text-muted">
          Nota de impresión: El navegador abrirá el diálogo estándar. Para el mejor ajuste en impresoras térmicas, desactiva &quot;Encabezados y pies de página&quot; en las opciones de impresión.
        </p>

        <div className="modal-dialog__actions ticket-dialog__actions">
          <Button
            ref={printButtonRef}
            type="button"
            variant="primary"
            onClick={handlePrint}
            disabled={printState === 'preparing'}
          >
            {printState === 'preparing'
              ? 'Preparando documento...'
              : 'Imprimir desde el navegador'}
          </Button>

          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
