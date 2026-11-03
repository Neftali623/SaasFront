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
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import { defaultProductsCatalogRepository } from '../../products/services/productsCatalogRepository'
import { getUnitLabel } from '../../products/utils/validation'
import { UnsavedChangesModal } from '../../settings/UnsavedChangesModal'
import {
  InitializeStockPanel,
  type InitializeStockPayload,
} from '../components/InitializeStockPanel'
import { InventoryFiltersBar } from '../components/InventoryFiltersBar'
import { InventoryTable } from '../components/InventoryTable'
import {
  ManualMovementPanel,
  type ManualMovementSubmitPayload,
} from '../components/ManualMovementPanel'
import { MinStockModal } from '../components/MinStockModal'
import { MovementsHistoryPanel } from '../components/MovementsHistoryPanel'
import {
  PhysicalCountPanel,
  type PhysicalCountSubmitPayload,
} from '../components/PhysicalCountPanel'
import {
  defaultInventoryRepository,
  generateInventoryId,
  getOrganizationInventoryStorageKey,
} from '../services/inventoryRepository'
import type {
  EnrichedInventoryItem,
  InventoryListFilters,
  OrganizationInventoryData,
} from '../types'
import { getBranchForOrganization } from '../utils/mockInventory'
import {
  buildEnrichedInventoryItems,
  formatQuantityWithUnit,
  formatSignedQuantityWithUnit,
} from '../utils/quantityUtils'

const PAGE_SIZE = 5

type InventoryViewMode =
  | 'stock'
  | 'initialize'
  | 'manual_in'
  | 'manual_out'
  | 'count'
  | 'history'

type QaUiPreviewState = 'normal' | 'loading' | 'empty' | 'error'

export function InventoryPage() {
  const { activeOrganization } = useDemoOrganization()

  return (
    <OrganizationInventoryWorkspace
      key={activeOrganization.id}
      organization={activeOrganization}
    />
  )
}

interface OrganizationInventoryWorkspaceProps {
  organization: Organization
}

function OrganizationInventoryWorkspace({
  organization,
}: OrganizationInventoryWorkspaceProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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

  const [initialCatalogLoad] = useState(() =>
    defaultProductsCatalogRepository.load(organization.id),
  )
  const [initialInventoryLoad] = useState(() =>
    defaultInventoryRepository.load(organization.id, branchInfo.id),
  )

  const [catalog] = useState(initialCatalogLoad.catalog)
  const [inventory, setInventory] = useState<OrganizationInventoryData>(
    initialInventoryLoad.inventory,
  )
  const [storageWarning, setStorageWarning] = useState<string | undefined>(
    initialInventoryLoad.warning ?? initialCatalogLoad.warning,
  )

  const [viewMode, setViewMode] = useState<InventoryViewMode>('stock')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    () => {
      const paramId = searchParams.get('productId')
      if (
        paramId &&
        initialCatalogLoad.catalog.products.some(
          (p) => p.id === paramId && p.organizationId === organization.id,
        )
      ) {
        return paramId
      }
      return null
    },
  )
  const [historyFilterProductId, setHistoryFilterProductId] =
    useState<string>('all')

  const [itemForMinStock, setItemForMinStock] =
    useState<EnrichedInventoryItem | null>(null)

  const [filters, setFilters] = useState<InventoryListFilters>(() => {
    const paramId = searchParams.get('productId')
    const matchedProduct = paramId
      ? initialCatalogLoad.catalog.products.find(
          (p) => p.id === paramId && p.organizationId === organization.id,
        )
      : undefined

    return {
      searchQuery: matchedProduct ? matchedProduct.sku : '',
      categoryFilter: 'all',
      productStatusFilter: 'all',
      stockStatusFilter: 'all',
    }
  })
  const [requestedPage, setRequestedPage] = useState<number>(1)

  const [isFormDirty, setIsFormDirty] = useState<boolean>(false)
  const [pendingViewTarget, setPendingViewTarget] = useState<{
    mode: InventoryViewMode
    productId: string | null
  } | null>(null)

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const [qaUiState, setQaUiState] = useState<QaUiPreviewState>('normal')

  useEffect(() => {
    setHasUnsavedSettingsChanges(isFormDirty)
    return () => {
      setHasUnsavedSettingsChanges(false)
    }
  }, [isFormDirty, setHasUnsavedSettingsChanges])

  // Escuchar cambios externos en localStorage entre pestañas para evitar sobrescrituras silenciosas
  useEffect(() => {
    const expectedKey = getOrganizationInventoryStorageKey(
      organization.id,
      branchInfo.id,
    )

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== expectedKey) {
        return
      }
      const reloaded = defaultInventoryRepository.load(
        organization.id,
        branchInfo.id,
      )
      setInventory(reloaded.inventory)
      setStorageWarning(
        'Se detectó una actualización externa del inventario en otra pestaña. Se sincronizaron los saldos actuales.',
      )
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [organization.id, branchInfo.id])

  const enrichedItems = useMemo(
    () =>
      buildEnrichedInventoryItems(
        catalog.products,
        catalog.categories,
        inventory.balances,
        inventory.movements,
        branchInfo.id,
      ),
    [
      catalog.products,
      catalog.categories,
      inventory.balances,
      inventory.movements,
      branchInfo.id,
    ],
  )

  const summaryCounts = useMemo(() => {
    let initializedCount = 0
    let uninitializedCount = 0
    let lowOrOutAlertCount = 0
    let outOfStockCount = 0

    for (const item of enrichedItems) {
      if (item.isInitialized) {
        initializedCount += 1
      } else {
        uninitializedCount += 1
      }
      if (item.stockStatus === 'out_of_stock') {
        outOfStockCount += 1
      }
      if (item.needsReplenishmentAlert) {
        lowOrOutAlertCount += 1
      }
    }

    return {
      totalCatalog: enrichedItems.length,
      initializedCount,
      uninitializedCount,
      lowOrOutAlertCount,
      outOfStockCount,
    }
  }, [enrichedItems])

  const filteredItems = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase()

    return enrichedItems.filter((item) => {
      if (
        filters.productStatusFilter !== 'all' &&
        item.productStatus !== filters.productStatusFilter
      ) {
        return false
      }

      if (filters.categoryFilter === 'uncategorized') {
        if (item.categoryId !== null) {
          return false
        }
      } else if (
        filters.categoryFilter !== 'all' &&
        item.categoryId !== filters.categoryFilter
      ) {
        return false
      }

      if (filters.stockStatusFilter === 'no_min') {
        if (!item.isInitialized || item.minStock !== null) {
          return false
        }
      } else if (
        filters.stockStatusFilter !== 'all' &&
        item.stockStatus !== filters.stockStatusFilter
      ) {
        return false
      }

      if (query.length > 0) {
        const matchesName = item.productName.toLowerCase().includes(query)
        const matchesSku = item.sku.toLowerCase().includes(query)
        const matchesBarcode = item.barcodes.some((code) =>
          code.toLowerCase().includes(query),
        )
        if (!matchesName && !matchesSku && !matchesBarcode) {
          return false
        }
      }

      return true
    })
  }, [enrichedItems, filters])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(Math.max(1, requestedPage), totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, safeCurrentPage])

  const pageStartIndex =
    filteredItems.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1
  const pageEndIndex = Math.min(
    safeCurrentPage * PAGE_SIZE,
    filteredItems.length,
  )

  const requestViewTransition = (
    targetMode: InventoryViewMode,
    productId: string | null = null,
  ) => {
    if (isFormDirty && targetMode !== viewMode) {
      setPendingViewTarget({ mode: targetMode, productId })
      return
    }
    setFeedback(null)
    setPendingViewTarget(null)
    setIsFormDirty(false)
    setSelectedProductId(productId)
    if (targetMode === 'history') {
      setHistoryFilterProductId(productId ?? 'all')
    }
    setViewMode(targetMode)
  }

  const handleInitializeStock = (
    payload: InitializeStockPayload,
  ): { ok: boolean; error?: string } => {
    const product = catalog.products.find(
      (prod) =>
        prod.id === payload.productId &&
        prod.organizationId === organization.id,
    )
    if (!product) {
      return {
        ok: false,
        error:
          'El producto seleccionado no pertenece a la organización activa.',
      }
    }

    const outcome = defaultInventoryRepository.initializeStock({
      organizationId: organization.id,
      branchId: branchInfo.id,
      product,
      initialQuantity: payload.initialQuantity,
      minStock: payload.minStock,
      reason: payload.reason,
      reference: payload.reference,
      operatorName: demoUser.name,
      operationId: payload.operationId,
      simulateStorageError,
    })

    if (!outcome.ok) {
      if (outcome.latestInventory) {
        setInventory(outcome.latestInventory)
      }
      return {
        ok: false,
        error: outcome.error,
      }
    }

    setInventory(outcome.inventory)
    setIsFormDirty(false)
    setViewMode('stock')
    setFeedback({
      type: 'success',
      message: `Existencia inicial registrada para "${product.name}": ${formatQuantityWithUnit(outcome.balance.quantity, product.unit)}.`,
    })
    return { ok: true }
  }

  const handleManualMovement = (
    payload: ManualMovementSubmitPayload,
  ): { ok: boolean; errorCode?: string; error?: string } => {
    const product = catalog.products.find(
      (prod) =>
        prod.id === payload.productId &&
        prod.organizationId === organization.id,
    )
    if (!product) {
      return {
        ok: false,
        error:
          'El producto seleccionado no pertenece a la organización activa.',
      }
    }

    const outcome = defaultInventoryRepository.registerManualMovement({
      organizationId: organization.id,
      branchId: branchInfo.id,
      product,
      type: payload.type,
      quantity: payload.quantity,
      reason: payload.reason,
      reference: payload.reference,
      operatorName: demoUser.name,
      operationId: payload.operationId,
      expectedBalanceVersion: payload.expectedBalanceVersion,
      simulateStorageError,
    })

    if (!outcome.ok) {
      if (outcome.latestInventory) {
        setInventory(outcome.latestInventory)
      }
      return {
        ok: false,
        errorCode: outcome.errorCode,
        error: outcome.error,
      }
    }

    setInventory(outcome.inventory)
    setIsFormDirty(false)
    setViewMode('stock')
    const actionLabel =
      payload.type === 'manual_in' ? 'Entrada manual' : 'Salida manual'
    const deltaLabel = outcome.movement
      ? formatSignedQuantityWithUnit(outcome.movement.delta, product.unit)
      : ''
    setFeedback({
      type: 'success',
      message: `${actionLabel} (${deltaLabel}) registrada en "${product.name}". Nuevo saldo: ${formatQuantityWithUnit(outcome.balance.quantity, product.unit)}.`,
    })
    return { ok: true }
  }

  const handlePhysicalCount = (
    payload: PhysicalCountSubmitPayload,
  ): { ok: boolean; errorCode?: string; error?: string } => {
    const product = catalog.products.find(
      (prod) =>
        prod.id === payload.productId &&
        prod.organizationId === organization.id,
    )
    if (!product) {
      return {
        ok: false,
        error:
          'El producto seleccionado no pertenece a la organización activa.',
      }
    }

    const outcome = defaultInventoryRepository.registerPhysicalCount({
      organizationId: organization.id,
      branchId: branchInfo.id,
      product,
      countedQuantity: payload.countedQuantity,
      reason: payload.reason,
      reference: payload.reference,
      operatorName: demoUser.name,
      operationId: payload.operationId,
      expectedBalanceVersion: payload.expectedBalanceVersion,
      simulateStorageError,
    })

    if (!outcome.ok) {
      if (outcome.latestInventory) {
        setInventory(outcome.latestInventory)
      }
      return {
        ok: false,
        errorCode: outcome.errorCode,
        error: outcome.error,
      }
    }

    setInventory(outcome.inventory)
    setIsFormDirty(false)
    setViewMode('stock')
    const deltaLabel = outcome.movement
      ? formatSignedQuantityWithUnit(outcome.movement.delta, product.unit)
      : ''
    setFeedback({
      type: 'success',
      message: `Ajuste por conteo físico (${deltaLabel}) aplicado a "${product.name}". Existencia conciliada: ${formatQuantityWithUnit(outcome.balance.quantity, product.unit)}.`,
    })
    return { ok: true }
  }

  const handleSaveMinStock = (
    productId: string,
    minStock: number | null,
  ): { ok: boolean; error?: string } => {
    const product = catalog.products.find(
      (prod) =>
        prod.id === productId && prod.organizationId === organization.id,
    )
    if (!product) {
      return {
        ok: false,
        error: 'El producto no pertenece a la organización activa.',
      }
    }

    const outcome = defaultInventoryRepository.updateMinStock({
      organizationId: organization.id,
      branchId: branchInfo.id,
      product,
      minStock,
      simulateStorageError,
    })

    if (!outcome.ok) {
      return {
        ok: false,
        error: outcome.error,
      }
    }

    setInventory(outcome.inventory)
    const minLabel =
      minStock === null
        ? 'Sin mínimo configurado'
        : minStock === 0
          ? `0 ${getUnitLabel(product.unit)} (Mínimo en cero)`
          : formatQuantityWithUnit(minStock, product.unit)

    setFeedback({
      type: 'success',
      message: `Mínimo de "${product.name}" actualizado a: ${minLabel}. No se generó movimiento de existencias.`,
    })
    return { ok: true }
  }

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      categoryFilter: 'all',
      productStatusFilter: 'all',
      stockStatusFilter: 'all',
    })
    setRequestedPage(1)
    if (searchParams.has('productId')) {
      setSearchParams({})
    }
  }

  // Herramienta QA para simular un cambio concurrente de saldo mientras un formulario está abierto
  const handleSimulateConcurrentExternalUpdate = () => {
    const targetId =
      selectedProductId ??
      enrichedItems.find((it) => it.isInitialized)?.productId
    if (!targetId) {
      return
    }
    const product = catalog.products.find(
      (p) => p.id === targetId && p.organizationId === organization.id,
    )
    if (!product || product.status === 'inactive') {
      return
    }

    const outcome = defaultInventoryRepository.registerManualMovement({
      organizationId: organization.id,
      branchId: branchInfo.id,
      product,
      type: 'manual_in',
      quantity: 1,
      reason: 'Movimiento concurrente simulado desde otra terminal (QA)',
      reference: 'SIM-CONC-QA',
      operatorName: 'Otra Terminal (Simulación QA)',
      operationId: generateInventoryId('op'),
    })

    if (outcome.ok) {
      setInventory(outcome.inventory)
    }
  }

  const pendingTargetOrganization = useMemo(() => {
    if (!pendingSwitchOrgId) {
      return null
    }
    return (
      organizations.find((org) => org.id === pendingSwitchOrgId) ?? null
    )
  }, [organizations, pendingSwitchOrgId])

  return (
    <div className="products-page inventory-page">
      <PageHeader
        title={`Inventario · ${organization.name}`}
        description={`Control de existencias físicas, entradas, salidas, conteo físico, mínimos y kardex en ${branchInfo.name}.`}
        badge={
          <Badge variant="demo">
            Modo demostración · {branchInfo.name}
          </Badge>
        }
        actions={
          <div className="page-header-actions-group">
            {viewMode !== 'stock' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestViewTransition('stock', null)}
              >
                Existencias ({enrichedItems.length})
              </Button>
            ) : null}

            <Button
              variant={viewMode === 'initialize' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() =>
                requestViewTransition('initialize', selectedProductId)
              }
            >
              Inicializar ({summaryCounts.uninitializedCount})
            </Button>

            <Button
              variant={viewMode === 'manual_in' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() =>
                requestViewTransition('manual_in', selectedProductId)
              }
            >
              + Entrada manual
            </Button>

            <Button
              variant={viewMode === 'manual_out' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() =>
                requestViewTransition('manual_out', selectedProductId)
              }
            >
              - Salida manual
            </Button>

            <Button
              variant={viewMode === 'count' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => requestViewTransition('count', selectedProductId)}
            >
              Conteo físico
            </Button>

            <Button
              variant={viewMode === 'history' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => requestViewTransition('history', null)}
            >
              Historial ({inventory.movements.length})
            </Button>
          </div>
        }
      />

      {/* Aviso breve de Modo demostración */}
      <div
        className="demo-brief-banner"
        role="note"
        aria-label="Aviso de modo demostración de inventario"
      >
        <p className="demo-brief-banner__text">
          <strong>Modo demostración:</strong> El balance y el historial de{' '}
          <strong>{organization.name}</strong> ({branchInfo.name}) se guardan en
          una misma unidad local del navegador. Los movimientos manuales no
          modifican ventas ni efectivo en caja.
        </p>
      </div>

      {storageWarning ? (
        <div
          className="settings-feedback settings-feedback--warning"
          role="alert"
        >
          {storageWarning}
        </div>
      ) : null}

      {pendingViewTarget ? (
        <div
          className="settings-unsaved-bar"
          role="region"
          aria-label="Confirmar cambio de vista con formulario sin guardar"
        >
          <div className="settings-unsaved-bar__text">
            <strong>Tienes datos capturados sin confirmar.</strong> ¿Deseas
            descartarlos para cambiar de sección?
          </div>
          <div className="settings-unsaved-bar__actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const target = pendingViewTarget
                setPendingViewTarget(null)
                setIsFormDirty(false)
                setSelectedProductId(target.productId)
                if (target.mode === 'history') {
                  setHistoryFilterProductId(target.productId ?? 'all')
                }
                setViewMode(target.mode)
              }}
            >
              Descartar y continuar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingViewTarget(null)}
            >
              Seguir en el formulario
            </Button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`settings-feedback settings-feedback--${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      {/* VISTA 1: LISTADO DE EXISTENCIAS */}
      {viewMode === 'stock' ? (
        <>
          {/* Tarjetas de resumen rápido de inventario */}
          <section
            className="metrics-grid"
            aria-label="Indicadores de inventario de la sucursal"
          >
            <Card as="article" accentTop className="metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">Catálogo en sucursal</span>
                <Badge variant="brand">{branchInfo.name}</Badge>
              </div>
              <p className="metric-card__value">
                {summaryCounts.totalCatalog} artículos
              </p>
              <p className="metric-card__meta">
                {summaryCounts.initializedCount} inicializados ·{' '}
                {summaryCounts.uninitializedCount} sin inicializar
              </p>
            </Card>

            <Card as="article" accentTop className="metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">
                  Alertas de reabastecimiento
                </span>
                <Badge
                  variant={
                    summaryCounts.lowOrOutAlertCount > 0 ? 'warning' : 'success'
                  }
                >
                  {summaryCounts.lowOrOutAlertCount > 0
                    ? 'Requiere atención'
                    : 'Al día'}
                </Badge>
              </div>
              <p className="metric-card__value">
                {summaryCounts.lowOrOutAlertCount}{' '}
                {summaryCounts.lowOrOutAlertCount === 1
                  ? 'producto'
                  : 'productos'}
              </p>
              <p className="metric-card__meta">
                Activos con saldo menor o igual al mínimo (sincronizado con
                Resumen)
              </p>
            </Card>

            <Card as="article" accentTop className="metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">Sin existencias (0)</span>
                <Badge
                  variant={
                    summaryCounts.outOfStockCount > 0 ? 'danger' : 'neutral'
                  }
                >
                  Saldo cero
                </Badge>
              </div>
              <p className="metric-card__value">
                {summaryCounts.outOfStockCount}{' '}
                {summaryCounts.outOfStockCount === 1
                  ? 'artículo'
                  : 'artículos'}
              </p>
              <p className="metric-card__meta">
                Inicializados con cantidad confirmada en 0
              </p>
            </Card>

            <Card as="article" accentTop className="metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">Movimientos en kardex</span>
                <Badge variant="neutral">Inmutables</Badge>
              </div>
              <p className="metric-card__value">
                {inventory.movements.length} registros
              </p>
              <p className="metric-card__meta">
                Entradas, salidas, conteos e inicializaciones
              </p>
            </Card>
          </section>

          <InventoryFiltersBar
            filters={filters}
            categories={catalog.categories}
            totalCatalogCount={enrichedItems.length}
            filteredCount={filteredItems.length}
            pageStartIndex={pageStartIndex}
            pageEndIndex={pageEndIndex}
            onChangeSearch={(value) => {
              setFilters((prev) => ({ ...prev, searchQuery: value }))
              setRequestedPage(1)
            }}
            onChangeCategory={(value) => {
              setFilters((prev) => ({ ...prev, categoryFilter: value }))
              setRequestedPage(1)
            }}
            onChangeProductStatus={(value) => {
              setFilters((prev) => ({ ...prev, productStatusFilter: value }))
              setRequestedPage(1)
            }}
            onChangeStockStatus={(value) => {
              setFilters((prev) => ({ ...prev, stockStatusFilter: value }))
              setRequestedPage(1)
            }}
            onResetFilters={resetFilters}
          />

          {qaUiState === 'loading' ? (
            <LoadingState
              title={`Cargando existencias de ${organization.name}...`}
              description="Consultando saldos y movimientos registrados en la sucursal activa."
            />
          ) : null}

          {qaUiState === 'error' ? (
            <ErrorState
              title="No se pudo cargar el inventario"
              description="Ocurrió un problema al consultar los saldos de la sucursal. Puedes reintentar la operación."
              onRetry={() => setQaUiState('normal')}
              retryLabel="Reintentar carga"
            />
          ) : null}

          {qaUiState === 'empty' ||
          (qaUiState === 'normal' && enrichedItems.length === 0) ? (
            <EmptyState
              title={`No hay productos en el catálogo de ${organization.name}`}
              description="Registra primero tus artículos en el módulo de Productos para poder inicializar y controlar sus existencias."
              action={
                <div className="pending-module-actions">
                  <Button
                    variant="primary"
                    onClick={() => navigate(APP_ROUTES.products)}
                  >
                    Ir a Productos
                  </Button>
                  {qaUiState === 'empty' ? (
                    <Button
                      variant="outline"
                      onClick={() => setQaUiState('normal')}
                    >
                      Restaurar vista normal
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : null}

          {qaUiState === 'normal' &&
          enrichedItems.length > 0 &&
          filteredItems.length === 0 ? (
            <EmptyState
              title="Sin resultados para los filtros aplicados"
              description="Ningún artículo coincide con tu búsqueda o combinación de estados actual."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : null}

          {qaUiState === 'normal' && filteredItems.length > 0 ? (
            <InventoryTable
              items={paginatedItems}
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={(page) => setRequestedPage(page)}
              onInitializeItem={(item) =>
                requestViewTransition('initialize', item.productId)
              }
              onManualEntry={(item) =>
                requestViewTransition('manual_in', item.productId)
              }
              onManualExit={(item) =>
                requestViewTransition('manual_out', item.productId)
              }
              onPhysicalCount={(item) =>
                requestViewTransition('count', item.productId)
              }
              onConfigureMinStock={(item) => setItemForMinStock(item)}
              onViewProductHistory={(item) =>
                requestViewTransition('history', item.productId)
              }
            />
          ) : null}
        </>
      ) : null}

      {/* VISTA 2: EXISTENCIA INICIAL */}
      {viewMode === 'initialize' ? (
        <InitializeStockPanel
          key={`init-${selectedProductId ?? 'default'}`}
          organizationName={organization.name}
          branchName={branchInfo.name}
          items={enrichedItems}
          preselectedProductId={selectedProductId}
          onSubmitInitialize={handleInitializeStock}
          onSwitchToManualEntry={(prodId) => {
            setIsFormDirty(false)
            setSelectedProductId(prodId)
            setViewMode('manual_in')
          }}
          onSwitchToPhysicalCount={(prodId) => {
            setIsFormDirty(false)
            setSelectedProductId(prodId)
            setViewMode('count')
          }}
          onCancel={() => requestViewTransition('stock', null)}
          onDirtyChange={setIsFormDirty}
        />
      ) : null}

      {/* VISTA 3 Y 4: ENTRADA MANUAL / SALIDA MANUAL */}
      {viewMode === 'manual_in' || viewMode === 'manual_out' ? (
        <ManualMovementPanel
          key={`${viewMode}-${selectedProductId ?? 'default'}`}
          mode={viewMode}
          organizationName={organization.name}
          branchName={branchInfo.name}
          items={enrichedItems}
          preselectedProductId={selectedProductId}
          onSubmitMovement={handleManualMovement}
          onSwitchToInitialize={(prodId) => {
            setIsFormDirty(false)
            setSelectedProductId(prodId)
            setViewMode('initialize')
          }}
          onSwitchMode={(nextMode, prodId) => {
            setIsFormDirty(false)
            setSelectedProductId(prodId)
            setViewMode(nextMode)
          }}
          onSwitchToPhysicalCount={(prodId) => {
            setIsFormDirty(false)
            setSelectedProductId(prodId)
            setViewMode('count')
          }}
          onCancel={() => requestViewTransition('stock', null)}
          onDirtyChange={setIsFormDirty}
        />
      ) : null}

      {/* VISTA 5: AJUSTE POR CONTEO FÍSICO */}
      {viewMode === 'count' ? (
        <PhysicalCountPanel
          key={`count-${selectedProductId ?? 'default'}`}
          organizationName={organization.name}
          branchName={branchInfo.name}
          items={enrichedItems}
          preselectedProductId={selectedProductId}
          onSubmitCount={handlePhysicalCount}
          onSwitchToInitialize={(prodId) => {
            setIsFormDirty(false)
            setSelectedProductId(prodId)
            setViewMode('initialize')
          }}
          onCancel={() => requestViewTransition('stock', null)}
          onDirtyChange={setIsFormDirty}
        />
      ) : null}

      {/* VISTA 6: HISTORIAL DE MOVIMIENTOS */}
      {viewMode === 'history' ? (
        <MovementsHistoryPanel
          key={`hist-${historyFilterProductId}`}
          organizationName={organization.name}
          branchName={branchInfo.name}
          preferences={organization.preferences}
          items={enrichedItems}
          movements={inventory.movements}
          initialProductId={historyFilterProductId}
          onBackToStockList={() => requestViewTransition('stock', null)}
          onOpenMovementForProduct={(target, prodId) => {
            setSelectedProductId(prodId)
            if (target === 'initial') {
              setViewMode('initialize')
            } else if (target === 'manual_in') {
              setViewMode('manual_in')
            } else if (target === 'manual_out') {
              setViewMode('manual_out')
            } else {
              setViewMode('count')
            }
          }}
        />
      ) : null}

      {/* Área discreta de desarrollo / QA */}
      <details className="dev-tools-drawer">
        <summary className="dev-tools-drawer__summary">
          Área de desarrollo y verificación QA (simulación de fallos y
          concurrencia)
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
              Simular fallo al guardar en localStorage (verifica que balance e
              historial no se alteren)
            </span>
          </label>

          {viewMode === 'count' ||
          viewMode === 'manual_in' ||
          viewMode === 'manual_out' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSimulateConcurrentExternalUpdate}
            >
              Simular cambio intermedio de saldo (+1) mientras el formulario
              está abierto
            </Button>
          ) : null}

          {viewMode === 'stock' ? (
            <div
              className="demo-state-switcher"
              role="group"
              aria-label="Simular estado de listado de inventario"
            >
              <span className="demo-state-switcher__label">
                Estado del listado:
              </span>
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
          ) : null}
        </div>
      </details>

      {itemForMinStock ? (
        <MinStockModal
          item={itemForMinStock}
          organizationName={organization.name}
          branchName={branchInfo.name}
          onSaveMinStock={handleSaveMinStock}
          onClose={() => setItemForMinStock(null)}
        />
      ) : null}

      {pendingTargetOrganization ? (
        <UnsavedChangesModal
          currentOrgName={organization.name}
          targetOrgName={pendingTargetOrganization.name}
          onSaveAndSwitch={() => {
            cancelPendingSwitch()
            setFeedback({
              type: 'info',
              message:
                'Confirma primero la operación de inventario en pantalla antes de cambiar de organización.',
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

