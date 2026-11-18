// SCRUM-1756d (CSP paso 3 · restos, filas de J3) · LANDING, PRECIOS, PRIVACIDAD, TÉRMINOS Y LAS
// PÁGINAS LEGALES SERVIDAS, SIN CSS EN LÍNEA.
//
// Con `style-src 'self'` aplicada (SCRUM-1637) el navegador no pinta un `<style>` en línea ni un
// `style=`. Medido el 18-nov-2026 sobre `origin/main` = `35153debf` (tabla de SCRUM-1756) y repetido
// sobre `65b2e3b2a`: `public/index.html` 1 `<style>` y 2 `style=`; `public/precios.html` 1 y 3;
// `public/privacidad.html` 1 y 0; `public/terminos.html` 1 y 0; `legalPages.routes.ts` 1 y 0.
// Cada `<style>` pasa TAL CUAL a una hoja estática de la raíz de `public/` (firmado en SCRUM-1756
// c.22008: `landing.css`, `precios.css`, `legal.css` —privacidad y términos llevan el mismo— y
// `legal-documento.css` para `/legal/*`), y cada `style=` a una clase con las mismas declaraciones.
//
// QUÉ MIRA, POR LA RUTA DE VERDAD (la `app` de `dist/app.js`; sólo prisma es un doble):
//   ① el HTML SERVIDO de cuatro páginas (privacidad, pendiente: ver `PAGINAS`): 0 `<style>` y 0 `style=`, y su hoja enlazada;
//   ② la hoja existe en `public/`, se sirve como CSS, y cada clase nueva del marcado tiene su regla;
//   ③ precios: lo que nace oculto por clase lo destapa el guion QUITANDO la clase (un
//      `style.display = ''` ya no lo destaparía: la clase seguiría mandando).
// Cada contador lleva su CONTROL POSITIVO sembrado: un HTML fabricado con un `<style>` y un `style=`
// TIENE que dar 1 y 1; si da 0, el contador está ciego.
//
// ⚠️ NO mide el aspecto: eso lo midió el recorrido en Edge con la CSP aplicada (registro de SCRUM-1756).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { casosEscritos } from './_casos-escritos.mjs';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo
// a como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El botón de precios de la landing vuelve a su `style=`.
    fichero: 'public/index.html',
    de: 'class="btn btn-primary landing-ancho-completo"',
    a: 'class="btn btn-primary" style="width:100%"',
    cae: 'SCRUM-1756d · /: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // Precios vuelve a llevar un `<style>` en línea en el hueco de su hoja.
    fichero: 'public/precios.html',
    de: '<link rel="stylesheet" href="/precios.css"/>',
    a: '<style>body{margin:0}</style>',
    cae: 'SCRUM-1756d · /precios: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // El precio tachado vuelve a destaparse con `style.display = ''`: con la clase puesta, no se ve.
    fichero: 'public/precios.html',
    de: "document.getElementById('price-old').classList.remove('precios-oculto');",
    a: "document.getElementById('price-old').style.display = '';",
    cae: 'SCRUM-1756d · /precios: lo que nace oculto por clase lo destapa el guion quitando la clase',
  },
  {
    // La página legal servida vuelve a llevar su `<style>`.
    fichero: 'src/modules/system/app/routes/legalPages.routes.ts',
    de: '<link rel="stylesheet" href="/legal-documento.css"/>',
    a: '<style>body{margin:0}</style>',
    cae: 'SCRUM-1756d · /legal/alcance-beta: 0 <style>, 0 style= y su hoja enlazada',
  },
  {
    // Términos enlaza una hoja que no existe: la página saldría desnuda.
    fichero: 'public/terminos.html',
    de: '<link rel="stylesheet" href="/legal.css"/>',
    a: '<link rel="stylesheet" href="/legal-no-existe.css"/>',
    cae: 'SCRUM-1756d · /terminos: 0 <style>, 0 style= y su hoja enlazada',
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

// ── Los contadores: sobre las ETIQUETAS del HTML, no sobre el texto ────────────────────────────
const ETIQUETA = /<[a-zA-Z][^<>]*>/g;
function sinComentarios(html) { return html.replace(/<!--[\s\S]*?-->/g, ' '); }
function estilosEnLinea(html) { return (sinComentarios(html).match(/<style\b[^<>]*>/gi) || []); }
function atributosStyle(html) {
  return (sinComentarios(html).match(ETIQUETA) || []).filter((t) => /\sstyle\s*=/i.test(t));
}
// El `<link>` lo lee el único extractor de `tests/` (SCRUM-676), no una regex de aquí.
function hojasEnlazadas(html) { return hojasDeLaPagina(html).locales; }
// Las clases que puso el arreglo: cada una tiene que tener regla en la hoja de su página.
function clasesNuevas(html) {
  return [...sinComentarios(html).matchAll(/class="([^"]*)"/g)].flatMap((x) => x[1].split(/\s+/))
    .filter((c) => /^(landing-|precios-)/.test(c));
}

test('SCRUM-1756d · control positivo sembrado: los contadores ven un <style>, un style= y una hoja fabricados', () => {
  const sembrado = '<head><link rel="stylesheet" href="/x.css"/><style>p{color:red}</style></head>'
    + '<span style="color:#ef4444">x</span><p>style= en un texto no cuenta</p><!-- <style> en un comentario no cuenta -->';
  assert.equal(estilosEnLinea(sembrado).length, 1, 'el contador de <style> no ve el sembrado: está CIEGO');
  assert.equal(atributosStyle(sembrado).length, 1, 'el contador de style= no ve el sembrado: está CIEGO');
  assert.deepEqual(hojasEnlazadas(sembrado), ['/x.css'], 'el lector de <link> está CIEGO');
  assert.deepEqual(clasesNuevas('<span class="a landing-x precios-y btn">'), ['landing-x', 'precios-y'], 'el extractor de clases está CIEGO');
});

// ruta servida → la hoja que tiene que enlazar → un texto que prueba que es esa página
const PAGINAS = [
  ['/', '/landing.css', 'Un solo plan. Todo incluido.'],
  ['/precios', '/precios.css', 'Un plan. Todo incluido.'],
  // `/privacidad` NO está: PENDIENTE DE DECISIÓN (SCRUM-1756, tramo 1756d). Tocar su HTML tumba
  // `scrum1196-fecha-de-la-politica` y obliga a mover su «Última actualización», texto visible.
  ['/terminos', '/legal.css', 'Términos'],
  ['/legal/alcance-beta', '/legal-documento.css', 'Versión del documento'],
];

// Un caso por fila con el nombre ESCRITO (SCRUM-1415): un nombre construido en un bucle no lo
// puede echar de menos la señal por nombres si la tanda lo pierde.
const pagina = casosEscritos(PAGINAS, ([ruta]) => `SCRUM-1756d · ${ruta}: 0 <style>, 0 style= y su hoja enlazada`,
  async ([ruta, hoja, suelo]) => {
    const r = await pedir(ruta);
    assert.equal(r.status, 200, `${ruta} no contestó 200 (contestó ${r.status}): no hay HTML que contar`);
    assert.ok(r.cuerpo.includes(suelo), `suelo: ${ruta} no pintó «${suelo}»`);
    assert.deepEqual(estilosEnLinea(r.cuerpo), [], `${ruta} lleva <style> en línea`);
    assert.deepEqual(atributosStyle(r.cuerpo), [], `${ruta} lleva style= en línea`);
    assert.ok(hojasEnlazadas(r.cuerpo).includes(hoja), `${ruta} no enlaza ${hoja}`);
    for (const h of hojasEnlazadas(r.cuerpo)) {
      const f = path.join(PUBLICO, h.split('?')[0]);
      assert.ok(fs.existsSync(f), `${ruta} enlaza ${h} y no existe en public/: la página saldría sin ese CSS`);
    }
    const css = await pedir(hoja);
    assert.equal(css.status, 200, `${hoja} contestó ${css.status}`);
    assert.match(String(css.cabeceras['content-type']), /text\/css/);
    assert.equal(css.cuerpo, fs.readFileSync(path.join(PUBLICO, hoja), 'utf8'));
    for (const c of clasesNuevas(r.cuerpo)) {
      assert.ok(css.cuerpo.includes(`.${c}{`), `la clase ${c} del marcado no tiene regla en ${hoja}`);
    }
  });
test('SCRUM-1756d · /: 0 <style>, 0 style= y su hoja enlazada', pagina(0));
test('SCRUM-1756d · /precios: 0 <style>, 0 style= y su hoja enlazada', pagina(1));
test('SCRUM-1756d · /terminos: 0 <style>, 0 style= y su hoja enlazada', pagina(2));
test('SCRUM-1756d · /legal/alcance-beta: 0 <style>, 0 style= y su hoja enlazada', pagina(3));
pagina.todos();

test('SCRUM-1756d · /precios: lo que nace oculto por clase lo destapa el guion quitando la clase', async () => {
  const { cuerpo } = await pedir('/precios');
  const ocultos = [...cuerpo.matchAll(/<[^<>]*\bid="([^"]+)"[^<>]*>/g)]
    .filter((m) => /class="[^"]*\bprecios-oculto\b/.test(m[0])).map((m) => m[1]);
  // SUELO: el banner founding y el precio tachado nacen ocultos. Si no se encuentran, está CIEGO.
  assert.deepEqual(ocultos.sort(), ['founding-banner', 'price-old'], 'suelo: no encuentro los dos ocultos de precios');
  for (const id of ocultos) {
    assert.ok(cuerpo.includes(`document.getElementById('${id}').classList.remove('precios-oculto');`),
      `#${id} nace oculto por clase y el guion no le quita la clase: no se destaparía nunca`);
    assert.ok(!new RegExp(`getElementById\\('${id}'\\)\\.style\\.display`).test(cuerpo),
      `#${id} se destapa por style.display: con la clase puesta, «''» no lo destapa`);
  }
  const css = fs.readFileSync(path.join(PUBLICO, 'precios.css'), 'utf8');
  // La clase va DESPUÉS de `.founding{…display:flex…}`: misma especificidad, gana la última.
  assert.ok(css.indexOf('.precios-oculto{display:none}') > css.indexOf('.founding{'),
    'la clase que oculta tiene que ir detrás de `.founding`, o el banner nace visible');
});
