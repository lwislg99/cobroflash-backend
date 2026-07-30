// SCRUM-236 (2.ª mitad) · LAS CUATRO ETAPAS DEL EMBUDO CUENTAN LA MISMA POBLACIÓN.
//
// El panel se titula **«Funnel de conversión · Cotizaciones»** (`reportsView.js`) y va
// Enviadas → Aceptadas → Facturadas → Cobradas. O sea que la población son los PRESUPUESTOS en
// las cuatro etapas.
//
// El defecto: `collected` contaba TODAS las facturas cobradas del periodo, mientras `invoiced`
// contaba solo las nacidas de un presupuesto. Con una sola factura de albarán cobrada en el mes,
// **Cobradas superaba a Facturadas** — una etapa posterior mayor que la anterior. No es un dato
// impreciso: es un error que el usuario ve, y en un embudo es imposible por definición.
//
// El filtro de `invoiced` NO se toca: una factura sin presupuesto **nunca fue presupuesto**, así
// que no pertenece a este embudo. Lo que se corrige es la ASIMETRÍA entre las dos etapas.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ UN CLIENTE FALSO Y NO LA BD
//
// La diferencia entre las dos etapas vive en el `where` de dos `count`, así que probarla exige
// ver qué filtros se emiten. Con un cliente inyectado —patrón que ya usa
// `buildVerifactuRegistrosXml` y el `fakePrisma` de `scrum145`— el test es ungated y determinista.
//
// El fake es DELIBERADAMENTE TONTO: solo entiende los tres predicados que este embudo usa
// (`status`, rango de fecha, `quoteId: { not: null }`). Si algún día el embudo filtrara por algo
// más, el fake lo IGNORARÍA y el test podría dar verde sobre una consulta que no entiende — por
// eso el último test comprueba que los predicados emitidos son exactamente los esperados, en vez
// de fiarse de que el fake los haya sabido aplicar.
import test from 'node:test';
import assert from 'node:assert/strict';

const { funnelForPeriod } = await import('../dist/modules/metrics/domain/metrics.service.js');

const INI = new Date('2026-07-01T00:00:00Z');
const FIN = new Date('2026-08-01T00:00:00Z');
const DENTRO = new Date('2026-07-15T10:00:00Z');

/**
 * Escenario mínimo que reproduce el defecto: UN presupuesto que llegó a factura y se cobró, y
 * UNA factura cobrada SIN presupuesto (la de albarán/recapitulativa, que es el caso normal).
 *
 *   Facturadas (solo de presupuesto) = 1
 *   Cobradas   (si no filtra)        = 2   ← etapa posterior > anterior
 */
function datos() {
  return {
    quotes: [
      { status: 'accepted', createdAt: DENTRO, acceptedAt: DENTRO, rejectedAt: null },
    ],
    invoices: [
      { quoteId: 101, status: 'paid', createdAt: DENTRO, paidAt: DENTRO },  // nació de presupuesto
      { quoteId: null, status: 'paid', createdAt: DENTRO, paidAt: DENTRO }, // albarán: SIN presupuesto
    ],
  };
}

/** Cliente falso: aplica solo los tres predicados del embudo y APUNTA cada `where` recibido. */
function fakePrisma(d) {
  const wheres = { quote: [], invoice: [] };

  const enRango = (valor, rango) => {
    if (!rango) return true;
    const t = new Date(valor).getTime();
    if (rango.gte && t < new Date(rango.gte).getTime()) return false;
    if (rango.lt && t >= new Date(rango.lt).getTime()) return false;
    return true;
  };
  const casaStatus = (valor, filtro) => {
    if (filtro === undefined) return true;
    if (typeof filtro === 'string') return valor === filtro;
    if (filtro.not !== undefined) return valor !== filtro.not;
    if (Array.isArray(filtro.in)) return filtro.in.includes(valor);
    return true;
  };
  const casaQuoteId = (valor, filtro) => {
    if (filtro === undefined) return true;
    if (filtro && filtro.not === null) return valor != null;
    return true;
  };

  const filtrar = (filas, where) => filas.filter((f) =>
    casaStatus(f.status, where.status)
    && enRango(f.createdAt, where.createdAt)
    && (where.paidAt === undefined || enRango(f.paidAt, where.paidAt))
    && casaQuoteId(f.quoteId, where.quoteId));

  return {
    _wheres: wheres,
    quote: {
      count: async ({ where }) => { wheres.quote.push(where); return filtrar(d.quotes, where).length; },
      findMany: async ({ where }) => { wheres.quote.push(where); return filtrar(d.quotes, where); },
    },
    invoice: {
      count: async ({ where }) => { wheres.invoice.push(where); return filtrar(d.invoices, where).length; },
    },
  };
}

// ── SUELO ANTI-VERDE-HUECO ────────────────────────────────────────────────────────────────
// Si el escenario no trajera una factura cobrada SIN presupuesto, «Cobradas ≤ Facturadas»
// pasaría trivialmente y no habría comprobado nada. Se exige y se comprueba.
test('SCRUM-236 · el escenario contiene el caso difícil (suelo)', () => {
  const d = datos();
  const sinPresupuesto = d.invoices.filter((i) => i.quoteId == null && i.status === 'paid');
  const conPresupuesto = d.invoices.filter((i) => i.quoteId != null && i.status === 'paid');
  assert.ok(sinPresupuesto.length > 0,
    '🔴 SUELO: sin una factura cobrada SIN presupuesto, el assert del embudo pasa en vacío');
  assert.ok(conPresupuesto.length > 0,
    '🔴 SUELO: hace falta también una CON presupuesto, o «Facturadas» sería 0 y no habría embudo');
});

// ── EL DEFECTO ────────────────────────────────────────────────────────────────────────────
test('SCRUM-236 · «Cobradas» no puede superar a «Facturadas»', async () => {
  const cliente = fakePrisma(datos());
  const f = await funnelForPeriod(1, INI, FIN, cliente);

  assert.equal(f.invoiced, 1, 'Facturadas: solo la nacida de presupuesto');
  assert.equal(
    f.collected, 1,
    '🔴 «Cobradas» cuenta una población MÁS ANCHA que «Facturadas».\n\n' +
      '  Este panel se llama «Funnel de conversión · Cotizaciones»: las cuatro etapas cuentan\n' +
      '  PRESUPUESTOS. Si «Cobradas» incluye facturas que nunca nacieron de un presupuesto\n' +
      '  (las de albarán y recapitulativa, que es el caso normal), una etapa posterior supera a\n' +
      '  la anterior — imposible en un embudo, y visible para el usuario.\n\n' +
      '  El arreglo es la simetría: `collected` filtra por `quoteId: { not: null }` igual que\n' +
      '  `invoiced`. El filtro de `invoiced` NO se toca: una factura sin presupuesto nunca fue\n' +
      '  presupuesto.',
  );

  assert.ok(
    f.collected <= f.invoiced,
    `🔴 EMBUDO IMPOSIBLE: Cobradas (${f.collected}) > Facturadas (${f.invoiced})`,
  );
});

// ── LA MONOTONÍA, ETAPA A ETAPA ──────────────────────────────────────────────────────────
test('SCRUM-236 · el embudo no crece en ninguna etapa', async () => {
  const cliente = fakePrisma(datos());
  const f = await funnelForPeriod(1, INI, FIN, cliente);
  const etapas = [
    ['Enviadas', f.sent], ['Aceptadas', f.accepted],
    ['Facturadas', f.invoiced], ['Cobradas', f.collected],
  ];
  for (let i = 1; i < etapas.length; i++) {
    assert.ok(
      etapas[i][1] <= etapas[i - 1][1],
      `🔴 «${etapas[i][0]}» (${etapas[i][1]}) supera a «${etapas[i - 1][0]}» (${etapas[i - 1][1]})`,
    );
  }
});

// ── QUE EL FAKE NO SEA LO QUE SE PRUEBA ──────────────────────────────────────────────────
// El fake solo entiende tres predicados. Si el embudo emitiera otro, lo ignoraría en silencio y
// este fichero podría dar verde sobre una consulta que no comprende. Así que se comprueba lo que
// SE EMITE, no lo que el fake supo aplicar.
test('SCRUM-236 · las dos etapas de factura emiten el MISMO filtro de población', async () => {
  const cliente = fakePrisma(datos());
  await funnelForPeriod(1, INI, FIN, cliente);

  const [wInvoiced, wCollected] = cliente._wheres.invoice;
  assert.ok(wInvoiced && wCollected, '🔴 se esperaban DOS consultas de factura en el embudo');

  assert.deepEqual(
    wInvoiced.quoteId, { not: null },
    '🔴 «Facturadas» dejó de restringirse a facturas nacidas de presupuesto',
  );
  assert.deepEqual(
    wCollected.quoteId, { not: null },
    '🔴 «Cobradas» no lleva el filtro de población: volvería a contar facturas que nunca fueron ' +
      'presupuesto, y el embudo podría crecer.',
  );
  assert.deepEqual(
    wInvoiced.quoteId, wCollected.quoteId,
    '🔴 las dos etapas filtran distinto: pueden desincronizarse otra vez',
  );
});
