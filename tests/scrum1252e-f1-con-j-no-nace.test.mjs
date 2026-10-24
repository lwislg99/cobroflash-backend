// tests/scrum1252e-f1-con-j-no-nace.test.mjs — SCRUM-1252e
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// QUE NINGÚN CAMINO DE CÓDIGO PUEDA DAR A LUZ UN DOCUMENTO `F1` CON NÚMERO `J-`.
//
// El censo del 10-ago contó cinco. Producción, medida por el fundador el 23-oct (SCRUM-1252
// c.20700): 2 filas, 0 con `type = 'F1'`, 2 con número `J-`. Los cinco no están ahí. La decisión
// (c.20683): con cero filas no se arregla nada; sólo se impide que nazca uno nuevo.
//
// Una `F1` con `J-` sólo puede aparecer por dos puertas, y este fichero cierra las dos LEYENDO
// el código, sin tocar el camino de emisión (regla 38):
//
//   · NACER así: una creación cuyo `number` empiece por `J-`. → ② y ③.
//   · CONVERTIRSE: un update que reescriba `type` o `number` de una fila que ya existe (las dos
//     filas `J-` de producción son justificantes: un `type: 'F1'` encima las haría F1 con J-).
//     → ① y ④.
//
// ── POR QUÉ NO SE MIRA EL `type` DE LAS CREACIONES ──────────────────────────────────────
// Si ningún número nuevo puede empezar por `J-`, el tipo que lleve la fila no cambia nada para
// esta pregunta. De dónde sale cada `type` está medido en el registro (docs/master/SCRUM-1252.md,
// tramo 1252e), y los literales `F1` de los cinco escritores ya los sujeta `scrum1260c`.
//
// ── LO QUE SE REUTILIZA, Y NO SE ESCRIBE OTRA VEZ ───────────────────────────────────────
//   · Las escrituras de `invoice` y sus campos: `scripts/_censo-escrituras-sin-version.mjs`
//     (SCRUM-1285c/1381). Lo único propio es resolver sus OPACOS: el censo los deja en `null`
//     («no se pueden leer»), y aquí un opaco que no se resuelve sale ROJO, nunca «no toca».
//   · De dónde sale el `number` de cada creación: `tests/_embudo-factura.mjs` (SCRUM-203).
//
// ── LO QUE ESTO NO VE (dicho aquí, no descubierto en un rojo raro) ──────────────────────
//   · Un receptor con alias (`const t = tx.invoice; t.update(…)`): lo mismo que no ve SCRUM-203.
//   · SQL fuera de `src/` y `scripts/` (psql, una migración a mano): reglas 3 y 29.
//   · FILAS: las de staging y dev no se han medido. Esto vigila código, no datos.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { medir, censarPiezas } from '../scripts/_censo-escrituras-sin-version.mjs';
import { analizarArbol, analizarFuente } from './_embudo-factura.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROHIBIDOS = ['type', 'number'];
const RESERVADOR = 'allocateInvoiceNumber';
const FORMATEADOR = 'formatInvoiceNumber';
const RUTA_RESERVADOR = 'src/modules/invoicing/domain/invoiceNumber.service.ts';
const RUTA_SERIES = 'src/core/documentos/formatoNumero.ts';

// La mutación cambia el `data` de un recordatorio (no es camino de emisión) para que escriba
// `type`: es exactamente la puerta «convertirse».
const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/billing/domain/invoiceReminder.service.ts',
    de: 'data: { reminder7SentAt: new Date() }',
    a: "data: { reminder7SentAt: new Date(), type: 'F1' }",
    cae: '① ningún update de Invoice escribe',
  },
];

// ── utilidades de AST ───────────────────────────────────────────────────────────────────

const parsear = (texto, nombre) => ts.createSourceFile(
  nombre, texto, ts.ScriptTarget.Latest, true, /\.tsx?$/.test(nombre) ? ts.ScriptKind.TS : ts.ScriptKind.JS,
);
const nombreDe = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null);
const pelar = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isAwaitExpression(n)
    || ts.isNonNullExpression(n) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)))) n = n.expression;
  return n;
};
const lineaDe = (n, sf) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const esFuncion = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)
  || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

function propiedad(obj, nombre) {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  for (const p of obj.properties) {
    if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && nombreDe(p.name) === nombre) {
      return ts.isPropertyAssignment(p) ? p.initializer : p.name;
    }
  }
  return null;
}

function recorrer(nodo, fn) {
  const v = (n) => { fn(n); ts.forEachChild(n, v); };
  v(nodo);
}

/** La declaración `X = …` visible desde `nodo`, de dentro hacia fuera. */
function declaracionDe(nombre, nodo, sf) {
  const ambitos = [];
  for (let p = nodo.parent; p; p = p.parent) if (esFuncion(p)) ambitos.push(p);
  ambitos.push(sf);
  for (const amb of ambitos) {
    let hallada = null;
    recorrer(amb, (n) => {
      if (!hallada && ts.isVariableDeclaration(n) && nombreDe(n.name) === nombre) hallada = n;
    });
    if (hallada) return hallada;
  }
  return null;
}

/** Las sentencias `return` de UNA función, sin bajar a las funciones que lleve dentro. */
function returnsDe(fn) {
  const out = [];
  const v = (n) => {
    if (n !== fn && esFuncion(n)) return;
    if (ts.isReturnStatement(n)) out.push(n);
    ts.forEachChild(n, v);
  };
  if (fn.body && !ts.isBlock(fn.body)) return [{ expression: fn.body }]; // flecha de expresión
  v(fn);
  return out;
}

// ── ① resolver los OPACOS del censo: qué campos escribe un `data` que no es un literal ──

/** Índice nombre → declaraciones de función, de todo `src/`. Se construye sólo si hace falta. */
let indice = null;
function funcionesDeSrc() {
  if (indice) return indice;
  indice = new Map();
  const visitar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { visitar(p); continue; }
      if (!/\.(ts|js|mjs)$/.test(e.name)) continue;
      const sf = parsear(fs.readFileSync(p, 'utf8'), p);
      recorrer(sf, (n) => {
        if (ts.isFunctionDeclaration(n) && n.name) {
          const l = indice.get(n.name.text) ?? [];
          l.push(n);
          indice.set(n.name.text, l);
        }
      });
    }
  };
  visitar(path.join(RAIZ, 'src'));
  return indice;
}

/**
 * Los campos que puede escribir una expresión usada como `data`, o `null` si no se puede saber.
 * `null` NO es «no toca»: es rojo. Formas que sabe leer: literal (con spreads), condicional,
 * identificador con su `const`/`let` y las asignaciones `id.k = …` de su ámbito, y la llamada
 * a una función de `src/` con nombre único cuyas salidas son literales.
 */
function camposDe(expr, sf, profundidad = 0, funciones = funcionesDeSrc) {
  expr = pelar(expr);
  if (!expr || profundidad > 4) return null;
  if (ts.isObjectLiteralExpression(expr)) {
    const out = new Set();
    for (const p of expr.properties) {
      if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
        const k = nombreDe(p.name);
        if (k === null) return null; // clave calculada
        out.add(k);
      } else if (ts.isSpreadAssignment(p)) {
        const s = camposDe(p.expression, sf, profundidad + 1, funciones);
        if (s === null) return null;
        for (const k of s) out.add(k);
      } else return null;
    }
    return out;
  }
  if (ts.isConditionalExpression(expr)) {
    const a = camposDe(expr.whenTrue, sf, profundidad + 1, funciones);
    const b = camposDe(expr.whenFalse, sf, profundidad + 1, funciones);
    return a && b ? new Set([...a, ...b]) : null;
  }
  if (ts.isIdentifier(expr)) {
    const decl = declaracionDe(expr.text, expr, sf);
    if (!decl || !decl.initializer) return null;
    const base = camposDe(decl.initializer, sf, profundidad + 1, funciones);
    if (base === null) return null;
    // Lo que se le añade después en su ámbito: `id.k = …` se lee; cualquier otra mutación, no.
    let ambito = decl.parent;
    while (ambito && !esFuncion(ambito) && !ts.isSourceFile(ambito)) ambito = ambito.parent;
    let opaco = false;
    recorrer(ambito, (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const l = n.left;
        if (ts.isPropertyAccessExpression(l) && nombreDe(l.expression) === expr.text) base.add(l.name.text);
        if (ts.isElementAccessExpression(l) && nombreDe(l.expression) === expr.text) opaco = true;
      }
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'Object.assign'
          && nombreDe(n.arguments[0]) === expr.text) opaco = true;
    });
    return opaco ? null : base;
  }
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const decls = funciones().get(expr.expression.text) ?? [];
    if (decls.length !== 1) return null;
    const fn = decls[0];
    const out = new Set();
    const rets = returnsDe(fn);
    if (!rets.length) return null;
    for (const r of rets) {
      const s = r.expression ? camposDe(r.expression, fn.getSourceFile(), profundidad + 1, funciones) : null;
      if (s === null) return null;
      for (const k of s) out.add(k);
    }
    return out;
  }
  return null;
}

/** Para una fila OPACA del censo, busca su llamada y resuelve su `data`. */
function resolverOpaco(fila, leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8')) {
  const sf = parsear(leer(fila.fichero), fila.fichero);
  let llamada = null;
  recorrer(sf, (n) => {
    if (!llamada && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === fila.metodo && lineaDe(n, sf) === fila.linea) llamada = n;
  });
  if (!llamada) return null;
  const arg = pelar(llamada.arguments[0]);
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const d = propiedad(arg, fila.metodo === 'upsert' ? 'update' : 'data');
  return d ? camposDe(d, sf) : null;
}

/** Juicio de UNA escritura de `invoice`: null si no toca nada prohibido, o el motivo. */
function motivoDeEscritura(fila, resolver = resolverOpaco) {
  const campos = fila.campos !== null ? new Set(fila.campos) : resolver(fila);
  if (campos === null) return 'su `data` no se puede leer: no se sabe si escribe type o number';
  const tocados = PROHIBIDOS.filter((k) => campos.has(k));
  return tocados.length ? `escribe ${tocados.join(' y ')}` : null;
}

function escriturasDeInvoice(filas) {
  return filas.filter((f) => f.modelo === 'invoice');
}

function ficherosDe(dir) {
  const out = [];
  const v = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(e.name)) v(p); continue; }
      if (/\.(ts|js|mjs)$/.test(e.name)) out.push(p);
    }
  };
  v(dir);
  return out;
}
const rel = (abs) => path.relative(RAIZ, abs).split(path.sep).join('/');

// ── ② el reservador: qué puede devolver ──────────────────────────────────────────────────

/**
 * Lo que puede devolver el reservador, leído por AST. Devuelve la lista de motivos por los que
 * un `return` podría NO ser un número de las series `F` o `<año>-…` (vacía = imposible un J-).
 */
function motivosDelReservador(sf, letraFactura) {
  const motivos = [];
  const fn = (nombre) => {
    let f = null;
    recorrer(sf, (n) => { if (!f && ts.isFunctionDeclaration(n) && n.name?.text === nombre) f = n; });
    return f;
  };
  const reservador = fn(RESERVADOR);
  const formateador = fn(FORMATEADOR);
  if (!reservador) return [`no encuentro ${RESERVADOR}`];
  if (!formateador) return [`no encuentro ${FORMATEADOR}`];

  const retsR = returnsDe(reservador);
  if (!retsR.length) motivos.push(`${RESERVADOR} sin return`);
  for (const r of retsR) {
    const e = pelar(r.expression);
    const llamaAlFormateador = (x) => ts.isCallExpression(pelar(x)) && nombreDe(pelar(x).expression) === FORMATEADOR;
    if (llamaAlFormateador(e)) continue;
    if (e && ts.isIdentifier(e)) {
      const d = declaracionDe(e.text, e, sf);
      const esConst = d && (d.parent.flags & ts.NodeFlags.Const) !== 0;
      if (esConst && llamaAlFormateador(d.initializer)) continue;
    }
    motivos.push(`${RESERVADOR}:${lineaDe(r, sf)} devuelve «${r.expression?.getText(sf)}», que no es un const de ${FORMATEADOR}`);
  }

  const retsF = returnsDe(formateador);
  if (!retsF.length) motivos.push(`${FORMATEADOR} sin return`);
  const anio = formateador.parameters[1] && nombreDe(formateador.parameters[1].name);
  for (const r of retsF) {
    const e = pelar(r.expression);
    // forma F: formatoNumeroDocumento(SERIES.factura, …) — empieza por la letra de la serie.
    if (e && ts.isCallExpression(e) && nombreDe(e.expression) === 'formatoNumeroDocumento'
        && e.arguments[0]?.getText(sf) === 'SERIES.factura') continue;
    // forma vieja: `${year}-…` — empieza por el año, un número.
    if (e && ts.isTemplateExpression(e) && e.head.text === '' && anio
        && nombreDe(e.templateSpans[0]?.expression) === anio) continue;
    motivos.push(`${FORMATEADOR}:${lineaDe(r, sf)} devuelve «${r.expression?.getText(sf)}», que no es serie F ni de año`);
  }
  if (typeof letraFactura !== 'string' || letraFactura.startsWith('J')) {
    motivos.push(`la letra de la serie de facturas es «${letraFactura}»: no se puede descartar un J-`);
  }
  return motivos;
}

/** La letra de `SERIES.factura`, leída del literal (sin `dist/`). */
function letraDeFactura(sf) {
  let letra = null;
  recorrer(sf, (n) => {
    if (ts.isVariableDeclaration(n) && nombreDe(n.name) === 'SERIES') {
      const obj = pelar(n.initializer);
      const v = propiedad(obj, 'factura');
      if (v && ts.isStringLiteralLike(v)) letra = v.text;
    }
  });
  return letra;
}

// ── ③ el nacimiento: el `number` de cada creación es un const del reservador ────────────

/**
 * Para cada creación que el embudo (SCRUM-203) da por buena, comprueba además que el número no
 * se REESCRIBE después: si es un identificador, su declaración es `const`. SCRUM-203 sólo mira
 * el inicializador, y un `let n = await allocate…; n = 'J-' + n` pasaría.
 */
function motivosDelNacimiento(creaciones, leer) {
  const motivos = [];
  const porFichero = new Map();
  for (const c of creaciones) {
    if (c.implementacion) continue;
    if (c.motivo) { motivos.push(`${rel(c.ruta)}:${c.linea} · ${c.motivo}`); continue; }
    const l = porFichero.get(c.ruta) ?? [];
    l.push(c);
    porFichero.set(c.ruta, l);
  }
  for (const [ruta, lista] of porFichero) {
    const sf = parsear(leer(ruta), ruta);
    for (const c of lista) {
      let datos = null;
      recorrer(sf, (n) => {
        if (datos || !ts.isCallExpression(n) || lineaDe(n, sf) !== c.linea) return;
        if (nombreDe(n.expression) === 'crearFacturaEmitida') datos = n.arguments[3];
        else if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'create') {
          datos = propiedad(pelar(n.arguments[0]), 'data');
        }
      });
      const numero = datos && propiedad(pelar(datos), 'number');
      if (!numero) { motivos.push(`${rel(ruta)}:${c.linea} · no encuentro su \`number\``); continue; }
      if (ts.isIdentifier(numero)) {
        const d = declaracionDe(numero.text, numero, sf);
        if (!d || (d.parent.flags & ts.NodeFlags.Const) === 0) {
          motivos.push(`${rel(ruta)}:${c.linea} · \`${numero.text}\` no es const: se puede reescribir después de reservarlo`);
        }
      }
    }
  }
  return motivos;
}

// ── ④ SQL en crudo que actualiza la tabla ────────────────────────────────────────────────

const SQL_QUE_ACTUALIZA = /\bupdate\s+"?invoices"?\b/i;
function sqlQueActualiza(texto, nombre) {
  const sf = parsear(texto, nombre);
  const out = [];
  recorrer(sf, (n) => {
    const raiz = ts.isTaggedTemplateExpression(n) ? n.tag : ts.isCallExpression(n) ? n.expression : null;
    if (!raiz) return;
    const metodo = ts.isPropertyAccessExpression(raiz) ? raiz.name.text : nombreDe(raiz);
    if (!/^\$(execute|query)Raw(Unsafe)?$/.test(metodo ?? '')) return;
    if (SQL_QUE_ACTUALIZA.test(n.getText(sf))) out.push(`${nombre}:${lineaDe(n, sf)}`);
  });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LOS CASOS SOBRE EL ÁRBOL
// ═══════════════════════════════════════════════════════════════════════════════════════════

const censo = medir();

test('SCRUM-1252e · ① ningún update de Invoice escribe `type` ni `number`, y los opacos se resuelven', (t) => {
  assert.equal(censo.noMedido, undefined, `🔴 CIEGO: el censo de escrituras no midió: ${censo.noMedido}`);
  const filas = escriturasDeInvoice(censo.filas);
  // Los scripts también son código que toca la base: se censan con la misma pieza.
  const scripts = censarPiezas(ficherosDe(path.join(RAIZ, 'scripts'))
    .map((p) => ({ nombre: rel(p), texto: fs.readFileSync(p, 'utf8') }))
    .filter((p) => /\binvoice\b/.test(p.texto)));
  const todas = [...filas, ...escriturasDeInvoice(scripts)];
  const opacas = todas.filter((f) => f.campos === null);
  t.diagnostic(`población: ${filas.length} escrituras de invoice en src/ + ${todas.length - filas.length} en scripts/ · ${opacas.length} opacas resueltas aquí`);
  for (const f of opacas) {
    const c = resolverOpaco(f);
    t.diagnostic(`  opaca ${f.fichero}:${f.linea} → ${c === null ? 'NO SE PUEDE LEER' : `{${[...c].join(', ')}}`}`);
  }
  assert.ok(filas.length >= 15, `🔴 CIEGO: sólo ${filas.length} escrituras de invoice en src/; el censo ha perdido su población`);
  const malas = todas
    .map((f) => ({ f, m: motivoDeEscritura(f) }))
    .filter((x) => x.m)
    .map((x) => `${x.f.fichero}:${x.f.linea} (${x.f.metodo}) · ${x.m}`);
  assert.deepEqual(malas, [],
    '🔴 Una escritura de Invoice puede reescribir type o number: es la puerta para convertir un ' +
      'justificante J- ya emitido en una F1 con J- (SCRUM-1252, c.20683). Una factura emitida no se ' +
      'edita (regla 29):\n  ' + malas.join('\n  '));
});

test('SCRUM-1252e · ② el reservador sólo devuelve números de serie F o de año: nunca J-', () => {
  const sfR = parsear(fs.readFileSync(path.join(RAIZ, RUTA_RESERVADOR), 'utf8'), RUTA_RESERVADOR);
  const sfS = parsear(fs.readFileSync(path.join(RAIZ, RUTA_SERIES), 'utf8'), RUTA_SERIES);
  const letra = letraDeFactura(sfS);
  assert.ok(letra, `🔴 CIEGO: no leo SERIES.factura en ${RUTA_SERIES}`);
  const motivos = motivosDelReservador(sfR, letra);
  assert.deepEqual(motivos, [], '🔴 El reservador podría devolver un número J-:\n  ' + motivos.join('\n  '));
});

test('SCRUM-1252e · ③ toda factura nace con el número del reservador, en un const que nadie reescribe', (t) => {
  const creaciones = [...analizarArbol(path.join(RAIZ, 'src')), ...analizarArbol(path.join(RAIZ, 'scripts'))];
  const reales = creaciones.filter((c) => !c.implementacion);
  t.diagnostic(`población: ${reales.length} creaciones de Invoice en src/ y scripts/`);
  assert.ok(reales.length >= 7, `🔴 CIEGO: sólo ${reales.length} creaciones; SCRUM-203 contaba siete en src/`);
  const motivos = motivosDelNacimiento(creaciones, (r) => fs.readFileSync(r, 'utf8'));
  assert.deepEqual(motivos, [], '🔴 Una factura puede nacer con un número que no sale del reservador:\n  ' + motivos.join('\n  '));
});

test('SCRUM-1252e · ④ ningún SQL en crudo de src/ ni de scripts/ actualiza la tabla invoices', (t) => {
  const ficheros = [...ficherosDe(path.join(RAIZ, 'src')), ...ficherosDe(path.join(RAIZ, 'scripts'))];
  t.diagnostic(`población: ${ficheros.length} ficheros`);
  assert.ok(ficheros.length > 300, `🔴 CIEGO: ${ficheros.length} ficheros`);
  const hallados = ficheros.flatMap((p) => sqlQueActualiza(fs.readFileSync(p, 'utf8'), rel(p)));
  assert.deepEqual(hallados, [], '🔴 SQL en crudo que actualiza invoices: puede reescribir type o number:\n  ' + hallados.join('\n  '));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LOS POSITIVOS SEMBRADOS: cada detector caza un caso fabricado. Sin ellos, los cuatro de arriba
// serían verdes sobre nada.
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1252e · sembrado ①: el censo + el resolvedor cazan type/number literales, opacos y spreads', () => {
  const fuente = [
    "async function a(id) { await prisma.invoice.update({ where: { id }, data: { number: 'J-0001' } }); }",
    "async function b(id) { await prisma.invoice.updateMany({ where: { id }, data: { type: 'F1' } }); }",
    "async function c(id) { const d = {}; d.type = 'F1'; await prisma.invoice.update({ where: { id }, data: d }); }",
    'async function e(id, body) { await prisma.invoice.update({ where: { id }, data: body }); }',
    "function g() { return { type: 'F1' }; }",
    'async function h(id) { const x = g(); await prisma.invoice.update({ where: { id }, data: { status: "paid", ...x } }); }',
    // y el negativo: un update limpio, opaco y resoluble, NO sale.
    'async function k(id) { const u = {}; u.reminder7SentAt = new Date(); await prisma.invoice.update({ where: { id }, data: u }); }',
  ].join('\n');
  const nombre = '__fabricado/f.ts';
  const filas = escriturasDeInvoice(censarPiezas([{ nombre, texto: fuente }]));
  assert.equal(filas.length, 6, `el censo debe ver las 6 escrituras fabricadas y ve ${filas.length}`);
  const sfFab = parsear(fuente, nombre);
  const funcionesFab = () => {
    const m = new Map();
    recorrer(sfFab, (n) => { if (ts.isFunctionDeclaration(n) && n.name) m.set(n.name.text, [n]); });
    return m;
  };
  const resolverFab = (fila) => {
    let llamada = null;
    recorrer(sfFab, (n) => {
      if (!llamada && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
          && n.expression.name.text === fila.metodo && lineaDe(n, sfFab) === fila.linea) llamada = n;
    });
    const d = propiedad(pelar(llamada.arguments[0]), 'data');
    return camposDe(d, sfFab, 0, funcionesFab);
  };
  const veredictos = filas.map((f) => [f.linea, motivoDeEscritura(f, resolverFab)]);
  assert.deepEqual(veredictos, [
    [1, 'escribe number'],
    [2, 'escribe type'],
    [3, 'escribe type'],
    [4, 'su `data` no se puede leer: no se sabe si escribe type o number'],
    [6, 'escribe type'],
    [7, null],
  ]);
});

test('SCRUM-1252e · sembrado ②: un reservador o un formateador que devuelve J- cae', () => {
  const bueno = [
    'export function formatInvoiceNumber(prefix, year, seq) {',
    '  if (seq > 1) return formatoNumeroDocumento(SERIES.factura, year, seq);',
    '  return `${year}-${prefix}-${seq}`;',
    '}',
    'export async function allocateInvoiceNumber(tx, m) {',
    '  const numero = formatInvoiceNumber(m.p, 2026, 1);',
    '  return numero;',
    '}',
  ];
  const sf = (lineas) => parsear(lineas.join('\n'), '__fabricado/r.ts');
  assert.deepEqual(motivosDelReservador(sf(bueno), 'F'), [], 'el negativo: el reservador bueno no da motivos');
  // formateador hostil
  const m1 = motivosDelReservador(sf(bueno.map((l) => l.replace('`${year}-${prefix}-${seq}`', '`J-${seq}`'))), 'F');
  assert.equal(m1.length, 1, `formateador con J-: ${JSON.stringify(m1)}`);
  // reservador que no devuelve lo del formateador
  const m2 = motivosDelReservador(sf(bueno.map((l) => l.replace('return numero;', "return 'J-' + numero;"))), 'F');
  assert.equal(m2.length, 1, `reservador con J-: ${JSON.stringify(m2)}`);
  // reservador con `let` reescribible
  const m3 = motivosDelReservador(sf(bueno.map((l) => l.replace('const numero', 'let numero'))), 'F');
  assert.equal(m3.length, 1, `reservador con let: ${JSON.stringify(m3)}`);
  // una serie de facturas que empezara por J
  assert.equal(motivosDelReservador(sf(bueno), 'J').length, 1);
});

test('SCRUM-1252e · sembrado ③: un número a mano o un let reescrito tras reservar caen', () => {
  const fuentes = {
    'a.ts': "async function a(tx) { return crearFacturaEmitida(tx, c, e, { number: 'J-0001', type: 'F1' }); }",
    'b.ts': 'async function b(tx) { let n = await allocateInvoiceNumber(tx, 1, {}); n = "J-" + n; return crearFacturaEmitida(tx, c, e, { number: n, type: "F1" }); }',
    'c.ts': 'async function c(tx) { const n = await allocateInvoiceNumber(tx, 1, {}); return crearFacturaEmitida(tx, c, e, { number: n, type: "F1" }); }',
  };
  const creaciones = Object.entries(fuentes).flatMap(([n, txt]) => analizarFuente(txt, n));
  assert.equal(creaciones.length, 3);
  const motivos = motivosDelNacimiento(creaciones, (r) => fuentes[r]);
  assert.equal(motivos.length, 2, `deben caer a.ts y b.ts, y c.ts no: ${JSON.stringify(motivos)}`);
  assert.ok(motivos.some((m) => m.includes('a.ts')) && motivos.some((m) => m.includes('b.ts')));
  assert.ok(!motivos.some((m) => m.includes('c.ts')));
});

test('SCRUM-1252e · sembrado ④: un UPDATE en crudo sobre invoices cae; un SELECT no', () => {
  assert.equal(sqlQueActualiza("await tx.$executeRaw`UPDATE invoices SET type = 'F1' WHERE id = ${id}`;", 'x.ts').length, 1);
  assert.equal(sqlQueActualiza("await tx.$executeRawUnsafe('update \"invoices\" set number = $1', n);", 'x.ts').length, 1);
  assert.equal(sqlQueActualiza('await tx.$queryRaw`SELECT number FROM invoices`;', 'x.ts').length, 0);
});
