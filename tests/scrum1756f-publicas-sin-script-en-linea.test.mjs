// SCRUM-1756f (CSP paso 2 · restos, filas de J3) · LANDING Y PRECIOS, SIN `<script>` EN LÍNEA.
//
// Con `script-src 'self'` aplicada (SCRUM-1637) el navegador no ejecuta un `<script>` en línea.
// Medido el 18-nov-2026 sobre `origin/main` = `64ec33eec`: `public/index.html` lleva su guion en
// línea en :420-511 y `public/precios.html` en :56-77; con la política aplicada dan 10 informes
// `script-src-elem` y precios con plazas no destapa su banner (SCRUM-1756 c.22017). Cada guion pasa
// TAL CUAL a un `.js` de la raíz de `public/` (firmado en SCRUM-1756 c.22082: `landing.js` y
// `precios.js`), enlazado con `<script src>` en el MISMO sitio y sin `defer`, para que se ejecute en
// el mismo punto del análisis que el guion en línea.
//
// QUÉ MIRA, POR LA RUTA DE VERDAD (la `app` de `dist/app.js`; sólo prisma es un doble):
//   ① el HTML SERVIDO de `/` y `/precios`: 0 `<script>` en línea con código (el de la landing sólo
//      conserva su `application/ld+json`, que son DATOS: el navegador no lo ejecuta y la CSP no lo
//      informa, medido en Edge en el recorrido de 1756f) y su guion enlazado, en orden y sin aplazar;
//   ② el guion existe en `public/`, se sirve como JavaScript, y su texto es BYTE A BYTE el que había
//      en línea en `main` (`64ec33eec`): sha-256 y tamaño medidos con dos sondas independientes.
// Los `<script>` los lee `scriptsDeLaPagina`, el ÚNICO extractor de `tests/` (SCRUM-670/676).
// CONTROL: el mismo contador sobre un HTML fabricado con un `<script>` en línea TIENE que dar 1, y
// sobre la página de hoy con su guion devuelto a línea (= la de `main`) también; si da 0, está ciego.
//
// ⚠️ NO mide el aspecto ni el comportamiento: eso lo midió el recorrido en Edge con la CSP aplicada
// (registro de SCRUM-1756, tramo 1756f).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { casosEscritos } from './_casos-escritos.mjs';
import { scriptsDeLaPagina } from './_scripts-de-la-pagina.mjs';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una deshace una pieza del arreglo
// y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el `<script>` en línea a la landing en el hueco de su guion.
    fichero: 'public/index.html',
    de: '<script src="/landing.js"></script>',
    a: '<script>(function(){})();</script>',
    cae: 'SCRUM-1756f · /: 0 <script> en línea y su guion enlazado',
  },
  {
    // Vuelve el `<script>` en línea a precios en el hueco de su guion.
    fichero: 'public/precios.html',
    de: '<script src="/precios.js"></script>',
    a: '<script>(function(){})();</script>',
    cae: 'SCRUM-1756f · /precios: 0 <script> en línea y su guion enlazado',
  },
  {
    // El guion de la landing pierde una línea al moverse: la del reveal de quien no pide movimiento reducido.
    fichero: 'public/landing.js',
    de: "  } else { rev.forEach(function(e){e.classList.add('in');}); }\n",
    a: '',
    cae: 'SCRUM-1756f · /landing.js: se sirve como JavaScript y es byte a byte el guion de main',
  },
  {
    // El guion de precios pierde la línea que destapa el banner founding.
    fichero: 'public/precios.js',
    de: "      document.getElementById('founding-banner').classList.remove('precios-oculto');\n",
    a: '',
    cae: 'SCRUM-1756f · /precios.js: se sirve como JavaScript y es byte a byte el guion de main',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const PUBLICO = path.join(RAIZ, 'public');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const modelo = new Proxy({}, { get: () => async () => null });
const prismaDoble = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : modelo) });
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma: prismaDoble } };

const { app } = require_('./dist/app.js');

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

// El único `<script>` sin `src` que se queda: el de datos estructurados de la landing. Es DATOS, no
// código (excepción medida en el recorrido de 1756f: 0 informes con él puesto). Se descuenta quitando
// SU apertura literal —no con una regex propia— y volviendo a pasar el extractor.
const DATOS_ESTRUCTURADOS = '<script type="application/ld+json">';
function guionesEnLinea(html) {
  return scriptsDeLaPagina(String(html).split(DATOS_ESTRUCTURADOS).join('')).inline;
}

test('SCRUM-1756f · control positivo sembrado: el contador ve un <script> en línea fabricado y no cuenta los datos', () => {
  const sembrado = '<head><script type="application/ld+json">{"a":1}</script><script src="/x.js"></script>'
    + '<script>var x=1;</script></head><!-- <script>en un comentario no cuenta</script> -->';
  assert.equal(guionesEnLinea(sembrado), 1, 'el contador de <script> en línea no ve el sembrado: está CIEGO');
  assert.equal(scriptsDeLaPagina(sembrado).inline, 2, 'sin descontar los datos, el extractor ve los dos sin src');
  assert.deepEqual(scriptsDeLaPagina(sembrado).clasicos, ['/x.js'], 'el lector de <script src> está CIEGO');
});

// ruta servida → el guion que tiene que enlazar → los `<script src>` locales, EN ORDEN → un texto
// que prueba que es esa página. El orden es el de `main` con el guion nuevo en el hueco del inline.
const PAGINAS = [
  ['/', 'public/index.html', '/landing.js', ['/landing.js', '/js/atribucion.js', '/js/contacto-publico.js'], 'Un solo plan. Todo incluido.'],
  ['/precios', 'public/precios.html', '/precios.js', ['/js/atribucion.js', '/precios.js'], 'Un plan. Todo incluido.'],
];

// Un caso por fila con el nombre ESCRITO (SCRUM-1415).
const pagina = casosEscritos(PAGINAS, ([ruta]) => `SCRUM-1756f · ${ruta}: 0 <script> en línea y su guion enlazado`,
  async ([ruta, relHtml, guion, enOrden, suelo]) => {
    const r = await pedir(ruta);
    assert.equal(r.status, 200, `${ruta} no contestó 200 (contestó ${r.status}): no hay HTML que contar`);
    assert.ok(r.cuerpo.includes(suelo), `suelo: ${ruta} no pintó «${suelo}»`);
    const res = scriptsDeLaPagina(r.cuerpo);
    assert.deepEqual(res.ilegibles, [], `${ruta}: el extractor no sabe leer alguna etiqueta <script>`);
    assert.equal(guionesEnLinea(r.cuerpo), 0, `${ruta} lleva un <script> en línea: con script-src 'self' no se ejecuta`);
    assert.deepEqual(res.clasicos, enOrden, `${ruta}: sus <script src> no son los de main con ${guion} en el hueco del guion en línea`);
    assert.ok(!res.aplazados.includes(guion), `${ruta}: ${guion} va aplazado y el guion en línea no lo iba`);
    // CONTROL: la misma página con su guion devuelto a línea es la de main, y ahí el contador da 1.
    const texto = fs.readFileSync(path.join(PUBLICO, guion), 'utf8');
    // La etiqueta se localiza por su `src` (no por su forma exacta): desde su `<script` hasta su cierre.
    const html = fs.readFileSync(path.join(RAIZ, relHtml), 'utf8');
    const enSrc = html.indexOf(`src="${guion}"`);
    const desde = html.lastIndexOf('<script', enSrc);
    const cierre = html.indexOf('</script', enSrc);
    assert.ok(enSrc > 0 && desde >= 0 && cierre > enSrc, `control: no encuentro la etiqueta de ${guion} en ${relHtml}`);
    const hasta = html.indexOf('>', cierre) + 1;
    const deMain = html.slice(0, desde) + '<script>\n' + texto + html.slice(cierre, hasta) + html.slice(hasta);
    assert.equal(guionesEnLinea(deMain), 1, `control: con el guion devuelto a línea, ${relHtml} tiene que dar 1`);
  });
test('SCRUM-1756f · /: 0 <script> en línea y su guion enlazado', pagina(0));
test('SCRUM-1756f · /precios: 0 <script> en línea y su guion enlazado', pagina(1));
pagina.todos();

// guion → sha-256 y bytes del texto que había en línea en `main` = `64ec33eec` (las líneas
// estrictamente entre `<script>` y `</script>`, más un salto final), medidos con dos sondas.
const GUIONES = [
  ['/landing.js', 'a19bfdd7ca623d8d6fc7f1a08c1a2212a51b3c9bed49e7833a51898c3bd29e5f', 5548],
  ['/precios.js', '947ed1a9c18ac3d5c0bfe16253b943f04623d8700e9c196e004baa7f577d87a2', 1479],
];

const guion = casosEscritos(GUIONES, ([ruta]) => `SCRUM-1756f · ${ruta}: se sirve como JavaScript y es byte a byte el guion de main`,
  async ([ruta, huella, bytes]) => {
    const fichero = path.join(PUBLICO, ruta);
    assert.ok(fs.existsSync(fichero), `${ruta} no existe en public/`);
    const texto = fs.readFileSync(fichero, 'utf8');
    assert.ok(!texto.includes('${'), `${ruta} lleva una interpolación \`\${\`: el guion pasa tal cual`);
    assert.equal(Buffer.byteLength(texto), bytes, `${ruta} no mide lo que medía el guion en línea de main`);
    assert.equal(crypto.createHash('sha256').update(texto).digest('hex'), huella,
      `${ruta} no es byte a byte el guion que había en línea en main`);
    const r = await pedir(ruta);
    assert.equal(r.status, 200, `${ruta} contestó ${r.status}`);
    assert.match(String(r.cabeceras['content-type']), /javascript/, `${ruta} no se sirve como JavaScript`);
    assert.equal(r.cuerpo, texto, `${ruta} servido no es el fichero de public/`);
  });
test('SCRUM-1756f · /landing.js: se sirve como JavaScript y es byte a byte el guion de main', guion(0));
test('SCRUM-1756f · /precios.js: se sirve como JavaScript y es byte a byte el guion de main', guion(1));
guion.todos();
