// tests/scrum815-disputa-una-sola-vez.test.mjs — SCRUM-815 (efecto ③: la disputa)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA VÍCTIMA VISIBLE, Y ES UNA PERSONA
//
// `charge.dispute.created` manda un WhatsApp al PROFESIONAL —«⚠️ El banco de X ha abierto una
// disputa por N €»— y escribe una fila de línea de tiempo. Ninguno de los dos estaba deduplicado,
// y **Stripe reentrega hasta 3 días**. El profesional recibía el mismo susto una y otra vez.
//
// El censo anterior lo contaba como «1 escritura en BD» porque es un censo de PRIMER NIVEL: mira
// las llamadas de `stripe.routes.ts` y no entra en la función (`docs/master/SCRUM-815.md`, §3 del
// apéndice 815b). Dentro hay dos efectos, y el segundo no es una escritura: es un mensaje.
//
// ── POR QUÉ LA MEMORIA DEL PROCESO NO LO TAPABA ──────────────────────────────────────────────
// `isDuplicateStripeEvent` (`stripe.routes.ts:22`) es un `Set` en memoria del módulo con tope 500.
// Un reinicio, una segunda réplica o 500 eventos después y el evento vuelve a parecer nuevo — que
// es el defecto entero de SCRUM-815. Y el webhook de **Connect** no lo llama siquiera.
// En tres días de reintentos, el proceso se reinicia.
//
// ── EL DOBLE, Y QUÉ NO SE DOBLA ──────────────────────────────────────────────────────────────
// La base y Meta se doblan con el banco que YA existe (`_envio-doblado.mjs`): `require.cache` para
// `prisma` y `WHATSAPP_DRY_RUN=1` + `__waDryRunOutbox` para Meta. En dry-run los senders pasan
// TODOS los guards y sólo se saltan el HTTP. **`handleStripeDispute` entero es código de
// producción sin tocar**, que es justo lo que se mide.
//
// ⛔ Ni una clave. Ni un byte hacia Meta. Ninguna base real: ni producción ni staging.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const TELEFONO_PRO = '+34600000042'; // rango imposible de laboratorio (SCRUM-262)
const EVENTO = 'evt_1TestDisputa815';
const DISPUTA = 'dp_1TestDisputa815';
const INTENT = 'pi_1TestDisputa815';

/**
 * Monta la base doblada para UNA disputa y devuelve el buzón de WhatsApp más el registro de
 * escrituras. `filasEvento` es lo que `event.findMany` devuelve: el ALMACÉN PERSISTENTE que el
 * arreglo consulta. Empieza vacío y se va llenando con lo que el propio código escriba — o sea,
 * **se comporta como una base de verdad entre entregas**, que es lo que un `Set` en memoria no
 * hace cuando el proceso se reinicia.
 */
function bancoDeDisputa({ intentId = INTENT, chargeId = 900, customerId = 55 } = {}) {
  const filasEvento = [];
  const timeline = [];
  const buzon = [];

  inyectarBase({
    'charge.findFirst': (args) => {
      const pedido = args?.where?.intentId;
      if (pedido !== intentId) return null;
      return {
        id: chargeId,
        merchantId: MERCHANT,
        customerId,
        amount: '120.00',
        currency: 'EUR',
        merchant: { id: MERCHANT, name: 'Taller de prueba', whatsappPhone: TELEFONO_PRO },
        customer: { id: customerId, name: 'Cliente de laboratorio' },
      };
    },
    'invoice.findFirst': () => ({ id: 1, number: 'F-2026-001' }),
    'event.findMany': (args) => {
      const c = args?.where?.chargeId;
      const t = args?.where?.type;
      return filasEvento.filter((f) => f.chargeId === c && (!t || f.type === t));
    },
    'event.create': (args) => { filasEvento.push(args.data); return args.data; },
    'customerEvent.create': (args) => { timeline.push(args.data); return args.data; },
  }, ['../dist/modules/payments/disputes.service.js',
      '../dist/modules/system/customerEvents.service.js',
      '../dist/integrations/whatsappNotifications.js']);

  globalThis.__waDryRunOutbox = buzon;
  const { handleStripeDispute } = moduloDeDist('../dist/modules/payments/disputes.service.js');
  assert.equal(typeof handleStripeDispute, 'function',
    '🔴 CIEGO: no se encuentra `handleStripeDispute` en `dist/`. Si se ha movido o renombrado, hay '
    + 'que reapuntar este banco, no borrarlo.');

  return { buzon, timeline, filasEvento, handleStripeDispute };
}

const disputaDe = (id = DISPUTA) => ({
  id,
  payment_intent: INTENT,
  amount: 12000,
  currency: 'eur',
  reason: 'fraudulent',
});

// ═══ ① SUELO — sin esto, «un solo WhatsApp» podría ser «ninguno» ══════════════════════════

test('SCRUM-815 · 🔴 SUELO: UNA entrega manda UN WhatsApp y escribe UNA fila de timeline', async () => {
  const b = bancoDeDisputa();
  await b.handleStripeDispute(disputaDe(), EVENTO);

  assert.equal(b.buzon.length, 1,
    `🔴 CIEGO: una disputa nueva ha producido ${b.buzon.length} WhatsApp. Si el detector no ve `
    + 'NINGUNO, todo lo de abajo —«sale uno», «no sale otro»— se cumpliría sobre un buzón vacío y '
    + 'no mediría nada. El aviso al profesional es el producto, no un detalle.');
  assert.equal(b.timeline.length, 1,
    '🔴 CIEGO: la fila de línea de tiempo no se ha escrito. La ficha del cliente tiene que '
    + 'enterarse de la disputa.');
  assert.match(JSON.stringify(b.buzon), /disputa/i,
    '🔴 el mensaje que sale no habla de una disputa: el buzón está recogiendo otra cosa.');
});

// ═══ ② EL DEFECTO: TRES ENTREGAS DEL MISMO EVENTO ════════════════════════════════════════

test('SCRUM-815 · 🔴 tres entregas del MISMO evento → UN WhatsApp, no tres', async () => {
  const b = bancoDeDisputa();

  // Tres entregas del MISMO evento. Es lo que hace Stripe durante 3 días, y lo que la memoria del
  // proceso deja pasar en cuanto hay un reinicio: cada entrega llega a un `Set` vacío.
  for (let i = 0; i < 3; i += 1) await b.handleStripeDispute(disputaDe(), EVENTO);

  assert.equal(b.buzon.length, 1,
    `🔴 EL PROFESIONAL HA RECIBIDO ${b.buzon.length} WHATSAPP POR LA MISMA DISPUTA. Stripe `
    + 'reentrega el mismo evento hasta 3 días: sin deduplicar en DISCO, cada reintento que cae en '
    + 'un proceso reiniciado vuelve a avisar. Un susto repetido por algo que ya sabe, y encima '
    + 'sobre dinero.');
  assert.equal(b.timeline.length, 1,
    `🔴 la ficha del cliente tiene ${b.timeline.length} filas «disputa abierta» de la misma `
    + 'disputa. Ruido en el sitio donde el profesional mira para entender qué pasó.');
});

// ═══ ③ CONTROL POSITIVO — romperlo por el lado bueno también es romperlo ══════════════════

test('SCRUM-815 · ✅ POSITIVO: dos disputas DISTINTAS siguen avisando DOS veces', async () => {
  const b = bancoDeDisputa();

  await b.handleStripeDispute(disputaDe('dp_primera'), 'evt_primera');
  await b.handleStripeDispute(disputaDe('dp_segunda'), 'evt_segunda');

  assert.equal(b.buzon.length, 2,
    `🔴 dos disputas distintas han producido ${b.buzon.length} aviso(s). La deduplicación se ha `
    + 'comido una disputa REAL: el profesional no se entera de que le han disputado otro cobro. '
    + 'Eso es peor que el defecto que se venía a arreglar — es perder dinero en silencio.');
  assert.equal(b.timeline.length, 2,
    '🔴 la segunda disputa no ha dejado fila en la ficha del cliente.');
});

test('SCRUM-815 · ✅ POSITIVO: la clave es el EVENTO, y se deriva — no se inventa', async () => {
  // Dos entregas del mismo evento con la MISMA disputa no repiten; y el criterio no puede ser
  // «una disputa por charge para siempre»: si Stripe manda otro evento para esa misma charge
  // (otra disputa sobre el mismo cobro), tiene que volver a avisar.
  const b = bancoDeDisputa();
  await b.handleStripeDispute(disputaDe(), EVENTO);
  await b.handleStripeDispute(disputaDe(), EVENTO);
  assert.equal(b.buzon.length, 1, '🔴 el mismo evento ha avisado dos veces.');

  await b.handleStripeDispute(disputaDe('dp_otra'), 'evt_otro_sobre_la_misma_charge');
  assert.equal(b.buzon.length, 2,
    '🔴 una disputa NUEVA sobre la misma charge no avisa. El criterio se ha atado a la charge en '
    + 'vez de al evento, y entonces la segunda disputa de un cobro se pierde.');
});

// ═══ ④ LA MARCA VIVE EN DISCO, NO EN MEMORIA ═════════════════════════════════════════════

test('SCRUM-815 · 🔴 la marca se guarda en la BASE, no en un Map del proceso', async () => {
  // El defecto entero de SCRUM-815 es que la memoria se olvida al reiniciar. Si el arreglo
  // viviera en un `Set`, sería el MISMO defecto una capa más arriba. Aquí se comprueba que la
  // segunda entrega no manda nada **porque lee una fila que la primera dejó escrita**.
  const b = bancoDeDisputa();
  await b.handleStripeDispute(disputaDe(), EVENTO);

  assert.ok(b.filasEvento.length > 0,
    '🔴 la primera entrega no ha dejado NADA en la base. Si la marca no está en disco, el '
    + 'siguiente reinicio vuelve a avisar: es el defecto de este ticket, no su arreglo.');
  assert.ok(JSON.stringify(b.filasEvento).includes(EVENTO),
    '🔴 la fila escrita no lleva el id del evento de Stripe. El criterio tiene que DERIVARSE del '
    + `evento —que es estable entre reintentos— y aquí no aparece: ${JSON.stringify(b.filasEvento)}`);

  // Y ahora se vacía la marca: sin ella, vuelve a avisar. Eso prueba que lo que corta es la fila
  // leída de la base y no un residuo en memoria del módulo.
  b.filasEvento.length = 0;
  await b.handleStripeDispute(disputaDe(), EVENTO);
  assert.equal(b.buzon.length, 2,
    '🔴 con la marca BORRADA de la base sigue sin avisar: entonces lo que corta es memoria del '
    + 'proceso, no la base. Es exactamente el defecto que este ticket viene a quitar.');
});
