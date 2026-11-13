// tests/scrum1240d-mencion-criterio-caja-pdf.test.mjs — SCRUM-1240d · GO de regla 40 (Javier, c.21776)
//
// La factura imprime la mención del ROF 6.1.p) / RIVA 61 undecies, con el literal FIRMADO en
// SCRUM-1240 c.21776 («Régimen especial del criterio de caja», inicial en mayúscula, línea propia),
// debajo de los totales y antes del bloque VERI*FACTU, y SÓLO si:
//   · el valor CONGELADO al sellar (`Invoice.merchantCriterioCaja`, SCRUM-1129e) es `true` —con
//     NULL o false no hay mención, y NUNCA se lee el `Merchant` vivo (regla 29: el PDF se regenera);
//   · hay al menos un detalle `S1`, la misma condición que la clave `07` del registro;
//   · es una factura: nunca un justificante.
//
// El PDF se genera DE VERDAD y se lee con el lector de la casa (SCRUM-604, `_texto-del-pdf.mjs`).
//
// ⚠️ La condición «hay un S1» vive en el PDF y NO importa el builder: importarlo metería
// `pdf.service.ts` en la población congelada de scrum523d (raíz por importar `fiscal/verifactu/`),
// y recongelarla pide autorización. Por eso el caso «la mención y la 07 no discrepan» la ata aquí
// a `clasificarDetalleDesglose`, el que decide la `07` del XML, sobre las mismas líneas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { lineasDePdf } from './_texto-del-pdf.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const requireCjs = createRequire(import.meta.url);
const { generateInvoicePdf } = requireCjs('../dist/lib/pdf.js');
const { calcVatBreakdown } = requireCjs('../dist/modules/invoicing/domain/vat.service.js');
const { clasificarDetalleDesglose, CLAVE_REGIMEN_CRITERIO_CAJA } =
  requireCjs('../dist/modules/fiscal/verifactu/registro.builder.js');

// Literal de SCRUM-1240 c.21776, punto 1. Ni una palabra más.
const MENCION = 'Régimen especial del criterio de caja';

const S1 = Object.freeze({ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 });
const S1_10 = Object.freeze({ concept: 'Reforma vivienda', qty: 1, price: 100, tax: 0.10 });
const S2 = Object.freeze({ concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0, causa: 'S2' });

let serie = 0;
/** El papel, leído: todas sus líneas de texto. `extra` se mezcla en los parámetros. */
async function papel(lines, extra = {}, total = '121.00') {
  serie += 1;
  const { outPath } = await generateInvoicePdf({
    number: `F-2026-QA1240D-${serie}`, invoiceId: 1, merchantId: 7,
    merchant: { name: 'QA 1240d', legalName: 'QA 1240d SL', taxId: 'B00000000' },
    customer: { name: 'Cliente QA' }, currency: 'EUR', total, qrData: 'x', lines, zona: null,
    createdAt: new Date('2026-11-13T10:00:00Z'),
    ...extra,
  });
  let r;
  try { r = lineasDePdf(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
  assert.equal(r.ok, true, `🔴 NO SUPE LEER EL PDF: ${r.motivo}`);
  const t = r.lineas.map((l) => l.texto);
  // Control positivo del lector: sin el bloque de totales no hay nada que medir.
  assert.ok(t.some((x) => /^TOTAL( COBRADO)?:/.test(x)), '🔴 CIEGO: no encuentro el TOTAL en el papel.');
  return t;
}
const conMencion = (t) => t.filter((x) => x.includes('criterio de caja'));

test('1240d · congelado true + S1: la mención sale, literal, en su línea, tras el TOTAL y antes del QR', async () => {
  const t = await papel([S1], { merchantCriterioCaja: true });
  assert.deepEqual(conMencion(t), [MENCION], 'la mención no sale una vez, en su propia línea y con el literal firmado');
  const iTotal = t.findIndex((x) => x.startsWith('TOTAL:'));
  const iMencion = t.indexOf(MENCION);
  const iQr = t.findIndex((x) => x.startsWith('Escanea el QR'));
  assert.ok(iTotal >= 0 && iQr > 0, '🔴 CIEGO: no encuentro el TOTAL o el bloque del QR');
  assert.ok(iTotal < iMencion && iMencion < iQr, `la mención no va entre los totales y el QR (${iTotal}/${iMencion}/${iQr})`);
});

test('1240d · congelado false, NULL o sin la columna: no hay mención', async () => {
  for (const extra of [{ merchantCriterioCaja: false }, { merchantCriterioCaja: null }, {}]) {
    const t = await papel([S1], extra);
    assert.deepEqual(conMencion(t), [], `sale la mención con ${JSON.stringify(extra)}`);
  }
});

const quitarNumero = (t) => t.filter((x) => !x.includes('QA1240D-'));

test('1240d · CONTROL: sin la columna, con NULL y con false el papel es el mismo', async () => {
  const sinColumna = quitarNumero(await papel([S1], {}));
  assert.ok(sinColumna.length > 5, '🔴 CIEGO: el papel sin la columna casi no tiene texto');
  assert.deepEqual(quitarNumero(await papel([S1], { merchantCriterioCaja: null })), sinColumna, 'NULL no pinta lo mismo que sin la columna');
  assert.deepEqual(quitarNumero(await papel([S1], { merchantCriterioCaja: false })), sinColumna, 'false no pinta lo mismo que sin la columna');
});

test('1240d · CONTROL: con true el papel es el de false más UNA línea, la mención', async () => {
  const f = quitarNumero(await papel([S1], { merchantCriterioCaja: false }));
  const v = quitarNumero(await papel([S1], { merchantCriterioCaja: true }));
  assert.deepEqual(v.filter((x) => x !== MENCION), f, 'con true cambia algo más que la mención');
  assert.equal(v.length, f.length + 1);
});

test('1240d · true con sólo S2 (inversión del sujeto pasivo): no hay mención (la S2 lleva 01, no 07)', async () => {
  const t = await papel([S2], { merchantCriterioCaja: true }, '1000.00');
  assert.deepEqual(conMencion(t), []);
});

test('1240d · true con S1 y S2: hay mención (al menos un detalle S1, c.21776)', async () => {
  const t = await papel([S1, S2], { merchantCriterioCaja: true }, '1121.00');
  assert.deepEqual(conMencion(t), [MENCION]);
});

test('1240d · un justificante nunca lleva la mención, aunque el congelado sea true', async () => {
  const t = await papel([S1], { merchantCriterioCaja: true, type: 'JUST' });
  assert.ok(t.some((x) => x.startsWith('TOTAL COBRADO:')), '🔴 CIEGO: no es el papel de un justificante');
  assert.deepEqual(conMencion(t), []);
});

test('1240d · la mención y la 07 del registro no discrepan: misma decisión que clasificarDetalleDesglose', async () => {
  const casos = [[S1], [S1_10], [S2], [S1, S2], [S1_10, S2], [S1, S1_10]];
  let conSiete = 0;
  for (const lines of casos) {
    for (const criterioCaja of [true, false, null]) {
      const siete = calcVatBreakdown(lines).entries.some((e) => {
        try { return clasificarDetalleDesglose(e, 'x', { criterioCaja }).claveRegimen === CLAVE_REGIMEN_CRITERIO_CAJA; }
        catch { return false; }
      });
      if (siete) conSiete += 1;
      const t = await papel(lines, { merchantCriterioCaja: criterioCaja });
      assert.equal(conMencion(t).length === 1, siete,
        `discrepan con ${JSON.stringify(lines.map((l) => l.causa ?? l.tax))} y criterioCaja=${criterioCaja}`);
    }
  }
  // Positivo derivado: los casos con S1 y true dan 07 (5 de 6). Si da 0, la comparación no midió nada.
  assert.equal(conSiete, 5, `🔴 CIEGO: esperaba 5 casos con 07 y salen ${conSiete}`);
});

// ── Los tres llamadores pasan la columna CONGELADA, nunca el Merchant vivo ─────────────────────
const LLAMADORES = [
  ['src/lib/invoicing.ts', 2],
  ['src/modules/system/app/routes/invoicesAdmin.routes.ts', 1],
];

test('1240d · cada llamada a generateInvoicePdf pasa merchantCriterioCaja de la FACTURA, no del merchant', () => {
  let total = 0;
  for (const [ruta, esperadas] of LLAMADORES) {
    const sf = ts.createSourceFile(ruta, leer(ruta), ts.ScriptTarget.Latest, true);
    const llamadas = [];
    const visita = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'generateInvoicePdf') llamadas.push(n);
      ts.forEachChild(n, visita);
    };
    visita(sf);
    assert.equal(llamadas.length, esperadas, `CIEGO: ${ruta} ya no llama ${esperadas} vez/veces a generateInvoicePdf`);
    for (const c of llamadas) {
      const obj = c.arguments[0];
      assert.ok(obj && ts.isObjectLiteralExpression(obj), `CIEGO: ${ruta} no pasa un objeto literal`);
      const p = obj.properties.find((x) => x.name && x.name.getText(sf) === 'merchantCriterioCaja');
      assert.ok(p && ts.isPropertyAssignment(p), `${ruta}:${sf.getLineAndCharacterOfPosition(c.getStart(sf)).line + 1} no pasa merchantCriterioCaja`);
      const v = p.initializer.getText(sf);
      assert.match(v, /^(inv|invoice)\.merchantCriterioCaja$/, `${ruta} pasa «${v}», no la columna congelada de la factura`);
      total += 1;
    }
  }
  assert.equal(total, 3);
});

test('1240d · pdf.service.ts no lee el criterio de caja vivo (sin `criterioCaja` de un merchant)', () => {
  const src = leer('src/modules/invoicing/infra/pdf/pdf.service.ts');
  assert.ok(src.includes('merchantCriterioCaja'), 'CIEGO: pdf.service.ts no nombra merchantCriterioCaja');
  assert.equal((src.match(/merchant\??\.criterioCaja/g) ?? []).length, 0, 'pdf.service.ts lee merchant.criterioCaja');
});

// El catálogo de la casa (scripts/meta-guard-mutaciones.mjs → aplicarUna).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '  if (criterioCaja !== true) return false;\n',
    a: '  if (criterioCaja == null) return false;\n',
    cae: '1240d · congelado false, NULL o sin la columna: no hay mención',
  },
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "  return calcVatBreakdown(lines).entries.some((e) => e.causa !== 'S2' && Number.isFinite(e.rate) && e.rate > 0);\n",
    a: '  return lines.length > 0;\n',
    cae: '1240d · true con sólo S2 (inversión del sujeto pasivo): no hay mención',
  },
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: '  if (!isReceipt && llevaMencionCriterioCaja(params.merchantCriterioCaja, params.lines ?? [])) {\n',
    a: '  if (llevaMencionCriterioCaja(params.merchantCriterioCaja, params.lines ?? [])) {\n',
    cae: '1240d · un justificante nunca lleva la mención',
  },
  {
    fichero: 'src/modules/invoicing/infra/pdf/pdf.service.ts',
    de: "const MENCION_CRITERIO_CAJA = 'Régimen especial del criterio de caja';\n",
    a: "const MENCION_CRITERIO_CAJA = 'régimen especial del criterio de caja';\n",
    cae: '1240d · congelado true + S1: la mención sale, literal',
  },
  {
    fichero: 'src/lib/invoicing.ts',
    de: '      merchantCriterioCaja: inv.merchantCriterioCaja, // SCRUM-1240d: el CONGELADO, nunca el vivo\n    });',
    a: '      merchantCriterioCaja: inv.merchant.criterioCaja, // SCRUM-1240d: el CONGELADO, nunca el vivo\n    });',
    cae: '1240d · cada llamada a generateInvoicePdf pasa merchantCriterioCaja de la FACTURA',
  },
];
