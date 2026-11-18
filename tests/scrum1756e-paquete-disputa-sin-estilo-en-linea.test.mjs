// tests/scrum1756e-paquete-disputa-sin-estilo-en-linea.test.mjs — SCRUM-1756e (CSP paso 3 · restos, fila J1)
//
// EL PAQUETE DE DISPUTA SIN CSS EN LÍNEA. Con `style-src 'self'` aplicada (SCRUM-1637) el navegador no
// pinta un `<style>` en línea ni un `style=`. Medido el 18-nov-2026 sobre `origin/main` = `34939a6ad`:
// `GET /admin/invoices/:id/dispute-package` llevaba 1 `<style>` y 4 `style=` (tres `<th>` y el pie).
// Receta de SCRUM-1756 (la de 1723b/c): el `<style>` pasa TAL CUAL a la hoja constante `DISPUTA_CSS`,
// servida por el MISMO router en `GET /admin/invoices/css/disputa.css` con el MISMO `requireRole('admin')`
// que la página (como `IMPRIMIR_JS`, SCRUM-1647f), y cada `style=` a una clase con su declaración.
//
// QUÉ MIRA, por la capa de la ruta (gate incluido) del router REAL de `dist`, con `prisma` sustituido
// en el objeto exportado (patrón de SCRUM-342 y 1647f; ni BD ni red):
//   ① el HTML servido: 0 `<style>`, 0 `style=`, y UNA hoja enlazada, la de la ruta (leída con
//      `hojasDeLaPagina`, el extractor único de `tests/`: SCRUM-676);
//   ② cada clase nueva está en el marcado donde estaba su `style=` y tiene en la hoja la MISMA
//      declaración, DESPUÉS de la regla a la que el atributo ganaba (`th`, `.sub`);
//   ③ la hoja contiene byte a byte el cuerpo del `<style>` de `34939a6ad` (copiado aquí abajo);
//   ④ la ruta de la hoja: nadie la pisa antes, un técnico recibe 403, sirve `text/css` sin caché compartida.
// Control POSITIVO sembrado: el marcado de main (copiado) TIENE que dar 1 y 4; si da 0, está CIEGO.
//
// ⚠️ NO mide el aspecto en un navegador: eso va en el registro (`docs/master/SCRUM-1756.md`, tramo 1756e).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reqDeSesion } from './_arnes-de-router.mjs';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo a
// como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve un `style=`: la columna de la fecha recupera su atributo.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '<th class="disputa-col-fecha">Fecha</th>',
    a: '<th style="width:170px">Fecha</th>',
    cae: 'SCRUM-1756e · el paquete de disputa sale con 0 <style>, 0 style= y una sola hoja enlazada, la suya',
  },
  {
    // La hoja vuelve a ir en línea dentro de la página.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '<link rel="stylesheet" href="/admin/invoices${RUTA_DISPUTA_CSS}"/>',
    a: '<style>${DISPUTA_CSS}</style>',
    cae: 'SCRUM-1756e · el paquete de disputa sale con 0 <style>, 0 style= y una sola hoja enlazada, la suya',
  },
  {
    // La hoja pierde una regla del `<style>` de antes.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '  th{color:#6b756f;font-weight:600;width:220px}\n',
    a: '',
    cae: 'SCRUM-1756e · la hoja contiene byte a byte el cuerpo del <style> de main',
  },
  {
    // La hoja pierde la regla de una clase nueva: el pie se queda sin su margen.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '  .disputa-pie{margin-top:26px}\n',
    a: '',
    cae: 'SCRUM-1756e · cada clase nueva está donde estaba su style= y la hoja le da la misma declaración',
  },
  {
    // La hoja se sirve sin el gate de admin.
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: "router.get(RUTA_DISPUTA_CSS, requireRole('admin'), (_req, res) => {",
    a: 'router.get(RUTA_DISPUTA_CSS, (_req, res) => {',
    cae: 'SCRUM-1756e · la hoja: ruta propia con el gate de admin, CSS y sin caché compartida',
  },
];

const DIST = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')).href + '/';
const moduloPrisma = await import(DIST + 'core/db/prisma.js');
const mod = await import(DIST + 'modules/system/app/routes/invoicesAdmin.routes.js');
const router = mod.default?.default ?? mod.default;
const exportado = mod.default?.RUTA_IMPRIMIR_JS ? mod.default : mod;
const { DISPUTA_CSS, RUTA_DISPUTA_CSS } = exportado;

// El cuerpo del `<style>` del paquete en `origin/main` = 34939a6ad (`invoicesAdmin.routes.ts:434-443`),
// COPIADO aquí, de `<style>` a `</style>` sin incluirlos. Es la referencia: la hoja tiene que contenerlo.
const ESTILO_DE_MAIN = `
  body{font-family:Inter,system-ui,sans-serif;color:#0f1c17;margin:0;padding:32px;max-width:820px;margin:0 auto}
  h1{font-size:22px;margin:0 0 2px} .sub{color:#6b756f;font-size:13px;margin:0 0 22px}
  h2{font-size:15px;border-bottom:2px solid #e7e9e5;padding-bottom:6px;margin:26px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td,th{padding:6px 8px;border-bottom:1px solid #f1f2ee;text-align:left;vertical-align:top}
  th{color:#6b756f;font-weight:600;width:220px}
  .sig{max-width:340px;border:1px solid #e7e9e5;border-radius:8px;padding:8px;background:#fff}
  .badge{display:inline-block;background:#ecfdf5;color:#166534;font-weight:700;border-radius:999px;padding:3px 12px;font-size:12px}
  .print{position:fixed;top:16px;right:16px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer}
  @media print{.print{display:none} body{padding:0}}
`;

// Las líneas del marcado de `34939a6ad` que llevaban `style=` (:478 y :485), copiadas, y la clase y la
// regla a la que ganaba cada atributo. El arreglo tiene que dejar la misma declaración en la hoja.
const STYLE_DE_MAIN = [
  { antes: '<th style="width:170px">Fecha</th>', ahora: '<th class="disputa-col-fecha">Fecha</th>', clase: 'disputa-col-fecha', decl: 'width:170px', ganaA: 'th{' },
  { antes: '<th style="width:110px">Tipo</th>', ahora: '<th class="disputa-col-tipo">Tipo</th>', clase: 'disputa-col-tipo', decl: 'width:110px', ganaA: 'th{' },
  { antes: '<th style="width:110px">Estado</th>', ahora: '<th class="disputa-col-estado">Estado</th>', clase: 'disputa-col-estado', decl: 'width:110px', ganaA: 'th{' },
  { antes: '<p class="sub" style="margin-top:26px">', ahora: '<p class="sub disputa-pie">', clase: 'disputa-pie', decl: 'margin-top:26px', ganaA: '.sub{' },
];
const MARCADO_DE_MAIN = `<head><style>${ESTILO_DE_MAIN}</style></head><table><tr>${STYLE_DE_MAIN.slice(0, 3).map((s) => s.antes).join('<th>Plantilla / doc</th>')}</tr></table>${STYLE_DE_MAIN[3].antes}x</p><p>style= en un texto no cuenta</p>`;

// ── Los contadores: sobre las ETIQUETAS del HTML, no sobre el texto ────────────────────────────
const ETIQUETA = /<[a-zA-Z][^<>]*>/g;
const estilosEnLinea = (html) => html.match(/<style\b[^<>]*>/gi) || [];
const atributosStyle = (html) => (html.match(ETIQUETA) || []).filter((t) => /\sstyle\s*=/i.test(t));

/** Ejecuta en orden TODOS los handlers de la capa (gate incluido), como Express. */
async function porLaCapa(capa, req) {
  let salida = null;
  const cabeceras = {};
  const res = {
    status(c) { this._c = c; return this; },
    json(b) { salida = { code: this._c ?? 200, body: b, cabeceras }; return this; },
    send(b) { salida = { code: this._c ?? 200, body: b, cabeceras }; return this; },
    setHeader(k, v) { cabeceras[k.toLowerCase()] = v; return this; },
    set(k, v) { cabeceras[k.toLowerCase()] = v; return this; },
    type() { return this; },
  };
  for (const h of capa.route.stack) {
    let siguió = false;
    await h.handle(req, res, () => { siguió = true; });
    if (!siguió) break;
  }
  return salida;
}
const capaDe = (ruta) => router.stack.find((l) => l.route?.path === ruta && l.route?.methods?.get);

const ORIG = {};
function sustituirPrisma() {
  for (const k of ['invoice', 'whatsAppMessage']) ORIG[k] = moduloPrisma.prisma[k];
  moduloPrisma.prisma.invoice = { findFirst: async () => ({
    id: 11, merchantId: 7, number: '2026-CF-0007', currency: 'EUR', status: 'paid',
    createdAt: new Date('2026-07-02T09:00:00Z'), paidAt: null, total: '250.00', quoteId: null, chargeId: null,
    merchant: { name: 'QA', legalName: 'QA SL', taxId: 'B1234', address: 'Calle X 1' },
    customer: { id: 2, name: 'Cliente', phone: null, email: null }, charge: null, quote: null,
  }) };
  moduloPrisma.prisma.whatsAppMessage = { findMany: async () => [
    { createdAt: new Date('2026-07-02T09:05:00Z'), type: 'template', templateName: 'factura', relatedType: 'invoice', relatedId: 11, status: 'read' },
  ] };
}
function restaurarPrisma() { for (const k of Object.keys(ORIG)) moduloPrisma.prisma[k] = ORIG[k]; }

async function paqueteServido(t) {
  t.after(restaurarPrisma);
  sustituirPrisma();
  const capa = capaDe('/:id/dispute-package');
  assert.ok(capa, 'SUELO: no existe GET /:id/dispute-package en el router');
  const r = await porLaCapa(capa, reqDeSesion({ rol: 'admin', merchantId: 7, params: { id: '11' } }));
  assert.equal(r?.code, 200, `esperaba 200: ${JSON.stringify(r?.body).slice(0, 200)}`);
  const html = String(r.body);
  assert.ok(html.includes('Paquete de evidencia de disputa'), 'SUELO: no es la página del paquete');
  assert.ok(html.includes('factura · invoice 11'), 'SUELO: no pintó la fila del mensaje');
  return html;
}

test('SCRUM-1756e · control positivo sembrado: el marcado de main da 1 <style> y 4 style=', () => {
  assert.equal(estilosEnLinea(MARCADO_DE_MAIN).length, 1, 'el contador de <style> no ve el de main: está CIEGO');
  assert.equal(atributosStyle(MARCADO_DE_MAIN).length, 4, 'el contador de style= no ve los de main: está CIEGO');
  const sembrado = hojasDeLaPagina('<link rel="stylesheet" href="/admin/invoices/css/x.css"/>');
  assert.deepEqual(sembrado.locales, ['/admin/invoices/css/x.css'], 'el extractor de hojas está CIEGO');
});

test('SCRUM-1756e · el paquete de disputa sale con 0 <style>, 0 style= y una sola hoja enlazada, la suya', async (t) => {
  const html = await paqueteServido(t);
  assert.deepEqual(estilosEnLinea(html), [], 'el HTML servido no lleva <style>');
  assert.deepEqual(atributosStyle(html), [], 'el HTML servido no lleva style=');
  const hojas = hojasDeLaPagina(html);
  assert.deepEqual(hojas.ilegibles, [], 'el extractor no sabe leer un <link> de la página');
  assert.deepEqual(hojas.remotas, [], 'ninguna hoja de fuera');
  assert.deepEqual(hojas.locales, ['/admin/invoices/css/disputa.css'], 'la página enlaza su hoja y sólo ésa');
});

test('SCRUM-1756e · cada clase nueva está donde estaba su style= y la hoja le da la misma declaración', async (t) => {
  const html = await paqueteServido(t);
  for (const s of STYLE_DE_MAIN) {
    assert.ok(html.includes(s.ahora), `el marcado no lleva «${s.ahora}» donde main llevaba «${s.antes}»`);
    const regla = `.${s.clase}{${s.decl}}`;
    const pos = DISPUTA_CSS.indexOf(regla);
    assert.ok(pos >= 0, `la hoja no tiene «${regla}»`);
    assert.ok(DISPUTA_CSS.indexOf(s.ganaA) < pos, `«${regla}» va antes de «${s.ganaA}»: ya no le ganaría como el style=`);
  }
});

test('SCRUM-1756e · la hoja contiene byte a byte el cuerpo del <style> de main', () => {
  assert.equal(typeof DISPUTA_CSS, 'string', 'SUELO: el módulo no exporta DISPUTA_CSS');
  assert.ok(DISPUTA_CSS.includes(ESTILO_DE_MAIN), 'la hoja no contiene el <style> de main tal cual');
  assert.ok(!DISPUTA_CSS.includes('${'), 'la hoja es constante: ningún dato dentro');
});

test('SCRUM-1756e · la hoja: ruta propia con el gate de admin, CSS y sin caché compartida', async () => {
  assert.equal(RUTA_DISPUTA_CSS, '/css/disputa.css');
  const primera = router.stack.find((l) => l.route?.methods?.get && l.match(RUTA_DISPUTA_CSS));
  assert.equal(primera?.route?.path, RUTA_DISPUTA_CSS, 'ninguna ruta anterior del router se la queda');
  const capa = capaDe(RUTA_DISPUTA_CSS);
  const tecnico = await porLaCapa(capa, reqDeSesion({ rol: 'tecnico', merchantId: 7 }));
  assert.equal(tecnico?.code, 403, 'un técnico no pasa: el mismo gate que la página');
  const admin = await porLaCapa(capa, reqDeSesion({ rol: 'admin', merchantId: 7 }));
  assert.equal(admin?.code, 200);
  assert.equal(admin.body, DISPUTA_CSS);
  assert.match(admin.cabeceras['content-type'], /^text\/css; charset=utf-8$/);
  assert.equal(admin.cabeceras['cache-control'], 'private, no-cache');
});
