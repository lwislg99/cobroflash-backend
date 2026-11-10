// tests/scrum1631-la-fila-del-fallo-se-espera.test.mjs — SCRUM-1631
//
// LA FILA DE UN ENVÍO QUE NO SALIÓ EXISTE CUANDO EL ENVÍO DEVUELVE.
//
// `logFailure` lanzaba la escritura y seguía: la función devolvía antes de que la fila existiera, y
// un proceso que moría en ese instante la perdía. Esa fila es la que SCRUM-115 creó para que un
// fallo no desapareciera. La medición contra Postgres está en `docs/master/SCRUM-1631.md`.
//
// QUÉ SE MIDE:
//   ① EN MARCHA: la base se queda parada a mitad de la escritura y se mira si el envío ha vuelto.
//      Son las ocho vías, y la plantilla reservada que Meta no llega a aceptar.
//   ② LO QUE NO CAMBIA: si la escritura falla, el envío devuelve lo mismo y no lanza.
//   ③ POR ÁRBOL SINTÁCTICO: ninguna escritura de un fallo se queda sin esperar, tampoco una vía
//      nueva. ① sólo ve las que recorre.
//
// La base se dobla con `_envio-doblado.mjs`. Ni un byte hacia Meta: sin dry-run, el interceptor de
// `metaHttp` lanza en un proceso de test (SCRUM-180), y ese es justo el fallo que aquí se provoca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const TELEFONO = telefonoDePrueba(31);
const PLANTILLA = { templateName: 'plantilla_de_laboratorio_1631', languageCode: 'es', components: [] };

/** Lo que este test tiene que tumbar (SCRUM-1387: la red de la casa, `npm run meta:mutaciones`). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/integrations/whatsapp.ts',
    de: "await recordWaMessage({\n      merchantId: params.merchantId,\n      toPhone: params.to,\n      customerId: params.log?.customerId ?? null,\n      type: 'template',\n      templateName: params.templateName,\n      status: 'failed',",
    a: "recordWaMessage({\n      merchantId: params.merchantId,\n      toPhone: params.to,\n      customerId: params.log?.customerId ?? null,\n      type: 'template',\n      templateName: params.templateName,\n      status: 'failed',",
    cae: 'SCRUM-1631 · las ocho vías' },
  { fichero: 'src/integrations/whatsapp.ts', de: "await logFailure('daily_cap');", a: "logFailure('daily_cap');", cae: 'SCRUM-1631 · por árbol' },
  { fichero: 'src/integrations/whatsapp.ts',
    de: "      await resolverReservaDePlantilla(prisma, reservaId, {\n        como: 'rechazada',",
    a: "      resolverReservaDePlantilla(prisma, reservaId, {\n        como: 'rechazada',",
    cae: 'SCRUM-1631 · la plantilla reservada' },
  { fichero: 'src/integrations/whatsapp.ts',
    de: "  console.error('[WA-0b] la fila del fallo no se escribió:', err?.message || err);",
    a: '  void err;',
    cae: 'SCRUM-1631 · si la escritura rechaza' },
];

const estado = { puerta: null, pedidas: 0, filas: [], bajas: [], romper: false };
inyectarBase({
  'whatsAppMessage.create': async (a) => {
    estado.pedidas++;
    if (estado.puerta) await estado.puerta;
    if (estado.romper) throw new Error('la base no contesta');
    estado.filas.push(a.data);
    return { id: 41 };
  },
  'customer.findMany': (a) => (a?.where?.waOptOut ? estado.bajas : []),
});

const { config } = moduloDeDist('../dist/core/config/env.js');
const wa = moduloDeDist('../dist/integrations/whatsapp.js');
const log = moduloDeDist('../dist/modules/messaging/domain/whatsappLog.service.js');

const VIAS = Object.freeze({
  sendWhatsAppTemplate: { ...PLANTILLA },
  sendWhatsAppText: { text: 'hola' },
  sendWhatsAppButtons: { bodyText: 'cuerpo', buttons: [{ id: 'a', title: 'A' }] },
  sendWhatsAppList: { bodyText: 'cuerpo', buttonText: 'Ver', rows: [{ id: 'a', title: 'A' }] },
  sendWhatsAppCtaUrl: { bodyText: 'cuerpo', buttonText: 'Abrir', url: 'https://yaqu.app/x' },
  sendWhatsAppDocument: { link: 'https://yaqu.app/x.pdf', filename: 'x.pdf' },
  sendWhatsAppLocationRequest: { bodyText: 'cuerpo' },
});

const enviar = (via) => wa[via]({ to: TELEFONO, merchantId: MERCHANT, ...VIAS[via] });

/** `credenciales`: true = hay con qué llamar a Meta · false = el envío se para en `not_configured`. */
async function conEntorno({ dry = false, credenciales = false }, cuerpo) {
  const antes = { dry: process.env.WHATSAPP_DRY_RUN, id: config.WHATSAPP_PHONE_NUMBER_ID, token: config.WHATSAPP_ACCESS_TOKEN };
  Object.assign(estado, { puerta: null, pedidas: 0, filas: [], bajas: [], romper: false });
  if (dry) process.env.WHATSAPP_DRY_RUN = '1';
  else delete process.env.WHATSAPP_DRY_RUN;
  config.WHATSAPP_PHONE_NUMBER_ID = credenciales ? 'id-de-laboratorio' : '';
  config.WHATSAPP_ACCESS_TOKEN = credenciales ? 'token-de-laboratorio' : '';
  try {
    return await cuerpo();
  } finally {
    if (antes.dry === undefined) delete process.env.WHATSAPP_DRY_RUN;
    else process.env.WHATSAPP_DRY_RUN = antes.dry;
    config.WHATSAPP_PHONE_NUMBER_ID = antes.id;
    config.WHATSAPP_ACCESS_TOKEN = antes.token;
  }
}

const vuelta = () => new Promise((r) => setImmediate(r));

/**
 * Lanza el envío con la escritura parada y dice si volvió antes de soltarla. El control va dentro:
 * si la escritura no llega a pedirse, «no volvió» no significaría nada.
 */
async function conLaEscrituraParada(lanzar, pedida = () => estado.pedidas > 0) {
  let soltar;
  const puerta = new Promise((r) => { soltar = r; });
  estado.puerta = puerta;
  let volvio = false;
  const envio = lanzar().then((v) => { volvio = true; return v; });
  for (let i = 0; i < 200 && !pedida(); i++) await vuelta();
  assert.ok(pedida(), 'CIEGO: el envío no llegó a pedir la escritura; «no volvió» no mediría nada');
  for (let i = 0; i < 20; i++) await vuelta();
  const volvioAntes = volvio;
  soltar();
  estado.puerta = null;
  return { volvioAntes, resultado: await envio };
}

// ── 1 · En marcha ────────────────────────────────────────────────────────────────────────────

test('SCRUM-1631 · las ocho vías: el envío no vuelve hasta que la fila del fallo está escrita', async () => {
  for (const via of Object.keys(VIAS)) {
    await conEntorno({}, async () => {
      const { volvioAntes, resultado } = await conLaEscrituraParada(() => enviar(via));
      assert.equal(volvioAntes, false, `${via} volvió con la fila del fallo sin escribir`);
      assert.deepEqual(resultado, { ok: false, reason: 'not_configured' }, `${via} cambió lo que devuelve`);
      assert.equal(estado.filas.length, 1, `${via}: la fila no está cuando el envío vuelve`);
      assert.equal(estado.filas[0].status, 'failed');
      assert.equal(estado.filas[0].error, 'not_configured');
    });
  }
  await conEntorno({ dry: true }, async () => {
    estado.bajas = [{ phone: TELEFONO, mobile: null }];
    const { volvioAntes, resultado } = await conLaEscrituraParada(() => wa.sendWhatsAppWindowFirst({
      to: TELEFONO, merchantId: MERCHANT, windowText: 'hola', template: PLANTILLA,
    }));
    assert.equal(volvioAntes, false, 'sendWhatsAppWindowFirst volvió con la fila de la baja sin escribir');
    assert.deepEqual(resultado, { ok: false, via: 'none', reason: 'wa_opt_out' });
    assert.equal(estado.filas.length, 1);
    assert.equal(estado.filas[0].status, 'failed');
  });
});

test('SCRUM-1631 · la plantilla reservada: el rechazo se escribe antes de devolver', async (t) => {
  t.mock.method(console, 'error', () => {});
  await conEntorno({ credenciales: true }, async () => {
    const reservar = log.reservarPlantilla;
    const resolver = log.resolverReservaDePlantilla;
    const resueltas = [];
    let pedidas = 0;
    log.reservarPlantilla = async () => ({ ok: true, id: 77 });
    log.resolverReservaDePlantilla = async (_db, id, desenlace) => {
      pedidas++;
      await estado.puerta;
      resueltas.push({ id, como: desenlace.como });
    };
    try {
      const { volvioAntes, resultado } = await conLaEscrituraParada(() => enviar('sendWhatsAppTemplate'), () => pedidas > 0);
      assert.equal(volvioAntes, false, 'la plantilla volvió con la reserva sin resolver');
      assert.deepEqual(resueltas, [{ id: 77, como: 'rechazada' }]);
      assert.equal(resultado.ok, false);
      assert.equal(resultado.desenlace, 'no_enviado');
    } finally {
      log.reservarPlantilla = reservar;
      log.resolverReservaDePlantilla = resolver;
    }
  });
});

// ── 2 · Lo que no cambia ─────────────────────────────────────────────────────────────────────

test('SCRUM-1631 · si la base falla al escribir, el envío devuelve lo mismo y no lanza', async (t) => {
  const error = t.mock.method(console, 'error', () => {});
  await conEntorno({}, async () => {
    estado.romper = true;
    const resultado = await enviar('sendWhatsAppText');
    assert.deepEqual(resultado, { ok: false, reason: 'not_configured' });
    assert.equal(estado.pedidas, 1, 'CIEGO: no se llegó a intentar la escritura');
    assert.equal(estado.filas.length, 0);
    assert.ok(error.mock.calls.some((c) => String(c.arguments[0]).includes('recordWaMessage omitido')),
      'la escritura falló y no quedó dicho en el log');
  });
});

test('SCRUM-1631 · si la escritura rechaza, queda en el log y el envío devuelve lo mismo', async (t) => {
  const error = t.mock.method(console, 'error', () => {});
  await conEntorno({}, async () => {
    const original = log.recordWaMessage;
    log.recordWaMessage = async () => { throw new Error('rechazo de laboratorio'); };
    try {
      const resultado = await enviar('sendWhatsAppText');
      assert.deepEqual(resultado, { ok: false, reason: 'not_configured' });
      assert.ok(error.mock.calls.some((c) => c.arguments.join(' ').includes('rechazo de laboratorio')),
        'el error de la escritura se tragó en silencio');
    } finally {
      log.recordWaMessage = original;
    }
  });
});

// ── 3 · Por árbol sintáctico ─────────────────────────────────────────────────────────────────

const ts = createRequire(import.meta.url)('typescript');

/** Qué escribe la llamada, o `null` si no es una escritura de un fallo. */
function fallaEn(nodo, arbol) {
  const nombre = nodo.expression.getText(arbol);
  if (nombre === 'logFailure') return 'logFailure';
  const texto = nodo.getText(arbol);
  if (nombre === 'recordWaMessage') return /status: 'failed'/.test(texto) ? 'recordWaMessage failed' : null;
  if (nombre === 'resolverReservaDePlantilla') return /como: '(rechazada|sin_respuesta)'/.test(texto) ? 'resolverReservaDePlantilla' : null;
  return null;
}

/** Las escrituras de un fallo de un fuente, y las que se quedan sin `await` o con el error tragado. */
function censo(fuente) {
  const arbol = ts.createSourceFile('censo.ts', fuente, ts.ScriptTarget.Latest, true);
  const escrituras = [];
  const declaraciones = [];
  const visita = (nodo) => {
    if (ts.isVariableDeclaration(nodo) && nodo.name.getText(arbol) === 'logFailure') declaraciones.push(nodo);
    if (ts.isCallExpression(nodo) && fallaEn(nodo, arbol)) {
      // Sube por la cadena `.catch(…)` hasta la expresión entera, que es la que se espera o no.
      let tope = nodo;
      while (ts.isPropertyAccessExpression(tope.parent) || (ts.isCallExpression(tope.parent) && tope.parent.expression === tope)) tope = tope.parent;
      escrituras.push({
        linea: arbol.getLineAndCharacterOfPosition(nodo.getStart(arbol)).line + 1,
        que: fallaEn(nodo, arbol),
        espera: ts.isAwaitExpression(tope.parent),
        muda: /\.catch\(\(\) => \{\s*\}\)$/.test(tope.getText(arbol)),
      });
    }
    ts.forEachChild(nodo, visita);
  };
  visita(arbol);
  return { declaraciones, escrituras, malas: escrituras.filter((e) => !e.espera || e.muda) };
}

test('SCRUM-1631 · por árbol: toda escritura de un fallo se espera y ninguna se traga el error', () => {
  // Control sembrado: las dos formas del defecto, en un fuente fabricado aquí, TIENEN que salir.
  const siembra = censo(`async function f() {
    logFailure('x');
    recordWaMessage({ status: 'failed' }).catch(() => {});
    await recordWaMessage({ status: 'failed' }).catch(() => {});
    await resolverReservaDePlantilla(db, 1, { como: 'rechazada' }).catch(aviso);
    recordWaMessage({ status: 'sent' }).catch(() => {});
  }`);
  assert.equal(siembra.escrituras.length, 4, 'CIEGO: el censo no ve las escrituras sembradas');
  assert.deepEqual(siembra.malas.map((e) => e.linea), [2, 3, 4], 'CIEGO: el censo no separa las sembradas');

  const real = censo(fs.readFileSync(path.join(RAIZ, 'src/integrations/whatsapp.ts'), 'utf8'));
  assert.equal(real.declaraciones.length, Object.keys(VIAS).length, 'hay una vía con `logFailure` que este test no ejercita');
  assert.ok(real.escrituras.length > real.declaraciones.length, 'CIEGO: población sospechosa');
  assert.deepEqual(real.malas, [], 'una escritura de un fallo no se espera o se traga el error');
});
