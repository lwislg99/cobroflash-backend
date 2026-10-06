// tests/scrum1302f-envio-sin-telefono.test.mjs — SCRUM-1302 (F)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 «ENVIAR PARA FIRMAR» Y «ENVIAR POR WHATSAPP» SE OFRECÍAN A UN CLIENTE SIN NÚMERO
//
// Medido el 30-sep sobre `b6243e1c`: con el cliente sin número, los dos botones salían y su ÚNICO
// desenlace posible era `409 customer_missing_phone` («Este cliente no tiene WhatsApp guardado.»).
// El profesional sí leía por qué — el defecto no era el silencio, era ofrecer un botón que sólo sabe
// fallar. Causa: el detalle (`GET /admin/albaranes/:id`) no decía si el cliente tiene canal, así que
// la pantalla no podía saberlo.
//
// Arreglo, con el patrón ya aprobado de la hoja del Trabajo (SCRUM-993, opción A): sin canal, NO SE
// OFRECEN. El servidor lo decide con `canalDeWhatsApp` —la misma función que da el 409— y lo manda
// resuelto; el registro del albarán lo declara con `requiere`, y la ley (`destinoEfectivo`) lo aplica.
//
// ── EL BANCO ─────────────────────────────────────────────────────────────────────────────────────
// La pantalla de verdad (`cargarDashboard`, scripts de `index.html` en orden) pidiendo el detalle a la
// RUTA de verdad (`dist`, base doblada con `_envio-doblado.mjs`). No se escribe a mano lo que manda
// el servidor: se lee lo que la ruta responde para ese cliente.
//
// CONTROL POSITIVO: con móvil, los dos siguen ahí (mismo token, `data-accion`). Y sin el dato —la
// lista, la copia precargada sin red— no se esconde nada: ahí el 409 sigue diciendo por qué.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inyectarBase, moduloDeDist, MERCHANT, CLIENTE } from './_envio-doblado.mjs';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = '../dist/modules/jobs/app/routes/albaranes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));
const JOB_ID = 13026;

function filaAlbaran(id, estado) {
  return {
    id, merchantId: MERCHANT, jobId: JOB_ID, numero: 'AB26' + id, estado, fecha: '2026-09-30T08:00:00.000Z',
    lineas: [{ concepto: 'Tubo', cantidad: 2 }], modoValoracion: 'SIN_VALORAR', invoiceId: null,
    enviadoParaFirmaAt: null, lugarEntrega: null, notas: null,
  };
}

/** La ruta de detalle de verdad, con un cliente cuyos números se dicen aquí. */
function rutaDeDetalle(filas, cliente) {
  inyectarBase({
    'albaran.findFirst': ({ where }) => {
      const f = filas.find((a) => a.id === where.id && where.merchantId === MERCHANT);
      return f ? copia(f) : null;
    },
    'job.findFirst': ({ where }) => (where.id === JOB_ID && where.merchantId === MERCHANT
      ? { id: JOB_ID, titulo: 'Baño', direccion: null, customerId: CLIENTE, quoteId: null, operarioId: null, assignedUserId: null, assignees: [] }
      : null),
    'customer.findFirst': ({ where }) => (where.id === CLIENTE && where.merchantId === MERCHANT
      ? { id: CLIENTE, name: 'Ana Ruiz', ...cliente } : null),
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/:id' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /:id en el router de albaranes');
  const h = capa.route.stack.at(-1).handle;
  return async (id) => {
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(id) }, merchantId: MERCHANT, userRole: 'admin' }, res);
    return r;
  };
}

const resp = (status, data) => ({
  ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
  json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
});

/** Todas las acciones que la pantalla ofrece, también las del «⋯» (se abre para mirarlas). */
async function accionesDelDetalle(alb, detalle) {
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
  const v = await pintarVista(banco, 'renderAlbaranDetailView', alb.id);
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: el detalle no se pinta: ${v.error && v.error.message}`);
  const disparador = todos(v.contenedor).find((n) => n.className && String(n.className).includes('overflow-trigger'));
  if (disparador) { disparador.click(); for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); }
  const ids = todos(banco.ctx.document.body).filter((n) => n.tagName === 'BUTTON' && n.dataset && n.dataset.accion)
    .map((b) => b.dataset.accion);
  assert.ok(ids.includes('btnPdf'), '🔴 NO PUDE MIRAR: ni «Descargar PDF» está; el «no está» de abajo no probaría nada');
  return ids;
}

const EMITIDO = filaAlbaran(1302601, 'emitido');
const FIRMADO = filaAlbaran(1302602, 'firmado');

const FILAS = [
  ['sin ningún número', { phone: null, mobile: null }],
  ['con un número que no se puede marcar', { phone: 'no tiene', mobile: '' }],
];
const caso2 = casosEscritos(FILAS, ([caso, cliente]) => `SCRUM-1302 F · 🔴 cliente ${caso}: ni «Enviar para firmar» ni «Enviar por WhatsApp» (su único desenlace es 409)`, async ([caso, cliente]) => {
  const detalle = rutaDeDetalle([EMITIDO, FIRMADO], cliente);
  const emitido = await accionesDelDetalle(EMITIDO, detalle);
  assert.ok(!emitido.includes('btnEnviarFirmar'),
    `🔴 emitido, cliente ${caso}: se ofrece «Enviar para firmar» y sólo puede dar 409 customer_missing_phone. Acciones: ${JSON.stringify(emitido)}`);
  assert.ok(emitido.includes('btnFirmarAqui'), '🔴 se ha escondido de más: «Firmar aquí mismo» no necesita número');
  const firmado = await accionesDelDetalle(FIRMADO, detalle);
  assert.ok(!firmado.includes('btnWhatsApp'),
    `🔴 firmado, cliente ${caso}: se ofrece «Enviar por WhatsApp» y sólo puede dar 409. Acciones: ${JSON.stringify(firmado)}`);
});
test('SCRUM-1302 F · 🔴 cliente sin ningún número: ni «Enviar para firmar» ni «Enviar por WhatsApp» (su único desenlace es 409)', caso2(0));
test('SCRUM-1302 F · 🔴 cliente con un número que no se puede marcar: ni «Enviar para firmar» ni «Enviar por WhatsApp» (su único desenlace es 409)', caso2(1));
caso2.todos();

test('SCRUM-1302 F · ✅ cliente con móvil: los dos envíos siguen ofreciéndose (btnEnviarFirmar, btnWhatsApp)', async () => {
  const detalle = rutaDeDetalle([EMITIDO, FIRMADO], { phone: null, mobile: '34000000001' });
  assert.ok((await accionesDelDetalle(EMITIDO, detalle)).includes('btnEnviarFirmar'),
    '🔴 con móvil ya no se ofrece «Enviar para firmar»: se esconde de más');
  assert.ok((await accionesDelDetalle(FIRMADO, detalle)).includes('btnWhatsApp'),
    '🔴 con móvil ya no se ofrece «Enviar por WhatsApp»: se esconde de más');
});

test('SCRUM-1302 F · ✅ sin el dato (lista, precarga sin red) no se esconde nada: btnEnviarFirmar sigue', async () => {
  const sinDato = async (id) => ({ status: 200, data: { ...copia(EMITIDO), id, customer: { id: CLIENTE, name: 'Ana Ruiz' }, job: { id: JOB_ID } } });
  const ids = await accionesDelDetalle(EMITIDO, sinDato);
  assert.ok(ids.includes('btnEnviarFirmar'),
    '🔴 sin saber si el cliente tiene número se ha escondido el envío: eso es callar por falta de dato (SCRUM-816)');
});

test('SCRUM-1302 F · la ruta dice el canal con la MISMA función que decide el 409, sin mandar el número', async () => {
  const con = await rutaDeDetalle([EMITIDO], { phone: '+34 000 000 002', mobile: null })(EMITIDO.id);
  const sin = await rutaDeDetalle([EMITIDO], { phone: null, mobile: null })(EMITIDO.id);
  assert.equal(con.status, 200, '🔴 NO PUDE MIRAR: la ruta no respondió');
  assert.equal(con.data.customer.puedeRecibirWhatsApp, true, '🔴 con número la ruta no dice que hay canal');
  assert.equal(sin.data.customer.puedeRecibirWhatsApp, false, '🔴 sin número la ruta no dice que falta el canal');
  assert.equal('phone' in con.data.customer || 'mobile' in con.data.customer, false,
    '🔴 el detalle ha empezado a mandar el número del cliente: basta con decir si hay canal');
});

// ═══ LA FACTURA NO CAMBIA · `requiere` vive en la ley compartida (`patronDetalleAcciones.js`) ═══
// Hoy ninguna acción de la factura lo lleva; esto lo deja sujeto para quien toque ese fichero.
test('SCRUM-1302 F · la factura no se entera: ninguna acción suya lleva `requiere` y sus destinos no cambian', async () => {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { INVOICE_ACTION_REGISTRY, INVOICE_STATES, destinoEfectivo } = req('../public/dashboard/js/invoiceActionsRegistry.js');
  const { ALBARAN_ACTION_REGISTRY } = req('../public/dashboard/js/albaranActionsRegistry.js');
  assert.ok(INVOICE_ACTION_REGISTRY.length > 5 && INVOICE_STATES.length > 2, '🔴 NO PUDE MIRAR: el registro de la factura no se ha cargado');
  assert.deepEqual(INVOICE_ACTION_REGISTRY.filter((a) => 'requiere' in a).map((a) => a.id), [],
    '🔴 una acción de la FACTURA ha empezado a llevar `requiere`: mide lo que oculta antes de seguir');
  // SCRUM-1302 (G) añadió la foto con su propia condición: cada una se fija con la SUYA.
  assert.deepEqual(Object.fromEntries(ALBARAN_ACTION_REGISTRY.filter((a) => 'requiere' in a).map((a) => [a.id, a.requiere])),
    { btnEnviarFirmar: 'cliente-con-whatsapp', btnWhatsApp: 'cliente-con-whatsapp', btnFoto: 'caben-fotos' },
    '🔴 las acciones del albarán con `requiere` no son los dos envíos por WhatsApp (canal) y la foto (plazas)');
  for (const hayCharge of [true, false]) {
    for (const a of INVOICE_ACTION_REGISTRY) {
      for (const s of INVOICE_STATES) {
        assert.equal(destinoEfectivo(a, s, { hayCharge, 'cliente-con-whatsapp': false }), destinoEfectivo(a, s, { hayCharge }),
          `🔴 la factura cambia de destino (${a.id} en ${s}) por una condición del albarán`);
      }
    }
  }
});
