// tests/scrum1601-transiciones-del-webhook-wa.test.mjs — SCRUM-1601 (regla 27, J2)
//
// QUÉ TRANSICIONES DE `WhatsAppMessage.status` APLICA EL WEBHOOK DE META, por la RUTA REAL.
//
// La Parte L del máster (`YAQU_MASTER.md`, «WhatsAppMessage») fija: `queued → sent → delivered →
// read` · `queued|sent → failed(error)` · `received` sin transiciones. J5 ejecutó
// `shouldApplyStatus` suelta y vio que dejaba pasar `delivered|read → failed` y `failed → lo que
// sea` (SCRUM-1499 c.20654 §6). Aquí se mide por donde de verdad llegan: un `POST
// /webhooks/whatsapp` firmado, con un evento `statuses` FABRICADO, a la APP ENTERA de `dist/app.js`
// (no se saca el manejador de su ruta, SCRUM-1344), sobre una fila con `waMessageId`.
//
// LO QUE SE DOBLA: la base (una en memoria con estado, la técnica de SCRUM-1509h). A Meta no se
// llama (`WHATSAPP_DRY_RUN`, y `fetch` revienta si alguien lo usa).
//
// Los SALTOS hacia delante ya están decididos. `sent → read` lo firmó el fundador (SCRUM-1601
// c.20673; la frase de la Parte L entra con SCRUM-1601b). `queued → delivered` y `queued → read`
// nadie los firmó, y se quitan del código (decisión c.20709, SCRUM-1601c): una fila `queued` no
// lleva `waMessageId`, así que el webhook no la encuentra y quitarlos no pierde ningún estado.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const requiere = createRequire(import.meta.url);

// Qué pieza trabaja (contrato de `scripts/meta-guard-mutaciones.mjs`, SCRUM-745).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Se quita la puerta del origen: `failed` (y `received`) vuelven a poder pisarse.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: 'if (cur < 0) return false;',
    a: '',
    cae: 'DESDE failed',
  },
  {
    // `failed` vuelve a aplicarse desde cualquier estado: lo que midió J5.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: 'return cur <= STATUS_RANK.sent;',
    a: 'return true;',
    cae: 'HACIA failed',
  },
  {
    // SCRUM-1601c · `queued` vuelve a saltar a `delivered` o a `read`, que nadie firmó.
    fichero: 'src/modules/messaging/domain/whatsappLog.service.ts',
    de: "if (cur === STATUS_RANK.queued) return next === 'sent';",
    a: '',
    cae: 'DESDE queued',
  },
];

for (const k of ['WA_CUSTOMER_DAILY_CAP', 'WA_DAILY_TEMPLATE_CAP', 'BOT_INBOUND_ENABLED']) delete process.env[k];
process.env.WHATSAPP_DRY_RUN = '1';

const SECRETO = 'laboratorio-1601';

// ── LA BASE EN MEMORIA ─────────────────────────────────────────────────────────────────────
const filas = [];
let lecturas = 0;
const casa = (f, where) => Object.entries(where || {}).every(([k, v]) => f[k] === v);
const mensajes = {
  findUnique: async ({ where }) => { lecturas += 1; return filas.find((f) => casa(f, where)) || null; },
  update: async ({ where, data }) => {
    const f = filas.find((x) => casa(x, where));
    if (!f) { const e = new Error('no casa'); e.code = 'P2025'; throw e; }
    Object.assign(f, data); return f;
  },
};
const neutro = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }), upsert: async () => ({ id: 1 }) };
const doble = new Proxy({}, { get: (_, m) => {
  if (m === '$transaction') return async (arg) => (typeof arg === 'function' ? arg(doble) : Promise.all(arg));
  if (m === '$executeRaw') return async () => 0;
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => (m === 'whatsAppMessage' && mensajes[met]) || neutro[met] });
} });
globalThis.prisma = doble;
globalThis.fetch = () => { throw new Error('BANCO: alguien llamó a fetch'); };
globalThis.__waDryRunOutbox = [];

const { config } = requiere('../dist/core/config/env.js');
config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1601';
config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1601';
config.WHATSAPP_APP_SECRET = SECRETO;
const { app } = requiere('../dist/app.js');
let servidor; let puerto;

// ── LOS ESTADOS ────────────────────────────────────────────────────────────────────────────
// Orígenes: los seis valores que la Parte L declara. Destinos: esos seis más uno que Meta no
// manda nunca a esta casa (`deleted`, inventado aquí), para ver qué hace con lo desconocido.
const ORIGENES = ['queued', 'sent', 'delivered', 'read', 'failed', 'received'];
const DESTINOS = [...ORIGENES, 'deleted'];
// Las que la Parte L dibuja como flecha, una a una.
const FIJADAS = new Set(['queued>sent', 'sent>delivered', 'delivered>read', 'queued>failed', 'sent>failed']);
// El único salto firmado (ver la cabecera).
const SALTO_FIRMADO = 'sent>read';

function pedir(cuerpo) {
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(cuerpo)).digest('hex');
  return new Promise((resolve, reject) => {
    const datos = Buffer.from(cuerpo);
    const req = http.request({ host: '127.0.0.1', port: puerto, path: '/webhooks/whatsapp', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': datos.length, 'x-hub-signature-256': firma } }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end(datos);
  });
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Matriz medida: `origen>destino` → ¿se aplicó? */
const aplicada = new Map();

test.before(async () => {
  servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;
  // Una fila por par, cada una con su `waMessageId`; y UN evento de Meta por par.
  const statuses = [];
  for (const o of ORIGENES) for (const d of DESTINOS) {
    const id = `wamid.lab-1601.${o}.${d}`;
    filas.push({ id: filas.length + 1, waMessageId: id, status: o, error: null });
    statuses.push({ id, status: d, ...(d === 'failed' ? { errors: [{ code: 131026, title: 'laboratorio' }] } : {}) });
  }
  // Testigo: una fila a la que no llega ningún evento no se mueve.
  filas.push({ id: filas.length + 1, waMessageId: 'wamid.lab-1601.testigo', status: 'sent', error: null });
  for (const st of statuses) {
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { statuses: [st] } }] }] });
    assert.equal(await pedir(cuerpo), 200);
  }
  // El webhook contesta 200 y sigue por detrás: se espera a que haya leído las 42 filas.
  for (let i = 0; i < 300 && lecturas < statuses.length; i += 1) await dormir(10);
  await dormir(30);
  for (const o of ORIGENES) for (const d of DESTINOS) {
    const f = filas.find((x) => x.waMessageId === `wamid.lab-1601.${o}.${d}`);
    aplicada.set(`${o}>${d}`, f.status !== o || (o === d && f.error !== null));
  }
  const tabla = ORIGENES.map((o) => `${o.padEnd(9)} → ` + DESTINOS.map((d) => `${d}:${aplicada.get(`${o}>${d}`) ? 'SÍ' : 'no'}`).join(' ')).join('\n');
  console.log('[SCRUM-1601] matriz medida por el webhook (origen → destino:¿se aplica?)\n' + tabla);
});
test.after(() => servidor?.close());

test('SCRUM-1601 · CONTROL: el webhook leyó una fila por evento, y el testigo no se movió', () => {
  assert.equal(lecturas, ORIGENES.length * DESTINOS.length, 'el webhook no llegó a todas las filas: la matriz no vale');
  assert.equal(filas.at(-1).status, 'sent');
});

test('SCRUM-1601 · POSITIVO: las cinco flechas de la Parte L se aplican', () => {
  for (const par of FIJADAS) assert.equal(aplicada.get(par), true, `${par} es de la Parte L y no se aplicó`);
  const f = filas.find((x) => x.waMessageId === 'wamid.lab-1601.sent.failed');
  assert.equal(f.error, '131026: laboratorio', 'el error de Meta no se guardó con el failed');
});

test('SCRUM-1601c · el salto firmado sent → read se aplica', () => {
  assert.equal(aplicada.get(SALTO_FIRMADO), true, 'sent → read está firmado (c.20673) y no se aplicó');
});

test('SCRUM-1601c · DESDE queued: sólo a sent o a failed (queued → delivered y queued → read no se aplican)', () => {
  for (const d of ['delivered', 'read']) assert.equal(aplicada.get(`queued>${d}`), false, `queued → ${d} se aplicó`);
});

test('SCRUM-1601 · HACIA failed: sólo desde queued o sent (delivered → failed y read → failed no se aplican)', () => {
  for (const o of ['delivered', 'read']) assert.equal(aplicada.get(`${o}>failed`), false, `${o} → failed se aplicó`);
});

test('SCRUM-1601 · DESDE failed y received: nada se aplica (la Parte L no fija ninguna salida)', () => {
  for (const o of ['failed', 'received']) for (const d of DESTINOS) {
    assert.equal(aplicada.get(`${o}>${d}`), false, `${o} → ${d} se aplicó`);
  }
});

test('SCRUM-1601 · lo demás tampoco: ni hacia atrás, ni repetido, ni a queued/received, ni a un estado desconocido', () => {
  const resto = [];
  for (const o of ORIGENES) for (const d of DESTINOS) {
    const par = `${o}>${d}`;
    if (FIJADAS.has(par) || par === SALTO_FIRMADO || o === 'failed' || o === 'received' || d === 'failed') continue;
    resto.push(par);
  }
  assert.ok(resto.length > 0);
  for (const par of resto) assert.equal(aplicada.get(par), false, `${par} se aplicó`);
});
