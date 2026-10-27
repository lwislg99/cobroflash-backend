// SCRUM-1509d - Los CUATRO llamadores a los que no se les pregunta el tope por cliente, EJECUTADOS.
//
// Se ejecuta el LLAMADOR de `dist/` tal cual (la funcion exportada, el cron o la ruta montada en
// un express), no `sendWhatsAppTemplate` a pelo. Se doblan dos cosas, y solo esas:
//   - LA BASE: un `prisma` en memoria CON ESTADO. Lo que no modela lo contesta con un valor
//     neutro y LO APUNTA: la lista sale al final (un instrumento declara su poblacion).
//   - EL TRANSPORTE de axios: no sale un byte. Cada peticion a Meta se ANOTA con su tipo.
// NO se usa WHATSAPP_DRY_RUN: se cuentan peticiones, no filas.
//
// Dos pasadas por caso:
//   HOY        el llamador tal cual.
//   CON TOPE   lo mismo, y a la llamada que llega SIN cliente se le pone EN MEMORIA el cliente
//              dueno de ese telefono. No es un arreglo: no se escribe nada en `src` ni en `dist`.
//              Si el telefono no es de ningun cliente (el profesional), no se pone nada y se cuenta.
//
// Uso:  node medir.cjs <dist> [--tope-esperado N]
//   --clave-fantasma   anade a K0 un esperado sobre una clave inexistente: tiene que salir rojo.
//   --tope-esperado N  NO cambia el producto: cambia el tope con que ESTE guion calcula lo que
//                      espera. Sirve para verlo en rojo.
// Sale 0 si todo cuadra, 1 si algun caso no cuadra, 2 si el guion se rompe o sale mudo.
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const dist = path.resolve(process.argv[2] || 'dist');
const iTope = process.argv.indexOf('--tope-esperado');
const topeForzado = iTope > 0 ? Number(process.argv[iTope + 1]) : null;
const claveFantasma = process.argv.includes('--clave-fantasma'); // control: un esperado sobre una clave que no existe tiene que salir rojo

if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('CIEGO: proceso de test; el freno de SCRUM-180 lanzaria antes de salir.'); process.exit(2);
}
delete process.env.WHATSAPP_DRY_RUN;
delete process.env.WA_CUSTOMER_DAILY_CAP;
delete process.env.WA_DAILY_TEMPLATE_CAP;

// -- reloj: mediodia, para que ninguna tanda cruce la medianoche ----------------------------
const RealDate = Date;
let desfaseMs = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfaseMs); else super(...a); }
  static now() { return RealDate.now() + desfaseMs; }
}
global.Date = FakeDate;
{ const d = new RealDate(); d.setHours(12, 0, 0, 0); desfaseMs = d.getTime() - RealDate.now(); }
const dormir = (ms) => new Promise((r) => (ms > 0 ? setTimeout(r, ms) : setImmediate(r)));

// -- base en memoria, con estado -------------------------------------------------------------
const MERCHANT = 7;
let t = {};        // tablas del caso
let est = {};      // contadores del caso
let modo = {};     // que se dobla en el caso
const noModeladas = {}; // modelo.metodo -> veces (toda la corrida)

function casa(fila, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (v === undefined) continue;
    const x = fila[k];
    if (v !== null && typeof v === 'object' && !(v instanceof RealDate)) {
      for (const [op, val] of Object.entries(v)) {
        if (op === 'gte') { if (!(x >= val)) return false; }
        else if (op === 'lte') { if (!(x <= val)) return false; }
        else if (op === 'not') { if (val === null) { if (x == null) return false; } else if (x === val) return false; }
        else throw new Error('INSTRUMENTO: operador no modelado en el where: ' + op);
      }
    } else if (v === null) { if (x != null) return false; }
    else if (x !== v) return false;
  }
  return true;
}
const neutro = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }),
  upsert: async () => ({ id: 1 }), aggregate: async () => ({}), groupBy: async () => [] };
const conRelaciones = (fila) => (fila ? { ...fila, customer: t.customer.find((c) => c.id === fila.customerId) || null, merchant: { id: MERCHANT, name: 'Taller Sonda', logoUrl: null } } : null);
const modelos = {
  customer: {
    // la lectura de la BAJA (nadie esta de baja aqui)
    findMany: async () => { est.preguntasBaja += 1; return []; },
  },
  whatsAppMessage: {
    create: async ({ data }) => { t.whatsAppMessage.push({ ...data, createdAt: new FakeDate() }); return { id: t.whatsAppMessage.length }; },
    count: async ({ where }) => {
      const conCliente = 'customerId' in where;
      const n = t.whatsAppMessage.filter((f) => casa(f, where)).length;
      est.preguntas.push({ conCliente, respuesta: n });
      return n;
    },
    // la ventana de 24 h: no hay entrantes, esta cerrada
    findFirst: async () => { est.preguntasVentana += 1; return null; },
  },
  quote: {
    findMany: async ({ where, take }) => { est.lecturasPresupuestos += 1; return t.quote.filter((f) => casa(f, where)).slice(0, take || undefined).map(conRelaciones); },
    findUnique: async ({ where }) => t.quote.find((f) => f.id === where.id) || null,
    update: async ({ where, data }) => { const f = t.quote.find((x) => x.id === where.id); Object.assign(f, data); return f; },
  },
  invoice: {
    findFirst: async ({ where }) => conRelaciones(t.invoice.find((f) => casa(f, where)) || null),
    update: async ({ where, data }) => { const f = t.invoice.find((x) => x.id === where.id); Object.assign(f, data); est.marcasFactura += 1; return f; },
  },
  charge: {
    findUnique: async ({ where }) => t.charge.find((f) => f.id === where.id) || null,
    update: async ({ where, data }) => { const f = t.charge.find((x) => x.id === where.id); Object.assign(f, data); return f; },
  },
};
global.prisma = new Proxy({}, { get: (_, m) => {
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => {
    if (modelos[m] && modelos[m][met]) return modelos[m][met];
    if (typeof met !== 'string' || !neutro[met]) return undefined;
    return async (...a) => { noModeladas[m + '.' + met] = (noModeladas[m + '.' + met] || 0) + 1; return neutro[met](...a); };
  } });
} });
global.fetch = () => { throw new Error('INSTRUMENTO: alguien llamo a fetch; aqui no sale nada'); };

// -- transporte: el destino ------------------------------------------------------------------
const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
// El host de Meta NO se escribe aqui: se lee del propio modulo que habla con Meta (asi este guion
// no nombra el destino, y si el modulo cambiara de host la comprobacion le seguiria).
const HOST_DE_META = (() => { const m = /https:\/\/([a-z0-9.-]+)\/v\d+/.exec(require('fs').readFileSync(path.join(dist, 'integrations/whatsapp.js'), 'utf8')); if (!m) { console.log('GUION MUDO: no se pudo leer el host de Meta del modulo'); process.exit(2); } return m[1]; })();
const axios = requiereDist('axios');
axios.defaults.adapter = async (cfg) => {
  let cuerpo = {};
  try { cuerpo = JSON.parse(cfg.data); } catch { /* se queda vacio */ }
  const tipo = String(cuerpo.type || 'ilegible');
  est.aMeta.push({ host: new URL(String(cfg.url)).host, tipo, to: String(cuerpo.to || ''), plantilla: (cuerpo.template && cuerpo.template.name) || null });
  const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
  // Un texto libre o un boton fuera de la ventana de 24 h: Meta lo rechaza (asi cae a la plantilla).
  if (tipo !== 'template' && !modo.ventanaAbierta) {
    throw new axios.AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', cfg, {}, resp(400, { error: { message: 'laboratorio: fuera de ventana', code: 131047 } }));
  }
  return resp(200, { messages: [{ id: 'wamid.laboratorio-1509d.' + est.aMeta.length }] });
};

const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
const hablar = console.log;
console.log = () => {};

let wa; let notif; let recordatorio; let puerto; let C; let D; let C_REAL; let tel;
const noCuadran = [];
const filasTabla = [];

function nuevoCaso(m) {
  modo = { ...m };
  trazas.length = 0;
  t = { customer: [], whatsAppMessage: [], quote: [], invoice: [], charge: [] };
  est = { preguntas: [], aMeta: [], preguntasBaja: 0, preguntasVentana: 0, lecturasPresupuestos: 0, marcasFactura: 0,
    llamadas: 0, llegaronConCliente: 0, puestos: 0, sinClienteQuePoner: 0, resultados: [] };
}
const cliente = (id) => { const c = { id, merchantId: MERCHANT, name: 'Cliente Sonda ' + id, phone: null, mobile: tel.telefonoDePrueba(100 + id), waOptOut: false }; t.customer.push(c); return c; };
const filaDeHoy = (customerId) => ({ merchantId: MERCHANT, customerId, type: 'template', waMessageId: 'wamid.previa', status: 'sent', createdAt: new FakeDate() });

function resumen() {
  const por = {};
  for (const r of est.resultados) por[r] = (por[r] || 0) + 1;
  const plantillas = est.aMeta.filter((p) => p.tipo === 'template');
  return {
    plantillas: plantillas.length,
    otroTipo: est.aMeta.length - plantillas.length,
    hostAjeno: est.aMeta.filter((p) => p.host !== HOST_DE_META).length,
    llamadas: est.llamadas, conCliente: est.llegaronConCliente, puestos: est.puestos, sinClienteQuePoner: est.sinClienteQuePoner,
    preguntasCliente: est.preguntas.filter((p) => p.conCliente).length,
    respuestas: est.preguntas.filter((p) => p.conCliente).map((p) => p.respuesta).join(','),
    bloqueoCliente: trazas.filter((l) => /J6: cliente \d+ ya recibi/.test(l)).length,
    bloqueoComercio: trazas.filter((l) => /alcanz. el tope diario de plantillas/.test(l)).length,
    resultados: Object.entries(por).map(([k, v]) => k + '=' + v).join(' ') || '-',
    marcados: t.quote.filter((q) => q.reminderSentAt).length,
    marcasFactura: est.marcasFactura,
  };
}
function anotar(nombre, r, esperado) {
  const fallos = [];
  for (const [k, v] of Object.entries(esperado || {})) {
    if (!(k in r)) fallos.push(k + ': el esperado nombra una clave que el resumen no tiene');
    else if (r[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + r[k]);
  }
  if (r.hostAjeno) fallos.push('peticiones a un host que no es Meta: ' + r.hostAjeno);
  if (fallos.length) noCuadran.push(nombre);
  filasTabla.push({ nombre, r, fallos });
  hablar((fallos.length ? 'ROJO   ' : 'cuadra ') + nombre.padEnd(66) + ' plantillas=' + String(r.plantillas).padStart(3) + ' otroTipo=' + String(r.otroTipo).padStart(3)
    + ' llamadas=' + String(r.llamadas).padStart(3) + ' conCliente=' + String(r.conCliente).padStart(3) + ' puestos=' + String(r.puestos).padStart(3)
    + ' bloqCli=' + String(r.bloqueoCliente).padStart(3) + ' bloqCom=' + String(r.bloqueoComercio).padStart(3)
    + ' pregCli=' + String(r.preguntasCliente).padStart(3) + ' [' + r.resultados + ']' + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
  return r;
}

function pedir(ruta, rol) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: 'POST', headers: { 'content-type': 'application/json', 'x-rol-sonda': rol || 'admin' } }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch { /* vacio */ } resolve({ status: res.statusCode, body: j }); });
    });
    req.on('error', reject); req.end('{}');
  });
}

(async () => {
  tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1509d';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1509d';
  C_REAL = config.WA_CUSTOMER_DAILY_CAP; D = config.WA_DAILY_TEMPLATE_CAP;
  C = topeForzado === null ? C_REAL : topeForzado;
  wa = require(path.join(dist, 'integrations/whatsapp.js'));

  // La envoltura: ve CADA llamada que llega a `sendWhatsAppTemplate` desde fuera de su modulo.
  // En HOY solo mira. En CON TOPE le pone el cliente dueno del telefono, si lo hay.
  const original = wa.sendWhatsAppTemplate;
  nuevoCaso({});
  wa.sendWhatsAppTemplate = async (p) => {
    est.llamadas += 1;
    let q = p;
    if (p.log && p.log.customerId) est.llegaronConCliente += 1;
    else if (modo.conTope) {
      const dueno = t.customer.find((c) => c.mobile === p.to);
      if (dueno) { est.puestos += 1; q = { ...p, log: { ...(p.log || {}), customerId: dueno.id } }; }
      else est.sinClienteQuePoner += 1;
    }
    return original(q);
  };
  if (wa.sendWhatsAppTemplate === original) { hablar('GUION MUDO: la envoltura no se pudo poner sobre el export.'); process.exit(2); }

  notif = require(path.join(dist, 'integrations/whatsappNotifications.js'));
  recordatorio = require(path.join(dist, 'modules/quotes/domain/reminder.service.js'));
  const express = requiereDist('express');
  const router = require(path.join(dist, 'modules/system/app/routes/invoicesAdmin.routes.js')).default;
  const app = express();
  app.use(express.json());
  // Lo que en la app pone la autenticacion (NO se ejercita aqui): comercio y rol.
  app.use((req, _res, next) => { req.merchantId = MERCHANT; req.userRole = req.headers['x-rol-sonda']; next(); });
  app.use('/admin/invoices', router);
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  puerto = servidor.address().port;

  hablar('topes leidos en dist: por cliente y dia = ' + C_REAL + ' · por comercio y dia = ' + D + (topeForzado !== null ? '  [ESPERADO FORZADO A ' + topeForzado + ': este guion debe salir rojo]' : ''));
  const N = 10;
  const tope = Math.min(N, C);
  const res = (r) => est.resultados.push(r && r.ok ? 'ok' : (r && (r.reason || r.via)) || 'no');

  // ---------------------------------------------------------------------------------------
  hablar('\n== K · CONTROLES (antes de cualquier numero) ==');
  // cero: los cuatro llamadores sin nada que mandar
  nuevoCaso({});
  await recordatorio.sendPendingReminders();
  res(await notif.sendPaymentConfirmation({ toPhone: '', amount: 1, currency: 'EUR', invoiceNumber: 'X', merchantId: MERCHANT }));
  res(await notif.notifyMerchantAlert({ merchantId: MERCHANT, merchantPhone: '', freeText: 'x', action: 'a', detail: 'd' }));
  { const r = await pedir('/admin/invoices/999/send-reminder'); est.resultados.push('http' + r.status); }
  anotar('K0 CERO: los cuatro sin nada que mandar (sin telefono, sin filas)', resumen(), { plantillas: 0, otroTipo: 0, llamadas: 0, preguntasCliente: 0, ...(claveFantasma ? { claveQueNoExiste: undefined } : {}) });
  if (est.lecturasPresupuestos !== 1) { hablar('GUION MUDO: el cron no llego a leer presupuestos en K0 (' + est.lecturasPresupuestos + ').'); process.exit(2); }

  // positivo: la MISMA envoltura y el mismo transporte, con una llamada que SI lleva cliente
  nuevoCaso({});
  { const c = cliente(50);
    for (let i = 0; i < N; i += 1) { res(await wa.sendWhatsAppTemplate({ to: c.mobile, merchantId: MERCHANT, templateName: 'quote_decision_es', ...plantillaPresupuesto(), log: { customerId: c.id } })); await dormir(0); } }
  const k1 = anotar('K1 POSITIVO: 10 al mismo cliente CON cliente en la llamada', resumen(), { plantillas: tope, bloqueoCliente: N - tope, conCliente: N, llamadas: N });

  // positivo con un llamador REAL del mismo fichero que si pasa cliente (whatsappNotifications:105)
  nuevoCaso({});
  { const c = cliente(50);
    for (let i = 0; i < N; i += 1) { res(await notif.sendPaymentConfirmationInvoice({ toPhone: c.mobile, customerName: c.name, amount: 100, currency: 'EUR', documentNumber: 'F-1', businessName: 'Taller Sonda', chargeId: 1, receiptToken: 'tokrecibo', merchantId: MERCHANT, customerId: c.id })); await dormir(0); } }
  const k2 = anotar('K2 POSITIVO: el hermano que SI pasa cliente (:105), 10 al mismo', resumen(), { plantillas: tope, bloqueoCliente: N - tope });

  // positivo del tope de comercio (para el aviso al profesional)
  nuevoCaso({});
  { const c = cliente(50); for (let i = 0; i < D; i += 1) t.whatsAppMessage.push(filaDeHoy(51));
    res(await wa.sendWhatsAppTemplate({ to: c.mobile, merchantId: MERCHANT, ...plantillaPresupuesto(), log: { customerId: c.id } })); }
  anotar('K3 POSITIVO comercio: ' + D + ' filas de otro cliente hoy, 1 envio', resumen(), { plantillas: 0, bloqueoComercio: 1 });

  // ---------------------------------------------------------------------------------------
  for (const conTope of [false, true]) {
    const P = conTope ? 'CON TOPE' : 'HOY     ';
    const esperado = (n, extra) => (conTope
      ? { plantillas: Math.min(n, C), bloqueoCliente: n - Math.min(n, C), llamadas: n, conCliente: 0, puestos: n, ...extra }
      : { plantillas: n, bloqueoCliente: 0, llamadas: n, conCliente: 0, puestos: 0, preguntasCliente: 0, ...extra });
    hablar('\n== ' + P.trim() + ' · los cuatro llamadores, ' + N + ' veces al mismo cliente el mismo dia, todo sano ==');

    // 1 · whatsappNotifications.ts:35 · sendPaymentConfirmation
    nuevoCaso({ conTope });
    { const c = cliente(50);
      for (let i = 0; i < N; i += 1) { res(await notif.sendPaymentConfirmation({ toPhone: c.mobile, customerName: c.name, amount: 100, currency: 'EUR', invoiceNumber: 'F-' + i, businessName: 'Taller Sonda', merchantId: MERCHANT })); await dormir(0); } }
    anotar(P + ' 1 sendPaymentConfirmation (:35) x' + N, resumen(), esperado(N));

    // 2 · whatsappNotifications.ts:171 · notifyMerchantAlert (el destinatario es el PROFESIONAL)
    nuevoCaso({ conTope });
    { cliente(50); const profesional = tel.telefonoDePrueba(900);
      for (let i = 0; i < N; i += 1) { res(await notif.notifyMerchantAlert({ merchantId: MERCHANT, merchantPhone: profesional, freeText: 'aviso', customerName: 'Cliente Sonda 50', action: 'ha aceptado tu presupuesto', detail: '100,00 EUR · P-' + i })); await dormir(0); } }
    anotar(P + ' 2 notifyMerchantAlert (:171) x' + N + ', ventana cerrada', resumen(),
      { plantillas: N, otroTipo: N, llamadas: N, conCliente: 0, puestos: 0, sinClienteQuePoner: conTope ? N : 0, bloqueoCliente: 0, preguntasCliente: 0 });

    // 3 · reminder.service.ts:47 · el cron, UNA pasada con N presupuestos del mismo cliente
    nuevoCaso({ conTope });
    { const c = cliente(50); const hace2dias = new FakeDate(FakeDate.now() - 48 * 3600 * 1000);
      for (let i = 1; i <= N; i += 1) t.quote.push({ id: i, merchantId: MERCHANT, customerId: c.id, status: 'sent', reminderSentAt: null, updatedAt: hace2dias, quoteNumber: i, total: 100, currency: 'EUR', decisionToken: 'tokdecision' + i });
      await recordatorio.sendPendingReminders(); }
    anotar(P + ' 3 sendPendingReminders (:47), 1 pasada, ' + N + ' presupuestos', resumen(), esperado(N, { marcados: N }));

    // 4 · invoicesAdmin.routes.ts:766 · la ruta, N pulsaciones sobre la misma factura
    nuevoCaso({ conTope });
    { const c = cliente(50);
      t.charge.push({ id: 31, receiptToken: 'tokpago' });
      t.invoice.push({ id: 21, merchantId: MERCHANT, customerId: c.id, status: 'pending', number: 'F-21', total: 100, currency: 'EUR', chargeId: 31, reminder7SentAt: null, reminder14SentAt: null });
      for (let i = 0; i < N; i += 1) { const r = await pedir('/admin/invoices/21/send-reminder'); est.resultados.push('http' + r.status + (r.body.sent === true ? '+enviado' : r.body.sent === false ? '+no:' + (r.body.reason || r.body.error || '?') : '')); } }
    anotar(P + ' 4 POST /:id/send-reminder (:766) x' + N + ', misma factura', resumen(), esperado(N));
  }

  // ---------------------------------------------------------------------------------------
  hablar('\n== V · VARIANTES que acotan (mismos llamadores) ==');
  // la envoltura CON TOPE no bloquea por si misma: clientes distintos
  nuevoCaso({ conTope: true });
  { const hace2dias = new FakeDate(FakeDate.now() - 48 * 3600 * 1000);
    for (let i = 1; i <= N; i += 1) { const c = cliente(60 + i); t.quote.push({ id: i, merchantId: MERCHANT, customerId: c.id, status: 'sent', reminderSentAt: null, updatedAt: hace2dias, quoteNumber: i, total: 100, currency: 'EUR', decisionToken: 'tokdecision' + i }); }
    await recordatorio.sendPendingReminders(); }
  anotar('V1 CERO de la envoltura: CON TOPE, ' + N + ' presupuestos de ' + N + ' clientes', resumen(), { plantillas: N, bloqueoCliente: 0, puestos: N });

  // el caso verosimil: el cliente ya recibio su cupo hoy por caminos que SI cuentan
  for (const conTope of [false, true]) {
    nuevoCaso({ conTope });
    { const c = cliente(50); for (let i = 0; i < C_REAL; i += 1) t.whatsAppMessage.push(filaDeHoy(c.id));
      t.quote.push({ id: 1, merchantId: MERCHANT, customerId: c.id, status: 'sent', reminderSentAt: null, updatedAt: new FakeDate(FakeDate.now() - 48 * 3600 * 1000), quoteNumber: 1, total: 100, currency: 'EUR', decisionToken: 'tokdecision1' });
      await recordatorio.sendPendingReminders(); }
    anotar('V2 ' + (conTope ? 'CON TOPE' : 'HOY     ') + ' cliente con ' + C_REAL + ' plantillas ya hoy + 1 recordatorio (cron)', resumen(), conTope ? { plantillas: C_REAL >= C ? 0 : 1, marcados: 1 } : { plantillas: 1, marcados: 1 });
    nuevoCaso({ conTope });
    { const c = cliente(50); for (let i = 0; i < C_REAL; i += 1) t.whatsAppMessage.push(filaDeHoy(c.id));
      t.charge.push({ id: 31, receiptToken: 'tokpago' });
      t.invoice.push({ id: 21, merchantId: MERCHANT, customerId: c.id, status: 'pending', number: 'F-21', total: 100, currency: 'EUR', chargeId: 31, reminder7SentAt: null, reminder14SentAt: null });
      const r = await pedir('/admin/invoices/21/send-reminder'); est.resultados.push('http' + r.status + (r.body.sent === true ? '+enviado' : '+no:' + (r.body.reason || r.body.error || '?'))); }
    anotar('V3 ' + (conTope ? 'CON TOPE' : 'HOY     ') + ' cliente con ' + C_REAL + ' plantillas ya hoy + 1 pulsacion (ruta)', resumen(), conTope ? { plantillas: C_REAL >= C ? 0 : 1 } : { plantillas: 1 });
  }

  // la ruta pasa por su puerta de rol (no se saco el handler de su ruta)
  nuevoCaso({});
  { const c = cliente(50); t.charge.push({ id: 31, receiptToken: 'tokpago' });
    t.invoice.push({ id: 21, merchantId: MERCHANT, customerId: c.id, status: 'pending', number: 'F-21', total: 100, currency: 'EUR', chargeId: 31, reminder7SentAt: null, reminder14SentAt: null });
    const r = await pedir('/admin/invoices/21/send-reminder', 'tecnico'); est.resultados.push('http' + r.status); }
  anotar('V4 la ruta con rol tecnico: no llega al envio', resumen(), { plantillas: 0, llamadas: 0, resultados: 'http403=1' });

  // la ruta sin cobro: va por TEXTO, que si pasa cliente y no es una plantilla
  nuevoCaso({ ventanaAbierta: true });
  { const c = cliente(50);
    t.invoice.push({ id: 22, merchantId: MERCHANT, customerId: c.id, status: 'pending', number: 'F-22', total: 100, currency: 'EUR', chargeId: null, reminder7SentAt: null, reminder14SentAt: null });
    const r = await pedir('/admin/invoices/22/send-reminder'); est.resultados.push('http' + r.status + (r.body.sent === true ? '+enviado' : '+no')); }
  anotar('V5 la ruta sin cobro: sale por texto, 0 plantillas', resumen(), { plantillas: 0, otroTipo: 1, llamadas: 0 });

  // el aviso al profesional con la ventana ABIERTA: no gasta plantilla
  nuevoCaso({ ventanaAbierta: true });
  { const profesional = tel.telefonoDePrueba(900);
    for (let i = 0; i < N; i += 1) res(await notif.notifyMerchantAlert({ merchantId: MERCHANT, merchantPhone: profesional, freeText: 'aviso', action: 'te ha pagado', detail: 'd' })); }
  anotar('V6 notifyMerchantAlert x' + N + ', ventana ABIERTA', resumen(), { plantillas: 0, otroTipo: N, llamadas: 0 });

  // al aviso al profesional SI se le pregunta el tope de COMERCIO, y se lo come
  nuevoCaso({});
  { const profesional = tel.telefonoDePrueba(900);
    for (let i = 0; i < D + 20; i += 1) { res(await notif.notifyMerchantAlert({ merchantId: MERCHANT, merchantPhone: profesional, freeText: 'aviso', action: 'te ha pagado', detail: 'd' + i })); await dormir(0); } }
  anotar('V7 notifyMerchantAlert x' + (D + 20) + ', ventana cerrada (tope de comercio)', resumen(), { plantillas: D, bloqueoComercio: 20, bloqueoCliente: 0 });
  // ...y con el cupo del comercio gastado en avisos al profesional, la plantilla a un CLIENTE no sale
  { const c = cliente(50); const antes = est.aMeta.filter((p) => p.tipo === 'template').length;
    const r = await original({ to: c.mobile, merchantId: MERCHANT, ...plantillaPresupuesto(), log: { customerId: c.id } });
    const despues = est.aMeta.filter((p) => p.tipo === 'template').length;
    const ok = !r.ok && r.reason === 'daily_cap' && despues === antes;
    if (!ok) noCuadran.push('V8');
    hablar((ok ? 'cuadra ' : 'ROJO   ') + 'V8 tras ' + D + ' avisos al profesional, 1 plantilla a un cliente'.padEnd(40) + ' -> ok=' + r.ok + ' motivo=' + r.reason + ' plantillas nuevas=' + (despues - antes));
    filasTabla.push({ nombre: 'V8', r: {}, fallos: ok ? [] : ['x'] }); }

  // ---------------------------------------------------------------------------------------
  hablar('\n== lo que la base en memoria contesto SIN modelarlo (valor neutro), toda la corrida ==');
  const nm = Object.entries(noModeladas).sort();
  hablar(nm.length ? nm.map(([k, v]) => '  ' + k + ' x' + v).join('\n') : '  (nada)');

  const totalPlantillas = filasTabla.reduce((s, f) => s + (f.r.plantillas || 0), 0);
  hablar('\nCASOS: ' + filasTabla.length + ' · cuadran: ' + (filasTabla.length - noCuadran.length) + ' · NO cuadran: ' + noCuadran.length + ' · plantillas contadas en total: ' + totalPlantillas);
  hablar('POSITIVO OBLIGATORIO: K1 bloqueo ' + k1.bloqueoCliente + ' de ' + N + ' y K2 bloqueo ' + k2.bloqueoCliente + ' de ' + N + ' (tienen que ser > 0 con el tope leido en dist).');
  servidor.close();
  if (topeForzado === null && (!(k1.bloqueoCliente > 0) || !(k2.bloqueoCliente > 0) || totalPlantillas === 0)) { hablar('GUION MUDO: el instrumento no ve el bloqueo que tiene que ver.'); process.exit(2); }
  process.exit(noCuadran.length ? 1 : 0);
})().catch((e) => { hablar('GUION ROTO: ' + ((e && e.stack) || e)); process.exit(2); });

function plantillaPresupuesto() {
  const { buildQuoteDecision } = require(path.join(dist, 'integrations/whatsappTemplates.js'));
  return buildQuoteDecision({ customerName: 'Cliente Sonda', businessName: 'Taller Sonda', quoteNumber: 12, amount: 100, currency: 'EUR', decisionToken: 'tokdecision' });
}
