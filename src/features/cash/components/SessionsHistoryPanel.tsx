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
  SessionsHistoryFilters,
  SessionsHistoryPeriodFilter,
} from '../types'
import {
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
  formatSignedCentsWithHistoricalCurrency,
  getCashMovementTypePresentation,
  getDifferencePresentation,
  isSessionWithinHistoryPeriod,
  sortCashMovementsDeterministically,
  sortCashSessionsDeterministically,
} from '../utils/moneyUtils'

export interface SessionsHistoryPanelProps {
  organizationName: string
  branchName: string
  register: CashRegister
  sessions: CashSession[]
  movements: CashMovement[]
  preferences: OrganizationPreferences
  onSelectSessionForMovementsView?: (session: CashSession) => void
}

export function SessionsHistoryPanel({
  organizationName,
  branchName,
  register,
  sessions,
  movements,
  preferences,
  onSelectSessionForMovementsView,
}: SessionsHistoryPanelProps) {
  const statusSelectId = useId()
  const periodSelectId = useId()
  const timezoneShort = getTimezoneShortLabel(preferences.timezone)

  const [statusFilter, setStatusFilter] =
    useState<SessionsHistoryFilters['statusFilter']>('all')
  const [periodFilter, setPeriodFilter] =
    useState<SessionsHistoryPeriodFilter>('all')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  )

  const sortedSessions = useMemo(
    () => sortCashSessionsDeterministically(sessions),
    [sessions],
  )

  const filteredSessions = useMemo(() => {
    return sortedSessions.filter((ses) => {
      if (statusFilter !== 'all' && ses.status !== statusFilter) {
        return false
      }
      if (
        !isSessionWithinHistoryPeriod(
          ses.openedAt,
          periodFilter,
          preferences.timezone,
        )
      ) {
        return false
      }
      return true
    })
  }, [sortedSessions, statusFilter, periodFilter, preferences.timezone])

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) {
      return null
    }
    return sortedSessions.find((s) => s.id === selectedSessionId) ?? null
  }, [sortedSessions, selectedSessionId])

  const selectedSessionMovements = useMemo(() => {
    if (!selectedSession) {
      return []
    }
    return sortCashMovementsDeterministically(
      movements.filter((m) => m.sessionId === selectedSession.id),
    )
  }, [movements, selectedSession])

  const selectedSessionTotals = useMemo(() => {
    if (!selectedSession) {
      return null
    }
    return calculateSessionComputedTotals(
      selectedSession,
      selectedSessionMovements,
    )
  }, [selectedSession, selectedSessionMovements])

  const hasActiveFilters = statusFilter !== 'all' || periodFilter !== 'all'

  return (
    <div className="cash-open-stack">
      <Card
        as="section"
        padding="lg"
        title="Historial de sesiones de caja"
        subtitle={`Turnos abiertos y cerrados en ${register.name} (${register.code}) · ${organizationName} (${branchName}). Cada sesión conserva la moneda histórica fijada al momento de su apertura.`}
        headerAction={
          <Badge variant="neutral">
            {filteredSessions.length} de {sortedSessions.length} sesiones
          </Badge>
        }
      >
        <div className="cash-filters-bar">
          <div className="cash-filters-bar__controls">
            <div className="ui-select-field">
              <label htmlFor={statusSelectId} className="ui-input__label">
                Estado del turno
              </label>
              <select
                id={statusSelectId}
                className="ui-select-field__control"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as SessionsHistoryFilters['statusFilter'],
                  )
                }
              >
                <option value="all">Todos los estados</option>
                <option value="open">Abiertas (en curso)</option>
                <option value="closed">Cerradas (arqueadas)</option>
              </select>
            </div>

            <div className="ui-select-field">
              <label htmlFor={periodSelectId} className="ui-input__label">
                Periodo de apertura
              </label>
              <select
                id={periodSelectId}
                className="ui-select-field__control"
                value={periodFilter}
                onChange={(e) =>
                  setPeriodFilter(e.target.value as SessionsHistoryPeriodFilter)
                }
              >
                <option value="all">Todo el historial</option>
                <option value="today">Hoy ({timezoneShort})</option>
                <option value="last_7_days">Últimos 7 días</option>
                <option value="last_30_days">Últimos 30 días</option>
              </select>
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="cash-filters-bar__actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all')
                  setPeriodFilter('all')
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </div>

        {filteredSessions.length === 0 ? (
          <EmptyState
            title="No se encontraron sesiones para los filtros aplicados"
            description="Ajusta el filtro de estado o amplía el rango de fechas para consultar sesiones anteriores."
            action={
              hasActiveFilters ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all')
                    setPeriodFilter('all')
                  }}
                >
                  Ver todas las sesiones ({sortedSessions.length})
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="products-table-wrapper">
            <table
              className="products-table"
              aria-label="Historial de sesiones de caja de la sucursal"
            >
              <thead>
                <tr>
                  <th scope="col">Apertura y cierre ({timezoneShort})</th>
                  <th scope="col">Caja y responsables</th>
                  <th scope="col">Estado y moneda</th>
                  <th scope="col" className="products-table__num-col">
                    Fondo inicial
                  </th>
                  <th scope="col" className="products-table__num-col">
                    Saldo esperado
                  </th>
                  <th scope="col" className="products-table__num-col">
                    Efectivo contado
                  </th>
                  <th scope="col">Diferencia de arqueo</th>
                  <th scope="col" className="products-table__actions-col">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((ses) => {
                  const isClosed = ses.status === 'closed'
                  const openedDt = formatDateTimeInOrganizationTimezone(
                    ses.openedAt,
                    preferences.timezone,
                    preferences.dateFormat,
                  )
                  const closedDt = ses.closedAt
                    ? formatDateTimeInOrganizationTimezone(
                        ses.closedAt,
                        preferences.timezone,
                        preferences.dateFormat,
                      )
                    : null

                  const totals = calculateSessionComputedTotals(ses, movements)
                  const expectedCents =
                    isClosed && ses.expectedClosingAmountCents !== null
                      ? ses.expectedClosingAmountCents
                      : totals.expectedBalanceCents

                  const diffMeta =
                    isClosed &&
                    ses.differenceAmountCents !== null &&
                    ses.differenceKind !== null
                      ? getDifferencePresentation(
                          ses.differenceAmountCents,
                          ses.differenceKind,
                          ses.currency,
                        )
                      : null

                  const isSelected = selectedSessionId === ses.id

                  return (
                    <tr
                      key={ses.id}
                      className={
                        isSelected ? 'cash-history-row--selected' : undefined
                      }
                    >
                      <td data-label="Apertura y cierre">
                        <div className="inventory-history-date">
                          <span>
                            <strong>Apertura:</strong> {openedDt.fullLabel}
                          </span>
                          <span className="inventory-history-date__time">
                            <strong>Cierre:</strong>{' '}
                            {closedDt ? closedDt.fullLabel : 'En curso'}
                          </span>
                        </div>
                      </td>

                      <td data-label="Caja y responsables">
                        <div className="inventory-history-date">
                          <strong>{ses.registerName}</strong>
                          <span className="inventory-history-date__time">
                            Abrió: {ses.openedBy}
                            {ses.closedBy ? ` · Cerró: ${ses.closedBy}` : ''}
                          </span>
                        </div>
                      </td>

                      <td data-label="Estado y moneda">
                        <div className="inventory-status-stack">
                          <Badge variant={isClosed ? 'neutral' : 'success'}>
                            {isClosed ? 'Cerrada' : 'Abierta'}
                          </Badge>
                          <Badge variant="brand">Moneda: {ses.currency}</Badge>
                        </div>
                      </td>

                      <td
                        data-label="Fondo inicial"
                        className="products-table__num-col"
                      >
                        <strong>
                          {formatCentsWithHistoricalCurrency(
                            ses.openingAmountCents,
                            ses.currency,
                          )}
                        </strong>
                      </td>

                      <td
                        data-label="Saldo esperado"
                        className="products-table__num-col"
                      >
                        <strong>
                          {formatCentsWithHistoricalCurrency(
                            expectedCents,
                            ses.currency,
                          )}
                        </strong>
                      </td>

                      <td
                        data-label="Efectivo contado"
                        className="products-table__num-col"
                      >
                        {isClosed && ses.countedAmountCents !== null ? (
                          <strong>
                            {formatCentsWithHistoricalCurrency(
                              ses.countedAmountCents,
                              ses.currency,
                            )}
                          </strong>
                        ) : (
                          <span className="product-cell-muted">—</span>
                        )}
                      </td>

                      <td data-label="Diferencia de arqueo">
                        {diffMeta ? (
                          <Badge variant={diffMeta.badgeVariant}>
                            {diffMeta.label}
                          </Badge>
                        ) : (
                          <span className="product-cell-muted">
                            Turno abierto
                          </span>
                        )}
                      </td>

                      <td
                        data-label="Detalle"
                        className="products-table__actions-col"
                      >
                        <Button
                          type="button"
                          variant={isSelected ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setSelectedSessionId(isSelected ? null : ses.id)
                          }
                        >
                          {isSelected ? 'Ocultar detalle' : 'Ver detalle'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detalle completo y movimientos de la sesión seleccionada */}
      {selectedSession && selectedSessionTotals ? (
        <Card
          as="section"
          padding="lg"
          title={`Detalle de sesión · ${selectedSession.id}`}
          subtitle={`Snapshot histórico en moneda ${selectedSession.currency}. Las sesiones cerradas son de solo lectura y no se recalculan con cambios posteriores de preferencias.`}
          headerAction={
            <div className="cash-session-badges">
              {onSelectSessionForMovementsView ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onSelectSessionForMovementsView(selectedSession)
                  }
                >
                  Abrir en vista de movimientos
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSessionId(null)}
              >
                Cerrar detalle
              </Button>
            </div>
          }
        >
          <div
            className="inventory-preview-grid inventory-preview-grid--four"
            aria-label="Resumen de montos de la sesión seleccionada"
          >
            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Fondo inicial ({selectedSession.currency})
              </span>
              <strong className="inventory-preview-stat__value">
                {formatCentsWithHistoricalCurrency(
                  selectedSession.openingAmountCents,
                  selectedSession.currency,
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
                  selectedSessionTotals.manualInCents,
                  selectedSession.currency,
                )}{' '}
                / -
                {formatCentsWithHistoricalCurrency(
                  selectedSessionTotals.manualOutCents,
                  selectedSession.currency,
                )}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Saldo esperado al cierre
              </span>
              <strong className="inventory-preview-stat__value">
                {formatCentsWithHistoricalCurrency(
                  selectedSession.status === 'closed' &&
                    selectedSession.expectedClosingAmountCents !== null
                    ? selectedSession.expectedClosingAmountCents
                    : selectedSessionTotals.expectedBalanceCents,
                  selectedSession.currency,
                )}
              </strong>
            </div>

            <div className="inventory-preview-stat">
              <span className="inventory-preview-stat__label">
                Efectivo contado y diferencia
              </span>
              {selectedSession.status === 'closed' &&
              selectedSession.countedAmountCents !== null &&
              selectedSession.differenceAmountCents !== null &&
              selectedSession.differenceKind !== null ? (
                <div className="inventory-status-stack">
                  <strong className="inventory-preview-stat__value">
                    {formatCentsWithHistoricalCurrency(
                      selectedSession.countedAmountCents,
                      selectedSession.currency,
                    )}
                  </strong>
                  <Badge
                    variant={
                      getDifferencePresentation(
                        selectedSession.differenceAmountCents,
                        selectedSession.differenceKind,
                        selectedSession.currency,
                      ).badgeVariant
                    }
                  >
                    {
                      getDifferencePresentation(
                        selectedSession.differenceAmountCents,
                        selectedSession.differenceKind,
                        selectedSession.currency,
                      ).label
                    }
                  </Badge>
                </div>
              ) : (
                <span className="product-cell-muted">Turno aún en curso</span>
              )}
            </div>
          </div>

          {selectedSession.openingNote || selectedSession.closingNote ? (
            <div className="cash-session-notes-box">
              {selectedSession.openingNote ? (
                <p>
                  <strong>Nota de apertura:</strong>{' '}
                  {selectedSession.openingNote}
                </p>
              ) : null}
              {selectedSession.closingNote ? (
                <p>
                  <strong>Observación de cierre:</strong>{' '}
                  {selectedSession.closingNote}
                </p>
              ) : null}
            </div>
          ) : null}

          <h4 className="cash-detail-subheading">
            Movimientos registrados en esta sesión (
            {selectedSessionMovements.length})
          </h4>

          <div className="products-table-wrapper">
            <table
              className="products-table"
              aria-label={`Movimientos de la sesión ${selectedSession.id}`}
            >
              <thead>
                <tr>
                  <th scope="col">Fecha y hora ({timezoneShort})</th>
                  <th scope="col">Tipo y dirección</th>
                  <th scope="col" className="products-table__num-col">
                    Importe ({selectedSession.currency})
                  </th>
                  <th scope="col" className="products-table__num-col">
                    Saldo posterior
                  </th>
                  <th scope="col">Motivo y referencia</th>
                  <th scope="col">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {selectedSessionMovements.map((mov) => {
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
