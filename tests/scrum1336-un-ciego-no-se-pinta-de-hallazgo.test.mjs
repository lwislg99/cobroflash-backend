// tests/scrum1336-un-ciego-no-se-pinta-de-hallazgo.test.mjs — SCRUM-1336
//
// Sin gate: ni BD, ni red, ni navegador. Lee `scripts/` por AST, ejecuta funciones puras y lee los
// resúmenes del banco de navegador que están en git.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// «NO SUPE MIRAR» NO SALE CON EL MISMO 1 QUE «HE MIRADO Y ESTÁ MAL»
//
// SCRUM-1327 dejó DECLARADOS seis guards que pintaban de 1 un ciego (la marca
// `pintaElCiegoDeHallazgo` de `SALEN_A_MANO`), leídos y no ejercitados. Este ticket los EJERCITA con
// su navegador —los seis tenían el defecto— y los pasa por `veredictoDe`. Y aparte, un séptimo que
// estaba en la lista SIN la marca: `guard-rastro-del-menu`, cuyo suelo era un `throw` sin capturar.
//
// 🔴 SEIS Y UNO NO SE SUMAN. Seis estaban declarados por el trinquete y uno no; aquí van en dos
// listas y en dos tests, y ningún recuento los junta.
//
// Lo que este fichero fija:
//   ① los siete salen sólo por `veredictoDe` y dicen SIEMPRE sus dos cuentas (E1 de c.17949);
//   ② el cableado: lo que no se supo mirar llega a `ciegos` y lo encontrado a `hallazgos`;
//   ③ la lista: ya nadie lleva la marca;
//   ④ F: el mensaje del séptimo dice lo que midió, no un «17» escrito a mano;
//   ⑤ E2: la línea agregada del banco, también con ceros · E3: la puerta lo refleja sin tocarla;
//   ⑥ que la evidencia con navegador que está en git dice lo que el registro afirma.
//
// ⚠️ LÍMITE, dicho aquí y no sólo en el registro: ② se comprueba por AST. Que un ciego PROVOCADO
// haga salir 2 a cada guard, que un hallazgo real siga saliendo 1 y que quitar una línea del arreglo
// lo cambie, sólo lo prueba el navegador: ese banco (`docs/master/evidencias/scrum1336/banco.mjs`)
// no corre en `npm test`. ⑥ lee su resultado GUARDADO: comprueba que está y qué dice, no lo repite.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { comoSale, SALEN_A_MANO } from './_salidas-de-guard.mjs';
import { desenlaceDelHijo, recuento } from '../scripts/guards-visuales.mjs';
import { leerVeredicto, veredictoDe, SALIDA_HALLAZGO, SALIDA_NO_SUPE_MEDIR } from '../scripts/_hallazgos-y-ciegos.mjs';
import { lineaDeLosQueMidieron, clasificarPasada } from '../docs/master/evidencias/scrum1336/linea.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leerGuard = (f) => fs.readFileSync(path.join(RAIZ, 'scripts', f), 'utf8');
const EVIDENCIAS = path.join(RAIZ, 'docs', 'master', 'evidencias', 'scrum1336');

/** Los seis que llevaban la marca `pintaElCiegoDeHallazgo`. */
const SEIS = [
  'guard-a11y-comparativa.mjs',
  'guard-a11y-landing.mjs',
  'guard-contraste.mjs',
  'guard-duplicar-926.mjs',
  'guard-marcadores-en-pantalla.mjs',
  'guard-objetivo-tactil.mjs',
];
/** El séptimo, APARTE: estaba en la lista sin la marca. No se suma a los seis. */
const SEPTIMO = 'guard-rastro-del-menu.mjs';

// El meta-guard de la casa ejecuta esto. Las cuatro primeras son el defecto del ticket, vuelto a
// poner; la quinta es el contrario, que es peor (un hallazgo de verdad pasando a ciego).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El ciego vuelve a contarse como hallazgo.
    fichero: 'scripts/guard-a11y-comparativa.mjs',
    de: 'const noSupeMirar = (texto) => { console.error(texto); ciegos.push(texto); };',
    a: 'const noSupeMirar = (texto) => { console.error(texto); hallazgos.push(texto); };',
    cae: 'los sumideros: «no supe mirar» va a `ciegos` y el hallazgo a `hallazgos`',
  },
  {
    // Un «NO SUPE MIRAR» vuelve a pasársele al sumidero de los hallazgos.
    fichero: 'scripts/guard-a11y-landing.mjs',
    de: 'noSupeMirar(`   🔴 NO SUPE MIRAR @${ancho}px: el árbol de accesibilidad',
    a: 'hallazgo(`   🔴 NO SUPE MIRAR @${ancho}px: el árbol de accesibilidad',
    cae: 'ningún «NO SUPE MIRAR» ni «CIEGO» se le pasa al sumidero de hallazgos',
  },
  {
    // El guard vuelve a decidir él con qué sale.
    fichero: 'scripts/guard-contraste.mjs',
    de: '    process.exit(veredictoFinal.codigo);',
    a: '    process.exit(1);',
    cae: 'LOS SEIS con la marca salen SÓLO por `veredictoDe`',
  },
  {
    // Lo que lanza `medir()` —el suelo del menú— vuelve a contarse como hallazgo.
    fichero: 'scripts/guard-rastro-del-menu.mjs',
    de: '    ciegos.push(String((e && e.message) || e));',
    a: '    fallos.push(String((e && e.message) || e));',
    cae: 'EL SÉPTIMO, aparte',
  },
  {
    // EL CONTRARIO, que es peor: el hallazgo se apunta como ciego.
    fichero: 'scripts/guard-objetivo-tactil.mjs',
    de: 'const hallazgo = (s) => { console.error(s); hallazgos.push(s); };',
    a: 'const hallazgo = (s) => { console.error(s); ciegos.push(s); };',
    cae: 'los sumideros: «no supe mirar» va a `ciegos` y el hallazgo a `hallazgos`',
  },
  {
    // La línea de las dos cuentas deja de salir en verde.
    fichero: 'scripts/guard-duplicar-926.mjs',
    de: 'else console.log(veredictoFinal.linea);',
    a: 'else console.log(\'\');',
    cae: 'E1 · cada uno de los siete dice SIEMPRE sus dos cuentas',
  },
  {
    // El mensaje del séptimo vuelve a llevar un número escrito a mano.
    fichero: 'scripts/guard-rastro-del-menu.mjs',
    de: '✓ los ${r.destinos.length} destinos del menú dejan rastro',
    a: '✓ los 17 destinos del menú dejan rastro',
    cae: 'F · el mensaje de `guard-rastro-del-menu` dice lo que MIDIÓ',
  },
  {
    // La línea agregada del banco calla los que no supieron mirar.
    fichero: 'docs/master/evidencias/scrum1336/linea.mjs',
    de: "const k = lista.filter((f) => clasificarPasada(f) === 'no supo mirar').length;",
    a: 'const k = 0;',
    cae: 'E2 · la línea agregada del banco sale SIEMPRE',
  },
];

// ── Los lectores, por AST: los comentarios de estos guards CITAN lo que se retiró (A23, casilla 2) ──

const arbolDe = (fuente) => ts.createSourceFile('guard.mjs', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function recorrer(nodo, ver) { ver(nodo); ts.forEachChild(nodo, (h) => recorrer(h, ver)); }
const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n);

/** A qué listas hace `.push` un trozo del árbol: `{ ciegos, hallazgos, … }`. */
function listasQueEmpuja(nodo) {
  const listas = new Set();
  recorrer(nodo, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push'
      && ts.isIdentifier(n.expression.expression)) listas.add(n.expression.expression.text);
  });
  return listas;
}

/** La función que guarda una `const nombre = (…) => …` o una `function nombre`. `null` si no existe. */
function funcionLlamada(sf, nombre) {
  let hallada = null;
  recorrer(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nombre && n.initializer && esFuncion(n.initializer)) hallada = n.initializer;
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === nombre) hallada = n;
  });
  return hallada;
}

/** El texto de los literales (cadenas y plantillas) de un nodo, juntos. Nunca los comentarios. */
function literalesDe(nodo) {
  const trozos = [];
  recorrer(nodo, (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) trozos.push(n.text);
    if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) trozos.push(n.text);
  });
  return trozos.join(' ');
}

/** Las llamadas `nombre(…)` del fuente, cada una con el texto de sus literales y su línea. */
function llamadasA(nodo, nombres) {
  const sf = nodo.getSourceFile();
  const hechas = [];
  recorrer(nodo, (n) => {
    if (!ts.isCallExpression(n)) return;
    const f = n.expression;
    const nombre = ts.isIdentifier(f) ? f.text
      : (ts.isPropertyAccessExpression(f) && ts.isIdentifier(f.expression) ? f.expression.text + '.' + f.name.text : null);
    if (!nombre || !nombres.includes(nombre)) return;
    hechas.push({ nombre, texto: n.arguments.map(literalesDe).join(' '), linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
  });
  return hechas;
}

const PALABRAS_DE_CIEGO = /NO SUPE MIRAR|\bCIEGO\b|SUPERFICIE NO MEDIDA|NO DISCRIMINA|UMBRAL MAL APLICADO/;
const SUMIDEROS_DE_HALLAZGO = ['hallazgo', 'hallazgos.push', 'fallos.push'];
const SUMIDEROS_DE_CIEGO = ['noSupeMirar', 'ciegos.push'];

/** Los literales con palabras de ciego que van al sumidero de hallazgos, y los «✖» que van al de ciegos. */
function cruces(fuente) {
  const sf = arbolDe(fuente);
  return [
    ...llamadasA(sf, SUMIDEROS_DE_HALLAZGO).filter((l) => PALABRAS_DE_CIEGO.test(l.texto)).map((l) => `:${l.linea} «${l.nombre}» recibe un «no supe mirar»`),
    ...llamadasA(sf, SUMIDEROS_DE_CIEGO).filter((l) => l.texto.includes('✖')).map((l) => `:${l.linea} «${l.nombre}» recibe un «✖»`),
  ];
}

/**
 * Lo que `recorrerCasos` apunta como ciego (un caso que LANZA, o cero casos) tiene que llegar a la
 * lista `ciegos`. Devuelve los `recorridoX.ciegos` que NO llegan, o `['no hay ninguno']`.
 */
function recorridosQueNoLlegan(fuente) {
  const sf = arbolDe(fuente);
  const usos = new Map();
  recorrer(sf, (n) => {
    if (!ts.isPropertyAccessExpression(n) || n.name.text !== 'ciegos' || !ts.isIdentifier(n.expression) || !/^recorrido/.test(n.expression.text)) return;
    const nombre = n.expression.text;
    if (!usos.has(nombre)) usos.set(nombre, false);
    const p = n.parent;
    // `ciegos.push(...recorrido.ciegos)`
    if (ts.isSpreadElement(p) && ts.isCallExpression(p.parent) && p.parent.expression.getText(sf) === 'ciegos.push') usos.set(nombre, true);
    // `for (const c of recorrido.ciegos) noSupeMirar(…)` · o `apuntar('ciego', c)`
    if (ts.isForOfStatement(p) && p.expression === n) {
      const cuerpo = p.statement;
      const llama = llamadasA(cuerpo, ['noSupeMirar', 'ciegos.push']).length > 0
        || llamadasA(cuerpo, ['apuntar']).some((l) => l.texto.trim() === 'ciego');
      if (llama) usos.set(nombre, true);
    }
  });
  if (usos.size === 0) return ['no hay ningún `recorridoX.ciegos`'];
  return [...usos].filter(([, llega]) => !llega).map(([nombre]) => nombre + '.ciegos no llega a `ciegos`');
}

/** `console.log(… veredictoFinal.linea …)`: la línea de las dos cuentas, dicha por el camino VERDE. */
function vecesQueDiceSusCuentasEnVerde(fuente) {
  const sf = arbolDe(fuente);
  let n = 0;
  recorrer(sf, (nodo) => {
    if (ts.isCallExpression(nodo) && nodo.expression.getText(sf) === 'console.log'
      && nodo.arguments.some((a) => /\bveredictoFinal\.linea\b/.test(a.getText(sf)))) n += 1;
  });
  return n;
}

function saleSoloPorVeredicto(f) {
  const r = comoSale(leerGuard(f), f);
  assert.equal(r.ciego, null, f);
  assert.equal(r.usaVeredicto, true, f + ' no llama a `veredictoDe`');
  assert.ok(r.porVeredicto.length >= 1, f + ' no sale con el `.codigo` de su veredicto');
  assert.deepEqual(r.aMano.map((s) => f + ':' + s.linea + ' ' + s.porque), [], f + ' vuelve a decidir por su cuenta con qué sale');
  assert.equal(SALEN_A_MANO.has(f), false, f + ' está arreglado: no puede seguir en la lista de los que salen a mano');
}

// ── ① LOS SIETE ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1336 · LOS SEIS con la marca salen SÓLO por `veredictoDe`, y ya no están en la lista de los que salen a mano', () => {
  console.log('  [SCRUM-1336] los seis que llevaban la marca: ' + SEIS.join(', '));
  assert.equal(SEIS.length, 6);
  for (const f of SEIS) saleSoloPorVeredicto(f);
});

test('SCRUM-1336 · EL SÉPTIMO, aparte: `guard-rastro-del-menu` sale por `veredictoDe`, y lo que lanza `medir()` es un ciego', () => {
  console.log('  [SCRUM-1336] el séptimo, que estaba en la lista SIN la marca: ' + SEPTIMO);
  assert.equal(SEIS.includes(SEPTIMO), false, 'el séptimo no es uno de los seis: no se cuentan juntos');
  saleSoloPorVeredicto(SEPTIMO);

  // El suelo era un `throw` dentro de `medir()`, llamada con un `await` a pelo: subía sin capturar y
  // el proceso salía con 1. Ahora la llamada va dentro de un `try`, y su `catch` apunta en `ciegos`.
  const sf = arbolDe(leerGuard(SEPTIMO));
  const capturas = [];
  recorrer(sf, (n) => {
    if (!ts.isTryStatement(n) || !n.catchClause) return;
    if (llamadasA(n.tryBlock, ['medir']).length === 0) return;
    capturas.push([...listasQueEmpuja(n.catchClause)]);
  });
  assert.equal(capturas.length, 1, 'la llamada a `medir()` tiene que estar dentro de UN `try` con su `catch`');
  assert.deepEqual(capturas[0], ['ciegos'], 'lo que lanza `medir()` no se ha medido: va a `ciegos`, y sólo ahí');
  // Y el veredicto recibe cada lista en su sitio.
  const cuentas = [];
  recorrer(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'veredictoDe') cuentas.push(n.arguments[0].getText(sf).replace(/\s+/g, ' '));
  });
  assert.deepEqual(cuentas, ['{ hallazgos: fallos, ciegos }']);
});

test('SCRUM-1336 · E1 · cada uno de los siete dice SIEMPRE sus dos cuentas, también en verde', () => {
  // Si la línea sólo saliera con algo que contar, que no esté no distinguiría «0 hallazgos · 0 ciegos»
  // de «nadie llegó a contar». (Es la E1 de c.17949; la E de c.17939 está enmendada allí.)
  for (const f of [...SEIS, SEPTIMO]) {
    assert.equal(vecesQueDiceSusCuentasEnVerde(leerGuard(f)), 1, f + ' no dice sus dos cuentas cuando sale en verde');
  }
  assert.equal(vecesQueDiceSusCuentasEnVerde("// console.log(veredictoFinal.linea)\nconsole.error(veredictoFinal.linea);"), 0, 'por `console.error` es el camino rojo, no el verde');
  assert.equal(vecesQueDiceSusCuentasEnVerde("console.log('  ' + veredictoFinal.linea);"), 1);
});

// ── ② EL CABLEADO ──────────────────────────────────────────────────────────────────────────────

test('SCRUM-1336 · los sumideros: «no supe mirar» va a `ciegos` y el hallazgo a `hallazgos`, y lo que apunta el recorrido llega a `ciegos`', () => {
  // Los cuatro que tienen los dos sumideros con nombre.
  for (const f of ['guard-a11y-comparativa.mjs', 'guard-a11y-landing.mjs', 'guard-marcadores-en-pantalla.mjs', 'guard-objetivo-tactil.mjs']) {
    const sf = arbolDe(leerGuard(f));
    const deCiego = funcionLlamada(sf, 'noSupeMirar');
    const deHallazgo = funcionLlamada(sf, 'hallazgo');
    assert.ok(deCiego && deHallazgo, f + ' ha perdido uno de sus dos sumideros');
    assert.deepEqual([...listasQueEmpuja(deCiego)], ['ciegos'], f + ': `noSupeMirar` tiene que apuntar en `ciegos`, y sólo ahí');
    assert.deepEqual([...listasQueEmpuja(deHallazgo)], ['hallazgos'], f + ': `hallazgo` tiene que apuntar en `hallazgos`, y sólo ahí');
  }
  // `guard-duplicar-926` apunta por estado: cada estado, a su lista.
  const duplicar = arbolDe(leerGuard('guard-duplicar-926.mjs'));
  const porEstado = {};
  recorrer(funcionLlamada(duplicar, 'apuntar'), (n) => {
    if (!ts.isIfStatement(n)) return;
    const m = n.expression.getText(duplicar).match(/^estado === '([a-z ]+)'$/);
    if (m) porEstado[m[1]] = [...listasQueEmpuja(n.thenStatement)];
  });
  assert.deepEqual(porEstado, { hallazgo: ['hallazgos'], ciego: ['ciegos'] }, 'guard-duplicar-926: cada estado apunta en su lista');

  // Los seis recorren con `recorrerCasos`, y lo que éste apunta (un caso que LANZA) llega a `ciegos`.
  for (const f of SEIS) {
    const fuente = leerGuard(f);
    assert.ok(llamadasA(arbolDe(fuente), ['recorrerCasos']).length >= 1, f + ' tiene que recorrer sus casos con `recorrerCasos`: escrito a mano, el bucle vuelve a elegir cuándo deja de mirar');
    assert.deepEqual(recorridosQueNoLlegan(fuente), [], f);
  }
});

test('SCRUM-1336 · ningún «NO SUPE MIRAR» ni «CIEGO» se le pasa al sumidero de hallazgos, y ningún «✖» al de ciegos', () => {
  let llamadas = 0;
  for (const f of [...SEIS, SEPTIMO]) {
    const fuente = leerGuard(f);
    llamadas += llamadasA(arbolDe(fuente), [...SUMIDEROS_DE_HALLAZGO, ...SUMIDEROS_DE_CIEGO]).length;
    assert.deepEqual(cruces(fuente).map((c) => f + c), [], f + ' pinta un ciego de hallazgo, o al revés');
  }
  // SUELO: un lector que no encuentra llamadas no ha mirado.
  console.log('  [SCRUM-1336] llamadas a los sumideros leídas en los siete: ' + llamadas);
  assert.ok(llamadas >= 40, 'sólo ' + llamadas + ' llamadas a los sumideros: no estoy leyendo los guards');
});

test('SCRUM-1336 · CONTROL de los lectores: saben fallar sobre el defecto fabricado, y no cuentan los comentarios', () => {
  // La cola de antes, tal como era en `guard-a11y-comparativa`.
  const DEFECTO = "let fallos = 0; const hallazgos = [];\nconst hallazgo = (t) => { hallazgos.push(t); };\nhallazgo(`🔴 NO SUPE MIRAR a ${ancho}px: no encuentro la sección`);\nconst ciegos = []; ciegos.push('   ✖ fila sin etiqueta');";
  assert.deepEqual(cruces(DEFECTO), [':3 «hallazgo» recibe un «no supe mirar»', ':4 «ciegos.push» recibe un «✖»']);
  // En un comentario no cuenta: es lo que estos guards hacen para explicar lo que se retiró.
  assert.deepEqual(cruces("// hallazgo('🔴 NO SUPE MIRAR')\nconst x = 1;"), []);
  // El recorrido que no llega: se guarda y nadie lo apunta.
  assert.deepEqual(recorridosQueNoLlegan('const recorrido = await recorrerCasos(a, b);\nconsole.log(recorrido.ciegos.length);'), ['recorrido.ciegos no llega a `ciegos`']);
  assert.deepEqual(recorridosQueNoLlegan('const recorrido = await recorrerCasos(a, b);\nhallazgos.push(...recorrido.ciegos);'), ['recorrido.ciegos no llega a `ciegos`']);
  assert.deepEqual(recorridosQueNoLlegan('const recorrido = await recorrerCasos(a, b);\nciegos.push(...recorrido.ciegos);'), []);
  assert.deepEqual(recorridosQueNoLlegan('const x = 1;'), ['no hay ningún `recorridoX.ciegos`']);
  // Y el sumidero cambiado de lista.
  assert.deepEqual([...listasQueEmpuja(funcionLlamada(arbolDe('const noSupeMirar = (t) => { hallazgos.push(t); };'), 'noSupeMirar'))], ['hallazgos']);
});

// ── ③ LA LISTA ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1336 · la lista: ninguna entrada lleva ya la marca `pintaElCiegoDeHallazgo`, y los siete han salido de ella', () => {
  const conMarca = [...SALEN_A_MANO].filter(([, d]) => d.pintaElCiegoDeHallazgo).map(([f]) => f);
  console.log('  [SCRUM-1336] SALEN_A_MANO: ' + SALEN_A_MANO.size + ' entradas · con la marca `pintaElCiegoDeHallazgo`: ' + conMarca.length
    + ' · (antes de SCRUM-1336: 17 entradas y 6 con la marca — `docs/master/evidencias/scrum1336/lista-antes-despues.mjs`)');
  assert.deepEqual(conMarca, [], 'la marca es una deuda con nombre: quien la lleve pinta de 1 un ciego');
  assert.deepEqual([...SEIS, SEPTIMO].filter((f) => SALEN_A_MANO.has(f)), []);
  // Y los siete siguen EXISTIENDO: no se han sacado del conjunto para que la lista cuadre (regla 41).
  for (const f of [...SEIS, SEPTIMO]) assert.ok(fs.existsSync(path.join(RAIZ, 'scripts', f)), f + ' ya no existe');
  const scripts = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts;
  const ordenes = Object.entries(scripts).filter(([k]) => /^guard:/.test(k)).map(([, v]) => v);
  for (const f of [...SEIS, SEPTIMO]) assert.ok(ordenes.some((o) => o.includes('scripts/' + f)), f + ' ya no tiene orden `guard:*` en package.json: la puerta dejaría de correrlo');
});

// ── ④ F ────────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1336 · F · el mensaje de `guard-rastro-del-menu` dice lo que MIDIÓ: ningún «17» escrito a mano, y nombra su constante', () => {
  // El comentario decía «menos de 17» y el mensaje verde «los 17 destinos», con la constante en 18
  // desde SCRUM-1040. Que la constante valga lo que el menú tiene lo fija `tests/scrum819-…` (18
  // exactos): aquí NO se repite ese número, sólo que el guard no lleve otro escrito a mano.
  const fuente = leerGuard(SEPTIMO);
  const sf = arbolDe(fuente);
  const literales = literalesDe(sf);
  assert.doesNotMatch(literales, /\b17\b/, 'un literal del guard vuelve a decir «17»');
  // (Los literales de una plantilla llegan troceados por sus `${…}`: donde iba el número queda un hueco.)
  assert.match(literales, /✓ los\s+destinos del menú dejan rastro \(suelo `MINIMO_DESTINOS` =\s+\)/, 'el mensaje verde dice el número medido y la constante por su nombre');
  // Y en los comentarios, que es donde mentía: ningún «N destinos» con el número a mano fuera de la
  // nota que cuenta lo que ponía antes.
  const sinLaNota = fuente.split('\n').filter((l) => !/SCRUM-1336|con 18 medidos/.test(l)).join('\n');
  assert.doesNotMatch(sinLaNota, /\b17 destinos\b|menos de 17\b/);
  // El control: sobre el texto de antes, los dos lectores caen.
  assert.match(literalesDe(arbolDe("console.log('\\n✓ los 17 destinos dejan rastro');")), /\b17\b/);
});

// ── ⑤ E2 y E3 ──────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1336 · E2 · la línea agregada del banco sale SIEMPRE, también con ceros, y suma el total', () => {
  const fila = (exit, valida = true) => ({ valida, exit });
  assert.equal(lineaDeLosQueMidieron([]), '0 guards midieron · 0 no supieron mirar · 0 pasadas sin contar (de 0)');
  assert.equal(lineaDeLosQueMidieron([fila(0), fila(1)]), '2 guards midieron · 0 no supieron mirar · 0 pasadas sin contar (de 2)');
  assert.equal(lineaDeLosQueMidieron([fila(2)]), '0 guards midieron · 1 no supo mirar · 0 pasadas sin contar (de 1)');
  assert.equal(lineaDeLosQueMidieron([fila(0), fila(2), fila(3), fila(4), fila(1, false), fila(null)]),
    '1 guard midió · 3 no supieron mirar · 2 pasadas sin contar (de 6)');
  // Una pasada que no vale no es ni lo uno ni lo otro, salga con lo que salga.
  assert.equal(clasificarPasada(fila(1, false)), 'sin contar');
  assert.equal(clasificarPasada(fila(0, false)), 'sin contar');
  assert.equal(clasificarPasada(undefined), 'sin contar');
  // Un código que no es de la casa tampoco se reparte a ojo.
  assert.equal(clasificarPasada(fila(7)), 'sin contar');
});

test('SCRUM-1336 · E3 · la puerta, SIN TOCARLA: un guard que pasa de 1 a 2 se mueve de «midieron» a «no llegaron a medir»', () => {
  // `scripts/guards-visuales.mjs` es de SCRUM-1343 y no se toca. Su `lineaDeArranque` ya da el
  // agregado; aquí se comprueba, con sus funciones puras, que el cambio de este ticket se VE en ella.
  const filaDe = (status, salida) => { const d = desenlaceDelHijo({ status }, salida); return { g: 'guard:x', ...d, cuentas: leerVeredicto(salida) }; };
  const dicho = (cuentas) => 'algo\n' + veredictoDe(cuentas).linea + '\n';

  const antes = recuento([filaDe(1, '🔴 NO SUPE MIRAR\n')]);
  assert.equal(antes.lineaDeArranque, '1 guard midió · 0 no arrancaron · 0 arrancaron y no llegaron a medir');
  assert.equal(antes.rojos, 1, 'antes del arreglo la puerta lo contaba entre los que midieron y encontraron algo');

  const despues = recuento([filaDe(SALIDA_NO_SUPE_MEDIR, dicho({ hallazgos: 0, ciegos: 2 }))]);
  assert.equal(despues.lineaDeArranque, '0 guards midieron · 0 no arrancaron · 1 arrancó y no llegó a medir');
  assert.deepEqual([despues.rojos, despues.ciegos], [0, 1]);

  // EL POSITIVO: con un hallazgo real sigue entre los que midieron, haya ciegos o no.
  const conHallazgo = recuento([filaDe(SALIDA_HALLAZGO, dicho({ hallazgos: 1, ciegos: 3 }))]);
  assert.equal(conHallazgo.lineaDeArranque, '1 guard midió · 0 no arrancaron · 0 arrancaron y no llegaron a medir');
  assert.deepEqual([conHallazgo.rojos, conHallazgo.rojosConCiegos], [1, 1], 'y la puerta dice que quedaron casos sin medir');
});

// ── ⑥ LA EVIDENCIA CON NAVEGADOR ───────────────────────────────────────────────────────────────

const resumenDe = (etiqueta) => JSON.parse(fs.readFileSync(path.join(EVIDENCIAS, etiqueta + '-resumen.json'), 'utf8'));
const GUARD_DE = (f) => f.replace(/^guard-/, '').replace(/\.mjs$/, '');

test('SCRUM-1336 · la evidencia con navegador dice lo que el registro afirma: en ciego, antes 1 y después 2; con hallazgo, 1; limpio, 0', () => {
  const antes = resumenDe('antes');
  const despues = resumenDe('despues');
  const pasadas = (r) => r.filas.filter((f) => !f.esMutacion);
  const salida = (r, id) => { const f = pasadas(r).find((x) => x.id === id); return f && f.valida ? f.exit : 'SIN PASADA VÁLIDA'; };

  // SUELO: los dos resúmenes están enteros, y son de dos SHA distintos.
  assert.match(antes.sha, /^[0-9a-f]{40}$/);
  assert.match(despues.sha, /^[0-9a-f]{40}$/);
  assert.notEqual(antes.sha, despues.sha, 'el «antes» y el «después» se midieron sobre el MISMO commit: no comparan nada');
  assert.deepEqual([pasadas(antes).length, antes.de, pasadas(despues).length, despues.de], [33, 33, 33, 33]);
  assert.deepEqual([...pasadas(antes), ...pasadas(despues)].filter((f) => !f.valida).map((f) => f.id), [], 'hay pasadas que no cuentan');

  for (const f of [...SEIS, SEPTIMO]) {
    const g = GUARD_DE(f);
    // El control del banco y el positivo de la C: limpio 0 y hallazgo real 1, ANTES y DESPUÉS.
    assert.deepEqual([salida(antes, g + '-limpio'), salida(despues, g + '-limpio')], [0, 0], g + ' · limpio');
    assert.deepEqual([salida(antes, g + '-hallazgo'), salida(despues, g + '-hallazgo')], [1, 1], g + ' · un hallazgo real tiene que seguir saliendo 1');
    // El rojo primero de la B: 0 hallazgos y sólo ciegos → antes 1, después 2.
    assert.deepEqual([salida(antes, g + '-ciego'), salida(despues, g + '-ciego')], [1, 2], g + ' · sólo ciegos');
  }
  // Los seis tienen además el mixto: hallazgo Y ciego sigue saliendo 1, y ahora con las dos cuentas.
  for (const f of SEIS) {
    const g = GUARD_DE(f);
    assert.deepEqual([salida(antes, g + '-mixto'), salida(despues, g + '-mixto')], [1, 1], g + ' · mixto');
    const fila = pasadas(despues).find((x) => x.id === g + '-mixto');
    const cuentas = leerVeredicto(fila.veredicto);
    assert.ok(cuentas && cuentas.hallazgos >= 1 && cuentas.ciegos >= 1, g + ' · el mixto tiene que decir las DOS cuentas: ' + fila.veredicto);
  }
  // Los otros caminos de ciego que se retiraron, y los tres donde un ciego fabricaba hallazgos por ausencia.
  for (const id of ['contraste-ciego-suelo', 'marcadores-en-pantalla-ciego-banco', 'contraste-ciego-ausencia', 'marcadores-en-pantalla-ciego-ausencia', 'objetivo-tactil-ciego-ausencia']) {
    assert.deepEqual([salida(antes, id), salida(despues, id)], [1, 2], id);
  }
  // Antes ninguno decía sus cuentas; después las dicen los siete en TODAS sus pasadas (E1, visto correr).
  assert.deepEqual(pasadas(antes).filter((f) => f.veredicto).map((f) => f.id), []);
  assert.deepEqual(pasadas(despues).filter((f) => !leerVeredicto(f.veredicto)).map((f) => f.id), []);

  // Y la línea agregada (E2), sobre las pasadas de verdad — los seis y el séptimo, por separado.
  const linea = (r, grupo, escenario) => lineaDeLosQueMidieron(pasadas(r).filter((f) => f.grupo === grupo && f.escenario === escenario));
  assert.equal(linea(antes, 'seis', 'ciego'), '6 guards midieron · 0 no supieron mirar · 0 pasadas sin contar (de 6)');
  assert.equal(linea(despues, 'seis', 'ciego'), '0 guards midieron · 6 no supieron mirar · 0 pasadas sin contar (de 6)');
  assert.equal(linea(antes, 'septimo', 'ciego'), '1 guard midió · 0 no supieron mirar · 0 pasadas sin contar (de 1)');
  assert.equal(linea(despues, 'septimo', 'ciego'), '0 guards midieron · 1 no supo mirar · 0 pasadas sin contar (de 1)');
  assert.equal(linea(despues, 'seis', 'hallazgo'), '6 guards midieron · 0 no supieron mirar · 0 pasadas sin contar (de 6)');
});

test('SCRUM-1336 · las mutaciones con navegador están VISTAS, cada una contra su pasada sin mutar, y cubren a los siete', () => {
  const despues = resumenDe('despues');
  const mutaciones = despues.filas.filter((f) => f.esMutacion);
  console.log('  [SCRUM-1336] mutaciones con navegador: ' + mutaciones.length + ' de ' + despues.deMutaciones
    + ' · vistas ' + mutaciones.filter((f) => f.valida && f.mutacion && f.mutacion.vista).length);
  assert.deepEqual([mutaciones.length, despues.deMutaciones], [17, 17]);
  assert.deepEqual(mutaciones.filter((f) => !f.valida || !f.mutacion || !f.mutacion.vista).map((f) => f.id), [], 'mutaciones MUDAS o sin contar');
  for (const f of [...SEIS, SEPTIMO]) {
    const g = GUARD_DE(f);
    // El defecto, vuelto a poner: el ciego deja de salir 2.
    const vuelve = mutaciones.find((m) => m.id === g + '-mut-ciego-a-hallazgo');
    assert.deepEqual([vuelve.mutacion.sinMutar, vuelve.exit], [2, 1], g + ' · ciego-a-hallazgo');
    // El contrario, que es el que la aceptación C teme: el hallazgo deja de salir 1.
    const alReves = mutaciones.find((m) => m.id === g + '-mut-hallazgo-a-ciego');
    assert.deepEqual([alReves.mutacion.sinMutar, alReves.exit], [1, 2], g + ' · hallazgo-a-ciego');
  }
});
