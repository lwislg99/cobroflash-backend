// tests/scrum1251b-el-zip-dice-cuantas-facturas.test.mjs — SCRUM-1251b (carril J1)
//
// EL `evidencias.zip` DICE CUÁNTAS FACTURAS LLEVA, CON EL MISMO CONTRATO QUE LA DESCARGA DE EMITIDAS.
//
// Medido por J4 el 23-oct-2026 (SCRUM-1251 c.20672): un trimestre vacío se descarga igual —7 ficheros,
// los CSV sólo con su cabecera y el 303 a 0,00— y la ruta no devuelve ningún recuento, así que ninguna
// pantalla puede decir honestamente que el periodo está vacío. El fundador decidió «Avisar» (c.20675,
// P3): la ruta manda el recuento como `X-Yaqu-Filas`, y la tarjeta de S2 (SCRUM-1602) lo dice.
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER. Arranca `dist/app.js` con el banco de SCRUM-597 y pide
// `GET /admin/evidencias.zip` con la cookie del propietario: `requireAuth`, `requireRole('admin')` y
// el montaje de `app.ts` incluidos (A10). La petición va por `node:http` propia, no por `app.pedir`:
// ése devuelve el cuerpo como texto UTF-8 y sin cabeceras, y un ZIP leído así llega roto.
//
// ⛔ EL CONTENIDO DEL ZIP NO CAMBIA. El caso «contenido» abre el ZIP de la ruta y compara, fichero a
// fichero y por sha256, con lo que devuelve el generador (`leerPaqueteEvidencias`) llamado sobre el
// MISMO doble: nombres, orden y bytes. Pasa igual sin la cabecera y con ella.
//
// POBLACIÓN: el merchant 1251 tiene 2 facturas F1 en el 3T-2026 (más una sin número, que el libro mira
// y no asienta) y ninguna en el 4T; el merchant 1252
// tiene 3 en el 3T. El doble filtra por `merchantId` y por la fecha que pida el lector, como Prisma.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const require = createRequire(import.meta.url);
const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 1251;
const OTRO = 1252;
const mio = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const otro = sesionesDe(OTRO, { id: 19, role: 'tecnico', merchantId: OTRO });

const { leerPaqueteEvidencias } = require('../dist/modules/fiscal/evidencias/paquete.repo.js');
const { FICHEROS } = require('../dist/modules/fiscal/evidencias/paquete.js');

const DIA = new Date('2026-08-10T10:00:00.000Z'); // 3T-2026

const factura = (id, merchantId, number) => ({
  id, merchantId, number, createdAt: DIA, paidAt: DIA, type: 'F1',
  total: 121, currency: 'EUR', status: 'paid',
  customerId: null, customerName: null, customerLegalName: null, customerTaxId: null,
  quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Trabajo', qty: 1, price: 100, tax: 0.21 }],
});

const FACTURAS = [
  factura(1, MIO, 'F-2026-0001'),
  factura(2, MIO, 'F-2026-0002'),
  // Sin número: el libro la MIRA pero no la asienta (`sinNumero`). Es lo que separa `asientos` (2)
  // de `miradas` (3): sin ella, una cabecera que mandara la cifra equivocada pasaría igual.
  factura(6, MIO, null),
  factura(3, OTRO, 'F-2026-0001'),
  factura(4, OTRO, 'F-2026-0002'),
  factura(5, OTRO, 'F-2026-0003'),
];

/** Como Prisma: sólo las del merchant pedido y, si el lector acota por fecha, sólo las del rango. */
function filtrar(where) {
  return FACTURAS.filter((f) => {
    if (f.merchantId !== where?.merchantId) return false;
    for (const [campo, rango] of Object.entries(where ?? {})) {
      if (!rango || typeof rango !== 'object' || !(f[campo] instanceof Date)) continue;
      if (rango.gte && f[campo] < rango.gte) return false;
      if (rango.lte && f[campo] > rango.lte) return false;
    }
    return true;
  });
}

function programar() {
  bancoDePrisma().programar({
    authSession: {
      findUnique: async (a) => (await mio.tabla.findUnique(a)) ?? (await otro.tabla.findUnique(a)),
    },
    merchant: {
      findUnique: async (a) => ({
        ...(a?.where?.id === OTRO ? otro.merchant : mio.merchant),
        country: 'ES', taxId: 'B00000000', legalName: 'Banco 1251 SL', timezone: 'Europe/Madrid',
        flags: null, criterioCaja: null,
      }),
    },
    invoice: { findMany: async (a) => filtrar(a?.where).map((f) => ({ ...f })) },
  });
}

// Los tokens de `sesionesDe` se llaman igual para los dos merchants: se renombra el del otro para
// que cada cookie resuelva a SU merchant (si no, la del otro abriría la sesión del mío).
otro.PROPIETARIO = 'TOKEN-PROPIETARIO-OTRO';
{
  const tablaOtro = otro.tabla;
  otro.tabla = {
    findUnique: async (a) => (a?.where?.token === 'TOKEN-PROPIETARIO-OTRO'
      ? tablaOtro.findUnique({ where: { token: 'TOKEN-PROPIETARIO' } })
      : null),
  };
}

/** GET binario: cabeceras y cuerpo como Buffer. `agent: false` por lo mismo que `app.pedir` (SCRUM-1332). */
function pedirBinario(ruta, token) {
  return new Promise((resolver, rechazar) => {
    const p = http.request(`${app.base}${ruta}`, {
      method: 'GET', agent: false, headers: { cookie: `pf_session=${token}` },
    }, (res) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('error', rechazar);
      res.on('end', () => resolver({ status: res.statusCode, headers: res.headers, cuerpo: Buffer.concat(trozos) }));
    });
    p.on('error', rechazar);
    p.end();
  });
}

/** Abre un ZIP por su directorio central: [{ nombre, contenido: Buffer }], en el orden del ZIP. */
function abrirZip(buf) {
  let fin = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  assert.ok(fin >= 0, `suelo: no es un ZIP (sin fin de directorio central), ${buf.length} B`);
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const salida = [];
  for (let n = 0; n < total; n++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'suelo: entrada del directorio central ilegible');
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const lNombre = buf.readUInt16LE(p + 28);
    const lExtra = buf.readUInt16LE(p + 30);
    const lComent = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + lNombre);
    const datos = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const crudo = buf.subarray(datos, datos + comprimido);
    salida.push({ nombre, contenido: metodo === 8 ? zlib.inflateRawSync(crudo) : Buffer.from(crudo) });
    p += 46 + lNombre + lExtra + lComent;
  }
  return salida;
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

async function zipDe(token, año, trimestre) {
  programar();
  const r = await pedirBinario(`/admin/evidencias.zip?year=${año}&quarter=${trimestre}`, token);
  assert.equal(r.status, 200, `suelo: ${r.status} ${r.cuerpo.toString('utf8').slice(0, 200)}`);
  assert.equal(r.headers['content-type'], 'application/zip', 'suelo: la ruta no ha devuelto un ZIP');
  return r;
}

test('SCRUM-1251b · suelo: la ruta montada responde con un ZIP con los ficheros declarados en FICHEROS', async () => {
  const r = await zipDe(mio.PROPIETARIO, 2026, 3);
  const nombres = abrirZip(r.cuerpo).map((f) => f.nombre).sort();
  assert.deepEqual(nombres, Object.values(FICHEROS).sort(), 'población: los ficheros que el generador declara');
});

test('SCRUM-1251b · 🔴 con 2 facturas en el trimestre, la ruta manda X-Yaqu-Filas = 2', async () => {
  const r = await zipDe(mio.PROPIETARIO, 2026, 3);
  assert.equal(r.headers['x-yaqu-filas'], '2',
    '🔴 el evidencias.zip no dice cuántas facturas lleva: la pantalla no puede distinguir un trimestre '
    + 'vacío de uno con facturas (SCRUM-1251 c.20672). Mismo contrato que /admin/libros/expedidas.csv.');
});

test('SCRUM-1251b · 🔴 en un trimestre vacío, la ruta manda X-Yaqu-Filas = 0 (y el ZIP se entrega igual)', async () => {
  const r = await zipDe(mio.PROPIETARIO, 2026, 4);
  assert.equal(r.headers['x-yaqu-filas'], '0',
    '🔴 un trimestre vacío se descarga sin señal: la cabecera tiene que existir y valer 0, no faltar.');
  assert.equal(abrirZip(r.cuerpo).length, Object.values(FICHEROS).length, 'el paquete vacío se sigue entregando entero');
});

test('SCRUM-1251b · control (regla 2): las facturas de otro merchant no se cuentan — el otro ve las suyas, 3', async () => {
  const mia = await zipDe(mio.PROPIETARIO, 2026, 3);
  const ajena = await zipDe(otro.PROPIETARIO, 2026, 3);
  assert.equal(mia.headers['x-yaqu-filas'], '2', 'el mío: 2, no 5');
  assert.equal(ajena.headers['x-yaqu-filas'], '3', 'el otro: sus 3 (control positivo de que la sesión del otro es del otro)');
});

test('SCRUM-1251b · las dos cabeceras de señal, como en emitidas y recibidas: X-Yaqu-Miradas también viaja', async () => {
  const r = await zipDe(mio.PROPIETARIO, 2026, 3);
  assert.equal(r.headers['x-yaqu-miradas'], '3', 'las facturas que el libro miró en el periodo, la sin número incluida');
});

test('SCRUM-1251b · la cabecera es legible por el navegador en las mismas condiciones que la de emitidas', async () => {
  programar();
  const emitidas = await pedirBinario('/admin/libros/expedidas.csv?a%C3%B1o=2026&trimestre=3', mio.PROPIETARIO);
  assert.equal(emitidas.status, 200, `suelo: expedidas.csv → ${emitidas.status}`);
  assert.ok('x-yaqu-filas' in emitidas.headers, 'suelo: la referencia (emitidas) manda su X-Yaqu-Filas');
  const zip = await zipDe(mio.PROPIETARIO, 2026, 3);
  assert.equal(zip.headers['access-control-expose-headers'], emitidas.headers['access-control-expose-headers'],
    'si emitidas necesita exponer sus cabeceras, el ZIP también (y si no, tampoco)');
});

test('SCRUM-1251b · ⛔ el contenido del ZIP no cambia: cada fichero, por sha256, es el que devuelve el generador', async () => {
  for (const [token, merchantId, trimestre] of [[mio.PROPIETARIO, MIO, 3], [mio.PROPIETARIO, MIO, 4], [otro.PROPIETARIO, OTRO, 3]]) {
    const r = await zipDe(token, 2026, trimestre);
    const delZip = abrirZip(r.cuerpo).map((f) => [f.nombre, sha(f.contenido)]);
    programar();
    const paquete = await leerPaqueteEvidencias(bancoDePrisma(), { merchantId, año: 2026, trimestre });
    const delGenerador = paquete.ficheros.map((f) => [f.nombre, sha(Buffer.from(f.contenido, 'utf8'))]);
    assert.deepEqual(delZip, delGenerador, `merchant ${merchantId}, T${trimestre}: nombres, orden y bytes`);
  }
});

test('SCRUM-1251b · la ruta sólo LEE: ninguna escritura en el banco', async () => {
  await zipDe(mio.PROPIETARIO, 2026, 3);
  assert.deepEqual(bancoDePrisma().escrituras, []);
});
