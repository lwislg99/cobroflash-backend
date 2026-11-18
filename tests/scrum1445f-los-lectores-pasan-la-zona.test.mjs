// SCRUM-1445f · FASE 2 de SCRUM-1445d: los LECTORES de J1 calculan el periodo en la zona del COMERCIO.
//
// Decisión del fundador (SCRUM-1445 c.21896): «arreglarlo en el código, sin tocar TZ». La fase 1
// (`scrum1445d-bordes-fiscales-en-la-zona`) hizo que las 4 funciones de borde ACEPTEN la zona. Ésta
// comprueba que los siete repos que las llaman la PASAN, leyéndola de `merchant.timezone` con
// `zonaDelMerchantParaElLibro` (`src/modules/invoicing/domain/zonaDelLibro.ts`).
//
// 🔴 El proceso se fija en UTC ANTES de importar nada (es lo que corre en Railway, c.21891). Así:
//   · un comercio PENINSULAR (casos A y D de c.21891) sólo acierta si el lector pasa su zona: con la
//     del proceso, la primera hora del trimestre cae en el anterior.
//   · un comercio de CANARIAS (casos E y F) acierta en UTC en invierno: es el caso que caza un lector
//     que pusiera `Europe/Madrid` a mano en vez de leer la zona del comercio.
//   · un comercio SIN zona sale en UTC (`ZONA_POR_DEFECTO`, decisión A del 2-sep).
// En Git Bash `TZ=X node` no llega al proceso (c.21891, error propio de jv-j3cf): por eso va aquí dentro,
// y el primer caso es un CONTROL que sale rojo si el proceso no ve UTC.
process.env.TZ = 'UTC';

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Cada lector que deja de pasar la zona (o un lector de zona que miente) tumba su caso. Literales:
// el meta-guard las lee por AST (`lecturaDeDeclaraciones`).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/fiscal/modelo303/modelo303.repo.ts',
    de: 'const { desde, hasta } = rangoTrimestre(params.año, params.trimestre, zona);',
    a: 'const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);',
    cae: 'SCRUM-1445f · leerModelo303 pide',
  },
  {
    fichero: 'src/modules/fiscal/modelo130/modelo130.repo.ts',
    de: 'const { desde, hasta } = rangoAcumulado(params.año, params.trimestre, zona);',
    a: 'const { desde, hasta } = rangoAcumulado(params.año, params.trimestre);',
    cae: 'SCRUM-1445f · leerBorrador130 pide',
  },
  {
    fichero: 'src/modules/fiscal/modelo347/modelo347.repo.ts',
    de: 'const { desde } = rangoTrimestre(params.año, 1, zona);',
    a: 'const { desde } = rangoTrimestre(params.año, 1);',
    cae: 'SCRUM-1445f · leerBorradorModelo347 pide',
  },
  {
    fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts',
    de: 'const { desde, hasta } = rangoTrimestre(params.año, params.trimestre, zona);',
    a: 'const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);',
    cae: 'SCRUM-1445f · leerBorradorRetenciones pide',
  },
  {
    fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts',
    de: 'const desde = rangoTrimestre(params.año, 1, zona).desde;',
    a: 'const desde = rangoTrimestre(params.año, 1).desde;',
    cae: 'SCRUM-1445f · leerHayRetencionAnotadaEnElAño pide',
  },
  {
    fichero: 'src/modules/fiscal/librosAeat/librosAeat.repo.ts',
    de: '// SCRUM-1445d (fase 2) · el trimestre, en la zona del comercio (c.21896).\n  const zona = await zonaDelMerchantParaElLibro(db, params.merchantId);',
    a: '// SCRUM-1445d (fase 2) · el trimestre, en la zona del comercio (c.21896).\n  const zona = (await zonaDelMerchantParaElLibro(db, params.merchantId)) && undefined;',
    cae: 'SCRUM-1445f · leerLibroExpedidasDelTrimestre pide',
  },
  {
    fichero: 'src/modules/fiscal/librosAeat/librosAeat.repo.ts',
    de: '// SCRUM-1445d fase 2\n  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre, zona);',
    a: '// SCRUM-1445d fase 2\n  const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);',
    cae: 'SCRUM-1445f · leerLibroRecibidasDelTrimestre pide',
  },
  {
    fichero: 'src/modules/fiscal/evidencias/paquete.repo.ts',
    de: 'const { desde, hasta } = rangoTrimestre(params.año, params.trimestre, zona);',
    a: 'const { desde, hasta } = rangoTrimestre(params.año, params.trimestre);',
    cae: 'SCRUM-1445f · leerPaqueteEvidencias pide',
  },
  {
    // El suelo se degrada a UTC en vez de parar.
    fichero: 'src/modules/invoicing/domain/zonaDelLibro.ts',
    de: 'if (fila === null || fila === undefined) {', a: 'if (false) {', cae: 'SCRUM-1445f · el suelo',
  },
  {
    // El lector pone la zona peninsular a mano en vez de leer la del comercio: Canarias lo caza.
    fichero: 'src/modules/invoicing/domain/zonaDelLibro.ts',
    de: 'return zonaDelMerchant(fila as { timezone?: string | null });',
    a: "return zonaDelMerchant(null) && 'Europe/Madrid';",
    cae: 'SCRUM-1445f · caso E',
  },
];

const M = 7;
const dist = (r) => import(new URL(`../dist/modules/${r}`, import.meta.url).href);
const { leerModelo303 } = await dist('fiscal/modelo303/modelo303.repo.js');
const { leerBorrador130 } = await dist('fiscal/modelo130/modelo130.repo.js');
const { leerBorradorModelo347 } = await dist('fiscal/modelo347/modelo347.repo.js');
const { leerBorradorRetenciones, leerHayRetencionAnotadaEnElAño } = await dist('fiscal/retenciones/retencionesPracticadas.repo.js');
const { leerLibroExpedidasDelTrimestre, leerLibroRecibidasDelTrimestre } = await dist('fiscal/librosAeat/librosAeat.repo.js');
const { leerPaqueteEvidencias } = await dist('fiscal/evidencias/paquete.repo.js');
const { zonaDelMerchantParaElLibro } = await dist('invoicing/domain/zonaDelLibro.js');

/**
 * Base falsa: el merchant `M` con la zona dada (y alta antigua, sin criterio de caja); todo `findMany`
 * devuelve vacío y se APUNTA cada rango de fechas que pide, con su tabla.
 */
function baseFalsa(timezone) {
  const rangos = [];
  const merchantsLeidos = [];
  const db = new Proxy({}, {
    get: (_, modelo) => new Proxy({}, {
      get: (_, op) => async (args) => {
        if (modelo === 'merchant') {
          merchantsLeidos.push(args?.where?.id);
          return args?.where?.id === M ? { id: M, timezone, createdAt: new Date(Date.UTC(2020, 0, 1)) } : null;
        }
        for (const [campo, v] of Object.entries(args?.where ?? {})) {
          if (v && typeof v === 'object' && v.gte instanceof Date && v.lte instanceof Date) {
            rangos.push({ tabla: `${String(modelo)}.${campo}`, gte: v.gte.toISOString(), lte: v.lte.toISOString() });
          }
        }
        return String(op) === 'findMany' ? [] : null;
      },
    }),
  });
  return { db, rangos, merchantsLeidos };
}

// Los bordes esperados, escritos A MANO en UTC (no derivados del código que se prueba).
const T2_2026 = {
  'Europe/Madrid': ['2026-03-31T22:00:00.000Z', '2026-06-30T21:59:59.999Z'],
  'Atlantic/Canary': ['2026-03-31T23:00:00.000Z', '2026-06-30T22:59:59.999Z'],
  null: ['2026-04-01T00:00:00.000Z', '2026-06-30T23:59:59.999Z'],
};
const AÑO_2026 = {
  'Europe/Madrid': ['2025-12-31T23:00:00.000Z', '2026-12-31T22:59:59.999Z'],
  'Atlantic/Canary': ['2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z'],
  null: ['2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z'],
};
const T1_A_T2_2026 = Object.fromEntries(Object.keys(T2_2026).map((z) => [z, [AÑO_2026[z][0], T2_2026[z][1]]]));

// Cada lector, con su llamada y el periodo que tiene que pedir.
const LECTORES = [
  { nombre: 'leerModelo303', llamar: (db) => leerModelo303(db, { merchantId: M, año: 2026, trimestre: 2 }), periodo: T2_2026 },
  { nombre: 'leerBorrador130', llamar: (db) => leerBorrador130(db, { merchantId: M, año: 2026, trimestre: 2 }), periodo: T1_A_T2_2026 },
  { nombre: 'leerBorradorModelo347', llamar: (db) => leerBorradorModelo347(db, { merchantId: M, año: 2026 }), periodo: AÑO_2026 },
  { nombre: 'leerBorradorRetenciones', llamar: (db) => leerBorradorRetenciones(db, { merchantId: M, año: 2026, trimestre: 2 }), periodo: T2_2026 },
  { nombre: 'leerHayRetencionAnotadaEnElAño', llamar: (db) => leerHayRetencionAnotadaEnElAño(db, { merchantId: M, año: 2026 }), periodo: AÑO_2026 },
  { nombre: 'leerLibroExpedidasDelTrimestre', llamar: (db) => leerLibroExpedidasDelTrimestre(db, { merchantId: M, año: 2026, trimestre: 2 }), periodo: T2_2026 },
  { nombre: 'leerLibroRecibidasDelTrimestre', llamar: (db) => leerLibroRecibidasDelTrimestre(db, { merchantId: M, año: 2026, trimestre: 2 }), periodo: T2_2026 },
  { nombre: 'leerPaqueteEvidencias', llamar: (db) => leerPaqueteEvidencias(db, { merchantId: M, año: 2026, trimestre: 2 }), periodo: T2_2026 },
];

const ZONAS = ['Europe/Madrid', 'Atlantic/Canary', null];

test('SCRUM-1445f · 🔵 CONTROL: el proceso corre en UTC (si no, el resto no mide lo que dice)', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC', 'CIEGO: el proceso no ve TZ=UTC');
  assert.equal(new Date(2026, 3, 1).toISOString(), '2026-04-01T00:00:00.000Z');
});

// Un test por lector, con su título LITERAL (scrum1415: los nombres de test no se construyen).
async function pideElPeriodoEnLaZona(nombre) {
  const l = LECTORES.find((x) => x.nombre === nombre);
  for (const zona of ZONAS) {
    const { db, rangos, merchantsLeidos } = baseFalsa(zona);
    await l.llamar(db);
    assert.ok(rangos.length > 0, `CIEGO: ${l.nombre} no ha pedido ningún rango de fechas`);
    assert.ok(merchantsLeidos.includes(M), `🔴 ${l.nombre} no lee la fila del merchant`);
    const [desde, hasta] = l.periodo[zona];
    const malos = rangos.filter((r) => r.gte !== desde || r.lte !== hasta);
    assert.deepEqual(malos, [], `🔴 ${l.nombre}, comercio ${zona ?? 'sin zona'}: esperaba [${desde} .. ${hasta}]`);
  }
}
test('SCRUM-1445f · leerModelo303 pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerModelo303'));
test('SCRUM-1445f · leerBorrador130 pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerBorrador130'));
test('SCRUM-1445f · leerBorradorModelo347 pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerBorradorModelo347'));
test('SCRUM-1445f · leerBorradorRetenciones pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerBorradorRetenciones'));
test('SCRUM-1445f · leerHayRetencionAnotadaEnElAño pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerHayRetencionAnotadaEnElAño'));
test('SCRUM-1445f · leerLibroExpedidasDelTrimestre pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerLibroExpedidasDelTrimestre'));
test('SCRUM-1445f · leerLibroRecibidasDelTrimestre pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerLibroRecibidasDelTrimestre'));
test('SCRUM-1445f · leerPaqueteEvidencias pide el periodo en la zona del comercio (península, Canarias y sin zona)', () => pideElPeriodoEnLaZona('leerPaqueteEvidencias'));

// Los casos de c.21891, como instantes concretos contra el rango que pide el 303 (el que heredan el
// 390 y el paquete). `dentro` es el mismo filtro que aplica la base.
const dentro = (iso, [desde, hasta]) => iso >= desde && iso <= hasta;
async function trimestreQuePide303(zona, trimestre, año = 2026) {
  const { db, rangos } = baseFalsa(zona);
  await leerModelo303(db, { merchantId: M, año, trimestre });
  const r = rangos.find((x) => x.tabla === 'invoice.createdAt') ?? rangos[0];
  return [r.gte, r.lte];
}

test('SCRUM-1445f · caso A: cobro del 1-abr a las 00:30 de Madrid es del T2, no del T1', async () => {
  const instante = '2026-03-31T22:30:00.000Z';
  assert.ok(dentro(instante, await trimestreQuePide303('Europe/Madrid', 2)), '🔴 no entra en el T2');
  assert.ok(!dentro(instante, await trimestreQuePide303('Europe/Madrid', 1)), '🔴 entra en el T1');
});

test('SCRUM-1445f · caso D: el 1-ene a las 00:30 de Madrid es del T1 del año nuevo', async () => {
  const instante = '2025-12-31T23:30:00.000Z';
  assert.ok(dentro(instante, await trimestreQuePide303('Europe/Madrid', 1, 2026)), '🔴 no entra en 2026T1');
  assert.ok(!dentro(instante, await trimestreQuePide303('Europe/Madrid', 4, 2025)), '🔴 entra en 2025T4');
});

test('SCRUM-1445f · caso E: Canarias, 31-dic a las 23:30, es del T4 de ese año', async () => {
  const instante = '2025-12-31T23:30:00.000Z';
  assert.ok(dentro(instante, await trimestreQuePide303('Atlantic/Canary', 4, 2025)), '🔴 no entra en 2025T4');
  assert.ok(!dentro(instante, await trimestreQuePide303('Atlantic/Canary', 1, 2026)), '🔴 entra en 2026T1');
});

test('SCRUM-1445f · caso F: Canarias, 30-jun a las 23:30 (verano), es del T2, no del T3', async () => {
  const instante = '2026-06-30T22:30:00.000Z';
  assert.ok(dentro(instante, await trimestreQuePide303('Atlantic/Canary', 2)), '🔴 no entra en el T2');
  assert.ok(!dentro(instante, await trimestreQuePide303('Atlantic/Canary', 3)), '🔴 entra en el T3');
});

test('SCRUM-1445f · el suelo: si el merchant no existe, el lector PARA (no sigue en UTC)', async () => {
  const { db } = baseFalsa('Europe/Madrid');
  await assert.rejects(() => zonaDelMerchantParaElLibro(db, M + 1), /no se ha podido leer el merchant/);
  await assert.rejects(() => leerModelo303(db, { merchantId: M + 1, año: 2026, trimestre: 2 }));
  // CONTROL POSITIVO del mismo lector: con el merchant que existe, da su zona.
  assert.equal(await zonaDelMerchantParaElLibro(db, M), 'Europe/Madrid');
  assert.equal(await zonaDelMerchantParaElLibro(baseFalsa(null).db, M), 'UTC');
});
