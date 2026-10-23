// docs/master/evidencias/SCRUM-1518/sonda-1518-punta-a-punta.mjs — SCRUM-1518 (S4, 22-oct-2026)
//
// REPRODUCIR DE PUNTA A PUNTA: un WhatsApp que ESCRIBE el cliente → qué se guarda → qué devuelve
// la ruta de su ficha → qué pinta la pestaña «WhatsApp» y qué dice el chip.
//
// LO QUE ES REAL Y LO QUE SE DOBLA (la técnica de `tests/scrum1262-la-baja-corta-todas-las-vias`):
//   · REAL: el router del webhook (`dist/.../whatsappIncoming.routes.js`) con su firma HMAC, el
//     registro del entrante (`recordInboundWaMessage`), el de estados (`updateWaMessageStatus`), la
//     consulta de la ficha (`historialWhatsAppDelCliente`) y la vista (`renderCustomer360View` + el
//     chip `waDeliveryChip`, en el banco de vistas).
//   · DOBLE: la base (`require.cache` de `dist/core/db/prisma.js`, en memoria) y Meta
//     (`WHATSAPP_DRY_RUN=1`). El secreto de la firma es aleatorio, de cada pasada.
//   ⛔ No sale un byte hacia Meta y no se toca ninguna base. El teléfono es del rango imposible.
//
// CONTROL POSITIVO: junto al entrante se siembra un ENVÍO de verdad (plantilla de presupuesto) y el
// webhook le manda `delivered`. Si la pestaña no lo pinta «Entregado», la sonda no está mirando.
// Y un estado desconocido de Meta (`warning`) para ver si llega a la fila.
//
// Salida: 0 reproducido (el entrante sale como «Enviado») · 1 NO reproducido · 2 no supe mirar.
// Uso: node docs/master/evidencias/SCRUM-1518/sonda-1518-punta-a-punta.mjs
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));

// ANTES de cargar `dist/`: `config` se congela al importarse. El secreto de la firma se genera en
// cada pasada (como `tests/scrum100-webhooks-fail-closed`): ninguna clave escrita en un fichero (A7).
const SECRETO = crypto.randomBytes(16).toString('hex');
process.env.WHATSAPP_DRY_RUN = '1';
process.env.WHATSAPP_APP_SECRET = SECRETO;

const { telefonoDePrueba } = await import(new URL('../../../../scripts/_telefonos-prueba.mjs', import.meta.url));
const MERCHANT = 4242;
const CLIENTE = 15180;
const TELEFONO = telefonoDePrueba(15180001);
const PRESUPUESTO = 77;

// ── LA BASE, EN MEMORIA ───────────────────────────────────────────────────────────────────────
const mensajes = [];
let siguienteId = 1;
const clientes = [{ id: CLIENTE, merchantId: MERCHANT, phone: TELEFONO, name: 'Cliente de la sonda', waOptOut: false }];
const casa = (fila, where) => Object.entries(where || {}).every(([k, v]) => {
  if (v === null || typeof v !== 'object') return fila[k] === v;
  if (Array.isArray(v.in)) return v.in.includes(fila[k]);
  // SCRUM-1518b (S1): `not` SÍ filtra. El arreglo es `type: { not: 'inbound' }`, y con `not` ignorado
  // la sonda seguía diciendo «reproducido» con el arreglo puesto: pasaba en vacío para esa forma.
  if ('not' in v && (v.not === null || typeof v.not !== 'object')) return fila[k] !== v.not;
  return true; // el resto de operadores (gte…) no los necesita esta sonda: no filtran
});
const propias = {
  'customer.findMany': (a) => clientes.filter((c) => casa(c, a && a.where)),
  'customer.findFirst': (a) => clientes.find((c) => casa(c, a && a.where)) || null,
  'whatsAppMessage.create': (a) => { const f = { id: siguienteId++, createdAt: new Date(), updatedAt: new Date(), ...a.data }; mensajes.push(f); return f; },
  'whatsAppMessage.createMany': (a) => {
    for (const d of a.data) mensajes.push({ id: siguienteId++, createdAt: new Date(), updatedAt: new Date(), templateName: null, error: null, relatedType: null, relatedId: null, waMessageId: null, ...d });
    return { count: a.data.length };
  },
  'whatsAppMessage.findUnique': (a) => mensajes.find((m) => casa(m, a.where)) || null,
  'whatsAppMessage.update': (a) => { const m = mensajes.find((x) => casa(x, a.where)); Object.assign(m, a.data, { updatedAt: new Date() }); return m; },
  'whatsAppMessage.findMany': (a) => {
    const filas = mensajes.filter((m) => casa(m, a.where)).sort((x, y) => y.id - x.id);
    return filas.map((m) => (a.select ? Object.fromEntries(Object.keys(a.select).map((k) => [k, m[k] ?? null])) : m));
  },
};
const porDefecto = (metodo) => (metodo === 'findMany' ? [] : metodo === 'count' ? 0 : /^find/.test(metodo) ? null : {});
const consultas = [];
const modelo = (nombre) => new Proxy({}, { get: (_t, metodo) => async (args) => {
  consultas.push(`${nombre}.${String(metodo)}`);
  const p = propias[`${nombre}.${String(metodo)}`];
  return p ? p(args) : porDefecto(String(metodo));
} });
const cacheModelos = new Map();
const cliente = new Proxy({}, { get: (_t, prop) => {
  const n = String(prop);
  if (n === '$transaction') return async (arg) => (typeof arg === 'function' ? arg(cliente) : Promise.all(arg));
  if (n.startsWith('$')) return async () => undefined;
  if (!cacheModelos.has(n)) cacheModelos.set(n, modelo(n));
  return cacheModelos.get(n);
} });
const rutaPrisma = requiere.resolve('./dist/core/db/prisma.js');
requiere.cache[rutaPrisma] = { id: rutaPrisma, filename: rutaPrisma, loaded: true, exports: { prisma: cliente } };

const express = requiere('express');
const router = requiere('./dist/modules/whatsappBot/app/routes/whatsappIncoming.routes.js').default;
const { historialWhatsAppDelCliente } = requiere('./dist/modules/system/domain/historialWhatsAppDelCliente.js');

// El ENVÍO del control positivo: lo que deja un presupuesto mandado por plantilla.
mensajes.push({ id: siguienteId++, merchantId: MERCHANT, customerId: CLIENTE, toPhone: TELEFONO, type: 'template',
  templateName: 'presupuesto_enviado', waMessageId: 'wamid.SONDA1518.SALIENTE', status: 'sent', error: null,
  relatedType: 'quote', relatedId: PRESUPUESTO, createdAt: new Date(Date.now() - 3600e3), updatedAt: new Date() });

// ── EL WEBHOOK, MONTADO COMO EN `app.ts` (cuerpo crudo para la firma) ─────────────────────────
const app = express();
app.use(express.json({ verify: (req, _res, buf) => { if ((req.url || '').startsWith('/webhooks/whatsapp')) req.rawBody = buf; } }));
app.use('/webhooks/whatsapp', router);
const srv = http.createServer(app);
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const puerto = srv.address().port;

async function postFirmado(cuerpo) {
  const raw = Buffer.from(JSON.stringify(cuerpo));
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO).update(raw).digest('hex');
  const r = await fetch(`http://127.0.0.1:${puerto}/webhooks/whatsapp`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': firma }, body: raw,
  });
  await new Promise((x) => setTimeout(x, 400)); // lo de después del ACK es fire-and-forget
  return r.status;
}
const cambio = (value) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value }] }] });

const pasos = [];
pasos.push(['webhook · estado «delivered» del envío', await postFirmado(cambio({ statuses: [{ id: 'wamid.SONDA1518.SALIENTE', status: 'delivered' }] }))]);
pasos.push(['webhook · estado desconocido «warning» del envío', await postFirmado(cambio({ statuses: [{ id: 'wamid.SONDA1518.SALIENTE', status: 'warning' }] }))]);
pasos.push(['webhook · el CLIENTE escribe «hola»', await postFirmado(cambio({
  contacts: [{ wa_id: TELEFONO, profile: { name: 'Cliente' } }],
  messages: [{ from: TELEFONO, id: 'wamid.SONDA1518.ENTRANTE', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'hola' } }],
}))]);
// Control de la firma: sin ella, 401 y nada guardado. Si saliera 200, el webhook no estaría validando.
const antesDeLaMala = mensajes.length;
const rMala = await fetch(`http://127.0.0.1:${puerto}/webhooks/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' }, body: JSON.stringify(cambio({ messages: [{ from: TELEFONO, id: 'x', type: 'text' }] })) });
srv.close();

console.log('═══ ① EL WEBHOOK (router real, firma HMAC) ═══');
for (const [p, s] of pasos) console.log(`   ${String(s).padEnd(4)} ${p}`);
console.log(`   ${String(rMala.status).padEnd(4)} control: misma petición con firma mala → filas nuevas: ${mensajes.length - antesDeLaMala}`);

console.log('\n═══ ② QUÉ SE GUARDA (WhatsAppMessage) ═══');
for (const m of mensajes) {
  console.log(`   id ${m.id} · type ${m.type} · status ${m.status} · customerId ${m.customerId} · relatedType ${m.relatedType} · toPhone ${m.toPhone ? '(sí)' : 'null'} · waMessageId ${m.waMessageId || 'null'}`);
}

console.log('\n═══ ③ QUÉ DEVUELVE LA RUTA DE LA FICHA (historialWhatsAppDelCliente) ═══');
const respuesta = await historialWhatsAppDelCliente(MERCHANT, CLIENTE);
for (const m of respuesta.mensajes) console.log(`   id ${m.id} · type ${m.type} · status ${m.status} · relatedType ${m.relatedType}`);
const consultaWhere = consultas.filter((c) => c === 'whatsAppMessage.findMany').length;
console.log(`   (whatsAppMessage.findMany llamado ${consultaWhere} vez/veces)`);

// ── ④ LA PANTALLA ────────────────────────────────────────────────────────────────────────────
const { cargarDashboard, pintarVista, todos } = await import(new URL('../../../../tests/_banco-vistas.mjs', import.meta.url));
const { datosDelCenso } = await import(new URL('../../../../scripts/_datos-del-censo.mjs', import.meta.url));
const dc = datosDelCenso();
dc.enVista('renderCustomer360View');
const servida = JSON.parse(JSON.stringify(respuesta)); // lo que viaja por la red: fechas como texto
const datos = (url) => (/\/admin\/customers\/\d+\/whatsapp(\?|$)/.test(url) ? structuredClone(servida) : dc.datos(url));
const banco = cargarDashboard(RAIZ, { datos });
banco.ctx.renderAppView = () => {};
const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE);
const texto = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim();
const pestana = r.contenedor && todos(r.contenedor).find((n) => /^WhatsApp \(\d+\+?\)$/.test(texto(n)) && n.hijos.every((h) => !/^WhatsApp/.test(texto(h)) || h.tagName === undefined));
console.log('\n═══ ④ LA PESTAÑA «WhatsApp» DE LA FICHA (banco de vistas) ═══');
if (r.error || !pestana) {
  console.error(`   🔴 NO SUPE MIRAR: ${r.error ? r.error.message : 'no encuentro la pestaña «WhatsApp (n)»'}`);
  process.exit(2);
}
console.log(`   rótulo de la pestaña: «${texto(pestana)}»`);
pestana.click();
await new Promise((x) => setTimeout(x, 50));
const filas = todos(r.contenedor).filter((n) => n.tagName === 'TR' && n.dataset && n.dataset.mensaje);
const chipDe = (tr) => { const tds = tr.hijos.filter((h) => h.tagName === 'TD'); return { doc: texto(tds[1]), estado: (tds[2] && (tds[2]._html || tds[2].innerHTML || texto(tds[2]))) || '' }; };
const limpio = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
let entrante = null;
let saliente = null;
for (const tr of filas) {
  const { doc, estado } = chipDe(tr);
  const fila = mensajes.find((m) => String(m.id) === String(tr.dataset.mensaje));
  console.log(`   fila id ${tr.dataset.mensaje} (${fila ? fila.type : '?'}) · Documento «${doc}» · Estado «${limpio(estado)}»`);
  if (fila && fila.type === 'inbound') entrante = limpio(estado);
  if (fila && fila.type === 'template') saliente = limpio(estado);
}

console.log('\n═══ VEREDICTO ═══');
if (saliente !== '✓✓ WhatsApp: Entregado') {
  console.error(`   🔴 NO SUPE MIRAR: el control positivo (el envío «delivered») sale «${saliente}»`);
  process.exit(2);
}
console.log(`   ✅ control positivo: el envío sale «${saliente}»`);
if (entrante === null) { console.log('   NO REPRODUCIDO: el mensaje del cliente no aparece en la pestaña'); process.exit(1); }
const reproducido = /WhatsApp: Enviado/.test(entrante);
console.log(`   ${reproducido ? '🔴 REPRODUCIDO' : 'NO REPRODUCIDO'}: el mensaje que ESCRIBIÓ el cliente sale en su ficha como «${entrante}»`);
process.exit(reproducido ? 0 : 1);
