// SCRUM-274 · EL SHELL DEL SERVICE WORKER Y LOS <script> DEL HTML, ATADOS.
//
// Sin gate: lee dos ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ
//
// `public/sw.js` declaraba su lista de precache como «alineado con los `<script src>` reales de
// dashboard/index.html», y **nada lo ataba**. Prohibición sin mecanismo — la familia que este
// repo lleva la semana desmontando: MODELOS_POR_MERCHANT (SCRUM-172), CODEOWNERS ↔ ZONA_ROJA
// (187), los aislados del runner (199), el semáforo ↔ el emisor (211), el mapa de las tres BD
// (225). Y como en todas, la afirmación ya era falsa cuando se midió: **31 scripts en el HTML,
// 28 en el SHELL**. Faltaban `semaforoFiscal.js`, `quoteMargen.js` y `exportView.js`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS DIRECCIONES, Y POR QUÉ NO BASTA UNA
//
//   HTML → SHELL   falta un script en el precache: la primera visita SIN COBERTURA se queda sin
//                  esa pantalla. Silencioso: con red no se nota nada.
//   SHELL → HTML   sobra una ruta que ya no existe: **`cache.addAll` es ATÓMICO y RECHAZA
//                  ENTERO**. No se precachea a medias — no se precachea NADA, y el `install` del
//                  service worker se va al traste. Un fichero borrado en un PR ajeno deja sin
//                  offline a todo el mundo, y tampoco lo dice nadie.
//
// El segundo sentido es el que más cuesta ver y el de peor consecuencia, y es justo el que un
// guard «que no falte ninguno» no cubriría.
//
// ⚠️ ESTE GUARD NO GENERA EL SHELL, y es deliberado (decisión del fundador). Generarlo obligaría
// a sacar `/sw.js` de `express.static` y servirlo por una ruta que lo inyecte: más superficie por
// un beneficio que atar las dos listas ya da. Aquí siguen siendo dos listas escritas a mano — lo
// que cambia es que ya no pueden separarse en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(RAIZ, 'public', 'dashboard', 'index.html');
const SW = path.join(RAIZ, 'public', 'sw.js');

// Suelo: lo que hay hoy son 31. Se exige el mínimo, no el número exacto, para que añadir una
// pantalla no obligue a tocar el guard — uno que estorba en cada PR acaba desactivado.
const MINIMO_SCRIPTS = 31;

/** Los `<script src>` LOCALES del dashboard, normalizados a la URL que pide el navegador. */
function scriptsDelHtml() {
  const html = fs.readFileSync(HTML, 'utf8');
  return [...html.matchAll(/<script[^>]+src\s*=\s*"([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((s) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(s)) // externas fuera, por absolutas
    .map((s) => s.replace(/^\.\//, '/dashboard/'));
}

/** Las entradas `.js` del SHELL de sw.js. */
function jsDelShell() {
  const sw = fs.readFileSync(SW, 'utf8');
  const bloque = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(
    bloque,
    '🔴 ESCÁNER CIEGO: no encuentro `const SHELL = [ … ];` en public/sw.js. Si se renombró o ' +
      'cambió de forma, este guard dejó de comparar nada y su verde no significaría nada.',
  );
  return [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((s) => s.endsWith('.js'));
}

test('SCRUM-274 · SUELO: el extractor ve los scripts y el SHELL de verdad', () => {
  const enHtml = scriptsDelHtml();
  const enShell = jsDelShell();

  assert.ok(
    enHtml.length >= MINIMO_SCRIPTS,
    `🔴 ESCÁNER CIEGO: veo ${enHtml.length} <script src> locales y el dashboard tiene al menos ` +
      `${MINIMO_SCRIPTS}. Si el HTML cambió de forma, la comparación de abajo sería cierta sobre ` +
      'un conjunto vacío — un verde peor que un rojo.',
  );
  assert.ok(
    enShell.length >= MINIMO_SCRIPTS,
    `🔴 ESCÁNER CIEGO: veo ${enShell.length} entradas .js en el SHELL y deberían ser al menos ` +
      `${MINIMO_SCRIPTS}.`,
  );
});

test('SCRUM-274 · el SHELL del service worker lleva TODOS los <script> del dashboard', () => {
  const enHtml = scriptsDelHtml();
  const enShell = new Set(jsDelShell());

  const faltan = enHtml.filter((s) => !enShell.has(s));
  assert.deepEqual(
    faltan, [],
    '🔴 EL SHELL NO PRECACHEA ESTOS SCRIPTS QUE EL DASHBOARD SÍ CARGA:\n' +
      faltan.map((s) => `    ${s}`).join('\n') +
      '\n\n  La primera visita SIN COBERTURA se queda sin esas pantallas, y con red no se nota\n' +
      '  nada — por eso llevaba tiempo desalineado sin que saltara. Añádelos a `SHELL` en\n' +
      '  `public/sw.js`, en el mismo orden que el HTML.',
  );
});

test('SCRUM-274 · el SHELL no precachea nada que el dashboard ya no cargue (addAll es ATÓMICO)', () => {
  const enHtml = new Set(scriptsDelHtml());
  const enShell = jsDelShell();

  const sobran = enShell.filter((s) => !enHtml.has(s));
  assert.deepEqual(
    sobran, [],
    '🔴 EL SHELL PRECACHEA SCRIPTS QUE EL DASHBOARD YA NO CARGA:\n' +
      sobran.map((s) => `    ${s}`).join('\n') +
      '\n\n  Esto es lo GRAVE de los dos sentidos: `cache.addAll` es ATÓMICO. Si una sola de esas\n' +
      '  rutas ya no existe, RECHAZA ENTERA — el precache no se queda a medias, se queda en nada\n' +
      '  y el `install` del service worker falla. Un fichero borrado en otro PR dejaría sin\n' +
      '  offline a todo el mundo, en silencio.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-302 · Y CADA ENTRADA TIENE QUE RESOLVER A UN FICHERO DE VERDAD
//
// Los dos tests de arriba comparan HTML ↔ SHELL, que es la mitad de la pregunta. La otra mitad
// es si lo listado EXISTE, y no la cubría nadie:
//
//   · una ruta puede estar en el HTML **y** en el SHELL y no existir en el árbol — entonces los
//     dos están mal a la vez y la comparación sigue verde;
//   · y el SHELL lleva entradas que NO son scripts (`/dashboard/`, `/tokens.css`, el CSS): si una
//     de ésas se renombra, la comparación HTML↔SHELL ni se entera.
//
// ⚠️ POR QUÉ IMPORTA TANTO: `cache.addAll` es **ATÓMICO** (SCRUM-231). Una sola ruta que no
// resuelva hace fallar el `install` ENTERO — el precache no se queda a medias, se queda en NADA —
// y **todos los usuarios pierden el offline a la vez**, en silencio: no hay error en el servidor,
// ni 500, ni log. Con red no se nota absolutamente nada.
//
// El riesgo real es de MERGE, y por eso el guard nace ahora: tres ramas añadieron ficheros a esta
// lista el mismo día. Basta con que una renombre el suyo después de que otra lo haya listado.
test('SCRUM-274 (+302) · toda entrada del SHELL resuelve a un fichero del árbol', () => {
  const sw = fs.readFileSync(SW, 'utf8');
  const bloque = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(bloque, '🔴 ESCÁNER CIEGO: no encuentro `const SHELL` en public/sw.js');
  const rutas = [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  // SUELO: si el extractor deja de ver entradas, «ninguna muerta» y «no supe mirar» serían el
  // mismo verde y significan lo contrario.
  assert.ok(
    rutas.length >= MINIMO_SCRIPTS,
    `🔴 ESCÁNER CIEGO: veo ${rutas.length} entradas en el SHELL y hay al menos ${MINIMO_SCRIPTS}`,
  );

  // Un directorio se sirve por su index.html; el resto es el fichero tal cual bajo `public/`.
  const aFichero = (r) => (r.endsWith('/')
    ? path.join(RAIZ, 'public', r, 'index.html')
    : path.join(RAIZ, 'public', r));

  const muertas = rutas.filter((r) => !fs.existsSync(aFichero(r)));
  assert.deepEqual(
    muertas, [],
    '🔴 EL SHELL PRECACHEA RUTAS QUE NO EXISTEN:\n    ' + muertas.join('\n    ') +
      '\n\n  `cache.addAll` es ATÓMICO: con UNA sola que no resuelva, el `install` falla entero y\n' +
      '  NADIE tiene offline — sin error visible en ninguna parte. Con red no se nota.\n' +
      '  Si el fichero se renombró, actualiza la entrada; si se borró, quítala.',
  );
});
