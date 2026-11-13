// tests/scrum1129e-clave-regimen-07.test.mjs — SCRUM-1129e (GO del fundador: SCRUM-1129 c.21753;
// columna aprobada en c.21757 y aplicada en las tres bases, c.21762)
//
// Sin gate: ni BD ni red. Ejecuta `dist/` con dobles de Prisma (el patrón de scrum149/scrum209).
//
// Lo que fija, con los cuatro casos de la propuesta (c.21752) más el escritor y la huella:
//   ① criterio de caja congelado `true` + tramo `S1`  → `ClaveRegimen` 07
//   ② criterio de caja congelado `true` + tramo `S2`  → 01 (LIVA 163 duodecies.Dos.d; AEAT §15.6.5)
//   ③ congelado `false` o NULL                        → 01, y con NULL NO se cae al Merchant vivo
//   ④ el XML con 07 VALIDA contra el XSD vendorizado
//   ⑤ el SELLADO escribe `merchantCriterioCaja` con el `Merchant.criterioCaja` de ese momento
//      (una F1); una R1 no lo escribe y sigue en 01, como hoy (pregunta abierta, c.21757)
//   ⑥ la HUELLA no depende del régimen: la misma factura sellada con caja y sin caja da la misma.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { validarRegistrosXml } from './_xsd-verifactu.mjs';


// Cada una imita un defecto que este fichero promete cazar (scripts/meta-guard-mutaciones.mjs).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El builder vuelve a poner 01 fijo: el defecto de 1129.
    fichero: 'src/modules/fiscal/verifactu/registro.builder.ts',
    de: 'regimen?.criterioCaja === true ? CLAVE_REGIMEN_CRITERIO_CAJA : CLAVE_REGIMEN_GENERAL',
    a: 'CLAVE_REGIMEN_GENERAL',
    cae: 'SCRUM-1129e · ① caja congelada + S1',
  },
  {
    // NULL se lee como «en caja»: el 07 se cuela en lo que se selló con 01.
    fichero: 'src/modules/fiscal/verifactu/registro.builder.ts',
    de: 'regimen?.criterioCaja === true ?',
    a: 'regimen?.criterioCaja !== false ?',
    cae: 'SCRUM-1129e · ③ false, NULL o sin régimen',
  },
  {
    // El builder lee otra cosa que la fila (aquí, «siempre en caja»): deja de mandar lo congelado.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: '{ criterioCaja: inv.merchantCriterioCaja }',
    a: '{ criterioCaja: true }',
    cae: 'SCRUM-1129e · ③ con NULL en la fila NO se cae al Merchant vivo',
  },
  {
    // El sellado deja de congelar el régimen.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: 'vfTimestamp: ahora, merchantCriterioCaja: merchantCriterioCajaCongelado }',
    a: 'vfTimestamp: ahora }',
    cae: 'SCRUM-1129e · ⑤ el sellado de una F1 congela',
  },
  {
    // La R1 pasa a congelar el suyo: una decisión que nadie ha tomado (c.21757).
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: "(invoice.type ?? 'F1') === 'F1'",
    a: "(invoice.type ?? 'F1') !== 'X'",
    cae: 'SCRUM-1129e · ⑤ una R1 NO se decide aquí',
  },
];

const { clasificarDetalleDesglose } = await import('../dist/modules/fiscal/verifactu/registro.builder.js');
const { buildVerifactuRegistrosXml, applyVeriFactu } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

const TRAMO_S1 = { rate: 21, base: 100, cuota: 21 };
const TRAMO_S2 = { rate: 0, base: 100, cuota: 0, causa: 'S2' };

// ── ①②③ · el builder, tramo a tramo ─────────────────────────────────────────────────────────

test('SCRUM-1129e · ① caja congelada + S1 → ClaveRegimen 07', () => {
  const d = clasificarDetalleDesglose(TRAMO_S1, 'F-1', { criterioCaja: true });
  assert.equal(d.calificacion, 'S1');
  assert.equal(d.claveRegimen, '07');
});

test('SCRUM-1129e · ② caja congelada + S2 → 01 (la inversión del sujeto pasivo queda fuera de la caja)', () => {
  const d = clasificarDetalleDesglose(TRAMO_S2, 'F-1', { criterioCaja: true });
  assert.equal(d.calificacion, 'S2');
  assert.equal(d.claveRegimen, '01');
});

test('SCRUM-1129e · ③ false, NULL o sin régimen → 01', () => {
  for (const regimen of [{ criterioCaja: false }, { criterioCaja: null }, {}, undefined]) {
    assert.equal(clasificarDetalleDesglose(TRAMO_S1, 'F-1', regimen).claveRegimen, '01', JSON.stringify(regimen));
  }
});

// ── ③④ · por el servicio: la clave sale de la FILA, y el XML valida ─────────────────────────

const merchantVivo = (criterioCaja) => ({
  id: 1, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA', criterioCaja,
});

const mkInvoice = (over = {}) => ({
  number: '2026-CF-001', createdAt: new Date('2026-03-15T10:00:00Z'), total: '121.00', type: 'F1',
  lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
  vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  ...over,
});

const exportar = async (invoices, merchant) => {
  const fake = {
    merchant: { findUnique: async () => merchant },
    invoice: { findMany: async (a) => (a?.where?.vfHash ? invoices.filter((i) => i.vfHash) : invoices) },
  };
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: 7, year: 2026 }, fake);
  return xml;
};

const claves = (xml) => [...xml.matchAll(/<sum1:ClaveRegimen>([^<]*)<\/sum1:ClaveRegimen>/g)].map((m) => m[1]);

test('SCRUM-1129e · ④ la factura congelada en caja sale con 07 y VALIDA contra el XSD', async () => {
  const xml = await exportar([mkInvoice({ merchantCriterioCaja: true })], merchantVivo(true));
  assert.deepEqual(claves(xml), ['07']);
  const { valido, errores } = await validarRegistrosXml(xml, 'scrum1129e-07.xml');
  assert.ok(valido, `el XML con 07 no valida:\n${errores.join('\n')}`);
});

test('SCRUM-1129e · ③ con NULL en la fila NO se cae al Merchant vivo: el merchant hoy en caja sigue en 01', async () => {
  // Una factura sellada antes del escritor (NULL) de un merchant que HOY está en caja.
  const xml = await exportar([mkInvoice({ merchantCriterioCaja: null })], merchantVivo(true));
  assert.deepEqual(claves(xml), ['01']);
});

test('SCRUM-1129e · el valor de la FILA manda sobre el vivo en los dos sentidos', async () => {
  // Sellada en caja, y el merchant ya no lo está: sigue diciendo 07, que es lo que se selló.
  assert.deepEqual(claves(await exportar([mkInvoice({ merchantCriterioCaja: true })], merchantVivo(false))), ['07']);
  // Sellada fuera de caja, y el merchant ya lo está: sigue diciendo 01.
  assert.deepEqual(claves(await exportar([mkInvoice({ merchantCriterioCaja: false })], merchantVivo(true))), ['01']);
});

test('SCRUM-1129e · ② por el servicio: una factura en caja con un tramo S1 y otro S2 da 07 y 01', async () => {
  const lines = [
    { concept: 'Reparación', qty: 1, price: 100, tax: 0.21 },
    { concept: 'Obra', qty: 1, price: 200, tax: 0, causa: 'S2' },
  ];
  const xml = await exportar([mkInvoice({ merchantCriterioCaja: true, lines, total: '321.00' })], merchantVivo(true));
  assert.deepEqual(claves(xml).sort(), ['01', '07']);
  const { valido, errores } = await validarRegistrosXml(xml, 'scrum1129e-mixta.xml');
  assert.ok(valido, `la factura mixta no valida:\n${errores.join('\n')}`);
});

// ── ⑤⑥ · el escritor al sellar, y la huella ───────────────────────────────────────────────

function fakeSellado({ criterioCaja }) {
  const escrito = [];
  const client = {
    invoice: {
      findUnique: async () => ({ lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }] }),
      findFirst: async () => null,
      update: async ({ data }) => { escrito.push(data); return { ...data }; },
    },
    merchant: { findUnique: async () => ({ timezone: null, criterioCaja }) },
    $executeRaw: async () => 1,
    $transaction: async (fn) => fn(client),
  };
  return { client, escrito };
}

const factura = (type = 'F1') => ({
  id: 7, number: '2026-CF-007', total: '121.00', createdAt: new Date('2026-03-15T10:00:00Z'), merchantId: 7, type,
});

async function sellar(criterioCaja, type = 'F1') {
  const { client, escrito } = fakeSellado({ criterioCaja });
  const r = await applyVeriFactu(factura(type), 'B12345678', client);
  assert.equal(escrito.length, 1, 'el sellado escribe la fila una vez');
  return { vfHash: r.vfHash, data: escrito[0] };
}

test('SCRUM-1129e · ⑤ el sellado de una F1 congela el Merchant.criterioCaja de ese momento', async (t) => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-03-15T10:00:05Z') });
  t.after(() => mock.timers.reset());
  for (const v of [true, false, null]) {
    const { data } = await sellar(v);
    assert.ok('merchantCriterioCaja' in data, `el sellado no escribe merchantCriterioCaja (merchant ${v})`);
    assert.equal(data.merchantCriterioCaja, v);
  }
});

test('SCRUM-1129e · ⑤ una R1 NO se decide aquí: no escribe la columna y sigue en 01, como hoy', async (t) => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-03-15T10:00:05Z') });
  t.after(() => mock.timers.reset());
  const { data } = await sellar(true, 'R1');
  assert.equal(data.merchantCriterioCaja, undefined, 'una R1 no congela el régimen: lo que lleva es pregunta del asesor');
});

test('SCRUM-1129e · ⑥ la huella NO depende del régimen: caja y no caja dan la misma', async (t) => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-03-15T10:00:05Z') });
  t.after(() => mock.timers.reset());
  const conCaja = await sellar(true);
  const sinCaja = await sellar(false);
  const sinDato = await sellar(null);
  assert.match(conCaja.vfHash, /^[0-9A-F]{64}$/);
  assert.equal(conCaja.vfHash, sinCaja.vfHash);
  assert.equal(conCaja.vfHash, sinDato.vfHash);
});
