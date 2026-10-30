// SCRUM-1585 · M DE SCRUM-1102: EL MODO DE EMISIÓN MIRA EL SII EN CADA EMISIÓN.
//
// GO del fundador en SCRUM-1585 c.20531 (D0 «Sí, ahora»; D2: el dato del SII es OBLIGATORIO en
// cada consulta que alimente la emisión; D4: la foral FUERA hasta el asesor). Diseño: J6f,
// `docs/master/SCRUM-1102.md`, anexo 1102g §⑤-§⑦. W (la puerta de encendido) ya está en main
// (SCRUM-1102h); M cubre la respuesta que CADUCA (RIVA art. 68 bis): quien contesta «Sí» con la
// facturación ya encendida deja de emitir.
//
// Población declarada: las 3 respuestas del SII + `undefined` (un `select` que no trae la columna)
// × {flag ON, flag OFF} para un español no demo; más el demo, un no español y la foral. Control
// positivo de cada negativa: el MISMO merchant con «No» da `fiscal` y el embudo numera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';


// Las corre `npm run meta:mutaciones`. La primera es el rojo primero: el modo de antes de M.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: "return motivoSiiSinEmision(m) === null ? 'fiscal' : 'receipt';",
    a: "return 'fiscal';", cae: 'SII «Sí» con el flag ON → receipt' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: "if (!isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m })) return 'receipt';",
    a: '', cae: 'con el flag OFF manda el flag' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: 'if (m.llevaLibrosPorSii === false) return null;',
    a: 'if (m.llevaLibrosPorSii !== true) return null;', cae: 'NULL no es «No»' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: 'if (isDemoMerchant(m)) return null;',
    a: '', cae: 'el demo sigue en demo' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: "if (!isFlagEnabled('INVOICING_ES_ENABLED', { merchant: m })) return null;",
    a: '', cae: 'fuera de España el SII no decide' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: 'return m.llevaLibrosPorSii === true ? ERROR_SII_DECLARADO : ERROR_SII_NO_CONSTA;',
    a: 'return m.llevaLibrosPorSii === true ? ERROR_SII_NO_CONSTA : ERROR_SII_DECLARADO;',
    cae: 'por sii_declarado' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: "ERROR_SII_DECLARADO = 'sii_declarado'",
    a: "ERROR_SII_DECLARADO = 'sii_si'", cae: 'los códigos de M son los de W' },
  { fichero: 'src/modules/invoicing/domain/emission.service.ts',
    de: 'llevaLibrosPorSii: boolean | null;',
    a: 'llevaLibrosPorSii?: boolean | null;', cae: 'es obligatorio y admite null' },
  { fichero: 'src/modules/invoicing/domain/invoiceNumber.service.ts',
    de: "throw new Error(motivoSiiSinEmision(m) ?? 'invoicing_es_disabled');",
    a: "throw new Error('invoicing_es_disabled');", cae: 'rechaza con sii_declarado' },
  { fichero: 'src/modules/invoicing/domain/invoiceNumber.service.ts',
    de: 'llevaLibrosPorSii: true,',
    a: '', cae: 'el select pide llevaLibrosPorSii' },
];

const {
  getEmissionMode, motivoSiiSinEmision,
} = await import('../dist/modules/invoicing/domain/emission.service.js');
const { allocateInvoiceNumber } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');
const { cambiarFlagFiscal, ErrorCambioFlag } = await import('../dist/modules/system/domain/flagFiscal.service.js');

const ON = { INVOICING_ES_ENABLED: true };
const ES = (sii, flags = ON, extra = {}) => {
  const m = { id: 7, email: 'pro@ejemplo.es', country: 'ES', flags, ...extra };
  if (sii !== 'ausente') m.llevaLibrosPorSii = sii;
  return m;
};

// ── El modo ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-1585 · control positivo: español, flag ON, SII «No» → fiscal, sin motivo', () => {
  assert.equal(getEmissionMode(ES(false)), 'fiscal');
  assert.equal(motivoSiiSinEmision(ES(false)), null);
});

test('SCRUM-1585 · SII «Sí» con el flag ON → receipt, por sii_declarado', () => {
  assert.equal(getEmissionMode(ES(true)), 'receipt');
  assert.equal(motivoSiiSinEmision(ES(true)), 'sii_declarado');
});

test('SCRUM-1585 · SII «No consta» (NULL) con el flag ON → receipt, por sii_no_consta (NULL no es «No»)', () => {
  assert.equal(getEmissionMode(ES(null)), 'receipt');
  assert.equal(motivoSiiSinEmision(ES(null)), 'sii_no_consta');
});

test('SCRUM-1585 · una lectura sin la columna (undefined) cuenta como «No consta», nunca como «No»', () => {
  assert.equal(getEmissionMode(ES('ausente')), 'receipt');
  assert.equal(motivoSiiSinEmision(ES('ausente')), 'sii_no_consta');
});

test('SCRUM-1585 · con el flag OFF manda el flag: receipt sin motivo del SII, conteste lo que conteste', () => {
  for (const sii of [true, false, null, 'ausente']) {
    assert.equal(getEmissionMode(ES(sii, null)), 'receipt', `sii=${sii}`);
    assert.equal(motivoSiiSinEmision(ES(sii, null)), null, `sii=${sii}`);
  }
});

test('SCRUM-1585 · el demo sigue en demo con el SII en «No consta» (la rama del demo va antes, 1102g §⑦)', () => {
  assert.equal(getEmissionMode({ id: 1, email: 'demo@yaqu.app', country: 'ES', flags: ON, llevaLibrosPorSii: null }), 'demo');
  assert.equal(motivoSiiSinEmision({ id: 1, email: 'demo@yaqu.app', country: 'ES', flags: ON, llevaLibrosPorSii: true }), null);
});

test('SCRUM-1585 · fuera de España el SII no decide (V0-0 sólo gobierna ES)', () => {
  assert.equal(getEmissionMode(ES(true, ON, { country: 'MX' })), 'fiscal');
  assert.equal(motivoSiiSinEmision(ES(true, ON, { country: 'MX' })), null);
});

test('SCRUM-1585 · la foral NO entra en M (D4 de c.20531): con SII «No» y foral «Sí», fiscal', () => {
  assert.equal(getEmissionMode(ES(false, ON, { domicilioFiscalForal: true })), 'fiscal');
});

// ── El embudo: el código de error propio ──────────────────────────────────────────────────

function txFalso(merchant) {
  const registro = { selects: [], escrituras: 0 };
  const tx = {
    $executeRaw: async () => 0,
    merchant: {
      findUnique: async (args) => { registro.selects.push(args.select); return { ...merchant,
        timezone: 'Europe/Madrid', invoiceSeriesPrefix: 'CF', nextInvoiceNumber: 7,
        nextRectInvoiceNumber: 1, invoiceSeriesYear: 2026 }; },
      update: async () => { registro.escrituras += 1; return {}; },
    },
    invoice: { findUnique: async () => null, findMany: async () => [] },
    auditLog: { create: async (args) => args.data },
  };
  return { tx, registro };
}
const reservar = (tx) => allocateInvoiceNumber(
  tx, 7, { camino: 'C3', actor: { tipo: 'pro_propietario', teamMemberId: null } }, new Date('2026-10-23T10:00:00Z'));

test('SCRUM-1585 · embudo · control positivo: con SII «No» numera y escribe la serie', async () => {
  const { tx, registro } = txFalso(ES(false));
  const numero = await reservar(tx);
  assert.ok(numero, 'no devolvió número');
  assert.ok(registro.escrituras >= 1, 'no escribió la serie');
});

test('SCRUM-1585 · embudo · el select pide llevaLibrosPorSii (sin él, «No» llegaría como undefined)', async () => {
  const { tx, registro } = txFalso(ES(false));
  await reservar(tx);
  assert.equal(registro.selects[0]?.llevaLibrosPorSii, true);
});

async function rechazaSinAvanzar(sii, codigo) {
  const { tx, registro } = txFalso(ES(sii));
  await assert.rejects(reservar(tx), (e) => e.message === codigo);
  assert.equal(registro.escrituras, 0);
}

test('SCRUM-1585 · embudo · SII «Sí» → rechaza con sii_declarado y no avanza la serie', () => rechazaSinAvanzar(true, 'sii_declarado'));
test('SCRUM-1585 · embudo · SII «No consta» → rechaza con sii_no_consta y no avanza la serie', () => rechazaSinAvanzar(null, 'sii_no_consta'));

test('SCRUM-1585 · embudo · con el flag OFF el error sigue siendo invoicing_es_disabled', async () => {
  const { tx } = txFalso(ES(true, null));
  await assert.rejects(reservar(tx), (e) => e.message === 'invoicing_es_disabled');
});

// ── W y M dicen lo mismo con el mismo nombre ──────────────────────────────────────────────

test('SCRUM-1585 · los códigos de M son los de W (SCRUM-1102h): un hecho, un nombre', async () => {
  for (const [sii, codigo] of [[true, 'sii_declarado'], [null, 'sii_no_consta']]) {
    const tx = {
      merchant: { findUnique: async () => ES(sii, null, { domicilioFiscalForal: null }), update: async () => ({}) },
      auditLog: { create: async () => ({}) },
      $transaction: async (fn) => fn(tx),
    };
    await assert.rejects(
      cambiarFlagFiscal({ merchantId: 7, flag: 'INVOICING_ES_ENABLED', valorNuevo: true,
        confirmacion: 'pro@ejemplo.es', actor: { tipo: 'sistema', teamMemberId: null, ref: 'test' } }, tx),
      (e) => e instanceof ErrorCambioFlag && e.codigo === codigo,
    );
  }
});

// ── D2: el campo es OBLIGATORIO en el tipo (lo que hace que un select que lo olvide no compile) ──

test('SCRUM-1585 · D2 · `MerchantLike.llevaLibrosPorSii` es obligatorio y admite null (AST del fuente)', () => {
  const ruta = new URL('../src/modules/invoicing/domain/emission.service.ts', import.meta.url);
  const sf = ts.createSourceFile('emission.service.ts', readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true);
  let miembro = null;
  sf.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === 'MerchantLike') {
      miembro = n.members.find((m) => m.name && m.name.getText(sf) === 'llevaLibrosPorSii') ?? null;
    }
  });
  assert.ok(miembro, '🔴 `MerchantLike` no declara `llevaLibrosPorSii`');
  assert.equal(miembro.questionToken, undefined, '🔴 `llevaLibrosPorSii` es opcional: un select que lo olvide compila y cae mudo en «No consta»');
  assert.match(miembro.type.getText(sf), /\bnull\b/, '«No consta» (NULL) tiene que caber en el tipo');
});
