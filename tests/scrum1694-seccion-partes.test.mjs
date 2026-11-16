// SCRUM-1694 (T1 de SCRUM-1686) · LA SECCIÓN «PARTES» DE LA FICHA DEL TRABAJO.
//
// Antes: el parte no tenía sección. Era un botón «Parte de trabajo» metido en la barra de los
// ALBARANES que abría el MÁS RECIENTE y sólo creaba si no había ninguno — y la ficha no listaba
// los partes, así que el segundo parte de un trabajo era inalcanzable desde él (SCRUM-1686 c.21447 ③).
//
// Ahora (D2 firmada en SCRUM-1686 c.21461; M2 en el máster: «la visita ES su parte»):
//   · sección «Partes» (N6) con TODOS los partes del trabajo, que el GET ya manda (SCRUM-1671);
//   · «+ Nuevo parte» (N9): crea uno, salvo que haya un BORRADOR DE HOY en ese trabajo: abre ése;
//   · los dos vacíos de N7: «Aún no hay partes.» y «Aún no hay albaranes.».
// Textos firmados: SCRUM-1686 c.21470, firma literal «si firmo» en c.21471 (~12:05 local).
//
// «HOY» = el día natural en la zona del MERCHANT (`Merchant.timezone`), que es la misma regla con
// la que el alta del parte (`partes.routes.ts`, POST) le pone el año al número. Sin zona → UTC,
// la decisión A de `zonaDelMerchant`. (El GO del fundador c.21479 decía «hora de Madrid»; S0 lo
// dejó preguntado en c.21488 porque `schema.prisma` prohíbe fijar Madrid. Declarado en el registro.)
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const reparto = require(path.join(RAIZ, 'public/dashboard/js/jobDocsReparto.js'));
const cal = require(path.join(RAIZ, 'public/dashboard/js/quoteCaducidad.js'));

const MADRID = { timezone: 'Europe/Madrid' };
const CANARIAS = { timezone: 'Atlantic/Canary' };

// ═══ LA REGLA DEL «BORRADOR DE HOY», PURA ═══════════════════════════════════════════════════

test('SCRUM-1694 · existe `borradorDeHoy` y es la que decide', () => {
  assert.equal(typeof reparto.borradorDeHoy, 'function', '🔴 falta `borradorDeHoy` en jobDocsReparto.js');
});

test('SCRUM-1694 · borrador de hoy → ése; firmado de hoy o borrador de ayer → ninguno', () => {
  const ahora = new Date('2026-11-11T10:00:00Z');
  const hoyB = { id: 3, estado: 'borrador', fecha: '2026-11-11T08:00:00Z' };
  const hoyF = { id: 2, estado: 'firmado', fecha: '2026-11-11T07:00:00Z' };
  const ayerB = { id: 1, estado: 'borrador', fecha: '2026-11-10T09:00:00Z' };
  assert.equal(reparto.borradorDeHoy([hoyF, hoyB, ayerB], MADRID, ahora, cal), hoyB);
  assert.equal(reparto.borradorDeHoy([hoyF, ayerB], MADRID, ahora, cal), null,
    '🔴 un parte FIRMADO hoy no se reabre, y un borrador de ayer es otra visita');
  assert.equal(reparto.borradorDeHoy([], MADRID, ahora, cal), null);
  assert.equal(reparto.borradorDeHoy(null, MADRID, ahora, cal), null);
});

test('SCRUM-1694 · 🔴 «hoy» se cuenta en la zona del MERCHANT, no en la del navegador ni en UTC', () => {
  // 23:30 UTC del 10-nov: en Madrid ya es 11-nov (00:30); en Canarias sigue siendo 10-nov (23:30).
  const ahora = new Date('2026-11-10T23:30:00Z');
  const deMadrugada = { id: 9, estado: 'borrador', fecha: '2026-11-10T23:10:00Z' }; // Madrid 11-nov 00:10
  const deLaTarde = { id: 8, estado: 'borrador', fecha: '2026-11-10T18:00:00Z' };   // 10-nov en las dos
  assert.equal(reparto.borradorDeHoy([deMadrugada, deLaTarde], MADRID, ahora, cal), deMadrugada,
    '🔴 en Madrid ya es el 11: el borrador de las 18:00 del 10 es de AYER');
  assert.equal(reparto.borradorDeHoy([deLaTarde], MADRID, ahora, cal), null);
  assert.equal(reparto.borradorDeHoy([deLaTarde], CANARIAS, ahora, cal), deLaTarde,
    '🔴 en Canarias sigue siendo el 10: el de las 18:00 es de HOY');
});

test('SCRUM-1694 · varios borradores de hoy → el más reciente (la lista llega ordenada por fecha desc)', () => {
  const ahora = new Date('2026-11-11T15:00:00Z');
  const a = { id: 5, estado: 'borrador', fecha: '2026-11-11T14:00:00Z' };
  const b = { id: 4, estado: 'borrador', fecha: '2026-11-11T09:00:00Z' };
  assert.equal(reparto.borradorDeHoy([a, b], MADRID, ahora, cal), a);
});

// ═══ LA FICHA MONTADA ════════════════════════════════════════════════════════════════════════

const hoyISO = new Date().toISOString();
const ayerISO = new Date(Date.now() - 2 * 86400000).toISOString();

function job(partes, extra = {}) {
  return {
    id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
    customer: { id: 3, name: 'IES' }, asignados: [], operario: null,
    albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null,
    partes, ...extra,
  };
}

async function montar(j, { listaPartes = j.partes, merchant = { name: 'Epipe', timezone: 'UTC' } } = {}) {
  const banco = cargarDashboard(RAIZ);
  const pedidas = [];
  const vistas = [];
  banco.ctx.apiRequest = async (u, opts) => {
    pedidas.push({ u, method: (opts && opts.method) || 'GET', body: opts && opts.body });
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return merchant;
    if (/\/admin\/partes/.test(u)) {
      if (opts && opts.method === 'POST') return { id: 99, numero: 'PT-2026-099', estado: 'borrador', fecha: hoyISO, jobId: j.id };
      return { partes: listaPartes.map((p) => ({ ...p, jobId: j.id })) };
    }
    if (/gastos/.test(u)) return [];
    return j;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message})`);
  banco.ctx.renderAppView = (v, p) => vistas.push({ v, p });
  return { ...r, pedidas, vistas };
}

const texto = (n) => String(n.textContent || '').trim();
const plano = (x) => JSON.parse(JSON.stringify(x)); // los objetos nacen en el realm del vm
const esperar = () => new Promise((res) => setTimeout(res, 0));

test('SCRUM-1694 · la sección «Partes» existe, va ANTES de «Albaranes», y lista TODOS los partes', async () => {
  const partes = [
    { id: 12, numero: 'PT-2026-012', estado: 'borrador', fecha: hoyISO },
    { id: 11, numero: 'PT-2026-011', estado: 'firmado', fecha: ayerISO },
  ];
  const r = await montar(job(partes));
  const nodos = todos(r.contenedor);
  const iPartes = nodos.findIndex((n) => n.tagName === 'H3' && texto(n) === 'Partes');
  const iAlb = nodos.findIndex((n) => n.tagName === 'H3' && texto(n) === 'Albaranes');
  assert.ok(iPartes >= 0, '🔴 no hay sección «Partes» (N6)');
  assert.ok(iAlb > iPartes, '🔴 «Partes» va antes que «Albaranes»: el parte es lo de la obra');
  const sec = nodos.find((n) => (n.dataset && n.dataset.seccion === 'partes') || (n.getAttribute && n.getAttribute('data-seccion') === 'partes'));
  assert.ok(sec, '🔴 la sección no lleva data-seccion="partes"');
  const enSec = todos(sec).map(texto);
  assert.ok(enSec.includes('PT-2026-012') && enSec.includes('PT-2026-011'),
    '🔴 el segundo parte del trabajo sigue inalcanzable desde la ficha');
  assert.ok(!enSec.includes('Aún no hay partes.'), '🔴 vacío pintado con partes');
});

test('SCRUM-1694 · pulsar un parte de la lista abre ESE parte', async () => {
  const partes = [
    { id: 12, numero: 'PT-2026-012', estado: 'borrador', fecha: hoyISO },
    { id: 11, numero: 'PT-2026-011', estado: 'firmado', fecha: ayerISO },
  ];
  const r = await montar(job(partes));
  const link = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && texto(n) === 'PT-2026-011');
  assert.ok(link, '🔴 el número del parte no es pulsable');
  link.click();
  assert.deepEqual(plano(r.vistas), [{ v: 'parte-detail', p: { parteId: 11 } }]);
});

test('SCRUM-1694 · vacíos N7: «Aún no hay partes.» y «Aún no hay albaranes.»; el texto viejo se va', async () => {
  const r = await montar(job([]));
  const textos = todos(r.contenedor).map(texto);
  assert.ok(textos.includes('Aún no hay partes.'), '🔴 falta el vacío de Partes (N7)');
  assert.ok(textos.includes('Aún no hay albaranes.'), '🔴 falta el vacío de Albaranes (N7)');
  assert.ok(!textos.some((t) => t.includes('Aún no hay documentos.')), '🔴 sigue el vacío viejo que N7 sustituye');
});

test('SCRUM-1694 · N9: el botón dice «+ Nuevo parte», conserva su gancho y vive en la sección Partes', async () => {
  const r = await montar(job([]));
  const nodos = todos(r.contenedor);
  const btn = nodos.find((n) => n.getAttribute && n.getAttribute('data-abrir-parte') === '1');
  assert.ok(btn, '🔴 se ha perdido el gancho data-abrir-parte (SCRUM-652d)');
  assert.equal(texto(btn), '+ Nuevo parte');
  assert.ok(!nodos.some((n) => n.tagName === 'BUTTON' && texto(n) === 'Parte de trabajo'), '🔴 sigue el rótulo viejo');
  const sec = nodos.find((n) => (n.dataset && n.dataset.seccion === 'partes') || (n.getAttribute && n.getAttribute('data-seccion') === 'partes'));
  assert.ok(todos(sec).includes(btn), '🔴 el botón sigue en la barra de los albaranes');
});

test('SCRUM-1694 · 🔴 con un borrador de HOY, «+ Nuevo parte» lo ABRE y no crea otro', async () => {
  const partes = [{ id: 12, numero: 'PT-2026-012', estado: 'borrador', fecha: hoyISO }];
  const r = await montar(job(partes));
  const btn = todos(r.contenedor).find((n) => n.getAttribute && n.getAttribute('data-abrir-parte') === '1');
  btn.click();
  await esperar(); await esperar();
  assert.deepEqual(plano(r.vistas), [{ v: 'parte-detail', p: { parteId: 12 } }]);
  assert.ok(!r.pedidas.some((p) => p.method === 'POST'), '🔴 creó un parte vacío habiendo un borrador de hoy');
});

test('SCRUM-1694 · 🔴 sin borrador de hoy (sólo uno FIRMADO hoy y uno de antes) → CREA uno nuevo', async () => {
  const partes = [
    { id: 12, numero: 'PT-2026-012', estado: 'firmado', fecha: hoyISO },
    { id: 11, numero: 'PT-2026-011', estado: 'borrador', fecha: ayerISO },
  ];
  const r = await montar(job(partes));
  const btn = todos(r.contenedor).find((n) => n.getAttribute && n.getAttribute('data-abrir-parte') === '1');
  btn.click();
  await esperar(); await esperar();
  const post = r.pedidas.filter((p) => p.method === 'POST' && /\/admin\/partes/.test(p.u));
  assert.equal(post.length, 1, '🔴 el botón ya no crea: la visita de hoy no tendría parte');
  assert.deepEqual(JSON.parse(post[0].body), { jobId: 7 });
  assert.deepEqual(plano(r.vistas), [{ v: 'parte-detail', p: { parteId: 99 } }]);
});

test('SCRUM-1694 · 🔴 si no se puede leer el merchant (su zona), NO crea a ciegas', async () => {
  const partes = [{ id: 12, numero: 'PT-2026-012', estado: 'borrador', fecha: hoyISO }];
  const r = await montar(job(partes), { merchant: null });
  const btn = todos(r.contenedor).find((n) => n.getAttribute && n.getAttribute('data-abrir-parte') === '1');
  btn.click();
  await esperar(); await esperar();
  assert.ok(!r.pedidas.some((p) => p.method === 'POST'), '🔴 sin zona creó un parte: podía haber un borrador de hoy');
  assert.deepEqual(plano(r.vistas), []);
});

test('SCRUM-1694 · trabajo CERRADO: se listan los partes, pero no se ofrece crear', async () => {
  const partes = [{ id: 12, numero: 'PT-2026-012', estado: 'firmado', fecha: ayerISO }];
  const r = await montar(job(partes, { status: 'cerrado' }));
  const nodos = todos(r.contenedor);
  assert.ok(nodos.some((n) => n.tagName === 'BUTTON' && texto(n) === 'PT-2026-012'), '🔴 el cerrado esconde sus partes');
  const btn = nodos.find((n) => n.getAttribute && n.getAttribute('data-abrir-parte') === '1');
  assert.ok(!btn || btn.hidden === true || (btn.parentNode && btn.parentNode.hidden === true),
    '🔴 se ofrece crear un parte en un trabajo cerrado (la regla de SCRUM-823 para la barra)');
});
