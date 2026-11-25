// tests/scrum1807d-agrupado-en-la-cabecera.test.mjs — SCRUM-1807 (tramo d, S1)
//
// EL MODO DESGLOSADO / AGRUPADO SE ELIGE POR APARTADO, CON UNA CLAVE EN SU CABECERA.
//
// SCRUM-1786 P3 ✅ (c.22269): «agrupado: true» en la CABECERA, dentro del JSON de `Quote.lines`, sin
// esquema (SCRUM-1786.md §3.4). Sin declararla en `QuoteLineSchema`, `z.object` la BORRA en silencio
// —zod quita las claves que no conoce, lo que ya les pasó a `suplido` (SCRUM-500), `costeUnitario`
// (SCRUM-661) y `apartado` (SCRUM-655)— y el interruptor del editor no llegaría nunca a la base.
//
// Lo que se mira, en este orden: la clave VIAJA (la puerta la deja pasar), SE GUARDA (lo que el
// `POST /quote/create` real le pasa a `quote.create`) y SE RELEE (de esa fila, tras el viaje por
// `Json`, `capitulos()` + `esAgrupado()` dicen qué apartado va agrupado). Y la compatibilidad: una
// cabecera SIN la clave —todas las guardadas hasta hoy— sigue valiendo y sale SIN la clave, no con
// un `false` que nadie escribió (sin clave = desglosado, SCRUM-1786.md §3.5).
//
// ⛔ Sin base y sin red: base doblada (`_envio-doblado.mjs`) y WhatsApp en dry-run.
process.env.WHATSAPP_DRY_RUN = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS_QUOTES = '../dist/modules/quotes/app/routes/quotes.routes.js';
const { CreateQuoteSchema } = moduloDeDist('../dist/core/validation/schemas.js');
const { capitulos, esAgrupado } = moduloDeDist('../dist/modules/quotes/domain/apartados.js');
const { calcTotal } = moduloDeDist('../dist/core/utils/utils.js');

/** Mutaciones que este test tiene que tumbar (se aplican con `aplicarUna`, scripts/meta-guard-mutaciones.mjs). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La puerta deja de declarar la clave: zod la borra en silencio.
    fichero: 'src/core/validation/schemas.ts',
    de: '  agrupado: z.boolean().optional(),',
    a: '',
    cae: 'SCRUM-1807d · la clave VIAJA: la puerta deja pasar «agrupado» en la cabecera',
  },
  {
    // Un default convierte el silencio de las cabeceras viejas en un dato que nadie escribió.
    fichero: 'src/core/validation/schemas.ts',
    de: '  agrupado: z.boolean().optional(),',
    a: '  agrupado: z.boolean().optional().default(false),',
    cae: 'SCRUM-1807d · compatibilidad: una cabecera SIN la clave vale y sale SIN la clave',
  },
  {
    // Se adivina: cualquier valor «verdadero» cuenta como agrupado.
    fichero: 'src/modules/quotes/domain/apartados.ts',
    de: "  return (cabecera as Record<string, unknown>)[MARCA_AGRUPADO] === true;",
    a: "  return Boolean((cabecera as Record<string, unknown>)[MARCA_AGRUPADO]);",
    cae: 'SCRUM-1807d · esAgrupado: sólo el booleano true y sólo en una cabecera',
  },
  {
    // La marca cuenta también en una línea que no es cabecera.
    fichero: 'src/modules/quotes/domain/apartados.ts',
    de: '  if (!esApartado(cabecera)) return false;',
    a: '  if (cabecera === null || typeof cabecera !== \'object\') return false;',
    cae: 'SCRUM-1807d · esAgrupado: sólo el booleano true y sólo en una cabecera',
  },
];

const BASE = { merchant_id: MERCHANT, customer_id: CLIENTE, currency: 'eur' };

/** Dos apartados: el primero agrupado, el segundo como hasta hoy (sin la clave). */
const LINEAS = () => [
  { concept: 'Baño', apartado: true, agrupado: true },
  { concept: 'Plato de ducha', qty: 1, price: 320, tax: 0.21 },
  { concept: 'Mampara', qty: 1, price: 180.5, tax: 0.21 },
  { concept: 'Cocina', apartado: true },
  { concept: 'Grifo', qty: 2, price: 45, tax: 0.1 },
];

test('SCRUM-1807d · la clave VIAJA: la puerta deja pasar «agrupado» en la cabecera', () => {
  const r = CreateQuoteSchema.safeParse({ ...BASE, lines: LINEAS() });
  assert.equal(r.success, true, `SUELO: la puerta rechaza un presupuesto válido: ${JSON.stringify(r.error?.issues)}`);
  assert.equal(r.data.lines[0].agrupado, true,
    '🔴 la puerta ha BORRADO «agrupado» de la cabecera: el interruptor del editor no llega a la base');
  // `false` también es una elección, y se conserva tal cual.
  const conFalse = CreateQuoteSchema.parse({ ...BASE, lines: [{ concept: 'A', apartado: true, agrupado: false }, { concept: 'x', qty: 1, price: 1 }] });
  assert.equal(conFalse.lines[0].agrupado, false);
  // Y también en el modo de tres opciones, que usa la misma línea.
  const tier = (id) => ({ id, label: id, lines: LINEAS() });
  const t = CreateQuoteSchema.parse({ ...BASE, tiers: [tier('good'), tier('better'), tier('best')] });
  assert.equal(t.tiers[1].lines[0].agrupado, true, '🔴 en las opciones la clave se pierde');
});

test('SCRUM-1807d · compatibilidad: una cabecera SIN la clave vale y sale SIN la clave', () => {
  const r = CreateQuoteSchema.safeParse({ ...BASE, lines: LINEAS() });
  assert.equal(r.success, true);
  assert.equal('agrupado' in r.data.lines[3], false,
    '🔴 una cabecera sin la clave sale CON ella: un default ha convertido el silencio en un dato');
  // Las líneas normales tampoco la ganan.
  for (const i of [1, 2, 4]) assert.equal('agrupado' in r.data.lines[i], false, `🔴 la línea ${i} ha ganado la clave`);
  // Y la clave no mueve el dinero: el total es el mismo con y sin ella.
  const sinClave = LINEAS().map(({ agrupado, ...l }) => l);
  assert.equal(calcTotal(r.data.lines), calcTotal(sinClave));
  assert.ok(calcTotal(sinClave) > 0, 'SUELO: un total 0 no compara nada');
});

test('SCRUM-1807d · un valor que no es booleano se rechaza, como la marca de apartado', () => {
  const r = CreateQuoteSchema.safeParse({ ...BASE, lines: [{ concept: 'A', apartado: true, agrupado: 'sí' }, { concept: 'x', qty: 1, price: 1 }] });
  assert.equal(r.success, false, '🔴 «agrupado: \'sí\'» ha pasado la puerta');
  assert.deepEqual(r.error.issues[0].path, ['lines', 0, 'agrupado']);
});

test('SCRUM-1807d · SE GUARDA y SE RELEE: POST /quote/create la escribe y capitulos() la lee de la fila', async () => {
  const creadas = [];
  inyectarBase({
    'merchant.findUnique': () => ({ id: MERCHANT, name: 'Reformas 1807', whatsappPhone: null, approvalThreshold: null,
      country: 'ES', timezone: 'Europe/Madrid', quoteSeriesYear: null, nextQuoteNumber: 1 }),
    'customer.findFirst': () => ({ id: CLIENTE, merchantId: MERCHANT, name: 'Cliente 1807' }),
    '$executeRaw': () => 0, // el cerrojo de la serie
    'merchant.update': () => ({ id: MERCHANT }),
    'quote.create': ({ data }) => { creadas.push(data); return { id: 1807, ...data }; },
  }, [RUTAS_QUOTES]);
  const router = moduloDeDist(RUTAS_QUOTES).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/create' && l.route.methods.post);
  assert.ok(capa, 'CIEGO: no encuentro POST /create en quotes.routes');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  const salida = { status: 200, data: undefined };
  const res = { status(s) { salida.status = s; return res; }, json(j) { salida.data = j; return res; }, setHeader() { return res; } };
  await h(reqDeSesion({ rol: 'admin', body: { ...BASE, lines: LINEAS() }, merchantId: MERCHANT, headers: {} }), res);
  assert.equal(salida.status, 201, `SUELO: la ruta no creó el presupuesto (${salida.status} ${JSON.stringify(salida.data)})`);
  assert.equal(creadas.length, 1, 'SUELO: no llegó nada a quote.create');

  // La fila tal y como vuelve de una columna `Json`.
  const releida = JSON.parse(JSON.stringify(creadas[0].lines));
  const caps = capitulos(releida);
  assert.deepEqual(caps.map((c) => c.cabecera?.concept), ['Baño', 'Cocina'], 'SUELO: los capítulos no son los dos que entraron');
  assert.deepEqual(caps.map((c) => esAgrupado(c.cabecera)), [true, false],
    '🔴 releída la fila, el primer apartado ya no va agrupado (o el segundo sí, sin que nadie lo pidiera)');
  assert.equal('agrupado' in releida[3], false, '🔴 la cabecera sin clave se guardó con ella');
});

test('SCRUM-1807d · esAgrupado: sólo el booleano true y sólo en una cabecera', () => {
  assert.equal(esAgrupado({ concept: 'A', apartado: true, agrupado: true }), true);
  for (const v of ['true', 1, 'sí', {}, false, null, undefined]) {
    assert.equal(esAgrupado({ concept: 'A', apartado: true, agrupado: v }), false, `🔴 agrupado: ${JSON.stringify(v)} cuenta como agrupado`);
  }
  assert.equal(esAgrupado({ concept: 'A', apartado: true }), false, 'sin clave = desglosado');
  assert.equal(esAgrupado({ concept: 'x', qty: 1, price: 1, agrupado: true }), false,
    '🔴 una línea que NO es cabecera cuenta como agrupada');
  assert.equal(esAgrupado(null), false, 'el capítulo de antes de la primera cabecera no se agrupa');
  assert.equal(esAgrupado(undefined), false);
});
