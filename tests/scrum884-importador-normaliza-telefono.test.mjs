// SCRUM-884 · EL IMPORTADOR CSV DE CLIENTES, CON LA MISMA REGLA DE TELÉFONO QUE EL ALTA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO CORRIENDO (16-sep-2026, origin/main 4b0d5739)
//
// Un CSV con el mismo cliente dos veces —«612 345 678» y «+34 612345678»— entraba como DOS
// clientes: `creados: 2, omitidos: 0`, y los dos teléfonos guardados tal cual venían. El alta
// por formulario ya no lo hace desde SCRUM-578; el importador se quedó con la mitad sin hacer.
//
// ⚠️ LO QUE EL ENUNCIADO NO SABÍA: `normalizePhone` SOLA NO ARREGLA ESTE CASO. Da `612345678`
// para uno y `34612345678` para el otro — el prefijo de país no lo resuelve, y está fijado así a
// propósito (`identificadoresDuplicados.ts`). El alta resuelve el duplicado con OTRA pieza que
// ya existe, `formasBuscables`. Así que «la misma regla que el alta» son DOS piezas existentes:
// `normalizarIdentificadores` para GUARDAR y `formasBuscables` para BUSCAR. Ninguna nueva.
//
// Los números van en el rango imposible de SCRUM-262 (`34 0…`): el caso es el mismo —nueve
// dígitos nacionales frente a prefijo + nueve— sin escribir un móvil que pueda existir.

import test from 'node:test';
import assert from 'node:assert/strict';

import { importarClientes } from '../dist/modules/system/domain/importarClientes.service.js';
import { normalizePhone } from '../dist/core/utils/utils.js';
// Por espacio de nombres a propósito: si el alta no exporta su normalizador, cae SOLO el test
// que lo necesita, con su mensaje, en vez de tumbar el fichero entero en la carga.
import * as alta from '../dist/modules/system/customerAdmin.js';

import { tramoNacionalDePrueba } from '../scripts/_telefonos-prueba.mjs';

const MERCHANT = 7;
/** Lo que el alta deja en la base para «012 345 678»: nueve dígitos, sin prefijo. */
const NACIONAL = tramoNacionalDePrueba(12345678);
const MAPEO = { name: 0, phone: 1 };

/**
 * Tabla de mentira con la semántica de Prisma que importa aquí: `findFirst` con `OR` de
 * IGUALDADES EXACTAS, y lo que se crea se ve en la búsqueda siguiente (como en la base real,
 * donde las filas del mismo CSV se insertan de una en una). Sin eso, el duplicado DENTRO del
 * mismo fichero —que es el caso del ticket— no se podría ver nunca.
 *
 * Sólo expone `findFirst` y `create`: si el importador intentara ACTUALIZAR una fila existente,
 * la llamada lanzaría y la fila saldría en `rechazos`.
 */
function tabla(existentes = []) {
  const filas = existentes.map((e) => ({ ...e }));
  const casa = (o, e) => Object.entries(o).every(([k, v]) => e[k] === v);
  return {
    filas,
    findFirst: async ({ where }) =>
      filas.find((e) => e.merchantId === where.merchantId && (where.OR ?? []).some((o) => casa(o, e))) ?? null,
    create: async ({ data }) => { filas.push({ ...data }); return data; },
  };
}

function csv(...filas) {
  return ['nombre;telefono', ...filas.map(([n, t]) => `${n};${t}`)].join('\r\n');
}

/** El SUELO: un verde sobre cero filas importadas no mide nada. */
async function importar(texto, t) {
  const r = await importarClientes(MERCHANT, texto, MAPEO, t);
  assert.ok(r.creados + r.omitidos >= 1,
    `🔴 NO PUDE MIRAR: el CSV de prueba no llegó a importar ninguna fila ` +
    `(creados ${r.creados}, omitidos ${r.omitidos}, rechazos ${JSON.stringify(r.rechazos)}). ` +
    'Lo de abajo no probaría nada.');
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ROJO · el caso del ticket
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-884 · 🔴 «012 345 678» y «+34 012345678» en el mismo CSV son UN cliente, no dos', async () => {
  const t = tabla();
  const r = await importar(csv(['Pepe', '012 345 678'], ['Pepe', '+34 012345678']), t);
  assert.equal(r.creados, 1, `🔴 entraron ${r.creados}: el mismo cliente con y sin prefijo se duplicó`);
  assert.equal(r.omitidos, 1, '🔴 la segunda fila no se reconoció como el mismo cliente');
  assert.deepEqual(r.rechazos, []);
});

test('SCRUM-884 · 🔴 y en el orden contrario: primero con prefijo, luego sin él', async () => {
  const t = tabla();
  const r = await importar(csv(['Pepe', '+34 012345678'], ['Pepe', '012 345 678']), t);
  assert.equal(r.creados, 1, `🔴 entraron ${r.creados}: el cruce sólo funciona en un sentido`);
  assert.equal(r.omitidos, 1);
});

test('SCRUM-884 · 🔴 un cliente YA GUARDADO por el alta tampoco se duplica al importarlo', async () => {
  // El alta guarda `normalizePhone`: nueve dígitos, sin prefijo. Es la fila que hay en la base.
  const t = tabla([{ merchantId: MERCHANT, name: 'Pepe', phone: NACIONAL }]);
  const r = await importar(csv(['Pepe', '+34 012 345 678'], ['Ana', '34000000009']), t);
  assert.equal(r.omitidos, 1, '🔴 el cliente que ya existía volvió a entrar');
  assert.equal(r.creados, 1, 'la fila distinta sí entra — si no, el suelo mediría otra cosa');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// SE GUARDA COMO LO GUARDA EL ALTA — la misma función, no una copia
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-884 · 🔴 el teléfono se guarda con el MISMO normalizador que el alta', async () => {
  assert.equal(typeof alta.normalizarIdentificadores, 'function',
    '🔴 el alta no expone su normalizador: el importador no puede estar usando el mismo.');
  const t = tabla();
  await importar(csv(['Pepe', '+34 012-345-678'], ['Ana', '0034 (000) 000 009'], ['Luis', 'ext. 12']), t);
  const guardados = t.filas.map((f) => f.phone);
  const comoElAlta = ['+34 012-345-678', '0034 (000) 000 009', 'ext. 12']
    .map((phone) => alta.normalizarIdentificadores({ phone }).phone);
  assert.deepEqual(guardados, comoElAlta, '🔴 el importador guarda distinto de lo que guardaría el formulario');
  // Y lo que el alta decide, dicho en claro, para que un cambio suyo no pase como «iguales»:
  assert.deepEqual(guardados, ['34012345678', '34000000009', 'ext. 12']);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// POSITIVOS · lo que ya funcionaba sigue funcionando
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-884 · los duplicados EXACTOS se siguen detectando (dentro del CSV y contra la base)', async () => {
  const t = tabla([{ merchantId: MERCHANT, name: 'Viejo', phone: '34000000001' }]);
  const r = await importar(csv(['Viejo', '34000000001'], ['Ana', '34000000002'], ['Ana', '34000000002']), t);
  assert.equal(r.creados, 1);
  assert.equal(r.omitidos, 2, '🔴 un duplicado exacto dejó de detectarse');
});

test('SCRUM-884 · un texto que no es teléfono y ya estaba guardado igual se sigue reconociendo', async () => {
  // `normalizePhone` lo rechaza (''), así que se guarda tal cual — y tal cual tiene que encontrarse.
  const t = tabla([{ merchantId: MERCHANT, name: 'Raro', phone: 'ext. 12' }]);
  const r = await importar(csv(['Raro', 'ext. 12'], ['Ana', '34000000002']), t);
  assert.equal(r.omitidos, 1, '🔴 la forma cruda dejó de buscarse');
});

test('SCRUM-884 · un teléfono EXTRANJERO válido no se deforma ni se confunde con uno español', async () => {
  const t = tabla([{ merchantId: MERCHANT, name: 'Pepe', phone: NACIONAL }]);
  const r = await importar(csv(['Pierre', '+33 012 345 678']), t);
  assert.equal(r.creados, 1, '🔴 un número francés se tomó por el español con los mismos nueve dígitos');
  assert.equal(t.filas.at(-1).phone, normalizePhone('+33 012 345 678'));
  assert.equal(t.filas.at(-1).phone, '33012345678', '🔴 el prefijo extranjero se perdió o se cambió');
});

test('SCRUM-884 · el duplicado sigue siendo DENTRO del merchant (regla 2)', async () => {
  const t = tabla([{ merchantId: MERCHANT + 1, name: 'Pepe', phone: NACIONAL }]);
  const r = await importar(csv(['Pepe', '+34 012345678']), t);
  assert.equal(r.creados, 1, '🔴 el cliente de OTRO merchant bloqueó la importación');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// NEGATIVO · lo ya guardado no se toca
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-884 · los clientes ya guardados NO se reescriben: ni se normalizan ni se actualizan', async () => {
  const antes = [
    { merchantId: MERCHANT, name: 'Viejo', phone: '+34 000 000 001' },
    { merchantId: MERCHANT, name: 'Otro', phone: NACIONAL },
  ];
  const t = tabla(antes);
  const r = await importar(csv(['Otro', '+34 012345678'], ['Nuevo', '34000000003']), t);
  assert.deepEqual(r.rechazos, [], '🔴 el importador intentó algo más que buscar y crear');
  assert.deepEqual(t.filas.slice(0, antes.length), antes, '🔴 una fila que ya existía cambió');
});
