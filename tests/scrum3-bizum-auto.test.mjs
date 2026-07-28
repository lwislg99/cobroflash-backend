// SCRUM-3 — Bizum AUTOMÁTICO en el checkout Connect (sin gate: corre en `npm test`, sin BD ni red).
//
// LO QUE HABÍA QUE VERIFICAR ANTES DE CONSTRUIR, y salió que sí: esto NO es infraestructura
// nueva. `payCard.routes.ts:104` ya crea la sesión con `{ stripeAccount }`, que es un DIRECT
// CHARGE sobre la cuenta conectada. No es el caso de SEPA (SCRUM-7), donde había que inventar
// Connect entero. Aquí el andamiaje existe y está en uso.
//
// DOS CORRECCIONES AL ENCUADRE DEL TICKET, verificadas en docs.stripe.com:
//
//   1. No se activa «añadiendo bizum a payment_method_types». Stripe lo desaconseja de forma
//      explícita, y el código YA hace lo recomendado (no pasa `payment_method_types`, o sea
//      dynamic payment methods). Bizum aparecerá solo en cuanto la capability
//      `bizum_payments` esté activa en plataforma y cuenta conectada. Es trabajo de Dashboard.
//   2. Por eso un flag nuestro NO puede impedir que Stripe pinte Bizum en su checkout. El flag
//      gobierna NUESTRA superficie. Decir lo contrario sería una prohibición sin mecanismo.
//
// Y LO QUE PEDÍA EL FUNDADOR COMPROBAR: que el guard de SCRUM-130 (regla 23) aplica también a
// Bizum. **Aplica, y por construcción**: Bizum viaja dentro de la MISMA sesión de checkout, así
// que si `cardChargeDecision` dice 'refuse' no se crea sesión y no hay Bizum que ofrecer. El
// último test de este fichero lo fija para que nadie lo rompa creyendo que son caminos aparte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bizumAutoDisponible,
  BIZUM_MIN_CENTS,
  BIZUM_MAX_CENTS,
} from '../dist/modules/billing/domain/bizumCharge.js';
import { cardChargeDecision } from '../dist/modules/billing/domain/cardCharge.js';
import { FLAG_DEFAULTS } from '../dist/core/flags.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_PAYCARD = path.join(AQUI, '..', 'src', 'modules', 'billing', 'app', 'routes', 'payCard.routes.ts');

const base = { flagOn: true, useConnect: true, currency: 'EUR', amountCents: 10_000 };

// ── 1. Los límites son los de Stripe, no unos inventados ─────────────────────────────────

test('SCRUM-3 · límites exactos de Bizum: 0,50 € a 5.000 €', () => {
  assert.equal(BIZUM_MIN_CENTS, 50);
  assert.equal(BIZUM_MAX_CENTS, 500_000);
  assert.equal(bizumAutoDisponible({ ...base, amountCents: 50 }), 'ok', 'el mínimo entra');
  assert.equal(bizumAutoDisponible({ ...base, amountCents: 49 }), 'importe_bajo');
  assert.equal(bizumAutoDisponible({ ...base, amountCents: 500_000 }), 'ok', 'el máximo entra');
  assert.equal(bizumAutoDisponible({ ...base, amountCents: 500_001 }), 'importe_alto');
});

test('SCRUM-3 · solo EUR', () => {
  assert.equal(bizumAutoDisponible({ ...base, currency: 'eur' }), 'ok', 'minúsculas también');
  assert.equal(bizumAutoDisponible({ ...base, currency: 'MXN' }), 'divisa');
});

test('SCRUM-3 · importes basura no pasan por descuido', () => {
  for (const malo of [NaN, Infinity, -100]) {
    assert.equal(bizumAutoDisponible({ ...base, amountCents: malo }), 'importe_bajo', `${malo}`);
  }
});

// ── 2. El orden de los motivos importa ───────────────────────────────────────────────────

test('SCRUM-3 · sin Connect gana sobre el importe: no se manda a bajar el precio', () => {
  const motivo = bizumAutoDisponible({ ...base, useConnect: false, amountCents: 900_000 });
  assert.equal(
    motivo,
    'sin_connect',
    '🔴 Con un importe fuera de rango Y sin Connect, el motivo tiene que ser `sin_connect`: un ' +
      'merchant sin cuenta conectada no puede cobrar Bizum automático POR REGULACIÓN, no por ' +
      'importe. Decir «importe alto» manda a bajar el precio para arreglar algo que no se arregla así.',
  );
});

test('SCRUM-3 · el flag apagado corta antes que nada', () => {
  assert.equal(bizumAutoDisponible({ ...base, flagOn: false, useConnect: false }), 'flag_off');
});

// ── 3. El flag nace apagado y es PROPIO ──────────────────────────────────────────────────

test('SCRUM-3 · BIZUM_AUTO_ENABLED existe, arranca OFF y no sustituye al manual', () => {
  assert.equal(
    FLAG_DEFAULTS.BIZUM_AUTO_ENABLED,
    false,
    '🔴 un flag de una vía de COBRO que nace encendido suelta dinero real antes de que nadie lo pruebe',
  );
  assert.equal(
    FLAG_DEFAULTS.BIZUM_MANUAL_ENABLED,
    false,
    'el manual sigue existiendo y aparte: son dos vías con coste distinto (el manual es gratis)',
  );
});

// ── 4. LA COMPROBACIÓN QUE PIDIÓ EL FUNDADOR: la regla 23 cubre Bizum ────────────────────
//
// No hay un guard nuevo para Bizum, y es correcto que no lo haya: Bizum viaja DENTRO de la
// misma `checkout.sessions.create` que la tarjeta, así que hereda su gate. Lo que hay que
// impedir es que alguien, mañana, le dé a Bizum un camino propio que se salte esa puerta.

test('SCRUM-3 · un merchant sin Connect y no-demo no llega a crear sesión: tampoco hay Bizum', () => {
  assert.equal(cardChargeDecision({ useConnect: false, isDemo: false }), 'refuse');
  assert.equal(
    bizumAutoDisponible({ ...base, useConnect: false }),
    'sin_connect',
    '🔴 Las dos capas tienen que decir lo mismo: si la tarjeta se rechaza por regla 23, Bizum ' +
      'automático tampoco puede ofrecerse. Dinero de clientes finales en la cuenta de plataforma ' +
      'es un problema regulatorio, y a Stripe le da igual qué método lo trajo.',
  );
});

test('SCRUM-3 · Bizum no tiene camino propio: sigue dentro de la sesión ya gateada', () => {
  const fuente = fs.readFileSync(RUTA_PAYCARD, 'utf8');

  assert.ok(
    fuente.includes("cardChargeDecision") && fuente.includes("mode === 'refuse'"),
    '🔴 el guard de SCRUM-130 ya no corta antes de crear la sesión',
  );
  assert.ok(
    !/payment_method_types/.test(fuente),
    '🔴 ha aparecido `payment_method_types` en el checkout. Stripe lo desaconseja de forma ' +
      'explícita («Don\'t pass payment_method_types… use dynamic payment methods») y además ' +
      'congelaría la lista: cualquier método futuro dejaría de mostrarse hasta que alguien ' +
      'se acordara de añadirlo aquí. Bizum se enciende con la capability, no con esta lista.',
  );
  assert.ok(
    /stripeAccount: merchant!\.stripeAccountId!/.test(fuente),
    '🔴 la sesión ya no se crea sobre la cuenta conectada. Con un cargo que no sea DIRECTO, el ' +
      'descriptor del extracto pasa a ser el de la PLATAFORMA — YaQu apareciendo como comercio ' +
      'en el banco del cliente final (tabla de tipos de cargo de la doc de Bizum, y regla 23).',
  );
});
