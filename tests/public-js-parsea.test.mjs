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
// **SUELO:** si encuentra menos de `SUELO_FICHEROS`, FALLA. «Todos parsean» y «no supe encontrar
// los ficheros» dan el mismo verde, y este guard existe precisamente porque un verde hueco duró
// cuatro commits.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DIR = path.join(RAIZ, 'public');

/** Hoy son 50. El suelo va por debajo para que un borrado legítimo no lo dispare, pero no tanto
 *  como para que un recorrido roto —que devolvería 0 o 3— se cuele. */
const SUELO_FICHEROS = 40;

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
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-parsea-')), 'x.mjs');
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

test('public/ · SUELO: el guard encuentra los ficheros que dice comprobar', () => {
  assert.ok(fs.existsSync(DIR), '🔴 no existe public/: el guard no puede mirar, y FALLA.');
  const n = ficherosJs(DIR).length;
  assert.ok(n >= SUELO_FICHEROS,
    `🔴 el recorrido solo ha encontrado ${n} ficheros .js en public/ (suelo ${SUELO_FICHEROS}).\n\n` +
    '  «Todos parsean» y «no supe encontrar los ficheros» son el mismo verde. Si el front se ha\n' +
    '  reorganizado, arregla el recorrido ANTES de creerte nada de lo de abajo.');
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
