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
// (②) Fue un TRINQUETE de un defecto conocido (el borde del trimestre en la zona del PROCESO). Lo
// arregló SCRUM-1445 (d: `rangoTrimestre` acepta `zona`; f: los lectores de J1 se la pasan), y
// SCRUM-1872 retira la declaración: desde entonces ② mide por los LECTORES REALES del libro de caja
// (`leerLibroExpedidasDelTrimestre` y `leerModelo303`), que leen la zona y el criterio de caja de la
// fila del merchant, con el proceso en UTC (Railway, c.21873), Madrid y Canarias. Cómo juzga:
//   · RETIRADO + borde en la zona del merchant → verde.
//   · RETIRADO + el borde vuelve a la zona del proceso → ROJO.
//   · DECLARADO otra vez con el borde arreglado → ROJO: una declaración que ya no describe nada.
//   · la caja no lleva la factura a 2026, o el proceso no ve su zona → CIEGO, que es ROJO.
// El respaldo «sin zona» de `rangoTrimestre` sigue vivo (lo usa `reports.routes.ts`, carril S1) y lo
// fija `scrum1445d`; aquí sólo sirve de DEFECTO SEMBRADO para el control del instrumento.
//
// 🔴 La zona del PROCESO se fija ANTES de cargar `dist/` (el patrón de `scrum1445d`), y cada cambio
// de zona comprueba que el proceso la VE antes de fiarse de lo que mide.
process.env.TZ = 'UTC';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// Por su efecto: pone `WHATSAPP_DRY_RUN=1` ANTES de cargar `dist/`.
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

/**
 * 🔴 La declaración del defecto ②, RETIRADA en SCRUM-1872 (el arreglo es de SCRUM-1445f). Volver a
 * `true` con el borde arreglado tumba ②: una declaración que no describe nada esconde el siguiente.
 */
export const DEFECTO_CONOCIDO = {
  bordeEnZonaDelProceso: { declarado: false,
    tickets: ['SCRUM-1055', 'SCRUM-1445', 'SCRUM-1872'],
    que: 'el borde del trimestre salía de la zona del proceso: con TZ=UTC, un cobro del 1-abr 00:30 de Madrid caía en el T1' },
};

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Volver a declarar el defecto con el borde ya arreglado.
    fichero: 'tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs',
    de: 'DEFECTO_CONOCIDO = {\n  bordeEnZonaDelProceso: { declarado: false,',
    a: 'DEFECTO_CONOCIDO = {\n  bordeEnZonaDelProceso: { declarado: true,',
    cae: 'SCRUM-1055b · ② el 1-abr 00:30 de Madrid es T2 por el libro de caja real',
  },
  {
    // El libro de expedidas deja de pasar la zona del merchant al trimestre.
    fichero: 'src/modules/fiscal/librosAeat/librosAeat.repo.ts',
    de: 'rangoTrimestre(params.año, params.trimestre, zona);\n  const { merchantId } = params;\n\n  // SCRUM-294',
    a: 'rangoTrimestre(params.año, params.trimestre);\n  const { merchantId } = params;\n\n  // SCRUM-294',
    cae: 'SCRUM-1055b · ② el 1-abr 00:30 de Madrid es T2 por el libro de caja real',
  },
  {
    // El 303 deja de pasar la zona del merchant al trimestre.
    fichero: 'src/modules/fiscal/modelo303/modelo303.repo.ts',
    de: '  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre, zona);\n',
    a: '  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);\n',
    cae: 'SCRUM-1055b · ② el 1-abr 00:30 de Madrid es T2 por el libro de caja real',
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
// SCRUM-1872 · los lectores REALES del trimestre (los que usan las rutas de libros y del 303).
const { leerLibroExpedidasDelTrimestre } = requiere(rutaDe('dist/modules/fiscal/librosAeat/librosAeat.repo.js'));
const { leerModelo303 } = requiere(rutaDe('dist/modules/fiscal/modelo303/modelo303.repo.js'));

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
    // SCRUM-1732d · invoice_payments: sin filas, cada factura se lee como hoy (100 % en paidAt, c.21926 §①).
    invoicePayment: { async findMany() { return []; } },
  };
}
function factura(numero, createdAt, paidAt, { type = 'F1', signo = 1 } = {}) {
  return {
    id: Number(numero.replace(/\D/g, '')) || 1, merchantId: M, number: numero, createdAt, paidAt, type,
    total: (121 * signo).toFixed(2), currency: 'EUR', status: 'paid', customerId: 1, quoteId: null, chargeId: null,
    albaranRefs: null, lines: [{ qty: 1, price: 100 * signo, tax: 0.21 }],
  };
}

/**
 * Los asientos de cada trimestre de 2026, con o sin caja, con el rango SIN zona: el respaldo de la
 * zona del proceso (1445d). ① y ③ no tocan ningún borde; ② lo usa sólo como defecto SEMBRADO.
 */
async function porTrimestre(facturas, { caja = true } = {}) {
  const q = {};
  for (const t of [1, 2, 3, 4]) {
    const libro = await leerLibroRegistro(baseDelLibro(facturas), {
      merchantId: M, ...rangoTrimestre(2026, t), ...(caja ? { criterioCaja: true, devengo: true } : {}),
    });
    q[t] = libro.asientos.map((a) => ({ numero: a.numero, base: a.base, cuota: a.cuota, total: a.total }));
  }
  return q;
}
const trimestresDe = (q, numero) => [1, 2, 3, 4].filter((t) => q[t].some((a) => a.numero === numero));

/** La hora de `instante` en `tz` según Intl, que no depende de la zona del proceso. */
const horaEn = (instante, tz) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(instante));
// Un instante de verano: UTC 12, Canarias 13, Madrid 14. En invierno, UTC y Canarias no se distinguen.
const SONDA_DE_ZONA = new Date('2026-07-01T12:00:00Z');

/** Corre `fn` con el proceso en la zona `tz`, comprueba que el proceso la VE, y la deja como estaba. */
async function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try {
    const visto = SONDA_DE_ZONA.getHours();
    assert.equal(visto, horaEn(SONDA_DE_ZONA, tz), `CIEGO: el proceso no está en ${tz} (getHours=${visto})`);
    return await fn();
  } finally {
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
  // SCRUM-1730e: el congelado de la factura (c.21789 ③); hoy el libro lo ignora. La copia va a la
  // lectura por caja; `f` se queda sin marca (NULL = por emisión) para el control por emisión.
  const fCaja = { ...f, merchantCriterioCaja: true };
  for (const tz of ['UTC', 'Europe/Madrid', 'Atlantic/Canary']) {
    await enZona(tz, async () => {
      const conCaja = await porTrimestre([fCaja]);
      assert.deepEqual(trimestresDe(conCaja, 'F-10551'), [1],
        `🔴 [proceso ${tz}] el cobro del ${r.fecha.toISOString()} tenía que devengar en el T1 y sólo en el T1: ${JSON.stringify(conCaja)}`);
      assert.deepEqual(trimestresDe(await porTrimestre([f], { caja: false }), 'F-10551'), [],
        `CIEGO [proceso ${tz}]: sin caja la factura de dic-2025 no puede salir en 2026`);
    });
  }
});

test('SCRUM-1055b · ① control: el último minuto del 31-mar de Madrid es T1 en cualquier zona del proceso', async () => {
  // SCRUM-1730e: el congelado de la factura (c.21789 ③); hoy el libro lo ignora
  const f = { ...factura('F-10552', new Date('2025-12-10T11:00:00Z'), new Date('2026-03-31T21:59:00Z')), merchantCriterioCaja: true };
  for (const tz of ['UTC', 'Europe/Madrid', 'Atlantic/Canary']) {
    await enZona(tz, async () => {
      assert.deepEqual(trimestresDe(await porTrimestre([f]), 'F-10552'), [1], `[proceso ${tz}]`);
    });
  }
});

// ── ② EL BORDE DEL TRIMESTRE, EN LA ZONA DEL MERCHANT (SCRUM-1872) ─────────────────────────

// 1-abr-2026 00:30 en Madrid (CEST, UTC+2) = 31-mar 22:30Z. Para un merchant de Madrid es del T2.
const BORDE = new Date('2026-03-31T22:30:00Z');
// 31-mar-2026 23:30 en Madrid = 21:30Z: el control, del T1.
const VISPERA = new Date('2026-03-31T21:30:00Z');
const PROCESOS = ['UTC', 'Europe/Madrid', 'Atlantic/Canary'];
const NUMERO_BORDE = 'F-10553';

/** La base del libro más la fila del merchant: los lectores reales sacan de ella la zona y el criterio. */
function baseDelMerchant(facturas, zonaMerchant) {
  return {
    ...baseDelLibro(facturas),
    // `zonaDelMerchantParaElLibro` lee `timezone`; `criterioDelMerchantParaElLibro`, la fila entera.
    merchant: { async findUnique(args) { return args?.where?.id === M ? { id: M, timezone: zonaMerchant, criterioCaja: true } : null; } },
    customer: { async findMany() { return []; } },
    expense: { async findMany() { return []; } },
  };
}

/**
 * Emitida en dic-2025 y cobrada en `instante`: por emisión NO es de 2026, así que si sale en un
 * trimestre de 2026 sólo puede ser por el COBRO (el criterio de caja). Lo midió jv-j1eo en 1732.
 */
// SCRUM-1730e: el congelado de la factura (c.21789 ③); hoy el libro lo ignora
const cobradaEn = (instante) => ({ ...factura(NUMERO_BORDE, new Date('2025-12-10T11:00:00Z'), instante), merchantCriterioCaja: true });

/** Los lectores reales: en qué trimestres de 2026 cae `instante`. */
const LECTORES_REALES = {
  // EL LIBRO DE CAJA: el 303 lee el libro con `criterioCaja` (de la fila del merchant) y `devengo`.
  // Con UNA factura en la base, «base del 303 distinta de cero» es «el cobro cae en ese trimestre».
  async '303 por caja (cobro)'(instante, zonaMerchant) {
    const t = [];
    for (const q of [1, 2, 3, 4]) {
      const m = await leerModelo303(baseDelMerchant([cobradaEn(instante)], zonaMerchant), { merchantId: M, año: 2026, trimestre: q });
      if (m.totalBase !== 0) t.push(q);
    }
    return t;
  },
  // El libro de expedidas corta por la fecha de EXPEDICIÓN (RIVA 63; sin `devengo`): el mismo borde,
  // con la factura EMITIDA en `instante`. Una emitida en dic-2025 no sale nunca en él.
  async 'libro de expedidas (emisión)'(instante, zonaMerchant) {
    const t = [];
    for (const q of [1, 2, 3, 4]) {
      const base = baseDelMerchant([factura(NUMERO_BORDE, instante, null)], zonaMerchant);
      const { filas } = await leerLibroExpedidasDelTrimestre(base, { merchantId: M, año: 2026, trimestre: q });
      if (filas.some((f) => f.serieNumero === NUMERO_BORDE)) t.push(q);
    }
    return t;
  },
};
/** DEFECTO SEMBRADO: el rango SIN zona (el respaldo de 1445d), que es lo que este test medía antes de SCRUM-1872. */
const LECTOR_SIN_ZONA = {
  async 'caja por el respaldo sin zona'(instante) { return trimestresDe(await porTrimestre([cobradaEn(instante)]), NUMERO_BORDE); },
};

export async function medirBorde({ instante = BORDE, zonaMerchant = 'Europe/Madrid', esperado = 2, lectores = LECTORES_REALES } = {}) {
  const vistos = [];
  for (const [lector, leer] of Object.entries(lectores)) {
    for (const tz of PROCESOS) vistos.push({ lector, tz, t: await enZona(tz, () => leer(instante, zonaMerchant)) });
  }
  const poblacion = `instante ${instante.toISOString()}, merchant en ${zonaMerchant}, esperado T${esperado} · `
    + `${vistos.length} lecturas: ` + vistos.map((v) => `${v.lector} [proceso ${v.tz}] → T[${v.t}]`).join(' · ');
  if (vistos.length === 0 || vistos.some((v) => v.t.length === 0)) return { estado: 'CIEGO', poblacion };
  const cambiaConElProceso = Object.keys(lectores)
    .some((l) => new Set(vistos.filter((v) => v.lector === l).map((v) => v.t.join())).size > 1);
  if (cambiaConElProceso) return { estado: 'DEFECTO', poblacion };
  if (vistos.every((v) => v.t.join() === String(esperado))) return { estado: 'EN_ZONA_DEL_MERCHANT', poblacion };
  return { estado: 'OTRO', poblacion };
}

export function juicio(medida, declaracion) {
  const declarado = declaracion?.declarado === true;
  switch (medida.estado) {
    case 'EN_ZONA_DEL_MERCHANT':
      return declarado
        ? { ok: false, motivo: `El borde ya se corta en la zona del merchant y el defecto sigue DECLARADO: ${medida.poblacion}. `
          + 'Una declaración que ya no describe nada esconde el siguiente defecto: retírala.' }
        : { ok: true, motivo: `En la zona del merchant (arreglo de SCRUM-1445f, declaración retirada en SCRUM-1872): ${medida.poblacion}.` };
    case 'DEFECTO':
      return declarado
        ? { ok: true, motivo: `DEFECTO CONOCIDO, declarado: ${medida.poblacion}. No es conformidad.` }
        : { ok: false, motivo: `El borde del trimestre ha vuelto a la zona del PROCESO: ${medida.poblacion}. `
          + 'Un lector de caja ha dejado de pasar la zona del merchant a `rangoTrimestre` (SCRUM-1445f).' };
    case 'OTRO':
      return { ok: false, motivo: `Ni la zona del merchant ni la del proceso: ${medida.poblacion}.` };
    default:
      return { ok: false, motivo: `CIEGO: algún lector, en alguna zona, no llevó la factura a 2026 (${medida.poblacion}). Eso no es un verde.` };
  }
}

test('SCRUM-1055b · ② el 1-abr 00:30 de Madrid es T2 por el libro de caja real, en las tres zonas del proceso', async (t) => {
  const medida = await medirBorde();
  t.diagnostic(`estado ${medida.estado} · ${medida.poblacion}`);
  const v = juicio(medida, DEFECTO_CONOCIDO.bordeEnZonaDelProceso);
  t.diagnostic(v.motivo);
  assert.equal(v.ok, true, `🔴 ${v.motivo}`);
});

test('SCRUM-1055b · ② control: el 31-mar 23:30 de Madrid sigue en el T1 por los mismos lectores, en las tres zonas', async () => {
  const medida = await medirBorde({ instante: VISPERA, esperado: 1 });
  assert.equal(medida.estado, 'EN_ZONA_DEL_MERCHANT', medida.poblacion);
});

test('SCRUM-1055b · ② control: manda la zona del MERCHANT, no una fija: el mismo instante, con el merchant en Canarias, es T1', async () => {
  // 31-mar 22:30Z son las 23:30 del 31-mar en Canarias (WEST, UTC+1 desde el 29-mar-2026).
  const medida = await medirBorde({ zonaMerchant: 'Atlantic/Canary', esperado: 1 });
  assert.equal(medida.estado, 'EN_ZONA_DEL_MERCHANT', medida.poblacion);
});

test('SCRUM-1055b · ② control: el instrumento con entradas fabricadas, en los tres sentidos', async () => {
  // DEFECTO sembrado: el rango SIN zona cambia con el proceso (UTC → T1, Madrid → T2).
  assert.equal((await medirBorde({ lectores: LECTOR_SIN_ZONA })).estado, 'DEFECTO');
  // CIEGO: un instante de dic-2025 no cae en ningún trimestre de 2026, ni por cobro ni por emisión.
  assert.equal((await medirBorde({ instante: new Date('2025-12-20T10:00:00Z') })).estado, 'CIEGO');
  // CIEGO: sin lectores no hay medición, y eso no puede salir verde.
  assert.equal((await medirBorde({ lectores: {} })).estado, 'CIEGO');
  // OTRO: lo esperado no sale en ninguna zona.
  assert.equal((await medirBorde({ esperado: 3 })).estado, 'OTRO');
});

test('SCRUM-1055b · ② control: las casillas del juicio', () => {
  const j = (estado, declarado) => juicio({ estado, poblacion: '' }, { declarado }).ok;
  assert.equal(j('EN_ZONA_DEL_MERCHANT', false), true);
  assert.equal(j('EN_ZONA_DEL_MERCHANT', true), false);
  assert.equal(j('DEFECTO', false), false);
  assert.equal(j('DEFECTO', true), true);
  for (const d of [true, false]) {
    assert.equal(j('OTRO', d), false);
    assert.equal(j('CIEGO', d), false);
  }
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
  // Sin comentarios con el filtro de la casa (SCRUM-694): el comentario que explica la R1 podría
  // contener la misma línea que se busca.
  const lineas = soloCodigo(fuente, 'invoicesAdmin.routes.ts').split(/\r?\n/).map((l) => l.trim());
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
  // SCRUM-1730e: el congelado de la factura (c.21789 ③); hoy el libro lo ignora
  const f1 = { ...factura('F-10554', new Date('2026-02-15T11:00:00Z'), new Date('2026-03-20T11:00:00Z')), merchantCriterioCaja: true };
  // SCRUM-1730e: la R1 hereda el congelado de la F1 que rectifica, por `rectifiesId` (c.22620); hoy el libro lo ignora
  const r1 = { ...factura('R-10555', new Date('2026-05-10T10:00:00Z'), new Date('2026-05-10T10:00:00Z'), { type: 'R1', signo: -1 }), rectifiesId: f1.id };
  const q = await enZona('UTC', () => porTrimestre([f1, r1]));
  assert.deepEqual(trimestresDe(q, 'F-10554'), [1], `la F1 devenga en el trimestre de su cobro: ${JSON.stringify(q)}`);
  assert.deepEqual(trimestresDe(q, 'R-10555'), [2], `la R1 devenga en el de su emisión: ${JSON.stringify(q)}`);
  const asientoR1 = q[2].find((a) => a.numero === 'R-10555');
  assert.ok(asientoR1.base < 0 && asientoR1.cuota < 0, `y resta: ${JSON.stringify(asientoR1)}`);
});
