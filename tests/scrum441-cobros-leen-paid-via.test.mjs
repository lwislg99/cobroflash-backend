// SCRUM-441 (fase 2) · LA COLUMNA `paid_via` SE ESCRIBÍA Y NO LA LEÍA NADIE.
//
// Sin gate: `fundirCobros` es puro —entran filas, sale la lista— así que se EJECUTA. Ni BD, ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL DEFECTO
//
// Otro carril añadió `Invoice.paidVia` y el selector que la escribe al marcar un cobro a mano.
// `cobros.service.ts` seguía mapeando **`metodo: null` a fuego**, con un comentario que afirmaba
// «la Invoice no guarda método» — cierto cuando se escribió, falso desde que llegó la columna.
//
// Resultado: el profesional elegía «Bizum» al marcar el cobro, y ese cobro salía en la pantalla
// dentro del cubo **«Método no registrado»**, con su método guardado en la fila de al lado.
//
// **Un comentario que envejece mal no rompe nada: por eso dura.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO CAMBIA, Y ES LA MITAD QUE PROTEGE EL DATO
//
// `null` sigue siendo un valor legítimo: «no consta». Las facturas históricas y las que se marquen
// sin elegir método siguen cayendo en su cubo, y **no se rellenan con un valor por defecto** —
// escribir «transferencia» porque suele serlo es el bug que `paidVia.ts` cierra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fundirCobros } from '../dist/modules/billing/domain/cobros.service.js';
import { CUBO_SIN_METODO } from '../dist/modules/billing/domain/metodoDeCobro.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Una factura suelta (sin `Charge` detrás): el cobro marcado a mano. */
const factura = (extra = {}) => ({
  id: 1, createdAt: new Date('2026-08-01T10:00:00Z'), total: '121.00', currency: 'EUR',
  status: 'paid', number: 'F-2026-001', type: 'F1', customer: { name: 'Cliente' }, ...extra,
});
const fundir = (invoices, charges = []) =>
  fundirCobros({ charges, candidatas: invoices, invoiced: [] });

// ── 🔴 EL CONTROL NEGATIVO VA PRIMERO ────────────────────────────────────────────────────

test('SCRUM-441 (fase 2) · 🔴 CONTROL NEGATIVO: sin `paidVia` el cobro sale EXACTAMENTE como antes', () => {
  // Lo primero porque es la mayoría de las filas: todo lo histórico. Un arreglo que mueva el caso
  // «no consta» habría cambiado el recuento de una pantalla de dinero sin que nadie lo pidiera.
  const [c] = fundir([factura()]);                    // sin paidVia
  assert.equal(c.metodo, null,
    '🔴 una factura SIN `paidVia` ha dejado de salir con `metodo: null`. «No consta» no se rellena: '
    + 'escribir «transferencia» porque suele serlo es el bug que `paidVia.ts` cierra.');
  assert.equal(c.metodoCubo, CUBO_SIN_METODO,
    `🔴 sin método, el cobro tiene que caer en «${CUBO_SIN_METODO}» y ha caído en «${c.metodoCubo}».`);

  // Y los tres sabores de «no hay dato» caen igual: null, undefined y vacío.
  for (const v of [null, undefined, '']) {
    const [x] = fundir([factura({ paidVia: v })]);
    assert.equal(x.metodo, null, `🔴 \`paidVia: ${JSON.stringify(v)}\` no se está tratando como «no consta».`);
    assert.equal(x.metodoCubo, CUBO_SIN_METODO);
  }
});

test('SCRUM-441 (fase 2) · 🔴 CONTROL NEGATIVO: los cobros con `Charge` no se tocan', () => {
  // La otra mitad de la pantalla. Este ticket solo mira las facturas sueltas.
  const charge = {
    id: 9, createdAt: new Date('2026-08-02T10:00:00Z'), amount: '50.00', currency: 'EUR',
    method: 'card:stripe', status: 'paid', concept: 'x', reference: 'r',
    customer: { name: 'Cliente' },
  };
  const [c] = fundir([], [charge]);
  assert.equal(c.metodo, 'card:stripe', '🔴 el método de un `Charge` ha cambiado.');
  assert.equal(c.metodoCubo, 'card', '🔴 el cubo de un `Charge` ha cambiado: `card:stripe` va a `card`.');
});

// ── 🔴 EL VECTOR ─────────────────────────────────────────────────────────────────────────

test('SCRUM-441 (fase 2) · 🔴 un cobro marcado a mano SÍ enseña cómo entró el dinero', () => {
  const [c] = fundir([factura({ paidVia: 'bizum_manual' })]);
  assert.equal(c.metodo, 'bizum_manual',
    '🔴 LA COLUMNA `paid_via` SE ESCRIBE Y NO LA LEE NADIE.\n\n'
    + '  El profesional elige el método al marcar el cobro a mano, se guarda en `Invoice.paidVia`,\n'
    + '  y esta fusión lo tira: el cobro sale en la pantalla dentro de «Método no registrado» con\n'
    + '  su método guardado en la fila de al lado.');
  assert.notEqual(c.metodoCubo, CUBO_SIN_METODO,
    '🔴 el cobro tiene método y sigue cayendo en el cubo de «sin método»: el filtro no lo separa.');
  // ⚠️ El cubo es `bizum`, NO `bizum_manual`, y es correcto: `CUBO_DE` agrupa `bizum_auto` y
  // `bizum_manual` bajo la misma clave para que pulsar «Bizum» los traiga a los dos. Lo que NO se
  // colapsa es el valor GUARDADO —uno lo confirma una persona y el otro un webhook (`paidVia.ts`)—.
  // Mi primera expectativa era `bizum_manual` y la equivocada era ella, no el código.
  assert.equal(c.metodoCubo, 'bizum',
    `🔴 el cubo no es el esperado: «${c.metodoCubo}».`);

  // Y con pasarela, la agrupación es la del método — no una etiqueta nueva.
  const [conPasarela] = fundir([factura({ paidVia: 'transfer:stripe' })]);
  assert.equal(conPasarela.metodo, 'transfer:stripe', '🔴 se ha perdido la pasarela.');
  assert.equal(conPasarela.metodoCubo, 'transfer',
    '🔴 `transfer:stripe` tiene que agrupar en `transfer`, como cualquier otro cobro.');
});

test('SCRUM-441 (fase 2) · el cubo sale de la MISMA función que los demás, no escrito a mano', () => {
  // Si alguien escribiera el cubo a dedo aquí, dejaría de moverse el día que la clasificación
  // cambie — y esa divergencia no da error, solo un filtro que cuenta mal.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/billing/domain/cobros.service.ts'), 'utf8');
  assert.match(src, /metodo: metodoDeclarado\(inv\.paidVia\),\s*\r?\n\s*\.\.\.camposDeMetodo\(metodoDeclarado\(inv\.paidVia\)\)/,
    '🔴 la factura ya no pasa por `camposDeMetodo`, o no lee `paidVia` a través de '
    + '`metodoDeclarado`. El cubo tiene que salir de la misma función que el de los `Charge`, y el '
    + 'valor crudo tiene que estar normalizado: `?? null` deja pasar la cadena vacía.');
  // Y el comentario viejo no puede seguir afirmando lo contrario: es lo que hizo durar el defecto.
  assert.doesNotMatch(src, /\*\*`Invoice` NO guarda método de cobro\*\*/,
    '🔴 SIGUE EL COMENTARIO QUE AFIRMA QUE `Invoice` NO GUARDA MÉTODO. Era cierto y dejó de serlo; '
    + 'mientras estuvo ahí, nadie miró el `null` a fuego de tres líneas más abajo. Un comentario '
    + 'que envejece mal no rompe nada, y por eso dura.');
});

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-441 (fase 2) · SUELO: la fusión devuelve filas, o no se está midiendo nada', () => {
  const cobros = fundir([factura({ paidVia: 'cash' }), factura({ id: 2 })]);
  assert.equal(cobros.length, 2,
    `🔴 la fusión ha devuelto ${cobros.length} filas de 2: los asserts de arriba estarían pasando `
    + 'sobre una lista vacía.');
  // Control positivo del propio banco: las dos filas se distinguen, así que comparar sus métodos
  // significa algo.
  assert.equal(cobros.filter((c) => c.metodo === 'cash').length, 1);
  assert.equal(cobros.filter((c) => c.metodo === null).length, 1);
});
