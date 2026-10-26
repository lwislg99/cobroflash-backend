// SCRUM-1610b · UNA SALIDA CORTADA SALE «CIEGO · salida cortada», NUNCA COMO ROJO DEL TEST NI COMO VERDE.
//
// POR QUÉ. El 26-oct-2026 el obligatorio dio tres rojos falsos (`scrum765` y `scrum1516c` ×2; SCRUM-1610
// c.20951): el hijo acabó con su código y la cola de su salida no llegó. Decisión de reparto, c.20952: el hijo
// sale cuando stdout se ha vaciado (en `tests/_censo-frontera.mjs`; el meta-guard es S3) y el lector exige el
// centinela final, relanza UNA vez y, si vuelve a faltar, cae como CIEGO dejando rastro de cada corte.
//
// QUÉ SE PRUEBA, con hijos DE VERDAD: el hijo es la sonda de jv-j6cu
// (`docs/master/evidencias/SCRUM-1610/sonda-salida-cortada.mjs --hijo`), que imprime K líneas y «FIN» y sale
// con `process.exit(0)`; con `--saltar 1` se salta «FIN»: es el corte SEMBRADO, a mano. Tres casos:
//   · cortada las dos veces → CIEGO, con los dos cortes en el rastro;
//   · cortada sólo en el primer intento → pasa, y lo dice;
//   · completa → como hoy: sin relanzar y sin rastro.
// Y la pieza del hijo: en `_censo-frontera.mjs` ninguna salida queda fuera de `fin`, que sale en el callback
// de la escritura del centinela.
// ⚠️ Lo que NO prueba: que `fin` evite el corte. En Windows la tubería es bloqueante y no se reproduce (0 de
// 300, c.20951); medirlo en el runner de Linux pide un workflow (punto 3 de c.20952, no se hace ahora).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sinCortar, sinCortarSync, rastroDeCortes, avisoDeCorte } from './_salida-entera.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SONDA = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-1610', 'sonda-salida-cortada.mjs');
const conFin = (s) => /\nFIN\r?\n$/.test(String(s));

/** Un hijo de la sonda: 40 líneas y «FIN», o sin «FIN» si `saltar`. */
function hijo(saltar) {
  return new Promise((ok) => {
    const h = spawn(process.execPath, [SONDA, '--hijo', '--lineas', '40', '--bytes', '60', '--saltar', saltar ? '1' : '0'],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    let salida = ''; let error;
    h.stdout.on('data', (b) => { salida += b; });
    h.on('error', (e) => { error = e; });
    h.on('close', (codigo) => ok({ codigo, salida, error }));
  });
}

/** Un lanzador que corta en los intentos indicados y cuenta cuántas veces se le llamó. */
function lanzadorQueCorta(...intentosCortados) {
  const l = async () => { l.veces += 1; return hijo(intentosCortados.includes(l.veces)); };
  l.veces = 0;
  return l;
}

test('SCRUM-1610b · la sonda existe y su hijo imprime lo que dice (control de que los casos miden algo)', async () => {
  assert.ok(fs.existsSync(SONDA), `falta la sonda de jv-j6cu en ${path.relative(RAIZ, SONDA)}: sin ella estos casos no tienen hijo`);
  const entera = await hijo(false); const sin = await hijo(true);
  assert.equal(entera.codigo, 0); assert.equal(sin.codigo, 0);
  assert.ok(conFin(entera.salida), 'el hijo completo no trae «FIN»: el centinela de la sonda ya no es ése');
  assert.ok(!conFin(sin.salida), 'el hijo con --saltar 1 trae «FIN»: la siembra no corta');
  assert.ok(sin.salida.split('\n').length > 40, 'el hijo cortado tiene que traer sus 40 líneas: lo cortado es sólo la cola');
});

test('SCRUM-1610b · cortada a mano las dos veces → CIEGO · salida cortada, con los dos cortes en el rastro', async () => {
  const lanzar = lanzadorQueCorta(1, 2);
  const r = await sinCortar(lanzar, conFin);
  console.log('[cortada ×2]' + rastroDeCortes(r.cortes));
  assert.equal(lanzar.veces, 2, 'se relanza UNA vez, ni cero ni más');
  assert.equal(r.cortada, true, 'un corte doble tiene que salir cortado: si no, el lector juzga media salida');
  assert.deepEqual(r.cortes.map((c) => c.intento), [1, 2]);
  assert.ok(r.cortes.every((c) => c.bytes > 0 && c.lineas > 40), 'cada corte dice cuánto llegó');
  const aviso = avisoDeCorte('la sonda', '«FIN»', r);
  assert.match(aviso, /^CIEGO · salida cortada: /);
  assert.match(aviso, /intento 1 \(\d+ B \/ \d+ líneas\), intento 2 \(\d+ B \/ \d+ líneas\)/);
  // Lo mismo por el camino síncrono (el de `scrum765`, con `execFileSync`).
  const rs = sinCortarSync(() => ({ codigo: 0, salida: 'a\nb\n' }), conFin);
  assert.equal(rs.cortada, true); assert.equal(rs.cortes.length, 2);
});

test('SCRUM-1610b · cortada sólo en el primer intento → pasa, y lo dice', async () => {
  const lanzar = lanzadorQueCorta(1);
  const r = await sinCortar(lanzar, conFin);
  const rastro = rastroDeCortes(r.cortes);
  console.log('[cortada ×1]' + rastro);
  assert.equal(lanzar.veces, 2);
  assert.equal(r.cortada, false, 'el relanzamiento llegó entero: se juzga ESA salida');
  assert.ok(conFin(r.salida), 'la salida devuelta es la del intento entero, no la cortada');
  assert.deepEqual(r.cortes.map((c) => c.intento), [1], 'el corte del primer intento queda en el rastro');
  assert.match(rastro, /cortes 1: intento 1 \(\d+ B \/ \d+ líneas\) → el relanzamiento llegó entero/);
});

test('SCRUM-1610b · completa → como hoy: sin relanzar y sin rastro; y un hijo que no acabó NO es un corte', async () => {
  const lanzar = lanzadorQueCorta();
  const r = await sinCortar(lanzar, conFin);
  assert.equal(lanzar.veces, 1); assert.equal(r.cortada, false); assert.deepEqual(r.cortes, []);
  assert.equal(rastroDeCortes(r.cortes), '');
  // Un hijo que no arrancó o que se mató por tiempo (código null) sale tal cual: su error lo juzga el lector.
  let veces = 0;
  const muerto = await sinCortar(async () => { veces += 1; return { codigo: null, salida: '', error: new Error('no acabó') }; }, conFin);
  assert.equal(veces, 1); assert.equal(muerto.cortada, false); assert.equal(muerto.error.message, 'no acabó');
});

// El código sin comentarios: el comentario de `fin` nombra `process.exit` a propósito.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

test('SCRUM-1610b · el censo de frontera sale SIEMPRE por `fin`, que sale cuando el centinela ya se ha escrito', () => {
  const codigo = sinComentarios(fs.readFileSync(path.join(RAIZ, 'tests', '_censo-frontera.mjs'), 'utf8'));
  const def = codigo.match(/const fin = \(c\) => new Promise\(\(\) => \{([^\n]*)\}\);/);
  assert.ok(def, 'no encuentro la definición de `fin` en _censo-frontera.mjs');
  assert.match(def[1], /process\.stdout\.write\('EXIT=' \+ c \+ '\\n', \(\) => process\.exit\(c\)\)/,
    '`fin` ya no sale DENTRO del callback de la escritura del centinela: vuelve a poder perder la cola');
  const salidas = codigo.match(/process\.exit\(/g) || [];
  const llamadas = codigo.match(/await fin\(/g) || [];
  const centinelas = codigo.match(/EXIT=/g) || [];
  console.log(`[_censo-frontera] process.exit( ${salidas.length} (dentro de fin: 1) · await fin( ${llamadas.length} · literales EXIT= ${centinelas.length}`);
  assert.equal(salidas.length, 1, 'hay un `process.exit(` fuera de `fin`: esa salida no espera a que stdout se vacíe');
  assert.equal(centinelas.length, 1, 'hay un `EXIT=` fuera de `fin`: ese centinela no es el que la salida espera');
  assert.ok(llamadas.length >= 2, 'el censo tiene que salir por `fin` en sus salidas de CIEGO y en la del veredicto');
});

// Las mutaciones que TIENEN que tumbar este fichero (catálogo del meta-guard). Cada una apaga una pieza.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Quitar la exigencia del centinela: la media salida se juzga entera y vuelve el rojo engañoso.
    fichero: 'tests/_salida-entera.mjs',
    de: '  return !entera(r.salida, r);',
    a: '  return false;',
    cae: 'cortada a mano las dos veces',
  },
  {
    // No relanzar: el corte de un solo intento vuelve a tumbar el test.
    fichero: 'tests/_salida-entera.mjs',
    de: '    r = await lanzar();',
    a: '    r = { ...r };',
    cae: 'cortada sólo en el primer intento',
  },
  {
    // El hijo vuelve a salir sin esperar a que el centinela se escriba.
    fichero: 'tests/_censo-frontera.mjs',
    de: "process.stdout.write('EXIT=' + c + '\\n', () => process.exit(c));",
    a: "process.stdout.write('EXIT=' + c + '\\n'); process.exit(c);",
    cae: 'el censo de frontera sale SIEMPRE por `fin`',
  },
];
