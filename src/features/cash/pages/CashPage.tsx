import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../../app/navigation'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { LoadingState } from '../../../components/ui/LoadingState'
import { PageHeader } from '../../../components/ui/PageHeader'
import type { Organization } from '../../../types'
import { getBranchForOrganization } from '../../inventory/utils/mockInventory'
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import { UnsavedChangesModal } from '../../settings/UnsavedChangesModal'
import { ActiveSessionStatusPanel } from '../components/ActiveSessionStatusPanel'
import {
  CashManualMovementPanel,
  type CashManualMovementSubmitPayload,
} from '../components/CashManualMovementPanel'
import {
  CloseCashSessionPanel,
  type CloseCashSessionSubmitPayload,
} from '../components/CloseCashSessionPanel'
import {
  OpenCashSessionPanel,
  type OpenCashSessionSubmitPayload,
} from '../components/OpenCashSessionPanel'
import { SessionMovementsPanel } from '../components/SessionMovementsPanel'
import { SessionsHistoryPanel } from '../components/SessionsHistoryPanel'
import {
  defaultCashRepository,
  generateCashId,
  getOrganizationCashStorageKey,
} from '../services/cashRepository'
import type {
  CashMovement,
  CashSession,
  OrganizationCashData,
} from '../types'
import {
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
  getDifferencePresentation,
  sortCashSessionsDeterministically,
} from '../utils/moneyUtils'

type CashViewMode =
  | 'status'
  | 'open_session'
  | 'manual_in'
  | 'manual_out'
  | 'close_session'
  | 'session_movements'
  | 'history'

type QaUiPreviewState = 'normal' | 'loading' | 'empty' | 'error'

export function CashPage() {
  const { activeOrganization } = useDemoOrganization()

  return (
    <OrganizationCashWorkspace
      key={activeOrganization.id}
      organization={activeOrganization}
    />
  )
}

interface OrganizationCashWorkspaceProps {
  organization: Organization
}

function OrganizationCashWorkspace({
  organization,
}: OrganizationCashWorkspaceProps) {
  const navigate = useNavigate()
  const {
    organizations,
    demoUser,
    pendingSwitchOrgId,
    cancelPendingSwitch,
    forceSelectOrganization,
    setHasUnsavedSettingsChanges,
    simulateStorageError,
    setSimulateStorageError,
  } = useDemoOrganization()

  const branchInfo = useMemo(
    () => getBranchForOrganization(organization.id, organization.branchName),
    [organization.id, organization.branchName],
  )

  const [initialCashLoad] = useState(() =>
    defaultCashRepository.load(organization.id, branchInfo.id),
  )

  const [cashData, setCashData] = useState<OrganizationCashData>(
    initialCashLoad.cashData,
  )
  const [storageWarning, setStorageWarning] = useState<string | undefined>(
    initialCashLoad.warning,
  )

  const [viewMode, setViewMode] = useState<CashViewMode>('status')
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false)
  const [pendingViewTarget, setPendingViewTarget] =
    useState<CashViewMode | null>(null)
  const [compensatingMovement, setCompensatingMovement] =
    useState<CashMovement | null>(null)
  const [inspectedSessionIdForMovements, setInspectedSessionIdForMovements] =
    useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [qaUiState, setQaUiState] = useState<QaUiPreviewState>('normal')

  useEffect(() => {
    setHasUnsavedSettingsChanges(isFormDirty)
    return () => {
      setHasUnsavedSettingsChanges(false)
    }
  }, [isFormDirty, setHasUnsavedSettingsChanges])

  // Sincronización multi-pestaña mediante evento storage
  useEffect(() => {
    const expectedKey = getOrganizationCashStorageKey(
      organization.id,
      branchInfo.id,
    )
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === expectedKey) {
        const reloaded = defaultCashRepository.load(
          organization.id,
          branchInfo.id,
        )
        setCashData(reloaded.cashData)
        if (reloaded.warning) {
          setStorageWarning(reloaded.warning)
        }
      }
    }

    window.addEventListener('storage', handleStorageEvent)
    return () => {
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [organization.id, branchInfo.id])

  const register = cashData.register

  const openSession = useMemo(
    () =>
      cashData.sessions.find(
        (s) =>
          s.organizationId === organization.id &&
          s.branchId === branchInfo.id &&
          s.registerId === register.id &&
          s.status === 'open',
      ) ?? null,
    [cashData.sessions, organization.id, branchInfo.id, register.id],
  )

  const openSessionTotals = useMemo(() => {
    if (!openSession) {
      return null
    }
    return calculateSessionComputedTotals(openSession, cashData.movements)
  }, [openSession, cashData.movements])

  const lastClosedSession = useMemo(() => {
    const sorted = sortCashSessionsDeterministically(
      cashData.sessions.filter(
        (s) =>
          s.organizationId === organization.id &&
          s.branchId === branchInfo.id &&
          s.registerId === register.id &&
          s.status === 'closed',
      ),
    )
    return sorted[0] ?? null
  }, [cashData.sessions, organization.id, branchInfo.id, register.id])

  const activeMovementsViewSession = useMemo(() => {
    if (inspectedSessionIdForMovements) {
      return (
        cashData.sessions.find(
          (s) => s.id === inspectedSessionIdForMovements,
        ) ?? openSession
      )
    }
    return openSession
  }, [cashData.sessions, inspectedSessionIdForMovements, openSession])

  const activeMovementsViewTotals = useMemo(() => {
    if (!activeMovementsViewSession) {
      return null
    }
    return calculateSessionComputedTotals(
      activeMovementsViewSession,
      cashData.movements,
    )
  }, [activeMovementsViewSession, cashData.movements])

  const pendingTargetOrganization = useMemo(
    () => organizations.find((o) => o.id === pendingSwitchOrgId) ?? null,
    [organizations, pendingSwitchOrgId],
  )

  const requestViewTransition = (targetView: CashViewMode) => {
    if (targetView === viewMode) {
      return
    }
    if (isFormDirty) {
      setPendingViewTarget(targetView)
      return
    }
    if (targetView !== 'manual_in' && targetView !== 'manual_out') {
      setCompensatingMovement(null)
    }
    if (targetView === 'session_movements' && !inspectedSessionIdForMovements) {
      setInspectedSessionIdForMovements(openSession?.id ?? null)
    }
    setViewMode(targetView)
  }

  const handleConfirmDiscardViewSwitch = () => {
    if (!pendingViewTarget) {
      return
    }
    const target = pendingViewTarget
    setIsFormDirty(false)
    setPendingViewTarget(null)
    if (target !== 'manual_in' && target !== 'manual_out') {
      setCompensatingMovement(null)
    }
    setViewMode(target)
  }

  const handleSubmitOpenSession = (payload: OpenCashSessionSubmitPayload) => {
    const outcome = defaultCashRepository.openSession({
      organizationId: organization.id,
      branchId: branchInfo.id,
      registerId: register.id,
      openingAmountCents: payload.openingAmountCents,
      currency: payload.currency,
      openingNote: payload.openingNote,
      operatorName: payload.operatorName,
      operationId: payload.operationId,
      simulateStorageError,
    })

    if (!outcome.ok) {
      if (outcome.latestCashData) {
        setCashData(outcome.latestCashData)
      }
      return {
        ok: false,
        error: outcome.error,
      }
    }

    setCashData(outcome.cashData)
    setIsFormDirty(false)
    setFeedback({
      type: 'success',
      message: `Sesión de caja abierta en "${register.name}" con fondo inicial de ${formatCentsWithHistoricalCurrency(
        outcome.session.openingAmountCents,
        outcome.session.currency,
      )} (${outcome.session.currency}).`,
    })
    setViewMode('status')
    return { ok: true }
  }

  const handleSubmitManualMovement = (
    payload: CashManualMovementSubmitPayload,
  ) => {
    const outcome = defaultCashRepository.registerManualMovement({
      organizationId: organization.id,
      branchId: branchInfo.id,
      sessionId: payload.sessionId,
      type: payload.type,
      amountCents: payload.amountCents,
      reason: payload.reason,
      reference: payload.reference,
      isCompensatory: payload.isCompensatory,
      compensatedMovementId: payload.compensatedMovementId,
      operatorName: payload.operatorName,
      operationId: payload.operationId,
      expectedSessionVersion: payload.expectedSessionVersion,
      simulateStorageError,
    })

    if (!outcome.ok) {
      if (outcome.latestCashData) {
        setCashData(outcome.latestCashData)
      }
      return {
        ok: false,
        errorCode: outcome.errorCode,
        error: outcome.error,
      }
    }

    setCashData(outcome.cashData)
    setIsFormDirty(false)
    setCompensatingMovement(null)

    const mov = outcome.movement
    if (mov) {
      const actionLabel = mov.isCompensatory
        ? 'Movimiento compensatorio registrado'
        : mov.type === 'manual_in'
          ? 'Entrada manual registrada'
          : 'Retiro manual registrado'

      setFeedback({
        type: 'success',
        message: `${actionLabel}: ${
          mov.direction === 'in' ? '+' : '-'
        }${formatCentsWithHistoricalCurrency(
          mov.amountCents,
          mov.currency,
        )}. Nuevo saldo esperado en caja: ${formatCentsWithHistoricalCurrency(
          mov.balanceAfterCents,
          mov.currency,
        )}.`,
      })
    }

    setViewMode('status')
    return { ok: true }
  }

  const handleSubmitCloseSession = (payload: CloseCashSessionSubmitPayload) => {
    const outcome = defaultCashRepository.closeSession({
      organizationId: organization.id,
      branchId: branchInfo.id,
      sessionId: payload.sessionId,
      countedAmountCents: payload.countedAmountCents,
      closingNote: payload.closingNote,
      operatorName: payload.operatorName,
      operationId: payload.operationId,
      expectedSessionVersion: payload.expectedSessionVersion,
      expectedBalanceCents: payload.expectedBalanceCents,
      simulateStorageError,
    })

    if (!outcome.ok) {
      if (outcome.latestCashData) {
        setCashData(outcome.latestCashData)
      }
      return {
        ok: false,
        errorCode: outcome.errorCode,
        error: outcome.error,
      }
    }

    setCashData(outcome.cashData)
    setIsFormDirty(false)

    const closed = outcome.session
    const diffPres =
      closed.differenceAmountCents !== null && closed.differenceKind !== null
        ? getDifferencePresentation(
            closed.differenceAmountCents,
            closed.differenceKind,
            closed.currency,
          ).label
        : 'Sin diferencia'

    setFeedback({
      type: 'success',
      message: `Turno cerrado en "${register.name}". Contado: ${formatCentsWithHistoricalCurrency(
        closed.countedAmountCents ?? 0,
        closed.currency,
      )} · Esperado: ${formatCentsWithHistoricalCurrency(
        closed.expectedClosingAmountCents ?? 0,
        closed.currency,
      )} · Resultado: ${diffPres}.`,
    })
    setViewMode('status')
    return { ok: true }
  }

  const handleSimulateConcurrentBalanceChange = () => {
    if (!openSession) {
      return
    }
    const outcome = defaultCashRepository.registerManualMovement({
      organizationId: organization.id,
      branchId: branchInfo.id,
      sessionId: openSession.id,
      type: 'manual_in',
      amountCents: 5000, // +$50.00
      reason: 'Ingreso intermedio simulado desde otra ventana (QA concurrencia)',
      reference: 'QA-CONC-50',
      operatorName: 'Supervisor QA',
      operationId: generateCashId('op'),
      simulateStorageError: false,
    })

    if (outcome.ok) {
      setCashData(outcome.cashData)
      setFeedback({
        type: 'info',
        message: `Se simuló un ingreso externo de ${formatCentsWithHistoricalCurrency(
          5000,
          openSession.currency,
        )} en la sesión activa (versión #${outcome.session.version}). El formulario actual detectará el cambio de saldo.`,
      })
    }
  }

  return (
    <div className="inventory-page">
      <PageHeader
        title={`Caja y sesiones · ${organization.name}`}
        description={`Control de turnos, fondo inicial, entradas y retiros manuales de efectivo y arqueo de cierre en ${register.name} (${branchInfo.name}).`}
        badge={
          <Badge variant={openSession ? 'success' : 'neutral'}>
            {openSession
              ? `Sesión abierta (${openSession.currency})`
              : 'Caja cerrada'}
          </Badge>
        }
        actions={
          <div className="page-header-actions-group">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.summary)}
            >
              Ver Resumen operativo
            </Button>
            {openSession ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCompensatingMovement(null)
                    requestViewTransition('manual_in')
                  }}
                >
                  + Entrada manual
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCompensatingMovement(null)
                    requestViewTransition('manual_out')
                  }}
                >
                  - Retiro manual
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => requestViewTransition('close_session')}
                >
                  Cerrar caja
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => requestViewTransition('open_session')}
              >
                Abrir sesión de caja
              </Button>
            )}
          </div>
        }
      />

      {/* Aviso de alcance de la fase */}
      <div
        className="demo-data-banner"
        role="note"
        aria-label="Contexto operativo de caja"
      >
        <div className="demo-data-banner__content">
          <span
            className="demo-data-banner__swatch"
            style={{ backgroundColor: organization.primaryColor }}
            aria-hidden="true"
          />
          <p className="demo-data-banner__text">
            <strong>Punto de cobro activo:</strong>{' '}
            <strong>
              {register.name} ({register.code})
            </strong>{' '}
            en <strong>{branchInfo.name}</strong> (
            <code>{organization.id}</code>). Esta fase administra sesiones de
            caja y movimientos manuales de efectivo; aún no procesa ventas de
            mostrador, pagos bancarios ni gastos contables.
          </p>
        </div>
      </div>

      {storageWarning ? (
        <div
          className="settings-alert settings-alert--warning"
          role="status"
          aria-live="polite"
        >
          <div className="settings-alert__content">
            <strong>Aviso de almacenamiento local</strong>
            <p>{storageWarning}</p>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`settings-alert settings-alert--${feedback.type}`}
          role="status"
          aria-live="polite"
        >
          <div className="settings-alert__content">
            <strong>
              {feedback.type === 'success'
                ? 'Operación de caja registrada'
                : feedback.type === 'warning'
                  ? 'Atención'
                  : feedback.type === 'error'
                    ? 'Operación rechazada'
                    : 'Información de caja'}
            </strong>
            <p>{feedback.message}</p>
          </div>
          <div className="settings-alert__actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFeedback(null)}
            >
              Cerrar aviso
            </Button>
          </div>
        </div>
      ) : null}

      {/* Confirmación cuando el usuario intenta cambiar de vista con datos sin guardar */}
      {pendingViewTarget ? (
        <div
          className="settings-alert settings-alert--warning"
          role="alert"
        >
          <div className="settings-alert__content">
            <strong>Tienes datos sin confirmar en el formulario actual</strong>
            <p>
              Si cambias de vista ahora, se descartarán los importes o notas que
              capturaste sin confirmar.
            </p>
          </div>
          <div className="settings-alert__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPendingViewTarget(null)}
            >
              Continuar en el formulario
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmDiscardViewSwitch}
            >
              Descartar y cambiar de vista
            </Button>
          </div>
        </div>
      ) : null}

      {/* Pestañas de navegación del módulo de Caja */}
      <nav
        className="inventory-view-tabs"
        aria-label="Vistas operativas del módulo de Caja"
      >
        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'status' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => requestViewTransition('status')}
        >
          Estado de caja
        </button>

        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'open_session' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => requestViewTransition('open_session')}
        >
          Abrir sesión
        </button>

        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'manual_in' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => {
            setCompensatingMovement(null)
            requestViewTransition('manual_in')
          }}
        >
          + Entrada manual
        </button>

        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'manual_out' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => {
            setCompensatingMovement(null)
            requestViewTransition('manual_out')
          }}
        >
          - Retiro manual
        </button>

        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'close_session' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => requestViewTransition('close_session')}
        >
          Cerrar sesión
        </button>

        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'session_movements' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => {
            setInspectedSessionIdForMovements(openSession?.id ?? null)
            requestViewTransition('session_movements')
          }}
        >
          Movimientos de la sesión
        </button>

        <button
          type="button"
          className={`inventory-view-tab ${
            viewMode === 'history' ? 'inventory-view-tab--active' : ''
          }`}
          onClick={() => requestViewTransition('history')}
        >
          Historial de sesiones ({cashData.sessions.length})
        </button>
      </nav>

      {/* Estados simulados de interfaz (QA) o vista activa */}
      {qaUiState === 'loading' ? (
        <Card as="section">
          <LoadingState
            title={`Cargando estado de caja de ${organization.name}...`}
            description="Sincronizando sesión activa, saldo esperado y bitácora de movimientos."
          />
        </Card>
      ) : qaUiState === 'error' ? (
        <Card as="section">
          <ErrorState
            title="No fue posible consultar el estado de caja"
            description="Simulación de fallo de lectura. Tus sesiones y movimientos confirmados permanecen íntegros."
            onRetry={() => setQaUiState('normal')}
            retryLabel="Reintentar consulta"
          />
        </Card>
      ) : qaUiState === 'empty' ? (
        <Card as="section">
          <EmptyState
            title="Sin sesiones registradas en este punto de cobro"
            description="Vista previa del estado vacío cuando una caja aún no tiene sesiones abiertas ni historial previo."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setQaUiState('normal')}
              >
                Restaurar vista de caja
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* VISTA 1: ESTADO DE CAJA */}
          {viewMode === 'status' ? (
            <ActiveSessionStatusPanel
              organizationName={organization.name}
              register={register}
              openSession={openSession}
              openSessionTotals={openSessionTotals}
              lastClosedSession={lastClosedSession}
              movements={cashData.movements}
              preferences={organization.preferences}
              onRequestOpenSession={() => requestViewTransition('open_session')}
              onRequestManualEntry={(compMov) => {
                setCompensatingMovement(compMov ?? null)
                setIsFormDirty(false)
                setViewMode('manual_in')
              }}
              onRequestManualWithdrawal={(compMov) => {
                setCompensatingMovement(compMov ?? null)
                setIsFormDirty(false)
                setViewMode('manual_out')
              }}
              onRequestCloseSession={() =>
                requestViewTransition('close_session')
              }
              onRequestViewSessionMovements={() => {
                setInspectedSessionIdForMovements(openSession?.id ?? null)
                requestViewTransition('session_movements')
              }}
              onRequestViewSessionsHistory={() =>
                requestViewTransition('history')
              }
            />
          ) : null}

          {/* VISTA 2: ABRIR SESIÓN */}
          {viewMode === 'open_session' ? (
            <OpenCashSessionPanel
              organizationName={organization.name}
              branchName={branchInfo.name}
              register={register}
              openSession={openSession}
              preferences={organization.preferences}
              defaultOperatorName={demoUser.name}
              onDirtyChange={setIsFormDirty}
              onSubmitOpenSession={handleSubmitOpenSession}
              onCancel={() => requestViewTransition('status')}
            />
          ) : null}

          {/* VISTA 3 Y 4: ENTRADA MANUAL / RETIRO MANUAL / COMPENSACIÓN */}
          {viewMode === 'manual_in' || viewMode === 'manual_out' ? (
            <CashManualMovementPanel
              key={`${viewMode}-${compensatingMovement?.id ?? 'direct'}`}
              mode={viewMode}
              organizationName={organization.name}
              branchName={branchInfo.name}
              register={register}
              openSession={openSession}
              openSessionTotals={openSessionTotals}
              compensatingMovement={compensatingMovement}
              defaultOperatorName={demoUser.name}
              onDirtyChange={setIsFormDirty}
              onSwitchMode={(nextMode) => {
                setIsFormDirty(false)
                setCompensatingMovement(null)
                setViewMode(nextMode)
              }}
              onClearCompensatingMovement={() => {
                setIsFormDirty(false)
                setCompensatingMovement(null)
              }}
              onRequestOpenSession={() => requestViewTransition('open_session')}
              onSubmitMovement={handleSubmitManualMovement}
              onCancel={() => requestViewTransition('status')}
            />
          ) : null}

          {/* VISTA 5: CERRAR SESIÓN */}
          {viewMode === 'close_session' ? (
            <CloseCashSessionPanel
              organizationName={organization.name}
              branchName={branchInfo.name}
              register={register}
              openSession={openSession}
              openSessionTotals={openSessionTotals}
              defaultOperatorName={demoUser.name}
              onDirtyChange={setIsFormDirty}
              onSubmitCloseSession={handleSubmitCloseSession}
              onCancel={() => requestViewTransition('status')}
            />
          ) : null}

          {/* VISTA 6: MOVIMIENTOS DE LA SESIÓN */}
          {viewMode === 'session_movements' ? (
            <SessionMovementsPanel
              organizationName={organization.name}
              branchName={branchInfo.name}
              register={register}
              session={activeMovementsViewSession}
              sessionTotals={activeMovementsViewTotals}
              movements={cashData.movements}
              preferences={organization.preferences}
              onRequestManualEntry={(compMov) => {
                setCompensatingMovement(compMov ?? null)
                setIsFormDirty(false)
                setViewMode('manual_in')
              }}
              onRequestManualWithdrawal={(compMov) => {
                setCompensatingMovement(compMov ?? null)
                setIsFormDirty(false)
                setViewMode('manual_out')
              }}
              onBackToStatus={() => requestViewTransition('status')}
              onViewSessionsHistory={() => requestViewTransition('history')}
            />
          ) : null}

          {/* VISTA 7: HISTORIAL DE SESIONES */}
          {viewMode === 'history' ? (
            <SessionsHistoryPanel
              organizationName={organization.name}
              branchName={branchInfo.name}
              register={register}
              sessions={cashData.sessions}
              movements={cashData.movements}
              preferences={organization.preferences}
              onSelectSessionForMovementsView={(ses: CashSession) => {
                setInspectedSessionIdForMovements(ses.id)
                setViewMode('session_movements')
              }}
            />
          ) : null}
        </>
      )}

      {/* Área discreta de desarrollo / QA */}
      <details className="dev-tools-drawer">
        <summary className="dev-tools-drawer__summary">
          Área de desarrollo y verificación QA (simulación de fallos y
          concurrencia en Caja)
        </summary>
        <div className="dev-tools-drawer__body">
          <label className="storage-test-toggle">
            <input
              type="checkbox"
              checked={simulateStorageError}
              onChange={(event) =>
                setSimulateStorageError(event.target.checked)
              }
            />
            <span>
              Simular fallo al guardar en localStorage (verifica que la sesión y
              los movimientos no se alteren)
            </span>
          </label>

          {openSession &&
          (viewMode === 'close_session' ||
            viewMode === 'manual_in' ||
            viewMode === 'manual_out') ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSimulateConcurrentBalanceChange}
            >
              Simular cambio intermedio de saldo (+$50.00) mientras el
              formulario está abierto
            </Button>
          ) : null}

          <div
            className="demo-state-switcher"
            role="group"
            aria-label="Simular estado de interfaz de Caja"
          >
            <span className="demo-state-switcher__label">Estado UI:</span>
            <button
              type="button"
              className={`demo-state-pill ${
                qaUiState === 'normal' ? 'demo-state-pill--active' : ''
              }`}
              onClick={() => setQaUiState('normal')}
            >
              Normal
            </button>
            <button
              type="button"
              className={`demo-state-pill ${
                qaUiState === 'loading' ? 'demo-state-pill--active' : ''
              }`}
              onClick={() => setQaUiState('loading')}
            >
              Cargando
            </button>
            <button
              type="button"
              className={`demo-state-pill ${
                qaUiState === 'empty' ? 'demo-state-pill--active' : ''
              }`}
              onClick={() => setQaUiState('empty')}
            >
              Vacío
            </button>
            <button
              type="button"
              className={`demo-state-pill ${
                qaUiState === 'error' ? 'demo-state-pill--active' : ''
              }`}
              onClick={() => setQaUiState('error')}
            >
              Error de red
            </button>
          </div>
        </div>
      </details>

      {pendingTargetOrganization ? (
        <UnsavedChangesModal
          currentOrgName={organization.name}
          targetOrgName={pendingTargetOrganization.name}
          onSaveAndSwitch={() => {
            cancelPendingSwitch()
            setFeedback({
              type: 'info',
              message:
                'Confirma primero la operación de caja en pantalla antes de cambiar de organización.',
            })
          }}
          onDiscardAndSwitch={() =>
            forceSelectOrganization(pendingTargetOrganization.id)
          }
          onCancelSwitch={cancelPendingSwitch}
        />
      ) : null}
    </div>
  )
}
