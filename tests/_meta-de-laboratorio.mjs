// tests/_meta-de-laboratorio.mjs — SCRUM-1477
//
// EL `catch` DE LOS SIETE ENVÍOS, EJECUTADO: qué devuelve `whatsapp.ts` cuando Meta dice que no,
// cuando no contesta y cuando se corta.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UN PROCESO APARTE Y NO UN CASO DE TEST
//
// Desde un proceso de test ese `catch` sólo se alcanza por un camino. Con `WHATSAPP_DRY_RUN=1`
// el envío vuelve ANTES de llamar a Meta; sin él, el interceptor de SCRUM-180 lanza antes de que
// salga nada (`asegurarSalidaAMetaPermitida`). Ese freno no se toca: es lo que impide que un
// fixture escriba a una persona. Así que la respuesta de Meta se ejercita aquí, en un proceso
// que NO es de test, y este fichero pone en su sitio lo que el freno garantizaba:
//
//   · el transporte de axios se sustituye ANTES de cargar `whatsapp.js`, y lo único que hace es
//     cambiar el destino por `127.0.0.1` y un puerto efímero. No se resuelve ningún nombre;
//   · TODA petición se desvía, vaya a donde vaya: este fichero no sabe dónde está Meta ni le hace
//     falta. Anota el destino que pedía `whatsapp.ts` y lo cambia por el servidor de laboratorio;
//     el test comprueba que el servidor recibió tantas peticiones como salieron;
//   · las credenciales son la cadena `laboratorio-1477`, y el destino es del rango imposible
//     (`telefonoDePrueba`, SCRUM-262).
//
// Lo que NO se dobla es lo que se mide: axios, su transporte HTTP, el error que fabrica ante un
// 4xx, un 5xx, un plazo vencido o un corte, y el `catch` de producción tal cual está en `dist/`.
//
// EL LÍMITE: el plazo real es de 10 s (`timeout: 10_000`). Aquí se ANOTA el que pide cada envío
// y, cuando el servidor no va a contestar, se acorta a `PLAZO_DE_LABORATORIO_MS` para no esperar
// más de un minuto. El error que sale es el de axios por plazo vencido; cambia la cifra de su
// mensaje.
//
// USO: `node tests/_meta-de-laboratorio.mjs <caso>` → un JSON por stdout. Lo lanza
// `tests/scrum1477-meta-dijo-que-no-o-no-contesto.test.mjs` con el entorno construido a mano.
import http from 'node:http';
import { createRequire } from 'node:module';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

export const PLAZO_DE_LABORATORIO_MS = 300;

const NO_ENTREGABLE = { status: 400, cuerpo: { error: { message: '(#131026) Message undeliverable', type: 'OAuthException', code: 131026 } } };

/**
 * Lo que contesta el servidor de laboratorio en cada caso. `null` = no contesta nunca ·
 * `'corte'` = recibe el envío entero y cierra la conexión · `{ porTipo, resto }` = depende del
 * `type` del mensaje que le llega (para el envío por ventana, que puede hacer DOS intentos).
 */
export const CASOS = Object.freeze({
  'responde-200': { status: 200, cuerpo: { messages: [{ id: 'wamid.laboratorio-1477' }] } },
  'meta-400': NO_ENTREGABLE,
  'meta-401': { status: 401, cuerpo: { error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 } } },
  'meta-429': { status: 429, cuerpo: { error: { message: '(#130429) Rate limit hit', type: 'OAuthException', code: 130429 } } },
  'meta-408': { status: 408, cuerpo: { error: { message: 'Request timeout', code: 408 } } },
  'meta-500': { status: 500, cuerpo: { error: { message: 'An unknown error occurred', type: 'OAuthException', code: 1 } } },
  'meta-503': { status: 503, cuerpo: { error: { message: 'Service temporarily unavailable', code: 2 } } },
  'sin-respuesta': null,
  'corte': 'corte',
  // El texto de ventana se queda sin respuesta; la plantilla que va detrás, Meta la rechaza.
  'texto-sin-respuesta-y-plantilla-400': { porTipo: { template: NO_ENTREGABLE }, resto: null },
  // El texto de ventana se queda sin respuesta; la plantilla que va detrás SALE.
  'texto-sin-respuesta-y-plantilla-200': {
    porTipo: { template: { status: 200, cuerpo: { messages: [{ id: 'wamid.laboratorio-1477' }] } } }, resto: null,
  },
});

/** Los siete envíos que llaman a Meta, con lo mínimo que cada uno pide. */
export const ENVIOS = Object.freeze({
  sendWhatsAppTemplate: { templateName: 'laboratorio_1477', components: [] },
  sendWhatsAppText: { text: 'x' },
  sendWhatsAppButtons: { bodyText: 'x', buttons: [{ id: 'a', title: 'A' }] },
  sendWhatsAppList: { bodyText: 'x', buttonText: 'Ver', rows: [{ id: 'a', title: 'A' }] },
  sendWhatsAppCtaUrl: { bodyText: 'x', buttonText: 'Abrir', url: 'https://yaqu.app/' },
  sendWhatsAppDocument: { link: 'https://yaqu.app/laboratorio.pdf' },
  sendWhatsAppLocationRequest: { bodyText: 'x' },
});

/** Qué hace el servidor con un mensaje de ese `type` en ese caso. */
function planDe(caso, tipo) {
  const que = CASOS[caso];
  if (que && typeof que === 'object' && 'porTipo' in que) return tipo in que.porTipo ? que.porTipo[tipo] : que.resto;
  return que;
}
const tipoDe = (cuerpo) => { try { return String(JSON.parse(cuerpo)?.type); } catch { return 'ilegible'; } };

async function medir(caso) {
  if (!(caso in CASOS)) throw new Error(`caso desconocido: ${caso}. Los que hay: ${Object.keys(CASOS).join(', ')}`);
  if (process.env.NODE_TEST_CONTEXT || process.execArgv.some((a) => a === '--test' || a.startsWith('--test-'))) {
    throw new Error('CIEGO: esto es un proceso de test, y ahí el interceptor de SCRUM-180 lanza antes de salir. '
      + 'Se lanza como proceso aparte, sin NODE_TEST_CONTEXT.');
  }

  // Lo que escriben los envíos por consola no es parte de la medida, y stdout es el JSON.
  console.error = () => {};
  console.warn = () => {};
  console.log = () => {};

  const recibidas = [];
  const abiertos = new Set();
  const servidor = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const tipo = tipoDe(cuerpo);
      recibidas.push({ ruta: req.url, tipo });
      const que = planDe(caso, tipo);
      if (que === null) return; // no contesta: el envío llegó entero y no se le dice nada
      if (que === 'corte') { req.socket.destroy(); return; }
      res.writeHead(que.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(que.cuerpo));
    });
  });
  servidor.on('connection', (s) => { abiertos.add(s); s.on('close', () => abiertos.delete(s)); });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const puerto = servidor.address().port;

  // ANTES de cargar nada de `dist/`: la base, y el transporte de axios.
  const { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } = await import('./_envio-doblado.mjs');
  delete process.env.WHATSAPP_DRY_RUN; // `_envio-doblado` lo enciende al cargarse; aquí se mide SIN él
  const filas = [];
  inyectarBase({
    'customer.findMany': () => [], // nadie se ha dado de baja (J3)
    'whatsAppMessage.create': (args) => { filas.push(args?.data ?? null); return {}; },
    // La ventana de 24 h del cliente, ABIERTA: sólo la mira el envío por ventana.
    'whatsAppMessage.findFirst': (args) => (args?.where?.type === 'inbound' ? { id: 1 } : null),
  });

  const requiere = createRequire(import.meta.url);
  const axios = requiere('axios');
  const transporte = axios.getAdapter('http');
  const salidas = [];
  axios.defaults.adapter = (cfg) => {
    const pedida = new URL(String(cfg.url));
    const tipo = tipoDe(cfg.data);
    salidas.push({ protocolo: pedida.protocol, destino: pedida.host, ruta: pedida.pathname, tipo, plazoPedidoMs: cfg.timeout });
    cfg.url = `http://127.0.0.1:${puerto}${pedida.pathname}${pedida.search}`;
    cfg.proxy = false;
    if (planDe(caso, tipo) === null) cfg.timeout = PLAZO_DE_LABORATORIO_MS;
    return transporte(cfg);
  };

  const { config } = moduloDeDist('../dist/core/config/env.js');
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1477';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1477';
  const wa = moduloDeDist('../dist/integrations/whatsapp.js');
  const to = telefonoDePrueba(77);

  const resultados = {};
  for (const [nombre, extra] of Object.entries(ENVIOS)) {
    const antes = salidas.length;
    const r = await wa[nombre]({ to, merchantId: MERCHANT, ...extra });
    resultados[nombre] = {
      claves: Object.keys(r).sort(),
      ok: r.ok,
      reason: r.reason ?? null,
      desenlace: r.desenlace ?? null,
      tipoDeError: r.error === undefined ? 'no hay' : typeof r.error,
      error: r.error ?? null,
      salidas: salidas.length - antes,
    };
  }

  // El envío POR VENTANA, con la ventana abierta: primero un texto y, si falla, la plantilla
  // (o nada, si el llamador pidió `sinPlantilla`).
  const porVentana = {};
  for (const sinPlantilla of [false, true]) {
    const antes = salidas.length;
    const r = await wa.sendWhatsAppWindowFirst({
      to, merchantId: MERCHANT, customerId: CLIENTE, windowText: 'x', sinPlantilla,
      template: { templateName: 'laboratorio_1477', components: [] },
    });
    porVentana[sinPlantilla ? 'sinPlantilla' : 'conPlantilla'] = {
      ok: r.ok,
      via: r.via,
      reason: r.reason ?? null,
      desenlace: r.desenlace ?? null,
      error: r.error ?? null,
      intentos: salidas.slice(antes).map((s) => s.tipo),
    };
  }

  for (const s of abiertos) s.destroy();
  await new Promise((ok) => servidor.close(ok));
  // Dar una vuelta al bucle: `recordWaMessage` se lanza sin esperarse.
  await new Promise((ok) => setImmediate(ok));

  return {
    caso,
    puerto,
    enviosMedidos: Object.keys(resultados).length,
    salidas,
    recibidas: recibidas.length,
    filasDeFallo: filas.filter((f) => f?.status === 'failed').length,
    resultados,
    porVentana,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  medir(process.argv[2]).then(
    (r) => { process.stdout.write(`${JSON.stringify(r)}\n`); process.exit(0); },
    (e) => { process.stderr.write(`${e?.stack || e}\n`); process.exit(1); },
  );
}
