// SCRUM-3 (segunda mitad) — el selector W4 con las DOS vías de Bizum (sin gate: solo lee
// ficheros y llama a una función pura; ni BD ni red).
//
// DECISIÓN DEL FUNDADOR (28-jul-2026): **los dos visibles, el manual primero.** No se decide
// por el fontanero si prefiere ahorrarse el 0,9 % o tener confirmación automática — es su
// dinero y su tiempo. El manual va delante porque es gratis y es el que ya conoce; el
// automático se etiqueta con su ventaja real, «se confirma solo», que es justo lo que el
// manual no puede garantizar.
//
// LOS TRAMOS DE W4 NO CAMBIAN (SCRUM-8) y esa es la parte contraintuitiva: Stripe admite Bizum
// hasta 5.000 €, pero el techo de 1.000 € **no lo pone Stripe, lo pone el banco DEL PAGADOR**
// (500-1.000 €/operación, 2.000 €/día). Subirlo pondría delante del cliente un método que su
// banco va a rechazar, después de haberlo elegido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { bizumAutoDisponible } from '../dist/modules/billing/domain/bizumCharge.js';
import { FLAG_DEFAULTS } from '../dist/core/flags.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const SELECTOR = fs.readFileSync(
  path.join(RAIZ, 'src', 'modules', 'billing', 'app', 'routes', 'payInvoice.routes.ts'),
  'utf8',
);
const WEBHOOK = fs.readFileSync(
  path.join(RAIZ, 'src', 'modules', 'payments', 'connect', 'connectWebhook.routes.ts'),
  'utf8',
);

// ── 1. EL ACOPLAMIENTO QUE IMPIDE SOLTAR DATOS FALSOS ────────────────────────────────────
//
// Encontrado al construir esto: `connectWebhook.routes.ts` manda `method: 'card'` A FUEGO en
// `checkout.session.completed`, sin mirar con qué pagó el cliente. Hoy no miente porque ese
// checkout solo acepta tarjeta — pero el Bizum automático entra POR ESE MISMO checkout. El día
// que la capability `bizum_payments` se active, todo Bizum quedaría registrado como tarjeta:
// no es un fallo por omisión, es **atribución falsa**, que es peor porque el dato existe,
// parece bueno y es mentira. Arrastra al CSV de exportación (columna «Método (paid_via)», el
// paquete que va al asesor o a una inspección) y al desglose de métricas. Rompe la regla 22.
//
// El arreglo técnico son tres líneas —la sesión trae `payment_method_types`— pero **el VALOR a
// escribir no es decisión de código**: la regla 22 enumera un conjunto CERRADO
// (`card/bizum_manual/transfer/cash`) y un Bizum automático no es ninguno de los cuatro.
// Añadir `bizum_auto` es cambio de máster (reglas 5 y 27).
//
// Así que mientras el webhook mienta, el flag NO puede encenderse. Esto lo convierte de nota
// en mecanismo: el peligro real empezaba con un clic en el Dashboard de Stripe, que no pasa
// por este repo y que ningún código habría visto venir.

test('SCRUM-3 · el flag de Bizum automático no puede encenderse mientras el webhook mienta', () => {
  const webhookMienteConMetodo = /method:\s*'card'/.test(WEBHOOK);

  if (webhookMienteConMetodo) {
    assert.equal(
      FLAG_DEFAULTS.BIZUM_AUTO_ENABLED,
      false,
      '🔴 BIZUM_AUTO_ENABLED está ON y `connectWebhook.routes.ts` sigue mandando ' +
        "`method: 'card'` a fuego. Todo cobro por Bizum entraría registrado como TARJETA: " +
        'el CSV que se entrega al asesor y las métricas dirían tarjeta donde hubo Bizum ' +
        '(regla 22, `paid_via` en el 100 % de los cobros). Arregla el webhook ANTES de ' +
        'encender el flag — y antes de eso hace falta la decisión del fundador sobre qué ' +
        'valor lleva un Bizum automático (el conjunto de la regla 22 es cerrado). ' +
        'Registrado en docs/BUGS.md como P1-BIZUM-PAIDVIA.',
    );
  } else {
    // El webhook ya lee el método de verdad: este acoplamiento sobra y debe retirarse a mano
    // (con su entrada de BUGS.md marcada), no quedarse aquí dando falsa sensación de vigilancia.
    assert.ok(
      true,
      'El webhook ya no fija el método a fuego: retira este test y cierra P1-BIZUM-PAIDVIA.',
    );
  }
});

// ── 2. Orden y etiquetas: la decisión del fundador, fijada ───────────────────────────────

test('SCRUM-3 · el manual va primero y el automático justo detrás', () => {
  const iManual = SELECTOR.indexOf("key: 'bizum'");
  const iAuto = SELECTOR.indexOf("key: 'bizum_auto'");
  assert.ok(iAuto !== -1, '🔴 la vía automática ha desaparecido del selector');
  assert.ok(
    SELECTOR.includes("mm.key === 'bizum' ? [mm, bizumAuto]"),
    '🔴 el automático ya no se inserta INMEDIATAMENTE detrás del manual. La decisión era ' +
      '«los dos visibles, manual primero»: si se separan, el cliente ve dos Bizum lejos el uno ' +
      'del otro y parecen métodos distintos en vez de dos formas de lo mismo.',
  );
  assert.ok(iManual !== -1);
});

// Se miran los literales `title:`/`sub:` —el texto que LEE EL CLIENTE— y no el fichero entero.
// Primera versión miraba el fuente completo y salió roja por el «0,9 %» de un COMENTARIO que
// explica el razonamiento. Es el bug de SCRUM-176 otra vez: un guard sobre texto falla en la
// prosa que describe la regla. Aquí además apuntar al texto renderizado es lo correcto de por
// sí — lo que no puede hablar del fee es la pantalla, no el código.
const TEXTOS_AL_CLIENTE = [...SELECTOR.matchAll(/\b(?:title|sub):\s*'([^']*)'/g)].map((m) => m[1]);

test('SCRUM-3 · el automático se etiqueta por su ventaja real, no por el fee', () => {
  assert.ok(
    TEXTOS_AL_CLIENTE.some((t) => /se confirma solo/i.test(t)),
    '🔴 falta la etiqueta «se confirma solo». Es la ventaja REAL del automático y justo lo que ' +
      'el manual no puede garantizar — el manual lo confirma el merchant a mano.',
  );
  const conFee = TEXTOS_AL_CLIENTE.filter((t) => /\d[,.]\d\s*%|comisi[óo]n|fee/i.test(t));
  assert.deepEqual(
    conFee,
    [],
    `🔴 el selector le habla al PAGADOR del fee (${conFee.join(' · ')}). La regla 22 ordena por ` +
      'probabilidad de cobro del MERCHANT, no por el fee de YaQu; y el coste lo paga el ' +
      'merchant, así que en la pantalla del cliente no pinta nada.',
  );
});

// ── 3. Los tramos de W4 siguen intactos ──────────────────────────────────────────────────

test('SCRUM-3 · el techo sigue en 1.000 €, no en los 5.000 de Stripe', () => {
  assert.ok(
    /amountNum <= 1000/.test(SELECTOR),
    '🔴 ha desaparecido el tope de 1.000 € del Bizum manual (W4)',
  );
  // Y la función de dominio no lo contradice: su 5.000 es el límite de STRIPE, no el del banco
  // del pagador. Quien decide qué se enseña es W4, que es más restrictivo a propósito.
  assert.equal(
    bizumAutoDisponible({ flagOn: true, useConnect: true, currency: 'EUR', amountCents: 300_000 }),
    'ok',
    'a nivel Stripe 3.000 € es válido…',
  );
  assert.ok(
    /amountNum <= 500 \? \[bizum, card, transfer\] : \[card, bizum, transfer\]/.test(SELECTOR),
    '🔴 …pero los TRAMOS de W4 mandan sobre lo que se pinta, y no han cambiado',
  );
});

// ── 4. El automático no se cuela donde el PRO limitó los métodos ─────────────────────────

test('SCRUM-3 · si el PRO limitó los métodos, el automático hereda el permiso de «bizum»', () => {
  assert.ok(
    /mm\.key === 'bizum_auto' && permits\('bizum'\)/.test(SELECTOR),
    '🔴 el automático debe pedir permiso como «bizum»: el PRO limitó Bizum como método de ' +
      'cobro, no la fontanería de cómo se confirma. Con un permiso propio, un cobro donde el ' +
      'PRO quitó Bizum lo seguiría ofreciendo por la puerta de al lado.',
  );
});
