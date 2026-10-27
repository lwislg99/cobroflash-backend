// SCRUM-1463c · EL LATIDO ENSEÑA LOS CIERRES SIN CLIC.
//
// `cierre-sin-clic.mjs` (SCRUM-1463b, #2404) existía desde el 13-oct-2026 y sólo avisaba si alguien se
// acordaba de correrlo: el mismo fallo que venía a cazar (cerrar dependía de acordarse del clic). Aquí se
// mide que el latido lo enseña en cada pasada, que un ticket CERRADO de verdad no sale en su fila y que
// uno con el comentario de cierre escrito y el estado sin mover SÍ sale. ⛔ Ni el latido ni el guion cierran.
//
// Sólo lo PURO y el guion lanzado sobre una foto fabricada que no toca git: aquí no se toca Jira ni la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cierresDelLatido, informe, salidaDe, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO } from '../scripts/equipo/latido.mjs';
import { leerFotos, filaDe, resumir, leerGuardado, NOTA_SIN_CORRER, HORAS_DE_FOTO } from '../scripts/equipo/cierre-sin-clic.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LATIDO = path.join(RAIZ, 'scripts', 'equipo', 'latido.mjs');
const GUION = path.join(RAIZ, 'scripts', 'equipo', 'cierre-sin-clic.mjs');
const AHORA = Date.parse('2026-10-14T08:00:00Z');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La sección se calcula y no entra en el veredicto: el latido calla aunque haya cierres sin clic.
    fichero: 'scripts/equipo/latido.mjs',
    de: '  if (cie.seccion) secciones.push(cie.seccion);',
    a: '  if (false) secciones.push(cie.seccion);',
    cae: 'SCRUM-1463c · ESCRITO NO ES CORRIENDO: el latido lee lo que dejó el guion, mete la sección en su veredicto y pega la nota',
  },
  {
    // Sin nada guardado, el latido no dice que nadie lo ha corrido: «no hay sección» se lee como «no hay cierres».
    fichero: 'scripts/equipo/latido.mjs',
    de: '  return seccion === null ? { seccion: null, notas: [NOTA_SIN_CORRER] } : { seccion, notas: [] };',
    a: '  return seccion === null ? { seccion: null, notas: [] } : { seccion, notas: [] };',
    cae: 'SCRUM-1463c · nadie lo ha corrido en esta máquina → NOTA que lo dice, sin sección y sin tocar la salida',
  },
];

const com = (id, created, body) => ({ id, created, body, author: { displayName: 'Luis' } });
const nodo = (num, { estado = 'En curso', cat = 'indeterminate', comentarios } = {}) => ({
  key: `SCRUM-${num}`,
  fields: { summary: 'ZONA · algo', updated: '2026-10-13T12:00:00.000+0200', status: { name: estado, statusCategory: { key: cat } }, ...(comentarios ? { comment: { comments: comentarios, total: comentarios.length } } : {}) },
});
const busqueda = (nodos) => JSON.stringify({ issues: { totalCount: nodos.length, nodes: nodos, pageInfo: { hasNextPage: false } } });
const hLimpio = (mas = {}) => ({ ciegos: [], registros: [], evidencias: [], commits: [], commitsAjenos: [], ramasEnMain: [], ramasVivas: [], cierresAjenos: [], citas: [], ...mas });
const EN_MAIN = hLimpio({ commits: [{ sha: '411e04c0e', fecha: '2026-09-29', asunto: 'SCRUM-1126: fusionar' }] });

// Los dos arranques son los LEÍDOS el 13-oct en SCRUM-1126 (abierto) y SCRUM-997 (cerrado).
const CIERRE_ABIERTO = com('17592', '2026-09-29T19:41:12.000+0200', 'h3. CERRADO — la rama está en {{main}} (regla 42 cumplida)\n\nCierre del orquestador (A13).');
const CIERRE_CERRADO = com('19443', '2026-10-13T16:47:44.000+0200', '**CERRADO por el orquestador · 13-oct-2026, 14:42Z**');

/** Lo que el guion guarda para el latido, hecho con SUS funciones y pasado por JSON como lo escribe `guardar`. */
function guardadoDe(nodos, { tomada = AHORA - 3600000 } = {}) {
  const { abiertos, cerrados } = leerFotos([{ nombre: 'foto.json', texto: busqueda(nodos) }]);
  const filas = [...abiertos.keys()].sort((a, b) => a - b).map((n) => filaDe(n, abiertos.get(n), EN_MAIN, AHORA));
  return JSON.parse(JSON.stringify(resumir({ filas, cerrados: cerrados.size, tomada, main: 'e2be1c9fd', ahora: AHORA })));
}

test('SCRUM-1463c · 🔴 CONTROL: un ticket CERRADO de verdad NO sale en el latido; uno con su cierre escrito y abierto, SÍ', () => {
  const cerrado = nodo(997, { estado: 'Finalizada', cat: 'done', comentarios: [CIERRE_CERRADO] });
  const abierto = nodo(1126, { comentarios: [CIERRE_ABIERTO] });
  const { seccion, notas } = cierresDelLatido({ guardado: guardadoDe([cerrado, abierto]), ahora: AHORA });
  assert.deepEqual(notas, [], 'con algo guardado no va la nota de «nadie lo ha corrido»');
  assert.equal(seccion.pudo, true);
  assert.equal(seccion.alertas.length, 1);
  const texto = informe([seccion], { ahora: AHORA });
  assert.match(texto, /🔴 CIERRES SIN CLIC · 1 ticket abierto casa/);
  assert.match(texto, /SCRUM-1126 \[En curso\] · 14 días desde su comentario de cierre \(c\.17592/);
  assert.match(texto, /LE FALTA EL CLIC/);
  assert.doesNotMatch(texto, /SCRUM-997/, 'un ticket ya cerrado no sale, lleve el comentario de cierre que lleve');
  assert.equal(salidaDe([seccion]), SALIDA_AVISO);
  // El mismo comentario de 997 con el ticket ABIERTO sí sale: el control no pasa por estar ciego.
  const s2 = cierresDelLatido({ guardado: guardadoDe([nodo(997, { comentarios: [CIERRE_CERRADO] })]), ahora: AHORA }).seccion;
  assert.match(informe([s2], { ahora: AHORA }), /SCRUM-997 \[En curso\] · 0 días desde su comentario de cierre \(c\.19443/);
});

test('SCRUM-1463c · nadie lo ha corrido en esta máquina → NOTA que lo dice, sin sección y sin tocar la salida', () => {
  const { seccion, notas } = cierresDelLatido({ guardado: null, ahora: AHORA });
  assert.equal(seccion, null);
  assert.deepEqual(notas, [NOTA_SIN_CORRER]);
  assert.match(NOTA_SIN_CORRER, /nadie ha corrido `cierre-sin-clic\.mjs` en esta máquina/);
  const texto = informe([], { ahora: AHORA, notas });
  assert.ok(texto.includes(NOTA_SIN_CORRER), 'la nota sale en el informe');
  assert.equal(salidaDe([]), SALIDA_OK, 'un puntero no afirma nada y no cuenta para la salida');
});

test('SCRUM-1463c · 🔴 FAIL-CLOSED: un resultado ilegible, o una foto de más de 12 h, es «no pude mirar» y la salida es 2', () => {
  const ilegible = cierresDelLatido({ guardado: undefined, ahora: AHORA });
  assert.equal(ilegible.seccion.pudo, false);
  assert.equal(salidaDe([ilegible.seccion]), SALIDA_CIEGO);
  const vieja = cierresDelLatido({ guardado: guardadoDe([nodo(1126, { comentarios: [CIERRE_ABIERTO] })], { tomada: AHORA - (HORAS_DE_FOTO + 1) * 3600000 }), ahora: AHORA });
  assert.equal(vieja.seccion.pudo, false);
  assert.match(informe([vieja.seccion], { ahora: AHORA }), /🔴 CIERRES SIN CLIC · NO PUDE MIRAR: la última foto de Jira es de hace 13\.0 h/);
  assert.equal(salidaDe([vieja.seccion]), SALIDA_CIEGO);
});

test('SCRUM-1463c · lo que ESCRIBE el guion lanzado es lo que el latido sabe leer (foto sin cierres: no toca git)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1463c-'));
  try {
    const f = path.join(dir, 'foto.json');
    const g = path.join(dir, 'guardado.json');
    // Uno cerrado y uno que sólo CITA: ninguno pregunta a git, así que no hay red.
    const cita = nodo(1538, { comentarios: [com('19393', '2026-10-13T15:15:22.418+0200', '| #2286 | cerrado por el orquestador durante el barrido |')] });
    fs.writeFileSync(f, busqueda([nodo(997, { estado: 'Finalizada', cat: 'done', comentarios: [CIERRE_CERRADO] }), cita]));
    const r = spawnSync(process.execPath, [GUION, '--jira', f, '--guardar-en', g, '--raiz', RAIZ], { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 0, `el guion salió ${r.status}: ${r.stdout}${r.stderr}`);
    const { seccion, notas } = cierresDelLatido({ guardado: leerGuardado(g), ahora: Date.now() });
    assert.deepEqual(notas, []);
    assert.equal(seccion.pudo, true, seccion.motivo);
    assert.deepEqual(seccion.alertas, []);
    assert.match(seccion.poblacion, /^1 ticket abierto casa con las fórmulas de cierre .*: 0 con comentario de cierre, 0 sin leer, 1 que sólo lo citan · ⛔ este guion NO cierra nada/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-1463c · ESCRITO NO ES CORRIENDO: el latido lee lo que dejó el guion, mete la sección en su veredicto y pega la nota', () => {
  const fuente = fs.readFileSync(LATIDO, 'utf8');
  assert.match(fuente, /import \{ seccionCierres, leerGuardado, NOTA_SIN_CORRER \} from '\.\/cierre-sin-clic\.mjs';/);
  assert.match(fuente, /const cie = cierresDelLatido\(\{ guardado: intentar\(\(\) => leerGuardado\(\)\), ahora \}\);/, '🔴 el latido no lee lo guardado (o lo lee sin `intentar`: un fallo suyo tumbaría la pasada entera)');
  assert.match(fuente, /\n {2}if \(cie\.seccion\) secciones\.push\(cie\.seccion\);\n/, '🔴 la sección CIERRES se calcula y NO entra en el veredicto');
  assert.match(fuente, /notas: \[\.\.\.NOTAS_FIJAS, \.\.\.cie\.notas\]/, '🔴 la nota de «nadie lo ha corrido» no llega al informe');
  // ⛔ Lista y calla: el latido no escribe en Jira ni corre el guion.
  assert.doesNotMatch(fuente, /transitionJiraIssue|cierre-sin-clic\.mjs['"]\s*,\s*\[/);
});
