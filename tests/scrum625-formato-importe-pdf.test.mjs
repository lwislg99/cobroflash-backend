// tests/scrum625-formato-importe-pdf.test.mjs — SCRUM-625
//
// LOS DOS DOCUMENTOS ESCRIBEN EL IMPORTE IGUAL. Leído del PDF REAL, no del fuente.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE SE MIDIÓ ANTES DE TOCAR, Y ES PEOR QUE «UNO CON PUNTO Y OTRO CON COMA»
//
// Generando los dos documentos con el mismo caso (105,00 + 12 % = 117,60) y leyendo su texto:
//
//     PRESUPUESTO   con punto: 117.60 · 105.00      con coma: 105,00 · 12,60 · 117,60
//     FACTURA       con punto: —                    con coma: 1,00 · 105,00 · 12,60 · 117,60
//
// O sea que el presupuesto llevaba **LOS DOS FORMATOS EN EL MISMO DOCUMENTO**, y el mismo total
// aparecía escrito de las dos maneras: `117.60` en la fila de la línea y `117,60` en el desglose
// que añadió SCRUM-604b. No era una discrepancia entre documentos: era una dentro de uno.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// NO SE ESCRIBIÓ NINGÚN FORMATEADOR: YA EXISTÍA
//
// `fmtImporte` está exportado en el propio `pdf.service.ts` desde SCRUM-604, con exactamente el
// mismo cuerpo que el `fmt` interno que usa la factura. Los cuatro sitios del presupuesto usaban
// `.toFixed(2)`, que **siempre** escribe punto pase lo que pase el idioma. Esto fue CABLEAR, no
// escribir — el mismo caso que `normalizePhone` en SCRUM-578.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 NO SE TOCA NINGUNA CIFRA, SÓLO EL SEPARADOR
//
// `toFixed(2)` y `fmtImporte` redondean igual: lo que cambia es cómo se escribe, no cuánto vale.
// Hay un test abajo que lo fija comparando los dos con los mismos números.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extraerTextoPdf } from './_texto-del-pdf.mjs';
// SCRUM-694: el scanner de TypeScript, no un filtro por lineas.
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { generateQuotePdf, generateInvoicePdf, fmtImporte } =
  await import('../dist/modules/invoicing/infra/pdf/pdf.service.js');

// El caso de SCRUM-619: 105,00 de base y 12 % → 12,60 de cuota → 117,60 de total.
const LINEAS = [{ concept: 'Mano de obra', qty: 1, price: 105, tax: 0.12 }];
const COMUN = {
  // `merchantId: 2` y no 1: el 1 es el merchant DEMO y no se comporta como uno normal
  // (SCRUM-409). Me lo cazo el mismo guard en SCRUM-574.
  merchantId: 2, merchant: { name: 'Taller' }, customer: { name: 'Cliente' },
  currency: 'EUR', total: '117.60', qrData: 'x',
};

/** Importes de la forma `123.45` (punto) que aparecen en el texto. */
const conPunto = (t) => [...new Set([...t.matchAll(/\d+\.\d{2}/g)].map((m) => m[0]))];
/** Importes de la forma `123,45` (coma). */
const conComa = (t) => [...new Set([...t.matchAll(/\d+,\d{2}/g)].map((m) => m[0]))];

async function textoDe(generar, params) {
  const { outPath } = await generar(params);
  const r = extraerTextoPdf(fs.readFileSync(outPath));
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}. Un texto vacío se leería como «no dice eso», que es un falso verde.`);
  return r.texto;
}

// ── 🔴 EL CONTROL POSITIVO, EN LAS DOS DIRECCIONES ───────────────────────────────────────

test('SCRUM-625 · SUELO: el detector distingue punto de coma EN LOS DOS SENTIDOS', () => {
  // Si sólo se comprobara una dirección, el test podría estar midiendo su propia sonda: un
  // detector que nunca encuentra puntos daría «cero puntos» sobre un documento lleno de ellos.
  const conPuntos = 'Total: 117.60 EUR y 105.00 de base';
  const conComas = 'Total: 117,60 EUR y 105,00 de base';

  assert.deepEqual(conPunto(conPuntos), ['117.60', '105.00'], '🔴 no caza un PUNTO como punto');
  assert.deepEqual(conComa(conPuntos), [], '🔴 ve comas donde sólo hay puntos');

  assert.deepEqual(conComa(conComas), ['117,60', '105,00'], '🔴 no caza una COMA como coma');
  assert.deepEqual(conPunto(conComas), [], '🔴 ve puntos donde sólo hay comas');
});

test('SCRUM-625 · SUELO: el extractor lee un PDF de verdad y encuentra el importe', async () => {
  // Antes de afirmar «cero puntos» hay que saber que el instrumento VE algo. Un extractor mudo
  // daría cero puntos y cero comas, y el test de abajo pasaría sobre un documento en blanco.
  const t = await textoDe(generateQuotePdf, { ...COMUN, quoteId: 9251, number: 'P-9251', lines: LINEAS });
  assert.ok(t.length > 200, '🔴 el texto del PDF es demasiado corto: el extractor no está leyendo');
  assert.ok(conComa(t).length > 0, '🔴 no encuentro NI UN importe en el documento: no mediría nada');
});

// ── LO QUE DECIDE ────────────────────────────────────────────────────────────────────────

test('SCRUM-625 · 🔴 el PRESUPUESTO no escribe NI UN importe con punto', async () => {
  const t = await textoDe(generateQuotePdf, { ...COMUN, quoteId: 9252, number: 'P-9252', lines: LINEAS });
  assert.deepEqual(
    conPunto(t), [],
    '🔴 el presupuesto vuelve a escribir importes con punto. Antes de SCRUM-625 tenía LOS DOS formatos en el mismo documento.',
  );
});

test('SCRUM-625 · la FACTURA sigue sin escribir ninguno con punto (no se ha tocado)', async () => {
  const t = await textoDe(generateInvoicePdf, { ...COMUN, invoiceId: 9253, number: '2026-CF-9253', lines: LINEAS });
  assert.deepEqual(conPunto(t), [], '🔴 la factura ha empezado a escribir con punto');
});

test('SCRUM-625 · 🔴 LOS DOS DOCUMENTOS ESCRIBEN EL MISMO IMPORTE IGUAL', async () => {
  // El ticket entero, en una línea: el mismo número, escrito igual en los dos sitios.
  const q = await textoDe(generateQuotePdf, { ...COMUN, quoteId: 9254, number: 'P-9254', lines: LINEAS });
  const f = await textoDe(generateInvoicePdf, { ...COMUN, invoiceId: 9255, number: '2026-CF-9255', lines: LINEAS });
  for (const importe of ['117,60', '105,00', '12,60']) {
    assert.ok(q.includes(importe), `🔴 el presupuesto no escribe ${importe}`);
    assert.ok(f.includes(importe), `🔴 la factura no escribe ${importe}`);
  }
});

// ── 🔴 NINGUNA CIFRA CAMBIA ──────────────────────────────────────────────────────────────

test('SCRUM-625 · 🔴 sólo cambia el SEPARADOR, nunca el número', async () => {
  // Es la línea roja del encargo: si al unificar el formato cambiara alguna cifra, esto sería
  // otro ticket y bastante peor. Se compara el viejo `toFixed(2)` con el nuevo `fmtImporte`
  // cambiando SÓLO el separador: si el redondeo divergiera en algún valor, cae aquí.
  const valores = [0, 0.005, 0.125, 1, 12.6, 105, 117.6, 999.995, 1234.567, 1e6 + 0.004];
  for (const v of valores) {
    const viejo = v.toFixed(2);
    const nuevo = fmtImporte(v);
    // `fmtImporte` además agrupa miles, así que se le quita el punto de millar antes de comparar.
    const nuevoComparable = nuevo.replace(/\./g, '').replace(',', '.');
    assert.equal(
      Number(nuevoComparable), Number(viejo),
      `🔴 LA CIFRA CAMBIA con ${v}: antes «${viejo}», ahora «${nuevo}». Eso NO es formato, es cálculo.`,
    );
  }
});

// ── QUE NO VUELVA A ENTRAR UN `toFixed` POR LA PUERTA DE ATRÁS ───────────────────────────

test('SCRUM-625 · 🔴 el PDF de presupuesto ya no formatea importes con `toFixed(2)`', () => {
  // Guard sobre el fuente, además del que lee el documento: `toFixed(2)` escribe punto SIEMPRE,
  // pase lo que pase el idioma, así que es la forma en la que este defecto volvería a entrar.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/infra/pdf/pdf.service.ts'), 'utf8');
  // 🔴 SCRUM-694 · ÉSTE ERA EL FILTRO PARCIAL DE LOS TRECE, y el hueco tenía nombre: quitaba las
  // líneas `//` y las `*` de continuación, pero NO las que ABREN un bloque (`/*` y `/**`). Esa
  // primera línea sobrevivía, así que un `/** … toFixed(2) … */` explicando por qué está prohibido
  // habría hecho saltar el guard por su propia documentación.
  //
  // Y hay un segundo motivo para el scanner aquí: este guard hace `slice(indexOf(…))` para acotar
  // la función. `soloCodigo()` NO ENCOGE el texto —pone los comentarios en blanco y conserva los
  // saltos—, así que el índice sigue apuntando al mismo sitio del fichero. Un filtro que acortara
  // mediría OTRO bloque, en silencio.
  const codigo = soloCodigo(fuente);
  const desdeQuote = codigo.slice(codigo.indexOf('export async function generateQuotePdf'));
  assert.ok(desdeQuote.length > 1000, '🔴 SUELO: no encuentro la función del presupuesto');
  assert.ok(desdeQuote.includes('fmtImporte('), '🔴 SUELO: la función no usa el formateador, este guard mediría mal');
  assert.equal(
    /toFixed\(2\)/.test(desdeQuote), false,
    '🔴 ha vuelto un `toFixed(2)` al PDF de presupuesto: eso escribe punto pase lo que pase el idioma',
  );
});
