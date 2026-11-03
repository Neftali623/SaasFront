import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_ROUTES } from '../../../app/navigation'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { LoadingState } from '../../../components/ui/LoadingState'
import { PageHeader } from '../../../components/ui/PageHeader'
import type { Organization } from '../../../types'
import { defaultInventoryRepository } from '../../inventory/services/inventoryRepository'
import { validateProductUnitChangeWithInventory } from '../../inventory/utils/quantityUtils'
import { useDemoOrganization } from '../../organizations/DemoOrganizationContext'
import { UnsavedChangesModal } from '../../settings/UnsavedChangesModal'
import { CategoriesManagerPanel } from '../components/CategoriesManagerPanel'
import { DeactivateProductModal } from '../components/DeactivateProductModal'
import {
  ProductFormPanel,
  type ProductSavePayload,
} from '../components/ProductFormPanel'
import { ProductsFiltersBar } from '../components/ProductsFiltersBar'
import { ProductsTable } from '../components/ProductsTable'
import {
  defaultProductsCatalogRepository,
  generateStableId,
} from '../services/productsCatalogRepository'
import type {
  CategoryStatus,
  OrganizationCatalogData,
  Product,
  ProductCatalogFilters,
  ProductCategory,
  StatusFilterValue,
} from '../types'

const PAGE_SIZE = 5

type CatalogViewMode = 'list' | 'form' | 'categories'
type QaUiPreviewState = 'normal' | 'loading' | 'empty-catalog' | 'error'

export function ProductsCatalogPage() {
  const { activeOrganization } = useDemoOrganization()

  return (
    <OrganizationCatalogWorkspace
      key={activeOrganization.id}
      organization={activeOrganization}
    />
  )
}

interface OrganizationCatalogWorkspaceProps {
  organization: Organization
}

function OrganizationCatalogWorkspace({
  organization,
}: OrganizationCatalogWorkspaceProps) {
  const navigate = useNavigate()
  const {
    organizations,
    pendingSwitchOrgId,
    cancelPendingSwitch,
    forceSelectOrganization,
    setHasUnsavedSettingsChanges,
    simulateStorageError,
    setSimulateStorageError,
  } = useDemoOrganization()

  const [initialLoad] = useState(() =>
    defaultProductsCatalogRepository.load(organization.id),
  )
  const [catalog, setCatalog] = useState<OrganizationCatalogData>(
    initialLoad.catalog,
  )
  const [storageWarning] = useState<string | undefined>(initialLoad.warning)

  const [viewMode, setViewMode] = useState<CatalogViewMode>('list')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productToDeactivate, setProductToDeactivate] =
    useState<Product | null>(null)

  const [filters, setFilters] = useState<ProductCatalogFilters>({
    searchQuery: '',
    categoryFilter: 'all',
    statusFilter: 'all',
  })
  const [requestedPage, setRequestedPage] = useState<number>(1)

  const [isFormDirty, setIsFormDirty] = useState<boolean>(false)
  const [pendingViewSwitch, setPendingViewSwitch] =
    useState<CatalogViewMode | null>(null)
  const externalSaveHandlerRef = useRef<(() => boolean) | null>(null)

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

  const categoriesById = useMemo(() => {
    const map = new Map<string, ProductCategory>()
    for (const cat of catalog.categories) {
      map.set(cat.id, cat)
    }
    return map
  }, [catalog.categories])

  const filteredProducts = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase()

    return catalog.products.filter((product) => {
      if (
        filters.statusFilter !== 'all' &&
        product.status !== filters.statusFilter
      ) {
        return false
      }

      if (filters.categoryFilter === 'uncategorized') {
        if (product.categoryId !== null) {
          return false
        }
      } else if (
        filters.categoryFilter !== 'all' &&
        product.categoryId !== filters.categoryFilter
      ) {
        return false
      }

      if (query.length > 0) {
        const matchesName = product.name.toLowerCase().includes(query)
        const matchesSku = product.sku.toLowerCase().includes(query)
        const matchesBarcode = product.barcodes.some((code) =>
          code.toLowerCase().includes(query),
        )
        if (!matchesName && !matchesSku && !matchesBarcode) {
          return false
        }
      }

      return true
    })
  }, [catalog.products, filters])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(Math.max(1, requestedPage), totalPages)

  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredProducts.slice(start, start + PAGE_SIZE)
  }, [filteredProducts, safeCurrentPage])

  const pageStartIndex =
    filteredProducts.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1
  const pageEndIndex = Math.min(
    safeCurrentPage * PAGE_SIZE,
    filteredProducts.length,
  )

  const persistCatalogUpdate = (
    nextCatalog: OrganizationCatalogData,
  ): { ok: boolean; error?: string } => {
    if (simulateStorageError) {
      return {
        ok: false,
        error:
          'Fallo simulado de almacenamiento: no se pudieron guardar los cambios en localStorage. Tus datos en pantalla se conservaron.',
      }
    }

    const saveOutcome = defaultProductsCatalogRepository.save(
      organization.id,
      nextCatalog,
    )
    if (!saveOutcome.ok) {
      return {
        ok: false,
        error: saveOutcome.error,
      }
    }

    setCatalog(nextCatalog)
    return { ok: true }
  }

  const handleOpenNewProduct = () => {
    setFeedback(null)
    setEditingProduct(null)
    setPendingViewSwitch(null)
    setViewMode('form')
  }

  const handleOpenEditProduct = (product: Product) => {
    if (product.organizationId !== organization.id) {
      return
    }
    setFeedback(null)
    setEditingProduct(product)
    setPendingViewSwitch(null)
    setViewMode('form')
  }

  const handleSwitchViewRequest = (targetView: CatalogViewMode) => {
    if (viewMode === 'form' && isFormDirty) {
      setPendingViewSwitch(targetView)
      return
    }
    setFeedback(null)
    setEditingProduct(null)
    setPendingViewSwitch(null)
    setViewMode(targetView)
  }

  const handleSaveProduct = (
    payload: ProductSavePayload,
    editingProductId?: string,
  ): { ok: boolean; error?: string } => {
    const now = new Date().toISOString()

    if (editingProductId) {
      const existingProduct = catalog.products.find(
        (prod) =>
          prod.id === editingProductId &&
          prod.organizationId === organization.id,
      )
      if (!existingProduct) {
        return {
          ok: false,
          error:
            'El producto que intentas editar no pertenece a la organización activa.',
        }
      }

      const hasInventoryMovements =
        defaultInventoryRepository.hasProductMovements(
          organization.id,
          editingProductId,
        )
      const unitConflictError = validateProductUnitChangeWithInventory(
        existingProduct.unit,
        payload.unit,
        hasInventoryMovements,
      )
      if (unitConflictError) {
        return {
          ok: false,
          error: unitConflictError,
        }
      }

      const nextProducts = catalog.products.map((prod) =>
        prod.id === editingProductId
          ? {
              ...prod,
              name: payload.name,
              description: payload.description,
              sku: payload.sku,
              categoryId: payload.categoryId,
              unit: payload.unit,
              salePrice: payload.salePrice,
              cost: payload.cost,
              barcodes: [...payload.barcodes],
              status: payload.status,
              updatedAt: now,
            }
          : prod,
      )

      const outcome = persistCatalogUpdate({
        ...catalog,
        products: nextProducts,
      })
      if (!outcome.ok) {
        return outcome
      }

      setIsFormDirty(false)
      setEditingProduct(null)
      setViewMode('list')
      setFeedback({
        type: 'success',
        message: `Producto "${payload.name}" (${payload.sku}) actualizado en ${organization.name}.`,
      })
      return { ok: true }
    }

    const newProduct: Product = {
      id: generateStableId('prod'),
      organizationId: organization.id,
      name: payload.name,
      description: payload.description,
      sku: payload.sku,
      categoryId: payload.categoryId,
      unit: payload.unit,
      salePrice: payload.salePrice,
      cost: payload.cost,
      barcodes: [...payload.barcodes],
      status: payload.status,
      createdAt: now,
      updatedAt: now,
    }

    const outcome = persistCatalogUpdate({
      ...catalog,
      products: [newProduct, ...catalog.products],
    })
    if (!outcome.ok) {
      return outcome
    }

    setIsFormDirty(false)
    setEditingProduct(null)
    setViewMode('list')
    setRequestedPage(1)
    setFeedback({
      type: 'success',
      message: `Producto "${newProduct.name}" (${newProduct.sku}) creado en ${organization.name}.`,
    })
    return { ok: true }
  }

  const handleConfirmDeactivateProduct = () => {
    if (!productToDeactivate) {
      return
    }
    const target = productToDeactivate
    const now = new Date().toISOString()

    const nextProducts = catalog.products.map((prod) =>
      prod.id === target.id
        ? { ...prod, status: 'inactive' as const, updatedAt: now }
        : prod,
    )

    const outcome = persistCatalogUpdate({
      ...catalog,
      products: nextProducts,
    })
    setProductToDeactivate(null)

    if (!outcome.ok) {
      setFeedback({
        type: 'error',
        message:
          outcome.error ?? 'No se pudo desactivar el producto seleccionado.',
      })
      return
    }

    setFeedback({
      type: 'success',
      message: `Producto "${target.name}" desactivado. Su SKU (${target.sku}) y códigos permanecen reservados.`,
    })
  }

  const handleReactivateProduct = (product: Product) => {
    const now = new Date().toISOString()
    const nextProducts = catalog.products.map((prod) =>
      prod.id === product.id
        ? { ...prod, status: 'active' as const, updatedAt: now }
        : prod,
    )

    const outcome = persistCatalogUpdate({
      ...catalog,
      products: nextProducts,
    })

    if (!outcome.ok) {
      setFeedback({
        type: 'error',
        message:
          outcome.error ?? 'No se pudo reactivar el producto seleccionado.',
      })
      return
    }

    setFeedback({
      type: 'success',
      message: `Producto "${product.name}" reactivado y disponible nuevamente.`,
    })
  }

  const handleCreateCategory = (
    cleanName: string,
  ): { ok: boolean; error?: string } => {
    const now = new Date().toISOString()
    const newCategory: ProductCategory = {
      id: generateStableId('cat'),
      organizationId: organization.id,
      name: cleanName,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }

    return persistCatalogUpdate({
      ...catalog,
      categories: [...catalog.categories, newCategory],
    })
  }

  const handleRenameCategory = (
    categoryId: string,
    cleanName: string,
  ): { ok: boolean; error?: string } => {
    const now = new Date().toISOString()
    const nextCategories = catalog.categories.map((cat) =>
      cat.id === categoryId
        ? { ...cat, name: cleanName, updatedAt: now }
        : cat,
    )

    return persistCatalogUpdate({
      ...catalog,
      categories: nextCategories,
    })
  }

  const handleToggleCategoryStatus = (
    category: ProductCategory,
  ): { ok: boolean; error?: string } => {
    const now = new Date().toISOString()
    const nextStatus: CategoryStatus =
      category.status === 'active' ? 'inactive' : 'active'
    const nextCategories = catalog.categories.map((cat) =>
      cat.id === category.id
        ? { ...cat, status: nextStatus, updatedAt: now }
        : cat,
    )

    return persistCatalogUpdate({
      ...catalog,
      categories: nextCategories,
    })
  }

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      categoryFilter: 'all',
      statusFilter: 'all',
    })
    setRequestedPage(1)
  }

  const pendingTargetOrganization = useMemo(() => {
    if (!pendingSwitchOrgId) {
      return null
    }
    return (
      organizations.find((org) => org.id === pendingSwitchOrgId) ?? null
    )
  }, [organizations, pendingSwitchOrgId])

  const handleSaveAndSwitchOrg = () => {
    if (!pendingSwitchOrgId) {
      return
    }
    const saved = externalSaveHandlerRef.current
      ? externalSaveHandlerRef.current()
      : true
    if (saved) {
      forceSelectOrganization(pendingSwitchOrgId)
    } else {
      cancelPendingSwitch()
    }
  }

  const handleDiscardAndSwitchOrg = () => {
    if (!pendingSwitchOrgId) {
      return
    }
    forceSelectOrganization(pendingSwitchOrgId)
  }

  return (
    <div className="products-page">
      <PageHeader
        title={`Productos · ${organization.name}`}
        description="Catálogo de artículos, precios de venta, códigos asociados y categorías de la organización activa."
        badge={<Badge variant="demo">Modo demostración</Badge>}
        actions={
          <div className="page-header-actions-group">
            {viewMode !== 'list' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSwitchViewRequest('list')}
              >
                Ver listado ({catalog.products.length})
              </Button>
            ) : null}

            <Button
              variant={viewMode === 'categories' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() =>
                handleSwitchViewRequest(
                  viewMode === 'categories' ? 'list' : 'categories',
                )
              }
            >
              Categorías ({catalog.categories.length})
            </Button>

            {viewMode !== 'form' || editingProduct !== null ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenNewProduct}
              >
                + Nuevo producto
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Aviso breve de Modo demostración */}
      <div
        className="demo-brief-banner"
        role="note"
        aria-label="Aviso de modo demostración"
      >
        <p className="demo-brief-banner__text">
          <strong>Modo demostración:</strong> El catálogo de{' '}
          <strong>{organization.name}</strong> se guarda localmente en este
          navegador. La columna de costo se muestra como vista previa; su
          visibilidad se restringirá por rol cuando se conecte la autorización
          del backend.
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

      {pendingViewSwitch ? (
        <div
          className="settings-unsaved-bar"
          role="region"
          aria-label="Confirmar cambio de vista con formulario sin guardar"
        >
          <div className="settings-unsaved-bar__text">
            <strong>Tienes cambios sin guardar en el formulario.</strong>{' '}
            ¿Deseas descartarlos para cambiar de vista?
          </div>
          <div className="settings-unsaved-bar__actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const target = pendingViewSwitch
                setPendingViewSwitch(null)
                setIsFormDirty(false)
                setEditingProduct(null)
                setViewMode(target)
              }}
            >
              Descartar y continuar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingViewSwitch(null)}
            >
              Seguir editando
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

      {/* Vista 1: Listado de productos */}
      {viewMode === 'list' ? (
        <>
          <ProductsFiltersBar
            filters={filters}
            categories={catalog.categories}
            totalCatalogCount={catalog.products.length}
            filteredCount={filteredProducts.length}
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
            onChangeStatus={(value: StatusFilterValue) => {
              setFilters((prev) => ({ ...prev, statusFilter: value }))
              setRequestedPage(1)
            }}
            onResetFilters={resetFilters}
          />

          {qaUiState === 'loading' ? (
            <LoadingState
              title={`Cargando catálogo de ${organization.name}...`}
              description="Consultando productos y categorías de la organización activa."
            />
          ) : null}

          {qaUiState === 'error' ? (
            <ErrorState
              title="No se pudo cargar el catálogo de productos"
              description="Ocurrió un problema al consultar el listado. Puedes reintentar la operación."
              onRetry={() => setQaUiState('normal')}
              retryLabel="Reintentar carga"
            />
          ) : null}

          {qaUiState === 'empty-catalog' ||
          (qaUiState === 'normal' && catalog.products.length === 0) ? (
            <EmptyState
              title={`El catálogo de ${organization.name} está vacío`}
              description="Registra el primer producto de tu negocio con su SKU, precio de venta y códigos de barras."
              action={
                <div className="pending-module-actions">
                  <Button variant="primary" onClick={handleOpenNewProduct}>
                    Registrar primer producto
                  </Button>
                  {qaUiState === 'empty-catalog' ? (
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
          catalog.products.length > 0 &&
          filteredProducts.length === 0 ? (
            <EmptyState
              title="Sin coincidencias para tu búsqueda o filtros"
              description="No encontramos productos que coincidan con los criterios actuales. Prueba con otro término o limpia los filtros."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : null}

          {qaUiState === 'normal' && filteredProducts.length > 0 ? (
            <ProductsTable
              products={paginatedProducts}
              categoriesById={categoriesById}
              currency={catalog.baseCurrency ?? 'MXN'}
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={(page) => setRequestedPage(page)}
              onEditProduct={handleOpenEditProduct}
              onViewInventory={(prod) =>
                navigate(
                  `${APP_ROUTES.inventory}?productId=${encodeURIComponent(prod.id)}`,
                )
              }
              onRequestDeactivate={(prod) => setProductToDeactivate(prod)}
              onReactivateProduct={handleReactivateProduct}
            />
          ) : null}
        </>
      ) : null}

      {/* Vista 2: Formulario de Alta / Edición de Producto */}
      {viewMode === 'form' ? (
        <ProductFormPanel
          key={editingProduct?.id ?? 'new-product'}
          organizationName={organization.name}
          currency={catalog.baseCurrency ?? 'MXN'}
          editingProduct={editingProduct}
          hasInventoryMovements={
            editingProduct
              ? defaultInventoryRepository.hasProductMovements(
                  organization.id,
                  editingProduct.id,
                )
              : false
          }
          organizationProducts={catalog.products}
          organizationCategories={catalog.categories}
          onSaveProduct={handleSaveProduct}
          onCancel={() => {
            setIsFormDirty(false)
            setEditingProduct(null)
            setViewMode('list')
          }}
          onDirtyChange={setIsFormDirty}
          registerExternalSaveHandler={(handler) => {
            externalSaveHandlerRef.current = handler
          }}
        />
      ) : null}

      {/* Vista 3: Gestión de Categorías */}
      {viewMode === 'categories' ? (
        <CategoriesManagerPanel
          organizationName={organization.name}
          categories={catalog.categories}
          products={catalog.products}
          onCreateCategory={handleCreateCategory}
          onRenameCategory={handleRenameCategory}
          onToggleCategoryStatus={handleToggleCategoryStatus}
          onBackToCatalog={() => setViewMode('list')}
        />
      ) : null}

      {/* Área discreta de desarrollo / QA */}
      <details className="dev-tools-drawer">
        <summary className="dev-tools-drawer__summary">
          Área de desarrollo y verificación QA (simulación de estados y fallos)
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
            <span>Simular fallo al guardar en almacenamiento local</span>
          </label>

          {viewMode === 'list' ? (
            <div
              className="demo-state-switcher"
              role="group"
              aria-label="Simular estado de listado"
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
                  qaUiState === 'empty-catalog' ? 'demo-state-pill--active' : ''
                }`}
                onClick={() => setQaUiState('empty-catalog')}
              >
                Catálogo vacío
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

      {productToDeactivate ? (
        <DeactivateProductModal
          product={productToDeactivate}
          onConfirmDeactivate={handleConfirmDeactivateProduct}
          onCancel={() => setProductToDeactivate(null)}
        />
      ) : null}

      {pendingTargetOrganization ? (
        <UnsavedChangesModal
          currentOrgName={organization.name}
          targetOrgName={pendingTargetOrganization.name}
          onSaveAndSwitch={handleSaveAndSwitchOrg}
          onDiscardAndSwitch={handleDiscardAndSwitchOrg}
          onCancelSwitch={cancelPendingSwitch}
        />
      ) : null}
    </div>
  )
}
