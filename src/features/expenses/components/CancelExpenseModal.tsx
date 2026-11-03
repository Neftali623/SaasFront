import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import type { CashSession } from '../../cash/types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { generateExpenseId } from '../services/expensesRepository'
import type { CancelExpensePayload, ExpenseRecord } from '../types'

export interface CancelExpenseModalProps {
  expense: ExpenseRecord
  openSession: CashSession | null
  operatorName: string
  isSubmitting: boolean
  onConfirmCancel: (payload: CancelExpensePayload) => void
  onClose: () => void
}

export function CancelExpenseModal({
  expense,
  openSession,
  operatorName,
  isSubmitting,
  onConfirmCancel,
  onClose,
}: CancelExpenseModalProps) {
  const titleId = useId()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [cashReturnedConfirmed, setCashReturnedConfirmed] = useState(false)
  const [externalReversalConfirmed, setExternalReversalConfirmed] = useState(false)

  const [operationId] = useState(() => generateExpenseId('op-can'))

  const isCash = expense.paymentMethod === 'cash'
  const isOriginalSessionOpen =
    isCash && openSession !== null && openSession.id === expense.cashSessionId

  const isBlockedByClosedSession = isCash && !isOriginalSessionOpen

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || isBlockedByClosedSession) return

    const cleanReason = reason.trim()
    if (!cleanReason) {
      setReasonError('El motivo de la anulación es obligatorio.')
      return
    }
    if (cleanReason.length < 5) {
      setReasonError('Ingresa un motivo descriptivo de al menos 5 caracteres.')
      return
    }

    if (isCash && !cashReturnedConfirmed) {
      setReasonError(
        'Debes confirmar que el dinero físico fue devuelto al cajón de caja.',
      )
      return
    }

    if (!isCash && !externalReversalConfirmed) {
      setReasonError(
        'Debes confirmar la reversión o cancelación administrativa externa.',
      )
      return
    }

    setReasonError(null)
    onConfirmCancel({
      expenseId: expense.id,
      reason: cleanReason,
      operatorName,
      operationId,
      cashReturnedConfirmed: isCash ? cashReturnedConfirmed : undefined,
    })
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="modal-dialog">
        <header className="modal-dialog__header">
          <div className="modal-dialog__title-group">
            <h3 id={titleId} className="modal-dialog__title">
              Anular gasto · Folio {expense.folio}
            </h3>
            <p className="modal-dialog__subtitle">
              Concepto: &quot;{expense.concept}&quot; ·{' '}
              {formatCentsWithHistoricalCurrency(expense.amountCents, expense.currency)}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal de anulación"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cancel-expense-form">
          {isBlockedByClosedSession ? (
            <div className="alert-box alert-box--warning" role="alert">
              <strong>Anulación bloqueada en esta fase:</strong>
              <p>
                La sesión de caja original (<code>{expense.cashSessionId}</code>)
                en la que se desembolsó este gasto ya fue cerrada. Por control de
                arqueo y trazabilidad histórica, no es posible reintegrar
                automáticamente efectivo a un turno anterior cerrado.
              </p>
            </div>
          ) : (
            <div className="alert-box alert-box--info" role="status">
              <strong>Operación trazable e inmutable:</strong>
              <p>
                El gasto no se eliminará; quedará marcado como <strong>Anulado</strong>{' '}
                con tu usuario, motivo y fecha.
                {isCash
                  ? ' Se generará una entrada compensatoria en la sesión de caja abierta para reintegrar el saldo.'
                  : ' No alterará la caja física por haberse liquidado de forma externa.'}
              </p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="cancel-expense-reason" className="form-label">
              Motivo de anulación <span className="text-danger">*</span>
            </label>
            <textarea
              id="cancel-expense-reason"
              className={`form-textarea ${reasonError ? 'form-textarea--error' : ''}`}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError(null)
              }}
              placeholder="Explica detalladamente por qué se anula este gasto (ej. Error de captura, factura duplicada, cancelación de compra...)"
              disabled={isSubmitting || isBlockedByClosedSession}
              autoFocus
            />
            {reasonError ? (
              <span className="form-field-error" role="alert">
                {reasonError}
              </span>
            ) : null}
          </div>

          {isCash && !isBlockedByClosedSession ? (
            <div className="form-checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={cashReturnedConfirmed}
                  onChange={(e) => setCashReturnedConfirmed(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>
                  Confirmo que el importe de{' '}
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      expense.amountCents,
                      expense.currency,
                    )}
                  </strong>{' '}
                  fue devuelto físicamente a la caja registradora abierta.
                </span>
              </label>
            </div>
          ) : null}

          {!isCash ? (
            <div className="form-checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={externalReversalConfirmed}
                  onChange={(e) =>
                    setExternalReversalConfirmed(e.target.checked)
                  }
                  disabled={isSubmitting}
                />
                <span>
                  Confirmo que el desembolso fue cancelado o revertido
                  administrativamente con la entidad externa.
                </span>
              </label>
            </div>
          ) : null}

          <footer className="modal-dialog__actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="ui-btn--danger"
              disabled={
                isSubmitting ||
                isBlockedByClosedSession ||
                !reason.trim() ||
                (isCash && !cashReturnedConfirmed) ||
                (!isCash && !externalReversalConfirmed)
              }
            >
              {isSubmitting ? 'Procesando anulación...' : 'Confirmar anulación'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  )
}

