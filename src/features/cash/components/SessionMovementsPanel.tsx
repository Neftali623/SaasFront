import { useId, useMemo, useState } from 'react'
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
  SessionMovementPeriodFilter,
  SessionMovementsFilters,
} from '../types'
import {
  formatCentsWithHistoricalCurrency,
  formatSignedCentsWithHistoricalCurrency,
  getCashMovementTypePresentation,
  isCashMovementWithinSessionPeriod,
  sortCashMovementsDeterministically,
} from '../utils/moneyUtils'

export interface SessionMovementsPanelProps {
  organizationName: string
  branchName: string
  register: CashRegister
  session: CashSession | null
  sessionTotals: CashSessionComputedTotals | null
  movements: CashMovement[]
  preferences: OrganizationPreferences
  onRequestManualEntry: (compensateMovement?: CashMovement) => void
  onRequestManualWithdrawal: (compensateMovement?: CashMovement) => void
  onBackToStatus: () => void
  onViewSessionsHistory: () => void
}

export function SessionMovementsPanel({
  organizationName,
  branchName,
  register,
  session,
  sessionTotals,
  movements,
  preferences,
  onRequestManualEntry,
  onRequestManualWithdrawal,
  onBackToStatus,
  onViewSessionsHistory,
}: SessionMovementsPanelProps) {
  const typeSelectId = useId()
  const periodSelectId = useId()
  const timezoneShort = getTimezoneShortLabel(preferences.timezone)

  const [typeFilter, setTypeFilter] =
    useState<SessionMovementsFilters['typeFilter']>('all')
  const [periodFilter, setPeriodFilter] =
    useState<SessionMovementPeriodFilter>('all')

  const sessionMovements = useMemo(() => {
    if (!session) {
      return []
    }
    return sortCashMovementsDeterministically(
      movements.filter((m) => m.sessionId === session.id),
    )
  }, [movements, session])

  const filteredMovements = useMemo(() => {
    return sessionMovements.filter((mov) => {
      if (typeFilter === 'compensatory') {
        if (!mov.isCompensatory) {
          return false
        }
      } else if (typeFilter !== 'all') {
        if (mov.type !== typeFilter) {
          return false
        }
      }

      if (
        !isCashMovementWithinSessionPeriod(
          mov.createdAt,
          periodFilter,
          preferences.timezone,
        )
      ) {
        return false
      }
      return true
    })
  }, [sessionMovements, typeFilter, periodFilter, preferences.timezone])

  if (!session || !sessionTotals) {
    return (
      <Card
        as="section"
        padding="lg"
        title="Movimientos de la sesión de caja"
        subtitle={`Bitácora de operaciones en ${register.name} (${register.code}) · ${branchName}`}
      >
        <EmptyState
          title="No hay una sesión abierta activa"
          description="Actualmente la caja está cerrada. Puedes consultar los movimientos de turnos anteriores desde el historial de sesiones."
          action={
            <div className="page-header-actions-group">
              <Button variant="outline" size="sm" onClick={onBackToStatus}>
                Ir a Estado de caja
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onViewSessionsHistory}
              >
                Ver Historial de sesiones
              </Button>
            </div>
          }
        />
      </Card>
    )
  }

  const isSessionOpen = session.status === 'open'
  const sessionCurrency = session.currency
  const openedDateInfo = formatDateTimeInOrganizationTimezone(
    session.openedAt,
    preferences.timezone,
    preferences.dateFormat,
  )
  const hasActiveFilters = typeFilter !== 'all' || periodFilter !== 'all'

  return (
    <div className="cash-open-stack">
      <Card
        as="section"
        padding="lg"
        title={`Movimientos de la sesión · ${register.name} (${register.code})`}
        subtitle={`${organizationName} (${branchName}) · Apertura: ${openedDateInfo.fullLabel} (${timezoneShort}) por ${session.openedBy}`}
        headerAction={
          <div className="cash-session-badges">
            <Badge variant={isSessionOpen ? 'success' : 'neutral'}>
              {isSessionOpen ? 'Sesión abierta' : 'Sesión cerrada (Inmutable)'}
            </Badge>
            <Badge variant="brand">Moneda fija: {sessionCurrency}</Badge>
          </div>
        }
      >
        <div
          className="inventory-preview-grid inventory-preview-grid--four"
          aria-label="Resumen de importes de la sesión"
        >
          <div className="inventory-preview-stat">
            <span className="inventory-preview-stat__label">Fondo inicial</span>
            <strong className="inventory-preview-stat__value">
              {formatCentsWithHistoricalCurrency(
                sessionTotals.openingAmountCents,
                sessionCurrency,
              )}
            </strong>
          </div>

          <div className="inventory-preview-stat">
            <span className="inventory-preview-stat__label">
              Entradas manuales (+)
            </span>
            <strong className="inventory-preview-stat__value inventory-delta-value--positive">
              {formatSignedCentsWithHistoricalCurrency(
                sessionTotals.manualInCents,
                sessionCurrency,
              )}
            </strong>
          </div>

          <div className="inventory-preview-stat">
            <span className="inventory-preview-stat__label">
              Retiros manuales (-)
            </span>
            <strong className="inventory-preview-stat__value inventory-delta-value--negative">
              {sessionTotals.manualOutCents > 0
                ? formatSignedCentsWithHistoricalCurrency(
                    -sessionTotals.manualOutCents,
                    sessionCurrency,
                  )
                : formatCentsWithHistoricalCurrency(0, sessionCurrency)}
            </strong>
          </div>

          {sessionTotals.cashRefundsCents > 0 ? (
            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Reembolsos POS (-)
              </span>
              <strong className="inventory-preview-stat__value inventory-delta-value--negative">
                {formatSignedCentsWithHistoricalCurrency(
                  -sessionTotals.cashRefundsCents,
                  sessionCurrency,
                )}
              </strong>
            </div>
          ) : null}

          <div className="inventory-preview-stat">
            <span className="inventory-preview-stat__label">
              Saldo esperado
            </span>
            <strong className="inventory-preview-stat__value inventory-preview-stat__value--highlight">
              {formatCentsWithHistoricalCurrency(
                sessionTotals.expectedBalanceCents,
                sessionCurrency,
              )}
            </strong>
          </div>
        </div>

        <p className="inventory-precision-banner">
          <strong>Regla de inmutabilidad:</strong> Los movimientos confirmados
          no pueden editarse ni borrarse.{' '}
          {isSessionOpen
            ? 'Para corregir una entrada o retiro en este turno abierto, usa "Compensar" para registrar un movimiento compensatorio inverso.'
            : 'Esta sesión se encuentra cerrada; sus movimientos son históricos y de solo lectura.'}
        </p>

        {/* Barra de filtros */}
        <div className="cash-filters-bar">
          <div className="cash-filters-bar__controls">
            <div className="ui-select-field">
              <label htmlFor={typeSelectId} className="ui-input__label">
                Tipo de movimiento
              </label>
              <select
                id={typeSelectId}
                className="ui-select-field__control"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(
                    e.target.value as SessionMovementsFilters['typeFilter'],
                  )
                }
              >
                <option value="all">Todos los tipos</option>
                <option value="opening_float">Fondo inicial de apertura</option>
                <option value="cash_sale">Cobro de venta en efectivo (+)</option>
                <option value="cash_refund">Reembolsos de venta en efectivo (-)</option>
                <option value="manual_in">Entradas manuales (+)</option>
                <option value="manual_out">Retiros manuales (-)</option>
                <option value="compensatory">Movimientos compensatorios</option>
              </select>
            </div>

            <div className="ui-select-field">
              <label htmlFor={periodSelectId} className="ui-input__label">
                Periodo dentro de la sesión
              </label>
              <select
                id={periodSelectId}
                className="ui-select-field__control"
                value={periodFilter}
                onChange={(e) =>
                  setPeriodFilter(e.target.value as SessionMovementPeriodFilter)
                }
              >
                <option value="all">Toda la sesión</option>
                <option value="last_hour">Última hora</option>
                <option value="last_4_hours">Últimas 4 horas</option>
                <option value="today">Hoy ({timezoneShort})</option>
              </select>
            </div>
          </div>

          <div className="cash-filters-bar__actions">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTypeFilter('all')
                  setPeriodFilter('all')
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
            {isSessionOpen ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onRequestManualEntry()}
                >
                  + Entrada manual
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestManualWithdrawal()}
                >
                  - Retiro manual
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Tabla de movimientos */}
        {filteredMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos para los filtros seleccionados"
            description={`La sesión cuenta con ${sessionMovements.length} movimiento(s) en total. Ajusta o limpia los filtros para ver todos los registros.`}
            action={
              hasActiveFilters ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTypeFilter('all')
                    setPeriodFilter('all')
                  }}
                >
                  Mostrar todos ({sessionMovements.length})
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="products-table-wrapper">
            <table
              className="products-table"
              aria-label="Lista completa de movimientos de la sesión de caja"
            >
              <thead>
                <tr>
                  <th scope="col">Fecha y hora ({timezoneShort})</th>
                  <th scope="col">Tipo y dirección</th>
                  <th scope="col" className="products-table__num-col">
                    Importe ({sessionCurrency})
                  </th>
                  <th scope="col" className="products-table__num-col">
                    Saldo posterior ({sessionCurrency})
                  </th>
                  <th scope="col">Motivo y referencia</th>
                  <th scope="col">Responsable</th>
                  {isSessionOpen ? (
                    <th scope="col" className="products-table__actions-col">
                      Corrección
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((mov) => {
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
                          <div className="cash-movement-refs">
                            {mov.reference ? (
                              <span className="inventory-reason-cell__ref">
                                Ref: <code>{mov.reference}</code>
                              </span>
                            ) : (
                              <span className="product-cell-muted">
                                Sin referencia
                              </span>
                            )}
                            {mov.compensatedMovementId ? (
                              <span className="inventory-reason-cell__ref">
                                Compensa a: <code>{mov.compensatedMovementId}</code>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td data-label="Responsable">
                        <span className="inventory-operator-name">
                          {mov.operatorName}
                        </span>
                      </td>

                      {isSessionOpen ? (
                        <td
                          data-label="Corrección"
                          className="products-table__actions-col"
                        >
                          {mov.type === 'manual_in' ||
                          mov.type === 'manual_out' ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (mov.direction === 'in') {
                                  onRequestManualWithdrawal(mov)
                                } else {
                                  onRequestManualEntry(mov)
                                }
                              }}
                            >
                              Compensar
                            </Button>
                          ) : (
                            <span className="product-cell-muted">Apertura</span>
                          )}
                        </td>
                      ) : null}
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
