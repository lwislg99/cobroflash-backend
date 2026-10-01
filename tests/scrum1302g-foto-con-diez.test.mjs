// tests/scrum1302g-foto-con-diez.test.mjs — SCRUM-1302 (G)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «AÑADIR FOTO» SE OFRECÍA CON LAS DIEZ PLAZAS YA OCUPADAS
//
// Medido el 30-sep sobre `b6243e1c`: con 10 fotos en el albarán, «📷 Añadir foto» seguía en el «⋯» y
// su único desenlace posible era `409 max_fotos` (`POST /admin/albaranes/:id/fotos`, tope
// `FOTOS_MAX_POR_ALBARAN`). El detalle no decía si caben más, así que la pantalla no podía saberlo.
//
// Arreglo: el detalle manda `cabenMasFotos`, contado en la ruta contra el MISMO tope que da el 409, y
// el registro lo declara con `requiere` (la ley de SCRUM-1302 F). Sin el dato no se esconde nada.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────────
// La pantalla de verdad pidiendo el detalle a la RUTA de verdad (`dist`, base doblada), con N fotos
// en la base. CONTROL POSITIVO: con 9 el botón sigue (mismo token, `data-accion`), y sin el dato
// también.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = '../dist/modules/jobs/app/routes/albaranes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const JOB_ID = 13027;
const ALB = {
  id: 1302701, merchantId: MERCHANT, jobId: JOB_ID, numero: 'AB261302701', estado: 'emitido',
  fecha: '2026-09-30T08:00:00.000Z', lineas: [{ concepto: 'Tubo', cantidad: 2 }], modoValoracion: 'SIN_VALORAR',
  invoiceId: null, enviadoParaFirmaAt: null, lugarEntrega: null, notas: null,
};

/** La ruta de detalle de verdad, con `fotos` fotos del albarán en la base. */
function rutaDeDetalle(fotos) {
  const contadas = [];
  inyectarBase({
    'albaran.findFirst': ({ where }) => (where.id === ALB.id && where.merchantId === MERCHANT ? copia(ALB) : null),
    'job.findFirst': ({ where }) => (where.id === JOB_ID && where.merchantId === MERCHANT
      ? { id: JOB_ID, titulo: 'Baño', direccion: null, customerId: CLIENTE, quoteId: null, operarioId: null, assignedUserId: null, assignees: [] }
      : null),
    'customer.findFirst': () => ({ id: CLIENTE, name: 'Ana Ruiz', phone: null, mobile: '34000000001' }),
    'attachment.count': ({ where }) => {
      contadas.push(where);
      return where.merchantId === MERCHANT && where.entityType === 'albaran' && where.entityId === ALB.id ? fotos : 0;
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /:id en el router de albaranes');
  const h = capa.route.stack.at(-1).handle;
  const pedir = async (id) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(id) }, merchantId: MERCHANT, userRole: 'admin' }, res);
    return r;
  };
  pedir.contadas = contadas;
  return pedir;
}

const resp = (status, data) => ({
  ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
  json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
});

async function accionesDelDetalle(detalle) {
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url) => {
        const m = String(url).match(/\/admin\/albaranes\/(\d+)$/);
        if (m) { const r = await detalle(Number(m[1])); return resp(r.status, r.data); }
        return resp(200, []);
      },
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    },
  });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', ALB.id);
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: el detalle no se pinta: ${v.error && v.error.message}`);
  const disparador = todos(v.contenedor).find((n) => n.className && String(n.className).includes('overflow-trigger'));
  assert.ok(disparador, '🔴 NO PUDE MIRAR: no hay «⋯» en el detalle emitido');
  disparador.click();
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  const ids = todos(banco.ctx.document.body).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.accion)
    .map((b) => b.dataset.accion);
  assert.ok(ids.includes('btnVerTrabajo'), '🔴 NO PUDE MIRAR: el «⋯» no se abrió (falta «Ver trabajo»)');
  return ids;
}

test('SCRUM-1302 G · 🔴 con las 10 fotos puestas «Añadir foto» NO se ofrece (su único desenlace es 409 max_fotos)', async () => {
  const detalle = rutaDeDetalle(10);
  const ids = await accionesDelDetalle(detalle);
  assert.ok(!ids.includes('btnFoto'), `🔴 con 10 fotos se ofrece «Añadir foto», que sólo puede dar 409 max_fotos. Acciones: ${JSON.stringify(ids)}`);
});

test('SCRUM-1302 G · ✅ con 9 fotos «Añadir foto» sigue (btnFoto)', async () => {
  const ids = await accionesDelDetalle(rutaDeDetalle(9));
  assert.ok(ids.includes('btnFoto'), `🔴 con 9 fotos ya no se ofrece «Añadir foto»: se esconde de más. Acciones: ${JSON.stringify(ids)}`);
});

test('SCRUM-1302 G · ✅ sin el dato (precarga sin red) no se esconde nada: btnFoto sigue', async () => {
  const sinDato = async () => ({ status: 200, data: { ...copia(ALB), customer: { id: CLIENTE, name: 'Ana Ruiz' }, job: { id: JOB_ID } } });
  const ids = await accionesDelDetalle(sinDato);
  assert.ok(ids.includes('btnFoto'), '🔴 sin saber cuántas fotos hay se ha escondido «Añadir foto»: callar por falta de dato (SCRUM-816)');
});

test('SCRUM-1302 G · la ruta cuenta SÓLO las fotos de ESTE albarán y de ESTE merchant, contra el tope del 409', async () => {
  const d10 = rutaDeDetalle(10);
  const r10 = await d10(ALB.id);
  assert.equal(r10.status, 200, '🔴 NO PUDE MIRAR: la ruta no respondió');
  assert.deepEqual(d10.contadas.at(-1), { merchantId: MERCHANT, entityType: 'albaran', entityId: ALB.id },
    '🔴 la cuenta de fotos no filtra por merchant (regla 2) o no es la del albarán');
  assert.equal(r10.data.cabenMasFotos, false, '🔴 con 10 fotos la ruta dice que caben más');
  assert.equal((await rutaDeDetalle(9)(ALB.id)).data.cabenMasFotos, true, '🔴 con 9 fotos la ruta dice que no caben más');
});
