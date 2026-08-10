// tests/scrum414-url-a-mano.test.mjs — SCRUM-414
//
// UNA URL NO SE PARSEA DONDE SU ERROR PUEDA HABLAR. Y LA CONVENCIÓN QUE PROMETE ESTAR IGNORADA,
// LO ESTÁ DE VERDAD.
//
// ── DE DÓNDE SALE: EL GUARD ATADO A LA FORMA, SEXTA VARIANTE ────────────────────────────────
// `scrum195-url-bd-sin-fuga` enunciaba «ningún script parsea una URL de BD a mano» y la hacía
// cumplir mirando **el nombre de la variable** (`/db|database|conn|dsn|postgres|pg/i`). Basta con
// llamarla `u` para salir del radar — y así estaba: tres scripts (`backfill-quote-jobid`,
// `conciliar-auditoria-fiscal`, `preflight-schema-drift`) parseaban a mano en `main` **con el guard
// en verde**. Los tres YA IMPORTABAN `_db-guard.mjs`; nadie usaba `parseBDSegura` porque nada lo
// exigía.
//
// Es la sexta vez que muerde el mismo patrón en este repo: ternario, `||`, objeto indexado,
// puntuación, número de línea… y ahora el identificador. **Un nombre de variable no es un hecho.**
//
// ── EL HECHO, QUE ES LO QUE SE VIGILA AHORA ─────────────────────────────────────────────────
// Lo que filtró una credencial de producción no fue cómo se llamaba nada: fue que **`new URL()`
// lanza un error que lleva la cadena entera en `e.input`**, y ese objeto acabó volcado por el
// manejador de excepciones no capturadas. El hecho peligroso es *¿puede alguien llegar a ese
// error?*, y eso lo dice el `try/catch`, no el nombre:
//
//   · `catch {` sin binding → el error es INALCANZABLE. Seguro por construcción, hoy y el día que
//     alguien meta una línea de depuración.
//   · `catch (e)` → alcanzable. El primer `console.error(e)` lo publica.
//   · sin `try` → sube al manejador global, que vuelca el objeto. **Es lo que pasó.**
//
// Se mira TODO `new URL` de `scripts/`, no solo los que parecen de BD: en este proyecto una URL de
// petición también lleva secretos (los `portalToken` viajan en la ruta).
//
// Y se deriva con **AST**, no con `grep`: el censo por regex de esta misma tarea contaba 10 y de
// verdad eran 7 — tres de la diferencia estaban en `_db-guard.mjs`, y una era **la línea de un
// comentario que explica el problema**. La trampa de autorreferencia de SCRUM-203, otra vez.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { censoNewUrl } from './_censo-new-url.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

test('SCRUM-414 · SUELO: el censo ve los `new URL` y sabe cuál es el parseo seguro', () => {
  const h = censoNewUrl(RAIZ);
  assert.ok(h.length >= 3,
    `🔴 el censo solo ve ${h.length} \`new URL\` en scripts/: no está mirando donde cree, y «no hay `
    + 'parseos a mano» pasaría a significar «no miré ninguno»');

  // La exención se deriva de lo que el módulo EXPORTA, no de su nombre. Si esa derivación se
  // rompiera, el parseo seguro se marcaría a sí mismo y el guard sería inusable — o peor, alguien
  // lo silenciaría con una lista de nombres.
  const exentos = h.filter((x) => x.esElParseoSeguro);
  assert.ok(exentos.length > 0,
    '🔴 el censo no reconoce el módulo que exporta `parseBDSegura`. La exención se deriva de esa '
    + 'exportación: si ha dejado de encontrarla, o el parseo seguro se ha movido, o la derivación está rota');

  // Y que el detector distinga de verdad las tres protecciones: si todo le saliera «catch-ciego»,
  // el guard daría verde eternamente.
  assert.ok(h.every((x) => ['catch-ciego', 'catch-con-binding', 'sin-try'].includes(x.proteccion)),
    '🔴 hay veredictos que el censo no sabe clasificar');
});

test('SCRUM-414 · ningún `new URL` de scripts/ deja su error al alcance', () => {
  const culpables = censoNewUrl(RAIZ)
    .filter((x) => !x.seguro && !x.esElParseoSeguro)
    .map((x) => `${path.join('scripts', x.fichero)}:${x.linea} — new URL(${x.argumento}) · ${x.proteccion}`);

  assert.deepEqual(
    culpables, [],
    '🔴 UN `new URL` CON EL ERROR AL ALCANCE:\n    ' + culpables.join('\n    ')
    + '\n\n  `new URL()` lanza con la cadena ENTERA dentro (`e.input`). Mientras el `catch` sea ciego\n'
    + '  —`catch {`, sin binding— nadie puede imprimirla ni por accidente. En cuanto el error se\n'
    + '  captura en una variable, o no se captura, alguien acaba volcándolo: eso costó rotar una\n'
    + '  credencial de PRODUCCIÓN.\n\n'
    + '  Si lo que parseas es una URL de BD, la respuesta no es envolverlo mejor: es\n'
    + '  `parseBDSegura` de scripts/_db-guard.mjs, que ya está importado en casi todos.');
});

test('SCRUM-414 · el módulo exento lo es porque sus catch son ciegos, no por serlo', () => {
  // La exención no puede ser un agujero. Si el `new URL` del parseo seguro dejara de estar bajo un
  // catch ciego, el único sitio del repo autorizado a ver una URL con contraseña dentro pasaría a
  // poder publicarla — y este guard lo estaría eximiendo justo entonces.
  const exentos = censoNewUrl(RAIZ).filter((x) => x.esElParseoSeguro);
  const abiertos = exentos.filter((x) => !x.seguro).map((x) => `${x.fichero}:${x.linea} (${x.proteccion})`);
  assert.deepEqual(
    abiertos, [],
    '🔴 el módulo del parseo seguro tiene un `new URL` con el error alcanzable: ' + abiertos.join(', ')
    + '\n\n  Es el ÚNICO sitio autorizado a mirar una URL con credenciales. Su exención se sostiene\n'
    + '  sobre que su error no se pueda tocar; sin eso, la exención es el agujero.');
});

// ── La convención documentada tiene que ser CIERTA ──────────────────────────────────────────

/** ¿Git ignora esta ruta? Se le pregunta A GIT, no al `.gitignore`. */
function gitIgnora(rutaRelativa) {
  const r = spawnSync('git', ['check-ignore', '-q', rutaRelativa], { cwd: RAIZ });
  // 0 = ignorada · 1 = NO ignorada · cualquier otra cosa = no se pudo preguntar.
  assert.ok(r.status === 0 || r.status === 1,
    `🔴 no se pudo preguntar a git por ${rutaRelativa} (status ${r.status}). `
    + '«Está ignorado» y «no supe preguntarlo» son el mismo verde.');
  return r.status === 0;
}

test('SCRUM-414 · los desechables de BD están ignorados DE VERDAD, no solo en la promesa', () => {
  // La cabecera de `scrum195-url-bd-sin-fuga` manda poner los scripts desechables de BD en
  // `scripts/tmp-*.mjs` —en scripts/, no en el scratchpad, para que este censo los VEA— y afirmaba
  // que ya estaban ignorados por git. **No lo estaban**: solo existía `tmp/`, un directorio. Quien
  // seguía la convención al pie de la letra commiteaba su script de base de datos, y precisamente
  // la promesa hacía que no lo comprobara.
  //
  // Se comprueba con `git check-ignore` y no leyendo `.gitignore`: que un fichero diga un patrón y
  // que git lo aplique son dos hechos distintos, y el que importa es el segundo.
  assert.ok(
    gitIgnora('scripts/tmp-loquesea.mjs'),
    '🔴 `scripts/tmp-*.mjs` NO está ignorado por git, y la convención documentada manda escribir '
    + 'ahí los scripts desechables que tocan una base de datos.\n\n'
    + '  Quien la siga commitea su script de BD. O se ignora de verdad, o la cabecera de '
    + 'scrum195-url-bd-sin-fuga deja de prometerlo.');

  // SUELO: si `check-ignore` respondiera que sí a todo —o si alguien metiera un patrón demasiado
  // ancho, tipo `scripts/*`— este guard sería una firma en blanco.
  //
  // ⚠️ LA RUTA DEL SUELO NO PUEDE ESTAR SEGUIDA POR GIT, y esto lo aprendí con el rojo que NO salió:
  // la primera versión preguntaba por `scripts/backup-dump.mjs`, y `git check-ignore` **omite los
  // ficheros que están en el índice** — responde «no ignorado» para un fichero seguido aunque el
  // patrón case (verificado: con `scripts/*` puesto da status 1, y con `--no-index` da 0). O sea que
  // el suelo pasaba SIEMPRE y no comprobaba nada. Una ruta inventada y no seguida sí responde a los
  // patrones, que es lo que hay que medir.
  assert.ok(
    !gitIgnora('scripts/una-ruta-normal-que-no-existe.mjs'),
    '🔴 git dice que un script normal también está ignorado. O el patrón se ha comido medio '
    + 'directorio, o la comprobación responde que sí a todo y no vigila nada.');
});

test('SCRUM-414 · la convención sigue escrita donde manda a la gente', () => {
  // Si la promesa desapareciera de la cabecera, el `.gitignore` quedaría huérfano y el siguiente
  // desechable volvería al scratchpad, donde este censo NO lo ve. Las dos mitades van juntas.
  const guard195 = fs.readFileSync(path.join(RAIZ, 'tests/scrum195-url-bd-sin-fuga.test.mjs'), 'utf8');
  assert.match(guard195, /scripts\/tmp-\*/,
    '🔴 la cabecera ya no manda poner los desechables de BD en `scripts/tmp-*.mjs`. Si la convención '
    + 'ha cambiado, cambia también el `.gitignore` y este guard; si no, vuelve a escribirla');
});
