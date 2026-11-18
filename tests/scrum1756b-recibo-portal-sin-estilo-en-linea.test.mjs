// SCRUM-1756b (CSP paso 3 · restos, filas de J2) · EL RECIBO Y EL PORTAL DEL CLIENTE SIN CSS EN LÍNEA.
//
// Con `style-src 'self'` aplicada (SCRUM-1637) el navegador no pinta un `<style>` en línea ni un
// `style=`. Medido el 18-nov-2026 sobre `origin/main` = `35153debf`, en el fuente (tabla de SCRUM-1756):
// `receipt.routes.ts` 2 `<style>` y 9 `style=`; `customerPortal.routes.ts` 1 y 8. Es la receta de
// SCRUM-1723b/c: cada `<style>` pasa TAL CUAL a una hoja de `reciboPortalEstilo.ts`, servida por la ruta
// que ya existe y ya está declarada (`GET /pay/css/pago.css?p=<hoja>&v=<huella>`, SCRUM-1723 c.21719),
// y cada `style=` a una clase con las mismas declaraciones.
//
// QUÉ MIRA, POR LA RUTA DE VERDAD (la `app` de `dist/app.js`; sólo prisma es un doble, en
// `require.cache`: ni BD, ni red):
//   ① el HTML SERVIDO del recibo (pagado, con la valoración y los bloques de desarrollo; y pendiente) y
//      del portal (con presupuestos y facturas de cada estado; y el 404 de «enlace no válido»): 0 `<style>`
//      y 0 `style=`, la hoja de SU página enlazada, y cada clase nueva del marcado con su regla en la hoja;
//   ② la etiqueta de estado del portal: cada estado lleva los MISMOS dos colores que pintaba su `style=`
//      (el mapa de antes, copiado aquí de `35153debf`), y un estado desconocido el gris de antes;
//   ③ las tres hojas se sirven desde `/pay`: CSS, `immutable` con la huella, `no-cache` sin ella.
// Cada contador lleva su CONTROL POSITIVO sembrado: un HTML fabricado con un `<style>` y un `style=`
// TIENE que dar 1 y 1; si da 0, el contador está ciego.
//
// ⚠️ NO mide el aspecto: eso lo mide el recorrido en Edge con la CSP aplicada (registro de SCRUM-1756).
// ⚠️ Los `<script>` en línea de las dos páginas NO son de este tramo (paso 2): aquí no se cuentan.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo
// a como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El recibo vuelve a llevar un `<style>` en su cabecera.
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: "${etiquetaEstiloDePago('recibo')}",
    a: '<style>body{margin:0}</style>',
    cae: 'SCRUM-1756b · /recibo pendiente: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // La línea del pie del recibo vuelve a su `style=`.
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: '<div class="recibo-pie">',
    a: '<div style="margin-top:1rem;text-align:center">',
    cae: 'SCRUM-1756b · /recibo pagado, con valoración y bloques de desarrollo: 0 <style>, 0 style= y sus dos hojas',
  },
  {
    // La valoración deja de enlazar su hoja: las estrellas salen sin estilo.
    fichero: 'src/modules/billing/app/routes/receipt.routes.ts',
    de: "${etiquetaEstiloDePago('recibo-valoracion')}",
    a: '',
    cae: 'SCRUM-1756b · /recibo pagado, con valoración y bloques de desarrollo: 0 <style>, 0 style= y sus dos hojas',
  },
  {
    // La etiqueta de estado del portal vuelve a llevar sus colores en un `style=`.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: '<span class="portal-pill ${claseDeEtiquetaDelPortal(status)}">',
    a: '<span style="background:#f1f2ee">',
    cae: 'SCRUM-1756b · /cliente con presupuestos y facturas: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // Todos los estados se pintan con el gris: el color deja de seguir al estado.
    fichero: 'src/modules/billing/app/routes/reciboPortalEstilo.ts',
    de: "Object.prototype.hasOwnProperty.call(COLOR_DE_ETIQUETA_DEL_PORTAL, status) ? `portal-pill-${status}` : 'portal-pill-otro'",
    a: "'portal-pill-otro'",
    cae: 'SCRUM-1756b · /cliente: cada estado lleva los dos colores de su style= de antes',
  },
  {
    // El portal enlaza la hoja del recibo en vez de la suya.
    fichero: 'src/modules/system/app/routes/customerPortal.routes.ts',
    de: "${etiquetaEstiloDePago('portal')}",
    a: "${etiquetaEstiloDePago('recibo')}",
    cae: 'SCRUM-1756b · /cliente con un enlace que no vale (404): 0 <style>, 0 style= y su hoja enlazada',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

// El mapa de colores de la etiqueta de estado del portal, COPIADO de `customerPortal.routes.ts` en
// `35153debf` (antes de este tramo). Es la referencia: el arreglo tiene que pintar lo mismo.
const COLOR_DE_ANTES = {
  accepted: { bg: '#dcfce7', fg: '#166534' },
  paid:     { bg: '#dcfce7', fg: '#166534' },
  sent:     { bg: '#dbeafe', fg: '#1d4ed8' },
  pending:  { bg: '#fef3c7', fg: '#92400e' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  expired:  { bg: '#f1f2ee', fg: '#4b554f' },
  draft:    { bg: '#f1f2ee', fg: '#4b554f' },
};
const GRIS_DE_ANTES = { bg: '#f1f2ee', fg: '#4b554f' };

const comercio = () => ({
  id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', email: 'ruiz@ejemplo.test',
  country: 'ES', logoUrl: null, timezone: null, iban: 'ES9121000418450200051332', clabe: null,
  bizumPhone: '600111222', whatsappPhone: '600111222', connectStatus: 'none', stripeAccountId: null,
  flags: { BIZUM_MANUAL_ENABLED: true }, deletedAt: null, googleReviewUrl: null, llevaLibrosPorSii: true,
});
const clienteFila = () => ({ id: 3, merchantId: 42, name: 'Ana', email: null, phone: null, portalToken: 'portal1756' });

let cobro = null;
let clientePortal = null;
const ESTADOS = Object.keys(COLOR_DE_ANTES);
const tablas = {
  charge: { findUnique: async () => cobro, findFirst: async () => cobro, update: async () => cobro },
  customer: { findUnique: async () => clientePortal, findFirst: async () => clientePortal },
  invoice: {
    findFirst: async () => null, findUnique: async () => null,
    findMany: async () => [{ id: 11, number: 'F-2026-0001', status: 'paid', currency: 'EUR', total: 250,
      createdAt: new Date('2026-11-10T10:00:00Z'), pdfUrl: null, lines: [], charge: null, chargeId: null }],
  },
  quote: {
    findFirst: async () => null,
    findUnique: async () => ({ decisionToken: 'dec1756' }),
    // Un presupuesto por estado, más uno con un estado que el mapa no conoce (cae al gris).
    findMany: async () => [...ESTADOS, 'archivado'].map((status, i) => ({
      id: 100 + i, quoteNumber: 100 + i, status, currency: 'EUR', total: 121, createdAt: new Date('2026-11-10T10:00:00Z'),
      decisionToken: `dec1756-${i}`, discount: null, lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 21 }],
    })),
  },
  event: { findFirst: async () => null, create: async () => ({ id: 1 }) },
  job: { findFirst: async () => null },
  teamMember: { findFirst: async () => null },
};
const prismaDoble = new Proxy(tablas, { get: (t, k) => t[k] ?? new Proxy({}, { get: () => async () => null }) });
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: prismaDoble } };

const { app } = require_('./dist/app.js');
const { RECIBO_PORTAL_CSS } = require_('./dist/modules/billing/app/routes/reciboPortalEstilo.js');
const { hrefEstiloDePago, etiquetaEstiloDePago } = require_('./dist/modules/billing/app/routes/pagoEstilo.js');

let servidor;
let puerto;
test.before(async () => {
  servidor = http.createServer(app);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = servidor.address().port;
});
test.after(async () => { await new Promise((r) => servidor.close(r)); });

// `node:http` sin agente y no `fetch` (SCRUM-1204 / SCRUM-1568).
function pedir(ruta) {
  return new Promise((ok, mal) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'GET', agent: false }, (r) => {
      let d = ''; r.setEncoding('utf8');
      r.on('data', (t) => { d += t; });
      r.on('end', () => ok({ status: r.statusCode, cabeceras: r.headers, cuerpo: d }));
    });
    req.on('error', mal);
    req.end();
  });
}

function ponerCobro(status) {
  cobro = {
    id: 7, receiptToken: 'tok1756', status, amount: 250, currency: 'EUR', concept: 'Reparación de bajante',
    reference: 'REF-1756', method: status === 'paid' ? 'bizum' : null, payMethods: null, intentId: null,
    createdAt: new Date('2026-11-10T10:00:00Z'), paidAt: status === 'paid' ? new Date('2026-11-10T11:00:00Z') : null,
    merchantId: 42, merchant: comercio(), customer: clienteFila(), events: [], reconciliations: [],
  };
}

// ── Los contadores: sobre las ETIQUETAS del HTML, no sobre el texto ────────────────────────────
const ETIQUETA = /<[a-zA-Z][^<>]*>/g;
function estilosEnLinea(html) {
  return (html.match(/<style\b[^<>]*>/gi) || []);
}
function atributosStyle(html) {
  return (html.match(ETIQUETA) || []).filter((t) => /\sstyle\s*=/i.test(t));
}
// Las clases `recibo-*` y `portal-*` que el arreglo puso en el marcado: cada una tiene que tener regla.
function clasesNuevas(html) {
  return [...html.matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(/\s+/)).filter((c) => /^(recibo-|portal-)/.test(c));
}

test('SCRUM-1756b · control positivo sembrado: los contadores ven un <style> y un style= fabricados', () => {
  const sembrado = '<div><style>p{color:red}</style><span style="color:#ef4444">x</span><p>style= en un texto no cuenta</p></div>';
  assert.equal(estilosEnLinea(sembrado).length, 1, 'el contador de <style> no ve el sembrado: está CIEGO');
  assert.equal(atributosStyle(sembrado).length, 1, 'el contador de style= no ve el sembrado: está CIEGO');
  assert.deepEqual(clasesNuevas('<span class="a recibo-x portal-y pf-z">'), ['recibo-x', 'portal-y'], 'el extractor de clases está CIEGO');
});

function sinEstiloEnLinea(cuerpo, hojas, suelo) {
  assert.ok(cuerpo.includes(suelo), `suelo: la página no pintó «${suelo}»`);
  assert.deepEqual(estilosEnLinea(cuerpo), []);
  assert.deepEqual(atributosStyle(cuerpo), []);
  for (const h of hojas) assert.ok(cuerpo.includes(etiquetaEstiloDePago(h)), `la hoja «${h}» no está enlazada`);
  const nuevas = clasesNuevas(cuerpo);
  for (const c of nuevas) {
    assert.ok(hojas.some((h) => RECIBO_PORTAL_CSS[h].includes(`.${c}{`)), `la clase ${c} del marcado no tiene regla en ${hojas.join(' ni en ')}`);
  }
  return nuevas;
}

test('SCRUM-1756b · /recibo pagado, con valoración y bloques de desarrollo: 0 <style>, 0 style= y sus dos hojas', async () => {
  ponerCobro('paid');
  const r = await pedir('/recibo/tok1756');
  assert.equal(r.status, 200, `contestó ${r.status}: no hay HTML que contar`);
  // Suelos: la valoración y los dos bloques de desarrollo (los que llevaban 8 de los 9 `style=`).
  assert.ok(r.cuerpo.includes('id="fb-form"'), 'suelo: no salió la valoración');
  assert.ok(r.cuerpo.includes('Simular pago SCTinst'), 'suelo: no salió el bloque de simulación (¿NODE_ENV=production?)');
  assert.ok(r.cuerpo.includes('Dev · eventos del cobro'), 'suelo: no salió la lista de eventos de desarrollo');
  const nuevas = sinEstiloEnLinea(r.cuerpo, ['recibo', 'recibo-valoracion'], 'Pago confirmado');
  assert.equal(new Set(nuevas).size, 9, `las 9 clases que sustituyen a los 9 style= (no hay dos iguales): ${[...new Set(nuevas)].join(', ')}`);
  // La hoja de la valoración va DENTRO del bloque, en el hueco de su `<style>`: después de la del recibo.
  assert.ok(r.cuerpo.indexOf(etiquetaEstiloDePago('recibo')) < r.cuerpo.indexOf(etiquetaEstiloDePago('recibo-valoracion')));
});

test('SCRUM-1756b · /recibo pendiente: 0 <style>, 0 style= y su hoja enlazada', async () => {
  ponerCobro('pending');
  const r = await pedir('/recibo/tok1756');
  assert.equal(r.status, 200, `contestó ${r.status}: no hay HTML que contar`);
  sinEstiloEnLinea(r.cuerpo, ['recibo'], 'Pago pendiente');
  assert.ok(!r.cuerpo.includes('p=recibo-valoracion'), 'sin valoración no se enlaza su hoja');
});

test('SCRUM-1756b · /cliente con presupuestos y facturas: 0 <style>, 0 style= y su hoja enlazada', async () => {
  clientePortal = { ...clienteFila(), merchant: comercio() };
  const r = await pedir('/cliente/portal1756');
  assert.equal(r.status, 200, `contestó ${r.status}: no hay HTML que contar`);
  assert.ok(r.cuerpo.includes('pf-lines-toggle'), 'suelo: no salieron las líneas del presupuesto');
  assert.ok(r.cuerpo.includes('id="pf-req-success"'), 'suelo: no salió el aviso de solicitud enviada');
  sinEstiloEnLinea(r.cuerpo, ['portal'], 'Hecho con');
});

test('SCRUM-1756b · /cliente: cada estado lleva los dos colores de su style= de antes', async () => {
  clientePortal = { ...clienteFila(), merchant: comercio() };
  const r = await pedir('/cliente/portal1756');
  assert.equal(r.status, 200, `contestó ${r.status}`);
  const etiquetas = [...r.cuerpo.matchAll(/<span class="portal-pill (portal-pill-[a-z]+)">([^<]*)<\/span>/g)];
  // 7 presupuestos de estado conocido + 1 desconocido + 1 factura pagada.
  assert.equal(etiquetas.length, ESTADOS.length + 2, `etiquetas pintadas: ${etiquetas.length}`);
  const hoja = RECIBO_PORTAL_CSS.portal;
  for (const status of ESTADOS) {
    const { bg, fg } = COLOR_DE_ANTES[status];
    assert.ok(etiquetas.some((e) => e[1] === `portal-pill-${status}`), `el estado ${status} no pinta su clase`);
    assert.ok(hoja.includes(`.portal-pill-${status}{background:${bg};color:${fg}}`), `la clase de ${status} no lleva ${bg} / ${fg}`);
  }
  assert.ok(etiquetas.some((e) => e[1] === 'portal-pill-otro'), 'un estado desconocido no cae a la clase gris');
  assert.ok(hoja.includes(`.portal-pill-otro{background:${GRIS_DE_ANTES.bg};color:${GRIS_DE_ANTES.fg}}`));
  // Control: los colores no son todos iguales (si lo fueran, el estado no decidiría nada).
  assert.ok(new Set(etiquetas.map((e) => e[1])).size >= 5);
});

test('SCRUM-1756b · /cliente con un enlace que no vale (404): 0 <style>, 0 style= y su hoja enlazada', async () => {
  clientePortal = null;
  const r = await pedir('/cliente/no-existe');
  assert.equal(r.status, 404, `contestó ${r.status}: no es la página de enlace no válido`);
  sinEstiloEnLinea(r.cuerpo, ['portal'], 'portal-enlace-no-valido');
});

test('SCRUM-1756b · GET /pay/css/pago.css sirve las tres hojas: CSS, immutable con la huella y no-cache sin ella', async () => {
  const claves = Object.keys(RECIBO_PORTAL_CSS);
  assert.deepEqual(claves.sort(), ['portal', 'recibo', 'recibo-valoracion'], 'suelo: las tres hojas de este tramo');
  for (const clave of claves) {
    const con = await pedir(hrefEstiloDePago(clave));
    assert.equal(con.status, 200, `${clave}: ${con.status}`);
    assert.match(String(con.cabeceras['content-type']), /text\/css/);
    assert.match(String(con.cabeceras['cache-control']), /immutable/);
    assert.equal(con.cuerpo, RECIBO_PORTAL_CSS[clave]);
    const sin = await pedir(`/pay/css/pago.css?p=${clave}`);
    assert.equal(sin.status, 200);
    assert.equal(sin.cabeceras['cache-control'], 'no-cache');
  }
  const r = await pedir('/pay/css/pago.css?p=portal-x');
  assert.equal(r.status, 404, 'una hoja que no es del conjunto es 404');
});
