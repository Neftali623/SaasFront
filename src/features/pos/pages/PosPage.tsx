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
import { getOrganizationCashStorageKey } from '../../cash/services/cashRepository'
import type { OrganizationCashData } from '../../cash/types'
import {
  amountToCents,
  calculateSessionComputedTotals,
  centsToAmount,
  formatCentsWithHistoricalCurrency,
} from '../../cash/utils/moneyUtils'
import {
  defaultInventoryRepository,
  getOrganizationInventoryStorageKey,
} from '../../inventory/services/inventoryRepository'
import type { OrganizationInventoryData } from '../../inventory/types'
import { getBranchForOrganization } from '../../inventory/utils/mockInventory'
import {
  addControlledQuantities,
  formatQuantityWithUnit,
  isQuantityCompatibleWithUnit,
  normalizeControlledQuantity,
  toScaledQuantity,
} from '../../inventory/utils/quantityUtils'
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import {
  defaultProductsCatalogRepository,
  getOrganizationCatalogStorageKey,
} from '../../products/services/productsCatalogRepository'
import type { OrganizationCatalogData } from '../../products/types'
import { getUnitLabel } from '../../products/utils/validation'
import { UnsavedChangesModal } from '../../settings/UnsavedChangesModal'
import { defaultTicketSnapshotService } from '../../tickets/services/ticketSnapshotService'
import { PosCartPanel } from '../components/PosCartPanel'
import {
  PosCheckoutModal,
  type PosCheckoutSubmitPayload,
} from '../components/PosCheckoutModal'
import { PosContextBar } from '../components/PosContextBar'
import { PosProductsResultsList } from '../components/PosProductsResultsList'
import { PosSaleConfirmationView } from '../components/PosSaleConfirmationView'
import { PosScannerAndSearchBar } from '../components/PosScannerAndSearchBar'
import {
  defaultPosSalesCoordinator,
  generatePosId,
  getOrganizationBranchTransactionStorageKey,
} from '../services/posSalesCoordinator'
import type {
  BarcodeScanResult,
  OrganizationSalesData,
  PosCartItem,
  PosCatalogProductItem,
  PosCheckoutDiscrepancy,
  SaleRecord,
} from '../types'
import {
  buildPosCatalogItems,
  calculateLineSubtotalCents,
  filterPosProductsForSale,
  findProductItemByExactBarcode,
  getDefaultScanQuantityForUnit,
} from '../utils/posMoneyAndQuantityUtils'

type QaUiPreviewState = 'normal' | 'loading' | 'empty' | 'error'

export function PosPage() {
  const { activeOrganization } = useDemoOrganization()

  return (
    <OrganizationPosWorkspace
      key={activeOrganization.id}
      organization={activeOrganization}
    />
  )
}

interface OrganizationPosWorkspaceProps {
  organization: Organization
}

function OrganizationPosWorkspace({
  organization,
}: OrganizationPosWorkspaceProps) {
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

  const [initialWorkspace] = useState(() =>
    defaultPosSalesCoordinator.loadWorkspace(organization.id, branchInfo.id),
  )

  const [catalog, setCatalog] = useState<OrganizationCatalogData>(
    initialWorkspace.catalog,
  )
  const [inventory, setInventory] = useState<OrganizationInventoryData>(
    initialWorkspace.inventory,
  )
  const [cashData, setCashData] = useState<OrganizationCashData>(
    initialWorkspace.cashData,
  )
  const [salesData, setSalesData] = useState<OrganizationSalesData>(
    initialWorkspace.salesData,
  )
  const [storageWarning, setStorageWarning] = useState<string | undefined>(
    initialWorkspace.warning,
  )

  // Carrito en memoria exclusivo de la organización activa
  const [cartItems, setCartItems] = useState<PosCartItem[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [lastScanResult, setLastScanResult] =
    useState<BarcodeScanResult | null>(null)

  // Estado del proceso de cobro y comprobante
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false)
  const [isSubmittingCheckout, setIsSubmittingCheckout] =
    useState<boolean>(false)
  const [checkoutOperationId, setCheckoutOperationId] = useState<string>(() =>
    generatePosId('op'),
  )
  const [checkoutDiscrepancies, setCheckoutDiscrepancies] = useState<
    PosCheckoutDiscrepancy[]
  >([])
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [confirmedSale, setConfirmedSale] = useState<SaleRecord | null>(null)

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [qaUiState, setQaUiState] = useState<QaUiPreviewState>('normal')

  // Protege el carrito activo y el cobro en curso frente a cambios accidentales de organización
  const hasActiveSaleWork =
    cartItems.length > 0 || isCheckoutModalOpen || isSubmittingCheckout

  useEffect(() => {
    setHasUnsavedSettingsChanges(hasActiveSaleWork)
    return () => {
      setHasUnsavedSettingsChanges(false)
    }
  }, [hasActiveSaleWork, setHasUnsavedSettingsChanges])

  // Sincronización multi-pestaña mediante evento storage
  useEffect(() => {
    const txKey = getOrganizationBranchTransactionStorageKey(
      organization.id,
      branchInfo.id,
    )
    const catalogKey = getOrganizationCatalogStorageKey(organization.id)
    const inventoryKey = getOrganizationInventoryStorageKey(
      organization.id,
      branchInfo.id,
    )
    const cashKey = getOrganizationCashStorageKey(
      organization.id,
      branchInfo.id,
    )

    const handleStorageEvent = (event: StorageEvent) => {
      if (
        event.key === txKey ||
        event.key === catalogKey ||
        event.key === inventoryKey ||
        event.key === cashKey
      ) {
        const reloaded = defaultPosSalesCoordinator.loadWorkspace(
          organization.id,
          branchInfo.id,
        )
        setCatalog(reloaded.catalog)
        setInventory(reloaded.inventory)
        setCashData(reloaded.cashData)
        setSalesData(reloaded.salesData)
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
  const catalogCurrency = catalog.baseCurrency ?? 'MXN'

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

  const operationCurrency = openSession ? openSession.currency : catalogCurrency
  const hasCurrencyMismatch =
    openSession !== null && openSession.currency !== catalogCurrency

  const allPosCatalogItems = useMemo(
    () =>
      buildPosCatalogItems(
        catalog.products,
        catalog.categories,
        inventory.balances,
        cartItems,
        branchInfo.id,
      ),
    [
      catalog.products,
      catalog.categories,
      inventory.balances,
      cartItems,
      branchInfo.id,
    ],
  )

  const totalActiveCatalogCount = useMemo(
    () =>
      allPosCatalogItems.filter((item) => item.product.status === 'active')
        .length,
    [allPosCatalogItems],
  )

  const filteredCatalogOutcome = useMemo(
    () =>
      filterPosProductsForSale(allPosCatalogItems, searchQuery, categoryFilter),
    [allPosCatalogItems, searchQuery, categoryFilter],
  )

  const availableStockByProductId = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const item of allPosCatalogItems) {
      map.set(item.product.id, item.registeredQuantity)
    }
    return map
  }, [allPosCatalogItems])

  const addOrIncrementCartLine = (
    item: PosCatalogProductItem,
    barcodeUsed: string | null,
  ): {
    ok: boolean
    addedQuantity: number
    newCartQuantity: number
    reasonKind?:
      | 'inactive'
      | 'uninitialized'
      | 'insufficient_stock'
    message: string
  } => {
    const { product } = item

    if (product.status !== 'active') {
      return {
        ok: false,
        addedQuantity: 0,
        newCartQuantity: item.inCartQuantity,
        reasonKind: 'inactive',
        message: `El producto "${product.name}" (${product.sku}) está inactivo y no puede venderse.`,
      }
    }

    if (!item.isInitialized || item.registeredQuantity === null) {
      return {
        ok: false,
        addedQuantity: 0,
        newCartQuantity: item.inCartQuantity,
        reasonKind: 'uninitialized',
        message: `El producto "${product.name}" (${product.sku}) no tiene existencias inicializadas en Inventario.`,
      }
    }

    if (item.registeredQuantity <= 0) {
      return {
        ok: false,
        addedQuantity: 0,
        newCartQuantity: item.inCartQuantity,
        reasonKind: 'insufficient_stock',
        message: `El producto "${product.name}" (${product.sku}) no tiene existencias disponibles (0).`,
      }
    }

    const defaultAddQty = getDefaultScanQuantityForUnit(product.unit)
    const existingLine = cartItems.find((line) => line.productId === product.id)
    const currentQty = existingLine ? existingLine.quantity : 0
    const proposedQty = existingLine
      ? addControlledQuantities(currentQty, defaultAddQty)
      : Math.min(defaultAddQty, item.registeredQuantity)

    if (toScaledQuantity(proposedQty) <= 0) {
      return {
        ok: false,
        addedQuantity: 0,
        newCartQuantity: currentQty,
        reasonKind: 'insufficient_stock',
        message: `No hay existencia suficiente para agregar "${product.name}".`,
      }
    }

    if (
      toScaledQuantity(proposedQty) > toScaledQuantity(item.registeredQuantity)
    ) {
      return {
        ok: false,
        addedQuantity: 0,
        newCartQuantity: currentQty,
        reasonKind: 'insufficient_stock',
        message: `Existencia insuficiente para "${product.name}": disponible ${formatQuantityWithUnit(
          item.registeredQuantity,
          product.unit,
        )} y ya tienes ${formatQuantityWithUnit(
          currentQty,
          product.unit,
        )} en el carrito.`,
      }
    }

    const normalizedNewQty = normalizeControlledQuantity(proposedQty)
    const addedQty = existingLine
      ? normalizeControlledQuantity(proposedQty - currentQty)
      : normalizedNewQty

    const unitPriceCents = item.unitPriceCents
    const lineSubtotalCents = calculateLineSubtotalCents(
      unitPriceCents,
      normalizedNewQty,
    )

    setCartItems((prev) => {
      const idx = prev.findIndex((line) => line.productId === product.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            barcodeUsed: barcodeUsed ?? product.barcodes[0] ?? null,
            unit: product.unit,
            unitPriceCents,
            historicalUnitCostCents: item.historicalUnitCostCents,
            quantity: normalizedNewQty,
            lineSubtotalCents,
          },
        ]
      }
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        productName: product.name,
        sku: product.sku,
        barcodeUsed: barcodeUsed ?? next[idx].barcodeUsed,
        unitPriceCents,
        historicalUnitCostCents: item.historicalUnitCostCents,
        quantity: normalizedNewQty,
        lineSubtotalCents,
      }
      return next
    })

    return {
      ok: true,
      addedQuantity: addedQty,
      newCartQuantity: normalizedNewQty,
      message: `Se agregó ${formatQuantityWithUnit(addedQty, product.unit)} de "${product.name}".`,
    }
  }

  const handleScanBarcode = (rawBarcode: string) => {
    if (isCheckoutModalOpen || isSubmittingCheckout || confirmedSale !== null) {
      return
    }

    const cleanCode = rawBarcode.trim()
    if (!cleanCode) {
      setLastScanResult({
        ok: false,
        code: '',
        reasonKind: 'empty',
        message: 'Ingresa o escanea un código de barras válido.',
      })
      return
    }

    const matchedItem = findProductItemByExactBarcode(
      allPosCatalogItems,
      cleanCode,
    )
    if (!matchedItem) {
      setLastScanResult({
        ok: false,
        code: cleanCode,
        reasonKind: 'not_found',
        message: `El código "${cleanCode}" no está asociado a ningún producto de ${organization.name}.`,
      })
      return
    }

    const outcome = addOrIncrementCartLine(matchedItem, cleanCode)
    if (!outcome.ok) {
      setLastScanResult({
        ok: false,
        code: cleanCode,
        reasonKind: outcome.reasonKind ?? 'insufficient_stock',
        message: outcome.message,
      })
      return
    }

    setLastScanResult({
      ok: true,
      code: cleanCode,
      productName: matchedItem.product.name,
      sku: matchedItem.product.sku,
      addedQuantity: outcome.addedQuantity,
      newCartQuantity: outcome.newCartQuantity,
      unit: matchedItem.product.unit,
    })
  }

  const handleAddProductFromList = (item: PosCatalogProductItem) => {
    const outcome = addOrIncrementCartLine(item, null)
    if (!outcome.ok) {
      setFeedback({
        type: 'warning',
        message: outcome.message,
      })
      return
    }
    setFeedback(null)
  }

  const handleUpdateCartQuantity = (
    productId: string,
    newQuantity: number,
  ): { ok: boolean; error?: string } => {
    const existingLine = cartItems.find((l) => l.productId === productId)
    if (!existingLine) {
      return { ok: false, error: 'Partida no encontrada en el carrito.' }
    }

    if (!isQuantityCompatibleWithUnit(newQuantity, existingLine.unit)) {
      return {
        ok: false,
        error: `La unidad "${getUnitLabel(existingLine.unit)}" no admite la cantidad ingresada.`,
      }
    }

    const normalizedQty = normalizeControlledQuantity(newQuantity)
    if (toScaledQuantity(normalizedQty) <= 0) {
      return {
        ok: false,
        error: 'La cantidad debe ser mayor a cero.',
      }
    }

    const maxAvailable = availableStockByProductId.get(productId) ?? null
    if (maxAvailable === null) {
      return {
        ok: false,
        error: 'El producto no tiene inventario inicializado.',
      }
    }

    if (toScaledQuantity(normalizedQty) > toScaledQuantity(maxAvailable)) {
      return {
        ok: false,
        error: `Supera la existencia disponible (${formatQuantityWithUnit(
          maxAvailable,
          existingLine.unit,
        )}).`,
      }
    }

    const newSubtotalCents = calculateLineSubtotalCents(
      existingLine.unitPriceCents,
      normalizedQty,
    )

    setCartItems((prev) =>
      prev.map((line) =>
        line.productId === productId
          ? {
              ...line,
              quantity: normalizedQty,
              lineSubtotalCents: newSubtotalCents,
            }
          : line,
      ),
    )

    return { ok: true }
  }

  const handleRemoveCartItem = (productId: string) => {
    setCartItems((prev) => prev.filter((line) => line.productId !== productId))
  }

  const handleClearCart = () => {
    setCartItems([])
    setLastScanResult(null)
    setFeedback({
      type: 'info',
      message: 'El carrito fue vaciado.',
    })
  }

  const handleOpenCheckoutModal = () => {
    const precheck = defaultPosSalesCoordinator.validateCartBeforeCheckout({
      organizationId: organization.id,
      branchId: branchInfo.id,
      expectedSessionId: openSession?.id,
      cartItems,
    })

    setCatalog(precheck.catalog)
    setInventory(precheck.inventory)
    setCashData(precheck.cashData)

    if (
      !precheck.ok &&
      precheck.errorCode !== 'CATALOG_OR_STOCK_DISCREPANCY'
    ) {
      setFeedback({
        type: 'error',
        message:
          precheck.error ??
          'No es posible proceder al cobro en este momento.',
      })
      return
    }

    setCheckoutOperationId(generatePosId('op'))
    setCheckoutDiscrepancies(precheck.discrepancies)
    setCheckoutError(null)
    setIsCheckoutModalOpen(true)
  }

  const handleSyncCartWithLiveState = () => {
    const latestWorkspace = defaultPosSalesCoordinator.loadWorkspace(
      organization.id,
      branchInfo.id,
    )
    setCatalog(latestWorkspace.catalog)
    setInventory(latestWorkspace.inventory)
    setCashData(latestWorkspace.cashData)
    setSalesData(latestWorkspace.salesData)

    const liveItemsById = new Map<string, PosCatalogProductItem>()
    const rebuiltItems = buildPosCatalogItems(
      latestWorkspace.catalog.products,
      latestWorkspace.catalog.categories,
      latestWorkspace.inventory.balances,
      [],
      branchInfo.id,
    )
    for (const item of rebuiltItems) {
      liveItemsById.set(item.product.id, item)
    }

    const syncedCart: PosCartItem[] = []
    for (const oldLine of cartItems) {
      const liveItem = liveItemsById.get(oldLine.productId)
      if (
        !liveItem ||
        liveItem.product.status !== 'active' ||
        !liveItem.isInitialized ||
        liveItem.registeredQuantity === null ||
        toScaledQuantity(liveItem.registeredQuantity) <= 0
      ) {
        continue
      }

      const cappedQty =
        toScaledQuantity(oldLine.quantity) >
        toScaledQuantity(liveItem.registeredQuantity)
          ? liveItem.registeredQuantity
          : oldLine.quantity

      const normalizedQty = normalizeControlledQuantity(cappedQty)
      if (toScaledQuantity(normalizedQty) <= 0) {
        continue
      }

      syncedCart.push({
        productId: liveItem.product.id,
        productName: liveItem.product.name,
        sku: liveItem.product.sku,
        barcodeUsed: oldLine.barcodeUsed,
        unit: liveItem.product.unit,
        unitPriceCents: liveItem.unitPriceCents,
        historicalUnitCostCents: liveItem.historicalUnitCostCents,
        quantity: normalizedQty,
        lineSubtotalCents: calculateLineSubtotalCents(
          liveItem.unitPriceCents,
          normalizedQty,
        ),
      })
    }

    setCartItems(syncedCart)
    setCheckoutDiscrepancies([])
    setCheckoutError(null)
    setCheckoutOperationId(generatePosId('op'))

    if (syncedCart.length === 0) {
      setIsCheckoutModalOpen(false)
      setFeedback({
        type: 'warning',
        message:
          'Los artículos del carrito dejaron de tener existencias o fueron desactivados tras sincronizar con el catálogo.',
      })
    } else {
      setFeedback({
        type: 'info',
        message:
          'El carrito fue sincronizado con los precios y existencias actuales. Revisa el nuevo total antes de confirmar.',
      })
    }
  }

  const handleConfirmCheckout = (payload: PosCheckoutSubmitPayload) => {
    if (isSubmittingCheckout || !openSession) {
      return
    }

    setIsSubmittingCheckout(true)
    setCheckoutError(null)

    const outcome = defaultPosSalesCoordinator.checkoutSale({
      organizationId: organization.id,
      organizationName: organization.name,
      branchId: branchInfo.id,
      expectedSessionId: openSession.id,
      operatorName: demoUser.name,
      cartItems,
      paymentMethod: payload.paymentMethod,
      cashReceivedCents: payload.cashReceivedCents,
      externalReference: payload.externalReference,
      externalVerifiedByOperator: payload.externalVerifiedByOperator,
      operationId: checkoutOperationId,
      simulateStorageError,
    })

    setIsSubmittingCheckout(false)

    if (!outcome.ok) {
      if (outcome.latestCatalog) {
        setCatalog(outcome.latestCatalog)
      }
      if (outcome.latestInventory) {
        setInventory(outcome.latestInventory)
      }
      if (outcome.latestCashData) {
        setCashData(outcome.latestCashData)
      }

      if (
        outcome.errorCode === 'CATALOG_OR_STOCK_DISCREPANCY' &&
        outcome.discrepancies
      ) {
        setCheckoutDiscrepancies(outcome.discrepancies)
      }
      setCheckoutError(outcome.error)
      return
    }

    setInventory(outcome.inventory)
    setCashData(outcome.cashData)
    setSalesData(outcome.salesData)

    // Genera snapshot inmutable del ticket para la venta confirmada
    defaultTicketSnapshotService.createSaleTicketSnapshot({
      sale: outcome.sale,
      organization,
    })

    setCartItems([])
    setLastScanResult(null)
    setCheckoutDiscrepancies([])
    setCheckoutError(null)
    setIsCheckoutModalOpen(false)
    setConfirmedSale(outcome.sale)
    setFeedback(null)
  }

  const handleSimulateExternalPriceChangeOnFirstCartItem = () => {
    if (cartItems.length === 0) {
      setFeedback({
        type: 'info',
        message:
          'Agrega primero un producto al carrito para simular un cambio intermedio de precio.',
      })
      return
    }
    const targetProductId = cartItems[0].productId
    const updatedProducts = catalog.products.map((prod) => {
      if (prod.id !== targetProductId) {
        return prod
      }
      const newPriceCents = amountToCents(prod.salePrice) + 500
      return {
        ...prod,
        salePrice: centsToAmount(newPriceCents),
        updatedAt: new Date().toISOString(),
      }
    })
    const nextCatalog: OrganizationCatalogData = {
      ...catalog,
      products: updatedProducts,
    }
    const saved = defaultProductsCatalogRepository.save(
      organization.id,
      nextCatalog,
    )
    if (saved.ok) {
      setCatalog(nextCatalog)
      if (isCheckoutModalOpen) {
        const recheck = defaultPosSalesCoordinator.validateCartBeforeCheckout({
          organizationId: organization.id,
          branchId: branchInfo.id,
          expectedSessionId: openSession?.id,
          cartItems,
        })
        setCheckoutDiscrepancies(recheck.discrepancies)
      }
      setFeedback({
        type: 'warning',
        message: `QA: Se incrementó en +$5.00 el precio en catálogo de "${cartItems[0].productName}" mientras sigue en el carrito.`,
      })
    }
  }

  const handleSimulateExternalStockReductionOnFirstCartItem = () => {
    if (cartItems.length === 0) {
      return
    }
    const targetProductId = cartItems[0].productId
    const updatedBalances = inventory.balances.map((bal) => {
      if (bal.productId !== targetProductId || bal.branchId !== branchInfo.id) {
        return bal
      }
      return {
        ...bal,
        quantity: 0,
        version: bal.version + 1,
        updatedAt: new Date().toISOString(),
      }
    })
    const nextInventory: OrganizationInventoryData = {
      ...inventory,
      storageRevision: (inventory.storageRevision ?? 1) + 1,
      balances: updatedBalances,
    }
    const saved = defaultInventoryRepository.save(
      organization.id,
      nextInventory,
    )
    if (saved.ok) {
      setInventory(nextInventory)
      if (isCheckoutModalOpen) {
        const recheck = defaultPosSalesCoordinator.validateCartBeforeCheckout({
          organizationId: organization.id,
          branchId: branchInfo.id,
          expectedSessionId: openSession?.id,
          cartItems,
        })
        setCheckoutDiscrepancies(recheck.discrepancies)
      }
      setFeedback({
        type: 'warning',
        message: `QA: Se agotó la existencia en inventario de "${cartItems[0].productName}" mientras sigue en el carrito.`,
      })
    }
  }

  const pendingTargetOrganization = useMemo(
    () => organizations.find((org) => org.id === pendingSwitchOrgId) ?? null,
    [organizations, pendingSwitchOrgId],
  )

  return (
    <div className="pos-page">
      <PageHeader
        title={`Punto de Venta · ${organization.name}`}
        description="Mostrador operativo integrado con Catálogo, Inventario y Sesión de Caja de la sucursal activa."
        badge={
          <Badge variant="demo">
            Operación local transaccional · {branchInfo.name}
          </Badge>
        }
        actions={
          <div className="page-header-actions-group">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(APP_ROUTES.sales)}
            >
              Ver Ventas ({salesData.sales.length})
            </Button>
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
          </div>
        }
      />

      <PosContextBar
        organizationName={organization.name}
        branchName={branchInfo.name}
        register={register}
        openSession={openSession}
        openSessionTotals={openSessionTotals}
        operatorName={demoUser.name}
        catalogCurrency={catalogCurrency}
        preferences={organization.preferences}
        onGoToCash={() => navigate(APP_ROUTES.cash)}
      />

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStorageWarning(undefined)}
          >
            Entendido
          </Button>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`settings-alert settings-alert--${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className="settings-alert__content">
            <p>{feedback.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFeedback(null)}
          >
            Cerrar
          </Button>
        </div>
      ) : null}

      {qaUiState === 'loading' ? (
        <LoadingState
          title={`Cargando Punto de Venta de ${organization.name}...`}
          description="Sincronizando catálogo, existencias de sucursal y sesión de caja."
        />
      ) : null}

      {qaUiState === 'error' ? (
        <ErrorState
          title="Error simulado al cargar el Punto de Venta"
          description="Vista previa del estado de fallo de carga cuando se conecte la API."
          onRetry={() => setQaUiState('normal')}
          retryLabel="Restaurar Punto de Venta"
        />
      ) : null}

      {qaUiState === 'empty' ? (
        <EmptyState
          title="Sin productos disponibles en esta vista"
          description="Vista previa de estado vacío cuando el catálogo aún no tiene artículos activos."
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
        confirmedSale ? (
          <PosSaleConfirmationView
            sale={confirmedSale}
            preferences={organization.preferences}
            organization={organization}
            onStartNewSale={() => setConfirmedSale(null)}
            onViewInSalesModule={(saleId) =>
              navigate(`${APP_ROUTES.sales}?saleId=${encodeURIComponent(saleId)}`)
            }
          />
        ) : (
          <div className="pos-workspace-grid">
            <Card
              as="section"
              className="pos-catalog-column"
              title="Búsqueda, escaneo y selección de productos"
              subtitle={`Precios en moneda base ${catalogCurrency} · Existencias en vivo de ${branchInfo.name}`}
            >
              <PosScannerAndSearchBar
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                categories={catalog.categories}
                onScanBarcode={handleScanBarcode}
                lastScanResult={lastScanResult}
                onDismissScanResult={() => setLastScanResult(null)}
                isCheckoutActive={isCheckoutModalOpen || isSubmittingCheckout}
                totalActiveCatalogCount={totalActiveCatalogCount}
                filteredActiveCount={
                  filteredCatalogOutcome.activeResults.length
                }
              />

              <PosProductsResultsList
                activeResults={filteredCatalogOutcome.activeResults}
                matchedInactiveProducts={
                  filteredCatalogOutcome.matchedInactiveProducts
                }
                totalActiveCatalogCount={totalActiveCatalogCount}
                catalogCurrency={catalogCurrency}
                hasActiveFilters={
                  searchQuery.trim().length > 0 || categoryFilter !== 'all'
                }
                onAddProduct={handleAddProductFromList}
                onClearFilters={() => {
                  setSearchQuery('')
                  setCategoryFilter('all')
                }}
                onGoToProducts={() => navigate(APP_ROUTES.products)}
                onGoToInventory={() => navigate(APP_ROUTES.inventory)}
              />
            </Card>

            <div className="pos-cart-column">
              <PosCartPanel
                cartItems={cartItems}
                availableStockByProductId={availableStockByProductId}
                currency={operationCurrency}
                hasOpenSession={openSession !== null}
                hasCurrencyMismatch={hasCurrencyMismatch}
                onUpdateQuantity={handleUpdateCartQuantity}
                onRemoveItem={handleRemoveCartItem}
                onClearCart={handleClearCart}
                onOpenCheckout={handleOpenCheckoutModal}
                onGoToCash={() => navigate(APP_ROUTES.cash)}
              />
            </div>
          </div>
        )
      ) : null}

      {isCheckoutModalOpen && openSession ? (
        <PosCheckoutModal
          organizationName={organization.name}
          branchName={branchInfo.name}
          register={register}
          openSession={openSession}
          operatorName={demoUser.name}
          cartItems={cartItems}
          discrepancies={checkoutDiscrepancies}
          checkoutError={checkoutError}
          isSubmitting={isSubmittingCheckout}
          onConfirmCheckout={handleConfirmCheckout}
          onSyncCartWithLiveState={handleSyncCartWithLiveState}
          onClose={() => {
            if (!isSubmittingCheckout) {
              setIsCheckoutModalOpen(false)
            }
          }}
          onSimulateMidCheckoutChange={
            cartItems.length > 0
              ? handleSimulateExternalPriceChangeOnFirstCartItem
              : undefined
          }
        />
      ) : null}

      <details className="dev-tools-drawer">
        <summary className="dev-tools-drawer__summary">
          Herramientas de diagnóstico QA · Punto de Venta
        </summary>
        <div className="dev-tools-drawer__body">
          <label className="dev-tools-checkbox">
            <input
              type="checkbox"
              checked={simulateStorageError}
              onChange={(event) =>
                setSimulateStorageError(event.target.checked)
              }
            />
            <span>
              Simular fallo al guardar en localStorage (verifica que no queden
              ventas parciales ni descuentos de stock huérfanos)
            </span>
          </label>

          {cartItems.length > 0 ? (
            <div className="page-header-actions-group">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimulateExternalPriceChangeOnFirstCartItem}
              >
                Simular cambio de precio (+{formatCentsWithHistoricalCurrency(500, catalogCurrency)}) en 1ª partida
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimulateExternalStockReductionOnFirstCartItem}
              >
                Simular agotamiento de stock en 1ª partida
              </Button>
            </div>
          ) : null}

          <div
            className="demo-state-switcher"
            role="group"
            aria-label="Simular estado de interfaz de Punto de Venta"
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
                'Termina de cobrar o vacía el carrito actual antes de cambiar de organización.',
            })
          }}
          onDiscardAndSwitch={() => {
            if (isSubmittingCheckout) {
              cancelPendingSwitch()
              return
            }
            forceSelectOrganization(pendingTargetOrganization.id)
          }}
          onCancelSwitch={cancelPendingSwitch}
        />
      ) : null}
    </div>
  )
}
