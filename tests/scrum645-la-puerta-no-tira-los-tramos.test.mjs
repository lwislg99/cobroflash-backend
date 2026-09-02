// tests/scrum645-la-puerta-no-tira-los-tramos.test.mjs — SCRUM-645
//
// LA PUERTA TIRABA EL DESGLOSE DE ⟦arranque⟧, Y ES LA SEGUNDA VEZ QUE TIRA INFORMACIÓN.
//
// SCRUM-642 partió el arranque en `proceso+ws` y `primera-página` para poder saber DÓNDE se va el
// tiempo en frío. La puerta reproduce la salida cruda del guard **sólo cuando NO sale verde**; para
// los verdes pinta su propia columna con el total. Medido en una tanda real con el tope a 180 s:
// **0 apariciones de `proceso+ws`, 9 de la columna de la puerta.**
//
// Y con el tope subido morir es justo lo que deja de pasar — o sea que el tope alto tapaba la
// información que 642 vino a producir.
//
// ── LOS TRES CONTROLES QUE PIDE EL TICKET ────────────────────────────────────────────────────
//  · guard que MUERE  → sigue volcando su salida cruda EXACTAMENTE como hoy.
//  · guard que PASA   → ahora enseña sus tramos.
//  · el trinquete     → un campo que la tabla no conoce PARA la tanda, en vez de tragárselo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  leerArranque, lineaDeTramos, loQueLaTablaNoSabePintar, TRAMOS_QUE_LA_TABLA_PINTA,
} from '../scripts/guards-visuales.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTA = fs.readFileSync(path.join(RAIZ, 'scripts', 'guards-visuales.mjs'), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL SUELO, y no es adorno: ata al LECTOR con el EMISOR de verdad.
//
// Todo lo demás de este fichero usa cadenas escritas a mano. Si `_navegador.mjs` cambiara el
// formato, esas cadenas seguirían pasando y este guard aprobaría un lector que ya no lee nada.
// Aquí se arranca el de verdad —con un doble, sin navegador— y se le da a la puerta SU salida.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const GUION = `
const doble = {
  launch: () => Promise.resolve({
    waitForTarget: () => Promise.resolve({}),
    close: () => Promise.resolve(),
  }),
};
import('./scripts/_navegador.mjs').then((m) => m.lanzarNavegador(doble));
`;

test('SCRUM-645 · 🔴 SUELO: la puerta entiende la marca que el guard emite DE VERDAD', () => {
  const r = spawnSync(process.execPath, ['-e', GUION], {
    cwd: RAIZ, encoding: 'utf8', env: { ...process.env, EDGE_PATH: process.execPath },
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  assert.match(salida, /⟦arranque⟧/, `🔴 el emisor no dejó marca; el suelo no prueba nada: ${salida}`);

  const a = leerArranque(salida);
  assert.ok(a, '🔴 la puerta no supo leer la marca que el guard acaba de emitir.');
  assert.deepEqual(a.desconocidos, [],
    `🔴 el emisor manda algo que la tabla no sabe pintar: ${JSON.stringify(a.desconocidos)}\n`
    + '  Lector y emisor han divergido. Es justo lo que el trinquete existe para cazar.');
  assert.equal(a.tramos.length, TRAMOS_QUE_LA_TABLA_PINTA.length,
    `🔴 se leyeron ${a.tramos.length} tramos y la tabla dice conocer ${TRAMOS_QUE_LA_TABLA_PINTA.length}.`);
});

// Cadenas de referencia, con la forma exacta que emite `_navegador.mjs` (atada por el suelo).
const COMPLETA = '⟦arranque⟧ 19.6 s COMPLETA · proceso+ws 19.2 s · primera-página 0.4 s';
const CORTADA = '⟦arranque⟧ 30.0 s CORTADA EN «proceso+ws» · proceso+ws ≥30.0 s '
  + '· primera-página SIN MEDIR';

test('SCRUM-645 · 🔴 el guard que PASA enseña sus tramos', () => {
  // Éste es el rojo del ticket: hoy un verde sólo dejaba ver el total.
  const linea = lineaDeTramos(leerArranque(COMPLETA));
  assert.ok(linea, '🔴 no se pinta ninguna línea de tramos para una medida completa.');
  for (const t of TRAMOS_QUE_LA_TABLA_PINTA) {
    assert.ok(linea.includes(t), `🔴 la tabla no enseña el tramo «${t}»: ${linea}`);
  }
  assert.match(linea, /19\.2 s/, `🔴 se pinta el tramo pero no su valor: ${linea}`);
  assert.match(linea, /COMPLETA/, `🔴 no se ve si la medida está completa o cortada: ${linea}`);
});

test('SCRUM-645 · 🔴 y se ve si está CORTADA, y en qué tramo', () => {
  const a = leerArranque(CORTADA);
  assert.equal(a.desenlace, 'CORTADA', '🔴 una medida cortada se lee como completa.');
  assert.equal(a.cortadoEn, 'proceso+ws', `🔴 no se lee en qué tramo se cortó: ${a.cortadoEn}`);
  const linea = lineaDeTramos(a);
  assert.match(linea, /CORTADA EN «proceso\+ws»/, `🔴 la tabla no dice dónde se cortó: ${linea}`);
  assert.match(linea, /≥30\.0 s/,
    `🔴 se pierde la cota inferior: un ≥30,0 pintado como 30,0 vuelve a leerse como duración.`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL TRINQUETE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-645 · 🔴 TRINQUETE: un tramo que la tabla NO conoce hace caer la tanda', () => {
  const conTramoNuevo = '⟦arranque⟧ 19.6 s COMPLETA · proceso+ws 19.2 s · primera-página 0.4 s'
    + ' · conexión-cdp 3.1 s';
  const a = leerArranque(conTramoNuevo);
  assert.ok(a.desconocidos.includes('conexión-cdp 3.1 s'),
    `🔴 un tramo nuevo se ha colado sin que nadie decida enseñarlo: ${JSON.stringify(a)}`);
  assert.equal(loQueLaTablaNoSabePintar([{ g: 'guard:x', marca: a }]).length, 1,
    '🔴 el trinquete no lo denuncia, así que la tanda seguiría en verde con menos información.');
});

test('SCRUM-645 · 🔴 TRINQUETE: también si el DESENLACE es uno que no conoce', () => {
  const a = leerArranque('⟦arranque⟧ 19.6 s PARCIAL · proceso+ws 19.2 s');
  assert.ok(a.desconocidos.length > 0,
    '🔴 un desenlace desconocido se está tragando: la puerta caería al total a secas, que es\n'
    + '  exactamente la columna de un solo número que este ticket viene a quitar.');
});

test('SCRUM-645 · 🔴 CONTROL NEGATIVO: lo que la tabla SÍ conoce no dispara el trinquete', () => {
  // Sin esto, un trinquete que saltara siempre también pasaría las pruebas de arriba.
  for (const linea of [COMPLETA, CORTADA]) {
    const a = leerArranque(linea);
    assert.deepEqual(a.desconocidos, [], `🔴 el trinquete salta con una marca legítima: ${linea}`);
    assert.equal(loQueLaTablaNoSabePintar([{ g: 'guard:x', marca: a }]).length, 0,
      `🔴 el trinquete denunciaría una tanda buena: ${linea}`);
  }
});

test('SCRUM-645 · 🔴 la lista de tramos NO se importa: si se importara, el trinquete no existiría', () => {
  // Si la puerta heredara los tramos de quien los emite, un tramo nuevo entraría aquí solo y
  // este guard no podría saltar nunca. La duplicación es el trinquete.
  assert.match(PUERTA, /export const TRAMOS_QUE_LA_TABLA_PINTA = \[/,
    '🔴 la lista ya no se declara en la puerta.');
  const importaDelNavegador = PUERTA.split('\n')
    .filter((l) => l.includes("from './_navegador.mjs'"))
    .join(' ');
  assert.doesNotMatch(importaDelNavegador, /TRAMO/,
    '🔴 la puerta ha empezado a importar los tramos de `_navegador.mjs`. Entonces un tramo nuevo\n'
    + '  se conocería solo y el trinquete quedaría inerte: exactamente el defecto que cierra.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE YA FUNCIONABA Y NO SE TOCA
// ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-645 · el guard que MUERE sigue volcando su salida cruda, igual que hoy', () => {
  // Anclado al CONTENIDO, no a un número de línea: un merge que mueva el fichero no debe teñir
  // esto de rojo, y una reescritura del volcado sí.
  assert.ok(PUERTA.includes("console.error(f.salida.trimEnd() || '   (sin salida)');"),
    '🔴 se ha tocado el volcado de la salida cruda del guard que no sale verde. Eso ya funcionaba:\n'
    + '  este ticket AÑADE el desglose para los verdes, no cambia lo que hacían los rojos.');
  assert.match(PUERTA, /filas\.filter\(\(x\) => x\.estado !== 'verde'\)/,
    '🔴 ha cambiado quién recibe el volcado crudo.');
});

test('SCRUM-645 · un guard SIN marca no es un fallo: no había nada que tirar', () => {
  assert.equal(leerArranque(''), null, '🔴 se inventa una lectura donde no hay marca.');
  assert.equal(lineaDeTramos(null), null, '🔴 se pinta una línea de tramos vacía.');
  assert.deepEqual(loQueLaTablaNoSabePintar([{ g: 'guard:x', marca: null }]), [],
    '🔴 el trinquete acusa a un guard que no emitió marca. Eso no es tirar información.');
});

test('SCRUM-645 · 🔴 y el trinquete está ENCHUFADO: decidir no basta, hay que parar', () => {
  // Sin esto, alguien puede borrar el bloque que sale con 2 y todos los tests de arriba siguen
  // verdes: `loQueLaTablaNoSabePintar` devolvería la fila y nadie la miraría. La decisión sin la
  // salida es exactamente el defecto de este ticket, un piso más abajo.
  assert.match(PUERTA, /const ciega = loQueLaTablaNoSabePintar\(filas\);/,
    '🔴 la puerta ya no consulta el trinquete.');
  const bloque = PUERTA.slice(PUERTA.indexOf('const ciega = loQueLaTablaNoSabePintar(filas);'));
  const hastaElFinDelIf = bloque.slice(0, bloque.indexOf('\n}\n') + 3);
  assert.match(hastaElFinDelIf, /process\.exit\(SALIDA_NO_ENCONTRADO\)/,
    '🔴 el trinquete detecta y NO para. Una tanda que sigue después de no entender lo que ha\n'
    + '  leído es un verde con menos información, que es lo que este ticket cierra.');
});

test('SCRUM-645 · la puerta sigue sacando el TOTAL, que es lo que ya leía', () => {
  assert.equal(leerArranque(COMPLETA).total, 19.6, '🔴 se ha perdido el total de una completa.');
  assert.equal(leerArranque(CORTADA).total, 30.0, '🔴 se ha perdido el total de una cortada.');
});
