import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { OrganizationPreferences } from '../../../types'
import { formatDateTimeInOrganizationTimezone } from '../../inventory/utils/quantityUtils'
import { getTimezoneShortLabel } from '../../settings/formatters'
import type {
  CashMovement,
  CashRegister,
  CashSession,
  CashSessionComputedTotals,
} from '../types'
import {
  formatCentsWithHistoricalCurrency,
  formatSignedCentsWithHistoricalCurrency,
  getCashMovementTypePresentation,
  getDifferencePresentation,
  sortCashMovementsDeterministically,
} from '../utils/moneyUtils'

export interface ActiveSessionStatusPanelProps {
  organizationName: string
  register: CashRegister
  openSession: CashSession | null
  openSessionTotals: CashSessionComputedTotals | null
  lastClosedSession: CashSession | null
  movements: CashMovement[]
  preferences: OrganizationPreferences
  onRequestOpenSession: () => void
  onRequestManualEntry: (compensateMovement?: CashMovement) => void
  onRequestManualWithdrawal: (compensateMovement?: CashMovement) => void
  onRequestCloseSession: () => void
  onRequestViewSessionMovements: () => void
  onRequestViewSessionsHistory: () => void
}

export function ActiveSessionStatusPanel({
  organizationName,
  register,
  openSession,
  openSessionTotals,
  lastClosedSession,
  movements,
  preferences,
  onRequestOpenSession,
  onRequestManualEntry,
  onRequestManualWithdrawal,
  onRequestCloseSession,
  onRequestViewSessionMovements,
  onRequestViewSessionsHistory,
}: ActiveSessionStatusPanelProps) {
  const timezoneShort = getTimezoneShortLabel(preferences.timezone)

  // CASO A: NO HAY SESIÓN ABIERTA (CAJA CERRADA)
  if (!openSession || !openSessionTotals) {
    const closedDateInfo =
      lastClosedSession?.closedAt
        ? formatDateTimeInOrganizationTimezone(
            lastClosedSession.closedAt,
            preferences.timezone,
            preferences.dateFormat,
          )
        : null

    const closedDiffMeta =
      lastClosedSession &&
      lastClosedSession.differenceAmountCents !== null &&
      lastClosedSession.differenceKind !== null
        ? getDifferencePresentation(
            lastClosedSession.differenceAmountCents,
            lastClosedSession.differenceKind,
            lastClosedSession.currency,
          )
        : null

    return (
      <div className="cash-closed-stack">
        <Card
          as="section"
          padding="lg"
          title={`${register.name} (${register.code})`}
          subtitle={`Sucursal: ${register.branchName} · Organización: ${organizationName}`}
          headerAction={<Badge variant="neutral">Caja cerrada</Badge>}
        >
          <div className="cash-closed-hero">
            <div className="cash-closed-hero__info">
              <div className="cash-closed-hero__status-row">
                <span className="cash-status-dot cash-status-dot--closed" aria-hidden="true" />
                <h3 className="cash-closed-hero__title">Caja cerrada</h3>
              </div>
              <p className="cash-closed-hero__desc">
                Actualmente no hay una sesión activa en{' '}
                <strong>{register.name}</strong> ({register.branchName}). Para
                registrar movimientos de efectivo o iniciar operaciones del
                turno, abre una nueva sesión capturando explícitamente su fondo
                inicial.
              </p>
              <p className="cash-closed-hero__rule">
                El saldo del turno anterior no se traslada automáticamente como
                fondo nuevo. Moneda actual en preferencias para una nueva
                apertura: <strong>{preferences.currency}</strong>.
              </p>
            </div>

            <div className="cash-closed-hero__actions">
              <Button variant="primary" onClick={onRequestOpenSession}>
                Abrir caja
              </Button>
              <Button
                variant="outline"
                onClick={onRequestViewSessionsHistory}
              >
                Consultar historial de sesiones
              </Button>
            </div>
          </div>
        </Card>

        {lastClosedSession ? (
          <Card
            as="section"
            title="Resumen del último cierre registrado"
            subtitle={`Turno cerrado por ${lastClosedSession.closedBy ?? lastClosedSession.openedBy} · ${closedDateInfo?.fullLabel ?? ''} (${timezoneShort})`}
            headerAction={
              <Badge variant="neutral">
                Moneda histórica: {lastClosedSession.currency}
              </Badge>
            }
          >
            <div className="inventory-preview-grid inventory-preview-grid--four">
              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Fondo inicial
                </span>
                <strong className="inventory-preview-stat__value">
                  {formatCentsWithHistoricalCurrency(
                    lastClosedSession.openingAmountCents,
                    lastClosedSession.currency,
                  )}
                </strong>
              </div>

              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Saldo esperado al cierre
                </span>
                <strong className="inventory-preview-stat__value">
                  {formatCentsWithHistoricalCurrency(
                    lastClosedSession.expectedClosingAmountCents ?? 0,
                    lastClosedSession.currency,
                  )}
                </strong>
              </div>

              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Efectivo físico contado
                </span>
                <strong className="inventory-preview-stat__value">
                  {formatCentsWithHistoricalCurrency(
                    lastClosedSession.countedAmountCents ?? 0,
                    lastClosedSession.currency,
                  )}
                </strong>
              </div>

              <div className="inventory-preview-stat">
                <span className="inventory-preview-stat__label">
                  Diferencia de arqueo
                </span>
                <div>
                  {closedDiffMeta ? (
                    <Badge variant={closedDiffMeta.badgeVariant}>
                      {closedDiffMeta.label}
                    </Badge>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>

            {lastClosedSession.closingNote ? (
              <p className="cash-closing-note-preview">
                <strong>Observación de cierre:</strong>{' '}
                {lastClosedSession.closingNote}
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>
    )
  }

  // CASO B: HAY SESIÓN ABIERTA
  const openedDateInfo = formatDateTimeInOrganizationTimezone(
    openSession.openedAt,
    preferences.timezone,
    preferences.dateFormat,
  )

  const sessionMovements = sortCashMovementsDeterministically(
    movements.filter((m) => m.sessionId === openSession.id),
  )
  const recentMovements = sessionMovements.slice(0, 5)
  const currencyDifferFromPreferences =
    openSession.currency !== preferences.currency

  return (
    <div className="cash-open-stack">
      {/* Encabezado de la sesión activa */}
      <Card
        as="section"
        padding="lg"
        title={`Turno activo · ${register.name} (${register.code})`}
        subtitle={`Sucursal: ${register.branchName} · Apertura: ${openedDateInfo.fullLabel} (${timezoneShort}) · Responsable: ${openSession.openedBy}`}
        headerAction={
          <div className="cash-session-badges">
            <Badge variant="success">Sesión abierta</Badge>
            <Badge variant="brand">
              Moneda fija: {openSession.currency}
            </Badge>
          </div>
        }
      >
        <div className="cash-active-toolbar">
          <div className="cash-active-toolbar__meta">
            {openSession.openingNote ? (
              <p className="cash-active-toolbar__note">
                <strong>Nota de apertura:</strong> {openSession.openingNote}
              </p>
            ) : (
              <p className="cash-active-toolbar__note">
                Fórmula activa:{' '}
                <code>
                  Saldo esperado = Fondo inicial + Entradas manuales - Retiros
                  manuales
                </code>
                .
              </p>
            )}
            {currencyDifferFromPreferences ? (
              <p className="cash-historical-currency-notice" role="note">
                Esta sesión se abrió en <strong>{openSession.currency}</strong>.
                Aunque la preferencia del negocio cambió a{' '}
                <strong>{preferences.currency}</strong>, todos los importes de
                este turno conservan su moneda histórica{' '}
                <strong>{openSession.currency}</strong> sin reconversión.
              </p>
            ) : null}
          </div>

          <div className="cash-active-toolbar__actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRequestManualEntry()}
            >
              + Registrar entrada
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestManualWithdrawal()}
            >
              - Registrar retiro
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onRequestCloseSession}
            >
              Cerrar caja
            </Button>
          </div>
        </div>
      </Card>

      {/* 4 Indicadores del cálculo del saldo esperado */}
      <section
        className="metrics-grid"
        aria-label="Desglose de saldo de la sesión activa"
      >
        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Fondo inicial</span>
            <Badge variant="brand">Apertura ({openSession.currency})</Badge>
          </div>
          <p className="metric-card__value">
            {formatCentsWithHistoricalCurrency(
              openSessionTotals.openingAmountCents,
              openSession.currency,
            )}
          </p>
          <p className="metric-card__meta">
            Contabilizado una sola vez al abrir turno
          </p>
        </Card>

        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Entradas manuales (+)</span>
            <Badge variant="success">
              {openSessionTotals.manualInCount}{' '}
              {openSessionTotals.manualInCount === 1 ? 'ingreso' : 'ingresos'}
            </Badge>
          </div>
          <p className="metric-card__value">
            {formatSignedCentsWithHistoricalCurrency(
              openSessionTotals.manualInCents,
              openSession.currency,
            )}
          </p>
          <p className="metric-card__meta">
            Dotaciones o cambio (no representan ventas)
          </p>
        </Card>

        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Retiros manuales (-)</span>
            <Badge variant="warning">
              {openSessionTotals.manualOutCount}{' '}
              {openSessionTotals.manualOutCount === 1 ? 'retiro' : 'retiros'}
            </Badge>
          </div>
          <p className="metric-card__value">
            {openSessionTotals.manualOutCents > 0
              ? formatSignedCentsWithHistoricalCurrency(
                  -openSessionTotals.manualOutCents,
                  openSession.currency,
                )
              : formatCentsWithHistoricalCurrency(0, openSession.currency)}
          </p>
          <p className="metric-card__meta">
            Resguardos o retiros (no crean gastos contables)
          </p>
        </Card>

        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Saldo esperado en caja</span>
            <Badge variant="brand">Efectivo físico</Badge>
          </div>
          <p className="metric-card__value">
            {formatCentsWithHistoricalCurrency(
              openSessionTotals.expectedBalanceCents,
              openSession.currency,
            )}
          </p>
          <p className="metric-card__meta">
            {openSessionTotals.cashSalesCents > 0 ||
            openSessionTotals.cashRefundsCents > 0
              ? `Ventas efec: ${formatSignedCentsWithHistoricalCurrency(
                  openSessionTotals.cashSalesCents,
                  openSession.currency,
                )}${
                  openSessionTotals.cashRefundsCents > 0
                    ? ` · Reembolsos: -${formatCentsWithHistoricalCurrency(
                        openSessionTotals.cashRefundsCents,
                        openSession.currency,
                      )}`
                    : ''
                } · Sincronizado con Resumen`
              : 'Calculado desde registros · Sincronizado con Resumen'}
          </p>
        </Card>
      </section>

      {/* Movimientos recientes de la sesión activa */}
      <Card
        as="section"
        title="Movimientos recientes de la sesión activa"
        subtitle={`Últimos registros en ${register.name}. Los movimientos confirmados son inmutables; para corregir una captura usa "Compensar".`}
        headerAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={onRequestViewSessionMovements}
          >
            Ver todos los movimientos ({sessionMovements.length})
          </Button>
        }
      >
        {recentMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos registrados"
            description="Aún no hay movimientos registrados en esta sesión."
          />
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th scope="col">Fecha y hora ({timezoneShort})</th>
                  <th scope="col">Tipo y dirección</th>
                  <th scope="col" className="products-table__num-col">
                    Importe ({openSession.currency})
                  </th>
                  <th scope="col" className="products-table__num-col">
                    Saldo posterior
                  </th>
                  <th scope="col">Motivo y referencia</th>
                  <th scope="col">Responsable</th>
                  <th scope="col" className="products-table__actions-col">
                    Corrección
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((mov) => {
                  const typeMeta = getCashMovementTypePresentation(
                    mov.type,
                    mov.isCompensatory,
                  )
                  const dt = formatDateTimeInOrganizationTimezone(
                    mov.createdAt,
                    preferences.timezone,
                    preferences.dateFormat,
                  )
                  const signedCents =
                    mov.type === 'opening_float'
                      ? mov.amountCents
                      : mov.direction === 'in'
                        ? mov.amountCents
                        : -mov.amountCents

                  return (
                    <tr key={mov.id}>
                      <td data-label="Fecha y hora">
                        <div className="inventory-history-date">
                          <strong>{dt.dateLabel}</strong>
                          <span className="inventory-history-date__time">
                            {dt.timeLabel} · Sec. #{mov.sequence}
                          </span>
                        </div>
                      </td>

                      <td data-label="Tipo y dirección">
                        <div className="inventory-status-stack">
                          <Badge variant={typeMeta.badgeVariant}>
                            {typeMeta.label}
                          </Badge>
                          <span className="cash-direction-tag">
                            Dirección: <strong>{typeMeta.directionLabel}</strong>
                          </span>
                        </div>
                      </td>

                      <td
                        data-label="Importe"
                        className="products-table__num-col"
                      >
                        <strong
                          className={`inventory-delta-value ${
                            mov.direction === 'in'
                              ? 'inventory-delta-value--positive'
                              : 'inventory-delta-value--negative'
                          }`}
                        >
                          {mov.type === 'opening_float'
                            ? formatCentsWithHistoricalCurrency(
                                mov.amountCents,
                                mov.currency,
                              )
                            : formatSignedCentsWithHistoricalCurrency(
                                signedCents,
                                mov.currency,
                              )}
                        </strong>
                      </td>

                      <td
                        data-label="Saldo posterior"
                        className="products-table__num-col"
                      >
                        <strong>
                          {formatCentsWithHistoricalCurrency(
                            mov.balanceAfterCents,
                            mov.currency,
                          )}
                        </strong>
                      </td>

                      <td data-label="Motivo y referencia">
                        <div className="inventory-reason-cell">
                          <p className="inventory-reason-cell__text">
                            {mov.reason}
                          </p>
                          {mov.reference ? (
                            <span className="inventory-reason-cell__ref">
                              Ref: <code>{mov.reference}</code>
                            </span>
                          ) : (
                            <span className="product-cell-muted">
                              Sin referencia
                            </span>
                          )}
                        </div>
                      </td>

                      <td data-label="Responsable">
                        <span className="inventory-operator-name">
                          {mov.operatorName}
                        </span>
                      </td>

                      <td
                        data-label="Corrección"
                        className="products-table__actions-col"
                      >
                        {mov.type === 'manual_in' ||
                        mov.type === 'manual_out' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (mov.direction === 'in') {
                                onRequestManualWithdrawal(mov)
                              } else {
                                onRequestManualEntry(mov)
                              }
                            }}
                            aria-label={`Registrar movimiento compensatorio para ${mov.reason}`}
                          >
                            Compensar
                          </Button>
                        ) : (
                          <span className="product-cell-muted">Apertura</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

