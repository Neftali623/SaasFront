import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { generateCashId } from '../services/cashRepository'
import type {
  CashMovement,
  CashRegister,
  CashSession,
  CashSessionComputedTotals,
} from '../types'
import {
  centsToAmount,
  formatCentsWithHistoricalCurrency,
  formatSignedCentsWithHistoricalCurrency,
  parseStrictCashInputToCents,
} from '../utils/moneyUtils'

export interface CashManualMovementSubmitPayload {
  sessionId: string
  type: 'manual_in' | 'manual_out'
  amountCents: number
  reason: string
  reference: string | null
  isCompensatory: boolean
  compensatedMovementId: string | null
  operatorName: string
  operationId: string
  expectedSessionVersion: number
}

export interface CashManualMovementPanelProps {
  mode: 'manual_in' | 'manual_out'
  organizationName: string
  branchName: string
  register: CashRegister
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  compensatingMovement: CashMovement | null
  defaultOperatorName: string
  onDirtyChange: (isDirty: boolean) => void
  onSwitchMode: (nextMode: 'manual_in' | 'manual_out') => void
  onClearCompensatingMovement: () => void
  onRequestOpenSession: () => void
  onSubmitMovement: (payload: CashManualMovementSubmitPayload) => {
    ok: boolean
    errorCode?: string
    error?: string
  }
  onCancel: () => void
}

const ENTRY_REASON_SUGGESTIONS = [
  'Ingreso de moneda fraccionaria para cambio en mostrador',
  'Dotación adicional de efectivo al cajón',
  'Reintegro operativo de efectivo en turno',
]

const WITHDRAWAL_REASON_SUGGESTIONS = [
  'Resguardo parcial de efectivo en bóveda',
  'Retiro de efectivo por propietario / encargado',
  'Canje de denominación fuera de mostrador',
]

export function CashManualMovementPanel({
  mode,
  organizationName,
  branchName,
  register,
  openSession,
  openSessionTotals,
  compensatingMovement,
  defaultOperatorName,
  onDirtyChange,
  onSwitchMode,
  onClearCompensatingMovement,
  onRequestOpenSession,
  onSubmitMovement,
  onCancel,
}: CashManualMovementPanelProps) {
  const effectiveMode: 'manual_in' | 'manual_out' = compensatingMovement
    ? compensatingMovement.direction === 'in'
      ? 'manual_out'
      : 'manual_in'
    : mode

  const isWithdrawal = effectiveMode === 'manual_out'

  const [amountInput, setAmountInput] = useState<string>(() =>
    compensatingMovement
      ? centsToAmount(compensatingMovement.amountCents).toFixed(2)
      : '',
  )
  const [reason, setReason] = useState<string>(() =>
    compensatingMovement
      ? `Compensación de movimiento "${compensatingMovement.reason}"`
      : '',
  )
  const [reference, setReference] = useState<string>(() =>
    compensatingMovement ? `COMP-${compensatingMovement.id.slice(0, 8)}` : '',
  )
  const [operatorName, setOperatorName] = useState<string>(defaultOperatorName)
  const [capturedVersion, setCapturedVersion] = useState<number>(
    () => openSession?.version ?? 1,
  )
  const [errors, setErrors] = useState<{
    amount?: string
    reason?: string
    reference?: string
    operatorName?: string
  }>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    amountCents: number
    resultingBalanceCents: number
    operationId: string
  } | null>(null)

  const isDirty =
    amountInput.trim() !== '' ||
    reason.trim() !== '' ||
    reference.trim() !== ''

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
        title={
          isWithdrawal
            ? 'Retiro manual de efectivo bloqueado'
            : 'Entrada manual de efectivo bloqueada'
        }
        subtitle="Solo se pueden registrar entradas o retiros manuales cuando existe una sesión abierta."
        headerAction={<Badge variant="neutral">Caja cerrada</Badge>}
      >
        <div
          className="inventory-already-init-box"
          role="region"
          aria-label="Sin sesión abierta para registrar movimiento"
        >
          <div className="inventory-already-init-box__content">
            <strong>
              La caja {register.name} ({register.code}) se encuentra cerrada.
            </strong>
            <p>
              Para registrar entradas o retiros manuales de efectivo, primero
              debes abrir una sesión de caja definiendo su fondo inicial.
            </p>
          </div>
          <div className="inventory-already-init-box__actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onRequestOpenSession}
            >
              Abrir sesión de caja
            </Button>
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
  const currentExpectedBalanceCents = openSessionTotals.expectedBalanceCents
  const hasConcurrentUpdate = openSession.version !== capturedVersion

  const liveParse = parseStrictCashInputToCents(
    amountInput,
    isWithdrawal ? 'importe del retiro' : 'importe de la entrada',
    false,
  )

  const previewResultingBalanceCents = liveParse.ok
    ? isWithdrawal
      ? currentExpectedBalanceCents - liveParse.cents
      : currentExpectedBalanceCents + liveParse.cents
    : null

  const exceedsAvailableBalance =
    isWithdrawal &&
    liveParse.ok &&
    liveParse.cents > currentExpectedBalanceCents

  const handleAcknowledgeConcurrentUpdate = () => {
    setCapturedVersion(openSession.version)
    setPendingConfirmation(null)
    setBannerError(null)
  }

  const validateFields = (): {
    valid: boolean
    cents: number | null
  } => {
    const nextErrors: {
      amount?: string
      reason?: string
      reference?: string
      operatorName?: string
    } = {}

    if (!liveParse.ok) {
      nextErrors.amount = liveParse.error
    } else if (isWithdrawal && liveParse.cents > currentExpectedBalanceCents) {
      nextErrors.amount = `Retiro rechazado: el importe (${formatCentsWithHistoricalCurrency(
        liveParse.cents,
        sessionCurrency,
      )}) supera el efectivo esperado disponible en caja (${formatCentsWithHistoricalCurrency(
        currentExpectedBalanceCents,
        sessionCurrency,
      )}).`
    }

    const cleanReason = reason.trim()
    if (!cleanReason) {
      nextErrors.reason = 'El motivo del movimiento es obligatorio.'
    } else if (cleanReason.length < 3) {
      nextErrors.reason = 'Describe el motivo con al menos 3 caracteres.'
    } else if (cleanReason.length > 180) {
      nextErrors.reason = 'El motivo no puede exceder 180 caracteres.'
    }

    if (reference.trim().length > 80) {
      nextErrors.reference =
        'La referencia opcional no puede exceder 80 caracteres.'
    }

    if (!operatorName.trim()) {
      nextErrors.operatorName = 'El responsable del movimiento es obligatorio.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !liveParse.ok) {
      return { valid: false, cents: null }
    }

    return { valid: true, cents: liveParse.cents }
  }

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBannerError(null)

    if (hasConcurrentUpdate) {
      setBannerError(
        'El saldo esperado de la sesión cambió mientras este formulario estaba abierto. Actualiza el saldo base antes de continuar.',
      )
      return
    }

    const validation = validateFields()
    if (!validation.valid || validation.cents === null) {
      setPendingConfirmation(null)
      return
    }

    const resultingBalanceCents = isWithdrawal
      ? currentExpectedBalanceCents - validation.cents
      : currentExpectedBalanceCents + validation.cents

    setPendingConfirmation({
      amountCents: validation.cents,
      resultingBalanceCents,
      operationId: generateCashId('op'),
    })
  }

  const handleConfirmMovement = () => {
    if (!pendingConfirmation) {
      return
    }
    setBannerError(null)

    const outcome = onSubmitMovement({
      sessionId: openSession.id,
      type: effectiveMode,
      amountCents: pendingConfirmation.amountCents,
      reason: reason.trim(),
      reference: reference.trim() ? reference.trim() : null,
      isCompensatory: Boolean(compensatingMovement),
      compensatedMovementId: compensatingMovement?.id ?? null,
      operatorName: operatorName.trim(),
      operationId: pendingConfirmation.operationId,
      expectedSessionVersion: capturedVersion,
    })

    if (!outcome.ok) {
      setBannerError(
        outcome.error ??
          'No se pudo registrar el movimiento. Tus datos ingresados se conservaron.',
      )
      if (outcome.errorCode === 'CONCURRENCY_CONFLICT') {
        setPendingConfirmation(null)
      }
    }
  }

  const reasonSuggestions = isWithdrawal
    ? WITHDRAWAL_REASON_SUGGESTIONS
    : ENTRY_REASON_SUGGESTIONS

  return (
    <Card
      as="section"
      padding="lg"
      title={
        compensatingMovement
          ? `Registrar movimiento compensatorio (${isWithdrawal ? 'Salida' : 'Entrada'})`
          : isWithdrawal
            ? 'Registrar retiro manual de efectivo'
            : 'Registrar entrada manual de efectivo'
      }
      subtitle={
        compensatingMovement
          ? 'Los movimientos confirmados son inmutables. Registra un movimiento inverso en la sesión abierta para corregir el saldo esperado.'
          : isWithdrawal
            ? 'Registra una salida física de efectivo del cajón sin crear un gasto contable.'
            : 'Registra un ingreso manual de efectivo en caja sin clasificarlo como venta.'
      }
      headerAction={
        !compensatingMovement ? (
          <div className="inventory-mode-toggle" role="group" aria-label="Tipo de movimiento manual">
            <Button
              type="button"
              size="sm"
              variant={!isWithdrawal ? 'primary' : 'outline'}
              onClick={() => {
                setPendingConfirmation(null)
                setErrors({})
                setBannerError(null)
                onSwitchMode('manual_in')
              }}
            >
              + Entrada manual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isWithdrawal ? 'primary' : 'outline'}
              onClick={() => {
                setPendingConfirmation(null)
                setErrors({})
                setBannerError(null)
                onSwitchMode('manual_out')
              }}
            >
              - Retiro manual
            </Button>
          </div>
        ) : (
          <Badge variant="neutral">Corrección compensatoria</Badge>
        )
      }
    >
      <form className="product-form" onSubmit={handleReviewSubmit} noValidate>
        {compensatingMovement ? (
          <div
            className="settings-alert settings-alert--info"
            role="region"
            aria-label="Información del movimiento a compensar"
          >
            <div className="settings-alert__content">
              <strong>
                Compensando movimiento #{compensatingMovement.sequence} (
                {compensatingMovement.direction === 'in'
                  ? 'Entrada original'
                  : 'Salida original'}{' '}
                por{' '}
                {formatCentsWithHistoricalCurrency(
                  compensatingMovement.amountCents,
                  sessionCurrency,
                )}
                )
              </strong>
              <p>
                Motivo original: <em>&ldquo;{compensatingMovement.reason}&rdquo;</em>. El movimiento original permanecerá intacto en la bitácora y este nuevo registro dejará constancia de la corrección.
              </p>
            </div>
            <div className="settings-alert__actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearCompensatingMovement()
                  setPendingConfirmation(null)
                }}
              >
                Salir de modo compensación
              </Button>
            </div>
          </div>
        ) : null}

        {hasConcurrentUpdate ? (
          <div
            className="settings-alert settings-alert--warning"
            role="alert"
          >
            <div className="settings-alert__content">
              <strong>El saldo esperado de la sesión se actualizó</strong>
              <p>
                Otro movimiento modificó el saldo esperado del turno a{' '}
                <strong>
                  {formatCentsWithHistoricalCurrency(
                    currentExpectedBalanceCents,
                    sessionCurrency,
                  )}
                </strong>{' '}
                (versión #{openSession.version}) mientras este formulario estaba
                abierto.
              </p>
            </div>
            <div className="settings-alert__actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAcknowledgeConcurrentUpdate}
              >
                Usar nuevo saldo ({formatCentsWithHistoricalCurrency(currentExpectedBalanceCents, sessionCurrency)})
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
              <strong>No se pudo registrar el movimiento</strong>
              <p>{bannerError}</p>
            </div>
          </div>
        ) : null}

        <div className="product-form-section">
          <h3 className="product-form-section__title">
            1. Vista previa del efecto en el saldo esperado ({sessionCurrency})
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
              Moneda fija de sesión: <strong>{sessionCurrency}</strong>
            </span>
          </div>

          <div
            className="inventory-preview-grid"
            aria-live="polite"
            aria-label="Previsualización de saldo esperado"
          >
            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Saldo esperado anterior
              </span>
              <strong className="inventory-preview-stat__value">
                {formatCentsWithHistoricalCurrency(
                  currentExpectedBalanceCents,
                  sessionCurrency,
                )}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                {isWithdrawal ? 'Retiro manual (-)' : 'Entrada manual (+)'}
              </span>
              <strong
                className={`inventory-preview-stat__value ${
                  liveParse.ok
                    ? isWithdrawal
                      ? 'inventory-delta-value--negative'
                      : 'inventory-delta-value--positive'
                    : ''
                }`}
              >
                {liveParse.ok
                  ? formatSignedCentsWithHistoricalCurrency(
                      isWithdrawal ? -liveParse.cents : liveParse.cents,
                      sessionCurrency,
                    )
                  : '—'}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Saldo esperado resultante
              </span>
              <strong
                className={`inventory-preview-stat__value ${
                  exceedsAvailableBalance
                    ? 'inventory-delta-value--negative'
                    : 'inventory-preview-stat__value--highlight'
                }`}
              >
                {previewResultingBalanceCents !== null
                  ? formatCentsWithHistoricalCurrency(
                      previewResultingBalanceCents,
                      sessionCurrency,
                    )
                  : formatCentsWithHistoricalCurrency(
                      currentExpectedBalanceCents,
                      sessionCurrency,
                    )}
              </strong>
            </div>
          </div>
        </div>

        <div className="product-form-section">
          <h3 className="product-form-section__title">
            2. Datos de la {isWithdrawal ? 'salida' : 'entrada'} manual
          </h3>

          <div className="settings-form-grid">
            <Input
              label={`Importe (${sessionCurrency}) *`}
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => {
                setAmountInput(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.amount) {
                  setErrors((prev) => ({ ...prev, amount: undefined }))
                }
              }}
              placeholder="Ej. 150.00"
              helpText={
                isWithdrawal
                  ? `Mayor que 0. Máximo disponible en caja: ${formatCentsWithHistoricalCurrency(
                      currentExpectedBalanceCents,
                      sessionCurrency,
                    )}.`
                  : 'Mayor que 0. Hasta 2 decimales.'
              }
              error={errors.amount}
              autoFocus
              required
            />

            <Input
              label="Motivo del movimiento *"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.reason) {
                  setErrors((prev) => ({ ...prev, reason: undefined }))
                }
              }}
              placeholder={
                isWithdrawal
                  ? 'Ej. Resguardo parcial en bóveda'
                  : 'Ej. Ingreso de cambio para mostrador'
              }
              helpText="Obligatorio. Explica por qué entra o sale efectivo del cajón."
              error={errors.reason}
              maxLength={180}
              required
            />
          </div>

          <div className="inventory-reason-chips" aria-label="Sugerencias rápidas de motivo">
            <span className="inventory-reason-chips__label">
              Motivos frecuentes:
            </span>
            {reasonSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="inventory-reason-chip"
                onClick={() => {
                  setReason(suggestion)
                  setPendingConfirmation(null)
                  if (errors.reason) {
                    setErrors((prev) => ({ ...prev, reason: undefined }))
                  }
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="settings-form-grid">
            <Input
              label="Referencia o comprobante (opcional)"
              value={reference}
              onChange={(event) => {
                setReference(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.reference) {
                  setErrors((prev) => ({ ...prev, reference: undefined }))
                }
              }}
              placeholder="Ej. VALE-014, DOT-02, COMP-..."
              helpText="Opcional. Folio interno o referencia documental."
              error={errors.reference}
              maxLength={80}
            />

            <Input
              label="Responsable (demostración) *"
              value={operatorName}
              onChange={(event) => {
                setOperatorName(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.operatorName) {
                  setErrors((prev) => ({ ...prev, operatorName: undefined }))
                }
              }}
              placeholder="Nombre del operador"
              helpText="Responsable que ejecuta el movimiento en el cajón."
              error={errors.operatorName}
              maxLength={80}
              required
            />
          </div>
        </div>

        {pendingConfirmation ? (
          <div
            className="inventory-confirm-box"
            role="region"
            aria-label="Confirmación de movimiento manual de efectivo"
          >
            <h4 className="inventory-confirm-box__title">
              Confirmar{' '}
              {isWithdrawal
                ? 'retiro manual de efectivo (-)'
                : 'entrada manual de efectivo (+)'}
            </h4>
            <div className="inventory-preview-grid">
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Saldo esperado anterior
                </span>
                <strong className="inventory-preview-stat__value">
                  {formatCentsWithHistoricalCurrency(
                    currentExpectedBalanceCents,
                    sessionCurrency,
                  )}
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  {isWithdrawal ? 'Retiro (-)' : 'Entrada (+)'}
                </span>
                <strong
                  className={`inventory-preview-stat__value ${
                    isWithdrawal
                      ? 'inventory-delta-value--negative'
                      : 'inventory-delta-value--positive'
                  }`}
                >
                  {formatSignedCentsWithHistoricalCurrency(
                    isWithdrawal
                      ? -pendingConfirmation.amountCents
                      : pendingConfirmation.amountCents,
                    sessionCurrency,
                  )}
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Saldo esperado resultante
                </span>
                <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                  {formatCentsWithHistoricalCurrency(
                    pendingConfirmation.resultingBalanceCents,
                    sessionCurrency,
                  )}
                </strong>
              </div>
            </div>
            <p className="inventory-confirm-box__note">
              Motivo: <strong>{reason.trim()}</strong>
              {reference.trim() ? ` · Ref: ${reference.trim()}` : ''}.{' '}
              {isWithdrawal
                ? 'Este retiro registra una salida física de efectivo en caja, sin crear un gasto contable.'
                : 'Esta entrada manual incrementa el efectivo disponible en caja y no se clasifica como venta.'}
            </p>
            <div className="inventory-confirm-box__actions">
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmMovement}
              >
                Confirmar y guardar {isWithdrawal ? 'retiro' : 'entrada'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingConfirmation(null)}
              >
                Modificar datos
              </Button>
            </div>
          </div>
        ) : null}

        <div className="settings-footer-bar">
          <div className="settings-footer-bar__meta">
            <span>
              Los movimientos confirmados son inmutables y solo admiten
              corrección mediante movimiento compensatorio.
            </span>
          </div>
          <div className="settings-footer-bar__actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            {!pendingConfirmation ? (
              <Button type="submit" variant="primary">
                Revisar {isWithdrawal ? 'retiro manual' : 'entrada manual'}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  )
}
