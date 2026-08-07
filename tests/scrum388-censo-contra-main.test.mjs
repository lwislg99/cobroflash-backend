// tests/scrum388-censo-contra-main.test.mjs — SCRUM-388
//
// EL CENSO DEL TRABAJO QUE ESTÁ EN `main` SIN ENTRADA EN JIRA.
//
// No es higiene: el 7-ago-2026 esto mordió TRES VECES en un día y de tres formas distintas, y esas
// tres son el banco de pruebas de aquí abajo porque se midieron a mano y se sabe la respuesta.
//
// ⚠️ ALCANCE: esto MIDE, no arregla Jira. No toca ningún ticket. Y no lee Jira: primero tiene que
// saber medir `main`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { censarTicket, comprobarSuelo, normalizar, MARCAS_SIN_CONECTAR } from './_censo-tickets.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * EL BANCO DE PRUEBAS — los tres casos que nos mordieron, con su respuesta medida a mano.
 *
 * El tercero es el que da valor al ticket: SCRUM-354 no tiene NADA construido, pero una nota
 * afirmaba que estaba cerrado porque alguien midió A15/MANT-1 (`d9fbd3c`, 6-JULIO, un mes antes de
 * que el ticket existiera) y le pareció el mismo mecanismo. Comparten el modelo y no comparten el
 * objeto.
 */
const BANCO = [
  { n: 298, espera: 'ENTERO', porque: 'entregado en `7f9220d` (Luis, 7-ago 11:52) mientras Jira decía «Tareas por hacer»' },
  { n: 293, espera: 'PARCIAL', porque: 'A2: dominio con tests, sin llamadores, sin UI (PR #520)' },
  { n: 294, espera: 'PARCIAL', porque: 'A3: igual que A2 (PR #523)' },
  { n: 354, espera: 'NADA', porque: 'A9: nada construido; el parecido con A15/MANT-1 no es evidencia' },
];

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R3 · SUELO — va PRIMERO, y en este fichero más que en ninguno
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · SUELO: el censo sabe leer sus dos fuentes, o falla declarándose ciego', () => {
  const problemas = comprobarSuelo({ raiz: RAIZ });
  assert.deepEqual(problemas, [],
    '🔴 EL CENSO NO PUEDE MIRAR:\n   · ' + problemas.join('\n   · ') +
    '\n\n  Y ésta es la peor forma de fallar que tiene ESTE fichero en concreto: un censo que no ' +
    'sabe mirar devuelve «no hay trabajo pendiente», que es exactamente lo que devuelve un censo ' +
    'con todo en orden. Es el defecto que este ticket existe para cazar, cometido por el cazador.');
});

test('SCRUM-388 · SUELO: sin repositorio, el suelo lo DICE en vez de devolver cero', () => {
  // Se prueba de verdad, no se razona: directorio temporal sin git y sin docs/master.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-ciego-'));
  try {
    const problemas = comprobarSuelo({ raiz: tmp });
    assert.ok(problemas.length >= 2,
      `🔴 en un directorio sin git ni docs/master el suelo solo señaló ${problemas.length} problemas. ` +
      'Tiene que quejarse de las DOS fuentes: si una falla en silencio, el censo mide media verdad.');
    assert.ok(problemas.some((p) => /historial/i.test(p)), '🔴 no nombra el historial de git');
    assert.ok(problemas.some((p) => /docs.master/i.test(p)), '🔴 no nombra docs/master');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('SCRUM-388 · SUELO: un `docs/master` que EXISTE pero está casi vacío también se declara', () => {
  // 🔴 HUECO MEDIDO Y CERRADO. El test de arriba usa un directorio que no existe, así que el suelo
  // cae por el `catch` de «no se pudo leer» y **el umbral de entradas no lo ejercitaba nadie**: se
  // podía desactivar entero y la suite seguía verde. Lo destapó la prueba de rojo, que salió VERDE.
  //
  // Y los dos casos no son el mismo: «la carpeta no está» es un error de ruta; «la carpeta está y
  // tiene tres ficheros» es un árbol a medio clonar o un `docs/master` recién movido — el censo
  // mediría contra casi nada y devolvería «no hay entradas de máster» con total aplomo.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-flaco-'));
  try {
    fs.mkdirSync(path.join(tmp, 'docs', 'master'), { recursive: true });
    for (const n of [1, 2, 3]) fs.writeFileSync(path.join(tmp, 'docs', 'master', `SCRUM-${n}.md`), '# x');
    const problemas = comprobarSuelo({ raiz: tmp });
    assert.ok(problemas.some((p) => /docs.master.*3 entradas/i.test(p)),
      '🔴 con `docs/master` presente pero con 3 entradas, el suelo no se queja del umbral. ' +
      `Problemas devueltos: ${JSON.stringify(problemas)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R1 · EL BANCO — ENTERO / PARCIAL / PARCIAL / NADA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · R1: los cuatro casos medidos a mano dan su veredicto', () => {
  const fallos = [];
  for (const c of BANCO) {
    const r = censarTicket(c.n, { raiz: RAIZ });
    if (r.veredicto !== c.espera) {
      fallos.push(`SCRUM-${c.n}: esperaba ${c.espera} y sale ${r.veredicto} — ${c.porque} · fuentes=[${r.fuentes}] · ${r.porque}`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 el mecanismo no reproduce el banco medido a mano:\n   · ' + fallos.join('\n   · ') +
    '\n\n  Si falla uno, el mecanismo no sirve todavía: estos cuatro son los únicos casos de los ' +
    'que conocemos la respuesta con certeza.');
});

test('SCRUM-388 · los TRES veredictos ocurren de verdad (y no sale todo igual)', () => {
  // Sin esto, un mecanismo que devolviera siempre «PARCIAL» pasaría dos de los cuatro y el de
  // arriba señalaría solo los otros dos, que se leería como un ajuste fino en vez de como que el
  // mecanismo no distingue nada.
  const salidas = new Set(BANCO.map((c) => censarTicket(c.n, { raiz: RAIZ }).veredicto));
  assert.equal(salidas.size, 3, `🔴 el censo solo produce ${[...salidas].join('/')}: no distingue los tres estados`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R2 · EL QUE MÁS IMPORTA · un ticket que NO existe
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · R2: un ticket inexistente da NADA, sin reventar y sin falso positivo', () => {
  const r = censarTicket(99999, { raiz: RAIZ });
  assert.equal(r.veredicto, 'NADA', `🔴 SCRUM-99999 no existe y sale «${r.veredicto}»`);
  assert.deepEqual(r.fuentes, [], `🔴 le ha encontrado fuentes a un ticket inventado: [${r.fuentes}]`);
  assert.match(r.porque, /ninguna evidencia/i, '🔴 el veredicto NADA tiene que decir POR QUÉ');
});

test('SCRUM-388 · R2: el número no se contagia entre tickets vecinos', () => {
  // 🔴 MEDIDO Y CORREGIDO. Antes, buscar el número suelto en los nombres de rama le daba a
  // SCRUM-2 cinco ramas ajenas (`…-rebasada-2`, `codeowners-zona-roja-v2`), y un commit de
  // SCRUM-8 que lo mencionaba en el cuerpo. SCRUM-2 salía ENTERO con evidencia de otros.
  for (const n of [2, 29]) {
    const r = censarTicket(n, { raiz: RAIZ });
    assert.equal(r.veredicto, 'NADA',
      `🔴 SCRUM-${n} sale «${r.veredicto}» heredando evidencia de un ticket vecino: ` +
      `commits=${r.commits.map((c) => c.sha).join(',')} ramas=${r.ramas.join(',')}`);
  }
  // Y el positivo que impide que lo de arriba pase por ser todo NADA: el 298 sí tiene las suyas.
  assert.ok(censarTicket(298, { raiz: RAIZ }).ramas.length >= 1,
    '🔴 el filtro de ramas se ha pasado de estricto y ya no ve ni las del 298');
});

test('SCRUM-388 · una entrada que no es un número LANZA, no devuelve NADA', () => {
  // «NADA» significa «medí y no había». Un número inválido no se ha medido, y devolver NADA lo
  // haría indistinguible de un ticket sin trabajo — el mismo silencio de siempre.
  for (const mal of ['abc', '', '298; rm -rf /', '-1', null, undefined]) {
    assert.throws(() => censarTicket(mal, { raiz: RAIZ }), /número de ticket inválido/,
      `🔴 «${mal}» no lanzó: un input basura no puede leerse como «no hay trabajo»`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R4 · ROMPE UNA FUENTE Y EL RESULTADO LO NOMBRA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · R4: el veredicto declara SUS FUENTES, y las tres del 298 están', () => {
  // Un veredicto sin su evidencia es una opinión. Aquí se fija que el 298 se sostiene sobre las
  // tres, para que romper cualquiera cambie el resultado NOMBRANDO la que se perdió.
  const r = censarTicket(298, { raiz: RAIZ });
  assert.equal(r.veredicto, 'ENTERO');
  for (const fuente of ['commits', 'docs/master', 'ramas']) {
    assert.ok(r.fuentes.includes(fuente),
      `🔴 SCRUM-298 ha perdido la fuente «${fuente}» (le quedan: [${r.fuentes}]). Si el buscador de ` +
      'esa fuente se rompe, el censo baja de veredicto sin que nadie sepa cuál dejó de mirar.');
  }
  assert.ok(r.commits.some((c) => c.sha.startsWith('7f9220d')),
    `🔴 no encuentra el commit que ENTREGÓ el 298 (7f9220d): ${r.commits.map((c) => c.sha).join(',') || 'ninguno'}`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL LECTOR · que sepa leer su propia fuente
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · la normalización lee frases partidas entre líneas de blockquote', () => {
  // 🔴 CASO REAL, y por poco pasa. En `SCRUM-294.md` «sin llamadores» cruza dos líneas de
  // blockquote, así que colapsar espacios sin quitar el «>» deja «sin > llamadores» y el censo
  // daba ENTERO a una entrega que se declara a sí misma incompleta.
  const conBlockquote = '> se entrega el cálculo, probado y sin\n> llamadores. Enchufarlo toca…';
  assert.match(normalizar(conBlockquote), /sin llamadores/,
    '🔴 el normalizador no lee frases que cruzan un blockquote: dará ENTERO a entregas parciales');
  // Hermano positivo: que la aserción de arriba pueda fallar de verdad.
  assert.doesNotMatch(conBlockquote.replace(/\s+/g, ' '), /sin llamadores/,
    '🔴 el caso ya no reproduce el defecto: sin el paso del «>» también casaría, y este test no probaría nada');
});

test('SCRUM-388 · SUELO de las marcas: la lista está declarada y se usa', () => {
  assert.ok(MARCAS_SIN_CONECTAR.length >= 2, '🔴 la lista de marcas se ha quedado vacía: nada saldría PARCIAL');
  const r = censarTicket(293, { raiz: RAIZ });
  assert.ok(r.marcas.length >= 1,
    '🔴 SCRUM-293 sale PARCIAL sin poder decir por qué marca. Un veredicto que no señala la frase ' +
    'que lo causó no se puede comprobar ni discutir.');
  assert.ok(r.marcas.every((m) => MARCAS_SIN_CONECTAR.includes(m)),
    '🔴 hay marcas fuera de la lista declarada: la detección se ha vuelto un detector de tono');
});
