// tests/scrum1506c-jv-jn-por-su-forma.test.mjs — SCRUM-1506c
//
// Sin gate, sin BD, sin red. La pieza ② de SCRUM-1506 (decisión de S0, SCRUM-1506 c.21966): los nombres
// con los que lanza el equipo de Javier (`jv-j1`…`jv-j6`, y sus relevos `jv-j4g`, `jv-j6ar`, `jv-j2ay`)
// no decían su puesto por su forma: `puestoDeNombre('jv-j6')` → null, y sin mesa la cerradura salía sin
// mirar. Ahora `^jv-j([1-6])(?:[a-z]{1,3}|-[a-z0-9-]+)?$` → `J<N>`.
//
//   ① controles positivos: jv-j1…jv-j6, jv-j4g, jv-j6ar, jv-j2ay → J<N>;
//   ② controles negativos: jv-j9z (el caso de SCRUM-1549), jv-j0, jv-j7, jv-j12 → null — sin ellos ① no
//      distinguiría una regla correcta de una que acepte cualquier `jv-j<dígitos>`;
//   ③ lo que ya había, sin cambio (j6-x → J6, puesto-j3 → J3, sesion-5 → S5; el nombre de la mesa gana);
//   ④ POR EFECTO, la cerradura ejecutada como proceso y SIN mesa: `jv-j1` pasa en un fichero de J1 y se para
//      en uno de S2 (antes pasaba en los dos sin mirar);
//   ⑤ `carriles.mjs mesa J<N> --nombre jv-jN` sigue sin discrepancia, y con el N de otro puesto SÍ la da.
// No toca `.claude/hooks/carril.mjs` ni `.claude/settings.json`: la pieza ③ (fail-closed) es del fundador.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { puestoDeNombre } from '../scripts/_carriles.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La forma jv-jN, fuera: vuelve el null de SCRUM-1506.
    fichero: 'scripts/_carriles.mjs',
    de: '  m = /^jv-j([1-6])(?:[a-z]{1,3}|-[a-z0-9-]+)?$/.exec(n);',
    a: '  m = /^$^/.exec(n);',
    cae: 'SCRUM-1506c ① ·',
  },
  {
    // Demasiado ancha: cualquier dígito y cualquier cola. Es el negativo el que tiene que caer.
    fichero: 'scripts/_carriles.mjs',
    de: '  m = /^jv-j([1-6])(?:[a-z]{1,3}|-[a-z0-9-]+)?$/.exec(n);',
    a: '  m = /^jv-j(\\d)/.exec(n);',
    cae: 'SCRUM-1506c ② ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'carril.mjs');
const CLI = path.join(RAIZ, 'scripts', 'carriles.mjs');
const DE_J1 = path.join(RAIZ, 'public/dashboard/js/invoicesView.js');
const DE_S2 = path.join(RAIZ, 'public/dashboard/js/homeView.js');

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349).
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1506c-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

test('SCRUM-1506c ① · los nombres del equipo de Javier dicen su puesto por su forma', () => {
  for (let n = 1; n <= 6; n++) assert.equal(puestoDeNombre(`jv-j${n}`), `J${n}`, `jv-j${n}`);
  for (const [nombre, puesto] of [['jv-j4g', 'J4'], ['jv-j6ar', 'J6'], ['jv-j2ay', 'J2'], ['jv-j1bb', 'J1'], ['JV-J3CF ', 'J3'], ['jv-j5-prueba-1', 'J5']]) {
    assert.equal(puestoDeNombre(nombre), puesto, nombre);
  }
});

test('SCRUM-1506c ② · y los que NO son un puesto siguen sin serlo', () => {
  for (const nombre of ['jv-j9z', 'jv-j0', 'jv-j7', 'jv-j12', 'jv-j4abcd', 'jv-j', 'jv-orquestador', 'xjv-j1', 'jv-j1_']) {
    assert.equal(puestoDeNombre(nombre), null, nombre);
  }
});

test('SCRUM-1506c ③ · lo que ya resolvía, sin cambio; y el nombre de la mesa gana', () => {
  assert.equal(puestoDeNombre('j6-x'), 'J6');
  assert.equal(puestoDeNombre('puesto-j3'), 'J3');
  assert.equal(puestoDeNombre('sesion-5'), 'S5');
  assert.equal(puestoDeNombre('s1-14oct'), 'S1');
  assert.equal(puestoDeNombre('orquestador'), 'ORQ');
  assert.equal(puestoDeNombre('cobroflash-backend-57'), null);
  // La mesa manda cuando la sesión se llama como ella dice, aunque la forma dijera otro puesto.
  assert.equal(puestoDeNombre('jv-j4g', { puesto: 'J2', nombre: 'jv-j4g' }), 'J2');
  // Un nombre que no es el de la mesa se lee por su forma: ahí la discrepancia sí es señal.
  assert.equal(puestoDeNombre('jv-j9z', { puesto: 'J4', nombre: 'jv-j4g' }), null);
  assert.equal(puestoDeNombre('jv-j3', { puesto: 'J4', nombre: 'jv-j4g' }), 'J3');
});

test('SCRUM-1506c ④ · la cerradura, SIN mesa, ya mira a jv-j1: deja en lo suyo y para en lo ajeno', (t) => {
  const dir = tmp(t);
  const transcript = path.join(dir, 't.jsonl');
  fs.writeFileSync(transcript, JSON.stringify({ type: 'agent-name', agentName: 'jv-j1' }) + '\n');
  const cerradura = (fichero) => {
    const r = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: fichero }, transcript_path: transcript, cwd: dir }),
      env: { ...entorno, CLAUDE_PROJECT_DIR: dir },
      encoding: 'utf8',
    });
    return { codigo: r.status, err: r.stderr };
  };
  assert.equal(cerradura(DE_J1).codigo, 0, 'su propio fichero');
  const ajeno = cerradura(DE_S2);
  assert.equal(ajeno.codigo, 2, `jv-j1 sin mesa en un fichero de S2 tiene que pararse: ${ajeno.err}`);
  assert.match(ajeno.err, /es de S2\b.*tú eres J1/);
});

test('SCRUM-1506c ⑤ · `carriles.mjs mesa J<N> --nombre jv-jN` sigue sin discrepancia', (t) => {
  for (const [puesto, nombre] of [['J1', 'jv-j1'], ['J4', 'jv-j4g'], ['J6', 'jv-j6ar']]) {
    const dir = tmp(t);
    const r = spawnSync(process.execPath, [CLI, 'mesa', puesto, dir, '--nombre', nombre], { cwd: RAIZ, encoding: 'utf8', env: entorno });
    assert.equal(r.status, 0, `${puesto} / ${nombre}: ${r.stdout}${r.stderr}`);
    const escrita = JSON.parse(fs.readFileSync(path.join(dir, '.yaqu-puesto.json'), 'utf8'));
    assert.deepEqual({ puesto: escrita.puesto, nombre: escrita.nombre }, { puesto, nombre });
  }
  // Control: un jv-jN de OTRO puesto en esa mesa ya no es una traducción, es una discrepancia.
  const cruzada = spawnSync(process.execPath, [CLI, 'mesa', 'J4', tmp(t), '--nombre', 'jv-j3'], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  assert.equal(cruzada.status, 2, `${cruzada.stdout}${cruzada.stderr}`);
  assert.match(cruzada.stdout + cruzada.stderr, /dice J3 por su forma y la mesa es de J4/);
});
