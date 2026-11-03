import { useEffect, useId, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { OrganizationPreferences } from '../../../types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import {
  getExpenseAttachmentObjectUrl,
  revokeExpenseAttachmentObjectUrl,
} from '../services/durableAttachmentStorage'
import type { ExpenseRecord } from '../types'

export interface ExpenseDetailModalProps {
  expense: ExpenseRecord
  preferences: OrganizationPreferences
  onClose: () => void
  onCancelExpense?: (expense: ExpenseRecord) => void
}

export function ExpenseDetailModal({
  expense,
  preferences,
  onClose,
  onCancelExpense,
}: ExpenseDetailModalProps) {
  const titleId = useId()
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [loadingAttachment, setLoadingAttachment] = useState<boolean>(() => Boolean(expense.attachment))

  const isCancelled = expense.status === 'cancelled'
  const isCash = expense.paymentMethod === 'cash'

  const registeredDt = formatDateTimeInOrganizationTimezone(
    expense.createdAt,
    preferences.timezone,
    preferences.dateFormat,
  )

  const cancelledDt = expense.cancellation
    ? formatDateTimeInOrganizationTimezone(
        expense.cancellation.cancelledAt,
        preferences.timezone,
        preferences.dateFormat,
      )
    : null

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    if (expense.attachment) {
      getExpenseAttachmentObjectUrl(expense.attachment.storageKey)
        .then((result) => {
          if (active) {
            if (result) {
              createdUrl = result.url
              setAttachmentUrl(result.url)
            }
            setLoadingAttachment(false)
          } else if (result) {
            revokeExpenseAttachmentObjectUrl(result.url)
          }
        })
        .catch(() => {
          if (active) {
            setLoadingAttachment(false)
          }
        })
    }

    return () => {
      active = false
      if (createdUrl) {
        revokeExpenseAttachmentObjectUrl(createdUrl)
      }
    }
  }, [expense.attachment])

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="modal-dialog modal-dialog--lg">
        <header className="modal-dialog__header">
          <div className="modal-dialog__title-group">
            <div className="modal-dialog__title-row">
              <h3 id={titleId} className="modal-dialog__title">
                Gasto {expense.folio}
              </h3>
              <Badge variant={isCancelled ? 'neutral' : 'warning'}>
                {isCancelled ? 'Anulado' : 'Vigente'}
              </Badge>
            </div>
            <p className="modal-dialog__subtitle">
              {expense.branchName} · {expense.categoryName}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar detalle de gasto"
          >
            ✕
          </button>
        </header>

        <div className="expense-detail-body">
          {/* Tarjeta de Importe y Concepto */}
          <div className="expense-detail-hero">
            <span className="expense-detail-hero__label">Importe del desembolso</span>
            <div className="expense-detail-hero__amount">
              {formatCentsWithHistoricalCurrency(
                expense.amountCents,
                expense.currency,
              )}
            </div>
            <p className="expense-detail-hero__concept">
              &quot;{expense.concept}&quot;
            </p>
          </div>

          {/* Grilla de metadatos */}
          <div className="pos-receipt-meta-grid">
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Fecha efectiva</span>
              <strong className="pos-receipt-meta-item__value">
                {expense.expenseDate}
              </strong>
            </div>
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Fecha de registro</span>
              <strong className="pos-receipt-meta-item__value">
                {registeredDt.dateLabel} {registeredDt.timeLabel}
              </strong>
            </div>
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Método de pago</span>
              <strong className="pos-receipt-meta-item__value">
                {expense.paymentMethod === 'cash'
                  ? 'Efectivo en caja'
                  : expense.paymentMethod === 'card'
                    ? 'Tarjeta (manual)'
                    : 'Transferencia bancaria'}
              </strong>
            </div>
            <div className="pos-receipt-meta-item">
              <span className="pos-receipt-meta-item__label">Registrado por</span>
              <strong className="pos-receipt-meta-item__value">
                {expense.registeredBy}
              </strong>
            </div>
            {expense.externalReference ? (
              <div className="pos-receipt-meta-item">
                <span className="pos-receipt-meta-item__label">Referencia</span>
                <strong className="pos-receipt-meta-item__value">
                  <code>{expense.externalReference}</code>
                </strong>
              </div>
            ) : null}
            {isCash ? (
              <div className="pos-receipt-meta-item">
                <span className="pos-receipt-meta-item__label">
                  Sesión y movimiento de caja
                </span>
                <strong className="pos-receipt-meta-item__value">
                  Sesión: <code>{expense.cashSessionId ?? 'n/a'}</code>
                </strong>
              </div>
            ) : null}
          </div>

          {/* Bloque de Anulación si aplica */}
          {isCancelled && expense.cancellation ? (
            <div className="alert-box alert-box--warning" role="region" aria-label="Detalles de anulación">
              <strong>Gasto anulado</strong>
              <p>
                <strong>Fecha:</strong> {cancelledDt?.dateLabel}{' '}
                {cancelledDt?.timeLabel} · <strong>Por:</strong>{' '}
                {expense.cancellation.cancelledBy}
              </p>
              <p>
                <strong>Motivo:</strong> &quot;{expense.cancellation.reason}&quot;
              </p>
              {expense.cancellation.cashMovementId ? (
                <p>
                  <strong>Reintegro a caja:</strong> Movimiento compensatorio{' '}
                  <code>{expense.cancellation.cashMovementId}</code>
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Comprobante adjunto */}
          {expense.attachment ? (
            <div className="expense-detail-attachment-box">
              <h4>Comprobante adjunto</h4>
              <div className="expense-attachment-row">
                <div className="expense-attachment-meta">
                  <strong>{expense.attachment.fileName}</strong>
                  <small className="text-muted">
                    ({(expense.attachment.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                    {expense.attachment.mimeType})
                  </small>
                </div>
                {attachmentUrl ? (
                  <div className="expense-attachment-actions">
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-btn ui-btn--sm ui-btn--outline"
                    >
                      Abrir en nueva pestaña
                    </a>
                    <a
                      href={attachmentUrl}
                      download={expense.attachment.fileName}
                      className="ui-btn ui-btn--sm ui-btn--primary"
                    >
                      Descargar archivo
                    </a>
                  </div>
                ) : loadingAttachment ? (
                  <span className="text-muted">Cargando archivo adjunto...</span>
                ) : null}
              </div>

              {/* Vista previa si es imagen */}
              {attachmentUrl &&
              expense.attachment.mimeType.startsWith('image/') ? (
                <div className="expense-attachment-preview-img-box">
                  <img
                    src={attachmentUrl}
                    alt={`Comprobante del gasto ${expense.folio}`}
                    className="expense-attachment-preview-img"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="modal-dialog__actions">
          {!isCancelled && onCancelExpense ? (
            <Button
              type="button"
              variant="outline"
              className="ui-btn--danger"
              onClick={() => {
                onClose()
                onCancelExpense(expense)
              }}
            >
              Anular este gasto
            </Button>
          ) : null}
          <Button type="button" variant="primary" onClick={onClose}>
            Cerrar detalle
          </Button>
        </footer>
      </div>
    </div>
  )
}

