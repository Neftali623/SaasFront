import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import type { CurrencyCode, OrganizationPreferences } from '../../../types'
import type {
  CashRegister,
  CashSession,
  CashSessionComputedTotals,
} from '../../cash/types'
import { formatCentsWithHistoricalCurrency } from '../../cash/utils/moneyUtils'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import { getTimezoneShortLabel } from '../../settings/formatters'

export interface PosContextBarProps {
  organizationName: string
  branchName: string
  register: CashRegister
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  operatorName: string
  catalogCurrency: CurrencyCode
  preferences: OrganizationPreferences
  onGoToCash: () => void
}

export function PosContextBar({
  organizationName,
  branchName,
  register,
  openSession,
  openSessionTotals,
  operatorName,
  catalogCurrency,
  preferences,
  onGoToCash,
}: PosContextBarProps) {
  const timezoneShort = getTimezoneShortLabel(preferences.timezone)
  const hasCurrencyMismatch =
    openSession !== null && openSession.currency !== catalogCurrency
  const hasVisualPreferenceDiff =
    preferences.currency !== catalogCurrency && !hasCurrencyMismatch

  const openedDateInfo = openSession
    ? formatDateTimeInOrganizationTimezone(
        openSession.openedAt,
        preferences.timezone,
        preferences.dateFormat,
      )
    : null

  return (
    <div className="pos-context-stack">
      <section
        className="pos-context-bar"
        aria-label="Contexto operativo de la venta"
      >
        <div className="pos-context-bar__items">
          <div className="pos-context-item">
            <span className="pos-context-item__label">Organización y sucursal</span>
            <strong className="pos-context-item__value">
              {organizationName} · {branchName}
            </strong>
          </div>

          <div className="pos-context-item">
            <span className="pos-context-item__label">Caja asignada</span>
            <strong className="pos-context-item__value">
              {register.name} ({register.code})
            </strong>
          </div>

          <div className="pos-context-item">
            <span className="pos-context-item__label">Sesión de caja</span>
            {openSession && openSessionTotals ? (
              <div className="pos-context-item__inline">
                <Badge variant="success">Abierta</Badge>
                <strong className="pos-context-item__value">
                  Efectivo esperado:{' '}
                  {formatCentsWithHistoricalCurrency(
                    openSessionTotals.expectedBalanceCents,
                    openSession.currency,
                  )}
                </strong>
                <span className="pos-context-item__sub">
                  ({openedDateInfo?.timeLabel} {timezoneShort})
                </span>
              </div>
            ) : (
              <div className="pos-context-item__inline">
                <Badge variant="warning">Caja cerrada</Badge>
                <span className="pos-context-item__sub">
                  Sin turno activo para cobrar
                </span>
              </div>
            )}
          </div>

          <div className="pos-context-item">
            <span className="pos-context-item__label">Operador (demo)</span>
            <strong className="pos-context-item__value">{operatorName}</strong>
          </div>

          <div className="pos-context-item">
            <span className="pos-context-item__label">Moneda de operación</span>
            <div className="pos-context-item__inline">
              <Badge variant={hasCurrencyMismatch ? 'danger' : 'brand'}>
                {openSession ? openSession.currency : catalogCurrency}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {!openSession ? (
        <div
          className="settings-alert settings-alert--warning"
          role="region"
          aria-label="Aviso de caja cerrada en Punto de Venta"
        >
          <div className="settings-alert__content">
            <strong>
              La caja {register.name} ({register.code}) está cerrada
            </strong>
            <p>
              Puedes consultar precios, existencias y preparar artículos en el
              carrito, pero para confirmar cualquier cobro es obligatorio tener
              una sesión de caja abierta en esta sucursal.
            </p>
          </div>
          <div className="settings-alert__actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onGoToCash}
            >
              Abrir caja en módulo de Caja
            </Button>
          </div>
        </div>
      ) : null}

      {hasCurrencyMismatch && openSession ? (
        <div
          className="settings-alert settings-alert--error"
          role="alert"
          aria-live="polite"
        >
          <div className="settings-alert__content">
            <strong>
              Cobro bloqueado por incompatibilidad de moneda (
              {openSession.currency} vs {catalogCurrency})
            </strong>
            <p>
              La sesión de caja activa fue abierta en{' '}
              <strong>{openSession.currency}</strong>, pero el catálogo de
              productos está denominado en <strong>{catalogCurrency}</strong>.
              El piloto no mezcla ni convierte monedas automáticamente. Cierra
              la sesión actual en {openSession.currency} y abre una nueva sesión
              en {catalogCurrency} para poder cobrar.
            </p>
          </div>
          <div className="settings-alert__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onGoToCash}
            >
              Ir a Caja para cambiar sesión
            </Button>
          </div>
        </div>
      ) : null}

      {hasVisualPreferenceDiff ? (
        <p className="pos-currency-integrity-note" role="note">
          Nota de integridad monetaria: aunque la preferencia visual del negocio
          está configurada en <strong>{preferences.currency}</strong>, los
          precios del catálogo y la sesión de caja operan en su moneda base{' '}
          <strong>{catalogCurrency}</strong> sin reinterpretar ni convertir
          importes existentes.
        </p>
      ) : null}
    </div>
  )
}

