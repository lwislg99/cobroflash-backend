// SCRUM-1300c · PIEZA 8 — `memoria-contra-el-arbol.mjs`: la memoria del orquestador contra el árbol.
//
// Sin red: las consultas a git/gh se doblan; el extractor, el juez, el control y `medir` son los de verdad.
// Lo que se prueba es lo que lo hace útil: que una afirmación falsa SALE, que «no pude mirar» sale 2 y
// nunca «0 falsas», y que el control de dentro tumba la pasada cuando las consultas mienten.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import {
  extraerAfirmaciones, juzgar, medir, leerMemoria, sinCitas, testigos,
  SALIDA_BIEN, SALIDA_FALSAS, SALIDA_CIEGO, SHA_QUE_NO_EXISTE,
} from '../scripts/equipo/memoria-contra-el-arbol.mjs';

const PUNTA = 'abc1234def5678abc1234def5678abc1234def56';
const EMPUJADO = 'beef5678beef5678beef5678beef5678beef5678';
const REFS = { ok: true, ultimoPRMergeado: 2500, puntaDeMain: PUNTA };

/** Un árbol de juguete: qué PR están en qué estado y qué commits dónde. */
function consultas({ prs = { 2500: 'MERGED', 2552: 'MERGED', 2577: 'OPEN', 2001: 'CLOSED' }, enMain = [PUNTA], remoto = [PUNTA, EMPUJADO], rutas = ['scripts/equipo/parados.mjs'], ghCaido = false } = {}) {
  const existen = new Set([...enMain, ...remoto]);
  return {
    estadoPR: (n) => (ghCaido ? { ok: false, motivo: 'gh no contestó' } : { ok: true, valor: prs[n] || 'NO EXISTE' }),
    existe: (s) => ({ ok: true, valor: existen.has(s) }),
    enMain: (s) => ({ ok: true, valor: enMain.includes(s) }),
    enElRemoto: (s) => ({ ok: true, valor: remoto.includes(s) }),
    rutaEnMain: (r) => ({ ok: true, valor: rutas.includes(r) }),
  };
}
const fichero = (texto, nombre = 'project_x.md') => [{ nombre, texto }];

// ═══ El extractor ═══════════════════════════════════════════════════════════════════════════

test('SCRUM-1300c · cada TRAMO es una afirmación: «#1 EN MAIN · #2 ABIERTO» son dos, con su estado', () => {
  const { afirmaciones } = extraerAfirmaciones(fichero('- 1434 #2552 EN MAIN · 1562d #2577 ABIERTO, falta mirarlo'));
  assert.deepEqual(afirmaciones.map((a) => [a.objeto, a.dice]), [[2552, 'en-main']]);
  // El segundo tramo lleva «falta»: negación, no se juzga. Mejor callar que inventar.
});

test('SCRUM-1300c · lo citado entre «…» NO se afirma: la memoria cita ahí el error mismo', () => {
  assert.equal(sinCitas('Convertí «#1552 mergeado» en otra cosa').includes('1552'), false);
  const { afirmaciones } = extraerAfirmaciones(fichero('Convertí «empujado» en «mergeado» al retransmitir (#1552)'));
  assert.deepEqual(afirmaciones, []);
});

test('SCRUM-1300c · negación y «EN MAIN y ABIERTO a la vez» se apartan, y se CUENTAN', () => {
  const { afirmaciones, sinJuzgar } = extraerAfirmaciones(fichero('#2552 NO está en main\n#2577 abierto y mergeado a mano'));
  assert.deepEqual(afirmaciones, []);
  assert.deepEqual(sinJuzgar.map((s) => s.porque), ['lleva negación', 'dice EN MAIN y ABIERTO a la vez']);
});

test('SCRUM-1300c · un sha es «commit» sólo si el texto lo dice (punta, commit, sha, `…`): un id de sesión no lo es', () => {
  const { afirmaciones } = extraerAfirmaciones(fichero(`- 1011b EMPUJADA, punta ${EMPUJADO.slice(0, 8)}\n- firma en la transcripción ed676fd1, EN MAIN #2552`));
  const shas = afirmaciones.filter((a) => a.tipo === 'sha');
  assert.deepEqual(shas.map((a) => [a.objeto, a.dice, a.commit]), [[EMPUJADO.slice(0, 8), 'empujado', true], ['ed676fd1', 'en-main', false]]);
});

test('SCRUM-1300c · una ruta con carpeta + EN MAIN es una afirmación sobre `origin/main`', () => {
  const { afirmaciones } = extraerAfirmaciones(fichero('- `scripts/equipo/quien-me-espera.mjs` EN MAIN desde hoy'));
  assert.deepEqual(afirmaciones.map((a) => [a.tipo, a.objeto]), [['ruta', 'scripts/equipo/quien-me-espera.mjs']]);
});

// ═══ El juez ════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1300c · 🔴 EL CASO QUE LO HIZO NACER: un PR ABIERTO contado como EN MAIN sale FALSA', () => {
  const r = juzgar({ tipo: 'pr', objeto: 2577, dice: 'en-main' }, consultas());
  assert.deepEqual(r, { veredicto: 'FALSA', real: 'OPEN' });
  assert.equal(juzgar({ tipo: 'pr', objeto: 2001, dice: 'en-main' }, consultas()).veredicto, 'FALSA', 'cerrado sin mergear tampoco es EN MAIN');
});

test('SCRUM-1300c · «ABIERTO» de un PR que ya entró es CADUCADA (foto vieja), no FALSA', () => {
  assert.deepEqual(juzgar({ tipo: 'pr', objeto: 2552, dice: 'abierto' }, consultas()), { veredicto: 'CADUCADA', real: 'MERGED' });
  assert.equal(juzgar({ tipo: 'pr', objeto: 2577, dice: 'abierto' }, consultas()).veredicto, 'BIEN');
});

test('SCRUM-1300c · sha: EMPUJADO pero no en main ≠ EN MAIN; y un commit que no existe es FALSA sólo si se dijo commit', () => {
  const c = consultas();
  assert.equal(juzgar({ tipo: 'sha', objeto: EMPUJADO, dice: 'empujado', commit: true }, c).veredicto, 'BIEN');
  assert.deepEqual(juzgar({ tipo: 'sha', objeto: EMPUJADO, dice: 'en-main', commit: true }, c), { veredicto: 'FALSA', real: 'existe, pero NO está en origin/main' });
  assert.equal(juzgar({ tipo: 'sha', objeto: 'deadbee1', dice: 'en-main', commit: true }, c).veredicto, 'FALSA');
  assert.equal(juzgar({ tipo: 'sha', objeto: 'ed676fd1', dice: 'en-main', commit: false }, c).veredicto, 'NO-ES-COMMIT');
  const soloLocal = consultas({ remoto: [PUNTA], enMain: [PUNTA] });
  assert.equal(juzgar({ tipo: 'sha', objeto: PUNTA, dice: 'empujado', commit: true }, soloLocal).veredicto, 'BIEN');
});

// ═══ La pasada: falsas, ciegos y el control de dentro ═════════════════════════════════════════

test('SCRUM-1300c · 🔴 una memoria con una afirmación falsa sale 1 y la NOMBRA con su sitio', () => {
  const r = medir({ ficheros: fichero('- 1562d #2577 EN MAIN y visto en prod', 'project_s4_traspaso.md'), consultas: consultas(), referencias: REFS });
  assert.equal(r.codigo, SALIDA_FALSAS, r.lineas.join('\n'));
  assert.match(r.lineas.join('\n'), /\| project_s4_traspaso\.md:1 \| #2577 \| EN MAIN \| OPEN \|/);
});

test('SCRUM-1300c · una memoria que se sostiene sale 0, y las caducadas se enseñan sin alarmar', () => {
  const r = medir({ ficheros: fichero('- #2552 EN MAIN\n- #2500 ABIERTO'), consultas: consultas(), referencias: REFS });
  assert.equal(r.codigo, SALIDA_BIEN, r.lineas.join('\n'));
  assert.match(r.lineas[0], /^✅ MEMORIA · 0 afirmación\(es\) FALSA\(S\) · 1 caducada/);
});

test('SCRUM-1300c · 🔴 gh caído: sale 2 y NUNCA «0 falsas», aunque haya falsas que sí vio', () => {
  const r = medir({ ficheros: fichero('- #2577 EN MAIN\n- punta `beef5678` EN MAIN'), consultas: consultas({ ghCaido: true }), referencias: REFS });
  assert.equal(r.codigo, SALIDA_CIEGO, r.lineas.join('\n'));
  assert.match(r.lineas[0], /NO PUDE MIRAR/);
  assert.doesNotMatch(r.lineas.join('\n'), /✅/);
});

test('SCRUM-1300c · 🔴 sin carpeta, sin ficheros, o sin NINGUNA afirmación reconocida: sale 2', () => {
  for (const ficheros of [null, [], fichero('nada que comprobar aquí')]) {
    const r = medir({ ficheros, motivoFicheros: 'no existe', consultas: consultas(), referencias: REFS });
    assert.equal(r.codigo, SALIDA_CIEGO, `${JSON.stringify(ficheros)}\n${r.lineas.join('\n')}`);
  }
});

test('SCRUM-1300c · 🔴 EL CONTROL DE DENTRO: unas consultas que mienten tumban la pasada (sale 2), aunque la memoria «se sostenga»', () => {
  // gh que dice OPEN a todo: el último PR mergeado afirmado ABIERTO saldría BIEN en vez de CADUCADA.
  const todoAbierto = { ...consultas(), estadoPR: () => ({ ok: true, valor: 'OPEN' }) };
  const r = medir({ ficheros: fichero('- #2577 ABIERTO'), consultas: todoAbierto, referencias: REFS });
  assert.equal(r.codigo, SALIDA_CIEGO, r.lineas.join('\n'));
  assert.match(r.lineas.join('\n'), /el CONTROL no cazó 1 de 3/);
  // git que da por existente cualquier sha: el commit inventado no saldría FALSA.
  const todoExiste = { ...consultas(), existe: () => ({ ok: true, valor: true }), enMain: () => ({ ok: true, valor: true }) };
  assert.equal(medir({ ficheros: fichero('- #2577 ABIERTO'), consultas: todoExiste, referencias: REFS }).codigo, SALIDA_CIEGO);
  // Sin referencias para fabricar los testigos, tampoco se afirma nada.
  assert.equal(medir({ ficheros: fichero('- #2577 ABIERTO'), consultas: consultas(), referencias: { ok: false, motivo: 'sin fetch' } }).codigo, SALIDA_CIEGO);
});

test('SCRUM-1300c · los testigos salen de `main` (sus referencias), no de una lista escrita a mano', () => {
  const t = testigos(REFS);
  assert.deepEqual(t.map((x) => [x.objeto, x.dice, x.espera]), [[2500, 'abierto', 'CADUCADA'], [PUNTA, 'en-main', 'BIEN'], [SHA_QUE_NO_EXISTE, 'en-main', 'FALSA']]);
});

test('SCRUM-1300c · la salida dice SIEMPRE lo que no cubre (Jira, la atribución a la pieza equivocada)', () => {
  const r = medir({ ficheros: fichero('- #2552 EN MAIN'), consultas: consultas(), referencias: REFS });
  assert.match(r.lineas.join('\n'), /No cubre: el estado de los tickets en Jira, ni una afirmación que atribuye un hecho a la pieza EQUIVOCADA/);
});

// ═══ La lectura de la carpeta ═══════════════════════════════════════════════════════════════

test('SCRUM-1300c · `leerMemoria`: por defecto MEMORY.md y project_*; con `todo`, también el resto; sin carpeta, el motivo', () => {
  const dir = temporal(`yaqu-1300c-${process.pid}-`);
  fs.writeFileSync(path.join(dir, 'MEMORY.md'), '- índice');
  fs.writeFileSync(path.join(dir, 'project_s5_traspaso.md'), '- estado');
  fs.writeFileSync(path.join(dir, 'feedback_leccion.md'), '- lección');
  fs.writeFileSync(path.join(dir, 'notas.txt'), 'no es memoria');
  assert.deepEqual(leerMemoria(dir).ficheros.map((f) => f.nombre), ['MEMORY.md', 'project_s5_traspaso.md']);
  assert.deepEqual(leerMemoria(dir, { todo: true }).ficheros.map((f) => f.nombre), ['MEMORY.md', 'feedback_leccion.md', 'project_s5_traspaso.md']);
  const no = leerMemoria(path.join(dir, 'no-existe'));
  assert.equal(no.ficheros, null);
  assert.match(no.motivo, /no se puede leer/);
});
