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

// Suelo: se exige el MÍNIMO, no el número exacto, para que añadir una pantalla no obligue a tocar
// el guard — uno que estorba en cada PR acaba desactivado.
//
// 31 → 45 el 10-ago-2026 (SCRUM-450). Cuando se escribió había 31 scripts; **hoy hay 51**, así que
// el suelo llevaba 20 de margen: seguía cazando al extractor ciego —que es su trabajo— pero ya no
// tocaba el suelo de nada. Se recalibra dejando holgura para retirar alguna pantalla sin tener que
// volver aquí. Contado con: leer los `<script src>` locales de `dashboard/index.html`.
const MINIMO_SCRIPTS = 45;

/**
 * 🔴 SCRUM-450 · ENTRADAS DEL SHELL QUE **NO** SON FICHEROS DEL REPO.
 *
 * El guard de abajo comprueba que cada entrada resuelva a un fichero bajo `public/`. Eso vale
 * mientras todo lo precacheado sea estático — y **hoy lo es: 54 entradas, 0 que no resuelvan**.
 *
 * Pero H1 va a precachear rutas que sirve el servidor, y ésas **no existen en disco por
 * definición**. El día que entre la primera, este guard acusaría en falso. Y un guard que acusa en
 * falso no se corrige: **se desactiva** — y entonces nadie vigila el precache, que es el escenario
 * del sótano sin offline que este fichero existe para impedir.
 *
 * Lista EXPLÍCITA y con motivo por entrada, no un prefijo ni un patrón: un `startsWith('/api')`
 * exceptuaría de golpe cualquier ruta futura que empiece así, incluida una escrita por error. Aquí
 * cada excepción se declara una a una, como el `CENSO` de SCRUM-402 y las `ENMIENDAS` de SCRUM-427.
 *
 * ⚠️ **HOY ESTÁ VACÍA, y eso NO apaga su control negativo.** El test que la vigila no se apoya en
 * el SHELL real —que no tiene ninguna— sino en un corpus sintético, así que se ejercita igual.
 * Una lista vacía haría verdad cualquier «las servidas no caen»; por eso no se comprueba contra
 * ella.
 */
const SERVIDAS_POR_EL_SERVIDOR = Object.freeze({
  // '/ruta/que/sirve/el/servidor': 'quién la sirve y por qué no está en disco',
});

/**
 * Un directorio se sirve por su `index.html`; el resto es el fichero tal cual bajo `public/`.
 *
 * 🔴 SCRUM-453 · LA QUERY Y EL FRAGMENTO SE PELAN ANTES DE RESOLVER, y no es cosmética.
 *
 * Antes, `/dashboard/js/api.js?v=abc` se buscaba en disco como un fichero LITERAL llamado
 * `api.js?v=abc` — que no existe en ningún sistema de ficheros, y en Windows ni siquiera es un
 * nombre válido. El guard la habría declarado MUERTA y habría dicho que el `install` falla entero.
 *
 * **Y eso es falso.** `express.static` sirve el fichero ignorando la query, así que `cache.addAll`
 * la traería con 200 y el `install` NO fallaría. El guard acusaría de la avería más grave que sabe
 * nombrar por un defecto que no es ésa — y un guard que acusa en falso no se corrige: se desactiva
 * (es el argumento entero de SCRUM-450, aquí aplicado a sí mismo).
 *
 * Pelarla deja el veredicto de existencia diciendo la verdad. El defecto REAL que una query en el
 * SHELL sí supone lo vigila su propio test, abajo.
 */
function aFichero(raiz, r) {
  const limpia = r.replace(/[?#].*$/, '');
  return limpia.endsWith('/')
    ? path.join(raiz, 'public', limpia, 'index.html')
    : path.join(raiz, 'public', limpia);
}

/**
 * Las entradas del SHELL que NO resuelven, excluidas las declaradas como servidas.
 *
 * PURA sobre sus argumentos —recibe las rutas y las excepciones— para que el control negativo se
 * pueda ejercitar con un corpus sintético aunque el SHELL real no tenga ninguna ruta servida.
 */
function rutasMuertas(rutas, excepciones, raiz = RAIZ) {
  return rutas.filter((r) => {
    if (Object.prototype.hasOwnProperty.call(excepciones, r)) return false;
    return !fs.existsSync(aFichero(raiz, r));
  });
}

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
      '  `public/sw.js`.\n\n' +
      '  ⚠️ SCRUM-662: aquí ponía «en el mismo orden que el HTML» y era FALSO. Este guard compara\n' +
      '  con `new Set`: exige la misma LISTA, no la misma secuencia — y de hecho las dos secuencias\n' +
      '  divergen desde antes de aquel ticket. Una frase que miente dentro de un error es peor que\n' +
      '  ninguna: la lee quien está depurando a las once de la noche.',
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

  // SCRUM-450: las declaradas como SERVIDAS quedan fuera — no existen en disco por definición.
  const muertas = rutasMuertas(rutas, SERVIDAS_POR_EL_SERVIDOR);
  assert.deepEqual(
    muertas, [],
    '🔴 EL SHELL PRECACHEA RUTAS QUE NO EXISTEN:\n    ' + muertas.join('\n    ') +
      '\n\n  `cache.addAll` es ATÓMICO: con UNA sola que no resuelva, el `install` falla entero y\n' +
      '  NADIE tiene offline — sin error visible en ninguna parte. Con red no se nota.\n' +
      '  Si el fichero se renombró, actualiza la entrada; si se borró, quítala.\n' +
      '  Si la sirve el SERVIDOR y no existe en disco, decláralo en `SERVIDAS_POR_EL_SERVIDOR`\n' +
      '  con su motivo — pero sólo entonces: esa lista no es un sitio donde callar un fallo.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-450 · EL CONTROL NEGATIVO QUE LE FALTABA A ESTE GUARD
//
// El de arriba comprueba que cada entrada del SHELL resuelva a un fichero. Hoy eso vale porque
// todo lo precacheado es estático —54 entradas, 0 que no resuelvan—, pero **H1 va a precachear
// rutas que sirve el servidor**, y ésas no existen en disco por definición.
//
// El día que entre la primera, el guard acusaría en falso. Y **un guard que acusa en falso no se
// corrige: se desactiva.** Entonces nadie vigila el precache y volvemos al sótano sin offline.
//
// 🔴 EL PROBLEMA DE PROBAR ESTO HOY, Y CÓMO SE RESUELVE
//
// `SERVIDAS_POR_EL_SERVIDOR` está VACÍA, porque hoy no hay ninguna. Un control negativo que se
// apoyara en el SHELL real diría «ninguna servida cae» sobre un conjunto vacío — cierto, hueco, y
// verde para siempre. **Una lista vacía hace verdad cualquier afirmación sobre sus elementos.**
//
// Por eso `rutasMuertas` es PURA sobre sus argumentos: el control negativo se ejercita contra un
// CORPUS SINTÉTICO que siempre tiene una servida y una de disco, exista o no en el producto. Lo
// que se prueba es el MECANISMO, y el mecanismo funciona hoy aunque no tenga clientes.

test('SCRUM-450 · 🔴 CONTROL NEGATIVO: una ruta SERVIDA declarada no hace caer el guard', () => {
  const SERVIDA = '/sintetica/servida/por/el/servidor';
  const corpus = ['/dashboard/js/api.js', SERVIDA];
  const excepciones = { [SERVIDA]: 'sintética: la sirve el servidor, no existe en disco' };

  // SUELO DEL PROPIO CONTROL: el corpus tiene que tener las DOS clases y la de disco tiene que
  // existir de verdad. Si el fichero real desapareciera, este test pasaría por el motivo
  // equivocado y dejaría de decir nada sobre las excepciones.
  assert.ok(fs.existsSync(aFichero(RAIZ, '/dashboard/js/api.js')),
    '🔴 el corpus sintético ya no tiene una ruta de disco REAL: el control negativo compararía ' +
    'dos ausencias y pasaría por el motivo equivocado.');
  assert.ok(!fs.existsSync(aFichero(RAIZ, SERVIDA)),
    '🔴 la ruta «servida» del corpus existe en disco: entonces no prueba la excepción, prueba que ' +
    'un fichero existe.');

  assert.deepEqual(rutasMuertas(corpus, excepciones), [],
    '🔴 una entrada declarada como SERVIDA está haciendo caer el guard. Es exactamente el falso ' +
    'positivo que lo condena: nadie corrige un guard que acusa en falso — lo desactiva.');
});

test('SCRUM-450 · 🔴 la excepción NO es una puerta trasera: lo NO declarado sigue cayendo', () => {
  // La otra dirección, y es la que impide que la lista se convierta en un sitio donde callar
  // fallos: una ruta muerta que *parece* servida, pero que nadie declaró, tiene que caer igual.
  const MUERTA = '/dashboard/js/esto-no-existe-jamas.js';
  const PARECE_SERVIDA = '/api/algo/que-nadie-declaro';
  const corpus = ['/dashboard/js/api.js', MUERTA, PARECE_SERVIDA];

  const muertas = rutasMuertas(corpus, SERVIDAS_POR_EL_SERVIDOR);
  assert.deepEqual(muertas.sort(), [PARECE_SERVIDA, MUERTA].sort(),
    '🔴 una ruta que NO resuelve y que NADIE declaró como servida no está cayendo. La excepción ' +
    'sólo puede excluir lo que está escrito en la lista, una a una: en cuanto excluya por parecido ' +
    '—un prefijo, un patrón— deja de vigilar justo lo que se escribió por error.');

  // Y nombra la ruta, no «el precache falla».
  assert.ok(muertas.includes(MUERTA), '🔴 el guard no nombra la ruta muerta concreta.');
});

test('SCRUM-450 · la lista de servidas está VACÍA hoy, y eso es un hecho medido', () => {
  // Se afirma el estado de hoy para que el día que entre la primera excepción haya que venir aquí
  // a decirlo. Y se exige que toda entrada futura traiga su motivo escrito: una excepción sin
  // motivo es un permiso, no una decisión.
  const entradas = Object.entries(SERVIDAS_POR_EL_SERVIDOR);
  assert.equal(entradas.length, 0,
    `🔴 ha aparecido una excepción y este test no se ha actualizado: ${entradas.map(([k]) => k).join(', ')}. ` +
    'No es que esté mal — es que tiene que constar, con su motivo, en la entrada de máster.');
  for (const [ruta, motivo] of entradas) {
    assert.ok(typeof motivo === 'string' && motivo.length > 20,
      `🔴 «${ruta}» se exceptúa sin decir quién la sirve ni por qué no está en disco.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-453 · EL SHELL SE ESCRIBE PELADO, Y LA HUELLA LA PONE EL SERVIDOR
//
// El circuito real, medido entero en SCRUM-453:
//
//   1. `dashboard/index.html` en disco pide `./js/api.js` — DESNUDO.
//   2. El servidor lo reescribe al servirlo: `sellarReferencias` añade `?v=<huella>`
//      (`core/http/huellaEstaticos.ts`).
//   3. El navegador pide `/dashboard/js/api.js?v=<huella>`.
//   4. El SHELL precachea la ruta PELADA.
//   5. `caches.match(request, { ignoreSearch: true })` las hace casar (guard propio en
//      `tests/scrum453-precache-con-huella.test.mjs`).
//
// 🔴 POR QUÉ UNA HUELLA ESCRITA A MANO EN EL SHELL ES UN DEFECTO INVISIBLE
//
// Congela un valor que el servidor recalcula del CONTENIDO. En cuanto ese fichero cambie, la
// huella escrita queda obsoleta — y el precache seguiría guardando la vieja. Lo peor es que
// **`ignoreSearch` lo taparía**: la petición del navegador casaría igual con la entrada obsoleta,
// así que sin cobertura se serviría una versión que ya no es la del despliegue, sin ningún error
// en ninguna parte. El paso 5, que es lo que hace que el offline funcione, es también lo que
// hace que este defecto no se note.
//
// El guard de existencia no puede cazarlo —ahora que `aFichero` pela la query, resuelve bien—, así
// que se vigila aquí, por separado y con su propio motivo. Las dos mitades del hueco: el veredicto
// deja de mentir, y el defecto real pasa a tener quien lo mire.

/** Las rutas del SHELL que llevan query o fragmento escritos a mano. */
function conQuery(rutas) {
  return rutas.filter((r) => /[?#]/.test(r));
}

test('SCRUM-453 · 🔴 ninguna entrada del SHELL lleva la huella escrita a mano', () => {
  const sw = fs.readFileSync(SW, 'utf8');
  const bloque = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(bloque, '🔴 ESCÁNER CIEGO: no encuentro `const SHELL` en public/sw.js');
  const rutas = [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  // SUELO: sin entradas, «ninguna lleva query» sería cierto y hueco.
  assert.ok(rutas.length >= MINIMO_SCRIPTS,
    `🔴 ESCÁNER CIEGO: veo ${rutas.length} entradas y hay al menos ${MINIMO_SCRIPTS}.`);

  assert.deepEqual(conQuery(rutas), [],
    '🔴 EL SHELL LLEVA UNA HUELLA ESCRITA A MANO:\n    ' + conQuery(rutas).join('\n    ') +
    '\n\n  La huella la calcula el SERVIDOR del contenido del fichero y la inyecta al servir el\n' +
    '  HTML (`sellarReferencias`). Escribirla aquí la CONGELA: en cuanto el fichero cambie, el\n' +
    '  precache seguirá guardando la vieja — y `ignoreSearch` hará que case igual, así que sin\n' +
    '  cobertura se serviría una versión que ya no es la del despliegue, en silencio.\n' +
    '  Escribe la ruta PELADA: el precache y la petición con huella ya casan solos.');
});

test('SCRUM-453 · 🔴 CONTROL NEGATIVO: pelar la query no vuelve ciego al guard de existencia', () => {
  // La mitad peligrosa del arreglo: si `aFichero` pela la query, ¿deja de ver las rutas muertas
  // que la llevan? Una ruta inexistente CON query tiene que seguir cayendo — si no, bastaría con
  // ponerle un `?v=1` a cualquier cosa para que el guard dejara de mirarla.
  const MUERTA_CON_QUERY = '/dashboard/js/esto-no-existe-jamas.js?v=abc123';
  const VIVA_CON_QUERY = '/dashboard/js/api.js?v=abc123';

  assert.deepEqual(rutasMuertas([MUERTA_CON_QUERY], {}), [MUERTA_CON_QUERY],
    '🔴 una ruta que NO existe deja de reportarse muerta por llevar `?v=`: el pelado se ha ' +
    'convertido en una puerta trasera y `cache.addAll` fallaría entero sin que nadie avise.');

  assert.deepEqual(rutasMuertas([VIVA_CON_QUERY], {}), [],
    '🔴 una ruta que SÍ existe se sigue reportando muerta por llevar `?v=`: el guard acusaría de ' +
    '«el install falla entero» —lo más grave que sabe nombrar— cuando `express.static` la sirve ' +
    'sin problema. Un guard que acusa en falso no se corrige: se desactiva.');

  // Y el fragmento se pela igual que la query.
  assert.deepEqual(rutasMuertas(['/dashboard/js/api.js#trozo'], {}), []);
});

test('SCRUM-453 · 🔴 SUELO: el detector de query distingue de verdad', () => {
  // Sin esto, `conQuery` podría devolver siempre `[]` y el test de arriba sería verde para siempre.
  assert.deepEqual(conQuery(['/a.js', '/b.js?v=1', '/c.js', '/d.js#x']), ['/b.js?v=1', '/d.js#x'],
    '🔴 el detector no separa las rutas con huella de las peladas: entonces su «ninguna» no es un ' +
    'hallazgo, es que no sabe mirar.');
  assert.deepEqual(conQuery([]), [],
    '🔴 el detector inventa rutas donde no hay ninguna.');
});
