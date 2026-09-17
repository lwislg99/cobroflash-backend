// tests/scrum887-el-cobro-es-lo-firmado.test.mjs — SCRUM-887 · PR 1 (caso A: descuento POR LÍNEA)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CLIENTE PAGA LO QUE FIRMÓ, NI UN CÉNTIMO MÁS POR TENER UN DESCUENTO
//
// Medido en STAGING (SCRUM-883): un presupuesto con descuentos de línea firmado por 539,05 € se
// cobraba por 628,60 €. La firma enseña `Quote.total` (`calcTotal`, que SÍ aplica `dto`), y la
// factura —y con ella el cobro— sale de `calcVatBreakdown` sobre `Quote.lines` tal cual, que NO lo
// aplica: `base = qty * price`.
//
// ── LA DECISIÓN (SCRUM-887, comentarios 15616 y 15620 · 16-sep-2026) ─────────────────────────
//   ① El objetivo es el TOTAL FIRMADO (`calcTotal`). La factura sigue saliendo de SUS líneas con
//     la reconciliación de SCRUM-141 (`stageLinesReconciled` → `reconcileToTarget`), aplicando
//     el `dto` AL PRECIO antes de entrar. Sin aritmética nueva.
//     Coste aceptado: 1-2 céntimos en ~1,2 % de los casos, LA MISMA TASA que ya existe sin
//     descuento (la reconciliación no siempre alcanza el objetivo — SCRUM-141).
//   A · descuento por línea → se aplica (ESTE PR).
//   B · descuento global con un solo IVA → PR 2.  C · global con IVA mezclado → NO se improvisa.
//
// ── POR QUÉ `pieDePresupuesto` NO ES LA FUENTE (medido, 40.000 casos) ─────────────────────────
// `calcTotal` redondea la suma una vez; `calcVatBreakdown` redondea base y cuota POR TIPO. Sin
// ningún descuento discrepan en 1.498 de cada 10.000. Hacerla fuente movería céntimos de
// presupuestos que no tienen descuento.
//
// ── LA MUESTRA ES FIJA ────────────────────────────────────────────────────────────────────────
// Generador con semilla (mulberry32): la misma muestra en cada tanda y en cada máquina. Si un día
// falla, el caso que falla se puede reproducir con su índice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';

const { calcTotal } = await import(DIST + 'core/utils/utils.js');
const { grossOfLines, stageLinesReconciled, lineasParaFacturar } = await import(DIST + 'modules/invoicing/domain/invoiceLines.service.js');
const { calcVatBreakdown } = await import(DIST + 'modules/invoicing/domain/vat.service.js');
const { distributeStageAmounts } = await import(DIST + 'modules/quotes/domain/billingPlan.js');

/**
 * LAS LÍNEAS QUE LOS SEIS CAMINOS DE EMISIÓN METEN EN LA FACTURA. Antes de SCRUM-887 era
 * `Quote.lines` tal cual (así se midió el rojo, commit 448bc5ac); ahora pasan por
 * `lineasParaFacturar`, y el guard de abajo exige que los seis caminos lo hagan.
 */
const lineasQueFactura = (quote) => lineasParaFacturar(quote);

const PLANES = {
  entero: [{ index: 0, percentage: 1, label: 'full' }],
  '50/50': [{ index: 0, percentage: 0.5, label: 'a' }, { index: 1, percentage: 0.5, label: 'b' }],
  '30/70': [{ index: 0, percentage: 0.3, label: 'a' }, { index: 1, percentage: 0.7, label: 'b' }],
};

/** Lo que emiten los caminos de tramos: líneas del tramo reconciliadas contra el reparto del firmado. */
function facturasDe(quote, plan) {
  const lineas = lineasQueFactura(quote);
  const objetivos = distributeStageAmounts(quote.total, plan);
  return plan.map((_, i) => {
    const ls = stageLinesReconciled(lineas, plan, i, objetivos[i]);
    return { lineas: ls, importe: grossOfLines(ls) };
  });
}

const cents = (n) => Math.round(n * 100);

function muestra(semilla, n, tipo) {
  let s = semilla;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const qtys = [1, 2, 2.5, 3, 7, 11, 37, 0.75];
  const precios = [9.99, 0.875, 24.95, 19.99, 42.35, 120, 4.19, 36.35, 1.005, 689, 58.33, 2.37, 0.01, 1000];
  const dtos = [5, 10, 15, 33.33, 12.5, 50];
  const tipos = [0.21, 0.10, 0.04, 0];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = pick(tipos);
    const lines = [];
    const k = 1 + Math.floor(rand() * 4);
    for (let j = 0; j < k; j++) {
      const tax = tipo === 'A_mixto' ? tipos[j % 2 === 0 ? 0 : 1 + Math.floor(rand() * 3)] : t0;
      const l = { concept: `L${j}`, qty: pick(qtys), price: pick(precios), tax };
      if (tipo !== 'SIN' && (j === 0 || rand() < 0.5)) l.dto = pick(dtos);
      lines.push(l);
    }
    const quote = { lines, discountGlobalAmount: null };
    quote.total = calcTotal(lines, null).toFixed(2);   // lo que se guarda y el cliente firma
    out.push(quote);
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO · C3 del electricista con descuentos de línea y UN solo IVA
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887 · 🔴 C3 con dto de línea: el cobro es EXACTAMENTE lo firmado, en todos los planes', () => {
  const lines = [
    { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
    { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
    { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
  ];
  const quote = { lines, discountGlobalAmount: null, total: calcTotal(lines, null).toFixed(2) };
  // SUELO: el firmado se LEE de `calcTotal`, y tiene que ser el descontado. Si no, el test
  // compararía dos cifras sin descuento y daría verde sin mirar nada.
  assert.equal(quote.total, '589.95', '🔴 CIEGO: el total firmado ya no es el descontado');

  for (const [nombre, plan] of Object.entries(PLANES)) {
    const f = facturasDe(quote, plan);
    const cobrado = f.reduce((a, x) => a + cents(x.importe), 0);
    assert.equal(cobrado, cents(589.95),
      `🔴 plan ${nombre}: el cliente firmó 589,95 € y se le cobran ${(cobrado / 100).toFixed(2)} €`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA MUESTRA A · dto de línea, un solo IVA y IVA mezclado
// ═════════════════════════════════════════════════════════════════════════════════════════════

// TECHOS medidos el 16-sep-2026 con el arreglo puesto. Sólo pueden BAJAR. La fila SIN es la tasa
// que YA existía sin descuento (SCRUM-141): el caso A no puede quedar peor que ella en proporción.
const TECHO_DISTINTOS = { SIN: 18, A_uno: 18, A_mixto: 14 };

test('SCRUM-887 · 🔴 caso A (2.000 + 2.000): cobro ≠ firmado sólo por 1-2 céntimos, y no más a menudo que sin descuento', () => {
  for (const tipo of ['SIN', 'A_uno', 'A_mixto']) {
    const quotes = muestra(887, 2000, tipo);
    const conDto = quotes.filter((q) => q.lines.some((l) => l.dto > 0)).length;
    assert.equal(conDto, tipo === 'SIN' ? 0 : 2000, `🔴 CIEGO: la muestra ${tipo} no es la que dice ser`);
    let distintos = 0;
    let peor = { d: 0 };
    quotes.forEach((q, i) => {
      const [f] = facturasDe(q, PLANES.entero);
      const d = Math.abs(cents(f.importe) - cents(Number(q.total)));
      if (d > 0) distintos++;
      if (d > peor.d) peor = { d, i, firmado: q.total, cobrado: f.importe };
    });
    assert.ok(peor.d <= 2,
      `🔴 ${tipo}: el caso ${peor.i} firma ${peor.firmado} € y se cobra ${peor.cobrado} € (${peor.d} cént.)`);
    assert.ok(distintos <= TECHO_DISTINTOS[tipo],
      `🔴 ${tipo}: ${distintos} de 2.000 no cobran lo firmado (techo ${TECHO_DISTINTOS[tipo]})`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ EL POSITIVO · sin descuento, los mismos céntimos que hoy
// ═════════════════════════════════════════════════════════════════════════════════════════════

// La huella de 10.000 presupuestos SIN descuento × 3 planes: importe, base y cuota de cada
// factura. Congelada con el código ANTERIOR a SCRUM-887. Si cambia UN céntimo, cambia la huella.
const HUELLA_SIN_DESCUENTO = '0f8e14d0ce42fab424daef3285864e4b09b90f5b788439174be180874a247753';

test('SCRUM-887 · ✅ sin descuento, 10.000 presupuestos × 3 planes dan los MISMOS céntimos que antes', () => {
  const quotes = muestra(20260916, 10000, 'SIN');
  assert.equal(quotes.filter((q) => q.lines.some((l) => 'dto' in l)).length, 0, '🔴 CIEGO: la muestra SIN trae dto');
  const h = createHash('sha256');
  let facturas = 0;
  for (const q of quotes) {
    for (const plan of Object.values(PLANES)) {
      for (const f of facturasDe(q, plan)) {
        const bd = calcVatBreakdown(f.lineas);
        h.update(`${cents(f.importe)}|${cents(bd.base)}|${cents(bd.cuota)};`);
        facturas++;
      }
    }
  }
  assert.equal(facturas, 50000, `🔴 CIEGO: se esperaban 50.000 facturas y se midieron ${facturas}`);
  assert.equal(h.digest('hex'), HUELLA_SIN_DESCUENTO,
    '🔴 un presupuesto SIN descuento ha cambiado de céntimos (importe, base o cuota). SCRUM-887 no '
    + 'puede mover nada que no tenga descuento, y el céntimo de SCRUM-624 no se toca.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PIEZA · qué sale de `lineasParaFacturar`, y qué NO toca
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-887 · la línea con dto sale con el precio EFECTIVO y SIN la clave `dto`; sin dto, sale la MISMA', () => {
  const conDto = { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21, costeUnitario: 9 };
  const sinDto = { concept: 'Boletín', qty: 1, price: 120, tax: 0.21 };
  const dtoCero = { concept: 'Cero', qty: 1, price: 10, dto: 0, tax: 0.21 };
  const [a, b, c] = lineasParaFacturar({ lines: [conDto, sinDto, dtoCero], discountGlobalAmount: null });
  assert.equal(a.price, 24.95 * (1 - 15 / 100), '🔴 el precio no es el de después del descuento');
  assert.equal('dto' in a, false,
    '🔴 la línea facturada conserva `dto` con el precio YA descontado: quien lo lea lo aplicará dos veces');
  assert.equal(a.costeUnitario, 9, '🔴 se han perdido otras claves de la línea');
  assert.equal(b, sinDto, '🔴 una línea SIN descuento no sale como entró: puede mover céntimos');
  assert.equal(c, dtoCero, '🔴 un `dto: 0` ha tocado la línea');
  assert.equal(conDto.price, 24.95, '🔴 se ha MUTADO `Quote.lines`');
});

test('SCRUM-887 · ⛔ NEGATIVO: con descuento GLOBAL e IVA MEZCLADO (C) no cambia NADA — acotación viva', () => {
  // C3 del SCRUM-883 tal cual: IVA 21 % y 10 % + 25 € global = caso C.
  const lines = [
    { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
    { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.10 },
    { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
  ];
  // Número, texto y un Decimal de Prisma (se lee por `valueOf`).
  for (const global of [25, '25.00', { toString: () => '25.00', valueOf: () => 25 }]) {
    const salida = lineasParaFacturar({ lines, discountGlobalAmount: global });
    assert.equal(salida, lines, `🔴 con global ${String(global)} se han tocado las líneas`);
  }
  // Y el cobro de ese caso C sigue siendo EL DE ANTES (medido en staging): no se arregla a medias.
  const quote = { lines, discountGlobalAmount: 25, total: calcTotal(lines, 25).toFixed(2) };
  assert.equal(quote.total, '539.05', '🔴 CIEGO: el firmado de C3 no es el medido');
  const [f] = facturasDe(quote, PLANES.entero);
  assert.equal(f.importe, 628.6, '🔴 el caso C ha cambiado de cálculo sin decisión de la asesoría');
});

test('SCRUM-887 · 🔴 un presupuesto cargado SIN `discountGlobalAmount` no se factura a ciegas', () => {
  const lines = [{ concept: 'x', qty: 1, price: 100, dto: 10, tax: 0.21 }];
  assert.throws(() => lineasParaFacturar({ lines }), /discountGlobalAmount/);
  // `null` SÍ es un dato: «no hay descuento global».
  assert.equal(lineasParaFacturar({ lines, discountGlobalAmount: null })[0].price, 90);
});

test('SCRUM-887 · la vista del plan promete lo MISMO que se emite, tramo a tramo', async () => {
  const { buildBillingPlanView } = await import(DIST + 'modules/quotes/domain/billingPlanView.js');
  const lines = [
    { concept: 'Punto de luz', qty: 8, price: 24.95, dto: 15, tax: 0.21 },
    { concept: 'Base de enchufe schuko', qty: 11, price: 19.99, dto: 10, tax: 0.21 },
    { concept: 'Boletín eléctrico (CIE)', qty: 1, price: 120, tax: 0.21 },
  ];
  const quote = {
    lines, discountGlobalAmount: null, total: calcTotal(lines, null).toFixed(2),
    currency: 'EUR', paymentTerms: 'FIFTY_FIFTY', customBillingPlan: null,
  };
  const vista = buildBillingPlanView(quote, 0);
  assert.equal(vista.billingPlan.length, 2, '🔴 CIEGO: FIFTY_FIFTY no dio dos tramos');
  const emitidos = facturasDe(quote, PLANES['50/50']).map((x) => x.importe);
  assert.deepEqual(vista.billingPlan.map((s) => s.amount), emitidos,
    '🔴 la pantalla promete un importe por tramo distinto del que se factura');
  assert.equal(cents(emitidos[0]) + cents(emitidos[1]), cents(589.95), '🔴 los tramos no suman lo firmado');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL GUARD · los seis caminos (y la vista) facturan lo que sale de `lineasParaFacturar`
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Por AST y en su ámbito, nunca por texto: el nombre aparece en estos comentarios.
// Lo que se vigila es la PROCEDENCIA del argumento de las funciones que convierten líneas del
// presupuesto en líneas o importes de factura. Un día alguien escribe `quote.lines` directo en
// una de ellas y el descuento vuelve a desaparecer del cobro sin que falle nada más.

/** Quién consume líneas de presupuesto, y cuál de sus argumentos son esas líneas. */
const CONSUMIDORES = { stageLinesReconciled: 0, stageAmountsFromLines: 0, casarLineas: 1 };

/**
 * LOS CAMINOS, enumerados: fichero → cuántas llamadas a consumidores tiene y quién la dispara.
 * C6 (`lib/invoicing.ts`) no reparte por tramos: allí se vigila la variable que va a `lines`.
 */
const CAMINOS = {
  'src/modules/quotes/app/routes/quotes.routes.ts': { consumidores: 1, quien: 'C1 · el CLIENTE acepta' },
  'src/modules/system/app/routes/quotesAdmin.routes.ts': { consumidores: 2, quien: 'el pro factura un tramo / la factura entera' },
  'src/modules/jobs/app/routes/jobs.routes.ts': { consumidores: 1, quien: 'el pro «cobra el resto»' },
  'src/modules/jobs/app/routes/albaranes.routes.ts': { consumidores: 1, quien: 'C7 · albarán firmado → factura' },
  'src/modules/quotes/domain/billingPlanView.ts': { consumidores: 1, quien: 'la vista del plan (promete el importe)' },
  'src/lib/invoicing.ts': { consumidores: 0, quien: 'C6 · factura desde un cobro', variable: 'invoiceLines' },
};

/** Donde viven los consumidores (se llaman entre sí): no son caminos, son la pieza. */
const DEFINEN_CONSUMIDORES = [
  'src/modules/invoicing/domain/invoiceLines.service.ts',
  'src/modules/jobs/domain/albaranAFactura.ts',
];

function buscar(nodo, ok, salida = []) {
  if (ok(nodo)) salida.push(nodo);
  ts.forEachChild(nodo, (h) => { buscar(h, ok, salida); });   // sin devolver nada: forEachChild corta con truthy
  return salida;
}

const esLlamadaA = (n, nombre) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre;
const esConsumidor = (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression)
  && Object.hasOwn(CONSUMIDORES, n.expression.text);

/** La declaración de `nombre` visible desde `desde`: se sube por los bloques que lo contienen. */
function declaracionVisible(nombre, desde) {
  for (let p = desde.parent; p; p = p.parent) {
    if (ts.isBlock(p) || ts.isSourceFile(p)) {
      for (const st of p.statements) {
        if (st.pos >= desde.pos) break;
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === nombre) return d;
        }
      }
    }
  }
  return null;
}

/** ¿Esta expresión PROCEDE de `lineasParaFacturar`? Se sigue la cadena de variables en su ámbito. */
function procedeDeLaPieza(expr, profundidad = 0) {
  if (!expr || profundidad > 5) return false;
  if (buscar(expr, (n) => esLlamadaA(n, 'lineasParaFacturar')).length > 0) return true;
  const ids = buscar(expr, (n) => ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n));
  return ids.some((id) => {
    const d = declaracionVisible(id.text, expr);
    return Boolean(d && d.initializer && procedeDeLaPieza(d.initializer, profundidad + 1));
  });
}

/** El juez. Devuelve los pecados de UN fichero: se usa con el árbol real y con el sembrado. */
function juzgar(fichero, fuente) {
  const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true);
  const esperado = CAMINOS[fichero];
  const pecados = [];
  const llamadas = buscar(sf, esConsumidor);
  if (llamadas.length !== esperado.consumidores) {
    pecados.push(`${fichero}: ${llamadas.length} llamadas a consumidores, se esperaban ${esperado.consumidores}`);
  }
  for (const c of llamadas) {
    const arg = c.arguments[CONSUMIDORES[c.expression.text]];
    if (!procedeDeLaPieza(arg)) {
      const { line } = sf.getLineAndCharacterOfPosition(c.getStart(sf));
      pecados.push(`${fichero}:${line + 1} · ${c.expression.text}(${arg ? arg.getText(sf) : '∅'}) no procede de lineasParaFacturar`);
    }
  }
  if (esperado.variable) {
    const decls = buscar(sf, (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === esperado.variable);
    if (decls.length !== 1) pecados.push(`${fichero}: ${decls.length} declaraciones de ${esperado.variable}, se esperaba 1`);
    else if (!procedeDeLaPieza(decls[0].initializer)) pecados.push(`${fichero}: ${esperado.variable} no procede de lineasParaFacturar`);
  }
  return pecados;
}

test('SCRUM-887 · 🔴 los seis caminos y la vista facturan líneas que PROCEDEN de `lineasParaFacturar`', () => {
  const pecados = Object.keys(CAMINOS).flatMap((f) => juzgar(f, fs.readFileSync(path.join(RAIZ, f), 'utf8')));
  assert.deepEqual(pecados, [],
    '🔴 un camino de emisión vuelve a facturar `Quote.lines` sin pasar por la pieza: el cliente '
    + `pagaría más de lo que firmó si el presupuesto lleva descuento de línea.\n  ${pecados.join('\n  ')}`);
});

test('SCRUM-887 · 🔴 no hay un SÉPTIMO consumidor de líneas de presupuesto fuera de la lista', () => {
  const fuera = [];
  const dentro = new Set();
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { recorrer(rel); continue; }
      if (!rel.endsWith('.ts') || rel.endsWith('.d.ts')) continue;
      const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ts.ScriptTarget.Latest, true);
      const n = buscar(sf, esConsumidor).length;
      if (n === 0) continue;
      if (Object.hasOwn(CAMINOS, rel)) dentro.add(rel);
      else if (!DEFINEN_CONSUMIDORES.includes(rel)) fuera.push(`${rel} (${n})`);
    }
  };
  recorrer('src');
  // SUELO: el recorrido tiene que VER los cinco ficheros de la lista que sí llaman a consumidores.
  assert.equal(dentro.size, 5, `🔴 CIEGO: el recorrido sólo vio ${dentro.size} de los 5 caminos con consumidores`);
  assert.deepEqual(fuera, [], `🔴 hay consumidores de líneas de presupuesto sin declarar: ${fuera.join(', ')}`);
});

test('SCRUM-887 · 🔴 CONTROL SEMBRADO: el juez caza `quote.lines` directo, en cada fichero', () => {
  // El MISMO juez sobre el texto real con la pieza arrancada. Si esto no sale rojo, el verde de
  // arriba no significa nada.
  for (const f of Object.keys(CAMINOS)) {
    const real = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    const sembrado = real.replace(/lineasParaFacturar\((\w+)\)/g, '(($1 as any).lines as any[])');
    assert.notEqual(sembrado, real, `🔴 CIEGO: no encontré la llamada a sembrar en ${f}`);
    assert.ok(juzgar(f, sembrado).length > 0, `🔴 el juez NO ve el camino sin la pieza en ${f}`);
  }
});
