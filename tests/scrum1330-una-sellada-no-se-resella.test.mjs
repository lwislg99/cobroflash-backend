// SCRUM-1330 · UNA FACTURA SELLADA NO SE VUELVE A SELLAR.
//
// `ensurePdfAndEvent` llamaba a `sellarTrasEmision` SIEMPRE, y `applyVeriFactu` no comprobaba si la
// factura ya estaba sellada: recalculaba y PISABA `vfHash`, `vfPrevHash` y `vfTimestamp`. Una
// factura emitida, editada por el propio código (regla 29 del máster).
//
// GO del fundador: SCRUM-1330, comentario 17724 («1-GO»), con sus límites. Autoriza dos guardas:
//
//   A · en el punto de llamada: `ensurePdfAndEvent` no llama a `sellarTrasEmision` si la fila que
//       tiene en la mano ya está `sellado`;
//   B · dentro del cerrojo: `applyVeriFactu`, tras tomarlo, no recalcula si la fila ya tiene huella.
//
// Hacen falta las dos. La A sola deja pasar a la entrega que leyó la fila ANTES de que la otra la
// sellara (④b). La B sola cierra la huella, pero deja entrar a `sellarTrasEmision`, que después del
// sellado ENCOLA el alta para la AEAT.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 CÓMO SE MIDE: POR EFECTO, SOBRE LO QUE QUEDA ESCRITO
//
//   · LA CADENA, BYTE A BYTE: se serializa lo persistido de cada factura (huella, anterior, sello
//     con sus milisegundos, QR, estado) antes y después, y se comparan las líneas y su sha256. Si
//     algo cambia, el fallo nombra la factura.
//   · LOS SELLADOS SE CUENTAN POR ESCRITURAS de `vfHash` en la fila, no por la huella: dos sellados
//     en el mismo segundo dan la misma huella, y un «huella igual» escondería el segundo. Y no por
//     una línea de log, que es texto y cambia con la redacción.
//
// Corre `dist/` tal cual sobre el banco con estado de SCRUM-1304 (`_banco-emision-con-estado.mjs`),
// que dobla la base, el PDF y el correo, y nada más. Sus límites están escritos allí: NO es Postgres.
//
// 🔴 LA SECCIÓN «TRANSCRIPCIÓN DE scrum173» Y LO QUE VALE. `tests/scrum173-…` fija el sellado contra
// una base real y está gateado (`QA_DB_TEST`): no corre en `npm test` ni en CI. Aquí van sus casos,
// con sus mismas llamadas y sus mismas aserciones, sobre el banco. La asimetría, dicha:
//   · si esta transcripción cae, hay un choque con lo que `scrum173` fija, y basta para parar;
//   · si pasa, NO prueba que el test real pase: el banco puede no montar lo que monta Postgres.
// ⛔ `tests/scrum173-…` no se toca desde este ticket (límite expreso del GO).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
// El banco se importa ANTES de cargar `dist/`: deja el doble de la base, el PDF y el correo.
import {
  banco, prisma, reiniciar, nuevoId, POR_DEFECTO, requiere, rutaDe, asentar,
  M_ES, CLIENTE,
} from './_banco-emision-con-estado.mjs';

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const vf = requiere(rutaDe('dist/modules/invoicing/domain/verifactu.service.js'));
const { applyVeriFactu, applyVeriFactuAnulacion, computeVeriFactuHash, formatDateES, formatFechaHoraHuso } = vf;
const { sellarTrasEmision } = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { calcVatCuotaTotal } = requiere(rutaDe('dist/modules/invoicing/domain/vat.service.js'));
const pspRouter = requiere(rutaDe('dist/modules/billing/app/routes/psp.routes.js'));
const capa = (pspRouter.default || pspRouter).stack.find((l) => l.route?.path === '/' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST / en psp.routes');
const pspH = capa.route.stack.at(-1).handle;

const NIF = 'B27000001'; // el del merchant de España del banco
const ZONA = 'Europe/Madrid';
const MERCHANT_ES = { country: 'ES', taxId: NIF, email: 'lugo@ejemplo.invalid' };

// ── LAS PIEZAS ────────────────────────────────────────────────────────────────────────────

/** Como el `crearFactura` de `tests/scrum173`: los mismos datos, sobre el banco. */
async function crearFactura(numero, createdAt) {
  return prisma.invoice.create({
    data: {
      merchantId: M_ES, customerId: CLIENTE, number: numero, status: 'pending',
      total: '121.00', currency: 'EUR', type: 'F1',
      lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
      pdfUrl: '', qrData: '',
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

function nuevoCobro() {
  const cobro = {
    id: nuevoId('charge'), merchantId: M_ES, customerId: CLIENTE, status: 'pending', amount: '121.00', currency: 'EUR',
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

/** Corre `fn` con la emisión automática encendida y en silencio (lo que se dice no se mide aquí). */
async function conFlag(fn) {
  const antes = config.AUTO_INVOICE_ON_PAID;
  const voces = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  config.AUTO_INVOICE_ON_PAID = true;
  try { return await fn(); }
  finally { config.AUTO_INVOICE_ON_PAID = antes; Object.assign(console, voces); await asentar(); }
}

const enSilencio = async (fn) => {
  const voces = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try { return await fn(); } finally { Object.assign(console, voces); await asentar(); }
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/** Más de un segundo: la huella lleva el sello truncado al segundo, así que un re-sellado la CAMBIA. */
const OTRO_SEGUNDO = 1100;

const facturasDe = (chargeId) => banco.tablas.invoice.filter((f) => f.chargeId === chargeId);
const fila = (id) => banco.tablas.invoice.find((f) => f.id === id);

/** Cuántas veces se ha ESCRITO una huella de alta en una fila: los sellados, por efecto. */
const sellados = () => banco.escriturasFactura.filter((e) => e.campos.includes('vfHash')).length;
/** Cuántas veces se ha escrito el estado del sellado: cada pasada por `sellarTrasEmision`. */
const pasosPorSellarTrasEmision = () => banco.escriturasFactura.filter((e) => e.campos.includes('vfEstado')).length;
/** Intentos de encolar el alta para la AEAT: los que llegaron a la cola más los que dejaron constancia de no llegar. */
const intentosDeEncolar = () => banco.tablas.vfSubmission.length
  + banco.tablas.auditLog.filter((a) => a.action === 'encolado_fallido').length;

/** Lo persistido de la cadena, una línea por factura, y su sha256. */
function cadena() {
  const lineas = [...banco.tablas.invoice].sort((a, b) => a.id - b.id).map((f) => [
    `factura=${f.number}`, `estado=${f.vfEstado}`, `huella=${f.vfHash}`, `anterior=${JSON.stringify(f.vfPrevHash)}`,
    `sello=${f.vfTimestamp instanceof Date ? f.vfTimestamp.toISOString() : f.vfTimestamp}`, `qr=${f.qrData}`,
    `anulacion=${f.vfAnulHash}`,
  ].join(' · '));
  return { lineas, sha256: crypto.createHash('sha256').update(lineas.join('\n')).digest('hex') };
}

function exigirCadenaIntacta(antes, que) {
  const despues = cadena();
  assert.deepEqual(despues.lineas, antes.lineas, `🔴 LA CADENA PERSISTIDA HA CAMBIADO ${que}. Una factura sellada no se edita (regla 29 del máster).`);
  assert.equal(despues.sha256, antes.sha256, `🔴 el sha256 de la cadena ha cambiado ${que}`);
}

/** Recalcula la huella de una fila con lo que tiene persistido. Si no sale la misma, no es reproducible. */
function huellaRecalculada(f) {
  return computeVeriFactuHash({
    nif: NIF, serie: f.number, fecha: formatDateES(f.createdAt, ZONA), tipoFactura: 'F1',
    cuotaTotal: calcVatCuotaTotal(f.lines).toFixed(2), importeTotal: Number(String(f.total)).toFixed(2),
    prevHash: f.vfPrevHash ?? '', timestamp: formatFechaHoraHuso(f.vfTimestamp, ZONA),
  });
}

const selladaDeAntes = (extra) => ({
  id: nuevoId('invoice'), ...POR_DEFECTO.invoice(), merchantId: M_ES, customerId: CLIENTE, total: '121.00', currency: 'EUR',
  lines: [{ concept: 'Arreglo de una fuga', qty: 1, price: 100, tax: 0.21 }], type: 'F1', vfEstado: 'sellado',
  pdfUrl: 'PENDING_PDF', qrData: 'https://ejemplo.invalid/qr', ...extra,
});

// ── SUELO Y POSITIVO: UNA FACTURA QUE SE SELLA POR PRIMERA VEZ SE SIGUE SELLANDO IGUAL ────────

test('SCRUM-1330 · SUELO Y ✅ POSITIVO: el primer sellado escribe la huella UNA vez, encadenada y reproducible', async () => {
  reiniciar();
  const antes = cadena();
  assert.equal(antes.lineas.length, 0, 'SUELO: el banco arranca sin facturas');
  const a = await crearFactura('F260001');
  const b = await crearFactura('F260002');
  const c = await crearFactura('F260003');
  const [sa, sb, sc] = await enSilencio(async () => [
    await applyVeriFactu(a, NIF, prisma), await applyVeriFactu(b, NIF, prisma), await applyVeriFactu(c, NIF, prisma),
  ]);
  assert.equal(sellados(), 3, 'SUELO: el contador de sellados VE los sellados (tres facturas, tres escrituras de huella)');
  assert.notEqual(cadena().sha256, antes.sha256, 'SUELO: la serialización de la cadena VE un sellado (si no, «intacta» no mediría nada)');
  for (const s of [sa, sb, sc]) assert.match(s.vfHash, /^[0-9A-F]{64}$/, 'con su huella');
  assert.equal(sa.vfPrevHash, '', 'la primera del emisor abre la cadena');
  assert.equal(sb.vfPrevHash, sa.vfHash, '🔴 la segunda no encadena a la primera');
  assert.equal(sc.vfPrevHash, sb.vfHash, '🔴 la tercera no encadena a la segunda');
  for (const [f, s] of [[a, sa], [b, sb], [c, sc]]) {
    const p = fila(f.id);
    assert.equal(p.vfHash, s.vfHash, 'lo que devuelve es lo que persiste');
    assert.equal(p.vfPrevHash, s.vfPrevHash);
    assert.equal(p.qrData, s.qrUrl);
    assert.equal(huellaRecalculada(p), p.vfHash, `🔴 la huella de ${p.number} no se reproduce con lo persistido`);
  }
});

// ── TRANSCRIPCIÓN DE `tests/scrum173` — sus casos, sobre el banco (ver la cabecera) ───────────

test('SCRUM-1330 · transcripción de scrum173 ①: sellar DENTRO de una transacción sigue prohibido', async () => {
  reiniciar();
  const inv = await crearFactura('QA173A');
  const ok = await enSilencio(() => applyVeriFactu(inv, NIF, prisma));
  assert.ok(ok.vfHash && ok.vfHash.length === 64, 'con el cliente global debe sellar');
  const inv2 = await crearFactura('QA173A2');
  await assert.rejects(
    () => prisma.$transaction(async (tx) => applyVeriFactu(inv2, NIF, tx)),
    (err) => { assert.match(err.message, /verifactu_seal_inside_transaction/); return true; },
  );
  assert.equal(fila(inv2.id).vfHash, null, 'y no debe haber sellado nada a medias');
});

test('SCRUM-1330 · transcripción de scrum173 ②: dos facturas con el MISMO createdAt encadenan de forma determinista', async () => {
  reiniciar();
  const mismoInstante = new Date();
  const a = await crearFactura('QA173B1', mismoInstante);
  const b = await crearFactura('QA173B2', mismoInstante);
  assert.equal(a.createdAt.getTime(), b.createdAt.getTime(), 'el empate de createdAt es la premisa');
  assert.ok(b.id > a.id);
  const selloA = await enSilencio(() => applyVeriFactu(a, NIF, prisma));
  const selloB = await enSilencio(() => applyVeriFactu(b, NIF, prisma));
  assert.equal(selloA.vfPrevHash, '');
  assert.equal(selloB.vfPrevHash, selloA.vfHash, '🔴 CADENA ROTA: con createdAt empatado, la segunda no encadenó a la primera');
  assert.notEqual(selloA.vfHash, selloB.vfHash);
});

test('SCRUM-1330 · transcripción de scrum173 ③: dos sellados CONCURRENTES de facturas distintas se serializan', async () => {
  reiniciar();
  const a = await crearFactura('QA173C1');
  const b = await crearFactura('QA173C2');
  const [s1, s2] = await enSilencio(() => Promise.all([applyVeriFactu(a, NIF, prisma), applyVeriFactu(b, NIF, prisma)]));
  assert.notEqual(s1.vfPrevHash, s2.vfPrevHash, '🔴 CADENA ROTA: dos sellados concurrentes encadenaron al MISMO registro anterior');
  const primera = s1.vfPrevHash === '' ? s1 : s2;
  const segunda = s1.vfPrevHash === '' ? s2 : s1;
  assert.equal(primera.vfPrevHash, '');
  assert.equal(segunda.vfPrevHash, primera.vfHash);
});

test('SCRUM-1330 · transcripción de scrum173b: la ANULACIÓN encadena al alta, y dentro de una transacción se rechaza', async () => {
  reiniciar();
  const inv = await crearFactura('QA173D');
  const alta = await enSilencio(() => applyVeriFactu(inv, NIF, prisma));
  assert.ok(alta.vfHash);
  const anul = await enSilencio(() => applyVeriFactuAnulacion(inv, NIF, prisma));
  assert.equal(anul.vfPrevHash, alta.vfHash, '🔴 la anulación debe encadenar al alta: es la MISMA cadena');
  const inv2 = await crearFactura('QA173D2');
  await enSilencio(() => applyVeriFactu(inv2, NIF, prisma));
  await assert.rejects(
    () => prisma.$transaction(async (tx) => applyVeriFactuAnulacion(inv2, NIF, tx)),
    (err) => { assert.match(err.message, /verifactu_seal_inside_transaction/); return true; },
  );
});

test('SCRUM-1330 · transcripción de scrum173 (SCRUM-177): el alta siguiente a una ANULACIÓN encadena a ELLA', async () => {
  reiniciar();
  const a = await crearFactura('QA177A');
  const selloA = await enSilencio(() => applyVeriFactu(a, NIF, prisma));
  assert.equal(selloA.vfPrevHash, '');
  const anul = await enSilencio(() => applyVeriFactuAnulacion(a, NIF, prisma));
  assert.equal(anul.vfPrevHash, selloA.vfHash);
  const b = await crearFactura('QA177B');
  const selloB = await enSilencio(() => applyVeriFactu(b, NIF, prisma));
  assert.equal(selloB.vfPrevHash, anul.vfAnulHash, '🔴 DOS CADENAS: el alta B saltó la anulación');
  assert.notEqual(selloB.vfPrevHash, selloA.vfHash);
});

test('SCRUM-1330 · transcripción de scrum173 (SCRUM-177, excluirId): «resellar» un alta no la encadena a sí misma', async () => {
  // 🔴 ÉSTE ES EL CASO QUE DECIDÍA SI LA GUARDA B PODÍA ESCRIBIRSE. Sus aserciones son las del test
  // real, literales: lo que devuelve la SEGUNDA llamada no encadena a la huella de la primera, y su
  // anterior es vacío. No exige que la segunda llamada produzca una huella NUEVA.
  reiniciar();
  const inv = await crearFactura('QA177C');
  const primero = await enSilencio(() => applyVeriFactu(inv, NIF, prisma));
  assert.equal(primero.vfPrevHash, '', 'primer sellado: abre la cadena');
  const segundo = await enSilencio(() => applyVeriFactu(inv, NIF, prisma));
  assert.notEqual(segundo.vfPrevHash, primero.vfHash, '🔴 BUCLE: la factura se encadenó a su propia huella al resellar');
  assert.equal(segundo.vfPrevHash, '', 'sigue siendo la única de la cadena: prev vacío');
});

// ── B · DENTRO DEL CERROJO: `applyVeriFactu` NO RECALCULA LO YA SELLADO ───────────────────────

test('SCRUM-1330 · 🔴 B · `applyVeriFactu` sobre una factura YA sellada, con otra encadenada detrás → la cadena queda BYTE A BYTE', async () => {
  reiniciar();
  const a = await crearFactura('F260001');
  const b = await crearFactura('F260002');
  const [sa] = await enSilencio(async () => [await applyVeriFactu(a, NIF, prisma), await applyVeriFactu(b, NIF, prisma)]);
  const antes = cadena();
  const selladosAntes = sellados();
  await esperar(OTRO_SEGUNDO);

  const otraVez = await enSilencio(() => applyVeriFactu(a, NIF, prisma));

  exigirCadenaIntacta(antes, 'al volver a pasar por el sellado una factura que ya tenía huella');
  assert.equal(sellados(), selladosAntes, '🔴 se ha ESCRITO otra huella en una fila ya sellada');
  assert.deepEqual(otraVez, { vfHash: sa.vfHash, vfPrevHash: sa.vfPrevHash, qrUrl: sa.qrUrl },
    'y lo que devuelve es el sello que ya había, no uno nuevo');
  assert.equal(fila(b.id).vfPrevHash, fila(a.id).vfHash, 'la posterior sigue apuntando a una huella que EXISTE');
});

test('SCRUM-1330 · 🔴 B · dos sellados A LA VEZ de la MISMA factura → se escribe UNA huella, y los dos devuelven la misma', async () => {
  reiniciar();
  const a = await crearFactura('F260001');
  const [s1, s2] = await enSilencio(() => Promise.all([applyVeriFactu(a, NIF, prisma), applyVeriFactu(a, NIF, prisma)]));
  assert.equal(sellados(), 1, `🔴 UNA FACTURA SELLADA ${sellados()} VECES: la que esperaba el cerrojo no miró si la otra ya la había sellado`);
  assert.deepEqual(s2, s1, 'los dos llamadores reciben el mismo sello');
  assert.equal(fila(a.id).vfHash, s1.vfHash);
});

test('SCRUM-1330 · ✅ B · una fila con huella que se quedó `pendiente_de_sellado` se TERMINA sin tocarle la huella', async () => {
  // El proceso murió entre escribir la huella y marcar el estado. El reintento tiene que dejarla
  // `sellado` — con B no es un no-op entero: es «conserva la huella y termina lo demás».
  reiniciar();
  const a = await crearFactura('F260001');
  await enSilencio(() => applyVeriFactu(a, NIF, prisma));
  assert.equal(fila(a.id).vfEstado, 'pendiente_de_sellado', 'precondición: sellada a medias');
  const huella = { h: fila(a.id).vfHash, p: fila(a.id).vfPrevHash, t: fila(a.id).vfTimestamp.toISOString(), q: fila(a.id).qrData };
  await esperar(OTRO_SEGUNDO);
  const r = await enSilencio(() => sellarTrasEmision(a, MERCHANT_ES, prisma));
  assert.equal(r.estado, 'sellado');
  assert.equal(fila(a.id).vfEstado, 'sellado', '🔴 el reintento no ha terminado la factura');
  assert.deepEqual({ h: fila(a.id).vfHash, p: fila(a.id).vfPrevHash, t: fila(a.id).vfTimestamp.toISOString(), q: fila(a.id).qrData }, huella,
    '🔴 terminar una factura sellada a medias le ha cambiado la huella');
});

// ── POR LA RUTA REAL: LOS TRES CASOS DEL TICKET, EN ESPAÑA ────────────────────────────────────

test('SCRUM-1330 · 🔴 ④a · ESPAÑA: una entrega REPETIDA del mismo cobro no toca la factura ya sellada', async () => {
  // El que ya ocurría en `main` sin ningún cambio: huella `9E45613C…` → `B6ABC7EB…` en 1,2 s.
  reiniciar();
  const cobro = nuevoCobro();
  await conFlag(() => entrega(cobro));
  assert.equal(facturasDe(cobro).length, 1, 'precondición: la primera entrega emitió');
  assert.equal(facturasDe(cobro)[0].vfEstado, 'sellado', 'precondición: y la selló');
  assert.equal(sellados(), 1, 'precondición: una vez');
  const antes = cadena();
  await esperar(OTRO_SEGUNDO);

  const segunda = await conFlag(() => entrega(cobro));

  assert.equal(segunda.cuerpo.status, 'already_paid', 'al proveedor se le contesta como siempre');
  assert.equal(facturasDe(cobro).length, 1, 'una sola factura');
  exigirCadenaIntacta(antes, 'con la segunda entrega del mismo cobro');
  assert.equal(sellados(), 1, '🔴 la entrega repetida ha vuelto a ESCRIBIR la huella');
});

test('SCRUM-1330 · 🔴 ④b · ESPAÑA: dos entregas A LA VEZ → UNA factura, sellada UNA vez', async () => {
  reiniciar();
  const cobro = nuevoCobro();
  const rs = await conFlag(() => Promise.all([entrega(cobro), entrega(cobro)]));
  assert.deepEqual(rs.map((r) => r.cuerpo.status), ['paid', 'paid'], 'precondición: las dos pasaron la barrera de `already_paid` — coincidieron de verdad');
  const fs = facturasDe(cobro);
  assert.equal(fs.length, 1, 'una factura (SCRUM-1304)');
  assert.equal(fs[0].vfEstado, 'sellado', 'sellada');
  assert.equal(sellados(), 1,
    `🔴 UNA FACTURA, ${sellados()} SELLADOS. La entrega que no emitió leyó la fila ANTES de que la otra la sellara, `
    + 'así que la guarda del punto de llamada no la para: la tiene que parar la de DENTRO del cerrojo.');
  assert.equal(huellaRecalculada(fs[0]), fs[0].vfHash, 'y su huella se reproduce con lo persistido');
});

test('SCRUM-1330 · 🔴 ④f · ESPAÑA: cobrar el enlace de una factura sellada hace un mes NO la re-sella — cadena BYTE A BYTE', async () => {
  // El motivo por el que SCRUM-1304 no podía entrar solo: deduplicar por cobro metía a la factura
  // vieja por el embudo del sellado, y la posterior se quedaba apuntando a una huella inexistente.
  reiniciar();
  const H1 = 'A'.repeat(64);
  const H2 = 'B'.repeat(64);
  const cobro = nuevoCobro();
  const vieja = selladaDeAntes({ number: 'F260001', chargeId: cobro, vfHash: H1, vfPrevHash: '', vfTimestamp: new Date('2026-09-01T10:00:00.123Z'), createdAt: new Date('2026-09-01T10:00:00Z') });
  const posterior = selladaDeAntes({ number: 'F260002', vfHash: H2, vfPrevHash: H1, vfTimestamp: new Date('2026-09-02T10:00:00.456Z'), createdAt: new Date('2026-09-02T10:00:00Z') });
  banco.tablas.invoice.push(vieja, posterior);
  const antes = cadena();

  await conFlag(() => entrega(cobro));

  assert.equal(banco.tablas.invoice.length, 2, '🔴 se ha emitido otra factura por el mismo dinero');
  assert.equal(vieja.status, 'paid', 'SUELO: la entrega llegó a la factura (queda cobrada)');
  assert.equal(vieja.pdfUrl, `/admin/invoices/${vieja.id}/pdf`, 'SUELO: y pasó por `ensurePdfAndEvent` (tiene su PDF)');
  exigirCadenaIntacta(antes, 'al cobrar el enlace de una factura ya sellada');
  assert.equal(sellados(), 0, '🔴 se ha ESCRITO una huella en una cadena que no tenía nada que sellar');
  assert.equal(banco.tablas.invoice.some((f) => f.vfHash === posterior.vfPrevHash), true,
    'la posterior sigue apuntando a una huella que EXISTE: la cadena no está rota');
});

// ── A · EN EL PUNTO DE LLAMADA: LO QUE LA B, SOLA, NO HACE ────────────────────────────────────

test('SCRUM-1330 · 🔴 A · con la fila ya `sellado`, `ensurePdfAndEvent` NO entra en `sellarTrasEmision`: ni estado ni cola', async () => {
  // La guarda de dentro conserva la huella, pero quien entra en `sellarTrasEmision` reescribe el
  // estado y vuelve a ENCOLAR el alta para la AEAT. Esto es lo que sujeta la guarda de fuera.
  reiniciar();
  const cobro = nuevoCobro();
  await conFlag(() => entrega(cobro));
  const trasLaPrimera = { pasos: pasosPorSellarTrasEmision(), cola: intentosDeEncolar() };
  assert.deepEqual(trasLaPrimera, { pasos: 1, cola: 1 }, 'SUELO: la primera entrega pasó UNA vez por `sellarTrasEmision` e intentó encolar UNA vez (los contadores ven)');

  await conFlag(() => entrega(cobro));

  assert.deepEqual({ pasos: pasosPorSellarTrasEmision(), cola: intentosDeEncolar() }, trasLaPrimera,
    '🔴 UNA FACTURA YA SELLADA HA VUELTO A ENTRAR EN `sellarTrasEmision`: se le ha reescrito el estado o se ha '
    + 'vuelto a encolar su alta para la AEAT.');
});
