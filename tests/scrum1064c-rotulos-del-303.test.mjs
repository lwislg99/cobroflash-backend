// tests/scrum1064c-rotulos-del-303.test.mjs — SCRUM-1064c · los rótulos del impreso en la ruta del 303.
//
// La pantalla del 303 (la construye S2) pinta cada casilla con el rótulo del impreso, y el fundador
// decidió que ese rótulo es la transcripción LITERAL del Anexo III de la Orden HAC/27/2026, sin la
// fórmula entre paréntesis (SCRUM-1064 c.20780). Este fichero fija cada rótulo con su cita, y que
// `GET /admin/modelo-303` los sirve — el handler REAL, no una copia.
//
// Los literales de abajo están copiados del impreso, NO de `casillas.ts`: si el código y el test
// salieran del mismo sitio, se equivocarían juntos.
//   página 1: https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png
//   página 3: https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_9.png
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { reqDeSesion } from './_arnes-de-router.mjs';

const require = createRequire(import.meta.url);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Un rótulo deja de ser el literal del impreso.
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: "rotulo: 'Total a deducir'",
    a: "rotulo: 'Total deducible'",
    cae: 'cada rótulo es el del impreso, con su columna y su página',
  },
  {
    // Vuelve la fórmula entre paréntesis (contra c.20780).
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: "{ casilla: 71, rotulo: 'Resultado', pagina",
    a: "{ casilla: 71, rotulo: 'Resultado (69 - 70 + 109 - 112)', pagina",
    cae: 'ningún rótulo lleva la fórmula entre paréntesis',
  },
  {
    // La ruta deja de servirlos.
    fichero: 'src/modules/fiscal/modelo303/modelo303.routes.ts',
    de: 'return res.json({ ...modelo, rotulos: ROTULOS_303 });',
    a: 'return res.json({ ...modelo });',
    cae: 'GET /admin/modelo-303 sirve los rótulos',
  },
  {
    // La salida pierde una casilla que sigue teniendo rótulo.
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: "Object.freeze({ casilla: 70, motivo: 'autoliquidacion_anterior_no_consta' as const }),",
    a: '',
    cae: 'hay uno por cada casilla que devuelve',
  },
];

// El `prisma` del handler es el singleton de `src/core/db/prisma.ts`, que reusa `global.prisma` si
// existe: se pone ANTES de cargar la ruta. Base en memoria, sin red y sin escribir nada.
const MIO = 7;
const consultas = { invoice: 0 };
globalThis.prisma = {
  invoice: { findMany: async ({ where }) => {
    consultas.invoice += 1;
    return [{
      id: 1, merchantId: where.merchantId, number: '2026-CF-001', createdAt: new Date(Date.UTC(2026, 4, 12, 10)),
      paidAt: null, type: 'F1', total: '121.00', currency: 'EUR', status: 'pending', customerId: 3,
      quoteId: null, chargeId: null, albaranRefs: null,
      lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax: 0.21 }],
    }];
  } },
  quote: { findMany: async () => [] },
  albaran: { findMany: async () => [] },
  expense: { findMany: async () => [] },
  merchant: { findUnique: async ({ where }) => ({ id: where.id, timezone: 'Europe/Madrid' }) },
};

const { ROTULOS_303 } = require('../dist/modules/fiscal/modelo303/casillas.js');
const mod = require('../dist/modules/fiscal/modelo303/modelo303.routes.js');
const router = mod.default?.stack ? mod.default : mod.default?.default;

const RG = 'Régimen general';
const CORRIENTES = 'Por cuotas soportadas en operaciones interiores corrientes';
const BIENES = 'Por cuotas soportadas en operaciones interiores con bienes de inversión';
const ESTADO = 'Atribuible a la Administración del Estado';

/** casilla → [rótulo, columna, página], leído en el impreso. */
const DEL_IMPRESO = {
  // SCRUM-1064d · c.20823 (c): las 01–09 llevan el tipo de su fila detrás de la llave del impreso.
  1: [`${RG} · 4 %`, 'Base imponible', 1],
  2: [`${RG} · 4 %`, 'Tipo %', 1],
  3: [`${RG} · 4 %`, 'Cuota', 1],
  4: [`${RG} · 10 %`, 'Base imponible', 1],
  5: [`${RG} · 10 %`, 'Tipo %', 1],
  6: [`${RG} · 10 %`, 'Cuota', 1],
  7: [`${RG} · 21 %`, 'Base imponible', 1],
  8: [`${RG} · 21 %`, 'Tipo %', 1],
  9: [`${RG} · 21 %`, 'Cuota', 1],
  27: ['Total cuota devengada', undefined, 1],
  28: [CORRIENTES, 'Base', 1],
  29: [CORRIENTES, 'Cuota', 1],
  30: [BIENES, 'Base', 1],
  31: [BIENES, 'Cuota', 1],
  45: ['Total a deducir', undefined, 1],
  46: ['Resultado régimen general', undefined, 1],
  64: ['Suma de resultados', undefined, 3],
  65: [ESTADO, '%', 3],
  66: [ESTADO, undefined, 3],
  68: ['Exclusivamente para sujetos pasivos que tributan conjuntamente a la Administración del Estado y a las Haciendas Forales. Resultado de la regularización anual.', undefined, 3],
  69: ['Resultado de la autoliquidación', undefined, 3],
  70: ['Resultado a ingresar correspondiente a la anterior autoliquidación o liquidación administrativa del ejercicio y período objeto de la autoliquidación', undefined, 3],
  71: ['Resultado', undefined, 3],
};

function llamar(query) {
  const capa = router?.stack?.find((l) => l.route?.path === '/');
  assert.ok(capa, '🔴 no encuentro el GET / del router del 303: este test no estaría midiendo la ruta.');
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      reqDeSesion({ rol: 'admin', merchantId: MIO, query }),
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

/** Todas las casillas con número que el 303 devuelve, sacadas de la SALIDA, no de una lista. */
function casillasDeLaSalida(m) {
  const n = new Set();
  for (const c of m.casillas) { n.add(c.casillaBase); n.add(c.casillaTipo); n.add(c.casillaCuota); }
  n.add(m.casillaTotalCuota.casilla);
  for (const p of [m.ivaDeducible.corrientes, m.ivaDeducible.bienesDeInversion]) { n.add(p.casillaBase); n.add(p.casillaCuota); }
  n.add(m.ivaDeducible.casillaTotalADeducir.casilla);
  n.add(m.resultadoRegimenGeneral.casilla);
  n.add(m.resultadoFinal.sumaDeResultados.casilla);
  for (const v of m.resultadoFinal.vacias) n.add(v.casilla);
  return [...n].sort((a, b) => a - b);
}

test('SCRUM-1064c · cada rótulo es el del impreso, con su columna y su página', () => {
  const esperados = Object.keys(DEL_IMPRESO).map(Number);
  assert.deepEqual(ROTULOS_303.map((r) => r.casilla), esperados,
    '🔴 las casillas con rótulo no son las transcritas del impreso (ni en número ni en orden).');
  for (const r of ROTULOS_303) {
    const [rotulo, columna, pagina] = DEL_IMPRESO[r.casilla];
    assert.equal(r.rotulo, rotulo, `🔴 casilla ${r.casilla}: el rótulo no es el literal del impreso.`);
    assert.equal(r.columna, columna, `🔴 casilla ${r.casilla}: la columna no es la de la cabecera del impreso.`);
    assert.equal(r.pagina, pagina, `🔴 casilla ${r.casilla}: no se lee en esa página del Anexo III.`);
  }
});

test('SCRUM-1064c · ningún rótulo lleva la fórmula entre paréntesis (c.20780)', () => {
  const formula = /\(\s*\d+\s*[+-]/;
  // Control positivo: el patrón SÍ caza el rótulo con fórmula tal y como sale en el impreso.
  assert.match('Total cuota devengada (152 + 167 + 03 + 155  + 06 + 09 + 11 + 13 + 15 + 158 + 170 + 18 + 21 + 24 + 26)', formula);
  assert.match('Resultado (69 - 70 + 109 - 112)', formula);
  const conFormula = ROTULOS_303.filter((r) => formula.test(r.rotulo)).map((r) => r.casilla);
  assert.deepEqual(conFormula, [], `🔴 rótulos con fórmula: ${conFormula.join(', ')}`);
});

test('SCRUM-1064c · GET /admin/modelo-303 sirve los rótulos, y hay uno por cada casilla que devuelve', async () => {
  const antes = consultas.invoice;
  const body = await llamar({ year: '2026', quarter: '2' });
  // Suelo: el cálculo corrió de verdad sobre una factura (si no, la comparación de abajo mide nada).
  assert.ok(consultas.invoice > antes, '🔴 el handler no leyó facturas: no ha corrido el cálculo.');
  assert.equal(body.casillaTotalCuota.valor, 21, '🔴 el 303 de una factura de 100 € al 21 % no da 21 € en la 27.');

  assert.deepEqual(body.rotulos, ROTULOS_303.map((r) => ({ ...r })),
    '🔴 la ruta no sirve los rótulos de `casillas.ts`.');
  const conRotulo = body.rotulos.map((r) => r.casilla);
  const devueltas = casillasDeLaSalida(body);
  assert.ok(devueltas.length >= 20, `🔴 sólo ${devueltas.length} casillas en la salida: el recorrido no ve el 303 entero.`);
  assert.deepEqual(conRotulo, devueltas,
    '🔴 las casillas con rótulo y las que devuelve el 303 no son las mismas: una casilla sin rótulo ' +
    'la pintaría la pantalla sin concepto, y un rótulo sin casilla es un texto de más.');
});
