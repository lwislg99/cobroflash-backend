// tests/scrum1510b-pendiente-que-el-porton-dejaria-pasar.test.mjs — SCRUM-1510 (punto ciego ②)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// `ensureInvoicePdf` TIENE DOS CORTES, Y HAY FACTURAS QUE SÓLO PARA EL PRIMERO
//
// El primero pregunta por el ESTADO (`puedeProducirDocumento`); el segundo, más abajo, es el portón
// de SCRUM-206 y pregunta por la HUELLA (`exigirDocumentoEmitible`). En el fallo corriente —el
// sellado revienta antes de escribir la huella— los dos niegan, y por eso quitar el primero no
// tumbaba ningún test (SCRUM-1510: 0 de 69).
//
// Pero el segundo deja pasar dos clases de factura pendiente, y las dos se FABRICAN aquí con el
// camino real, no se escriben a mano:
//   · la que tiene la huella escrita y el estado sin marcar: `applyVeriFactu` escribe la huella y
//     la escritura siguiente (`vfEstado: sellado`) es otra llamada a la base. Si ésa falla, la
//     factura queda pendiente CON huella, y su registro no se ha encolado para la AEAT;
//   · la que no entra en la cadena (un justificante `J-`): nace pendiente por el `@default` del
//     esquema, y pasa a «no aplica» en una escritura posterior que también puede fallar.
// Medido sobre un espejo del compilado sin el primer corte: de las dos sale un PDF de verdad.
//
// ── POR DESTINO ──────────────────────────────────────────────────────────────────────────────
// No se lee ningún nombre en `src/`. Se ejecutan `sellarTrasEmision`, `applyVeriFactu` y
// `ensureInvoicePdf` de `dist/`, y se mira qué devuelven y qué queda escrito. Lo único doblado es
// la BASE, y lo único que se le hace es que UNA escritura concreta falle.
//
// ── LO QUE ESTE FICHERO NO PRUEBA ────────────────────────────────────────────────────────────
// Que esas filas existan en una base de verdad: hace falta un fallo entre dos escrituras, y aquí
// se provoca. Tampoco prueba los otros productores de bytes; sólo `ensureInvoicePdf`.
//
// ⛔ Ni una base, ni un byte de red. Los PDF van a un directorio temporal, nunca al árbol.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');

// `invoicesDir` se calcula al cargar `dist` desde el directorio del proceso: se cambia ANTES de
// cargar nada, para que el PDF del caso sano no caiga dentro del árbol.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1510b-'));
process.chdir(TMP);
process.on('exit', () => {
  try { process.chdir(RAIZ); fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal del sistema */ }
});

const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const {
  SELLADO_PENDIENTE, SELLADO_HECHO, SELLADO_NO_APLICA, ERROR_PDF_SIN_SELLAR,
} = requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js'));
const { invoicesDir } = requiere(rutaDe('dist/core/storage/dirs.js'));

const ES = Object.freeze({
  id: 77, country: 'ES', taxId: 'B12345678', email: 'obra@example.test', name: 'Fontaneria',
  legalName: 'Fontaneria S.L.', address: null, logoUrl: null, whatsappPhone: null, timezone: null,
});

/** El estado con el que NACE la fila sale del esquema, no de este fichero. */
const ESTADO_AL_NACER = /vfEstado\s+String\s+@default\("([^"]+)"\)/
  .exec(fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8'))?.[1];

/**
 * La base doblada, CON ESTADO: lo que el camino real escribe es lo que se lee después. `falla`
 * decide, mirando el argumento, qué `invoice.update` lanza. Ningún campo de la fila se toca a mano.
 */
function base({ numero, falla = () => false }) {
  const llamadas = [];
  const fila = {
    id: 4101, number: numero, total: '121.00', currency: 'EUR', type: 'F1', stageLabel: null,
    createdAt: new Date('2026-09-29T10:00:00Z'), merchantId: ES.id, customerId: 9,
    lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }],
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    vfEstado: ESTADO_AL_NACER, vfHash: null, vfPrevHash: null, vfTimestamp: null,
    vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
    merchantName: null, rectifies: null,
    merchant: { ...ES },
    customer: { id: 9, name: 'Cliente', legalName: null, taxId: 'A11111111', email: null, phone: null, address: null },
  };
  const respuestas = {
    'invoice.findUnique': () => fila,
    'invoice.findFirst': () => null, // primer registro de la cadena
    'invoice.update': (a) => { Object.assign(fila, a?.data ?? {}); return fila; },
    'merchant.findUnique': () => ({ ...ES }),
  };
  const modelo = (m) => new Proxy({}, {
    get: (_, metodo) => async (args) => {
      const clave = `${m}.${String(metodo)}`;
      llamadas.push({ clave, args });
      if (clave === 'invoice.update' && falla(args)) throw new Error('la base no responde');
      const r = respuestas[clave];
      if (r) return r(args);
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      return { id: llamadas.length, ...(args?.data ?? {}) };
    },
  });
  const cliente = new Proxy({}, {
    get: (_, k) => {
      if (k === '$transaction') return async (fn) => fn(cliente);
      if (k === '$executeRaw' || k === '$executeRawUnsafe') return async () => 1;
      if (k === '$queryRaw') return async () => [];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return modelo(String(k));
    },
  });
  return { cliente, llamadas, fila };
}

/** Carga el camino real con la base doblada también en el sitio del cliente global. */
function cargar(doble) {
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble.cliente } };
  for (const m of [
    'dist/modules/system/audit.service.js',
    'dist/modules/invoicing/domain/verifactu.service.js',
    'dist/modules/invoicing/domain/encolarRemision.js',
    'dist/modules/invoicing/domain/selladoEstado.js',
    'dist/lib/invoicing.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no cargado */ } }
  return {
    ...requiere(rutaDe('dist/modules/invoicing/domain/selladoEstado.js')),
    ...requiere(rutaDe('dist/modules/invoicing/domain/portonDocumento.js')),
    ...requiere(rutaDe('dist/lib/invoicing.js')),
  };
}

const tic = () => new Promise((r) => setImmediate(r)); // la auditoría escribe sin esperar
const HUELLA = /^[0-9A-F]{64}$/;
const facturaDe = (fila) => ({
  id: fila.id, number: fila.number, total: { toString: () => fila.total },
  createdAt: fila.createdAt, merchantId: fila.merchantId, type: fila.type,
});
const pdfDe = (fila) => path.join(invoicesDir, `${fila.merchantId}-${fila.number}.pdf`);
const escrituras = (llamadas) => llamadas
  .filter((l) => /\.(update|updateMany|create|createMany|upsert|delete|deleteMany)$/.test(l.clave))
  .map((l) => l.clave);

/** Las tres exigencias, iguales para las dos facturas: se niega, con ESE error, y no deja nada. */
async function exigirQueNoSale(d, camino, quien) {
  // Antes de pedir nada: el SEGUNDO portón, preguntado de verdad, la dejaría pasar. Si esto deja de
  // ser cierto, la fila ya no distingue un corte del otro y lo de abajo no mediría el primero.
  assert.equal(
    camino.puedeSalirDocumento({ number: d.fila.number, vfHash: d.fila.vfHash }, d.fila.merchant), true,
    `🔴 CIEGO: el portón de la huella ya niega ${quien}; esta fila no separa los dos cortes`);

  const antes = d.llamadas.length;
  let error = null; let entregado = null;
  try { entregado = await camino.ensureInvoicePdf(d.fila.id, d.cliente); } catch (e) { error = e; }
  await tic();

  assert.equal(entregado, null,
    `🔴 SALIÓ EL DOCUMENTO de ${quien}: ${JSON.stringify(entregado)}.\n`
    + '  La factura está pendiente de sellado y el portón de la huella no la para: el único corte\n'
    + '  que la negaba es el del ESTADO, y ya no se pregunta.');
  assert.equal(error?.message, ERROR_PDF_SIN_SELLAR,
    `🔴 ${quien} se niega, pero no con el error del corte del estado (dice «${error?.message}»)`);
  assert.deepEqual(escrituras(d.llamadas.slice(antes)), [],
    `🔴 hubo escrituras al pedir el PDF de ${quien}: ni \`pdfUrl\` ni \`qrData\` se tocan`);
  assert.equal(fs.existsSync(pdfDe(d.fila)), false, `🔴 hay un PDF en disco de ${quien}`);
}

// ═══ ① POSITIVO — este banco SÍ sabe sacar un PDF, o los «no sale» de abajo no dicen nada ════════

test('SCRUM-1510 · POSITIVO: la misma factura, sellada entera, SÍ produce su PDF (bytes en disco y `pdfUrl` escrito)', async () => {
  assert.equal(ESTADO_AL_NACER, SELLADO_PENDIENTE,
    `🔴 CIEGO: el esquema ya no hace nacer la factura pendiente (@default «${ESTADO_AL_NACER}»)`);
  const d = base({ numero: '2026-CF-0001' });
  const camino = cargar(d);
  const r = await camino.sellarTrasEmision(facturaDe(d.fila), ES, d.cliente);
  await tic();
  assert.equal(r.estado, SELLADO_HECHO, `🔴 CIEGO: el sellado no llegó a hacerse (${JSON.stringify(r)})`);
  assert.equal(d.fila.vfEstado, SELLADO_HECHO);
  assert.match(String(d.fila.vfHash), HUELLA);
  assert.equal(camino.puedeSalirDocumento({ number: d.fila.number, vfHash: d.fila.vfHash }, d.fila.merchant), true);

  const antes = d.llamadas.length;
  const entregado = await camino.ensureInvoicePdf(d.fila.id, d.cliente);
  assert.equal(entregado.number, d.fila.number);
  assert.deepEqual(escrituras(d.llamadas.slice(antes)), ['invoice.update'], 'se escribe `pdfUrl` una vez');
  assert.equal(d.fila.pdfUrl, entregado.pdfUrl);
  assert.equal(fs.existsSync(pdfDe(d.fila)), true, '🔴 CIEGO: el caso sano no dejó PDF en disco');
  assert.equal(fs.readFileSync(pdfDe(d.fila)).subarray(0, 5).toString('latin1'), '%PDF-');
});

// ═══ ② LA QUE TIENE HUELLA Y NO TIENE EL ESTADO ════════════════════════════════════════════════

test('SCRUM-1510 · 🔴 pendiente CON huella (la escritura del estado falló): no sale documento, y lo niega el corte del ESTADO', async () => {
  const d = base({ numero: '2026-CF-0002', falla: (a) => a?.data?.vfEstado === SELLADO_HECHO });
  const camino = cargar(d);
  const r = await camino.sellarTrasEmision(facturaDe(d.fila), ES, d.cliente);
  await tic();

  // SUELO: la fila es la que se quería fabricar, y la ha escrito el camino real.
  assert.equal(r.estado, SELLADO_PENDIENTE, `🔴 CIEGO: la puerta no devolvió pendiente (${JSON.stringify(r)})`);
  assert.equal(d.fila.vfEstado, SELLADO_PENDIENTE);
  assert.match(String(d.fila.vfHash), HUELLA, '🔴 CIEGO: la huella no llegó a escribirse; éste es el fallo corriente, no el que se mide');
  assert.equal(d.llamadas.filter((l) => l.clave.startsWith('vfSubmission.')).length, 0,
    '🔴 CIEGO: el registro se encoló; ya no es «huella sin estado ni envío»');

  await exigirQueNoSale(d, camino, 'la factura con huella y sin estado');
});

// ═══ ③ LA QUE NO ENTRA EN LA CADENA Y SE QUEDÓ COMO NACIÓ ══════════════════════════════════════

test('SCRUM-1510 · 🔴 justificante que se quedó pendiente (la escritura de «no aplica» falló): no sale documento, y lo niega el corte del ESTADO', async () => {
  const d = base({ numero: 'J-20260929-AB12', falla: (a) => a?.data?.vfEstado === SELLADO_NO_APLICA });
  const camino = cargar(d);
  await assert.rejects(() => camino.sellarTrasEmision(facturaDe(d.fila), ES, d.cliente), /la base no responde/,
    '🔴 CIEGO: la escritura de «no aplica» no falló; la fila no se queda como nació');
  await tic();

  assert.equal(d.fila.vfEstado, SELLADO_PENDIENTE);
  assert.equal(d.fila.vfHash, null);

  await exigirQueNoSale(d, camino, 'el justificante pendiente');
});
