// SCRUM-1771d · CIERRES 14 · sonda contra STAGING con la cuenta QA (comercio 2). Solo staging.
//
// Uso (desde la raíz del árbol, con el `.env` del árbol):
//   node docs/master/evidencias/SCRUM-1771/cierres14.mjs antes    → sólo lecturas: /health, login, «sin vías», ①, ④
//   node docs/master/evidencias/SCRUM-1771/cierres14.mjs emitir   → ② emite UNA F1 suelta (21 % + 10 %) al cliente 3936, SIN enviar
//   node docs/master/evidencias/SCRUM-1771/cierres14.mjs despues <idF1>  → lecturas: ② PDF, ③ libro y 303, ④
//
// El secreto de `POST /auth/test-login` se LEE del `.env` por código y no se imprime ni se escribe.
// La sonda se niega a correr si la URL no es la de staging, y `emitir` se niega si alguna de las
// tres comprobaciones de «sin vías» (SCRUM-1732 c.22174/c.22182) no sale como se espera.
// No llama a ninguna ruta de envío (`send-*`, `resend-*`, `confirm-bizum`).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lineasDePdf, extraerTextoPdf, vecesEnPdf } from '../../../../tests/_texto-del-pdf.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/^https:\/\/yaqu-staging-production\.up\.railway\.app$/.test(BASE)) throw new Error('solo staging');
const EMAIL = 'qa@staging.yaqu';
const CLIENTE = 3936;
const R1 = 1976;
const DIR = path.dirname(fileURLToPath(import.meta.url));

function secretoDelEnv() {
  const txt = fs.readFileSync('.env', 'utf8');
  const m = txt.match(/^E2E_TEST_LOGIN_SECRET=(.*)$/m); // nombre LITERAL (cicatriz J2 de 1732f: un regex [A-Z_]+ no casa con el «2»)
  if (!m) throw new Error('sin E2E_TEST_LOGIN_SECRET en .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

let cookie = '';
async function pedir(metodo, ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { ...(cookie ? { cookie } : {}), ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const tipo = r.headers.get('content-type') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, tipo, buf, json: tipo.includes('json') ? JSON.parse(buf.toString('utf8') || 'null') : null, date: r.headers.get('date') };
}

const lleno = (v) => (v === null || v === undefined || v === '' ? 'vacío' : 'presente');
function listaDe(j) {
  if (Array.isArray(j)) return j;
  for (const k of ['customers', 'items', 'data', 'rows', 'clientes']) if (Array.isArray(j?.[k])) return j[k];
  return null;
}
function camposBizum(obj, pref = '', out = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const ruta = pref ? `${pref}.${k}` : k;
    if (/bizum/i.test(k)) out[ruta] = /phone$/i.test(k) ? lleno(v) : (typeof v === 'object' ? JSON.stringify(v) : v); // sin teléfonos: presente/vacío
    else if (v && typeof v === 'object' && !Array.isArray(v)) camposBizum(v, ruta, out);
  }
  return out;
}
function papel(buf) {
  const L = lineasDePdf(buf);
  const T = extraerTextoPdf(buf);
  if (!L.ok || !T.ok) return { bytes: buf.length, lector: 'CIEGO', motivo: L.motivo || T.motivo };
  const lineas = L.lineas.map((l) => l.texto);
  const texto = T.texto;
  const interesa = lineas.filter((l) => /IVA|TOTAL|Total|Base imponible|PENDIENTE|R1|Rectific/i.test(l));
  return {
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    lineasTotales: lineas.length,
    lineas: interesa,
    veces: {
      'Base imponible por tipo': vecesEnPdf(texto, 'Base imponible por tipo'),
      '[PENDIENTE': vecesEnPdf(texto, '[PENDIENTE'),
      // control positivo del lector: toda factura lleva «Base imponible»
      'Base imponible': vecesEnPdf(texto, 'Base imponible'),
    },
  };
}

async function login() {
  const h = await pedir('GET', '/health');
  const l = await pedir('POST', '/auth/test-login', { email: EMAIL, secret: secretoDelEnv() });
  if (l.status !== 200 || !cookie) throw new Error(`login ${l.status}`);
  return { health: h.json, horaHealth: h.date, login: l.status };
}

async function sinVias() {
  const c = await pedir('GET', '/admin/customers');
  const lista = listaDe(c.json);
  let cli = lista ? lista.find((x) => Number(x.id) === CLIENTE) : null;
  if (!cli) { const d = await pedir('GET', `/admin/customers/${CLIENTE}`); cli = d.json?.customer ?? d.json; }
  const m = await pedir('GET', '/admin/merchant');
  const mer = m.json?.merchant ?? m.json ?? {};
  const v = {
    cliente: { id: cli?.id ?? null, name: cli?.name ?? null, phone: lleno(cli?.phone), mobile: lleno(cli?.mobile), email: lleno(cli?.email) },
    merchant: { status: m.status, notifyEmailOnPaid: mer.notifyEmailOnPaid ?? '(no viene)', whatsappPhone: lleno(mer.whatsappPhone) },
  };
  v.ok = v.cliente.id === CLIENTE && v.cliente.phone === 'vacío' && v.cliente.mobile === 'vacío' && v.cliente.email === 'vacío'
    && v.merchant.notifyEmailOnPaid === false && v.merchant.whatsappPhone === 'vacío';
  return v;
}

async function bizum() {
  const cs = await pedir('GET', '/admin/connect/status');
  const me = await pedir('GET', '/admin/me');
  return { connectStatus: { status: cs.status, campos: camposBizum(cs.json) }, adminMe: { status: me.status, campos: camposBizum(me.json) } };
}

async function libroY303(idF1) {
  const hoy = new Date().toISOString().slice(0, 10);
  const lib = await pedir('GET', `/admin/libro-registro?desde=2026-11-01&hasta=2026-11-30`);
  const txt = lib.buf.toString('utf8');
  const filasLibro = JSON.stringify(lib.json ?? {}).length;
  // la fila de la F1, si viene, entera; y si alguna fila del libro trae `cobros`
  const buscar = (o, f) => { if (!o || typeof o !== 'object') return null; if (f(o)) return o; for (const v of Object.values(o)) { const r = buscar(v, f); if (r) return r; } return null; };
  const filaF1 = buscar(lib.json, (o) => !Array.isArray(o) && (Number(o.id) === Number(idF1) || Number(o.invoiceId) === Number(idF1)));
  const conCobros = buscar(lib.json, (o) => !Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, 'cobros'));
  const m303 = await pedir('GET', '/admin/modelo-303?year=2026&quarter=4');
  const m303b = await pedir('GET', '/admin/modelo-303?year=2027&quarter=4');
  return {
    hoy,
    libro: { status: lib.status, bytes: lib.buf.length, jsonBytes: filasLibro, clavesRaiz: lib.json && typeof lib.json === 'object' ? Object.keys(lib.json) : null, filaF1, algunaFilaConCobros: conCobros ? Object.keys(conCobros) : null, mencionaCobros: (txt.match(/"cobros"/g) || []).length, cuerpo: lib.json },
    m303_2026T4: { status: m303.status, cuerpo: m303.json },
    m303_2027T4: { status: m303b.status, cuerpo: m303b.json },
  };
}

const fase = process.argv[2];
const salida = {};
salida.fase = fase;
Object.assign(salida, await login());
if (fase === 'antes') {
  salida.sinVias = await sinVias();
  const pdf = await pedir('GET', `/admin/invoices/${R1}/pdf`);
  salida.r1 = { id: R1, status: pdf.status, tipo: pdf.tipo, ...(pdf.tipo.includes('pdf') ? papel(pdf.buf) : { cuerpo: pdf.buf.toString('utf8').slice(0, 300) }) };
  const det = await pedir('GET', `/admin/invoices/${R1}`);
  const inv = det.json?.invoice ?? det.json ?? {};
  salida.r1.detalle = { status: det.status, number: inv.number ?? null, type: inv.type ?? null, total: inv.total ?? null };
  salida.bizum = await bizum();
  fs.writeFileSync(path.join(DIR, 'cierres14-antes.json'), JSON.stringify(salida, null, 2) + '\n');
} else if (fase === 'emitir') {
  const v = await sinVias();
  salida.sinVias = v;
  if (!v.ok) { console.log(JSON.stringify(salida, null, 2)); throw new Error('NO EMITO: la QA no está sin vías'); }
  const r = await pedir('POST', '/admin/invoices', {
    customerId: CLIENTE,
    lines: [
      { concept: 'CIERRES 14 · línea al 21 %', qty: 1, price: 50, tax: 0.21 },
      { concept: 'CIERRES 14 · línea al 10 %', qty: 1, price: 30, tax: 0.10 },
    ],
  });
  salida.emision = { status: r.status, cuerpo: r.json, hora: r.date };
  fs.writeFileSync(path.join(DIR, 'cierres14-emision.json'), JSON.stringify(salida, null, 2) + '\n');
} else if (fase === 'despues') {
  const id = Number(process.argv[3]);
  const pdf = await pedir('GET', `/admin/invoices/${id}/pdf`);
  salida.f1 = { id, status: pdf.status, tipo: pdf.tipo, ...(pdf.tipo.includes('pdf') ? papel(pdf.buf) : { cuerpo: pdf.buf.toString('utf8').slice(0, 300) }) };
  const det = await pedir('GET', `/admin/invoices/${id}`);
  const inv = det.json?.invoice ?? det.json ?? {};
  salida.f1.detalle = { status: det.status, number: inv.number ?? null, type: inv.type ?? null, total: inv.total ?? null, estado: inv.status ?? null, chargeId: inv.chargeId ?? '(no viene)', sentVia: inv.sentVia ?? inv.sentAt ?? '(no viene)' };
  salida.libroY303 = await libroY303(id);
  salida.bizum = await bizum();
  salida.sinVias = await sinVias();
  fs.writeFileSync(path.join(DIR, 'cierres14-despues.json'), JSON.stringify(salida, null, 2) + '\n');
} else throw new Error('fase: antes | emitir | despues <id>');
console.log('ok', fase);
