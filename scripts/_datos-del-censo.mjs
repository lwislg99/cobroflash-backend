// scripts/_datos-del-censo.mjs — SCRUM-1560
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE CADA RUTA LE CONTESTA AL BANCO DEL CENSO TÁCTIL, CON LA FORMA QUE DA EL SERVIDOR.
//
// Antes, `DATOS` de `censo-objetivo-tactil-panel.mjs` servía ocho rutas y a TODAS las demás les
// devolvía `[]`. Medido el 16-oct-2026 (sonda `docs/master/evidencias/scrum1559/
// sonda-fixture-relleno.mjs`): 28 rutas reales caían en ese relleno, varias de ellas OBJETO en el
// servidor (`/admin/referral`, `/admin/connect/status`, `/admin/metrics/home`…); seis recibían el
// dato de OTRA (`/admin/customers/:n/historial` la lista de clientes, `/admin/jobs/:n/gastos` el
// Trabajo, `/admin/products/frequent-concepts` el catálogo…); y cinco vistas de detalle se montaban
// SIN id (`/admin/jobs/NaN`, `/admin/partes/undefined`). Un banco así mide pantallas que no
// existen: el «undefined» de Referidos que vio S2 lo pintaba el banco, no el producto.
//
// ── UN CONTRATO POR RUTA, Y SU FUENTE AL LADO ────────────────────────────────────────────────
// `forma` y `claves` se copiaron del `res.json` del servidor el 17-oct-2026. `fuente` es el
// fichero del router y `get`, el literal de su `router.get(…)`: se ancla a lo que la ruta ES, no a
// una línea que caduca en cuanto alguien edite por encima (SCRUM-710b; el test comprueba que ese
// literal sigue en ese fichero). `claves` son las de primer nivel que el servidor manda SIEMPRE (las opcionales,
// como `siguiente` o `maintenance`, no se exigen). `dato` las lleva todas; `comprobarForma` lo
// comprueba en CADA respuesta servida, así que un dato que se aparte de su contrato hace caer el
// censo en vez de medir otra pantalla.
//
// 🔴 LO QUE ESTO NO SABE: si el servidor cambia su respuesta, este fichero no se entera. El
//    contrato es una COPIA fechada, no una lectura del servidor; `fuente` está para volver a
//    mirarla. Lo dice también el registro de SCRUM-1560.
//
// ── LA RUTA SIN CONTRATO NO RECIBE RELLENO ───────────────────────────────────────────────────
// `datosDelCenso()` devuelve la función para el banco y la lista de rutas que pidieron algo sin
// contrato. A esas se les contesta `null` (lo que `apiRequest` da ante un 204) y el censo las DICE
// y sale con 2: una pantalla montada con una respuesta inventada no está medida.
//
// ── LO COMPARTIDO, TAMBIÉN CON SU CONTRATO ───────────────────────────────────────────────────
// `CLIENTES_DE_MUESTRA`, `DETALLE_360_DE_MUESTRA` y `TRABAJO_DE_MUESTRA` (de `_pagina-panel.mjs`)
// los usa también `guard-objetivo-tactil`: cambiarlos mueve el guard. En SCRUM-1560 se sirvieron
// tal cual, con `claves` sólo las que ya llevaban y lo que les faltaba declarado aparte. Desde
// SCRUM-1560d tienen la forma del servidor y aquí se exigen sus claves enteras, como a las demás.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } from './_pagina-panel.mjs';

const F = '2026-10-01T09:00:00.000Z';
const CLIENTE = CLIENTES_DE_MUESTRA[0];
// Ids de los detalles: los de los fixtures que ya existían, para que todo hable del MISMO negocio.
export const IDS = Object.freeze({ trabajo: TRABAJO_DE_MUESTRA.id, presupuesto: 11, factura: 21, albaran: 31, parte: 41, gasto: 51 });

const lineaAlbaran = { concepto: 'Sustitución de grifo', unidad: 'ud', cantidad: 1, precioUnitario: 85, tipoIva: 21 };
const job = (id, titulo, status) => ({
  id, status, scheduledAt: F, assignedUserId: null, notes: null, createdAt: F, titulo, tituloPropio: titulo,
  // SCRUM-1560d · `estadoCobro` es 'Pagado' | 'Parcial' | 'Pendiente' (`estadoCobroFor`, con
  // mayúscula) y `tipoOperacion`, uno de `JOB_TIPOS_OPERACION`. Aquí ponía 'pendiente' y 'servicio':
  // la forma cumplía y los valores no existen (la lista no contaba la fila en ningún chip de cobro).
  direccion: 'C/ Mayor 1, Valencia', totalAceptado: 1234.56, totalCobrado: 0, estadoCobro: 'Pendiente',
  importeReferencia: 1234.56, operarioId: null, tipoOperacion: 'TRABAJO_UNICO', nextStage: null, pendingStagesCount: 0,
  hasCustomPlan: false, customer: { id: CLIENTE.id, name: CLIENTE.name, phone: CLIENTE.phone, mobile: null },
  operario: null, asignados: [], quote: { id: IDS.presupuesto, number: 'P-2026-0011', total: 1234.56, currency: 'EUR', paymentTerms: null },
  remaining: { amount: 1234.56, currency: 'EUR' }, albaranes: [], invoices: [],
});
const gasto = (id, concept, amount) => ({
  id, merchantId: 1, quoteId: IDS.presupuesto, providerId: 1, concept, amount, currency: 'EUR', category: 'materiales', date: F,
  notes: null, baseAmount: amount / 1.21, vatRate: 21, vatAmount: amount - amount / 1.21, vatDeducible: true,
  providerInvoiceNumber: null, providerInvoiceDate: null, retencionPracticadaTipo: null, retencionPracticadaCuota: null,
  retencionPracticadaDeclarada: false, teamMemberId: null, createdAt: F, updatedAt: F,
  quote: { id: IDS.presupuesto }, provider: { id: 1, name: 'Proveedor QA' }, tieneFoto: false, job: { id: IDS.trabajo, titulo: 'Reforma de baño' },
});
const factura = (id, number, status) => ({
  id, merchantId: 1, customerId: CLIENTE.id, quoteId: IDS.presupuesto, chargeId: null, customerName: CLIENTE.name,
  customerLegalName: null, customerTaxId: null, customerEmail: CLIENTE.email, customerPhone: CLIENTE.phone,
  merchantName: 'Fontanería Soler', merchantLegalName: null, merchantTaxId: null, merchantAddress: null,
  merchantLogoUrl: null, merchantPhone: null, merchantEmail: null, number, total: '999.99',
  discountGlobalAmount: null, shippingAddress: null, shippingAddressMode: null, tags: [], currency: 'EUR',
  pdfUrl: '/x.pdf', qrData: null, registerId: null, status, paidAt: status === 'paid' ? F : null, paidVia: null,
  clientComment: null, stageLabel: null, lines: [{ description: 'Reparación', quantity: 1, unitPrice: 826.44, vatRate: 21 }],
  suplidos: [], albaranRefs: [], deductsRefs: [], type: 'FULL', rectifiesId: null, vfEstado: null, vfHash: null,
  vfPrevHash: null, vfTimestamp: null, vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
  reminder7SentAt: null, reminder14SentAt: null, createdAt: F,
  customer: { id: CLIENTE.id, name: CLIENTE.name, phone: CLIENTE.phone, email: CLIENTE.email }, quote: { id: IDS.presupuesto },
});
const parteTecnico = {
  id: IDS.parte, jobId: IDS.trabajo, customerId: CLIENTE.id, clienteNombre: CLIENTE.name, numero: 'PT-2026-0041', fecha: F,
  obra: 'C/ Mayor 1', referencia: null, entrada: '09:00', salida: '11:00', desplazamientos: 1, kilometros: 12,
  tecnicos: ['Luis'], tipo: null, notas: '', estado: 'borrador', firmadoAt: null, firmadoPorNombre: null,
  firmadoPorCalidad: null, firmadoTecnicoAt: null, firmadoTecnicoNombre: null, firmoElCliente: false, firmoElTecnico: false,
  firmasCompletas: false, contenidoHash: null, contenidoVersion: 1, puedeEditarContenido: true, puedeEditarPrecios: true,
  lineas: [{ id: 1, bloque: 'material', unds: 1, descripcion: 'Grifo monomando' }],
};
const cuentaCobros = { sent: 4, accepted: 2, rejected: 1, awaiting: 1, invoiced: 2, collected: 1, avgResponseHours: 5 };
const totalesPl = { revenue: 2500, expenses: 900, profit: 1600, maintenance: 0, revenueBase: 2066.12, revenueWithVat: 2500,
  revenueSinDesglose: 0, expensesBase: 743.8, expensesWithVat: 900, expensesSinClasificar: 0, profitBase: 1322.32 };

/**
 * El orden importa: gana la PRIMERA cuya `ruta` casa con el pathname. Por eso las rutas son
 * `^…$` sobre el pathname entero y no un `includes`: `/admin/jobs/1/gastos` ya no puede recibir
 * el Trabajo, ni `/admin/products/frequent-concepts` el catálogo.
 */
export const CONTRATOS = Object.freeze([
  // ── clientes (los fixtures COMPARTIDOS con el guard: forma comprobada, claves las que ya llevan)
  { ruta: /^\/admin\/customers\/\d+\/detail$/, ejemplo: '/admin/customers/1/detail', forma: 'objeto', compartido: true,
    claves: ['customer', 'quotes', 'invoices', 'stats', 'events'],
    elementosDe: { quotes: ['id', 'quoteNumber', 'status', 'total', 'currency', 'createdAt', 'acceptedAt'],
      invoices: ['id', 'number', 'status', 'total', 'currency', 'createdAt', 'paidAt', 'pdfUrl'] },
    fuente: 'src/modules/system/app/routes/customersAdmin.routes.ts', get: '/:id/detail',
    dato: () => DETALLE_360_DE_MUESTRA },
  { ruta: /^\/admin\/customers\/\d+\/historial$/, ejemplo: '/admin/customers/1/historial', forma: 'objeto',
    claves: ['trabajos', 'partesSueltos'], fuente: 'src/modules/system/app/routes/customersAdmin.routes.ts', get: '/:id/historial',
    dato: () => ({ trabajos: [{ id: IDS.trabajo, titulo: TRABAJO_DE_MUESTRA.titulo, estado: 'en_curso', scheduledAt: F, createdAt: F,
      partes: [{ id: IDS.parte, numero: 'PT-2026-0041', fecha: F, estado: 'borrador' }],
      albaranes: [{ id: IDS.albaran, numero: 'A-2026-0031', fecha: F, estado: 'borrador', fotos: 0 }] }], partesSueltos: [] }) },
  { ruta: /^\/admin\/customers\/\d+\/whatsapp$/, ejemplo: '/admin/customers/1/whatsapp', forma: 'objeto',
    claves: ['waOptOut', 'mensajes'], fuente: 'src/modules/system/app/routes/customersAdmin.routes.ts', get: '/:id/whatsapp',
    dato: () => ({ waOptOut: false, mensajes: [{ id: 1, type: 'template', templateName: 'presupuesto_enviado', status: 'delivered',
      error: null, relatedType: 'quote', relatedId: IDS.presupuesto, createdAt: F }] }) },
  { ruta: /^\/admin\/customers$/, ejemplo: '/admin/customers', forma: 'array', compartido: true,
    elemento: ['id', 'merchantId', 'name', 'phone', 'mobile', 'email', 'notes', 'legalName', 'taxId', 'waOptOut', 'createdAt',
      'updatedAt', 'contactKind', 'companyId', 'tipoDestinatario', 'billingPeriodicity', 'recargoEquivalencia', 'dtoPorDefecto',
      'tags', 'billingAddress', 'billingCity', 'billingPostalCode', 'billingProvince', 'billingCountry', 'internalRef'],
    fuente: 'src/modules/system/app/routes/customersAdmin.routes.ts (listCustomers, CUSTOMER_SELECT_NO_TOKEN de src/modules/system/customerAdmin.ts)', get: '/',
    dato: () => CLIENTES_DE_MUESTRA },
  // ── negocio, catálogo
  { ruta: /^\/admin\/merchant$/, ejemplo: '/admin/merchant', forma: 'objeto', claves: ['id', 'name'],
    fuente: 'src/app.ts (claves completas SIN medir: getMerchantProfile no se abrió)', get: '/admin/merchant', dato: () => ({ id: 1, name: 'Fontanería Soler' }) },
  { ruta: /^\/admin\/products\/frequent-concepts$/, ejemplo: '/admin/products/frequent-concepts', forma: 'objeto',
    claves: ['ok', 'items'], elementosDe: { items: ['concepto', 'usos'] }, fuente: 'src/modules/products/app/routes/products.routes.ts', get: '/frequent-concepts',
    dato: () => ({ ok: true, items: [{ concepto: 'Mano de obra', usos: 7 }, { concepto: 'Desplazamiento', usos: 4 }] }) },
  { ruta: /^\/admin\/products$/, ejemplo: '/admin/products', forma: 'objeto', claves: ['ok', 'items'], elementosDe: { items: ['id', 'name', 'price'] },
    fuente: 'scripts/censo-objetivo-tactil-panel.mjs (el que ya servía el censo)',
    dato: () => ({ ok: true, items: [{ id: 1, name: 'Grifo', price: 100, cost: 60, description: '', providerId: null, itemKind: null, active: true }] }) },
  { ruta: /^\/admin\/providers$/, ejemplo: '/admin/providers', forma: 'objeto', claves: ['ok', 'items'],
    fuente: 'scripts/censo-objetivo-tactil-panel.mjs (el que ya servía el censo)',
    dato: () => ({ ok: true, items: [{ id: 1, name: 'Proveedor QA', phone: '', email: '', notes: '' }] }) },
  // Antes `{ plans: [], currentPlan: null, founding: null }`: el servidor NUNCA lo da (lista fija de
  // un plan, `currentPlan` cae a 'trial', `founding` siempre es objeto). La vista pintaba 3 nodos.
  { ruta: /^\/admin\/billing\/plans$/, ejemplo: '/admin/billing/plans', forma: 'objeto', claves: ['currentPlan', 'planExpiresAt', 'plans', 'founding'],
    fuente: 'src/modules/billing/app/routes/subscriptions.routes.ts (founding: getFoundingStatus, src/modules/billing/domain/founding.ts)', get: '/plans',
    dato: () => ({ currentPlan: 'trial', planExpiresAt: '2026-10-31T00:00:00.000Z',
      plans: [{ id: 'pro', label: 'Pro', price: 19.9, priceAnnual: 199, currency: 'EUR' }],
      founding: { price: 9.9, seatsTotal: 20, seatsLeft: 20, taken: 0 } }) },
  // ── albaranes
  { ruta: /^\/admin\/albaranes$/, ejemplo: '/admin/albaranes', forma: 'objeto', claves: ['filas', 'contadores', 'ejes'],
    fuente: 'src/modules/jobs/app/routes/albaranes.routes.ts', get: '/',
    dato: () => ({
      filas: [{ id: IDS.albaran, numero: 'A-2026-0031', fecha: F, emisionAt: F, estado: 'emitido', estadoFacturacion: 'sin_facturar',
        modoValoracion: 'VALORADO', quote: { id: IDS.presupuesto }, clienteId: CLIENTE.id, cliente: CLIENTE.name, jobId: IDS.trabajo,
        trabajo: TRABAJO_DE_MUESTRA.titulo }],
      contadores: { total: 1, porEstado: { emitido: 1 }, porCobro: { sin_facturar: 1 } },
      ejes: { estado: ['borrador', 'emitido', 'firmado'], cobro: ['sin_facturar', 'parcial', 'facturado'] },
    }) },
  { ruta: /^\/admin\/albaranes\/pendientes-facturar$/, ejemplo: '/admin/albaranes/pendientes-facturar', forma: 'objeto',
    claves: ['clientes'], fuente: 'src/modules/jobs/app/routes/albaranes.routes.ts', get: '/pendientes-facturar', dato: () => ({ clientes: [] }) },
  { ruta: /^\/admin\/albaranes\/serie$/, ejemplo: '/admin/albaranes/serie', forma: 'objeto', claves: ['siguiente'],
    fuente: 'src/modules/jobs/app/routes/albaranes.routes.ts', get: '/serie', dato: () => ({ siguiente: 'A-2026-0032' }) },
  { ruta: /^\/admin\/albaranes\/\d+\/fotos$/, ejemplo: '/admin/albaranes/31/fotos', forma: 'array', elemento: ['id', 'url', 'mime', 'createdAt'],
    fuente: 'src/modules/jobs/app/routes/albaranes.routes.ts', get: '/:id/fotos', dato: () => [] },
  { ruta: /^\/admin\/albaranes\/\d+$/, ejemplo: '/admin/albaranes/31', forma: 'objeto',
    claves: ['id', 'jobId', 'numero', 'fecha', 'modoValoracion', 'lineas', 'totales', 'estado', 'version', 'facturado', 'job',
      'customer', 'quote', 'estadoFacturacion', 'enviadoParaFirma', 'cabenMasFotos', 'pendientes'],
    fuente: 'src/modules/jobs/app/routes/albaranes.routes.ts', get: '/:id',
    dato: () => ({
      id: IDS.albaran, jobId: IDS.trabajo, numero: 'A-2026-0031', fecha: F, modoValoracion: 'VALORADO', lineas: [lineaAlbaran],
      totales: { base: 85, cuota: 17.85, total: 102.85 }, estado: 'borrador', version: 1, firmadoAt: null, notas: '', docHeaderText: null,
      ocultarPreciosEnDocumento: false, fechaEntrega: null, lugarEntrega: null, firmadoPorNombre: null, firmadoPorCalidad: null,
      pdfUrl: null, facturado: false, createdAt: F, updatedAt: F,
      job: { id: IDS.trabajo, titulo: TRABAJO_DE_MUESTRA.titulo, direccion: 'C/ Mayor 1, Valencia' },
      customer: { id: CLIENTE.id, name: CLIENTE.name, puedeRecibirWhatsApp: true }, quote: { id: IDS.presupuesto, number: 'P-2026-0011' },
      estadoFacturacion: 'sin_facturar', enviadoParaFirma: false, cabenMasFotos: true, pendientes: [],
    }) },
  // ── trabajos
  { ruta: /^\/admin\/jobs$/, ejemplo: '/admin/jobs', forma: 'array', elemento: ['id', 'status', 'titulo', 'customer', 'quote', 'albaranes', 'invoices'],
    fuente: 'src/modules/jobs/app/routes/jobs.routes.ts', get: '/',
    dato: () => [job(IDS.trabajo, TRABAJO_DE_MUESTRA.titulo, 'en_curso'), job(2, 'Cambio de termo', 'pendiente_agendar')] },
  { ruta: /^\/admin\/jobs\/\d+\/gastos$/, ejemplo: '/admin/jobs/1/gastos', forma: 'objeto', claves: ['gastos'],
    fuente: 'src/modules/jobs/app/routes/jobs.routes.ts', get: '/:id/gastos', dato: () => ({ gastos: [] }) },
  { ruta: /^\/admin\/jobs\/\d+$/, ejemplo: '/admin/jobs/1', forma: 'objeto', compartido: true,
    claves: ['id', 'status', 'scheduledAt', 'assignedUserId', 'notes', 'createdAt', 'titulo', 'tituloPropio', 'direccion',
      'totalAceptado', 'totalCobrado', 'estadoCobro', 'importeReferencia', 'customer', 'operarioId', 'operario', 'asignados',
      'tipoOperacion', 'quote', 'remaining', 'nextStage', 'pendingStagesCount', 'hasCustomPlan', 'albaranes', 'invoices',
      'charge', 'entregaPendiente'],
    fuente: 'src/modules/jobs/app/routes/jobs.routes.ts (serializeJobDetail sobre serializeJob)', get: '/:id',
    dato: () => TRABAJO_DE_MUESTRA },
  // ── partes
  { ruta: /^\/admin\/partes$/, ejemplo: '/admin/partes', forma: 'objeto', claves: ['partes'], elementosDe: { partes: ['id', 'numero', 'estado', 'lineas'] },
    fuente: 'src/modules/jobs/app/routes/partes.routes.ts', get: '/', dato: () => ({ partes: [parteTecnico] }) },
  { ruta: /^\/admin\/partes\/oficina\/pendientes$/, ejemplo: '/admin/partes/oficina/pendientes', forma: 'objeto',
    claves: ['pendientes', 'firmadosLeidos'], elementosDe: { pendientes: ['id', 'numero', 'lineas', 'sinValorar'] },
    fuente: 'src/modules/jobs/app/routes/partes.routes.ts', get: '/oficina/pendientes',
    dato: () => ({ firmadosLeidos: 0, pendientes: [{
      id: IDS.parte, jobId: IDS.trabajo, customerId: CLIENTE.id, clienteNombre: CLIENTE.name, numero: 'PT-2026-0041', fecha: F,
      obra: 'C/ Mayor 1', referencia: null, tipo: null, tecnicos: ['Luis'], notas: '', estado: 'firmado', firmadoAt: F,
      firmadoPorNombre: 'Ana Ruiz', sinValorar: true, totalBase: null, puedeEditarContenido: false, puedeEditarPrecios: true,
      lineas: [{ id: 1, bloque: 'material', unds: 1, descripcion: 'Grifo monomando', precioUnitario: null, tipoIva: null, importe: null }],
    }] }) },
  { ruta: /^\/admin\/partes\/\d+$/, ejemplo: '/admin/partes/41', forma: 'objeto',
    claves: ['id', 'jobId', 'numero', 'fecha', 'estado', 'lineas', 'firmasCompletas', 'puedeEditarContenido', 'puedeEditarPrecios'],
    fuente: 'src/modules/jobs/app/routes/partes.routes.ts', get: '/:id', dato: () => parteTecnico },
  // ── dinero
  { ruta: /^\/admin\/cobros$/, ejemplo: '/admin/cobros', forma: 'array', elemento: ['origen', 'id', 'fecha', 'importe', 'metodoCubo', 'estado'],
    fuente: 'src/modules/billing/app/routes/cobrosAdmin.routes.ts', get: '/',
    dato: () => [{ origen: 'invoice', id: IDS.factura, fecha: F, cliente: CLIENTE.name, concepto: 'F-2026-0021', importe: '999.99',
      moneda: 'EUR', metodo: 'transfer', metodoCubo: 'transferencia', estado: 'paid', referencia: null, numero: 'F-2026-0021',
      tipo: 'FULL', invoiceId: IDS.factura, chargeId: null, correoNoSalio: null }] },
  { ruta: /^\/admin\/connect\/status$/, ejemplo: '/admin/connect/status', forma: 'objeto',
    claves: ['enabled', 'bizumEnabled', 'connectStatus', 'hasStripeAccount', 'bizumPhone', 'hasIban'],
    fuente: 'src/modules/payments/connect/connect.routes.ts', get: '/status',
    dato: () => ({ enabled: false, bizumEnabled: false, connectStatus: 'not_connected', hasStripeAccount: false, bizumPhone: null, hasIban: false }) },
  { ruta: /^\/admin\/invoices$/, ejemplo: '/admin/invoices', forma: 'array', elemento: ['id', 'number', 'status', 'total', 'customer', 'createdAt'],
    fuente: 'src/modules/system/app/routes/invoicesAdmin.routes.ts', get: '/',
    dato: () => [factura(IDS.factura, 'F-2026-0021', 'paid'), factura(22, 'F-2026-0022', 'pending')] },
  { ruta: /^\/admin\/invoices\/\d+$/, ejemplo: '/admin/invoices/21', forma: 'objeto',
    claves: ['id', 'number', 'status', 'total', 'lines', 'merchant', 'customer', 'quote', 'rectifies', 'rectifiedBy', 'demo',
      'waDelivery', 'payToken', 'asignados', 'envioDocumento'],
    fuente: 'src/modules/system/app/routes/invoicesAdmin.routes.ts', get: '/:id',
    dato: () => ({ ...factura(IDS.factura, 'F-2026-0021', 'pending'),
      merchant: { id: 1, name: 'Fontanería Soler', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
      customer: { id: CLIENTE.id, name: CLIENTE.name, phone: CLIENTE.phone, email: CLIENTE.email, notes: CLIENTE.notes },
      quote: null, rectifies: null, rectifiedBy: [], demo: true, waDelivery: null, payToken: null, asignados: [], envioDocumento: null }) },
  { ruta: /^\/admin\/expenses$/, ejemplo: '/admin/expenses', forma: 'objeto', claves: ['ok', 'items'],
    fuente: 'src/modules/expenses/app/routes/expenses.routes.ts', get: '/', dato: () => ({ ok: true, items: [] }) },
  { ruta: /^\/admin\/expenses\/summary$/, ejemplo: '/admin/expenses/summary', forma: 'objeto',
    claves: ['ok', 'month', 'totalAmount', 'unassignedAmount', 'byCategory'], fuente: 'src/modules/expenses/app/routes/expenses.routes.ts', get: '/summary',
    dato: () => ({ ok: true, month: '2026-10', totalAmount: 0, unassignedAmount: 0, byCategory: [] }) },
  { ruta: /^\/admin\/expenses\/margin\/\d+$/, ejemplo: '/admin/expenses/margin/11', forma: 'objeto',
    claves: ['ok', 'revenue', 'totalExpenses', 'margin', 'marginPct', 'currency', 'expenses'], fuente: 'src/modules/expenses/app/routes/expenses.routes.ts', get: '/margin/:quoteId',
    dato: () => ({ ok: true, revenue: 1234.56, totalExpenses: 0, margin: 1234.56, marginPct: 100, currency: 'EUR', expenses: [] }) },
  // SCRUM-1560c · la ficha del gasto (SCRUM-1156c). `item` es la MISMA fila que la lista (`getExpense`
  // y `listExpenses` comparten `CAMPOS_DE_LA_LISTA` + `quote` + `provider`, y `completarFilas` les
  // añade `tieneFoto` y `job`): es `gasto()`. `comprobarForma` sólo mira `ok` e `item`, no lo de dentro.
  // Sin foto, a propósito: con `tieneFoto` la ficha pide `/:id/foto`, que no es JSON.
  { ruta: /^\/admin\/expenses\/\d+$/, ejemplo: '/admin/expenses/51', forma: 'objeto', claves: ['ok', 'item'],
    fuente: 'src/modules/expenses/app/routes/expenses.routes.ts', get: '/:id',
    dato: () => ({ ok: true, item: gasto(IDS.gasto, 'Tubería de cobre', 121) }) },
  { ruta: /^\/admin\/exports\/datos\.zip\/info$/, ejemplo: '/admin/exports/datos.zip/info', forma: 'objeto',
    claves: ['facturas', 'maximo', 'excede'], fuente: 'src/modules/exports/app/routes/exports.routes.ts', get: '/datos.zip/info',
    dato: () => ({ facturas: 2, maximo: 500, excede: false }) },
  // ── presupuestos y solicitudes
  { ruta: /^\/admin\/quotes$/, ejemplo: '/admin/quotes', forma: 'array', elemento: ['id', 'number', 'customerName', 'totalAmount', 'status'],
    fuente: 'src/modules/system/app/routes/quotesAdmin.routes.ts', get: '/',
    dato: () => [{ id: IDS.presupuesto, number: 'P-2026-0011', customerName: CLIENTE.name, customerPhone: CLIENTE.phone, createdAt: F,
      currency: 'EUR', totalAmount: '1234.56', status: 'accepted', method: null, chargeId: null, internalNotes: null, tags: null,
      waDelivery: null, archivedAt: null }] },
  { ruta: /^\/admin\/quotes\/\d+$/, ejemplo: '/admin/quotes/11', forma: 'objeto',
    claves: ['id', 'number', 'status', 'total', 'lines', 'revisiones', 'merchant', 'customer', 'charge', 'invoices', 'decision', 'asignados'],
    fuente: 'src/modules/system/app/routes/quotesAdmin.routes.ts', get: '/:id',
    dato: () => ({
      id: IDS.presupuesto, number: 'P-2026-0011', revision: 1, numeroConRevision: 'P-2026-0011', vigenteId: IDS.presupuesto,
      payToken: null, status: 'sent', createdAt: F, updatedAt: F, archivedAt: null, currency: 'EUR', total: '1234.56',
      discountGlobalAmount: null, docHeaderText: null, docFooterText: null, clausulasExcluidas: [],
      lines: [{ description: 'Reforma de baño', quantity: 1, unitPrice: 1020.3, vatRate: 21 }], pdfUrl: null, signatureUrl: null,
      tiers: null, selectedTierId: null, internalNotes: null, tags: null, billingPlan: null, nextStage: null, hasCustomPlan: false,
      firmaConTrazo: false,
      revisiones: [{ id: IDS.presupuesto, revision: 1, numero: 'P-2026-0011', status: 'sent', firmado: false, total: '1234.56', createdAt: F, vigente: true }],
      merchant: { id: 1, name: 'Fontanería Soler', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
      customer: { id: CLIENTE.id, name: CLIENTE.name, phone: CLIENTE.phone, email: CLIENTE.email, notes: CLIENTE.notes, tieneNumeroDeContacto: true },
      charge: null, invoices: [],
      decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: null, evidence: null },
      waDelivery: null, asignados: [],
    }) },
  { ruta: /^\/admin\/quote-requests$/, ejemplo: '/admin/quote-requests', forma: 'array', elemento: ['id', 'description', 'status', 'customer', 'attachments'],
    fuente: 'src/modules/quoteRequests/app/routes/quoteRequests.routes.ts', get: '/',
    dato: () => [{ id: 1, merchantId: 1, customerId: CLIENTE.id, description: 'Gotea el grifo de la cocina', status: 'pending',
      zone: 'Valencia', source: 'whatsapp', createdAt: F, customer: { id: CLIENTE.id, name: CLIENTE.name, phone: CLIENTE.phone, email: CLIENTE.email },
      attachments: [] }] },
  { ruta: /^\/admin\/templates$/, ejemplo: '/admin/templates', forma: 'array', elemento: ['id', 'name', 'currency', 'lines'],
    fuente: 'src/modules/templates/app/routes/templates.routes.ts', get: '/',
    dato: () => [{ id: 1, name: 'Cambio de grifo', currency: 'EUR', lines: [{ description: 'Grifo', quantity: 1, unitPrice: 85, vatRate: 21 }],
      tiers: null, paymentTerms: null, createdAt: F, updatedAt: F }] },
  { ruta: /^\/admin\/team$/, ejemplo: '/admin/team', forma: 'array', elemento: ['id', 'name', 'role', 'status', 'isOwner', 'resumen'],
    fuente: 'src/modules/team/app/routes/team.routes.ts', get: '/',
    dato: () => [
      { id: null, name: 'Fontanería Soler', email: 'demo@yaqu.app', role: 'admin', status: 'active', isOwner: true, createdAt: null,
        resumen: { presupuestosEnviados: 4, presupuestosAceptados: 2, trabajosAbiertos: 1, trabajosTotales: 2, pendiente: 1234.56 } },
      { id: 2, name: 'Luis Técnico', email: 'tecnico@ejemplo.es', role: 'technician', status: 'active', isOwner: false, createdAt: F,
        resumen: { presupuestosEnviados: 0, presupuestosAceptados: 0, trabajosAbiertos: 1, trabajosTotales: 1, pendiente: 0 } },
    ] },
  { ruta: /^\/admin\/bot\/handoffs$/, ejemplo: '/admin/bot/handoffs', forma: 'array', elemento: ['phone', 'name', 'customerId', 'since', 'context'],
    fuente: 'src/modules/whatsappBot/app/routes/botAdmin.routes.ts', get: '/handoffs', dato: () => [] },
  { ruta: /^\/admin\/referral$/, ejemplo: '/admin/referral', forma: 'objeto',
    claves: ['code', 'link', 'referredCount', 'payingCount', 'freeMonthsEarned'], fuente: 'src/app.ts', get: '/admin/referral',
    dato: () => ({ code: 'SOLER01', link: 'https://yaqu.app/r/SOLER01', referredCount: 0, payingCount: 0, freeMonthsEarned: 0 }) },
  // ── libros e informes
  { ruta: /^\/admin\/libro-registro$/, ejemplo: '/admin/libro-registro', forma: 'objeto',
    claves: ['asientos', 'miradas', 'ajenas', 'sinNumero', 'sinNumeroImporte', 'importesIlegibles'],
    fuente: 'src/modules/invoicing/app/routes/libroRegistro.routes.ts', get: '/',
    dato: () => ({ asientos: [{ numero: 'F-2026-0021', fecha: F, tipo: 'FULL', clienteId: CLIENTE.id, base: 826.44, cuota: 173.55,
      porTipo: [{ tipo: 21, base: 826.44, cuota: 173.55 }], total: 999.99, moneda: 'EUR', estado: 'paid', importeIlegible: false,
      enlaces: { presupuestoId: IDS.presupuesto, presupuestoFirmado: true, albaranes: [], albaranesNoSellados: 0, cobroId: null } }],
      miradas: 1, ajenas: 0, sinNumero: 0, sinNumeroImporte: 0, importesIlegibles: [] }) },
  { ruta: /^\/admin\/libros\/recibidas\.json$/, ejemplo: '/admin/libros/recibidas.json', forma: 'objeto',
    claves: ['filas', 'miradas', 'avisos', 'desde', 'hasta', 'año', 'trimestre'], fuente: 'src/modules/fiscal/librosAeat/librosAeat.routes.ts', get: '/recibidas.json',
    dato: () => ({ filas: [], miradas: 0, avisos: [], desde: '2026-10-01T00:00:00.000Z', hasta: '2026-12-31T23:59:59.999Z', año: 2026, trimestre: 4 }) },
  { ruta: /^\/admin\/metrics\/funnel$/, ejemplo: '/admin/metrics/funnel', forma: 'objeto',
    claves: ['current', 'previous', 'rejectionReasons', 'acceptanceRate'], fuente: 'src/modules/metrics/app/routes/metrics.routes.ts', get: '/funnel',
    dato: () => ({ current: cuentaCobros, previous: cuentaCobros, rejectionReasons: [], acceptanceRate: 50 }) },
  { ruta: /^\/admin\/metrics\/home$/, ejemplo: '/admin/metrics/home', forma: 'objeto',
    claves: ['sparkline', 'avgResponseHours', 'pendingAmount', 'pendingCount', 'quotesAwaiting', 'awaitingAmount', 'collectedThisMonth',
      'expensesThisMonth', 'expensesCount', 'profitThisMonth', 'pendingRequests', 'onboarding', 'weekly', 'recentActivity', 'topCustomers', 'topServices'],
    fuente: 'src/modules/metrics/app/routes/metrics.routes.ts', get: '/home',
    dato: () => ({ sparkline: [0, 1, 0, 2, 1, 0, 1], avgResponseHours: 5, pendingAmount: 1234.56, pendingCount: 1, quotesAwaiting: 1,
      awaitingAmount: 1234.56, collectedThisMonth: 999.99, expensesThisMonth: 0, expensesCount: 0, profitThisMonth: 999.99, pendingRequests: 1,
      onboarding: { precios: true, firma: true, cobro: false },
      weekly: { quotesThisWeek: 1, quotesLastWeek: 2, collectedThisWeek: 0, collectedLastWeek: 999.99 },
      recentActivity: [{ type: 'quote', id: IDS.presupuesto, quoteNumber: 'P-2026-0011', status: 'sent', customer: CLIENTE.name, total: 1234.56, currency: 'EUR', updatedAt: F }],
      topCustomers: [{ customerId: CLIENTE.id, name: CLIENTE.name, invoices: 1, total: 999.99 }], topServices: [{ name: 'Reparación', count: 1, revenue: 999.99 }] }) },
  { ruta: /^\/admin\/metrics\/platform-funnel$/, ejemplo: '/admin/metrics/platform-funnel', forma: 'objeto',
    claves: ['steps', 'paidVia', 'quoteCreatedVia', 'bySource', 'merchants'],
    fuente: 'src/modules/metrics/app/routes/metrics.routes.ts (la del dueño de la plataforma; los demás reciben 403)', get: '/platform-funnel',
    dato: () => ({ steps: { registered: 1, firstQuote: 1, sent: 1, accepted: 1, collected: 1 }, paidVia: {}, quoteCreatedVia: {}, bySource: [], merchants: [] }) },
  { ruta: /^\/admin\/metrics\/services$/, ejemplo: '/admin/metrics/services', forma: 'objeto', claves: ['services'],
    fuente: 'src/modules/metrics/app/routes/metrics.routes.ts', get: '/services',
    dato: () => ({ services: [{ name: 'Reparación', quoted: 2, accepted: 1, acceptanceRate: 50, revenue: 999.99, avgPrice: 999.99 }] }) },
  { ruta: /^\/admin\/metrics\/team$/, ejemplo: '/admin/metrics/team', forma: 'objeto',
    claves: ['hasTeam', 'members', 'inactive', 'sinAsignar', 'totalCollected'], fuente: 'src/modules/metrics/app/routes/metrics.routes.ts', get: '/team',
    dato: () => ({ hasTeam: false, members: [], inactive: [], sinAsignar: null, totalCollected: 999.99 }) },
  { ruta: /^\/admin\/metrics\/whatsapp$/, ejemplo: '/admin/metrics/whatsapp', forma: 'objeto', claves: ['month', 'byTemplate', 'alert', 'channel'],
    fuente: 'src/modules/metrics/app/routes/metrics.routes.ts', get: '/whatsapp',
    dato: () => ({ month: { sent: 4, delivered: 4, read: 3, failed: 0, total: 4, costEur: 0.2 }, byTemplate: [],
      alert: { active: false, deliveryRate7d: null, sample: 0, minimo: 20 }, channel: { templateToday: 0, windowToday: 0, windowMonth: 0, savedEurMonth: 0 } }) },
  { ruta: /^\/admin\/reports\/pl$/, ejemplo: '/admin/reports/pl', forma: 'objeto', claves: ['year', 'currency', 'months', 'totals', 'byEmployee', 'prevYear'],
    fuente: 'src/modules/reports/app/routes/reports.routes.ts', get: '/pl',
    dato: () => ({ year: 2026, currency: 'EUR', months: [{ month: 10, label: 'oct', revenue: 2500, expenses: 900, profit: 1600, maintenance: 0 }],
      totals: totalesPl, byEmployee: [], prevYear: { revenue: 0, expenses: 0, profit: 0 } }) },
  { ruta: /^\/admin\/reports\/x2$/, ejemplo: '/admin/reports/x2', forma: 'objeto',
    claves: ['year', 'byMethod', 'marcadosAMano', 'reminderEur', 'aging', 'pendingTotal'], fuente: 'src/modules/reports/app/routes/reports.routes.ts', get: '/x2',
    dato: () => ({ year: 2026, byMethod: [], marcadosAMano: { count: 0, eur: 0 }, reminderEur: 0, aging: [], pendingTotal: 0 }) },
  { ruta: /^\/admin\/reports\/vat$/, ejemplo: '/admin/reports/vat', forma: 'objeto',
    claves: ['year', 'quarter', 'from', 'to', 'currency', 'rates', 'totals', 'invoiceCount', 'excluded'], fuente: 'src/modules/reports/app/routes/reports.routes.ts', get: '/vat',
    dato: () => ({ year: 2026, quarter: 4, from: '2026-10-01', to: '2026-12-31', currency: 'EUR', rates: [{ rate: 21, base: 826.44, cuota: 173.55 }],
      totals: { base: 826.44, cuota: 173.55 }, invoiceCount: 1, excluded: { count: 0, total: 0 } }) },
  { ruta: /^\/admin\/reports\/resumen-trimestre$/, ejemplo: '/admin/reports/resumen-trimestre', forma: 'objeto',
    claves: ['año', 'trimestre', 'ivaRepercutido', 'ivaSoportado', 'diferencia', 'retenciones', 'borradorParaAsesor', 'from', 'to',
      'facturasSinDesglose', 'invoiceCount', 'expenseCount', 'gastosNoDeducibleDeclarados', 'avisosLibroRecibidas'],
    fuente: 'src/modules/reports/app/routes/reports.routes.ts', get: '/resumen-trimestre',
    dato: () => ({ año: 2026, trimestre: 4,
      ivaRepercutido: { porTipo: [{ tipo: 21, base: 826.44, cuota: 173.55 }], totalBase: 826.44, totalCuota: 173.55 },
      ivaSoportado: { porTipo: [], totalBaseDeducible: 0, totalCuotaDeducible: 0, noDeducible: { count: 0, importe: 0 }, sinClasificar: { count: 0, importe: 0 } },
      diferencia: 173.55, retenciones: { disponible: false, motivo: 'sin_datos' }, borradorParaAsesor: true, from: '2026-10-01', to: '2026-12-31',
      facturasSinDesglose: { count: 0, importe: 0 }, invoiceCount: 1, expenseCount: 0, gastosNoDeducibleDeclarados: 0, avisosLibroRecibidas: [] }) },
]);


/** Las vistas de detalle con el id que el producto les pasa (`renderView` de `app.js`). Sólo para el censo. */
export const ARGUMENTOS_DEL_CENSO = Object.freeze({
  ...ARGUMENTOS_DE_VISTA,
  renderJobDetailView: [IDS.trabajo],
  renderQuoteDetailView: [IDS.presupuesto],
  renderInvoiceDetailView: [IDS.factura],
  renderAlbaranDetailView: [IDS.albaran],
  renderParteDetailView: [IDS.parte],
  renderExpenseDetailView: [IDS.gasto],
});

const tipo = (v) => (Array.isArray(v) ? 'array' : v !== null && typeof v === 'object' ? 'objeto' : typeof v);

/** Los fallos de forma de `valor` frente a su contrato. Vacío = cumple. */
export function comprobarForma(contrato, valor) {
  const r = contrato.ejemplo;
  const t = tipo(valor);
  if (t !== contrato.forma) return [`${r}: el servidor da ${contrato.forma} y aquí sale ${t}`];
  const fallos = [];
  if (t === 'objeto') {
    for (const k of contrato.claves || []) if (!(k in valor)) fallos.push(`${r}: falta \`${k}\``);
    // `{ ok, items }` lo devuelven el catálogo y los conceptos frecuentes: sin mirar DENTRO, uno
    // pasaría por el otro (lo cazó el control de SCRUM-1560 con la respuesta vieja).
    for (const [k, claves] of Object.entries(contrato.elementosDe || {})) {
      if (!Array.isArray(valor[k])) { fallos.push(`${r}: \`${k}\` no es un array`); continue; }
      valor[k].forEach((e, i) => {
        for (const c of claves) if (tipo(e) !== 'objeto' || !(c in e)) fallos.push(`${r}.${k}[${i}]: falta \`${c}\``);
      });
    }
  } else {
    valor.forEach((e, i) => {
      if (tipo(e) !== 'objeto') { fallos.push(`${r}[${i}]: no es un objeto`); return; }
      for (const k of contrato.elemento || []) if (!(k in e)) fallos.push(`${r}[${i}]: falta \`${k}\``);
    });
  }
  return fallos;
}

/** El pathname de lo que pide la vista: `apiRequest` manda rutas, el detalle de factura una URL entera. */
// Sin `new URL`: su error lleva la cadena entera dentro (SCRUM-414), y aquí basta con quitar el
// origen y la consulta.
export const caminoDe = (url) => String(url || '').replace(/^[a-z]+:\/\/[^/]*/i, '').split(/[?#]/)[0];

/** El contrato que contesta a `url`: el PRIMERO que casa, o `null`. */
export const contratoDe = (url) => CONTRATOS.find((c) => c.ruta.test(caminoDe(url))) || null;

/**
 * La función de datos para el banco, y las rutas que pidieron algo SIN contrato.
 * Cada respuesta es una copia (una vista que muta lo recibido no ensucia la siguiente) y se
 * comprueba contra su contrato al servirla: si no cumple, LANZA, y el censo no mide.
 */
export function datosDelCenso() {
  const sinContrato = new Map();
  const servidas = new Map();
  // SCRUM-1560e · cuántas peticiones hizo cada vista. Una que no pide NADA no aparece en ninguno de
  // los dos mapas de arriba, y por eso pasaba por «ninguna ruta sin contrato» sin haber mirado.
  const pedidasPor = new Map();
  let vista = '';
  const datos = (url) => {
    pedidasPor.set(vista, (pedidasPor.get(vista) || 0) + 1);
    const c = contratoDe(url);
    const camino = caminoDe(url).replace(/\d+/g, ':n');
    const anota = (m) => { if (!m.has(camino)) m.set(camino, new Set()); m.get(camino).add(vista); };
    if (!c) { anota(sinContrato); return null; }
    const v = structuredClone(c.dato());
    const fallos = comprobarForma(c, v);
    if (fallos.length) throw new Error(`SCRUM-1560 · el dato de muestra no cumple su contrato: ${fallos.join(' · ')}`);
    anota(servidas);
    return v;
  };
  return { datos, sinContrato, servidas, pedidasDe: (fn) => pedidasPor.get(fn) || 0, enVista: (fn) => { vista = fn; } };
}

// ═══ SCRUM-1560e · CUANDO EL CENSO NO PUEDE MEDIR UNA VISTA, DICE QUÉ AÑADIR Y DÓNDE ══════════
//
// La ficha del gasto entró en `main` (#2545) y el censo la apuntó en «NO MEDIDAS» con «a medias o
// vacía con estos datos». Era falso: se montaba SIN su id, no pedía nada y volvía con el contenedor
// vacío. El resumen del CI sólo daba el número, que pasó de 1 a 2 sin que nadie lo viera.
// Lo que distingue ese caso, medido el 17-oct-2026 sobre las vistas del banco: «no pidió ninguna
// ruta y pintó menos nodos que el suelo». La aridad de la función NO vale: el editor de
// presupuestos y Partes de oficina declaran parámetros opcionales y se montan bien sin ellos.
//
// Aquí sólo se REDACTA el aviso; el censo lo imprime, y no bloquea (decisión del orquestador,
// 17-oct: primero informa y se arreglan los que haya; obligatorio, después y acordado con J).

const FICHERO = 'scripts/_datos-del-censo.mjs';

/** Los parámetros que declara una vista, sin el contenedor ni los valores por defecto. */
export function parametrosDe(f) {
  const m = String(f).match(/^[^(]*\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(',').map((p) => p.split('=')[0].trim()).filter(Boolean).slice(1);
}

/** Una vista que no pidió nada y no llegó al suelo: le falta su entrada en `ARGUMENTOS_DEL_CENSO`. */
export function avisoDeVistaSinPedir(fn, parametros, nodos) {
  const primero = parametros[0] || 'id';
  return `${fn} no le pidió NADA al servidor y pintó ${nodos} nodo(s): se montó sin los argumentos que espera`
    + ` (declara: ${parametros.length ? parametros.join(', ') : 'ninguno además del contenedor'}).`
    + `\n      QUÉ AÑADIR · en ${FICHERO}, dentro de ARGUMENTOS_DEL_CENSO: \`${fn}: [<${primero}>],\``
    + ` con el valor que le pasa \`renderView\` de app.js (un id de IDS si es una ficha).`
    + `\n      Si la ruta que pida entonces no tiene contrato, el censo la dirá en «SIN contrato» con su línea para CONTRATOS.`;
}

/** Una ruta que alguna vista pidió y no tiene contrato: la entrada de `CONTRATOS` que falta, a medio rellenar. */
export function avisoDeRutaSinContrato(camino, vistas) {
  const ruta = camino.split(':n').map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('\\d+');
  const ejemplo = camino.replace(/:n/g, '1');
  return `${camino} ← ${[...vistas].join(', ')}`
    + `\n      QUÉ AÑADIR · en ${FICHERO}, dentro de CONTRATOS (antes de cualquier ruta más general que también case):`
    + `\n      { ruta: /^${ruta}$/, ejemplo: '${ejemplo}', forma: 'objeto' | 'array', claves: [ …las de su res.json… ],`
    + ` fuente: 'src/…/<router>.routes.ts', get: '<literal de su router.get>', dato: () => ({ … }) },`
    + `\n      forma y claves se COPIAN del res.json del servidor; el test de SCRUM-1560 comprueba que el literal del get sigue en su router.`;
}
