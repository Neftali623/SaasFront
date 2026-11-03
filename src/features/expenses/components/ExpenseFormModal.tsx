import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { CurrencyCode } from '../../../types'
import type { CashSession, CashSessionComputedTotals } from '../../cash/types'
import {
  amountToCents,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import { storeExpenseAttachmentBlob } from '../services/durableAttachmentStorage'
import { generateExpenseId } from '../services/expensesRepository'
import type {
  CreateExpensePayload,
  ExpenseAttachment,
  ExpenseCategory,
  ExpensePaymentMethod,
} from '../types'
import {
  validateExpenseAttachmentFile,
  validateExpenseForm,
  type ExpenseValidationErrors,
} from '../utils/expensesValidation'

export interface ExpenseFormModalProps {
  organizationId: string
  branchName: string
  currency: CurrencyCode
  categories: ExpenseCategory[]
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  operatorName: string
  isSubmitting: boolean
  onSubmit: (payload: CreateExpensePayload) => void
  onClose: () => void
  onManageCategories: () => void
}

export function ExpenseFormModal({
  organizationId,
  branchName,
  currency,
  categories,
  openSession,
  openSessionTotals,
  operatorName,
  isSubmitting,
  onSubmit,
  onClose,
  onManageCategories,
}: ExpenseFormModalProps) {
  const formId = useId()
  const today = new Date().toISOString().split('T')[0]

  const activeCategories = categories.filter((c) => c.isActive)

  const [concept, setConcept] = useState('')
  const [categoryId, setCategoryId] = useState(activeCategories[0]?.id || '')
  const [amountStr, setAmountStr] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash')
  const [externalReference, setExternalReference] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isStoringFile, setIsStoringFile] = useState(false)
  const [errors, setErrors] = useState<ExpenseValidationErrors>({})

  // Evita doble envío
  const [operationId] = useState(() => generateExpenseId('op-exp'))

  const amountCents = amountToCents(Number(amountStr) || 0)

  // Validación en tiempo real del saldo si es efectivo
  const isCash = paymentMethod === 'cash'
  const hasOpenSession = openSession !== null && openSession.status === 'open'
  const hasMatchingCurrency = openSession?.currency === currency
  const availableBalanceCents = openSessionTotals?.expectedBalanceCents ?? 0
  const hasSufficientBalance = isCash
    ? hasOpenSession && hasMatchingCurrency && availableBalanceCents >= amountCents
    : true

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      setFileError(null)
      return
    }

    const error = validateExpenseAttachmentFile(file)
    if (error) {
      setFileError(error)
      setSelectedFile(null)
      e.target.value = ''
    } else {
      setFileError(null)
      setSelectedFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileError(null)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || isStoringFile) return

    const validationErrors = validateExpenseForm({
      concept,
      categoryId,
      amountCents,
      expenseDate,
      categories,
      selectedFile,
    })

    if (isCash && !hasOpenSession) {
      validationErrors.amount =
        'No hay ninguna sesión de caja abierta en esta sucursal para entregar efectivo.'
    } else if (isCash && !hasSufficientBalance) {
      validationErrors.amount = `Saldo insuficiente en la sesión de caja activa (${formatCentsWithHistoricalCurrency(
        availableBalanceCents,
        currency,
      )} disponible frente a ${formatCentsWithHistoricalCurrency(
        amountCents,
        currency,
      )}).`
    }

    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    let attachment: ExpenseAttachment | null = null

    // Guardar archivo adjunto si fue seleccionado
    if (selectedFile) {
      setIsStoringFile(true)
      try {
        const fileId = generateExpenseId('att')
        const storageKey = `att_${organizationId}_${fileId}`
        const success = await storeExpenseAttachmentBlob(
          storageKey,
          selectedFile,
          selectedFile.name,
          selectedFile.type,
        )

        if (success) {
          attachment = {
            id: fileId,
            fileName: selectedFile.name,
            mimeType: selectedFile.type,
            sizeBytes: selectedFile.size,
            storageKey,
            uploadedAt: new Date().toISOString(),
          }
        } else {
          setFileError(
            'No fue posible guardar el archivo en el almacenamiento seguro. Puedes intentar de nuevo o quitar el archivo.',
          )
          setIsStoringFile(false)
          return
        }
      } catch {
        setFileError(
          'Error al procesar el archivo adjunto. Intenta de nuevo o quita el archivo.',
        )
        setIsStoringFile(false)
        return
      }
      setIsStoringFile(false)
    }

    onSubmit({
      concept: concept.trim(),
      categoryId,
      amountCents,
      currency,
      paymentMethod,
      expenseDate,
      externalReference: externalReference.trim() || null,
      attachment,
      operationId,
      operatorName,
    })
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={formId}>
      <div className="modal-dialog modal-dialog--lg">
        <header className="modal-dialog__header">
          <div className="modal-dialog__title-group">
            <h3 id={formId} className="modal-dialog__title">
              Registrar gasto operativo
            </h3>
            <p className="modal-dialog__subtitle">
              {branchName} · Moneda {currency} · Responsable: {operatorName}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar formulario de gasto"
            disabled={isSubmitting || isStoringFile}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="expense-form" noValidate>
          <div className="expense-form__grid">
            <div className="expense-form__field expense-form__field--full">
              <Input
                label="Concepto del gasto"
                id="expense-concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej. Pago bimestral de energía eléctrica, Papel higiénico y jabón..."
                error={errors.concept}
                required
                autoFocus
              />
            </div>

            <div className="expense-form__field">
              <div className="form-label-row">
                <label htmlFor="expense-category" className="form-label">
                  Categoría
                </label>
                <button
                  type="button"
                  className="link-button"
                  onClick={onManageCategories}
                >
                  Administrar categorías
                </button>
              </div>
              <select
                id="expense-category"
                className={`form-select ${errors.categoryId ? 'form-select--error' : ''}`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId ? (
                <span className="form-field-error" role="alert">
                  {errors.categoryId}
                </span>
              ) : null}
            </div>

            <div className="expense-form__field">
              <Input
                label={`Importe (${currency})`}
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                error={errors.amount}
                required
              />
            </div>

            <div className="expense-form__field">
              <Input
                label="Fecha efectiva del gasto"
                id="expense-date"
                type="date"
                max={today}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                helpText="Fecha en que ocurrió el egreso (no admite fechas futuras)"
                error={errors.expenseDate}
                required
              />
            </div>

            <div className="expense-form__field">
              <label className="form-label">Método de desembolso</label>
              <div
                className="pos-payment-method-tabs"
                role="radiogroup"
                aria-label="Método de pago del gasto"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'cash'}
                  className={`pos-payment-tab-btn ${
                    paymentMethod === 'cash' ? 'pos-payment-tab-btn--active' : ''
                  }`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  Efectivo (Caja)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'card'}
                  className={`pos-payment-tab-btn ${
                    paymentMethod === 'card' ? 'pos-payment-tab-btn--active' : ''
                  }`}
                  onClick={() => setPaymentMethod('card')}
                >
                  Tarjeta (Manual)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === 'transfer'}
                  className={`pos-payment-tab-btn ${
                    paymentMethod === 'transfer' ? 'pos-payment-tab-btn--active' : ''
                  }`}
                  onClick={() => setPaymentMethod('transfer')}
                >
                  Transferencia
                </button>
              </div>
            </div>

            <div className="expense-form__field expense-form__field--full">
              <Input
                label="Referencia o folio externo (opcional)"
                id="expense-reference"
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                placeholder="Ej. Factura A-1029, Comprobante SPEI 9921, Ticket 4481..."
              />
            </div>

            <div className="expense-form__field expense-form__field--full">
              <label htmlFor="expense-attachment-input" className="form-label">
                Comprobante adjunto (opcional · máx 2 MB · PDF, PNG, JPG, WebP)
              </label>
              {selectedFile ? (
                <div className="expense-attachment-preview">
                  <div className="expense-attachment-preview__info">
                    <strong>{selectedFile.name}</strong>
                    <small className="text-muted">
                      ({(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type})
                    </small>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                  >
                    Quitar archivo
                  </Button>
                </div>
              ) : (
                <input
                  id="expense-attachment-input"
                  type="file"
                  className="form-input"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                />
              )}
              {fileError || errors.attachment ? (
                <span className="form-field-error" role="alert">
                  {fileError || errors.attachment}
                </span>
              ) : null}
            </div>
          </div>

          {/* Banner de Impacto Operativo */}
          <div
            className={`expense-impact-banner ${
              isCash
                ? hasOpenSession && hasSufficientBalance
                  ? 'expense-impact-banner--cash'
                  : 'expense-impact-banner--warning'
                : 'expense-impact-banner--external'
            }`}
          >
            {isCash ? (
              hasOpenSession ? (
                <div>
                  <strong>Efecto en caja física:</strong> Se registrará una salida por{' '}
                  <strong>
                    {formatCentsWithHistoricalCurrency(amountCents, currency)}
                  </strong>{' '}
                  en la sesión activa (
                  <code>{openSession.registerName}</code>
                  ), reduciendo su efectivo esperado de{' '}
                  {formatCentsWithHistoricalCurrency(availableBalanceCents, currency)}{' '}
                  a{' '}
                  <strong>
                    {formatCentsWithHistoricalCurrency(
                      availableBalanceCents - amountCents,
                      currency,
                    )}
                  </strong>
                  .
                </div>
              ) : (
                <div>
                  <strong>Atención:</strong> No hay sesión de caja abierta. Para
                  egresos en efectivo es indispensable abrir turno previamente.
                </div>
              )
            ) : (
              <div>
                <strong>Registro administrativo externo:</strong> Este gasto se pagó
                por {paymentMethod === 'card' ? 'tarjeta' : 'transferencia bancaria'}.
                No alterará el efectivo físico esperado en la caja registradora.
              </div>
            )}
          </div>

          <footer className="modal-dialog__actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isStoringFile}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                isSubmitting ||
                isStoringFile ||
                (isCash && (!hasOpenSession || !hasSufficientBalance))
              }
            >
              {isSubmitting || isStoringFile
                ? 'Registrando gasto...'
                : `Confirmar gasto (${formatCentsWithHistoricalCurrency(
                    amountCents,
                    currency,
                  )})`}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  )
}

