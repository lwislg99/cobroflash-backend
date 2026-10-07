// tests/scrum1436-ventana-abierta-envio-fallido.test.mjs — SCRUM-1436 (hallazgo 3)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «TU CLIENTE NO HA ESCRITO EN 24 H» CUANDO SÍ ESCRIBIÓ
//
// `sendWhatsAppWindowFirst` con `sinPlantilla` (SCRUM-195: el presupuesto adicional no cae a la
// plantilla que abre la conversación) devolvía `ventana_cerrada` en DOS casos distintos:
//
//   · la ventana está CERRADA → se decide no mandar. Correcto, y firmado (decisión 3, 28-jul-2026);
//   · la ventana está ABIERTA y el envío FALLA → caía al mismo `return`, porque lo que se miraba
//     era la opción del llamador y no el estado de la ventana.
//
// En el segundo el profesional leía «Tu cliente no ha escrito en 24 h, llámale o mándaselo tú.»
// de un cliente que acababa de escribirle. El motivo correcto, `whatsapp_send_failed`, ya existía.
//
// QUÉ NO CAMBIA, y se comprueba: con `sinPlantilla` no se manda plantilla en NINGÚN caso; con la
// ventana cerrada el motivo sigue siendo `ventana_cerrada`; sin la opción se sigue cayendo a
// plantilla.
//
// CÓMO SE FABRICA EL FALLO, sin doblar el sender: se apaga el dry-run y entonces `metaHttp` LANZA
// antes de tocar la red por ser un proceso de test (SCRUM-180). El `catch` del sender lo convierte
// en `{ ok: false, error }`, que es la forma que devuelve cuando Meta rechaza o no contesta.
// Las credenciales son dos cadenas de laboratorio puestas en el objeto `config` ya cargado: sin
// ellas el sender se pararía antes, en `not_configured`, que es OTRO caso (el ④).
//
// ⛔ Ni una clave real. Ni un byte hacia Meta: lo impide el propio interceptor que se ejercita.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';

// LA BASE SE INYECTA UNA VEZ, y lo que cambia de un caso a otro es este estado. Inyectarla en cada
// caso no vale: `inyectarBase` sólo descarta el sender y el envío, y los módulos que ya habían
// capturado `prisma` (el de la ventana, entre ellos) seguirían contestando con el banco del
// PRIMER caso. Medido al escribir esto: el contador de consultas del segundo caso salía a 0.
const estado = { ventana: 'cerrada', consultasDeVentana: [] };
inyectarBase({
  'whatsAppMessage.findFirst': (args) => {
    if (args?.where?.type !== 'inbound') return null;
    estado.consultasDeVentana.push(args);
    return estado.ventana === 'abierta' ? { id: 1 } : null;
  },
  'customer.findMany': () => [], // nadie se ha dado de baja (J3)
  'quote.findUnique': () => ({
    id: 7, merchantId: MERCHANT, customerId: CLIENTE, status: 'sent', quoteNumber: 12,
    total: '150.00', currency: 'EUR', decisionToken: 'tok-1436-de-laboratorio',
    merchant: { id: MERCHANT, name: 'Taller de prueba', legalName: null },
    customer: { id: CLIENTE, name: 'Cliente de laboratorio', phone: '+34600000055', mobile: '+34600000055' },
  }),
});

const { config } = moduloDeDist('../dist/core/config/env.js');
const { SEND_FAILURE_MESSAGES } = moduloDeDist('../dist/lib/sendOutcome.js');
const PLANTILLA = { templateName: 'quote_decision_es', languageCode: 'es', components: [] };
const TEXTO_24H = SEND_FAILURE_MESSAGES.ventana_cerrada;

/**
 * Monta el entorno de UN caso y lo deshace al acabar.
 *
 * `ventana` decide lo que contesta la consulta de `isServiceWindowOpen` (el último entrante del
 * cliente): 'abierta' devuelve una fila, 'cerrada' ninguna.
 * `meta`: 'responde' = dry-run (el envío sale bien, al buzón) · 'falla' = dry-run apagado con
 * credenciales de laboratorio (el interceptor lanza) · 'sin-configurar' = dry-run apagado y sin
 * credenciales.
 */
async function conEntorno({ ventana, meta }, cuerpo) {
  estado.ventana = ventana;
  estado.consultasDeVentana = [];

  const antes = {
    dry: process.env.WHATSAPP_DRY_RUN,
    id: config.WHATSAPP_PHONE_NUMBER_ID,
    token: config.WHATSAPP_ACCESS_TOKEN,
  };
  const buzon = [];
  globalThis.__waDryRunOutbox = buzon;
  if (meta === 'responde') {
    process.env.WHATSAPP_DRY_RUN = '1';
  } else {
    delete process.env.WHATSAPP_DRY_RUN;
    config.WHATSAPP_PHONE_NUMBER_ID = meta === 'falla' ? 'laboratorio-1436' : '';
    config.WHATSAPP_ACCESS_TOKEN = meta === 'falla' ? 'laboratorio-1436' : '';
  }
  try {
    return await cuerpo({
      wa: moduloDeDist('../dist/integrations/whatsapp.js'),
      envio: moduloDeDist('../dist/modules/quotes/domain/sendQuote.service.js'),
      buzon,
      consultasDeVentana: estado.consultasDeVentana,
    });
  } finally {
    process.env.WHATSAPP_DRY_RUN = antes.dry;
    config.WHATSAPP_PHONE_NUMBER_ID = antes.id;
    config.WHATSAPP_ACCESS_TOKEN = antes.token;
    delete globalThis.__waDryRunOutbox;
  }
}

const directo = (wa, extra = {}) => wa.sendWhatsAppWindowFirst({
  to: '34600000055', // rango imposible de laboratorio (SCRUM-262)
  merchantId: MERCHANT,
  customerId: CLIENTE,
  windowText: 'texto de ventana',
  template: PLANTILLA,
  sinPlantilla: true,
  ...extra,
});

// ═══ ① SUELOS — sin ellos, lo de abajo mediría otra cosa ═════════════════════════════════════

test('SCRUM-1436 · 🔴 SUELO: el banco sabe ABRIR la ventana (con Meta respondiendo, sale por ventana)', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'responde' }, async ({ wa, buzon, consultasDeVentana }) => {
    const r = await directo(wa);
    assert.equal(consultasDeVentana.length, 1, '🔴 CIEGO: nadie ha preguntado por la ventana de 24 h.');
    assert.equal(r.ok, true, `🔴 CIEGO: con la ventana abierta y Meta respondiendo no ha salido: ${JSON.stringify(r)}`);
    assert.equal(r.via, 'window');
    assert.equal(buzon.length, 1, '🔴 CIEGO: el texto de ventana no ha llegado al buzón.');
  });
});

test('SCRUM-1436 · 🔴 SUELO: el banco sabe hacer FALLAR el envío sin tocar la red', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'falla' }, async ({ wa, buzon }) => {
    const r = await wa.sendWhatsAppText({ to: '34600000055', merchantId: MERCHANT, text: 'x' });
    assert.equal(r.ok, false, '🔴 CIEGO: el envío no ha fallado: el caso de abajo no ejercitaría el fallo.');
    assert.equal(r.reason, undefined, '🔴 CIEGO: el envío se ha parado ANTES de Meta, con motivo propio.');
    assert.match(String(r.error), /SCRUM-180/, '🔴 CIEGO: el fallo no es el del interceptor de salida a Meta.');
    assert.equal(buzon.length, 0);
  });
});

// ═══ ② EL DEFECTO ════════════════════════════════════════════════════════════════════════════

test('SCRUM-1436 · 🔴 ventana ABIERTA y envío fallido → el motivo es `whatsapp_send_failed`, no `ventana_cerrada`', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'falla' }, async ({ wa, buzon, consultasDeVentana }) => {
    const r = await directo(wa);

    assert.equal(consultasDeVentana.length, 1, '🔴 CIEGO: no se ha consultado la ventana.');
    assert.equal(r.ok, false);
    assert.equal(r.via, 'none', '🔴 con `sinPlantilla` no se manda plantilla, tampoco cuando el texto falla.');
    assert.notEqual(r.reason, 'ventana_cerrada',
      '🔴 EL CLIENTE SÍ HA ESCRITO y el motivo dice que la ventana está cerrada: el profesional va a '
      + `leer «${TEXTO_24H}».`);
    assert.equal(r.reason, 'whatsapp_send_failed');
    assert.equal(buzon.length, 0, '🔴 ha salido algo hacia el cliente en un envío que se da por fallido.');
  });
});

test('SCRUM-1436 · 🔴 por el camino entero del presupuesto, el profesional NO lee «no ha escrito en 24 h»', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'falla' }, async ({ envio }) => {
    const r = await envio.sendQuoteWhatsAppToCustomer(7, MERCHANT, { sinPlantilla: true });

    assert.equal(r.ok, false, `🔴 CIEGO: el envío se ha dado por bueno: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'whatsapp_send_failed',
      `🔴 el motivo que sube a la pantalla es «${r.reason}», y su frase es «${SEND_FAILURE_MESSAGES[r.reason]}».`);
    assert.notEqual(SEND_FAILURE_MESSAGES[r.reason], TEXTO_24H);
  });
});

// ═══ ③ LO QUE NO CAMBIA ══════════════════════════════════════════════════════════════════════

test('SCRUM-1436 · ✅ POSITIVO: ventana CERRADA con `sinPlantilla` → sigue siendo `ventana_cerrada` y no se manda', async () => {
  for (const meta of ['responde', 'falla']) {
    await conEntorno({ ventana: 'cerrada', meta }, async ({ wa, buzon, consultasDeVentana }) => {
      const r = await directo(wa);
      assert.equal(consultasDeVentana.length, 1, '🔴 CIEGO: no se ha consultado la ventana.');
      assert.deepEqual({ ok: r.ok, via: r.via, reason: r.reason }, { ok: false, via: 'none', reason: 'ventana_cerrada' },
        `🔴 la decisión firmada de SCRUM-195 ha cambiado (Meta: ${meta}).`);
      assert.equal(buzon.length, 0, '🔴 con la ventana cerrada y `sinPlantilla` ha salido un mensaje.');
    });
  }
});

test('SCRUM-1436 · ✅ POSITIVO: sin cliente conocido no hay ventana que mirar → `ventana_cerrada`, como antes', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'falla' }, async ({ wa, consultasDeVentana }) => {
    const r = await directo(wa, { customerId: null });
    assert.equal(consultasDeVentana.length, 0);
    assert.equal(r.reason, 'ventana_cerrada');
  });
});

test('SCRUM-1436 · ✅ POSITIVO: SIN la opción, ventana abierta y envío fallido sigue cayendo a PLANTILLA', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'falla' }, async ({ wa }) => {
    const r = await directo(wa, { sinPlantilla: false });
    assert.equal(r.via, 'template', '🔴 el envío normal ha dejado de intentar la plantilla: se ha cambiado todo el producto.');
    assert.notEqual(r.reason, 'ventana_cerrada');
  });
});

// ═══ ④ SI EL ENVÍO TRAE SU PROPIO MOTIVO, ES ÉSE ════════════════════════════════════════════

test('SCRUM-1436 · 🔴 ventana ABIERTA y el envío se para con motivo propio → sube ESE motivo, no `ventana_cerrada`', async () => {
  await conEntorno({ ventana: 'abierta', meta: 'sin-configurar' }, async ({ wa }) => {
    const r = await directo(wa);
    assert.equal(r.via, 'none');
    assert.equal(r.reason, 'not_configured',
      '🔴 el sender dijo por qué no salió y ese motivo se ha perdido por el camino.');
  });
});
