// SCRUM-1324d — el vigía de main sale ROJO cuando no consigue dar un veredicto.
//
// Decisión del fundador, SCRUM-1324 c.20749: «Sí, rojo sin veredicto». Del 22 al 24-oct el juez de
// `vigia-de-main.yml` no escribió veredicto en más de 120 pasadas seguidas (le faltaba `typescript`,
// SCRUM-1324c), comentó «salida 1 y SIN veredicto escrito» en el Issue #2641 cada vez, y el job salió
// `success` en todas. Medido el 24-oct a las 12:36Z: seguía igual.
//
// CÓMO SE PRUEBA: ejecutando el `run:` REAL del paso «Sin veredicto, el job en ROJO» con `bash -e`,
// como Actions, en un temporal fuera del árbol, con cada forma de «sin veredicto» y con dos veredictos
// de verdad (salida 0 y salida 1). Y la FORMA: es el último paso, corre con `always()` y lee la salida
// del juez, y el juez escribe el `vigia.json` que este paso lee. SIN GATE: sin red y sin BD.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { casosEscritos } from './_casos-escritos.mjs';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = path.join(RAIZ, '.github', 'workflows', 'vigia-de-main.yml');
const NOMBRE = 'Sin veredicto, el job en ROJO';
const LINEAS = fs.readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n').split('\n');

/** Los pasos del job, en orden: nombre y líneas de su bloque (el repo no trae parser de YAML). */
function pasos() {
  const lista = [];
  for (const l of LINEAS) {
    const m = /^ {6}- (?:name: (.+?)|uses: .+)\s*$/.exec(l);
    if (m) lista.push({ nombre: m[1] ?? null, lineas: [] });
    else if (lista.length && (l.startsWith(' '.repeat(8)) || l.trim() === '')) lista.at(-1).lineas.push(l);
    else if (lista.length && /^\S/.test(l)) break;
  }
  return lista;
}

/** El `run: |` de un paso, sin su sangría de 10. */
function guion(paso) {
  const i = paso.lineas.findIndex((l) => /^ {8}run: \|\s*$/.test(l));
  if (i < 0) return null;
  const cuerpo = [];
  for (const l of paso.lineas.slice(i + 1)) {
    if (l.trim() === '') { cuerpo.push(''); continue; }
    if (!l.startsWith(' '.repeat(10))) break;
    cuerpo.push(l.slice(10));
  }
  return cuerpo.join('\n');
}

const PASOS = pasos();
const PASO = PASOS.find((p) => p.nombre === NOMBRE);
const barras = (p) => p.split(path.sep).join('/');

/** Corre el paso REAL con `vigia` (contenido de vigia.json, o null = no existe) y `salida`. */
function correr({ vigia, salida }) {
  const tmp = temporal(`yaqu-1324d-${process.pid}-`);
  fs.writeFileSync(path.join(tmp, 'paso.sh'), guion(PASO));
  fs.writeFileSync(path.join(tmp, 'summary'), '');
  if (vigia !== null) fs.writeFileSync(path.join(tmp, 'vigia.json'), vigia);
  const env = { ...process.env, GITHUB_STEP_SUMMARY: barras(path.join(tmp, 'summary')) };
  if (salida === undefined) delete env.SALIDA; else env.SALIDA = salida;
  // `bash -e`: así invoca Actions un `run:` sin `shell:` (medido en el log, SCRUM-1123c).
  const r = spawnSync('bash', ['-e', barras(path.join(tmp, 'paso.sh'))], { cwd: tmp, env, encoding: 'utf8', timeout: 60000 });
  return { status: r.status, salida: (r.stdout || '') + (r.stderr || ''), resumen: fs.readFileSync(path.join(tmp, 'summary'), 'utf8'), error: r.error };
}

const CON_DOS = JSON.stringify({ ahora: 'x', origen: 'x', salida: 0, veredictos: [{ sha: 'a', estado: 'VERDE' }, { sha: 'b', estado: 'VERDE' }] });

test('SCRUM-1324d · SUELO: el paso existe, y bash y node se pueden usar aquí', () => {
  assert.ok(PASOS.length >= 6, `🔴 sólo veo ${PASOS.length} pasos en vigia-de-main.yml: el lector no ve el fichero`);
  assert.ok(PASO, `🔴 no encuentro el paso «${NOMBRE}» en vigia-de-main.yml`);
  assert.ok(guion(PASO)?.includes('vigia.json'), '🔴 no encuentro el `run:` del paso, o no lee vigia.json');
  const b = spawnSync('bash', ['-c', 'node -e "process.stdout.write(String(6*7))"'], { encoding: 'utf8' });
  assert.equal(b.stdout, '42', `🔴 bash con node no se puede usar aquí (${b.error?.message ?? b.stderr}): el laboratorio no mediría nada`);
});

test('SCRUM-1324d · FORMA: último paso, con always(), lee la salida del juez, y el juez escribe vigia.json', () => {
  assert.equal(PASOS.at(-1)?.nombre, NOMBRE, `🔴 el paso no es el último (lo es «${PASOS.at(-1)?.nombre}»): uno de después podría tumbar o tapar su rojo`);
  const cab = PASO.lineas.slice(0, PASO.lineas.findIndex((l) => /^ {8}run: \|/.test(l))).filter((l) => !/^\s*#/.test(l));
  assert.ok(cab.some((l) => /^ {8}if: always\(\)\s*$/.test(l)), '🔴 sin `if: always()`: si un paso de antes cae, éste no corre');
  assert.ok(cab.some((l) => /^ {10}SALIDA: \$\{\{ steps\.juez\.outputs\.salida \}\}\s*$/.test(l)), '🔴 el paso no lee la salida del juez');
  const juez = PASOS.find((p) => p.nombre === 'Juzgar los commits');
  assert.ok(juez && /--json vigia\.json/.test(guion(juez)), '🔴 el juez ya no escribe vigia.json: este paso miraría un fichero que no existe');
  assert.match(guion(juez), /echo "salida=\$codigo" >> "\$GITHUB_OUTPUT"/, '🔴 el juez ya no publica su salida');
});

// SCRUM-1415: un caso por fila, con el nombre ESCRITO (la señal por nombres no lee nombres construidos).
const SIN_VEREDICTO = [
  ['sin vigia.json y salida 1 (el ciego del 22-24 oct)', { vigia: null, salida: '1' }],
  ['sin vigia.json y salida 0', { vigia: null, salida: '0' }],
  ['salida 2: el vigía no supo mirar', { vigia: CON_DOS, salida: '2' }],
  ['salida vacía: el juez no llegó a correr', { vigia: CON_DOS, salida: '' }],
  ['sin salida en el entorno', { vigia: CON_DOS, salida: undefined }],
  ['vigia.json ilegible', { vigia: '{ esto no es json', salida: '0' }],
  ['vigia.json sin «veredictos»', { vigia: '{"salida":0}', salida: '0' }],
  ['vigia.json que no juzga ningún commit', { vigia: '{"salida":0,"veredictos":[]}', salida: '0' }],
];
const rojo = casosEscritos(SIN_VEREDICTO, ([caso]) => `SCRUM-1324d · 🔴 ROJO sin veredicto: ${caso}`, ([, entrada]) => {
  const r = correr(entrada);
  assert.ifError(r.error);
  assert.equal(r.status, 1, `🔴 sin veredicto el paso sale ${r.status}, no 1:\n${r.salida}`);
  assert.match(r.salida, /::error title=Vigía de main SIN veredicto::/, '🔴 sale rojo sin decir por qué');
  assert.match(r.resumen, /SIN veredicto/);
});
test('SCRUM-1324d · 🔴 ROJO sin veredicto: sin vigia.json y salida 1 (el ciego del 22-24 oct)', rojo(0));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: sin vigia.json y salida 0', rojo(1));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: salida 2: el vigía no supo mirar', rojo(2));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: salida vacía: el juez no llegó a correr', rojo(3));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: sin salida en el entorno', rojo(4));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: vigia.json ilegible', rojo(5));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: vigia.json sin «veredictos»', rojo(6));
test('SCRUM-1324d · 🔴 ROJO sin veredicto: vigia.json que no juzga ningún commit', rojo(7));
rojo.todos();

const CON_VEREDICTO = ['0', '1'];
const positivo = casosEscritos(CON_VEREDICTO, (salida) => `SCRUM-1324d · POSITIVO: con veredicto (2 commits) y salida ${salida}, el paso NO cae`, (salida) => {
  const r = correr({ vigia: CON_DOS, salida });
  assert.ifError(r.error);
  assert.equal(r.status, 0, `🔴 con veredicto el paso sale ${r.status}:\n${r.salida}`);
  assert.match(r.resumen, /veredicto: \*\*2\*\* commit/, '🔴 no declara cuántos commits juzgó');
});
test('SCRUM-1324d · POSITIVO: con veredicto (2 commits) y salida 0, el paso NO cae', positivo(0));
test('SCRUM-1324d · POSITIVO: con veredicto (2 commits) y salida 1, el paso NO cae', positivo(1));
positivo.todos();
