// tests/scrum388-censo-mecanismo.test.mjs — SCRUM-388
//
// ¿SABE EL CENSO CLASIFICAR? Contra FIXTURES CONGELADOS, no contra `main`.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ CONTRA FIXTURES, Y NO CONTRA LOS TICKETS DE VERDAD
//
// La primera versión de este fichero fijaba los veredictos de cuatro tickets REALES. Funcionaba
// —los cuatro salían bien— y estaba mal, por una regla de la casa que se me pasó:
//
// > **Un test que fija el estado actual convierte un defecto en un requisito.**
//
// «SCRUM-354 → NADA» se pondría rojo **el día que alguien construya A9**, o sea el día que se hace
// el trabajo BIEN, y el siguiente que lo lea tiene delante un test que le exige que A9 siga sin
// empezar. Ya nos pasó con el test que falló cuando el import se ARREGLÓ.
//
// Aquí los cuatro casos se reproducen en un repositorio sintético (`_censo-fixture.mjs`) con sus
// commits, entradas y ramas. Lo que se sostiene es que el censo sabe **clasificar**; eso no puede
// caducar. Lo que hay hoy en `main` lo vigila el centinela, aparte, y sin fijar veredictos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { censarTicket, comprobarSuelo, normalizar, MARCAS_SIN_CONECTAR } from './_censo-tickets.mjs';
import { repoFixture, CASOS, RAMAS_TRAMPA } from './_censo-fixture.mjs';

const RAIZ = repoFixture();
const en = (n) => censarTicket(n, { raiz: RAIZ });

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R3 · SUELO — va PRIMERO, y en este fichero más que en ninguno
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · SUELO: el fixture es medible, o lo de abajo mide sobre nada', () => {
  const problemas = comprobarSuelo({ raiz: RAIZ });
  assert.deepEqual(problemas, [],
    '🔴 el repositorio sintético no es medible:\n   · ' + problemas.join('\n   · ') +
    '\n\n  Sin esto, todos los casos de abajo saldrían NADA y el banco pasaría en verde ' +
    'clasificándolo todo como «no hay trabajo» — el defecto que este censo existe para cazar, ' +
    'cometido por el cazador.');
});

test('SCRUM-388 · SUELO: sin repositorio, el censo lo DICE en vez de devolver cero', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-ciego-'));
  try {
    const problemas = comprobarSuelo({ raiz: tmp });
    assert.ok(problemas.length >= 2,
      `🔴 en un directorio sin git ni docs/master el suelo solo señaló ${problemas.length} problemas. ` +
      'Tiene que quejarse de las DOS fuentes: si una falla en silencio, el censo mide media verdad.');
    assert.ok(problemas.some((p) => /historial/i.test(p)), '🔴 no nombra el historial de git');
    assert.ok(problemas.some((p) => /docs.master/i.test(p)), '🔴 no nombra docs/master');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('SCRUM-388 · SUELO: un `docs/master` que EXISTE pero está casi vacío también se declara', () => {
  // 🔴 HUECO MEDIDO Y CERRADO. El test de arriba usa un directorio que no existe, así que cae por
  // el `catch` de «no se pudo leer» y **el umbral de entradas no lo ejercitaba nadie**: se podía
  // desactivar entero con la suite en verde. Lo destapó una prueba de rojo que salió VERDE.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-flaco-'));
  try {
    fs.mkdirSync(path.join(tmp, 'docs', 'master'), { recursive: true });
    for (const n of [1, 2, 3]) fs.writeFileSync(path.join(tmp, 'docs', 'master', `SCRUM-${n}.md`), '# x');
    const problemas = comprobarSuelo({ raiz: tmp });
    assert.ok(problemas.some((p) => /docs.master.*3 entradas/i.test(p)),
      `🔴 con docs/master presente pero con 3 entradas, el suelo no se queja del umbral. Devolvió: ${JSON.stringify(problemas)}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R1 · EL BANCO — ENTERO / PARCIAL / PARCIAL / NADA, sobre los cuatro casos reproducidos
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · R1: los cuatro casos que nos mordieron, reproducidos y clasificados', () => {
  const fallos = [];
  for (const c of CASOS) {
    const r = en(c.n);
    if (r.veredicto !== c.espera) {
      fallos.push(`SCRUM-${c.n} (${c.imita}): esperaba ${c.espera} y sale ${r.veredicto} · fuentes=[${r.fuentes}] · ${r.porque}`);
    }
  }
  assert.deepEqual(fallos, [],
    '🔴 el mecanismo no clasifica los cuatro casos del banco:\n   · ' + fallos.join('\n   · '));
});

test('SCRUM-388 · los TRES veredictos ocurren de verdad (y no sale todo igual)', () => {
  // Sin esto, un mecanismo que devolviera siempre «PARCIAL» acertaría dos de cuatro y el de arriba
  // señalaría solo los otros dos, que se lee como un ajuste fino y no como que no distingue nada.
  const salidas = new Set(CASOS.map((c) => en(c.n).veredicto));
  assert.equal(salidas.size, 3, `🔴 el censo solo produce ${[...salidas].join('/')}: no distingue los tres estados`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R2 · EL QUE MÁS IMPORTA · lo que NO es evidencia
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · R2: un ticket inexistente da NADA, sin reventar y sin falso positivo', () => {
  for (const n of [99999, 9999]) {
    const r = en(n);
    assert.equal(r.veredicto, 'NADA', `🔴 SCRUM-${n} no existe y sale «${r.veredicto}»`);
    assert.deepEqual(r.fuentes, [], `🔴 le ha encontrado fuentes a un ticket inventado: [${r.fuentes}]`);
    assert.match(r.porque, /ninguna evidencia/i, '🔴 el veredicto NADA tiene que decir POR QUÉ');
  }
});

test('SCRUM-388 · R2: UN MECANISMO PARECIDO NO ES EVIDENCIA — el caso A9', () => {
  // El corazón del ticket. En el fixture, `SCRUM-9100` es un ciclo entero con su commit y su rama
  // —el A15/MANT-1 sintético— y `SCRUM-9004` es el A9 que no se construyó. Se parecen; no son.
  const a9 = en(9004);
  assert.equal(a9.veredicto, 'NADA',
    `🔴 SCRUM-9004 sale «${a9.veredicto}» habiendo al lado un mecanismo que se le parece. Así es ` +
    'exactamente como se dio A9 por cerrada: alguien midió A15/MANT-1, construido un mes antes de ' +
    `que el ticket existiera. Fuentes que le atribuyó: [${a9.fuentes}]`);
  // Y el positivo que impide que esto pase por ser todo NADA: el parecido SÍ tiene lo suyo.
  assert.equal(en(9100).veredicto, 'ENTERO', '🔴 el mecanismo parecido tampoco se ve: el caso no probaría nada');
});

test('SCRUM-388 · R2: una referencia cruzada en el CUERPO no cuenta como entrega', () => {
  // En el fixture hay un commit de SCRUM-9100 cuyo cuerpo dice «Relacionado con SCRUM-9004». Eso
  // dice «esto tiene que ver con aquello», no «aquello se construyó aquí».
  assert.deepEqual(en(9004).commits, [],
    '🔴 un commit de otro ticket que menciona al 9004 en su cuerpo se está contando como entrega suya');
});

test('SCRUM-388 · R2: el número no se contagia entre tickets vecinos', () => {
  // Las ramas trampa del fixture (`…-rebasada-2`, `codeowners-zona-roja-v2`) llevan números que no
  // son suyos. Antes, buscar el número suelto le daba cinco ramas ajenas a SCRUM-2.
  for (const n of [900, 90, 2]) {
    const r = en(n);
    assert.equal(r.veredicto, 'NADA',
      `🔴 SCRUM-${n} sale «${r.veredicto}» heredando de un vecino: commits=${r.commits.map((c) => c.sha).join(',')} ramas=${r.ramas.join(',')}`);
  }
  assert.ok(RAMAS_TRAMPA.length >= 2 && en(9001).ramas.length >= 1,
    '🔴 o no hay ramas trampa en el fixture, o el filtro se pasó de estricto y ya no ve las buenas');
});

test('SCRUM-388 · una entrada que no es un número LANZA, no devuelve NADA', () => {
  // «NADA» significa «medí y no había». Un número inválido no se ha medido, y devolver NADA lo
  // haría indistinguible de un ticket sin trabajo — el mismo silencio de siempre.
  for (const mal of ['abc', '', '298; rm -rf /', '-1', null, undefined]) {
    assert.throws(() => en(mal), /número de ticket inválido/,
      `🔴 «${mal}» no lanzó: un input basura no puede leerse como «no hay trabajo»`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R4 · ROMPE UNA FUENTE Y EL RESULTADO LO NOMBRA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · R4: el veredicto declara SUS FUENTES, y las tres del caso ENTERO están', () => {
  // Un veredicto sin su evidencia es una opinión. Fijar las tres hace que romper cualquiera de los
  // buscadores cambie el resultado NOMBRANDO la que se perdió.
  const r = en(9001);
  assert.equal(r.veredicto, 'ENTERO');
  for (const fuente of ['commits', 'docs/master', 'ramas']) {
    assert.ok(r.fuentes.includes(fuente),
      `🔴 el caso ENTERO ha perdido la fuente «${fuente}» (le quedan: [${r.fuentes}]). Si el buscador ` +
      'de esa fuente se rompe, el censo baja de veredicto sin que nadie sepa cuál dejó de mirar.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL LECTOR · que sepa leer su propia fuente
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-388 · lee frases partidas entre líneas de BLOCKQUOTE', () => {
  // 🔴 CASO REAL congelado en el fixture (`SCRUM-9003`). En `SCRUM-294.md` «sin llamadores» cruza
  // dos líneas de blockquote; colapsar espacios sin quitar el «>» deja «sin > llamadores» y el
  // censo daba ENTERO a una entrega que se declara incompleta.
  assert.equal(en(9003).veredicto, 'PARCIAL',
    '🔴 no ve la marca cuando cruza un blockquote: dará ENTERO a entregas parciales');
  const conBlockquote = '> probado y sin\n> llamadores.';
  assert.match(normalizar(conBlockquote), /sin llamadores/);
  // Hermano positivo: que el caso reproduzca el defecto de verdad.
  assert.doesNotMatch(conBlockquote.replace(/\s+/g, ' '), /sin llamadores/,
    '🔴 el caso ya no reproduce el defecto: sin el paso del «>» también casaría y esto no probaría nada');
});

test('SCRUM-388 · SUELO de las marcas: la lista está declarada y se usa', () => {
  assert.ok(MARCAS_SIN_CONECTAR.length >= 2, '🔴 la lista de marcas se ha quedado vacía: nada saldría PARCIAL');
  const r = en(9002);
  assert.ok(r.marcas.length >= 1,
    '🔴 sale PARCIAL sin poder decir por qué marca. Un veredicto que no señala la frase que lo causó ' +
    'no se puede comprobar ni discutir.');
  assert.ok(r.marcas.every((m) => MARCAS_SIN_CONECTAR.includes(m)),
    '🔴 hay marcas fuera de la lista declarada: la detección se ha vuelto un detector de tono');
});
