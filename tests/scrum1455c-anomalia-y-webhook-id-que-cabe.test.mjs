// tests/scrum1455c-anomalia-y-webhook-id-que-cabe.test.mjs — SCRUM-1455c (J1, 23-oct-2026)
//
// 🔴 EL MISMO DEFECTO DE SCRUM-1455, EN LAS DOS LECTURAS QUE QUEDABAN: `POST /admin/invoices/:id/payment-anomaly`
// y `POST /invoice/:id/paid-webhook` validaban el id con `Number.isInteger`. Un id que no cabe en la columna
// `Int` (`2147483648`, `10000000000`, `99999999999999999999`) lo pasa, llega a la base y la ruta contesta
// 500 donde toca 400. Firma: SCRUM-1456 c.18731, que nombra las dos (`payment-anomaly` 309 e
// `invoice.routes.ts:63`). La forma es `cabeEnColumnaInt` (`src/core/validation/enteroDeColumna.ts`, de S1), tal cual.
//
// ── POR LA RUTA, NO POR EL HANDLER (A10, SCRUM-1344) ──
// Cada petición entra por HTTP en un `express` montado como en `src/app.ts`: `/invoice` detrás de
// `requireInternalSecret` (el de `dist/`, con su cabecera), y `/admin/invoices` con el `requireRole` de la
// propia ruta. Lo único que se sustituye es `requireAuth`, por un `req` de sesión de `reqDeSesion`.
//
// ── EL BANCO ── el de scrum1456c: cualquier consulta lanza si entre sus argumentos viaja un número que no
// cabe en un int4, que es lo que hacen Postgres y Prisma. Cada ruta lleva su SUELO: un id que cabe LLEGA
// a la base y no se rechaza; sin él, un 400 a todo pasaría igual.
//
// ── LA CONDICIÓN ② DE c.18731: que nada reaccione distinto a un 400 que a un 500 ──
// · `paid-webhook`: no lo llama NADIE del repositorio (censo de abajo, con su positivo). Está detrás del
//   secreto interno, y el comentario de su montaje dice «legacy n8n […] Sin llamadas internas».
// · `payment-anomaly`: lo llaman `invoiceDetailView.js` y `jobDetailView.js`, y los dos van al mismo
//   `catch` con todo lo que no es 2xx. Además, la línea ya contestaba 400 (`invalid_input`) a un id que no
//   es entero: el arreglo no añade una respuesta nueva.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const express = require('express');

const consultas = [];
function cabe(n) {
  return Number.isInteger(n) && n >= -2147483648 && n <= 2147483647;
}
function numerosDe(v, acc = []) {
  if (typeof v === 'number') acc.push(v);
  else if (v && typeof v === 'object' && !(v instanceof Date)) for (const x of Object.values(v)) numerosDe(x, acc);
  return acc;
}
function vacio(metodo) {
  if (metodo === 'findMany') return [];
  if (metodo === 'count') return 0;
  if (metodo === 'findUnique' || metodo === 'findFirst') return null;
  if (metodo === 'updateMany' || metodo === 'deleteMany') return { count: 0 };
  return {};
}
inyectarBase(new Proxy({}, {
  get: (_t, clave) => (args) => {
    const nombre = String(clave);
    consultas.push(nombre);
    const malo = numerosDe(args).find((n) => !cabe(n));
    if (malo !== undefined) throw new Error(`Unable to fit value ${malo} into a 32-bit signed integer`);
    return vacio(nombre.split('.').pop());
  },
}));

const facturas = moduloDeDist('../dist/modules/system/app/routes/invoicesAdmin.routes.js').default;
const webhook = moduloDeDist('../dist/modules/invoicing/app/routes/invoice.routes.js').default;
const { requireInternalSecret, internalHeaders } = moduloDeDist('../dist/core/http/internalAuth.js');

const app = express();
app.use(express.json());
app.use('/invoice', requireInternalSecret, webhook);
app.use('/admin/invoices', (req, _res, next) => {
  Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT }));
  next();
}, facturas);
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const PUERTO = servidor.address().port;
test.after(() => servidor.close());

function post(ruta, cabeceras = {}) {
  const cuerpo = JSON.stringify({ amount: 10 });
  return new Promise((ok, mal) => {
    const req = http.request({
      host: '127.0.0.1', port: PUERTO, path: ruta, method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(cuerpo), ...cabeceras },
    }, (res) => {
      res.resume();
      res.on('end', () => ok(res.statusCode));
    });
    req.on('error', mal);
    req.end(cuerpo);
  });
}

/** [nombre, ruta con `{id}`, cabeceras] — las dos lecturas de este tramo. */
const RUTAS = [
  ['POST /admin/invoices/:id/payment-anomaly', '/admin/invoices/{id}/payment-anomaly', () => ({})],
  ['POST /invoice/:id/paid-webhook', '/invoice/{id}/paid-webhook', () => internalHeaders()],
];

async function pedir([, ruta, cabeceras], id) {
  consultas.length = 0;
  const callar = console.error; console.error = () => {};
  try {
    const status = await post(ruta.replace('{id}', id), cabeceras());
    return { status, consultas: consultas.length };
  } finally { console.error = callar; }
}

for (const r of RUTAS) {
  test(`SCRUM-1455c · ${r[0]} · 🔴 un id que no cabe en la columna → 400, sin llegar a la base`, async () => {
    for (const id of ['2147483648', '10000000000', '99999999999999999999', '-2147483649']) {
      const res = await pedir(r, id);
      assert.equal(res.status, 400, `🔴 con ${id} responde ${res.status}: el id ha llegado a la base`);
      assert.equal(res.consultas, 0, `🔴 con ${id} la ruta ha consultado la base ${res.consultas} veces`);
    }
  });
  test(`SCRUM-1455c · ${r[0]} · CONTROL: \`abc\` y un decimal siguen en 400`, async () => {
    for (const id of ['abc', '1.5']) {
      const res = await pedir(r, id);
      assert.equal(res.status, 400, `con ${id} responde ${res.status}`);
      assert.equal(res.consultas, 0, `con ${id} la ruta ha consultado la base`);
    }
  });
  test(`SCRUM-1455c · ${r[0]} · SUELO: un id que cabe llega a la base y no se rechaza (1, 2147483647, 0, -1)`, async () => {
    for (const id of ['1', '2147483647', '0', '-1']) {
      const res = await pedir(r, id);
      assert.ok(res.consultas > 0, `🔴 CIEGO: con ${id} la ruta no ha consultado la base (status ${res.status})`);
      assert.equal(res.status, 404, `con ${id} responde ${res.status}: la base doblada no tiene la factura, toca 404`);
    }
  });
}

test('SCRUM-1455c · CONTROL del montaje: sin el secreto interno, `/invoice` sigue contestando 404 y no consulta', async () => {
  const res = await pedir([null, '/invoice/{id}/paid-webhook', () => ({})], '1');
  assert.equal(res.status, 404);
  assert.equal(res.consultas, 0);
});

// ── Condición ② para `paid-webhook`: ¿quién lo llama? ── Se busca el nombre de la ruta en `src/`, `public/`
// y `scripts/`. El único que puede contenerlo es el propio router que la declara: ése es el POSITIVO, y
// si deja de verse el censo está CIEGO, no limpio.
test('SCRUM-1455c · condición ②: nadie del repositorio llama a `paid-webhook` (un 400 y un 500 no los lee nadie)', () => {
  const DECLARA = path.join('src', 'modules', 'invoicing', 'app', 'routes', 'invoice.routes.ts');
  const ext = new Set(['.ts', '.js', '.mjs', '.cjs', '.html']);
  const conLaPalabra = [];
  let mirados = 0;
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') recorrer(rel); continue; }
      if (!ext.has(path.extname(e.name))) continue;
      mirados++;
      if (fs.readFileSync(path.join(RAIZ, rel), 'utf8').includes('paid-webhook')) conLaPalabra.push(rel);
    }
  };
  for (const d of ['src', 'public', 'scripts']) recorrer(d);
  assert.ok(mirados > 100, `🔴 CIEGO: sólo ${mirados} ficheros mirados`);
  assert.ok(conLaPalabra.includes(DECLARA), `🔴 CIEGO: el censo no ve ni el router que declara la ruta (${mirados} mirados)`);
  assert.deepEqual(conLaPalabra.filter((f) => f !== DECLARA && f !== path.join('src', 'app.ts')), [],
    'alguien llama a `paid-webhook`: antes de cambiar su respuesta hay que medir qué hace con un 400 y con un 500');
});
