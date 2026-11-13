// tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs — SCRUM-1055b (J1)
//
// Los tests que el enunciado de SCRUM-1055 pedía y no existían (c.21850 de jv-j4bg): el cobro del
// 31-mar confirmado en abril, el borde del trimestre con zona horaria y la devolución. Medido en
// SCRUM-1055 c.21863. Sin gate: ni BD, ni red. EJECUTA piezas reales de `dist/`:
// `resolverInstanteDeCobro` (el que usa `POST /webhooks/psp` desde SCRUM-1735), `rangoTrimestre`,
// `leerLibroRegistro` con criterio de caja y `updateInvoiceStatusAdmin`, contra una base en memoria.
//
// No toca `src/`, ni el esquema, ni ninguna base (reglas 38 y 40). La R1 (camino de emisión) sólo se
// LEE: su `paidAt` se comprueba por el texto del fuente, sin ejecutarla ni mutarla.
//
// El cobro PARCIAL no está aquí a propósito: ya lo fija `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs`,
// hueco (c). Duplicarlo serían dos anclas para la misma comprobación.
//
// 🔴 (②) ES UN TRINQUETE DE UN DEFECTO CONOCIDO, no un verde que lo bendice: el borde del trimestre se
// calcula en la zona del PROCESO (`new Date(año, mes, …)` en `rangoTrimestre`), no en la del
// merchant. Con el proceso en UTC —lo que `fechaDeCobro.ts` dice de Railway; NO medido en producción—
// un cobro del 1-abr a las 00:30 de Madrid cae en el T1. Cómo trabaja, igual que `scrum1732`:
//   · DECLARADO + defecto presente → verde, y dice que es un defecto conocido, no conformidad.
//   · DECLARADO + el comportamiento cambió → ROJO: quien lo arregle retira la declaración en su PR.
//   · RETIRADO + defecto presente → ROJO: retirar la declaración no es arreglarlo.
//   · el control (proceso en Madrid → T2) no sale → CIEGO, que es ROJO.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// Por su efecto: pone `WHATSAPP_DRY_RUN=1` ANTES de cargar `dist/`.
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

/** 🔴 La declaración del defecto ②. Quien lo arregle la retira (`declarado: false`) en el mismo cambio. */
export const DEFECTO_CONOCIDO = {
  bordeEnZonaDelProceso: { declarado: true,
    tickets: ['SCRUM-1055'],
    que: 'el borde del trimestre sale de la zona del proceso: con TZ=UTC, un cobro del 1-abr 00:30 de Madrid cae en el T1' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Retirar la declaración sin arreglar el defecto.
    fichero: 'tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  bordeEnZonaDelProceso: { declarado: true,',
    a: 'DEFECTO_CONOCIDO = {\n  bordeEnZonaDelProceso: { declarado: false,',
    cae: 'SCRUM-1055b · ② el borde del trimestre sigue en la zona del proceso: defecto declarado',
  },
  {
    // La fecha declarada se ignora y el cobro se fecha con el reloj de la confirmación.
    fichero: 'src/modules/billing/domain/fechaDeCobro.ts',
    de: "  return { ok: true, fecha: d, origen: 'declarada' };",
    a: "  return { ok: true, fecha: ahora, origen: 'declarada' };",
    cae: 'SCRUM-1055b · ① un cobro declarado el 31-mar y confirmado el 2-abr devenga en el T1',
  },
  {
    // Una F1 cobrada se deja des-pagar a mano.
    fichero: 'src/modules/system/invoiceAdmin.ts',
    de: '    if (!isReceipt) {',
    a: '    if (false) {',
    cae: 'SCRUM-1055b · ③ una F1 cobrada no se des-paga: la devolución pasa por una R1',
  },
];

const { leerLibroRegistro } = requiere(rutaDe('dist/modules/invoicing/domain/libroRegistro.repo.js'));
const { rangoTrimestre } = requiere(rutaDe('dist/modules/fiscal/modelo303/modelo303.js'));
const { resolverInstanteDeCobro } = requiere(rutaDe('dist/modules/billing/domain/instanteDeCobro.js'));

const M = 1055;
const cumple = (v, f) => !f || ((!f.gte || (v && v >= f.gte)) && (!f.lte || (v && v <= f.lte)));
function baseDelLibro(facturas) {
  return {
    invoice: { async findMany(args) {
      const w = args.where || {};
      return facturas.filter((f) => f.merchantId === w.merchantId && cumple(f.createdAt, w.createdAt) && cumple(f.paidAt, w.paidAt));
    } },
    quote: { async findMany() { return []; } },
    albaran: { async findMany() { return []; } },
  };
}
function factura(numero, createdAt, paidAt, { type = 'F1', signo = 1 } = {}) {
  return {
    id: Number(numero.replace(/\D/g, '')) || 1, merchantId: M, number: numero, createdAt, paidAt, type,
    total: (121 * signo).toFixed(2), currency: 'EUR', status: 'paid', customerId: 1, quoteId: null, chargeId: null,
    albaranRefs: null, lines: [{ qty: 1, price: 100 * signo, tax: 0.21 }],
  };
}

/** Los asientos de cada trimestre de 2026, con o sin caja. */
async function porTrimestre(facturas, { caja = true } = {}) {
  const q = {};
  for (const t of [1, 2, 3, 4]) {
    const libro = await leerLibroRegistro(baseDelLibro(facturas), {
      merchantId: M, ...rangoTrimestre(2026, t), ...(caja ? { criterioCaja: true } : {}),
    });
    q[t] = libro.asientos.map((a) => ({ numero: a.numero, base: a.base, cuota: a.cuota, total: a.total }));
  }
  return q;
}
const trimestresDe = (q, numero) => [1, 2, 3, 4].filter((t) => q[t].some((a) => a.numero === numero));

/** Corre `fn` con el proceso en la zona `tz` y la deja como estaba. */
async function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return await fn(); } finally {
    if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
  }
}

// ── ① EL 31-MAR CONFIRMADO EN ABRIL ───────────────────────────────────────────────────────

test('SCRUM-1055b · ① un cobro declarado el 31-mar y confirmado el 2-abr devenga en el T1', async () => {
  // La misma llamada que hace `psp.routes` (SCRUM-1735) con el `ts` de `confirm-bizum`.
  const r = resolverInstanteDeCobro('2026-03-31', new Date('2026-04-02T09:00:00Z'), 'Europe/Madrid');
  assert.equal(r.ok, true, JSON.stringify(r));
  // Emitida en diciembre de 2025: por emisión NO está en 2026, así que «sale en el T1» sólo puede
  // venir del cobro. Sin esto, una caja desconectada saldría igual (lo midió jv-j1eo en 1732).
  const f = factura('F-10551', new Date('2025-12-10T11:00:00Z'), r.fecha);
  for (const tz of ['UTC', 'Europe/Madrid', 'Atlantic/Canary']) {
    await enZona(tz, async () => {
      const conCaja = await porTrimestre([f]);
      assert.deepEqual(trimestresDe(conCaja, 'F-10551'), [1],
        `🔴 [proceso ${tz}] el cobro del ${r.fecha.toISOString()} tenía que devengar en el T1 y sólo en el T1: ${JSON.stringify(conCaja)}`);
      assert.deepEqual(trimestresDe(await porTrimestre([f], { caja: false }), 'F-10551'), [],
        `CIEGO [proceso ${tz}]: sin caja la factura de dic-2025 no puede salir en 2026`);
    });
  }
});

test('SCRUM-1055b · ① control: el último minuto del 31-mar de Madrid es T1 en cualquier zona del proceso', async () => {
  const f = factura('F-10552', new Date('2025-12-10T11:00:00Z'), new Date('2026-03-31T21:59:00Z'));
  for (const tz of ['UTC', 'Europe/Madrid', 'Atlantic/Canary']) {
    await enZona(tz, async () => {
      assert.deepEqual(trimestresDe(await porTrimestre([f]), 'F-10552'), [1], `[proceso ${tz}]`);
    });
  }
});

// ── ② EL BORDE DEL TRIMESTRE Y LA ZONA DEL PROCESO (DEFECTO DECLARADO) ─────────────────────

export async function medirBorde() {
  // 1-abr-2026 00:30 en Madrid (CEST, UTC+2) = 31-mar 22:30Z. Para un merchant de Madrid es del T2.
  const f = factura('F-10553', new Date('2025-12-10T11:00:00Z'), new Date('2026-03-31T22:30:00Z'));
  const enUtc = await enZona('UTC', async () => trimestresDe(await porTrimestre([f]), 'F-10553'));
  const enMadrid = await enZona('Europe/Madrid', async () => trimestresDe(await porTrimestre([f]), 'F-10553'));
  const poblacion = `1 factura cobrada el 1-abr 00:30 de Madrid (2026-03-31T22:30Z) · proceso UTC → T[${enUtc}] · proceso Europe/Madrid → T[${enMadrid}]`;
  if (enMadrid.join() !== '2') return { estado: 'CIEGO', poblacion };
  if (enUtc.join() === '1') return { estado: 'DEFECTO', poblacion };
  return { estado: 'CAMBIADO', poblacion };
}

export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  switch (medida.estado) {
    case 'CIEGO':
      return { ok: false, motivo: `CIEGO: el control (proceso en Madrid → T2) no sale (${medida.poblacion}). Eso no es un verde.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado (SCRUM-1055 c.21863): ${medida.poblacion}. No es conformidad.` }
        : { ok: false, motivo: `Se retiró la declaración y el defecto sigue: ${medida.poblacion}. Retirarla es parte del arreglo, no lo sustituye.` };
    default:
      return declarado
        ? { ok: false, motivo: `El borde del trimestre ha CAMBIADO con el defecto todavía declarado: ${medida.poblacion}. `
          + 'Si es el arreglo (bordes en la zona del merchant), retira `bordeEnZonaDelProceso` de DEFECTO_CONOCIDO en este mismo cambio.' }
        : { ok: true, motivo: `Declaración retirada y arreglado: ${medida.poblacion}.` };
  }
}

test('SCRUM-1055b · ② el borde del trimestre sigue en la zona del proceso: defecto declarado', async (t) => {
  const medida = await medirBorde();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO.bordeEnZonaDelProceso);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1055b · ② control: las casillas del juicio', () => {
  const d = { declarado: true };
  assert.equal(juicio({ estado: 'DEFECTO', poblacion: '' }, d).ok, true);
  assert.equal(juicio({ estado: 'DEFECTO', poblacion: '' }, { declarado: false }).ok, false);
  assert.equal(juicio({ estado: 'CAMBIADO', poblacion: '' }, d).ok, false);
  assert.equal(juicio({ estado: 'CAMBIADO', poblacion: '' }, { declarado: false }).ok, true);
  assert.equal(juicio({ estado: 'CIEGO', poblacion: '' }, d).ok, false);
  assert.equal(juicio({ estado: 'CIEGO', poblacion: '' }, { declarado: false }).ok, false);
});

// ── ③ LA DEVOLUCIÓN: LO QUE HACE HOY EL PRODUCTO ──────────────────────────────────────────

const estadoFactura = { fila: null };
const doble = dobleDeLaBase({
  'invoice.findFirst': () => (estadoFactura.fila ? { ...estadoFactura.fila } : null),
  'invoice.update': (a) => { Object.assign(estadoFactura.fila, a.data); return { ...estadoFactura.fila }; },
});
const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
const { updateInvoiceStatusAdmin, UnpayNotAllowedError } = requiere(rutaDe('dist/modules/system/invoiceAdmin.js'));

function cobrada(numero, type) {
  estadoFactura.fila = { id: 9055, merchantId: M, number: numero, type, status: 'paid', paidAt: new Date('2026-03-20T11:00:00Z'), paidVia: null };
}

test('SCRUM-1055b · ③ una F1 cobrada no se des-paga: la devolución pasa por una R1', async () => {
  cobrada('F-2026-0001', 'F1');
  await assert.rejects(() => updateInvoiceStatusAdmin(9055, 'pending', M),
    (e) => e instanceof UnpayNotAllowedError && /rectificativa \(R1\)/.test(e.message));
  assert.equal(estadoFactura.fila.status, 'paid', 'la F1 sigue cobrada');
  assert.equal(estadoFactura.fila.paidAt.toISOString(), '2026-03-20T11:00:00.000Z', 'y con su fecha de cobro');
});

test('SCRUM-1055b · ③ control: un justificante J- sí se des-paga y pierde su fecha de cobro', async () => {
  cobrada('J-2026-0001', 'JUST');
  const r = await updateInvoiceStatusAdmin(9055, 'pending', M);
  assert.equal(r?.status, 'pending', `CIEGO: el doble no deja des-pagar ni lo que se puede (${JSON.stringify(r)})`);
  assert.equal(r.paidAt, null);
});

/** El `create` de la R1 en `/rectify`, sin comentarios: qué estado y qué fecha de cobro le pone. */
function creacionDeLaR1() {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/system/app/routes/invoicesAdmin.routes.ts'), 'utf8');
  const lineas = fuente.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '').trim());
  const tipos = lineas.map((l, i) => (l === "type: 'R1'," ? i : -1)).filter((i) => i >= 0);
  return { tipos, cercanas: tipos.map((i) => lineas.slice(i, i + 6)) };
}

test('SCRUM-1055b · ③ la R1 nace cobrada con el reloj de su emisión (leído, no ejecutado)', () => {
  const { tipos, cercanas } = creacionDeLaR1();
  assert.equal(tipos.length, 1, `CIEGO: esperaba UNA línea \`type: 'R1',\` en /rectify y hay ${tipos.length}`);
  assert.ok(cercanas[0].includes("status: 'paid',") && cercanas[0].includes('paidAt: new Date(),'),
    `🔴 La R1 ya no nace \`paid\` con \`paidAt: new Date()\`: ${JSON.stringify(cercanas[0])}. `
    + 'Si cambió a propósito, rehaz la medición de ③ (SCRUM-1055 c.21863) en este fichero.');
});

test('SCRUM-1055b · ③ en el libro de caja, la R1 resta en el trimestre de su emisión y la F1 no se mueve', async () => {
  // F1 emitida el 15-feb y cobrada el 20-mar; R1 emitida (y por tanto «cobrada») el 10-may.
  const f1 = factura('F-10554', new Date('2026-02-15T11:00:00Z'), new Date('2026-03-20T11:00:00Z'));
  const r1 = factura('R-10555', new Date('2026-05-10T10:00:00Z'), new Date('2026-05-10T10:00:00Z'), { type: 'R1', signo: -1 });
  const q = await enZona('UTC', () => porTrimestre([f1, r1]));
  assert.deepEqual(trimestresDe(q, 'F-10554'), [1], `la F1 devenga en el trimestre de su cobro: ${JSON.stringify(q)}`);
  assert.deepEqual(trimestresDe(q, 'R-10555'), [2], `la R1 devenga en el de su emisión: ${JSON.stringify(q)}`);
  const asientoR1 = q[2].find((a) => a.numero === 'R-10555');
  assert.ok(asientoR1.base < 0 && asientoR1.cuota < 0, `y resta: ${JSON.stringify(asientoR1)}`);
});
