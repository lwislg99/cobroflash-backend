// scripts/pasada-real-etiquetas-del-documento.mjs — SCRUM-595 (DOC-05)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA PRIMERA PASADA REAL · guarda una etiqueta en un PRESUPUESTO y en una FACTURA **por el
// camino real** —las rutas HTTP de verdad, con su auth, su validación y su relectura— y lo enseña.
//
// POR QUÉ EXISTE, teniendo 24 tests: porque hasta aquí el ticket estaba probado sobre MECANISMO,
// no sobre USO. Un guard que lee el árbol no distingue «la columna existe y el camino funciona»
// de «el código dice que funcionaría». Esto lo distingue: levanta la app de verdad y usa las
// rutas que usa el dashboard.
//
// ⛔ SÓLO DESARROLLO, y por dos vías, no por una:
//   1. la clave es `DATABASE_URL_DEV` y nada más;
//   2. antes de abrir nada se contrasta con `exigirDestinoCorrecto` (SCRUM-383), el guard de la
//      casa que compara la clave con su destino DECLARADO — host **y** nombre de base, porque
//      staging y dev comparten host y mirar sólo el host las daría por iguales.
//
// ⚠️ `DATABASE_URL` NO VIVE EN UN ÁRBOL DE TRABAJO (regla 3), y este script no la crea: la pone
// en el entorno de ESTE proceso y nunca la escribe en `.env` ni en `.env.local`. Al terminar el
// proceso desaparece con él.
//
// 🔴 DEJA LA BASE COMO ESTABA. Guarda el valor previo de cada documento y lo restaura en el
// `finally`, pase lo que pase — incluso si algo falla a mitad.
//
// USO:  node scripts/pasada-real-etiquetas-del-documento.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { exigirDestinoCorrecto } from './_clave-vs-destino.mjs';
import { describirBD } from './_db-guard.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CLAVE = 'DATABASE_URL_DEV';

const url = process.env[CLAVE];
if (!url) { console.error('🔴 ' + CLAVE + ' ausente. No se sigue.'); process.exit(2); }

// 🔴 EL GUARD DE LA CASA, ANTES DE ABRIR NADA.
exigirDestinoCorrecto(CLAVE, url);
console.log('destino: ' + describirBD(url) + '\n');

process.env.DATABASE_URL = url.trim().replace(/^['"]|['"]$/g, '');
process.env.WHATSAPP_DRY_RUN = '1'; // cero mensajes reales
process.env.DISABLE_CRONS = 'true';

const PORT = Number(process.env.PASADA_PORT || 3479);
process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${PORT}`;

const { prisma } = await import('../dist/core/db/prisma.js');
const { app } = await import('../dist/app.js');
const { Prisma } = await import('@prisma/client');

const server = app.listen(PORT);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${PORT}`;

const ETIQUETA = 'obra puerto';
let restaurar = [];
let fallos = 0;
const ok = (m) => console.log('  ✅ ' + m);
const mal = (m) => { console.log('  ❌ ' + m); fallos++; };

try {
  // ── El merchant demo (regla 8) y UN documento de cada tipo, suyos ────────────────────────
  const merchantId = 1;
  const quote = await prisma.quote.findFirst({ where: { merchantId }, orderBy: { id: 'desc' } });
  const invoice = await prisma.invoice.findFirst({
    where: { merchantId, number: { not: '' } }, orderBy: { id: 'desc' },
  });
  if (!quote || !invoice) {
    console.error('🔴 CIEGO: el merchant demo no tiene los dos documentos. No se afirma nada.');
    process.exit(2);
  }
  restaurar = [
    { modelo: 'quote', id: quote.id, previo: quote.tags },
    { modelo: 'invoice', id: invoice.id, previo: invoice.tags },
  ];
  console.log(`documentos: presupuesto #${quote.id} · factura ${invoice.number} (id ${invoice.id})`);
  console.log(`estado de partida: presupuesto.tags=${JSON.stringify(quote.tags)} · factura.tags=${JSON.stringify(invoice.tags)}\n`);

  // 🔴 EL ESTADO DE LA FACTURA **ANTES**. Es el control de la regla 29: sin el antes, «no ha
  // cambiado» no se puede afirmar — no distingue «no cambió» de «nunca miré».
  const antesFactura = {
    number: invoice.number, total: String(invoice.total), pdfUrl: invoice.pdfUrl,
    vfHash: invoice.vfHash, qrData: invoice.qrData, status: invoice.status,
  };

  // ── Sesión, con la MISMA cadena que usa `e2e-critico.mjs` ────────────────────────────────
  const t = 'pasada-' + crypto.randomBytes(12).toString('hex');
  await prisma.authSession.create({
    data: { merchantId, token: t, type: 'magic_link', expiresAt: new Date(Date.now() + 900000) },
  });
  const v = await fetch(`${base}/auth/verify?token=${t}`, { redirect: 'manual' });
  const cookie = (v.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) { console.error('🔴 no se obtuvo cookie de sesión'); process.exit(2); }

  const put = (ruta, cuerpo) => fetch(base + ruta, {
    method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const get = (ruta) => fetch(base + ruta, { headers: { cookie } });

  // ── 1 · SE ESCRIBE, POR LA RUTA DE VERDAD ────────────────────────────────────────────────
  console.log('1 · SE GUARDA');
  const r1 = await put(`/admin/quotes/${quote.id}/tags`, { tags: [ETIQUETA, 'garantía'] });
  r1.status === 200 ? ok(`PUT /admin/quotes/${quote.id}/tags → 200`) : mal(`presupuesto → ${r1.status}`);
  const r2 = await put(`/admin/invoices/${invoice.id}/tags`, { tags: [ETIQUETA] });
  r2.status === 200 ? ok(`PUT /admin/invoices/${invoice.id}/tags → 200`) : mal(`factura → ${r2.status}`);

  // ── 2 · SE RELEE · el quinto eslabón, contra la base de verdad ───────────────────────────
  console.log('\n2 · SE RELEE (el quinto eslabón, y aquí es donde se pierde en silencio)');
  const lista = await (await get('/admin/quotes')).json();
  const enLista = lista.find((q) => q.id === quote.id);
  JSON.stringify(enLista?.tags) === JSON.stringify([ETIQUETA, 'garantía'])
    ? ok(`la LISTA de presupuestos las devuelve: ${JSON.stringify(enLista.tags)}`)
    : mal(`la lista de presupuestos devuelve ${JSON.stringify(enLista?.tags)}`);

  const detalle = await (await get(`/admin/quotes/${quote.id}`)).json();
  JSON.stringify(detalle.tags) === JSON.stringify([ETIQUETA, 'garantía'])
    ? ok(`el DETALLE del presupuesto las devuelve: ${JSON.stringify(detalle.tags)}`)
    : mal(`el detalle devuelve ${JSON.stringify(detalle.tags)}`);

  const listaF = await (await get('/admin/invoices')).json();
  const enListaF = listaF.find((i) => i.id === invoice.id);
  JSON.stringify(enListaF?.tags) === JSON.stringify([ETIQUETA])
    ? ok(`la LISTA de facturas las devuelve: ${JSON.stringify(enListaF.tags)}`)
    : mal(`la lista de facturas devuelve ${JSON.stringify(enListaF?.tags)}`);

  const detalleF = await (await get(`/admin/invoices/${invoice.id}`)).json();
  JSON.stringify(detalleF.tags) === JSON.stringify([ETIQUETA])
    ? ok(`el DETALLE de la factura las devuelve: ${JSON.stringify(detalleF.tags)}`)
    : mal(`el detalle de la factura devuelve ${JSON.stringify(detalleF.tags)}`);

  // ── 3 · 🔴 EL CONTROL QUE DECIDE, sobre datos REALES ─────────────────────────────────────
  console.log('\n3 · 🔴 EL CONTROL: se filtra por la etiqueta y salen LOS DOS');
  const w = {};
  new Function('window', 'module',
    fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/filtroClientes.js'), 'utf8'))(w, {});
  const FC = w.filtroClientes;

  const pres = FC.filtrarPorEtiqueta(lista, ETIQUETA);
  const facs = FC.filtrarPorEtiqueta(listaF, ETIQUETA);
  pres.some((q) => q.id === quote.id)
    ? ok(`filtrando por «${ETIQUETA}» sale el PRESUPUESTO #${quote.id}  (${pres.length} de ${lista.length})`)
    : mal('el presupuesto NO sale al filtrar');
  facs.some((i) => i.id === invoice.id)
    ? ok(`filtrando por «${ETIQUETA}» sale la FACTURA ${invoice.number}  (${facs.length} de ${listaF.length})`)
    : mal('la factura NO sale al filtrar');
  (FC.filtrarPorEtiqueta(lista, null).length === lista.length
    && FC.filtrarPorEtiqueta(listaF, null).length === listaF.length)
    ? ok('sin etiqueta seleccionada, las dos listas salen ENTERAS (el positivo)')
    : mal('sin etiqueta seleccionada la lista cambia');

  // ── 4 · 🔴 REGLA 29 · sobre la factura EMITIDA de verdad ─────────────────────────────────
  console.log('\n4 · 🔴 REGLA 29: etiquetar una factura emitida no la cambia');
  const releida = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  const despues = {
    number: releida.number, total: String(releida.total), pdfUrl: releida.pdfUrl,
    vfHash: releida.vfHash, qrData: releida.qrData, status: releida.status,
  };
  for (const campo of Object.keys(antesFactura)) {
    antesFactura[campo] === despues[campo]
      ? ok(`${campo}: ${JSON.stringify(antesFactura[campo])} → SIN CAMBIO`)
      : mal(`🔴 ${campo} HA CAMBIADO: ${JSON.stringify(antesFactura[campo])} → ${JSON.stringify(despues[campo])}`);
  }
  // SUELO: la etiqueta SÍ está. Sin esto, «nada ha cambiado» sería lo que diría un no-op.
  JSON.stringify(releida.tags) === JSON.stringify([ETIQUETA])
    ? ok('y la etiqueta SÍ está guardada: la invariancia de arriba no es la de un no-op')
    : mal('la etiqueta no se guardó: lo de arriba no prueba nada');

  // ── 5 · la validación estricta, por la ruta real ─────────────────────────────────────────
  console.log('\n5 · la validación no deja borrar por accidente');
  const r3 = await put(`/admin/quotes/${quote.id}/tags`, { tags: 'obra puerto' });
  r3.status === 400 ? ok('un cuerpo mal formado → 400') : mal(`devolvió ${r3.status}`);
  const trasBasura = await prisma.quote.findUnique({ where: { id: quote.id } });
  JSON.stringify(trasBasura.tags) === JSON.stringify([ETIQUETA, 'garantía'])
    ? ok('y las etiquetas SIGUEN ahí tras el 400: el suelo no las borró')
    : mal('el 400 se llevó las etiquetas por delante');
  const r4 = await put('/admin/quotes/99999999/tags', { tags: ['x'] });
  r4.status === 404 ? ok('un id que no existe → 404, no un `ok` sobre cero filas') : mal(`devolvió ${r4.status}`);
} finally {
  // ── SE DEJA LA BASE COMO ESTABA ──────────────────────────────────────────────────────────
  for (const r of restaurar) {
    const valor = r.previo == null ? Prisma.DbNull : r.previo;
    if (r.modelo === 'quote') await prisma.quote.update({ where: { id: r.id }, data: { tags: valor } });
    else await prisma.invoice.update({ where: { id: r.id }, data: { tags: valor } });
  }
  if (restaurar.length === 2) {
    const q = await prisma.quote.findUnique({ where: { id: restaurar[0].id } });
    const i = await prisma.invoice.findUnique({ where: { id: restaurar[1].id } });
    console.log(`\n↩ restaurado: presupuesto.tags=${JSON.stringify(q.tags)} · factura.tags=${JSON.stringify(i.tags)}`);
  }
  await prisma.$disconnect().catch(() => {});
  server.close();
}

console.log(fallos === 0 ? '\n✅ PASADA REAL COMPLETA, 0 fallos.' : `\n❌ ${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
