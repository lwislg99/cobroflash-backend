// tests/scrum1064d-tipos-y-rotulos-del-303.test.mjs — SCRUM-1064d · qué tipo va en cada fila del
// IVA devengado del 303, y el rótulo de las casillas 01–09 con su tipo.
//
// ① LA MEDICIÓN (SCRUM-1064 c.20823, punto d). El impreso (Orden HAC/27/2026, Anexo III, pág. 1,
// `https://www.boe.es/datos/imagenes/disp/2026/23/1761_16563944_7.png`, leído como imagen) pone seis
// filas bajo la llave «Régimen general» —150, 165, 01, 153, 04 y 07— y la 27 las suma todas
// («Total cuota devengada (152 + 167 + 03 + 155 + 06 + 09 + …)»). El impreso NO dice qué tipo va en
// cada fila: lo dicen las instrucciones de la AEAT. Las de 2026
// (`https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026.html`,
// leídas el 24-oct-2026), en su tabla «Casillas del modelo 303 en las que declarar las operaciones»:
//   «Tipo Casillas IVA devengado Cero 150, 151, 152 4% 01, 02., 03 10% 04, 05, 06 21% 07, 08, 09»
// Ni el 5 % ni el 7,5 % tienen fila en 2026. Los tenía la 153–155 sólo en 2024: «Para 09/3T, en las
// casillas 153, 154 y 155 se harán constar las bases imponibles gravadas al tipo del 5% […] Para 10 a
// 12/4T, […] al tipo del 7,5%» (instrucciones 09-12/3T-4T de 2024, misma sede).
// Así que, para un periodo de 2026, que el 303 aparte el 5 % y el 7,5 % fuera de la 27 es lo que dice
// la AEAT. Este fichero fija dónde cae HOY cada tipo, pasando facturas fabricadas por la ruta REAL.
//
// ② LOS RÓTULOS (c.20823, punto c): las 01–09 se rotulan «Régimen general · {tipo} %», con el tipo
// sacado del dato de la fila. Un test por fila; el tipo esperado sale de la SALIDA de la ruta y el
// literal de la tabla de la AEAT de arriba, no de `casillas.ts`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El rótulo pierde el tipo (vuelve el «Régimen general» a secas de 1064c).
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: 'const rotulo = `${REGIMEN_GENERAL} · ${t.tipo} %`;',
    a: 'const rotulo = REGIMEN_GENERAL;',
    cae: 'fila del 21 %',
  },
  {
    // El tipo del rótulo deja de salir del dato de la fila.
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: 'const rotulo = `${REGIMEN_GENERAL} · ${t.tipo} %`;',
    a: 'const rotulo = `${REGIMEN_GENERAL} · 21 %`;',
    cae: 'fila del 4 %',
  },
  {
    // Alguien le da fila al 5 % en 2026 (o cambia la del 4 %): la 27 dejaría de ser la de la AEAT.
    fichero: 'src/modules/fiscal/modelo303/casillas.ts',
    de: 'Object.freeze({ tipo: 4,  base: 1,',
    a: 'Object.freeze({ tipo: 5,  base: 1,',
    cae: 'dónde cae HOY cada tipo',
  },
];

// El `prisma` del handler es el singleton de `src/core/db/prisma.ts`, que reusa `global.prisma` si
// existe: se pone ANTES de cargar la ruta. Base en memoria, sin red y sin escribir nada.
const MIO = 7;
let facturas = [];
const consultas = { invoice: 0 };
globalThis.prisma = {
  invoice: { findMany: async ({ where }) => {
    consultas.invoice += 1;
    return facturas.filter((f) => f.merchantId === where.merchantId);
  } },
  quote: { findMany: async () => [] },
  albaran: { findMany: async () => [] },
  expense: { findMany: async () => [] },
  merchant: { findUnique: async ({ where }) => ({ id: where.id, timezone: 'Europe/Madrid' }) },
};

const mod = require('../dist/modules/fiscal/modelo303/modelo303.routes.js');
const router = mod.default?.stack ? mod.default : mod.default?.default;

/** Una factura de 100 € a `tax` (fracción), del 2T de 2026. */
const factura = (id, tax) => ({
  id, merchantId: MIO, number: `2026-CF-${id}`, createdAt: new Date(Date.UTC(2026, 4, 12, 10)),
  paidAt: null, type: 'F1', total: String(100 * (1 + tax)), currency: 'EUR', status: 'pending', customerId: 3,
  quoteId: null, chargeId: null, albaranRefs: null,
  lines: [{ concept: 'Mano de obra', qty: 1, price: 100, tax }],
});

function llamar(query) {
  const capa = router?.stack?.find((l) => l.route?.path === '/');
  assert.ok(capa, '🔴 no encuentro el GET / del router del 303: este test no estaría midiendo la ruta.');
  return new Promise((resolve, reject) => {
    capa.route.stack[0].handle(
      { merchantId: MIO, userRole: 'admin', query },
      { json: resolve, status: (c) => ({ json: (b) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }) },
      reject,
    );
  });
}

async function el303(lista) {
  facturas = lista;
  const antes = consultas.invoice;
  const body = await llamar({ year: '2026', quarter: '2' });
  assert.ok(consultas.invoice > antes, '🔴 el handler no leyó facturas: no ha corrido el cálculo.');
  return body;
}

test('SCRUM-1064d · dónde cae HOY cada tipo: 10 % y 21 % en su fila, 5 % y 7,5 % fuera de la 27', async () => {
  const body = await el303([factura(1, 0.05), factura(2, 0.075), factura(3, 0.10), factura(4, 0.21)]);
  const fila = (tipo) => body.casillas.find((c) => c.tipo === tipo);

  // Control positivo: el 10 % y el 21 % SÍ caen en su fila (04–06 y 07–09) y suman en la 27.
  assert.deepEqual([fila(10)?.casillaBase, fila(10)?.casillaCuota, fila(10)?.base, fila(10)?.cuota], [4, 6, 100, 10]);
  assert.deepEqual([fila(21)?.casillaBase, fila(21)?.casillaCuota, fila(21)?.base, fila(21)?.cuota], [7, 9, 100, 21]);
  assert.equal(body.casillaTotalCuota.casilla, 27);
  assert.equal(body.casillaTotalCuota.valor, 31, '🔴 la 27 no es 10 + 21: el 5 % o el 7,5 % han entrado, o se ha perdido una fila.');

  // Las filas del impreso para 2026 son las de la AEAT: 4, 10 y 21 % (la del 0 % no entra, SCRUM-212).
  assert.deepEqual(body.casillas.map((c) => c.tipo), [4, 10, 21],
    '🔴 el 303 tiene filas que la tabla de la AEAT de 2026 no da (o le falta una).');

  // El 5 % y el 7,5 % no tienen fila en 2026: se apartan, con su motivo, y no se pierden.
  const aparte = body.sinClasificar.map((o) => `${o.tipo}:${o.motivo}:${o.base}/${o.cuota}`).sort();
  assert.deepEqual(aparte, ['5:tipo_sin_casilla:100/5', '7.5:tipo_sin_casilla:100/7.5']);
});

/** casilla de base, de tipo y de cuota → el rótulo que lleva cada una. */
async function rotulosDeLaFila(tipo) {
  const body = await el303([factura(1, tipo / 100)]);
  const fila = body.casillas.find((c) => c.tipo === tipo);
  assert.ok(fila, `🔴 el 303 no devuelve la fila del ${tipo} %.`);
  const de = (n) => body.rotulos.find((r) => r.casilla === n);
  return { fila, base: de(fila.casillaBase), tipoR: de(fila.casillaTipo), cuota: de(fila.casillaCuota) };
}

// Literal de c.20823: «Régimen general · {tipo} %». Las columnas, de la cabecera del impreso.
for (const [tipo, casillas] of [[4, [1, 2, 3]], [10, [4, 5, 6]], [21, [7, 8, 9]]]) {
  test(`SCRUM-1064d · fila del ${tipo} %: las casillas ${casillas.map((n) => String(n).padStart(2, '0')).join('–')} se rotulan «Régimen general · ${tipo} %»`, async () => {
    const { fila, base, tipoR, cuota } = await rotulosDeLaFila(tipo);
    assert.deepEqual([fila.casillaBase, fila.casillaTipo, fila.casillaCuota], casillas,
      `🔴 la fila del ${tipo} % no va a las casillas de la tabla de la AEAT.`);
    const esperado = `Régimen general · ${fila.tipo} %`;
    assert.equal(esperado, `Régimen general · ${tipo} %`);
    for (const [r, columna] of [[base, 'Base imponible'], [tipoR, 'Tipo %'], [cuota, 'Cuota']]) {
      assert.ok(r, `🔴 una casilla de la fila del ${tipo} % sale sin rótulo.`);
      assert.equal(r.rotulo, esperado, `🔴 casilla ${r.casilla}: el rótulo no lleva el tipo de su fila.`);
      assert.equal(r.columna, columna, `🔴 casilla ${r.casilla}: la columna no es la de la cabecera del impreso.`);
    }
  });
}
