// tests/scrum1761a-anio-del-xml-por-zona.test.mjs — SCRUM-1761 ① (J1)
//
// El año del XML de VeriFactu (`buildVerifactuRegistrosXml`, `src/modules/invoicing/domain/verifactu.service.ts`)
// elige sus facturas con `createdAt` entre `new Date(params.year, 0, 1)` y
// `new Date(params.year, 11, 31, 23, 59, 59, 999)`: el calendario del PROCESO. La fecha que el mismo XML
// imprime (`FechaExpedicionFactura`) sale en la zona del EMISOR (SCRUM-735, `zonaDelMerchant`). Los dos
// relojes no tienen por qué coincidir, y en el borde del año no coinciden.
//
// Camino de emisión: SÓLO SE LEE (regla 38). Este test EJECUTA el servicio de `dist/` tal cual, con una base
// doblada que aplica el filtro `createdAt` que el servicio le pide. No exporta, extrae ni mueve nada.
//
// 🔴 ES UN TRINQUETE DE UN DEFECTO CONOCIDO, no un verde que lo bendice. Cómo trabaja (igual que `scrum1055b`):
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no conformidad.
//   · DECLARADO + el comportamiento cambió → ROJO: quien lo arregle retira la declaración en su PR.
//   · RETIRADO + defecto presente → ROJO: retirar la declaración no es arreglarlo.
//   · el instrumento no ve el registro en exactamente un año, o sus dos sondas del año del emisor no
//     coinciden → CIEGO, que es ROJO.
//
// LA DECISIÓN QUE FALTA no es de este test ni de J1: qué año manda para el registro de facturación
// (¿el de la fecha de expedición en la zona del emisor?). Está preguntada en SCRUM-1761 para J5/asesor.
// Hasta que se conteste, el test fija lo que hay y declara que los dos años divergen; no dice cuál es el bueno.
//
// La zona del proceso se fija aquí a UTC: en el servicio de producción de Railway no hay variable `TZ`
// (medido por Javier el 16-nov-2026, SCRUM-1055 c.21873); que la zona por defecto sea UTC NO está medido
// leyendo la hora del proceso.
import test from 'node:test';
import assert from 'node:assert/strict';

/** 🔴 La declaración del defecto. Quien lo arregle la retira (`declarado: false`) en el mismo cambio. */
export const DEFECTO_CONOCIDO = {
  anioDelXmlEnZonaDelProceso: { declarado: true,
    tickets: ['SCRUM-1761', 'SCRUM-1445'],
    que: 'el XML del año N elige sus facturas con el calendario del proceso: con TZ=UTC, una factura del 31-dic 23:30Z de un emisor en Pacific/Kiritimati (allí ya es 1-ene) sale en el XML del año N con FechaExpedicionFactura del año N+1' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Retirar la declaración sin arreglar el defecto.
    fichero: 'tests/scrum1761a-anio-del-xml-por-zona.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  anioDelXmlEnZonaDelProceso: { declarado: true,',
    a: 'DEFECTO_CONOCIDO = {\n  anioDelXmlEnZonaDelProceso: { declarado: false,',
    cae: 'SCRUM-1761a · el año del XML sigue en la zona del proceso: defecto declarado',
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

/** Exporta el XML de `year` para un emisor en `timezone` con UNA factura creada en `instante`. */
async function exportar(year, timezone, instante) {
  const merchant = { id: 1761, country: 'ES', taxId: 'B12345678', legalName: 'Fontanería QA S.L.', name: 'Fontanería QA', timezone };
  const factura = {
    number: '2026-CF-1761', createdAt: instante, total: '121.00', type: 'F1',
    lines: [{ concept: 'Reparación', qty: 1, price: 100, tax: 0.21 }],
    vfHash: 'A'.repeat(64), vfPrevHash: null, customer: { name: 'Cliente QA', taxId: 'A11111111' }, rectifies: null,
  };
  const base = {
    merchant: { findUnique: async () => merchant },
    // El filtro que el servicio le pide a Prisma, aplicado de verdad: es lo que se mide.
    invoice: { findMany: async (a) => [factura].filter((f) => (a?.where?.vfHash ? f.vfHash : cumple(f.createdAt, a?.where?.createdAt))) },
  };
  const { xml } = await buildVerifactuRegistrosXml({ merchantId: merchant.id, year }, base);
  return [...xml.matchAll(/<sum1:FechaExpedicionFactura>([^<]*)<\/sum1:FechaExpedicionFactura>/g)].map((m) => m[1]);
}

/** El año del instante en la zona del emisor, por una sonda que no pasa por el servicio. */
const anioEnZona = (d, timeZone) => Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(d));

export async function medirAnio({ timezone, instante = INSTANTE, procesoTz = 'UTC' }) {
  return enZona(procesoTz, async () => {
    const enAnio = {};
    for (const y of [2026, 2027]) enAnio[y] = await exportar(y, timezone, instante);
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
    return { estado: anioDelXml === anioDelEmisor ? 'COINCIDE' : 'DEFECTO', poblacion: p };
  });
}

export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  switch (medida.estado) {
    case 'CIEGO':
      return { ok: false, motivo: `CIEGO: el instrumento no ve el registro en exactamente un año, o sus dos sondas discrepan (${medida.poblacion}). Eso no es un verde.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (SCRUM-1761): ${medida.poblacion}. No es conformidad, y qué año manda está SIN DECIDIR.` }
        : { ok: false, motivo: `Se retiró la declaración y el defecto sigue: ${medida.poblacion}. Retirarla es parte del arreglo, no lo sustituye.` };
    default:
      return declarado
        ? { ok: false, motivo: `El año del XML ha CAMBIADO con el defecto todavía declarado: ${medida.poblacion}. `
          + 'Si es el arreglo, retira `anioDelXmlEnZonaDelProceso` de DEFECTO_CONOCIDO en este mismo cambio (y el arreglo es camino de emisión: GO del fundador).' }
        : { ok: true, motivo: `Declaración retirada y los dos años coinciden: ${medida.poblacion}.` };
  }
}

test('SCRUM-1761a · el año del XML sigue en la zona del proceso: defecto declarado', async (t) => {
  const medida = await medirAnio({ timezone: 'Pacific/Kiritimati' });
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO.anioDelXmlEnZonaDelProceso);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1761a · control: el mismo instante en Pacific/Midway sigue siendo 31-dic y los dos años coinciden', async () => {
  const m = await medirAnio({ timezone: 'Pacific/Midway' });
  assert.equal(m.estado, 'COINCIDE', m.poblacion);
});

test('SCRUM-1761a · control: con el proceso en la zona del emisor el defecto desaparece (lo decide el proceso)', async () => {
  // La misma factura y el mismo emisor: sólo cambia la zona del PROCESO. Si el año del XML cambia, quien
  // lo elige es la máquina, no el comercio.
  const m = await medirAnio({ timezone: 'Pacific/Kiritimati', procesoTz: 'Pacific/Kiritimati' });
  assert.equal(m.estado, 'COINCIDE', m.poblacion);
});

test('SCRUM-1761a · control: el instrumento con entradas fabricadas, en los dos sentidos', async () => {
  // SÍ: el otro sentido del borde. 1-ene-2027 05:00Z es 31-dic 18:00 en Midway: el proceso en UTC la manda al XML de 2027.
  assert.equal((await medirAnio({ timezone: 'Pacific/Midway', instante: new Date('2027-01-01T05:00:00Z') })).estado, 'DEFECTO');
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
