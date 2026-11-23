// tests/scrum1787s-congelar-formas-de-pago.test.mjs — SCRUM-1787s y SCRUM-1787s-bis
//
// Decisiones: c.22401 («1-GO», opción A, los DOS caminos de emisión), c.22404 («1-Sí a las dos»: un
// ayudante de J1; la lista RESTRINGIDA del presupuesto también se congela) y c.22415 (orquestador,
// dentro del GO: el `select` del comercio de la suelta se ensancha con los cinco campos que mira
// `formasDePagoActivas`, con control negativo).
//
// QUÉ SE EJECUTA Y QUÉ NO.
//   · El ayudante (`formasDePagoACongelar`) se EJECUTA sobre comercios fabricados.
//   · La factura tras cobrar (`ensureInvoiceForCharge`) se EJECUTA entera sobre el banco con estado
//     (`_banco-emision-con-estado.mjs`), y se lee lo que queda escrito en `invoices`.
//   · El PDF se fabrica con el `generateInvoicePdf` de verdad y se lee con el extractor de 1787m.
//   · La ruta de la factura suelta NO se monta: su `select` y su llamada se leen por AST, y el `select`
//     leído se EJECUTA como proyección del comercio antes de pasarlo al ayudante (⑤). Así el control
//     negativo de c.22415 corre con el `select` real, no con una copia.
//
// ① presupuesto con lista → ESA lista, aunque el comercio tenga más activas (c.22404 b)
// ② presupuesto con `null` («todas») o sin presupuesto → las activas hoy, en el vocabulario de la factura
// ③ `bizum_auto` nunca llega a `Invoice.payMethods` (→ `bizum`, sin duplicados)
// ④ sin ninguna activa → `null`
// ⑤ la ruta de la suelta: el `select` trae lo que mira la función; con el de ANTES, sin transferencia
// ⑥ la ruta de la suelta: si el cuerpo trae `payMethods`, mandan las del cuerpo; si no, el ayudante
// ⑦ `ensureInvoiceForCharge` congela la lista del presupuesto, o las activas con `null` o sin presupuesto
// ⑧ el PDF de una factura con las formas por defecto lleva «Formas de pago»
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// El banco se importa ANTES de cargar `dist/`: deja el doble de la base, el PDF y el correo.
import { banco, prisma, reiniciar, nuevoId, requiere, rutaDe, asentar, M_PT, CLIENTE } from './_banco-emision-con-estado.mjs';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = requiere('typescript');

const { formasDePagoACongelar } = requiere(rutaDe('dist/modules/invoicing/domain/formasDePagoACongelar.js'));
const { validarFacturaSuelta } = requiere(rutaDe('dist/modules/invoicing/domain/facturaSuelta.js'));
const { ensureInvoiceForCharge } = requiere(rutaDe('dist/lib/invoicing.js'));
// El PDF de verdad: el banco dobla `dist/lib/pdf.js`, no el servicio que lo pinta.
const { generateInvoicePdf } = requiere(rutaDe('dist/modules/invoicing/infra/pdf/pdf.service.js'));

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La suelta vuelve a congelar SOLO las del cuerpo: sin ellas, nada.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: 'payMethods: val.payMethods ?? formasDePagoACongelar({',
    a: 'payMethods: val.payMethods ?? void ({',
    cae: 'SCRUM-1787s ⑥ la suelta: mandan las del cuerpo y, sin ellas, el ayudante',
  },
  {
    // El ayudante ignora la lista del presupuesto.
    fichero: 'src/modules/invoicing/domain/formasDePagoACongelar.ts',
    de: 'if (Array.isArray(delPresupuesto)) {',
    a: 'if (false) {',
    cae: 'SCRUM-1787s ① presupuesto con lista',
  },
  {
    // La factura tras cobrar no le pasa el presupuesto al ayudante.
    fichero: 'src/lib/invoicing.ts',
    de: 'presupuesto: quote,',
    a: 'presupuesto: null,',
    cae: 'SCRUM-1787s ⑦ ensureInvoiceForCharge congela la lista del presupuesto',
  },
  {
    // La factura tras cobrar no le pasa el cobro al ayudante (c.22423).
    fichero: 'src/lib/invoicing.ts',
    de: 'formasDePagoACongelar({ cobro: ch,',
    a: 'formasDePagoACongelar({ cobro: null,',
    cae: 'SCRUM-1787s ⑨ ensureInvoiceForCharge congela la lista del COBRO',
  },
  {
    // El ayudante ignora la lista del cobro.
    fichero: 'src/modules/invoicing/domain/formasDePagoACongelar.ts',
    de: 'if (Array.isArray(delCobro)) {',
    a: 'if (false) {',
    cae: 'SCRUM-1787s ⑨ ensureInvoiceForCharge congela la lista del COBRO',
  },
];

// ── Comercios fabricados (la forma de 1787u: los flags SIEMPRE explícitos por comercio) ──────────
function comercio({ iban = false, bizum = false, connect = false, auto = false } = {}) {
  return {
    id: 1787, country: 'ES', email: 'pro@ejemplo.invalid', defaultCurrency: 'EUR',
    iban: iban ? 'ES9121000418450200051332' : null, clabe: null,
    bizumPhone: bizum ? '+34600111222' : null, whatsappPhone: null,
    connectStatus: connect ? 'active' : 'none', stripeAccountId: connect ? 'acct_1787s_ejemplo' : null,
    flags: { PAYMENTS_CONNECT_ENABLED: connect, BIZUM_MANUAL_ENABLED: bizum, BIZUM_AUTO_ENABLED: auto },
  };
}
const CON_IBAN_Y_BIZUM = comercio({ iban: true, bizum: true });
const congelar = (merchant, presupuesto, importe = 121) => formasDePagoACongelar({ presupuesto, merchant, importe, moneda: 'EUR' });

test('SCRUM-1787s ① presupuesto con lista → esa lista, aunque el comercio tenga más activas', () => {
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, { payMethods: ['transfer'] }), ['transfer']);
  // c.22404 b: la lista del presupuesto manda TAL CUAL, también si hoy no está activa.
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, { payMethods: ['card', 'bizum'] }), ['card', 'bizum']);
  // Control: el mismo comercio SIN lista sí tiene otras, así que la de arriba no sale por casualidad.
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, { payMethods: null }), ['bizum', 'transfer']);
});

test('SCRUM-1787s ② presupuesto «todas» o sin presupuesto → las activas hoy para el total', () => {
  // Orden: el de la página de pago (hasta 500 €, Bizum delante; por encima, la tarjeta).
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, { payMethods: null }), ['bizum', 'transfer']);
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, null), ['bizum', 'transfer']);
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, undefined), ['bizum', 'transfer']);
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, {}), ['bizum', 'transfer']);
  // El tope de Bizum (1.000 €) se juzga con el total de la factura.
  assert.deepEqual(congelar(CON_IBAN_Y_BIZUM, null, 1000.01), ['transfer']);
  const todo = comercio({ iban: true, bizum: true, connect: true });
  assert.deepEqual(congelar(todo, null, 999.99), ['card', 'bizum', 'transfer']);
});

test('SCRUM-1787s ③ bizum_auto nunca llega a la factura: se congela como bizum, sin duplicados', () => {
  const conAuto = comercio({ iban: true, bizum: true, connect: true, auto: true });
  const r = congelar(conAuto, null, 999.99);
  assert.deepEqual(r, ['card', 'bizum', 'transfer']);
  assert.ok(!r.includes('bizum_auto'));
  // Por encima de 1.000 € el manual no está y el automático sí (1787u): queda `bizum`, una vez.
  assert.deepEqual(congelar(conAuto, null, 1000.01), ['card', 'bizum', 'transfer']);
});

test('SCRUM-1787s ④ sin ninguna activa → null', () => {
  assert.equal(congelar(comercio(), null), null);
  assert.equal(congelar(null, null), null);
  assert.equal(congelar(comercio(), { payMethods: [] }), null, 'una lista vacía no congela «ninguna»: congela nada');
});

// ── La ruta de la suelta, por AST ───────────────────────────────────────────────────────────────
const FUENTE_RUTA = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
const SF = ts.createSourceFile('invoicesAdmin.routes.ts', FUENTE_RUTA, ts.ScriptTarget.Latest, true);

/** El manejador de `router.post('/', …)`: la factura suelta. */
function manejadorDeLaSuelta() {
  let hallado = null;
  (function visitar(n) {
    if (!hallado && ts.isCallExpression(n) && n.expression.getText(SF) === 'router.post'
      && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === '/') hallado = n.arguments.at(-1);
    ts.forEachChild(n, visitar);
  })(SF);
  assert.ok(hallado, "🔴 CIEGO: no encuentro router.post('/') en invoicesAdmin.routes.ts");
  return hallado;
}
function llamadas(raiz, texto) {
  const fuera = [];
  (function visitar(n) {
    if (ts.isCallExpression(n) && n.expression.getText(SF) === texto) fuera.push(n);
    ts.forEachChild(n, visitar);
  })(raiz);
  return fuera;
}
const propiedad = (obj, nombre) => obj.properties.find((p) => p.name && p.name.getText(SF) === nombre);

/** Las claves del `select` con que la suelta lee el comercio. */
function selectDelComercio() {
  const [lectura, ...mas] = llamadas(manejadorDeLaSuelta(), 'prisma.merchant.findUnique');
  assert.ok(lectura && mas.length === 0, '🔴 CIEGO: la suelta no lee el comercio exactamente una vez');
  const sel = propiedad(lectura.arguments[0], 'select');
  assert.ok(sel && ts.isObjectLiteralExpression(sel.initializer), '🔴 CIEGO: la lectura del comercio no lleva `select`');
  return sel.initializer.properties.map((p) => p.name.getText(SF));
}
const proyectar = (fila, claves) => Object.fromEntries(claves.map((k) => [k, fila[k] ?? null]));

// El `select` que tenía la ruta ANTES de 1787s (origin/main 1acb5e4e, invoicesAdmin.routes.ts:124-129).
const SELECT_DE_ANTES = ['id', 'email', 'country', 'flags', 'defaultCurrency', 'llevaLibrosPorSii',
  'name', 'legalName', 'taxId', 'address', 'logoUrl', 'whatsappPhone'];

test('SCRUM-1787s ⑤ la suelta lee del comercio lo que mira la función; con el select de antes, sin transferencia', () => {
  const claves = selectDelComercio();
  assert.ok(claves.length >= SELECT_DE_ANTES.length, `🔴 CIEGO: el select leído tiene ${claves.length} claves`);
  for (const k of SELECT_DE_ANTES) assert.ok(claves.includes(k), `🔴 el select ha perdido «${k}»`);
  // Con el select de HOY: la lista correcta.
  assert.deepEqual(congelar(proyectar(CON_IBAN_Y_BIZUM, claves), null), ['bizum', 'transfer']);
  // CONTROL NEGATIVO (c.22415 ②): con el de ANTES, el comercio TIENE IBAN y la factura sale sin transferencia.
  const conElDeAntes = congelar(proyectar(CON_IBAN_Y_BIZUM, SELECT_DE_ANTES), null);
  assert.ok(!(conElDeAntes ?? []).includes('transfer'), `🔴 el control negativo no muerde: ${JSON.stringify(conElDeAntes)}`);
  // Y solo los cinco de c.22415 ①: nada más se añadió.
  const nuevas = claves.filter((k) => !SELECT_DE_ANTES.includes(k)).sort();
  assert.deepEqual(nuevas, ['bizumPhone', 'clabe', 'connectStatus', 'iban', 'stripeAccountId']);
});

test('SCRUM-1787s ⑥ la suelta: mandan las del cuerpo y, sin ellas, el ayudante', () => {
  // El validador sigue devolviendo las del cuerpo, y `undefined` sin ellas (1787i ③).
  const LINEAS = [{ concept: 'ZZ trabajo de ejemplo', qty: 1, price: 100, tax: 0.21 }];
  const con = validarFacturaSuelta({ customerId: 5, lines: LINEAS, payMethods: ['card'] });
  assert.deepEqual(con.ok && con.payMethods, ['card']);
  const sin = validarFacturaSuelta({ customerId: 5, lines: LINEAS });
  assert.equal(sin.ok && sin.payMethods, undefined);
  // La ruta: `payMethods: val.payMethods ?? formasDePagoACongelar({ presupuesto: null, merchant, … })`.
  const [emision] = llamadas(manejadorDeLaSuelta(), 'emitInvoice');
  assert.ok(emision, '🔴 CIEGO: no encuentro la emisión de la suelta');
  const pm = propiedad(emision.arguments[1], 'payMethods');
  assert.ok(pm, '🔴 la suelta no pasa `payMethods` a la emisión');
  let e = pm.initializer;
  // `a ?? b ?? undefined` se agrupa por la izquierda: se baja hasta el primer `??`.
  while (ts.isBinaryExpression(e) && ts.isBinaryExpression(e.left)) e = e.left;
  assert.ok(ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken,
    `🔴 la suelta no cae al ayudante sin formas en el cuerpo: ${pm.initializer.getText(SF)}`);
  assert.equal(e.left.getText(SF), 'val.payMethods', '🔴 las del cuerpo ya no mandan');
  assert.ok(ts.isCallExpression(e.right) && e.right.expression.getText(SF) === 'formasDePagoACongelar',
    `🔴 sin formas en el cuerpo la suelta no llama al ayudante: ${e.right.getText(SF)}`);
  const args = e.right.arguments[0];
  assert.equal(propiedad(args, 'presupuesto')?.initializer.getText(SF), 'null', 'la suelta no tiene presupuesto');
  assert.ok(propiedad(args, 'merchant') || args.properties.some((p) => ts.isShorthandPropertyAssignment(p) && p.name.text === 'merchant'),
    '🔴 la suelta no le pasa el comercio que leyó');
});

// ── La factura tras cobrar, ejecutada sobre el banco con estado ─────────────────────────────────
function prepararComercio(campos) {
  reiniciar();
  Object.assign(banco.tablas.merchant.find((m) => m.id === M_PT), campos);
}
function nuevoCobro({ presupuesto, delCobro = null } = {}) {
  const id = nuevoId('charge');
  banco.tablas.charge.push({
    id, merchantId: M_PT, customerId: CLIENTE, status: 'paid', amount: '121.00', currency: 'EUR',
    concept: 'Arreglo de una fuga', method: 'card', reference: null, intentId: null, receiptToken: null, paidAt: null,
    payMethods: delCobro,
  });
  if (presupuesto !== undefined) {
    banco.tablas.quote.push({ id: nuevoId('quote'), merchantId: M_PT, chargeId: id, payMethods: presupuesto, lines: [], discountGlobalAmount: null });
  }
  return id;
}
const ACTIVAS_PT = { iban: 'PT50000201231234567890154', bizumPhone: '+34600111222', connectStatus: 'none', stripeAccountId: null,
  flags: { PAYMENTS_CONNECT_ENABLED: false, BIZUM_MANUAL_ENABLED: true, BIZUM_AUTO_ENABLED: false } };

async function facturaTrasCobrar(campos, presupuesto, delCobro = null) {
  prepararComercio(campos);
  const cobro = nuevoCobro({ presupuesto, delCobro });
  await ensureInvoiceForCharge(cobro, prisma);
  await asentar();
  const fs_ = banco.tablas.invoice.filter((f) => f.chargeId === cobro);
  assert.equal(fs_.length, 1, `🔴 CIEGO: el cobro dejó ${fs_.length} facturas`);
  return fs_[0];
}

test('SCRUM-1787s ⑦ ensureInvoiceForCharge congela la lista del presupuesto', async () => {
  const f = await facturaTrasCobrar(ACTIVAS_PT, ['transfer']);
  assert.deepEqual(f.payMethods, ['transfer']);
});

test('SCRUM-1787s ⑦ ensureInvoiceForCharge congela las activas con «todas» o sin presupuesto, y nada sin ninguna', async () => {
  assert.deepEqual((await facturaTrasCobrar(ACTIVAS_PT, null)).payMethods, ['bizum', 'transfer']);
  assert.deepEqual((await facturaTrasCobrar(ACTIVAS_PT, undefined)).payMethods, ['bizum', 'transfer']);
  const sinNada = await facturaTrasCobrar({}, null);
  assert.equal(sinNada.payMethods ?? null, null, '🔴 un comercio sin ninguna activa congela algo');
});

test('SCRUM-1787s ⑧ el PDF de una factura con las formas por defecto lleva «Formas de pago»', async () => {
  const f = await facturaTrasCobrar(ACTIVAS_PT, null);
  const { outPath } = await generateInvoicePdf({
    number: 'F-2026-QA1787S', invoiceId: 17870, merchantId: 1787,
    merchant: { name: 'Oficio Ficticio', legalName: 'Oficio Ficticio SL', taxId: 'B00000000', address: 'Calle Inventada 1' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total: '121.00', qrData: '', type: 'F1',
    createdAt: new Date('2026-11-23T10:00:00.000Z'), lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    zona: 'Europe/Madrid', merchantCriterioCaja: null, payMethods: f.payMethods,
  });
  try {
    const r = lineasDePdf(fs.readFileSync(outPath));
    assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
    const lineas = r.lineas.filter((l) => l.texto.includes('Formas de pago'));
    assert.equal(lineas.length, 1, `🔴 «Formas de pago» aparece ${lineas.length} veces`);
    assert.equal(lineas[0].texto.trim(), 'Formas de pago: Bizum, Transferencia');
  } finally {
    fs.rmSync(outPath, { force: true });
  }
});

// ⑨ SCRUM-1787s-bis · decisión del orquestador (SCRUM-1787 c.22423, lectura de c.22404): en la factura
// tras cobrar manda la lista del COBRO si el profesional la limitó; si no, la del presupuesto; si no,
// las activas; si ninguna, null.
test('SCRUM-1787s ⑨ ensureInvoiceForCharge congela la lista del COBRO antes que la del presupuesto y que las activas', async () => {
  // El comercio tiene IBAN y Bizum activos: sin la regla, la factura congelaría las dos.
  assert.deepEqual((await facturaTrasCobrar(ACTIVAS_PT, undefined, ['bizum'])).payMethods, ['bizum']);
  assert.deepEqual((await facturaTrasCobrar(ACTIVAS_PT, ['transfer'], ['bizum'])).payMethods, ['bizum']);
  // Control: con el cobro en «todas» (null), sigue mandando el presupuesto.
  assert.deepEqual((await facturaTrasCobrar(ACTIVAS_PT, ['transfer'], null)).payMethods, ['transfer']);
});
