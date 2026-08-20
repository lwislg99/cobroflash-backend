// tests/scrum333-tarjetas-gremio.test.mjs — SCRUM-333 (F6) · las tarjetas por gremio.
//
// Lo que este fichero sostiene, y no es «que la sección exista»:
//
//   ① que la lista de tarjetas SALGA del catálogo y no de una lista escrita a mano — D0 encontró
//      TRES listas del mismo gremio en `scripts/`, ninguna derivada, y una cuarta habría sido más
//      de lo mismo;
//   ② que **ningún concepto y ningún precio de oficio se publique sin procedencia validada**, y
//      que eso lo decida el ESTADO que el propio catálogo declara, no la memoria de nadie;
//   ③ que los literales del seed del vídeo —que es lo que el ticket quería enseñar— no lleguen
//      nunca a la landing;
//   ④ que un texto pendiente de aprobación del fundador NO se pinte (regla 30);
//   ⑤ que ningún enlace de tarjeta apunte a un sitio que no existe, ni rompa la atribución.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  leerCatalogos, tarjetasDeGremio, conceptosPublicables, preciosPublicables,
  estaValidado, CatalogosCiego, ESTADO_VALIDADO, ESTADO_BORRADOR, LITERALES_DEL_SEED_DEL_VIDEO,
} from '../scripts/_gremios-landing.mjs';
// Se REUTILIZA el extractor de SCRUM-400 en vez de escribir un segundo: ya sabe quitar
// comentarios, `<script>` y `<style>`, y una segunda copia de la misma idea se desincroniza.
import { textoPublicado } from '../scripts/_guard-conformidad-landing.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = path.join(RAIZ, 'public', 'index.html');
const html = fs.readFileSync(LANDING, 'utf8');

// 🔴 LA DISTINCIÓN QUE ESTE FICHERO APRENDIÓ EN ROJO, Y EN SU PRIMERA EJECUCIÓN.
//
// El test de los literales del seed cayó nombrando «Cambio de termo 80L»… que estaba en el
// COMENTARIO donde se explica por qué no puede publicarse. El guard se cazó a sí mismo: la trampa
// de autorreferencia que ya mordió cuatro veces en esta casa (SCRUM-176/168/3/193).
//
// Desde aquí, la regla: **lo que se afirma se mide sobre el texto PUBLICADO** (sin comentarios) y
// **lo que es estructura se mide sobre el HTML crudo** (los atributos no se publican, pero son el
// mecanismo). Dos superficies distintas, cada assert en la suya.
const publicado = textoPublicado(html);

/** El bloque de la sección, para no medir la landing entera y cazar falsos de otras secciones. */
function seccionGremios(texto = html) {
  const i = texto.indexOf('<section id="gremios"');
  if (i === -1) return null;
  const j = texto.indexOf('</section>', i);
  return j === -1 ? null : texto.slice(i, j + 10);
}

/** Los `data-gremio` publicados, en el orden en que salen. */
function gremiosPublicados(bloque) {
  const out = [];
  const re = /data-gremio="([^"]+)"/g;
  let m;
  while ((m = re.exec(bloque)) !== null) out.push(m[1]);
  return out;
}

// ── ① SUELO: un cero tiene que doler ─────────────────────────────────────────────────────────

test('SCRUM-333 · 🔴 SUELO: sin catálogos, el derivador se declara CIEGO en vez de devolver []', () => {
  const vacio = fs.mkdtempSync(path.join(RAIZ, 'tests', '.tmp-gremios-'));
  try {
    assert.throws(() => leerCatalogos(vacio), CatalogosCiego,
      '🔴 el derivador ha devuelto una lista vacía sin protestar. «No hay gremios configurados» y ' +
      '«no supe mirar» son el mismo [] y consecuencias opuestas: con el segundo, la sección se ' +
      'queda sin tarjetas y nadie se entera de que el derivador está roto.');
    // Y con el directorio creado pero vacío de .json, lo mismo: existir no es tener.
    fs.mkdirSync(path.join(vacio, 'data', 'catalogs'), { recursive: true });
    assert.throws(() => leerCatalogos(vacio), CatalogosCiego);
  } finally {
    fs.rmSync(vacio, { recursive: true, force: true });
  }
});

test('SCRUM-333 · SUELO: el repo real SÍ tiene catálogos, y el derivador los ve', () => {
  const cats = leerCatalogos(RAIZ);
  assert.ok(cats.length >= 1, '🔴 cero catálogos en el repo real: el suelo de arriba pasaría por el motivo equivocado');
  for (const c of cats) {
    assert.ok(c.gremio, '🔴 un catálogo sin `gremio`: ' + c.fichero);
    assert.ok(c.items.length > 0, '🔴 ' + c.fichero + ' no tiene items — leerlo mal se parece a que esté vacío');
  }
});

// ── ② EL GATE, PROBADO EN LAS DOS DIRECCIONES ────────────────────────────────────────────────

test('SCRUM-333 · 🔴 CONTROL NEGATIVO: sin validar → CERO conceptos, nunca inventados', () => {
  const borrador = { status: ESTADO_BORRADOR, items: [{ nombre: 'Desatasco de WC', precioOrientativo: { min: 90, max: 160 } }] };
  assert.deepEqual(conceptosPublicables(borrador), [],
    '🔴 un catálogo SIN VALIDAR ha entregado conceptos para publicar. Su propio `_nota` dice que ' +
    'los precios están sin confirmar por un profesional: la tarjeta sale sin conceptos, no con ' +
    'conceptos improvisados.');
  assert.deepEqual(preciosPublicables(borrador, true), [],
    '🔴 ha entregado precios de un catálogo sin validar, y ni siquiera la aprobación del fundador ' +
    'puede saltarse el estado del fichero.');
  assert.equal(estaValidado(borrador), false);

  // Y sin catálogo NINGUNO (el gremio no existe): tampoco se inventa nada.
  assert.deepEqual(conceptosPublicables(undefined), []);
  assert.deepEqual(conceptosPublicables(null), []);
});

test('SCRUM-333 · AUTOPRUEBA: validado → SÍ entrega conceptos (si no, el control negativo no probaría nada)', () => {
  const ok = { status: ESTADO_VALIDADO, items: [{ nombre: 'Desatasco de WC', precioOrientativo: { min: 90, max: 160 } }] };
  assert.deepEqual(conceptosPublicables(ok), ['Desatasco de WC'],
    '🔴 ni validado entrega conceptos: entonces el [] de arriba no demuestra que el gate funcione, ' +
    'sólo que la función devuelve [] siempre.');
  // Los precios llevan ADEMÁS la aprobación del fundador: dos llaves, no una.
  assert.deepEqual(preciosPublicables(ok, false), [], '🔴 el precio ha salido sin aprobación del fundador (regla 30)');
  assert.equal(preciosPublicables(ok, true).length, 1);
});

// ── ③ LO QUE ESTÁ PUBLICADO, CONTRASTADO CONTRA LA FUENTE ────────────────────────────────────

test('SCRUM-333 · 🔴 la landing enseña EXACTAMENTE los gremios del catálogo, ni uno más ni uno menos', () => {
  const bloque = seccionGremios();
  assert.ok(bloque, '🔴 no está la sección `#gremios` en public/index.html');

  const enLanding = gremiosPublicados(bloque).sort();
  const enCatalogo = tarjetasDeGremio(RAIZ).map((t) => t.gremio).sort();

  const sobran = enLanding.filter((g) => !enCatalogo.includes(g));
  const faltan = enCatalogo.filter((g) => !enLanding.includes(g));

  assert.deepEqual(sobran, [],
    '🔴 LA LANDING ENSEÑA UN GREMIO QUE NO ESTÁ EN data/catalogs/: ' + sobran.join(', ') +
    '\n   Una tarjeta sin catálogo detrás es una lista escrita a mano, que es justo lo que D0 ' +
    'encontró por triplicado y lo que este ticket no repite.');
  assert.deepEqual(faltan, [],
    '🔴 HAY UN GREMIO EN EL CATÁLOGO SIN SU TARJETA: ' + faltan.join(', ') +
    '\n   O se le añade tarjeta, o se retira su catálogo. Las dos listas se derivan de la misma ' +
    'fuente para que no puedan discrepar en silencio.');
});

test('SCRUM-333 · 🔴 mientras el catálogo esté SIN VALIDAR, su tarjeta no enseña ni un concepto ni un euro', () => {
  // Texto PUBLICADO de la sección: un concepto citado en un comentario no cuenta como publicado.
  const bloque = textoPublicado(seccionGremios());
  const cats = leerCatalogos(RAIZ);
  const sinValidar = cats.filter((c) => !estaValidado(c));

  assert.ok(sinValidar.length > 0,
    'ℹ️ los seis catálogos están validados: entonces este test ya no mide lo que cree y hay que ' +
    'darle la vuelta — ahora tocaría exigir que los conceptos SÍ estén.');

  for (const c of sinValidar) {
    for (const it of c.items) {
      assert.ok(!bloque.includes(it.nombre),
        '🔴 la landing publica «' + it.nombre + '» y su catálogo (' + c.fichero + ') declara `' +
        c.status + '`. El propio fichero dice que nadie del oficio lo ha confirmado.');
    }
  }
  // Ni un importe, de ninguna forma: ni «90 €», ni «90€», ni «desde 90».
  assert.doesNotMatch(bloque, /\d+\s?(€|EUR|euros)/i,
    '🔴 hay un importe en las tarjetas de gremio. Un precio sin procedencia validada no se pinta, ' +
    'y hoy no hay ninguno con ella.');
});

test('SCRUM-333 · 🔴 los literales del SEED DEL VÍDEO no llegan a la landing', () => {
  // D0 (SCRUM-310 · P4) los midió uno a uno: cinco de seis viven SOLO en scripts/seed-video.mjs.
  // Enseñarlos como conocimiento del oficio sería enseñar lo que escribió quien grabó el vídeo.
  for (const lit of LITERALES_DEL_SEED_DEL_VIDEO) {
    assert.ok(!publicado.includes(lit),
      '🔴 «' + lit + '» está en la landing y su única fuente es `scripts/seed-video.mjs` (D0 · P4). ' +
      'No es conocimiento del gremio: es atrezo del vídeo comercial.');
  }
});

// ── ④ REGLA 30: LO PENDIENTE NO SE PINTA ─────────────────────────────────────────────────────

test('SCRUM-333 · 🔴 con el microcopy PENDIENTE del fundador, la sección va `hidden`', () => {
  const bloque = seccionGremios();
  const apertura = bloque.slice(0, bloque.indexOf('>') + 1);
  if (apertura.includes('PENDIENTE_FUNDADOR')) {
    assert.match(apertura, /\shidden(\s|>)/,
      '🔴 la sección tiene el microcopy marcado como PENDIENTE y NO está `hidden`: se le está ' +
      'enseñando al visitante un texto que el fundador no ha aprobado (regla 30).');
  } else {
    // Aprobada: entonces no puede quedar ni rastro del marcador en la sección.
    assert.ok(!bloque.includes('PENDIENTE'),
      '🔴 la sección ya no lleva el marcador en su etiqueta pero sí en el cuerpo: media aprobación ' +
      'no es una aprobación.');
  }
});

// ── ⑤ LOS ENLACES ────────────────────────────────────────────────────────────────────────────

test('SCRUM-333 · cada tarjeta enlaza a un destino que EXISTE (nada de 404)', () => {
  const bloque = seccionGremios();
  const hrefs = [];
  const re = /<a[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(bloque)) !== null) hrefs.push(m[1]);

  assert.ok(hrefs.length > 0, '🔴 ninguna tarjeta enlaza a ningún sitio: una tarjeta que no lleva a nada es una imagen');

  for (const h of hrefs) {
    if (h.startsWith('#')) {
      assert.ok(html.includes('id="' + h.slice(1) + '"'),
        '🔴 el ancla ' + h + ' no existe en la página');
    } else if (h.startsWith('/')) {
      const rel = h.split('?')[0].split('#')[0];
      assert.ok(fs.existsSync(path.join(RAIZ, 'public', rel)),
        '🔴 el enlace ' + h + ' apunta a public' + rel + ', que NO existe → 404 desde la landing');
    } else {
      assert.fail('🔴 enlace no clasificable en una tarjeta de gremio: ' + h);
    }
  }
});

test('SCRUM-333 · 🔴 ningún enlace de tarjeta lleva utm_ propio: borraría el origen real del visitante', () => {
  const bloque = seccionGremios();
  // MEDIDO en `public/js/atribucion.js`: propaga la atribución de la URL a los enlaces a
  // /register.html, pero «NO pisa lo que el enlace ya trae». Un utm_source escrito aquí ganaría
  // sobre el real (google, un grupo de gremio, un QR) y el embudo diría que todos vinieron de la
  // landing. La tarjeta se quedaría bonita y la medición, rota.
  assert.doesNotMatch(bloque, /utm_(source|medium|campaign)=/,
    '🔴 una tarjeta de gremio lleva utm_ escrito a mano. `atribucion.js` no lo pisa, así que ' +
    'sustituiría el origen REAL del visitante en `Merchant.acquisitionSource`.');
});

// ── ⑥ MÓVIL: seis tarjetas son más de tres ───────────────────────────────────────────────────

test('SCRUM-333 · con más de 3 tarjetas, en móvil la rejilla APILA (no hay carrusel que nadie desliza)', () => {
  const bloque = seccionGremios();
  const n = gremiosPublicados(bloque).length;
  assert.ok(n > 3, 'ℹ️ hay ' + n + ' tarjetas: si bajaran de 4 este test sobra y hay que retirarlo con su motivo');

  // La regla vive en el CSS de la propia página; se comprueba ahí y no de memoria.
  assert.match(html, /@media\(max-width:560px\)\{[^}]*\.prods\{grid-template-columns:1fr\}/,
    '🔴 la rejilla `.prods` ya no colapsa a una columna por debajo de 560 px. Con seis tarjetas ' +
    'eso deja tres columnas en un móvil de 390: o se apila, o hay que medirlo otra vez.');
  assert.ok(!/overflow-x\s*:\s*auto/.test(bloque) && !/scroll-snap/.test(bloque),
    '🔴 la sección ha pasado a carrusel. Con seis tarjetas apiladas se ven las seis; en un carrusel ' +
    'se ve la primera y media.');
  assert.ok(bloque.includes('class="prods"'),
    '🔴 la sección ya no usa la rejilla `.prods` del inventario (AB3): un componente nuevo para lo ' +
    'mismo es lo que el inventario existe para evitar.');
});
