# Nedaxoli Control — Frontend (Panel Base, Configuración, Productos, Inventario, Caja, POS, Historial de Ventas y Tickets Térmicos)

Aplicación web frontend de **Nedaxoli Control**, sistema SaaS para pequeños negocios orientado al control de ventas, productos, inventario, turnos de caja, historial transaccional y emisión/reimpresión de tickets térmicos personalizables, con identidad visual, preferencias, catálogos, inventario, sesiones de caja y plantillas de impresión independientes por organización.

## Equipo del proyecto

- **Neftali**: Frontend.
- **Edwin**: Backend.
- **Haniel**: Base de datos.

---

## Requisitos e instalación

1. Contar con **Node.js** instalado (compatible con el entorno de Vite y ESLint).
2. Entrar a la carpeta del proyecto frontend e instalar las dependencias:

```bash
cd nedaxoli-front
npm install
```

3. (Opcional) Crear un archivo `.env` local a partir de `.env.example`:

```bash
cp .env.example .env
```

4. Iniciar el servidor de desarrollo:

```bash
npm run dev
```

---

## Scripts disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo de Vite con recarga en caliente (HMR). |
| `npm run build` | Ejecuta la verificación de tipos con TypeScript (`tsc -b`) y genera el compilado de producción (`vite build`). |
| `npm run lint` | Ejecuta ESLint sobre todos los archivos `.ts` y `.tsx` del proyecto. |
| `npm run preview` | Sirve localmente la compilación generada en `dist/` para pruebas previas. |

> **Nota sobre versiones**: TypeScript se mantiene fijo en `6.0.2` por compatibilidad con `typescript-eslint`. Se utiliza `react-router-dom` para la navegación declarativa por rutas del panel.

---

## Estructura del proyecto

```text
src/
  app/
    App.tsx                           # Conector raíz de la aplicación
    navigation.ts                     # Configuración central de rutas y títulos del panel
    router.tsx                        # Definición de rutas (login, organizaciones, resumen, productos, inventario, configuración y 404)
  components/
    layout/
      AppLayout.tsx                   # Estructura general responsive con soporte de teclado y foco
      Header.tsx                      # Encabezado con sección actual, selector de negocio y salida demo
      MainContent.tsx                 # Contenedor semántico del área principal de trabajo
      Sidebar.tsx                     # Barra lateral fija en escritorio y menú deslizable en móvil
    ui/
      Badge.tsx                       # Etiquetas de estado e indicadores visuales
      BrandMark.tsx                   # Identificador tipográfico provisional de Nedaxoli Control
      Button.tsx                      # Botón reutilizable con variantes y estados de foco
      Card.tsx                        # Tarjeta estructural para paneles y métricas
      EmptyState.tsx                  # Estado vacío reutilizable
      ErrorState.tsx                  # Estado de error con acción de reintento
      Input.tsx                       # Campo de texto con label asociado, ayuda y error accesible
      LoadingState.tsx                # Estado de carga accesible
      NavIcon.tsx                     # Iconografía vectorial SVG interna sin dependencias adicionales
      PageHeader.tsx                  # Encabezado estándar de páginas operativas
  features/
    auth/
      DemoLoginPage.tsx               # Pantalla visual de acceso de demostración (sin autenticación real)
    organizations/
      DemoOrganizationContext.ts      # Contrato del contexto de organización activa
      DemoOrganizationProvider.tsx    # Proveedor de estado, persistencia y tema por organización
      OrganizationAvatar.tsx          # Avatar reutilizable que muestra el logo de sesión o iniciales
      OrganizationSelectPage.tsx      # Pantalla de selección de negocio de demostración
      OrganizationSwitcher.tsx        # Selector rápido de organización con protección de cambios pendientes
    dashboard/
      DashboardSummaryPage.tsx        # Resumen operativo con alertas sincronizadas al inventario activo
      SummaryMetricsGrid.tsx          # Indicadores diarios adaptados a la moneda y fecha activas
      QuickActionsPanel.tsx           # Accesos directos a Punto de venta, Productos, Inventario y Caja
      RecentSalesList.tsx             # Ventas recientes de demostración
      InventoryAlertsList.tsx         # Alertas dinámicas de stock bajo por organización
      PendingModulePage.tsx           # Vista informativa para módulos en preparación
      NotFoundPage.tsx                # Pantalla 404 para rutas inexistentes
    products/
      pages/
        ProductsCatalogPage.tsx       # Página principal de Productos y Categorías por organización
      components/
        ProductsFiltersBar.tsx        # Búsqueda (nombre, SKU, código) y filtros (categoría, estado)
        ProductsTable.tsx             # Tabla responsive de productos con enlace directo a Inventario
        ProductFormPanel.tsx          # Formulario de alta/edición con bloqueo de cambio de unidad si hay kardex
        CategoriesManagerPanel.tsx    # Creación, renombrado y activación/desactivación de categorías
        DeactivateProductModal.tsx    # Confirmación accesible de desactivación con explicación de impacto
      services/
        productsCatalogRepository.ts  # Repositorio reemplazable con persistencia local por organización
      types/
        index.ts                      # Contratos TypeScript de productos, categorías, filtros y borradores
      utils/
        validation.ts                 # Reglas de SKU, códigos con ceros iniciales, precisión monetaria y unidad
        mockCatalog.ts                # Semillas iniciales por organización
    inventory/
      pages/
        InventoryPage.tsx             # Página principal de Inventario (existencias, movimientos, conteo e historial)
      components/
        InventoryFiltersBar.tsx       # Búsqueda por nombre/SKU/código y filtros por categoría y estados
        InventoryTable.tsx            # Tabla responsive de existencias, mínimos, estados y acciones
        InitializeStockPanel.tsx      # Registro único de existencias iniciales por producto y sucursal
        ManualMovementPanel.tsx       # Formulario de entrada manual (+) y salida manual (-) con vista previa
        PhysicalCountPanel.tsx        # Ajuste por conteo físico con cálculo de diferencia y control de concurrencia
        MinStockModal.tsx             # Configuración o eliminación de stock mínimo (diferenciando null de 0)
        MovementsHistoryPanel.tsx     # Historial general y por producto con filtros y orden estable
      services/
        inventoryRepository.ts        # Repositorio atómico (balance + historial), idempotencia y versión
      types/
        index.ts                      # Contratos de balance, movimiento, sucursal, estados y filtros
      utils/
        quantityUtils.ts              # Aritmética decimal controlada (escala 1000), estados y alertas
        mockInventory.ts              # Semillas iniciales vinculadas al catálogo de cada organización
    cash/
      pages/
        CashPage.tsx                  # Página principal de Caja y sesiones de caja (/panel/caja)
      components/
        ActiveSessionStatusPanel.tsx  # Estado actual de caja (cerrada o turno activo, saldos y últimos movimientos)
        OpenCashSessionPanel.tsx      # Formulario de apertura con fondo inicial (>= 0) y moneda fija del turno
        CashManualMovementPanel.tsx   # Registro de entradas (+), retiros (-) y movimientos compensatorios
        CloseCashSessionPanel.tsx     # Arqueo de cierre por conteo físico con cálculo de diferencia y concurrencia
        SessionMovementsPanel.tsx     # Bitácora de movimientos de la sesión con filtros y orden determinista
        SessionsHistoryPanel.tsx      # Historial de sesiones abiertas/cerradas con detalle e inmutabilidad
      services/
        cashRepository.ts             # Repositorio atómico (caja + sesiones + movimientos), idempotencia y versión
      types/
        index.ts                      # Contratos TypeScript de caja, sesión, movimiento, totales y filtros
      utils/
        moneyUtils.ts                 # Aritmética exacta en centavos enteros, moneda histórica y sincronización con Resumen
        mockCash.ts                   # Semillas iniciales de cajas, sesiones cerradas y turno activo por organización
    pos/
      pages/
        PosPage.tsx                   # Mostrador de cobro, escaneo, carrito y liquidación
        SalesHistoryPage.tsx          # Historial de ventas, cancelaciones completas y devoluciones
      components/
        PosCartPanel.tsx              # Carrito en memoria con ajuste de cantidades y vaciado
        PosCheckoutModal.tsx          # Modal de cobro (efectivo, tarjeta, transferencia) con comprobación de caja
        PosReceiptModal.tsx           # Comprobante visual de confirmación de venta con desglose
        SalesHistoryTable.tsx         # Tabla histórica con búsqueda, filtros por periodo/estado/método y paginación
        CancelSaleModal.tsx           # Modal de cancelación completa al 100% con advertencia y motivo
        RefundSaleModal.tsx           # Modal de devolución parcial/total con selector de destino y validación de caja
      services/
        posSalesCoordinator.ts        # Coordinador transaccional unificado (Inventario + Caja + Ventas) e idempotencia
      types/
        index.ts                      # Tipos de venta, partidas, pagos, devoluciones, auditoría y cancelaciones
      utils/
        posMoneyAndQuantityUtils.ts   # Aritmética exacta, redondeo fraccionario, fechas con zona horaria y filtros
    settings/
      OrganizationSettingsPage.tsx    # Pantalla de Configuración con pestañas (Negocio, Apariencia, Preferencias y Tickets)
      BusinessProfileSection.tsx      # Formulario y validación de datos comerciales
      AppearanceSection.tsx           # Personalización de colores, vista previa en vivo y carga de logo
      PreferencesSection.tsx          # Selección de moneda, zona horaria y formato de fecha
      UnsavedChangesModal.tsx         # Modal accesible para proteger cambios pendientes al cambiar de negocio
      colorUtils.ts                   # Validación hexadecimal, cálculo de contraste WCAG y generación de tema
      logoUtils.ts                    # Validación de tipo MIME, tamaño (1.5 MB), decodificación e Object URLs
      formatters.ts                   # Formateadores de moneda, fecha y zona horaria para demostración
      validation.ts                   # Reglas de validación de datos comerciales
    tickets/
      components/
        TicketEditorPanel.tsx         # Editor de tickets con selección de perfil 58/80 mm, plantilla, tipografía y mensajes
        TicketModal.tsx               # Modal accesible para impresión en navegador (window.print()) y atajos de teclado
        TicketViewer.tsx              # Componente de comprobante térmico monocromático de alta fidelidad para 58 mm y 80 mm
      services/
        durableLogoStorage.ts         # Almacenamiento durable en IndexedDB para blobs de logotipos persistentes
        ticketConfigRepository.ts     # Repositorio de configuración por organización con valores predeterminados
        ticketSnapshotService.ts      # Servicio de instantáneas inmutables para ventas, devoluciones y reconstrucción histórica
      styles/
        tickets.css                   # Estilos térmicos y reglas @media print para impresión limpia en rollos de 58/80 mm
      types/
        index.ts                      # Tipos de configuración, instantáneas de comprobante, bitácora de reimpresión y perfiles
      utils/
        ticketFormatting.ts           # Instantánea simulada para vista previa, formateadores de moneda, fecha y títulos
  services/
    api/
      config.ts                       # Punto central de configuración para VITE_API_URL y contratos pendientes
    settings/
      organizationSettingsRepository.ts # Repositorio local reemplazable con validación de esquema
  styles/
    variables.css                     # Tokens de diseño, paleta base y variables dinámicas
    theme.ts                          # Aplicador de variables CSS para el tema de la organización activa
    global.css                        # Estilos base, componentes, tablas y media queries responsive
  types/
    index.ts                          # Interfaces y contratos TypeScript del dominio general
  mocks/
    organizations.ts                  # Organizaciones de demostración con su configuración inicial
    dashboardData.ts                  # Datos de ejemplo por organización para ventas y caja del Resumen
  main.tsx                            # Punto de montaje de React y proveedores principales
```

---

## Alcance de Configuración del negocio y Apariencia (`/panel/configuracion`)

- **Datos del negocio**: edición por organización de nombre comercial obligatorio, teléfono, correo, dirección y sitio web con validación por campo.
- **Apariencia**: selección de color principal y acento con validación hexadecimal (`#RRGGBB`), verificación de contraste WCAG y carga de logotipo de sesión (`PNG`, `JPEG`, `WebP` hasta `1.5 MB`).
- **Preferencias de visualización**: moneda (`MXN`, `USD`, `COP`, `EUR`), zona horaria y formato de fecha aplicados a las vistas operativas sin conversión cambiaria.

---

## Alcance de Productos y Categorías (`/panel/productos`)

- **Catálogo aislado por organización**: consulta, búsqueda por nombre/SKU/código, filtros por categoría y estado, alta, edición, desactivación y reactivación sin borrado físico.
- **Reglas de datos**: SKU único por organización, códigos de barras almacenados como texto (`string[]`) conservando ceros iniciales, precisión monetaria de hasta 2 decimales y diferenciación entre costo desconocido (`null`) y costo cero (`0.00`).
- **Conexión con Inventario**: cada producto incluye acceso directo a su inventario (`/panel/inventario?productId=...`) y no contiene campos editables de existencias dentro del formulario de Productos.

---

## Alcance del Módulo de Inventario (`/panel/inventario`)

### 1. Reglas de unidades y cantidades (`src/features/inventory/utils/quantityUtils.ts`)

- **Reutilización de la unidad del producto**: cada artículo utiliza la unidad definida en el catálogo de Productos.
- **Unidades indivisibles (`pieza`, `paquete`, `caja`, `servicio`)**:
  - Exigen cantidades **enteras exactas** sin decimales. Cualquier entrada con punto decimal (`1.5`, `2.0`) es rechazada explícitamente sin redondear ni truncar en silencio.
- **Unidades divisibles (`kg`, `litro`)**:
  - Admiten cantidades enteras o decimales con una **precisión máxima de 3 cifras decimales** (`0.001 kg = 1 g`, `0.001 L = 1 ml`). Entradas con más de 3 decimales son rechazadas con mensaje claro.
- **Aritmética decimal controlada**:
  - Todos los cálculos de saldo (`initial`, `manual_in`, `manual_out`, `count_adjustment`) operan sobre enteros escalados (`QUANTITY_SCALE = 1000`, `Math.round(valor * 1000)`) para evitar errores acumulados de coma flotante IEEE 754 (por ejemplo, `0.1 + 0.2` produce exactamente `0.3`).
- **Política de stock y signos**:
  - `Entrada manual` y `Salida manual` exigen cantidades estrictamente positivas (`> 0`); el tipo de movimiento determina el signo (`+` o `-`).
  - `Existencia inicial` y `Ajuste por conteo físico` admiten `0` (`>= 0`).
  - **No se permite stock negativo** en esta fase: cualquier salida que supere la existencia disponible es rechazada.
- **Bloqueo de cambio de unidad en Productos con historial**:
  - Si un artículo ya tiene movimientos o balance registrado en Inventario, el formulario de Productos **impide cambiar su unidad de medida** a otra incompatible, explicando que las cantidades históricas no se convierten automáticamente y que para comercializar otra presentación debe liquidarse el saldo actual, desactivar el artículo y dar de alta un nuevo SKU.

### 2. Estados de inventario y mínimos

Para evitar etiquetas contradictorias, cada artículo se clasifica en uno de cuatro estados mutuamente excluyentes:

1. **Sin inicializar (`uninitialized`)**: el producto existe en el catálogo pero aún no tiene registro de existencia inicial en la sucursal (`balance === undefined`). Un producto nuevo creado en Productos inicia siempre en este estado sin asignarle existencias ficticias.
2. **Sin existencias (`out_of_stock`)**: el producto ya fue inicializado y su cantidad confirmada actual es exactamente `0`.
3. **Bajo mínimo (`low_stock`)**: el producto está inicializado, tiene cantidad positiva (`> 0`), cuenta con mínimo configurado (`minStock !== null`) y `quantity <= minStock`.
4. **Disponible (`available`)**: el producto está inicializado, tiene cantidad positiva (`> 0`) y (`minStock === null` o `quantity > minStock`).

En la configuración de **Mínimos**:
- **`Sin mínimo` (`minStock: null`)**: el producto no tiene umbral de alerta configurado.
- **`Mínimo en 0` (`minStock: 0`)**: el producto tiene un umbral configurado explícitamente en cero, diferenciado visual y técnicamente de `null`.
- Modificar o quitar el stock mínimo actualiza las alertas inmediatamente y **no genera movimientos** en el historial de existencias.

### 3. Inicialización, entradas, salidas y ajuste por conteo físico

- **Existencia inicial**:
  - Permite seleccionar un producto sin inicializar, capturar su cantidad inicial (`>= 0`, incluyendo `0`), configurar opcionalmente su mínimo y confirmar explícitamente antes de guardar.
  - Solo se permite inicializar **una vez por producto y sucursal**. Si el producto ya fue inicializado, la interfaz informa su saldo actual y redirige a *Entrada manual* o *Ajuste por conteo físico*.
- **Entrada manual (`+`) y Salida manual (`-`)**:
  - Exigen motivo obligatorio, muestran vista previa con **existencia actual**, **variación** y **existencia resultante**, y requieren confirmación explícita antes de persistir.
  - Las entradas y salidas manuales no representan compras contables ni ventas, y mantienen intactos los indicadores de ventas y efectivo en caja del Resumen.
- **Ajuste por conteo físico**:
  - El operador captura la **cantidad realmente contada** (`>= 0`), nunca un saldo libre sin historial.
  - Muestra: **Existencia registrada**, **Cantidad contada**, **Diferencia calculada (`contado - registrado`)** y **Resultado**.
  - Si la diferencia es `0`, informa que el conteo coincide con el saldo registrado y **no crea un movimiento innecesario**.
  - Si el saldo del producto cambia mientras el formulario está abierto (por otra pestaña o actualización concurrente), el sistema detecta el cambio de versión (`expectedBalanceVersion`), bloquea el guardado directo y **exige al usuario revisar el nuevo saldo registrado** antes de confirmar.

### 4. Tratamiento de productos inactivos

- Un producto desactivado en el catálogo **conserva su saldo e historial de movimientos** en Inventario.
- **No se permiten nuevas entradas manuales** sobre productos inactivos.
- **Sí se permite registrar salidas manuales o ajustes por conteo físico** justificados para depurar o conciliar existencias residuales, así como consultar todo su historial.

### 5. Persistencia de demostración y límites de concurrencia

- El repositorio [`inventoryRepository.ts`](src/features/inventory/services/inventoryRepository.ts) almacena `balances` y `movements` dentro de una **misma unidad de persistencia** por organización y sucursal (`nedaxoli_demo_inventory_v1_<organizationId>_<branchId>`), evitando escrituras parciales donde el saldo cambie sin su movimiento o viceversa.
- Cada operación utiliza un identificador `operationId` para garantizar idempotencia y evitar registros duplicados por doble envío.
- Si ocurre un fallo de almacenamiento en `localStorage`, el estado en memoria y el almacenamiento previo permanecen inalterados y no se muestra una confirmación falsa.
- **Límite de la demostración local**: `localStorage` opera en un solo navegador y no ofrece bloqueos transaccionales reales entre múltiples dispositivos o pestañas simultáneas. Se incluye detección de cambios mediante el evento `storage` y verificación de `balance.version` (`expectedBalanceVersion`), pero el control transaccional definitivo corresponderá a la base de datos y al backend.

---

## Contratos pendientes con Edwin (Backend) y Haniel (Base de datos)

### Con Edwin (Backend)

1. **Consultar existencias por organización y sucursal**:
   - `GET /api/organizations/:orgId/branches/:branchId/inventory` con soporte de búsqueda (`q`), filtros (`categoryId`, `productStatus`, `stockStatus`) y paginación.
2. **Registrar existencia inicial única**:
   - `POST /api/organizations/:orgId/branches/:branchId/inventory/initialize` recibiendo `productId`, `initialQuantity`, `minStock`, `reason`, `reference` y `operationId`, rechazando con `409 Conflict` si el artículo ya fue inicializado en esa sucursal.
3. **Registrar entradas y salidas manuales**:
   - `POST /api/organizations/:orgId/branches/:branchId/inventory/movements` validando pertenencia del producto a la organización, precisión de la unidad del producto, bloqueo de entradas en productos inactivos, suficiencia de stock en salidas e idempotencia por `operationId`.
4. **Registrar ajuste por conteo físico con control de concurrencia**:
   - `POST /api/organizations/:orgId/branches/:branchId/inventory/physical-count` recibiendo `productId`, `countedQuantity`, `expectedBalanceVersion`, `reason`, `reference` y `operationId`. Si `balance.version !== expectedBalanceVersion`, responder `409 Conflict` con el saldo actual para que el usuario revise la nueva diferencia antes de confirmar.
5. **Configurar o quitar stock mínimo**:
   - `PATCH /api/organizations/:orgId/branches/:branchId/inventory/:productId/min-stock` permitiendo establecer un valor `>= 0` acorde a la unidad o `null` (*Sin mínimo*), sin generar movimientos en el kardex.
6. **Consultar historial de movimientos (Kardex)**:
   - `GET /api/organizations/:orgId/branches/:branchId/inventory/movements` con filtros por `productId`, `type` y rango de fechas, ordenado por `(created_at DESC, sequence DESC)`.

### Con Haniel (Base de datos)

1. **Tablas y claves compuestas**:
   - Tabla `inventory_balances` con restricción única `UNIQUE (organization_id, branch_id, product_id)`, columna `quantity NUMERIC(12, 3) NOT NULL CHECK (quantity >= 0)`, `min_stock NUMERIC(12, 3) NULL CHECK (min_stock IS NULL OR min_stock >= 0)` (diferenciando `NULL` de `0.000`) y `version INTEGER NOT NULL DEFAULT 1`.
   - Tabla inmutable `inventory_movements` con claves foráneas hacia organización, sucursal y producto, `sequence BIGINT` incremental, `previous_quantity NUMERIC(12, 3) NULL`, `new_quantity NUMERIC(12, 3) NOT NULL CHECK (new_quantity >= 0)`, `delta NUMERIC(12, 3) NOT NULL` y restricción única `UNIQUE (organization_id, operation_id)` para idempotencia.
2. **Transacciones ACID y bloqueo de fila**:
   - Ejecutar cada movimiento (`initialize`, `manual_in`, `manual_out`, `count_adjustment`) dentro de una transacción `BEGIN ... COMMIT` utilizando `SELECT ... FOR UPDATE` sobre la fila de `inventory_balances` (o inserción única en inicialización) para impedir condiciones de carrera y garantizar que `new_quantity = previous_quantity + delta` se cumpla siempre sin lecturas sucias ni saldos negativos.
3. **Integridad de unidad en productos con historial**:
   - Impedir a nivel de servicio/base de datos la modificación de `products.unit` cuando existan registros asociados en `inventory_movements` o `inventory_balances`.

---

## Módulo de Caja y Sesiones de Caja (`/panel/caja`)

### 1. Modelo de caja, sesión y movimientos

Se distingue explícitamente entre el punto físico de cobro y cada turno operativo:
- **Caja (`CashRegister`)**: punto de cobro asignado a la sucursal de una organización (`reg-pl-01` en *Papelería Luna*, `reg-cf-01` en *Cafetería El Faro*). Si aún no existe registro local, se inicializa de forma controlada una sola vez por organización y sucursal sin duplicarse en cada render.
- **Sesión de caja (`CashSession`)**: turno abierto y cerrado sobre esa caja, con `id` estable, `organizationId`, `branchId`, `registerId`, `openedBy`, `openedAt`, `openingAmountCents`, moneda fija de la sesión (`currency`), `status` (`open` | `closed`), datos de cierre (`closedBy`, `closedAt`, `expectedClosingAmountCents`, `countedAmountCents`, `differenceAmountCents`, `differenceKind`, `closingNote`), `version` para control de concurrencia e identificador de operación (`operationId`).
- **Movimiento de caja (`CashMovement`)**: registro inmutable vinculado a una sesión (`sessionId`), con tipo (`opening_float`, `manual_in`, `manual_out`), importe entero positivo en centavos (`amountCents`), dirección (`in` | `out`), saldo posterior (`balanceAfterCents`), moneda histórica (`currency`), motivo obligatorio (`reason`), referencia opcional (`reference`), banderas de corrección (`isCompensatory`, `compensatedMovementId`), responsable (`operatorName`), fecha (`createdAt`), secuencia determinista (`sequence`) y `operationId`.

### 2. Reglas monetarias, fórmula de saldo esperado y diferencia de cierre

- **Aritmética exacta en centavos enteros**: todos los importes se validan con máximo 2 decimales (rechazando negativos, valores no finitos o más de 2 decimales sin redondear silenciosamente) y se operan internamente como enteros en centavos (`1 unidad = 100 centavos`) para evitar errores de punto flotante.
- **Moneda histórica fija por sesión**: al abrir una sesión se fija `session.currency` con la moneda activa de la organización en ese instante. Un cambio posterior en las preferencias del negocio no convierte ni reetiqueta silenciosamente los importes de esa sesión ni de sesiones históricas cerradas.
- **Fórmula de saldo esperado**:
  $$\text{Saldo esperado} = \text{Fondo inicial} + \text{Entradas manuales} - \text{Retiros manuales}$$
  El fondo inicial (`session.openingAmountCents`) se contabiliza una sola vez; el movimiento informativo `opening_float` nunca duplica el saldo.
- **Fórmula de diferencia al cierre**:
  $$\text{Diferencia} = \text{Efectivo contado} - \text{Saldo esperado}$$
  - `0`: **Sin diferencia** (`exact`) — observación opcional.
  - `> 0`: **Sobrante (`+`)** (`surplus`) — exige explicación obligatoria (`closingNote`).
  - `< 0`: **Faltante (`-`)** (`shortage`) — exige explicación obligatoria (`closingNote`).

### 3. Regla de una sola sesión abierta por caja e inmutabilidad

- **Una sola sesión abierta por caja**: el repositorio y la interfaz impiden abrir una segunda sesión mientras exista una sesión con `status === 'open'` en esa caja.
- **Entradas y retiros manuales**:
  - Solo se permiten con sesión abierta y exigen importe `> 0` y motivo obligatorio.
  - Las entradas manuales (`manual_in`) no se clasifican como ventas.
  - Los retiros manuales (`manual_out`) se rechazan si el importe supera el saldo esperado disponible en caja (`INSUFFICIENT_CASH_BALANCE`) y no crean un gasto contable.
- **Inmutabilidad y movimientos compensatorios**:
  - Los movimientos confirmados no pueden editarse ni eliminarse.
  - Para corregir una captura dentro de una sesión abierta, el operador registra un **movimiento compensatorio** en sentido inverso (`isCompensatory: true`, `compensatedMovementId`), preservando la trazabilidad completa.
  - Las sesiones cerradas son definitivas en esta fase: no aceptan nuevos movimientos, no pueden editarse y su saldo contado no se transfiere automáticamente como fondo inicial de la siguiente sesión.

### 4. Claves de persistencia demo, sincronización con Resumen y límites sin backend

- **Persistencia atómica por organización y sucursal**: se utiliza la clave `nedaxoli_demo_cash_v1_<organizationId>_<branchId>` en `localStorage`, guardando caja, sesiones y movimientos en una sola envoltura verificada. Si ocurre un fallo de escritura, el estado previo permanece intacto.
- **Sincronización con Resumen (`/panel/resumen`)**: el indicador de *Estado de caja* en `DashboardSummaryPage` consume directamente el estado vivo de `defaultCashRepository` mediante `buildDashboardCashRegisterStatus`, mostrando exactamente el mismo saldo esperado, fondo inicial y moneda histórica que `/panel/caja`, sin mezclar las ventas diarias de demostración.
- **Límites sin backend**: `localStorage` es local al navegador y no sustituye transacciones distribuidas multiusuario. Se incluye sincronización entre pestañas mediante el evento `storage`, idempotencia por `operationId` y detección de cambios concurrentes (`expectedSessionVersion` / `expectedBalanceCents`) mientras el formulario de cierre o retiro está abierto.

### 5. Integración futura con Punto de Venta, Ventas y Gastos (Edwin y Haniel)

- **Punto de Venta y Ventas**: los cobros en efectivo registran movimientos `cash_sale` (`+`) por el total de la venta asociados a la sesión abierta activa (`session_id`) dentro de la misma transacción de emisión del comprobante; las devoluciones futuras registrarán `cash_refund` (`-`).
- **Gastos**: cuando un gasto operativo se pague con efectivo de caja, generará su salida vinculada a la sesión abierta; los gastos pagados por transferencia o tarjeta no afectarán el efectivo esperado del cajón.
- **Base de datos (PostgreSQL)**: índice único parcial `CREATE UNIQUE INDEX uq_open_cash_session_per_register ON cash_sessions (organization_id, branch_id, register_id) WHERE status = 'open'` y bloqueo pesimista `SELECT ... FOR UPDATE` sobre la fila de `cash_sessions` al insertar movimientos o ejecutar el cierre.

---

## Módulo de Punto de Venta (`/panel/punto-de-venta`) y Ventas (`/panel/ventas`)

### 1. Modelo de venta, partidas históricas y pago

- **Venta (`SaleRecord`)**: registro inmutable con `id` estable, `folio` consecutivo por organización (`FOL-0001`, `FOL-0002`, ...), `organizationId`, `branchId`, `registerId`, `sessionId`, `operatorName`, `createdAt`, `currency`, `subtotalCents`, `totalCents`, `itemsCount`, `lines`, `payment`, `inventoryMovementIds`, `cashMovementId`, `sequence` y `operationId`.
- **Partida histórica (`SaleLineItem`)**: conserva los datos exactos vigentes al momento de la venta (`productId`, `productName`, `sku`, `barcodeUsed`, `unit`, `quantity`, `unitPriceCents`, `lineSubtotalCents`, `historicalUnitCostCents`, `inventoryMovementId`). Cualquier cambio posterior al nombre, SKU o precio en el catálogo de Productos no altera las ventas históricas.
- **Pago (`SalePaymentRecord`)**: registra un solo método por venta (`cash`, `card` o `transfer`), `currency`, `amountCents` (total de la venta), `cashReceivedCents`, `cashChangeCents`, `externalReference`, `externalVerifiedByOperator` y `cashMovementId`.

### 2. Regla de sesión de caja abierta y moneda de operación

- **Sesión abierta obligatoria para cobrar**: el mostrador permite explorar productos y armar el carrito aun con la caja cerrada, pero bloquea el botón de cobro y ofrece un acceso directo para abrir turno en `/panel/caja`.
- **Integridad de moneda entre sesión, catálogo y venta**: la venta se registra en la moneda fija de la sesión de caja abierta (`openSession.currency`). Si la moneda de la sesión abierta y la moneda base del catálogo (`catalog.baseCurrency`) difieren, el cobro se bloquea con una explicación clara para evitar mezclar o convertir divisas silenciosamente. Cambiar la preferencia visual de moneda en Configuración no reinterpreta los precios existentes del catálogo.

### 3. Escaneo por código de barras y validación de cantidades

- **Lector USB HID en modo teclado y captura manual**: se incluye un campo de escaneo explícito que procesa el código al presionar `Enter` (`preventDefault` / `stopPropagation`) sin enviar otros formularios, sin capturar globalmente todas las teclas de `window` y sin robar el foco cuando el usuario escribe en otros campos. El escaneo se pausa automáticamente mientras el modal de cobro está abierto.
- **Preservación de ceros iniciales**: los códigos se comparan como texto exacto (`'0075010553108'`), nunca convertidos a `Number`. Si el producto ya está en el carrito, un escaneo repetido incrementa su cantidad en la misma partida respetando la existencia disponible.
- **Redondeo explícito por partida**: cada partida calcula su importe en centavos enteros mediante `Math.round((unitPriceCents * scaledQuantity) / 1000)` y el total de la venta es la suma exacta de los importes ya redondeados de sus partidas.

### 4. Reglas de descuento de inventario, ingreso de efectivo y pagos manuales

- **Descuento de inventario (`sale_out`)**: al confirmar la venta, cada partida descuenta `quantity` del balance del producto en la sucursal (`newQuantity = previousQuantity - quantity`) y genera un movimiento de inventario tipo `sale_out` (*Salida por venta (POS)*) referenciado al folio de la venta (`FOL-XXXX`).
- **Cobro en efectivo (`cash`)**: exige `cashReceivedCents >= totalCents`, calcula `cashChangeCents = cashReceivedCents - totalCents` y registra un movimiento `cash_sale` en la sesión de caja abierta por el **total de la venta (`totalCents`)**, nunca por el efectivo recibido.
  $$\text{Saldo esperado en caja} = \text{Fondo inicial} + \text{Ventas en efectivo} + \text{Entradas manuales} - \text{Retiros manuales}$$
- **Pagos manuales con tarjeta (`card`) y transferencia (`transfer`)**: permiten capturar una referencia opcional y exigen confirmación explícita del operador (`externalVerifiedByOperator = true`). No simulan terminal bancaria integrada ni incrementan el efectivo físico esperado en la sesión de caja.

### 5. Persistencia transaccional local, idempotencia y concurrencia

- **Escritura atómica única (`StoredBranchTransactionEnvelope`)**: para evitar que un fallo a mitad del proceso deje ventas parciales o descuentos de inventario huérfanos, `posSalesCoordinator.checkoutSale` prepara en memoria los estados actualizados de Inventario, Caja y Ventas (incrementando `storageRevision`) y los persiste en **una sola llamada `localStorage.setItem`** bajo la clave `nedaxoli_demo_branch_tx_v1_<organizationId>_<branchId>`. Tanto `inventoryRepository` como `cashRepository` leen automáticamente esta instantánea transaccional cuando su revisión es más reciente.
- **Idempotencia (`operationId`) y detección de discrepancias**: si el usuario reintenta confirmar con el mismo `operationId`, el coordinador devuelve la venta original sin duplicar el cobro ni volver a descontar existencias. Si un producto cambió de precio, quedó inactivo o agotó su stock antes de confirmar, se devuelve `CATALOG_OR_STOCK_DISCREPANCY` obligando al cajero a sincronizar y revisar el nuevo total antes de confirmar.

### 6. Módulo de Historial de Ventas, Cancelaciones y Devoluciones (`/panel/ventas`)

#### A. Consulta histórica, filtros avanzados y paginación

- **Filtros combinados**:
  - Búsqueda textual sobre folio (`FOL-XXXX`), nombre de producto, SKU, código de barras utilizado, operador o referencia externa.
  - Periodo operativo evaluado según la zona horaria del negocio (`America/Mexico_City`, `America/Monterrey`, etc.): *Todo el historial*, *Hoy*, *Últimos 7 días* o *Últimos 30 días*.
  - Estado de la venta: *Completada*, *Devuelta parcialmente*, *Devuelta totalmente* o *Cancelada*.
  - Método de cobro original: *Todos*, *Efectivo*, *Tarjeta (manual)* o *Transferencia (manual)*.
- **Paginación determinista**: visualización de 10 ventas por página con controles accesibles de página anterior/siguiente y resumen de registros.
- **Detalle inmutable de venta**: consulta de datos de contexto del momento exacto del cobro (organización, sucursal, caja, código de terminal, operador, sesión original con indicador de estado abierto/cerrado), tabla de partidas vendidas con cantidades originales, acumulado devuelto, saldo disponible, precio unitario histórico y subtotales.

#### B. Reglas de Cancelación Completa

- **Criterios de elegibilidad**:
  - Permitida únicamente si la venta **no tiene devoluciones parciales previas** (`returnsCount === 0` y `refundedTotalCents === 0`).
  - Exige que la **sesión de caja original continúe abierta** (`openSession.id === sale.sessionId`). Si la sesión original ya cerró, el sistema bloquea la cancelación y orienta al operador a utilizar el flujo de Devolución.
  - Si el pago original fue en efectivo, valida que la sesión abierta disponga de saldo suficiente (`expectedBalanceCents >= sale.totalCents`).
- **Impacto de la cancelación**:
  - Reversión del 100% de la venta y transición al estado `cancelled`.
  - Reingreso del 100% de las unidades al inventario vendible de la sucursal mediante movimientos `sale_return_in`.
  - Si fue en efectivo, descuenta el importe de la sesión de caja activa mediante un egreso `cash_refund`.
  - Si fue tarjeta o transferencia, no mueve efectivo físico de caja y exige confirmación manual del operador (`externalVerifiedByOperator = true`) con referencia externa opcional.
  - Exige motivo obligatorio (mínimo 3 caracteres) y queda registrada en la bitácora inmutable de auditoría.
  - Una vez cancelada, se bloquea permanentemente cualquier cancelación posterior o intento de devolución.

#### C. Reglas de Devolución (Parcial o Total)

- **Selección de partidas y cantidades**:
  - Permite devolver una, varias o todas las partidas de la venta, con validación estricta para no exceder la cantidad vendida ni el remanente pendiente por partida (`remainingReturnableQuantity`).
  - Admite devoluciones fraccionarias si la unidad es divisible (`kg`, `litro`), aplicando un cálculo con redondeo exacto al centavo que garantiza que la suma de reembolsos parciales coincida exactamente con el subtotal histórico de la partida al completar el 100%.
- **Destino físico de la mercancía por partida**:
  - **`Reingreso vendible` (`sellable`)**: suma existencias al inventario vendible de la sucursal generando un movimiento `sale_return_in`.
  - **`Merma / No apto` (`unsellable`)**: documenta la pérdida o daño en el historial de la devolución sin incrementar el stock vendible disponible.
- **Reembolso por método original**:
  - Si la venta fue en efectivo, el reembolso se descuenta de una sesión de caja abierta en esa misma sucursal (`cash_refund`). Si la sesión original ya cerró, el efectivo se entrega desde la sesión abierta actual sin alterar los registros históricos del turno cerrado.
  - Si no hay sesión abierta o el saldo disponible no cubre el importe, la operación es bloqueada.
  - Si la venta fue con tarjeta o transferencia, no se mueve efectivo de la caja física y se exige verificación manual del operador.
- **Tratamiento de productos inactivos**:
  - Artículos que fueron desactivados en el catálogo posterior a la venta pueden ser devueltos y recuperar existencias vendibles sin reactivarse automáticamente en el catálogo.

#### D. Conexión con Caja e Inventario

- **Kardex de Inventario**: los reingresos vendibles se registran como `sale_return_in` (*Reingreso por devolución/cancelación (POS)*), referenciados tanto al folio de la venta original (`FOL-XXXX`) como al folio consecutivo de la devolución (`DEV-XXXX`).
- **Sesión de Caja**: los reembolsos en efectivo se clasifican como `cash_refund` (distinguidos de retiros manuales y gastos).
  $$\text{Saldo esperado} = \text{Fondo inicial} + \text{Ventas efectivo} - \text{Reembolsos efectivo} + \text{Entradas manuales} - \text{Retiros manuales}$$
  En el arqueo de cierre, el resumen refleja el total reembolsado en efectivo.

#### E. Persistencia Atómica, Idempotencia y Trazabilidad

- **Instantánea transaccional única (`StoredBranchTransactionEnvelope`)**: toda cancelación o devolución actualiza en una sola llamada atómica `localStorage.setItem` el estado coordinado de Inventario, Caja y Ventas bajo la clave `nedaxoli_demo_branch_tx_v1_<organizationId>_<branchId>`, impidiendo inconsistencias parciales.
- **Idempotencia**: cada acción requiere un identificador único `operationId` para prevenir dobles reembolsos ante dobles clics o reintentos de red.
- **Bitácora de auditoría inmutable**: cada venta conserva la cronología de eventos (`sale_created`, `sale_cancelled`, `sale_returned`) con operador, fecha, folio asociado y notas.

#### F. Resumen operativo (`/panel/resumen`)

- **Ventas del día**: muestra la venta neta del periodo (`Ventas brutas - Reembolsos del día`) calculada en la zona horaria del negocio, sin utilizar el término "utilidad" o "ganancia".
- **Ventas recientes**: incluye etiquetas visuales de estado (*Completada*, *Devuelta parcialmente*, *Devuelta totalmente*, *Cancelada*) e importe neto resultante.

---

## Contratos pendientes con Edwin (Backend) y Haniel (Base de datos) para Ventas y Devoluciones

### Con Edwin (Backend)

1. **Confirmar venta transaccional**: `POST /api/organizations/:orgId/branches/:branchId/sales` recibiendo carrito, sesión de caja y método de pago con clave de idempotencia (`operationId`).
2. **Cancelar venta completa**: `POST /api/organizations/:orgId/branches/:branchId/sales/:saleId/cancel` con validación de sesión abierta, ausencia de devoluciones previas y reversión integral.
3. **Registrar devolución parcial o total**: `POST /api/organizations/:orgId/branches/:branchId/sales/:saleId/refund` recibiendo arreglo de partidas, destino (`sellable` / `unsellable`), motivo, sesión abierta para efectivo o confirmación manual para tarjeta/transferencia.
4. **Consultar historial y detalle**: `GET /api/organizations/:orgId/branches/:branchId/sales` con paginación, filtros por fecha, estado y método.

### Con Haniel (Base de datos)

1. **Tablas relacionales**:
   - `sales`: `id`, `organization_id`, `branch_id`, `register_id`, `session_id`, `folio`, `status` (`completed`, `partially_refunded`, `fully_refunded`, `cancelled`), `total_cents`, `refunded_total_cents`, `net_total_cents`, `created_at`.
   - `sale_lines`: `id`, `sale_id`, `product_id`, `quantity`, `returned_quantity`, `unit_price_cents`, `subtotal_cents`.
   - `sale_returns`: `id`, `sale_id`, `return_folio`, `type` (`cancelation`, `return`), `total_refund_cents`, `reason`, `operator_name`, `created_at`, `operation_id` con restricción `UNIQUE (organization_id, operation_id)`.
   - `sale_return_lines`: `id`, `return_id`, `sale_line_id`, `returned_quantity`, `refund_cents`, `destination` (`sellable`, `unsellable`).
2. **Transacciones ACID**: ejecución con bloqueo pesimista `SELECT ... FOR UPDATE` sobre `sales`, `cash_sessions` e `inventory_balances` para garantizar consistencia atómica y evitar sobre-reembolsos concurrentes.

---

## Módulo: Tickets Personalizables e Impresión Térmica desde Navegador

### 1. Objetivo y Alcance

Permitir configurar, previsualizar, emitir y reimprimir comprobantes térmicos para ventas, cancelaciones completas y devoluciones, con fidelidad tipográfica e independencia por organización:
- **Perfiles de papel térmico**: selección de 58 mm (rollo estándar estrecho) u 80 mm (rollo comercial amplio).
- **Plantillas**: formato `compact` (optimizado para ahorrar papel y lectura rápida) o `detailed` (incluye desglose de códigos SKU/código de barras, importes unitarios e impuestos/subtotales).
- **Tipografía y contrastes**: perfiles de fuente `small`, `normal` y `large` con renderizado monocromático de alto contraste (`#000000` sobre `#ffffff`), tipografía monoespaciada legible y líneas divisorias segmentadas.
- **Campos personalizables con longitud máxima controlada**:
  - Mensaje de cabecera (`headerMessage`): hasta 120 caracteres.
  - Mensaje de pie (`footerMessage`): hasta 160 caracteres.
  - Leyenda / política de devolución (`returnPolicyText`): hasta 240 caracteres.
- **Toggles de visibilidad**: logotipo, datos de contacto/dirección, nombre del cajero/operador, desglose de cambio en efectivo y política de devolución.
- **Persistencia durable de logotipos (`IndexedDB`)**: los blobs de imágenes cargadas se almacenan bajo la base de datos `nedaxoli_durable_logos_db_v1`, garantizando que persistan a través de recargas de página sin exceder la cuota de 5 MB de `localStorage`.
- **Impresión nativa desde navegador (`@media print`)**: utiliza el diálogo nativo `window.print()` con estilos optimizados que ocultan por completo la barra lateral, el encabezado, los botones y el fondo del panel, centrando exclusivamente el comprobante en su ancho milimétrico real (`48mm` útiles para 58 mm y `72mm` útiles para 80 mm).
- **Reimpresión y bitácora de auditoría inmutable**: reimprimir un comprobante desde el historial de ventas añade visiblemente la franja `*** COPIA / REIMPRESIÓN ***` con la fecha/hora en la zona horaria del negocio y el operador que solicitó la copia, registrando una entrada en `reprintAuditTrail` sin alterar la venta, ni el inventario, ni los fondos de caja.
- **Reconstrucción fiel de comprobantes heredados**: las ventas registradas con anterioridad a la incorporación del módulo de tickets se reconstruyen de forma fiel a partir de sus partidas históricas inmutables y se marcan explícitamente con `[Comprobante reconstruido de venta previa al sistema de plantillas]`, sin inventar logotipos ni configuraciones ficticias.
- **Comprobantes de Devolución y Cancelación**: las devoluciones y cancelaciones generan comprobantes dedicados (`refund_ticket` o `cancellation_ticket`) con su folio consecutivo `DEV-XXXX`, partidas reintegradas a inventario o enviadas a merma, y desglose del reembolso entregado.

---

## Revisión y Correcciones Responsivas del Panel

En esta fase se realizó una auditoría y corrección integral de la interfaz en los breakpoints obligatorios (**360px**, **390px**, **768px**, **1280px** y **1440px**), resolviendo de raíz el problema reportado en `/panel/ventas`:

1. **Resolución de la compresión en `/panel/ventas` (Screenshot Reportado)**:
   - **Causa raíz**: la cuadrícula `.sales-history-layout` dividía la pantalla en 2 columnas fijas (`minmax(0, 1.25fr) minmax(320px, 0.95fr)`) en cualquier resolución superior a 1024px. En monitores estándar (1280px-1366px), la columna izquierda solo disponía de ~540px para acomodar una tabla con 9 columnas (Folio, Fecha, Caja/Operador, Totales, Método, Estado, Botón de acción), provocando que los encabezados y celdas se partieran en múltiples líneas ilegibles. Además, `.table-responsive` y `.data-table` no tenían reglas CSS definidas.
   - **Solución implementada**:
     - Se crearon las clases globales `.table-responsive` (`width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;`) y `.data-table` con `min-width: 820px`, bordes limpios y espaciado de celda equilibrado, garantizando que ninguna columna colapse horizontalmente.
     - Se reestructuró `.sales-history-layout` para desplegarse verticalmente en 1 columna amplia por defecto en pantallas portátiles y de escritorio estándar (< 1440px). De este modo, la tarjeta de "Ventas registradas" aprovecha el ancho completo del contenedor (~1000px-1200px), otorgando espacio generoso a las 9 columnas sin quiebres de línea forzados. El "Detalle histórico" se ubica abajo con visibilidad total.
     - Solo en pantallas extra anchas (`@media (min-width: 1440px)`), el layout se divide en 2 columnas (`minmax(0, 1.35fr) minmax(420px, 1fr)`).
2. **Prevención de desbordamiento en diálogos modales**:
   - Se añadió `max-height: min(92vh, 850px); overflow-y: auto;` a `.modal-dialog` para asegurar que modales con mucho contenido (cobro en POS, cancelaciones, devoluciones y tickets) nunca queden cortados en pantallas de baja altura o dispositivos móviles.
3. **Pestañas organizadas en Configuración (`/panel/configuracion`)**:
   - Se sustituyó la pila infinita de formularios por una barra de navegación con pestañas responsivas con scroll horizontal suave (`.settings-tabs-nav`): *Datos comerciales*, *Apariencia y logo*, *Preferencias* y *Tickets y comprobantes*, mejorando radicalmente la ergonomía en dispositivos táctiles y pantallas pequeñas.

---

## Contratos pendientes con Edwin (Backend) y Haniel (Base de datos) para Tickets e Impresión

### Con Edwin (Backend)

1. **Consultar configuración de tickets**: `GET /api/organizations/:orgId/tickets/config`
2. **Actualizar configuración de tickets**: `PUT /api/organizations/:orgId/tickets/config` con validación de longitudes de texto y valores permitidos para plantilla y ancho de papel.
3. **Consultar comprobante inmutable**: `GET /api/organizations/:orgId/tickets/:ticketId` o `GET /api/organizations/:orgId/sales/:saleId/ticket`
4. **Registrar evento de reimpresión**: `POST /api/organizations/:orgId/tickets/:ticketId/reprints` registrando operador, timestamp y motivo sin alterar saldos ni stock.

### Con Haniel (Base de datos)

1. **Tabla `ticket_configurations`**:
   - `id UUID PRIMARY KEY`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `paper_width VARCHAR(10) NOT NULL CHECK (paper_width IN ('58mm', '80mm'))`, `template_kind VARCHAR(20) NOT NULL CHECK (template_kind IN ('compact', 'detailed'))`, `font_size VARCHAR(10) NOT NULL CHECK (font_size IN ('small', 'normal', 'large'))`, `show_logo BOOLEAN NOT NULL DEFAULT true`, `show_address_and_contact BOOLEAN NOT NULL DEFAULT true`, `show_operator_name BOOLEAN NOT NULL DEFAULT true`, `show_cash_change_breakdown BOOLEAN NOT NULL DEFAULT true`, `show_return_policy BOOLEAN NOT NULL DEFAULT true`, `header_message VARCHAR(120)`, `footer_message VARCHAR(160)`, `return_policy_text VARCHAR(240)`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
2. **Tabla `ticket_snapshots`**:
   - `id UUID PRIMARY KEY`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `sale_id UUID REFERENCES sales(id)`, `return_id UUID REFERENCES sale_returns(id)`, `ticket_folio VARCHAR(40) NOT NULL`, `document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('sale_ticket', 'refund_ticket', 'cancellation_ticket'))`, `config_snapshot JSONB NOT NULL`, `business_profile_snapshot JSONB NOT NULL`, `lines_snapshot JSONB NOT NULL`, `total_cents BIGINT NOT NULL`, `currency VARCHAR(10) NOT NULL`, `is_reconstructed BOOLEAN NOT NULL DEFAULT false`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
3. **Tabla `ticket_reprint_audit_logs`**:
   - `id UUID PRIMARY KEY`, `ticket_id UUID NOT NULL REFERENCES ticket_snapshots(id)`, `reprinted_by VARCHAR(100) NOT NULL`, `reason TEXT`, `reprinted_at TIMESTAMPTZ NOT NULL DEFAULT now()`.


---

## Fase: Gastos, Reportes y Resumen Operativo (Implementación Actual)

Se implementó el registro y control de egresos clasificados, la vinculación atómica con las sesiones de caja abierta y el sistema de reportes operativos con exportación segura a CSV.

### 1. Módulo de Gastos Operativos (`features/expenses`)
- **Registro de egresos (`ExpenseFormModal`)**:
  - Concepto (3 a 160 caracteres), Categoría clasificada, Importe monetario exacto en centavos enteros (`amountCents`), Fecha efectiva (restringida a hoy o fechas pasadas; bloqueo de fechas futuras) y Selección de método de pago:
    - **Efectivo en caja (`cash`)**: Requiere obligatoriamente un turno de caja abierto en la sucursal activa con moneda coincidente y saldo disponible suficiente (`availableBalanceCents >= amountCents`). Descuenta de inmediato el efectivo registrando un movimiento de tipo `expense_out`.
    - **Tarjeta comercial (`card`)** y **Transferencia (`transfer`)**: Solicitan folio o referencia externa comprobable por el operador. Se registran en la bitácora operativa sin alterar la gaveta de efectivo físico.
- **Almacenamiento seguro y durable de comprobantes (`IndexedDB`)**:
  - Base de datos local aislada `nedaxoli_expense_attachments_db_v1` para archivar comprobantes digitales en formato PNG, JPEG, WebP o PDF hasta 2 MB.
  - Bloqueo preventivo de ejecutables, scripts (.exe, .sh, .bat) y tipos de archivo con riesgo de inyección (.html, .svg).
  - Previene saturar `localStorage` con cadenas base64 pesadas y revoca las URLs temporales (`URL.revokeObjectURL`) tras el uso para evitar fugas de memoria.
- **Categorías de gastos (`ExpenseCategoriesManagerModal`)**:
  - Creación, edición/renombrado y conmutación de estado activo/inactivo por organización.
  - Validación de nombres únicos (insensible a mayúsculas y espacios).
  - Principio de preservación de histórico: las categorías no se eliminan físicamente para mantener intacta la trazabilidad de los gastos pasados.
- **Anulación trazable (`CancelExpenseModal`)**:
  - Motivo de anulación obligatorio y operador responsable.
  - **Reintegro de efectivo físico**: Para gastos en efectivo, exige la confirmación expresa de que el dinero devuelto fue reingresado físicamente a la gaveta. Genera un movimiento compensatorio de tipo `expense_cancel_in` asociado al movimiento de desembolso original.
  - **Protección de arqueo histórico**: Si el turno de caja original ya fue cerrado y arqueado, se bloquea la anulación automática de efectivo para preservar la fidelidad del corte histórico.

### 2. Módulo de Reportes Operativos (`features/reports`)
- **Reporte A (Ventas y Cobranza)**:
  - Ventas netas acumuladas, cobro bruto, devoluciones y cancelaciones.
  - Desglose por método de cobro (efectivo, tarjeta, transferencia).
  - Desglose por estado de venta (completadas, parciales, reembolsadas, canceladas).
- **Reporte B (Productos Vendidos, Devueltos y Desplazamiento)**:
  - Artículos vendidos y devueltos con cantidades brutas, devueltas y netas.
  - **Rigor volumétrico estricto**: Las cantidades se calculan y presentan por unidad de medida (`pieza`, `kg`, `litro`, etc.). Jamás se combinan unidades incompatibles en un solo total (ej. piezas con kilogramos). Los totales monetarios consolidados se conservan exactos en centavos.
- **Reporte C (Gastos Operativos)**:
  - Gastos netos activos, gastos brutos y gastos anulados.
  - Desglose por categoría con montos netos y cálculo porcentual.
  - Desglose por método de desembolso.
- **Reporte D (Caja, Turnos y Flujo de Efectivo)**:
  - Sesiones y turnos de caja en el período.
  - Fondos iniciales, ventas en efectivo, reembolsos en efectivo, entradas manuales, retiros manuales, gastos en efectivo y reintegros por gastos anulados.
  - Arqueo físico: conteo de efectivo y diferencia acumulada.
  - **Principio contable de corte**: Los saldos finales de sesiones distintas representan balances independientes en el tiempo y nunca se acumulan entre sí como si fueran ingresos.
- **Filtros de Período**:
  - Selector flexible: *Hoy*, *Ayer*, *Esta semana*, *Este mes*, *Todo el historial* o *Rango personalizado de fechas*.
- **Exportación a CSV Segura (`csvExport.ts`)**:
  - **Protección contra Inyección de Fórmulas CSV (CSV Injection)**: Cualquier campo de texto que inicie con caracteres interpretables por hojas de cálculo (`=`, `+`, `-`, `@`, tabulador o retorno) es neutralizado anteponiendo una comilla simple (`'`).
  - **Preservación de ceros iniciales**: Códigos, folios y SKUs (ej. `00049210084`) se exportan con formato de texto preservado (`="00049210084"`).
  - **Codificación con BOM UTF-8**: Incluye `\uFEFF` para compatibilidad nativa inmediata con Microsoft Excel en Windows sin distorsión de caracteres con acentos o letra eñe.
  - Encabezados de metadatos con título del reporte, organización, sucursal, período, moneda, fecha/hora y operador responsable.

### 3. Actualización de Resumen Operativo (`/panel/resumen`)
- Métricas conectadas a los mismos orígenes de datos y reglas de cálculo de Reportes.
- Accesos directos actualizados en `QuickActionsPanel` para Gastos y Reportes.

### 4. Corrección de Emisión de Tickets en Punto de Venta
- Se resolvió el problema reportado en la confirmación de venta de POS (`PosSaleConfirmationView`), integrando la previsualización directa del ticket térmico (`TicketViewer`) y el botón de acción rápida para impresión en un solo clic, alineando correctamente las tablas de importes en vista móvil y escritorio.

---

## Contratos pendientes con Edwin (Backend) y Haniel (Base de datos) para Gastos y Reportes

### Con Edwin (Backend)
1. **Registrar gasto**: `POST /api/organizations/:orgId/expenses` (soporta multipart/form-data para comprobante o JSON con referencia a almacenamiento seguro).
2. **Consultar gastos**: `GET /api/organizations/:orgId/expenses?period=...&categoryId=...&method=...&status=...`
3. **Anular gasto**: `POST /api/organizations/:orgId/expenses/:expenseId/cancel` con payload `{ reason, operatorName, cashReturnedConfirmed }`.
4. **CRUD de categorías de gastos**: `GET /api/organizations/:orgId/expense-categories`, `POST /api/organizations/:orgId/expense-categories`, `PUT /api/organizations/:orgId/expense-categories/:id`.
5. **Endpoints de reportes agregados**:
   - `GET /api/organizations/:orgId/reports/sales?from=...&to=...`
   - `GET /api/organizations/:orgId/reports/products-sold?from=...&to=...`
   - `GET /api/organizations/:orgId/reports/expenses?from=...&to=...`
   - `GET /api/organizations/:orgId/reports/cash?from=...&to=...`

### Con Haniel (Base de datos)
1. **Tabla `expense_categories`**:
   - `id UUID PRIMARY KEY`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `name VARCHAR(60) NOT NULL`, `is_active BOOLEAN NOT NULL DEFAULT true`, `is_default BOOLEAN NOT NULL DEFAULT false`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE(organization_id, LOWER(name))`.
2. **Tabla `expenses`**:
   - `id UUID PRIMARY KEY`, `folio VARCHAR(30) NOT NULL`, `organization_id UUID NOT NULL REFERENCES organizations(id)`, `branch_id UUID NOT NULL REFERENCES branches(id)`, `category_id UUID NOT NULL REFERENCES expense_categories(id)`, `concept VARCHAR(160) NOT NULL`, `amount_cents BIGINT NOT NULL CHECK (amount_cents > 0)`, `currency VARCHAR(10) NOT NULL`, `payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer'))`, `expense_date DATE NOT NULL`, `registered_by VARCHAR(100) NOT NULL`, `external_reference VARCHAR(120)`, `attachment_storage_key VARCHAR(255)`, `cash_session_id UUID REFERENCES cash_sessions(id)`, `cash_movement_id UUID REFERENCES cash_movements(id)`, `status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled'))`, `cancellation_reason TEXT`, `cancelled_by VARCHAR(100)`, `cancelled_at TIMESTAMPTZ`, `cancel_cash_movement_id UUID REFERENCES cash_movements(id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `operation_id VARCHAR(64) NOT NULL UNIQUE`.
