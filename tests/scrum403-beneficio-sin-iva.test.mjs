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

/**
 * SCRUM-435 · EL BLOQUE DE UN MODELO SE CORTA POR SU ESTRUCTURA, NUNCA POR UNA LONGITUD.
 *
 * La versión anterior de este guard hacía `schema.slice(i, i + 1200)`. Medido: el modelo `Expense`
 * ocupa **3.473** caracteres y la primera columna que vigilaba —`baseAmount`— está en el offset
 * **1.417**. O sea que la ventana terminaba 217 caracteres antes de poder ver nada:
 *
 *   **el rojo era imposible desde el día uno.** Las columnas entraron y el trinquete siguió verde.
 *
 * Un número fijo es una apuesta sobre cuánto va a crecer un fichero que otros editan, y esa apuesta
 * se pierde sola: basta un comentario nuevo arriba para empujar lo vigilado fuera de la ventana. La
 * llave que cierra sin candado.
 */
function bloqueDeModelo(schema, nombre) {
  const cabecera = `model ${nombre} {`;
  const i = schema.indexOf(cabecera);
  if (i < 0) return null;
  let p = 0;
  for (let j = i + cabecera.length - 1; j < schema.length; j++) {
    if (schema[j] === '{') p++;
    else if (schema[j] === '}') { p--; if (p === 0) return schema.slice(i, j + 1); }
  }
  return null; // llave sin cerrar: es un schema roto, y decirlo es mejor que devolver medio bloque
}

const COLUMNAS_IVA_DEL_GASTO = ['baseAmount', 'vatRate', 'vatAmount', 'vatDeducible'];

test('SCRUM-435 · SUELO: el bloque se localiza por ESTRUCTURA, y la ventana vieja era ciega', () => {
  const schema = leer('prisma/schema.prisma');
  const bloque = bloqueDeModelo(schema, 'Expense');

  // El defecto exacto que persigue este ticket: si no se encuentra el bloque, se DECLARA. Un
  // escáner que no localiza lo que vigila y calla es el trinquete muerto otra vez.
  assert.ok(bloque, '🔴 ESCÁNER CIEGO: no se localiza el bloque `model Expense { … }` en el schema. '
    + 'No se puede afirmar nada sobre sus columnas — ni que están ni que no.');
  assert.ok(bloque.endsWith('}'), '🔴 el bloque no llega a su llave de cierre: se está cortando a medias');

  // Y la prueba de que el número fijo era el defecto, no una preferencia de estilo: al menos una de
  // las columnas vigiladas cae MÁS ALLÁ de donde terminaba la ventana vieja.
  const VENTANA_VIEJA = 1200;
  const fuera = COLUMNAS_IVA_DEL_GASTO
    .map((c) => [c, bloque.indexOf(c)])
    .filter(([, off]) => off >= VENTANA_VIEJA);
  assert.ok(
    fuera.length > 0,
    '🔴 ninguna columna cae fuera de los 1.200 caracteres viejos. Si el modelo ha encogido, este '
    + 'suelo ya no demuestra nada: revísalo en vez de dejarlo pasando por inercia.');
});

test('SCRUM-435 · el trinquete YA SALTÓ: las columnas están, y el cálculo aún no las usa', () => {
  // Este test SUSTITUYE al aviso «`Expense` sigue sin dato», que dejó de ser cierto: las columnas
  // entraron el 10-ago-2026. Pero **tener la columna no es tener el dato**, y ésa es la distinción
  // que el aviso viejo no sabía hacer:
  //
  //   · son NULLABLE y SIN `@default`, y el propio schema declara que NO HAY BACKFILL — deducir la
  //     base de `amount` exige saber si lleva IVA y a qué tipo, y eso no está escrito en ninguna
  //     parte. Así que todo gasto anterior a hoy tiene `baseAmount = null`;
  //   · y `reports.routes.ts` sigue sumando `Number(exp.amount)`, el total con IVA.
  //
  // Por eso el hueco de SCRUM-403 SIGUE ABIERTO, y por eso no se retira sin más: lo que cambia es
  // el MOTIVO. Ya no es «faltan las columnas»; es «no hay datos y nadie las usa».
  const bloque = bloqueDeModelo(leer('prisma/schema.prisma'), 'Expense');
  assert.ok(bloque, '🔴 ESCÁNER CIEGO: sin el bloque no se puede afirmar nada');

  const presentes = COLUMNAS_IVA_DEL_GASTO.filter((c) => bloque.includes(c));
  assert.deepEqual(
    presentes, COLUMNAS_IVA_DEL_GASTO,
    '🔴 faltan columnas de IVA en `Expense`: ' + COLUMNAS_IVA_DEL_GASTO.filter((c) => !presentes.includes(c)).join(', ')
    + '\n\n  Si se han retirado, el hueco de SCRUM-403 vuelve a su estado anterior y este test tiene\n'
    + '  que volver a describirlo así. No lo dejes describiendo un mundo que ya cambió.');

  // Y la otra mitad, que es la que mantiene vivo el hueco.
  const informes = leer('src/modules/reports/app/routes/reports.routes.ts');
  const usaLaBase = /monthlyExpenses\[[^\]]*\]\s*\+=[^;]*\b(baseAmount|vatAmount)\b/.test(informes);
  assert.equal(
    usaLaBase, false,
    '🔴 INFORMES YA USA LA BASE DEL GASTO, y este test sigue diciendo que el hueco está abierto.\n\n'
    + '  Columnas encontradas: ' + presentes.join(', ') + '\n'
    + '  Entonces el «Beneficio neto» ya no resta cifras con IVA en los dos lados, y toca:\n'
    + '    · retirar la declaración del hueco de `docs/master/SCRUM-403.md`, y\n'
    + '    · escribir el vector del lado del GASTO con números reales, como se hizo con el de la\n'
    + '      factura (1.000+210 contra 400+84 → 600, no 726).\n\n'
    + '  Ojo con los gastos anteriores: sus columnas son `null` y no hay backfill, así que el\n'
    + '  periodo mezclaría gastos con base y gastos sin ella. Eso hay que decidirlo, no heredarlo.');
});

