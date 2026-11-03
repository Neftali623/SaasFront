import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { generateCashId } from '../services/cashRepository'
import type {
  CashDifferenceKind,
  CashRegister,
  CashSession,
  CashSessionComputedTotals,
} from '../types'
import {
  calculateClosingDifference,
  formatCentsWithHistoricalCurrency,
  getDifferencePresentation,
  parseStrictCashInputToCents,
} from '../utils/moneyUtils'

export interface CloseCashSessionSubmitPayload {
  sessionId: string
  countedAmountCents: number
  closingNote: string | null
  operatorName: string
  operationId: string
  expectedSessionVersion: number
  expectedBalanceCents: number
}

export interface CloseCashSessionPanelProps {
  organizationName: string
  branchName: string
  register: CashRegister
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  defaultOperatorName: string
  onDirtyChange: (isDirty: boolean) => void
  onSubmitCloseSession: (payload: CloseCashSessionSubmitPayload) => {
    ok: boolean
    errorCode?: string
    error?: string
  }
  onCancel: () => void
}

export function CloseCashSessionPanel({
  organizationName,
  branchName,
  register,
  openSession,
  openSessionTotals,
  defaultOperatorName,
  onDirtyChange,
  onSubmitCloseSession,
  onCancel,
}: CloseCashSessionPanelProps) {
  const [countedInput, setCountedInput] = useState<string>('')
  const [closingNote, setClosingNote] = useState<string>('')
  const [operatorName, setOperatorName] = useState<string>(defaultOperatorName)
  const [capturedVersion, setCapturedVersion] = useState<number>(
    () => openSession?.version ?? 1,
  )
  const [capturedExpectedCents, setCapturedExpectedCents] = useState<number>(
    () => openSessionTotals?.expectedBalanceCents ?? 0,
  )
  const [errors, setErrors] = useState<{
    countedAmount?: string
    closingNote?: string
    operatorName?: string
  }>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    countedAmountCents: number
    differenceAmountCents: number
    differenceKind: CashDifferenceKind
    operationId: string
  } | null>(null)

  const isDirty = countedInput.trim() !== '' || closingNote.trim() !== ''

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => {
      onDirtyChange(false)
    }
  }, [isDirty, onDirtyChange])

  if (!openSession || !openSessionTotals) {
    return (
      <Card
        as="section"
        padding="lg"
        title="Corte y cierre de sesión de caja"
        subtitle="Se requiere una sesión de caja abierta para realizar el arqueo."
        headerAction={<Badge variant="neutral">Caja cerrada</Badge>}
      >
        <div
          className="inventory-already-init-box"
          role="region"
          aria-label="Sin turno activo por cerrar"
        >
          <div className="inventory-already-init-box__content">
            <strong>
              La caja {register.name} ({register.code}) ya se encuentra cerrada.
            </strong>
            <p>
              No existe un turno abierto pendiente de arqueo. Puedes consultar
              los cortes anteriores en el historial de sesiones.
            </p>
          </div>
          <div className="inventory-already-init-box__actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Volver al estado de caja
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const sessionCurrency = openSession.currency
  const currentExpectedCents = openSessionTotals.expectedBalanceCents
  const hasConcurrentUpdate =
    openSession.version !== capturedVersion ||
    currentExpectedCents !== capturedExpectedCents

  const liveParse = parseStrictCashInputToCents(
    countedInput,
    'efectivo físico contado',
    true,
  )

  const liveDifference = liveParse.ok
    ? calculateClosingDifference(currentExpectedCents, liveParse.cents)
    : null

  const liveDiffMeta = liveDifference
    ? getDifferencePresentation(
        liveDifference.differenceAmountCents,
        liveDifference.differenceKind,
        sessionCurrency,
      )
    : null

  const requiresExplanation =
    liveDifference !== null && liveDifference.differenceAmountCents !== 0

  const handleAcknowledgeConcurrentUpdate = () => {
    setCapturedVersion(openSession.version)
    setCapturedExpectedCents(currentExpectedCents)
    setPendingConfirmation(null)
    setBannerError(null)
  }

  const validateFields = (): {
    valid: boolean
    countedCents: number | null
    diffCents: number | null
    diffKind: CashDifferenceKind | null
  } => {
    const nextErrors: {
      countedAmount?: string
      closingNote?: string
      operatorName?: string
    } = {}

    if (!liveParse.ok) {
      nextErrors.countedAmount = liveParse.error
    }

    const cleanNote = closingNote.trim()
    let diffCents: number | null = null
    let diffKind: CashDifferenceKind | null = null

    if (liveParse.ok) {
      const calc = calculateClosingDifference(
        currentExpectedCents,
        liveParse.cents,
      )
      diffCents = calc.differenceAmountCents
      diffKind = calc.differenceKind

      if (calc.differenceAmountCents !== 0 && !cleanNote) {
        nextErrors.closingNote =
          'Existe diferencia entre el efectivo contado y el saldo esperado. Debes ingresar una explicación obligatoria.'
      } else if (calc.differenceAmountCents !== 0 && cleanNote.length < 5) {
        nextErrors.closingNote =
          'La explicación de la diferencia debe tener al menos 5 caracteres.'
      }
    }

    if (cleanNote.length > 280) {
      nextErrors.closingNote =
        'La observación de cierre no puede exceder 280 caracteres.'
    }

    if (!operatorName.trim()) {
      nextErrors.operatorName = 'El responsable de cierre es obligatorio.'
    }

    setErrors(nextErrors)
    if (
      Object.keys(nextErrors).length > 0 ||
      !liveParse.ok ||
      diffCents === null ||
      diffKind === null
    ) {
      return {
        valid: false,
        countedCents: null,
        diffCents: null,
        diffKind: null,
      }
    }

    return {
      valid: true,
      countedCents: liveParse.cents,
      diffCents,
      diffKind,
    }
  }

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBannerError(null)

    if (hasConcurrentUpdate) {
      setBannerError(
        'El saldo esperado de la sesión cambió mientras realizabas el conteo. Revisa y acepta el nuevo saldo esperado antes de continuar.',
      )
      return
    }

    const validation = validateFields()
    if (
      !validation.valid ||
      validation.countedCents === null ||
      validation.diffCents === null ||
      validation.diffKind === null
    ) {
      setPendingConfirmation(null)
      return
    }

    setPendingConfirmation({
      countedAmountCents: validation.countedCents,
      differenceAmountCents: validation.diffCents,
      differenceKind: validation.diffKind,
      operationId: generateCashId('op'),
    })
  }

  const handleConfirmClose = () => {
    if (!pendingConfirmation) {
      return
    }
    setBannerError(null)

    const outcome = onSubmitCloseSession({
      sessionId: openSession.id,
      countedAmountCents: pendingConfirmation.countedAmountCents,
      closingNote: closingNote.trim() ? closingNote.trim() : null,
      operatorName: operatorName.trim(),
      operationId: pendingConfirmation.operationId,
      expectedSessionVersion: capturedVersion,
      expectedBalanceCents: capturedExpectedCents,
    })

    if (!outcome.ok) {
      setBannerError(
        outcome.error ??
          'No se pudo cerrar la sesión de caja. Tus datos ingresados se conservaron.',
      )
      if (outcome.errorCode === 'CONCURRENCY_CONFLICT') {
        setPendingConfirmation(null)
      }
    }
  }

  const confirmDiffMeta = pendingConfirmation
    ? getDifferencePresentation(
        pendingConfirmation.differenceAmountCents,
        pendingConfirmation.differenceKind,
        sessionCurrency,
      )
    : null

  return (
    <Card
      as="section"
      padding="lg"
      title="Cerrar sesión de caja (Arqueo físico)"
      subtitle={`Captura el conteo físico de efectivo en ${register.name} (${register.code}) y concílialo contra el saldo esperado del turno.`}
      headerAction={
        <Badge variant="brand">Moneda fija: {sessionCurrency}</Badge>
      }
    >
      <form className="product-form" onSubmit={handleReviewSubmit} noValidate>
        {hasConcurrentUpdate ? (
          <div className="settings-alert settings-alert--warning" role="alert">
            <div className="settings-alert__content">
              <strong>
                Cambio detectado en el saldo esperado de la sesión
              </strong>
              <p>
                El saldo esperado cambió de{' '}
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    capturedExpectedCents,
                    sessionCurrency,
                  )}
                </strong>{' '}
                a{' '}
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    currentExpectedCents,
                    sessionCurrency,
                  )}
                </strong>{' '}
                (versión #{openSession.version}) mientras este formulario de
                cierre estaba abierto.
              </p>
            </div>
            <div className="settings-alert__actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAcknowledgeConcurrentUpdate}
              >
                Actualizar saldo esperado (
                {formatCentsWithHistoricalCurrency(
                  currentExpectedCents,
                  sessionCurrency,
                )}
                )
              </Button>
            </div>
          </div>
        ) : null}

        {bannerError ? (
          <div
            className="settings-alert settings-alert--error"
            role="alert"
            aria-live="assertive"
          >
            <div className="settings-alert__content">
              <strong>No se pudo cerrar la sesión de caja</strong>
              <p>{bannerError}</p>
            </div>
          </div>
        ) : null}

        <div className="product-form-section">
          <h3 className="product-form-section__title">
            1. Desglose del saldo esperado y cálculo de diferencia (
            {sessionCurrency})
          </h3>

          <div className="inventory-context-pills">
            <span className="inventory-context-pill">
              Organización: <strong>{organizationName}</strong>
            </span>
            <span className="inventory-context-pill">
              Sucursal: <strong>{branchName}</strong>
            </span>
            <span className="inventory-context-pill">
              Caja: <strong>{register.name}</strong>
            </span>
            <span className="inventory-context-pill">
              Fórmula: <strong>Diferencia = Contado − Esperado</strong>
            </span>
          </div>

          <div
            className="inventory-preview-grid inventory-preview-grid--four"
            aria-live="polite"
            aria-label="Desglose de saldo esperado y diferencia"
          >
            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Fondo inicial
              </span>
              <strong className="inventory-preview-stat__value">
                {formatCentsWithHistoricalCurrency(
                  openSessionTotals.openingAmountCents,
                  sessionCurrency,
                )}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Entradas (+) / Retiros (-)
              </span>
              <strong className="inventory-preview-stat__value">
                +
                {formatCentsWithHistoricalCurrency(
                  openSessionTotals.manualInCents,
                  sessionCurrency,
                )}{' '}
                / -
                {formatCentsWithHistoricalCurrency(
                  openSessionTotals.manualOutCents,
                  sessionCurrency,
                )}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Saldo esperado al cierre
              </span>
              <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                {formatCentsWithHistoricalCurrency(
                  currentExpectedCents,
                  sessionCurrency,
                )}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Diferencia (Contado − Esperado)
              </span>
              <div>
                {liveDiffMeta ? (
                  <Badge variant={liveDiffMeta.badgeVariant}>
                    {liveDiffMeta.label}
                  </Badge>
                ) : (
                  <span className="product-cell-muted">
                    Ingresa el efectivo contado
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="product-form-section">
          <h3 className="product-form-section__title">
            2. Conteo físico de efectivo y observación de cierre
          </h3>

          <div className="settings-form-grid">
            <Input
              label={`Efectivo físico contado (${sessionCurrency}) *`}
              inputMode="decimal"
              value={countedInput}
              onChange={(event) => {
                setCountedInput(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.countedAmount) {
                  setErrors((prev) => ({
                    ...prev,
                    countedAmount: undefined,
                  }))
                }
              }}
              placeholder="Ej. 1040.00 (permite 0 o 0.00)"
              helpText="Permite 0 si el cajón quedó vacío al cierre. Hasta 2 decimales."
              error={errors.countedAmount}
              autoFocus
              required
            />

            <Input
              label="Responsable de cierre (demostración) *"
              value={operatorName}
              onChange={(event) => {
                setOperatorName(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.operatorName) {
                  setErrors((prev) => ({
                    ...prev,
                    operatorName: undefined,
                  }))
                }
              }}
              placeholder="Nombre del cajero o encargado"
              helpText="Operador que realiza el conteo y firma el cierre."
              error={errors.operatorName}
              maxLength={80}
              required
            />
          </div>

          <Input
            label={
              requiresExplanation
                ? 'Observación de cierre (explicación obligatoria por diferencia) *'
                : 'Observación de cierre (opcional si la diferencia es 0)'
            }
            value={closingNote}
            onChange={(event) => {
              setClosingNote(event.target.value)
              setPendingConfirmation(null)
              setBannerError(null)
              if (errors.closingNote) {
                setErrors((prev) => ({ ...prev, closingNote: undefined }))
              }
            }}
            placeholder={
              requiresExplanation
                ? 'Explica la causa del sobrante o faltante detectado en el arqueo físico (mínimo 5 caracteres)...'
                : 'Opcional cuando no hay diferencia. Ej. Corte cuadrado sin novedades...'
            }
            helpText={
              requiresExplanation
                ? `Obligatoria cuando Contado ≠ Esperado (${closingNote.trim().length}/280 caracteres).`
                : `Opcional cuando la diferencia es $0.00 (${closingNote.trim().length}/280 caracteres).`
            }
            error={errors.closingNote}
            maxLength={280}
            required={requiresExplanation}
          />
        </div>

        {pendingConfirmation && confirmDiffMeta ? (
          <div
            className="inventory-confirm-box"
            role="region"
            aria-label="Confirmación de cierre definitivo de sesión de caja"
          >
            <h4 className="inventory-confirm-box__title">
              Confirmar cierre definitivo del turno
            </h4>
            <div className="inventory-preview-grid inventory-preview-grid--four">
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Saldo esperado
                </span>
                <strong className="inventory-preview-stat__value">
                  {formatCentsWithHistoricalCurrency(
                    currentExpectedCents,
                    sessionCurrency,
                  )}
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Efectivo físico contado
                </span>
                <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                  {formatCentsWithHistoricalCurrency(
                    pendingConfirmation.countedAmountCents,
                    sessionCurrency,
                  )}
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Diferencia calculada
                </span>
                <div>
                  <Badge variant={confirmDiffMeta.badgeVariant}>
                    {confirmDiffMeta.label}
                  </Badge>
                </div>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Responsable de cierre
                </span>
                <strong className="inventory-preview-stat__value">
                  {operatorName.trim()}
                </strong>
              </div>
            </div>
            <p className="inventory-confirm-box__note">
              <strong>El cierre de sesión es final en esta fase:</strong> una
              vez confirmado, se guardará el snapshot histórico del turno y no
              se podrán registrar nuevos movimientos sobre esta sesión. El saldo
              contado no se transfiere automáticamente a la siguiente apertura.
            </p>
            <div className="inventory-confirm-box__actions">
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmClose}
              >
                Confirmar y cerrar sesión de caja
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingConfirmation(null)}
              >
                Volver a revisar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="settings-footer-bar">
          <div className="settings-footer-bar__meta">
            <span>
              Diferencia = Contado − Esperado (0: Sin diferencia · &gt;0:
              Sobrante · &lt;0: Faltante).
            </span>
          </div>
          <div className="settings-footer-bar__actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            {!pendingConfirmation ? (
              <Button type="submit" variant="primary">
                Revisar corte de caja
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  )
}
