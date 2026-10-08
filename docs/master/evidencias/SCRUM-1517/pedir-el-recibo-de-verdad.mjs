// docs/master/evidencias/SCRUM-1517/pedir-el-recibo-de-verdad.mjs — SCRUM-1517
//
// ¿QUÉ CONTESTA `GET /recibo/:token/pdf` CUANDO LA FACTURA ESTÁ PENDIENTE DE SELLADO?
//
// SCRUM-1510 (c.18965) lo dejó LEÍDO, NO EJECUTADO: «daría 500 y no el 409 firmado». Aquí no se
// razona: se PIDE. La fila la escribe el camino real compilado (`sellarTrasEmision` +
// `applyVeriFactu` de `dist/`, la receta de `../SCRUM-1510/fabricar-la-factura-del-segundo-porton.mjs`),
// y después se monta el ROUTER COMPILADO de la ruta en un express de verdad, en un puerto de
// verdad, y se le hace una petición HTTP de verdad. Lo único doblado es la BASE.
//
// De paso se le pide lo mismo a la OTRA ruta que ramifica por `esErrorSinSellar`
// (`GET /admin/invoices/:id/pdf`), que es el punto 2 del encargo.
//
//   node docs/master/evidencias/SCRUM-1517/pedir-el-recibo-de-verdad.mjs
//
// Sólo LEE `dist/` y `prisma/schema.prisma`. No toca `src/`, ni el camino de emisión, ni ninguna
// base de verdad. Los PDF que salgan van a un directorio temporal del sistema, nunca al árbol.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const DIST = path.join(RAIZ, 'dist');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// `invoicesDir` se calcula al CARGAR `dist` desde el directorio del proceso: se cambia ANTES.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1517-'));
process.chdir(TMP);
// Se borra PASE LO QUE PASE (también si un caso lanza): al salir el proceso, y volviendo antes al
// árbol, porque Windows no deja borrar el directorio en el que está el proceso (SCRUM-864c).
process.on('exit', () => {
  try { process.chdir(RAIZ); fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temporal del sistema */ }
});

const requiere = createRequire(path.join(DIST, 'x.js'));
const rutaDe = (r) => requiere.resolve(path.join(DIST, r));

const NIF = 'B12345678';
const ES = Object.freeze({ id: 77, country: 'ES', taxId: NIF, email: 'obra@example.test', name: 'Fontaneria', legalName: 'Fontaneria S.L.', address: null, logoUrl: null, whatsappPhone: null, timezone: null });
const TOKEN = 'tok-scrum1517-recibo-de-prueba';
const COBRO = 501;

/** La base doblada, CON ESTADO (la de SCRUM-1510), más lo que la ruta lee para llegar a la factura. */
function base({ numero, merchant, nace, falla = [] }) {
  const llamadas = [];
  const fila = {
    id: 4101, number: numero, total: '121.00', currency: 'EUR', type: 'F1', stageLabel: null,
    createdAt: new Date('2026-09-29T10:00:00Z'), merchantId: merchant.id, customerId: 9,
    lines: [{ concept: 'Obra', qty: 1, price: 100, tax: 0.21 }],
    pdfUrl: 'PENDING_PDF', qrData: 'PENDING_QR',
    vfEstado: nace, vfHash: null, vfPrevHash: null, vfTimestamp: null,
    vfAnulHash: null, vfAnulTimestamp: null, vfAnulPrevHash: null,
    merchantName: null, rectifies: null,
    merchant: { ...merchant },
    customer: { id: 9, name: 'Cliente', legalName: null, taxId: 'A11111111', email: null, phone: null, address: null },
  };
  const respuestas = {
    'invoice.findUnique': () => fila,
    // La ruta del panel comprueba que la factura es del comercio con `findFirst({ id, merchantId })`.
    // Cualquier otra forma (la cadena buscando su eslabón anterior) sigue recibiendo «no hay».
    'invoice.findFirst': (a) => (a?.where?.id === fila.id && a?.where?.merchantId === fila.merchantId ? { id: fila.id } : null),
    'invoice.update': (a) => { Object.assign(fila, a?.data ?? {}); return fila; },
    'merchant.findUnique': () => ({ ...fila.merchant }),
    // El cobro PAGADO al que apunta el enlace del recibo, con su evento «facturado».
    'charge.findUnique': (a) => (a?.where?.receiptToken === TOKEN
      ? { id: COBRO, status: 'paid', merchantId: fila.merchantId, events: [{ type: 'invoiced', payload: { invoice_id: fila.id } }] }
      : null),
    'quote.findFirst': () => null,
  };
  const modelo = (m) => new Proxy({}, {
    get: (_, metodo) => async (args) => {
      const clave = `${m}.${String(metodo)}`;
      llamadas.push({ clave, args });
      const f = falla.find((x) => x.clave === clave && x.si(args));
      if (f) throw new Error(f.mensaje);
      const r = respuestas[clave];
      if (r) return r(args);
      if (metodo === 'findMany') return [];
      if (metodo === 'count') return 0;
      return { id: llamadas.length, ...(args?.data ?? {}) };
    },
  });
  const cliente = new Proxy({}, {
    get: (_, k) => {
      if (k === '$transaction') return async (fn) => fn(cliente);
      if (k === '$executeRaw' || k === '$executeRawUnsafe') return async () => 1;
      if (k === '$queryRaw') return async () => [];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return modelo(String(k));
    },
  });
  return { cliente, llamadas, fila };
}

// UN solo doble de base para todo el proceso, que delega en el caso en curso: así los routers se
// cargan UNA vez (con todo su árbol de imports) y lo que cambia entre casos es sólo la fila.
let enCurso = null;
const delegado = new Proxy({}, {
  get: (_, k) => {
    if (k === 'then' || typeof k === 'symbol') return undefined;
    return enCurso.cliente[k];
  },
});
const fPrisma = rutaDe('core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: delegado } };

const K = requiere(rutaDe('modules/invoicing/domain/selladoEstado.js'));
const porton = requiere(rutaDe('modules/invoicing/domain/portonDocumento.js'));
// `--simular-la-propuesta`: ENSAYO, no arreglo. Sustituye EN MEMORIA, en este proceso y nada más,
// la función de clasificación por una que además reconoce el error del primer corte. No se escribe
// ningún fichero (ni de `src/` ni de `dist/`): sirve para ver qué contestarían las dos rutas si la
// propuesta ① del registro se construyera. Las rutas compiladas la llaman por propiedad del módulo
// (`portonDocumento_1.esErrorSinSellar`), así que ven la sustituta.
const ENSAYO = process.argv.includes('--simular-la-propuesta');
if (ENSAYO) {
  const original = porton.esErrorSinSellar;
  porton.esErrorSinSellar = (e) => original(e) || String(e?.message ?? '') === K.ERROR_PDF_SIN_SELLAR;
  if (porton.esErrorSinSellar(new Error(K.ERROR_PDF_SIN_SELLAR)) !== true) throw new Error('CIEGO: la sustitución en memoria no ha prendido');
}
const express = requiere('express');
const reciboRouter = requiere(rutaDe('modules/billing/app/routes/receipt.routes.js')).default;
const panelRouter = requiere(rutaDe('modules/system/app/routes/invoicesAdmin.routes.js')).default;
const PAGINA_404 = requiere(rutaDe('core/http/publicNotFound.js')).documentNotFoundHtml();
const TITULO_404 = /<h1>([^<]+)<\/h1>/.exec(PAGINA_404)[1];

// Lo que las rutas mandan a `console.error` se RECOGE, no se pierde: dice qué error les llegó.
const registro = [];
const errorOriginal = console.error;
console.error = (...a) => { registro.push(a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : String(x))).join(' ')); };

const app = express();
app.use('/recibo', reciboRouter);                       // el mismo prefijo que `src/app.ts:361`
app.use('/admin/invoices', (req, _res, next) => {       // lo que deja `requireAuth`: un admin del comercio
  req.merchantId = ES.id; req.userRole = 'owner'; req.teamMemberId = null; next();
}, panelRouter);
const servidor = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
const PUERTO = servidor.address().port;

// `node:http` con `agent: false`, no `fetch`: el `fetch` de undici deja un cierre que en Windows
// aborta el proceso al salir (SCRUM-1204).
const pedir = (ruta) => new Promise((ok, mal) => {
  http.get({ host: '127.0.0.1', port: PUERTO, path: ruta, agent: false }, (res) => {
    const trozos = [];
    res.on('data', (t) => trozos.push(t));
    res.on('end', () => ok({ status: res.statusCode, tipo: String(res.headers['content-type'] ?? ''), cuerpo: Buffer.concat(trozos) }));
  }).on('error', mal);
});
const tic = () => new Promise((r) => setImmediate(r));

const esquema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
const defecto = /vfEstado\s+String\s+@default\("([^"]+)"\)/.exec(esquema)?.[1] ?? null;
const ESCRIBE_ESTADO = (valor) => (a) => a?.data?.vfEstado === valor;
const SIN_NIF = { ...ES, taxId: null };

const CASOS = [
  { id: 'A', que: 'CONTROL · factura ES, sin fallo: se sella entera',
    numero: '2026-CF-0001', merchant: ES, falla: [] },
  { id: 'B', que: 'factura ES, el sellado revienta ANTES de la huella (el caso NORMAL del fallo de sellado)',
    numero: '2026-CF-0002', merchant: ES,
    falla: [{ clave: 'invoice.update', si: (a) => !!a?.data?.vfHash, mensaje: 'la base no responde (huella)' }] },
  { id: 'C', que: 'factura ES: la HUELLA se escribe y la escritura siguiente, la del estado, falla',
    numero: '2026-CF-0003', merchant: ES,
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_HECHO), mensaje: 'la base no responde (estado)' }] },
  { id: 'D', que: 'justificante J- de un comercio ES: la escritura de «no aplica» falla',
    numero: 'J-20260929-AB12', merchant: ES,
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_NO_APLICA), mensaje: 'la base no responde (no aplica)' }] },
  { id: 'E', que: 'factura de un comercio NO español: la escritura de «no aplica» falla',
    numero: '2026-CF-0005', merchant: { ...ES, country: 'PT', taxId: 'PT509999999' },
    falla: [{ clave: 'invoice.update', si: ESCRIBE_ESTADO(K.SELLADO_NO_APLICA), mensaje: 'la base no responde (no aplica)' }] },
  { id: 'F', que: 'factura ES: el proceso muere entre el commit y el sellado (no se llama a la puerta)',
    numero: '2026-CF-0006', merchant: ES, falla: [], sinPuerta: true },
  // El POSITIVO del 409: la única forma que he encontrado de llegar al error que `esErrorSinSellar`
  // SÍ reconoce (el del portón de la huella). La factura se emite cuando el comercio aún no tiene
  // NIF (queda «no aplica», sin huella) y el comercio rellena su NIF DESPUÉS. La fila de la factura
  // no se toca a mano: lo que cambia es la ficha del comercio.
  { id: 'G', que: 'POSITIVO DEL 409 · factura emitida SIN NIF en la ficha («no aplica»); el comercio pone su NIF después',
    numero: '2026-CF-0007', merchant: SIN_NIF, falla: [], despues: (fila) => { fila.merchant.taxId = NIF; } },
];

console.log(ENSAYO
  ? '⚠️ ENSAYO DE LA PROPUESTA: `esErrorSinSellar` sustituida EN MEMORIA. Esto NO es lo que hace el código de hoy.'
  : 'CÓDIGO DE HOY, sin sustituir nada.');
console.log(`POBLACION: ${CASOS.length} filas fabricadas por el camino real compilado, y 2 rutas pedidas por HTTP a 127.0.0.1 (puerto efímero)`);
console.log(`sha256 dist/modules/billing/app/routes/receipt.routes.js     = ${sha(rutaDe('modules/billing/app/routes/receipt.routes.js'))}`);
console.log(`sha256 dist/modules/invoicing/domain/portonDocumento.js      = ${sha(rutaDe('modules/invoicing/domain/portonDocumento.js'))}`);
console.log(`sha256 dist/lib/invoicing.js                                 = ${sha(rutaDe('lib/invoicing.js'))}`);
console.log(`texto firmado del 409 (COPY_PUBLICO_SIN_SELLAR, leído de dist): «${porton.COPY_PUBLICO_SIN_SELLAR}»`);
console.log(`titular de la página que acompaña al 500 (documentNotFoundHtml, leído de dist): «${TITULO_404}»`);
console.log('');

const filas = [];
for (const c of CASOS) {
  const d = base({ numero: c.numero, merchant: c.merchant, nace: defecto, falla: c.falla });
  enCurso = d;

  // ① EL CAMINO REAL ESCRIBE LA FILA
  let puerta = '(no se llama)';
  if (!c.sinPuerta) {
    try {
      const r = await K.sellarTrasEmision(
        { id: d.fila.id, number: d.fila.number, total: { toString: () => d.fila.total }, createdAt: d.fila.createdAt, merchantId: d.fila.merchantId, type: d.fila.type },
        c.merchant, d.cliente);
      puerta = `devuelve ${r.estado}${r.error ? ` (${r.error})` : ''}`;
    } catch (e) { puerta = `LANZA ${e.message}`; }
    await tic();
  }
  if (c.despues) c.despues(d.fila);
  const antes = d.llamadas.length;
  const pendiente = d.fila.vfEstado === K.SELLADO_PENDIENTE;

  // ② SE PIDE LA RUTA PÚBLICA, DE VERDAD
  registro.length = 0;
  const recibo = await pedir(`/recibo/${TOKEN}/pdf`);
  const logRecibo = registro.slice();
  // ③ Y LA DEL PANEL
  registro.length = 0;
  const panel = await pedir(`/admin/invoices/${d.fila.id}/pdf`);
  const logPanel = registro.slice();
  await tic();

  const escritas = d.llamadas.slice(antes).filter((l) => /\.(update|create|upsert|delete)/.test(l.clave)).map((l) => l.clave);
  const texto = recibo.cuerpo.toString('utf8');
  const lleva = {
    firmado: texto.includes(porton.COPY_PUBLICO_SIN_SELLAR),
    noEncontrado: texto.includes(TITULO_404),
    pdf: recibo.cuerpo.subarray(0, 5).toString('latin1') === '%PDF-',
  };
  let json = null;
  try { json = JSON.parse(panel.cuerpo.toString('utf8')); } catch { /* era un PDF */ }

  filas.push({ c, d, pendiente, recibo, panel, lleva, json, escritas });
  console.log(`── ${c.id} · ${c.que}`);
  console.log(`   la puerta ${puerta}`);
  console.log(`   fila que queda:  vfEstado=${d.fila.vfEstado}  huella=${d.fila.vfHash ? 'sí' : 'no'}   → ${pendiente ? 'PENDIENTE DE SELLADO' : 'no pendiente'}`);
  console.log(`   GET /recibo/:token/pdf        → ${recibo.status}  ${recibo.tipo}  ${recibo.cuerpo.length} B  · `
    + (lleva.pdf ? 'es un PDF' : lleva.firmado ? 'LLEVA el texto firmado del 409' : lleva.noEncontrado ? `lleva «${TITULO_404}»` : 'cuerpo NO reconocido'));
  console.log(`      lo que la ruta dejó en el log: ${logRecibo.length ? logRecibo.join(' | ') : '(nada)'}`);
  console.log(`   GET /admin/invoices/:id/pdf   → ${panel.status}  ${panel.tipo}  ${panel.cuerpo.length} B  · ${json ? JSON.stringify(json) : (panel.cuerpo.subarray(0, 5).toString('latin1') === '%PDF-' ? 'es un PDF' : 'cuerpo NO reconocido')}`);
  console.log(`      lo que la ruta dejó en el log: ${logPanel.length ? logPanel.join(' | ') : '(nada)'}`);
  console.log(`   escrituras durante las dos peticiones: ${escritas.length ? escritas.join(', ') : 'ninguna'}`);
  console.log('');
}

// ── CONTROL A CERO de la ruta pública: un enlace que no es de ningún cobro ───────────────────────
enCurso = base({ numero: '2026-CF-0001', merchant: ES, nace: defecto });
const ajeno = await pedir(`/recibo/${TOKEN}-que-no-existe/pdf`);

console.error = errorOriginal;
await new Promise((ok) => servidor.close(ok));

// ── RESUMEN ──────────────────────────────────────────────────────────────────────────────────────
const pendientes = filas.filter((f) => f.pendiente);
const cuenta = (lista, sel) => {
  const m = new Map();
  for (const f of lista) m.set(sel(f), [...(m.get(sel(f)) ?? []), f.c.id]);
  return [...m].map(([k, ids]) => `${k} × ${ids.length} (${ids.join(', ')})`).join(' · ') || '—';
};
console.log('── RESUMEN ──');
console.log(`  facturas PENDIENTES DE SELLADO fabricadas: ${pendientes.length} de ${filas.length} → ${pendientes.map((f) => f.c.id).join(', ')}`);
console.log(`  qué contesta a esas ${pendientes.length} la ruta PÚBLICA  GET /recibo/:token/pdf      : ${cuenta(pendientes, (f) => f.recibo.status)}`);
console.log(`     de ellas, con el texto firmado en el cuerpo: ${pendientes.filter((f) => f.lleva.firmado).length} · con «${TITULO_404}»: ${pendientes.filter((f) => f.lleva.noEncontrado).length}`);
console.log(`  qué contesta a esas ${pendientes.length} la ruta del PANEL  GET /admin/invoices/:id/pdf : ${cuenta(pendientes, (f) => `${f.panel.status} ${f.json?.error ?? ''}`.trim())}`);
console.log(`  PDF entregados a una pendiente (por cualquiera de las dos rutas): ${pendientes.filter((f) => f.lleva.pdf || !f.json).length}`);
console.log(`  escrituras provocadas por pedir el documento de una pendiente: ${pendientes.reduce((n, f) => n + f.escritas.length, 0)}`);

// ── CONTROLES: sin ellos, los números de arriba no dicen nada ───────────────────────────────────
const fallos = [];
const A = filas.find((f) => f.c.id === 'A');
const G = filas.find((f) => f.c.id === 'G');
if (defecto !== K.SELLADO_PENDIENTE) fallos.push(`el @default del esquema (${defecto}) no es SELLADO_PENDIENTE`);
if (!(A.recibo.status === 200 && A.lleva.pdf && /pdf/.test(A.recibo.tipo))) fallos.push('POSITIVO DEL 200: el banco no sabe sacar por la ruta pública el PDF de una factura bien sellada');
if (!(A.panel.status === 200 && !A.json)) fallos.push('POSITIVO DEL 200 (panel): la ruta del panel no entrega el PDF de una factura bien sellada');
if (!(G.recibo.status === 409 && G.lleva.firmado)) fallos.push('POSITIVO DEL 409: el banco no sabe llegar al 409 con el texto firmado por NINGÚN camino (sin esto, «no sale 409» no dice nada)');
if (!(G.panel.status === 409 && G.json?.error === porton.ERROR_SIN_SELLAR)) fallos.push('POSITIVO DEL 409 (panel): la ruta del panel no llega a su 409 por ningún camino');
if (!(ajeno.status === 404)) fallos.push(`CONTROL A CERO: un enlace que no es de ningún cobro contesta ${ajeno.status}, no 404`);
if (pendientes.length < 4) fallos.push(`POBLACION: sólo ${pendientes.length} pendientes fabricadas`);
if (filas.length !== CASOS.length) fallos.push('no corrieron todos los casos');
console.log('');
console.log(`  control a cero: un enlace que no es de ningún cobro → ${ajeno.status}`);
console.log(fallos.length
  ? `CONTROLES: ${fallos.length} FALLAN\n  · ${fallos.join('\n  · ')}`
  : 'CONTROLES: los 8 pasan (estado de nacimiento · 200 con PDF por las dos rutas · 409 alcanzable por las dos rutas · 404 del enlace ajeno · población de pendientes · todos los casos)');

console.log(`EXIT=${fallos.length ? 1 : 0}`);
process.exit(fallos.length ? 1 : 0);
