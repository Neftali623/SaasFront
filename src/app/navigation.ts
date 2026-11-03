import type { PanelRouteItem } from '../types'

export const APP_ROUTES = {
  root: '/',
  login: '/login',
  organizations: '/organizaciones',
  panelRoot: '/panel',
  summary: '/panel/resumen',
  pos: '/panel/punto-de-venta',
  sales: '/panel/ventas',
  products: '/panel/productos',
  inventory: '/panel/inventario',
  cash: '/panel/caja',
  expenses: '/panel/gastos',
  reports: '/panel/reportes',
  team: '/panel/equipo',
  settings: '/panel/configuracion',
  planAndHelp: '/panel/plan-y-ayuda',
} as const

export const PANEL_NAV_ITEMS: PanelRouteItem[] = [
  {
    id: 'summary',
    path: APP_ROUTES.summary,
    title: 'Resumen',
    shortDescription: 'Panorama diario de ventas, caja e inventario del negocio activo.',
    icon: 'summary',
    status: 'active-demo',
    plannedFeatures: [
      'Consulta en tiempo real de indicadores operativos desde la API.',
      'Filtros por sucursal y corte del turno activo.',
    ],
  },
  {
    id: 'pos',
    path: APP_ROUTES.pos,
    title: 'Punto de venta',
    shortDescription: 'Mostrador ágil para cobro de artículos, búsqueda por código y emisión de tickets.',
    icon: 'pos',
    status: 'active-demo',
    plannedFeatures: [
      'Búsqueda rápida de productos por nombre o código SKU.',
      'Carrito de cobro con cálculo de cambio en efectivo y pagos manuales verificados.',
      'Emisión de comprobante con folio consecutivo por organización.',
    ],
  },
  {
    id: 'sales',
    path: APP_ROUTES.sales,
    title: 'Ventas',
    shortDescription: 'Historial de tickets emitidos, consulta de folios y detalle por operación.',
    icon: 'sales',
    status: 'active-demo',
    plannedFeatures: [
      'Listado de tickets por fecha, cajero y método de pago.',
      'Consulta de desglose histórico e inmutable de artículos vendidos por ticket.',
      'Cancelaciones y devoluciones con registro de autorización (fase posterior).',
    ],
  },
  {
    id: 'products',
    path: APP_ROUTES.products,
    title: 'Productos',
    shortDescription: 'Catálogo de artículos, precios de venta, categorías y códigos.',
    icon: 'products',
    status: 'active-demo',
    plannedFeatures: [
      'Alta y edición de productos con código SKU, unidad y categoría.',
      'Definición de precios de venta e impuestos aplicables.',
      'Estado activo o inactivo por producto en el mostrador.',
    ],
  },
  {
    id: 'inventory',
    path: APP_ROUTES.inventory,
    title: 'Inventario',
    shortDescription: 'Existencias actuales, entradas de mercancía, ajustes y mínimos de reposición.',
    icon: 'inventory',
    status: 'active-demo',
    plannedFeatures: [
      'Kardex de movimientos de entrada, salida y ajuste justificado.',
      'Configuración de stock mínimo y alertas de reabastecimiento.',
      'Conteo físico y conciliación de existencias.',
    ],
  },
  {
    id: 'cash',
    path: APP_ROUTES.cash,
    title: 'Caja',
    shortDescription: 'Apertura de turno, fondo inicial, entradas/salidas de efectivo y arqueo de cierre.',
    icon: 'cash',
    status: 'active-demo',
    plannedFeatures: [
      'Apertura de turno con registro de fondo fijo en efectivo.',
      'Registro de movimientos de efectivo en caja y retiros parciales.',
      'Corte y arqueo de cierre de turno con conciliación de montos.',
    ],
  },
  {
    id: 'expenses',
    path: APP_ROUTES.expenses,
    title: 'Gastos',
    shortDescription: 'Registro de pagos a proveedores, servicios e insumos operativos del negocio.',
    icon: 'expenses',
    status: 'active-demo',
    plannedFeatures: [
      'Captura de gastos operativos clasificados por categoría.',
      'Asociación atómica con salida de caja o registro bancario/tarjeta.',
      'Consulta histórica de egresos, comprobantes adjuntos y anulación trazable.',
    ],
  },
  {
    id: 'reports',
    path: APP_ROUTES.reports,
    title: 'Reportes',
    shortDescription: 'Consultas operativas por periodo, artículos más vendidos y cortes históricos.',
    icon: 'reports',
    status: 'active-demo',
    plannedFeatures: [
      'Resumen de ventas por rango de fechas y método de pago.',
      'Desempeño de productos de mayor rotación y cantidades por unidad.',
      'Exportación a CSV con protección de inyección y metadatos.',
    ],
  },
  {
    id: 'team',
    path: APP_ROUTES.team,
    title: 'Mi equipo',
    shortDescription: 'Usuarios de la organización, perfiles operativos y permisos de acceso.',
    icon: 'team',
    status: 'pending',
    plannedFeatures: [
      'Administración de usuarios cajeros, encargados y administradores.',
      'Asignación de roles y permisos validados por el backend.',
      'Control de acceso activo por organización.',
    ],
  },
  {
    id: 'settings',
    path: APP_ROUTES.settings,
    title: 'Configuración',
    shortDescription: 'Datos comerciales del negocio, apariencia (logo y colores) y preferencias de formato.',
    icon: 'settings',
    status: 'active-demo',
    plannedFeatures: [
      'Persistencia en PostgreSQL mediante endpoints de configuración del backend.',
      'Subida y almacenamiento de logotipo con validación en servidor.',
      'Configuración adicional de pie de ticket fiscal/comercial.',
    ],
  },
  {
    id: 'plan-and-help',
    path: APP_ROUTES.planAndHelp,
    title: 'Mi plan y ayuda',
    shortDescription: 'Estado de suscripción de la cuenta, guías de uso y soporte técnico.',
    icon: 'plan',
    status: 'pending',
    plannedFeatures: [
      'Detalles del plan contratado y límites de operación.',
      'Guía rápida de operación para cajeros y administradores.',
      'Canal de contacto y soporte de Nedaxoli Control.',
    ],
  },
]

export function getPanelRouteByPath(pathname: string): PanelRouteItem | undefined {
  return PANEL_NAV_ITEMS.find((item) => item.path === pathname)
}
