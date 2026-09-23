// tests/scrum711-guards-sin-sitio.test.mjs — SCRUM-711
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ GUARD NO CORRE EN NINGÚN SITIO?
//
// El ticket nació el 3-sep-2026 con un síntoma —«Nuevo cliente» a 30 px sin que nadie lo viera— y
// una causa: `guard:objetivo-tactil` estaba escrito, era correcto y no lo ejecutaba nadie. Un guard
// así se lee como cobertura y protege lo mismo que uno que no existe.
//
// 🔴 LA PREMISA CADUCÓ, Y SE DICE. Hoy ese guard SÍ corre: el job «guards de navegador» de CI lo
// ejecuta a través de `guards:visuales`. Así que la pregunta útil ya no es la del ticket («¿corre
// con la tanda?») sino la de debajo: ¿hay algún guard que no corra NI en `npm test` NI en ningún
// workflow? Y, sobre todo: ¿qué impide que el próximo que se escriba se quede así?
//
// ── MEDIDO EL 15-SEP-2026 SOBRE `origin/main` = `9070f3d7` ─────────────────────────────────────
// Comparando CONJUNTOS —los guards ejecutables que existen frente a los que algo invoca—:
//
//     guards ejecutables en scripts/   →  24
//     invocados por npm test o por CI  →  22
//     sin invocar                      →   2   y los dos corren igualmente, por otro camino:
//        · guard-conformidad-landing.mjs → su comprobación corre en la tanda por su módulo puro:
//          `scrum400` llama a `comprobarEnDisco(RAIZ)` sobre el árbol real. Sobra el CLI, no el guard.
//        · guards-entrada.mjs → runner local para empujar una entrada del registro; sus cuatro
//          comprobaciones son `tests/*.test.mjs`, así que ya corren en la tanda.
//     guards que no corren en ningún sitio  →  0
//
// Un cero no se cree por sí solo (SCRUM-846): abajo va el CASO CONOCIDO —la situación exacta del
// 3-sep, fabricada— y el censo tiene que verlo con la MISMA función que da el cero sobre el árbol.
//
// ── QUÉ CUENTA COMO GUARD, Y QUÉ NO (el límite, declarado) ─────────────────────────────────────
//   ✔ POBLACIÓN: los EJECUTABLES — `scripts/guard-*.mjs`, `scripts/guards-*.mjs`,
//     `scripts/meta-guard-*.mjs`, y todo fichero que ejecute una clave `guard:*`/`guards:*` de
//     `package.json` (así entran los dos `_prisma-*-guard.mjs`).
//   ✘ Los módulos `_*.mjs` que no se ejecutan solos son LIBRERÍAS: corren si corre quien los
//     importa, y se cuentan a través de él.
//   ✘ Los tests: de «un fichero con tests que la tanda no ejecuta» ya se ocupa SCRUM-708.
//   ✘ Los hooks `guard-dangerous` de `.claude/` y `.codex/`: corren en cada orden del agente, no
//     en CI, por naturaleza. Su lógica la ejercitan cinco tests de la tanda (`scrum176`…).
//   ✘ Subcarpetas de `scripts/`: el censo lee el primer nivel. Un test de abajo exige que no haya
//     ningún guard en ellas, para que este límite no se vuelva un hueco en silencio.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';
import { sinComentario } from '../scripts/_invocaciones-de-la-tanda.mjs';
import { ficheroDe } from '../scripts/_solape-de-guards.mjs';
// Importar la puerta NO la ejecuta (probado en SCRUM-522). Se usa SU regla para saber qué guards
// corre, en vez de copiarla: si la puerta cambia de criterio, este censo cambia con ella.
import { fueraDeLaTanda } from '../scripts/guards-visuales.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un guard EJECUTABLE por su nombre. Primer nivel de `scripts/`: ver el límite de arriba. */
export const ES_GUARD_EJECUTABLE = /^scripts\/(?:guard-|guards-|meta-guard-)[\w.-]+\.mjs$/;

/** TODOS los `scripts/X.mjs` de un comando. `ficheroDe` sólo da el primero, y `guard:prisma` lleva dos. */
const ficherosDeComando = (cmd) => [...String(cmd || '').matchAll(/scripts\/[A-Za-z0-9._-]+\.mjs/g)].map((m) => m[0]);

/**
 * Las líneas que un workflow EJECUTA: el contenido de sus `run:`, sin comentarios.
 *
 * ⚠️ Es el mismo recorrido que `deWorkflows` de `_invocaciones-de-la-tanda.mjs`, que no se puede
 * reutilizar entero porque sólo devuelve las invocaciones DE LA TANDA. Se importa su
 * `sinComentario` —la parte delicada, la que respeta comillas— y se repite el recorrido.
 *
 * 🔴 Sin quitar comentarios, este censo mentiría del lado peligroso: `ci.yml` nombra
 * `npm run guards:visuales` en decenas de líneas explicativas, y cada una contaría como invocación.
 */
export function lineasDeRun(textoYaml) {
  const out = [];
  let dentro = false;
  let sangriaRun = 0;
  for (const cruda of String(textoYaml).split('\n')) {
    const sangria = cruda.length - cruda.trimStart().length;
    const limpia = sinComentario(cruda);
    const m = /^\s*(-\s+)?run:\s*(\|-?|>-?)?\s*(.*)$/.exec(limpia);
    if (m) {
      dentro = !!m[2];
      sangriaRun = sangria;
      if (m[3].trim()) out.push(m[3]);
      continue;
    }
    if (dentro) {
      if (cruda.trim() && sangria <= sangriaRun) { dentro = false; continue; }
      out.push(limpia);
    }
  }
  return out;
}

/** Los runners que ejecutan OTROS guards, con SU propia regla de a quién ejecutan. */
const RUNNERS = {
  'scripts/guards-visuales.mjs': (scripts) =>
    fueraDeLaTanda(scripts).map((k) => ficheroDe(scripts, k)).filter(Boolean),
};

/**
 * EL CENSO. Puro: recibe el árbol ya leído, así que se le puede poner delante uno fabricado.
 *
 * @param {object} a
 * @param {string[]} a.ficherosScripts  rutas `scripts/X.mjs` del primer nivel
 * @param {object}   a.scripts          el `scripts` de package.json
 * @param {string[]} a.workflows        el TEXTO de cada workflow
 * @param {object}   a.declarados       fichero → motivo, para los que corren por otro camino
 */
export function censar({ ficherosScripts, scripts, workflows, declarados = {} }) {
  const porNombre = ficherosScripts.filter((f) => ES_GUARD_EJECUTABLE.test(f));
  const porClave = Object.keys(scripts)
    .filter((k) => /^guards?:/.test(k))
    .flatMap((k) => ficherosDeComando(scripts[k]));
  const poblacion = [...new Set([...porNombre, ...porClave])].sort();

  const invocados = new Set();
  const vistas = new Set();
  const anotar = (fichero) => {
    if (invocados.has(fichero)) return;
    invocados.add(fichero);
    if (RUNNERS[fichero]) for (const f of RUNNERS[fichero](scripts)) anotar(f);
  };
  const expandir = (clave) => {
    if (vistas.has(clave) || !(clave in scripts)) return;
    vistas.add(clave);
    const cmd = String(scripts[clave]);
    for (const f of ficherosDeComando(cmd)) anotar(f);
    for (const m of cmd.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)) expandir(m[1]);
    if (/\bnpm\s+test\b/.test(cmd)) { expandir('pretest'); expandir('test'); }
  };
  for (const texto of workflows) {
    for (const linea of lineasDeRun(texto)) {
      for (const f of ficherosDeComando(linea)) anotar(f);
      for (const m of linea.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)) expandir(m[1]);
      // `npm test` ejecuta antes `pretest`: ahí corren los dos guards del cliente de Prisma.
      if (/\bnpm\s+test\b/.test(linea)) { expandir('pretest'); expandir('test'); }
    }
  }

  const declaradosLista = Object.keys(declarados);
  return {
    poblacion,
    invocados: [...invocados].sort(),
    sinSitio: poblacion.filter((f) => !invocados.has(f) && !declaradosLista.includes(f)),
    // Una declaración que ya no hace falta NO se deja: se borra (criterio de SCRUM-402/424).
    declaracionesSobrantes: declaradosLista.filter((f) => invocados.has(f) || !poblacion.includes(f)),
  };
}

// ── LOS QUE CORREN POR OTRO CAMINO, con la prueba que lo sostiene ──────────────────────────────
// Cada uno lleva una prueba COMPROBABLE. Sin ella, esta lista sería el sitio donde esconder un
// guard que no corre — exactamente lo que el ticket viene a impedir.
export const DECLARADOS = {
  'scripts/guard-conformidad-landing.mjs': {
    porque: 'su comprobación corre en la tanda a través de su módulo puro: scrum400 la ejecuta sobre el árbol real',
    prueba: { fichero: 'tests/scrum400-conformidad-landing.test.mjs', llamada: 'comprobarEnDisco(RAIZ)' },
  },
  'scripts/guards-entrada.mjs': {
    porque: 'runner local para empujar una entrada del registro; lo que ejecuta son tests de la tanda',
    prueba: { susGuardsSonDeLaTanda: true },
  },
  'scripts/guard-acreditacion-invoicing-es.mjs': {
    porque: 'SCRUM-1097/1109: su CLI no lo invoca npm test ni CI — corre por su propio contrato de '
      + 'bandera (--staging/--prod-ro), programado en Railway contra producción (SCRUM-1109), fuera '
      + 'del repo. Su módulo puro SÍ corre en la tanda: tests/scrum1097-… llama DIRECTAMENTE a sus '
      + 'dos funciones exportadas, y scripts/aviso-programado-… las llama a su vez desde dentro de '
      + '`ejecutarPasada`, que tests/scrum1109-… ejercita de verdad.',
    prueba: {
      directas: {
        fichero: 'tests/scrum1097-guard-acreditacion-invoicing-es.test.mjs',
        llamadas: ['medirAcreditacion', 'verificarSoloLecturaEstructural'],
      },
      indirectas: {
        envoltorio: 'scripts/aviso-programado-acreditacion-invoicing-es.mjs',
        llamadas: ['medirAcreditacion', 'verificarSoloLecturaEstructural'],
        testDelEnvoltorio: 'tests/scrum1109-aviso-programado-acreditacion-invoicing-es.test.mjs',
        llamadaDelTest: 'ejecutarPasada',
      },
    },
  },
};

// ── EL ÁRBOL REAL ────────────────────────────────────────────────────────────────────────────
function leerArbol() {
  const dirScripts = path.join(RAIZ, 'scripts');
  const dirWf = path.join(RAIZ, '.github', 'workflows');
  return {
    ficherosScripts: fs.readdirSync(dirScripts, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
      .map((e) => 'scripts/' + e.name),
    scripts: JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts,
    workflows: fs.readdirSync(dirWf).filter((n) => /\.ya?ml$/.test(n))
      .map((n) => fs.readFileSync(path.join(dirWf, n), 'utf8')),
  };
}

/**
 * Los patrones que expande `node --test` en el script `test`.
 * ⚠️ Mismo criterio que `patronesDeLaTanda` de SCRUM-708, repetido a propósito: aquél vive en un
 * fichero de test, e importarlo registraría sus tests otra vez dentro de éste.
 */
function patronesDeLaTanda(script) {
  const conNode = String(script || '').split('&&').find((t) => /(^|\s)node\s+--test(\s|$)/.test(t));
  if (!conNode) return [];
  // SCRUM-858b · detrás de `--test`, no del primer `node`: la tanda va envuelta
  // (`node scripts/tanda-con-veredicto.mjs node --test …`) y el `.mjs` del envoltorio no es un patrón.
  const palabras = conNode.trim().split(/\s+/);
  return palabras.slice(palabras.indexOf('--test') + 1)
    .filter((a) => !a.startsWith('-') && /\.m?js$/.test(a))
    .map((p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ① EL CASO CONOCIDO: la situación exacta del 3-sep-2026, fabricada
// ═════════════════════════════════════════════════════════════════════════════════════════════

const PKG_CON_TACTIL = {
  test: 'npm run build && node --test tests/*.test.mjs',
  'guard:objetivo-tactil': 'node scripts/guard-objetivo-tactil.mjs',
  '//guard:objetivo-tactil': 'mide en navegador (puppeteer-core) el área de toque',
  'guards:visuales': 'node scripts/guards-visuales.mjs',
};
const FICHEROS_CON_TACTIL = ['scripts/guard-objetivo-tactil.mjs', 'scripts/guards-visuales.mjs', 'scripts/_utilidad.mjs'];

test('SCRUM-711 · 🔴 CASO CONOCIDO: el guard táctil del 3-sep, escrito y sin que nadie lo ejecute, SE VE', () => {
  const r = censar({
    ficherosScripts: FICHEROS_CON_TACTIL,
    scripts: PKG_CON_TACTIL,
    workflows: ['jobs:\n  test:\n    steps:\n      - run: npm test\n'],
  });
  assert.ok(r.sinSitio.includes('scripts/guard-objetivo-tactil.mjs'),
    '🔴 el censo NO ve el guard que originó este ticket, en la situación exacta en que estaba. Si '
    + 'no ve éste, su cero sobre el árbol real no significa nada.\n     sinSitio: ' + JSON.stringify(r.sinSitio));
  // La negación de abajo sólo dice algo si la librería SE LE OFRECIÓ al censo: sin este hermano,
  // quitarla de la entrada la dejaría en verde para siempre (SCRUM-237).
  assert.ok(FICHEROS_CON_TACTIL.includes('scripts/_utilidad.mjs'),
    '🔴 CIEGO: el caso ya no le ofrece al censo la librería `scripts/_utilidad.mjs`, así que la '
    + 'comprobación de abajo no está mirando nada.');
  assert.ok(!r.poblacion.includes('scripts/_utilidad.mjs'),
    '🔴 una librería `_*.mjs` que no ejecuta nadie ha entrado en la población de guards.');
});

test('SCRUM-711 · ✅ MITAD NEGATIVA: con el job de guards de navegador, el mismo guard YA tiene sitio', () => {
  const r = censar({
    ficherosScripts: FICHEROS_CON_TACTIL,
    scripts: PKG_CON_TACTIL,
    workflows: ['jobs:\n  guards:\n    steps:\n      - name: Guards\n        run: npm run guards:visuales\n'],
  });
  assert.deepEqual(r.sinSitio, [],
    '🔴 el censo no sabe seguir al runner: `guards:visuales` ejecuta el guard táctil y aun así lo '
    + 'da por huérfano. Un censo que dice «sí» a todo pasaría el caso de arriba.');
});

test('SCRUM-711 · 🔴 un COMENTARIO que nombra la invocación NO es una invocación', () => {
  const r = censar({
    ficherosScripts: FICHEROS_CON_TACTIL,
    scripts: PKG_CON_TACTIL,
    workflows: [
      'jobs:\n  guards:\n    steps:\n'
      + '      # aquí debería ir: run: npm run guards:visuales\n'
      + '      - run: |\n          # npm run guards:visuales   (desactivado)\n          echo hola\n',
    ],
  });
  assert.ok(r.sinSitio.includes('scripts/guard-objetivo-tactil.mjs'),
    '🔴 un comentario ha contado como invocación. En `ci.yml` hay decenas de líneas que explican '
    + '`npm run guards:visuales`: con este fallo, el censo daría por cubierto lo que sólo se menciona.');
});

test('SCRUM-711 · un guard SIN clave en package.json se ve; declarado, no; y la declaración sobrante se caza', () => {
  const base = { scripts: { test: 'node --test tests/*.test.mjs' }, workflows: ['- run: npm test\n'] };
  const suelto = 'scripts/guard-suelto.mjs';

  assert.deepEqual(censar({ ...base, ficherosScripts: [suelto] }).sinSitio, [suelto],
    '🔴 un `guard-*.mjs` sin clave ni invocación no sale: es la forma exacta de `guard-conformidad-landing`.');

  const declarado = censar({ ...base, ficherosScripts: [suelto], declarados: { [suelto]: {} } });
  assert.deepEqual(declarado.sinSitio, [], '🔴 una declaración no ha retirado su guard del censo.');

  const sobrante = censar({
    ...base,
    scripts: { ...base.scripts, 'guard:suelto': 'node scripts/guard-suelto.mjs' },
    workflows: ['- run: npm run guard:suelto\n'],
    ficherosScripts: [suelto],
    declarados: { [suelto]: {} },
  });
  assert.deepEqual(sobrante.declaracionesSobrantes, [suelto],
    '🔴 una declaración para un guard que YA se invoca no sale como sobrante. Se quedaría para '
    + 'siempre, y el día que se desenganche el guard seguiría tapado por ella.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ② EL ÁRBOL DE VERDAD
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-711 · 🔴 SUELO: el censo lee el árbol de verdad, y lee lo que tiene que leer', () => {
  const arbol = leerArbol();
  const r = censar({ ...arbol, declarados: DECLARADOS });

  // La población contiene TODO lo que ejecuta una clave `guard:*` — derivado, no un número a mano.
  const deClaves = Object.keys(arbol.scripts).filter((k) => k.startsWith('guard:'))
    .flatMap((k) => ficherosDeComando(arbol.scripts[k]));
  assert.ok(deClaves.length > 0, '🔴 CIEGO: no encuentro ninguna clave `guard:*` en package.json.');
  const faltan = deClaves.filter((f) => !r.poblacion.includes(f));
  assert.deepEqual(faltan, [], '🔴 la población no contiene ficheros que package.json declara como guard.');

  // Y los dos caminos de invocación funcionan sobre el árbol real: el runner de CI y el pretest.
  assert.ok(r.invocados.includes('scripts/guard-objetivo-tactil.mjs'),
    '🔴 CIEGO: no veo que CI ejecute `guard-objetivo-tactil` a través de `guards:visuales`, y el '
    + 'fundador lo comprobó verde en main (runs 34954547206 y 34958150014).');
  assert.ok(r.invocados.includes('scripts/_prisma-client-guard.mjs'),
    '🔴 CIEGO: no veo que `npm test` ejecute el `pretest`, que es donde corren los guards de Prisma.');
});

test('SCRUM-711 · 🔒 NINGÚN guard deja de correr en algún sitio', () => {
  const r = censar({ ...leerArbol(), declarados: DECLARADOS });
  assert.deepEqual(r.sinSitio, [],
    '🔴 hay guards que no corren NI en `npm test` NI en ningún workflow:\n     '
    + r.sinSitio.join('\n     ')
    + '\n     Un guard escrito y sin invocar se lee como cobertura y protege lo mismo que uno que no '
    + 'existe (SCRUM-711). Engánchalo: una clave `guard:*` con su `//comentario` que diga '
    + '«navegador» lo mete en el job de CI; si corre por otro camino, decláralo en DECLARADOS con '
    + 'una prueba comprobable.');
  assert.deepEqual(r.declaracionesSobrantes, [],
    '🔴 sobra una declaración: ese guard ya se invoca, o ya no existe. Se BORRA, no se deja.\n     '
    + r.declaracionesSobrantes.join('\n     '));
});

test('SCRUM-711 · 🔴 el cero se juzga con la MISMA función: sin declaraciones, salen exactamente las declaradas', () => {
  // Sembrar y juzgar con la misma función: si el censo quedara ciego para el árbol real, este
  // conjunto saldría vacío y no igual a las declaraciones.
  const r = censar({ ...leerArbol(), declarados: {} });
  assert.deepEqual(r.sinSitio, Object.keys(DECLARADOS).sort(),
    '🔴 sobre el árbol real y sin declaraciones, el censo debería ver exactamente los guards que '
    + 'corren por otro camino. Ve: ' + JSON.stringify(r.sinSitio));
});

test('SCRUM-711 · las pruebas de las declaraciones siguen siendo ciertas', () => {
  const pc = DECLARADOS['scripts/guard-conformidad-landing.mjs'].prueba;
  const codigo = soloCodigo(fs.readFileSync(path.join(RAIZ, pc.fichero), 'utf8'));
  assert.ok(codigo.includes(pc.llamada),
    `🔴 \`${pc.fichero}\` ya no ejecuta \`${pc.llamada}\` (fuera de comentarios). Sin esa llamada, `
    + '`guard-conformidad-landing` deja de correr en ningún sitio y su declaración lo estaría tapando.');

  const scripts = leerArbol().scripts;
  const patrones = patronesDeLaTanda(scripts.test);
  assert.ok(patrones.length > 0, '🔴 CIEGO: no saco ningún patrón del script `test`.');
  const entrada = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts', 'guards-entrada.mjs'), 'utf8'));
  const suyos = [...entrada.matchAll(/tests\/[\w.-]+\.test\.mjs/g)].map((m) => m[0]);
  assert.ok(suyos.length > 0, '🔴 CIEGO: no encuentro qué ejecuta `guards-entrada.mjs`.');
  const fuera = suyos.filter((f) => !fs.existsSync(path.join(RAIZ, f)) || !patrones.some((p) => p.test(f)));
  assert.deepEqual(fuera, [],
    '🔴 `guards-entrada.mjs` ejecuta algo que la tanda NO corre, así que ya no vale su declaración: '
    + fuera.join(', '));
});

test('SCRUM-1109 · la prueba de guard-acreditacion-invoicing-es.mjs en DECLARADOS sigue siendo cierta', () => {
  const pc = DECLARADOS['scripts/guard-acreditacion-invoicing-es.mjs'].prueba;

  // Directa: el test de SCRUM-1097 llama a las dos funciones exportadas por su nombre.
  const codigoDirecto = soloCodigo(fs.readFileSync(path.join(RAIZ, pc.directas.fichero), 'utf8'));
  for (const llamada of pc.directas.llamadas) {
    assert.match(codigoDirecto, new RegExp(`\\b${llamada}\\(`),
      `🔴 ${pc.directas.fichero} ya no llama a ${llamada}(…) fuera de comentarios.`);
  }

  // Indirecta: el envoltorio de SCRUM-1109 llama a las dos funciones dentro de su propio código…
  const codigoEnvoltorio = soloCodigo(fs.readFileSync(path.join(RAIZ, pc.indirectas.envoltorio), 'utf8'));
  for (const llamada of pc.indirectas.llamadas) {
    assert.match(codigoEnvoltorio, new RegExp(`\\b${llamada}\\(`),
      `🔴 ${pc.indirectas.envoltorio} ya no llama a ${llamada}(…) fuera de comentarios — deja de `
      + 'ejercitar el guard importado.');
  }
  // …y el test de SCRUM-1109 SÍ ejercita ese envoltorio de verdad (no solo lo importa).
  const codigoTestEnvoltorio = soloCodigo(fs.readFileSync(path.join(RAIZ, pc.indirectas.testDelEnvoltorio), 'utf8'));
  assert.match(codigoTestEnvoltorio, new RegExp(`\\b${pc.indirectas.llamadaDelTest}\\(`),
    `🔴 ${pc.indirectas.testDelEnvoltorio} ya no llama a ${pc.indirectas.llamadaDelTest}(…) fuera de `
    + 'comentarios. Sin esa llamada, la cadena hasta el guard importado deja de ejercitarse en la tanda '
    + 'y la declaración de scripts/guard-acreditacion-invoicing-es.mjs en DECLARADOS estaría tapando '
    + 'un guard que no corre en ningún sitio.');
});

test('SCRUM-711 · 📌 el límite de «primer nivel» sigue sin esconder nada', () => {
  const hondos = [];
  const recorrer = (rel) => {
    for (const e of fs.readdirSync(path.join(RAIZ, rel), { withFileTypes: true })) {
      if (e.isDirectory()) recorrer(rel + '/' + e.name);
      else if (rel !== 'scripts' && /guard/i.test(e.name)) hondos.push(rel + '/' + e.name);
    }
  };
  recorrer('scripts');
  assert.deepEqual(hondos, [],
    '🔴 hay un fichero con «guard» en una SUBCARPETA de scripts/, y el censo sólo lee el primer '
    + 'nivel. Ese límite estaba declarado por estar vacío; ya no lo está: amplía la lectura.');
});
