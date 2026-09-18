// tests/public-js-parsea.test.mjs — el front que se sirve tiene que PARSEAR.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, Y POR QUÉ ES EL BARATO DE EVITAR Y EL CARO DE TENER
//
// Un comentario HTML **con backticks** dentro de un template literal de `innerHTML` **cierra el
// template**. Lo que sigue se parsea como código y el fichero entero deja de existir para el
// navegador: la pantalla no se renderiza, no a medias — nada.
//
// `public/dashboard/js/exportView.js` estuvo así en `main` desde `1527f67` (SCRUM-384), y
// **pasaron por encima cuatro commits y una PR** sin que nadie lo notara: SCRUM-384 → SCRUM-280/325
// → SCRUM-325 → SCRUM-405. Ninguno tenía por qué notarlo: `npm test` no miraba `public/`.
//
// Es la TERCERA vez que muerde el mismo mecanismo (`plansView.js` en SCRUM-345, `exportView.js`
// aquí, y un template literal de otra sesión la misma mañana). Tres veces es un patrón, y el guard
// cuesta un script.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// CÓMO MIRA
//
// **Derivado, no enumerado:** recorre `public/` y comprueba TODOS los `.js` que encuentre. No hay
// lista que mantener, así que un fichero nuevo entra solo.
//
// **SUELO:** si su recorrido y git no coinciden en qué `.js` hay en `public/`, FALLA. «Todos
// parsean» y «no supe encontrar los ficheros» dan el mismo verde, y este guard existe precisamente
// porque un verde hueco duró cuatro commits.
//
// SCRUM-949 · Hasta el 18-sep-2026 el suelo era `SUELO_FICHEROS = 40`, un número escrito a mano con
// la población de su día. Con 96 ficheros, el recorrido podía perder 56 sin que saltara. Ahora es
// un COCIENTE entre dos sondas de la misma población (`scripts/_suelo-por-cociente.mjs`), y el
// umbral sale de la población de cada ejecución: crecer lo mueve solo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import {
  censoDeGit, medirCociente, explicarCociente, poblacionDeclarada,
} from '../scripts/_suelo-por-cociente.mjs'; // SCRUM-949 · el suelo como cociente

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, 'public');

/**
 * El cociente mínimo entre lo que RECORRE este guard y lo que GIT sabe que hay en el disco.
 *
 * Es 1 y no «un poco menos, por si acaso», y no es una intuición: la segunda sonda cuenta los
 * ficheros sin `git add` y descuenta los borrados sin `git rm`, así que un cambio honesto no separa
 * las dos sondas —probado uno a uno en `tests/scrum949-el-suelo-como-cociente.test.mjs`—. Lo único
 * que las separa es que una esté ciega.
 *
 * 🔴 Por qué no un porcentaje fijo por debajo de 1 (medido en SCRUM-949): la ceguera plausible de
 * este recorrido es de tamaño FIJO —mirar sólo `public/dashboard/js` pierde `sw.js` y `public/js/`,
 * 3 ficheros— mientras la población crece dentro de `dashboard/js`. Un 97 % la ve hoy y deja de
 * verla a partir de 100 ficheros; el 81,8 % que da el historial ya no la ve hoy.
 */
const COCIENTE_MINIMO = 1;

/**
 * La población, declarada POR SEPARADO del recorrido: el literal `'public'` y el filtro de aquí
 * abajo NO se derivan de `DIR` ni de `ficherosJs`, y es a propósito. Si alguien estrecha el
 * recorrido, el censo sigue mirando `public/` entero y la diferencia es justo lo que salta.
 */
const censoDePublic = () => censoDeGit(RAIZ, 'public', (p) => p.endsWith('.js'));

function ficherosJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficherosJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/**
 * ¿Parsea? Devuelve `null` si sí, y `{ linea, texto }` si no.
 *
 * `node --check` parsea como script clásico, que es EXACTAMENTE como se sirven estos ficheros
 * (`<script src>` sin `type="module"`). Un fichero que sí use `import`/`export` se vuelve a
 * comprobar como módulo, para no acusarlo por usar una sintaxis legítima.
 */
function noParsea(fichero) {
  const r = spawnSync(process.execPath, ['--check', fichero], { encoding: 'utf8' });
  if (r.status === 0) return null;

  const src = fs.readFileSync(fichero, 'utf8');
  if (/^\s*(import|export)[\s{*]/m.test(src)) {
    const tmp = path.join(temporal('yaqu-parsea-'), 'x.mjs');
    fs.writeFileSync(tmp, src);
    const rm = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    if (rm.status === 0) return null;
  }

  // El mensaje tiene que NOMBRAR el fichero y la línea: un «error de sintaxis» a secas obliga a
  // buscarlo a mano, y eso fue justo lo que costó localizar este.
  const err = r.stderr || '';
  // `\r?\n` y no `\n`: en Windows el `stderr` viene con CRLF y la primera versión de esta regex
  // devolvía la línea como «?». Un guard que no sabe decir DÓNDE deja el trabajo a medias.
  const m = /:(\d+)\r?\n([\s\S]*?)\r?\n\s*\^/.exec(err);
  const linea = m ? Number(m[1]) : null;
  const causa = /(SyntaxError: .*)/.exec(err);
  return {
    linea,
    texto: (m ? m[2].trim() : '').slice(0, 120),
    causa: causa ? causa[1] : 'no parsea',
  };
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('public/ · SUELO: el guard encuentra los ficheros que dice comprobar', (t) => {
  assert.ok(fs.existsSync(DIR), '🔴 no existe public/: el guard no puede mirar, y FALLA.');
  // El colector del suelo es EL MISMO que usa el guard de abajo, no una copia: una copia del
  // recorrido no se entera de que el recorrido de verdad se ha roto (el defecto del registro de
  // SCRUM-810b, que lleva su propio `rec` para esta misma población).
  const vistos = ficherosJs(DIR).map((f) => path.relative(RAIZ, f).split(path.sep).join('/'));
  const censados = censoDePublic();
  assert.ok(censados,
    '🔴 CIEGO: no he podido preguntarle a git qué `.js` hay en public/. Sin la segunda sonda no hay\n' +
    '  suelo, y un suelo que no se puede calcular NO es un verde: es no haber mirado.');
  const m = medirCociente(vistos, censados);
  t.diagnostic(poblacionDeclarada('los .js de public/', m, COCIENTE_MINIMO));
  assert.ok(m.cociente >= COCIENTE_MINIMO, explicarCociente('los .js de public/', m, COCIENTE_MINIMO));
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────────

test('public/ · 🔴 todo .js que se sirve al navegador PARSEA', () => {
  const rotos = [];
  for (const f of ficherosJs(DIR)) {
    const mal = noParsea(f);
    if (mal) {
      const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
      rotos.push(`${rel}:${mal.linea ?? '?'} — ${mal.causa}\n      ${mal.texto}`);
    }
  }

  assert.deepEqual(rotos, [],
    `🔴 HAY FICHEROS DEL FRONT QUE NO PARSEAN:\n    ${rotos.join('\n    ')}\n\n` +
    '  Un fichero que no parsea no falla a medias: el navegador lo descarta ENTERO y la pantalla\n' +
    '  no se renderiza. Y no se nota en ninguna otra prueba, porque el resto de la suite corre\n' +
    '  contra `dist/`, no contra `public/`.\n\n' +
    '  La causa habitual, y la que hizo falta este guard: un **backtick dentro de un template\n' +
    '  literal**. Un comentario HTML del tipo <!-- sin `style="..."` --> escrito dentro de un\n' +
    '  `innerHTML = `…`` CIERRA el template en ese backtick. Usa «comillas angulares» en los\n' +
    '  comentarios de dentro del template, no backticks.');
});
