import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { APP_ROUTES } from '../../../app/navigation'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { LoadingState } from '../../../components/ui/LoadingState'
import { PageHeader } from '../../../components/ui/PageHeader'
import type { Organization } from '../../../types'
import type { OrganizationCashData } from '../../cash/types'
import {
  calculateSessionComputedTotals,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import { getBranchForOrganization } from '../../inventory/utils/mockInventory'
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import { defaultTicketSnapshotService } from '../../tickets/services/ticketSnapshotService'
import {
  CancelSaleModal,
  type CancelSaleSubmitPayload,
} from '../components/CancelSaleModal'
import {
  RefundSaleModal,
  type RefundSaleSubmitPayload,
} from '../components/RefundSaleModal'
import { SalesHistoryTable } from '../components/SalesHistoryTable'
import {
  defaultPosSalesCoordinator,
  generatePosId,
  getOrganizationBranchTransactionStorageKey,
} from '../services/posSalesCoordinator'
import type { OrganizationSalesData, SaleRecord } from '../types'
import { deriveSaleComputedTotals } from '../utils/posMoneyAndQuantityUtils'

type QaUiPreviewState = 'normal' | 'loading' | 'empty' | 'error'

export function SalesHistoryPage() {
  const { activeOrganization } = useDemoOrganization()

  return (
    <OrganizationSalesWorkspace
      key={activeOrganization.id}
      organization={activeOrganization}
    />
  )
}

interface OrganizationSalesWorkspaceProps {
  organization: Organization
}

function OrganizationSalesWorkspace({
  organization,
}: OrganizationSalesWorkspaceProps) {
  const navigate = useNavigate()
  const { demoUser } = useDemoOrganization()
  const [searchParams] = useSearchParams()
  const initialSaleIdParam = searchParams.get('saleId')

  const branchInfo = useMemo(
    () => getBranchForOrganization(organization.id, organization.branchName),
    [organization.id, organization.branchName],
  )

  const [workspace, setWorkspace] = useState(() =>
    defaultPosSalesCoordinator.loadWorkspace(organization.id, branchInfo.id),
  )
  const [salesData, setSalesData] = useState<OrganizationSalesData>(
    workspace.salesData,
  )
  const [cashData, setCashData] = useState<OrganizationCashData>(
    workspace.cashData,
  )
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(
    initialSaleIdParam,
  )

  // Modales de cancelación y devolución
  const [cancellingSale, setCancellingSale] = useState<SaleRecord | null>(null)
  const [refundingSale, setRefundingSale] = useState<SaleRecord | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false)
  const [actionModalError, setActionModalError] = useState<string | null>(null)
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)

  const [qaUiState, setQaUiState] = useState<QaUiPreviewState>('normal')

  // Recarga cuando cambia la clave de almacenamiento transaccional (sincronización multi-pestaña)
  useEffect(() => {
    const txKey = getOrganizationBranchTransactionStorageKey(
      organization.id,
      branchInfo.id,
    )
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === txKey) {
        const fresh = defaultPosSalesCoordinator.loadWorkspace(
          organization.id,
          branchInfo.id,
        )
        setWorkspace(fresh)
        setSalesData(fresh.salesData)
        setCashData(fresh.cashData)
      }
    }

    window.addEventListener('storage', handleStorageEvent)
    return () => {
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [organization.id, branchInfo.id])

  // Identificación de sesión de caja abierta y sus totales esperados
  const openSession = useMemo(() => {
    return cashData.sessions.find((s) => s.status === 'open') ?? null
  }, [cashData.sessions])

  const openSessionTotals = useMemo(() => {
    if (!openSession) return null
    const sessionMovements = cashData.movements.filter(
      (m) => m.sessionId === openSession.id,
    )
    return calculateSessionComputedTotals(openSession, sessionMovements)
  }, [openSession, cashData.movements])

  // Indicadores acumulados generales de ventas
  const summaryKpis = useMemo(() => {
    let grossTotalCents = 0
    let refundedTotalCents = 0
    let netTotalCents = 0
    let cashGrossCents = 0
    let cashRefundedCents = 0
    let nonCashGrossCents = 0
    let nonCashRefundedCents = 0
    const primaryCurrency =
      salesData.sales[0]?.currency ?? organization.preferences.currency

    for (const sale of salesData.sales) {
      const derived = deriveSaleComputedTotals(sale)
      grossTotalCents += sale.totalCents
      refundedTotalCents += derived.refundedTotalCents
      netTotalCents += derived.netTotalCents

      if (sale.payment.method === 'cash') {
        cashGrossCents += sale.totalCents
        cashRefundedCents += derived.refundedTotalCents
      } else {
        nonCashGrossCents += sale.totalCents
        nonCashRefundedCents += derived.refundedTotalCents
      }
    }

    return {
      count: salesData.sales.length,
      grossTotalCents,
      refundedTotalCents,
      netTotalCents,
      cashGrossCents,
      cashRefundedCents,
      cashNetCents: Math.max(0, cashGrossCents - cashRefundedCents),
      nonCashGrossCents,
      nonCashRefundedCents,
      nonCashNetCents: Math.max(0, nonCashGrossCents - nonCashRefundedCents),
      currency: primaryCurrency,
    }
  }, [salesData.sales, organization.preferences.currency])

  const handleOpenCancelModal = (sale: SaleRecord) => {
    setActionModalError(null)
    setCancellingSale(sale)
  }

  const handleOpenRefundModal = (sale: SaleRecord) => {
    setActionModalError(null)
    setRefundingSale(sale)
  }

  const handleConfirmCancel = (payload: CancelSaleSubmitPayload) => {
    if (!cancellingSale) return
    setIsSubmittingAction(true)
    setActionModalError(null)

    try {
      const operationId = generatePosId('op')
      const outcome = defaultPosSalesCoordinator.cancelSale({
        organizationId: organization.id,
        branchId: branchInfo.id,
        saleId: cancellingSale.id,
        reason: payload.reason,
        operationId,
        externalReference: payload.externalReference,
        externalVerifiedByOperator: payload.externalVerifiedByOperator,
        operatorName: demoUser.name || 'Operador en turno',
      })

      if (!outcome.ok) {
        setActionModalError(outcome.error)
        setIsSubmittingAction(false)
        return
      }

      // Actualizar estado local sincronizado recargando el workspace unificado
      const fresh = defaultPosSalesCoordinator.loadWorkspace(
        organization.id,
        branchInfo.id,
      )

      // Genera snapshot del ticket de cancelación para trazabilidad
      defaultTicketSnapshotService.createReturnTicketSnapshot({
        sale: outcome.sale,
        returnRecord: outcome.returnRecord,
        organization,
      })

      setWorkspace(fresh)
      setSalesData(fresh.salesData)
      setCashData(fresh.cashData)
      setSelectedSaleId(outcome.sale.id)
      setCancellingSale(null)
      setIsSubmittingAction(false)
      setFeedbackBanner({
        type: 'success',
        message: `Venta ${outcome.sale.folio} cancelada exitosamente con folio ${outcome.returnRecord.returnFolio}. Se reingresaron todas las partidas al inventario vendible.`,
      })
    } catch (err) {
      setActionModalError(
        err instanceof Error
          ? err.message
          : 'Error inesperado al procesar la cancelación.',
      )
      setIsSubmittingAction(false)
    }
  }

  const handleConfirmRefund = (payload: RefundSaleSubmitPayload) => {
    if (!refundingSale) return
    setIsSubmittingAction(true)
    setActionModalError(null)

    try {
      const operationId = generatePosId('op')
      const outcome = defaultPosSalesCoordinator.refundSale({
        organizationId: organization.id,
        branchId: branchInfo.id,
        saleId: refundingSale.id,
        items: payload.items,
        reason: payload.reason,
        operationId,
        externalReference: payload.externalReference,
        externalVerifiedByOperator: payload.externalVerifiedByOperator,
        operatorName: demoUser.name || 'Operador en turno',
      })

      if (!outcome.ok) {
        setActionModalError(outcome.error)
        setIsSubmittingAction(false)
        return
      }

      const fresh = defaultPosSalesCoordinator.loadWorkspace(
        organization.id,
        branchInfo.id,
      )

      // Genera snapshot del ticket de cancelación para trazabilidad
      defaultTicketSnapshotService.createReturnTicketSnapshot({
        sale: outcome.sale,
        returnRecord: outcome.returnRecord,
        organization,
      })

      setWorkspace(fresh)
      setSalesData(fresh.salesData)
      setCashData(fresh.cashData)
      setSelectedSaleId(outcome.sale.id)
      setRefundingSale(null)
      setIsSubmittingAction(false)
      setFeedbackBanner({
        type: 'success',
        message: `Devolución ${outcome.returnRecord.returnFolio} registrada exitosamente por ${formatCentsWithHistoricalCurrency(
          outcome.returnRecord.totalRefundCents,
          outcome.returnRecord.refund.currency,
        )} para la venta ${outcome.sale.folio}.`,
      })
    } catch (err) {
      setActionModalError(
        err instanceof Error
          ? err.message
          : 'Error inesperado al procesar la devolución.',
      )
      setIsSubmittingAction(false)
    }
  }

  return (
    <div className="sales-page">
      <PageHeader
        title={`Ventas · ${organization.name}`}
        description="Consulta histórica e inmutable de ventas, cancelaciones completas y devoluciones de partidas con trazabilidad transaccional."
        badge={
          <Badge variant="demo">
            Historial conectado a POS · {branchInfo.name}
          </Badge>
        }
        actions={
          <div className="page-header-actions-group">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.cash)}
            >
              Ir a Caja
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.inventory)}
            >
              Ir a Inventario
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate(APP_ROUTES.pos)}
            >
              Nueva venta en POS
            </Button>
          </div>
        }
      />

      {feedbackBanner ? (
        <div
          className={`alert-banner alert-banner--${feedbackBanner.type}`}
          role="status"
        >
          <div className="alert-banner__content">
            <p>{feedbackBanner.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFeedbackBanner(null)}
          >
            Cerrar aviso
          </Button>
        </div>
      ) : null}

      <section
        className="metrics-grid"
        aria-label="Resumen acumulado de ventas registradas"
      >
        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Ventas registradas</span>
            <Badge variant="brand">Folios POS</Badge>
          </div>
          <p className="metric-card__value">{summaryKpis.count} venta(s)</p>
          <p className="metric-card__meta">
            Registradas en {branchInfo.name}
          </p>
        </Card>

        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Venta neta acumulada</span>
            <Badge variant="neutral">{summaryKpis.currency}</Badge>
          </div>
          <p className="metric-card__value">
            {formatCentsWithHistoricalCurrency(
              summaryKpis.netTotalCents,
              summaryKpis.currency,
            )}
          </p>
          <p className="metric-card__meta">
            Bruto: {formatCentsWithHistoricalCurrency(summaryKpis.grossTotalCents, summaryKpis.currency)}
            {summaryKpis.refundedTotalCents > 0 ? (
              <> · Reembolsos: -{formatCentsWithHistoricalCurrency(summaryKpis.refundedTotalCents, summaryKpis.currency)}</>
            ) : null}
          </p>
        </Card>

        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Cobrado en efectivo (neto)</span>
            <Badge variant="success">Suma a caja</Badge>
          </div>
          <p className="metric-card__value">
            {formatCentsWithHistoricalCurrency(
              summaryKpis.cashNetCents,
              summaryKpis.currency,
            )}
          </p>
          <p className="metric-card__meta">
            Cobrado: {formatCentsWithHistoricalCurrency(summaryKpis.cashGrossCents, summaryKpis.currency)}
            {summaryKpis.cashRefundedCents > 0 ? (
              <> · Devuelto: -{formatCentsWithHistoricalCurrency(summaryKpis.cashRefundedCents, summaryKpis.currency)}</>
            ) : null}
          </p>
        </Card>

        <Card as="article" accentTop className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Tarjeta y transferencia</span>
            <Badge variant="accent">Registro manual</Badge>
          </div>
          <p className="metric-card__value">
            {formatCentsWithHistoricalCurrency(
              summaryKpis.nonCashNetCents,
              summaryKpis.currency,
            )}
          </p>
          <p className="metric-card__meta">
            Pagos externos verificados (no afectan efectivo físico)
          </p>
        </Card>
      </section>

      {qaUiState === 'loading' ? (
        <LoadingState
          title="Cargando historial de ventas..."
          description="Consultando registros históricos de la sucursal."
        />
      ) : null}

      {qaUiState === 'error' ? (
        <ErrorState
          title="Error simulado al consultar Ventas"
          description="Vista previa del estado de error para cuando se conecte la API."
          onRetry={() => setQaUiState('normal')}
          retryLabel="Restaurar historial"
        />
      ) : null}

      {qaUiState === 'empty' ? (
        <EmptyState
          title="Vista previa de historial vacío"
          description="Así se presenta el módulo cuando una organización recién creada aún no registra cobros."
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setQaUiState('normal')}
            >
              Volver a vista normal
            </Button>
          }
        />
      ) : null}

      {qaUiState === 'normal' ? (
        <SalesHistoryTable
          sales={salesData.sales}
          selectedSaleId={selectedSaleId}
          onSelectSaleId={setSelectedSaleId}
          preferences={organization.preferences}
          organization={organization}
          openSession={openSession}
          openSessionTotals={openSessionTotals}
          onOpenCancelModal={handleOpenCancelModal}
          onOpenRefundModal={handleOpenRefundModal}
          onGoToPos={() => navigate(APP_ROUTES.pos)}
        />
      ) : null}

      {/* Modal de Cancelación Completa */}
      {cancellingSale ? (
        <CancelSaleModal
          sale={cancellingSale}
          saleComputed={deriveSaleComputedTotals(cancellingSale)}
          openSession={openSession}
          openSessionTotals={openSessionTotals}
          operatorName={demoUser.name || 'Operador en turno'}
          isSubmitting={isSubmittingAction}
          actionError={actionModalError}
          timezone={organization.preferences.timezone}
          dateFormat={organization.preferences.dateFormat}
          onConfirmCancel={handleConfirmCancel}
          onClose={() => {
            if (!isSubmittingAction) {
              setCancellingSale(null)
              setActionModalError(null)
            }
          }}
        />
      ) : null}

      {/* Modal de Devolución de Partidas */}
      {refundingSale ? (
        <RefundSaleModal
          sale={refundingSale}
          saleComputed={deriveSaleComputedTotals(refundingSale)}
          openSession={openSession}
          openSessionTotals={openSessionTotals}
          operatorName={demoUser.name || 'Operador en turno'}
          isSubmitting={isSubmittingAction}
          actionError={actionModalError}
          onConfirmRefund={handleConfirmRefund}
          onClose={() => {
            if (!isSubmittingAction) {
              setRefundingSale(null)
              setActionModalError(null)
            }
          }}
        />
      ) : null}

      <details className="dev-tools-drawer">
        <summary className="dev-tools-drawer__summary">
          Herramientas de diagnóstico QA · Ventas
        </summary>
        <div className="dev-tools-drawer__body">
          <div
            className="demo-state-switcher"
            role="group"
            aria-label="Simular estado de interfaz de Ventas"
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
    </div>
  )
}
