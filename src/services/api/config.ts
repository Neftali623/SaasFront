/**
 * Punto central de configuración para la comunicación futura con el backend.
 *
 * IMPORTANTE (Modo Demostración):
 * - En esta entrega NO se realizan peticiones HTTP porque el backend aún no está conectado.
 * - Solo se expone la variable pública VITE_API_URL para cuando se acuerden los contratos con Edwin.
 * - Nunca colocar credenciales de base de datos, secretos ni llaves privadas en el frontend.
 * - El frontend jamás se conecta directamente a PostgreSQL; toda operación pasará por la API.
 *
 * Contratos pendientes por acordar con Edwin (Backend) y Haniel (Base de datos):
 * 1. Autenticación, sesión y autorización por rol:
 *    - Formato de inicio/cierre de sesión y mecanismo de sesión segura.
 *    - Perfil del usuario autenticado y permisos por rol (incluyendo restricción de visibilidad
 *      y edición del costo unitario de productos para roles de cajero/operador).
 * 2. Organizaciones (Multi-tenant):
 *    - Listado de organizaciones y sucursales a las que pertenece el usuario.
 *    - El aislamiento real de datos por organización y sucursal será validado en backend en cada solicitud.
 * 3. Configuración del negocio, apariencia y preferencias:
 *    - Consultar y actualizar configuración comercial, colores hexadecimales y preferencias.
 *    - Cargar y eliminar logotipo de la organización con validación de archivo en servidor.
 * 4. Catálogo de Productos y Categorías:
 *    - Consultar productos paginados con búsqueda (nombre, SKU, código) y filtros (categoría, estado).
 *    - Crear, editar, activar y desactivar productos (sin borrado físico), validando en servidor:
 *      unicidad de SKU por organización, unicidad de códigos de barras por organización (conservando
 *      ceros iniciales como texto), precisión monetaria de 2 decimales y bloqueo de cambio de unidad
 *      de medida cuando el producto ya cuenta con movimientos de inventario registrados.
 *    - Listar, crear, renombrar, activar y desactivar categorías por organización.
 * 5. Inventario (Saldos por sucursal, Movimientos e Idempotencia):
 *    - Consultar existencias paginadas por organización y sucursal con filtros por estado de stock.
 *    - Registrar existencia inicial única por `(organization_id, branch_id, product_id)`.
 *    - Registrar entradas manuales (solo productos activos) y salidas manuales con validación de stock
 *      suficiente y clave de idempotencia (`operationId`).
 *    - Registrar ajuste por conteo físico con control de concurrencia optimista (`expectedBalanceVersion`),
 *      calculando `delta = counted - registered` dentro de una transacción ACID en base de datos.
 *    - Configurar o quitar stock mínimo (`minStock: number | null`) diferenciando `NULL` de `0`, sin
 *      generar movimientos en el kardex.
 *    - Consultar historial inmutable de movimientos ordenado por `(created_at DESC, sequence DESC)`.
 * 6. Caja y Sesiones de Caja (Turnos, Movimientos de Efectivo y Arqueo):
 *    - Consultar la caja asignada a la sucursal y su sesión abierta activa (regla de una sola sesión
 *      abierta por caja mediante índice único parcial en base de datos).
 *    - Abrir sesión de caja fijando la moneda histórica del turno (`currency`) y el fondo inicial en
 *      centavos enteros (`openingAmountCents >= 0`), con clave de idempotencia (`operationId`).
 *    - Registrar entradas manuales (`manual_in`) y retiros manuales (`manual_out`, validando que no
 *      supere el saldo esperado disponible) e inmutabilidad de movimientos confirmados (correcciones
 *      mediante movimientos compensatorios vinculados `isCompensatory: true`).
 *    - Cerrar sesión mediante conteo físico (`countedAmountCents >= 0`), calculando
 *      `Diferencia = Contado - Esperado`, exigiendo observación cuando `Diferencia !== 0` y validando
 *      concurrencia (`expectedSessionVersion` / `expectedBalanceCents`).
 *    - Integración con Punto de Venta (`cash_sale` / `cash_refund`) y Gastos pagados en efectivo.
 * 7. Punto de Venta y Ventas Históricas (Cobro coordinado, Inventario y Caja):
 *    - Exigir una sesión de caja abierta (`openSession.status === 'open'`) en la sucursal y compatibilidad
 *      de moneda entre la sesión activa y el catálogo antes de confirmar cualquier cobro.
 *    - Procesar el cobro en una sola transacción ACID en servidor (`POST /api/organizations/:orgId/branches/:branchId/sales`)
 *      validando idempotencia por `operationId`, precios vigentes, estado activo y stock suficiente con
 *      bloqueo pesimista (`SELECT ... FOR UPDATE`), insertando la venta (`sales`), sus partidas históricas
 *      inmutables (`sale_lines`), el pago (`sale_payments`), las salidas de inventario (`inventory_movements`
 *      tipo `sale_out`) y, si el método es efectivo (`cash`), el movimiento `cash_sale` por el total de la
 *      venta (`totalCents`, no el efectivo recibido `cashReceivedCents`).
 *    - Para pagos manuales con tarjeta (`card`) o transferencia (`transfer`), almacenar referencia opcional
 *      y bandera de verificación externa del operador (`externalVerifiedByOperator = true`) sin incrementar
 *      el efectivo físico esperado en caja.
 *    - Consultar ventas históricas paginadas (`GET /api/organizations/:orgId/branches/:branchId/sales`) y
 *      su detalle inmutable por folio.
 * 8. Cancelaciones completas y Devoluciones de partidas (Reversión, Inventario y Caja):
 *    - Endpoint de cancelación completa (`POST /api/organizations/:orgId/branches/:branchId/sales/:saleId/cancel`):
 *      Valida que la venta no tenga devoluciones previas (`refunded_total_cents === 0`), que la sesión original
 *      de caja continúe abierta (`session.status === 'open'`) y que haya saldo en caja si fue efectivo.
 *      Reingresa el 100% de las partidas al inventario vendible (`sale_return_in`), descuenta efectivo de la sesión
 *      activa si fue `cash` (`cash_refund`), o exige verificación manual externa si fue `card`/`transfer`.
 *      Actualiza la venta a estado `cancelled` y bloquea toda cancelación o devolución posterior.
 *      Exige motivo obligatorio (`reason`) y clave de idempotencia (`operationId`).
 *    - Endpoint de devolución parcial o total (`POST /api/organizations/:orgId/branches/:branchId/sales/:saleId/refund`):
 *      Valida que las cantidades no superen el saldo pendiente por partida (`remaining_returnable_quantity`) ni
 *      el importe neto cobrado. Permite seleccionar destino por partida (`sellable` reingresa con `sale_return_in`,
 *      `unsellable` documenta merma sin sumar stock). Permite devolver productos actualmente inactivos recuperando
 *      existencias sin reactivarlos en catálogo. Calcula reembolsos con redondeo exacto al centavo. Si el método original
 *      fue efectivo, descuenta de la sesión de caja abierta actual sin alterar registros de turnos cerrados anteriores.
 *      Si fue tarjeta o transferencia, no mueve efectivo físico y exige confirmación externa manual del operador.
 *      Actualiza la venta a `partially_refunded` o `fully_refunded`, generando registro inmutable en `sale_returns`.
 *      Exige motivo obligatorio (`reason`) y clave de idempotencia (`operationId`).
 * 9. Resumen del panel (Dashboard):
 *    - Totales del día calculados según la zona horaria del negocio, distinguiendo venta bruta, reembolsos del día
 *      y venta neta. Estado de caja sincronizado con Caja, ventas recientes con badges de estado y alertas de
 *      stock bajo sincronizadas con Inventario.
 * 10. Plantillas de Tickets, Instantáneas inmutables e Impresión térmica (Frontend & Navegador):
 *    - Personalización de tickets por organización (`ticket_configurations`):
 *      Perfil de papel (58 mm u 80 mm), tipo de plantilla (`compact` o `detailed`), tamaño de fuente (`small`,
 *      `normal`, `large`), toggles para mostrar logo, datos fiscales/contacto, cajero, desglose de cambio y
 *      política de devolución, con longitud máxima controlada en encabezado (120 car.) y pie (160 car.).
 *    - Creación de instantáneas inmutables de comprobantes (`ticket_snapshots`):
 *      Al confirmar un cobro en POS (`sale_ticket`), cancelación total (`cancellation_ticket`) o devolución
 *      parcial/total (`refund_ticket`), se genera una instantánea inmutable que captura el perfil comercial,
 *      logotipo duradero, partidas y totales vigentes en el instante exacto de la operación.
 *    - Impresión y reimpresión desde navegador:
 *      Impresión nativa mediante `window.print()` y reglas CSS `@media print` optimizadas para impresoras
 *      térmicas estándar de 58/80 mm en monocromático de alto contraste, ocultando todo el shell de la aplicación.
 *      La reimpresión desde el historial marca visiblemente el comprobante como `*** COPIA / REIMPRESIÓN ***`,
 *      registra una entrada en la bitácora de auditoría (`reprint_audit_trail`) con operador y fecha/hora, y
 *      bajo ninguna circunstancia genera nuevas ventas, movimientos de caja o salidas de inventario.
 *    - Reconstrucción fiel de comprobantes heredados:
 *      Ventas creadas en fases previas sin instantánea previa se reconstruyen fielmente marcadas como
 *      `isReconstructed: true` sin inventar logotipos ni configuraciones inexistentes.
 * 11. Gastos Operativos y Categorías (Egresos, Comprobantes y Desembolso de Caja):
 *    - Registro de egresos clasificados (`POST /api/organizations/:orgId/expenses`):
 *      Exige concepto (3-160 car.), categoría activa, importe en centavos (`amount_cents > 0`),
 *      fecha efectiva (hoy o anterior, bloqueando fechas futuras) y método de pago (`cash`, `card`, `transfer`).
 *    - Desembolso en efectivo atómico: Para método `cash`, exige turno de caja abierto en sucursal con
 *      moneda coincidente y saldo suficiente, registrando simultáneamente el movimiento `expense_out` en caja.
 *    - Métodos no físicos: `card` y `transfer` no alteran la gaveta de caja y almacenan referencia externa comprobable.
 *    - Comprobantes digitales adjuntos: Almacenamiento seguro en blob storage / IndexedDB para imágenes (PNG,
 *      JPEG, WebP) o PDF (máx. 2 MB), bloqueando ejecutables y scripts por seguridad.
 *    - Anulación trazable (`POST /api/organizations/:orgId/expenses/:expenseId/cancel`):
 *      Exige motivo obligatorio y operador. Para gastos en efectivo, exige confirmación de reingreso físico
 *      y genera movimiento compensatorio `expense_cancel_in` en el turno original; se bloquea si el turno ya fue cerrado.
 * 12. Reportes Operativos y Exportación Segura (Ventas, Productos, Gastos y Caja):
 *    - Cuatro reportes analíticos consolidados por período (Ventas, Desplazamiento de Productos, Gastos y Arqueo de Caja).
 *    - Rigor volumétrico: cantidades separadas estrictamente por unidad de medida (sin sumar piezas con kg).
 *    - Principio de corte de caja: nunca sumar saldos finales de sesiones distintas como si fueran ingresos.
 *    - Exportación a CSV segura: sanitización contra inyección de fórmulas (`'`, `="code"`), preservación de
 *      ceros a la izquierda y codificación BOM UTF-8 para Excel en Windows.
 */

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined

export const API_CONFIG = {
  /**
   * URL base pública configurada mediante VITE_API_URL en archivos .env locales.
   * Permanece sin uso de red durante la demostración.
   */
  baseUrl: rawApiUrl ? rawApiUrl.trim().replace(/\/+$/, '') : '',
  isDemoMode: true,
} as const
