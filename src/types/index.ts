export interface OrganizationTheme {
  primaryColor: string
  primaryHoverColor: string
  primarySoftColor: string
  accentColor: string
  accentSoftColor: string
}

export interface BusinessProfileSettings {
  commercialName: string
  phone: string
  email: string
  address: string
  website: string
}

export interface AppearanceSettings {
  primaryColor: string
  accentColor: string
}

export type CurrencyCode = 'MXN' | 'USD' | 'COP' | 'EUR'

export type TimezoneOption =
  | 'America/Mexico_City'
  | 'America/Monterrey'
  | 'America/Tijuana'
  | 'America/Bogota'
  | 'America/Lima'
  | 'Europe/Madrid'

export type DateFormatOption = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'

export interface OrganizationPreferences {
  currency: CurrencyCode
  timezone: TimezoneOption
  dateFormat: DateFormatOption
}

export interface SerializableOrganizationSettings {
  businessProfile: BusinessProfileSettings
  appearance: AppearanceSettings
  preferences: OrganizationPreferences
}

export interface SessionLogoData {
  objectUrl: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
}

export interface Organization {
  id: string
  name: string
  initials: string
  category: string
  branchName: string
  primaryColor: string
  accentColor: string
  theme: OrganizationTheme
  businessProfile: BusinessProfileSettings
  preferences: OrganizationPreferences
  logo: SessionLogoData
  initialSettings: SerializableOrganizationSettings
  updatedAt: string | null
}

export interface DemoUser {
  name: string
  role: string
  emailPreview: string
}

export interface CashRegisterStatus {
  status: 'open' | 'closed'
  statusLabel: string
  shiftName: string
  openedAt: string
  openingBalanceAmount: number
  currentCashAmount: number
  openingBalanceFormatted: string
  currentCashFormatted: string
  operatorName: string
}

export interface DailySalesMetrics {
  totalSalesAmount: number
  totalSalesFormatted: string
  grossSalesAmount?: number
  grossSalesFormatted?: string
  refundsAmount?: number
  refundsFormatted?: string
  refundsCount?: number
  netSalesAmount?: number
  netSalesFormatted?: string
  salesCount: number
  averageTicketAmount: number
  averageTicketFormatted: string
  referenceDateIso: string
  cutoffTime24h: string
  lastUpdatedLabel: string
  lowStockCount: number
}

export type PaymentMethodLabel = 'Efectivo' | 'Tarjeta' | 'Transferencia'

export interface RecentSaleItem {
  id: string
  ticketNumber: string
  saleDateIso: string
  time: string
  itemsSummary: string
  itemsCount: number
  paymentMethod: PaymentMethodLabel
  totalAmount: number
  totalFormatted: string
  cashierName: string
  statusLabel?: string
  statusBadgeVariant?: 'success' | 'warning' | 'danger' | 'neutral'
  netAmount?: number
  netFormatted?: string
}

export type InventoryAlertSeverity = 'critical' | 'warning'

export interface InventoryAlertItem {
  id: string
  sku: string
  productName: string
  category: string
  currentStock: number
  minStock: number
  unit: string
  severity: InventoryAlertSeverity
}

export interface OrganizationDashboardData {
  organizationId: string
  summaryNote: string
  metrics: DailySalesMetrics
  cashRegister: CashRegisterStatus
  recentSales: RecentSaleItem[]
  inventoryAlerts: InventoryAlertItem[]
}

export type NavIconName =
  | 'summary'
  | 'pos'
  | 'sales'
  | 'products'
  | 'inventory'
  | 'cash'
  | 'expenses'
  | 'reports'
  | 'team'
  | 'settings'
  | 'plan'

export interface PanelRouteItem {
  id: string
  path: string
  title: string
  shortDescription: string
  icon: NavIconName
  status: 'active-demo' | 'pending'
  plannedFeatures: string[]
}
