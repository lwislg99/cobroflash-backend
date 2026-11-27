// tests/scrum1840-bizum-solo-con-cobro-pendiente.test.mjs — SCRUM-1840 (puesto S2, 25-nov-2026)
//
// En la ficha del TRABAJO, «📲 Confirmar Bizum recibido» salía con solo tener `chargeId`, aunque el
// cobro estuviera cancelado, pagado o caducado: su POST respondía 409 `charge_not_pending` y la ficha
// decía «Este cobro ya no está pendiente.» DESPUÉS de que el profesional pulsara dos veces (hallazgo
// de S2 en SCRUM-1808b, visible en `docs/master/evidencias/SCRUM-1808b/cobro-cancelado-despues-1280.png`).
//
// Desde SCRUM-1808b el detalle del trabajo sirve `estadoDelCobro` por factura; ahora el botón sale
// SOLO con `estadoDelCobro === 'pending'`. Sin el campo (servidor viejo) cae CERRADO, como el
// «Cancelar cobro» de 1808b. Cero textos nuevos: aquí solo se busca el literal que ya existe.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Las mutaciones que tienen que tumbarme (SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: "if (inv.chargeId && inv.estadoDelCobro === 'pending') {",
    a: 'if (inv.chargeId) {',
    cae: 'SCRUM-1840 · ficha del trabajo · 🔴 sin cobro `pending` (cancelled, paid, expired, null, sin campo) no hay «Confirmar Bizum recibido»',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: "if (inv.chargeId && inv.estadoDelCobro === 'pending') {",
    a: "if (inv.chargeId && inv.estadoDelCobro === 'cancelled') {",
    cae: 'SCRUM-1840 · ficha del trabajo · CONTROL POSITIVO: con el cobro `pending` el botón sigue, y su doble toque llega al POST',
  },
];

const BIZUM = '📲 Confirmar Bizum recibido';

function trabajoCon(factura) {
  return {
    id: 1840, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'ZZ caldera',
    customer: { id: 5, name: 'ZZCLIENTE Ejemplo', phone: '34000000001', mobile: null },
    asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
    quote: null, direccion: null, totalAceptado: 100, totalCobrado: 0, estadoCobro: 'Pendiente',
    tipoOperacion: 'OPERACIONES_SUELTAS',
    invoices: [{
      id: 84, number: 'F-2026-0084', status: 'pending', type: 'F1', total: 100, currency: 'EUR',
      createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: 78, payToken: 'tok-1840',
      stageLabel: null, rectifiesId: null, envioDocumento: null,
      ...factura,
    }],
  };
}

async function fichaDelTrabajo(factura) {
  const banco = cargarDashboard(RAIZ);
  const job = trabajoCon(factura);
  const llamadas = [];
  banco.ctx.apiRequest = async (u, o) => {
    llamadas.push({ u: String(u), o: o || {} });
    if (o && o.method === 'POST') return { ok: true, envioDocumento: null };
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  banco.ctx.appModoEmision = 'fiscal';
  const r = await pintarVista(banco, 'renderJobDetailView', 1840);
  assert.equal(r.error, null, `🔴 SUELO: la ficha del trabajo no monta (${r.error && r.error.message})`);
  const body = banco.ctx.document.body;
  const nodos = () => todos(body);
  const texto = (n) => String(n.textContent || '').trim();
  // El botón puede vivir en la fila o tras el «⋯»: se abre el menú si lo hay, para no dar un falso «no está».
  const fila = nodos().find((n) => String(n.className || '').includes('jobdet-inv-actions'));
  assert.ok(fila, '🔴 CIEGO: no encuentro la fila de acciones de la factura');
  const kebab = todos(fila).find((n) => String(n.className || '').includes('overflow-trigger'));
  if (kebab) await pulsar(kebab);
  const bizum = () => nodos().find((n) => n.tagName === 'BUTTON' && texto(n) === BIZUM) || null;
  const posts = () => llamadas.filter((l) => l.o.method === 'POST' && /\/admin\/charges\/78\/confirm-bizum$/.test(l.u));
  return { bizum, posts, nodos, texto };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} })));
}

test('SCRUM-1840 · ficha del trabajo · 🔴 sin cobro `pending` (cancelled, paid, expired, null, sin campo) no hay «Confirmar Bizum recibido»', async () => {
  const casos = [
    ['cancelled', { estadoDelCobro: 'cancelled' }],
    ['paid', { estadoDelCobro: 'paid' }],
    ['expired', { estadoDelCobro: 'expired' }],
    ['null', { estadoDelCobro: null }],
    ['sin el campo (servidor viejo)', {}],
  ];
  for (const [nombre, factura] of casos) {
    const f = await fichaDelTrabajo(factura);
    assert.equal(f.bizum(), null, `🔴 con el cobro «${nombre}» la ficha ofrece «${BIZUM}»`);
  }
});

test('SCRUM-1840 · ficha del trabajo · CONTROL POSITIVO: con el cobro `pending` el botón sigue, y su doble toque llega al POST', async () => {
  const f = await fichaDelTrabajo({ estadoDelCobro: 'pending' });
  const b = f.bizum();
  assert.ok(b, `🔴 CONTROL POSITIVO: con el cobro pendiente la ficha ya no ofrece «${BIZUM}»`);
  await pulsar(b); // 1.er toque: arma (pregunta con el importe)
  assert.equal(f.posts().length, 0, '🔴 el primer toque ya confirma el Bizum (el doble toque se ha perdido)');
  await pulsar(b); // 2.º toque: confirma
  assert.equal(f.posts().length, 1, '🔴 el doble toque no llega a POST /admin/charges/78/confirm-bizum');
});

test('SCRUM-1840 · ficha del trabajo · sin `chargeId` sigue sin haber botón aunque diga `pending`', async () => {
  const f = await fichaDelTrabajo({ estadoDelCobro: 'pending', chargeId: null });
  assert.equal(f.bizum(), null, `🔴 sin cobro asociado la ficha ofrece «${BIZUM}»`);
});
