// tests/scrum1179c-censo-tactil-informativo.test.mjs — SCRUM-1179 (parte C)
//
// `censo:tactil-panel` cuenta los objetivos de toque cortos de las vistas del panel que el guard NO
// vigila (entre ellas botones de COBRO a ~30 px). No corría en ningún sitio (SCRUM-1172) y se citaba
// como red. Decisión (SCRUM-1179, com. 17340): a un job INFORMATIVO, el primero de los siete de C.
//
// Lo que se fija aquí es el CONTRATO, las dos mitades:
//   · que corre: un paso del job de guards de navegador, `if: always()` (también con los guards en
//     rojo), que deja su número en el resumen;
//   · que NO bloquea: `continue-on-error`, en un job que no es el obligatorio. Si un día se quiere
//     que bloquee, se decide, no se desliza.
// Y que las citas del guard dejan de decir «no corre», que desde este cambio es falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El censo pasa a poder tumbar el job sin que nadie lo haya decidido.
    fichero: '.github/workflows/ci.yml',
    de: "      - name: censo:tactil-panel (informativo — NO bloquea)\n        if: always()\n        continue-on-error: true\n",
    a: "      - name: censo:tactil-panel (informativo — NO bloquea)\n        if: always()\n",
    cae: 'SCRUM-1179-C · el censo de toque corre en el job INFORMATIVO, siempre, y NO bloquea',
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

test('SCRUM-1179-C · el censo de toque corre en el job INFORMATIVO, siempre, y NO bloquea', () => {
  const bloque = job('guards-visuales');
  assert.ok(bloque, 'no encuentro el job guards-visuales en ci.yml');
  assert.match(bloque, /name: guards de navegador \(fuera de la tanda\)/);
  const paso = bloque.split(/\n(?= {6}- )/).find((p) => /npm run -s censo:tactil-panel/.test(p));
  assert.ok(paso, 'el paso del censo no está en el job de guards de navegador');
  assert.match(paso, /\n {8}if: always\(\)/, 'tiene que correr también con los guards en rojo');
  assert.match(paso, /\n {8}continue-on-error: true/, 'NO bloquea: su «no supe medir» no tumba el job');
  assert.match(paso, /GITHUB_STEP_SUMMARY/, 'el número se deja donde se lee');
  assert.match(paso, /NO SUPO MEDIR/, 'un censo ciego lo dice, no deja un cero');
  // El job obligatorio es otro: éste no puede frenar un PR.
  assert.ok(!/name: build \+ tests/.test(bloque));
});

test('SCRUM-1179-C · las citas del guard ya no dicen que el censo «no corre»', () => {
  const guard = fs.readFileSync(path.join(RAIZ, 'scripts', 'guard-objetivo-tactil.mjs'), 'utf8');
  for (const falso of ['sin correr solo', 'no corre solo', 'no lanza ningún workflow ni ningún test']) {
    assert.ok(!guard.includes(falso), `el guard sigue diciendo «${falso}», y desde SCRUM-1179-C corre en cada PR`);
  }
  assert.ok(guard.includes('SCRUM-1179-C'), 'y dice dónde corre');
  assert.ok(/NO bloquea|sin frenar ningún PR/.test(guard), 'y que NO bloquea');
});
