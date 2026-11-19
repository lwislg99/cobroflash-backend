// tests/scrum1761a-anio-del-xml-por-zona.test.mjs — SCRUM-1761 ① (J1) · arreglo en SCRUM-1761c
//
// El año del XML de VeriFactu (`buildVerifactuRegistrosXml`, `src/modules/invoicing/domain/verifactu.service.ts`)
// elegía sus facturas con `createdAt` entre `new Date(params.year, 0, 1)` y
// `new Date(params.year, 11, 31, 23, 59, 59, 999)`: el calendario del PROCESO. La fecha que el mismo XML
// imprime (`FechaExpedicionFactura`, que sale de `createdAt`) sale en la zona del EMISOR (SCRUM-735,
// `zonaDelMerchant`). Los dos relojes no tienen por qué coincidir, y en el borde del año no coincidían.
//
// SCRUM-1761c · DECISIÓN A del fundador (SCRUM-1761 c.22126, «A») y GO para tocar esas dos líneas
// (c.22136, «GO»): el XML del año N lleva las facturas cuya fecha de EXPEDICIÓN cae en N en la zona del
// emisor. La declaración del defecto se RETIRA en el mismo cambio que lo arregla.
//
// Camino de emisión: este test SÓLO LO LEE (regla 38). EJECUTA el servicio de `dist/` tal cual, con una base
// doblada que aplica el filtro `createdAt` que el servicio le pide. No exporta, extrae ni mueve nada.
//
// Cómo juzga (igual que `scrum1055b`):
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no conformidad.
//   · DECLARADO + el comportamiento cambió → ROJO: quien lo arregle retira la declaración en su PR.
//   · RETIRADO + defecto presente → ROJO: retirar la declaración no es arreglarlo.
//   · el instrumento no ve el registro en exactamente un año, o sus dos sondas del año del emisor no
//     coinciden → CIEGO, que es ROJO.
//
// La zona del proceso se fija aquí a UTC salvo donde se dice: en el servicio de producción de Railway no hay
// variable `TZ` (medido por Javier el 16-nov-2026, SCRUM-1055 c.21873); que la zona por defecto sea UTC NO
// está medido leyendo la hora del proceso.
import test from 'node:test';
import assert from 'node:assert/strict';

/** La declaración del defecto: RETIRADA en SCRUM-1761c, que lo arregla (c.22126 · c.22136). */
export const DEFECTO_CONOCIDO = {
  anioDelXmlEnZonaDelProceso: { declarado: false,
    tickets: ['SCRUM-1761', 'SCRUM-1445'],
    que: 'el XML del año N elegía sus facturas con el calendario del proceso: con TZ=UTC, una factura del 31-dic 23:30Z de un emisor en Pacific/Kiritimati (allí ya es 1-ene) salía en el XML del año N con FechaExpedicionFactura del año N+1' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Volver a declarar el defecto con el arreglo puesto.
    fichero: 'tests/scrum1761a-anio-del-xml-por-zona.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  anioDelXmlEnZonaDelProceso: { declarado: false,',
    a: 'DEFECTO_CONOCIDO = {\n  anioDelXmlEnZonaDelProceso: { declarado: true,',
    cae: 'SCRUM-1761c · el año del XML es el de expedición en la zona del emisor (los 4 casos de c.22059)',
  },
  {
    // El principio del año vuelve al calendario del proceso.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: 'gte: inicioDelDiaEn(`${params.year}-01-01`, zona),',
    a: 'gte: new Date(params.year, 0, 1),',
    cae: 'SCRUM-1761c · el año del XML es el de expedición en la zona del emisor (los 4 casos de c.22059)',
  },
  {
    // El final del año vuelve al calendario del proceso.
    fichero: 'src/modules/invoicing/domain/verifactu.service.ts',
    de: 'lte: finDelDiaEn(`${params.year}-12-31`, zona),',
    a: 'lte: new Date(params.year, 11, 31, 23, 59, 59, 999),',
    cae: 'SCRUM-1761c · el año del XML es el de expedición en la zona del emisor (los 4 casos de c.22059)',
  },
];

const { buildVerifactuRegistrosXml } = await import('../dist/modules/invoicing/domain/verifactu.service.js');

// 31-dic-2026 23:30Z. En Pacific/Kiritimati (UTC+14) es 1-ene-2027 13:30; en Pacific/Midway (UTC-11), 31-dic 12:30.
const INSTANTE = new Date('2026-12-31T23:30:00Z');

/** Corre `fn` con el proceso en la zona `tz` y la deja como estaba. */
async function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return await fn(); } finally {
    if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
  }
}

const cumple = (v, f) => !f || ((!f.gte || v >= f.gte) && (!f.lte || v <= f.lte));

/**
 * Exporta el XML de `year` para un emisor en `timezone` con UNA factura creada en `instante`.
 * `sembrarFiltroDelProceso`: POSITIVO SEMBRADO del instrumento. La base doblada ignora el filtro que pide el
 * servicio y aplica el de antes del arreglo (calendario del proceso). Sirve para ver que el instrumento
 * todavía distingue DEFECTO de COINCIDE aunque el servicio ya no lo produzca.
 */
async function exportar(year, timezone, instante, sembrarFiltroDelProceso) {
  const merchant = { id: 1761, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA', timezone };
  const factura = {
    number: '2026-CF-1761', createdAt: instante, total: '121.00', type: 'F1',
    lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
    vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  };
  const filtroDelProceso = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59, 999) };
  const base = {
    merchant: { findUnique: async () => merchant },
    // El filtro que el servicio le pide a Prisma, aplicado de verdad: es lo que se mide.
    invoice: { findMany: async (a) => [factura].filter((f) => (a?.where?.vfHash ? f.vfHash
      : cumple(f.createdAt, sembrarFiltroDelProceso ? filtroDelProceso : a?.where?.createdAt))) },
  };
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: merchant.id, year }, base);
  return [...xml.matchAll(/<sum1:FechaExpedicionFactura>([^<]*)<\/sum1:FechaExpedicionFactura>/g)].map((m) => m[1]);
}

/** El año del instante en la zona del emisor, por una sonda que no pasa por el servicio. */
const anioEnZona = (d, timeZone) => Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(d));

export async function medirAnio({ timezone, instante = INSTANTE, procesoTz = 'UTC', sembrarFiltroDelProceso = false }) {
  return enZona(procesoTz, async () => {
    const enAnio = {};
    for (const y of [2026, 2027]) enAnio[y] = await exportar(y, timezone, instante, sembrarFiltroDelProceso);
    const anios = [2026, 2027].filter((y) => enAnio[y].length > 0);
    const poblacion = `1 factura de ${instante.toISOString()} · emisor ${timezone} · proceso ${procesoTz} · `
      + `XML 2026 → [${enAnio[2026]}] · XML 2027 → [${enAnio[2027]}]`;
    if (anios.length !== 1 || enAnio[anios[0]].length !== 1) return { estado: 'CIEGO', poblacion };
    const anioDelXml = anios[0];
    const anioImpreso = Number(enAnio[anioDelXml][0].slice(-4));
    const anioDelEmisor = anioEnZona(instante, timezone);
    // Dos sondas independientes del año del emisor: la fecha que imprime el servicio y `Intl`.
    if (anioImpreso !== anioDelEmisor) return { estado: 'CIEGO', poblacion: `${poblacion} · impreso ${anioImpreso} ≠ Intl ${anioDelEmisor}` };
    const p = `${poblacion} · año del XML ${anioDelXml} · año del emisor ${anioDelEmisor}`;
    return { estado: anioDelXml === anioDelEmisor ? 'COINCIDE' : 'DEFECTO', anioDelXml, poblacion: p };
  });
}

export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  switch (medida.estado) {
    case 'CIEGO':
      return { ok: false, motivo: `CIEGO: el instrumento no ve el registro en exactamente un año, o sus dos sondas discrepan (${medida.poblacion}). Eso no es un verde.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (SCRUM-1761): ${medida.poblacion}. No es conformidad.` }
        : { ok: false, motivo: `El año del XML no es el de expedición en la zona del emisor (decisión A, SCRUM-1761 c.22126): ${medida.poblacion}.` };
    default:
      return declarado
        ? { ok: false, motivo: `El año del XML ha CAMBIADO con el defecto todavía declarado: ${medida.poblacion}. `
          + 'Si es el arreglo, retira `anioDelXmlEnZonaDelProceso` de DEFECTO_CONOCIDO en este mismo cambio.' }
        : { ok: true, motivo: `Declaración retirada y los dos años coinciden: ${medida.poblacion}.` };
  }
}

/** Los 4 casos de SCRUM-1761 c.22059, con el año del XML que pide la decisión A. */
const CASOS = [
  { timezone: 'Pacific/Kiritimati', instante: INSTANTE, procesoTz: 'UTC', xml: 2027 },
  { timezone: 'Pacific/Midway', instante: INSTANTE, procesoTz: 'UTC', xml: 2026 },
  { timezone: 'Pacific/Kiritimati', instante: INSTANTE, procesoTz: 'Pacific/Kiritimati', xml: 2027 },
  { timezone: 'Pacific/Midway', instante: new Date('2027-01-01T05:00:00Z'), procesoTz: 'UTC', xml: 2026 },
];

test('SCRUM-1761c · el año del XML es el de expedición en la zona del emisor (los 4 casos de c.22059)', async (t) => {
  assert.equal(CASOS.length, 4, 'población: los 4 casos de c.22059');
  for (const c of CASOS) {
    const medida = await medirAnio(c);
    t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
    const v = juicio(medida, DEFECTO_CONOCIDO.anioDelXmlEnZonaDelProceso);
    assert.equal(v.ok, true, `🔴 ${v.motivo}`);
    assert.equal(medida.anioDelXml, c.xml, `🔴 se esperaba el XML ${c.xml}: ${medida.poblacion}`);
  }
});

test('SCRUM-1761a · control: el año del XML ya no depende de la zona del proceso', async () => {
  // La misma factura y el mismo emisor: sólo cambia la zona del PROCESO. El año del XML no debe moverse.
  const enUtc = await medirAnio({ timezone: 'Pacific/Kiritimati', procesoTz: 'UTC' });
  const enKiritimati = await medirAnio({ timezone: 'Pacific/Kiritimati', procesoTz: 'Pacific/Kiritimati' });
  const enMidway = await medirAnio({ timezone: 'Pacific/Kiritimati', procesoTz: 'Pacific/Midway' });
  assert.deepEqual([enUtc.anioDelXml, enKiritimati.anioDelXml, enMidway.anioDelXml], [2027, 2027, 2027],
    `${enUtc.poblacion} | ${enKiritimati.poblacion} | ${enMidway.poblacion}`);
});

test('SCRUM-1761a · control: sin zona guardada, el año es el de UTC (ZONA_POR_DEFECTO, decisión A de SCRUM-643)', async () => {
  // `zonaDelMerchant` cae a UTC: con el proceso en Kiritimati (allí ya es 2027), el borde sigue siendo el de UTC.
  // (Sin `medirAnio`: su sonda `Intl` con `timeZone: undefined` usaría la zona del proceso.)
  const r = await enZona('Pacific/Kiritimati', async () => [await exportar(2026, undefined, INSTANTE), await exportar(2027, undefined, INSTANTE)]);
  assert.deepEqual(r, [['31-12-2026'], []], 'sin zona: la factura del 31-dic 23:30Z va al XML de 2026 (UTC)');
});

test('SCRUM-1761a · control: el instrumento con entradas fabricadas, en los dos sentidos', async () => {
  // SÍ (sembrado): con el filtro de antes del arreglo aplicado por la base, el instrumento dice DEFECTO.
  assert.equal((await medirAnio({ timezone: 'Pacific/Kiritimati', sembrarFiltroDelProceso: true })).estado, 'DEFECTO');
  assert.equal((await medirAnio({ timezone: 'Pacific/Midway', instante: new Date('2027-01-01T05:00:00Z'), sembrarFiltroDelProceso: true })).estado, 'DEFECTO');
  // NO: una factura de mediados de año coincide en cualquier zona.
  assert.equal((await medirAnio({ timezone: 'Pacific/Kiritimati', instante: new Date('2026-06-15T10:00:00Z') })).estado, 'COINCIDE');
  // CIEGO: una factura fuera de 2026 y 2027 no sale en ningún XML de los que se miran.
  assert.equal((await medirAnio({ timezone: 'Europe/Madrid', instante: new Date('2025-06-15T10:00:00Z') })).estado, 'CIEGO');
});

test('SCRUM-1761a · control: las casillas del juicio', () => {
  const d = { declarado: true };
  assert.equal(juicio({ estado: 'DEFECTO', poblacion: '' }, d).ok, true);
  assert.equal(juicio({ estado: 'DEFECTO', poblacion: '' }, { declarado: false }).ok, false);
  assert.equal(juicio({ estado: 'COINCIDE', poblacion: '' }, d).ok, false);
  assert.equal(juicio({ estado: 'COINCIDE', poblacion: '' }, { declarado: false }).ok, true);
  assert.equal(juicio({ estado: 'CIEGO', poblacion: '' }, d).ok, false);
  assert.equal(juicio({ estado: 'CIEGO', poblacion: '' }, { declarado: false }).ok, false);
});
