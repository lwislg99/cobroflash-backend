#!/usr/bin/env node
// scripts/guard-notas-en-la-ficha.mjs — SCRUM-1132 · LA TARJETA DE NOTAS, MEDIDA EN NAVEGADOR
//
//   npm run guard:notas-en-la-ficha            (necesita `dist/`: npm run build)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL SERVIDOR TENÍA LAS NOTAS Y LA PANTALLA NO
//
// SCRUM-1036 dejó `GET`/`POST /admin/customers/:id/notes` y se cerró sin pantalla: la ficha del
// cliente no las pedía ni dejaba escribirlas. Este guard abre la ficha y mide lo que ve una persona.
//
// ── 🔴 TODO ES DE VERDAD MENOS LA BASE ───────────────────────────────────────────────────────
// La vista (`customerDetailView.js`) y `api.js` son los del árbol, y `apiRequest` hace un `fetch`
// de verdad. Las peticiones a `/notes` las contesta el ROUTER real (`customersAdmin.routes.js` de
// `dist/`, con su `requireRole`) y, debajo, `listarNotas`/`crearNota` reales. Lo único doblado es
// `prisma`: un almacén en memoria que filtra por TODOS los campos del `where` que le llegan, así
// que si la consulta pierde el `merchantId`, la nota del otro comercio aparece en pantalla.
// `/detail` y `/historial` salen de un fijo: no son lo que se mide.
//
// ── LOS LITERALES SALEN DEL REGISTRO DE LA FIRMA, NO DE AQUÍ ─────────────────────────────────
// `docs/microcopy/2026-10-14-SCRUM-1132-notas-del-cliente.md`, por el buscador de la casa. Si el
// registro no está o no trae los cuatro, el guard sale CIEGO: sin literal no hay con qué comparar.
//
// SALIDAS: 0 todo en su sitio · 1 hallazgo (haya ciegos o no) · 2 sólo ciegos.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from './_navegador.mjs';
import { veredictoDe, recorrerCasos } from './_hallazgos-y-ciegos.mjs';
import { aprobacionesDeMicrocopy } from '../tests/_microcopy-aprobada.mjs';
import { reqDeSesion } from '../tests/_arnes-de-router.mjs';

const AQUI = fileURLToPath(import.meta.url);
const RAIZ = path.join(path.dirname(AQUI), '..');
const PUBLICO = path.join(RAIZ, 'public');
const DIST = pathToFileURL(path.join(RAIZ, 'dist')).href + '/';
const CAPTURAS = process.env.NOTAS_CAPTURAS || '';

// ── LOS LITERALES FIRMADOS ────────────────────────────────────────────────────────────────────
const registro = aprobacionesDeMicrocopy().find((a) => a.ticket === 'SCRUM-1132' && a.ranura === 'notas-del-cliente');
const L = registro ? registro.literales : [];
const [TITULO, VACIO, BOTON, ERROR] = ['Notas', 'Sin notas', 'Añadir nota', 'No se pudo guardar:'].map((x) => (L.includes(x) ? x : null));

// ── LA BASE DOBLADA ───────────────────────────────────────────────────────────────────────────
const COMERCIO = 1;
const AJENO = 2;
const CLIENTE = 7;
const CLIENTE_SIN_NADA = 8;
let almacen;
function sembrar() {
  almacen = {
    merchant: [{ id: COMERCIO, name: 'Fontanería Medición' }, { id: AJENO, name: 'Otro Comercio' }],
    teamMember: [],
    customer: [
      { id: CLIENTE, merchantId: COMERCIO, notes: 'Texto fijo de la cabecera' },
      { id: CLIENTE_SIN_NADA, merchantId: COMERCIO, notes: null },
      // El MISMO id de cliente en otro comercio: la nota de abajo cuelga de él.
      { id: CLIENTE, merchantId: AJENO, notes: null },
    ],
    customerEvent: [
      { id: 1, merchantId: COMERCIO, customerId: CLIENTE, type: 'nota', title: 'Trae repuesto de la marca de siempre',
        meta: { authorName: 'Fontanería Medición', teamMemberId: null }, createdAt: new Date('2026-10-01T09:30:00Z') },
      { id: 2, merchantId: AJENO, customerId: CLIENTE, type: 'nota', title: 'NOTA DE OTRO COMERCIO',
        meta: { authorName: 'Otro Comercio', teamMemberId: null }, createdAt: new Date('2026-10-02T09:30:00Z') },
    ],
  };
}

/** ¿La fila cumple el `where`? Todo campo escalar del `where` cuenta; `{ not: x }` también. */
function casa(where, fila) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'not' in v) return fila[k] !== v.not;
    return fila[k] === v;
  });
}
const proyectar = (fila, select) => (fila && select ? Object.fromEntries(Object.keys(select).map((k) => [k, fila[k]])) : fila);
const modelo = (nombre) => ({
  findFirst: async ({ where, select } = {}) => proyectar(almacen[nombre].find((f) => casa(where, f)) || null, select),
  findUnique: async ({ where, select } = {}) => proyectar(almacen[nombre].find((f) => casa(where, f)) || null, select),
  findMany: async ({ where } = {}) => almacen[nombre].filter((f) => casa(where, f))
    .sort((a, b) => (b.createdAt - a.createdAt) || (b.id - a.id)),
  create: async ({ data }) => {
    const fila = { id: almacen[nombre].reduce((m, f) => Math.max(m, f.id), 0) + 1, createdAt: new Date(), ...data };
    almacen[nombre].push(fila);
    return fila;
  },
});

let router;
let prismaModulo;
let originales;
const ciegosDeCarga = [];
try {
  const mod = await import(DIST + 'modules/system/app/routes/customersAdmin.routes.js');
  router = mod.default?.default ?? mod.default;
  prismaModulo = await import(DIST + 'core/db/prisma.js');
} catch (e) {
  ciegosDeCarga.push(`no se pudo cargar el router de dist/ (${e.message}). ¿Falta npm run build?`);
}
if (ciegosDeCarga.length) {
  const hallazgosDeCarga = [];
  const sinRouter = veredictoDe({ hallazgos: hallazgosDeCarga, ciegos: ciegosDeCarga });
  console.error(`🔴 NO SUPE MEDIR: ${ciegosDeCarga.join(' · ')}\n${sinRouter.linea}`);
  process.exit(sinRouter.codigo);
}
const MODELOS = ['merchant', 'teamMember', 'customer', 'customerEvent'];
originales = Object.fromEntries(MODELOS.map((m) => [m, prismaModulo.prisma[m]]));
for (const m of MODELOS) prismaModulo.prisma[m] = modelo(m);

// Sólo se fuerza a 500 cuando un caso lo pide: es el fallo SIN `message`.
let forzar500 = false;

/** Una petición del navegador, despachada por el router REAL con la sesión del caso. */
function despachar(metodo, ruta, cuerpo, rol, res) {
  const salida = (codigo, json) => { res.writeHead(codigo, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
  if (forzar500 && metodo === 'POST') return salida(500, { error: 'internal_error' });
  const [camino] = ruta.split('?');
  const req = reqDeSesion({ rol, merchantId: COMERCIO, teamMemberId: null, method: metodo, url: camino, headers: {}, query: {}, params: {}, body: cuerpo });
  const r = {
    _c: 200,
    status(c) { this._c = c; return this; },
    json(b) { salida(this._c, b); return this; },
    send(b) { salida(this._c, b); return this; },
  };
  router.handle(req, r, (err) => salida(404, { error: 'not_found', sinRuta: true, err: err && err.message }));
}

const SCRIPTS = ['api.js', 'contacto.js', 'modalHeader.js', 'filtroClientes.js', 'clienteVolverALlamar.js',
  'etiquetasDelDocumento.js', 'buscadorDeClientes.js', 'customerDetailView.js'];

function pagina(caso) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/fonts/inter.css"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/dashboard/css/styles.css">
</head><body><div class="layout"><div class="main"><div id="ficha"></div></div></div>
${SCRIPTS.map((s) => `<script src="/dashboard/js/${s}"></script>`).join('\n')}
<script>
  window.appState = { customerId360: ${caso.cliente} };
  window.appLocale = {};
  window.appUserRole = ${JSON.stringify(caso.rol)};
  window.renderAppView = () => {};
  window.showToast = () => {};
</script></body></html>`;
}

const detalle = (id) => ({
  customer: { id, name: 'Cliente de medición', phone: '34000000001', email: 'x@test.local', tags: null,
    notes: (almacen.customer.find((c) => c.id === id && c.merchantId === COMERCIO) || {}).notes || null,
    createdAt: '2026-01-01T00:00:00Z' },
  quotes: [], invoices: [], events: [],
  stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, profit: 0 },
});

let casoActual = null;
const peticiones = [];
const servidor = http.createServer((req, res) => {
  // El camino, sin la consulta. Sin `new URL`: su error lleva la cadena entera (SCRUM-414).
  const u = { pathname: decodeURIComponent(String(req.url).split('?')[0]) };
  if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(pagina(casoActual)); }
  if (u.pathname.startsWith('/admin/customers/')) {
    peticiones.push(`${req.method} ${u.pathname}`);
    const resto = u.pathname.slice('/admin/customers'.length);
    if (/\/notes$/.test(resto)) {
      let crudo = '';
      req.on('data', (c) => { crudo += c; });
      req.on('end', () => {
        let cuerpo = {};
        try { cuerpo = crudo ? JSON.parse(crudo) : {}; } catch { cuerpo = {}; }
        despachar(req.method, resto, cuerpo, casoActual.rol, res);
      });
      return;
    }
    const json = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (/\/detail$/.test(resto)) return json(detalle(Number(resto.split('/')[1])));
    if (/\/historial/.test(resto)) return json({ trabajos: [], hayMas: false });
    if (/\/whatsapp/.test(resto)) return json({ mensajes: [] });
    return json({});
  }
  const fichero = path.join(PUBLICO, u.pathname);
  if (!fichero.startsWith(PUBLICO) || !fs.existsSync(fichero)) { res.writeHead(404); return res.end(); }
  const tipo = fichero.endsWith('.js') ? 'text/javascript' : fichero.endsWith('.css') ? 'text/css' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
  res.end(fs.readFileSync(fichero));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${servidor.address().port}`;

const CASOS = [
  { nombre: 'admin con notas', rol: 'admin', cliente: CLIENTE },
  { nombre: 'admin sin notas', rol: 'admin', cliente: CLIENTE_SIN_NADA },
  { nombre: 'técnico', rol: 'tecnico', cliente: CLIENTE },
];
const ANCHOS = [390, 768, 1280];

const navegador = await lanzarNavegador(puppeteer, {});
let cuentas;
const filas = [];

/** Lo que una persona ve en la tarjeta, leído del DOM. */
async function leerTarjeta(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#ficha [data-tarjeta="notas"]');
    if (!t) return null;
    const boton = t.querySelector('button');
    const campo = t.querySelector('textarea');
    const r = boton ? boton.getBoundingClientRect() : null;
    return {
      titulo: (t.querySelector('h3') || {}).textContent || '',
      texto: t.innerText,
      notas: [...t.querySelectorAll('[data-nota]')].map((n) => n.innerText),
      boton: boton ? boton.textContent.trim() : null,
      altoBoton: r ? r.height : 0,
      campoNombrado: Boolean(campo && (campo.getAttribute('aria-labelledby') || campo.getAttribute('aria-label') || campo.labels?.length)),
      error: ((t.querySelector('[data-error-nota]') || {}).textContent || '').trim(),
      desborda: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

try {
  const page = await navegador.newPage();
  cuentas = await recorrerCasos(CASOS, async (caso, suyas) => {
    const ciegos = [];
    const suyos = suyas.hallazgos;
    if (!TITULO || !VACIO || !BOTON || !ERROR) {
      return { hallazgos: [], ciegos: [`sin los cuatro literales en el registro de la firma (leídos: ${JSON.stringify(L)})`] };
    }
    for (const ancho of ANCHOS) {
      sembrar(); forzar500 = false; peticiones.length = 0; casoActual = caso;
      await page.setViewport({ width: ancho, height: 900 });
      await page.goto(base + '/', { waitUntil: 'networkidle0' });
      await page.evaluate(() => renderCustomer360View(document.getElementById('ficha'), window.appState.customerId360));
      await page.waitForNetworkIdle({ idleTime: 150 });
      // SUELO: la ficha tiene que haber pintado algo suyo. Sin ancla, «no hay tarjeta» no dice nada.
      const pinto = await page.evaluate(() => Boolean(document.querySelector('#ficha #btn-edit-360')));
      if (!pinto) { ciegos.push(`${ancho}px: la ficha no ha pintado (sin #btn-edit-360)`); continue; }
      const t = await leerTarjeta(page);
      const cabecera = await page.evaluate(() => (document.querySelector('#ficha .customers-card') || {}).innerText || '');
      if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `${caso.nombre.replace(/\W+/g, '-')}-${ancho}.png`), fullPage: true });

      if (caso.rol === 'tecnico') {
        if (t) suyos.push(`${ancho}px: al técnico se le pinta la tarjeta, y las dos rutas son requireRole('admin')`);
        if (peticiones.some((p) => p.endsWith('/notes'))) suyos.push(`${ancho}px: la ficha del técnico pide /notes (sería un 403)`);
        filas.push({ caso: caso.nombre, ancho, tarjeta: Boolean(t) });
        continue;
      }
      if (!t) { suyos.push(`${ancho}px: la ficha NO tiene tarjeta de notas`); filas.push({ caso: caso.nombre, ancho, tarjeta: false }); continue; }
      if (t.titulo.trim() !== TITULO) suyos.push(`${ancho}px: el título es ${JSON.stringify(t.titulo)}, no «${TITULO}»`);
      if (t.boton !== BOTON) suyos.push(`${ancho}px: el botón dice ${JSON.stringify(t.boton)}, no «${BOTON}»`);
      if (!t.campoNombrado) suyos.push(`${ancho}px: el campo de la nota no tiene nombre accesible`);
      if (ancho === 390 && t.altoBoton < 44) suyos.push(`390px: el botón mide ${t.altoBoton}px de alto (< 44)`);
      if (t.desborda) suyos.push(`${ancho}px: la página desborda a lo ancho`);
      if (t.texto.includes('NOTA DE OTRO COMERCIO')) suyos.push(`${ancho}px: 🔴 sale la nota de OTRO comercio (regla 2)`);
      if (t.texto.includes('Texto fijo de la cabecera')) suyos.push(`${ancho}px: la tarjeta repite la Nota fija; la forma firmada es la (B): sólo en la cabecera`);

      if (caso.cliente === CLIENTE) {
        if (!cabecera.includes('Texto fijo de la cabecera')) suyos.push(`${ancho}px: la Nota fija ha desaparecido de la cabecera`);
        if (t.notas.length !== 1 || !t.notas[0].includes('Trae repuesto de la marca de siempre')) suyos.push(`${ancho}px: se esperaba la nota del comercio y sólo ésa; hay ${JSON.stringify(t.notas)}`);
        else if (!t.notas[0].includes('Fontanería Medición') || !/2026/.test(t.notas[0])) suyos.push(`${ancho}px: la nota no lleva fecha y autor: ${JSON.stringify(t.notas[0])}`);
        if (t.texto.includes(VACIO)) suyos.push(`${ancho}px: dice «${VACIO}» teniendo una nota`);

        // ── EL CLIC REAL: escribir y pulsar «Añadir nota» ──
        await page.type('#ficha [data-tarjeta="notas"] textarea', 'Llamar antes de subir');
        const [botonEl] = await page.$$('#ficha [data-tarjeta="notas"] button');
        await botonEl.click();
        await page.waitForNetworkIdle({ idleTime: 150 });
        const tras = await leerTarjeta(page);
        const guardada = almacen.customerEvent.find((e) => e.title === 'Llamar antes de subir');
        if (!guardada) suyos.push(`${ancho}px: el clic en «${BOTON}» no llegó a escribir la nota`);
        else if (guardada.merchantId !== COMERCIO) suyos.push(`${ancho}px: 🔴 la nota se escribió con el comercio ${guardada.merchantId}`);
        if (!tras || !tras.notas[0] || !tras.notas[0].includes('Llamar antes de subir')) suyos.push(`${ancho}px: tras guardar, la nota nueva no aparece la primera (${JSON.stringify(tras && tras.notas)})`);
        if (tras && tras.error) suyos.push(`${ancho}px: tras guardar bien sale un error: ${JSON.stringify(tras.error)}`);
        const campoVacio = await page.$eval('#ficha [data-tarjeta="notas"] textarea', (c) => c.value === '');
        if (!campoVacio) suyos.push(`${ancho}px: tras guardar, el campo no se vacía`);

        // ── EL ERROR CON MOTIVO DEL SERVIDOR: pulsar con el campo vacío ──
        await botonEl.click();
        await page.waitForNetworkIdle({ idleTime: 150 });
        const vacio = await leerTarjeta(page);
        const esperado = `${ERROR} Escribe algo antes de guardar la nota.`;
        if (!vacio || vacio.error !== esperado) suyos.push(`${ancho}px: con el campo vacío el error es ${JSON.stringify(vacio && vacio.error)}, no ${JSON.stringify(esperado)}`);

        // ── EL ERROR SIN MOTIVO (500 sin `message`): nunca la tripa del sistema ──
        forzar500 = true;
        await page.type('#ficha [data-tarjeta="notas"] textarea', 'otra');
        await botonEl.click();
        await page.waitForNetworkIdle({ idleTime: 150 });
        const fallo = await leerTarjeta(page);
        forzar500 = false;
        if (!fallo || !fallo.error.startsWith(ERROR)) suyos.push(`${ancho}px: el 500 no empieza por «${ERROR}»: ${JSON.stringify(fallo && fallo.error)}`);
        if (fallo && /API \d|internal_error|Failed to fetch/.test(fallo.error)) suyos.push(`${ancho}px: el 500 enseña la tripa del sistema: ${JSON.stringify(fallo.error)}`);
        filas.push({ caso: caso.nombre, ancho, tarjeta: true, notas: t.notas.length, error: vacio && vacio.error, fallo: fallo && fallo.error });
      } else {
        if (!t.texto.includes(VACIO)) suyos.push(`${ancho}px: sin notas, la tarjeta no dice «${VACIO}»`);
        if (t.notas.length) suyos.push(`${ancho}px: sin notas pinta ${t.notas.length}`);
        filas.push({ caso: caso.nombre, ancho, tarjeta: true, notas: 0 });
      }
    }
    return { hallazgos: suyos, ciegos };
  }, (caso) => caso.nombre);
} finally {
  await navegador.close().catch(() => {});
  servidor.close();
  for (const m of MODELOS) prismaModulo.prisma[m] = originales[m];
}

console.log(`\n${'═'.repeat(84)}`);
console.log('LA TARJETA DE NOTAS · medida en NAVEGADOR, con la ruta real · ' + ANCHOS.join(' / ') + ' px');
console.log(`${'═'.repeat(84)}`);
for (const f of filas) console.log(`  ${f.caso.padEnd(18)}${String(f.ancho).padEnd(6)}${f.tarjeta ? 'tarjeta' : 'SIN TARJETA'}${f.notas !== undefined ? ` · ${f.notas} nota(s)` : ''}${f.error ? ` · vacío: ${f.error}` : ''}${f.fallo ? ` · 500: ${f.fallo}` : ''}`);

const { hallazgos, ciegos } = cuentas;
if (ciegos.length) console.error(`\n🔴 NO SUPE MEDIR — de esto no se da ningún veredicto:\n   · ${ciegos.join('\n   · ')}\n`);
if (hallazgos.length) console.error('\n🔴 HALLAZGOS:\n  · ' + hallazgos.join('\n  · ') + '\n');
const veredictoFinal = veredictoDe({ hallazgos, ciegos });
if (veredictoFinal.codigo !== 0) {
  console.error(veredictoFinal.linea + '\n');
  process.exit(veredictoFinal.codigo);
}
console.log(veredictoFinal.linea);
console.log('\n✅ La ficha pinta las notas del comercio, guarda con un clic y dice por qué no guarda.\n');
