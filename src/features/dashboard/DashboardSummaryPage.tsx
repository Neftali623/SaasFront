import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../app/navigation'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { PageHeader } from '../../components/ui/PageHeader'
import { DASHBOARD_MOCK_BY_ORG } from '../../mocks/dashboardData'
import { defaultCashRepository } from '../cash/services/cashRepository'
import { buildDashboardCashRegisterStatus } from '../cash/utils/moneyUtils'
import { defaultInventoryRepository } from '../inventory/services/inventoryRepository'
import { buildOrganizationInventoryAlerts } from '../inventory/utils/quantityUtils'
import { useDemoOrganization } from '../organizations/DemoOrganizationContext'
import { defaultPosSalesCoordinator } from '../pos/services/posSalesCoordinator'
import { buildDashboardSalesSummaryFromRecords } from '../pos/utils/posMoneyAndQuantityUtils'
import { defaultProductsCatalogRepository } from '../products/services/productsCatalogRepository'
import { InventoryAlertsList } from './InventoryAlertsList'
import { QuickActionsPanel } from './QuickActionsPanel'
import { RecentSalesList } from './RecentSalesList'
import { SummaryMetricsGrid } from './SummaryMetricsGrid'

type DemoStateView = 'data' | 'loading' | 'empty' | 'error'

export function DashboardSummaryPage() {
  const navigate = useNavigate()
  const { activeOrganization } = useDemoOrganization()
  const [demoView, setDemoView] = useState<DemoStateView>('data')

  const dashboardData = DASHBOARD_MOCK_BY_ORG[activeOrganization.id]

  // Alertas de inventario dinámicas conectadas al inventario y catálogo demo del negocio activo
  const liveInventoryAlerts = useMemo(() => {
    const { catalog } = defaultProductsCatalogRepository.load(
      activeOrganization.id,
    )
    const { inventory } = defaultInventoryRepository.load(
      activeOrganization.id,
    )
    return buildOrganizationInventoryAlerts(
      catalog.products,
      catalog.categories,
      inventory.balances,
    )
  }, [activeOrganization.id])

  // Estado de caja dinámico conectado al repositorio de Caja de la organización activa
  const liveCashRegisterStatus = useMemo(() => {
    const { cashData } = defaultCashRepository.load(activeOrganization.id)
    return buildDashboardCashRegisterStatus(
      cashData,
      activeOrganization.preferences.timezone,
      activeOrganization.preferences.dateFormat,
      activeOrganization.preferences.currency,
    )
  }, [
    activeOrganization.id,
    activeOrganization.preferences.timezone,
    activeOrganization.preferences.dateFormat,
    activeOrganization.preferences.currency,
  ])

  // Ventas del día y ventas recientes calculadas desde el historial real de Punto de Venta
  const liveSalesSummary = useMemo(() => {
    const salesData = defaultPosSalesCoordinator.loadSales(
      activeOrganization.id,
    )
    const { catalog } = defaultProductsCatalogRepository.load(
      activeOrganization.id,
    )
    const fallbackCurrency =
      catalog.baseCurrency ?? activeOrganization.preferences.currency

    return buildDashboardSalesSummaryFromRecords(
      salesData.sales,
      activeOrganization.preferences.timezone,
      activeOrganization.preferences.dateFormat,
      fallbackCurrency,
      liveInventoryAlerts.length,
    )
  }, [
    activeOrganization.id,
    activeOrganization.preferences.timezone,
    activeOrganization.preferences.dateFormat,
    activeOrganization.preferences.currency,
    liveInventoryAlerts.length,
  ])

  return (
    <div className="dashboard-page">
      <PageHeader
        title={`Resumen operativo · ${activeOrganization.name}`}
        description={
          dashboardData?.summaryNote ??
          'Vista general del estado diario del negocio activo.'
        }
        badge={
          <Badge variant="demo">
            Datos ficticios de demostración · {activeOrganization.branchName}
          </Badge>
        }
        actions={
          <div className="page-header-actions-group">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.settings)}
            >
              Configurar negocio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.cash)}
            >
              Ir a Caja
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.inventory)}
            >
              Ir a Inventario
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.expenses)}
            >
              Gastos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.reports)}
            >
              Reportes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(APP_ROUTES.pos)}
            >
              Ir a Punto de venta
            </Button>
          </div>
        }
      />

      <div
        className="demo-data-banner"
        role="note"
        aria-label="Aviso de datos ficticios"
      >
        <div className="demo-data-banner__content">
          <span
            className="demo-data-banner__swatch"
            style={{ backgroundColor: activeOrganization.primaryColor }}
            aria-hidden="true"
          />
          <p className="demo-data-banner__text">
            <strong>Demostración activa:</strong> Estás viendo los datos
            exclusivos de <strong>{activeOrganization.name}</strong> (
            <code>{activeOrganization.id}</code>). Las ventas del día, ventas
            recientes, estado de caja y alertas de stock están sincronizados en
            vivo con Punto de Venta, Caja e Inventario.
          </p>
        </div>
        <div
          className="demo-state-switcher"
          role="group"
          aria-label="Previsualizar estados base de interfaz"
        >
          <span className="demo-state-switcher__label">Estado UI:</span>
          <button
            type="button"
            className={`demo-state-pill ${demoView === 'data' ? 'demo-state-pill--active' : ''}`}
            onClick={() => setDemoView('data')}
            aria-pressed={demoView === 'data'}
          >
            Datos
          </button>
          <button
            type="button"
            className={`demo-state-pill ${demoView === 'loading' ? 'demo-state-pill--active' : ''}`}
            onClick={() => setDemoView('loading')}
            aria-pressed={demoView === 'loading'}
          >
            Cargando
          </button>
          <button
            type="button"
            className={`demo-state-pill ${demoView === 'empty' ? 'demo-state-pill--active' : ''}`}
            onClick={() => setDemoView('empty')}
            aria-pressed={demoView === 'empty'}
          >
            Vacío
          </button>
          <button
            type="button"
            className={`demo-state-pill ${demoView === 'error' ? 'demo-state-pill--active' : ''}`}
            onClick={() => setDemoView('error')}
            aria-pressed={demoView === 'error'}
          >
            Error
          </button>
        </div>
      </div>

      {demoView === 'loading' ? (
        <LoadingState
          title={`Cargando resumen de ${activeOrganization.name}...`}
          description="Vista previa del componente reutilizable LoadingState para futuras peticiones a la API."
        />
      ) : null}

      {demoView === 'error' ? (
        <ErrorState
          title="Simulación de error de carga"
          description="Vista previa del componente ErrorState. Cuando se conecte la API con Edwin, aquí se mostrarán fallos de red con opción de reintento."
          onRetry={() => setDemoView('data')}
          retryLabel="Restaurar datos de demostración"
        />
      ) : null}

      {demoView === 'empty' ? (
        <EmptyState
          title="Sin actividad registrada en el turno"
          description="Vista previa del componente EmptyState cuando una organización recién creada aún no registra ventas ni alertas."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setDemoView('data')}
            >
              Volver a mostrar datos de ejemplo
            </Button>
          }
        />
      ) : null}

      {demoView === 'data' ? (
        <>
          <SummaryMetricsGrid
            metrics={liveSalesSummary.metrics}
            cashRegister={liveCashRegisterStatus}
            preferences={activeOrganization.preferences}
          />

          <QuickActionsPanel />

          <div className="dashboard-columns">
            <RecentSalesList
              sales={liveSalesSummary.recentSales}
              organizationName={activeOrganization.name}
              preferences={activeOrganization.preferences}
            />
            <InventoryAlertsList
              alerts={liveInventoryAlerts}
              organizationName={activeOrganization.name}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
