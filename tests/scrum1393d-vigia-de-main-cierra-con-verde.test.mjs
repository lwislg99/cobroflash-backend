// tests/scrum1393d-vigia-de-main-cierra-con-verde.test.mjs — SCRUM-1393d
//
// Cuándo el vigía de `main` CIERRA su Issue y cuándo lo REABRE (`accionDelIssue` del motor, que
// ejecuta `.github/workflows/vigia-de-main.yml`). Sin red. Los casos se SIEMBRAN aquí: un verde que
// cierra, un ciego que no cierra, un rojo que reabre. Lo que sólo se ve corriendo en GitHub (que
// `gh issue close`/`reopen` contesten) no se prueba aquí: es CIEGO declarado en el registro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  veredictoDeCommit, accionDelIssue, pendientesDelIssue, marcaDeAviso, marcaDeCierre, cuerpoDelAviso,
  topeDeCorridaDelCI, JOBS_DEL_CI,
} from '../scripts/vigia-silencio-de-main.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = path.join(RAIZ, 'scripts', 'vigia-silencio-de-main.mjs');
const AHORA = '2026-10-21T12:00:00Z';
const TOPE = topeDeCorridaDelCI(fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'ci.yml'), 'utf8'));
const job = (name, conclusion) => ({ name, status: 'completed', conclusion });
const run = (conclusion) => ({ status: 'completed', conclusion, created_at: '2026-10-21T11:55:00Z', html_url: 'https://x/run' });
const VERDE = (sha) => veredictoDeCommit({ sha, run: run('success'), jobs: JOBS_DEL_CI.map((n) => job(n, 'success')), ahora: AHORA, topeMin: TOPE });
const ROJO = (sha) => veredictoDeCommit({ sha, run: run('failure'), jobs: [job(JOBS_DEL_CI[0], 'failure')], ahora: AHORA, topeMin: TOPE });
const CIEGO = (sha) => veredictoDeCommit({ sha, run: run('cancelled'), jobs: [], ahora: AHORA, topeMin: TOPE });
const P = 'a'.repeat(40); // la punta
const V = 'b'.repeat(40); // un commit viejo
const pasada = (veredictos, punta = P) => ({ veredictos, ahora: AHORA, origen: 'siembra', urlDelRun: 'https://x/p', punta });

test('SCRUM-1393d · los cebos son lo que dicen ser (si no, el resto no prueba nada)', () => {
  assert.deepEqual([VERDE(P), ROJO(P), CIEGO(P)].map((v) => v.estado), ['VERDE', 'ROJO', 'CIEGO']);
});

test('SCRUM-1393d · SIEMBRA: la punta VERDE con el Issue abierto lo CIERRA, diciendo sha y población', () => {
  const a = accionDelIssue(pasada([VERDE(P)]), { previos: marcaDeAviso(ROJO(V)), estado: 'abierto' });
  assert.deepEqual(a.pasos, ['comentar', 'cerrar']);
  assert.ok(a.cuerpo.includes(P.slice(0, 12)), 'nombra el sha de la punta');
  assert.match(a.cuerpo, /1 commits mirados · 0 rojos · 0 ciegos \(sin verificar\) · 0 corriendo · 0 sin leer · 1 verdes/);
  assert.ok(a.cuerpo.includes(marcaDeCierre(P)), 'lleva la marca de cierre');
  assert.doesNotMatch(a.cuerpo, /@claude/i);
  assert.match(a.cuerpo, /Vigía de main · CERRADO/);
});

test('SCRUM-1393d · SIEMBRA: un CIEGO no cierra en la punta ni pendiente en el Issue; en la pasada se declara (1393g)', () => {
  // en la punta
  assert.deepEqual(accionDelIssue(pasada([CIEGO(P)]), { estado: 'abierto' }).pasos, ['comentar']);
  // en la pasada (la red diaria), con la punta verde: SCRUM-1393g (c.21059) ya no bloquea, se DECLARA
  const enLaPasada = accionDelIssue(pasada([CIEGO(V), VERDE(P)]), { estado: 'abierto' });
  assert.deepEqual(enLaPasada.pasos, ['comentar', 'cerrar']);
  assert.match(enLaPasada.cuerpo, /1 CIEGO sin absolver de 2 commits mirados en esta pasada/);
  // pendiente en el Issue: un verde POSTERIOR no lo absuelve (sin «lectura generosa»)
  const pendiente = accionDelIssue(pasada([VERDE(P)]), { previos: marcaDeAviso(CIEGO(V)), estado: 'abierto' });
  assert.deepEqual(pendiente.pasos, []);
  assert.match(pendiente.motivo, /CIEGO pendiente/);
  // ...salvo que ESE commit se haya vuelto a juzgar, y entonces sí cierra
  assert.deepEqual(accionDelIssue(pasada([VERDE(V), VERDE(P)]), { previos: marcaDeAviso(CIEGO(V)), estado: 'abierto' }).pasos, ['comentar', 'cerrar']);
});

test('SCRUM-1393d · SIEMBRA: un ROJO con el Issue cerrado lo REABRE (el mismo), y sin Issue lo crea', () => {
  const previos = `${marcaDeAviso(ROJO(V))}\n${marcaDeCierre(V)}`;
  assert.deepEqual(accionDelIssue(pasada([ROJO(P)]), { previos, estado: 'cerrado' }).pasos, ['reabrir', 'comentar']);
  assert.deepEqual(accionDelIssue(pasada([CIEGO(P)]), { previos, estado: 'cerrado' }).pasos, ['reabrir', 'comentar']);
  assert.deepEqual(accionDelIssue(pasada([ROJO(P)]), { estado: 'ninguno' }).pasos, ['crear']);
  // un rojo YA avisado no reabre: no hay nada nuevo que decir
  assert.deepEqual(accionDelIssue(pasada([ROJO(P)]), { previos: `${marcaDeAviso(ROJO(P))}\n${marcaDeCierre(V)}`, estado: 'cerrado' }).pasos, []);
});

test('SCRUM-1393d · un ROJO viejo sí lo absuelve el verde de la punta; un cierre corta los pendientes', () => {
  assert.deepEqual(accionDelIssue(pasada([ROJO(V), VERDE(P)]), { previos: marcaDeAviso(ROJO(V)), estado: 'abierto' }).pasos, ['comentar', 'cerrar']);
  assert.deepEqual(pendientesDelIssue(marcaDeAviso(CIEGO(V))), [V]);
  assert.deepEqual(pendientesDelIssue(`${marcaDeAviso(CIEGO(V))}\n${marcaDeCierre(P)}`), [], 'lo de antes del cierre ya no está pendiente');
  assert.deepEqual(pendientesDelIssue(`${marcaDeAviso(CIEGO(V))}\n${marcaDeAviso(ROJO(V))}`), [], 'manda la ÚLTIMA marca del commit');
  assert.deepEqual(pendientesDelIssue(''), []);
});

test('SCRUM-1393d · no cierra sin saber la punta, si la punta no está en la pasada, ni si no hay Issue abierto', () => {
  assert.deepEqual(accionDelIssue(pasada([VERDE(V)]), { estado: 'abierto' }).pasos, [], '(C) juzgó un commit que ya no es la punta');
  assert.deepEqual(accionDelIssue(pasada([VERDE(P)], null), { estado: 'abierto' }).pasos, []);
  assert.deepEqual(accionDelIssue(pasada([VERDE(P)]), { estado: 'cerrado' }).pasos, []);
  assert.deepEqual(accionDelIssue(pasada([VERDE(P)]), { estado: 'ninguno' }).pasos, []);
  assert.throws(() => accionDelIssue(pasada([ROJO(P)]), { estado: 'raro' }), /estado del Issue desconocido/);
});

test('SCRUM-1393d · el modo de consola (`--accion-del-issue`) dice sus pasos y escribe el cuerpo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1393d-'));
  try {
    const env = { ...process.env, URL_RUN: 'https://x/p' };
    delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
    const correr = (veredictos, estado, previos = '') => {
      fs.writeFileSync(path.join(dir, 'v.json'), JSON.stringify({ ahora: AHORA, origen: 'siembra', veredictos }));
      fs.writeFileSync(path.join(dir, 'p.txt'), previos);
      const out = execFileSync(process.execPath, [MOTOR, '--accion-del-issue', path.join(dir, 'v.json'), '--punta', P,
        '--estado-issue', estado, '--previos', path.join(dir, 'p.txt'), '--cuerpo', path.join(dir, 'c.md')], { env, encoding: 'utf8' });
      return { pasos: out.match(/^PASOS=(.*)$/m)?.[1], cuerpo: fs.readFileSync(path.join(dir, 'c.md'), 'utf8') };
    };
    const cierra = correr([VERDE(P)], 'abierto');
    assert.equal(cierra.pasos, 'comentar,cerrar');
    assert.ok(cierra.cuerpo.includes(marcaDeCierre(P)) && cierra.cuerpo.includes('https://x/p'));
    const reabre = correr([ROJO(P)], 'cerrado', marcaDeCierre(V));
    assert.equal(reabre.pasos, 'reabrir,comentar');
    assert.equal(reabre.cuerpo, cuerpoDelAviso({ ...pasada([ROJO(P)]) }, marcaDeCierre(V)));
    const nada = correr([VERDE(P)], 'cerrado');
    assert.equal(nada.pasos, '', 'PASOS= vacío, pero la línea está');
    assert.equal(nada.cuerpo, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SCRUM-1393d · el workflow ejecuta TODOS los pasos que el motor puede pedir, y corre también con salida 0', () => {
  const yml = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'vigia-de-main.yml'), 'utf8')
    .split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
  const motor = fs.readFileSync(MOTOR, 'utf8');
  const pasos = new Set([...motor.matchAll(/'(crear|reabrir|comentar|cerrar)'/g)].map((m) => m[1]));
  assert.equal(pasos.size, 4, `pasos que el motor nombra: ${[...pasos]}`);
  for (const p of pasos) assert.match(yml, new RegExp(`^\\s+${p}\\) gh issue `, 'm'), `el workflow no ejecuta «${p}»`);
  assert.match(yml, /--accion-del-issue vigia\.json --punta "\$PUNTA"/);
  assert.match(yml, /gh issue list --repo "\$REPO" --state all /, 'busca también los cerrados: reabrir y no duplicar');
  const paso = yml.slice(yml.indexOf('- name: Avisar o cerrar en el Issue'));
  assert.ok(paso.length > 0 && yml.includes('- name: Avisar o cerrar en el Issue'));
  assert.doesNotMatch(paso.split('run: |')[0], /if: steps\.juez\.outputs\.salida/, 'con salida 0 tiene que correr: es la que cierra');
  assert.match(yml, /if: steps\.juez\.outputs\.salida|salida=\$codigo/, 'la salida del juez sigue existiendo');
});
