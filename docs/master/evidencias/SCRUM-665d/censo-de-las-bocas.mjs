// docs/master/evidencias/SCRUM-665d/censo-de-las-bocas.mjs — SCRUM-665 (D) · 17-sep-2026
//
// SOLO LECTURA. No importa nada de `src/`, no abre base, no toca red. Lee un árbol EXPORTADO de
// `origin/main` con `git archive` y lo analiza por AST.
//
// QUÉ CONTESTA
//   ① ¿Cuántas bocas del embudo `crearFacturaEmitida` hay HOY en main, y en qué línea EXACTA?
//   ② Para cada una: quién la llama · si la lectura del MERCHANT cae dentro o fuera de la
//      `$transaction` · qué haría falta para escribir el emisor congelado ahí.
//
// POR QUÉ AST Y NO `grep` (SCRUM-203): un `grep` de `crearFacturaEmitida` casa también el import,
// el comentario que lo nombra y el propio fichero que lo define. Aquí una BOCA es una
// `CallExpression`, no una línea de texto que contiene un nombre.
//
// SUELO (si esto no se cumple, el censo se declara CIEGO y sale con 3):
//   · ve los ficheros .ts que `git ls-tree` cuenta en `origin/main:src/` (población esperada)
//   · encuentra la DEFINICIÓN de `crearFacturaEmitida` (si no la ve, no está mirando el árbol)
//   · encuentra al menos una llamada al congelador de CLIENTE (el precedente de SCRUM-729, que
//     SABEMOS que está). Un censo que no ve el patrón ya construido no puede opinar del que falta.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = process.argv[2];
const POBLACION_ESPERADA = Number(process.argv[3] || 288);
if (!RAIZ) {
  console.error('uso: node censo-de-las-bocas.mjs <raiz-del-arbol-exportado> [poblacion-esperada]');
  process.exit(2);
}

const EMBUDO = 'crearFacturaEmitida';
const RUTA_EMBUDO = 'src/modules/invoicing/domain/crearFacturaEmitida.ts';
const LECTORES_CLIENTE = new Set(['congelarCliente', 'congelarParaRectificativa', 'congelarDesdeFicha']);
const METODOS_LECTURA = new Set(['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow', 'findMany']);
const VERBOS_HTTP = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);

function ficherosTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(e.name)) ficherosTs(p, acc);
    } else if (e.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

const ficheros = ficherosTs(RAIZ);
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

const nombreDe = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null);

/** Nombre de la función llamada, suelta o como `obj.metodo()`. */
function nombreLlamado(nodo) {
  if (!ts.isCallExpression(nodo)) return null;
  const c = nodo.expression;
  return ts.isPropertyAccessExpression(c) ? nombreDe(c.name) : nombreDe(c);
}

/** `x.y.$transaction(...)` → true. */
function esTransaccion(nodo) {
  if (!ts.isCallExpression(nodo)) return false;
  const c = nodo.expression;
  return ts.isPropertyAccessExpression(c) && nombreDe(c.name) === '$transaction';
}

/** `algo.invoice.create` / `algo.merchant.findUnique` → { modelo, metodo }. */
function modeloYMetodo(nodo) {
  if (!ts.isCallExpression(nodo)) return null;
  const c = nodo.expression;
  if (!ts.isPropertyAccessExpression(c)) return null;
  const metodo = nombreDe(c.name);
  const recep = c.expression;
  if (!ts.isPropertyAccessExpression(recep)) return null;
  return { modelo: nombreDe(recep.name), metodo, receptor: recep.expression.getText() };
}

function linea(sf, nodo) {
  return sf.getLineAndCharacterOfPosition(nodo.getStart(sf)).line + 1;
}

/** Contenedores hacia arriba: funciones con nombre, ruta HTTP y la `$transaction` que envuelve. */
function contexto(sf, nodo) {
  const fns = [];
  let ruta = null;
  let tx = null;
  let n = nodo.parent;
  while (n) {
    if (ts.isFunctionDeclaration(n) && n.name) fns.push(nombreDe(n.name));
    else if (ts.isMethodDeclaration(n) && n.name) fns.push(nombreDe(n.name));
    else if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name)) fns.push(nombreDe(n.name));
    else if (ts.isCallExpression(n)) {
      if (!tx && esTransaccion(n)) tx = { desde: n.getStart(sf), hasta: n.getEnd(), linea: linea(sf, n) };
      const c = n.expression;
      if (!ruta && ts.isPropertyAccessExpression(c) && VERBOS_HTTP.has(nombreDe(c.name) || '')) {
        const a0 = n.arguments[0];
        if (a0 && ts.isStringLiteralLike(a0)) ruta = `${(nombreDe(c.name) || '').toUpperCase()} ${a0.text}`;
      }
    }
    n = n.parent;
  }
  return { fns, ruta, tx };
}

/**
 * La función que contiene al nodo, SALTÁNDOSE el callback de la propia `$transaction`: queremos
 * el handler entero, porque la pregunta del encargo es si la lectura cae dentro o fuera de la tx,
 * y para eso hay que mirar también lo que pasa ANTES de abrirla.
 */
function envolturaFuncion(sf, nodo) {
  let n = nodo.parent;
  while (n) {
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) ||
        ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
      const p = n.parent;
      const esCallbackDeTx = p && ts.isCallExpression(p) && esTransaccion(p);
      if (!esCallbackDeTx) return { desde: n.getStart(sf), hasta: n.getEnd() };
    }
    n = n.parent;
  }
  return { desde: 0, hasta: sf.getEnd() };
}

const bocas = [];
let definicionVista = false;
let llamadasCongelarCliente = 0;
let ficherosParseados = 0;

for (const f of ficheros) {
  const texto = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(rel(f), texto, ts.ScriptTarget.Latest, true);
  ficherosParseados++;
  const esElFicheroDelEmbudo = rel(f) === RUTA_EMBUDO;

  const todas = [];
  (function anda(n) {
    if (ts.isCallExpression(n)) todas.push(n);
    if (ts.isFunctionDeclaration(n) && nombreDe(n.name) === EMBUDO) definicionVista = true;
    ts.forEachChild(n, anda);
  })(sf);

  for (const n of todas) {
    const nom = nombreLlamado(n);
    if (nom && LECTORES_CLIENTE.has(nom)) llamadasCongelarCliente++;
    if (nom !== EMBUDO) continue;
    if (esElFicheroDelEmbudo) continue;

    const ctx = contexto(sf, n);
    const env = envolturaFuncion(sf, n);
    const dentro = (x) => x.getStart(sf) >= env.desde && x.getEnd() <= env.hasta;
    const enTx = (x) => !!(ctx.tx && x.getStart(sf) >= ctx.tx.desde && x.getEnd() <= ctx.tx.hasta);

    const lecturasCliente = todas
      .filter((x) => dentro(x) && LECTORES_CLIENTE.has(nombreLlamado(x) || ''))
      .map((x) => ({ que: nombreLlamado(x), linea: linea(sf, x), enTx: enTx(x) }));

    const lecturasMerchant = todas
      .filter((x) => {
        if (!dentro(x)) return false;
        const mm = modeloYMetodo(x);
        return mm && mm.modelo === 'merchant' && METODOS_LECTURA.has(mm.metodo || '');
      })
      .map((x) => {
        const mm = modeloYMetodo(x);
        return { que: `${mm.receptor}.merchant.${mm.metodo}`, linea: linea(sf, x), enTx: enTx(x) };
      });

    // ¿alguna lectura de OTRO modelo trae el merchant por relación (`include: { merchant: … }`)?
    const porRelacion = todas
      .filter((x) => {
        if (!dentro(x)) return false;
        const mm = modeloYMetodo(x);
        if (!mm || !METODOS_LECTURA.has(mm.metodo || '') || mm.modelo === 'merchant') return false;
        return /\bmerchant\s*:\s*(true|\{)/.test(x.getText(sf));
      })
      .map((x) => {
        const mm = modeloYMetodo(x);
        return { que: `${mm.modelo}.${mm.metodo} (trae merchant)`, linea: linea(sf, x), enTx: enTx(x) };
      });

    bocas.push({
      fichero: rel(f),
      linea: linea(sf, n),
      quien: ctx.fns.slice(0, 3).reverse().join(' → ') || '(nivel de modulo)',
      ruta: ctx.ruta,
      txLinea: ctx.tx ? ctx.tx.linea : null,
      arg2: n.arguments[1] ? n.arguments[1].getText(sf).slice(0, 60) : '(ninguno)',
      lecturasCliente,
      lecturasMerchant,
      porRelacion,
    });
  }
}

const problemas = [];
if (ficherosParseados !== POBLACION_ESPERADA) {
  problemas.push(`poblacion: esperaba ${POBLACION_ESPERADA} ficheros .ts, parseados ${ficherosParseados}`);
}
if (!definicionVista) {
  problemas.push(`NO veo la definicion de ${EMBUDO}: no estoy mirando este arbol`);
}
if (llamadasCongelarCliente === 0) {
  problemas.push('NO veo ninguna llamada al congelador de CLIENTE: ese patron SI esta (SCRUM-729); si no lo veo, estoy ciego');
}

console.log('========================================================================');
console.log('CENSO DE LAS BOCAS DEL EMBUDO · SCRUM-665 (D) · SOLO LECTURA');
console.log('========================================================================');
console.log(`POBLACION ....... ${ficherosParseados} ficheros .ts bajo src/ del arbol exportado (esperados ${POBLACION_ESPERADA})`);
console.log(`SUELO (a) ....... definicion de ${EMBUDO} vista: ${definicionVista ? 'SI' : 'NO'}`);
console.log(`SUELO (b) ....... llamadas al congelador de CLIENTE vistas: ${llamadasCongelarCliente}`);
console.log(`BOCAS ........... ${bocas.length}`);
if (problemas.length) {
  console.log('');
  console.log('SUELO CAIDO — este censo se declara CIEGO:');
  for (const p of problemas) console.log(`   · ${p}`);
  process.exit(3);
}
console.log('');

for (const [i, b] of bocas.entries()) {
  console.log(`-- BOCA ${i + 1} ------------------------------------------------------------`);
  console.log(`   ${b.fichero}:${b.linea}`);
  console.log(`   quien la llama .............: ${b.quien}`);
  if (b.ruta) console.log(`   ruta HTTP ..................: ${b.ruta}`);
  console.log(`   $transaction que la envuelve: ${b.txLinea ? `linea ${b.txLinea}` : 'NINGUNA'}`);
  console.log(`   2o argumento (cliente) .....: ${b.arg2}`);
  const pinta = (etiqueta, lista) => {
    if (!lista.length) {
      console.log(`   ${etiqueta}: 0 en esta funcion`);
      return;
    }
    for (const l of lista) {
      console.log(`   ${etiqueta}: ${l.que} @ linea ${l.linea} -> ${l.enTx ? 'DENTRO de la tx' : 'FUERA de la tx'}`);
    }
  };
  pinta('lectura CLIENTE ', b.lecturasCliente);
  pinta('lectura MERCHANT', b.lecturasMerchant);
  pinta('merchant por rel', b.porRelacion);
  console.log('');
}
