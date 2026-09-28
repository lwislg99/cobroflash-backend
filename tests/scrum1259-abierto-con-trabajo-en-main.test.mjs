// tests/scrum1259-abierto-con-trabajo-en-main.test.mjs — SCRUM-1259 (J6)
//
// La red de `scripts/abierto-con-trabajo-en-main.mjs`, la CAPA que cruza el motor de la casa
// (`censarTicket` de SCRUM-388 y `rastroDeLosTickets` de SCRUM-804) con una foto de los abiertos de
// Jira. Lo que se prueba aquí es sólo lo que la capa AÑADE: las trampas ① y ② del encargo, el
// «abierto legítimo» que NO se marca, y la foto que caduca. El motor tiene sus propios guards.
// Todo con casos FABRICADOS con la forma que devuelve el motor: los reales cambian cada vez que
// alguien cierra un ticket, y el CI no tiene la foto de Jira. Los casos reales del 28-sep-2026
// (1194, 1214, 1200 vía SCRUM-1216.md §⑦, 825, 1179, 1232, 1101) están medidos en
// `docs/master/SCRUM-1259.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ticketDeExpediente, reMencion, RE_CIERRE, clasificar, leerFoto,
} from '../scripts/abierto-con-trabajo-en-main.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'abierto-con-trabajo-en-main.mjs');

/** Lo que dirían el motor y `docs/master/`, fabricado con la forma real de cada uno. */
function caso({ fuentes = [], veredicto = fuentes.length ? 'ENTERO' : 'NADA', marcas = [], ramas = [], expedientes = {} } = {}) {
  return {
    censo: { veredicto, fuentes, commits: [], marcas },
    rastro: ramas.length ? { ramas } : undefined,
    expedientes: new Map(Object.entries(expedientes).map(([f, t]) => [f, t.split('\n')])),
  };
}

test('el número se lee entero: la letra de parte es del mismo ticket, y 120 no es 1200', () => {
  assert.equal(ticketDeExpediente('docs/master/SCRUM-1216b.md'), 1216);
  assert.equal(reMencion(120).test('SCRUM-1200, cerrado aquí'), false);
  assert.equal(reMencion(1200).test('SCRUM-1200, cerrado aquí'), true);
});

// ① — el 28-sep había dos ramas `scrum-1216b-*`: una en main y otra no.
test('🔴 ① una rama suya VIVA hace PARCIAL al ticket, aunque tenga otra de su número dentro', () => {
  const r = clasificar(9001, caso({ ramas: [
    { nombre: 'scrum-9001b-la-que-entro', clase: 'en-main' },
    { nombre: 'scrum-9001b-la-que-no', clase: 'viva' },
  ] }));
  assert.equal(r.veredicto, 'PARCIAL');
  assert.deepEqual(r.fuera.map((b) => b.nombre), ['scrum-9001b-la-que-no']);
  // Su gemelo, con sólo la que entró, SÍ es candidato: el PARCIAL de arriba lo decide la otra rama.
  const g = clasificar(9001, caso({ ramas: [{ nombre: 'scrum-9001b-la-que-entro', clase: 'en-main' }] }));
  assert.equal(g.veredicto, 'CANDIDATO');
});

// ② — SCRUM-1200 quedó «cerrado aquí» en docs/master/SCRUM-1216.md §⑦.
test('🔴 ② sin nada propio, OTRO expediente que dice «cerrado aquí» lo saca', () => {
  const r = clasificar(9002, caso({ expedientes: { 'docs/master/SCRUM-9003.md': '# SCRUM-9003 · otra cosa\n\n## ⑦ SCRUM-9002, cerrado aquí\n' } }));
  assert.equal(r.veredicto, 'CERRADO_EN_OTRO');
  assert.deepEqual(r.cierreAjeno.map((c) => [c.fichero, c.linea]), [['docs/master/SCRUM-9003.md', 3]]);
});

test('② una mención que sólo CITA no lo saca, y un número más largo no es el suyo', () => {
  const r = clasificar(9002, caso({ expedientes: { 'docs/master/SCRUM-9003.md': 'ver SCRUM-9002 para el contexto\nSCRUM-90021, cerrado aquí\n' } }));
  assert.equal(r.veredicto, 'SIN_RASTRO');
  assert.equal(r.mencionesAjenas, 1);
});

test('la frase de cierre tiene frontera de LETRA: «sólo cubre» no es «lo cubre»', () => {
  assert.equal(RE_CIERRE.test('SCRUM-774 sólo cubre `checkout -b`'), false);
  assert.equal(RE_CIERRE.test('SCRUM-774: lo cubre SCRUM-800'), true);
});

// El control que pidió el orquestador: abierto LEGÍTIMAMENTE con trabajo en main → no se marca.
test('🔴 abierto con MOTIVO escrito (Jira espera a otro, o el expediente se declara BLOQUEADO) NO es candidato', () => {
  const fundador = clasificar(9004, caso({ fuentes: ['commits'] }), { estado: 'Acción del fundador' });
  assert.equal(fundador.veredicto, 'ABIERTO_CON_MOTIVO');
  assert.match(fundador.motivo, /Acción del fundador/);
  const bloqueado = clasificar(9004, caso({ fuentes: ['commits', 'docs/master'], expedientes: { 'docs/master/SCRUM-9004.md': '# SCRUM-9004 · Modelo 303 — BLOQUEADO, motivo medido\n' } }), { estado: 'Tareas por hacer' });
  assert.equal(bloqueado.veredicto, 'ABIERTO_CON_MOTIVO');
  // El gemelo: el MISMO trabajo, sin motivo escrito, sí es candidato. Si esto no se cumple, el
  // instrumento no acusa a nadie y el «no se marca» de arriba no ha ganado nada.
  const sinMotivo = clasificar(9004, caso({ fuentes: ['commits', 'docs/master'], expedientes: { 'docs/master/SCRUM-9004.md': '# SCRUM-9004 · Modelo 303\n' } }), { estado: 'Tareas por hacer' });
  assert.equal(sinMotivo.veredicto, 'CANDIDATO');
});

test('lo que el MOTOR dice se respeta: número compartido → NO_MEDIBLE, y marcas sin conectar → con motivo', () => {
  const compartido = clasificar(9005, caso({ fuentes: ['commits'], veredicto: 'NO_MEDIBLE' }));
  assert.equal(compartido.veredicto, 'NO_MEDIBLE');
  const marcas = clasificar(9005, caso({ fuentes: ['commits'], veredicto: 'PARCIAL', marcas: ['sin conectar'] }), { estado: 'Tareas por hacer' });
  assert.equal(marcas.veredicto, 'ABIERTO_CON_MOTIVO');
  assert.match(marcas.motivo, /sin conectar/);
});

test('③ sin nada con su número sale SIN RASTRO (límite declarado, no «sin hacer»)', () => {
  assert.equal(clasificar(9006, caso()).veredicto, 'SIN_RASTRO');
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
    // cwd en el temporal, que NO es un repositorio: si la foto no la parase, el motor fallaría ahí.
    const vieja = spawnSync(process.execPath, [SCRIPT, '--jira', foto, '--tomada', '2020-01-01T00:00:00Z'], { encoding: 'utf8', cwd: dir });
    assert.equal(vieja.status, 2, vieja.stdout + vieja.stderr);
    assert.match(vieja.stdout, /CIEGO[\s\S]*pasa de 12 h/);
    // Su gemelo con la MISMA foto y un tope que la admite: la edad era lo único que la paraba, y
    // ahora pasa de largo y llega al motor (que, fuera de un repositorio, se declara ciego).
    const admitida = spawnSync(process.execPath, [SCRIPT, '--jira', foto, '--tomada', '2020-01-01T00:00:00Z', '--horas-max', '1e9'], { encoding: 'utf8', cwd: dir });
    assert.equal(admitida.stdout.includes('pasa de'), false, admitida.stdout);
    assert.equal(vieja.stdout.includes('pasa de'), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
