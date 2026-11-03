import { calculateSessionComputedTotals } from '../src/features/cash/utils/moneyUtils'
import type { CashMovement, CashSession } from '../src/features/cash/types'
import {
  calculateExpensesReport,
  calculateProductsSoldReport,
} from '../src/features/reports/services/reportsCalculator'
import {
  sanitizeCsvCell,
  sanitizeCodeCell,
} from '../src/features/reports/utils/csvExport'
import type { ExpenseCategory, ExpenseRecord } from '../src/features/expenses/types'
import type { SaleRecord } from '../src/features/pos/types'

console.log('--- INICIO DE PRUEBAS DE VERIFICACIÓN AUTOMATIZADA: GASTOS Y REPORTES ---')

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, testName: string, details?: unknown) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`)
    passedTests++
  } else {
    console.error(`❌ [FAIL] ${testName}`, details || '')
    failedTests++
  }
}

// =========================================================================
// 1. VERIFICACIÓN DE FÓRMULA DE SALDO DE CAJA CON GASTOS Y REINTEGROS
// =========================================================================

const sessionMock: CashSession = {
  id: 'ses-test-01',
  organizationId: 'org-test',
  branchId: 'suc-test',
  branchName: 'Sucursal Test',
  registerId: 'reg-01',
  registerName: 'Caja 01',
  registerCode: 'CAJA-01',
  status: 'open',
  openedAt: '2026-11-02T10:00:00Z',
  closedAt: null,
  openedByUserId: 'usr-1',
  openedByUserName: 'Operador',
  closedByUserId: null,
  closedByUserName: null,
  openingAmountCents: 100000, // $1,000.00
  openingNote: null,
  closedBy: null,
  expectedClosingAmountCents: null,
  countedAmountCents: null,
  differenceAmountCents: null,
  currency: 'MXN',
  version: 1,
}

const movements: CashMovement[] = [
  // Venta en efectivo: +$160.00
  {
    id: 'mov-1',
    organizationId: 'org-test',
    branchId: 'suc-test',
    registerId: 'reg-01',
    sessionId: 'ses-test-01',
    type: 'cash_sale',
    direction: 'in',
    amountCents: 16000,
    balanceAfterCents: 116000,
    currency: 'MXN',
    reason: 'Venta FOL-0001',
    reference: 'FOL-0001',
    isCompensatory: false,
    compensatedMovementId: null,
    operatorName: 'Operador',
    createdAt: '2026-11-02T11:00:00Z',
    sequence: 1,
    operationId: 'op-1',
  },
  // Devolución en efectivo: -$80.00
  {
    id: 'mov-2',
    organizationId: 'org-test',
    branchId: 'suc-test',
    registerId: 'reg-01',
    sessionId: 'ses-test-01',
    type: 'cash_refund',
    direction: 'out',
    amountCents: 8000,
    balanceAfterCents: 108000,
    currency: 'MXN',
    reason: 'Reembolso FOL-0001',
    reference: 'DEV-0001',
    isCompensatory: true,
    compensatedMovementId: 'mov-1',
    operatorName: 'Operador',
    createdAt: '2026-11-02T11:30:00Z',
    sequence: 2,
    operationId: 'op-2',
  },
  // Gasto operativo en efectivo: -$100.00
  {
    id: 'mov-3',
    organizationId: 'org-test',
    branchId: 'suc-test',
    registerId: 'reg-01',
    sessionId: 'ses-test-01',
    type: 'expense_out',
    direction: 'out',
    amountCents: 10000,
    balanceAfterCents: 98000,
    currency: 'MXN',
    reason: 'Gasto: Artículos de limpieza',
    reference: 'GAS-0001',
    isCompensatory: false,
    compensatedMovementId: null,
    operatorName: 'Operador',
    createdAt: '2026-11-02T12:00:00Z',
    sequence: 3,
    operationId: 'op-3',
  },
]

const totals1 = calculateSessionComputedTotals(sessionMock, movements)
assert(
  totals1.expectedBalanceCents === 98000,
  'Flujo de caja: Apertura(1000) + Venta(160) - Reembolso(80) - Gasto(100) = $980.00 (98000 centavos)',
  totals1,
)

// Ahora se anula el gasto y se reingresa el efectivo (+100.00)
const compensatoryMovements: CashMovement[] = [
  ...movements,
  {
    id: 'mov-4',
    organizationId: 'org-test',
    branchId: 'suc-test',
    registerId: 'reg-01',
    sessionId: 'ses-test-01',
    type: 'expense_cancel_in',
    direction: 'in',
    amountCents: 10000,
    balanceAfterCents: 108000,
    currency: 'MXN',
    reason: 'Reintegro por anulación de gasto GAS-0001',
    reference: 'GAS-0001',
    isCompensatory: true,
    compensatedMovementId: 'mov-3',
    operatorName: 'Operador',
    createdAt: '2026-11-02T12:30:00Z',
    sequence: 4,
    operationId: 'op-4',
  },
]

const totals2 = calculateSessionComputedTotals(sessionMock, compensatoryMovements)
assert(
  totals2.expectedBalanceCents === 108000,
  'Reintegro de gasto: Saldo esperado aumenta en $100.00 llegando exactamente a $1,080.00',
  totals2,
)

// =========================================================================
// 2. REPORTE DE PRODUCTOS VENDIDOS: RIGOR EN UNIDADES DE MEDIDA
// =========================================================================

const salesMock: SaleRecord[] = [
  {
    id: 'sale-1',
    folio: 'FOL-0001',
    folioNumber: 1,
    organizationId: 'org-test',
    organizationName: 'Org Test',
    branchId: 'suc-test',
    branchName: 'Sucursal Test',
    registerId: 'reg-01',
    registerName: 'Caja 01',
    registerCode: 'CAJA-01',
    sessionId: 'ses-test-01',
    operatorName: 'Operador',
    createdAt: '2026-11-02T10:30:00Z',
    currency: 'MXN',
    subtotalCents: 23500,
    totalCents: 23500,
    itemsCount: 2,
    lines: [
      {
        id: 'line-1',
        productId: 'prod-pza',
        productName: 'Cuaderno Profesional',
        sku: '000123',
        barcodeUsed: '750123456789',
        unit: 'piece',
        quantity: 5,
        unitPriceCents: 3500,
        lineSubtotalCents: 17500,
        historicalUnitCostCents: 2000,
        inventoryMovementId: 'inv-1',
      },
      {
        id: 'line-2',
        productId: 'prod-kg',
        productName: 'Café en Grano Mezcla',
        sku: 'CAF-KG',
        barcodeUsed: null,
        unit: 'kg',
        quantity: 2.5,
        unitPriceCents: 2400,
        lineSubtotalCents: 6000,
        historicalUnitCostCents: 1500,
        inventoryMovementId: 'inv-2',
      },
    ],
    payment: {
      id: 'pay-1',
      method: 'cash',
      currency: 'MXN',
      amountCents: 23500,
      cashReceivedCents: 30000,
      cashChangeCents: 6500,
      externalReference: null,
      externalVerifiedByOperator: false,
      cashMovementId: 'mov-1',
    },
    inventoryMovementIds: ['inv-1', 'inv-2'],
    cashMovementId: 'mov-1',
    sequence: 1,
    operationId: 'op-sale-1',
    status: 'completed',
    refundedTotalCents: 0,
    netTotalCents: 23500,
    returnsCount: 0,
    returns: [],
    auditEvents: [],
  },
]

const productsReport = calculateProductsSoldReport(
  salesMock,
  { period: 'all' },
  'MXN',
)

assert(
  productsReport.unitTotals.length === 2,
  'Reporte de Productos: Las unidades están rigurosamente separadas en 2 grupos',
)

const pieceTotal = productsReport.unitTotals.find((u) => u.unit === 'piece')
const kgTotal = productsReport.unitTotals.find((u) => u.unit === 'kg')

assert(
  pieceTotal?.netQuantity === 5,
  'Unidad "piece": Total neto es exactamente 5 piezas',
)
assert(
  kgTotal?.netQuantity === 2.5,
  'Unidad "kg": Total neto es exactamente 2.5 kilogramos',
)

// Asegurar que NO se sumaron 5 + 2.5 = 7.5 en un total mezclado
assert(
  productsReport.totalNetCents === 23500,
  'Total monetario consolidado exacto en centavos: $235.00 MXN',
)

// =========================================================================
// 3. REPORTE DE GASTOS: ACTIVOS, ANULADOS Y PORCENTAJES
// =========================================================================

const categoriesMock: ExpenseCategory[] = [
  {
    id: 'cat-1',
    name: 'Papelería y Oficina',
    description: '',
    isActive: true,
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    name: 'Servicios Básicos',
    description: '',
    isActive: true,
    createdAt: '2026-11-01T00:00:00Z',
  },
]

const expensesMock: ExpenseRecord[] = [
  {
    id: 'exp-1',
    folio: 'GAS-0001',
    organizationId: 'org-test',
    branchId: 'suc-test',
    branchName: 'Sucursal Test',
    categoryId: 'cat-1',
    categoryName: 'Papelería y Oficina',
    concept: 'Resma de papel',
    amountCents: 15000, // $150.00
    currency: 'MXN',
    paymentMethod: 'cash',
    expenseDate: '2026-11-02',
    createdAt: '2026-11-02T10:00:00Z',
    registeredBy: 'Operador',
    externalReference: null,
    attachment: null,
    cashSessionId: 'ses-test-01',
    cashMovementId: 'mov-3',
    status: 'active',
    cancellation: null,
    operationId: 'op-e-1',
  },
  {
    id: 'exp-2',
    folio: 'GAS-0002',
    organizationId: 'org-test',
    branchId: 'suc-test',
    branchName: 'Sucursal Test',
    categoryId: 'cat-2',
    categoryName: 'Servicios Básicos',
    concept: 'Pago de Internet',
    amountCents: 35000, // $350.00
    currency: 'MXN',
    paymentMethod: 'transfer',
    expenseDate: '2026-11-02',
    createdAt: '2026-11-02T11:00:00Z',
    registeredBy: 'Operador',
    externalReference: 'SPEI-8827',
    attachment: null,
    cashSessionId: null,
    cashMovementId: null,
    status: 'active',
    cancellation: null,
    operationId: 'op-e-2',
  },
  {
    id: 'exp-3',
    folio: 'GAS-0003',
    organizationId: 'org-test',
    branchId: 'suc-test',
    branchName: 'Sucursal Test',
    categoryId: 'cat-1',
    categoryName: 'Papelería y Oficina',
    concept: 'Tóner duplicado',
    amountCents: 20000, // $200.00
    currency: 'MXN',
    paymentMethod: 'cash',
    expenseDate: '2026-11-02',
    createdAt: '2026-11-02T12:00:00Z',
    registeredBy: 'Operador',
    externalReference: null,
    attachment: null,
    cashSessionId: 'ses-test-01',
    cashMovementId: 'mov-e-3',
    status: 'cancelled',
    cancellation: {
      cancelledAt: '2026-11-02T13:00:00Z',
      cancelledBy: 'Operador',
      reason: 'Error en captura',
      cashMovementId: 'mov-e-cancel',
    },
    operationId: 'op-e-3',
  },
]

const expensesReport = calculateExpensesReport(
  expensesMock,
  categoriesMock,
  { period: 'all' },
  'MXN',
)

assert(
  expensesReport.grossTotalCents === 70000,
  'Gastos brutos registrados: $700.00 (70000 centavos)',
)
assert(
  expensesReport.cancelledTotalCents === 20000,
  'Gastos anulados: $200.00 (20000 centavos)',
)
assert(
  expensesReport.netTotalCents === 50000,
  'Gastos netos activos: $500.00 (50000 centavos)',
)

// =========================================================================
// 4. SANITIZACIÓN CSV CONTRA FORMULA INJECTION Y CEROS A LA IZQUIERDA
// =========================================================================

const formulaDangerousValues = [
  '=SUM(A1:A10)',
  '+cmd| /c calc',
  '-2+3*[1]',
  '@IMPORTXML("url")',
]

for (const val of formulaDangerousValues) {
  const sanitized = sanitizeCsvCell(val)
  const isProtected = sanitized.startsWith("'") || sanitized.startsWith('"\'')
  assert(
    isProtected,
    `Protección CSV: "${val}" se neutraliza anteponiendo comilla simple`,
  )
}

const codeWithLeadingZeros = '00049210084'
const sanitizedCode = sanitizeCodeCell(codeWithLeadingZeros)
assert(
  sanitizedCode === '="00049210084"',
  'Preservación de ceros: "00049210084" se exporta como ="00049210084" en CSV',
)

console.log(
  `\n--- RESUMEN DE PRUEBAS: ${passedTests} aprobadas, ${failedTests} fallidas ---`,
)

if (failedTests > 0) {
  process.exit(1)
} else {
  console.log('🎉 TODAS LAS VERIFICACIONES COMPLETADAS EXITOSAMENTE.')
}
