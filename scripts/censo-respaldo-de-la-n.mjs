// scripts/censo-respaldo-de-la-n.mjs — SCRUM-801
//
//   npm run censo:respaldo-n
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ¿EN CUÁNTAS PANTALLAS LA «N» ABRE **OTRA COSA**? **ESTO NO ARREGLA NADA: MIDE.**
//
// El despacho de `app.js` es éste, y su última línea es el respaldo:
//
//     const accion = A.accionDe(window.appState && window.appState.view);
//     if (accion) { accion(); return; }
//     if (typeof openQuickQuoteModal === 'function') openQuickQuoteModal();
//
// O sea: en una vista **sin destino registrado** la «N» no se queda quieta — abre la COTIZACIÓN
// RÁPIDA. Medido con teclado real en SCRUM-769: en Productos y en Proveedores pasa exactamente
// eso. Este censo contesta en cuántas más, sin lista cableada.
//
// ── LA POBLACIÓN NO ES «LAS VISTAS»: ES LO QUE PUEDE VALER `appState.view` ──────────────────
// 🔴 Y la diferencia decide. El despacho no pregunta por la función que pintó la pantalla, sino
// por `appState.view`. Quien fija ese valor es `renderView(view)` en `app.js`, y sus destinos
// posibles son las **etiquetas `case` de su `switch (view)`**. Censar `render*View` mediría otra
// cosa: hay vistas que se pintan desde otra (`renderQuoteDetailView`) y `case` que no pintan
// nada. Por eso la población sale del `switch`, POR AST — no de un `grep`, que confunde la
// etiqueta con cualquier cadena igual escrita en un comentario.
//
// ── Y LOS DESTINOS SALEN TAMBIÉN POR AST ────────────────────────────────────────────────────
// Cada vista declara el suyo con `window.atajoNuevo.registrar('<clave>', …)`. Se recogen las
// llamadas REALES —`CallExpression` cuyo `.registrar` cuelga de `atajoNuevo`—, no las menciones.
// Un `registrar` cuya clave NO sea una cadena literal **no se cuenta como cero**: sale en
// `NO LEGIBLES`, porque una clave calculada es un destino que este instrumento no sabe ver.
//
// ── LOS TRES SUELOS, PARA QUE UN CERO SEA UN DATO ───────────────────────────────────────────
//   ① si no aparece el `switch (view)` de `renderView` → CIEGO, no «cero pantallas».
//   ② si la población baja de `MINIMO_ETIQUETAS` → CIEGO: el árbol no encoge así.
//   ③ si no aparece NINGÚN `registrar` → CIEGO: hay seis, y cero significaría que no supe mirar.
//
// ── CONTROL POSITIVO, DENTRO DEL INSTRUMENTO ────────────────────────────────────────────────
// `products` y `proveedores` YA sabemos que caen al respaldo: se midió con teclado real. Si el
// censo no los encuentra, **no está viendo** y sale con 2 aunque su lista parezca razonable.
//
// SALIDAS: 0 censo completo · 2 no supe medir (suelo o control positivo caídos).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const APP = path.join(DIR_JS, 'app.js');

/** El suelo de la población. Hoy son 27; nadie borra doce pantallas de una tacada. */
export const MINIMO_ETIQUETAS = 20;
/** El suelo de los destinos. Hoy son 6. */
export const MINIMO_REGISTROS = 4;
/** Las dos que se midieron con teclado real cayendo al respaldo (SCRUM-769). */
export const CONTROL_POSITIVO = ['products', 'providers'];

const fuente = (f) => ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

function recorrer(nodo, ver) {
  ver(nodo);
  ts.forEachChild(nodo, (h) => recorrer(h, ver));
}

/**
 * Las etiquetas `case` del `switch (view)` de `renderView`, en el orden en que están escritas,
 * con el rótulo que cada una pone en la cabecera (`viewTitle.textContent = …`).
 *
 * Devuelve `null` si no encuentra ese `switch`: el llamante decide que eso es ceguera, no cero.
 */
export function etiquetasDeVista(ficheroApp = APP) {
  const sf = fuente(ficheroApp);
  let sw = null;
  recorrer(sf, (n) => {
    if (sw) return;
    if (!ts.isFunctionDeclaration(n) || !n.name || n.name.text !== 'renderView') return;
    recorrer(n, (m) => {
      if (sw) return;
      if (ts.isSwitchStatement(m) && ts.isIdentifier(m.expression) && m.expression.text === 'view') sw = m;
    });
  });
  if (!sw) return null;

  const out = [];
  let hayDefecto = false;
  for (const c of sw.caseBlock.clauses) {
    if (ts.isDefaultClause(c)) { hayDefecto = true; continue; }
    if (!ts.isStringLiteral(c.expression)) {
      out.push({ clave: null, rotulo: c.expression.getText(sf), legible: false });
      continue;
    }
    out.push({
      clave: c.expression.text,
      rotulo: rotuloDe(c, sf),
      alias: aliasDe(c, sf),
      pinta: pintaDe(c, sf),
      legible: true,
    });
  }
  return { etiquetas: out, hayDefecto };
}

/**
 * El rótulo que ese `case` pone en la cabecera. **TODOS**, no el primero.
 *
 * 🔴 Por qué todos: `export`, `team` y `settings` ponen «Inicio» si el usuario no es admin y su
 * rótulo de verdad si lo es. Quedarse con el primero los pintaba a los tres como «Inicio» —un
 * dato falso con forma de dato—, y este censo se lee para decidir si la cotización rápida encaja
 * en cada pantalla. Se enseñan los dos y se ve que la pantalla depende del rol.
 */
function rotuloDe(clausula, sf) {
  const vistos = [];
  for (const st of clausula.statements) {
    recorrer(st, (n) => {
      if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
      if (!/viewTitle\.textContent$/.test(n.left.getText(sf))) return;
      const v = ts.isStringLiteral(n.right) ? n.right.text : `«${n.right.getText(sf)}» (no literal)`;
      if (!vistos.includes(v)) vistos.push(v);
    });
  }
  return vistos.length ? vistos.join(' / ') : '(sin rótulo propio)';
}

/**
 * Qué `render*View` pinta ese `case`. Sirve para cruzar esta población con la del censo de
 * SCRUM-768 —que mide sobre el DOM ejecutado quién tiene botón primario de crear—, que es la
 * pregunta que decide si el respaldo estorba en esa pantalla o sólo ocupa un hueco vacío.
 */
// 🔴 SE RECOGEN IDENTIFICADORES, NO LA EXPRESIÓN LLAMADA, y el motivo se midió aquí mismo: dos
// `case` invocan `(window.renderProductsView || renderProductsView)(…)`. Mirando el callee, su
// texto es el paréntesis entero y no casa — así que Productos y Proveedores salían como «no pinta
// ninguna vista», que es FALSO y con forma de dato. Un identificador `render*View` dentro del
// `case` es una referencia a esa vista, la llame quien la llame.
function pintaDe(clausula, sf) {
  const vistos = [];
  recorrer(clausula, (n) => {
    if (!ts.isIdentifier(n)) return;
    const t = n.text;
    if (/^render[A-Z]\w*View$/.test(t) && !vistos.includes(t)) vistos.push(t);
  });
  return vistos;
}

/**
 * ¿Este `case` es un ALIAS de otro? `case 'operarios': return renderView('team', options);`
 *
 * 🔴 Importa para lo que se mide: `renderView` vuelve a entrar y deja `appState.view = 'team'`,
 * así que **`appState.view` nunca se queda valiendo `operarios`**. Contarlo como una pantalla
 * más sin decirlo inflaría el censo con una etiqueta que el despacho no llega a ver.
 */
function aliasDe(clausula, sf) {
  let destino = null;
  for (const st of clausula.statements) {
    if (!ts.isReturnStatement(st) || !st.expression) continue;
    const e = st.expression;
    if (!ts.isCallExpression(e) || e.expression.getText(sf) !== 'renderView') continue;
    const a0 = e.arguments[0];
    destino = a0 && ts.isStringLiteral(a0) ? a0.text : `«${a0 ? a0.getText(sf) : '?'}» (no literal)`;
  }
  return destino;
}

/**
 * Los destinos registrados: `{ claves, noLegibles }`. Recorre TODO `public/dashboard/js`.
 * Una llamada con clave calculada va a `noLegibles` — ceguera declarada, no ausencia.
 */
export function destinosRegistrados(dir = DIR_JS) {
  const claves = new Map(); // clave → [fichero:línea]
  const noLegibles = [];
  for (const nombre of fs.readdirSync(dir).sort()) {
    if (!nombre.endsWith('.js')) continue;
    const f = path.join(dir, nombre);
    const sf = fuente(f);
    recorrer(sf, (n) => {
      if (!ts.isCallExpression(n)) return;
      const e = n.expression;
      if (!ts.isPropertyAccessExpression(e) || e.name.text !== 'registrar') return;
      // El objeto tiene que ser `atajoNuevo` (o `window.atajoNuevo`): así no entra el
      // `registrar` de otra pieza que se llame igual.
      const obj = e.expression.getText(sf);
      if (!/(^|\.)atajoNuevo$/.test(obj)) return;
      const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const donde = `${nombre}:${linea}`;
      const a0 = n.arguments[0];
      if (!a0 || !ts.isStringLiteral(a0)) { noLegibles.push(`${donde} → ${a0 ? a0.getText(sf) : '(sin argumento)'}`); return; }
      if (!claves.has(a0.text)) claves.set(a0.text, []);
      claves.get(a0.text).push(donde);
    });
  }
  return { claves, noLegibles };
}

/** El censo entero. `motivo` no nulo = ciego. */
export function censar({ ficheroApp = APP, dir = DIR_JS } = {}) {
  const sw = etiquetasDeVista(ficheroApp);
  if (!sw) return { motivo: 'no encuentro el `switch (view)` de `renderView` en app.js' };
  const { etiquetas, hayDefecto } = sw;
  const legibles = etiquetas.filter((e) => e.legible);
  if (legibles.length < MINIMO_ETIQUETAS) {
    return { motivo: `sólo ${legibles.length} etiquetas de vista y el suelo son ${MINIMO_ETIQUETAS}` };
  }
  const { claves, noLegibles } = destinosRegistrados(dir);
  if (claves.size < MINIMO_REGISTROS) {
    return { motivo: `sólo ${claves.size} destinos registrados y el suelo son ${MINIMO_REGISTROS}` };
  }
  const conDestino = legibles.filter((e) => claves.has(e.clave));
  const alRespaldo = legibles.filter((e) => !claves.has(e.clave));
  const registradasSinEtiqueta = [...claves.keys()].filter((k) => !legibles.some((e) => e.clave === k)).sort();
  return {
    motivo: null,
    etiquetas,
    hayDefecto,
    conDestino,
    alRespaldo,
    claves,
    noLegibles,
    registradasSinEtiqueta,
  };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════

function principal() {
  const c = censar();
  if (c.motivo) {
    console.error(`🔴 CIEGO: ${c.motivo}.`);
    console.error('   No se imprime ningún número: un cero por no haber sabido mirar es la peor cifra posible.');
    return 2;
  }

  console.log('═══ LA POBLACIÓN · lo que puede valer `appState.view` ═══');
  console.log(`   etiquetas \`case\` del \`switch (view)\` : ${c.etiquetas.length}`
    + (c.hayDefecto ? '  (+ un `default:`)' : '  (SIN `default:`)'));
  console.log(`   con destino registrado                : ${c.conDestino.length}`);
  console.log(`   🔴 SIN destino → CAEN AL RESPALDO      : ${c.alRespaldo.length}`);

  console.log('\n═══ ✅ LAS QUE SÍ TIENEN DESTINO ═══');
  for (const e of c.conDestino) {
    console.log(`   ${e.clave.padEnd(16)} ${String(e.rotulo).padEnd(20)} ← ${c.claves.get(e.clave).join(', ')}`);
  }

  console.log('\n═══ 🔴 LAS QUE CAEN AL RESPALDO · ahí la «N» abre la COTIZACIÓN RÁPIDA ═══');
  for (const e of c.alRespaldo) {
    const pinta = e.pinta.length ? e.pinta.join(' + ') : '(no pinta ninguna render*View)';
    console.log(`   ${e.clave.padEnd(16)} ${String(e.rotulo).padEnd(26)} ${pinta}`
      + `${e.alias ? `   ⚠️ ALIAS: reentra como «${e.alias}»` : ''}`);
  }
  const alias = c.alRespaldo.filter((e) => e.alias);
  if (alias.length) {
    console.log(`   ⚠️ ${alias.length} de esas ${c.alRespaldo.length} son ALIAS: `
      + '`renderView` vuelve a entrar y `appState.view` acaba valiendo otra cosa, así que el');
    console.log('      despacho nunca las ve con ese valor. Se enseñan, no se esconden.');
  }

  if (c.registradasSinEtiqueta.length) {
    console.log('\n═══ ⚠️ DESTINOS REGISTRADOS QUE NO SON NINGUNA ETIQUETA ═══');
    console.log('   (se registran y nunca se consultan: la «N» no los alcanzaría)');
    for (const k of c.registradasSinEtiqueta) console.log(`   ${k} ← ${c.claves.get(k).join(', ')}`);
  }

  const noLeidas = c.etiquetas.filter((e) => !e.legible);
  if (noLeidas.length || c.noLegibles.length) {
    console.log('\n═══ ⚠️ NO LEGIBLES · declarados, no contados como cero ═══');
    for (const e of noLeidas) console.log(`   etiqueta no literal: ${e.rotulo}`);
    for (const s of c.noLegibles) console.log(`   registrar con clave calculada: ${s}`);
  }

  console.log('\n═══ ✅ CONTROL POSITIVO DEL INSTRUMENTO ═══');
  const faltan = CONTROL_POSITIVO.filter((k) => !c.alRespaldo.some((e) => e.clave === k));
  if (faltan.length) {
    console.error(`   🔴 el censo NO encuentra ${faltan.join(' ni ')} entre las que caen, y con teclado`);
    console.error('      real (SCRUM-769) se midió que caen. El instrumento no está viendo.');
    return 2;
  }
  console.log(`   ${CONTROL_POSITIVO.join(' y ')} salen entre las que caen, como se midió con teclado real.`);
  return 0;
}

if (ejecutadoDirectamente(import.meta.url)) process.exit(principal());
