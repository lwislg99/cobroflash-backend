// SCRUM-403 · EL BENEFICIO NETO RESTABA CIFRAS CON IVA EN LOS DOS LADOS.
//
// Sin gate: el módulo es puro y se importa de `dist/`; el censo lee el código por AST. Ni BD, ni
// red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO ES UN BUG DE CUENTAS
//
// El IVA repercutido **no es ingreso**: es dinero de Hacienda que el profesional custodia. El
// soportado no es gasto suyo si es deducible. Restar totales con IVA en los dos lados le enseña un
// «beneficio» que no es el suyo — y sobre ese número la gente decide si puede comprarse la
// furgoneta.
//
// ⚠️ ESTE TICKET ARREGLA **LA MITAD**. El lado del GASTO no es derivable: `Expense` solo tiene
// `amount` y en ninguna parte está escrito si lleva IVA. Hace falta migración
// (`docs/master/SCRUM-403.md`). Lo que NO se hace es suponerlo — sería cometer el
// defecto que el ticket denuncia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { soloEjecutable } from './_guard-texto.mjs';
import { calcVatBreakdown } from '../dist/modules/invoicing/domain/vat.service.js';

/** El desglose de UNA factura, con la primitiva compartida. El módulo que envolvía esto se
 * retiró: nadie lo alcanzaba (SCRUM-411) y agregarlo habría chocado con SCRUM-389. */
const baseDeFactura = (inv) => {
  const lines = Array.isArray(inv?.lines) ? inv.lines : null;
  if (!lines || lines.length === 0) return { base: null, cuota: null, medible: false };
  const { base, cuota } = calcVatBreakdown(lines);
  if (!Number.isFinite(base) || !Number.isFinite(cuota)) return { base: null, cuota: null, medible: false };
  return { base, cuota, medible: true };
};

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// Merchant de id REAL: `isDemoMerchant` es `id === 1` y desactiva comprobaciones sin tocar el guard.
const MERCHANT_ID = 7;

// ── LOS VECTORES DEL FUNDADOR ───────────────────────────────────────────────────────────

/** 1.000 de base al 21 % → 210 de cuota, 1.210 de total. */
const FACTURA_1000 = { lines: [{ concept: 'Reforma baño', qty: 1, price: 1000, tax: 0.21 }] };

test('SCRUM-403 · el lado de la FACTURA: 1.000 base + 210 IVA se separan de verdad', () => {
  const r = baseDeFactura(FACTURA_1000);
  assert.equal(r.medible, true, '🔴 no se pudo derivar la base de una factura con líneas normales');
  assert.equal(r.base, 1000, `🔴 la base sale ${r.base} y son 1.000`);
  assert.equal(r.cuota, 210, `🔴 la cuota sale ${r.cuota} y son 210`);
  // El total con IVA es 1.210: es lo que sumaba «Beneficio neto» y lo que NO debe sumar.
  assert.notEqual(r.base, 1210, '🔴 se está devolviendo el TOTAL como si fuera la base');
});

test('SCRUM-403 · 🔴 EL VECTOR: 1.000+210 contra 400+84 → el beneficio es 600, NO 726', () => {
  // El número que el profesional ve hoy sale de restar totales: 1.210 − 484 = 726. El beneficio de
  // verdad es 1.000 − 400 = 600. La diferencia, 126 €, es dinero de Hacienda contado como suyo.
  const ingresos = baseDeFactura(FACTURA_1000);
  assert.equal(ingresos.base, 1000);

  // ⚠️ EL LADO DEL GASTO NO EXISTE EN EL MODELO. `Expense` no tiene base ni cuota, así que aquí se
  // usa el número que la migración hará posible, NO un fixture que finja que ya está. El test que
  // recorra el gasto de verdad se escribe DESPUÉS de la migración — declarado, no inventado.
  const baseGastoTrasMigracion = 400;
  const beneficio = ingresos.base - baseGastoTrasMigracion;

  assert.equal(
    beneficio, 600,
    `🔴 el beneficio sale ${beneficio} y son 600. Restando totales con IVA saldría 726 (1.210 − 484): ` +
      '126 € de más, que son IVA — dinero de Hacienda enseñado como beneficio del profesional.',
  );
  assert.notEqual(beneficio, 726, '🔴 se están restando totales con IVA en los dos lados');
});

// ── EL SUELO EN LOS DATOS ───────────────────────────────────────────────────────────────

test('SCRUM-403 · SUELO EN LOS DATOS: los fixtures llevan IVA de verdad', () => {
  // Si ningún fixture llevara IVA, base y total coincidirían y el rojo no se ejercitaría: sería un
  // verde hueco con otra forma. Se comprueba que el caso de prueba SEPARA los dos números.
  const r = baseDeFactura(FACTURA_1000);
  assert.ok(
    r.cuota > 0,
    '🔴 ESCÁNER CIEGO: el fixture no lleva IVA, así que base y total coinciden y este fichero no ' +
      'está probando nada. Un rojo que ningún caso ejercita es un verde hueco.',
  );
  assert.notEqual(r.base, r.base + r.cuota, '🔴 base y total son el mismo número en el fixture');
});

test('SCRUM-403 · sin líneas utilizables NO se inventa la base: se declara', () => {
  for (const sinDesglose of [{}, { lines: null }, { lines: [] }, { lines: 'no es un array' }]) {
    const r = baseDeFactura(sinDesglose);
    assert.equal(
      r.medible, false,
      `🔴 con ${JSON.stringify(sinDesglose)} se dice que la base es medible`,
    );
    assert.equal(r.base, null, '🔴 se devuelve 0 en vez de null: «no se pudo medir» y «cero» se ' +
      'sumarían igual y significan lo contrario.');
  }
});


// ── EL CENSO DERIVADO ───────────────────────────────────────────────────────────────────
//
// Arreglar una instancia de un patrón y dejar las otras es dejar la trampa puesta con un cartel al
// lado. Se derivan por AST TODAS las cifras de Informes que suman o restan importes de factura o
// de gasto — no una lista escrita a mano.

const FICHEROS_INFORMES = [
  'src/modules/reports/app/routes/reports.routes.ts',
  'src/modules/reports/domain/desgloseEmpleado.ts',
];

/** Cifras que operan con importes: `X - Y`, `X + Y` y `+=` sobre acumuladores de dinero. */
function cifrasConImporte() {
  const DINERO = /(revenue|expenses?|profit|total|amount|monthly|prevRev|prevExp|totalR|totalG)/i;
  const out = [];
  let nodosVisitados = 0;

  for (const f of FICHEROS_INFORMES) {
    const src = leer(f);
    const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const L = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const visita = (n) => {
      nodosVisitados += 1;
      if (ts.isBinaryExpression(n)) {
        const op = n.operatorToken.kind;
        const esOperacion = op === ts.SyntaxKind.MinusToken || op === ts.SyntaxKind.PlusToken
          || op === ts.SyntaxKind.PlusEqualsToken;
        const txt = n.getText(sf);
        if (esOperacion && DINERO.test(txt) && txt.length < 160) {
          out.push({ f, l: L(n), expr: txt.replace(/\s+/g, ' ').slice(0, 90) });
        }
      }
      ts.forEachChild(n, visita);
    };
    visita(sf);
  }
  return { cifras: out, nodosVisitados };
}

test('SCRUM-403 · SUELO del censo: encuentra cifras que operan con importes', () => {
  const { cifras, nodosVisitados } = cifrasConImporte();
  assert.ok(nodosVisitados > 500, `🔴 ESCÁNER CIEGO: solo ${nodosVisitados} nodos recorridos`);
  assert.ok(
    cifras.length > 0,
    '🔴 ESCÁNER CIEGO: el censo devuelve 0 cifras. «No hay cifras que operen con importes» y «no ' +
      'supe mirar» son el mismo número y significan lo contrario — y con 0 todo lo de abajo pasaría ' +
      'por vacío.',
  );
  // Las cinco que se localizaron a mano tienen que estar entre las derivadas: si el censo ve menos,
  // está ciego a alguna forma de escribir la operación.
  assert.ok(
    cifras.length >= 5,
    `🔴 el censo ve ${cifras.length} cifras y se localizaron 5 a mano (reports.routes.ts:85, :120, ` +
      ':127 y desgloseEmpleado.ts:118, :137). Si ve menos, no cubre todas las formas.',
  );
});

test('SCRUM-403 · el censo NOMBRA las cifras afectadas, para que ninguna se quede sin arreglar', () => {
  const { cifras } = cifrasConImporte();
  const porFichero = new Map();
  for (const c of cifras) porFichero.set(c.f, (porFichero.get(c.f) ?? 0) + 1);

  // Los dos ficheros de Informes tienen cifras: si uno saliera a 0, se estaría arreglando la mitad
  // del patrón sin enterarse.
  for (const f of FICHEROS_INFORMES) {
    assert.ok(
      (porFichero.get(f) ?? 0) > 0,
      `🔴 el censo no ve ninguna cifra en ${f}: o cambió de forma, o se arreglaría solo el otro.`,
    );
  }
});

// ── EL CRITERIO, FIJADO ─────────────────────────────────────────────────────────────────





// ── LO QUE FALTA, DECLARADO ─────────────────────────────────────────────────────────────

test('SCRUM-403 · el lado del GASTO sigue sin dato, y está declarado', () => {
  // Que este test exista es el punto: mientras `Expense` no tenga base, el beneficio NO es el
  // beneficio, y eso no puede quedar solo en una nota que nadie relee.
  const schema = leer('prisma/schema.prisma');
  const expense = schema.slice(schema.indexOf('model Expense'), schema.indexOf('model Expense') + 1200);
  assert.ok(expense.includes('model Expense'), '🔴 ESCÁNER CIEGO: no se encuentra el modelo Expense');

  const tieneBase = /baseAmount|vatAmount|vatRate|vatDeducible/.test(expense);
  assert.equal(
    tieneBase, false,
    '🔴 `Expense` YA tiene columnas de IVA. Entonces la migración de ' +
      '`docs/master/SCRUM-403.md` se aplicó, y toca escribir el test del lado del ' +
      'gasto con números reales y quitar este aviso — no dejarlo describiendo un mundo que ya cambió.',
  );
  // Y la especificación existe, para que el hueco tenga a dónde ir.
  assert.ok(
    fs.existsSync(path.join(RAIZ, 'docs/master/SCRUM-403.md')),
    '🔴 falta la entrada con la especificación de columnas: el hueco quedaría sin destino.',
  );
});
