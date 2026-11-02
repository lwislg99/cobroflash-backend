// SCRUM-115 — un envío de WhatsApp que NO llega a Meta (guard, credencial, error de API)
// antes desaparecía sin dejar rastro: sendWhatsAppTemplate solo llamaba a recordWaMessage
// (WA-0b) en el camino de ÉXITO, y sendWhatsAppText no lo llamaba nunca. El front podía
// arreglarse para leer bien `ok`/`sent`, pero el título del ticket ("el fallo no se
// registra en ningún sitio") seguía siendo cierto: nada quedaba para consultar más allá
// de un console.error o un toast que desaparece en unos segundos.
//
// Este test fija que un guard bloqueado deja una fila `status:'failed'` en WA-0b, Y que
// esa fila tiene `waMessageId: null` — la señal que usan los topes A3.2/J6 para NO contar
// intentos que nunca llegaron a Meta como si hubieran consumido cupo/gasto.
//
// ── SCRUM-250 · POR QUÉ YA NO SE SONDEA LA TABLA ─────────────────────────────
// Estos dos subtests esperaban la fila con un bucle de 30 × 100 ms. `recordWaMessage` se
// llamaba SIN `await` (la fila de un fallo se espera desde SCRUM-1631; la de lo que salió, no), así
// que el INSERT podía aterrizar después de esos 3 s bajo contención del pool de staging —
// el mismo retraso que deja huérfanas en SCRUM-194. Resultado: cayó en dos tandas y no cayó
// en la tercera CON EL MISMO CÓDIGO. La variable era la latencia, no el diff.
//
// Subir el sondeo habría escondido la carrera. Lo que se hace es esperar A LA PROMESA que
// producción ya crea y tira: `interceptarWaLog` la recoge desde fuera (envuelve, no
// sustituye) sin tocar una línea de `src/`. El detalle, en `tests/_wa-log-sync.mjs`.
//
// ⚠️ Toca BD real (staging), gateado:
//   QA_DB_TEST=1 WHATSAPP_DRY_RUN=1 DATABASE_URL_TESTS="..." npm run test:staging
import './_staging-db.mjs';
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-1599p: segundo destino (LIBRO_PG_URL), inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import { withMerchant, registrarBarridoFinal } from './_merchant-fixture.mjs';
import { interceptarWaLog } from './_wa-log-sync.mjs';
import { cortarSalida } from './_sin-salida.mjs'; // SCRUM-1599p: el hecho, no la bandera (forma de SCRUM-876g)

const CON_BANCO = URL_BANCO !== '';
const ENABLED = process.env.QA_DB_TEST === '1' || CON_BANCO;

// SCRUM-1599p · con el banco como destino este fichero corre en la tanda de CI, y CI no trae
// credenciales de WhatsApp: sin la bandera, los dos envíos cortan en `not_configured` ANTES de
// llegar a la regla que se vigila (medido en el job 121893679905 de #2900). La bandera es el modo
// de pruebas del propio sender (pasa TODAS las reglas y no llama a Meta), no una credencial falsa;
// el sender la lee en cada envío (`scrum876f-el-seco-se-decide-al-enviar`). Y lo que decide no es
// la bandera: se corta toda conexión que no sea de esta máquina, con su control positivo delante.
if (CON_BANCO) process.env.WHATSAPP_DRY_RUN = '1';
async function sinSalidaConBanco(t) {
  if (!CON_BANCO) return;
  assert.equal(process.env.WHATSAPP_DRY_RUN, '1', 'con el banco, este test exige WHATSAPP_DRY_RUN=1');
  const corte = cortarSalida();
  await corte.controlPositivo();
  t.after(() => {
    const ajenos = corte.ajenos();
    corte.restaurar();
    assert.equal(corte.controlado, true, '🔴 CIEGO: el corte de salida no pasó su control');
    assert.deepEqual(ajenos, [], '🔴 el test INTENTÓ salir de esta máquina con WHATSAPP_DRY_RUN=1 y el banco como destino');
  });
}

/** El objeto `exports` REAL del módulo de log — el mismo que lee `whatsapp.js` en cada llamada. */
async function moduloDeLog() {
  return (await import('../dist/modules/messaging/domain/whatsappLog.service.js')).default;
}

test('SCRUM-115: sendWhatsAppTemplate bloqueado por wa_opt_out registra status:failed en WA-0b (waMessageId null)', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
  await sinSalidaConBanco(t);
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { sendWhatsAppTemplate } = await import('../dist/integrations/whatsapp.js');
  const log = await moduloDeLog();

  await withMerchant(prisma, { name: 'QA SCRUM-115', email: `qa-scrum115-${Date.now()}@test.local` }, async (merchant) => {
    const phone = '34600000088';
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'Cliente opt-out', phone, waOptOut: true },
    });

    const t0 = new Date();
    const wa = interceptarWaLog({ log, prisma });
    let row = null;
    try {
      const result = await sendWhatsAppTemplate({
        to: phone,
        templateName: 'payment_request_es',
        merchantId: merchant.id,
        log: { customerId: customer.id, relatedType: 'invoice', relatedId: 999 },
      });

      assert.equal(result.ok, false);
      assert.equal(result.reason, 'wa_opt_out');

      // SCRUM-250: el punto de sincronización. Resuelve cuando la escritura TERMINA, no
      // cuando lo dice un reloj. La promesa ya está registrada aquí: `logFailure()` está en
      // el camino hacia el `return` del envío que acabamos de esperar.
      await wa.esperar();

      row = await prisma.whatsAppMessage.findFirst({
        where: { merchantId: merchant.id, customerId: customer.id, createdAt: { gte: t0 } },
      });
    } finally {
      wa.restaurar();
    }

    // `wa.explicar` añade el motivo REAL si la escritura falló (p. ej. P2024 del pool), que
    // `recordWaMessage` se traga por diseño. Sin esto el rojo solo diría "no hay fila".
    assert.ok(row, wa.explicar('debe quedar una fila en WA-0b para el intento bloqueado'));
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'wa_opt_out');
    assert.equal(row.type, 'template');
    assert.equal(row.relatedType, 'invoice');
    assert.equal(row.relatedId, 999);
    assert.equal(row.waMessageId, null, 'sin waMessageId: nunca llegó a Meta, así que no debe consumir el tope A3.2/J6');
  });
});

test('SCRUM-115: sendWhatsAppText bloqueado (demo fuera de DEMO_SAFE_NUMBERS) registra status:failed en WA-0b', { skip: !ENABLED && 'sin QA_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
  await sinSalidaConBanco(t);
  const { prisma } = await import('../dist/core/db/prisma.js');
  registrarBarridoFinal(prisma);
  const { sendWhatsAppText } = await import('../dist/integrations/whatsapp.js');
  const log = await moduloDeLog();

  const DEMO_MERCHANT_ID = 1; // regla 8
  const phone = '34600000099'; // deliberadamente fuera de cualquier DEMO_SAFE_NUMBERS razonable
  const t0 = new Date();

  const wa = interceptarWaLog({ log, prisma });
  let row = null;
  try {
    const result = await sendWhatsAppText({
      to: phone,
      text: 'SCRUM-115 test — no debe salir de verdad (bloqueado por V0-2)',
      merchantId: DEMO_MERCHANT_ID,
      log: { relatedType: 'invoice', relatedId: 999 },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'demo_safe_numbers');

    await wa.esperar(); // SCRUM-250: ver el subtest de arriba

    row = await prisma.whatsAppMessage.findFirst({
      where: { merchantId: DEMO_MERCHANT_ID, relatedType: 'invoice', relatedId: 999, createdAt: { gte: t0 } },
    });

    assert.ok(row, wa.explicar('debe quedar una fila en WA-0b para el intento bloqueado'));
    assert.equal(row.status, 'failed');
    assert.equal(row.error, 'demo_safe_numbers');
    assert.equal(row.type, 'service');
    assert.equal(row.waMessageId, null);
  } finally {
    wa.restaurar();
    // La fila es del merchant DEMO (id=1), que ningún barrido toca: se limpia aquí o se queda.
    if (row) await prisma.whatsAppMessage.delete({ where: { id: row.id } }).catch(() => {});
  }
});

// SCRUM-1599p (diseño B de SCRUM-1599) · la mutación que tumba el caso de base, CATALOGADA en SCRUM-1599p.
// Va aparte de `MUTACIONES_QUE_ME_TUMBAN` a propósito: el job del meta-guard corre SIN base, el caso sale
// SALTADO en su pasada limpia y eso es CIEGO (PUERTA 1a), no un veredicto. La ejecuta, con el banco,
// `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs` (forma de SCRUM-1390e). Cada campo, LITERAL.
export const MUTACIONES_CON_BASE = [
  { fichero: "src/integrations/whatsapp.ts", de: "      type: 'template',\n      templateName: params.templateName,\n      status: 'failed',", a: "      type: 'template',\n      templateName: params.templateName,\n      status: 'sent',", cae: "SCRUM-115: sendWhatsAppTemplate bloqueado" },
];
