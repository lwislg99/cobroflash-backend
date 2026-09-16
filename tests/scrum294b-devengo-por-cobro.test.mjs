// SCRUM-294 (fase B) · CON CRITERIO DE CAJA, EL IVA DEVENGA CUANDO SE COBRA.
//
// Sin gate: núcleo puro + el repo del libro contra un doble en memoria. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CASO QUE DECIDE EL TICKET, Y ES UNO SOLO
//
//   «Una factura de un merchant con criterio de caja, EMITIDA en un trimestre y COBRADA en otro,
//    queda asociada al TRIMESTRE DEL COBRO.»
//
// Si ese test no existe y no pasa, el ticket no está hecho aunque lo demás esté verde.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO NO ES UNA CASILLA
//
// Un facturador sin pasarela solo puede ofrecer el RECC como casilla informativa: no sabe cuándo
// cobras, así que su usuario lleva en una libreta qué facturas ha cobrado para poder liquidar.
// Aquí el cobro está dentro, así que el criterio de caja **mueve el dato**: de este libro sale el
// 303, y lo que cambia es en qué declaración cae cada euro.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  campoDeDevengo, fechaDeDevengo, CAMPO_EMISION, CAMPO_COBRO,
} from '../dist/modules/invoicing/domain/devengoPorCaja.js';
import { leerLibroRegistro } from '../dist/modules/invoicing/domain/libroRegistro.repo.js';
import { rangoTrimestre } from '../dist/modules/fiscal/modelo303/modelo303.js';

// ── El doble de base: guarda las facturas y responde al `where` como lo haría Postgres ───

/** Una factura emitida en el Q1 y cobrada en el Q2 — el caso del ticket. */
const FACTURA = {
  id: 1, merchantId: 7, number: 'F-2026-001',
  createdAt: new Date(2026, 1, 15, 12, 0, 0),   // 15-feb-2026 → Q1
  paidAt: new Date(2026, 4, 20, 12, 0, 0),      // 20-may-2026 → Q2
  type: 'F1', total: '121.00', currency: 'EUR', status: 'paid',
  customerId: 3, quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ qty: 1, price: 100, tax: 0.21 }],
};

function baseCon(facturas) {
  const cumple = (valor, filtro) => {
    if (!filtro) return true;
    if (filtro.gte && !(valor && valor >= filtro.gte)) return false;
    if (filtro.lte && !(valor && valor <= filtro.lte)) return false;
    return true;
  };
  return {
    invoice: {
      async findMany(args) {
        const w = args.where || {};
        return facturas.filter((f) => f.merchantId === w.merchantId
          && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt));
      },
    },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
  };
}

const Q = (n) => rangoTrimestre(2026, n);
const numerosDelLibro = (libro) => libro.asientos.map((a) => a.numero);

// ── 🔴 EL CONTROL NEGATIVO VA PRIMERO ────────────────────────────────────────────────────

test('SCRUM-294 f2 · 🔴 CONTROL NEGATIVO: sin criterio de caja se devenga por EMISIÓN, como hoy', () => {
  // Primero, porque es la inmensa mayoría de los merchants. Probar solo el caso nuevo no demuestra
  // que no se haya roto el viejo — y el viejo es todo el dinero que hoy declara bien.
  assert.equal(campoDeDevengo(false), CAMPO_EMISION,
    '🔴 un merchant que declara NO estar acogido al RECC ha dejado de devengar por emisión.');
  const f = { createdAt: new Date(2026, 1, 15), paidAt: new Date(2026, 4, 20) };
  assert.deepEqual(fechaDeDevengo(f, CAMPO_EMISION), f.createdAt,
    '🔴 sin RECC, la fecha que decide tiene que ser la de emisión.');
});

test('SCRUM-294 f2 · 🔴 CONTROL NEGATIVO: el libro SIN preguntar por el criterio no cambia', async () => {
  // Nadie pasa `criterioCaja` hoy —la columna del merchant no existe—, así que el libro tiene que
  // comportarse EXACTAMENTE como siempre: filtra por emisión.
  const db = baseCon([FACTURA]);
  const q1 = await leerLibroRegistro(db, { merchantId: 7, ...Q(1) });
  const q2 = await leerLibroRegistro(db, { merchantId: 7, ...Q(2) });
  assert.deepEqual(numerosDelLibro(q1), ['F-2026-001'],
    '🔴 SIN preguntar por el criterio, la factura tiene que salir en el trimestre de EMISIÓN (Q1). '
    + 'Si ha dejado de salir, este cambio ha movido el 303 de todos los merchants.');
  assert.deepEqual(numerosDelLibro(q2), [],
    '🔴 sin criterio de caja, la factura NO puede aparecer en el trimestre del cobro.');
});

// ── 🔴 EL CASO QUE DECIDE EL TICKET ──────────────────────────────────────────────────────

test('SCRUM-294 f2 · 🔴 EL CASO: emitida en Q1 y cobrada en Q2, con RECC declara en Q2', async () => {
  const db = baseCon([FACTURA]);
  const q1 = await leerLibroRegistro(db, { merchantId: 7, ...Q(1), criterioCaja: true });
  const q2 = await leerLibroRegistro(db, { merchantId: 7, ...Q(2), criterioCaja: true });

  assert.deepEqual(numerosDelLibro(q2), ['F-2026-001'],
    '🔴 LA FACTURA NO HA CAÍDO EN EL TRIMESTRE DEL COBRO.\n\n'
    + `  F-2026-001 se emitió el ${FACTURA.createdAt.toLocaleDateString('es-ES')} (Q1) y se cobró\n`
    + `  el ${FACTURA.paidAt.toLocaleDateString('es-ES')} (Q2). Con criterio de caja el IVA devenga\n`
    + '  AL COBRAR, así que tiene que declarar en el SEGUNDO trimestre.\n'
    + '  Si sale en el primero, el merchant liquida un IVA que todavía no había cobrado.');

  assert.deepEqual(numerosDelLibro(q1), [],
    '🔴 F-2026-001 SIGUE APARECIENDO EN EL TRIMESTRE DE EMISIÓN (Q1) pese al criterio de caja.\n'
    + '  Y si aparece en los dos, el mismo IVA se declara dos veces.');
});

test('SCRUM-294 f2 · con RECC, una factura EMITIDA Y NO COBRADA no cae en ningún trimestre', async () => {
  // No es un hueco: es el dato. Bajo criterio de caja una factura sin cobrar NO devenga, así que
  // meterla en la declaración por su fecha de emisión sería justo lo que el RECC evita.
  const sinCobrar = { ...FACTURA, id: 2, number: 'F-2026-002', paidAt: null, status: 'pending' };
  const db = baseCon([sinCobrar]);
  for (const t of [1, 2, 3, 4]) {
    const libro = await leerLibroRegistro(db, { merchantId: 7, ...Q(t), criterioCaja: true });
    assert.deepEqual(numerosDelLibro(libro), [],
      `🔴 una factura SIN cobrar ha caído en el trimestre ${t} con criterio de caja: se estaría `
      + 'declarando un IVA que no se ha cobrado.');
  }
  // Control positivo del propio caso: sin RECC, esa misma factura SÍ sale por emisión.
  const porEmision = await leerLibroRegistro(db, { merchantId: 7, ...Q(1) });
  assert.deepEqual(numerosDelLibro(porEmision), ['F-2026-002'],
    '🔴 la fixture no sirve: sin criterio de caja esa factura tiene que salir en Q1, o el test de '
    + 'arriba estaría pasando porque la factura no existe.');
});

// ── 🔴 EL SUELO: no se degrada a «sin criterio de caja» ──────────────────────────────────

test('SCRUM-294 f2 · 🔴 SUELO: una lectura fallida LANZA, no cae a «sin criterio de caja»', () => {
  // Es el peor sitio del mundo para degradar: «sin RECC» es un valor legítimo —la mayoría— así que
  // un fallo convertido en «no tiene» produce un 303 que se parece al de todos los demás. Nadie lo
  // notaría nunca.
  for (const malo of [null, undefined, 'sí', 1, 0, {}]) {
    assert.throws(() => campoDeDevengo(malo),
      /no se puede decidir el devengo/,
      `🔴 \`${JSON.stringify(malo)}\` NO ha lanzado: se está degradando a «sin criterio de caja». `
      + 'Un merchant acogido al RECC declararía por emisión y nadie se enteraría.');
  }
  // Y los dos valores legítimos NO lanzan: si lanzara con todo, el guard de arriba no probaría nada.
  assert.equal(campoDeDevengo(true), CAMPO_COBRO);
  assert.equal(campoDeDevengo(false), CAMPO_EMISION);
});

test('SCRUM-294 f2 · 🔴 SUELO: el libro también lanza si le preguntan con un valor ilegible', async () => {
  const db = baseCon([FACTURA]);
  await assert.rejects(
    () => leerLibroRegistro(db, { merchantId: 7, ...Q(1), criterioCaja: 'quizá' }),
    /no se puede decidir el devengo/,
    '🔴 el libro se ha comido una configuración ilegible y ha devuelto un periodo igualmente. Un '
    + '303 que no se puede calcular es un problema visible; uno calculado con el criterio '
    + 'equivocado se descubre en una inspección.');
});
