// tests/scrum1259-abierto-con-trabajo-en-main.test.mjs — SCRUM-1259 (J6)
//
// La red de `scripts/abierto-con-trabajo-en-main.mjs`: las tres trampas del encargo, el «abierto
// legítimo» que NO se marca, y la foto de Jira que caduca. Todo con casos FABRICADOS: los reales
// cambian cada vez que alguien cierra un ticket, y el CI no tiene la foto de Jira. Los casos reales
// del 28-sep-2026 (1194, 1214, 825, 1200 vía SCRUM-1216.md §⑦, 1101 SIN RASTRO) están medidos en
// `docs/master/SCRUM-1259.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ticketDeRama, ticketDeExpediente, reMencion, RE_CIERRE, clasificar, leerFoto,
} from '../scripts/abierto-con-trabajo-en-main.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'abierto-con-trabajo-en-main.mjs');

/** Un repo fabricado: ramas, commits de main y expedientes (fichero → líneas). */
function repo({ ramas = [], commits = [], expedientes = {} } = {}) {
  return { ramas, commits, expedientes: new Map(Object.entries(expedientes).map(([f, t]) => [f, t.split('\n')])) };
}

test('la rama se lee ENTERA: número, parte y nada más', () => {
  assert.deepEqual(ticketDeRama('scrum-1216b-numero-de-arranque'), { num: 1216, parte: 'b' });
  assert.deepEqual(ticketDeRama('scrum-1200-sin-respuesta'), { num: 1200, parte: '' });
  assert.equal(ticketDeRama('main'), null);
  assert.equal(ticketDeExpediente('docs/master/SCRUM-1216b.md'), 1216);
  assert.equal(reMencion(120).test('SCRUM-1200, cerrado aquí'), false);
  assert.equal(reMencion(1200).test('SCRUM-1200, cerrado aquí'), true);
});

// ① — el 28-sep había dos ramas `scrum-1216b-*`: una en main y otra no.
test('🔴 ① una rama suya SIN MERGEAR hace PARCIAL al ticket, aunque tenga otra de su número dentro', () => {
  const r = clasificar(9001, repo({ ramas: [
    { nombre: 'scrum-9001b-la-que-entro', estado: 'MERGEADA_BORRADA' },
    { nombre: 'scrum-9001b-la-que-no', estado: 'SIN_MERGEAR' },
  ] }));
  assert.equal(r.veredicto, 'PARCIAL');
  assert.deepEqual(r.fuera.map((b) => b.nombre), ['scrum-9001b-la-que-no']);
  // Su gemelo, con sólo la que entró, SÍ es candidato: el PARCIAL de arriba lo decide la otra rama.
  const g = clasificar(9001, repo({ ramas: [{ nombre: 'scrum-9001b-la-que-entro', estado: 'MERGEADA_BORRADA' }] }));
  assert.equal(g.veredicto, 'CANDIDATO');
});

// ② — SCRUM-1200 quedó «cerrado aquí» en docs/master/SCRUM-1216.md §⑦.
test('🔴 ② sin rama ni expediente propio, OTRO expediente que dice «cerrado aquí» lo saca', () => {
  const r = clasificar(9002, repo({ expedientes: { 'docs/master/SCRUM-9003.md': '# SCRUM-9003 · otra cosa\n\n## ⑦ SCRUM-9002, cerrado aquí\n' } }));
  assert.equal(r.veredicto, 'CERRADO_EN_OTRO');
  assert.deepEqual(r.cierreAjeno.map((c) => `${c.fichero}:${c.linea}`), ['docs/master/SCRUM-9003.md:3']);
});

test('② una mención que sólo CITA no lo saca, y un número más largo no es el suyo', () => {
  const r = clasificar(9002, repo({ expedientes: { 'docs/master/SCRUM-9003.md': 'ver SCRUM-9002 para el contexto\nSCRUM-90021, cerrado aquí\n' } }));
  assert.equal(r.veredicto, 'SIN_RASTRO');
  assert.equal(r.mencionesAjenas, 1);
});

test('la frase de cierre tiene frontera de LETRA: «sólo cubre» no es «lo cubre»', () => {
  assert.equal(RE_CIERRE.test('SCRUM-774 sólo cubre `checkout -b`'), false);
  assert.equal(RE_CIERRE.test('SCRUM-774: lo cubre SCRUM-800'), true);
});

// El control que pidió el orquestador: abierto LEGÍTIMAMENTE con trabajo en main → no se marca.
test('🔴 abierto con MOTIVO escrito (Jira espera a otro, o el expediente se declara BLOQUEADO) NO es candidato', () => {
  const base = { ramas: [{ nombre: 'scrum-9004-medicion', estado: 'MERGEADA_BORRADA' }] };
  const fundador = clasificar(9004, repo(base), { estado: 'Acción del fundador' });
  assert.equal(fundador.veredicto, 'ABIERTO_CON_MOTIVO');
  assert.match(fundador.motivo, /Acción del fundador/);
  const bloqueado = clasificar(9004, repo({ ...base, expedientes: { 'docs/master/SCRUM-9004.md': '# SCRUM-9004 · Modelo 303 — BLOQUEADO, motivo medido\n' } }), { estado: 'Tareas por hacer' });
  assert.equal(bloqueado.veredicto, 'ABIERTO_CON_MOTIVO');
  // El gemelo: el MISMO trabajo, sin motivo escrito, sí es candidato. Si esto no se cumple, el
  // instrumento no acusa a nadie y el «no se marca» de arriba no ha ganado nada.
  const sinMotivo = clasificar(9004, repo({ ...base, expedientes: { 'docs/master/SCRUM-9004.md': '# SCRUM-9004 · Modelo 303\n' } }), { estado: 'Tareas por hacer' });
  assert.equal(sinMotivo.veredicto, 'CANDIDATO');
});

test('③ sin nada con su número sale SIN RASTRO (límite declarado, no «sin hacer»)', () => {
  const r = clasificar(9005, repo({ commits: [{ sha: 'abc', asunto: 'SCRUM-9006: el trabajo de 9005 hecho con otro número' }] }));
  assert.equal(r.veredicto, 'SIN_RASTRO');
});

test('un commit de main que EMPIEZA por su número cuenta como trabajo; uno que sólo lo cita, no', () => {
  const r = clasificar(9007, repo({ commits: [{ sha: 'a1', asunto: 'SCRUM-9007: hecho' }] }));
  assert.equal(r.veredicto, 'CANDIDATO');
  const s = clasificar(9007, repo({ commits: [{ sha: 'a2', asunto: 'SCRUM-9008: arregla lo que dejó SCRUM-9007' }] }));
  assert.equal(s.veredicto, 'SIN_RASTRO');
});

test('la foto de Jira: JSON del MCP por páginas, sin los «done», y CIEGA si falta la última página', () => {
  const pag = (nodos, hasNextPage) => ({ nombre: 'p', texto: JSON.stringify({ issues: { nodes: nodos, pageInfo: { hasNextPage } } }) });
  const nodo = (k, cat) => ({ key: k, fields: { summary: 's', status: { name: cat === 'done' ? 'Finalizada' : 'Tareas por hacer', statusCategory: { key: cat } } } });
  const entera = leerFoto([pag([nodo('SCRUM-1', 'new'), nodo('SCRUM-2', 'done')], true), pag([nodo('SCRUM-3', 'indeterminate')], false)]);
  assert.deepEqual([...entera.abiertos.keys()], [1, 3]);
  assert.deepEqual(entera.problemas, []);
  const cortada = leerFoto([pag([nodo('SCRUM-1', 'new')], true)]);
  assert.equal(cortada.problemas.length, 1);
  assert.match(cortada.problemas[0], /faltan páginas/);
});

test('🔴 una foto VIEJA deja al instrumento CIEGO (sale 2) sin llegar a tocar git', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abierto-'));
  const foto = path.join(dir, 'foto.tsv');
  fs.writeFileSync(foto, 'SCRUM-1\tTareas por hacer\tuno\n');
  try {
    const vieja = spawnSync(process.execPath, [SCRIPT, '--jira', foto, '--tomada', '2020-01-01T00:00:00Z'], { encoding: 'utf8' });
    assert.equal(vieja.status, 2, vieja.stdout + vieja.stderr);
    assert.match(vieja.stdout, /CIEGO[\s\S]*pasa de 12 h/);
    // Su gemelo con la MISMA foto y otro tope: la edad es lo único que la dejaba ciega.
    const tope = spawnSync(process.execPath, [SCRIPT, '--jira', foto, '--tomada', '2020-01-01T00:00:00Z', '--horas-max', '1e9', '--ref', 'no-existe-esta-ref'], { encoding: 'utf8' });
    assert.notEqual(tope.stdout.includes('pasa de'), true, tope.stdout);
    assert.equal(vieja.stdout.includes('pasa de'), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
