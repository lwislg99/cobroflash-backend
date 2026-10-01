// SCRUM-1304 · UN COBRO, UNA FACTURA.
//
// `ensureInvoiceForCharge` buscaba la factura de un cobro por dos vías —el evento `invoiced`, que
// se escribe AL FINAL, y la factura del presupuesto— y por `Invoice.chargeId` no buscaba. Así que:
//
//   ④b/④c dos entregas CONCURRENTES del mismo cobro (el retorno de `/recibo` y el aviso de Stripe
//         coinciden por diseño) → DOS facturas del mismo cobro;
//   ④e    SIN carrera: la primera entrega crea la factura y el PDF cae una vez → no se escribe el
//         evento → la entrega siguiente crea OTRA;
//   ④f    SIN carrera y SIN fallo: un cobro creado para COBRAR una factura que ya existe (el enlace
//         de pago de `invoiceWhatsApp.service`, que escribe `Invoice.chargeId`) → al pagarse, se
//         emitía una SEGUNDA factura por el mismo dinero.
//
// Medido y reproducido por J6 el 30-sep (④b, ④c, ④e); ④f lo midió J1d al construir este banco.
// GO del fundador: SCRUM-1304, comentario 17704.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 CÓMO SE MIDE: POR EFECTO, CON LAS RUTAS REALES, Y SIN DOBLAR LO QUE DECIDE
//
// Se cuenta lo que queda escrito: cuántas filas `Invoice` tiene el cobro. Y lo que corre es el
// código compilado tal cual: `/webhooks/psp`, `ensureInvoiceForCharge`, `allocateInvoiceNumber`
// (el de verdad, con su cerrojo y su registro), `crearFacturaEmitida` y `sellarTrasEmision`.
//
// La carrera se juega de DOS maneras, y hacen falta las dos:
//
//   · A LA VEZ: las dos entregas se lanzan juntas y se entrelazan solas en cada `await`;
//   · EN EL HUECO: cuando la primera pide el cerrojo de serie, se ejecuta ENTERA la ruta real de
//     la segunda, y luego sigue la primera. Es la forma de SCRUM-1303, y es la que separa el
//     arreglo entero del arreglo a medias: una búsqueda por `chargeId` puesta FUERA del cerrojo
//     ya ha contestado «no hay» cuando la otra entrega escribe.
//
// EL BANCO TIENE ESTADO (lo que se escribe se lee), evalúa el `where` entero con el evaluador de
// la casa (`_where-como-prisma.mjs`) y modela el cerrojo consultivo como lo que es: una exclusión
// por clave que se suelta al terminar la transacción, re-entrante dentro de la misma.
//
// 🔴 SUS LÍMITES, DICHOS:
//   · NO deshace una transacción que lanza (no hay rollback). Ningún caso de aquí lanza dentro.
//   · NO aísla: lo escrito dentro de una transacción se ve fuera antes del commit. Con el cerrojo
//     tomado en la primera sentencia, que es lo que se mide, eso no cambia ningún desenlace.
//   · NO es Postgres. La carrera contra una base real no se ha medido: en esta máquina no hay
//     ninguna, y darle una en CI es tocar un workflow.
//   · Se doblan el PDF (no escribe en disco; puede fallar a propósito) y el correo. Nada más.
import test from 'node:test';
import assert from 'node:assert/strict';
// El banco se importa ANTES de cargar `dist/`: deja el doble de la base, el PDF y el correo.
import {
  banco, prisma, reiniciar, nuevoId, POR_DEFECTO, requiere, rutaDe, asentar,
  M_PT, M_ES, CLIENTE, NS_SERIE,
} from './_banco-emision-con-estado.mjs';

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const { ensureInvoiceForCharge } = requiere(rutaDe('dist/lib/invoicing.js'));
const pspRouter = requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js'));
const capa = (pspRouter.default || pspRouter).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST / en psp.routes');
const pspH = capa.route.stack.at(-1).handle;

// ── LAS PIEZAS DE CADA CASO ───────────────────────────────────────────────────────────────

function nuevoCobro({ merchantId = M_PT, status = 'pending', amount = '121.00' } = {}) {
  const cobro = {
    id: nuevoId('charge'), merchantId, customerId: CLIENTE, status, amount, currency: 'EUR',
    concept: 'Arreglo de una fuga', method: 'card', reference: null, intentId: null, receiptToken: null, paidAt: null,
  };
  banco.tablas.charge.push(cobro);
  return cobro.id;
}

async function entrega(chargeId) {
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  await pspH({ body: { event: 'payment.confirmed', charge_id: chargeId, method: 'card', bank_ref: `cs_${chargeId}`, amount: 121, currency: 'EUR' }, headers: {} }, res, (e) => { if (e) throw e; });
  return r;
}

const facturasDe = (chargeId) => banco.tablas.invoice.filter((f) => f.chargeId === chargeId);
const eventosDe = (chargeId, tipo) => banco.tablas.event.filter((e) => e.chargeId === chargeId && e.type === tipo);

/** Corre `fn` con el flag encendido y apuntando lo que se dice por `console.error`. */
async function conFlag(fn) {
  const antes = config.AUTO_INVOICE_ON_PAID;
  const original = console.error;
  const dicho = [];
  console.error = (...a) => { dicho.push(a.map(String).join(' ')); };
  config.AUTO_INVOICE_ON_PAID = true;
  try { return { resultado: await fn(), dicho }; }
  finally { config.AUTO_INVOICE_ON_PAID = antes; console.error = original; }
}

const numeros = (fs) => fs.map((f) => f.number).join(' y ');

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1304 · SUELO: el banco tiene estado, evalúa el `where` entero y su cerrojo EXCLUYE', async () => {
  reiniciar();
  const a = await prisma.invoice.create({ data: { merchantId: M_PT, number: 'F260001', chargeId: 7 } });
  assert.equal((await prisma.invoice.findFirst({ where: { chargeId: 7, merchantId: M_PT } }))?.id, a.id, 'lo escrito se lee');
  assert.equal(await prisma.invoice.findFirst({ where: { chargeId: 7, merchantId: M_ES } }), null, '🔴 el banco ignora el merchant');
  assert.equal(await prisma.invoice.findFirst({ where: { chargeId: 8 } }), null, '🔴 el banco ignora el `chargeId`');
  assert.equal((await prisma.invoice.findMany({ where: { merchantId: M_PT, number: { startsWith: 'F26' } } })).length, 1);
  await assert.rejects(prisma.invoice.findFirst({ where: { number: { contains: 'F' } } }), /NO SABE EVALUAR/);
  await assert.rejects(prisma.invoice.update({ where: { id: a.id, status: 'paid' }, data: { status: 'x' } }), (e) => e.code === 'P2025');

  // El cerrojo: dos transacciones con la misma clave NO se solapan; con claves distintas, sí.
  const traza = [];
  const seccion = (nombre, clave) => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NS_SERIE}::int, ${clave}::int)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NS_SERIE}::int, ${clave}::int)`; // re-entrante: no se bloquea a sí misma
    traza.push(`${nombre}+`);
    await new Promise((r) => setTimeout(r, 5));
    traza.push(`${nombre}-`);
  });
  await Promise.all([seccion('a', 1), seccion('b', 1)]);
  assert.deepEqual(traza, ['a+', 'a-', 'b+', 'b-'], '🔴 el cerrojo del banco NO excluye: dos transacciones con la misma clave se han solapado');
  traza.length = 0;
  await Promise.all([seccion('a', 1), seccion('c', 2)]);
  assert.deepEqual(traza, ['a+', 'c+', 'a-', 'c-'], '🔴 el cerrojo del banco bloquea claves DISTINTAS: serializa de más y daría verdes falsos');
});

// ── LOS CONTROLES POSITIVOS: UN COBRO NORMAL SIGUE EMITIENDO **SU** FACTURA ───────────────

test('SCRUM-1304 · ✅ C · una sola entrega → UNA factura, con su número, su PDF y su evento', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  const { resultado } = await conFlag(() => entrega(cobro));
  await asentar();
  assert.equal(resultado.statusCode, 200);
  assert.equal(resultado.cuerpo.status, 'paid');
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1, `🔴 UN COBRO NORMAL HA DEJADO DE EMITIR SU FACTURA (hay ${fs.length}). Un arreglo que no emite ninguna es peor que el defecto.`);
  assert.match(fs[0].number, /^F\d{6}$/, 'con número de la serie');
  assert.equal(fs[0].pdfUrl, `/admin/invoices/${fs[0].id}/pdf`, 'con su PDF');
  assert.equal(fs[0].status, 'paid', 'y cobrada');
  assert.equal(eventosDe(cobro, 'invoiced').length, 1, 'y con su evento `invoiced`');
  assert.equal(banco.tomas.length >= 1, true, 'SUELO: se pasó por el cerrojo de serie (la reserva de número es la de verdad)');
});

test('SCRUM-1304 · ✅ dos cobros DISTINTOS del mismo merchant → dos facturas, una por cobro, correlativas', async () => {
  reiniciar();
  const uno = nuevoCobro();
  const dos = nuevoCobro();
  await conFlag(() => Promise.all([entrega(uno), entrega(dos)]));
  await asentar();
  assert.equal(facturasDe(uno).length, 1, '🔴 deduplicar por cobro se ha comido la factura de OTRO cobro');
  assert.equal(facturasDe(dos).length, 1, '🔴 deduplicar por cobro se ha comido la factura de OTRO cobro');
  assert.deepEqual(banco.tablas.invoice.map((f) => f.number).sort(), ['F260001', 'F260002'].map((n) => n.replace('26', String(new Date().getFullYear() % 100).padStart(2, '0'))), 'sin hueco ni repetido en la serie');
});

test('SCRUM-1304 · ✅ ④a · dos entregas SEGUIDAS → una factura (la segunda la encuentra por su evento)', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  const { resultado } = await conFlag(async () => [await entrega(cobro), await entrega(cobro)]);
  await asentar();
  assert.deepEqual(resultado.map((r) => r.cuerpo.status), ['paid', 'already_paid'], 'al proveedor se le contesta como siempre');
  assert.equal(facturasDe(cobro).length, 1);
});

test('SCRUM-1304 · ✅ ④d · el presupuesto del cobro YA tiene factura → no se emite otra', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  banco.tablas.quote.push({ id: 77, merchantId: M_PT, chargeId: cobro, lines: [], discountGlobalAmount: null });
  banco.tablas.invoice.push({ id: nuevoId('invoice'), ...POR_DEFECTO.invoice(), merchantId: M_PT, customerId: CLIENTE, number: 'F260001', total: '121.00', currency: 'EUR', lines: [{ concept: 'x', qty: 1, price: 121, tax: 0 }], type: 'F1', quoteId: 77, pdfUrl: 'PENDING_PDF', qrData: 'PENDING' });
  await conFlag(() => entrega(cobro));
  await asentar();
  assert.equal(banco.tablas.invoice.length, 1, `🔴 se ha emitido otra factura para un presupuesto que ya la tenía: ${numeros(banco.tablas.invoice)}`);
});

// ── 🔴 EL DEFECTO: DOS ENTREGAS DEL MISMO COBRO ───────────────────────────────────────────

test('SCRUM-1304 · 🔴 ④b · dos entregas A LA VEZ del mismo cobro → UNA factura', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  const { resultado } = await conFlag(() => Promise.all([entrega(cobro), entrega(cobro)]));
  await asentar();
  assert.deepEqual(resultado.map((r) => r.cuerpo.status), ['paid', 'paid'], 'precondición: las dos pasaron la barrera de `already_paid` — coincidieron de verdad');
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1,
    `🔴 UN COBRO HA EMITIDO ${fs.length} FACTURAS: ${numeros(fs)}. Las dos entregas buscaron la factura del `
    + 'cobro, ninguna la encontró, y las dos la crearon. La búsqueda por `chargeId` tiene que ir DENTRO '
    + 'del cerrojo de serie, antes de pedir número.');
  assert.equal(banco.tablas.merchant.find((m) => m.id === M_PT).nextInvoiceNumber, 2, '🔴 la entrega que no emitió ha consumido un número: hueco en la serie');
});

test('SCRUM-1304 · 🔴 ④b′ · la segunda entrega entra EN EL HUECO (la primera ya buscó y espera el cerrojo) → UNA factura', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  let enMedio = null;
  // La primera entrega marca el cobro pagado y busca su factura; cuando va a pedir el cerrojo, la
  // otra entrega —la ruta real, entera— entra, emite y termina. Es el retorno de `/recibo` contra
  // el aviso de Stripe.
  banco.alPedirCerrojoDeSerie = async () => { enMedio = await entrega(cobro); };
  const { resultado } = await conFlag(() => entrega(cobro));
  await asentar();
  assert.equal(enMedio?.statusCode, 200, 'precondición: la entrega de en medio entró');
  assert.equal(facturasDe(cobro).length >= 1, true, 'precondición: la de en medio emitió');
  assert.equal(resultado.cuerpo.status, 'paid', 'al proveedor se le contesta como siempre (GO c.17639: la respuesta no cambia)');
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1,
    `🔴 UN COBRO HA EMITIDO ${fs.length} FACTURAS: ${numeros(fs)}. La primera entrega había buscado ANTES de `
    + 'tomar el cerrojo y contestado «no hay»; mientras esperaba, la otra emitió. Una búsqueda fuera '
    + 'del cerrojo es el arreglo a medias: la pregunta tiene que repetirse DENTRO, antes de pedir número.');
  assert.equal(banco.tablas.merchant.find((m) => m.id === M_PT).nextInvoiceNumber, 2, '🔴 la entrega que no emitió ha consumido un número: hueco en la serie');
});

test('SCRUM-1304 · 🔴 ④c · dos entregas a la vez, con presupuesto aún SIN factura → UNA factura', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  banco.tablas.quote.push({ id: 77, merchantId: M_PT, chargeId: cobro, lines: [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }], discountGlobalAmount: null });
  const { dicho } = await conFlag(() => Promise.all([entrega(cobro), entrega(cobro)]));
  await asentar();
  assert.deepEqual(dicho.filter((l) => l.includes('auto-invoice error')), [], 'precondición: ninguna de las dos entregas falló al emitir (un rojo por no emitir no es este rojo)');
  const fs = banco.tablas.invoice.filter((f) => f.quoteId === 77);
  assert.equal(fs.length, 1, `🔴 EL PRESUPUESTO 77 TIENE ${fs.length} FACTURAS DEL MISMO COBRO: ${numeros(fs)}`);
  assert.equal(fs[0].chargeId, cobro, 'y es la del cobro');
});

test('SCRUM-1304 · 🔴 ④e · SIN CARRERA: el PDF cae una vez → la entrega siguiente NO crea otra, y TERMINA la que hay', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  banco.pdf.fallos = 1;
  const { resultado, dicho } = await conFlag(async () => {
    const primera = await entrega(cobro);
    const trasLaPrimera = { facturas: facturasDe(cobro).length, eventos: eventosDe(cobro, 'invoiced').length, pdf: facturasDe(cobro)[0]?.pdfUrl };
    const segunda = await entrega(cobro);
    return { primera, trasLaPrimera, segunda };
  });
  await asentar();
  assert.deepEqual(resultado.trasLaPrimera, { facturas: 1, eventos: 0, pdf: 'PENDING_PDF' },
    'precondición: la primera entrega creó la factura, el PDF cayó y el evento `invoiced` NO se escribió');
  assert.ok(dicho.some((l) => l.includes('auto-invoice error') && l.includes('pdf_caido_a_proposito')), 'y el fallo del PDF quedó dicho');
  assert.equal(resultado.segunda.cuerpo.status, 'already_paid');
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1,
    `🔴 UN COBRO HA EMITIDO ${fs.length} FACTURAS SIN NINGUNA CARRERA: ${numeros(fs)}. Lo que marcaba «ya está `
    + 'hecha» —el evento `invoiced`— se escribe al final; el PDF cayó antes, y la entrega siguiente no '
    + 'encontró nada. La factura lleva su `chargeId` desde que nace: es por ahí por donde se busca.');
  assert.equal(fs[0].pdfUrl, `/admin/invoices/${fs[0].id}/pdf`, '🔴 la segunda entrega no ha TERMINADO la factura que quedó a medias: sigue sin PDF');
  assert.equal(eventosDe(cobro, 'invoiced').length, 1, 'y ahora sí tiene su evento');
});

test('SCRUM-1304 · 🔴 ④f · SIN CARRERA NI FALLO: un cobro creado para COBRAR una factura que ya existe → no se emite una segunda', async () => {
  // El enlace de pago de una factura ya emitida (`invoiceWhatsApp.service`): crea el cobro y escribe
  // `Invoice.chargeId`. No hay evento `invoiced` (esa factura no nació del cobro) ni presupuesto.
  reiniciar();
  const cobro = nuevoCobro();
  banco.tablas.invoice.push({ id: nuevoId('invoice'), ...POR_DEFECTO.invoice(), merchantId: M_PT, customerId: CLIENTE, number: 'F260001', total: '121.00', currency: 'EUR', lines: [{ concept: 'Arreglo de una fuga', qty: 1, price: 121, tax: 0 }], type: 'F1', chargeId: cobro, vfEstado: 'no_aplica', pdfUrl: 'PENDING_PDF', qrData: 'PENDING' });
  await conFlag(() => entrega(cobro));
  await asentar();
  const fs = banco.tablas.invoice;
  assert.equal(fs.length, 1,
    `🔴 AL COBRAR UNA FACTURA SE HA EMITIDO OTRA POR EL MISMO DINERO: ${numeros(fs)}. El cobro era el `
    + 'enlace de pago de una factura ya emitida, que lleva su `chargeId`.');
  assert.equal(fs[0].status, 'paid', 'y la que había queda cobrada');
});

// ── ⚠️ QUE LA ENTREGA QUE NO EMITE NO SE CALLE ────────────────────────────────────────────

test('SCRUM-1304 · ⚠️ la entrega que NO emite lo DICE: nombra el cobro y la factura que ya había', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  banco.alPedirCerrojoDeSerie = async () => { await entrega(cobro); };
  const { dicho } = await conFlag(() => entrega(cobro));
  await asentar();
  const numero = facturasDe(cobro)[0].number;
  const avisos = dicho.filter((l) => l.includes('SCRUM-1304'));
  assert.equal(avisos.length, 1,
    `🔴 LA ENTREGA QUE PERDIÓ LA CARRERA NO HA DEJADO NI UNA LÍNEA (${avisos.length} avisos; lo dicho: ${JSON.stringify(dicho)}). `
    + 'Un arreglo cuya negativa no se ve queda escrito y no se entera nadie (SCRUM-1315).');
  assert.ok(avisos[0].includes(String(cobro)) && avisos[0].includes(numero), `el aviso nombra el cobro ${cobro} y la factura ${numero}: «${avisos[0]}»`);
});

test('SCRUM-1304 · ⚠️ y un cobro normal NO dice nada: el aviso no es ruido', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  const { dicho } = await conFlag(() => entrega(cobro));
  await asentar();
  assert.deepEqual(dicho.filter((l) => l.includes('SCRUM-1304')), [], 'una emisión normal no avisa de un duplicado que no hubo');
});

// ── LA FUNCIÓN SUELTA: las otras bocas (`POST /invoice/issue`, MercadoPago) entran por aquí ──

test('SCRUM-1304 · 🔴 `ensureInvoiceForCharge` a secas, dos llamadas a la vez sobre un cobro pagado → UNA factura', async () => {
  reiniciar();
  const cobro = nuevoCobro({ status: 'paid' });
  const { resultado } = await conFlag(() => Promise.all([ensureInvoiceForCharge(cobro, prisma), ensureInvoiceForCharge(cobro, prisma)]));
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1, `🔴 DOS LLAMADAS, ${fs.length} FACTURAS: ${numeros(fs)}. No es cosa de la ruta: es la función.`);
  assert.deepEqual(resultado.map((f) => f.id), [fs[0].id, fs[0].id], 'y las dos llamadas devuelven LA MISMA factura');
});


test('SCRUM-1304 · ⛔ regla 2: una factura de OTRO merchant con ese `chargeId` no es «la del cobro»', async () => {
  // No debería existir: un cobro es de un merchant. Pero si existiera, devolverla sería entregarle a
  // un merchant la factura de otro. La pregunta va acotada, y este caso es lo único que lo sujeta.
  reiniciar();
  const cobro = nuevoCobro({ status: 'paid' });
  banco.tablas.invoice.push({ id: nuevoId('invoice'), ...POR_DEFECTO.invoice(), merchantId: M_ES, customerId: CLIENTE, number: 'F269999', total: '121.00', currency: 'EUR', lines: [], type: 'F1', chargeId: cobro, vfEstado: 'sellado', pdfUrl: 'PENDING_PDF', qrData: 'PENDING' });
  const { resultado } = await conFlag(() => ensureInvoiceForCharge(cobro, prisma));
  assert.equal(resultado.merchantId, M_PT, '🔴 SE HA DEVUELTO LA FACTURA DE OTRO MERCHANT como si fuera la de este cobro');
  assert.notEqual(resultado.number, 'F269999');
});

// ── ⚠️ ESPAÑA · LO QUE ESTE ARREGLO NO CIERRA, FIJADO COMO ESTÁ (SCRUM-1330) ─────────────────
//
// 🔴 NADA DE LO QUE SIGUE ES EL COMPORTAMIENTO DESEADO. Es el que hay, medido, y está aquí para que
// no se pueda cambiar sin enterarse. `ensurePdfAndEvent` llama a `sellarTrasEmision` SIEMPRE, y el
// sellado no comprueba si la factura ya está sellada: recalcula y pisa `vfHash`, `vfPrevHash` y
// `vfTimestamp`. Deduplicar por cobro mete a la factura que ya existía por ese mismo embudo.
//
// Cerrarlo es tocar el sellado, y el GO de SCRUM-1304 (c.17704) lo excluye expresamente: decide el
// fundador en SCRUM-1330. Cuando se arregle, estos tres casos CAEN: se reescriben con lo contrario
// —la huella no cambia, se sella una vez— en el mismo cambio.
//
// Se cuentan SELLADOS (la línea `[verifactu]` que deja cada uno) y no sólo la huella: dos sellados
// en el mismo segundo dan la misma huella, y un «huella igual» escondería el segundo.

/** Corre `fn` con el flag encendido y devuelve cuántas veces se selló. */
async function contandoSellados(fn) {
  const original = console.log;
  const sellados = [];
  console.log = (...a) => { const l = a.map(String).join(' '); if (l.startsWith('[verifactu]')) sellados.push(l); };
  try { await conFlag(fn); } finally { console.log = original; }
  await asentar();
  return sellados;
}

const selladaDeAntes = (extra) => ({
  id: nuevoId('invoice'), ...POR_DEFECTO.invoice(), merchantId: M_ES, customerId: CLIENTE, total: '121.00', currency: 'EUR',
  lines: [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }], type: 'F1', vfEstado: 'sellado',
  pdfUrl: 'PENDING_PDF', qrData: 'https://ejemplo.invalid/qr', ...extra,
});

test('SCRUM-1304 · ✅ ESPAÑA · C: una sola entrega → una factura, SELLADA UNA VEZ', async () => {
  reiniciar();
  const cobro = nuevoCobro({ merchantId: M_ES });
  const sellados = await contandoSellados(() => entrega(cobro));
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1);
  assert.equal(fs[0].vfEstado, 'sellado', 'SUELO: el merchant de España entra en la cadena (si no, lo de abajo no mide nada)');
  assert.match(fs[0].vfHash ?? '', /^[0-9A-F]{64}$/, 'con su huella');
  assert.equal(sellados.length, 1, 'y se selló exactamente una vez');
});

test('SCRUM-1304 · ⚠️ RESIDUAL CONOCIDO (SCRUM-1330) · ESPAÑA ④a: una entrega REPETIDA vuelve a sellar la misma factura — ya pasaba antes de este arreglo', async () => {
  reiniciar();
  const cobro = nuevoCobro({ merchantId: M_ES });
  let selloPrimero = null;
  const sellados = await contandoSellados(async () => {
    await entrega(cobro);
    selloPrimero = facturasDe(cobro)[0].vfTimestamp;
    await entrega(cobro);
  });
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1, 'una sola factura');
  assert.equal(sellados.length, 2,
    '⚠️ la entrega repetida YA NO vuelve a sellar. Si es a propósito (SCRUM-1330), reescribe este caso con lo '
    + 'contrario —se sella UNA vez y la huella no cambia— en el mismo cambio.');
  assert.notEqual(fs[0].vfTimestamp, selloPrimero, 'y el sello de la fila se ha reescrito: una factura sellada, editada');
});

test('SCRUM-1304 · ⚠️ RESIDUAL CONOCIDO (SCRUM-1330) · ESPAÑA ④b: dos entregas a la vez → UNA factura, pero sellada DOS veces', async () => {
  reiniciar();
  const cobro = nuevoCobro({ merchantId: M_ES });
  const sellados = await contandoSellados(() => Promise.all([entrega(cobro), entrega(cobro)]));
  assert.equal(facturasDe(cobro).length, 1, '🔴 el arreglo de SCRUM-1304 ha dejado de valer en España: dos facturas del mismo cobro');
  assert.equal(sellados.length, 2,
    '⚠️ la entrega que no emite YA NO vuelve a sellar la factura que encontró. Si es a propósito (SCRUM-1330), '
    + 'reescribe este caso con lo contrario en el mismo cambio.');
});

test('SCRUM-1304 · ⚠️ RESIDUAL CONOCIDO (SCRUM-1330) · ESPAÑA ④f: cobrar el enlace de una factura sellada hace tiempo la RE-SELLA y rompe la cadena', async () => {
  // 🔴 ÉSTE ES EL MOTIVO POR EL QUE EL ARREGLO NO PUEDE ENTRAR SOLO. Sin él, main emite una factura
  // duplicada y deja la cadena intacta. Con él no se duplica, pero la que había se vuelve a sellar.
  reiniciar();
  const H1 = 'A'.repeat(64);
  const H2 = 'B'.repeat(64);
  const cobro = nuevoCobro({ merchantId: M_ES });
  const vieja = selladaDeAntes({ number: 'F260001', chargeId: cobro, vfHash: H1, vfPrevHash: '', vfTimestamp: new Date('2026-09-01T10:00:00Z'), createdAt: new Date('2026-09-01T10:00:00Z') });
  const posterior = selladaDeAntes({ number: 'F260002', vfHash: H2, vfPrevHash: H1, vfTimestamp: new Date('2026-09-02T10:00:00Z'), createdAt: new Date('2026-09-02T10:00:00Z') });
  banco.tablas.invoice.push(vieja, posterior);
  const sellados = await contandoSellados(() => entrega(cobro));
  assert.equal(banco.tablas.invoice.length, 2, '🔴 se ha emitido otra factura por el mismo dinero (las dos de partida y ninguna más)');
  assert.equal(posterior.vfPrevHash, H1, 'la posterior no se toca: sigue apuntando a la huella con la que se selló');
  assert.equal(sellados.length, 1,
    '⚠️ cobrar el enlace de una factura ya sellada YA NO la vuelve a sellar. Si es a propósito (SCRUM-1330), '
    + 'reescribe este caso con lo contrario —huella, anterior y sello idénticos byte a byte— en el mismo cambio.');
  assert.notEqual(vieja.vfHash, H1, 'la huella de la factura sellada hace un mes HA CAMBIADO');
  assert.equal(vieja.vfPrevHash, H2, 'y ahora se encadena a la que se selló DESPUÉS de ella');
  assert.equal(banco.tablas.invoice.some((f) => f.vfHash === posterior.vfPrevHash), false,
    'así que la posterior apunta a una huella que ya no tiene ninguna factura: la cadena está rota');
});
