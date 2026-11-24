// tests/scrum1808b-cancelar-cobro-en-ficha-trabajo.test.mjs — SCRUM-1808b (puesto S2, 24-nov-2026)
//
// «Cancelar cobro» en la ficha del TRABAJO. La ficha de factura ya lo tiene (SCRUM-1532d, J1,
// `invoiceDetailView.js`); la del trabajo no podía, porque GET /admin/jobs/:id no servía el estado
// del cobro. Decisión (a) del orquestador, SCRUM-1808 c.22680 (cruce S2→S1, precedente SCRUM-1804):
//   ① SERVIDOR · cada factura del detalle lleva `estadoDelCobro`, el mismo nombre y dato que
//     GET /admin/invoices/:id (`estadoDelCobroDeLaFactura`): el `status` del cobro, o `null`. Aditivo.
//   ② FICHA · el botón sale SOLO con `estadoDelCobro === 'pending'` y sin `paidAt` (cae CERRADO sin
//     el campo), confirma con el literal firmado, hace el POST y repinta; «Cobro cancelado» con el
//     cobro cancelado.
//
// Literales FIRMADOS (SCRUM-1532 c.22430 / c.22455; el del 409 `document_already_paid`, SCRUM-1800
// c.22496 ①). Aquí se copian SOLO para compararlos byte a byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiere = createRequire(import.meta.url);

/** Las mutaciones que tienen que tumbarme (SCRUM-745). Una por pieza. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: "estadoDelCobro: inv.chargeId != null ? (estadoDeCobro.get(inv.chargeId) ?? null) : null,",
    a: "estadoDelCobro: null,",
    cae: 'SCRUM-1808b · ① GET /admin/jobs/:id · 🔴 cada factura dice el estado de SU cobro (pending, paid, cancelled o null)',
  },
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: "const pagados = new Set(cobrosDelTrabajo.filter((c) => c.status === 'paid').map((c) => c.id));",
    a: 'const pagados = new Set(cobrosDelTrabajo.map((c) => c.id));',
    cae: 'SCRUM-1808b · ① GET /admin/jobs/:id · `envioDocumento` sigue siendo SOLO de los cobros pagados',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: "if (inv.chargeId && inv.estadoDelCobro === 'pending' && !inv.paidAt) {",
    a: 'if (inv.chargeId) {',
    cae: 'SCRUM-1808b · ② ficha del trabajo · 🔴 NEGATIVOS: sin cobro `pending` (paid, cancelled, expired, sin campo, con paidAt) no hay botón',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: 'if (!window.confirm(CONFIRMAR_CANCELAR_COBRO)) return;',
    a: '',
    cae: 'SCRUM-1808b · ② ficha del trabajo · 🔴 decir que NO a la confirmación no cancela nada',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: "const pillCobroCancelado = inv.estadoDelCobro === 'cancelled'",
    a: 'const pillCobroCancelado = false',
    cae: 'SCRUM-1808b · ② ficha del trabajo · 🔴 con el cobro cancelado, la fila dice «Cobro cancelado» y no ofrece cancelarlo',
  },
];

const BOTON = 'Cancelar cobro';
const CONFIRMACION = '¿Cancelar este cobro? El cliente ya no podrá pagarlo con este enlace.';
const ETIQUETA = 'Cobro cancelado';
const YA_NO_PENDIENTE = 'Este cobro ya no está pendiente.';
const YA_PAGADO = 'Este documento ya consta como pagado: su cobro no se puede cancelar.';
const GENERICO = 'Error actualizando estado: inténtalo de nuevo';

// ═══ ① EL DETALLE DEL TRABAJO SIRVE EL ESTADO DEL COBRO ══════════════════════════════════════

function doblarModulo(rel, exports) {
  const f = requiere.resolve(path.join(RAIZ, rel));
  requiere.cache[f] = { id: f, filename: f, loaded: true, exports };
}

function handleDe(rel, metodo, camino) {
  const mod = requiere(path.join(RAIZ, rel));
  const router = mod.default || mod;
  const capa = router.stack?.find((c) => c.route?.path === camino && c.route?.methods?.[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${camino} en ${rel}`);
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

async function entregarA(handle, req) {
  let cuerpo = null;
  const res = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(x) { cuerpo = x; return this; },
    setHeader() {}, set() { return this; },
  };
  await handle({ headers: {}, query: {}, ...req }, res, (e) => { if (e) throw e; });
  return { cuerpo, statusCode: res.statusCode };
}

/** Lo que devuelve la base SOLO si el `select` lo pide: un campo no seleccionado no llega. */
function segunSelect(fila, select) {
  if (!select) return { ...fila };
  const out = {};
  for (const [k, v] of Object.entries(select)) if (v === true && k in fila) out[k] = fila[k];
  return out;
}

/** El `where` de un `charge.findMany`, EVALUADO: id ∈ lista, merchant y, si lo pide, status. */
function casaCobro(c, where = {}) {
  if (where.id?.in && !where.id.in.includes(c.id)) return false;
  if (where.merchantId !== undefined && where.merchantId !== c.merchantId) return false;
  if (where.status !== undefined && where.status !== c.status) return false;
  return true;
}

const MERCHANT = 41808;
const OTRO_MERCHANT = 41809;
// Cuatro facturas: cobro pendiente, pagado, cancelado y sin cobro. El cobro 74 es de OTRO negocio
// (regla 2): aunque una factura lo nombre, su estado no puede viajar.
const COBROS = [
  { id: 71, merchantId: MERCHANT, status: 'pending' },
  { id: 72, merchantId: MERCHANT, status: 'paid' },
  { id: 73, merchantId: MERCHANT, status: 'cancelled' },
  { id: 74, merchantId: OTRO_MERCHANT, status: 'pending' },
];
const CHARGE_IDS = [71, 72, 73, null, 74];

async function detalleDelTrabajo() {
  const jobId = 1808, quoteId = 18080;
  const llamadasCharge = [];
  const facturas = CHARGE_IDS.map((chargeId, i) => ({
    id: 800 + i, number: `F-2026-080${i}`, total: '100.00', currency: 'EUR', createdAt: new Date(`2026-11-2${i}T10:00:00Z`),
    pdfUrl: null, type: 'F1', status: chargeId === 72 ? 'paid' : 'pending', paidAt: chargeId === 72 ? new Date('2026-11-23T10:00:00Z') : null,
    chargeId, stageLabel: null, rectifiesId: null, lines: [{ concept: 'ZZ', qty: 1, price: 100, tax: 0.21 }],
  }));
  const presupuesto = {
    id: quoteId, merchantId: MERCHANT, customerId: 5, jobId, chargeId: null, status: 'accepted', total: '500.00',
    currency: 'EUR', lines: [], createdAt: new Date('2026-11-19T10:00:00Z'), discountGlobalAmount: null,
  };
  const doble = dobleDeLaBase({
    'job.findFirst': () => ({ id: jobId, merchantId: MERCHANT, customerId: 5, quoteId, status: 'en_curso', titulo: 'ZZ', createdAt: new Date() }),
    'customer.findUnique': () => ({ id: 5, name: 'ZZCLIENTE', email: 'zz@example.invalid', taxId: null, notes: null, phone: null }),
    'merchant.findUnique': () => ({ id: MERCHANT, country: 'ES', flags: {} }),
    'quote.findUnique': () => ({ ...presupuesto }),
    'quote.findFirst': () => ({ id: quoteId }),
    'quote.findMany': (args) => (args?.select?.Invoice
      ? [{ id: quoteId, charge: null, Invoice: facturas.map((f) => segunSelect(f, args.select.Invoice.select)) }]
      : [{ ...presupuesto }]),
    'jobAssignee.findMany': () => [],
    'albaran.findMany': () => [],
    'albaranLineaFacturada.findMany': () => [],
    'parteTrabajo.findMany': () => [],
    'charge.findMany': (args) => {
      llamadasCharge.push(args);
      return COBROS.filter((c) => casaCobro(c, args?.where)).map((c) => segunSelect(c, args?.select));
    },
    'whatsAppMessage.findMany': () => [],
  });
  const fPrisma = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
  doblarModulo('dist/lib/invoicing.js', { ensureChargeReceiptToken: async () => null, ensureInvoiceForCharge: async () => null });
  for (const m of ['dist/modules/jobs/domain/job.service.js', 'dist/modules/jobs/app/routes/jobs.routes.js',
    'dist/modules/system/invoiceAdmin.js']) {
    try { delete requiere.cache[requiere.resolve(path.join(RAIZ, m))]; } catch { /* aún no existe */ }
  }
  const detalle = handleDe('dist/modules/jobs/app/routes/jobs.routes.js', 'get', '/:id');
  const r = await entregarA(detalle, reqDeSesion({ rol: 'admin', params: { id: String(jobId) }, merchantId: MERCHANT }));
  return { ...r, llamadasCharge };
}

test('SCRUM-1808b · ① GET /admin/jobs/:id · 🔴 cada factura dice el estado de SU cobro (pending, paid, cancelled o null)', async () => {
  const r = await detalleDelTrabajo();
  assert.equal(r.statusCode, 200, `el detalle respondió ${r.statusCode}: ${JSON.stringify(r.cuerpo)}`);
  const inv = r.cuerpo?.invoices ?? [];
  assert.equal(inv.length, 5, '🔴 CIEGO: el detalle no devuelve las cinco facturas');
  const porCobro = Object.fromEntries(inv.map((f) => [String(f.chargeId), f]));
  assert.equal(porCobro['71'].estadoDelCobro, 'pending', '🔴 el cobro pendiente no viaja como `pending`');
  assert.equal(porCobro['72'].estadoDelCobro, 'paid', '🔴 el cobro pagado no viaja como `paid`');
  assert.equal(porCobro['73'].estadoDelCobro, 'cancelled', '🔴 el cobro cancelado no viaja como `cancelled`');
  assert.ok('estadoDelCobro' in porCobro.null && porCobro.null.estadoDelCobro === null, '🔴 una factura sin cobro no dice `null`');
  // Regla 2: el cobro 74 es de otro negocio. Su estado NO puede llegar a esta ficha.
  assert.equal(porCobro['74'].estadoDelCobro, null, '🔴 REGLA 2: viaja el estado de un cobro de OTRO negocio');
  for (const a of r.llamadasCharge) assert.equal(a?.where?.merchantId, MERCHANT, '🔴 REGLA 2: un charge.findMany sin el merchant del trabajo');
});

test('SCRUM-1808b · ① GET /admin/jobs/:id · `envioDocumento` sigue siendo SOLO de los cobros pagados', async () => {
  const r = await detalleDelTrabajo();
  const porCobro = Object.fromEntries((r.cuerpo?.invoices ?? []).map((f) => [String(f.chargeId), f]));
  assert.notEqual(porCobro['72'].envioDocumento, null, '🔴 CONTROL POSITIVO: el cobro pagado ha perdido su `envioDocumento`');
  for (const k of ['71', '73', 'null', '74']) {
    assert.equal(porCobro[k].envioDocumento, null, `🔴 la factura del cobro ${k} (no pagado) trae \`envioDocumento\``);
  }
  // ADITIVO: lo que ya viajaba sigue ahí (los campos solo se AÑADEN) y las líneas NO salen.
  for (const k of ['id', 'number', 'total', 'currency', 'createdAt', 'pdfUrl', 'type', 'status', 'paidAt', 'chargeId',
    'payToken', 'stageLabel', 'rectifiesId', 'envioDocumento', 'conIvaAlDiez', 'metodosConAvisoIvaAlDiez']) {
    assert.ok(k in porCobro['71'], `🔴 el detalle ha dejado de servir «${k}»`);
  }
  assert.equal('lines' in porCobro['71'], false, '🔴 el detalle del trabajo ha empezado a servir las líneas');
});

// ═══ ② LA FICHA DEL TRABAJO ═════════════════════════════════════════════════════════════════

function trabajoCon(factura) {
  return {
    id: 1808, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'ZZ caldera',
    customer: { id: 5, name: 'ZZCLIENTE Ejemplo', phone: '+34600000000', mobile: null },
    asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
    quote: null, direccion: null, totalAceptado: 100, totalCobrado: 0, estadoCobro: 'Pendiente',
    tipoOperacion: 'OPERACIONES_SUELTAS',
    invoices: [{
      id: 81, number: 'F-2026-0081', status: 'pending', type: 'F1', total: 100, currency: 'EUR',
      createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: 77, payToken: 'tok-1808b',
      stageLabel: null, rectifiesId: null, envioDocumento: null,
      ...factura,
    }],
  };
}

async function fichaDelTrabajo(factura, { rol = 'admin', confirma = true, fallo = null } = {}) {
  const banco = cargarDashboard(RAIZ);
  const job = trabajoCon(factura);
  const llamadas = [];
  const preguntas = [];
  banco.ctx.apiRequest = async (u, o) => {
    llamadas.push({ u: String(u), o: o || {} });
    if (o && o.method === 'POST' && /\/cancel$/.test(String(u))) {
      if (fallo) { const e = new Error('fallo'); e.data = fallo; throw e; }
      return { ok: true, status: 'cancelled' };
    }
    return job;
  };
  banco.ctx.appUserRole = rol;
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.confirm = (m) => { preguntas.push(m); return confirma; };
  const r = await pintarVista(banco, 'renderJobDetailView', 1808);
  assert.equal(r.error, null, `🔴 SUELO: la ficha del trabajo no monta (${r.error && r.error.message})`);
  const body = banco.ctx.document.body;
  const nodos = () => todos(body);
  const texto = (n) => String(n.textContent || '').trim();
  // El «⋯» de la fila de la factura: sus acciones solo existen en el DOM con el menú abierto.
  const abrirMenu = async () => {
    const fila = nodos().find((n) => String(n.className || '').includes('jobdet-inv-actions'));
    assert.ok(fila, '🔴 CIEGO: no encuentro la fila de acciones de la factura');
    const kebab = todos(fila).find((n) => String(n.className || '').includes('overflow-trigger'));
    if (kebab) await pulsar(kebab);
  };
  const boton = () => nodos().find((n) => n.tagName === 'BUTTON' && texto(n) === BOTON) || null;
  const posts = () => llamadas.filter((l) => l.o.method === 'POST' && /\/admin\/charges\/77\/cancel$/.test(l.u));
  const lecturas = () => llamadas.filter((l) => !l.o.method && /\/admin\/jobs\/1808$/.test(l.u));
  return { banco, body, nodos, texto, abrirMenu, boton, posts, lecturas, preguntas };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} })));
}

test('SCRUM-1808b · ② ficha del trabajo · 🔴 con el cobro `pending`, «Cancelar cobro» confirma con el literal, hace el POST y repinta', async () => {
  const f = await fichaDelTrabajo({ estadoDelCobro: 'pending' });
  await f.abrirMenu();
  const b = f.boton();
  assert.ok(b, '🔴 con el cobro pendiente la ficha del trabajo no ofrece «Cancelar cobro»');
  const antes = f.lecturas().length;
  await pulsar(b);
  assert.deepEqual(f.preguntas, [CONFIRMACION], '🔴 la confirmación no es la firmada, byte a byte');
  assert.equal(f.posts().length, 1, '🔴 no sale POST /admin/charges/77/cancel');
  assert.ok(f.lecturas().length > antes, '🔴 tras cancelar, la ficha no se repinta (no relee el trabajo)');
});

test('SCRUM-1808b · ② ficha del trabajo · 🔴 decir que NO a la confirmación no cancela nada', async () => {
  const f = await fichaDelTrabajo({ estadoDelCobro: 'pending' }, { confirma: false });
  await f.abrirMenu();
  assert.ok(f.boton(), '🔴 CIEGO: no encuentro «Cancelar cobro»');
  await pulsar(f.boton());
  assert.equal(f.preguntas.length, 1, '🔴 CIEGO: no se ha preguntado');
  assert.equal(f.posts().length, 0, '🔴 con «Cancelar» en la confirmación, el cobro se ha cancelado igual');
});

test('SCRUM-1808b · ② ficha del trabajo · 🔴 NEGATIVOS: sin cobro `pending` (paid, cancelled, expired, sin campo, con paidAt) no hay botón', async () => {
  const casos = [
    ['paid', { estadoDelCobro: 'paid' }],
    ['cancelled', { estadoDelCobro: 'cancelled' }],
    ['expired', { estadoDelCobro: 'expired' }],
    ['sin el campo (servidor viejo)', {}],
    ['null', { estadoDelCobro: null }],
    ['pending con paidAt', { estadoDelCobro: 'pending', paidAt: '2026-11-22T10:00:00.000Z', status: 'sent' }],
    ['pending sin chargeId', { estadoDelCobro: 'pending', chargeId: null }],
  ];
  for (const [nombre, factura] of casos) {
    const f = await fichaDelTrabajo(factura);
    await f.abrirMenu();
    assert.equal(f.boton(), null, `🔴 con el cobro «${nombre}» la ficha ofrece «Cancelar cobro»`);
  }
  // CONTROL POSITIVO del mismo instrumento: con `pending` el botón SÍ aparece.
  const ok = await fichaDelTrabajo({ estadoDelCobro: 'pending' });
  await ok.abrirMenu();
  assert.ok(ok.boton(), '🔴 CONTROL POSITIVO: el instrumento no ve el botón ni con `pending`');
});

test('SCRUM-1808b · ② ficha del trabajo · 🔴 con el cobro cancelado, la fila dice «Cobro cancelado» y no ofrece cancelarlo', async () => {
  const f = await fichaDelTrabajo({ estadoDelCobro: 'cancelled' });
  const pill = f.nodos().find((n) => n.tagName === 'SPAN' && f.texto(n) === ETIQUETA);
  assert.ok(pill, '🔴 con el cobro cancelado la fila no dice «Cobro cancelado»');
  assert.ok(String(pill.className).split(/\s+/).includes('status-pill'), '🔴 «Cobro cancelado» no es una pill del inventario');
  const sinCancelar = await fichaDelTrabajo({ estadoDelCobro: 'pending' });
  assert.equal(sinCancelar.nodos().some((n) => sinCancelar.texto(n) === ETIQUETA), false,
    '🔴 con el cobro pendiente la fila dice «Cobro cancelado»');
});

test('SCRUM-1808b · ② ficha del trabajo · los errores pintan SOLO los literales de la ficha de factura (1532d)', async () => {
  const casos = [
    [{ error: 'charge_not_pending' }, YA_NO_PENDIENTE],
    [{ error: 'document_already_paid' }, YA_PAGADO],
    [{ error: 'internal_error', message: 'TEXTO CRUDO DEL SERVIDOR' }, GENERICO],
  ];
  for (const [fallo, literal] of casos) {
    const f = await fichaDelTrabajo({ estadoDelCobro: 'pending' }, { fallo });
    await f.abrirMenu();
    const b = f.boton();
    assert.ok(b, '🔴 CIEGO: no encuentro «Cancelar cobro»');
    const antes = f.lecturas().length;
    await pulsar(b);
    assert.ok(f.nodos().some((n) => f.texto(n) === literal), `🔴 con ${fallo.error} la ficha no dice «${literal}»`);
    assert.equal(f.nodos().some((n) => String(n.textContent || '').includes('TEXTO CRUDO')), false, '🔴 se pinta el mensaje crudo del servidor');
    assert.equal(f.lecturas().length, antes, '🔴 tras un fallo la ficha se repinta y borra el aviso');
    assert.equal(b.disabled, false, '🔴 tras un fallo el botón se queda deshabilitado');
  }
});

test('SCRUM-1808b · ② ficha del trabajo · el técnico lo VE deshabilitado (SCRUM-89), sin POST', async () => {
  const f = await fichaDelTrabajo({ estadoDelCobro: 'pending' }, { rol: 'tecnico' });
  const b = f.boton();
  assert.ok(b, '🔴 el técnico no ve «Cancelar cobro» (las de dinero se ven deshabilitadas)');
  assert.equal(b.disabled, true, '🔴 el técnico puede pulsar «Cancelar cobro» (la ruta es requireRole(admin))');
});
