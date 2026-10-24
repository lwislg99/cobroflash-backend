// tests/scrum1554c-puerta-de-go-live.test.mjs — SCRUM-1554c
//
// LA PUERTA DE GO-LIVE (`docs/go-live/puerta.json`): lo que tiene que ser verdad antes de encender
// INVOICING_ES_ENABLED para el primer negocio real en España (regla 43; SCRUM-1554 c.19645).
//
// 🔴 UNA ENTRADA NUNCA SE BORRA: se cierra con «cerrada: {por, motivo, sha, fecha}». Una puerta de la
// que se pueden quitar renglones no es una puerta. Por eso este guard DECLARA cuántas entradas existen
// (TOTAL) y cuáles están cerradas (CERRADAS), y cae en los dos sentidos:
//   · una entrada que desaparece, o una cerrada sin su motivo → rojo;
//   · una entrada nueva, o una cerrada que aquí no se declara → rojo, hasta que el mismo cambio suba
//     TOTAL o añada su número a CERRADAS. Así el diff dice CUÁL salió, y su motivo está en la lista.
//
// LO QUE ESTO NO HACE: impedir que se encienda el interruptor. Se enciende por la variable de entorno
// de Railway o por `merchants.flags` en la BD, y ninguno de los dos pasa por la CI. Ver la cabecera de
// `scripts/go-live/puerta.mjs` y la mitad B de `docs/master/SCRUM-1554.md` § SCRUM-1554c.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { temporal } from './_temporal.mjs'; // SCRUM-864 · el temporal se borra pase lo que pase
import { juzgarPuerta, leerPuerta, recuento, PUERTA, SALIDA_LIBRE, SALIDA_ABIERTAS, SALIDA_NO_PUDE } from '../scripts/go-live/puerta.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(RAIZ, 'scripts', 'go-live', 'puerta.mjs');

// Cuántas entradas tiene la puerta. Sube con cada entrada nueva; NUNCA baja.
const TOTAL = 24;
// Las cerradas, una por línea. Sólo crece: una entrada cerrada no se reabre sin decirlo aquí.
const CERRADAS = [
  2,
  3,
  4,
  7,
  8,
  14,
];

// ── la lista de verdad ──────────────────────────────────────────────────────

test('SCRUM-1554c · la puerta de verdad se lee, tiene su forma y cuadra con lo declarado', () => {
  const r = leerPuerta();
  assert.ok(!r.motivo, `🔴 NO PUDE LEER la puerta: ${r.motivo}`);
  assert.deepEqual(juzgarPuerta(r.doc, { total: TOTAL, cerradas: CERRADAS }), []);
});

// ── los rojos, fabricados: cada uno es una forma de vaciar la puerta sin que se note ──

/** Una puerta pequeña y bien formada: 1 abierta, 2 cerrada, 3 abierta. */
function puertaDePrueba() {
  return {
    entradas: [
      { numero: 1, que: 'uno', de_donde: 'SCRUM-1', consta_en: 'aquí', estado: 'abierta' },
      { numero: 2, que: 'dos', de_donde: 'SCRUM-2', consta_en: 'aquí', estado: 'cerrada', cerrada: { por: 'S5', motivo: 'arreglado en #1', sha: 'abcdef1', fecha: '2026-10-19' } },
      { numero: 3, que: 'tres', de_donde: 'SCRUM-3', consta_en: 'aquí', estado: 'abierta' },
    ],
  };
}
const DE_PRUEBA = { total: 3, cerradas: [2] };

test('SCRUM-1554c · CONTROL: la puerta de prueba, intacta, da cero fallos', () => {
  assert.deepEqual(juzgarPuerta(puertaDePrueba(), DE_PRUEBA), []);
});

test('SCRUM-1554c · 🔴 BORRAR la última entrada cae y nombra cuál falta', () => {
  const d = puertaDePrueba();
  d.entradas.pop();
  const f = juzgarPuerta(d, DE_PRUEBA);
  assert.ok(f.some((x) => /faltan 1 entrada\(s\) \(3\)/.test(x) && /NUNCA se borra/.test(x)), f.join('\n'));
});

test('SCRUM-1554c · 🔴 BORRAR una del medio cae aunque se renumere el resto', () => {
  const d = puertaDePrueba();
  d.entradas.splice(1, 1);
  d.entradas[1].numero = 2;
  const f = juzgarPuerta(d, DE_PRUEBA);
  assert.ok(f.some((x) => /faltan 1 entrada/.test(x)), f.join('\n'));
  assert.ok(f.some((x) => /el guard da por cerrada la entrada 2 y la lista no/.test(x)), f.join('\n'));
});

test('SCRUM-1554c · 🔴 un HUECO en la numeración cae', () => {
  const d = puertaDePrueba();
  d.entradas[2].numero = 4;
  const f = juzgarPuerta(d, DE_PRUEBA);
  assert.ok(f.some((x) => /lleva el número 4 y le toca el 3/.test(x)), f.join('\n'));
});

test('SCRUM-1554c · 🔴 CERRAR sin motivo, sin quién o sin sha cae', () => {
  for (const quitar of ['motivo', 'por', 'sha']) {
    const d = puertaDePrueba();
    delete d.entradas[1].cerrada[quitar];
    const f = juzgarPuerta(d, DE_PRUEBA);
    assert.ok(f.some((x) => /la entrada 2 está cerrada sin/.test(x)), `sin ${quitar}: ${f.join('\n')}`);
  }
  const d = puertaDePrueba();
  d.entradas[1].cerrada.sha = 'ya está';
  assert.ok(juzgarPuerta(d, DE_PRUEBA).some((x) => /sin un sha que se pueda buscar/.test(x)));
});

test('SCRUM-1554c · 🔴 CERRAR una entrada sin declararlo en el guard cae (el diff tiene que decir cuál)', () => {
  const d = puertaDePrueba();
  d.entradas[0].estado = 'cerrada';
  d.entradas[0].cerrada = { por: 'S5', motivo: 'arreglado', sha: '1234567', fecha: '2026-10-19' };
  const f = juzgarPuerta(d, DE_PRUEBA);
  assert.ok(f.some((x) => /la entrada 1 está cerrada y el guard no lo declara/.test(x)), f.join('\n'));
});

test('SCRUM-1554c · 🔴 REABRIR una cerrada sin decirlo cae', () => {
  const d = puertaDePrueba();
  d.entradas[1].estado = 'abierta';
  delete d.entradas[1].cerrada;
  const f = juzgarPuerta(d, DE_PRUEBA);
  assert.ok(f.some((x) => /el guard da por cerrada la entrada 2 y la lista no/.test(x)), f.join('\n'));
});

test('SCRUM-1554c · 🔴 una entrada NUEVA sin subir TOTAL cae, y dice a cuánto subirlo', () => {
  const d = puertaDePrueba();
  d.entradas.push({ numero: 4, que: 'cuatro', de_donde: 'SCRUM-4', consta_en: 'aquí', estado: 'abierta' });
  const f = juzgarPuerta(d, DE_PRUEBA);
  assert.ok(f.some((x) => /sube TOTAL a 4/.test(x)), f.join('\n'));
});

test('SCRUM-1554c · 🔴 una entrada sin «que», un estado inventado o una abierta con «cerrada» caen', () => {
  const a = puertaDePrueba();
  a.entradas[0].que = '  ';
  assert.ok(juzgarPuerta(a, DE_PRUEBA).some((x) => /la entrada 1 no dice «que»/.test(x)));
  const b = puertaDePrueba();
  b.entradas[0].estado = 'aparcada';
  assert.ok(juzgarPuerta(b, DE_PRUEBA).some((x) => /estado que no es/.test(x)));
  const c = puertaDePrueba();
  c.entradas[0].cerrada = { por: 'x', motivo: 'y', sha: 'abcdef1', fecha: '2026-10-19' };
  assert.ok(juzgarPuerta(c, DE_PRUEBA).some((x) => /está abierta y lleva «cerrada»/.test(x)));
});

test('SCRUM-1554c · 🔴 algo que no es la lista NO pasa por una lista vacía', () => {
  assert.deepEqual(juzgarPuerta(null, DE_PRUEBA), ['la lista no tiene «entradas»: no es la puerta']);
  assert.deepEqual(juzgarPuerta({ entradas: 'ninguna' }, DE_PRUEBA), ['la lista no tiene «entradas»: no es la puerta']);
});

// ── la línea de órdenes: 0 libre · 1 abiertas · 2 NO PUDE (nunca un 0 por no poder leer) ──

function correr(fichero) {
  const entorno = { ...process.env };
  delete entorno.FORCE_COLOR;
  delete entorno.NODE_OPTIONS;
  delete entorno.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [CLI, ...(fichero ? [fichero] : [])], { encoding: 'utf8', env: entorno });
}

test('SCRUM-1554c · la línea de órdenes sale 1 con la puerta de verdad y lista las abiertas', () => {
  const p = correr();
  const { abiertas } = recuento(leerPuerta(PUERTA).doc);
  assert.equal(p.status, abiertas.length ? SALIDA_ABIERTAS : SALIDA_LIBRE, p.stdout + p.stderr);
  assert.match(p.stdout, new RegExp(`PUERTA DE GO-LIVE · ${abiertas.length} abierta\\(s\\) de ${TOTAL}`));
});

test('SCRUM-1554c · 🔴 una lista que no existe o no es JSON sale 2 y dice NO PUDE MIRAR, nunca 0', () => {
  const dir = temporal(`yaqu-1554c-${process.pid}-`);
  const roto = path.join(dir, 'rota.json');
  fs.writeFileSync(roto, '{ esto no es json');
  for (const f of [path.join(dir, 'no-existe.json'), roto]) {
    const p = correr(f);
    assert.equal(p.status, SALIDA_NO_PUDE, p.stdout + p.stderr);
    assert.match(p.stdout, /NO PUDE MIRAR/);
    assert.match(p.stdout, /no es «puerta libre»/);
  }
});

test('SCRUM-1554c · CONTROL: una lista con todo cerrado sale 0', () => {
  const dir = temporal(`yaqu-1554c-${process.pid}-`);
  const f = path.join(dir, 'libre.json');
  const d = puertaDePrueba();
  for (const e of d.entradas) { e.estado = 'cerrada'; e.cerrada = { por: 'S5', motivo: 'm', sha: 'abcdef1', fecha: '2026-10-19' }; }
  fs.writeFileSync(f, JSON.stringify(d));
  const p = correr(f);
  assert.equal(p.status, SALIDA_LIBRE, p.stdout + p.stderr);
  assert.match(p.stdout, /0 abierta\(s\) de 3/);
});
