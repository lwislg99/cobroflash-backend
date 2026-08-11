// tests/scrum474-filtro-cobros-un-cubo.test.mjs — SCRUM-474
//
// EL DEFECTO QUE EL PROFESIONAL VE: filtra por «tarjeta» y ve la mitad de sus cobros.
//
// `card` lo escribe el selector de pago y `card:stripe` lo escribe la pasarela — **son el mismo
// método**, uno es la preferencia y el otro el hecho consumado. El filtro comparaba el valor
// entero, así que `card:stripe` caía en «Método no registrado».
//
// Medido en producción el 11-ago-2026: **38 de 51 cobros** repartidos entre las dos etiquetas.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const { cuboDeMetodo, metodoSinPasarela, COBROS_METODOS } =
  require_(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'));

/** Un cobro con la forma que sirve el servicio, para poder pintarlo de verdad. */
const cobro = (id, metodo) => ({
  origen: 'charge', id, fecha: '2026-08-01T10:00:00.000Z', cliente: `Cliente ${id}`,
  concepto: 'Trabajo', importe: '100.00', moneda: 'EUR', metodo, estado: 'paid',
  referencia: null, numero: null, tipo: null, invoiceId: null, chargeId: id,
});

/**
 * Cuántas filas de cobro hay pintadas. Se cuentan por `cell-client` —una por fila— y no por `TR`:
 * el estado vacío también pinta un `<tr>`, y contarlo daría 1 donde hay 0.
 */
const filas = (n) => todos(n).filter((x) => x.className === 'cell-client').length;

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-474 · SUELO: la tabla de cubos existe y el clasificador la usa', () => {
  assert.ok(Array.isArray(COBROS_METODOS) && COBROS_METODOS.length >= 4,
    `🔴 solo se leen ${COBROS_METODOS?.length} cubos: el test no está midiendo el filtro real.`);
  // Control positivo del instrumento: un valor que SIEMPRE cayó bien sigue cayendo bien.
  assert.equal(cuboDeMetodo('transfer'), 'transfer',
    '🔴 el clasificador no funciona ni con un valor simple: lo de abajo no probaría nada.');
});

// ── EL CONTROL POSITIVO ──────────────────────────────────────────────────────────────────────

test('SCRUM-474 · 🔴 `card` y `card:stripe` caen en el MISMO cubo', () => {
  assert.equal(cuboDeMetodo('card'), 'card');
  assert.equal(cuboDeMetodo('card:stripe'), 'card',
    '🔴 `card:stripe` no cae en el cubo «tarjeta». El profesional filtra por tarjeta y ve la ' +
    'mitad de sus cobros: 38 de 51 repartidos en dos etiquetas para lo mismo.');

  // Y el filtro de la pantalla, ejercido: los dos tienen que volver juntos.
  const datos = [
    { id: 1, metodo: 'card' },
    { id: 2, metodo: 'card:stripe' },
    { id: 3, metodo: 'transfer' },
  ];
  const enTarjeta = datos.filter((c) => cuboDeMetodo(c.metodo) === 'card').map((c) => c.id);
  assert.deepEqual(enTarjeta, [1, 2],
    `🔴 el filtro «tarjeta» devuelve ${JSON.stringify(enTarjeta)} y tienen que ser los dos. El ` +
    'cobro que se queda fuera no desaparece: aparece en «Método no registrado», que dice que de ' +
    'él no consta cómo entró el dinero — y sí consta.');
});

test('SCRUM-474 · la pasarela vale para cualquier método, no solo para la tarjeta', () => {
  assert.equal(cuboDeMetodo('transfer:mercadopago'), 'transfer');
  assert.equal(cuboDeMetodo('bizum_manual'), 'bizum');
  assert.equal(cuboDeMetodo('CARD:Stripe'), 'card', '🔴 la comparación es sensible a mayúsculas.');
});

// ── EL CONTROL NEGATIVO ──────────────────────────────────────────────────────────────────────

test('SCRUM-474 · 🔴 CONTROL NEGATIVO: los métodos NO se mezclan entre sí', () => {
  // Recortar la pasarela no puede convertirse en «todo cae en el primer cubo».
  const esperado = { card: 'card', 'card:stripe': 'card', transfer: 'transfer', cash: 'cash', bizum_auto: 'bizum', bizum_manual: 'bizum' };
  for (const [valor, cubo] of Object.entries(esperado)) {
    assert.equal(cuboDeMetodo(valor), cubo, `🔴 «${valor}» ha caído fuera de «${cubo}».`);
  }
  // Y lo que no consta sigue sin constar: los huérfanos no se cuelan en ningún cubo real.
  for (const huerfano of ['bizum', 'bank', 'mp', 'desconocido', null, undefined, '', '  ', 42]) {
    assert.equal(cuboDeMetodo(huerfano), 'sin-metodo',
      `🔴 «${String(huerfano)}» se ha colado en un cubo con nombre. «Método no registrado» dice la ` +
      'verdad —no consta— y meterlo en «tarjeta» sería afirmar algo que nadie sabe.');
  }
});

test('SCRUM-474 · recortar la pasarela es lo único que hace, y no toca el valor guardado', () => {
  assert.equal(metodoSinPasarela('card:stripe'), 'card');
  assert.equal(metodoSinPasarela('card'), 'card');
  assert.equal(metodoSinPasarela(':stripe'), null,
    '🔴 un valor sin método delante devuelve algo que parece un método.');
  assert.equal(metodoSinPasarela(null), null);
});

// ── LOS CASOS FRONTERA, UNO A UNO ────────────────────────────────────────────────────────────

test('SCRUM-474 · los ocho casos frontera, y qué cubo le toca a cada uno', () => {
  // Escritos de uno en uno y no en bucle: cuando uno caiga, el rojo tiene que decir CUÁL.
  assert.equal(cuboDeMetodo('card'), 'card', '🔴 la preferencia que elige el profesional.');
  assert.equal(cuboDeMetodo('card:stripe'), 'card', '🔴 el hecho consumado que escribe la pasarela.');
  assert.equal(cuboDeMetodo('bizum_manual'), 'bizum', '🔴 el Bizum que confirma una PERSONA.');
  assert.equal(cuboDeMetodo('transfer'), 'transfer');
  assert.equal(cuboDeMetodo('mp'), 'sin-metodo',
    '🔴 «mp» no está en `PAID_VIA` (censo SCRUM-473 §3): no puede tener cubo propio.');
  assert.equal(cuboDeMetodo(''), 'sin-metodo');

  // 🔴 `bizum` A SECAS ≠ `bizum_manual`. Son dos cadenas de evidencia distintas —una la confirma
  // una persona (`chargesAdmin.routes.ts:51`), la otra un webhook— y `bizum` a secas no está en
  // `PAID_VIA`: de él no consta cuál de las dos fue. Fundirlos sería peor que el defecto que este
  // ticket arregla, porque afirmaría una confirmación que nadie hizo.
  assert.equal(cuboDeMetodo('bizum'), 'sin-metodo',
    '🔴 `bizum` a secas se ha colado en el cubo «Bizum» con `bizum_manual`. No consta quién lo ' +
    'confirmó: meterlo ahí inventa una cadena de evidencia.');
  assert.notEqual(cuboDeMetodo('bizum'), cuboDeMetodo('bizum_manual'),
    '🔴 `bizum` y `bizum_manual` han acabado en el mismo cubo.');

  // Dos puntos y NADA detrás: la pasarela vacía no cumple la forma. `partirMetodo` la rechaza
  // (`metodoDeCobro.ts:45`) y `esMetodoValido('card:')` es `false`, así que el guard de
  // `psp.routes.ts:110` ya rechaza ese valor AL ESCRIBIRLO. El lector no puede contradecir al
  // escritor sobre el mismo dato. Enmienda de esta sesión sobre `79248b55`: ver
  // `docs/master/SCRUM-474.md` (apéndice §4).
  assert.equal(cuboDeMetodo('card:'), 'sin-metodo',
    '🔴 `card:` cae en «tarjeta» y el servidor lo da por inválido. Las dos copias de la ' +
    'partición han dejado de decir lo mismo sobre el mismo valor.');
  assert.equal(metodoSinPasarela('card:'), null);
});

// ── EL CONTROL POSITIVO, SOBRE LA PANTALLA DE VERDAD ─────────────────────────────────────────

test('SCRUM-474 · 🔴 EL TEST: el profesional filtra por tarjeta y ve LOS 38, no 28', async () => {
  // Se pulsa el botón de la barra y se cuentan las filas que la vista pintó. No se reimplementa
  // `visibles()`: eso mediría una copia del filtro, y la copia siempre pasa.
  //
  // Los números son los de producción del 11-ago-2026 (`79248b55`): 28 `card` + 10 `card:stripe`.
  const COBROS = [];
  for (let i = 0; i < 28; i++) COBROS.push(cobro(i + 1, 'card'));
  for (let i = 0; i < 10; i++) COBROS.push(cobro(100 + i, 'card:stripe'));
  for (let i = 0; i < 13; i++) COBROS.push(cobro(200 + i, 'transfer')); // 51 en total, como en prod

  const banco = cargarDashboard(RAIZ, { datos: COBROS });
  const r = await pintarVista(banco, 'renderCobrosView');
  assert.equal(r.error, null, `🔴 la pantalla revienta: ${r.error && r.error.message}`);

  const boton = todos(r.contenedor).find(
    (n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.filtroCobro === 'card');
  assert.ok(boton, '🔴 no hay botón de filtro «tarjeta»: sin él esto no mide nada.');
  assert.equal(filas(r.contenedor), 51, '🔴 SUELO: sin filtrar tienen que verse los 51 cobros.');

  boton.dispararClick();
  const vistas = filas(r.contenedor);
  assert.equal(vistas, 38,
    `🔴 EL FILTRO LE ESCONDE COBROS AL PROFESIONAL: filtra por tarjeta y ve ${vistas} de 38. ` +
    `Los ${38 - vistas} que faltan están cobrados con tarjeta y guardados como «card:stripe» — la ` +
    'pasarela, no otro método. Salen bajo «Método no registrado», que afirma que no consta cómo ' +
    'entró ese dinero, y sí consta. En la pantalla del dinero eso no es una etiqueta imprecisa: ' +
    'le responde con un número más bajo del que tiene.');
});
