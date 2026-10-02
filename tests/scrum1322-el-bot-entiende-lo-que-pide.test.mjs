// tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs — SCRUM-1322
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// El bot le dice al cliente «escribe *Acepto* o *No*», y «Acepto» no lo entendía: la expresión
// cerraba con límite de palabra detrás de la RAÍZ (`acept`), así que sólo casaba la raíz suelta. Y
// «sí» con tilde tampoco, por otra causa: `\b` sin modo unicode no ve frontera detrás de «í».
//
// Al medirlo salió lo contrario y es peor: la expresión no estaba ANCLADA. Buscaba la palabra en
// cualquier parte del mensaje, así que «no sé» RECHAZABA el presupuesto y «¿va con IVA?» lo
// ACEPTABA (y creaba el Trabajo, y le decía al profesional que el cliente había aceptado).
//
// Lo que se sostiene aquí: sólo decide el mensaje que ENTERO es una decisión. Todo lo demás es
// `unknown`, que no mueve el presupuesto.
//
// 🔴 Ni BD, ni red, ni staging. La función de verdad (de `dist/`) y la ruta real con dobles en
// `require.cache` — mismo harness que `tests/scrum1312-boton-email-recibo-gateado.test.mjs`.
// ⛔ Ningún texto del bot se toca ni se fija aquí: las dos palabras que pide se LEEN de su literal.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const RUTA_SRC = path.join(RAIZ, 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts');
const MODULO_SRC = path.join(RAIZ, 'src/modules/whatsappBot/domain/decisionPorTexto.ts');
const { parseDecision } = require_('./dist/modules/whatsappBot/domain/decisionPorTexto.js');

/**
 * Las tres listas, LEÍDAS del fuente por AST. No se exportan: su único consumidor está dentro del
 * módulo, y un `export` sólo para el test es un huérfano (lo caza `scrum411`). Lo que dicen se lee
 * aquí; lo que HACEN se mide abajo con `parseDecision`, que es la superficie pública.
 */
function listasDelModulo() {
  const sf = ts.createSourceFile(MODULO_SRC, fs.readFileSync(MODULO_SRC, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = {};
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      const nombre = d.name.getText(sf);
      if (!['ACEPTA', 'RECHAZA', 'CORTESIA'].includes(nombre) || !d.initializer) continue;
      if (ts.isArrayLiteralExpression(d.initializer)) {
        assert.ok(d.initializer.elements.every((e) => ts.isStringLiteral(e)), `CIEGO: ${nombre} lleva algo que no es un literal`);
        out[nombre] = d.initializer.elements.map((e) => e.text);
      } else if (ts.isObjectLiteralExpression(d.initializer)) {
        assert.ok(d.initializer.properties.every((p) => ts.isPropertyAssignment(p) && ts.isStringLiteral(p.name) && ts.isStringLiteral(p.initializer)),
          `CIEGO: ${nombre} lleva algo que no es «'palabra': 'motivo'»`);
        out[nombre] = Object.fromEntries(d.initializer.properties.map((p) => [p.name.text, p.initializer.text]));
      }
    }
  }
  assert.deepEqual(Object.keys(out).sort(), ['ACEPTA', 'CORTESIA', 'RECHAZA'], '🔴 CIEGO: no encuentro las tres listas en el módulo');
  return out;
}

/** Cada entrada, una por una y con su nombre: un fallo dice QUÉ frase, no «alguna de 18». */
function cadaUna(entradas, esperado, porQue) {
  const mal = entradas.filter((e) => parseDecision(e) !== esperado)
    .map((e) => `${JSON.stringify(e)} → ${parseDecision(e)}`);
  assert.deepEqual(mal, [], `🔴 ${porQue} (esperado «${esperado}», población ${entradas.length})`);
}

// ── 1 · Lo que el bot PIDE ─────────────────────────────────────────────────────────────────────

/** Las dos palabras de la instrucción, leídas del literal que el bot manda. No se copian aquí. */
function loQuePideElBot() {
  const src = fs.readFileSync(RUTA_SRC, 'utf8');
  const hallados = [...src.matchAll(/escribe \*([^*\n]+)\* o \*([^*\n]+)\*/g)];
  return hallados.map((m) => ({ acepta: m[1], rechaza: m[2] }));
}

test('🔴 SCRUM-1322 · la palabra que el bot pide escribir, el bot la entiende', () => {
  const pedidas = loQuePideElBot();
  // Suelo: si la instrucción cambia de forma, esto no puede quedarse verde sin mirar nada.
  assert.equal(pedidas.length, 1, `🔴 CIEGO: esperaba UNA instrucción «escribe *X* o *Y*» en la ruta y hay ${pedidas.length}`);
  const { acepta, rechaza } = pedidas[0];
  assert.equal(parseDecision(acepta), 'accept', `🔴 el bot pide «${acepta}» y no lo entiende`);
  assert.equal(parseDecision(rechaza), 'reject', `🔴 el bot pide «${rechaza}» y no lo entiende`);
  // Tal cual lo ve en pantalla (con los asteriscos de la negrita) y como lo teclea un móvil.
  cadaUna([`*${acepta}*`, acepta.toLowerCase(), acepta.toUpperCase(), `${acepta}.`, `${acepta}!`, ` ${acepta} `],
    'accept', 'la palabra pedida, con otra caja o con un signo detrás, deja de entenderse');
  cadaUna([`*${rechaza}*`, rechaza.toLowerCase(), rechaza.toUpperCase(), `${rechaza}.`],
    'reject', 'la palabra pedida para rechazar deja de entenderse');
});

// ── 2 · El positivo completo ───────────────────────────────────────────────────────────────────

const ACEPTAN = [
  'Acepto', 'acepto', 'ACEPTO', 'Acepto.', '*Acepto*',
  'sí', 'Sí', 'SÍ', 'sí.', 'si', 'Si', 'si!',
  // lo que ya se entendía suelto antes de este ticket, y tiene que seguir:
  'acept', 'dale', 'confirm', 'adelante', 'de acuerdo', 'me interesa',
  'quiero', 'sale',
  // las conjugaciones que la raíz dejaba fuera:
  'aceptar', 'aceptado', 'aceptamos', 'lo acepto', 'acepto el presupuesto', 'confirmo', 'confirmar', 'confirmado',
  // varias a la vez y con cortesía:
  'sí, acepto', 'si acepto', 'hola, acepto', 'sí, por favor', 'claro que sí',
  'sí, gracias', 'acepto, muchas gracias',
];
// SCRUM-1326 (firmado por el fundador, comentarios 17692 y 17802): estas ocho, sueltas, YA NO aceptan: el
// bot pregunta. Hasta ese ticket estaban arriba, en ACEPTAN. Su test es `tests/scrum1326-…`.
const PREGUNTAN = ['ok', 'okay', 'okey', 'vale', 'va', 'perfecto', 'listo', 'claro', 'vale, gracias', 'ok perfecto', 'vale, muchas gracias'];
const RECHAZAN = [
  'no', 'No', 'NO', 'No.', '*No*',
  'rechazo', 'cancelar',
  'rechaz', 'cancel', 'paso', 'mejor no', 'no gracias', 'negativo', 'nel',
  'rechazar', 'rechazado', 'lo rechazo', 'rechazo el presupuesto', 'cancelo', 'cancelado',
  'no, gracias', 'no acepto', 'no lo acepto', 'no me interesa', 'no quiero', 'claro que no', 'no, muchas gracias',
];

test('SCRUM-1322 · control positivo: lo que es una decisión se entiende', () => {
  cadaUna(ACEPTAN, 'accept', 'una aceptación deja de entenderse');
  cadaUna(RECHAZAN, 'reject', 'un rechazo deja de entenderse');
  cadaUna(PREGUNTAN, 'ask', 'una de las ocho de SCRUM-1326 deja de preguntar');
});

test('SCRUM-1322 · «sí» con tilde, en las dos formas en que puede llegar el carácter', () => {
  const compuesta = 's\xed';           // í como UN carácter
  const descompuesta = 'si' + String.fromCharCode(0x301);     // i + tilde combinatoria
  assert.notEqual(compuesta, descompuesta, 'CIEGO: las dos formas son la misma cadena y no mido dos cosas');
  cadaUna([compuesta, descompuesta, compuesta.toUpperCase()], 'accept', '«sí» con tilde no se entiende');
  // Una tilde EN MEDIO de la palabra (el corrector del móvil) no la parte en dos: sin quitar las
  // tildes, «vále» serían «va» y «le». Es el caso que separa «quitar la tilde» de «partir por ella».
  // («vále» pregunta desde SCRUM-1326; partida en «va» + «le» sería `unknown`.)
  cadaUna(['ac\xe9pto'], 'accept', 'una tilde en medio de la palabra la parte en dos');
  cadaUna(['v\xe1le'], 'ask', 'una tilde en medio de la palabra la parte en dos');
});

// ── 3 · 🔴 Lo que NO es una decisión ───────────────────────────────────────────────────────────

// Medidas el 1-oct-2026 sobre `main` (e9e71cab): TODAS movían el presupuesto.
const RECHAZABAN_SIN_SERLO = [
  'no sé', 'no se', 'no entiendo', 'no me llega el enlace', 'no puedo abrirlo',
  'ahora no puedo, luego te digo', 'por qué no incluye el IVA?', 'no lo veo',
  'todavía no lo he mirado', 'si no hay mas remedio',
];
const ACEPTABAN_SIN_SERLO = [
  'quiero saber si incluye IVA', 'si pago en efectivo hay descuento?', 'vale cuanto?',
  'cuanto sale el metro?', 'va con IVA?', 'claro que es caro',
  'ok pero me lo tengo que pensar', 'me interesa pero es caro',
];

test('🔴 SCRUM-1322 · «no sé» NO rechaza un presupuesto, y una pregunta NO lo acepta', () => {
  assert.equal(RECHAZABAN_SIN_SERLO.length + ACEPTABAN_SIN_SERLO.length, 18, 'la población medida son 18 frases');
  cadaUna(RECHAZABAN_SIN_SERLO, 'unknown', 'una frase que no es una decisión RECHAZA el presupuesto');
  cadaUna(ACEPTABAN_SIN_SERLO, 'unknown', 'una frase que no es una decisión ACEPTA el presupuesto');
});

test('SCRUM-1322 · control negativo: «no» y «si» DENTRO de otra palabra no son nada', () => {
  cadaUna(['hola', 'gracias', 'nota', 'noche', 'casino'], 'unknown', 'una palabra suelta que no decide, decide');
  cadaUna(['norte', 'nosotros', 'oka', 'vales', 'sino', 'aceptaría', 'nono'], 'unknown',
    'una palabra que EMPIEZA como una decisión se toma por la decisión');
});

test('SCRUM-1322 · lo que lleva las dos cosas, o una pregunta, no decide', () => {
  cadaUna(['si no', 'no, acepto', 'acepto no', 'vale no', 'sí pero no'], 'unknown',
    'un mensaje que acepta Y rechaza se resuelve hacia uno de los dos');
  cadaUna(['vale?', '¿sí?', 'ok?', 'acepto?', 'no?'], 'unknown', 'una PREGUNTA se toma por decisión');
  cadaUna(['', '   ', '👍', '...', '**', 'acepto 2', 'aceptaría si me bajas el precio'], 'unknown',
    'un mensaje sin decisión, o con algo más que la decisión, decide');
});

// ── 4 · Las listas son CERRADAS, y están aquí enteras ──────────────────────────────────────────

test('🔴 SCRUM-1322 · la cortesía es una lista BLANCA: ésta, entera, y cada una con su motivo', () => {
  const { CORTESIA } = listasDelModulo();
  // Si esta lista crece, «vale, cuánto sale si quito el IVA, gracias» acaba siendo una aceptación.
  // Añadir una palabra es cambiar ESTA línea a propósito, con su motivo al lado en el módulo.
  assert.deepEqual(Object.keys(CORTESIA).sort(), ['gracias', 'hola', 'muchas gracias', 'por favor']);
  for (const [palabra, motivo] of Object.entries(CORTESIA)) {
    assert.ok(typeof motivo === 'string' && motivo.length >= 10, `🔴 «${palabra}» está en la cortesía sin motivo`);
  }
  // La cortesía SOLA no decide nada, ni una ni todas juntas.
  cadaUna([...Object.keys(CORTESIA), Object.keys(CORTESIA).join(' ')], 'unknown', 'la cortesía sola decide');
  // Y no abre la puerta a lo de en medio.
  cadaUna(['vale, cuánto sale si quito el IVA, gracias', 'hola, no me llega el enlace, gracias',
    'ok gracias pero es caro', 'por favor mándamelo otra vez'], 'unknown',
    'la cortesía deja pasar una frase que no es una decisión');
});

test('SCRUM-1322 · el vocabulario que decide es éste, entero', () => {
  const { ACEPTA, RECHAZA, CORTESIA } = listasDelModulo();
  assert.deepEqual([...ACEPTA].sort(), [
    'acept', 'aceptado', 'aceptamos', 'aceptar', 'acepto', 'acepto el presupuesto', 'adelante',
    'claro que si', 'confirm', 'confirmado', 'confirmamos', 'confirmar', 'confirmo', 'dale', 'de acuerdo',
    'lo acepto', 'lo confirmo', 'lo quiero', 'me interesa',
    'quiero', 'sale', 'si',
  ]); // sin `claro`, `listo`, `ok`, `okay`, `okey`, `perfecto`, `va`, `vale`: desde SCRUM-1326 están en `PREGUNTA`
  assert.deepEqual([...RECHAZA].sort(), [
    'cancel', 'cancelado', 'cancelamos', 'cancelar', 'cancelo', 'claro que no', 'lo rechazo', 'mejor no',
    'negativo', 'nel', 'no', 'no acepto', 'no lo acepto', 'no lo quiero', 'no me interesa', 'no quiero',
    'paso', 'rechaz', 'rechazado', 'rechazamos', 'rechazar', 'rechazo', 'rechazo el presupuesto',
  ]);
  // Ninguna entrada en dos listas: si no, el orden de búsqueda decidiría en silencio.
  const todas = [...ACEPTA, ...RECHAZA, ...Object.keys(CORTESIA)];
  assert.equal(new Set(todas).size, todas.length, '🔴 una misma entrada está en dos listas');
  // Y cada entrada, sola, da lo que su lista dice (ninguna está de adorno ni tapada por otra).
  cadaUna(ACEPTA, 'accept', 'una entrada de ACEPTA no acepta');
  cadaUna(RECHAZA, 'reject', 'una entrada de RECHAZA no rechaza');
});

// ── 5 · Por EFECTO: el webhook real, con dobles ────────────────────────────────────────────────

const R = (rel) => require_.resolve(`./dist/${rel}`);
const R_RUTA = R('modules/whatsappBot/app/routes/whatsappIncoming.routes.js');
const { config } = require_('./dist/core/config/env.js');
const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const CLIENTE = '34611222333';
const PRO = '34600111222';
const SECRETO = 'secreto-de-prueba-scrum1322';
let serie = 0;

/** Un cliente con UN presupuesto en `sent` escribe `texto`. Devuelve lo que pasó de verdad. */
async function escribe(texto, { botEncendido = false } = {}) {
  const cambios = [];      // lo que se escribe en el presupuesto
  const envios = [];       // lo que sale por WhatsApp
  const alBot = [];        // lo que se le pasa al menú del bot
  delete require_.cache[R_RUTA];
  poner(R('core/db/prisma.js'), { prisma: {
    customer: {
      findMany: async () => [{ id: 3, merchantId: 42, name: 'Ana' }],
      findUnique: async () => ({ name: 'Ana' }),
    },
    quote: {
      findMany: async () => [{ id: 11, merchantId: 42, customerId: 3, status: 'sent', quoteNumber: 'P-0011', total: 250, currency: 'EUR' }],
      update: async (a) => { cambios.push(a.data.status); return {}; },
    },
    merchant: { findUnique: async () => ({ id: 42, name: 'Fontanería Ruiz', email: null, whatsappPhone: PRO,
      notifyEmailOnQuoteAccepted: false, country: 'ES', flags: null }) },
    whatsAppMessage: { findFirst: async () => null },
  } });
  poner(R('integrations/whatsapp.js'), {
    sendWhatsAppText: async (a) => { envios.push({ to: a.to, text: a.text }); return { ok: true }; },
    markInboundRead: async () => {},
  });
  poner(R('modules/messaging/domain/whatsappLog.service.js'), {
    recordInboundWaMessage: async () => {}, updateWaMessageStatus: async () => {},
  });
  poner(R('modules/jobs/domain/job.service.js'), { ensureJobForQuote: async () => {} });
  poner(R('integrations/whatsappNotifications.js'), { notifyMerchantAlert: async () => {} });
  poner(R('modules/maintenance/domain/maintenance.service.js'), { handleMaintenanceButton: async () => false });
  poner(R('modules/whatsappBot/domain/botFlow.service.js'), {
    handleBotMessage: async (_from, input) => { alBot.push(input.text); return true; },
    isMidIntake: async () => false,
    handleUnsupportedMedia: async () => {}, handleIncomingPhoto: async () => {},
  });

  const express = require_('express');
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use('/webhooks/whatsapp', require_(R_RUTA).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const secretoAntes = config.WHATSAPP_APP_SECRET;
  const flagAntes = process.env.BOT_INBOUND_ENABLED;
  config.WHATSAPP_APP_SECRET = SECRETO;
  process.env.BOT_INBOUND_ENABLED = botEncendido ? 'true' : 'false';
  try {
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [
      { from: CLIENTE, id: `wamid.s1322.${process.pid}.${++serie}`, type: 'text', text: { body: texto } },
    ] } }] }] });
    const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO).update(cuerpo).digest('hex');
    // `node:http` con `agent: false`, NUNCA `fetch` (SCRUM-1204, ver scrum910d).
    const estado = await new Promise((ok, ko) => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/webhooks/whatsapp',
        method: 'POST', agent: false,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo), 'X-Hub-Signature-256': firma } },
      (res) => { res.resume(); res.on('end', () => ok(res.statusCode)); });
      req.on('error', ko);
      req.end(cuerpo);
    });
    assert.equal(estado, 200, 'CIEGO: el webhook no aceptó el mensaje firmado; lo de abajo no mediría nada');
    // El webhook contesta 200 ANTES de procesar: se espera a que pase algo, y luego a que pare.
    const hecho = () => envios.length + alBot.length;
    for (let i = 0; i < 200 && hecho() === 0; i++) await new Promise((r) => setTimeout(r, 10));
    for (let antes = -1; antes !== hecho();) { antes = hecho(); await new Promise((r) => setTimeout(r, 40)); }
    return { cambios, alBot, alCliente: envios.filter((e) => e.to === CLIENTE).map((e) => e.text),
      alPro: envios.filter((e) => e.to === PRO).map((e) => e.text) };
  } finally {
    config.WHATSAPP_APP_SECRET = secretoAntes;
    if (flagAntes === undefined) delete process.env.BOT_INBOUND_ENABLED; else process.env.BOT_INBOUND_ENABLED = flagAntes;
    await new Promise((r) => server.close(r));
  }
}

const INSTRUCCION = /escribe \*[^*]+\* o \*[^*]+\*/;

test('🔴 SCRUM-1322 · por efecto: el cliente escribe lo que el bot le pidió, y el presupuesto se acepta', async () => {
  const { acepta, rechaza } = loQuePideElBot()[0];

  const si = await escribe(acepta);
  assert.deepEqual(si.cambios, ['accepted'], `🔴 «${acepta}» no acepta el presupuesto`);
  assert.equal(si.alCliente.length, 1, 'el cliente recibe UNA respuesta');
  assert.ok(!INSTRUCCION.test(si.alCliente[0]), `🔴 el bucle: a «${acepta}» se le contesta otra vez «escribe ${acepta}…»`);
  assert.equal(si.alPro.length, 1, 'el profesional se entera de la aceptación');

  const no = await escribe(rechaza);
  assert.deepEqual(no.cambios, ['rejected'], `🔴 «${rechaza}» no rechaza el presupuesto`);
  assert.equal(no.alPro.length, 1, 'el profesional se entera del rechazo');
});

test('🔴 SCRUM-1322 · por efecto: «no sé» y «va con IVA?» NO mueven el presupuesto ni avisan al profesional', async () => {
  // La última lleva «acept» dentro: una ruta que mirase la palabra por su cuenta la daría por buena.
  for (const frase of ['no sé', 'va con IVA?', 'no me llega el enlace', 'ok pero me lo tengo que pensar',
    'aceptaría si me bajas el precio']) {
    const r = await escribe(frase);
    assert.deepEqual(r.cambios, [], `🔴 «${frase}» ha cambiado el estado del presupuesto a ${r.cambios}`);
    assert.deepEqual(r.alPro, [], `🔴 «${frase}» le ha dicho al profesional que el cliente decidió`);
    // Control: el mensaje SÍ se procesó — el cliente recibe la instrucción, no un silencio.
    assert.equal(r.alCliente.length, 1, `CIEGO: «${frase}» no produjo respuesta; no sé si llegó a procesarse`);
    assert.match(r.alCliente[0], INSTRUCCION, `a «${frase}» se le contesta con la instrucción`);
  }
});

test('SCRUM-1322 · por efecto, con el bot encendido: lo que no es decisión va al bot, y la decisión NO', async () => {
  const duda = await escribe('no sé', { botEncendido: true });
  assert.deepEqual(duda.cambios, [], '🔴 con el bot encendido, «no sé» rechaza el presupuesto');
  assert.deepEqual(duda.alBot, ['no sé'], '«no sé» lo atiende el bot');

  const { acepta } = loQuePideElBot()[0];
  const si = await escribe(acepta, { botEncendido: true });
  assert.deepEqual(si.cambios, ['accepted'], `🔴 con el bot encendido, «${acepta}» no acepta`);
  assert.deepEqual(si.alBot, [], 'una decisión no se le pasa al menú del bot');
});
