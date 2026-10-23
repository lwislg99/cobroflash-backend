// tests/scrum1457a-supresion-id-que-cabe.test.mjs — SCRUM-1457a (J3, 23-oct-2026)
//
// 🔴 EL DEFECTO: `POST /admin/supresion/:merchantId` validaba el id con `Number.isInteger`.
// `Number('99999999999999999999')` es `1e20` y `Number.isInteger(1e20)` es `true`: el valor pasaba la
// guarda de entrada. Hoy no llega a la base —la comparación de tenencia (SCRUM-440) lo para antes— pero
// contesta 404 donde la propia línea ya tenía su 400 (`merchant_invalido`). El arreglo es la forma de
// la casa, `cabeEnColumnaInt` (`src/core/validation/enteroDeColumna.ts`, SCRUM-1379), tal cual.
//
// ── LAS CONDICIONES DEL FUNDADOR (SCRUM-1456 c.18731) ──
// ⑥ «Rechaza más, nunca menos»: lo mide el caso POBLACIÓN, que calcula para cada entrada lo que
//   decidía la guarda VIEJA y exige que todo lo que ella rechazaba siga en 400.
// ② «Nada reacciona distinto»: ninguna pantalla llama a esta ruta (medido en el registro, con su
//   control positivo). Aquí sólo se comprueba que el cuerpo del 400 es el que la línea ya tenía.
//
// ── POR LA RUTA REAL (A10, SCRUM-1344) ── `dist/app.js` entero, con `requireAuth` y
// `requireRole('admin')`, por HTTP. Lo único doblado es Prisma (`_banco-camino-real.mjs`): ninguna
// base real. Es borrado de datos: el flag `MERCHANT_DELETE_ENABLED` se enciende SÓLO dentro de cada caso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Volver a la guarda de antes: un entero que no cabe vuelve a pasar la entrada.
    fichero: 'src/modules/system/app/routes/supresion.routes.ts',
    de: 'if (!cabeEnColumnaInt(merchantId) || merchantId <= 0) return',
    a: 'if (!Number.isInteger(merchantId) || merchantId <= 0) return',
    cae: 'SCRUM-1457a · 🔴 un merchantId entero que no cabe en la columna',
  },
  {
    // `isSafeInteger` deja pasar hasta 2^53: `10000000000` es «seguro» y no cabe.
    fichero: 'src/modules/system/app/routes/supresion.routes.ts',
    de: 'if (!cabeEnColumnaInt(merchantId) || merchantId <= 0) return',
    a: 'if (!Number.isSafeInteger(merchantId) || merchantId <= 0) return',
    cae: 'SCRUM-1457a · 🔴 un merchantId entero que no cabe en la columna',
  },
  {
    // Perder el suelo `<= 0`: el 0 y el -1, que la guarda vieja rechazaba, dejarían de salir en 400.
    fichero: 'src/modules/system/app/routes/supresion.routes.ts',
    de: 'if (!cabeEnColumnaInt(merchantId) || merchantId <= 0) return',
    a: 'if (!cabeEnColumnaInt(merchantId)) return',
    cae: 'SCRUM-1457a · ⑥ RECHAZA MÁS, NUNCA MENOS',
  },
];

const M = 7;
const app = await montarAppReal();
const ses = sesionesDe(M, { id: 9, role: 'tecnico', name: 'T', status: 'active', merchantId: M });

/** La guarda de ANTES, copiada de la línea que se sustituye, para que ⑥ se mida contra ella. */
const pasabaLaGuardaVieja = (texto) => { const n = Number(texto); return Number.isInteger(n) && n > 0; };

/** Programa el doble y devuelve el diario de lecturas del merchant (la de la ruta, no la de la sesión). */
function programar() {
  const lecturas = [];
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async (a) => { lecturas.push(a?.where?.id); return { ...ses.merchant, name: 'QA 1457a' }; } },
  });
  return lecturas;
}

async function pedir(id, { flag = true } = {}) {
  if (flag) process.env.MERCHANT_DELETE_ENABLED = 'true'; else delete process.env.MERCHANT_DELETE_ENABLED;
  const lecturas = programar();
  const callar = console.error; console.error = () => {};
  try {
    const r = await app.pedir(`/admin/supresion/${encodeURIComponent(id)}`, { token: ses.PROPIETARIO, metodo: 'POST', cuerpo: {} });
    return { ...r, lecturas, escrituras: bancoDePrisma().escrituras.length };
  } finally { console.error = callar; delete process.env.MERCHANT_DELETE_ENABLED; }
}

const NO_CABEN = ['99999999999999999999', '10000000000', '2147483648'];

test('SCRUM-1457a · 🔴 un merchantId entero que no cabe en la columna → 400 `merchant_invalido`, sin leer ni escribir', async () => {
  for (const v of NO_CABEN) {
    assert.ok(pasabaLaGuardaVieja(v), `el caso ${v} tiene que ser uno que la guarda vieja dejaba pasar, o no mide nada`);
    const r = await pedir(v);
    assert.equal(r.status, 400, `🔴 con ${v} la ruta contesta ${r.status}: la guarda de entrada lo ha dejado pasar`);
    assert.deepEqual(r.json, { error: 'merchant_invalido' }, `con ${v} el cuerpo no es el 400 que la línea ya tenía`);
    assert.deepEqual(r.lecturas, [], `🔴 con ${v} se ha leído el merchant`);
    assert.equal(r.escrituras, 0, `🔴 con ${v} se ha escrito en la base`);
  }
});

test('SCRUM-1457a · CONTROL: el id PROPIO sigue llegando a la base y a la confirmación (409), y `2147483647` ajeno sigue en 404', async () => {
  const propio = await pedir(String(M));
  assert.equal(propio.status, 409, `🔴 el merchant propio ya no llega a la confirmación: ${propio.status} ${propio.texto}`);
  assert.deepEqual(propio.lecturas, [M], '🔴 CIEGO: el id propio no ha llegado a leer el merchant');
  assert.equal(propio.escrituras, 0, 'sin la confirmación escrita no se borra nada');

  const borde = await pedir('2147483647');
  assert.equal(borde.status, 404, `el máximo de la columna cabe: es un merchant ajeno y la tenencia contesta 404 (vino ${borde.status})`);
  assert.deepEqual(borde.lecturas, [], '🔴 un merchant ajeno ha tocado la base');
});

test('SCRUM-1457a · CONTROL: con el flag apagado la ruta sigue sin existir (404), también para un id que no cabe', async () => {
  for (const v of [NO_CABEN[0], String(M)]) {
    const r = await pedir(v, { flag: false });
    assert.equal(r.status, 404, `con el flag apagado y ${v} vino ${r.status}`);
    assert.deepEqual(r.lecturas, []);
  }
});

// ⑥ · Para cada entrada, lo que decidía la guarda vieja manda: si la rechazaba, sigue en 400.
// Si la dejaba pasar y cabe, la respuesta es la de siempre (propio → 409, ajeno → 404).
// Si la dejaba pasar y NO cabe, es lo único que cambia: 400.
// ⚠️ Sin la cadena vacía: `/admin/supresion/` no casa con `/:merchantId` y no llega a la línea.
const POBLACION = [
  'abc', ' ', '1.5', '7.5', '-1', '0', '-0', '-2147483649', 'Infinity', '-Infinity', 'NaN', '1e400',
  '7', '07', '7.0', '7e0', '0x7', '+7', ' 7 ', '99', '2147483647',
  '2147483648', '10000000000', '99999999999999999999', '9007199254740993',
];

test(`SCRUM-1457a · ⑥ RECHAZA MÁS, NUNCA MENOS: ${POBLACION.length} entradas contra la guarda vieja`, async () => {
  const cuenta = { rechazabaYSigue: 0, nuevoRechazo: 0, igual: 0 };
  for (const v of POBLACION) {
    const r = await pedir(v);
    const n = Number(v);
    if (!pasabaLaGuardaVieja(v)) {
      assert.equal(r.status, 400, `🔴 ⑥ ROTA: «${v}» lo rechazaba la guarda vieja y ahora contesta ${r.status}`);
      assert.deepEqual(r.lecturas, [], `🔴 ⑥ ROTA: «${v}» ha llegado a leer el merchant`);
      cuenta.rechazabaYSigue++;
    } else if (n > 2147483647) {
      assert.equal(r.status, 400, `«${v}» no cabe en la columna y contesta ${r.status}`);
      cuenta.nuevoRechazo++;
    } else {
      assert.equal(r.status, n === M ? 409 : 404, `«${v}» cabe y ha cambiado de respuesta: ${r.status}`);
      cuenta.igual++;
    }
    assert.equal(r.escrituras, 0, `«${v}» ha escrito en la base`);
  }
  // La población declara qué ha medido: sin las tres ramas pobladas, el caso no prueba ⑥.
  assert.equal(cuenta.rechazabaYSigue + cuenta.nuevoRechazo + cuenta.igual, POBLACION.length);
  assert.ok(cuenta.rechazabaYSigue >= 10 && cuenta.nuevoRechazo >= 3 && cuenta.igual >= 6,
    `🔴 CIEGO: población desequilibrada ${JSON.stringify(cuenta)}`);
});
