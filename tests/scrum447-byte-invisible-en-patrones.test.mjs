// SCRUM-447 · NINGÚN FICHERO DE `tests/` NI `scripts/` LLEVA UN 0x08 DENTRO.
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, QUE NO ES UN TYPO
//
// `\b` escrito en una cadena de shell —o en un literal de JS, donde "\b" ES el backspace— no
// llega al fichero como el metacarácter «límite de palabra»: llega como el BYTE 0x08. El patrón
// resultante **no puede casar con nada**, y un patrón que no casa nunca devuelve cero…
// **que se lee exactamente igual que «no hay nada».**
//
// No es que el guard se rompa: es que **contesta correctamente a la pregunta equivocada**. Pasó en
// el guard de SCRUM-428, que habría pasado SIEMPRE, y lo delató inyectarle el rojo — no leerlo.
//
// ⚠️ ESTE GUARD BUSCA EL BYTE, NO EL TEXTO. Buscar la cadena `\b` sería cometer el mismo error
// dentro de la búsqueda del error: el texto escapado es CORRECTO y no debe caer. Lo separa del
// buscador de texto el control negativo de abajo.
//
// Nace VERDE y con sentido: 526 ficheros leídos, 0 afectados (10-ago-2026). Un guard que nace
// rojo no protege — entrena a ignorarlo.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['tests', 'scripts'];

/** El 0x08, construido por código: escribirlo como literal lo reintroduce. */
const BACKSPACE = String.fromCharCode(8);

/** Recorre `tests/` y `scripts/` y devuelve {leidos, hallazgos:[fichero:linea]}. */
function censo() {
  const hallazgos = [];
  let leidos = 0;
  for (const d of DIRS) {
    const abs = path.join(RAIZ, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      const p = path.join(abs, f);
      if (!fs.statSync(p).isFile()) continue;
      leidos++;
      const lineas = fs.readFileSync(p, 'utf8').split(/\r?\n/);
      lineas.forEach((l, i) => {
        if (l.includes(BACKSPACE)) hallazgos.push(`${d}/${f}:${i + 1}`);
      });
    }
  }
  return { leidos, hallazgos };
}

test('SCRUM-447 · SUELO: el censo LEE ficheros de verdad', () => {
  // El ticket entero: un censo que devuelve cero y no se declara ciego confirma cualquier cosa.
  // «No hay bytes invisibles» y «no abrí ningún fichero» dan el mismo verde sin esto.
  const { leidos } = censo();
  assert.ok(leidos > 100,
    `🔴 CIEGO: solo se han leído ${leidos} ficheros de ${DIRS.join(' y ')} (se esperan cientos). `
    + 'El cero de abajo no significaría «no hay»: significaría «no miré».');
});

test('SCRUM-447 · 🔴 ningún fichero lleva el byte 0x08 dentro', () => {
  const { hallazgos } = censo();
  assert.deepEqual(hallazgos, [],
    '🔴 HAY UN BYTE 0x08 (backspace) EN EL ÁRBOL, y es invisible al leer el fichero.\n\n'
    + '  Casi siempre viene de escribir `\\b` en una cadena de shell o en un literal JS —donde\n'
    + '  "\\b" ES el backspace—. Si está dentro de un patrón, ese patrón NO CASA NUNCA y su guard\n'
    + '  pasa SIEMPRE: contesta bien a la pregunta equivocada.\n\n'
    + '  QUÉ HACER: sustituirlo por los DOS caracteres backslash + b. Constrúyelo por código\n'
    + '  (`String.fromCharCode(92) + "b"`) si lo haces con un script: escribirlo como literal\n'
    + '  vuelve a producir el 0x08 — el defecto metiéndose dentro de su propio arreglo.');
});

test('SCRUM-447 · CONTROL NEGATIVO: el texto `\\b` bien escapado NO cae', () => {
  // Ésta es toda la diferencia entre este guard y el error que persigue. Un buscador del TEXTO
  // `\b` marcaría en rojo cada regex correcta del repo.
  const bienEscapado = String.fromCharCode(92) + 'b';
  const linea = `const re = /^\\d+${bienEscapado}/;`;
  assert.ok(!linea.includes(BACKSPACE),
    '🔴 el control negativo está mal montado: la línea de prueba ya lleva un 0x08');
  // Y el criterio del censo, aplicado a esa línea, la deja pasar.
  assert.equal(linea.includes(BACKSPACE), false,
    '🔴 el guard caería sobre una regex correctamente escapada');
});

test('SCRUM-447 · 🔴 ROJO POR EL MECANISMO: un fichero de mentira con el byte SÍ cae', () => {
  // Se prueba sobre un fichero INVENTADO, nunca sobre uno real: inyectar el fallo en el árbol
  // deja restos si el proceso muere a medias.
  const falso = [
    'const ok = /^abc/;',
    `const malo = /^num${BACKSPACE}/;`,
    'const otro = 1;',
  ];
  const encontrados = [];
  falso.forEach((l, i) => { if (l.includes(BACKSPACE)) encontrados.push(`falso.mjs:${i + 1}`); });
  assert.deepEqual(encontrados, ['falso.mjs:2'],
    '🔴 el detector NO encuentra el byte donde SÍ está: no sirve para lo que dice medir. '
    + 'Si esto falla, el verde del test de arriba no vale nada.');
});
