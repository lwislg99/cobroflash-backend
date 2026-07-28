// SCRUM-191 — `paid_via` dice con qué se pagó DE VERDAD (sin gate: pura, ni BD ni red).
//
// EL BUG: `connectWebhook.routes.ts` mandaba `method: 'card'` a fuego en
// `checkout.session.completed`. No fallaba mientras ese Checkout solo aceptase tarjeta — pero
// el Bizum automático entra por el MISMO checkout (SCRUM-3), así que en cuanto la capability
// `bizum_payments` se activase, todo Bizum habría quedado registrado como TARJETA.
//
// No es fallo por omisión: es **atribución falsa**. El dato existe, parece bueno y miente — y
// viaja a la columna «Método (paid_via)» del CSV que se entrega al asesor o a una inspección.
//
// DECISIÓN DEL FUNDADOR: se añade `bizum_auto` al conjunto cerrado de la regla 22.
// `bizum_manual` sería falso (nadie confirmó a mano) y `card` es el bug. **Y la distinción
// importa fiscalmente: uno lo confirma una PERSONA, el otro un WEBHOOK** — dos cadenas de
// evidencia distintas ante una inspección.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { paidViaDesdeStripe, esPaidViaValido, PAID_VIA } from '../dist/modules/billing/domain/paidVia.js';
import { leerFuente } from './_guard-texto.mjs'; // SCRUM-193: leer YA filtrado es el camino corto

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const WEBHOOK = leerFuente(
  path.join(RAIZ, 'src', 'modules', 'payments', 'connect', 'connectWebhook.routes.ts'),
  'utf8',
);
const MASTER = fs.readFileSync(path.join(RAIZ, 'docs', 'YAQU_MASTER.md'), 'utf8');

// ── 1. La traducción ─────────────────────────────────────────────────────────────────────

test('SCRUM-191 · un pago con Bizum NO se registra como tarjeta', () => {
  assert.equal(
    paidViaDesdeStripe('bizum'),
    'bizum_auto',
    '🔴 EL BUG ORIGINAL. Un Bizum registrado como otra cosa mete un dato falso en el CSV que ' +
      'se entrega al asesor fiscal o a una inspección.',
  );
  assert.equal(paidViaDesdeStripe('card'), 'card');
  assert.equal(paidViaDesdeStripe('CARD'), 'card', 'insensible a mayúsculas y espacios');
  assert.equal(paidViaDesdeStripe(' bizum '), 'bizum_auto');
});

test('SCRUM-191 · lo desconocido devuelve null: NO se inventa un valor de repuesto', () => {
  for (const raro of ['ideal', 'sepa_debit', '', null, undefined, 'paypal']) {
    assert.equal(
      paidViaDesdeStripe(raro),
      null,
      `🔴 «${raro}» produjo un valor. Cambiar «asumo tarjeta» por «asumo otra cosa» es el ` +
        `mismo bug con otro disfraz: ante lo desconocido, no se toca el método del cobro.`,
    );
  }
});

test('SCRUM-191 · el conjunto cerrado de la regla 22, con bizum_auto dentro', () => {
  assert.deepEqual([...PAID_VIA].sort(), ['bizum_auto', 'bizum_manual', 'card', 'cash', 'transfer']);
  assert.ok(esPaidViaValido('bizum_auto'));
  assert.equal(esPaidViaValido('bizum'), false, 'el valor de Stripe no es nuestro vocabulario');
  assert.equal(esPaidViaValido('tarjeta'), false);
});

test('SCRUM-191 · el máster y el código dicen lo mismo', () => {
  for (const via of PAID_VIA) {
    assert.ok(
      MASTER.includes(via),
      `🔴 «${via}» está en el código y no en la regla 22 del máster. El conjunto es CERRADO: ` +
        `si divergen, el código deja de estar autorizado por el máster (reglas 5 y 35).`,
    );
  }
});

// ── 2. El webhook dejó de mentir ─────────────────────────────────────────────────────────
//
// Se mira SOLO el código ejecutable (principio 10 de SUITE_REGRESION.md, adoptado hoy): los
// comentarios de este mismo webhook contienen el literal `method: 'card'` a propósito, para
// explicar qué se arregló. Un guard que barriera el fichero entero se cazaría a sí mismo —
// que es exactamente el fallo que se repitió tres veces esta sesión.

test('SCRUM-191 · el webhook ya no fija el método a fuego', () => {
  const codigo = WEBHOOK;
  assert.ok(
    !/method:\s*'card'/.test(codigo),
    "🔴 ha vuelto `method: 'card'` a fuego en el webhook de Connect. Todo cobro por Bizum " +
      'volvería a registrarse como tarjeta.',
  );
  assert.ok(
    /paidViaDesdeStripe\(/.test(codigo),
    '🔴 el webhook ya no traduce el método real de Stripe',
  );
  assert.ok(
    /payment_method_details/.test(codigo),
    '🔴 el método debe salir de `payment_method_details.type` del cargo. `payment_method_types` ' +
      'de la sesión NO vale: con dynamic payment methods dice lo que se OFRECIÓ, no lo que se usó.',
  );
});

test('SCRUM-191 · si no se puede resolver el método, se omite en vez de inventarlo', () => {
  const codigo = WEBHOOK;
  assert.ok(
    /\.\.\.\(metodo \? \{ method: metodo \} : \{\}\)/.test(codigo),
    '🔴 el `method` debe omitirse cuando no se resolvió, para que /webhooks/psp conserve el que ' +
      'ya tenía el cobro (`body.method ?? charge.method`). El cobro se confirma igual; lo que ' +
      'no se toca es la atribución. Mejor sin dato que con un dato falso.',
  );
});

// ── 3. El acoplamiento de SCRUM-3, que se QUEDA ──────────────────────────────────────────
//
// El fundador pidió mantenerlo: ahora el webhook ya no miente, así que el flag PUEDE
// encenderse — pero el guard sigue vigilando por si alguien vuelve a fijar el método a fuego
// mañana. Ya no bloquea nada hoy; bloquea la reincidencia.

test('SCRUM-191 · el acoplamiento flag↔webhook sigue en pie', () => {
  // SCRUM-193: también filtrado. Si 'BIZUM_AUTO_ENABLED' solo apareciera en un COMENTARIO de
  // ese test, este assert habría dado por vivo un acoplamiento retirado — verde falso.
  const acopl = leerFuente(path.join(AQUI, 'scrum3b-selector-bizum.test.mjs'));
  assert.ok(
    acopl.includes('BIZUM_AUTO_ENABLED'),
    '🔴 se ha retirado el acoplamiento entre el flag y el webhook. Mientras exista la ' +
      'posibilidad de volver a fijar el método a fuego, ese guard es lo que impide encender ' +
      'el flag encima de datos falsos.',
  );
});
