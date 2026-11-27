// docs/master/evidencias/SCRUM-1807/comparar-antes-despues.cjs — SCRUM-1807 tramo c (S1)
//
// Compara, BYTE A BYTE, el PDF del presupuesto (`generateQuotePdf`) y el HTML del portal del
// cliente entre dos `dist/`: el de `origin/main` antes del refactor y el de la rama.
//
//   NODE_PATH=<árbol>/node_modules node comparar-antes-despues.cjs <dist-antes> <dist-despues>
//
// El reloj se congela (PDFKit escribe la fecha de creación). Controles: el MISMO dist dos veces
// da el mismo hash (si no, comparar no vale nada) y una entrada con un carácter distinto da otro.
// Sale 0 si todo es idéntico, 1 si algo difiere, 2 si los controles fallan.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const [antes, despues] = process.argv.slice(2).map((p) => path.resolve(p));
if (!antes || !despues) { console.error('uso: comparar-antes-despues.cjs <dist-antes> <dist-despues>'); process.exit(2); }

// ── Reloj congelado ──────────────────────────────────────────────────────────────────────
const FIJO = Date.parse('2026-11-25T09:00:00Z');
const DateReal = Date;
class DateFijo extends DateReal { constructor(...a) { if (a.length === 0) super(FIJO); else super(...a); } static now() { return FIJO; } }
global.Date = DateFijo;

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cab = (concept) => ({ concept, apartado: true });
const L = (concept, qty, price, tax, extra = {}) => ({ concept, qty, price, tax, ...extra });

const MUCHAS = [];
for (let a = 0; a < 6; a++) { MUCHAS.push(cab(`Apartado ${a}`)); for (let i = 0; i < 9; i++) MUCHAS.push(L(`Partida ${a}.${i} con una descripción\nlarga de dos renglones`, i + 1, 10.5 * (i + 1), i % 2 ? 0.1 : 0.21)); }

const CASOS = {
  sin_apartados: [L('Pintura', 2, 100, 0.21), L('Mano de obra', 3, 12.25, 0.1)],
  dos_apartados: [cab('Salón'), L('Pintura plástica', 2, 100, 0.21), L('Aire', 1, 50.5, 0.21), L('Mano de obra', 3, 12.25, 0.1), cab('Cocina'), L('Alicatado', 1, 300, 0.21), L('Silicona', 4, 7.5, 0.21)],
  lineas_antes_y_apartado_vacio: [L('Desplazamiento', 1, 30, 0.21), cab('Salón'), cab('Cocina'), L('Alicatado', 1, 300, 0.21, { dto: 10 })],
  cabecera_al_final: [L('Pintura', 2, 100, 0.21), cab('Pendiente')],
  // 60 filas: varios saltos de página, alguno justo antes de un «Total del apartado».
  muchas_paginas: MUCHAS,
};

function cargar(dist) {
  // Prisma de mentira en la caché ANTES de cargar la ruta (el de scrum1786g).
  const tablas = {};
  const prisma = new Proxy({}, { get(_t, m) { if (typeof m !== 'string' || m === 'then') return undefined; return new Proxy({}, { get(_x, f) { return tablas[m]?.[f] ?? (async () => { throw new Error(`prisma.${m}.${String(f)}`); }); } }); } });
  const rPrisma = require.resolve(path.join(dist, 'core/db/prisma.js'));
  require.cache[rPrisma] = { id: rPrisma, filename: rPrisma, loaded: true, exports: { prisma } };
  return {
    tablas,
    generateQuotePdf: require(path.join(dist, 'lib/pdf.js')).generateQuotePdf,
    calcTotal: require(path.join(dist, 'core/utils/utils.js')).calcTotal,
    portal: require(path.join(dist, 'modules/system/app/routes/customerPortal.routes.js')).default,
  };
}

async function pdf(m, lines, n) {
  const { outPath } = await m.generateQuotePdf({
    quoteId: 918070000 + n, quoteNumber: 1, merchant: { name: 'QA 1807c' }, customer: { name: 'Cliente QA' },
    currency: 'EUR', total: String(m.calcTotal(lines, null)), lines, country: 'ES',
  });
  try { return sha(fs.readFileSync(outPath)); } finally { fs.rmSync(outPath, { force: true }); }
}

async function portal(m, lines) {
  const merchant = { id: 1807, name: 'Taller', legalName: 'Taller SL', email: 't@test.local', logoUrl: null, address: null, country: 'ES', brandColor: null, brandAccentColor: null, whatsappPhone: null, flags: {}, connectStatus: 'none', stripeAccountId: null, timezone: 'Europe/Madrid' };
  m.tablas.customer = { findUnique: async () => ({ id: 3, merchantId: merchant.id, name: 'Ana', portalToken: 'tok1807', merchant }) };
  m.tablas.quote = { findMany: async () => [{ id: 9, quoteNumber: 7, status: 'accepted', createdAt: new Date('2026-11-21T10:00:00Z'), currency: 'EUR', total: m.calcTotal(lines, null), lines, decisionToken: null, discountGlobalAmount: null }] };
  m.tablas.invoice = { findMany: async () => [] };
  m.tablas.job = { findFirst: async () => null };
  const express = require('express');
  const app = express();
  app.use('/portal', m.portal);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const cuerpo = await new Promise((ok, ko) => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/portal/tok1807', method: 'GET', agent: false }, (res) => {
        let b = ''; res.setEncoding('utf8'); res.on('data', (c) => { b += c; }); res.on('end', () => (res.statusCode === 200 ? ok(b) : ko(new Error(`portal ${res.statusCode}`))));
      });
      req.on('error', ko); req.end();
    });
    if (!/pf-line-row/.test(cuerpo)) throw new Error('CIEGO: el HTML del portal no trae filas de línea');
    return sha(cuerpo);
  } finally { server.close(); }
}

(async () => {
  const A = cargar(antes);
  const D = cargar(despues);
  // Controles: el mismo dist dos veces, y una entrada distinta.
  const c1 = await pdf(A, CASOS.dos_apartados, 1);
  const c2 = await pdf(A, CASOS.dos_apartados, 1);
  const c3 = await pdf(A, [...CASOS.dos_apartados.slice(0, -1), L('Silicona!', 4, 7.5, 0.21)], 1);
  const p1 = await portal(A, CASOS.dos_apartados);
  const p2 = await portal(A, CASOS.dos_apartados);
  const p3 = await portal(A, [...CASOS.dos_apartados.slice(0, -1), L('Silicona!', 4, 7.5, 0.21)]);
  console.log(`control PDF    mismo dist dos veces: ${c1 === c2 ? 'IGUAL' : 'DISTINTO'} · un carácter distinto: ${c1 === c3 ? 'IGUAL' : 'DISTINTO'}`);
  console.log(`control portal mismo dist dos veces: ${p1 === p2 ? 'IGUAL' : 'DISTINTO'} · un carácter distinto: ${p1 === p3 ? 'IGUAL' : 'DISTINTO'}`);
  if (c1 !== c2 || c1 === c3 || p1 !== p2 || p1 === p3) { console.error('🔴 los controles fallan: la comparación no vale'); process.exit(2); }

  let distintos = 0;
  let n = 10;
  for (const [que, lines] of Object.entries(CASOS)) {
    n++;
    const [pa, pd, ha, hd] = [await pdf(A, lines, n), await pdf(D, lines, n), await portal(A, lines), await portal(D, lines)];
    if (pa !== pd) distintos++;
    if (ha !== hd) distintos++;
    console.log(`${que.padEnd(30)} PDF ${pa === pd ? 'IDÉNTICO' : 'DIFIERE '} ${pd.slice(0, 16)} · portal ${ha === hd ? 'IDÉNTICO' : 'DIFIERE '} ${hd.slice(0, 16)}`);
  }
  console.log(distintos === 0 ? 'TODO IDÉNTICO' : `🔴 ${distintos} salida(s) difieren`);
  process.exit(distintos === 0 ? 0 : 1);
})().catch((e) => { console.error('NO PUDE MIRAR:', e?.message || e); process.exit(2); });
