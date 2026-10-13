// SCRUM-1509c - QUE LEE el tope anti-abuso de plantillas para decidir, medido en el DESTINO.
//
// Se ejecuta `sendWhatsAppTemplate` de `dist/` tal cual. Se doblan dos cosas, y solo esas:
//   - LA BASE: un `prisma` en memoria CON ESTADO, que evalua el `where` que le pidan (y LANZA si
//     le piden un operador que no modela: un instrumento que calla no es un instrumento).
//   - EL TRANSPORTE de axios: no sale un byte. Cada peticion que `whatsapp.js` manda a Meta se
//     ANOTA (eso es el destino) y se contesta aqui dentro. `fetch` lanza si alguien lo llama.
// NO se usa WHATSAPP_DRY_RUN: en dry-run el envio vuelve antes de la llamada y lo que se cuenta
// es una fila pedida, no una peticion. Aqui se cuenta la peticion.
//
// Uso:  node medir.cjs <dist> [--tope-esperado N]
//   --tope-esperado N  NO cambia el producto: cambia el tope con que ESTE guion calcula lo que
//                      espera. Sirve para verlo en rojo (control del propio guion).
// Sale 0 si todo cuadra, 1 si algun caso no cuadra, 2 si el guion se rompe.
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const dist = path.resolve(process.argv[2] || 'dist');
const iTope = process.argv.indexOf('--tope-esperado');
const topeForzado = iTope > 0 ? Number(process.argv[iTope + 1]) : null;

if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
  console.log('CIEGO: proceso de test; el freno de SCRUM-180 lanzaria antes de salir.'); process.exit(2);
}
delete process.env.WHATSAPP_DRY_RUN;
delete process.env.WA_CUSTOMER_DAILY_CAP;
delete process.env.WA_DAILY_TEMPLATE_CAP;

// -- reloj ------------------------------------------------------------------------------
const RealDate = Date;
let desfaseMs = 0;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() + desfaseMs); else super(...a); }
  static now() { return RealDate.now() + desfaseMs; }
}
global.Date = FakeDate;
const ponerHora = (h, m) => { const d = new RealDate(); d.setHours(h, m, 0, 0); desfaseMs = d.getTime() - RealDate.now(); };
const dormir = (ms) => new Promise((r) => (ms > 0 ? setTimeout(r, ms) : setImmediate(r)));

// -- base en memoria, con estado ----------------------------------------------------------
const MERCHANT = 7;
const CLIENTE = 50;
let filas = [];
let est = {};
let modo = {};
function casa(fila, where) {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    const x = fila[k];
    if (v !== null && typeof v === 'object' && !(v instanceof RealDate)) {
      for (const [op, val] of Object.entries(v)) {
        if (op === 'gte') { if (!(x >= val)) return false; }
        else if (op === 'not') { if (val === null) { if (x == null) return false; } else if (x === val) return false; }
        else throw new Error('INSTRUMENTO: operador no modelado en el where: ' + op);
      }
    } else if (x !== v) return false;
  }
  return true;
}
const porDefecto = { findMany: async () => [], findFirst: async () => null, findUnique: async () => null, count: async () => 0,
  create: async () => ({ id: 1 }), createMany: async () => ({ count: 0 }), update: async () => ({ id: 1 }), updateMany: async () => ({ count: 0 }) };
const modelos = {
  customer: {
    findMany: async () => { est.preguntasBaja += 1; if (modo.fallaBaja) throw new Error('SONDA: la lectura de la baja falla'); return []; },
  },
  whatsAppMessage: {
    create: async ({ data }) => {
      est.filasPedidas += 1;
      const creada = new FakeDate();
      if (modo.latEscrituraMs > 0) await dormir(modo.latEscrituraMs); else await null;
      if (modo.fallaEscritura) throw new Error('SONDA: la escritura del registro de mensajes falla');
      filas.push({ ...data, createdAt: creada });
      est.filasEscritas += 1;
      return { id: filas.length };
    },
    count: async ({ where }) => {
      const conCliente = 'customerId' in where;
      if (modo.fallaLectura) { est.preguntas.push({ conCliente, where, respuesta: 'LANZA' }); throw new Error('SONDA: la lectura del tope falla'); }
      const n = filas.filter((f) => casa(f, where)).length;
      est.preguntas.push({ conCliente, where, respuesta: n });
      return n;
    },
  },
};
global.prisma = new Proxy({}, { get: (_, m) => {
  if (typeof m !== 'string' || m.startsWith('$') || m === 'then') return undefined;
  return new Proxy({}, { get: (__, met) => (modelos[m] && modelos[m][met]) || porDefecto[met] });
} });
global.fetch = () => { throw new Error('INSTRUMENTO: alguien llamo a fetch; aqui no sale nada'); };

// -- transporte: el destino ---------------------------------------------------------------
const requiereDist = createRequire(path.join(dist, 'integrations/whatsapp.js'));
const axios = requiereDist('axios');
axios.defaults.adapter = async (cfg) => {
  let tipo = 'ilegible';
  try { tipo = String(JSON.parse(cfg.data).type); } catch { /* se queda ilegible */ }
  est.aMeta.push({ destino: new URL(String(cfg.url)).host, tipo });
  if (modo.latMetaMs > 0) await dormir(modo.latMetaMs);
  const resp = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
  const que = modo.meta || '200';
  if (que === '200') { est.confirmadas += 1; return resp(200, { messages: [{ id: 'wamid.laboratorio-1509c.' + est.aMeta.length }] }); }
  if (que === '200-sin-id') { est.confirmadas += 1; return resp(200, { messages: [] }); }
  if (que === 'plazo') throw new axios.AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED', cfg, {});
  const status = Number(que);
  throw new axios.AxiosError('Request failed with status code ' + status, 'ERR_BAD_RESPONSE', cfg, {}, resp(status, { error: { message: 'laboratorio', code: status } }));
};

const trazas = [];
console.error = (...a) => trazas.push(a.map(String).join(' '));
console.warn = (...a) => trazas.push(a.map(String).join(' '));
const hablar = console.log;
console.log = () => {};

async function correr(m) {
  filas = []; trazas.length = 0;
  modo = { ...m };
  est = { preguntas: [], aMeta: [], confirmadas: 0, filasPedidas: 0, filasEscritas: 0, preguntasBaja: 0 };
  if (m.hora) ponerHora(m.hora[0], m.hora[1]); else ponerHora(12, 0);
  for (const f of (m.prellenar ? m.prellenar() : [])) filas.push(f);
  const resultados = [];
  const uno = async (i) => {
    const params = { to: TO, ...PLANTILLA };
    if (!m.sinMerchant) params.merchantId = MERCHANT;
    if (!m.sinCliente) params.log = { customerId: m.clienteDistinto ? 1000 + i : CLIENTE, relatedType: 'quote', relatedId: 900 };
    const r = await wa.sendWhatsAppTemplate(params);
    return r.ok ? 'ok' : (r.reason || r.desenlace || String(r.error).slice(0, 30));
  };
  const tandas = m.tandas || [{ n: m.n === undefined ? 10 : m.n }];
  for (const t of tandas) {
    if (t.hora) ponerHora(t.hora[0], t.hora[1]);
    if (m.concurrente) resultados.push(...await Promise.all(Array.from({ length: t.n }, (_, i) => uno(i))));
    else for (let i = 0; i < t.n; i += 1) { resultados.push(await uno(resultados.length)); if (!m.sinPausa) await dormir(0); }
  }
  await dormir((m.latEscrituraMs || 0) + 20);
  const cuenta = (re) => trazas.filter((l) => re.test(l)).length;
  const por = {};
  for (const r of resultados) por[r] = (por[r] || 0) + 1;
  return {
    envios: resultados.length,
    aMeta: est.aMeta.filter((p) => p.tipo === 'template').length,
    aMetaOtroTipo: est.aMeta.filter((p) => p.tipo !== 'template').length,
    confirmadas: est.confirmadas,
    ok: por.ok || 0,
    bloqueoCliente: por.customer_daily_cap || 0,
    bloqueoComercio: por.daily_cap || 0,
    otros: Object.entries(por).filter(([k]) => !['ok', 'customer_daily_cap', 'daily_cap'].includes(k)).map(([k, v]) => k + '=' + v).join(' ') || '-',
    preguntasTope: est.preguntas.length,
    preguntasConCliente: est.preguntas.filter((p) => p.conCliente).length,
    respuestas: est.preguntas.filter((p) => p.conCliente).map((p) => p.respuesta).join(','),
    respuestasComercio: est.preguntas.filter((p) => !p.conCliente).map((p) => p.respuesta).join(','),
    preguntasBaja: est.preguntasBaja,
    filasPedidas: est.filasPedidas, filasEscritas: est.filasEscritas,
    trazaEscritura: cuenta(/recordWaMessage omitido/), trazaLectura: cuenta(/Error comprobando topes/),
    primerWhere: est.preguntas[0] ? est.preguntas[0].where : null,
    primerWhereCliente: (est.preguntas.find((p) => p.conCliente) || {}).where || null,
  };
}

let wa; let TO; let PLANTILLA; let C; let D;
const noCuadran = [];
const filasTabla = [];
function anotar(nombre, r, esperado) {
  const fallos = [];
  for (const [k, v] of Object.entries(esperado || {})) if (r[k] !== v) fallos.push(k + ': esperado ' + v + ', salio ' + r[k]);
  if (fallos.length) noCuadran.push(nombre);
  filasTabla.push({ nombre, r, esperado: esperado || null, fallos });
  hablar((esperado ? (fallos.length ? 'ROJO   ' : 'cuadra ') : 'sin-esp ') + nombre.padEnd(62) + ' aMeta=' + String(r.aMeta).padStart(3) + ' ok=' + String(r.ok).padStart(3)
    + ' bloqCli=' + String(r.bloqueoCliente).padStart(3) + ' bloqCom=' + String(r.bloqueoComercio).padStart(3) + ' pregTope=' + String(r.preguntasTope).padStart(3)
    + ' filas=' + r.filasEscritas + '/' + r.filasPedidas + ' otros=' + r.otros + (fallos.length ? '  <<< ' + fallos.join(' | ') : ''));
}

(async () => {
  const tel = await import(pathToFileURL(path.resolve(__dirname, '../../../../scripts/_telefonos-prueba.mjs')).href);
  TO = tel.telefonoDePrueba(77);
  const { config } = require(path.join(dist, 'core/config/env.js'));
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1509c';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1509c';
  const C_REAL = config.WA_CUSTOMER_DAILY_CAP; const D_REAL = config.WA_DAILY_TEMPLATE_CAP;
  C = topeForzado === null ? C_REAL : topeForzado; D = D_REAL;
  wa = require(path.join(dist, 'integrations/whatsapp.js'));
  const { buildQuoteDecision } = require(path.join(dist, 'integrations/whatsappTemplates.js'));
  PLANTILLA = buildQuoteDecision({ customerName: 'Cliente Sonda', businessName: 'Taller Sonda', amount: '100,00 €', quoteToken: 'tokdecision', quoteNumber: 12, total: '100,00 €', token: 'tokdecision' });
  hablar('topes leidos en dist: por cliente y dia = ' + C_REAL + ' · por comercio y dia = ' + D_REAL + (topeForzado !== null ? '  [ESPERADO FORZADO A ' + topeForzado + ': este guion debe salir rojo]' : ''));
  hablar('destino de las pruebas: ' + TO + ' (rango imposible: ' + tel.esTelefonoDePrueba(TO) + ')');
  const N = 10;
  const sano = (extra) => ({ aMeta: Math.min(N, C), ok: Math.min(N, C), bloqueoCliente: N - Math.min(N, C), ...extra });
  const todos = (extra) => ({ aMeta: N, bloqueoCliente: 0, bloqueoComercio: 0, ...extra });

  hablar('\n== A · CONTROLES (antes de cualquier numero) ==');
  anotar('A0 cero: ningun envio', await correr({ n: 0 }), { aMeta: 0, ok: 0, preguntasTope: 0, filasPedidas: 0, bloqueoCliente: 0, bloqueoComercio: 0, preguntasBaja: 0 });
  const rSano = await correr({});
  anotar('A1 positivo: 10 al mismo cliente, todo sano (ve el bloqueo)', rSano, sano({ preguntasTope: 2 * Math.min(N, C) + 2 * (N - Math.min(N, C)), filasEscritas: N }));
  anotar('A2 positivo comercio: ' + D + ' filas de OTRO cliente hoy, 1 envio', await correr({ n: 1, prellenar: () => Array.from({ length: D }, () => ({ merchantId: MERCHANT, customerId: 51, type: 'template', waMessageId: 'wamid.x', status: 'sent', createdAt: new FakeDate() })) }), { aMeta: 0, bloqueoComercio: 1, preguntasConCliente: 0 });
  anotar('A3 borde comercio: ' + (D - 1) + ' filas de otro cliente, 1 envio', await correr({ n: 1, prellenar: () => Array.from({ length: D - 1 }, () => ({ merchantId: MERCHANT, customerId: 51, type: 'template', waMessageId: 'wamid.x', status: 'sent', createdAt: new FakeDate() })) }), { aMeta: 1, bloqueoComercio: 0 });

  hablar('\n== B · QUE CAMPOS LEE (3 filas prellenadas, 1 envio; se cambia UN campo en las 3) ==');
  const base = () => ({ merchantId: MERCHANT, customerId: CLIENTE, type: 'template', templateName: PLANTILLA.templateName, waMessageId: 'wamid.x', status: 'sent', error: null, relatedType: 'quote', relatedId: 900, createdAt: new FakeDate() });
  const ayer = () => { const d = new FakeDate(); d.setHours(0, 0, 0, 0); return new FakeDate(d.getTime() - 60000); };
  const medianoche = () => { const d = new FakeDate(); d.setHours(0, 0, 0, 0); return d; };
  const mutaciones = [
    ['B0 sin cambiar nada (positivo: bloquea)', {}, 0],
    ['B1 waMessageId = null', { waMessageId: null }, 1],
    ['B2 type = service', { type: 'service' }, 1],
    ['B3 customerId = otro', { customerId: 51 }, 1],
    ['B4 customerId = null', { customerId: null }, 1],
    ['B5 merchantId = otro', { merchantId: 8 }, 1],
    ['B6 createdAt = ayer 23:59', { createdAt: ayer }, 1],
    ['B7 createdAt = hoy 00:00:00.000', { createdAt: medianoche }, 0],
    ['B8 status = failed (con waMessageId)', { status: 'failed' }, 0],
    ['B9 status = delivered', { status: 'delivered' }, 0],
    ['B10 templateName = otra', { templateName: 'otra_plantilla' }, 0],
    ['B11 relatedType/relatedId = otros', { relatedType: 'invoice', relatedId: 1 }, 0],
    ['B12 error = texto', { error: 'x' }, 0],
  ];
  for (const [nombre, cambio, pasa] of mutaciones) {
    const r = await correr({ n: 1, prellenar: () => Array.from({ length: C_REAL }, () => { const f = { ...base() }; for (const [k, v] of Object.entries(cambio)) f[k] = typeof v === 'function' ? v() : v; return f; }) });
    anotar(nombre, r, topeForzado === null ? { aMeta: pasa, bloqueoCliente: 1 - pasa } : { aMeta: pasa });
  }

  hablar('\n== C · POR QUE: la escritura, la lectura, y la baja (misma funcion) ==');
  const rEsc = await correr({ fallaEscritura: true });
  anotar('C1 falla la ESCRITURA del registro (lectura sana)', rEsc, todos({ ok: N, preguntasTope: 2 * N, filasPedidas: N, filasEscritas: 0, trazaEscritura: N, trazaLectura: 0 }));
  const rLec = await correr({ fallaLectura: true });
  anotar('C2 falla la LECTURA del tope (escritura sana)', rLec, todos({ ok: N, preguntasTope: N, filasEscritas: N, trazaLectura: N, trazaEscritura: 0 }));
  anotar('C3 fallan las dos', await correr({ fallaEscritura: true, fallaLectura: true }), todos({ ok: N, filasEscritas: 0 }));
  anotar('C4 CONTRASTE: falla la lectura de la BAJA (misma funcion)', await correr({ fallaBaja: true }), { aMeta: 0, ok: 0, preguntasTope: 0, preguntasBaja: N });
  anotar('C5 los dos topes a la vez: ' + (D + 20) + ' envios a clientes distintos, sano', await correr({ n: D + 20, clienteDistinto: true }), { aMeta: D, bloqueoComercio: 20, bloqueoCliente: 0 });
  anotar('C6 lo mismo con la escritura fallando', await correr({ n: D + 20, clienteDistinto: true, fallaEscritura: true }), { aMeta: D + 20, bloqueoComercio: 0, bloqueoCliente: 0 });

  hablar('\n== D · LA BASE VA BIEN y el tope tampoco protege ==');
  anotar('D1 10 A LA VEZ (Promise.all), base sana e instantanea', await correr({ concurrente: true }), todos({ ok: N, filasEscritas: N }));
  anotar('D2 seguidos, escritura 50 ms, Meta instantanea', await correr({ latEscrituraMs: 50, sinPausa: true }), todos({ ok: N, filasEscritas: N }));
  anotar('D3 seguidos, escritura instantanea, Meta 30 ms (como A1)', await correr({ latMetaMs: 30, sinPausa: true }), sano({}));
  anotar('D4 [modelo] seguidos, escritura 100 ms, Meta 30 ms', await correr({ latEscrituraMs: 100, latMetaMs: 30, sinPausa: true }), null);
  anotar('D5 [modelo] seguidos, escritura 300 ms, Meta 30 ms', await correr({ latEscrituraMs: 300, latMetaMs: 30, sinPausa: true }), null);
  anotar('D6 Meta contesta 200 SIN id de mensaje', await correr({ meta: '200-sin-id' }), todos({ ok: N, filasEscritas: N }));
  anotar('D7 Meta NO contesta (plazo): pudo salir', await correr({ meta: 'plazo' }), todos({ ok: 0, confirmadas: 0, filasEscritas: N }));
  anotar('D8 Meta contesta 500: pudo salir', await correr({ meta: '500' }), todos({ ok: 0, confirmadas: 0 }));
  anotar('D9 Meta contesta 400: NO salio (no contar es lo correcto)', await correr({ meta: '400' }), todos({ ok: 0, confirmadas: 0 }));
  anotar('D10 medianoche: 5 a las 23:58 y 5 a las 00:01', await correr({ tandas: [{ n: 5, hora: [23, 58] }, { n: 5, hora: [24, 1] }] }), { aMeta: 2 * Math.min(5, C), bloqueoCliente: 10 - 2 * Math.min(5, C) });

  hablar('\n== E · CONTRAFACTICOS (a quien no se le pregunta) ==');
  anotar('E1 sin cliente en la llamada', await correr({ sinCliente: true }), todos({ ok: N, preguntasConCliente: 0, preguntasTope: N }));
  anotar('E2 sin comercio en la llamada', await correr({ sinMerchant: true }), todos({ ok: N, preguntasTope: 0, filasPedidas: 0 }));

  hablar('\n== LO QUE PREGUNTA EL DESTINO (where literal, del caso A1) ==');
  hablar('comercio: ' + JSON.stringify(rSano.primerWhere));
  hablar('cliente:  ' + JSON.stringify(rSano.primerWhereCliente));
  hablar('respuestas a la pregunta por cliente, A1 (sano):            ' + rSano.respuestas);
  hablar('respuestas a la pregunta por cliente, C1 (escritura falla): ' + rEsc.respuestas);
  hablar('respuestas a la pregunta por cliente, C2 (lectura falla):   ' + (rLec.respuestas || '(no llega a preguntarse: la de comercio LANZA antes)'));
  hablar('respuestas a la pregunta por comercio, C2:                  ' + rLec.respuestasComercio);

  const conEsperado = filasTabla.filter((f) => f.esperado).length;
  hablar('\nCASOS: ' + filasTabla.length + ' · con esperado: ' + conEsperado + ' · cuadran: ' + (conEsperado - noCuadran.length) + ' · NO cuadran: ' + noCuadran.length + ' · sin esperado (modelo): ' + (filasTabla.length - conEsperado));
  process.exit(noCuadran.length ? 1 : 0);
})().catch((e) => { hablar('GUION ROTO: ' + ((e && e.stack) || e)); process.exit(2); });
