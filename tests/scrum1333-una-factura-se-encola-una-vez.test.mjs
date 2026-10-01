// SCRUM-1333 · LA MISMA FACTURA NO SE ENCOLA DOS VECES A LA AEAT.
//
// `sellarTrasEmision` encola el alta DESPUÉS de cada sellado (`encolarAltaTrasSellado`), y la cola
// (`VfSubmission`) no tiene único por factura. Una factura que pasaba dos veces por
// `sellarTrasEmision` dejaba DOS filas con el MISMO registro: la misma alta, dos veces, esperando
// a salir hacia la AEAT.
//
// GO del fundador: SCRUM-1333, comentario 17733 («2-Go»), con sus límites: no se toca ninguna
// huella ni el sellado, no se enciende ningún flag, no se borra ni edita ninguna fila de la cola.
//
// LA DECISIÓN (era de quien lo construyera): se evita en el CAMINO, no en el esquema. El encolado
// pregunta a la cola, dentro de un cerrojo consultivo por factura, si esa factura ya tiene su alta.
// Un único en la tabla sería un ALTER, y aquí no lo hay. El porqué, en `docs/master/SCRUM-1333.md`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 CÓMO SE MIDE: POR EFECTO, CONTANDO FILAS EN LA COLA
//
// Corre `dist/` tal cual sobre el banco con estado de SCRUM-1304 (`_banco-emision-con-estado.mjs`),
// que dobla la base, el PDF y el correo, y nada más. Sus límites están escritos allí: NO es
// Postgres, no aísla y no deshace. El cerrojo consultivo lo modela como una exclusión por clave
// que se suelta al terminar la transacción.
//
// ⚠️ EL LÍMITE QUE MIDIÓ J1e: la fila sólo llega a la cola si la factura es DECLARABLE (merchant de
// España, cliente con NIF, líneas con IVA). Con el cobro pelado del banco el registro no se monta,
// el intento acaba en `encolado_fallido` y la cola se queda en 0: no se vería nada. Por eso todos
// los casos montan la factura declarable y comprueban, antes de medir, que llegó UNA fila.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
// El banco se importa ANTES de cargar `dist/`: deja el doble de la base, el PDF y el correo.
import {
  banco, prisma, reiniciar, nuevoId, requiere, rutaDe, asentar,
  M_ES, M_PT, CLIENTE,
} from './_banco-emision-con-estado.mjs';

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const { sellarTrasEmision } = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { encolarAltaTrasSellado } = requiere(rutaDe('dist/modules/invoicing/domain/encolarRemision.js'));
const pspRouter = requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js'));
const capa = (pspRouter.default || pspRouter).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST / en psp.routes');
const pspH = capa.route.stack.at(-1).handle;

const NIF = 'B27000001'; // el del merchant de España del banco
const MERCHANT_ES = { country: 'ES', taxId: NIF, email: 'lugo@ejemplo.invalid' };

// ── LAS PIEZAS ────────────────────────────────────────────────────────────────────────────

/** Un cobro cuya factura será DECLARABLE: cliente con NIF y un presupuesto con una línea al 21 %. */
function nuevoCobroDeclarable() {
  Object.assign(banco.tablas.customer[0], { taxId: '12345678Z', legalName: 'Clienta de prueba SL', address: 'Calle 1, Lugo' });
  const cobro = {
    id: nuevoId('charge'), merchantId: M_ES, customerId: CLIENTE, status: 'pending', amount: '121.00', currency: 'EUR',
    concept: 'Arreglo de una fuga', method: 'card', reference: null, intentId: null, receiptToken: null, paidAt: null,
  };
  banco.tablas.charge.push(cobro);
  banco.tablas.quote.push({
    id: nuevoId('quote'), merchantId: M_ES, chargeId: cobro.id,
    lines: [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }], discountGlobalAmount: null,
  });
  return cobro.id;
}

async function entrega(chargeId) {
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  await pspH({ body: { event: 'payment.confirmed', charge_id: chargeId, method: 'card', bank_ref: `cs_${chargeId}`, amount: 121, currency: 'EUR' }, headers: {} }, res, (e) => { if (e) throw e; });
  return r;
}

/** Corre `fn` con la emisión automática encendida, apuntando lo que se dice por consola. */
async function conFlag(fn) {
  const antes = config.AUTO_INVOICE_ON_PAID;
  const voces = { log: console.log, error: console.error, warn: console.warn };
  const dicho = { warn: [] };
  console.log = console.error = () => {};
  console.warn = (...x) => dicho.warn.push(x.map(String).join(' '));
  config.AUTO_INVOICE_ON_PAID = true;
  try { await fn(); return dicho; }
  finally { config.AUTO_INVOICE_ON_PAID = antes; Object.assign(console, voces); await asentar(); }
}

const facturasDe = (chargeId) => banco.tablas.invoice.filter((f) => f.chargeId === chargeId);
const colaDe = (invoiceId) => banco.tablas.vfSubmission.filter((s) => s.invoiceId === invoiceId);
const constancias = () => banco.tablas.auditLog.filter((a) => a.action === 'encolado_fallido');
/** Cuántas veces se ha ESCRITO una huella de alta en una fila: los sellados, por efecto. */
const sellados = () => banco.escriturasFactura.filter((e) => e.campos.includes('vfHash')).length;

/** Lo persistido de la cadena, una línea por factura, y su sha256. */
function cadena() {
  const lineas = [...banco.tablas.invoice].sort((a, b) => a.id - b.id).map((f) => [
    `factura=${f.number}`, `estado=${f.vfEstado}`, `huella=${f.vfHash}`, `anterior=${JSON.stringify(f.vfPrevHash)}`,
    `sello=${f.vfTimestamp instanceof Date ? f.vfTimestamp.toISOString() : f.vfTimestamp}`, `qr=${f.qrData}`,
  ].join(' · '));
  return { lineas, sha256: crypto.createHash('sha256').update(lineas.join('\n')).digest('hex') };
}

/** Emite y sella UNA factura declarable por la ruta real, y comprueba el suelo: UNA fila en la cola. */
async function emitirUna() {
  const cobro = nuevoCobroDeclarable();
  await conFlag(() => entrega(cobro));
  const [factura] = facturasDe(cobro);
  assert.ok(factura, '🔴 CIEGO: la entrega no emitió ninguna factura');
  assert.equal(factura.vfEstado, 'sellado', '🔴 CIEGO: la factura no quedó sellada');
  assert.deepEqual(constancias().map((a) => a.meta?.errorMensaje), [],
    '🔴 CIEGO: el registro no se pudo montar (la factura no es declarable): la cola no mide nada');
  assert.equal(colaDe(factura.id).length, 1, '🔴 CIEGO: la primera pasada no dejó su fila en la cola');
  return factura;
}

// ── ✅ EL POSITIVO: UNA FACTURA SELLADA UNA VEZ SE SIGUE ENCOLANDO UNA VEZ ──────────────────────

test('SCRUM-1333 · SUELO Y ✅ POSITIVO: una factura sellada UNA vez deja UNA fila en la cola, con su registro tal como se selló', async () => {
  reiniciar();
  const factura = await emitirUna();
  const [fila] = colaDe(factura.id);
  assert.equal(fila.merchantId, M_ES, 'regla 2: la fila es de su comercio');
  assert.equal(fila.tipoOperacion, 'Alta');
  assert.equal(fila.obligadoNif, NIF);
  assert.match(String(factura.vfHash), /^[0-9A-F]{64}$/, 'la factura tiene huella');
  assert.ok(fila.registroXml.includes(factura.vfHash), '🔴 el registro encolado no lleva la huella sellada');
  assert.ok(fila.registroXml.includes(factura.number));
});

test('SCRUM-1333 · ✅ dos facturas DISTINTAS dejan cada una SU fila: no encolar dos veces no es no encolar la segunda', async () => {
  reiniciar();
  const una = await emitirUna();
  const cobro2 = nuevoCobroDeclarable();
  await conFlag(() => entrega(cobro2));
  const [otra] = facturasDe(cobro2);
  assert.notEqual(otra.id, una.id);
  assert.equal(colaDe(una.id).length, 1, 'la primera, su fila');
  assert.equal(colaDe(otra.id).length, 1,
    '🔴 LA SEGUNDA FACTURA NO SE HA ENCOLADO: la pregunta «¿ya está en la cola?» no mira de QUÉ factura.');
  assert.equal(banco.tablas.vfSubmission.length, 2);
});

// ── 🔴 EL DEFECTO: LA MISMA FACTURA, DOS PASADAS ──────────────────────────────────────────────

test('SCRUM-1333 · 🔴 ④b · dos entregas A LA VEZ del mismo cobro → UNA factura, UNA huella, UNA fila en la cola', async () => {
  reiniciar();
  const cobro = nuevoCobroDeclarable();
  await conFlag(() => Promise.all([entrega(cobro), entrega(cobro)]));
  assert.equal(facturasDe(cobro).length, 1, 'una factura');
  assert.equal(sellados(), 1, 'sellada una vez: la huella no se toca');
  assert.deepEqual(constancias().map((a) => a.meta?.errorMensaje), [],
    'precondición: el registro se pudo montar (si no, los intentos no llegan a la cola y este caso no mide nada)');
  const cola = colaDe(facturasDe(cobro)[0].id);
  assert.equal(cola.length, 1,
    `🔴 LA MISMA FACTURA ESTÁ ${cola.length} VECES EN LA COLA DE LA AEAT: la entrega que pierde la carrera ha `
    + 'vuelto a encolar su alta.');
});

test('SCRUM-1333 · 🔴 una factura ya sellada que vuelve a pasar por `sellarTrasEmision` NO se encola otra vez — y su cadena queda BYTE A BYTE', async () => {
  reiniciar();
  const factura = await emitirUna();
  const antes = cadena();

  const dicho = await conFlag(async () => {
    const r = await sellarTrasEmision({ ...factura }, MERCHANT_ES, prisma);
    assert.equal(r.estado, 'sellado', 'la segunda pasada termina como sellada (la huella se conserva)');
  });

  assert.equal(colaDe(factura.id).length, 1,
    `🔴 LA MISMA FACTURA ESTÁ ${colaDe(factura.id).length} VECES EN LA COLA DE LA AEAT tras una segunda pasada por \`sellarTrasEmision\`.`);
  assert.deepEqual(cadena(), antes, '⛔ la cadena ha cambiado: este arreglo no toca ninguna huella');
  // ⚠️ No encolar NO es mudo, y NO es un fallo: se dice por consola y no deja `encolado_fallido`.
  assert.equal(dicho.warn.filter((l) => /ya ten[ií]a su alta en la cola/.test(l) && l.includes(factura.number)).length, 1,
    `🔴 MUDO: la pasada que no encola no lo dice. Dicho por warn: ${JSON.stringify(dicho.warn)}`);
  assert.equal(constancias().length, 0, '🔴 no encolar una alta que ya está en la cola se ha registrado como `encolado_fallido`');
});

test('SCRUM-1333 · 🔴 dos encolados A LA VEZ de la misma factura → UNA fila: la pregunta va DENTRO del cerrojo', async () => {
  // Es la carrera desnuda: los dos preguntan a la vez. Sin cerrojo, los dos oyen «no hay» y los
  // dos escriben. La cola se vacía antes para que ninguno encuentre la fila de la emisión.
  reiniciar();
  const factura = await emitirUna();
  banco.tablas.vfSubmission.length = 0;

  let resultados;
  await conFlag(async () => {
    resultados = await Promise.all([
      encolarAltaTrasSellado({ ...factura }, MERCHANT_ES, prisma),
      encolarAltaTrasSellado({ ...factura }, MERCHANT_ES, prisma),
    ]);
  });

  assert.equal(colaDe(factura.id).length, 1,
    `🔴 DOS ENCOLADOS A LA VEZ HAN DEJADO ${colaDe(factura.id).length} FILAS: preguntar y escribir no van bajo el mismo cerrojo.`);
  assert.deepEqual(resultados.map((r) => r.encolado).sort(), [false, true], 'uno encola y el otro dice que no');
  assert.equal(constancias().length, 0);
});

// ── ✅ LO QUE LA GUARDA NO PUEDE TAPAR ────────────────────────────────────────────────────────

test('SCRUM-1333 · ✅ si el PRIMER intento no llegó a la cola, la segunda pasada SÍ encola: manda la cola, no «quién selló»', async () => {
  // Una guarda del tipo «sólo encola la pasada que escribió la huella» dejaría esta alta sin
  // remitir para siempre: la huella ya está escrita y la cola, vacía.
  reiniciar();
  const cobro = nuevoCobroDeclarable();
  const modeloCola = prisma.vfSubmission;
  const crear = modeloCola.create;
  let fallos = 1;
  modeloCola.create = async (a) => { if (fallos > 0) { fallos--; throw new Error('la cola no responde'); } return crear(a); };
  try {
    await conFlag(() => entrega(cobro));
    const [factura] = facturasDe(cobro);
    assert.equal(factura.vfEstado, 'sellado', 'el fallo de la cola no des-sella');
    assert.equal(colaDe(factura.id).length, 0, 'SUELO: el primer intento no dejó fila');
    assert.deepEqual(constancias().map((a) => a.meta?.motivo), ['error'], 'y dejó su constancia');

    await conFlag(() => sellarTrasEmision({ ...factura }, MERCHANT_ES, prisma));

    assert.equal(colaDe(factura.id).length, 1,
      '🔴 UNA FACTURA SELLADA SE HA QUEDADO SIN ALTA EN LA COLA: la segunda pasada no ha encolado lo que la primera no pudo.');
    assert.equal(sellados(), 1, 'y la huella se escribió una sola vez');
  } finally { modeloCola.create = crear; }
});

test('SCRUM-1333 · ✅ regla 2: una fila de OTRO comercio no cuenta como «ya encolada»', async () => {
  // No puede pasar con la base real (el id de factura es único), y por eso mismo hay que
  // fabricarlo: sin este caso, quitar el comercio de la pregunta no lo notaría nadie.
  reiniciar();
  const factura = await emitirUna();
  banco.tablas.vfSubmission.length = 0;
  banco.tablas.vfSubmission.push({ id: nuevoId('vfSubmission'), merchantId: M_PT, invoiceId: factura.id, obligadoNif: 'X', tipoOperacion: 'Alta', registroXml: '<x/>' });

  await conFlag(() => encolarAltaTrasSellado({ ...factura }, MERCHANT_ES, prisma));

  assert.equal(colaDe(factura.id).filter((s) => s.merchantId === M_ES).length, 1,
    '🔴 la fila de otro comercio ha hecho de «ya encolada»: la pregunta no filtra por comercio (regla 2).');
});

test('SCRUM-1333 · ✅ una fila de OTRA operación de la misma factura no cuenta como su alta', async () => {
  reiniciar();
  const factura = await emitirUna();
  banco.tablas.vfSubmission.length = 0;
  banco.tablas.vfSubmission.push({ id: nuevoId('vfSubmission'), merchantId: M_ES, invoiceId: factura.id, obligadoNif: NIF, tipoOperacion: 'OtraOperacion', registroXml: '<x/>' });

  await conFlag(() => encolarAltaTrasSellado({ ...factura }, MERCHANT_ES, prisma));

  assert.equal(colaDe(factura.id).filter((s) => s.tipoOperacion === 'Alta').length, 1,
    '🔴 una fila que no es un alta ha impedido encolar el alta: la pregunta no mira el tipo de operación.');
});
