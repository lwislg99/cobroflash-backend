// tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs — SCRUM-1445d (J1) · FASE 1
//
// Decisión del fundador (SCRUM-1445 c.21896): los bordes fiscales se calculan en la zona del COMERCIO,
// en el código y sin tocar `TZ`. Esta fase da la zona a las cuatro funciones de borde (plan de
// c.21898): `rangoTrimestre` (303), `rangoAcumulado` y el aviso de alta (130), `topeDeDevengo` /
// `fechaDeDevengo` y `leerPorCaja` (por `leerLibroRegistro`). Los casos A–G son los de la medición de
// jv-j3cf (c.21891), con la zona pasada a mano.
//
// 🔴 La zona del PROCESO se fija ANTES de cargar `dist/` (jv-j3cf cazó que `TZ=X node` desde Git Bash
// no llega al proceso). Cada caso con zona se corre con el proceso en DOS zonas lejanas (UTC y
// Pacific/Kiritimati, UTC+14): si el resultado cambiase con la máquina, no estaría en la zona dada.
//
// FASE 1 NO CAMBIA A NINGÚN LLAMADOR: sin zona, las funciones calculan lo de siempre (la zona del
// proceso). El caso «sin zona» lo fija, y el DEFECTO_CONOCIDO de `scrum1055b` ② sigue declarado hasta
// la fase 2. Sin gate: ni BD ni red; una base en memoria. No toca `src/`, ni el esquema.
//
// El año del XML exportado (`verifactu.service.ts`, camino de emisión) NO está aquí: es regla 38 y
// queda para su propio test de defecto conocido.
process.env.TZ = 'UTC';

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El 303 ignora la zona que se le pasa.
    fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: '  if (zona !== undefined) return rangoDeMesesEn(año, (t - 1) * 3 + 1, t * 3, zona);',
    a: '  if (zona === "__nunca__") return rangoDeMesesEn(año, (t - 1) * 3 + 1, t * 3, zona);',
    cae: 'SCRUM-1445d · rangoTrimestre con zona',
  },
  {
    // El último día del trimestre se corta un día antes.
    fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: '  const ultimoDia = new Date(Date.UTC(año, mesHasta, 0)).getUTCDate();',
    a: '  const ultimoDia = new Date(Date.UTC(año, mesHasta, 0)).getUTCDate() - 1;',
    cae: 'SCRUM-1445d · rangoTrimestre con zona',
  },
  {
    // El 130 acumulado ignora la zona.
    fichero: 'src/modules/fiscal/modelo130/modelo130.ts',
    de: '  if (zona !== undefined) return rangoDeMesesEn(año, 1, t * 3, zona);',
    a: '  if (zona === "__nunca__") return rangoDeMesesEn(año, 1, t * 3, zona);',
    cae: 'SCRUM-1445d · rangoAcumulado con zona',
  },
  {
    // El aviso de alta vuelve a la zona del proceso aunque se le dé la del comercio.
    fichero: 'src/modules/fiscal/modelo130/modelo130.ts',
    de: '  const altaTardia = params.zona !== undefined',
    a: '  const altaTardia = params.zona === "__nunca__"',
    cae: 'SCRUM-1445d · el aviso de alta a mitad de ejercicio',
  },
  {
    // El tope toma el año del reloj del proceso.
    fichero: 'src/modules/invoicing/domain/devengoPorCaja.ts',
    de: '    const año = Number(diaNaturalEn(createdAt, zona).slice(0, 4));',
    a: '    const año = createdAt.getUTCFullYear();',
    cae: 'SCRUM-1445d · topeDeDevengo con zona',
  },
  {
    // `fechaDeDevengo` no pasa la zona al tope.
    fichero: 'src/modules/invoicing/domain/devengoPorCaja.ts',
    de: '  const tope = topeDeDevengo(factura.createdAt, zona);',
    a: '  const tope = topeDeDevengo(factura.createdAt);',
    cae: 'SCRUM-1445d · topeDeDevengo con zona',
  },
  {
    // El libro por caja no pasa la zona a la fecha de devengo.
    fichero: 'src/modules/invoicing/domain/libroRegistro.repo.ts',
    de: '    const d = fechaDeDevengo(f as never, CAMPO_COBRO, zona);',
    a: '    const d = fechaDeDevengo(f as never, CAMPO_COBRO);',
    cae: 'SCRUM-1445d · leerPorCaja con zona',
  },
  // NO declarada, a propósito: el año (`añoDesde`/`añoHasta`) del PROCESO en `leerPorCaja`. Medida MUDA con
  // aplicarUna (registro 1445d): con un rango de trimestre alineado en la zona, el año del proceso sólo
  // ENSANCHA la consulta de candidatas, y el filtro por `fechaDeDevengo` deja el mismo libro.
  {
    // Sin zona deja de ser «lo de siempre»: la fase 1 cambiaría a los llamadores.
    fichero: 'src/modules/fiscal/modelo303/modelo303.ts',
    de: '    desde: new Date(año, (t - 1) * 3, 1, 0, 0, 0, 0),',
    a: '    desde: new Date(Date.UTC(año, (t - 1) * 3, 1, 0, 0, 0, 0) - 7200000),',
    cae: 'SCRUM-1445d · sin zona, lo de siempre',
  },
];

const { rangoTrimestre } = requiere(rutaDe('dist/modules/fiscal/modelo303/modelo303.js'));
const { rangoAcumulado, construirBorrador130 } = requiere(rutaDe('dist/modules/fiscal/modelo130/modelo130.js'));
const { topeDeDevengo, fechaDeDevengo, CAMPO_COBRO } = requiere(rutaDe('dist/modules/invoicing/domain/devengoPorCaja.js'));
const { leerLibroRegistro } = requiere(rutaDe('dist/modules/invoicing/domain/libroRegistro.repo.js'));

const MADRID = 'Europe/Madrid';
const CANARIAS = 'Atlantic/Canary';
const PROCESOS = ['UTC', 'Pacific/Kiritimati'];

/** Corre `fn` con el proceso en la zona `tz`, y comprueba que el proceso la VE antes de fiarse. */
async function enProceso(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try {
    const visto = new Date(Date.UTC(2026, 0, 1, 12)).getHours();
    assert.equal(visto, tz === 'UTC' ? 12 : 2, `CIEGO: el proceso no está en ${tz} (getHours=${visto})`);
    return await fn();
  } finally { process.env.TZ = antes; }
}
const dentro = (r, iso) => { const t = Date.parse(iso); return t >= r.desde.getTime() && t <= r.hasta.getTime(); };
/** El trimestre (1-4) de `año` en `zona` que contiene el instante, o null. */
function trimestreDe(año, iso, zona) {
  const t = [1, 2, 3, 4].filter((q) => dentro(rangoTrimestre(año, q, zona), iso));
  assert.ok(t.length <= 1, `los trimestres se solapan en ${iso}`);
  return t[0] ?? null;
}

// Los casos de c.21891, como instantes. Esperado: el trimestre en la zona del comercio.
const CASOS = [
  { id: 'A', que: 'cobro 1-abr 00:30 de Madrid', iso: '2026-03-31T22:30:00Z', zona: MADRID, año: 2026, t: 2 },
  { id: 'B', que: 'día declarado 2026-03-31 (medianoche UTC)', iso: '2026-03-31T00:00:00Z', zona: MADRID, año: 2026, t: 1 },
  { id: 'C', que: 'día declarado 2026-04-01', iso: '2026-04-01T00:00:00Z', zona: MADRID, año: 2026, t: 2 },
  { id: 'D', que: '1-ene 00:30 de Madrid', iso: '2025-12-31T23:30:00Z', zona: MADRID, año: 2026, t: 1 },
  { id: 'E', que: 'Canarias, 31-dic 23:30 (invierno)', iso: '2025-12-31T23:30:00Z', zona: CANARIAS, año: 2025, t: 4 },
  { id: 'F', que: 'Canarias, 30-jun 23:30 (verano)', iso: '2026-06-30T22:30:00Z', zona: CANARIAS, año: 2026, t: 2 },
  { id: 'G', que: 'control, 15-may 12:00Z', iso: '2026-05-15T12:00:00Z', zona: MADRID, año: 2026, t: 2 },
];

test('SCRUM-1445d · rangoTrimestre con zona: los casos A–G caen en el trimestre del comercio, sea cual sea el proceso', async () => {
  for (const tz of PROCESOS) {
    await enProceso(tz, () => {
      for (const c of CASOS) {
        assert.equal(trimestreDe(c.año, c.iso, c.zona), c.t, `caso ${c.id} (${c.que}) con el proceso en ${tz}`);
      }
      // Los bordes exactos del T2 de Madrid (verano, UTC+2) y del T4 de Canarias (entra en verano y sale en invierno).
      const t2 = rangoTrimestre(2026, 2, MADRID);
      assert.equal(t2.desde.toISOString(), '2026-03-31T22:00:00.000Z');
      assert.equal(t2.hasta.toISOString(), '2026-06-30T21:59:59.999Z');
      const t4 = rangoTrimestre(2025, 4, CANARIAS);
      assert.equal(t4.desde.toISOString(), '2025-09-30T23:00:00.000Z'); // el 1-oct Canarias aún va en verano (UTC+1)
      assert.equal(t4.hasta.toISOString(), '2025-12-31T23:59:59.999Z');
    });
  }
});

test('SCRUM-1445d · rangoAcumulado con zona: del 1-ene al fin del trimestre en el calendario del comercio', async () => {
  for (const tz of PROCESOS) {
    await enProceso(tz, () => {
      assert.ok(dentro(rangoAcumulado(2026, 1, MADRID), '2025-12-31T23:30:00Z'), `D: el 1-ene 00:30 de Madrid es de 2026 (proceso ${tz})`);
      assert.ok(!dentro(rangoAcumulado(2026, 4, MADRID), '2026-12-31T23:30:00Z'), `el 1-ene-2027 00:30 de Madrid no es de 2026 (proceso ${tz})`);
      assert.ok(dentro(rangoAcumulado(2025, 4, CANARIAS), '2025-12-31T23:30:00Z'), `E: el 31-dic 23:30 de Canarias es de 2025 (proceso ${tz})`);
      assert.ok(dentro(rangoAcumulado(2026, 2, CANARIAS), '2026-06-30T22:30:00Z'), `F: el 30-jun 23:30 de Canarias está en el acumulado al T2 (proceso ${tz})`);
      const r = rangoAcumulado(2026, 3, MADRID);
      assert.equal(r.desde.toISOString(), '2025-12-31T23:00:00.000Z');
      assert.equal(r.hasta.toISOString(), '2026-09-30T21:59:59.999Z');
    });
  }
});

const LIBRO_VACIO = { asientos: [], miradas: 0, sinNumero: 0, sinNumeroImporte: 0 };
const RECIBIDAS_VACIAS = { asientos: [], miradas: 0, sinClasificar: 0, sinClasificarImporte: 0 };
const avisaAlta = (alta, zona) => construirBorrador130({
  libro: LIBRO_VACIO, libroRecibidas: RECIBIDAS_VACIAS, año: 2026, trimestre: 1, altaDelMerchant: new Date(alta), zona,
}).motivosParaNoFiarse.includes('alta_a_mitad_de_ejercicio');

test('SCRUM-1445d · el aviso de alta a mitad de ejercicio: el 2-ene empieza a las 00:00 del comercio', async () => {
  for (const tz of PROCESOS) {
    await enProceso(tz, () => {
      // 2-ene 00:30 de Madrid = 1-ene 23:30Z: ya es 2-ene para el comercio, avisa.
      assert.equal(avisaAlta('2026-01-01T23:30:00Z', MADRID), true, `alta el 2-ene 00:30 de Madrid (proceso ${tz})`);
      // 1-ene 23:30 de Canarias = 1-ene 23:30Z: sigue siendo 1-ene, no avisa.
      assert.equal(avisaAlta('2026-01-01T23:30:00Z', CANARIAS), false, `alta el 1-ene 23:30 de Canarias (proceso ${tz})`);
    });
  }
});

test('SCRUM-1445d · topeDeDevengo con zona: el año de la operación y el 31-dic son los del comercio', async () => {
  for (const tz of PROCESOS) {
    await enProceso(tz, () => {
      // 1-ene-2027 00:30 de Madrid: operación de 2027, tope el 31-dic-2028 de Madrid.
      assert.equal(topeDeDevengo(new Date('2026-12-31T23:30:00Z'), MADRID).toISOString(), '2028-12-31T22:59:59.999Z', `proceso ${tz}`);
      // El mismo instante es el 31-dic-2026 23:30 en Canarias: tope el 31-dic-2027 de Canarias.
      assert.equal(topeDeDevengo(new Date('2026-12-31T23:30:00Z'), CANARIAS).toISOString(), '2027-12-31T23:59:59.999Z', `proceso ${tz}`);
      // `fechaDeDevengo` sin cobro devuelve ESE tope.
      const sinCobro = { createdAt: new Date('2026-12-31T23:30:00Z'), paidAt: null, lines: [{ causa: 'S1' }] };
      assert.equal(fechaDeDevengo(sinCobro, CAMPO_COBRO, MADRID).toISOString(), '2028-12-31T22:59:59.999Z', `proceso ${tz}`);
    });
  }
});

// Base en memoria con el mismo filtro gte/lte que Prisma (el patrón de scrum1055b).
const M = 14450;
const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));
const baseDelLibro = (facturas) => ({
  invoice: { async findMany(args) {
    const w = args.where || {};
    return facturas.filter((f) => f.merchantId === w.merchantId && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt));
  } },
  quote: { async findMany() { return []; } },
  albaran: { async findMany() { return []; } },
  // SCRUM-1732d · invoice_payments: sin filas, cada factura se lee como hoy (100 % en paidAt, c.21926 §①).
  invoicePayment: { async findMany() { return []; } },
});
const factura = (numero, createdAt, paidAt) => ({
  id: Number(numero.replace(/\D/g, '')) || 1, merchantId: M, number: numero, createdAt: new Date(createdAt),
  paidAt: paidAt ? new Date(paidAt) : null, type: 'F1', total: '121.00', currency: 'EUR', status: paidAt ? 'paid' : 'sent',
  customerId: 1, quoteId: null, chargeId: null, albaranRefs: null, lines: [{ qty: 1, price: 100, tax: 0.21 }],
});
async function numerosEn(facturas, año, t, zona) {
  const libro = await leerLibroRegistro(baseDelLibro(facturas), {
    merchantId: M, ...rangoTrimestre(año, t, zona), criterioCaja: true, devengo: true, zona,
  });
  return libro.asientos.map((a) => a.numero);
}

test('SCRUM-1445d · leerPorCaja con zona: cobro y tope en el trimestre del comercio', async () => {
  const facturas = [
    factura('A-1', '2026-03-20T10:00:00Z', '2026-03-31T22:30:00Z'), // caso A: cobrada el 1-abr 00:30 de Madrid
    factura('N-2', '2026-12-31T23:30:00Z', null), // emitida el 1-ene-2027 00:30 de Madrid, sin cobro
  ];
  for (const tz of PROCESOS) {
    await enProceso(tz, async () => {
      assert.deepEqual(await numerosEn(facturas, 2026, 1, MADRID), [], `T1-2026 de Madrid (proceso ${tz})`);
      assert.deepEqual(await numerosEn(facturas, 2026, 2, MADRID), ['A-1'], `T2-2026 de Madrid (proceso ${tz})`);
      // Sin cobro, devenga en el tope: 31-dic-2028 de Madrid, no el de 2027.
      assert.deepEqual(await numerosEn(facturas, 2027, 4, MADRID), [], `T4-2027 de Madrid (proceso ${tz})`);
      assert.deepEqual(await numerosEn(facturas, 2028, 4, MADRID), ['N-2'], `T4-2028 de Madrid (proceso ${tz})`);
    });
  }
});

test('SCRUM-1445d · sin zona, lo de siempre: la fase 1 no cambia a ningún llamador', async () => {
  // Con el proceso en UTC y SIN zona, el caso A sigue en el T1 (el defecto de scrum1055b ②, que
  // retira la fase 2) y los bordes son los del reloj del proceso.
  await enProceso('UTC', () => {
    assert.equal(trimestreDe(2026, '2026-03-31T22:30:00Z', undefined), 1);
    const t2 = rangoTrimestre(2026, 2);
    assert.equal(t2.desde.toISOString(), '2026-04-01T00:00:00.000Z');
    assert.equal(t2.hasta.toISOString(), '2026-06-30T23:59:59.999Z');
    assert.equal(rangoAcumulado(2026, 1).desde.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(topeDeDevengo(new Date('2026-12-31T23:30:00Z')).toISOString(), '2027-12-31T23:59:59.999Z');
  });
  await enProceso('Pacific/Kiritimati', () => {
    assert.equal(rangoTrimestre(2026, 2).desde.toISOString(), '2026-03-31T10:00:00.000Z');
  });
});
