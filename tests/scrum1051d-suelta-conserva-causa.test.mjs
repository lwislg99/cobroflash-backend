// tests/scrum1051d-suelta-conserva-causa.test.mjs — SCRUM-1051d · GO de regla 40 (Javier, c.21180 punto 1)
//
// La factura SUELTA (`POST /admin/invoices`) conserva la `causa` de cada línea y pasa por
// `exigirCausaLineaEmitible`, igual que la boca de cobro (`lib/invoicing.ts`). Es el rojo de
// 1051c dado la vuelta: allí `validarFacturaSuelta` reconstruía la línea con concept/qty/price/tax
// y la causa se perdía, así que una S2 con `tax: 0` salía como un 0 % sin causa (el builder la
// excluía) y una S2 con `tax: 0.21` salía como un 21 % que COBRABA cuota.
//
// Fuera del GO, y no se mide aquí: el builder, la rama S2 de `registro.builder.ts` y el error 1198
// (punto 2 de c.21180, esperan a la prueba en la AEAT).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';

const { validarFacturaSuelta } = await import('../dist/modules/invoicing/domain/facturaSuelta.js');
const { lineasParaFacturar } = await import('../dist/modules/invoicing/domain/invoiceLines.service.js');
const { calcVatBreakdown } = await import('../dist/modules/invoicing/domain/vat.service.js');
const { exigirCausaLineaEmitible, esErrorCausaLineaNoEmitible } =
  await import('../dist/core/validation/causaLineaEmitible.js');
const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

const LINEA_S2 = Object.freeze({ concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0, causa: 'S2' });

const merchant = { id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Instalaciones QA S.L.', name: 'Instalaciones QA' };
const fakePrisma = (invs) => ({
  merchant: { findUnique: async () => merchant },
  invoice: { findMany: async (a) => (a?.where?.vfHash ? invs.filter((i) => i.vfHash) : invs) },
});
const factura = (lines) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '1000.00', type: 'F1', lines,
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Contratista QA', taxId: 'A11111111' }, rectifies: null,
});

const suelta = (linea) => {
  const v = validarFacturaSuelta({ customerId: 5, lines: [linea] });
  assert.equal(v.ok, true, `CIEGO: la validación no aceptó el cuerpo: ${JSON.stringify(v)}`);
  assert.equal(v.lineas.length, 1);
  return v.lineas[0];
};

// ── ① la función pura ───────────────────────────────────────────────────────────────────────

test('1051d ① · la suelta CONSERVA la causa S2 (y las otras cuatro claves llegan igual)', () => {
  assert.deepEqual(suelta({ ...LINEA_S2 }),
    { concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0, causa: 'S2' });
});

test('1051d ① · una S2 con tax 0.21 que entra por la suelta NO cobra cuota (la autorrepercute el destinatario)', () => {
  const l = suelta({ ...LINEA_S2, tax: 0.21 });
  assert.equal(l.causa, 'S2');
  const bd = calcVatBreakdown([l]);
  // Suelo: la base se calcula, para que «cuota 0» no se lea sobre un desglose vacío.
  assert.equal(bd.base, 1000);
  assert.equal(bd.cuota, 0);
});

test('1051d ① · control: una línea SIN causa sale con las cuatro claves de siempre, sin una `causa` vacía', () => {
  const l = suelta({ concept: 'Material', qty: 2, price: 50, tax: 0.21 });
  assert.deepEqual(l, { concept: 'Material', qty: 2, price: 50, tax: 0.21 });
  assert.equal('causa' in l, false);
  assert.equal('causa' in suelta({ concept: 'Material', qty: 1, price: 1, tax: 0.21, causa: null }), false);
});

test('1051d ① · una causa NO activa (E1) se conserva y la rechaza el portón de la casa, no se cae en silencio', () => {
  const l = suelta({ ...LINEA_S2, causa: 'E1' });
  assert.equal(l.causa, 'E1');
  assert.throws(() => exigirCausaLineaEmitible([l]), (e) => esErrorCausaLineaNoEmitible(e));
  // Control: la S2 sí pasa el mismo portón.
  assert.doesNotThrow(() => exigirCausaLineaEmitible([suelta({ ...LINEA_S2 })]));
});

test('1051d ① · la línea S2 que sale de la suelta SELLA en el registro, igual que la de presupuesto', async () => {
  const deSuelta = suelta({ ...LINEA_S2 });
  const dePresupuesto = lineasParaFacturar({ lines: [{ ...LINEA_S2 }], discountGlobalAmount: null })[0];
  assert.equal(dePresupuesto.causa, 'S2', 'control: de presupuesto a factura la causa se conserva, como hoy');
  for (const [nombre, linea] of [['suelta', deSuelta], ['presupuesto', dePresupuesto]]) {
    const { excluidos, xml } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fakePrisma([factura([linea])]));
    assert.deepEqual(excluidos, [], `la línea S2 de ${nombre} no sella`);
    assert.match(xml, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion>/, `la línea de ${nombre} no sale S2`);
  }
});

// ── ② la ruta: `POST /admin/invoices` llama al portón, entre validar y emitir ────────────────
// Por AST y sobre LLAMADAS: el comentario que explica el portón y el `import` mantienen la palabra
// viva en el fichero aunque la llamada desaparezca (SCRUM-745).

const fuenteRuta = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
const sf = ts.createSourceFile(RUTA, fuenteRuta, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function handlerDelPost(raiz) {
  let hallado = null;
  const visita = (n) => {
    if (hallado) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'post' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === '/') {
      hallado = n;
      return;
    }
    ts.forEachChild(n, visita);
  };
  visita(raiz);
  return hallado;
}

function llamadas(nodo) {
  const out = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      out.push({ nombre: n.expression.text, pos: n.getStart(sf), arg: n.arguments[0]?.getText(sf) });
    }
    ts.forEachChild(n, visita);
  };
  visita(nodo);
  return out;
}

test('1051d ② · POST /admin/invoices llama a exigirCausaLineaEmitible(val.lineas) después de validar y antes de emitir', () => {
  const post = handlerDelPost(sf);
  assert.ok(post, `CIEGO: no encuentro router.post('/', …) en ${RUTA}`);
  const ll = llamadas(post);
  const primera = (nombre) => ll.find((c) => c.nombre === nombre);
  const validar = primera('validarFacturaSuelta');
  const emitir = primera('emitInvoice');
  const tipos = primera('exigirTiposDeIvaEmitibles');
  // Suelo: el handler es el de la suelta, con sus dos extremos y el portón vecino.
  assert.ok(validar && emitir && tipos, `CIEGO: el handler no trae validar/emitir/tipos (${ll.map((c) => c.nombre).join(', ')})`);
  const causa = ll.filter((c) => c.nombre === 'exigirCausaLineaEmitible');
  assert.equal(causa.length, 1, 'POST /admin/invoices no llama (exactamente una vez) a exigirCausaLineaEmitible');
  assert.equal(causa[0].arg, 'val.lineas', 'el portón no recibe las líneas que se emiten');
  assert.ok(causa[0].pos > validar.pos && causa[0].pos < emitir.pos, 'el portón no va entre validar y emitir');
});

test('1051d ② · el portón que llama la ruta es EL de la casa (core/validation), no una copia', () => {
  const imp = sf.statements.find((s) => ts.isImportDeclaration(s)
    && s.moduleSpecifier.text.endsWith('core/validation/causaLineaEmitible'));
  assert.ok(imp, 'la ruta no importa exigirCausaLineaEmitible de core/validation/causaLineaEmitible');
  const nombres = imp.importClause?.namedBindings?.elements?.map((e) => e.name.text) ?? [];
  assert.ok(nombres.includes('exigirCausaLineaEmitible'));
  // Ninguna función homónima declarada en la ruta.
  let declarada = false;
  const visita = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name?.getText(sf) === 'exigirCausaLineaEmitible') declarada = true;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.equal(declarada, false, 'la ruta declara su propia exigirCausaLineaEmitible');
});

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/invoicing/domain/facturaSuelta.ts',
    de: '    if (l.causa !== undefined && l.causa !== null) linea.causa = l.causa as Causa;\n',
    a: '',
    cae: '1051d ① · la suelta CONSERVA la causa S2',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '    exigirCausaLineaEmitible(val.lineas);\n',
    a: '',
    cae: '1051d ② · POST /admin/invoices llama a exigirCausaLineaEmitible(val.lineas)',
  },
];
