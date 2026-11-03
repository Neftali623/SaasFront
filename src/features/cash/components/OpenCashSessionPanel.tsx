import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import type { CurrencyCode, OrganizationPreferences } from '../../../types'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import { generateCashId } from '../services/cashRepository'
import type { CashRegister, CashSession } from '../types'
import {
  formatCentsWithHistoricalCurrency,
  parseStrictCashInputToCents,
} from '../utils/moneyUtils'

export interface OpenCashSessionSubmitPayload {
  openingAmountCents: number
  currency: CurrencyCode
  openingNote: string | null
  operatorName: string
  operationId: string
}

export interface OpenCashSessionPanelProps {
  organizationName: string
  branchName: string
  register: CashRegister
  openSession: CashSession | null
  preferences: OrganizationPreferences
  defaultOperatorName: string
  onDirtyChange: (isDirty: boolean) => void
  onSubmitOpenSession: (payload: OpenCashSessionSubmitPayload) => {
    ok: boolean
    error?: string
  }
  onCancel: () => void
}

export function OpenCashSessionPanel({
  organizationName,
  branchName,
  register,
  openSession,
  preferences,
  defaultOperatorName,
  onDirtyChange,
  onSubmitOpenSession,
  onCancel,
}: OpenCashSessionPanelProps) {
  const activeCurrency = preferences.currency

  const [openingAmountInput, setOpeningAmountInput] = useState<string>('0.00')
  const [openingNote, setOpeningNote] = useState<string>('')
  const [operatorName, setOperatorName] = useState<string>(defaultOperatorName)
  const [errors, setErrors] = useState<{
    openingAmount?: string
    openingNote?: string
    operatorName?: string
  }>({})
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    openingAmountCents: number
    operationId: string
  } | null>(null)

  const isDirty =
    openingAmountInput.trim() !== '0.00' || openingNote.trim() !== ''

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => {
      onDirtyChange(false)
    }
  }, [isDirty, onDirtyChange])

  if (openSession) {
    const openedInfo = formatDateTimeInOrganizationTimezone(
      openSession.openedAt,
      preferences.timezone,
      preferences.dateFormat,
    )

    return (
      <Card
        as="section"
        padding="lg"
        title="Apertura de sesión de caja bloqueada"
        subtitle="Regla operativa: solo puede existir una sesión abierta por caja en cada sucursal."
        headerAction={<Badge variant="warning">Turno en curso</Badge>}
      >
        <div
          className="inventory-already-init-box"
          role="region"
          aria-label="Sesión ya abierta en la caja"
        >
          <div className="inventory-already-init-box__content">
            <strong>
              La caja {register.name} ({register.code}) ya tiene una sesión
              abierta.
            </strong>
            <p>
              El turno actual fue abierto el{' '}
              <strong>{openedInfo.fullLabel}</strong> por{' '}
              <strong>{openSession.openedBy}</strong> en moneda{' '}
              <strong>{openSession.currency}</strong>. Para abrir un nuevo
              turno, primero debes cerrar la sesión activa mediante arqueo de
              efectivo.
            </p>
          </div>
          <div className="inventory-already-init-box__actions">
            <Button type="button" variant="primary" size="sm" onClick={onCancel}>
              Volver al turno activo
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const validateFields = (): {
    valid: boolean
    cents: number | null
  } => {
    const nextErrors: {
      openingAmount?: string
      openingNote?: string
      operatorName?: string
    } = {}

    const amountResult = parseStrictCashInputToCents(
      openingAmountInput,
      'fondo inicial',
      true,
    )
    if (!amountResult.ok) {
      nextErrors.openingAmount = amountResult.error
    }

    if (openingNote.trim().length > 200) {
      nextErrors.openingNote =
        'La nota de apertura no puede exceder 200 caracteres.'
    }

    if (!operatorName.trim()) {
      nextErrors.operatorName = 'El responsable de apertura es obligatorio.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !amountResult.ok) {
      return { valid: false, cents: null }
    }

    return { valid: true, cents: amountResult.cents }
  }

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBannerError(null)

    const validation = validateFields()
    if (!validation.valid || validation.cents === null) {
      setPendingConfirmation(null)
      return
    }

    setPendingConfirmation({
      openingAmountCents: validation.cents,
      operationId: generateCashId('op'),
    })
  }

  const handleConfirmOpen = () => {
    if (!pendingConfirmation) {
      return
    }
    setBannerError(null)

    const outcome = onSubmitOpenSession({
      openingAmountCents: pendingConfirmation.openingAmountCents,
      currency: activeCurrency,
      openingNote: openingNote.trim() ? openingNote.trim() : null,
      operatorName: operatorName.trim(),
      operationId: pendingConfirmation.operationId,
    })

    if (!outcome.ok) {
      setBannerError(
        outcome.error ??
          'No se pudo abrir la sesión de caja. Tus datos ingresados se conservaron.',
      )
    }
  }

  return (
    <Card
      as="section"
      padding="lg"
      title="Abrir sesión de caja"
      subtitle="Inicia un nuevo turno de operación registrando el fondo inicial en efectivo disponible en el cajón."
      headerAction={<Badge variant="brand">Moneda del turno: {activeCurrency}</Badge>}
    >
      <form className="product-form" onSubmit={handleReviewSubmit} noValidate>
        {bannerError ? (
          <div
            className="settings-alert settings-alert--error"
            role="alert"
            aria-live="assertive"
          >
            <div className="settings-alert__content">
              <strong>No se pudo abrir la sesión de caja</strong>
              <p>{bannerError}</p>
            </div>
          </div>
        ) : null}

        <div className="product-form-section">
          <h3 className="product-form-section__title">
            1. Contexto del punto de cobro y moneda fija del turno
          </h3>

          <div className="inventory-context-pills">
            <span className="inventory-context-pill">
              Organización: <strong>{organizationName}</strong>
            </span>
            <span className="inventory-context-pill">
              Sucursal: <strong>{branchName}</strong>
            </span>
            <span className="inventory-context-pill">
              Caja: <strong>{register.name} ({register.code})</strong>
            </span>
            <span className="inventory-context-pill">
              Moneda fija de sesión: <strong>{activeCurrency}</strong>
            </span>
          </div>

          <p className="inventory-precision-banner">
            Al abrir esta sesión se fijará la moneda{' '}
            <strong>{activeCurrency}</strong> para todos sus importes y
            movimientos. El saldo de turnos anteriores no se transfiere
            automáticamente.
          </p>
        </div>

        <div className="product-form-section">
          <h3 className="product-form-section__title">
            2. Fondo inicial y nota de apertura
          </h3>

          <div className="settings-form-grid">
            <Input
              label={`Fondo inicial en efectivo (${activeCurrency}) *`}
              inputMode="decimal"
              value={openingAmountInput}
              onChange={(event) => {
                setOpeningAmountInput(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.openingAmount) {
                  setErrors((prev) => ({ ...prev, openingAmount: undefined }))
                }
              }}
              placeholder="Ej. 0.00 o 1000.00"
              helpText="Permite 0 o 0.00 si abres el cajón sin efectivo inicial. Hasta 2 decimales."
              error={errors.openingAmount}
              autoFocus
              required
            />

            <Input
              label="Responsable de apertura (demostración) *"
              value={operatorName}
              onChange={(event) => {
                setOperatorName(event.target.value)
                setPendingConfirmation(null)
                setBannerError(null)
                if (errors.operatorName) {
                  setErrors((prev) => ({ ...prev, operatorName: undefined }))
                }
              }}
              placeholder="Nombre del cajero o encargado"
              helpText="Operador que recibe el cajón e inicia el turno."
              error={errors.operatorName}
              maxLength={80}
              required
            />
          </div>

          <Input
            label="Nota de apertura (opcional)"
            value={openingNote}
            onChange={(event) => {
              setOpeningNote(event.target.value)
              setPendingConfirmation(null)
              setBannerError(null)
              if (errors.openingNote) {
                setErrors((prev) => ({ ...prev, openingNote: undefined }))
              }
            }}
            placeholder="Ej. Fondo verificado en billetes de $100 y moneda fraccionaria completa"
            helpText={`Opcional (${openingNote.trim().length}/200 caracteres). Quedará asentada en la bitácora de apertura.`}
            error={errors.openingNote}
            maxLength={200}
          />
        </div>

        {pendingConfirmation ? (
          <div
            className="inventory-confirm-box"
            role="region"
            aria-label="Confirmación de apertura de sesión de caja"
          >
            <h4 className="inventory-confirm-box__title">
              Confirmar apertura de sesión de caja
            </h4>
            <div className="inventory-preview-grid inventory-preview-grid--four">
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Caja asignada
                </span>
                <strong className="inventory-preview-stat__value">
                  {register.name} ({register.code})
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Fondo inicial registrado
                </span>
                <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
                  {formatCentsWithHistoricalCurrency(
                    pendingConfirmation.openingAmountCents,
                    activeCurrency,
                  )}
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Moneda fija del turno
                </span>
                <strong className="inventory-preview-stat__value">
                  {activeCurrency}
                </strong>
              </div>
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Responsable
                </span>
                <strong className="inventory-preview-stat__value">
                  {operatorName.trim()}
                </strong>
              </div>
            </div>
            <p className="inventory-confirm-box__note">
              El fondo inicial establece el saldo esperado de partida (
              <strong>
                {formatCentsWithHistoricalCurrency(
                  pendingConfirmation.openingAmountCents,
                  activeCurrency,
                )}
              </strong>
              ) y <strong>no se clasifica como ingreso por venta</strong>.
            </p>
            <div className="inventory-confirm-box__actions">
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmOpen}
              >
                Confirmar y abrir sesión de caja
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
              Solo se permite una sesión abierta por caja en cada sucursal.
            </span>
          </div>
          <div className="settings-footer-bar__actions">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            {!pendingConfirmation ? (
              <Button type="submit" variant="primary">
                Revisar apertura de caja
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  )
}
