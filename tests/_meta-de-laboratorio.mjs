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
//     el test comprueba que el servidor recibió tantas peticiones como envíos se hicieron;
//   · las credenciales son la cadena `laboratorio-1477`, y el destino es del rango imposible
//     (`telefonoDePrueba`, SCRUM-262).
//
// Lo que NO se dobla es lo que se mide: axios, su transporte HTTP, el error que fabrica ante un
// 4xx, un 5xx, un plazo vencido o un corte, y el `catch` de producción tal cual está en `dist/`.
//
// EL LÍMITE: el plazo real es de 10 s (`timeout: 10_000`). Aquí se ANOTA el que pide cada envío
// y se acorta a `PLAZO_DE_LABORATORIO_MS` para no esperar setenta segundos. El error que sale es
// el de axios por plazo vencido; lo que cambia es la cifra de su mensaje.
//
// USO: `node tests/_meta-de-laboratorio.mjs <caso>` → un JSON por stdout. Lo lanza
// `tests/scrum1477-meta-dijo-que-no-o-no-contesto.test.mjs` con el entorno construido a mano.
import http from 'node:http';
import { createRequire } from 'node:module';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

export const PLAZO_DE_LABORATORIO_MS = 300;

/** Lo que contesta el servidor de laboratorio en cada caso. `null` = no contesta nunca. */
export const CASOS = Object.freeze({
  'responde-200': { status: 200, cuerpo: { messages: [{ id: 'wamid.laboratorio-1477' }] } },
  'meta-400': { status: 400, cuerpo: { error: { message: '(#131026) Message undeliverable', type: 'OAuthException', code: 131026 } } },
  'meta-401': { status: 401, cuerpo: { error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 } } },
  'meta-429': { status: 429, cuerpo: { error: { message: '(#130429) Rate limit hit', type: 'OAuthException', code: 130429 } } },
  'meta-408': { status: 408, cuerpo: { error: { message: 'Request timeout', code: 408 } } },
  'meta-500': { status: 500, cuerpo: { error: { message: 'An unknown error occurred', type: 'OAuthException', code: 1 } } },
  'meta-503': { status: 503, cuerpo: { error: { message: 'Service temporarily unavailable', code: 2 } } },
  'sin-respuesta': null,
  'corte': 'corte',
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
      recibidas.push({ ruta: req.url, bytes: cuerpo.length });
      const que = CASOS[caso];
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
  const { inyectarBase, moduloDeDist, MERCHANT } = await import('./_envio-doblado.mjs');
  delete process.env.WHATSAPP_DRY_RUN; // `_envio-doblado` lo enciende al cargarse; aquí se mide SIN él
  const filas = [];
  inyectarBase({
    'customer.findMany': () => [], // nadie se ha dado de baja (J3)
    'whatsAppMessage.create': (args) => { filas.push(args?.data ?? null); return {}; },
  });

  const requiere = createRequire(import.meta.url);
  const axios = requiere('axios');
  const transporte = axios.getAdapter('http');
  const salidas = [];
  axios.defaults.adapter = (cfg) => {
    const pedida = new URL(String(cfg.url));
    salidas.push({ protocolo: pedida.protocol, destino: pedida.host, ruta: pedida.pathname, plazoPedidoMs: cfg.timeout });
    cfg.url = `http://127.0.0.1:${puerto}${pedida.pathname}${pedida.search}`;
    cfg.proxy = false;
    if (caso === 'sin-respuesta') cfg.timeout = PLAZO_DE_LABORATORIO_MS;
    return transporte(cfg);
  };

  const { config } = moduloDeDist('../dist/core/config/env.js');
  config.WHATSAPP_PHONE_NUMBER_ID = 'laboratorio-1477';
  config.WHATSAPP_ACCESS_TOKEN = 'laboratorio-1477';
  const wa = moduloDeDist('../dist/integrations/whatsapp.js');

  const resultados = {};
  for (const [nombre, extra] of Object.entries(ENVIOS)) {
    const antes = salidas.length;
    const r = await wa[nombre]({ to: telefonoDePrueba(77), merchantId: MERCHANT, ...extra });
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
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  medir(process.argv[2]).then(
    (r) => { process.stdout.write(`${JSON.stringify(r)}\n`); process.exit(0); },
    (e) => { process.stderr.write(`${e?.stack || e}\n`); process.exit(1); },
  );
}
