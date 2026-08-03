// SCRUM-274 · NINGÚN ESTÁTICO DEL DASHBOARD SE SIRVE SIN HUELLA.
//
// Sin gate: sella el HTML real en memoria y lo inspecciona. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA, Y POR QUÉ NO BASTA CON MIRAR EL FICHERO FUENTE
//
// El HTML del repo NO lleva huellas: se las pone el servidor al arrancar. Así que un guard que
// leyera `public/dashboard/index.html` estaría midiendo el objeto equivocado — vería 36
// referencias peladas y no sabría decir si el sellado funciona. Este test **ejecuta el sellado
// de verdad** (el mismo `sellarReferencias` que usa `app.ts`) y mira el resultado, que es lo que
// llega al navegador.
//
// EL SUELO ANTI-ESCÁNER-CIEGO es la mitad del valor. Si el HTML cambia de forma —comillas
// simples, un atributo partido en dos líneas— la regex del extractor podría dejar de ver las
// referencias, y entonces «todas las locales llevan huella» sería VERDAD sobre un conjunto
// vacío. Un verde así es peor que un rojo. Por eso se exige un mínimo de referencias ANTES de
// comprobar nada sobre ellas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(RAIZ, 'public');
const BASE_URL = '/dashboard/';

// Lo que hay HOY: 31 <script src> + 3 <link> locales (tokens.css, styles.css, icon) + manifest
// y apple-touch-icon. El suelo se pone en los DOS números que el ticket fijó (31 scripts y 34
// referencias locales) y no en el total exacto: exigir el número exacto convertiría este guard
// en un estorbo cada vez que alguien añada una pantalla, y un guard que estorba se desactiva.
const MINIMO_SCRIPTS = 31;
const MINIMO_LOCALES = 34;

const {
  sellarReferencias, crearHuellas, referenciasDe, esExterna, resolverEstatico,
  PARAM_HUELLA, CACHE_CON_HUELLA,
} = await import('../dist/core/http/huellaEstaticos.js');

/** El HTML tal como lo sirve el servidor: leído del disco y sellado. */
function htmlServido() {
  const crudo = fs.readFileSync(path.join(PUBLIC_DIR, 'dashboard', 'index.html'), 'utf8');
  return sellarReferencias(crudo, {
    publicDir: PUBLIC_DIR,
    baseUrl: BASE_URL,
    huellaDeFichero: crearHuellas(fs),
  });
}

const RE_HUELLA = new RegExp(`[?&]${PARAM_HUELLA}=[0-9a-f]{10}(?:&|$)`);

test('SCRUM-274 · SUELO: el extractor ve las referencias que de verdad hay', () => {
  const html = htmlServido();
  const refs = referenciasDe(html, { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });
  const scripts = (html.match(/<script[^>]+src\s*=/gi) || []).length;
  const locales = refs.filter((r) => !r.externa);

  assert.ok(
    scripts >= MINIMO_SCRIPTS,
    `🔴 ESCÁNER CIEGO: veo ${scripts} <script src> y el dashboard tiene al menos ${MINIMO_SCRIPTS}. ` +
      'Si el HTML cambió de forma (comillas simples, atributo partido), la regex dejó de verlos y ' +
      'el verde de los tests de abajo no significaría nada: serían ciertos sobre un conjunto vacío.',
  );
  assert.ok(
    locales.length >= MINIMO_LOCALES,
    `🔴 ESCÁNER CIEGO: veo ${locales.length} referencias locales y debería haber al menos ${MINIMO_LOCALES}.`,
  );
});

test('SCRUM-274 · ningún <script> ni <link> LOCAL del dashboard se sirve sin huella', () => {
  const refs = referenciasDe(htmlServido(), { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });

  const sinHuella = refs
    .filter((r) => !r.externa && r.fichero)
    .filter((r) => !RE_HUELLA.test(r.valor))
    .map((r) => `${r.atributo}="${r.valor}"`);

  assert.deepEqual(
    sinHuella, [],
    '🔴 HAY UN ESTÁTICO DEL DASHBOARD SIN HUELLA:\n' + sinHuella.map((s) => `    ${s}`).join('\n') +
      '\n\n  Sin huella en la URL no hay forma de invalidar una copia cacheada: el fichero nuevo se\n' +
      '  llama igual que el viejo. Eso es lo que obligaba a servir todo con `max-age=0` y a\n' +
      '  rebajarse los ~858 KB del dashboard en CADA despliegue.\n\n' +
      '  El sellado es automático (`sellarReferencias`): si algo sale sin huella, o el fichero no\n' +
      '  existe donde dice la referencia, o el sellador ha dejado de reconocer esa forma.',
  );
});

test('SCRUM-274 · una referencia local que NO existe se caza aquí, no en la consola del navegador', () => {
  const refs = referenciasDe(htmlServido(), { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });
  const rotas = refs.filter((r) => !r.externa && !r.fichero).map((r) => `${r.atributo}="${r.valor}"`);

  assert.deepEqual(
    rotas, [],
    '🔴 EL DASHBOARD APUNTA A UN FICHERO QUE NO EXISTE:\n' + rotas.map((s) => `    ${s}`).join('\n') +
      '\n\n  No se puede sellar lo que no está. Hasta ahora un `src` roto era invisible hasta que\n' +
      '  alguien abría la consola del navegador; ahora se cae en `npm test`.',
  );
});

test('SCRUM-274 · las externas quedan fuera POR SER ABSOLUTAS, no por una lista de dominios', () => {
  // La propiedad la tiene la URL, así que un dominio NUEVO queda fuera solo, sin que nadie lo
  // añada a ningún sitio. Una allowlist envejecería igual que la lista de referencias que este
  // ticket viene a eliminar.
  for (const externa of [
    'https://fonts.googleapis.com/css2?family=Inter',
    'http://ejemplo.test/x.js',
    '//cdn.ejemplo.test/x.js',
    'data:text/css,body{}',
    'mailto:hola@yaqu.app',
    '#seccion',
  ]) {
    assert.equal(esExterna(externa), true, `🔴 «${externa}» debería contar como externa`);
  }
  for (const local of ['./js/api.js', '/tokens.css', 'css/styles.css']) {
    assert.equal(esExterna(local), false, `🔴 «${local}» es local y se ha tomado por externa`);
  }

  // Y en el HTML real: las de Google Fonts siguen intactas, sin `?v=` añadido.
  const refs = referenciasDe(htmlServido(), { publicDir: PUBLIC_DIR, baseUrl: BASE_URL });
  const externasTocadas = refs.filter((r) => r.externa && RE_HUELLA.test(r.valor));
  assert.deepEqual(
    externasTocadas.map((r) => r.valor), [],
    '🔴 se ha sellado una URL externa: la huella se calcula de un fichero NUESTRO, así que en una ' +
      'URL ajena no significa nada y además le cambia la clave de caché al tercero.',
  );
});

test('SCRUM-274 · el sellador NO sale de public/ (una referencia con `../..` no se sella)', () => {
  // No es paranoia decorativa: si resolviera, le pondríamos huella y `immutable` a un fichero
  // del servidor que no es un estático público.
  assert.equal(
    resolverEstatico('../../package.json', { publicDir: PUBLIC_DIR, baseUrl: BASE_URL }),
    null,
    '🔴 una referencia con `../..` ha resuelto FUERA de public/',
  );
  assert.notEqual(
    resolverEstatico('./js/api.js', { publicDir: PUBLIC_DIR, baseUrl: BASE_URL }),
    null,
    '🔴 ESCÁNER CIEGO: `./js/api.js` debería resolver — si no, el test de arriba pasa por el motivo equivocado',
  );
});

test('SCRUM-274 · `immutable` es una promesa comprobada, no una etiqueta: exige que la huella CUADRE', () => {
  // La lógica de `setHeaders` de app.ts, ejercitada sin servidor. Lo que se afirma es que una
  // huella VIEJA (o inventada) no consigue `immutable` — si lo consiguiera, un fichero editado
  // quedaría congelado un año bajo una URL que ya no le corresponde.
  const huella = crearHuellas(fs);
  const fichero = path.join(PUBLIC_DIR, 'dashboard', 'js', 'api.js');
  const real = huella(fichero);

  assert.match(real, /^[0-9a-f]{10}$/, '🔴 la huella no tiene la forma esperada');
  assert.equal(real, huella(fichero), '🔴 la huella no es estable entre dos lecturas del MISMO fichero');
  assert.notEqual(real, '0000000000', '🔴 huella degenerada');
  assert.match(
    CACHE_CON_HUELLA, /immutable/,
    '🔴 la cabecera de huella válida ha dejado de ser immutable — sin eso el ticket no entrega nada',
  );
});

test('SCRUM-274 · dos contenidos distintos dan huellas distintas (o no invalida nada)', () => {
  const huella = crearHuellas(fs);
  const a = huella(path.join(PUBLIC_DIR, 'dashboard', 'js', 'api.js'));
  const b = huella(path.join(PUBLIC_DIR, 'dashboard', 'js', 'app.js'));
  assert.notEqual(a, b, '🔴 dos ficheros distintos comparten huella: la invalidación no funcionaría');
});
