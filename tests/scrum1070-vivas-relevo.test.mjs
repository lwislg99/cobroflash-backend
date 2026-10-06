// tests/scrum1070-vivas-relevo.test.mjs — SCRUM-1070 · `gasto-arranque.mjs vivas`
//
// El subcomando dice a quién le toca el relevo AHORA (el umbral de `sesion.mjs`) y simula cuánto
// bajaría Σcontexto.
//
// DE QUIÉN ES EL NÚMERO, con las dos fechas (SCRUM-1479). Hasta el 6-oct-2026 este fichero decía «umbral del
// fundador, 21-sep: 200k». Lo que consta en `docs/master/SCRUM-1070.md` («1070b») son DOS cosas, y se dicen
// las dos: bajar la A19 de 300k a 200k fue decisión del ORQUESTADOR, y tocar `UMBRAL_CONTEXTO` de `sesion.mjs`
// llevó la autorización escrita del FUNDADOR. Desde el 6-oct-2026 el número es 500k y vive en un solo sitio. Aquí se fija la LÓGICA pura (sin disco): el recorrido real sobre los jsonl se corrió
// en el expediente con su población. Un umbral que no señala a nadie sin decir sobre cuántas sesiones
// miró NO es un verde (A3): cero sesiones da EXIT 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UMBRAL_RELEVO, CTX_TRAS_RELEVO, simularRelevo, resumenDeVivas, informeVivas, ejecutar,
} from '../scripts/equipo/gasto-arranque.mjs';
import { UMBRAL_CONTEXTO } from '../scripts/equipo/sesion.mjs';

const AHORA = Date.parse('2026-09-21T18:00:00Z');
const turnos = (us, ts) => us.map((U) => ({ U, ts }));
const cen = (filas) => ({
  ok: true, rotas: 0,
  pob: { states: filas.length, ilegibles: 0, conJsonl: filas.length, activas: filas.length, incluidas: filas.length, jsonlIlegibles: 0 },
  sesiones: filas.map(([nombre, us, ts]) => ({ nombre, datos: resumenDeVivas(turnos(us, ts)) })),
});
const informe = (filas, o = {}) => informeVivas(cen(filas), { horas: 2, umbral: UMBRAL_RELEVO, simular: null, ahoraMs: AHORA, ...o });

test('SCRUM-1070 · el umbral es el de `sesion.mjs` (500k desde el 6-oct-2026; fue 200k desde el 21-sep-2026) y el arranque tras relevo es un SUPUESTO declarado', () => {
  assert.equal(UMBRAL_RELEVO, 500000);
  assert.equal(CTX_TRAS_RELEVO, 85000);
});

test('SCRUM-1479 · 🔴 un solo sitio manda: `gasto-arranque` no escribe su propio umbral, toma el de `sesion.mjs`', () => {
  assert.equal(UMBRAL_RELEVO, UMBRAL_CONTEXTO);
  // Que hoy valgan lo mismo no basta: dos números iguales escritos a mano divergen el día que se cambia uno.
  const fuente = fs.readFileSync(new URL('../scripts/equipo/gasto-arranque.mjs', import.meta.url), 'utf8');
  assert.match(fuente, /^export const UMBRAL_RELEVO = UMBRAL_CONTEXTO;$/m);
  assert.match(fuente, /^import \{ UMBRAL_CONTEXTO \} from '\.\/sesion\.mjs';$/m);
  // Y la ayuda enseña el que rige, no uno tecleado.
  assert.match(ejecutar([], { env: {}, ahoraMs: AHORA }).texto, new RegExp(`--umbral ${UMBRAL_CONTEXTO}\\]`));
});

test('SCRUM-1070 · simularRelevo: cruza el umbral, reinicia en `arr` y sigue creciendo igual', () => {
  const r = simularRelevo([100000, 150000, 210000, 230000, 250000], 200000, 85000);
  assert.deepEqual(r, { suma: 100000 + 150000 + 85000 + 105000 + 125000, relevos: 1 });
});

test('SCRUM-1070 · simularRelevo CONTROL: sin cruce no cambia nada, y el ÚLTIMO turno no se releva', () => {
  assert.deepEqual(simularRelevo([100000, 150000, 210000], 300000), { suma: 460000, relevos: 0 });
  assert.deepEqual(simularRelevo([100000, 250000], 200000), { suma: 350000, relevos: 0 });
});

test('SCRUM-1070 · vivas: señala RELEVAR desde el umbral (≥), ordena por contexto y sale 1', () => {
  const r = informe([
    ['s-ok', [90000, 120000], '2026-09-21T17:59:00Z'],
    ['s-borde', [150000, 500000], '2026-09-21T17:59:00Z'],
    ['s-alta', [600000, 780000], '2026-09-21T17:58:00Z'],
  ]);
  const l = r.cuerpo.split('\n');
  assert.equal(r.codigo, 1);
  assert.match(l[1], /^s-alta .*RELEVAR/);
  assert.match(l[2], /^s-borde .*RELEVAR/, 'el contexto IGUAL al umbral ya toca relevo');
  assert.match(l[3], /^s-ok .* ok /);
  assert.match(r.cuerpo, /VIVAS 3 · a relevar \(≥ 500000\): 2/);
  assert.match(r.cuerpo, /POBLACION: 3 state\.json/);
});

test('SCRUM-1070 · vivas: nadie pasa del umbral → EXIT 0, y la parada de más de 1 h avisa de caché fría', () => {
  const r = informe([['s-fria', [90000, 120000], '2026-09-21T16:30:00Z']]);
  assert.equal(r.codigo, 0);
  assert.match(r.cuerpo, /parada 90 min: caché fría, RELEVO antes de reanudar/);
  const reciente = informe([['s-viva', [90000, 120000], '2026-09-21T17:55:00Z']]);
  assert.doesNotMatch(reciente.cuerpo, /caché fría/);
});

test('SCRUM-1070 · vivas --simular: declara la simulación, su supuesto y que NO mide eficiencia', () => {
  const r = informe([['s-alta', [100000, 150000, 210000, 230000, 250000], '2026-09-21T17:58:00Z']], { simular: 200000 });
  assert.match(r.cuerpo, /SIMULADO relevo a 200000 sobre estas 1: .*\+1 relevos · arranque tras relevo 85000 SUPUESTO/);
  assert.match(r.cuerpo, /no del coste ni de la eficiencia/);
});

test('SCRUM-1070 · vivas SUELO: cero sesiones (o un directorio ilegible) da EXIT 2, no «nadie pasa del umbral»', () => {
  assert.equal(informe([]).codigo, 2);
  assert.match(informe([]).cuerpo, /NO PUDE MIRAR: cero sesiones/);
  assert.equal(informeVivas({ ok: false, motivo: 'no pude listar X' }, { horas: 2, umbral: 200000, simular: null, ahoraMs: AHORA }).codigo, 2);
  const e = ejecutar(['vivas', '--horas', '2'], { env: { CLAUDE_JOBS_DIR: 'D:/no/existe/yaqu-1070' }, ahoraMs: AHORA });
  assert.equal(e.codigo, 2);
  assert.match(e.texto, /gasto-arranque vivas · EXIT=2/);
});
