// SCRUM-504 · UNA CANTIDAD AUSENTE NO ES 1.
//
// Sin gate: funciones puras + AST. Ni BD, ni red, ni PDF renderizado.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO
//
//     const qty = Number(l?.qty) || 1;
//
// `Number('')` es `0`. `0 || 1` es `1`. **Silencioso.** Una línea sin cantidad legible se cobraba
// como una unidad — y estaba COPIADA EN CINCO SITIOS: el cálculo del IVA, la factura final, el
// reparto por tramos y **dos veces el PDF**.
//
// ⚠️ Y el titular no era «cobra de más». Era que **el total que el profesional VE y el que el
// dominio CALCULA no coincidían**: la pantalla ya trataba ese caso como 0
// (`quotesView.js:1079` → `Number.isFinite(qty) ? qty : 0`). El dominio se alinea con lo que el
// profesional ya ve; la semántica no se ha inventado aquí.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ CINCO A LA VEZ Y NO UNO
//
// Arreglar solo el cálculo dejaría **el PDF enseñando 1 donde la cuenta dice 0**: un descuadre
// entre el papel y el importe, peor que el defecto original. El test de §3 es el que justifica el
// alcance.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { cantidadDeLinea, calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

/** Los CINCO sitios que compartían la línea. El PDF cuenta dos veces: fila y subtotal. */
const LOS_CINCO = [
  'src/modules/invoicing/domain/vat.service.ts',
  'src/modules/invoicing/domain/finalInvoice.service.ts',
  'src/modules/invoicing/domain/invoiceLines.service.ts',
  'src/modules/invoicing/infra/pdf/pdf.service.ts',
];

// ── 1 · 🔴 EL CONTROL NEGATIVO QUE EXIGE EL TICKET, Y VA PRIMERO ─────────────────────────

test('SCRUM-504 · 🔴 el «1» de una PERSONA y el «1» inventado por el `||` se distinguen', () => {
  // Con `||` los dos acababan en 1 y eran indistinguibles: `0` y `Number('')` son el mismo falsy.
  // `Number.isFinite` los separa, y aquí se demuestra caso por caso.
  assert.equal(cantidadDeLinea(1), 1,
    '🔴 el «1» ESCRITO POR UNA PERSONA ha dejado de valer 1. El arreglo del caso raro no puede '
    + 'mover el caso normal: es la cantidad más frecuente de todas.');
  assert.equal(cantidadDeLinea('1'), 1, '🔴 un «1» que llega como texto tiene que seguir siendo 1.');
  assert.equal(cantidadDeLinea(2.5), 2.5, '🔴 las cantidades decimales han cambiado.');
  assert.equal(cantidadDeLinea(0), 0,
    '🔴 UN CERO ESCRITO A PROPÓSITO SE ESTÁ CONVIRTIENDO EN OTRA COSA. Con `||` un 0 legítimo se '
    + 'volvía 1: ése era el defecto, y respetarlo es la mitad del arreglo.');

  // Y lo ilegible cae a 0 — nunca a 1.
  for (const ausente of ['', '   ', 'x', null, undefined, NaN, {}, []]) {
    assert.equal(cantidadDeLinea(ausente), 0,
      `🔴 la cantidad ${JSON.stringify(ausente)} se ha convertido en `
      + `${cantidadDeLinea(ausente)} en vez de 0. Inventar una unidad que nadie escribió es el `
      + 'defecto de este ticket.');
    assert.notEqual(cantidadDeLinea(ausente), 1,
      `🔴 ${JSON.stringify(ausente)} ha vuelto a valer 1.`);
  }
  // 🔴 EL PAR QUE LO DEMUESTRA: mismo resultado 1 antes, resultados distintos ahora.
  assert.notEqual(cantidadDeLinea(''), cantidadDeLinea(1),
    '🔴 la cantidad VACÍA y la cantidad UNO siguen dando lo mismo: no se distinguen, y entonces el '
    + 'control negativo no controla nada.');
});

// ── 2 · 🔴 EL ROJO POR EL HECHO: nombra la línea y el importe ────────────────────────────

test('SCRUM-504 · 🔴 una línea con cantidad vacía NO aporta importe', () => {
  const lineas = [
    { concept: 'Mano de obra', qty: 2, price: 100, tax: 0.21 },
    { concept: 'Material sin cantidad', qty: '', price: 340, tax: 0.21 },
  ];
  const bd = calcVatBreakdown(lineas);

  const colado = 340 * 1;           // lo que aportaba cuando `''` valía 1
  assert.equal(bd.base, 200,
    `🔴 SE HA COLADO UN IMPORTE DE UNA LÍNEA SIN CANTIDAD.\n\n`
    + `  «${lineas[1].concept}» tiene la cantidad VACÍA y su precio es ${lineas[1].price},00 €.\n`
    + `  Base esperada: 200,00 € (solo la línea con cantidad). Base obtenida: ${bd.base},00 €.\n`
    + `  Diferencia: ${(bd.base - 200).toFixed(2)} € — que son ${colado},00 € facturados por una\n`
    + '  unidad que nadie escribió.');
  assert.equal(bd.cuota, 42, '🔴 la cuota arrastra el importe colado (200 × 21 % = 42,00).');
});

// ── 3 · 🔴 EL QUE JUSTIFICA ARREGLAR CINCO: PDF Y CUENTA NO PUEDEN DISCREPAR ─────────────

test('SCRUM-504 · 🔴 el PDF y el cálculo dan LO MISMO sobre la línea defectuosa', () => {
  const linea = { concept: 'Material sin cantidad', qty: '', price: 340, tax: 0.21 };

  // Lo que el PDF imprime en la fila, con SU misma fórmula (`pdf.service.ts`: qty·price·(1+tax))
  // pero tomando la cantidad de donde la toma ahora: la función compartida.
  const qtyPdf = cantidadDeLinea(linea.qty);
  const totalPdf = qtyPdf * Number(linea.price) * (1 + Number(linea.tax));

  // Lo que la cuenta calcula.
  const bd = calcVatBreakdown([linea]);
  const totalCuenta = bd.base + bd.cuota;

  assert.equal(totalPdf, totalCuenta,
    `🔴 EL PAPEL Y LA CUENTA DICEN COSAS DISTINTAS SOBRE LA MISMA LÍNEA.\n\n`
    + `  PDF: ${totalPdf.toFixed(2)} € · cálculo: ${totalCuenta.toFixed(2)} €\n`
    + '  Ésta es la razón por la que este ticket arregla CINCO sitios y no uno: con el cálculo\n'
    + '  arreglado y el PDF no, el cliente recibe un papel que no cuadra con lo que se le cobra.');
  assert.equal(totalPdf, 0, '🔴 una línea sin cantidad no puede aportar importe en ninguno de los dos.');

  // Y con una cantidad legítima, los dos siguen coincidiendo — si no, el de arriba se cumpliría
  // por dar 0 en ambos lados sin calcular nada.
  const buena = { qty: 2, price: 100, tax: 0.21 };
  const bdB = calcVatBreakdown([buena]);
  assert.equal(cantidadDeLinea(buena.qty) * buena.price * (1 + buena.tax), bdB.base + bdB.cuota,
    '🔴 con cantidad legítima el PDF y la cuenta ya no coinciden: el test de arriba estaría '
    + 'pasando porque los dos dan cero, no porque calculen igual.');
});

// ── 4 · UNA SOLA FUENTE DE LA CANTIDAD, o volverán a divergir ────────────────────────────

test('SCRUM-504 · 🔴 los CINCO sitios toman la cantidad de la MISMA función', () => {
  // Cinco copias de `Number.isFinite` divergen igual que divergieron las cinco de `|| 1`. Lo que
  // impide que el papel y la cuenta se separen no es que hoy coincidan: es que solo haya una fuente.
  const ofensores = [];
  let usos = 0;
  for (const f of LOS_CINCO) {
    const src = leer(f);
    const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true);
    const visitar = (n) => {
      // Un `||` cuyo lado izquierdo lee una cantidad y cuyo defecto no es 0.
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        const izq = n.left.getText(sf).replace(/\s+/g, ' ');
        const der = n.right.getText(sf).trim();
        if (/^Number\(.*\bqty\b.*\)$/.test(izq) && der !== '0') {
          ofensores.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}  ${izq} || ${der}`);
        }
      }
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'cantidadDeLinea') usos += 1;
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  assert.deepEqual(ofensores, [],
    `🔴 HA VUELTO UN \`|| <n>\` SOBRE UNA CANTIDAD:\n    ${ofensores.join('\n    ')}\n\n`
    + '  `Number("")` es 0 y `0 || 1` da 1 en silencio. La cantidad se toma de `cantidadDeLinea`.');

  // SUELO: si el detector no viera ningún uso, el cero de arriba no significaría nada.
  assert.ok(usos >= 5,
    `🔴 solo ${usos} usos de \`cantidadDeLinea\` en los cinco sitios, y son CINCO llamadas (el PDF `
    + 'cuenta dos veces: la fila y el subtotal). Si alguno ha dejado de usarla, ese sitio puede '
    + 'volver a inventarse la cantidad sin que este guard lo vea.');
});

// ── 5 · CONTROL NEGATIVO GRANDE: el cálculo de siempre no se ha movido ───────────────────

test('SCRUM-504 · 🔴 CONTROL NEGATIVO: una factura normal calcula EXACTAMENTE lo de antes', () => {
  // El mismo caso que fija `scrum294-recargo-caja.test.mjs`, que vigila el desglose compartido —
  // el que `registro.builder.ts` manda literal al XML. Si esto se mueve, se movió lo sellado.
  const lineas = [
    { concept: 'Mano de obra', qty: 2, price: 300, tax: 0.21 },
    { concept: 'Material', qty: 1, price: 250, tax: 0.10 },
  ];
  const bd = calcVatBreakdown(lineas);
  assert.equal(bd.base, 850.00, '🔴 la base compartida ha cambiado');
  assert.equal(bd.cuota, 151.00, '🔴 la cuota compartida ha cambiado (126,00 + 25,00)');
  assert.deepEqual(bd.entries, [
    { rate: 21, base: 600, cuota: 126 },
    { rate: 10, base: 250, cuota: 25 },
  ], '🔴 el desglose por tramos ha cambiado');
});
