// tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs — SCRUM-1327
//
// Sin gate: ni BD, ni red, ni navegador. Lee `scripts/` por AST y ejecuta funciones puras.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN GUARD NO DECIDE CON QUÉ SALE, NI CUÁNDO DEJA DE MIRAR
//
// SCRUM-904 arregló en UN guard el orden entre «ciego» y «hallazgo», y la regla se quedó en ese
// fichero. SCRUM-1320 la sacó a `veredictoDe` y censó quién seguía decidiendo a mano. Quedaban seis,
// con DOS defectos distintos, y los dos se han visto ocurrir con el navegador de verdad
// (`docs/master/evidencias/scrum1327/`, antes y después):
//
//   GRUPO ① · caja-datos-del-cliente, caja-documento-suelto, portal-en-la-ficha
//       Al primer caso ciego SALÍAN (o cortaban el bucle). Un ciego a 929 px y, detrás, un rótulo que
//       no cabe a 390 px → salida 2, y del rótulo ni una palabra: no se tapaba, NO SE MEDÍA.
//   GRUPO ② · aviso-bizum, vias-de-cobro, firma-con-tramos
//       Con 0 hallazgos y todos los casos ciegos salían con 1: el mismo número que «he medido y está mal».
//
// Lo que este fichero fija:
//   ① el recorrido (`recorrerCasos`): un caso ciego NO corta los de después — con el ciego DELANTE;
//   ② los seis salen sólo por `veredictoDe`, y los tres del grupo ① recorren con `recorrerCasos`;
//   ③ el lector (`comoSale`) ve las formas en que un guard decide por su cuenta, y dice «no lo sé»
//      cuando no lo sabe;
//   ④ el censo: ningún guard sale a mano fuera de los declarados, con sus dos mitades. Es lo que
//      impide la séptima vez — y dice en su salida, en cada pasada, lo que NO mira.
//
// ⚠️ LÍMITE de ②, dicho aquí y no sólo en el registro: que los seis llamen a `recorrerCasos` y a
// `veredictoDe` se comprueba por AST; que el caso real los ponga ciegos y los vea salir bien sólo lo
// prueba el navegador, y ese banco (`rojo-en-navegador.mjs`) no corre en `npm test`.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  veredictoDe, recorrerCasos, SALIDA_VERDE, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR,
} from '../scripts/_hallazgos-y-ciegos.mjs';
import { comoSale, censoDeSalidas, defectosDe, SALEN_A_MANO, LIMITES_DE_COMO_SALE } from './_salidas-de-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_SCRIPTS = path.join(RAIZ, 'scripts');
const leerGuard = (f) => fs.readFileSync(path.join(DIR_SCRIPTS, f), 'utf8');

const GRUPO_1 = ['guard-caja-datos-del-cliente.mjs', 'guard-caja-documento-suelto.mjs', 'guard-portal-en-la-ficha.mjs'];
const GRUPO_2 = ['guard-aviso-bizum.mjs', 'guard-vias-de-cobro.mjs', 'guard-firma-con-tramos.mjs'];

// ── ① EL RECORRIDO ─────────────────────────────────────────────────────────────────────────────

/** Un juez de mentira: cada caso trae escritas sus dos cuentas, o lanza. Apunta a quién le preguntaron. */
function juezDe(preguntados) {
  return async (caso) => {
    preguntados.push(caso.nombre);
    if (caso.lanza) throw new Error(caso.lanza);
    return { hallazgos: caso.hallazgos || [], ciegos: caso.ciegos || [] };
  };
}
const nombrar = (caso) => caso.nombre;

test('SCRUM-1327 · GRUPO ① · el caso que se vio: un ciego DELANTE no impide medir el hallazgo de detrás', async () => {
  // El orden importa y es el del defecto: el ciego va PRIMERO. Con el hallazgo delante, un bucle
  // que corta al primer ciego también lo habría apuntado, y el caso no probaría nada.
  const casos = [
    { nombre: '929 px', ciegos: ['929 px: el sidebar computa 0 px'] },
    { nombre: '390 px', hallazgos: ['390 px: la nota no cabe'] },
  ];
  const preguntados = [];
  const r = await recorrerCasos(casos, juezDe(preguntados), nombrar);
  assert.deepEqual(preguntados, ['929 px', '390 px'], 'el caso de DESPUÉS del ciego se tiene que medir');
  assert.deepEqual(r.hallazgos, ['390 px: la nota no cabe'], 'el hallazgo de detrás del ciego llega a existir');
  assert.deepEqual(r.ciegos, ['929 px: el sidebar computa 0 px']);
  const v = veredictoDe(r);
  assert.equal(v.codigo, SALIDA_HALLAZGO, 'antes del arreglo esto salía con 2 y sin el hallazgo');
  assert.equal(v.estado, 'HALLAZGO Y CIEGO');
  assert.match(v.linea, /1 hallazgo · 1 ciego\b/);
});

test('SCRUM-1327 · GRUPO ① · un caso que LANZA es un ciego de ese caso, y los de después se miden', async () => {
  const casos = [
    { nombre: 'SIN token', lanza: 'Execution context was destroyed' },
    { nombre: 'CON token', hallazgos: ['con token alguna de las dos ha dejado de pintarlo'] },
  ];
  const preguntados = [];
  const r = await recorrerCasos(casos, juezDe(preguntados), nombrar);
  assert.deepEqual(preguntados, ['SIN token', 'CON token']);
  assert.equal(r.ciegos.length, 1);
  assert.match(r.ciegos[0], /^SIN token: no se pudo medir — Execution context was destroyed$/, 'el ciego dice QUÉ caso y POR QUÉ');
  assert.equal(r.hallazgos.length, 1);
  assert.equal(veredictoDe(r).codigo, SALIDA_HALLAZGO);
});

test('SCRUM-1327 · GRUPO ② · sólo ciegos sale por CIEGO (2), no por hallazgo (1)', async () => {
  // Las cuentas del caso visto en `guard-aviso-bizum`: la ranura del aviso no existe en ninguno de
  // los cuatro casos. Antes del arreglo ese guard salía con 1.
  const casos = ['sin · sin', 'sin · con', 'con · sin', 'con · con'].map((n) => ({ nombre: n, ciegos: [n + ': no existe input[name=bizumPhone]'] }));
  const r = await recorrerCasos(casos, juezDe([]), nombrar);
  assert.equal(r.hallazgos.length, 0);
  assert.equal(r.ciegos.length, 4);
  const v = veredictoDe(r);
  assert.equal(v.codigo, SALIDA_NO_SUPE_MEDIR, '0 hallazgos y N ciegos NO es un rojo: es «no supe medir»');
  assert.match(v.linea, /0 hallazgos · 4 ciegos/);
});

test('SCRUM-1327 · CONTROL POSITIVO de los dos grupos: con hallazgos sigue saliendo 1, y limpio sigue saliendo 0', async () => {
  const conHallazgos = await recorrerCasos([{ nombre: 'a', hallazgos: ['a: no cabe'] }, { nombre: 'b' }], juezDe([]), nombrar);
  assert.deepEqual([conHallazgos.hallazgos.length, conHallazgos.ciegos.length], [1, 0]);
  assert.equal(veredictoDe(conHallazgos).codigo, SALIDA_HALLAZGO, 'un defecto real no puede pasar a «no medido»');
  assert.equal(veredictoDe(conHallazgos).estado, 'HALLAZGO');

  const limpio = await recorrerCasos([{ nombre: 'a' }, { nombre: 'b' }], juezDe([]), nombrar);
  assert.deepEqual([limpio.hallazgos.length, limpio.ciegos.length, limpio.recorridos], [0, 0, 2]);
  assert.equal(veredictoDe(limpio).codigo, SALIDA_VERDE);
});

test('SCRUM-1327 · SUELO del recorrido: cero casos es un ciego, y un caso sin cuentas lanza', async () => {
  // Sin esto, un guard cuya lista de casos se quedara vacía saldría con «0 hallazgos · 0 ciegos»: verde.
  const vacio = await recorrerCasos([], juezDe([]), nombrar);
  assert.equal(vacio.recorridos, 0);
  assert.equal(vacio.ciegos.length, 1);
  assert.equal(veredictoDe(vacio).codigo, SALIDA_NO_SUPE_MEDIR);
  // Un juez que no devuelve sus dos listas no ha juzgado: no es un caso limpio.
  // El último es el que muerde: una FRASE en vez de una lista se esparciría letra a letra, y «no cabe»
  // contaría como siete hallazgos sin que nada lanzase.
  for (const malo of [undefined, null, {}, { hallazgos: [] }, { ciegos: [] }, { hallazgos: 0, ciegos: 0 }, { hallazgos: 'no cabe', ciegos: [] }]) {
    await assert.rejects(() => recorrerCasos([{ nombre: 'a' }], async () => malo, nombrar), TypeError, 'devolvió ' + JSON.stringify(malo));
  }
  // El control de que `rejects` no pasa por cualquier cosa: la forma buena no lanza.
  assert.equal((await recorrerCasos([{ nombre: 'a' }], async () => ({ hallazgos: [], ciegos: [] }), nombrar)).recorridos, 1);
});

// ── ② LOS SEIS ─────────────────────────────────────────────────────────────────────────────────

/** Las llamadas del fuente que cumplen `es`. Por AST: los comentarios de estos guards nombran lo mismo al explicarse. */
function llamadas(fuente, es) {
  const sf = ts.createSourceFile('guard.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let n = 0;
  const ver = (nodo) => {
    if (ts.isCallExpression(nodo) && es(nodo, sf)) n += 1;
    ts.forEachChild(nodo, ver);
  };
  ver(sf);
  return n;
}
const llamaA = (fuente, nombre) => llamadas(fuente, (n) => ts.isIdentifier(n.expression) && n.expression.text === nombre);
/** `console.log(… veredictoFinal.linea …)`: la línea de las dos cuentas, dicha por el camino VERDE. */
const diceSusCuentasEnVerde = (fuente) => llamadas(fuente, (n, sf) => n.expression.getText(sf) === 'console.log'
  && n.arguments.some((a) => /\bveredictoFinal\.linea\b/.test(a.getText(sf))));

test('SCRUM-1327 · los seis salen SÓLO por `veredictoDe`, y los tres del grupo ① recorren con `recorrerCasos`', () => {
  for (const f of [...GRUPO_1, ...GRUPO_2]) {
    const r = comoSale(leerGuard(f), f);
    assert.equal(r.ciego, null, f);
    assert.equal(r.usaVeredicto, true, f + ' ya no llama a `veredictoDe`');
    assert.ok(r.porVeredicto.length >= 1, f + ' no sale con el `.codigo` de su veredicto');
    assert.deepEqual(r.aMano.map((s) => f + ':' + s.linea + ' ' + s.porque), [], f + ' vuelve a decidir por su cuenta');
    assert.equal(SALEN_A_MANO.has(f), false, f + ' está arreglado: no puede seguir en la lista de los que salen a mano');
    // La línea de las cuentas sale SIEMPRE, también en verde. Si sólo saliera con algo que contar, que
    // no esté no distinguiría «0 hallazgos · 0 ciegos» de «nadie llegó a contar».
    assert.equal(diceSusCuentasEnVerde(leerGuard(f)), 1, f + ' ya no dice sus dos cuentas cuando sale en verde');
  }
  for (const f of GRUPO_1) {
    assert.equal(llamaA(leerGuard(f), 'recorrerCasos'), 1, f + ' tiene que recorrer sus casos con `recorrerCasos`: escrito a mano, el bucle vuelve a elegir cuándo deja de mirar');
  }
  // El control de los dos lectores: no cuentan la palabra en un comentario, sólo la llamada.
  assert.equal(llamaA('// recorrerCasos(a, b)\nconst x = 1;', 'recorrerCasos'), 0);
  assert.equal(llamaA('await recorrerCasos(a, b);', 'recorrerCasos'), 1);
  assert.equal(diceSusCuentasEnVerde("// console.log(veredictoFinal.linea)\nconsole.error(veredictoFinal.linea);"), 0, 'por `console.error` es el camino rojo, no el verde');
  assert.equal(diceSusCuentasEnVerde("console.log('  ' + veredictoFinal.linea);"), 1);
});

// ── ③ EL LECTOR ────────────────────────────────────────────────────────────────────────────────

// Las colas, tal como eran y tal como quedan. Son el suelo del lector: si deja de distinguirlas, el
// censo de abajo no dice nada aunque salga limpio.
const COLA_DEL_GRUPO_2 = `
const fallos = []; const ciegos = [];
if (ciegos.length) { console.error('no supe mirar'); process.exit(1); }
if (fallos.length) { console.error('fallos'); process.exit(1); }
`;
const ABORTA_EN_EL_BUCLE = `
function noSupeMirar(porque) { console.error(porque); process.exit(2); }
const hallazgos = [];
for (const ancho of [929, 390]) {
  if (ancho > 900) noSupeMirar('ciego');
  hallazgos.push('no cabe');
}
if (hallazgos.length) process.exit(1);
`;
const EL_VEREDICTO_CORTA_EL_RECORRIDO = `
import { veredictoDe, recorrerCasos } from './_hallazgos-y-ciegos.mjs';
const hallazgos = []; const ciegos = [];
function cerrar() { const v = veredictoDe({ hallazgos, ciegos }); if (v.codigo !== 0) process.exit(v.codigo); }
const cuentas = await recorrerCasos([929, 390], async (ancho) => {
  if (ancho > 900) { ciegos.push('ciego'); cerrar(); }
  return { hallazgos: [], ciegos: [] };
});
cerrar();
`;
const LA_CUENTA_A_MANO = `
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
const v = veredictoDe({ hallazgos: 0, ciegos: 1 });
process.exit(v.codigo);
`;
const POR_EXITCODE = `
const fallos = [];
if (fallos.length) process.exitCode = 1;
`;
const POR_UNA_VARIABLE = `
const codigo = calcular();
process.exit(codigo);
`;
const EL_CODIGO_DE_OTRO = `
import { veredictoDe } from './_hallazgos-y-ciegos.mjs';
const v = veredictoDe({ hallazgos, ciegos });
const mio = { codigo: 0 };
process.exit(mio.codigo);
`;
const COLA_BUENA = `
import { veredictoDe, recorrerCasos } from './_hallazgos-y-ciegos.mjs';
const hallazgos = []; const ciegos = [];
function cerrar() { const v = veredictoDe({ hallazgos, ciegos }); if (v.codigo !== 0) process.exit(v.codigo); }
if (!textos) { ciegos.push('sin textos'); cerrar(); }
const cuentas = await recorrerCasos([929, 390], async (ancho) => ({ hallazgos: [], ciegos: ancho > 900 ? ['ciego'] : [] }));
hallazgos.push(...cuentas.hallazgos); ciegos.push(...cuentas.ciegos);
cerrar();
`;

test('SCRUM-1327 · el lector ve la cola del grupo ②, que el censo de SCRUM-1320 NO podía ver', () => {
  const r = comoSale(COLA_DEL_GRUPO_2);
  assert.equal(r.aMano.length, 2);
  assert.equal(r.porVeredicto.length, 0);
  // Por qué hizo falta: pintar el ciego con el MISMO 1 no deja «salida de ciego» que encontrar.
  assert.deepEqual(defectosDe(COLA_DEL_GRUPO_2).defectos, [], 'si `defectosDe` ya la viera, este lector sobraría');
});

test('SCRUM-1327 · el lector ve la forma del grupo ①: una salida a la que se llega desde DENTRO del recorrido', () => {
  const aborta = comoSale(ABORTA_EN_EL_BUCLE);
  assert.equal(aborta.aMano.length, 2);
  assert.match(aborta.aMano[0].porque, /DENTRO del recorrido/, 'el `process.exit(2)` de `noSupeMirar()` se llama desde el bucle');
  assert.doesNotMatch(aborta.aMano[1].porque, /recorrido/, 'el de después del bucle es a mano, pero no corta nada');

  // Y con `veredictoDe` puesto: el número es bueno y aun así deja de mirar. Es la forma en que el
  // grupo ① podría volver sin que ningún otro lector se entere.
  const corta = comoSale(EL_VEREDICTO_CORTA_EL_RECORRIDO);
  assert.equal(corta.usaVeredicto, true);
  assert.equal(corta.aMano.length, 1);
  assert.match(corta.aMano[0].porque, /sale DENTRO del recorrido: lo que hubiera después no se mide/);
});

test('SCRUM-1327 · el lector ve las otras formas de decidir a mano: la cuenta escrita, `exitCode`, una variable, el `.codigo` de otro', () => {
  const cuenta = comoSale(LA_CUENTA_A_MANO);
  assert.equal(cuenta.aMano.length, 2, 'las dos cuentas son literales');
  assert.match(cuenta.aMano[0].porque, /cuenta escrita a mano/);
  assert.match(comoSale(POR_EXITCODE).aMano[0].porque, /process\.exitCode/);
  assert.match(comoSale(POR_UNA_VARIABLE).aMano[0].porque, /con `codigo`/);
  // `mio.codigo` se llama igual que el del veredicto y no lo es: un nombre no es una procedencia.
  assert.equal(comoSale(EL_CODIGO_DE_OTRO).aMano.length, 1);
  assert.equal(comoSale(EL_CODIGO_DE_OTRO).porVeredicto.length, 0);
});

test('SCRUM-1327 · CONTROL del lector: de la cola buena no se queja, y cuando no sabe, dice que no sabe', () => {
  const buena = comoSale(COLA_BUENA);
  assert.deepEqual(buena.aMano, [], 'cerrar ANTES de medir y al final no corta ningún recorrido');
  assert.equal(buena.porVeredicto.length, 1);
  assert.equal(buena.ciego, null);
  // «No lo sé» no es «decide bien»: un fichero ilegible, o sin ninguna salida, es un ciego del lector.
  assert.match(comoSale('if (').ciego, /no se puede leer como programa/);
  assert.match(comoSale('const x = 1;\nconsole.log(x);').ciego, /no le encuentro ninguna salida/);
});

// ── ④ EL CENSO ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1327 · el censo SABE FALLAR: uno nuevo sin declarar, un número que no cuadra, una entrada caduca y un «no lo sé»', () => {
  const declarados = new Map([
    ['guard-viejo.mjs', { salidas: 2, motivo: 'deuda' }],
    ['guard-arreglado.mjs', { salidas: 1, motivo: 'ya no' }],
    ['guard-ilegible.mjs', { salidas: 1, motivo: 'estar en la lista no excusa no saber' }],
  ]);
  const poblacion = [
    { f: 'guard-bueno.mjs', fuente: COLA_BUENA },
    { f: 'guard-septimo.mjs', fuente: COLA_DEL_GRUPO_2 },      // el nuevo, que decide solo
    { f: 'guard-viejo.mjs', fuente: POR_UNA_VARIABLE },         // declara 2 y tiene 1
    { f: 'guard-arreglado.mjs', fuente: COLA_BUENA },           // ya no sale a mano
    { f: 'guard-ilegible.mjs', fuente: 'if (' },
    { f: 'guard-mudo.mjs', fuente: 'const x = 1;' },
  ];
  const c = censoDeSalidas(poblacion, declarados);
  assert.equal(c.sinDeclarar.length, 1);
  assert.match(c.sinDeclarar[0], /^guard-septimo\.mjs → 2 salida\(s\) a mano/);
  assert.equal(c.desajustes.length, 1);
  assert.match(c.desajustes[0], /^guard-viejo\.mjs → declara 2 y tiene 1/);
  assert.deepEqual(c.caducas, ['guard-arreglado.mjs', 'guard-ilegible.mjs']);
  assert.equal(c.noSe.length, 2, 'el ilegible y el que no tiene ninguna salida; la lista no excusa a ninguno');
  assert.match(c.noSe.join('\n'), /guard-ilegible\.mjs → no se puede leer/);
  assert.match(c.noSe.join('\n'), /guard-mudo\.mjs → no le encuentro ninguna salida/);
  assert.equal(c.linea, 'POBLACIÓN: 6 guards · 2 salen sólo por `veredictoDe` · 2 salen a mano (3 salidas) · 2 de los que NO SÉ cómo deciden');

  // Y el control: con todo en su sitio no se queja de nada, y los ceros TAMBIÉN se dicen.
  const limpio = censoDeSalidas([{ f: 'guard-bueno.mjs', fuente: COLA_BUENA }], new Map());
  assert.deepEqual([limpio.noSe, limpio.sinDeclarar, limpio.desajustes, limpio.caducas], [[], [], [], []]);
  assert.equal(limpio.linea, 'POBLACIÓN: 1 guards · 1 salen sólo por `veredictoDe` · 0 salen a mano (0 salidas) · 0 de los que NO SÉ cómo deciden');
});

test('SCRUM-1327 · censo: ningún `scripts/guard-*.mjs` sale a mano fuera de los declarados, y de ninguno se ignora cómo decide', () => {
  const ficheros = fs.readdirSync(DIR_SCRIPTS).filter((f) => /^guard-.*\.mjs$/.test(f)).sort();
  const c = censoDeSalidas(ficheros.map((f) => ({ f, fuente: leerGuard(f) })), SALEN_A_MANO);
  const sinArreglar = [...SALEN_A_MANO].filter(([, d]) => d.pintaElCiegoDeHallazgo).map(([f]) => f);

  // LO QUE SE DICE EN CADA PASADA, también cuando todo es cero: las cuentas, la deuda y los límites.
  console.log('  [SCRUM-1327] ' + c.linea);
  console.log('  [SCRUM-1327] pintan el ciego de hallazgo, SIN ARREGLAR (SCRUM-1336): ' + sinArreglar.length + ' de ' + SALEN_A_MANO.size
    + ' declarados (' + (sinArreglar.join(', ') || 'ninguno') + ')');
  console.log('  [SCRUM-1327] ⚠️ LO QUE ESTE CENSO NO MIRA: ' + LIMITES_DE_COMO_SALE.join(' · ')
    + ' · y su población es `scripts/guard-*.mjs`: `guards-entrada.mjs`, `guards-visuales.mjs` y los `_prisma-*-guard.mjs` quedan fuera.');

  // SUELO: un censo que no ha mirado no aprueba.
  assert.ok(ficheros.length >= 40, c.linea + '\n🔴 sólo ' + ficheros.length + ' ficheros: no estoy mirando `scripts/`.');
  assert.ok(c.limpios.includes('guard-915g-ajustes-del-justificante.mjs'),
    c.linea + '\n🔴 el lector no da por bueno ni el guard donde nació `veredictoDe`: no está leyendo.');

  // SIN LISTA QUE LO EXCUSE: de un guard del que no sé cómo decide, no digo que decide bien.
  assert.deepEqual(c.noSe, [], c.linea
    + '\n🔴 NO SÉ cómo deciden estos guards. O no se pueden leer como programa, o no se les encuentra ninguna salida.'
    + '\n   No se arregla añadiéndolos a ninguna lista: se arregla haciendo que salgan por `veredictoDe(...).codigo`.');

  // MITAD ①: no entra uno nuevo en silencio — ni una salida nueva en uno ya declarado.
  assert.deepEqual(c.sinDeclarar, [], c.linea
    + '\n🔴 Estos guards deciden ellos con qué salen (o cuándo dejan de mirar). SCRUM-904 lo arregló en un guard y la regla se'
    + '\n   quedó en ese fichero; SCRUM-1327 tuvo que arreglarlo en seis más. Un guard sale SÓLO así:'
    + '\n       const veredictoFinal = veredictoDe({ hallazgos, ciegos });          // scripts/_hallazgos-y-ciegos.mjs'
    + '\n       if (veredictoFinal.codigo !== 0) { console.error(veredictoFinal.linea); process.exit(veredictoFinal.codigo); }'
    + '\n   y sus casos los recorre `recorrerCasos`, que no deja de mirar al primer ciego. No se arregla añadiéndolo a SALEN_A_MANO.');
  assert.deepEqual(c.desajustes, [], c.linea
    + '\n🔴 El número de salidas a mano de estos guards no es el declarado en SALEN_A_MANO (`tests/_salidas-de-guard.mjs`).'
    + '\n   Si ha SUBIDO: la salida nueva sale por `veredictoDe`, no se sube el número. Si ha BAJADO: baja el número, o una'
    + '\n   salida a mano podría volver sin que esto salte.');

  // MITAD ②: no se queda una entrada que ya no hace falta.
  assert.deepEqual(c.caducas, [], c.linea
    + '\n🔴 Declarados que ya NO salen a mano (o que ya no existen). Bórralos de SALEN_A_MANO: una entrada de más es'
    + '\n   holgura para que ese guard vuelva a decidir solo sin que esto salte.');
});

test('SCRUM-1327 · la lista dice por qué, una a una, y sus marcas no mienten', () => {
  for (const [f, d] of SALEN_A_MANO) {
    assert.ok(Number.isInteger(d.salidas) && d.salidas >= 1, f + ': `salidas` tiene que ser un entero ≥ 1');
    assert.ok(typeof d.motivo === 'string' && d.motivo.length >= 40, f + ': sin motivo, una entrada es un permiso');
    // `eligeEntreCiegoYHallazgo` es lo que el censo de SCRUM-1320 deriva de aquí: tiene que ser lo que `defectosDe` ve.
    assert.equal(Boolean(d.eligeEntreCiegoYHallazgo), defectosDe(leerGuard(f), f).defectos.length > 0,
      f + ': la marca `eligeEntreCiegoYHallazgo` no coincide con lo que encuentra `defectosDe`');
  }
});
