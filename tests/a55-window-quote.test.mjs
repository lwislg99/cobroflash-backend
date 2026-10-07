// A5.5 — Ciclo cero-plantillas: si el cliente ACABA de escribirnos (ventana de
// 24 h abierta, p. ej. solicitud del bot), el envío del presupuesto sale como
// TEXTO de sesión (type:'service', 0 €) y NO como plantilla quote_decision_es.
//
// ── CÓMO SE EJECUTA (SCRUM-157 / 159 / 166) ──────────────────────────────────
// Corre por `npm run test:staging:gated` — el runner `scripts/staging-gated.mjs`
// (SCRUM-157) setea A55_DB_TEST=1 + WHATSAPP_DRY_RUN=1 en su hijo aislado. NO corre por
// `npm run test:staging` (rutina, sin ese gate hasta que mergee la unificación de SCRUM-166).
// En `npm test` sin banco aparece como SKIP y no toca nada; con `LIBRO_PG_URL` (la tanda de CI)
// corre contra el banco desechable: ver SCRUM-876f, justo encima de los imports.
//
// ── SCRUM-159 (①): fixture EFÍMERO propio ────────────────────────────────────
// Esta prueba estuvo ROJA hasta SCRUM-159 porque hacía findFirst de un cliente del seed demo
// id=1, que SCRUM-42 quemó (lo dejó como placeholder inerte). Por eso ahora crea su propio
// merchant + cliente EFÍMEROS (withMerchant): no depende del seed, no toca seed-staging.mjs
// (el id=1 sigue quemado) y sobrevive a un reset de staging. El merchant efímero NO es el demo,
// así que el lock V0-2 no aplica y ya NO hace falta DEMO_SAFE_NUMBERS (el runner sigue
// pasándolo; queda inerte). Lo que A5.5 prueba —ventana vs plantilla— es agnóstico al merchant;
// la demo-ness era fricción heredada, no lo que se verifica.
//
// ⚠️ LIMPIEZA (SCRUM-159): esta prueba escribe `whatsAppMessage` (WA-0b), tabla SIN FK. El
// borrado por merchantId de withMerchant la barre, pero un fallo sería MUDO (principio
// FK-Restrict, docs/QA/SUITE_REGRESION.md). Por eso la limpieza va en finally/withMerchant y
// la contraprueba es un CONTEO que GRITA tras el borrado, no un assert (que en un finally
// enmascararía el error real del test).
//
// ── SCRUM-876f: SEGUNDO DESTINO, el banco desechable de `LIBRO_PG_URL` ───────────────────────
// Con `A55_DB_TEST=1` nada cambia: staging, y `WHATSAPP_DRY_RUN=1` lo pone quien lanza. Sin ese
// gate y con `LIBRO_PG_URL` (lo que hay en la tanda de CI), corre contra el banco, y ahí:
//   1) el fichero SE PONE `WHATSAPP_DRY_RUN=1` antes de que nada haya cargado el sender;
//   2) la aserción de siempre SE QUEDA, y pasa a comprobar que ponerla ha surtido efecto;
//   3) lo que decide no es la bandera: se corta toda conexión hacia fuera (`_sin-salida.mjs`,
//      con su control positivo delante) y el test cae si el envío intentó abrir una sola.
// El corte sólo se instala con el banco: contra staging la base es remota y no se toca nada.
import './_staging-db.mjs'; // SCRUM-60: fuerza la BD de staging cuando A55_DB_TEST=1 (fail-closed anti-prod)
import { URL_BANCO } from './_banco-libro.mjs'; // SCRUM-876e/f: segundo destino, inerte con el gate de staging
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { withMerchant } from './_merchant-fixture.mjs'; // SCRUM-159 (①)
import { interceptarWaLog } from './_wa-log-sync.mjs'; // SCRUM-250/255: esperar la escritura, no el reloj
import { cortarSalida } from './_sin-salida.mjs'; // SCRUM-876f

/** El objeto `exports` REAL del módulo de log — el mismo que lee `whatsapp.js` en cada llamada. */
async function moduloDeLog() {
  return (await import('../dist/modules/messaging/domain/whatsappLog.service.js')).default;
}

const CON_BANCO = URL_BANCO !== '';
const ENABLED = process.env.A55_DB_TEST === '1' || CON_BANCO;

// SCRUM-876f (1): lo primero que hace el cuerpo del fichero. `SENDER_YA_CARGADO` deja dicho, con
// el estado del proceso y no con el orden de las líneas, si la bandera llegó antes que el sender.
const requiere = createRequire(import.meta.url);
const senderCargado = () => Boolean(requiere.cache[requiere.resolve('../dist/integrations/whatsapp.js')]);
const SENDER_YA_CARGADO = ENABLED && senderCargado();
if (CON_BANCO) process.env.WHATSAPP_DRY_RUN = '1';

test('A5.5: ventana abierta → envío de presupuesto por SESIÓN (service), no plantilla', { skip: !ENABLED && 'sin A55_DB_TEST=1 ni LIBRO_PG_URL · npm run test:staging:gated' }, async (t) => {
  assert.equal(process.env.WHATSAPP_DRY_RUN, '1', 'este test exige WHATSAPP_DRY_RUN=1');
  assert.equal(SENDER_YA_CARGADO, false, '🔴 el sender de WhatsApp ya estaba cargado cuando este fichero fijó su entorno');

  // SCRUM-876f (3): el corte, y su control ANTES del primer envío. Si el control no ve un POST de
  // axios y un fetch, lanza aquí y no se manda nada.
  const corte = CON_BANCO ? cortarSalida() : null;
  if (corte) {
    t.after(() => corte.restaurar());
    await corte.controlPositivo();
  }
  // Se llama justo detrás de cada envío, ANTES de mirar su `ok`: si algo quiso salir, el motivo
  // del rojo tiene que ser ése y no una consecuencia suya.
  const sinSalida = (cuando) => {
    if (!corte) return;
    assert.equal(corte.controlado, true, '🔴 CIEGO: el corte de salida no pasó su control');
    assert.deepEqual(corte.ajenos(), [],
      `🔴 ${cuando}: el envío INTENTÓ salir de esta máquina con WHATSAPP_DRY_RUN=1 y el banco como destino`);
  };

  const { prisma } = await import('../dist/core/db/prisma.js');
  const { recordInboundWaMessage } = await import('../dist/modules/messaging/domain/whatsappLog.service.js');
  const { sendWhatsAppWindowFirst } = await import('../dist/integrations/whatsapp.js');
  const { buildQuoteDecision } = await import('../dist/integrations/whatsappTemplates.js');
  // El suelo de `SENDER_YA_CARGADO`: ahora que SÍ está cargado, la misma pregunta tiene que decir
  // que sí. Si no, aquel `false` de arriba no era «todavía no»: era «no sé mirar».
  assert.equal(senderCargado(), true, '🔴 CIEGO: no sé ver si el sender está cargado');

  let savedMerchantId;
  let failed = false;
  try {
    await withMerchant(prisma, { name: 'QA S159 a55', email: `qa-s159-a55-${Date.now()}@test.local` }, async (merchant, phones) => {
      savedMerchantId = merchant.id;
      // SCRUM-174: el teléfono lo GENERA withMerchant (fuente única, SCRUM-180) y lo entrega aquí,
      // ya no se inventa. a55 no crea bot sessions, así que solo usa `cliente` (34600…) para el
      // cliente y los envíos; el barrido por phone del fixture no tiene nada que llevarse aquí.
      const TEST_PHONE = phones.cliente;
      const customer = await prisma.customer.create({
        data: { merchantId: merchant.id, name: 'María García QA', phone: TEST_PHONE },
        select: { id: true, name: true },
      });

      // SCRUM-255: aquí había un sondeo de 30 × 100 ms — la forma que SCRUM-250 retiró de
      // scrum115. El log WA-0b es fire-and-forget A PROPÓSITO (registrar telemetría no puede
      // tumbar un envío), así que bajo contención del pool de staging la fila llega pasada la
      // ventana y el test cae CON EL MISMO CÓDIGO: el veredicto lo decidía el reloj.
      // Ahora se espera a la PROMESA y la consulta se hace UNA vez. Sigue sin acumular ids para
      // limpiar: de eso se encarga withMerchant (barre whatsAppMessage por merchantId).
      //
      // UNA VENTANA POR CASO, no una sola de principio a fin: el suelo `interceptadas === 0` es
      // lo que avisa de que el registro dejó de pasar por `recordWaMessage`. Con una sola ventana
      // abierta, ese suelo solo protegería al primer caso — para el segundo el contador ya no
      // sería cero aunque su escritura no hubiera nacido.
      const filasNuevas = async (since) => prisma.whatsAppMessage.findMany({
        where: { merchantId: merchant.id, customerId: customer.id, createdAt: { gte: since } },
        orderBy: { id: 'asc' },
      });

      const t0 = new Date();
      const template = buildQuoteDecision({
        customerName: customer.name || 'Cliente',
        businessName: 'Fontanería García S.L.',
        quoteNumber: 999,
        totalWithCurrency: '100.00 EUR',
        decisionToken: 'ff00ee11dd22cc33bb44aa55ff00ee11',
      });
      const windowText = 'Hola 👋 (texto de sesión A5.5 — test)';

      // ── Caso 1: SIN ventana → debe salir PLANTILLA ─────────────────────────
      const wa1 = interceptarWaLog({ log: await moduloDeLog(), prisma });
      const closed = await sendWhatsAppWindowFirst({
        to: TEST_PHONE,
        merchantId: merchant.id,
        customerId: customer.id,
        windowText,
        template,
        log: { customerId: customer.id },
      });
      sinSalida('caso 1, sin ventana (plantilla)');
      assert.equal(closed.ok, true);
      assert.equal(closed.via, 'template', 'sin inbound reciente debe caer a plantilla');
      let rows;
      try {
        await wa1.esperar(); // resuelve cuando la escritura TERMINA, no cuando lo dice un reloj
        rows = await filasNuevas(t0);
      } finally {
        wa1.restaurar();
      }
      assert.equal(rows.filter((r) => r.type === 'template').length, 1,
        wa1.explicar('debe registrarse 1 fila template'));

      // ── Caso 2: el cliente escribe (bot) → ventana abierta → SESIÓN ────────
      const wa2 = interceptarWaLog({ log: await moduloDeLog(), prisma }); // ventana propia: ver arriba
      await recordInboundWaMessage(TEST_PHONE); // lo que hace el webhook con CUALQUIER entrante
      const open = await sendWhatsAppWindowFirst({
        to: TEST_PHONE,
        merchantId: merchant.id,
        customerId: customer.id,
        windowText,
        template,
        log: { customerId: customer.id },
      });
      sinSalida('caso 2, con ventana (sesión)');
      assert.equal(open.ok, true);
      assert.equal(open.via, 'window', 'con inbound <24h debe salir por VENTANA');

      try {
        await wa2.esperar();
        rows = await filasNuevas(t0); // acumulado: template + inbound + service
      } finally {
        wa2.restaurar();
      }
      const templates = rows.filter((r) => r.type === 'template');
      const services = rows.filter((r) => r.type === 'service');
      assert.equal(templates.length, 1, 'NO debe haberse añadido otra plantilla');
      assert.equal(services.length, 1, 'debe registrarse 1 fila service (sentVia=window)');
      assert.equal(services[0].templateName, 'quote_decision_es', 'la service guarda qué plantilla se ahorró (métrica A5.4)');
      assert.equal(Number(services[0].costEstimate), 0, 'coste 0 €');

      // SCRUM-876f (3): los dos envíos han terminado y sus dos filas están escritas. Una vuelta
      // más del bucle, por si algo quedó lanzado sin esperar, y se mira por última vez.
      await new Promise((r) => setImmediate(r));
      sinSalida('al terminar');
    });
  } catch (e) {
    failed = true; // el test falló por su propia razón; el finally NO debe enmascararla
    throw e;
  } finally {
    // withMerchant ya borró el merchant + sus filas por merchantId (incluida whatsAppMessage, que
    // NO tiene FK). Contraprueba por CONTEO. DOS casos: si el test YA falló (failed) solo se GRITA
    // —lanzar aquí enmascararía el error real—; si fue BIEN y quedó basura, eso ES el fallo
    // (contaminaría el proceso siguiente del runner) y se lanza → ROJO. Un verde falso no lo mira
    // nadie. Si la consulta de conteo falla, "NO PUDE CONTAR" y null, NUNCA 0 (se leería como limpio).
    let waLeft = 0;
    const countOrNull = async (label, fn) => {
      try { return await fn(); }
      catch (e) { console.error(`🔴 SCRUM-159: NO PUDE CONTAR ${label} en la contraprueba — la verificación NO corrió; esto NO es "limpio": ${e?.message || e}`); return null; }
    };
    if (savedMerchantId != null) {
      waLeft = (await countOrNull('whatsAppMessage', () => prisma.whatsAppMessage.count({ where: { merchantId: savedMerchantId } }))) ?? 0;
      if (waLeft > 0) console.error(`🔴 SCRUM-159 LIMPIEZA INCOMPLETA: ${waLeft} whatsAppMessage del merchant efímero ${savedMerchantId} sobrevivieron (sin FK → fallo mudo) — contaminarían el proceso siguiente del runner.`);
    }
    // Conteo POSITIVO, SIEMPRE (no solo si >0): ver el conteo, no la ausencia de error.
    console.log(`✔ SCRUM-159 contraprueba de limpieza: whatsAppMessage=${waLeft} (merchant efímero ${savedMerchantId})`);
    await prisma.$disconnect().catch(() => {});
    // Solo si el test fue BIEN: la contaminación ES el fallo y debe ser ROJA. Con failed=true no se
    // lanza: el error original ya propaga intacto por el `throw e` del catch.
    if (!failed && waLeft > 0) {
      throw new Error(`SCRUM-159 LIMPIEZA INCOMPLETA: ${waLeft} whatsAppMessage del merchant efímero ${savedMerchantId} sobrevivieron; contaminarían el proceso siguiente del runner.`);
    }
  }
});
