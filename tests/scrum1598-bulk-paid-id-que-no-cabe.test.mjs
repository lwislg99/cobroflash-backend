// tests/scrum1598-bulk-paid-id-que-no-cabe.test.mjs — SCRUM-1598 (J1, 23-oct-2026)
//
// 🔴 EL MISMO DEFECTO DE SCRUM-1455, EN LA LECTURA QUE QUEDABA: `POST /admin/invoices/bulk-paid` leía los ids
// del CUERPO con `filter(Number.isInteger)`. `Number('99999999999999999999')` es `1e20`, que es entero: pasaba
// el filtro, llegaba a la base y la ruta contestaba 500 a TODO el lote. GO del fundador, SCRUM-1598 c.20641:
// «Ignorarlo» — el id que no cabe se descarta igual que hoy se descarta uno que no es entero, y las demás
// facturas del lote se marcan igual. La forma es `cabeEnColumnaInt` (`src/core/validation/enteroDeColumna.ts`,
// de S1), tal cual.
//
// ── POR LA RUTA, NO POR EL HANDLER (A10, SCRUM-1344) ──
// Cada petición entra por HTTP en un `express` montado como en `src/app.ts` (`/admin/invoices`), con el
// `requireRole('admin')` de la propia ruta. Lo único que se sustituye es `requireAuth`, por un `req` de sesión
// de `reqDeSesion`.
//
// ── EL BANCO ── el de scrum1455c: cualquier consulta lanza si entre sus argumentos viaja un número que no cabe en
// un int4, que es lo que hacen Postgres y Prisma. Y `invoice.updateMany` marca sobre una TABLA doblada que
// respeta el `where` (`id in` + `merchantId`): así el recuento `updated` sale de lo que la consulta pide, no de
// lo que el test supone.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const require = createRequire(import.meta.url);
const express = require('express');

const OTRO_MERCHANT = MERCHANT + 1;
/** id → merchantId. La 7 es de OTRO comercio. */
const TABLA = new Map([[1, MERCHANT], [2, MERCHANT], [3, MERCHANT], [2147483647, MERCHANT], [7, OTRO_MERCHANT]]);

const consultas = [];
let marcadas = null;
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
    if (nombre === 'invoice.updateMany') {
      const pedidos = args?.where?.id?.in ?? [];
      marcadas = pedidos.filter((id) => TABLA.get(id) === args?.where?.merchantId);
      return { count: marcadas.length, _pedidos: pedidos, _merchantId: args?.where?.merchantId };
    }
    return vacio(nombre.split('.').pop());
  },
}));

const facturas = moduloDeDist('../dist/modules/system/app/routes/invoicesAdmin.routes.js').default;

const app = express();
app.use(express.json());
app.use('/admin/invoices', (req, _res, next) => {
  Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MERCHANT }));
  next();
}, facturas);
const servidor = http.createServer(app);
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const PUERTO = servidor.address().port;
test.after(() => servidor.close());

/** El cuerpo va como TEXTO: `99999999999999999999` en JSON llega a `req.body` como `1e20`, igual que de la pantalla. */
async function lote(idsJson) {
  consultas.length = 0;
  marcadas = null;
  const cuerpo = `{"ids":${idsJson}}`;
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, mal) => {
      const req = http.request({
        host: '127.0.0.1', port: PUERTO, path: '/admin/invoices/bulk-paid', method: 'POST', agent: false,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(cuerpo) },
      }, (res) => {
        let texto = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { texto += c; });
        res.on('end', () => ok({ status: res.statusCode, body: texto ? JSON.parse(texto) : null, marcadas, consultas: consultas.length }));
      });
      req.on('error', mal);
      req.end(cuerpo);
    });
  } finally { console.error = callar; }
}

// Los nombres van LITERALES (SCRUM-1415): la señal por nombres no puede echar de menos uno construido.
test('SCRUM-1598 · POST /admin/invoices/bulk-paid · 🔴 un id que no cabe en la columna se DESCARTA y el resto del lote se marca igual', async () => {
  for (const malo of ['99999999999999999999', '2147483648', '10000000000', '-2147483649']) {
    const r = await lote(`[1,${malo},2]`);
    assert.equal(r.status, 200, `🔴 con ${malo} en el lote responde ${r.status}: el id ha llegado a la base`);
    assert.deepEqual(r.marcadas, [1, 2], `con ${malo} en el lote se han marcado ${JSON.stringify(r.marcadas)}`);
    assert.equal(r.body?.updated, 2, `con ${malo} en el lote dice updated=${r.body?.updated}`);
  }
});

test('SCRUM-1598 · POST /admin/invoices/bulk-paid · 🔴 un lote SÓLO con ids que no caben contesta lo mismo que uno sólo con no enteros (400 no_ids), sin llegar a la base', async () => {
  const noCabe = await lote('[99999999999999999999]');
  const noEntero = await lote('["abc"]');
  assert.equal(noCabe.status, 400, `🔴 responde ${noCabe.status}: el id ha llegado a la base`);
  assert.deepEqual(noCabe.body, noEntero.body, 'el id que no cabe no se trata igual que el que no es entero');
  assert.equal(noCabe.consultas, 0, `🔴 ha consultado la base ${noCabe.consultas} veces`);
});

test('SCRUM-1598 · POST /admin/invoices/bulk-paid · CONTROL: un lote sólo con ids válidos se marca entero, como hoy (2147483647 incluido)', async () => {
  const r = await lote('[1,2,3,2147483647]');
  assert.equal(r.status, 200);
  assert.deepEqual(r.marcadas, [1, 2, 3, 2147483647], '🔴 CIEGO: la base doblada no ha recibido el lote');
  assert.equal(r.body?.updated, 4);
});

test('SCRUM-1598 · POST /admin/invoices/bulk-paid · CONTROL regla 2: una factura de OTRO merchant del lote no se marca', async () => {
  const r = await lote('[1,7]');
  assert.equal(r.status, 200);
  assert.deepEqual(r.marcadas, [1], 'se ha marcado una factura de otro comercio');
  assert.equal(r.body?.updated, 1);
});

test('SCRUM-1598 · POST /admin/invoices/bulk-paid · CONTROL: un id no entero se descarta igual que hoy (`abc`, 1.5)', async () => {
  const r = await lote('[1,"abc",1.5,2]');
  assert.equal(r.status, 200);
  assert.deepEqual(r.marcadas, [1, 2]);
  assert.equal(r.body?.updated, 2);
});
