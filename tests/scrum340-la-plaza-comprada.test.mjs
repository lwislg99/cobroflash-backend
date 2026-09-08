// tests/scrum340-la-plaza-comprada.test.mjs — SCRUM-340
//
// Sin gate: la regla es PURA. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUIÉN OCUPA UNA PLAZA DE FUNDADOR — la regla firmada, con sus dos rojos
//
// DECISIÓN DEL FUNDADOR (8-sep-2026), literal:
//
//   «la plaza se queda con él; si se retrasa en un pago tiene un tiempo para pagarla, y si no,
//    esa plaza desaparece con el merchant».
//
// ⇒ Ocupa quien tiene `founding_purchased_at` NOT NULL. Y punto. Cancelar no libera; `past_due`
// no libera; la plaza sólo desaparece con el merchant.
//
// ── LOS DOS CRITERIOS QUE ESTO SUSTITUYE, Y POR QUÉ NINGUNO VALÍA ────────────────────────────
//
//   · por `plan: 'founding'` (lo que hay en `main`) → el webhook devuelve `plan` a `'trial'` al
//     cancelar (`stripe.routes.ts:138,151`), así que LIBERABA la plaza. Contradice la firma.
//   · por el ESTADO (`active`/`past_due`, lo que proponía la rama `scrum-340-contador-plazas-
//     reales`) → el webhook escribe `subscriptionStatus: 'active'` para `pro` y para `founding`
//     por igual (`:77`), así que **cada suscriptor PRO activo ocupaba una plaza de fundador**.
//     Medido el 8-sep-2026 ejecutando su predicado: `{active}` de un PRO y `{active}` de un
//     fundador son LA MISMA ENTRADA, porque el predicado no recibía el plan.
//
// Ése segundo es el bug de SCRUM-327 —prueba social sobre gente que no compró esa plaza—
// entrando por la otra puerta, y por eso el control de abajo es obligatorio y no decorativo.
//
// 🛑 ESTA REGLA TODAVÍA NO CUENTA NADA. `getFoundingStatus` sigue con `PLAZA_OCUPADA` hasta que
// exista `merchants.founding_purchased_at` — el ALTER está escrito y SIN APLICAR en
// `docs/sql/scrum-340-la-plaza-comprada.sql`, y `prisma/schema.prisma` es del fundador. Este
// fichero vigila la REGLA; el día del cableado hará falta además un test del CONTADOR.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.join(import.meta.dirname, '..');
const { plazaOcupada } = await import(
  pathToFileURL(path.join(RAIZ, 'dist', 'modules', 'billing', 'domain', 'founding.js')).href);

const AYER = new Date('2026-09-07T10:00:00Z');

test('SCRUM-340 · SUELO: el predicado existe y sabe decir que SÍ y que NO', () => {
  assert.equal(typeof plazaOcupada, 'function', '🔴 la regla no está: el resto pasaría vacío');
  assert.equal(plazaOcupada({ foundingPurchasedAt: AYER }), true);
  assert.equal(plazaOcupada({ foundingPurchasedAt: null }), false);
  // Sin las dos respuestas, un predicado que conteste siempre lo mismo pasaría los tests de abajo.
});

test('SCRUM-340 · 🔴 EL CONTROL QUE DECIDE: un suscriptor PRO activo NO ocupa plaza de fundador', () => {
  // El PRO paga: tiene `subscriptionStatus: 'active'` (`stripe.routes.ts:77`, el mismo que el
  // fundador). Lo que NO tiene es fecha de compra de la plaza.
  const proActivo = { foundingPurchasedAt: null, subscriptionStatus: 'active', plan: 'pro' };
  assert.equal(
    plazaOcupada(proActivo), false,
    '🔴 UN SUSCRIPTOR PRO ESTÁ OCUPANDO UNA PLAZA DE FUNDADOR. Es el bug de SCRUM-327 por la otra '
    + 'puerta: la landing diría «quedan 18 de 20» porque dos personas compraron PRO. El criterio '
    + 'ha vuelto a mirar el ESTADO, que es común a los dos planes, en vez de la fecha de compra.',
  );

  // Y el fundador, con el MISMO estado, sí ocupa. Las dos filas sólo se diferencian en la fecha:
  // si el predicado las tratara igual, es que no la está mirando.
  const fundadorActivo = { foundingPurchasedAt: AYER, subscriptionStatus: 'active', plan: 'founding' };
  assert.equal(plazaOcupada(fundadorActivo), true,
    '🔴 el fundador que paga tiene que ocupar su plaza');
});

test('SCRUM-340 · la plaza NO se libera: ni al cancelar, ni con un cobro fallido', () => {
  // Cancelar: el webhook deja `plan: 'trial'` y `subscriptionStatus: 'canceled'` — y la fecha se
  // queda. Es la firma del fundador: «la plaza se queda con él».
  assert.equal(
    plazaOcupada({ foundingPurchasedAt: AYER, subscriptionStatus: 'canceled', plan: 'trial' }), true,
    '🔴 CANCELAR HA LIBERADO LA PLAZA. Es exactamente lo que hacía el criterio por `plan`, que '
    + 'vuelve a `trial` al cancelar. La plaza sólo desaparece con el merchant.',
  );
  assert.equal(
    plazaOcupada({ foundingPurchasedAt: AYER, subscriptionStatus: 'past_due', plan: 'founding' }), true,
    '🔴 UN COBRO FALLIDO HA LIBERADO LA PLAZA. «Si se retrasa en un pago tiene un tiempo para '
    + 'pagarla»: `past_due` es alguien que compró y va retrasado, no alguien que se fue.',
  );
});

test('SCRUM-340 · quien NUNCA compró no ocupa, diga lo que diga el resto de la fila', () => {
  // El campo `plan` suelto no acredita nada: se asigna a mano y por seed. Era el bug de origen.
  assert.equal(plazaOcupada({ foundingPurchasedAt: null, plan: 'founding' }), false,
    '🔴 el CAMPO `plan` vuelve a ocupar plaza por sí solo: es el bug de origen de SCRUM-327/330');
  assert.equal(plazaOcupada({ foundingPurchasedAt: null, subscriptionStatus: null, plan: 'trial' }), false);
});

test('SCRUM-340 · ⛔ el predicado NO lee `plan` ni `subscriptionStatus` — son OTRA columna', () => {
  // La regla completa cabe en una pregunta, y este test lo comprueba por COMPORTAMIENTO: dos filas
  // con la misma fecha y estados/planes opuestos tienen que dar lo mismo. Si difirieran, el
  // criterio habría vuelto a mezclar «qué compró» con «si sigue pagando».
  const conFecha = (extra) => plazaOcupada({ foundingPurchasedAt: AYER, ...extra });
  const veredictos = new Set([
    conFecha({ plan: 'trial', subscriptionStatus: 'canceled' }),
    conFecha({ plan: 'founding', subscriptionStatus: 'active' }),
    conFecha({ plan: 'pro', subscriptionStatus: 'past_due' }),
    conFecha({}),
  ]);
  assert.deepEqual([...veredictos], [true],
    '🔴 el veredicto CAMBIA con `plan` o `subscriptionStatus`. La fecha de compra es lo único que '
    + 'decide; las otras dos columnas contestan otra pregunta y volver a mezclarlas es el defecto '
    + 'que este ticket cierra.');

  const sinFecha = (extra) => plazaOcupada({ foundingPurchasedAt: null, ...extra });
  const veredictosSin = new Set([
    sinFecha({ plan: 'founding', subscriptionStatus: 'active' }),
    sinFecha({ plan: 'pro', subscriptionStatus: 'active' }),
    sinFecha({}),
  ]);
  assert.deepEqual([...veredictosSin], [false], '🔴 sin fecha de compra, nada puede ocupar plaza');
});
