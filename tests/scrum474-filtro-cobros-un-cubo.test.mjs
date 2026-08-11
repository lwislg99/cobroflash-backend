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

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const { cuboDeMetodo, metodoSinPasarela, COBROS_METODOS } =
  require_(path.join(RAIZ, 'public/dashboard/js/cobrosView.js'));

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
  assert.equal(metodoSinPasarela(':stripe'), '',
    '🔴 un valor sin método delante devuelve algo que parece un método.');
  assert.equal(metodoSinPasarela(null), null);
});
