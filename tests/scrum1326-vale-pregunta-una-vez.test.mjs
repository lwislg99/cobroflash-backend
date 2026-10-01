// tests/scrum1326-vale-pregunta-una-vez.test.mjs — SCRUM-1326
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Un cliente que contesta «vale» a un presupuesto lo ACEPTABA: estado `accepted`, se creaba el
// Trabajo y al profesional se le decía que su cliente había aceptado. Y «vale» puede ser sólo
// «recibido». El fundador firmó (SCRUM-1326, comentario 17692) que cinco palabras —`vale`, `ok`,
// `perfecto`, `listo`, `claro`—, sueltas, dejan de aceptar: el bot PREGUNTA, con un texto firmado.
//
// Lo que se sostiene aquí, por EFECTO en el webhook real (dobles en `require.cache`, el mismo
// harness que `tests/scrum1322-el-bot-entiende-lo-que-pide.test.mjs`):
//   · «vale» no mueve el presupuesto, no crea el Trabajo y no avisa al profesional;
//   · «Acepto», «sí», «confirmo», «aceptar» SIGUEN aceptando sin pregunta intermedia;
//   · si el cliente no contesta a la pregunta, el presupuesto está en `sent` y NADA más se ha
//     escrito en ningún sitio: no hay estado intermedio, ni en la fila ni fuera de ella;
//   · el texto que sale es el de la ficha firmada, letra a letra.
//
// 🔴 Ni BD, ni red, ni staging. ⛔ El texto firmado NO se copia aquí: se LEE de su ficha.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const RUTA_SRC = path.join(RAIZ, 'src/modules/whatsappBot/app/routes/whatsappIncoming.routes.ts');
const MODULO_SRC = path.join(RAIZ, 'src/modules/whatsappBot/domain/decisionPorTexto.ts');
const { parseDecision } = require_('./dist/modules/whatsappBot/domain/decisionPorTexto.js');

// Las DOS listas de la decisión firmada en SCRUM-1326 (comentario 17692;
// `docs/microcopy/2026-10-01-SCRUM-1326-vale-pregunta-una-vez.md`), no las del módulo: si el módulo
// cambia de opinión sobre una de estas nueve, este fichero cae.
const PREGUNTAN = ['vale', 'ok', 'perfecto', 'listo', 'claro'];
const ACEPTAN_SIN_PREGUNTA = ['Acepto', 'sí', 'confirmo', 'aceptar'];

/** Cada entrada, una por una y con su nombre: un fallo dice QUÉ frase. */
function cadaUna(entradas, esperado, porQue) {
  const mal = entradas.filter((e) => parseDecision(e) !== esperado)
    .map((e) => `${JSON.stringify(e)} → ${parseDecision(e)}`);
  assert.deepEqual(mal, [], `🔴 ${porQue} (esperado «${esperado}», población ${entradas.length})`);
}

// ── La ficha firmada ───────────────────────────────────────────────────────────────────────────

const HUECO = '{número}';

/** El texto firmado, LEÍDO de su ficha (por ticket y ranura, SCRUM-1306), con su hueco. */
function textoFirmado() {
  const ficha = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1326' && a.ranura === 'vale-pregunta-una-vez');
  assert.ok(ficha, '🔴 CIEGO: no encuentro la ficha de SCRUM-1326 en docs/microcopy/');
  assert.equal(ficha.aprobada, true, '🔴 la ficha de SCRUM-1326 no lleva una firma que cuente');
  const md = fs.readFileSync(path.join(RAIZ, ficha.ruta), 'utf8');
  const citas = [];
  let dentro = false;
  for (const linea of md.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(linea)) { dentro = /texto\s+aprobado/i.test(linea); continue; }
    const m = /^>\s?(.+)$/.exec(linea.trim());
    if (dentro && m) citas.push(m[1].trim());
  }
  assert.equal(citas.length, 1, `🔴 CIEGO: esperaba UNA cita bajo «Texto aprobado» y hay ${citas.length}`);
  assert.equal(citas[0].split(HUECO).length - 1, 1, '🔴 CIEGO: la cita no lleva su hueco exactamente una vez');
  return citas[0];
}
const laPregunta = (numero) => textoFirmado().replace(HUECO, String(numero));

// ── El webhook real, con dobles y un presupuesto que RECUERDA ──────────────────────────────────

const R = (rel) => require_.resolve(`./dist/${rel}`);
const R_RUTA = R('modules/whatsappBot/app/routes/whatsappIncoming.routes.js');
const { config } = require_('./dist/core/config/env.js');
const poner = (r, e) => { require_.cache[r] = { id: r, filename: r, loaded: true, exports: e }; };

const CLIENTE = '34611222333';
const PRO = '34600111222';
const SECRETO = 'secreto-de-prueba-scrum1326';
const LECTURAS = new Set(['findMany', 'findUnique', 'findFirst', 'count']);
let serie = 0;

/**
 * Un cliente con UN presupuesto en `sent`. Devuelve `escribe(texto)`, que manda UN mensaje por el
 * webhook real y cuenta lo que ese mensaje provocó. El presupuesto es el mismo entre mensajes: lo
 * que uno escribe, lo lee el siguiente. Y CUALQUIER escritura en CUALQUIER tabla queda apuntada,
 * también en una que este doble no conoce: «no se escribió nada» se mide, no se supone.
 */
async function conversacion({ quoteNumber = 'P-0011', botEncendido = false, enCaptacion = false } = {}) {
  const presupuesto = { id: 11, merchantId: 42, customerId: 3, status: 'sent', quoteNumber, total: 250, currency: 'EUR' };
  const escrituras = [];
  const trabajos = [];
  const envios = [];
  const alBot = [];

  const modelo = (nombre, conocidos) => new Proxy(conocidos, {
    get(t, metodo) {
      if (metodo in t) return t[metodo];
      if (typeof metodo !== 'string' || metodo === 'then') return undefined;
      return async (a) => { if (!LECTURAS.has(metodo)) escrituras.push({ modelo: nombre, metodo, data: a?.data }); return null; };
    },
  });
  const prisma = new Proxy({
    customer: modelo('customer', {
      findMany: async () => [{ id: 3, merchantId: 42, name: 'Ana' }],
      findUnique: async () => ({ name: 'Ana' }),
    }),
    quote: modelo('quote', {
      findMany: async (a) => (a?.where?.status === undefined || a.where.status === presupuesto.status ? [{ ...presupuesto }] : []),
      update: async (a) => { escrituras.push({ modelo: 'quote', metodo: 'update', data: a.data }); Object.assign(presupuesto, a.data); return {}; },
    }),
    merchant: modelo('merchant', {
      findUnique: async () => ({ id: 42, name: 'Fontanería Ruiz', email: null, whatsappPhone: PRO,
        notifyEmailOnQuoteAccepted: false, country: 'ES', flags: null }),
    }),
    whatsAppMessage: modelo('whatsAppMessage', { findFirst: async () => null }),
  }, {
    get(t, tabla) {
      if (tabla in t) return t[tabla];
      if (typeof tabla !== 'string' || tabla === 'then') return undefined;
      return modelo(tabla, {});
    },
  });

  delete require_.cache[R_RUTA];
  poner(R('core/db/prisma.js'), { prisma });
  poner(R('integrations/whatsapp.js'), {
    sendWhatsAppText: async (a) => { envios.push(a); return { ok: true }; },
    markInboundRead: async () => {},
  });
  poner(R('modules/messaging/domain/whatsappLog.service.js'), {
    recordInboundWaMessage: async () => {}, updateWaMessageStatus: async () => {},
  });
  poner(R('modules/jobs/domain/job.service.js'), { ensureJobForQuote: async (id) => { trabajos.push(id); } });
  poner(R('integrations/whatsappNotifications.js'), { notifyMerchantAlert: async () => {} });
  poner(R('modules/maintenance/domain/maintenance.service.js'), { handleMaintenanceButton: async () => false });
  poner(R('modules/whatsappBot/domain/botFlow.service.js'), {
    handleBotMessage: async (_from, input) => { alBot.push(input.text); return true; },
    isMidIntake: async () => enCaptacion,
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

  async function escribe(texto) {
    const desde = { escrituras: escrituras.length, trabajos: trabajos.length, envios: envios.length, alBot: alBot.length };
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { messages: [
      { from: CLIENTE, id: `wamid.s1326.${process.pid}.${++serie}`, type: 'text', text: { body: texto } },
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
    const antesDeEste = desde.envios + desde.alBot;
    for (let i = 0; i < 200 && hecho() === antesDeEste; i++) await new Promise((r) => setTimeout(r, 10));
    for (let antes = -1; antes !== hecho();) { antes = hecho(); await new Promise((r) => setTimeout(r, 40)); }
    const suyos = envios.slice(desde.envios);
    return {
      estado: presupuesto.status,
      escrituras: escrituras.slice(desde.escrituras),
      trabajos: trabajos.slice(desde.trabajos),
      alBot: alBot.slice(desde.alBot),
      envios: suyos,
      alCliente: suyos.filter((e) => e.to === CLIENTE).map((e) => e.text),
      alPro: suyos.filter((e) => e.to === PRO).map((e) => e.text),
    };
  }
  async function cerrar() {
    config.WHATSAPP_APP_SECRET = secretoAntes;
    if (flagAntes === undefined) delete process.env.BOT_INBOUND_ENABLED; else process.env.BOT_INBOUND_ENABLED = flagAntes;
    await new Promise((r) => server.close(r));
  }
  return { escribe, cerrar, presupuesto };
}

/** Un mensaje suelto sobre un presupuesto recién enviado. */
async function escribe(texto, opciones) {
  const c = await conversacion(opciones);
  try { return await c.escribe(texto); } finally { await c.cerrar(); }
}

// ── 1 · 🔴 El defecto, por efecto ──────────────────────────────────────────────────────────────

test('🔴 SCRUM-1326 · por efecto: «vale» NO acepta el presupuesto, NO crea el Trabajo y NO avisa al profesional', async () => {
  for (const palabra of PREGUNTAN) {
    const r = await escribe(palabra);
    assert.equal(r.estado, 'sent', `🔴 «${palabra}» ha movido el presupuesto a «${r.estado}»`);
    assert.deepEqual(r.escrituras, [], `🔴 «${palabra}» ha escrito en la base`);
    assert.deepEqual(r.trabajos, [], `🔴 «${palabra}» ha creado el Trabajo`);
    assert.deepEqual(r.alPro, [], `🔴 «${palabra}» le ha dicho al profesional que su cliente aceptó`);
    // Control: el mensaje SÍ se procesó. Un silencio también dejaría todo lo de arriba vacío.
    assert.deepEqual(r.alCliente, [laPregunta('P-0011')], `«${palabra}» recibe la pregunta firmada, una vez y entera`);
  }
});

test('SCRUM-1326 · por efecto: como lo teclea un móvil, con cortesía o con dos a la vez, sigue preguntando', async () => {
  for (const frase of ['Vale', 'VALE', 'vale.', 'Ok!', '*vale*', 'vale, gracias', 'ok, muchas gracias', 'hola, vale',
    'ok perfecto', 'vale vale', 'claro, perfecto', 'v\xe1le', 'Perfecto 👍']) {
    const r = await escribe(frase);
    assert.equal(r.estado, 'sent', `🔴 «${frase}» ha movido el presupuesto a «${r.estado}»`);
    assert.deepEqual(r.trabajos, [], `🔴 «${frase}» ha creado el Trabajo`);
    assert.deepEqual(r.alCliente, [laPregunta('P-0011')], `«${frase}» recibe la pregunta firmada`);
  }
});

// ── 2 · El positivo: lo que protege lo ganado ──────────────────────────────────────────────────

test('🔴 SCRUM-1326 · por efecto: «Acepto», «sí», «confirmo» y «aceptar» aceptan SIN pregunta intermedia', async () => {
  for (const palabra of ACEPTAN_SIN_PREGUNTA) {
    const r = await escribe(palabra);
    assert.equal(r.estado, 'accepted', `🔴 «${palabra}» ya no acepta el presupuesto a la primera`);
    assert.deepEqual(r.trabajos, [11], `🔴 «${palabra}» no crea el Trabajo`);
    assert.equal(r.alPro.length, 1, `🔴 «${palabra}»: el profesional no se entera de la aceptación`);
    assert.equal(r.alCliente.length, 1, `«${palabra}»: el cliente recibe UNA respuesta`);
    assert.notEqual(r.alCliente[0], laPregunta('P-0011'), `🔴 a «${palabra}» se le ha metido la pregunta por medio`);
  }
  // Y una palabra de las que preguntan, si va CON una de las que aceptan, no añade un paso.
  for (const frase of ['sí, vale', 'vale, acepto', 'ok, confirmo', 'claro que sí', 'perfecto, lo acepto']) {
    const r = await escribe(frase);
    assert.equal(r.estado, 'accepted', `🔴 «${frase}» lleva una aceptación clara y no acepta`);
  }
});

test('SCRUM-1326 · control: «No» sigue rechazando, y lo que no es una decisión sigue recibiendo la instrucción de siempre', async () => {
  const no = await escribe('No');
  assert.equal(no.estado, 'rejected', '🔴 «No» ya no rechaza');
  assert.equal(no.alPro.length, 1, 'el profesional se entera del rechazo');

  const duda = await escribe('va con IVA?');
  assert.equal(duda.estado, 'sent');
  assert.equal(duda.alCliente.length, 1);
  assert.notEqual(duda.alCliente[0], laPregunta('P-0011'), '🔴 a quien NO se le ha entendido se le contesta «Entendido»');
  assert.match(duda.alCliente[0], /escribe \*[^*]+\* o \*[^*]+\*/, 'el «no te entiendo» de siempre');

  // Lo que lleva las dos direcciones no decide ni pregunta (como antes de este ticket).
  const lasDos = await escribe('vale no');
  assert.equal(lasDos.estado, 'sent');
  assert.notEqual(lasDos.alCliente[0], laPregunta('P-0011'), '🔴 «vale no» recibe la pregunta de confirmación');
});

// ── 3 · ⚠️ El control del que no contesta ──────────────────────────────────────────────────────

test('🔴 SCRUM-1326 · si el cliente NO contesta a la pregunta, el presupuesto está en `sent` y no se ha escrito NADA', async () => {
  const c = await conversacion();
  try {
    const antes = JSON.stringify(c.presupuesto);
    const r = await c.escribe('vale');
    // Y aquí el cliente no vuelve a escribir. Lo que queda es esto:
    assert.equal(JSON.stringify(c.presupuesto), antes, '🔴 la pregunta ha tocado la fila del presupuesto');
    assert.deepEqual(r.escrituras, [], '🔴 la pregunta deja algo escrito en alguna tabla: eso es un estado intermedio');
    assert.equal(c.presupuesto.status, 'sent');
    // Control del instrumento: una escritura en una tabla que el doble NO conoce sí se apunta.
    const r2 = await c.escribe('Acepto');
    assert.deepEqual(r2.escrituras.map((e) => `${e.modelo}.${e.metodo}`), ['quote.update'],
      'CIEGO: el doble no apunta las escrituras, así que «no se escribió nada» no valía');
  } finally { await c.cerrar(); }
});

test('SCRUM-1326 · después de la pregunta, «Acepto» acepta y «No» rechaza: la pregunta se puede contestar', async () => {
  const si = await conversacion();
  try {
    await si.escribe('vale');
    const r = await si.escribe('Acepto');
    assert.equal(r.estado, 'accepted', '🔴 tras la pregunta, «Acepto» no acepta');
    assert.deepEqual(r.trabajos, [11]);
    assert.equal(r.alPro.length, 1);
  } finally { await si.cerrar(); }

  const no = await conversacion();
  try {
    await no.escribe('ok');
    const r = await no.escribe('No');
    assert.equal(r.estado, 'rejected', '🔴 tras la pregunta, «No» no rechaza');
    assert.deepEqual(r.trabajos, []);
  } finally { await no.cerrar(); }
});

test('SCRUM-1326 · un segundo «vale» tampoco acepta: el bot no guarda que preguntó, así que vuelve a preguntar', async () => {
  // No hay memoria de la pregunta (ni estado ni marca): es lo que hace que «no contesta» sea
  // exactamente `sent`. La consecuencia, medida y declarada: quien repite «vale» recibe la misma
  // pregunta otra vez, y sólo «Acepto» (o las otras claras) acepta.
  const c = await conversacion();
  try {
    await c.escribe('vale');
    const r = await c.escribe('vale');
    assert.equal(r.estado, 'sent', '🔴 el segundo «vale» acepta');
    assert.deepEqual(r.escrituras, []);
    assert.deepEqual(r.trabajos, []);
    assert.deepEqual(r.alCliente, [laPregunta('P-0011')]);
  } finally { await c.cerrar(); }
});

// ── 4 · El texto firmado, y a quién se le manda ────────────────────────────────────────────────

test('🔴 SCRUM-1326 · lo que sale es el texto de la ficha firmada, letra a letra, con el mismo número que el «no te entiendo»', async () => {
  for (const [quoteNumber, esperado] of [['P-0011', 'P-0011'], [null, '11']]) {
    const c = await conversacion({ quoteNumber });
    try {
      const pregunta = (await c.escribe('vale')).alCliente;
      assert.deepEqual(pregunta, [laPregunta(esperado)], `con quoteNumber=${quoteNumber}`);
      // El número es el MISMO que usa el mensaje de «no te entiendo» para ese presupuesto.
      const noEntiendo = (await c.escribe('va con IVA?')).alCliente[0];
      const suNumero = /presupuesto #(\S+?),/.exec(noEntiendo);
      assert.ok(suNumero, 'CIEGO: no encuentro el número en el mensaje de «no te entiendo»');
      assert.equal(suNumero[1], esperado);
      assert.ok(pregunta[0].includes(`#${suNumero[1]}:`), '🔴 la pregunta nombra el presupuesto con otro número');
    } finally { await c.cerrar(); }
  }
  // La ficha lleva lo que el comentario firmado dice que no se toca: el arranque, lo que pasa al
  // aceptar, las dos negritas de WhatsApp, y NINGÚN enlace.
  const t = textoFirmado();
  assert.ok(t.startsWith('Entendido 🙌 '), '🔴 la ficha no empieza como lo firmado');
  assert.ok(t.includes('y avisamos a tu profesional'), '🔴 la ficha no dice qué pasa al aceptar');
  assert.deepEqual([...t.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]), ['Acepto', 'No'], '🔴 las negritas de WhatsApp no son las firmadas');
  assert.ok(!/enlace|https?:/i.test(t), '🔴 la pregunta lleva un enlace, y se firmó SIN él');
});

test('SCRUM-1326 · la pregunta es una RESPUESTA a quien escribió: un envío, al cliente, declarado como respuesta', async () => {
  const r = await escribe('vale');
  assert.equal(r.envios.length, 1, '🔴 «vale» provoca más de un envío');
  const [e] = r.envios;
  assert.equal(e.to, CLIENTE, '🔴 la pregunta sale hacia alguien que no es quien escribió');
  assert.equal(e.merchantId, 42, 'el envío es del negocio del presupuesto');
  assert.equal(e.exentoDelDemo, 'respuesta-a-entrante');
  assert.equal(e.exentoDeLaBaja, 'respuesta-a-entrante');
});

test('🔴 SCRUM-1326 · las dos palabras que la pregunta pide escribir DECIDEN, sin otra pregunta', () => {
  const pedidas = [...textoFirmado().matchAll(/\*([^*]+)\*/g)].map((m) => m[1]);
  assert.equal(pedidas.length, 2, 'CIEGO: esperaba dos palabras en negrita en la pregunta');
  assert.equal(parseDecision(pedidas[0]), 'accept', `🔴 el bucle: la pregunta pide «${pedidas[0]}» y eso no acepta`);
  assert.equal(parseDecision(pedidas[1]), 'reject', `🔴 la pregunta pide «${pedidas[1]}» y eso no rechaza`);
  // Tal cual las ve en pantalla, con los asteriscos.
  assert.equal(parseDecision(`*${pedidas[0]}*`), 'accept');
  assert.equal(parseDecision(`*${pedidas[1]}*`), 'reject');
});

// ── 5 · Con el bot encendido ───────────────────────────────────────────────────────────────────

test('SCRUM-1326 · con el bot encendido: «vale» sobre UN presupuesto enviado pregunta; a mitad de captación es del bot', async () => {
  const r = await escribe('vale', { botEncendido: true });
  assert.equal(r.estado, 'sent', '🔴 con el bot encendido, «vale» acepta');
  assert.deepEqual(r.trabajos, []);
  assert.deepEqual(r.alBot, [], 'la pregunta no pasa por el menú del bot');
  assert.deepEqual(r.alCliente, [laPregunta('P-0011')]);

  const si = await escribe('Acepto', { botEncendido: true });
  assert.equal(si.estado, 'accepted', '🔴 con el bot encendido, «Acepto» no acepta');

  // B1 (7-jul): a mitad de la captación de un presupuesto nuevo, «vale» es la respuesta AL BOT.
  const captando = await escribe('vale', { botEncendido: true, enCaptacion: true });
  assert.deepEqual(captando.alBot, ['vale']);
  assert.deepEqual(captando.alCliente, [], '🔴 a mitad de captación se le cuela la pregunta del presupuesto viejo');
  assert.equal(captando.estado, 'sent');
});

// ── 6 · La función, y la lista CERRADA ─────────────────────────────────────────────────────────

/** Una lista de literales del módulo, LEÍDA por AST (no se exporta: scrum411). */
function listaDelModulo(nombre) {
  const sf = ts.createSourceFile(MODULO_SRC, fs.readFileSync(MODULO_SRC, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (d.name.getText(sf) !== nombre || !d.initializer || !ts.isArrayLiteralExpression(d.initializer)) continue;
      assert.ok(d.initializer.elements.every((e) => ts.isStringLiteral(e)), `CIEGO: ${nombre} lleva algo que no es un literal`);
      return d.initializer.elements.map((e) => e.text);
    }
  }
  assert.fail(`🔴 CIEGO: no encuentro la lista ${nombre} en el módulo`);
}

test('🔴 SCRUM-1326 · las que preguntan son CINCO, las firmadas, y ninguna más', () => {
  assert.deepEqual([...listaDelModulo('PREGUNTA')].sort(), [...PREGUNTAN].sort(),
    '🔴 la lista de las que preguntan no es la que firmó el fundador (SCRUM-1326, comentario 17692)');
  // Ninguna de las cinco sigue, además, entre las que aceptan: el orden de búsqueda decidiría.
  const acepta = listaDelModulo('ACEPTA');
  assert.deepEqual(PREGUNTAN.filter((p) => acepta.includes(p)), [], '🔴 una palabra está en las dos listas');
  // Las cuatro que el fundador nombró como claras siguen en la de aceptar.
  assert.deepEqual(['acepto', 'si', 'confirmo', 'aceptar'].filter((p) => !acepta.includes(p)), []);
});

test('SCRUM-1326 · la función: sueltas preguntan; con una aceptación clara, aceptan; con un rechazo o una pregunta, nada', () => {
  cadaUna(PREGUNTAN, 'ask', 'una de las cinco, suelta, no pregunta');
  cadaUna(ACEPTAN_SIN_PREGUNTA, 'accept', 'una de las cuatro claras ya no acepta a la primera');
  cadaUna(['vale, gracias', 'hola, ok', 'ok perfecto', 'listo listo', 'claro, por favor', '*vale*', ' VALE ', 'ok.', 'listo!'],
    'ask', 'una de las cinco, con cortesía o con otra de las cinco, no pregunta');
  cadaUna(['sí, vale', 'vale, acepto', 'ok confirmo', 'claro que sí', 'perfecto, aceptar'], 'accept',
    'una aceptación clara, acompañada de una de las cinco, no acepta');
  cadaUna(['vale no', 'no, vale', 'ok, no gracias'], 'unknown', 'una de las cinco con un rechazo decide algo');
  assert.equal(parseDecision('claro que no'), 'reject', '«claro que no» es un rechazo entero');
  cadaUna(['vale?', '¿ok?', 'listo?'], 'unknown', 'una PREGUNTA del cliente provoca la pregunta del bot');
  cadaUna(['vales', 'oka', 'listos', 'clarooo', 'perfectos', 'vale cuanto', 'ok pero me lo tengo que pensar'], 'unknown',
    'algo que sólo EMPIEZA como una de las cinco, o que trae más cosas, pregunta');
});

test('SCRUM-1326 · con tildes, en las dos formas en que puede llegar el carácter (SCRUM-1325)', () => {
  // El corrector del móvil pone tildes donde no van. Ni parten la palabra ni la cambian de clase.
  const conTilde = ['v\xe1le', 'val\xe9', '\xf3k', 'perf\xe9cto', 'l\xedsto', 'cl\xe1ro', 'V\xc1LE'];
  const descompuestas = conTilde.map((p) => p.normalize('NFD'));
  assert.ok(conTilde.every((p, i) => p !== descompuestas[i]), 'CIEGO: las dos formas son la misma cadena y no mido dos cosas');
  cadaUna(conTilde, 'ask', 'una tilde (carácter compuesto) cambia lo que el bot entiende');
  cadaUna(descompuestas, 'ask', 'una tilde (carácter + tilde combinatoria) cambia lo que el bot entiende');
  // Y las claras, con su tilde y sin ella, siguen siendo claras.
  cadaUna(['s\xed', 's\xed'.normalize('NFD'), 'S\xcd', 'si', 'ac\xe9pto', 'conf\xedrmo'], 'accept', 'una clara con tilde deja de aceptar');
  // Detrás de una vocal con tilde no hay «frontera de palabra» sin modo unicode: que no se pegue.
  cadaUna(['s\xed vale', 'vale s\xed', 's\xed, ok'], 'accept', '«sí» pegada a una de las cinco no se separa');
});
