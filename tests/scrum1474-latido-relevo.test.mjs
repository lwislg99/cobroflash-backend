// SCRUM-1474 · EL LATIDO SABE QUE UN PUESTO FUE RELEVADO, Y NO LO LLAMA «CONTESTADA».
//
// El 6-oct-2026 el cementerio sacaba 25 preguntas «sin contestar» y SESIONES decía «nadie vuelve» de un PR
// cuyo puesto tenía a otra sesión trabajando en él. El orquestador contesta relanzando el puesto, y a una
// sesión que ya salió no se le puede contestar.
//
// LO QUE SE MIDIÓ ANTES DE CONSTRUIR, y por qué esto no hace lo primero que se pidió: sobre 299 trabajos, las
// 31 preguntas en el aire tenían TODAS una sesión posterior de su puesto, y las ocho del 27 al 29-sep por las
// que nació el cementerio, también. «Hay relevo» sale siempre: no puede apagar un aviso. Así que el relevo
// PLIEGA la salida (un renglón por puesto) y la marca `contestada`, ahora por puesto entero, es lo único que
// la apaga. Donde sí hay un identificador duro —un PR tiene número y rama— se mira si al relevo se le ha dicho.
//
// Sólo lo PURO: ni `gh` ni el registro de trabajos de la máquina se tocan aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seccionSesiones, seccionCementerio, preguntasDelLibro, actualizarLibro, marcarPuesto, relevosDe, loQueLeDijeron,
  nombraElPR, ordenDeMarcar, esElHueco, salidaDe, LIMITE_DE_RELEVADA, SALIDA_AVISO, SALIDA_OK,
} from '../scripts/equipo/latido.mjs';

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El relevo vuelve a apagar el aviso: es el criterio que el 1-oct habría callado las ocho preguntas.
    fichero: 'scripts/equipo/latido.mjs',
    de: "  const sinContestar = sinRelevo.length + noSeSabe.length + relevadas.length;",
    a: "  const sinContestar = sinRelevo.length + noSeSabe.length; alertas.length = sinContestar;",
    cae: 'SCRUM-1474 · 🔴 EL CONTROL: las ocho preguntas por las que nació el cementerio tenían relevo, y SIGUEN siendo aviso',
  },
  {
    // «Trabaja alguien en el puesto» basta para callar el PR, sepa o no que es suyo.
    fichero: 'scripts/equipo/latido.mjs',
    de: "    const avisado = sabe.find((x) => x.nombra === true);",
    a: "    const avisado = sabe[0];",
    cae: 'SCRUM-1474 · 🔴 su relevo trabaja pero nadie le ha dicho que el PR es suyo: SIGUE siendo aviso, con ese texto',
  },
  {
    // Un relevo que ya no trabaja cuenta como que alguien vuelve.
    fichero: 'scripts/equipo/latido.mjs',
    de: "        if (r.estado === 'working' && !enElPuesto.includes(r)) enElPuesto.push(r);",
    a: "        if (!enElPuesto.includes(r)) enElPuesto.push(r);",
    cae: 'SCRUM-1474 · NEGATIVO: un relevo que ya no trabaja, uno de OTRO puesto y uno ANTERIOR no son «alguien vuelve»',
  },
  {
    // No poder leer lo que se le dijo se cuenta como «no se lo han dicho».
    fichero: 'scripts/equipo/latido.mjs',
    de: "      : sabe.some((x) => x.nombra === undefined) ? `en su puesto trabaja ${relevo} y NO PUDE LEER",
    a: "      : false ? `en su puesto trabaja ${relevo} y NO PUDE LEER",
    cae: 'SCRUM-1474 · 🔴 FAIL-CLOSED: si no se puede leer qué se le dijo al relevo, se dice «no pude leer», ni «lo sabe» ni «no lo sabe»',
  },
  {
    // La marca por puesto se lleva también las preguntas de otros puestos.
    fichero: 'scripts/equipo/latido.mjs',
    de: "    if (a.contestada || puestoDe(a.nombre) !== puesto || !(a.desde <= cuando)) continue;",
    a: "    if (a.contestada || !(a.desde <= cuando)) continue;",
    cae: 'SCRUM-1474 · la marca por PUESTO apaga las de ese puesto, sólo las de ese puesto, y no borra ninguna del libro',
  },
  {
    // Una pregunta sin puesto reconocible se da por relevada.
    fichero: 'scripts/equipo/latido.mjs',
    de: "  if (puesto === null || !Number.isFinite(desde)) return null;",
    a: "  if (!Number.isFinite(desde)) return null;",
    cae: 'SCRUM-1474 · los tres cubos: SIN RELEVO y NO SE PUEDE SABER de una en una, RELEVADA plegada por puesto',
  },
  {
    // Un número a secas vale como «nombra el PR».
    fichero: 'scripts/equipo/latido.mjs',
    de: "new RegExp(`(?:#|pull/)${Number(numero)}(?!\\\\d)`)",
    a: "new RegExp(`${Number(numero)}`)",
    cae: 'SCRUM-1474 · «nombrar el PR» es su número ESCRITO COMO PR o su rama entera; un número a secas no vale',
  },
];

const AHORA = Date.parse('2026-10-06T13:00:00Z');
const H = 36e5;
let n = 0;
/** Una sesión del registro. `hace` y `arranco`, en horas antes de AHORA. */
const sesion = (nombre, estado, { hace = 1, arranco = hace + 1, needs, ramas = [], dicho } = {}) => ({
  id: `id${String(++n).padStart(4, '0')}`, nombre, estado, needs, actualizado: AHORA - hace * H, creado: AHORA - arranco * H, ramas, dicho,
});
const ramasDe = (s) => s.ramas;
const dichoA = (s) => s.dicho;
const ROJO = [{ numero: 2209, rama: 'scrum-1465b-frases-del-envio', causa: 'ROJO-OBLIGATORIO' }];

// ── el relevo ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1474 · el relevo es una sesión POSTERIOR del MISMO puesto; sin puesto o sin fecha no se puede saber', () => {
  const vieja = sesion('s4-6oct', 'blocked', { hace: 3, arranco: 4 });
  const b = sesion('s4-6octb', 'done', { hace: 1, arranco: 2 });
  const c = sesion('s4-6octc', 'working', { hace: 0, arranco: 1 });
  const antes = sesion('s4-5oct', 'done', { hace: 20, arranco: 24 });
  const otra = sesion('s1-6octd', 'working', { hace: 0, arranco: 1 });
  const sinFecha = { ...sesion('s4-6octz', 'working'), creado: undefined };
  const todas = [c, otra, vieja, antes, sinFecha, b];
  const r = relevosDe({ id: vieja.id, nombre: vieja.nombre, desde: vieja.actualizado }, todas);
  assert.deepEqual(r.map((s) => s.nombre), ['s4-6octb', 's4-6octc'], 'de la más vieja a la más nueva, sin ella misma, sin otro puesto, sin la anterior, sin la que no tiene fecha');
  assert.deepEqual(relevosDe({ nombre: 's3-6oct', desde: AHORA }, todas), []);
  assert.equal(relevosDe({ nombre: 'prueba-954', desde: vieja.actualizado }, todas), null);
  assert.equal(relevosDe({ nombre: 's4-6oct', desde: undefined }, todas), null);
});

// ── SESIONES: «nadie vuelve» ──────────────────────────────────────────────────────────────────

test('SCRUM-1474 · SUELO: sin nadie en el puesto, el PR rojo de una sesión que ya no trabaja sigue saliendo como «nadie vuelve»', () => {
  const s = seccionSesiones({ sesiones: [sesion('s1-6octc', 'done', { ramas: [ROJO[0].rama] })], filasPR: ROJO, ramasDe, dichoA, ahora: AHORA });
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /s1-6octc \(id\d+, done\) ya NO trabaja y el PR #2209, cuya rama scrum-1465b-frases-del-envio EMPUJÓ, sigue ROJO-OBLIGATORIO: nadie vuelve$/);
});

test('SCRUM-1474 · EL CASO del 6-oct: el relevo del puesto TRABAJA y su encargo nombra el PR → no es aviso, y se dice quién y desde cuándo', () => {
  const duena = sesion('s1-6octc', 'done', { hace: 1, arranco: 2, ramas: [ROJO[0].rama] });
  const relevo = sesion('s1-6octd', 'working', { hace: 0, arranco: 0.5, dicho: 'tu rojo es el de #2209: cayó scrum1349' });
  const s = seccionSesiones({ sesiones: [duena, relevo], filasPR: ROJO, ramasDe, dichoA, ahora: AHORA });
  assert.deepEqual(s.alertas, []);
  assert.match(s.poblacion, /1 PR de una sesión que ya no trabaja lo lleva el relevo de su puesto, que TRABAJA y a quien se le ha nombrado \(#2209 → s1-6octd, arrancó 2026-10-06T12:30Z\)/);
  assert.match(s.poblacion, /eso dice que lo sabe, no que lo vaya a arreglar/);
  // Nombrarlo por su rama vale igual.
  const porRama = seccionSesiones({ sesiones: [duena, { ...relevo, dicho: 'sigue en scrum-1465b-frases-del-envio' }], filasPR: ROJO, ramasDe, dichoA, ahora: AHORA });
  assert.deepEqual(porRama.alertas, []);
  // Y un PR sin veredicto se trata igual que uno rojo.
  const sinVeredicto = [{ ...ROJO[0], causa: 'SIN-VEREDICTO' }];
  assert.deepEqual(seccionSesiones({ sesiones: [duena, relevo], filasPR: sinVeredicto, ramasDe, dichoA, ahora: AHORA }).alertas, []);
  assert.match(seccionSesiones({ sesiones: [duena], filasPR: sinVeredicto, ramasDe, dichoA, ahora: AHORA }).alertas[0].linea, /si sale rojo, nadie vuelve$/);
});

test('SCRUM-1474 · 🔴 su relevo trabaja pero nadie le ha dicho que el PR es suyo: SIGUE siendo aviso, con ese texto', () => {
  const duena = sesion('s1-6octc', 'done', { hace: 1, arranco: 2, ramas: [ROJO[0].rama] });
  const relevo = sesion('s1-6octd', 'working', { hace: 0, arranco: 0.5, dicho: 'sigue con SCRUM-1445 y con el #2131' });
  const s = seccionSesiones({ sesiones: [duena, relevo], filasPR: ROJO, ramasDe, dichoA, ahora: AHORA });
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /sigue ROJO-OBLIGATORIO: en su puesto trabaja s1-6octd \(arrancó 2026-10-06T12:30Z\), pero ni su encargo ni ningún mensaje que haya recibido nombran el #2209 ni su rama: nadie le ha dicho que es suyo$/);
  assert.doesNotMatch(s.alertas[0].linea, /nadie vuelve/);
  assert.doesNotMatch(s.poblacion, /lo lleva el relevo/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1474 · 🔴 FAIL-CLOSED: si no se puede leer qué se le dijo al relevo, se dice «no pude leer», ni «lo sabe» ni «no lo sabe»', () => {
  const duena = sesion('s1-6octc', 'done', { hace: 1, arranco: 2, ramas: [ROJO[0].rama] });
  for (const [caso, dicho] of [['transcript ilegible', undefined], ['sin encargo ni mensajes', null]]) {
    const relevo = sesion('s1-6octd', 'working', { hace: 0, arranco: 0.5, dicho });
    const s = seccionSesiones({ sesiones: [duena, relevo], filasPR: ROJO, ramasDe, dichoA, ahora: AHORA });
    assert.equal(s.alertas.length, 1, caso);
    assert.match(s.alertas[0].linea, /en su puesto trabaja s1-6octd \(arrancó 2026-10-06T12:30Z\) y NO PUDE LEER qué se le ha dicho: no sé si sabe que es suyo$/, caso);
    assert.doesNotMatch(s.alertas[0].linea, /nadie le ha dicho|nadie vuelve/, caso);
  }
  // Quien no pasa `dichoA` (el hook de arranque) tampoco convierte el silencio en «lo sabe».
  const sinLector = seccionSesiones({ sesiones: [duena, sesion('s1-6octd', 'working', { hace: 0, arranco: 0.5 })], filasPR: ROJO, ramasDe, ahora: AHORA });
  assert.match(sinLector.alertas[0].linea, /NO PUDE LEER/);
});

test('SCRUM-1474 · NEGATIVO: un relevo que ya no trabaja, uno de OTRO puesto y uno ANTERIOR no son «alguien vuelve»', () => {
  const duena = sesion('s1-6octc', 'done', { hace: 1, arranco: 2, ramas: [ROJO[0].rama] });
  const lo = 'es tuyo el #2209';
  const casos = {
    'el relevo ya terminó': sesion('s1-6octd', 'done', { hace: 0, arranco: 0.5, dicho: lo }),
    'el relevo está bloqueado': sesion('s1-6octd', 'blocked', { hace: 0, arranco: 0.5, dicho: lo }),
    'trabaja otro puesto': sesion('s2-6octd', 'working', { hace: 0, arranco: 0.5, dicho: lo }),
    'trabaja una anterior del puesto': sesion('s1-6octb', 'working', { hace: 0, arranco: 5, dicho: lo }),
  };
  for (const [caso, otra] of Object.entries(casos)) {
    const s = seccionSesiones({ sesiones: [duena, otra], filasPR: ROJO, ramasDe, dichoA, ahora: AHORA });
    assert.match(s.alertas.map((a) => a.linea).join('\n'), /el PR #2209, cuya rama scrum-1465b-frases-del-envio EMPUJÓ, sigue ROJO-OBLIGATORIO: nadie vuelve/, caso);
  }
});

test('SCRUM-1474 · «nombrar el PR» es su número ESCRITO COMO PR o su rama entera; un número a secas no vale', () => {
  const pr = { numero: 2209, rama: 'scrum-1465b-frases-del-envio' };
  for (const si of ['mira el #2209', 'https://github.com/o/r/pull/2209', 'la rama scrum-1465b-frases-del-envio sigue roja', '(#2209)']) assert.equal(nombraElPR(si, pr), true, si);
  for (const no of ['SCRUM-2209', 'a las 2209 líneas', '#22090', '#220', 'pull/22091', 'scrum-1465b', '']) assert.equal(nombraElPR(no, pr), false, no);
  assert.equal(nombraElPR(undefined, pr), undefined);
  assert.equal(nombraElPR(null, pr), undefined);
});

test('SCRUM-1474 · lo que a una sesión LE HAN DICHO: su encargo y los mensajes de otras sesiones — no lo que ella leyó por su cuenta', () => {
  const linea = (o) => JSON.stringify(o);
  const jsonl = [
    linea({ type: 'user', isMeta: true, message: { content: 'Base directory for this skill: #1111' } }),
    linea({ type: 'user', isSidechain: true, message: { content: 'encargo de un subagente: #2222' } }),
    linea({ type: 'user', isSidechain: false, message: { content: [{ type: 'text', text: 'ERES LA SESIÓN 1. Tu rojo es el #2209.' }] } }),
    linea({ type: 'assistant', message: { content: [{ type: 'text', text: 'he visto el #3333 al listar los PR' }] } }),
    linea({ type: 'user', message: { content: [{ type: 'tool_result', content: 'gh pr list → #4444' }] } }),
    linea({ type: 'user', message: { content: 'segundo mensaje de una persona: #5555' } }),
    linea({ type: 'attachment', attachment: { type: 'queued_command', prompt: '<cross-session-message from="x">y también el #6666</cross-session-message>' } }),
    linea({ type: 'queue-operation', content: '<cross-session-message>#7777</cross-session-message>' }),
    '{ esto no es json',
  ].join('\n');
  const dicho = loQueLeDijeron(jsonl);
  assert.match(dicho, /#2209/);
  assert.match(dicho, /#6666/);
  for (const ajeno of ['#1111', '#2222', '#3333', '#4444', '#5555', '#7777']) assert.doesNotMatch(dicho, new RegExp(ajeno), ajeno);
  assert.equal(loQueLeDijeron(linea({ type: 'assistant', message: { content: 'nada' } })), null);
  assert.equal(loQueLeDijeron(''), null);
});

// ── CEMENTERIO: los cubos y la marca ──────────────────────────────────────────────────────────

/** Las ocho del 27 al 29-sep, con los relevos que de verdad tuvieron (nombre y horas hasta el relevo). */
const LAS_OCHO = [
  ['s0-27c', 's0-29a'], ['s4-28d', 's4-28e'], ['s4-28e', 's4-29a'], ['s4-29a', 's4-29b'],
  ['s3-29b', 's3-29c'], ['s3-29c', 's3-29e'], ['s5-29e', 's5-1oct'], ['s4-29c', 's4-1oct'],
];

test('SCRUM-1474 · 🔴 EL CONTROL: las ocho preguntas por las que nació el cementerio tenían relevo, y SIGUEN siendo aviso', () => {
  const el1oct = Date.parse('2026-10-01T12:00:00Z');
  const sesiones = []; const libro = {};
  LAS_OCHO.forEach(([vieja, relevo], i) => {
    const desde = el1oct - (96 - i * 6) * H;
    const id = `muerta${i}`;
    sesiones.push({ id, nombre: vieja, estado: 'stopped', actualizado: desde + H, creado: desde - H });
    libro[id] = { nombre: vieja, needs: `pregunta ${i}`, desde };
    sesiones.push({ id: `relevo${i}`, nombre: relevo, estado: 'done', actualizado: desde + 20 * H, creado: desde + 10 * H });
  });
  const c = seccionCementerio({ sesiones, libro, ahora: el1oct });
  assert.equal(preguntasDelLibro({ sesiones, libro, ahora: el1oct }).filter((f) => f.cubo === 'RELEVADA').length, 8, 'SUELO: las ocho tienen relevo, que es lo que se midió');
  assert.equal(c.pudo, true);
  assert.equal(salidaDe([c]), SALIDA_AVISO, 'con relevo y sin marca, el cementerio AVISA: el relevo no contesta nada');
  assert.match(c.poblacion, /8 pregunta\(s\) sin contestar .*: 0 SIN RELEVO · 8 RELEVADA\(S\) sin marcar, plegadas en 4 puesto\(s\) · 0 que NO SE PUEDE SABER/);
  assert.equal(c.alertas.length, 4, 'ocho preguntas de cuatro puestos (s0, s3, s4, s5) son cuatro renglones, no ocho');
  assert.ok(c.poblacion.includes(LIMITE_DE_RELEVADA));
  assert.equal(LIMITE_DE_RELEVADA, 'RELEVADA = el puesto siguió con otra sesión; NO dice que la pregunta se contestara');
});

test('SCRUM-1474 · los tres cubos: SIN RELEVO y NO SE PUEDE SABER de una en una, RELEVADA plegada por puesto', () => {
  const sesiones = [
    sesion('s2-2oct', 'blocked', { hace: 96, needs: 'renew QA session cookie' }),
    sesion('s4-2oct', 'blocked', { hace: 96, needs: 'close SCRUM-1374' }),
    sesion('s4-29a', 'blocked', { hace: 170, needs: 'approve the two texts for SCRUM-1266' }),
    sesion('s4-2octb', 'done', { hace: 90, arranco: 95.5 }),
    sesion('prueba-954', 'blocked', { hace: 50, needs: 'no sé de quién soy' }),
    sesion('s2-1oct', 'working', { hace: 100, arranco: 120 }),
  ];
  const c = seccionCementerio({ sesiones, libro: null, ahora: AHORA });
  const cubos = Object.fromEntries(preguntasDelLibro({ sesiones, libro: null, ahora: AHORA }).map((f) => [f.nombre, f.cubo]));
  assert.deepEqual(cubos, { 's4-29a': 'RELEVADA', 's4-2oct': 'RELEVADA', 's2-2oct': 'SIN RELEVO', 'prueba-954': 'NO SE PUEDE SABER' });
  assert.match(c.poblacion, /4 pregunta\(s\) sin contestar .*: 1 SIN RELEVO · 2 RELEVADA\(S\) sin marcar, plegadas en 1 puesto\(s\) · 1 que NO SE PUEDE SABER · 0 de hoy/);
  assert.equal(c.alertas.length, 3);
  const [sinRelevo, noSeSabe, plegada] = c.alertas.map((a) => a.linea);
  assert.match(sinRelevo, /^s2-2oct \(id\d+\) · hace 4\.0 días · espera: renew QA session cookie$/);
  assert.match(noSeSabe, /^prueba-954 \(id\d+\) · hace 2\.1 días · espera: no sé de quién soy · NO SE PUEDE SABER si su puesto siguió: su nombre no dice de qué puesto es$/);
  assert.match(plegada, /^s4 · 2 pregunta\(s\) RELEVADA\(S\) y SIN MARCAR \(la más vieja de hace 7\.1 días, la más nueva de hace 4\.0 días\) · la más nueva es de s4-2oct y su puesto siguió con s4-2octb \(2026-10-02T13:30Z\)/);
  // La orden que las marca y la que las enseña, ENTERAS y listas para pegar.
  assert.ok(plegada.includes('si ya están despachadas → node scripts/equipo/latido.mjs contestada s4 "<dónde está la respuesta>"'));
  assert.ok(plegada.includes('para leerlas enteras → node scripts/equipo/latido.mjs preguntas s4'));
  assert.equal(ordenDeMarcar(4), 'node scripts/equipo/latido.mjs contestada s4 "<dónde está la respuesta>"');
  // Sin ninguna relevada, la frase del límite no se añade: no hay nada que matizar.
  assert.ok(!seccionCementerio({ sesiones: [sesiones[0]], libro: null, ahora: AHORA }).poblacion.includes(LIMITE_DE_RELEVADA));
});

test('SCRUM-1474 · la orden impresa lleva un hueco, y pegada SIN rellenar no marca nada', () => {
  const hueco = /"(.*)"$/.exec(ordenDeMarcar(4))[1];
  assert.equal(hueco, '<dónde está la respuesta>');
  assert.equal(esElHueco(hueco), true);
  assert.equal(esElHueco('  <dónde está la respuesta>  '), true);
  assert.equal(esElHueco('encargo de s4-6octb, 6-oct 11:21Z'), false);
  assert.equal(esElHueco('SCRUM-1428 c.18370 <firmado>'), false);
});

test('SCRUM-1474 · la marca por PUESTO apaga las de ese puesto, sólo las de ese puesto, y no borra ninguna del libro', () => {
  const sesiones = [
    sesion('s4-2oct', 'blocked', { hace: 96, needs: 'close SCRUM-1374' }),
    sesion('s4-29a', 'blocked', { hace: 170, needs: 'approve the two texts' }),
    sesion('s4-6octc', 'working', { hace: 0, arranco: 1 }),
    sesion('s5-2octf', 'blocked', { hace: 92, needs: 'go ahead to fix ya-esta' }),
    sesion('s5-6oct', 'done', { hace: 2, arranco: 3 }),
  ];
  const libro = actualizarLibro({}, sesiones);
  assert.equal(Object.keys(libro).length, 3, 'SUELO: las tres preguntas están apuntadas');
  const antes = seccionCementerio({ sesiones, libro, ahora: AHORA });
  assert.deepEqual(antes.alertas.map((a) => a.sesion), ['s4', 's5']);

  const m = marcarPuesto(libro, 4, { cuando: AHORA, donde: 'encargo de s4-6octc, 6-oct 12:00Z' });
  assert.equal(m.marcadas.length, 2);
  assert.deepEqual(Object.keys(m.libro).sort(), Object.keys(libro).sort(), 'ninguna sale del libro');
  for (const id of m.marcadas) {
    assert.deepEqual(m.libro[id].contestada, { cuando: AHORA, donde: 'encargo de s4-6octc, 6-oct 12:00Z' });
    assert.equal(m.libro[id].needs, libro[id].needs, 'la pregunta sigue escrita');
  }
  assert.equal(libro[m.marcadas[0]].contestada, undefined, 'y el libro de entrada no se toca');
  const despues = seccionCementerio({ sesiones, libro: m.libro, ahora: AHORA });
  assert.deepEqual(despues.alertas.map((a) => a.sesion), ['s5'], 's4 deja de avisar; s5, que nadie marcó, sigue');
  assert.match(despues.poblacion, /1 pregunta\(s\) sin contestar .* · 2 marcada\(s\) como contestadas \(siguen en el libro\)/);

  // Volver a marcar no marca nada, y una pregunta POSTERIOR a la marca no queda contestada por adelantado.
  assert.equal(marcarPuesto(m.libro, 4, { cuando: AHORA, donde: 'otra vez' }).marcadas.length, 0);
  assert.equal(marcarPuesto(libro, 4, { cuando: AHORA - 100 * H, donde: 'antes de la de hace 96 h' }).marcadas.length, 1);
  // Y si la misma sesión pregunta OTRA cosa, la marca era de la anterior: vuelve a avisar.
  const otra = sesiones.map((s) => (s.nombre === 's4-2oct' ? { ...s, needs: 'y ahora otra pregunta' } : s));
  const conOtra = seccionCementerio({ sesiones: otra, libro: actualizarLibro(m.libro, otra), ahora: AHORA });
  assert.deepEqual(conOtra.alertas.map((a) => a.sesion), ['s4', 's5']);
  assert.match(conOtra.alertas[0].linea, /^s4 · 1 pregunta\(s\) RELEVADA\(S\) y SIN MARCAR/);
});

test('SCRUM-1474 · una bloqueada de HOY con relevo lleva la orden en su renglón, y una vez marcada no se repite en SESIONES', () => {
  const sesiones = [
    sesion('s4-6oct', 'blocked', { hace: 2.5, needs: 'choose between A, B, C, D for ticket 1428' }),
    sesion('s4-6octb', 'done', { hace: 1, arranco: 1.65 }),
    sesion('s3-6oct', 'blocked', { hace: 1, needs: 'sin relevo todavía' }),
  ];
  const libro = actualizarLibro({}, sesiones);
  const s = seccionSesiones({ sesiones, filasPR: [], libro, ahora: AHORA });
  assert.equal(s.alertas.length, 2);
  assert.ok(s.alertas[0].linea.endsWith('· su puesto ya tiene relevo (s4-6octb, arrancó 2026-10-06T11:21Z): si la respuesta fue en su encargo, apúntalo → node scripts/equipo/latido.mjs contestada s4 "<dónde está la respuesta>"'), s.alertas[0].linea);
  assert.match(s.alertas[1].linea, /^s3-6oct \(id\d+\) BLOQUEADA hace 60 min · espera: sin relevo todavía$/, 'sin relevo no hay orden que ofrecer');
  // El relevo NO la quita: la quita la marca.
  const marcado = marcarPuesto(libro, 4, { cuando: AHORA, donde: 'encargo de s4-6octb' }).libro;
  const d = seccionSesiones({ sesiones, filasPR: [], libro: marcado, ahora: AHORA });
  assert.deepEqual(d.alertas.map((a) => a.sesion), ['s3-6oct']);
  assert.match(d.poblacion, /1 bloqueada\(s\) de hoy con su pregunta marcada «contestada» \(no se repiten aquí; siguen en el libro\)/);
  // Sin libro (el hook de arranque no lo pasa) todo sigue saliendo: no marcar nunca calla.
  assert.equal(seccionSesiones({ sesiones, filasPR: [], ahora: AHORA }).alertas.length, 2);
  // Y con todo marcado, las dos secciones quedan limpias.
  const todo = marcarPuesto(marcado, 3, { cuando: AHORA, donde: 'mensaje a s3' }).libro;
  assert.equal(salidaDe([seccionSesiones({ sesiones, filasPR: [], libro: todo, ahora: AHORA }), seccionCementerio({ sesiones, libro: todo, ahora: AHORA })]), SALIDA_OK);
});
