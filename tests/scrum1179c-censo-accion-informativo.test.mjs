// tests/scrum1179c-censo-accion-informativo.test.mjs — SCRUM-1179 (parte C, 3/7)
//
// `censo:accion-del-80` hace el inventario de lo pulsable en la primera fila de las cinco listas.
// No corría en ningún sitio; desde aquí corre en cada PR, en el job INFORMATIVO de navegador, y no
// bloquea. Al pasarlo se le quitaron tres cegueras:
//   · el rótulo del árbol medido estaba escrito a mano («esta rama (816 + 823 dentro)», 8-sep) y era
//     falso desde que esas ramas entraron en main: ahora se LEE;
//   · un «⋯» que no abre menú salía como «dentro del ⋯: 0»: ahora es «no supe abrirlo» (salida 2);
//   · una vista que dio error al pintarse se inventariaba igual: ahora se declara ciega.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');
const CENSO = 'scripts/censo-accion-del-80.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El censo pasa a poder tumbar el job sin que nadie lo haya decidido.
    fichero: '.github/workflows/ci.yml',
    de: "      - name: censo:accion-del-80 (informativo — NO bloquea)\n        if: always() && steps.alcance.outputs.solo_docs != 'true'\n        continue-on-error: true\n",
    a: "      - name: censo:accion-del-80 (informativo — NO bloquea)\n        if: always() && steps.alcance.outputs.solo_docs != 'true'\n",
    cae: 'SCRUM-1179-C · accion-del-80 corre en el job INFORMATIVO, siempre, y NO bloquea',
  },
  {
    // Vuelve la ceguera: un «⋯» que no abre menú se contaría como «0 dentro».
    fichero: 'scripts/censo-accion-del-80.mjs',
    de: '  if (ov.error || (ov.hay && !ov.menuVisto)) {',
    a: '  if (false) {',
    cae: 'SCRUM-1179-C · accion-del-80 no convierte en cero lo que no pudo ver',
  },
  {
    // Vuelve el rótulo escrito a mano.
    fichero: 'scripts/censo-accion-del-80.mjs',
    de: 'árbol: ${arbolMedido()}',
    a: 'árbol: esta rama (816 + 823 dentro)',
    cae: 'SCRUM-1179-C · accion-del-80 LEE el árbol que mide, no lo escribe a mano',
  },
];

/** El bloque de un job de `ci.yml`, de su clave a la siguiente clave de job. */
function job(nombre) {
  const lineas = CI.split('\n');
  const i = lineas.findIndex((l) => l === `  ${nombre}:`);
  if (i < 0) return null;
  let j = i + 1;
  while (j < lineas.length && !/^ {2}[a-z][\w-]*:\s*$/.test(lineas[j])) j++;
  return lineas.slice(i, j).join('\n');
}

/**
 * El código sin comentarios (de línea y las líneas de un bloque JSDoc): el comentario que explica la
 * regla —y que cita el rótulo viejo— no puede sostenerla ni tumbarla.
 */
const sinComentarios = (s) => s.split('\n').filter((l) => !/^\s*(\/\/|\/\*\*|\*)/.test(l)).join('\n');
const codigo = () => sinComentarios(fs.readFileSync(path.join(RAIZ, CENSO), 'utf8'));

test('SCRUM-1179-C · accion-del-80 corre en el job INFORMATIVO, siempre, y NO bloquea', () => {
  const bloque = job('guards-visuales');
  assert.ok(bloque, 'no encuentro el job guards-visuales en ci.yml');
  const paso = bloque.split(/\n(?= {6}- )/).find((p) => /npm run -s censo:accion-del-80/.test(p));
  assert.ok(paso, 'el paso del censo no está en el job de guards de navegador');
  assert.match(paso, /\n {8}if: always\(\)/, 'tiene que correr también con los guards en rojo');
  assert.match(paso, /\n {8}continue-on-error: true/, 'NO bloquea');
  assert.match(paso, /GITHUB_STEP_SUMMARY/, 'el inventario se deja donde se lee');
  assert.match(paso, /NO SUPO MEDIR/, 'un censo ciego lo dice');
  assert.ok(!/name: build \+ tests/.test(bloque), 'el job obligatorio es otro');
});

test('SCRUM-1179-C · accion-del-80 LEE el árbol que mide, no lo escribe a mano', () => {
  const c = codigo();
  assert.ok(!c.includes('816 + 823 dentro'), 'el rótulo escrito a mano del 8-sep sigue ahí');
  assert.match(c, /árbol: \$\{arbolMedido\(\)\}/, 'el rótulo sale de leer el árbol');
  assert.match(c, /process\.env\.GITHUB_SHA/, 'en CI, el SHA del run');
  assert.match(c, /NO SUPE LEERLO/, 'y si no puede leerlo, lo dice');
});

test('SCRUM-1179-C · accion-del-80 no convierte en cero lo que no pudo ver', () => {
  const c = codigo();
  assert.match(c, /menuVisto: !!menu,/, 'el «⋯» dice si su menú se VIO');
  const i = c.indexOf('if (ov.error || (ov.hay && !ov.menuVisto)) {');
  assert.ok(i > 0, 'un «⋯» sin menú no se cuenta como «0 dentro»');
  assert.match(c.slice(i, i + 300), /ciego \+= 1;/, 'y cuenta como no medido');
  const j = c.indexOf('if (errores.length) {');
  assert.ok(j > 0, 'una vista con error al pintarse no se inventaría');
  assert.match(c.slice(j, j + 300), /ciego \+= 1;/);
  assert.match(c, /process\.exit\(2\);/, 'lo no medido sale con 2');
});
