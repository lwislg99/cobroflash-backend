// tests/scrum1805-congelar-desde-presupuesto.test.mjs — SCRUM-1805 (puntos 2 y 3, S1)
//
// LA FACTURA QUE NACE DE UN PRESUPUESTO CONGELA SUS OBSERVACIONES Y SUS FORMAS DE PAGO.
// GO nominal: SCRUM-1656 c.22782. Decisiones de fondo: SCRUM-1787 c.22345 (② el pie pasa, la
// cabecera no; ⑤ «5-Sí»: también en cada factura por tramos; ④ la R1 NO las hereda), c.22404 y
// c.22429 (las formas: la lista del presupuesto, o las activas), 1787l (la columna `Invoice.docFooterText`).
//
// LOS CINCO CAMINOS:
//   #1 C3  POST /admin/quotes/:id/invoice           (quotesAdmin.routes.ts)  crearFacturaEmitida
//   #2 C4  POST /admin/quotes/:id/invoice-manual    (quotesAdmin.routes.ts)  crearFacturaEmitida
//   #3 C1  POST /quote/:token/decision              (quotes.routes.ts)       crearFacturaEmitida
//   #4 C2  POST /admin/jobs/:id/collect-rest        (jobs.routes.ts)         crearFacturaEmitida
//   #5 C7  POST /admin/albaranes/:id/convertir-en-factura (albaranes.routes.ts) emitInvoice
//
// QUÉ SE EJECUTA Y QUÉ NO (A10, dicho antes de que nadie lo crea de más):
//   · De cada camino se lee por AST, en el fuente de HOY, el objeto que la ruta le pasa a la emisión
//     (el 4.º argumento de `crearFacturaEmitida`, el 2.º de `emitInvoice`). Ese objeto se TRANSPILA y se
//     EVALÚA con las variables que la ruta tiene en ese punto, y lo evaluado se emite con la emisión DE
//     VERDAD (`dist/`) sobre el banco con estado (`_banco-emision-con-estado.mjs`). Se lee la fila escrita.
//   · El manejador NO se monta entero: sus puertas previas (firma del cliente, token, cobro, WhatsApp,
//     casación del albarán) no son lo que este ticket cambia, y cada una tiene su test. Lo que une el
//     objeto evaluado con la ruta es que sale del MISMO fuente, encontrado por la ruta y el verbo.
//   · Que el presupuesto del manejador traiga los campos: en #1–#4 se lee con `include` y SIN `select`
//     (fila entera; se comprueba por AST). En #5 se lee con `select`, y ese `select` leído se EJECUTA como
//     proyección antes de evaluar (el patrón de 1787s ⑤): así el control corre con el `select` real.
//   · Una variable que el objeto use y este test no conozca LANZA (ReferenceError): no hay huecos
//     rellenados en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { casosEscritos } from './_casos-escritos.mjs';
// El banco ANTES que `dist/`: deja el doble de la base, el PDF y el correo.
const { banco, prisma, reiniciar, requiere, rutaDe, asentar, M_PT, CLIENTE } = await import('./_banco-emision-con-estado.mjs');

const RAIZ = path.resolve(import.meta.dirname, '..');
const ts = requiere('typescript');
const { crearFacturaEmitida } = requiere(rutaDe('dist/modules/invoicing/domain/crearFacturaEmitida.js'));
const { congelarCliente } = requiere(rutaDe('dist/modules/invoicing/domain/clienteCongelado.js'));
const { congelarEmisorDesdeFicha } = requiere(rutaDe('dist/modules/invoicing/domain/emisorCongelado.js'));
const { formasDePagoACongelar } = requiere(rutaDe('dist/modules/invoicing/domain/formasDePagoACongelar.js'));
const { ensureInvoiceForCharge } = requiere(rutaDe('dist/lib/invoicing.js'));
const { emitInvoice } = requiere(rutaDe('dist/modules/invoicing/domain/invoicing.service.js'));
const { actorDeRequest } = requiere(rutaDe('dist/modules/system/audit.service.js'));

export const MUTACIONES_QUE_ME_TUMBAN = [
  // ① Observaciones, una por camino (en quotesAdmin el ancla lleva la línea de antes: la de abajo sola sale dos veces).
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    de: 'stageLabel: isCustomPlan ? tramo.stage.label : null, // SCRUM-27: etiqueta congelada (solo custom)\n        docFooterText: quote.docFooterText ?? null,',
    a: 'stageLabel: isCustomPlan ? tramo.stage.label : null, // SCRUM-27: etiqueta congelada (solo custom)\n        docFooterText: null,',
    cae: 'SCRUM-1805 ① #1 C3 · la factura del tramo lleva las Observaciones',
  },
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    de: 'stageLabel: null, // no es un tramo: es el documento entero\n        docFooterText: quote.docFooterText ?? null,',
    a: 'stageLabel: null, // no es un tramo: es el documento entero\n        docFooterText: null,',
    cae: 'SCRUM-1805 ① #2 C4 · la factura del total lleva las Observaciones',
  },
  {
    fichero: 'src/modules/quotes/app/routes/quotes.routes.ts',
    de: 'docFooterText: quote.docFooterText ?? null, // SCRUM-1787l',
    a: 'docFooterText: null, // SCRUM-1787l',
    cae: 'SCRUM-1805 ① #3 C1 · la factura al aceptar lleva las Observaciones',
  },
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: 'docFooterText: quote.docFooterText ?? null, // SCRUM-1787l',
    a: 'docFooterText: null, // SCRUM-1787l',
    cae: 'SCRUM-1805 ① #4 C2 · cobrar el resto lleva las Observaciones (c.22345 ⑤)',
  },
  // ② Formas de pago, una por camino: sin el presupuesto, el ayudante da las activas y no la lista.
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    de: 'presupuesto: quote, merchant: quote.merchant, importe: Number(tramo.invoiceAmount)',
    a: 'presupuesto: null, merchant: quote.merchant, importe: Number(tramo.invoiceAmount)',
    cae: 'SCRUM-1805 ② #1 C3 · con lista → esa lista; sin lista → las activas',
  },
  {
    fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts',
    de: 'presupuesto: quote, merchant: quote.merchant, importe: Number(invoiceAmount)',
    a: 'presupuesto: null, merchant: quote.merchant, importe: Number(invoiceAmount)',
    cae: 'SCRUM-1805 ② #2 C4 · con lista → esa lista; sin lista → las activas',
  },
  {
    fichero: 'src/modules/quotes/app/routes/quotes.routes.ts',
    de: 'presupuesto: quote, merchant: quote.merchant, importe: Number(invoiceAmount)',
    a: 'presupuesto: null, merchant: quote.merchant, importe: Number(invoiceAmount)',
    cae: 'SCRUM-1805 ② #3 C1 · con lista → esa lista; sin lista → las activas',
  },
  {
    fichero: 'src/modules/jobs/app/routes/jobs.routes.ts',
    de: 'presupuesto: quote, merchant: quote.merchant, importe: Number(tramo.amount)',
    a: 'presupuesto: null, merchant: quote.merchant, importe: Number(tramo.amount)',
    cae: 'SCRUM-1805 ② #4 C2 · con lista → esa lista; sin lista → las activas',
  },
  // ③ #5: la llamada al ayudante y cada `select` ensanchado.
  {
    fichero: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    de: 'payMethods: formasDePagoACongelar({ presupuesto: quote,',
    a: 'payMethods: formasDePagoACongelar({ presupuesto: null,',
    cae: 'SCRUM-1805 ③ #5 C7 · con lista → esa lista; sin lista → las activas',
  },
  {
    fichero: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    de: 'discountGlobalAmount: true, payMethods: true },',
    a: 'discountGlobalAmount: true },',
    cae: 'SCRUM-1805 ③ #5 C7 · con lista → esa lista; sin lista → las activas',
  },
  {
    fichero: 'src/modules/jobs/app/routes/albaranes.routes.ts',
    de: 'iban: true, clabe: true,',
    a: 'clabe: true,',
    cae: 'SCRUM-1805 ③ #5 C7 · con lista → esa lista; sin lista → las activas',
  },
];

// ── Lectura por AST ─────────────────────────────────────────────────────────────────────────────
const fuentes = new Map();
function fuente(rel) {
  if (!fuentes.has(rel)) {
    const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    fuentes.set(rel, ts.createSourceFile(rel, texto, ts.ScriptTarget.Latest, true));
  }
  return fuentes.get(rel);
}
function llamadas(sf, raiz, texto) {
  const fuera = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === texto) fuera.push(n);
    ts.forEachChild(n, visitar);
  })(raiz);
  return fuera;
}
/** El manejador (último argumento) de `router.<verbo>('<ruta>', …)`. */
function manejador(sf, verbo, ruta) {
  const hallados = llamadas(sf, sf, `router.${verbo}`)
    .filter((c) => ts.isStringLiteral(c.arguments[0]) && c.arguments[0].text === ruta);
  assert.equal(hallados.length, 1, `🔴 CIEGO: router.${verbo}('${ruta}') aparece ${hallados.length} veces en ${sf.fileName}`);
  return hallados[0].arguments.at(-1);
}
const propiedad = (obj, nombre) => obj.properties.find((p) => p.name && p.name.getText() === nombre);

/** El camino: su fichero, su ruta y con qué emite. */
const CAMINOS = {
  1: { nombre: '#1 C3', fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts', verbo: 'post', ruta: '/:id/invoice', emite: 'crearFacturaEmitida' },
  2: { nombre: '#2 C4', fichero: 'src/modules/system/app/routes/quotesAdmin.routes.ts', verbo: 'post', ruta: '/:id/invoice-manual', emite: 'crearFacturaEmitida' },
  3: { nombre: '#3 C1', fichero: 'src/modules/quotes/app/routes/quotes.routes.ts', verbo: 'post', ruta: '/:token/decision', emite: 'crearFacturaEmitida' },
  4: { nombre: '#4 C2', fichero: 'src/modules/jobs/app/routes/jobs.routes.ts', verbo: 'post', ruta: '/:id/collect-rest', emite: 'crearFacturaEmitida' },
  5: { nombre: '#5 C7', fichero: 'src/modules/jobs/app/routes/albaranes.routes.ts', verbo: 'post', ruta: '/:id/convertir-en-factura', emite: 'emitInvoice' },
};

/** El objeto literal que el camino pasa a la emisión (exactamente una emisión por manejador). */
function datosDelCamino(c) {
  const sf = fuente(c.fichero);
  const [emision, ...mas] = llamadas(sf, manejador(sf, c.verbo, c.ruta), c.emite);
  assert.ok(emision && mas.length === 0, `🔴 CIEGO: ${c.nombre} no llama a ${c.emite} exactamente una vez`);
  const obj = emision.arguments[c.emite === 'emitInvoice' ? 1 : 3];
  assert.ok(obj && ts.isObjectLiteralExpression(obj), `🔴 CIEGO: ${c.nombre} no pasa un objeto literal a ${c.emite}`);
  return { sf, obj };
}

/**
 * Evalúa un objeto literal de TS con las variables dadas. Una variable que no esté en `vars` y no sea
 * global LANZA: el `has` del alcance dice «no» y JS la busca fuera, donde no existe.
 */
function evaluar(sf, nodo, vars) {
  const js = ts.transpileModule(`(${nodo.getText(sf)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/^"use strict";\s*/, '').trim().replace(/;$/, '');
  const alcance = new Proxy(vars, {
    has: (t, k) => Object.prototype.hasOwnProperty.call(t, k),
    get: (t, k) => (k === Symbol.unscopables ? undefined : t[k]),
  });
  // eslint-disable-next-line no-new-func
  return new Function('alcance', `with (alcance) { return ${js}; }`)(alcance);
}

/** Las claves de un `select` literal. */
const clavesDeSelect = (sel) => sel.initializer.properties.map((p) => p.name.getText());
const proyectar = (fila, claves) => Object.fromEntries(claves.map((k) => [k, fila[k] ?? null]));

// ── Los datos de la prueba ──────────────────────────────────────────────────────────────────────
const OBSERVACIONES = 'ZZ Observaciones de prueba: garantía de 2 años en mano de obra.';
const CABECERA = 'ZZ Cabecera de prueba: no viaja a la factura.';
const LINEAS = [{ concept: 'ZZ Mano de obra', qty: 1, price: 100, tax: 0.21 }];
// El comercio con IBAN y Bizum: a 121 € sus activas son Bizum y transferencia (1787u).
const ACTIVAS = {
  iban: 'PT50000201231234567890154', clabe: null, bizumPhone: '+34600111222', whatsappPhone: null,
  connectStatus: 'none', stripeAccountId: null, defaultCurrency: 'EUR',
  flags: { PAYMENTS_CONNECT_ENABLED: false, BIZUM_MANUAL_ENABLED: true, BIZUM_AUTO_ENABLED: false },
};

function prepararComercio() {
  reiniciar();
  const m = banco.tablas.merchant.find((x) => x.id === M_PT);
  Object.assign(m, ACTIVAS);
  // `congelarCliente` busca la ficha del cliente CON el comercio (regla 2); el banco la deja sin él.
  Object.assign(banco.tablas.customer.find((c) => c.id === CLIENTE), { merchantId: M_PT });
  return { ...m };
}
function presupuesto(merchant, campos = {}) {
  const q = {
    id: 1805, merchantId: M_PT, customerId: CLIENTE, quoteNumber: 'P-1805', currency: 'eur',
    lines: LINEAS, discountGlobalAmount: null, total: '121.00', status: 'accepted',
    docHeaderText: CABECERA, docFooterText: OBSERVACIONES, payMethods: null, merchant, ...campos,
  };
  banco.tablas.quote.push({ ...q, merchant: undefined });
  return q;
}

/** Las variables que cada camino tiene en el punto de la emisión. `quote` y `merchant` los pone quien llama. */
function variablesDe(n, { quote, merchant }) {
  const tramo = { stage: { index: 0, label: 'Anticipo', percentage: 1 }, scaledLines: LINEAS, invoiceAmount: 121, amount: 121 };
  const comunes = { quote, invoiceNumber: `F-1805-${n}`, formasDePagoACongelar };
  switch (n) {
    case 1: return { ...comunes, tramo, isCustomPlan: false };
    case 2: return { ...comunes, invoiceAmount: 121, scaledLines: LINEAS, merchant };
    case 3: return { ...comunes, invoiceAmount: 121, scaledLines: LINEAS, stage: tramo.stage, isCustomPlan: false };
    case 4: return { ...comunes, tramo, isCustomPlan: false };
    default: throw new Error(`camino ${n} sin variables`);
  }
}

/** Emite por el camino `n` (#1–#4) sobre el banco y devuelve la fila escrita. */
async function emitirPor(n, campos = {}) {
  const merchant = prepararComercio();
  const quote = presupuesto(merchant, campos);
  const { sf, obj } = datosDelCamino(CAMINOS[n]);
  const datos = evaluar(sf, obj, variablesDe(n, { quote, merchant }));
  const cliente = await congelarCliente(prisma, M_PT, CLIENTE);
  const emisor = congelarEmisorDesdeFicha(merchant);
  const creada = await prisma.$transaction((tx) => crearFacturaEmitida(tx, cliente, emisor, datos));
  await asentar();
  const fila = banco.tablas.invoice.find((f) => f.id === creada.id);
  assert.ok(fila, `🔴 CIEGO: ${CAMINOS[n].nombre} no dejó fila en invoices`);
  return fila;
}

// ── #1–#4 leen el presupuesto ENTERO (sin `select`): por eso basta `quote.<campo>` ──────────────
test('SCRUM-1805 · #1–#4 leen el presupuesto sin `select` (traen docFooterText y payMethods)', () => {
  for (const n of [1, 2, 3, 4]) {
    const c = CAMINOS[n];
    const sf = fuente(c.fichero);
    const lecturas = ['prisma.quote.findFirst', 'prisma.quote.findUnique', 'prisma.quote.findMany']
      .flatMap((t) => llamadas(sf, manejador(sf, c.verbo, c.ruta), t));
    assert.ok(lecturas.length > 0, `🔴 CIEGO: ${c.nombre} no lee ningún presupuesto`);
    for (const l of lecturas) {
      assert.equal(propiedad(l.arguments[0], 'select'), undefined,
        `🔴 ${c.nombre}: la lectura del presupuesto lleva \`select\` y quizá no trae los campos: ${l.getText(sf).slice(0, 120)}`);
    }
  }
});

// ── ① Observaciones en #1–#4 (c.22345 ② y ⑤); la cabecera NO ───────────────────────────────────
const observaciones = casosEscritos([
  { n: 1, que: 'la factura del tramo lleva las Observaciones' },
  { n: 2, que: 'la factura del total lleva las Observaciones' },
  { n: 3, que: 'la factura al aceptar lleva las Observaciones' },
  { n: 4, que: 'cobrar el resto lleva las Observaciones (c.22345 ⑤)' },
], (f) => `SCRUM-1805 ① ${CAMINOS[f.n].nombre} · ${f.que}`, async ({ n }) => {
  const f = await emitirPor(n);
  assert.equal(f.docFooterText, OBSERVACIONES, `🔴 ${CAMINOS[n].nombre}: la factura no congela las Observaciones`);
  assert.equal(f.docHeaderText, undefined, `🔴 ${CAMINOS[n].nombre}: la cabecera viaja a la factura (c.22345 ②: NO)`);
  // Control: sin Observaciones en el presupuesto, NULL (no una cadena vacía ni la de otro).
  const sin = await emitirPor(n, { docFooterText: null });
  assert.equal(sin.docFooterText, null);
});
test('SCRUM-1805 ① #1 C3 · la factura del tramo lleva las Observaciones', observaciones(0));
test('SCRUM-1805 ① #2 C4 · la factura del total lleva las Observaciones', observaciones(1));
test('SCRUM-1805 ① #3 C1 · la factura al aceptar lleva las Observaciones', observaciones(2));
test('SCRUM-1805 ① #4 C2 · cobrar el resto lleva las Observaciones (c.22345 ⑤)', observaciones(3));
observaciones.todos();

// ── Control ④ de c.22345: la R1 NO hereda las Observaciones ─────────────────────────────────────
test('SCRUM-1805 · control: la R1 de una factura con Observaciones NO las copia (c.22345 ④)', async () => {
  const original = await emitirPor(1);
  assert.equal(original.docFooterText, OBSERVACIONES, '🔴 CIEGO: la original no lleva Observaciones y el control no mide nada');
  const sf = fuente('src/modules/system/app/routes/invoicesAdmin.routes.ts');
  const r1 = llamadas(sf, sf, 'crearFacturaEmitida')
    .map((c) => c.arguments[3])
    .filter((o) => o && ts.isObjectLiteralExpression(o) && propiedad(o, 'type')?.initializer.getText(sf) === "'R1'");
  assert.equal(r1.length, 1, `🔴 CIEGO: la R1 aparece ${r1.length} veces en invoicesAdmin.routes.ts`);
  const merchant = banco.tablas.merchant.find((x) => x.id === M_PT);
  const datos = evaluar(sf, r1[0], {
    original: { ...original, merchant }, number: 'R-1805-1', totalRect: '-121.00',
    negLines: LINEAS.map((l) => ({ ...l, qty: -l.qty })),
  });
  const cliente = await congelarCliente(prisma, M_PT, CLIENTE);
  const rect = await prisma.$transaction((tx) => crearFacturaEmitida(tx, cliente, congelarEmisorDesdeFicha(merchant), datos));
  const fila = banco.tablas.invoice.find((f) => f.id === rect.id);
  assert.equal(fila.type, 'R1');
  assert.equal(fila.docFooterText ?? null, null, '🔴 la R1 copia las Observaciones de la original (c.22345 ④: NO)');
});

// ── ② Formas de pago en #1–#4 (c.22404 b y c.22429): la lista del presupuesto, o las activas ─────
const formas = casosEscritos([1, 2, 3, 4],
  (n) => `SCRUM-1805 ② ${CAMINOS[n].nombre} · con lista → esa lista; sin lista → las activas`, async (n) => {
    // Con lista: ESA lista, aunque el comercio tenga otras activas (la tarjeta NO está activa hoy).
    const con = await emitirPor(n, { payMethods: ['card'] });
    assert.deepEqual(con.payMethods, ['card'], `🔴 ${CAMINOS[n].nombre}: no congela la lista del presupuesto`);
    // Sin lista («todas»): las activas hoy para el importe de ESA factura (121 € → Bizum delante).
    const sin = await emitirPor(n, { payMethods: null });
    assert.deepEqual(sin.payMethods, ['bizum', 'transfer'], `🔴 ${CAMINOS[n].nombre}: sin lista no congela las activas`);
  });
test('SCRUM-1805 ② #1 C3 · con lista → esa lista; sin lista → las activas', formas(0));
test('SCRUM-1805 ② #2 C4 · con lista → esa lista; sin lista → las activas', formas(1));
test('SCRUM-1805 ② #3 C1 · con lista → esa lista; sin lista → las activas', formas(2));
test('SCRUM-1805 ② #4 C2 · con lista → esa lista; sin lista → las activas', formas(3));
formas.todos();

// ── Controles: la suelta y la factura tras cobrar NO cambian ────────────────────────────────────
test('SCRUM-1805 · control: la factura suelta sigue con su expresión de 1787s, sin tocar', () => {
  const sf = fuente('src/modules/system/app/routes/invoicesAdmin.routes.ts');
  const [emision, ...mas] = llamadas(sf, manejador(sf, 'post', '/'), 'emitInvoice');
  assert.ok(emision && mas.length === 0, '🔴 CIEGO: la suelta no emite exactamente una vez');
  assert.equal(propiedad(emision.arguments[1], 'payMethods')?.initializer.getText(sf),
    "val.payMethods ?? formasDePagoACongelar({ presupuesto: null, merchant, importe: Number(total), moneda: merchant.defaultCurrency || 'EUR' }) ?? undefined");
});

test('SCRUM-1805 · control: la factura tras cobrar sigue mandando la lista del COBRO, luego la del presupuesto', async () => {
  async function trasCobrar(delPresupuesto, delCobro) {
    prepararComercio();
    const id = 18050 + banco.tablas.charge.length;
    banco.tablas.charge.push({
      id, merchantId: M_PT, customerId: CLIENTE, status: 'paid', amount: '121.00', currency: 'EUR',
      concept: 'ZZ Arreglo', method: 'card', reference: null, intentId: null, receiptToken: null, paidAt: null,
      payMethods: delCobro,
    });
    banco.tablas.quote.push({ id: id + 1, merchantId: M_PT, chargeId: id, payMethods: delPresupuesto, lines: [], discountGlobalAmount: null });
    await ensureInvoiceForCharge(id, prisma);
    await asentar();
    const fs_ = banco.tablas.invoice.filter((f) => f.chargeId === id);
    assert.equal(fs_.length, 1, `🔴 CIEGO: el cobro dejó ${fs_.length} facturas`);
    return fs_[0].payMethods;
  }
  assert.deepEqual(await trasCobrar(['transfer'], ['bizum']), ['bizum']);
  assert.deepEqual(await trasCobrar(['transfer'], null), ['transfer']);
  assert.deepEqual(await trasCobrar(null, null), ['bizum', 'transfer']);
});
// ── ③ #5 C7 albarán → factura: `emitInvoice` con los dos `select` ensanchados ───────────────────
// Lo que leían ANTES de SCRUM-1805 (origin/main 734b01758, albaranes.routes.ts:1569-1573 y :1604).
const SELECT_COMERCIO_DE_ANTES = ['id', 'email', 'country', 'flags', 'defaultCurrency', 'taxId',
  'name', 'legalName', 'address', 'logoUrl', 'whatsappPhone', 'llevaLibrosPorSii'];
const SELECT_PRESUPUESTO_DE_ANTES = ['id', 'quoteNumber', 'lines', 'discountGlobalAmount'];

/** Las claves de los dos `select` con que #5 lee el comercio y el presupuesto. */
function selectsDe5() {
  const c = CAMINOS[5];
  const sf = fuente(c.fichero);
  const h = manejador(sf, c.verbo, c.ruta);
  const leer = (texto, quien) => {
    const [l, ...mas] = llamadas(sf, h, texto);
    assert.ok(l && mas.length === 0, `🔴 CIEGO: #5 no lee ${quien} exactamente una vez`);
    const sel = propiedad(l.arguments[0], 'select');
    assert.ok(sel && ts.isObjectLiteralExpression(sel.initializer), `🔴 CIEGO: la lectura de ${quien} no lleva \`select\``);
    return clavesDeSelect(sel);
  };
  return { comercio: leer('prisma.merchant.findUnique', 'el comercio'), presupuesto: leer('prisma.quote.findFirst', 'el presupuesto') };
}

async function emitirPor5(payMethods, selects = selectsDe5()) {
  const completo = prepararComercio();
  const merchant = proyectar(completo, selects.comercio);
  const quote = proyectar(presupuesto(completo, { payMethods }), selects.presupuesto);
  const { sf, obj } = datosDelCamino(CAMINOS[5]);
  const datos = evaluar(sf, obj, {
    req: { merchantId: M_PT }, job: { customerId: CLIENTE }, total: '121.00', merchant, quote,
    invoiceLines: LINEAS, albaran: { id: 18051, numero: 'ALB-1805', fecha: new Date('2026-11-25T10:00:00Z') },
    actorDeRequest, clienteCongelado: await congelarCliente(prisma, M_PT, CLIENTE),
    emisorCongelado: congelarEmisorDesdeFicha(completo), formasDePagoACongelar,
  });
  const inv = await prisma.$transaction((tx) => emitInvoice(tx, datos));
  await asentar();
  const fila = banco.tablas.invoice.find((f) => f.id === inv.id);
  assert.ok(fila, '🔴 CIEGO: #5 no dejó fila en invoices');
  return fila;
}

test('SCRUM-1805 ③ #5 C7 · con lista → esa lista; sin lista → las activas', async () => {
  assert.deepEqual((await emitirPor5(['card'])).payMethods, ['card'], '🔴 #5: no congela la lista del presupuesto');
  assert.deepEqual((await emitirPor5(null)).payMethods, ['bizum', 'transfer'], '🔴 #5: sin lista no congela las activas');
});

test('SCRUM-1805 ③ #5 C7 · los dos `select` ensanchan SOLO lo nombrado; con los de antes, mal', async () => {
  const s = selectsDe5();
  for (const k of SELECT_COMERCIO_DE_ANTES) assert.ok(s.comercio.includes(k), `🔴 el select del comercio ha perdido «${k}»`);
  for (const k of SELECT_PRESUPUESTO_DE_ANTES) assert.ok(s.presupuesto.includes(k), `🔴 el select del presupuesto ha perdido «${k}»`);
  // Solo los campos de `ComercioParaFormasDePago` que faltaban, y solo `payMethods` en el presupuesto.
  assert.deepEqual(s.comercio.filter((k) => !SELECT_COMERCIO_DE_ANTES.includes(k)).sort(),
    ['bizumPhone', 'clabe', 'connectStatus', 'iban', 'stripeAccountId']);
  assert.deepEqual(s.presupuesto.filter((k) => !SELECT_PRESUPUESTO_DE_ANTES.includes(k)), ['payMethods']);
  // CONTROL NEGATIVO: con los `select` de antes la lista se pierde y la transferencia no aparece.
  const antes = { comercio: SELECT_COMERCIO_DE_ANTES, presupuesto: SELECT_PRESUPUESTO_DE_ANTES };
  const conLista = (await emitirPor5(['card'], antes)).payMethods ?? null;
  assert.notDeepEqual(conLista, ['card'], `🔴 el control negativo no muerde (con lista): ${JSON.stringify(conLista)}`);
  const sinLista = (await emitirPor5(null, antes)).payMethods ?? [];
  assert.ok(!sinLista.includes('transfer'), `🔴 el control negativo no muerde (sin lista): ${JSON.stringify(sinLista)}`);
});