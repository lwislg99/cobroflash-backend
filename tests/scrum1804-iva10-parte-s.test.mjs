// tests/scrum1804-iva10-parte-s.test.mjs — SCRUM-1804 (PARTE S de SCRUM-1316, puesto S2, 24-nov-2026)
//
// 🔴 RDL 29/2026, desde el 1-dic-2026: el 10 % en obras de vivienda depende del medio de pago.
// El equipo J dejó en main el servidor y la ficha de factura (SCRUM-1316l, PR #3336/#3334/#3328).
// Esto mide lo que faltaba, en las pantallas de S2 y en el informe:
//   ② el AVISO al elegir el 10 % en el IVA de la línea y en «IVA por defecto» del documento;
//   ③ la ficha del TRABAJO: «¿Cómo lo has cobrado?» obligatorio SOLO con línea al 10 %, T3 si no
//     se elige, T4 al elegir efectivo; y el detalle del trabajo sirviendo lo que la ficha necesita;
//   ④ el informe X2: un cargo NO pagado no manda sobre el método declarado (SCRUM-1316 c.22445).
//
// El texto NO es de este ticket (regla 39): es `window.COPY_IVA_10` de `invoicesView.js` (J1), la
// redacción de SCRUM-1316 c.22424, la única que hay en main (medido el 24-nov, registro SCRUM-1804).
// Aquí se copia SOLO para compararlo byte a byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiere = createRequire(import.meta.url);

/** Las mutaciones que tienen que tumbarme (SCRUM-745). Una por pieza. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/tiposDeIva.js',
    de: 'aviso.hidden = !(texto && avisoIvaAlDiezVisible(select.value));',
    a: 'aviso.hidden = true;',
    cae: 'SCRUM-1804 · ② IVA por defecto · 🔴 al elegir el 10 % sale el aviso firmado, byte a byte; con el 21 % no',
  },
  {
    fichero: 'public/dashboard/js/quotesView.js',
    de: 'window.tiposDeIva.conectarAvisoIvaAlDiez(vatInput, vatTd);',
    a: '',
    cae: 'SCRUM-1804 · ② IVA de la línea · 🔴 al elegir el 10 % sale el aviso firmado, byte a byte; con el 21 % no',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: 'if (conIvaAlDiez && selMetodo && typeof window.metodoElegido === \'function\' && !window.metodoElegido(selMetodo)) {',
    a: 'if (false) {',
    cae: 'SCRUM-1804 · ③ ficha del trabajo · 🔴 con línea al 10 % y sin elegir, «Marcar como PAGADA» dice T3 y no pregunta ni llama',
  },
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: 'conIvaAlDiez: llevaLineaAlDiez(inv.lines),',
    a: 'conIvaAlDiez: false,',
    cae: 'SCRUM-1804 · ③ GET /admin/jobs/:id · 🔴 cada factura dice si lleva línea al 10 % y qué medios avisan',
  },
  {
    fichero: 'src/modules/reports/app/routes/reports.routes.ts',
    de: 'charge: { select: { method: true, status: true } },',
    a: 'charge: { select: { method: true } },',
    cae: 'SCRUM-1804 · ④ X2 · 🔴 un cargo NO pagado no manda sobre el método declarado',
  },
];

const T3 = 'Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.';
const T4 = 'Desde el 1 de diciembre de 2026, el IVA del 10 % en obras de vivienda solo se aplica si el cliente paga con tarjeta, transferencia bancaria, cheque nominativo o ingreso en cuenta. Si cobras en efectivo, consúltalo con tu asesor.';

const AL_10 = [{ concept: 'ZZ reforma baño', qty: 1, price: 100, tax: 0.1 }, { concept: 'ZZ material', qty: 1, price: 50, tax: 0.21 }];
const AL_21 = [{ concept: 'ZZ reparación', qty: 1, price: 100, tax: 0.21 }];

// ═══ ② EL AVISO AL ELEGIR EL 10 % ════════════════════════════════════════════════════════════

async function editor() {
  const banco = cargarDashboard(RAIZ, { datos: (u) => datosDeMuestra(String(u || '')) });
  const r = await pintarVista(banco, 'renderQuotesView');
  assert.equal(r.error, null, `🔴 SUELO: el editor no monta (${r.error && r.error.message})`);
  return { banco, r, body: banco.ctx.document.body };
}

const selects = (c) => todos(c).filter((n) => n.tagName === 'SELECT');
/** El aviso de un selector: el nodo que su `aria-describedby` nombra. Sin él, no hay aviso. */
function avisoDe(sel, raiz) {
  const id = sel.getAttribute && sel.getAttribute('aria-describedby');
  return id ? todos(raiz).find((n) => n._id === id || n.id === id) || null : null;
}

function cambiar(sel, valor) {
  sel.value = valor;
  sel.disparar('change');
}

function comprobarAviso(sel, raiz, que) {
  assert.ok(sel, `🔴 CIEGO: no encuentro el selector de ${que}`);
  cambiar(sel, '21');
  const alVeintiuno = avisoDe(sel, raiz);
  assert.ok(!alVeintiuno || alVeintiuno.hidden === true, `🔴 con el 21 % el ${que} enseña el aviso del 10 %`);
  cambiar(sel, '10');
  const aviso = avisoDe(sel, raiz);
  assert.ok(aviso, `🔴 al elegir el 10 % en ${que} no hay aviso`);
  assert.equal(aviso.hidden, false, `🔴 al elegir el 10 % en ${que} no sale el aviso`);
  assert.equal(aviso.textContent, T4, `🔴 el aviso de ${que} no es el firmado, byte a byte`);
  assert.equal(sel.value, '10', `🔴 el aviso ha cambiado el tipo elegido en ${que}`);
  assert.ok(String(aviso.className).split(/\s+/).includes('alert') && String(aviso.className).split(/\s+/).includes('warning'),
    `🔴 el aviso de ${que} no es el componente de siempre (.alert.warning, AB3)`);
  cambiar(sel, '4');
  assert.equal(aviso.hidden, true, `🔴 con el 4 % sigue a la vista el aviso del 10 % en ${que}`);
}

test('SCRUM-1804 · ② IVA por defecto · 🔴 al elegir el 10 % sale el aviso firmado, byte a byte; con el 21 % no', async () => {
  const { body } = await editor();
  const sel = selects(body).find((n) => n.name === 'vat_default');
  // Al montar (21 %) el aviso NO existe: el editor pinta los mismos nodos que antes (scrum697/698).
  assert.equal(avisoDe(sel, body), null, '🔴 el editor al 21 % ya monta el nodo del aviso');
  comprobarAviso(sel, body, 'IVA por defecto');
});

test('SCRUM-1804 · ② IVA de la línea · 🔴 al elegir el 10 % sale el aviso firmado, byte a byte; con el 21 % no', async () => {
  const { r, body } = await editor();
  // Como el profesional: el IVA de la línea vive en su hoja de ajustes (SCRUM-660, mismo camino).
  const chip = todos(r.contenedor).find((n) => String(n.className || '').includes('quote-line__ajustes'));
  assert.ok(chip && chip.disparar('click') === 1, '🔴 CIEGO: no puedo abrir la hoja de ajustes de la primera línea');
  const deLinea = selects(body).filter((n) => !n.name && n._padre && String(n._padre.className || '').includes('quote-line__vat'));
  assert.ok(deLinea.length > 0, '🔴 CIEGO: el editor no tiene ninguna línea con su selector de IVA');
  comprobarAviso(deLinea[0], body, 'IVA de la línea');
});

test('SCRUM-1804 · ② el aviso sigue al valor puesto por código (borrador, plantilla, suplido), no sólo al clic', () => {
  const { ctx } = cargarDashboard(RAIZ);
  const t = ctx.tiposDeIva;
  const caja = ctx.document.createElement('div');
  const sel = t.montar(21);
  caja.appendChild(sel);
  assert.equal(t.conectarAvisoIvaAlDiez(sel, caja), true, '🔴 conectarAvisoIvaAlDiez no ata el aviso');
  assert.equal(avisoDe(sel, caja), null, '🔴 al 21 % ya hay nodo de aviso');
  t.ponerValor(sel, 10);
  const aviso = avisoDe(sel, caja);
  assert.ok(aviso && aviso.hidden === false, '🔴 un 10 % que llega de un borrador o una plantilla no enseña el aviso');
  t.ponerValor(sel, 0);
  assert.equal(aviso.hidden, true, '🔴 al marcar suplido (0 %) sigue el aviso del 10 %');
  assert.equal(t.conectarAvisoIvaAlDiez(sel, caja), false, '🔴 conectar dos veces se ata dos veces');
  t.ponerValor(sel, 10);
  assert.equal(todos(caja).filter((n) => n.tagName === 'P').length, 1, '🔴 hay más de un aviso en la misma caja');
});

test('SCRUM-1804 · ② sin el texto servido por invoicesView.js NO hay aviso: la pantalla no lo escribe por su cuenta', () => {
  const { ctx } = cargarDashboard(RAIZ);
  ctx.COPY_IVA_10 = undefined; // banco vm: `= undefined`, no `delete` (feedback_delete_desde_fuera_del_vm)
  const caja = ctx.document.createElement('div');
  const sel = ctx.tiposDeIva.montar(10);
  caja.appendChild(sel);
  ctx.tiposDeIva.conectarAvisoIvaAlDiez(sel, caja);
  ctx.tiposDeIva.ponerValor(sel, 10);
  const aviso = avisoDe(sel, caja);
  assert.ok(!aviso || (aviso.hidden === true && (aviso.textContent || '') === ''),
    '🔴 sin COPY_IVA_10 se enseña un aviso vacío o inventado');
});

test('SCRUM-1804 · ② CERO copias del literal: las pantallas de S2 lo piden a COPY_IVA_10, no lo escriben', () => {
  for (const rel of ['public/dashboard/js/tiposDeIva.js', 'public/dashboard/js/quotesView.js', 'public/dashboard/js/jobDetailView.js']) {
    const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    for (const trozo of ['obras de vivienda solo se aplica', 'consúltalo con tu asesor', 'en esta factura hay IVA al 10']) {
      assert.ok(!fuente.includes(trozo), `🔴 SEGUNDA COPIA: ${rel} escribe «${trozo}» en vez de leer window.COPY_IVA_10`);
    }
  }
});

// ═══ ③ LA FICHA DEL TRABAJO ═════════════════════════════════════════════════════════════════

const METODOS = [
  { valor: 'bizum_manual', rotulo: 'Bizum' }, { valor: 'card', rotulo: 'tarjeta' },
  { valor: 'transfer', rotulo: 'transferencia' }, { valor: 'cash', rotulo: 'efectivo' },
];

function trabajoCon(factura) {
  return {
    id: 1804, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'ZZ reforma baño',
    customer: { id: 5, name: 'ZZCLIENTE Ejemplo', phone: null, mobile: null },
    asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
    quote: null, direccion: null, totalAceptado: 160.5, totalCobrado: 0, estadoCobro: 'Pendiente',
    tipoOperacion: 'OPERACIONES_SUELTAS',
    invoices: [{
      id: 91, number: 'F-2026-0091', status: 'pending', type: 'F1', total: 160.5, currency: 'EUR',
      createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: null, payToken: null,
      stageLabel: null, rectifiesId: null, envioDocumento: null,
      ...factura,
    }],
  };
}

async function fichaDelTrabajo(factura, { rol = 'admin', recibido = '160.50' } = {}) {
  const banco = cargarDashboard(RAIZ);
  const job = trabajoCon(factura);
  const llamadas = [];
  const preguntas = [];
  banco.ctx.apiRequest = async (u, o) => {
    llamadas.push({ u: String(u), o: o || {} });
    return o && o.method === 'PUT' ? { ok: true } : job;
  };
  banco.ctx.appUserRole = rol;
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.appMetodosDeclarables = METODOS;
  banco.ctx.confirm = (m) => { preguntas.push(['confirm', m]); return true; };
  banco.ctx.prompt = (m) => { preguntas.push(['prompt', m]); return recibido; };
  const r = await pintarVista(banco, 'renderJobDetailView', 1804);
  assert.equal(r.error, null, `🔴 SUELO: la ficha del trabajo no monta (${r.error && r.error.message})`);
  const body = banco.ctx.document.body;
  const nodos = () => todos(body);
  const sel = nodos().find((n) => n.tagName === 'SELECT' && n._id === 'metodo-cobro-inv-91') || null;
  const boton = nodos().find((n) => n.tagName === 'BUTTON' && String(n.textContent || '').trim() === 'Marcar como PAGADA');
  const puts = () => llamadas.filter((l) => l.o.method === 'PUT' && /\/admin\/invoices\/91\/status$/.test(l.u));
  return { banco, body, nodos, sel, boton, puts, preguntas };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, preventDefault() {}, stopPropagation() {} })));
}

test('SCRUM-1804 · ③ ficha del trabajo · 🔴 con línea al 10 %, «¿Cómo lo has cobrado?» es obligatorio y «efectivo» enseña T4', async () => {
  const f = await fichaDelTrabajo({ conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'] });
  assert.ok(f.sel, '🔴 la factura con línea al 10 % no pinta «¿Cómo lo has cobrado?» en la ficha del trabajo');
  assert.equal(f.sel.required, true, '🔴 con línea al 10 % el selector no es obligatorio');
  const etiqueta = f.nodos().find((n) => n.tagName === 'LABEL' && n.htmlFor === 'metodo-cobro-inv-91');
  assert.equal(etiqueta && etiqueta.textContent, '¿Cómo lo has cobrado?', '🔴 el rótulo no es el de la pieza común (selectorMetodoCobro.js)');
  const aviso = f.nodos().find((n) => n._id === 'metodo-cobro-inv-91-aviso');
  assert.ok(aviso, '🔴 no hay aviso T4 junto al selector');
  assert.equal(aviso.hidden, true, '🔴 T4 sale antes de elegir efectivo');
  cambiar(f.sel, 'cash');
  assert.equal(aviso.hidden, false, '🔴 al elegir «efectivo» no se enseña T4');
  assert.equal(aviso.textContent, T4, '🔴 T4 no es el firmado, byte a byte');
  cambiar(f.sel, 'transfer');
  assert.equal(aviso.hidden, true, '🔴 T4 sigue a la vista con «transferencia»');
});

test('SCRUM-1804 · ③ ficha del trabajo · 🔴 con línea al 10 % y sin elegir, «Marcar como PAGADA» dice T3 y no pregunta ni llama', async () => {
  const f = await fichaDelTrabajo({ conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'] });
  assert.ok(f.boton, '🔴 CIEGO: no encuentro «Marcar como PAGADA»');
  await pulsar(f.boton);
  assert.equal(f.puts().length, 0, '🔴 se ha mandado el PUT sin medio de cobro');
  assert.deepEqual(f.preguntas, [], '🔴 se pregunta confirmación e importe para luego fallar con un 422');
  assert.ok(f.nodos().some((n) => String(n.textContent || '').includes(T3)), '🔴 la ficha del trabajo no enseña T3');
});

test('SCRUM-1804 · ③ ficha del trabajo · con línea al 10 % y medio elegido, el PUT lleva ese paidVia', async () => {
  const f = await fichaDelTrabajo({ conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'] });
  cambiar(f.sel, 'transfer');
  await pulsar(f.boton);
  assert.equal(f.puts().length, 1, '🔴 con medio elegido no sale el PUT');
  assert.deepEqual(JSON.parse(f.puts()[0].o.body), { status: 'paid', paidVia: 'transfer' });
});

test('SCRUM-1804 · ③ ficha del trabajo · POSITIVO: sin línea al 10 % nada cambia (ni selector ni aviso, PUT de siempre)', async () => {
  const f = await fichaDelTrabajo({ conIvaAlDiez: false, metodosConAvisoIvaAlDiez: ['cash'] });
  assert.equal(f.sel, null, '🔴 sin línea al 10 % aparece un selector que no se ha pedido');
  assert.equal(f.nodos().find((n) => n._id === 'metodo-cobro-inv-91-aviso'), undefined);
  assert.ok(f.boton, '🔴 CIEGO: no encuentro «Marcar como PAGADA»');
  await pulsar(f.boton);
  assert.equal(f.puts().length, 1, '🔴 control: sin 10 % el PUT tiene que salir');
  assert.deepEqual(JSON.parse(f.puts()[0].o.body), { status: 'paid' }, '🔴 sin 10 % ha cambiado el cuerpo del PUT');
});

test('SCRUM-1804 · ③ ficha del trabajo · sin `conIvaAlDiez` servido (servidor viejo) se comporta como hoy', async () => {
  const f = await fichaDelTrabajo({});
  assert.equal(f.sel, null);
  await pulsar(f.boton);
  assert.deepEqual(JSON.parse(f.puts()[0].o.body), { status: 'paid' });
});

// ═══ ③ EL DETALLE DEL TRABAJO SIRVE LO QUE LA FICHA NECESITA ════════════════════════════════

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

const MERCHANT_1804 = 41804;
function detalleDelTrabajo(lineasPorFactura) {
  const jobId = 1804, quoteId = 18040;
  const facturas = lineasPorFactura.map((lines, i) => ({
    id: 900 + i, number: `F-2026-090${i}`, total: '160.50', currency: 'EUR', createdAt: new Date(`2026-11-2${i}T10:00:00Z`),
    pdfUrl: null, type: 'F1', status: 'pending', paidAt: null, chargeId: null, stageLabel: null, rectifiesId: null, lines,
  }));
  const presupuesto = {
    id: quoteId, merchantId: MERCHANT_1804, customerId: 5, jobId, chargeId: null, status: 'accepted', total: '160.50',
    currency: 'EUR', lines: AL_10, createdAt: new Date('2026-11-19T10:00:00Z'), discountGlobalAmount: null,
  };
  const doble = dobleDeLaBase({
    'job.findFirst': () => ({ id: jobId, merchantId: MERCHANT_1804, customerId: 5, quoteId, status: 'en_curso', titulo: 'ZZ', createdAt: new Date() }),
    'customer.findUnique': () => ({ id: 5, name: 'ZZCLIENTE', email: null, taxId: null, notes: null, phone: null }),
    'merchant.findUnique': () => ({ id: MERCHANT_1804, country: 'ES', flags: {} }),
    'quote.findUnique': () => ({ ...presupuesto }),
    'quote.findFirst': () => ({ id: quoteId }),
    'quote.findMany': (args) => (args?.select?.Invoice
      ? [{ id: quoteId, charge: null, Invoice: facturas.map((f) => segunSelect(f, args.select.Invoice.select)) }]
      : [{ ...presupuesto }]),
    'jobAssignee.findMany': () => [],
    'albaran.findMany': () => [],
    'albaranLineaFacturada.findMany': () => [],
    'parteTrabajo.findMany': () => [],
    'charge.findMany': () => [],
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
  return entregarA(detalle, reqDeSesion({ rol: 'admin', params: { id: String(jobId) }, merchantId: MERCHANT_1804 }));
}

test('SCRUM-1804 · ③ GET /admin/jobs/:id · 🔴 cada factura dice si lleva línea al 10 % y qué medios avisan', async () => {
  const r = await detalleDelTrabajo([AL_10, AL_21]);
  assert.equal(r.statusCode, 200, `el detalle respondió ${r.statusCode}: ${JSON.stringify(r.cuerpo)}`);
  const [con10, sin10] = r.cuerpo?.invoices ?? [];
  assert.ok(con10 && sin10, '🔴 CIEGO: el detalle no devuelve las dos facturas');
  assert.equal(con10.conIvaAlDiez, true, '🔴 la factura con línea al 10 % no lo dice');
  assert.equal(sin10.conIvaAlDiez, false, '🔴 la factura al 21 % dice que lleva 10 %');
  assert.deepEqual(con10.metodosConAvisoIvaAlDiez, ['cash'], '🔴 no viajan los medios con aviso (los decide el servidor, regla 22)');
  // ADITIVO: lo que ya viajaba sigue igual, y las líneas NO salen (la ficha solo necesita la respuesta).
  for (const k of ['id', 'number', 'total', 'currency', 'createdAt', 'pdfUrl', 'type', 'status', 'paidAt', 'chargeId', 'payToken', 'stageLabel', 'rectifiesId', 'envioDocumento']) {
    assert.ok(k in con10, `🔴 el detalle ha dejado de servir «${k}» (los campos solo se AÑADEN)`);
  }
  assert.equal('lines' in con10, false, '🔴 el detalle del trabajo ha empezado a servir las líneas de la factura');
});

// ═══ ④ EL INFORME X2 ═══════════════════════════════════════════════════════════════════════

async function informeX2(charge) {
  const doble = dobleDeLaBase({
    'invoice.findMany': (args) => {
      if (args?.where?.status !== 'paid') return [];
      const sel = args?.select?.charge?.select || {};
      const fila = { total: 121, paidAt: new Date('2026-11-21T10:00:00Z'), reminder7SentAt: null, reminder14SentAt: null, paidVia: 'cash' };
      return [{ ...fila, charge: charge ? segunSelect(charge, sel) : null }];
    },
  });
  const fPrisma = requiere.resolve(path.join(RAIZ, 'dist/core/db/prisma.js'));
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
  try { delete requiere.cache[requiere.resolve(path.join(RAIZ, 'dist/modules/reports/app/routes/reports.routes.js'))]; } catch { /* */ }
  const x2 = handleDe('dist/modules/reports/app/routes/reports.routes.js', 'get', '/x2');
  const r = await entregarA(x2, reqDeSesion({ rol: 'admin', query: { year: '2026' }, merchantId: MERCHANT_1804 }));
  assert.equal(r.statusCode, 200, `X2 respondió ${r.statusCode}: ${JSON.stringify(r.cuerpo)}`);
  return (r.cuerpo.byMethod || []).map((f) => f.method);
}

test('SCRUM-1804 · ④ X2 · 🔴 un cargo NO pagado no manda sobre el método declarado', async () => {
  const metodos = await informeX2({ method: 'card', status: 'pending' });
  assert.ok(metodos.includes('cash'), `🔴 X2 no cuenta el efectivo declarado: ${JSON.stringify(metodos)}`);
  assert.equal(metodos.some((m) => String(m).startsWith('card')), false,
    `🔴 X2 cuenta como tarjeta un cargo que nunca se pagó: ${JSON.stringify(metodos)}`);
});

test('SCRUM-1804 · ④ X2 · POSITIVO: un cargo PAGADO sigue mandando (el hecho consumado gana)', async () => {
  const metodos = await informeX2({ method: 'card', status: 'paid' });
  assert.ok(metodos.some((m) => String(m).startsWith('card')), `🔴 control: el cargo pagado tiene que mandar: ${JSON.stringify(metodos)}`);
  assert.equal(metodos.includes('cash'), false);
});
