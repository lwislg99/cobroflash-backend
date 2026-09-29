// tests/scrum1245b-patron-de-la-tanda-entre-comillas.test.mjs — SCRUM-1245b
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// NINGÚN DOCUMENTO ENSEÑA `node --test … tests/*.test.mjs` CON EL PATRÓN SIN COMILLAS
//
// SCRUM-1245 lo arregló en `CLAUDE.md` y `docs/RUNBOOKS.md`; el arreglo llevaba escrito desde el
// 18-sep en `trampas-del-entorno.md` §7 y nadie lo llevó al fichero que se lee al arrancar. Esto
// es lo que impide que vuelva: sin comillas, bash expande 1.063 ficheros, node no arranca, y el
// bloque salió 0 con un test en rojo dentro (medido el 28-sep-2026).
//
// El censo es de `scripts/_invocaciones-de-la-tanda.mjs` (SCRUM-850), con las líneas continuadas
// ya juntas: el comando roto seguía en la línea de abajo con `\` y el censo línea a línea no lo veía.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patronesDeLaTandaEnDocumentos, patronesSinComillas, lineasLogicas } from '../scripts/_invocaciones-de-la-tanda.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero. */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/_invocaciones-de-la-tanda.mjs',
    de: "    if (c === '*' || c === '?') esPatron = true;",
    a: '    if (false) esPatron = true; // el patron sin comillas, invisible a proposito',
    cae: 'el bloque VIEJO de CLAUDE.md sale como hallazgo',
  },
  {
    fichero: 'scripts/_invocaciones-de-la-tanda.mjs',
    de: "    while (/\\\\\\s*$/.test(texto) && i + 1 < lineas.length) texto = texto.replace(/\\\\\\s*$/, ' ') + lineas[++i];",
    a: '    // sin juntar las lineas continuadas, a proposito',
    cae: 'el bloque VIEJO de CLAUDE.md sale como hallazgo',
  },
];

// El bloque tal como estaba en `origin/main:CLAUDE.md` líneas 127-129 antes de SCRUM-1245.
const VIEJO = [
  '```bash',
  'node --test --test-force-exit --test-reporter=spec --test-reporter-destination=stdout \\',
  '     --test-reporter=tap --test-reporter-destination="${TMPDIR:-/tmp}/yaqu-tanda.tap" tests/*.test.mjs',
  'grep "# SKIP" "${TMPDIR:-/tmp}/yaqu-tanda.tap"',
  '```',
].join('\n');
const NUEVO = VIEJO.replace(' tests/*.test.mjs', " 'tests/*.test.mjs'");

function enUnArbol(ficheros) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1245b-'));
  for (const [rel, texto] of Object.entries(ficheros)) {
    fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
    fs.writeFileSync(path.join(raiz, rel), texto);
  }
  try { return patronesDeLaTandaEnDocumentos(raiz); } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}

test('SCRUM-1245b · 🔴 el bloque VIEJO de CLAUDE.md sale como hallazgo', () => {
  const r = enUnArbol({ 'CLAUDE.md': VIEJO });
  assert.equal(r.poblacion.invocaciones, 1);
  assert.deepEqual(r.hallazgos.map((h) => [h.fichero, h.linea, h.sinComillas]), [['CLAUDE.md', 2, ['tests/*.test.mjs']]]);
});

test('SCRUM-1245b · el bloque NUEVO, entre comillas, se ve y NO es hallazgo (el positivo)', () => {
  const r = enUnArbol({ 'CLAUDE.md': NUEVO });
  assert.equal(r.poblacion.invocaciones, 1);
  assert.match(r.invocaciones[0].comando, /'tests\/\*\.test\.mjs'/);
  assert.deepEqual(r.hallazgos, []);
});

test('SCRUM-1245b · las comillas dobles también valen, y un patrón en un comentario no cuenta', () => {
  const dobles = NUEVO.replace("'tests/*.test.mjs'", '"tests/*.test.mjs"');
  assert.deepEqual(enUnArbol({ 'docs/a.md': dobles }).hallazgos, []);
  const comentado = ['```bash', 'node --test tests/uno.test.mjs  # no: tests/*.test.mjs', '```'].join('\n');
  const r = enUnArbol({ 'docs/a.md': comentado });
  assert.equal(r.poblacion.invocaciones, 1);
  assert.deepEqual(r.hallazgos, []);
  // …y el mismo patrón, fuera del comentario, sí es hallazgo:
  const vivo = ['```bash', 'node --test tests/uno.test.mjs tests/*.test.mjs', '```'].join('\n');
  assert.deepEqual(enUnArbol({ 'docs/a.md': vivo }).hallazgos.map((h) => h.sinComillas), [['tests/*.test.mjs']]);
});

test('SCRUM-1245b · docs/master/ es registro, no instrucción: queda fuera de la población', () => {
  const r = enUnArbol({ 'docs/master/SCRUM-1.md': VIEJO, 'docs/b.md': VIEJO });
  assert.equal(r.poblacion.ficheros, 1);
  assert.deepEqual(r.hallazgos.map((h) => h.fichero), ['docs/b.md']);
});

test('SCRUM-1245b · las piezas: línea continuada y palabra con patrón', () => {
  assert.deepEqual(lineasLogicas(['a \\', 'b', 'c']), [{ linea: 1, texto: 'a  b' }, { linea: 3, texto: 'c' }]);
  // Una `\` con espacios detrás también continúa (así se cuela a veces al copiar un bloque):
  assert.deepEqual(lineasLogicas(['a \\  ', 'b']), [{ linea: 1, texto: 'a  b' }]);
  assert.deepEqual(patronesSinComillas("node --test 'tests/*.test.mjs' tests/x?.test.mjs \"t/*.mjs\""), ['tests/x?.test.mjs']);
});

test('SCRUM-1245b · el árbol real: ningún documento enseña el patrón sin comillas', () => {
  const r = patronesDeLaTandaEnDocumentos(RAIZ);
  // SUELO: medido el 28-sep-2026, 294 ficheros · 347 bloques · 5 invocaciones. Si baja de esto, el
  // censo se ha quedado ciego, no limpio.
  assert.ok(r.poblacion.ficheros >= 250, `sólo he mirado ${r.poblacion.ficheros} documentos`);
  assert.ok(r.poblacion.bloques >= 300, `sólo he visto ${r.poblacion.bloques} bloques de código`);
  assert.ok(r.poblacion.invocaciones >= 5, `sólo he visto ${r.poblacion.invocaciones} invocaciones de node --test`);
  // Primero el hallazgo, para que el rojo diga DÓNDE está el patrón sin comillas.
  assert.deepEqual(
    r.hallazgos.map((h) => `${h.fichero}:${h.linea} ${h.sinComillas.join(' ')}`), [],
    'Un documento enseña `node --test` con un patrón SIN COMILLAS. En bash lo expande el shell y, con la\n' +
    'tanda entera, node no arranca y el bloque puede salir 0. Ponlo entre comillas simples (SCRUM-1245).',
  );
  // Control positivo: las dos copias que arregló SCRUM-1245 se VEN, con su patrón entre comillas.
  const conPatron = r.invocaciones.filter((v) => /['"]tests\/\*\.test\.mjs['"]/.test(v.comando)).map((v) => v.fichero).sort();
  assert.deepEqual(conPatron, ['CLAUDE.md', 'docs/RUNBOOKS.md']);
});
