// tests/scrum1066h-ruta-borrador-retenciones.test.mjs — SCRUM-1066h
//
// La ruta del borrador del 111/115 (pieza ⑥ de SCRUM-1066 c.21634; decidida en c.21636), CORRIDA
// por HTTP: el router real de `dist/` montado en una app propia, con la base doblada en
// `require.cache` (el mismo mecanismo que `scrum1107b`). No se llama al handler suelto: la petición
// entra por la ruta. El montaje en `src/app.ts` es de S1 (pieza ⑦, SCRUM-1721) y NO se prueba aquí.
//
//   · positivo: un gasto al 15 % y un «alquiler» al 19 % caen en sus casillas del 111 y del 115;
//   · filtro ⑨: «hay alguna retención anotada en el año» — false sin retenciones, true con una en
//     OTRO trimestre del mismo año;
//   · regla 2: lo de otro merchant no se ve, y toda consulta va filtrada por `req.merchantId`;
//   · un periodo mal formado da 400 con código, no otro periodo en silencio;
//   · pieza ③: la lista de tipos válidos que exporta J1 para S1, atada a lo que el borrador coloca.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_ROUTES = require_.resolve('./dist/modules/fiscal/retenciones/retenciones.routes.js');
const R_REPO = require_.resolve('./dist/modules/fiscal/retenciones/retencionesPracticadas.repo.js');

const { construirBorradorRetenciones, TIPOS_RETENCION_PRACTICADA_VALIDOS, TIPOS_111_ACTIVIDADES, TIPO_ALQUILER, CATEGORIA_ALQUILER } =
  await import('../dist/modules/fiscal/retenciones/retencionesPracticadas.js');

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/fiscal/retenciones/retenciones.routes.ts',
    de: 'const merchantId = req.merchantId;', a: 'const merchantId = 99;',
    cae: 'SCRUM-1066h · regla 2' },
  { fichero: 'src/modules/fiscal/retenciones/retenciones.routes.ts',
    de: 'return res.json({ ...borrador, hayRetencionAnotadaEnElAño });', a: 'return res.json(borrador);',
    cae: 'SCRUM-1066h · filtro ⑨' },
  { fichero: 'src/modules/fiscal/retenciones/retenciones.routes.ts',
    de: "if (!periodo) return res.status(400).json({ error: 'periodo_invalido' });", a: 'if (!periodo) throw new Error();',
    cae: 'SCRUM-1066h · periodo mal formado' },
  { fichero: 'src/modules/fiscal/retenciones/retenciones.routes.ts',
    de: "!/^[1-4]$/.test(crudoTrim)", a: "!/^\\d$/.test(crudoTrim)",
    cae: 'SCRUM-1066h · periodo mal formado' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts',
    de: 'return b.miradas - b.sinRetencion - b.sinDatoDeRetencion > 0;', a: 'return b.miradas > 0;',
    cae: 'SCRUM-1066h · filtro ⑨' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.repo.ts',
    de: 'const hasta = rangoTrimestre(params.año, 4).hasta;', a: 'const hasta = rangoTrimestre(params.año, 1).hasta;',
    cae: 'SCRUM-1066h · filtro ⑨' },
  { fichero: 'src/modules/fiscal/retenciones/retencionesPracticadas.ts',
    de: 'Object.freeze([15, 7, TIPO_ALQUILER])', a: 'Object.freeze([15, 7])',
    cae: 'SCRUM-1066h · pieza ③' },
];

const YO = 42;
const AJENO = 99;

/** Gasto con lo que lee el borrador. Por defecto: sin dato de retención. */
function gasto(extra) {
  return {
    id: 1, merchantId: YO, date: new Date(2026, 4, 10), providerId: 501, currency: 'EUR', category: 'materiales',
    baseAmount: '100.00', retencionPracticadaTipo: null, retencionPracticadaCuota: null, retencionPracticadaDeclarada: null,
    ...extra,
  };
}

/** La base doblada: filtra por merchant y por fecha como lo haría Postgres, y anota cada `where`. */
function dobleDeLaBase(filas) {
  const consultas = [];
  const prisma = {
    merchant: { findUnique: async ({ where }) => ({ id: where.id, timezone: 'Europe/Madrid' }) },
    expense: {
      findMany: async (args) => {
        consultas.push(args.where);
        const { merchantId, date } = args.where;
        return filas
          .filter((f) => f.merchantId === merchantId && f.date >= date.gte && f.date <= date.lte)
          .map((f) => ({ ...f }));
      },
    },
  };
  return { prisma, consultas };
}

function peticion(puerto, url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: url, method: 'GET', agent: false }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { data += t; });
      res.on('end', () => {
        let cuerpo = null;
        try { cuerpo = data ? JSON.parse(data) : null; } catch { /* se deja null */ }
        resolve({ status: res.statusCode, cuerpo });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** Monta el router REAL en `/admin/retenciones` de una app propia y le hace un GET. */
async function pedir({ filas, url, merchantId = YO }) {
  const { prisma, consultas } = dobleDeLaBase(filas);
  delete require_.cache[R_ROUTES];
  delete require_.cache[R_REPO];
  require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };
  const express = require_('express');
  const app = express();
  app.use((req, _res, next) => { req.merchantId = merchantId; req.userRole = 'admin'; next(); });
  app.use('/admin/retenciones', require_(R_ROUTES).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const r = await peticion(server.address().port, url);
    return { ...r, consultas };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const Q2_2026 = `/admin/retenciones?${encodeURI('año')}=2026&trimestre=2`;

const casillas = (b) => ({
  '111': [b.modelo111.actividadesEconomicasDinerarias.perceptores.valor,
          b.modelo111.actividadesEconomicasDinerarias.importe.valor,
          b.modelo111.actividadesEconomicasDinerarias.retenciones.valor],
  '115': [b.modelo115.perceptores.valor, b.modelo115.base.valor, b.modelo115.retenciones.valor],
});

test('SCRUM-1066h · positivo: un gasto al 15 % y un alquiler al 19 % caen en sus casillas, por la ruta', async () => {
  const filas = [
    gasto({ id: 1, providerId: 501, baseAmount: '1000.00', retencionPracticadaTipo: 15, retencionPracticadaCuota: '150.00' }),
    gasto({ id: 2, providerId: 502, category: CATEGORIA_ALQUILER, baseAmount: '600.00', retencionPracticadaTipo: 19, retencionPracticadaCuota: '114.00' }),
    gasto({ id: 3, providerId: 503 }), // sin dato de retención: no suma nada
  ];
  const r = await pedir({ filas, url: Q2_2026 });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.año, 2026);
  assert.equal(r.cuerpo.trimestre, 2);
  // Cifras a mano: 111 → 1 perceptor / 1.000 / 150 · 115 → 1 / 600 / 114.
  assert.deepEqual(casillas(r.cuerpo), { '111': [1, 1000, 150], '115': [1, 600, 114] });
  // Y cada importe con su casilla citada (la de `casillas.ts`, no un número suelto).
  assert.equal(typeof r.cuerpo.modelo111.actividadesEconomicasDinerarias.retenciones.casilla, 'string');
  assert.equal(typeof r.cuerpo.modelo115.retenciones.casilla, 'string');
  assert.deepEqual(r.cuerpo.sinClasificar, []);
  assert.equal(r.cuerpo.hayRetencionAnotadaEnElAño, true);
});

test('SCRUM-1066h · filtro ⑨: sin ninguna retención anotada en el año, dice «no hay»', async () => {
  const filas = [
    gasto({ id: 1 }),                                                     // sin dato
    gasto({ id: 2, retencionPracticadaTipo: 0 }),                         // decidido: tipo 0
    gasto({ id: 3, retencionPracticadaDeclarada: false }),                // decidido: «No»
    gasto({ id: 4, date: new Date(2025, 11, 31, 12) , retencionPracticadaTipo: 15, retencionPracticadaCuota: '15.00' }), // otro AÑO
    gasto({ id: 5, date: new Date(2027, 0, 1, 12), retencionPracticadaTipo: 15, retencionPracticadaCuota: '15.00' }),   // otro AÑO
  ];
  const r = await pedir({ filas, url: Q2_2026 });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.hayRetencionAnotadaEnElAño, false);
  assert.deepEqual(casillas(r.cuerpo), { '111': [0, 0, 0], '115': [0, 0, 0] });
});

test('SCRUM-1066h · filtro ⑨: una retención en OTRO trimestre del mismo año enciende el filtro', async () => {
  const filas = [
    gasto({ id: 1, date: new Date(2026, 10, 20), baseAmount: '200.00', retencionPracticadaTipo: 7, retencionPracticadaCuota: '14.00' }), // 4T
    gasto({ id: 2 }), // 2T, sin dato
  ];
  const r = await pedir({ filas, url: Q2_2026 });
  assert.equal(r.status, 200);
  // El 2T no tiene nada que colocar…
  assert.deepEqual(casillas(r.cuerpo), { '111': [0, 0, 0], '115': [0, 0, 0] });
  // …pero el año sí tiene una retención anotada: la pantalla se enseña.
  assert.equal(r.cuerpo.hayRetencionAnotadaEnElAño, true);
});

test('SCRUM-1066h · filtro ⑨: una retención que va a «sin clasificar» también cuenta como anotada', async () => {
  const filas = [gasto({ id: 1, retencionPracticadaTipo: 21, retencionPracticadaCuota: '21.00' })];
  const r = await pedir({ filas, url: Q2_2026 });
  assert.equal(r.cuerpo.sinClasificar.length, 1);
  assert.equal(r.cuerpo.hayRetencionAnotadaEnElAño, true);
});

test('SCRUM-1066h · regla 2: lo de otro merchant no se ve, y cada consulta va por req.merchantId', async () => {
  const filas = [
    gasto({ id: 1, merchantId: AJENO, baseAmount: '1000.00', retencionPracticadaTipo: 15, retencionPracticadaCuota: '150.00' }),
    gasto({ id: 2, merchantId: AJENO, category: CATEGORIA_ALQUILER, baseAmount: '600.00', retencionPracticadaTipo: 19, retencionPracticadaCuota: '114.00' }),
  ];
  const r = await pedir({ filas, url: Q2_2026, merchantId: YO });
  assert.equal(r.status, 200);
  assert.deepEqual(casillas(r.cuerpo), { '111': [0, 0, 0], '115': [0, 0, 0] });
  assert.equal(r.cuerpo.hayRetencionAnotadaEnElAño, false);
  assert.equal(r.cuerpo.miradas, 0);
  // Población: las DOS consultas (borrador del trimestre y filtro del año), y las dos por YO.
  assert.equal(r.consultas.length, 2);
  for (const w of r.consultas) assert.equal(w.merchantId, YO);
  // Control positivo: el mismo juego, pedido por el AJENO, sí se ve. Si no, el doble no filtraría nada.
  const suyo = await pedir({ filas, url: Q2_2026, merchantId: AJENO });
  assert.deepEqual(casillas(suyo.cuerpo), { '111': [1, 1000, 150], '115': [1, 600, 114] });
  assert.equal(suyo.cuerpo.hayRetencionAnotadaEnElAño, true);
});

test('SCRUM-1066h · periodo mal formado: 400 con código, no otro periodo en silencio', async () => {
  for (const q of [`${encodeURI('año')}=2026&trimestre=5`, `${encodeURI('año')}=2026&trimestre=0`,
                   `${encodeURI('año')}=26&trimestre=1`, `${encodeURI('año')}=dosmil&trimestre=1`,
                   `${encodeURI('año')}=2026&trimestre=1&trimestre=2`]) {
    const r = await pedir({ filas: [], url: `/admin/retenciones?${q}` });
    assert.equal(r.status, 400, q);
    assert.deepEqual(r.cuerpo, { error: 'periodo_invalido' }, q);
    assert.equal(r.consultas.length, 0, `${q}: con el periodo mal no se consulta nada`);
  }
  // Control: sin parámetros contesta el periodo EN CURSO (200), no un 400.
  const enCurso = await pedir({ filas: [], url: '/admin/retenciones' });
  assert.equal(enCurso.status, 200);
  assert.ok(enCurso.cuerpo.trimestre >= 1 && enCurso.cuerpo.trimestre <= 4);
});

test('SCRUM-1066h · pieza ③: los tipos válidos son 15, 7 y 19, y el borrador sabe colocar cada uno', () => {
  assert.deepEqual([...TIPOS_RETENCION_PRACTICADA_VALIDOS], [15, 7, 19]);
  assert.ok(Object.isFrozen(TIPOS_RETENCION_PRACTICADA_VALIDOS));
  assert.equal(TIPO_ALQUILER, 19);
  // Atada al borrador: cada tipo de la lista, con su categoría, entra en una casilla y no en
  // «sin clasificar». Si alguien añade a la lista un tipo que el borrador no coloca, esto cae.
  for (const tipo of TIPOS_RETENCION_PRACTICADA_VALIDOS) {
    const category = TIPOS_111_ACTIVIDADES.has(tipo) ? 'materiales' : CATEGORIA_ALQUILER;
    const b = construirBorradorRetenciones({
      gastos: [gasto({ retencionPracticadaTipo: tipo, retencionPracticadaCuota: '1.00', category })],
      merchantId: YO, año: 2026, trimestre: 2,
    });
    assert.deepEqual(b.sinClasificar, [], `tipo ${tipo}`);
    assert.equal(b.modelo111.actividadesEconomicasDinerarias.retenciones.valor + b.modelo115.retenciones.valor, 1, `tipo ${tipo}`);
  }
});
