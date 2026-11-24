// tests/scrum1831-regla4-banderas-por-significado.test.mjs — SCRUM-1831
//
// La regla 4 de `.claude/hooks/guard-dangerous.mjs` («rm -rf fuera del workspace») casaba una
// FORMA DE TECLEAR, no una acción: `rm +-[…]*r[…]*f[…]* +ruta-absoluta`. Exigía la r ANTES que la
// f y las dos en el MISMO grupo de letras. Medido con sonda por jv-j6fq (SCRUM-1792 c.22619) y
// repetido aquí en rojo antes de tocar el hook: `rm -fr "/c/…"`, `rm -r -f "/c/…"`,
// `rm -f -r "/c/…"`, `rm --recursive --force "/c/…"` y `rm -R -f "/c/…"` PASABAN.
//
// El arreglo reconoce las banderas por su SIGNIFICADO (recursivo + forzado, en cualquier orden,
// juntas o separadas, cortas o largas) y SUMA esa comprobación a la regex de siempre, que se queda
// tal cual: nada de lo que paraba ayer deja de parar (regla 41).
//
// La regla 4 es texto puro: no pregunta al disco ni depende de `process.platform`, así que todo
// este fichero es determinista en cualquier host (el CI de Linux incluido) y ningún caso se salta.
// No se ejecuta NINGÚN `rm`: todo pasa por `evaluar()`, la función del hook.

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluar } from '../.claude/hooks/guard-dangerous.mjs';

// Volver a la regla de hoy (solo la regex) tiene que tumbar el caso principal.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: '.claude/hooks/guard-dangerous.mjs',
    de: 'if (enAlguna(RM_RF_LITERAL) || lista.some(rmRecursivoForzadoFuera)) {',
    a: 'if (enAlguna(RM_RF_LITERAL)) {',
    cae: 'SCRUM-1831 · 🔴 EL CASO: `rm -fr`, `rm -r -f`, `rm -f -r`, `rm --recursive --force` y `rm -R -f` con ruta absoluta MSYS PARAN',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL_FALSO = path.join(os.tmpdir(), 'yaqu-1831-sentinel-que-no-existe');
const DESTRUCTIVO_FALSO = path.join(os.tmpdir(), 'yaqu-1831-allow-destructivo-que-no-existe');
const llamada = (c) => JSON.stringify({ tool_name: 'Bash', tool_input: { command: c, description: 'prueba' } });
const evaluarAqui = (comando) =>
  evaluar(llamada(comando), SENTINEL_FALSO, { cwd: RAIZ, sentinelDestructivo: DESTRUCTIVO_FALSO });


const MSYS = '"/c/Users/yaqu-1831/no-existe"';
const DRIVE = '"C:\\Users\\yaqu-1831\\no-existe"';
const BANDERAS = ['-fr', '-r -f', '-f -r', '--recursive --force', '-R -f'];

// «El guard PARA», por la regla que sea. Ojo, medido en rojo: las formas LARGAS con `--force` ya
// las paraba la regla 3 (`forcePeligrosa`, que va antes); el hueco eran las formas CORTAS.
const para = (comando) => evaluarAqui(comando).bloqueado === true;

test('SCRUM-1831 · 🔴 EL CASO: `rm -fr`, `rm -r -f`, `rm -f -r`, `rm --recursive --force` y `rm -R -f` con ruta absoluta MSYS PARAN', () => {
  const pasan = BANDERAS.map((b) => `rm ${b} ${MSYS}`).filter((c) => !para(c));
  assert.deepEqual(pasan, [], `la regla 4 deja pasar: ${pasan.join(' · ')}`);
});

test('SCRUM-1831 · 🔴 las mismas cinco con la ruta `C:\\…` PARAN', () => {
  const pasan = BANDERAS.map((b) => `rm ${b} ${DRIVE}`).filter((c) => !para(c));
  assert.deepEqual(pasan, [], `la regla 4 deja pasar: ${pasan.join(' · ')}`);
});

test('SCRUM-1831 · 🔴 la bandera DETRÁS de la ruta y el orden `--force --recursive` también PARAN', () => {
  const casos = [`rm ${MSYS} -r -f`, `rm --force --recursive ${MSYS}`, `rm -f --recursive ${DRIVE}`, 'rm -Rf ~/x'];
  const pasan = casos.filter((c) => !para(c));
  assert.deepEqual(pasan, [], `la regla 4 deja pasar: ${pasan.join(' · ')}`);
});

test('SCRUM-1831 · control: `rm -rf` con ruta absoluta (MSYS, `C:\\…`, `/` y `~`) sigue parando', () => {
  const casos = [`rm -rf ${MSYS}`, `rm -rf ${DRIVE}`, 'rm -rf /tmp/x', 'rm -rf ~/x', 'rm -Rf /tmp/x'];
  const pasan = casos.filter((c) => !para(c));
  assert.deepEqual(pasan, [], `deja de parar: ${pasan.join(' · ')}`);
});

// Medido ANTES del arreglo, con este mismo fichero, sobre el hook de origin/main fc51ec7a2 (registro
// en docs/master/SCRUM-1831.md): `true` = el guard paraba HOY. Tienen que seguir IGUAL. Los `true`
// son de la regla 3 (`--force` en forma larga), no de la 4.
const COMO_HOY = [
  ['rm -f fichero-que-no-existe-1831', false],
  [`rm -f ${MSYS}`, false],
  [`rm --force ${DRIVE}`, true],
  [`rm -r ${DRIVE}`, false],
  [`rm --recursive ${MSYS}`, false],
  ['rm -rf tmp-scrum1831-no-existe/sub', false],
  ['rm -fr tmp-scrum1831-no-existe/sub', false],
  ['rm -r -f tmp-scrum1831-no-existe/sub', false],
  ['rm -f -r tmp-scrum1831-no-existe/sub', false],
  ['rm -R -f tmp-scrum1831-no-existe/sub', false],
  ['rm --recursive --force tmp-scrum1831-no-existe/sub', true],
  [`git commit -m "no hagas rm -fr /c/x"`, false],
  ['echo "rm -r -f /c/x"', false],
];

test('SCRUM-1831 · control: sin recursivo o sin forzado, las rutas RELATIVAS y las menciones entre comillas se comportan como hoy', () => {
  const cambian = COMO_HOY.filter(([c, hoy]) => para(c) !== hoy).map(([c, hoy]) => `${c} (hoy ${hoy ? 'para' : 'pasa'})`);
  assert.deepEqual(cambian, [], `cambian: ${cambian.join(' · ')}`);
});

test('SCRUM-1831 · control de la tabla: tiene pasan y paran, y las relativas cubren las cinco banderas', () => {
  assert.ok(COMO_HOY.some(([, h]) => h) && COMO_HOY.some(([, h]) => !h), 'la tabla tiene que tener los dos valores');
  for (const b of BANDERAS) assert.ok(COMO_HOY.some(([c]) => c === `rm ${b} tmp-scrum1831-no-existe/sub`), `falta la relativa con ${b}`);
});
