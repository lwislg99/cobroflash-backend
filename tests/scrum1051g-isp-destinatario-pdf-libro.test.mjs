// tests/scrum1051g-isp-destinatario-pdf-libro.test.mjs — SCRUM-1051g · GO de regla 40 (Javier, c.21750)
//
// ② Una factura con líneas S2 (inversión del sujeto pasivo) se rechaza ANTES de emitir si el
//    cliente no tiene NIF válido (con P4, firmado) o no es `tipoDestinatario = EMPRESARIO` (sin
//    texto: no hay firma, regla 39). En las dos bocas de J1: `POST /admin/invoices` y el cobro.
// ① El PDF imprime P1 («Inversión del sujeto pasivo») y separa la fila S2 del desglose, sólo si
//    hay líneas S2.
// ③ El libro de emitidas lleva la columna P3 («ISP», valor «Sí») en la descarga.
//
// Textos firmados, literales de c.21750: P1, P3 y P4. Registro: docs/microcopy/2026-11-12-SCRUM-1051-isp.md
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');
const sfDe = (r) => ts.createSourceFile(r, leer(r), ts.ScriptTarget.Latest, true);

const P4 = 'Para facturar con inversión del sujeto pasivo, el cliente necesita NIF.';

const {
  destinatarioIspNoValido, exigirDestinatarioParaIsp, esErrorDestinatarioIsp,
  ERROR_ISP_CLIENTE_SIN_NIF, ERROR_ISP_CLIENTE_NO_EMPRESARIO, COPY_ISP_SIN_NIF,
} = await import('../dist/modules/invoicing/domain/destinatarioIsp.js');

const S2 = Object.freeze({ concept: 'Subcontrata de obra', qty: 1, price: 1000, tax: 0, causa: 'S2' });
const NORMAL = Object.freeze({ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 });
// 12345678 mod 23 = 14 → «Z»: DNI válido. Con «A», la letra de control no casa.
const NIF_OK = '12345678Z';
const NIF_MAL = '12345678A';

// ── ② la función pura ───────────────────────────────────────────────────────────────

test('1051g ② · S2 con cliente SIN NIF se rechaza con P4, literal', () => {
  for (const taxId of [null, undefined, '', '   ']) {
    const r = destinatarioIspNoValido([S2], { taxId, tipoDestinatario: 'EMPRESARIO' });
    assert.deepEqual(r, { code: ERROR_ISP_CLIENTE_SIN_NIF, message: P4 }, `taxId=${JSON.stringify(taxId)}`);
  }
  assert.equal(COPY_ISP_SIN_NIF, P4);
});

test('1051g ② · S2 con NIF de control falso se rechaza igual (válido, no sólo presente)', () => {
  const r = destinatarioIspNoValido([NORMAL, S2], { taxId: NIF_MAL, tipoDestinatario: 'EMPRESARIO' });
  assert.equal(r?.code, ERROR_ISP_CLIENTE_SIN_NIF);
});

test('1051g ② · S2 con NIF válido y cliente NO empresario se rechaza, SIN texto (no hay firma)', () => {
  for (const tipoDestinatario of [null, undefined, 'PARTICULAR', 'empresario']) {
    const r = destinatarioIspNoValido([S2], { taxId: NIF_OK, tipoDestinatario });
    assert.deepEqual(r, { code: ERROR_ISP_CLIENTE_NO_EMPRESARIO }, `tipoDestinatario=${tipoDestinatario}`);
    assert.equal('message' in r, false, 'el caso «no es empresario» no lleva texto: no está firmado');
  }
});

test('1051g ② · S2 con NIF válido y EMPRESARIO pasa', () => {
  assert.equal(destinatarioIspNoValido([S2], { taxId: NIF_OK, tipoDestinatario: 'EMPRESARIO' }), null);
  assert.doesNotThrow(() => exigirDestinatarioParaIsp([S2], { taxId: NIF_OK, tipoDestinatario: 'EMPRESARIO' }));
});

test('1051g ② · CONTROL: sin líneas S2 no mira al cliente (lo de siempre no cambia)', () => {
  assert.equal(destinatarioIspNoValido([NORMAL], { taxId: null, tipoDestinatario: null }), null);
  assert.equal(destinatarioIspNoValido([{ ...NORMAL, tax: 0 }], null), null);
  assert.equal(destinatarioIspNoValido([], null), null);
  assert.equal(destinatarioIspNoValido(null, null), null);
});

test('1051g ② · el portón LANZA el error tipado con el código y el texto', () => {
  let err = null;
  try { exigirDestinatarioParaIsp([S2], { taxId: null }); } catch (e) { err = e; }
  assert.ok(err, 'el portón no lanzó con una S2 sin NIF');
  assert.equal(esErrorDestinatarioIsp(err), true);
  assert.equal(err.code, ERROR_ISP_CLIENTE_SIN_NIF);
  assert.equal(err.mensaje, P4);
});

// ── ② las dos bocas de J1, por AST ───────────────────────────────────────────────────

function llamadas(nodo, sf) {
  const out = [];
  const visita = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;
      if (nombre) out.push({ nombre, pos: n.getStart(sf), args: n.arguments.map((a) => a.getText(sf)) });
    }
    ts.forEachChild(n, visita);
  };
  visita(nodo);
  return out;
}

const RUTA = 'src/modules/system/app/routes/invoicesAdmin.routes.ts';
function handlerDelPost(sf) {
  let hallado = null;
  const visita = (n) => {
    if (hallado) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'post' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])
      && n.arguments[0].text === '/') { hallado = n; return; }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return hallado;
}

test('1051g ② · POST /admin/invoices llama al portón ISP con las líneas y el cliente, antes de emitir', () => {
  const sf = sfDe(RUTA);
  const post = handlerDelPost(sf);
  assert.ok(post, `CIEGO: no encuentro router.post('/', …) en ${RUTA}`);
  const ll = llamadas(post, sf);
  const primera = (n) => ll.find((c) => c.nombre === n);
  const validar = primera('validarFacturaSuelta');
  const emitir = primera('emitInvoice');
  assert.ok(validar && emitir, `CIEGO: el handler no trae validar/emitir (${ll.map((c) => c.nombre).join(', ')})`);
  const isp = ll.filter((c) => c.nombre === 'exigirDestinatarioParaIsp');
  assert.equal(isp.length, 1, 'POST /admin/invoices no llama (exactamente una vez) a exigirDestinatarioParaIsp');
  assert.deepEqual(isp[0].args, ['val.lineas', 'customer']);
  assert.ok(isp[0].pos > validar.pos && isp[0].pos < emitir.pos, 'el portón ISP no va entre validar y emitir');
});

test('1051g ② · la consulta del cliente de la suelta trae tipoDestinatario (si no, todo S2 sería «no empresario»)', () => {
  const sf = sfDe(RUTA);
  const post = handlerDelPost(sf);
  const txt = post.getText(sf);
  const m = txt.match(/prisma\.customer\.findFirst\(\{[\s\S]*?select:\s*\{([^}]*)\}/);
  assert.ok(m, 'CIEGO: no encuentro el select de prisma.customer.findFirst en el POST');
  assert.match(m[1], /\btaxId:\s*true\b/, 'CIEGO: el select no trae taxId');
  assert.match(m[1], /\btipoDestinatario:\s*true\b/, 'el select del cliente no trae tipoDestinatario');
});

test('1051g ② · el catch del POST devuelve 422 con el código y, sólo si lo hay, el texto firmado', () => {
  const sf = sfDe(RUTA);
  const txt = handlerDelPost(sf).getText(sf);
  const i = txt.indexOf('esErrorDestinatarioIsp(err)');
  assert.ok(i > 0, 'el catch del POST no reconoce el error del portón ISP: saldría un 500');
  const tramo = txt.slice(i, i + 300);
  assert.match(tramo, /status\(422\)/);
  assert.match(tramo, /error:\s*err\.code/);
  assert.match(tramo, /message:\s*err\.mensaje/);
  assert.ok(i < txt.indexOf("console.error('[POST /admin/invoices]'"), 'el 422 va detrás del 500 genérico');
});

test('1051g ② · el cobro (lib/invoicing) llama al portón ISP con sus líneas y su cliente, antes de la transacción', () => {
  const R = 'src/lib/invoicing.ts';
  const sf = sfDe(R);
  const ll = llamadas(sf, sf);
  const causa = ll.find((c) => c.nombre === 'exigirCausaLineaEmitible');
  assert.ok(causa, 'CIEGO: lib/invoicing.ts ya no llama a exigirCausaLineaEmitible');
  const isp = ll.filter((c) => c.nombre === 'exigirDestinatarioParaIsp');
  assert.equal(isp.length, 1, 'el cobro no llama (exactamente una vez) a exigirDestinatarioParaIsp');
  assert.deepEqual(isp[0].args, ['invoiceLines', 'ch.customer']);
  const tx = ll.find((c) => c.nombre === '$transaction' && c.pos > causa.pos);
  assert.ok(tx, 'CIEGO: no encuentro la $transaction detrás del portón de causa');
  assert.ok(isp[0].pos > causa.pos && isp[0].pos < tx.pos, 'el portón ISP no va entre el de causa y la transacción');
});

// El catálogo de la casa (scripts/meta-guard-mutaciones.mjs → aplicarUna).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/invoicing/domain/destinatarioIsp.ts',
    de: "  if (cliente?.tipoDestinatario !== 'EMPRESARIO') {\n",
    a: '  if (false) {\n',
    cae: '1051g ② · S2 con NIF válido y cliente NO empresario se rechaza',
  },
  {
    fichero: 'src/modules/invoicing/domain/destinatarioIsp.ts',
    de: "  if (!(nif.valido && nif.motivo === 'ok')) {\n",
    a: '  if (!nif.valido) {\n',
    cae: '1051g ② · S2 con cliente SIN NIF se rechaza con P4',
  },
  {
    fichero: 'src/modules/system/app/routes/invoicesAdmin.routes.ts',
    de: '    exigirDestinatarioParaIsp(val.lineas, customer);\n',
    a: '',
    cae: '1051g ② · POST /admin/invoices llama al portón ISP',
  },
  {
    fichero: 'src/lib/invoicing.ts',
    de: '  exigirDestinatarioParaIsp(invoiceLines, ch.customer);\n',
    a: '',
    cae: '1051g ② · el cobro (lib/invoicing) llama al portón ISP',
  },
];
