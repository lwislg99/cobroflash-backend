// tests/scrum1390y-inicio-por-rol.test.mjs — SCRUM-1390y
//
// Sin gate: monta el Inicio en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// El bloque de actividad del Inicio es el MISMO para los dos roles, y desde SCRUM-1555 la ruta del
// Técnico (`/admin/metrics/inicio`) ya le recorta los presupuestos a los suyos. Lo que faltaba eran
// los TEXTOS: los dos roles leían «Actividad reciente» y «Sin actividad reciente». Firmados en
// SCRUM-1390 por el fundador el 1-oct-2026:
//   · rótulo del Técnico  → c.17962, respuesta literal «2-Ok firmo»;
//   · vacío del Técnico   → c.17963, respuesta literal «1-Firmo la 1»;
//   · el admin CONSERVA los suyos → c.17962 ③, «3-El admin conserva sí».
// c.17962 y c.17963 piden que se comprueben POR EFECTO, con sesión de cada rol, y no leyendo el `if`:
// por eso esto pinta la vista y lee el texto del bloque, no busca cadenas en el fuente.
//
// Y dos puntos de la medida de J4 (c.20438) que se construyen sin texto nuevo:
//   · punto 2: un 200 SIN `recentActivity` caía en el vacío (`|| []`); con el texto firmado, el Técnico
//     leería «Todavía no tienes presupuestos» sobre una respuesta rota. Ahora va al estado de error.
//   · punto 4: el rótulo se decide ANTES de cargar, así que encima de un error ya está el del rol.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "${veNegocio ? 'Actividad reciente' : 'Tus presupuestos recientes'}",
    a: 'Actividad reciente',
    cae: 'SCRUM-1390y ① ·',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "${veNegocio ? 'Sin actividad reciente' : 'Todavía no tienes presupuestos. Aquí verás los que hagas tú y los que te asignen.'}",
    a: 'Sin actividad reciente',
    cae: 'SCRUM-1390y ② ·',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: '  if (!Array.isArray(items)) {\n    uiErrorState(feed,',
    a: '  if (!Array.isArray(items)) items = [];\n  if (false) {\n    uiErrorState(feed,',
    cae: 'SCRUM-1390y ④ ·',
  },
  {
    fichero: 'public/dashboard/js/homeView.js',
    de: "  const veNegocio = window.appUserRole === 'admin';\n  container.innerHTML = `",
    a: "  const veNegocio = true;\n  container.innerHTML = `",
    cae: 'SCRUM-1390y ① ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los literales, copiados de su firma. Si alguien los cambia en la vista sin otra firma, cae.
const ROTULO_ADMIN = 'Actividad reciente';
const ROTULO_TECNICO = 'Tus presupuestos recientes';
const VACIO_ADMIN = 'Sin actividad reciente';
const VACIO_TECNICO = 'Todavía no tienes presupuestos. Aquí verás los que hagas tú y los que te asignen.';
const ERROR = 'No pudimos cargar tus métricas';

const UN_PRESUPUESTO = { id: 41, quoteNumber: 7, customer: 'Cliente Sembrado 1390y', total: 120, currency: 'EUR', status: 'sent', updatedAt: '2026-10-20T10:00:00Z' };

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

/** Monta el Inicio con `rol` y contesta las métricas con `metricas` (`{ status, cuerpo }`). */
async function montar(rol, metricas) {
  const pedidas = [];
  const fetch = async (url, opts) => {
    const u = String(url);
    let status = 200;
    let cuerpo = [];
    if (/\/admin\/metrics\/(home|inicio)$/.test(u)) {
      pedidas.push(u.replace(/^.*\/admin\/metrics\//, ''));
      ({ status, cuerpo } = metricas);
    } else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
    else if (/\/admin\/metrics\/(team|actividad-equipo)$/.test(u)) cuerpo = { hasTeam: false, members: [], inactive: [], sinAsignar: null, totalCollected: 0 };
    return {
      ok: status >= 200 && status < 300, status,
      headers: { get: () => 'application/json' },
      json: async () => cuerpo, text: async () => JSON.stringify(cuerpo),
    };
  };
  const b = cargarDashboard(RAIZ, {
    rol,
    red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch },
  });
  b.ctx.appMerchantId = 1;
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.renderAppView = () => {};
  for (const id of ['req-badge', 'nav-quotes-badge', 'nav-invoices-badge']) {
    const g = b.mk('span');
    g.id = id;
    b.ctx.document.body.appendChild(g);
  }
  const v = await pintarVista(b, 'renderHomeView');
  if (v.error || v.noMedida) throw new Error(`el Inicio no monta con rol ${rol}: ${(v.error && v.error.message) || v.noMedida}`);
  await respirar();
  const bloque = v.contenedor.querySelector('[data-home-block="activity"]');
  assert.ok(bloque, `🔴 NO PUDE MIRAR: con rol ${rol} no hay bloque [data-home-block="activity"] en el Inicio.`);
  const texto = todos(bloque).map((n) => String(n.textContent || '')).join(' ').replace(/\s+/g, ' ').trim();
  assert.ok(texto.length > 0, `🔴 NO PUDE MIRAR: el bloque de actividad (${rol}) no tiene texto que leer.`);
  return { texto, pedidas };
}

const VACIA = { status: 200, cuerpo: { pendingCount: 0, quotesAwaiting: 0, pendingRequests: 0, weekly: {}, sparkline: [], recentActivity: [] } };
const CON_UNO = { status: 200, cuerpo: { pendingCount: 0, quotesAwaiting: 0, pendingRequests: 0, weekly: {}, sparkline: [], recentActivity: [UN_PRESUPUESTO] } };
const SIN_LISTA = { status: 200, cuerpo: { pendingCount: 0, quotesAwaiting: 0, pendingRequests: 0, weekly: {}, sparkline: [] } };
const CAE = { status: 500, cuerpo: { error: 'boom' } };

test('SCRUM-1390y ⓪ · CONTROL: el banco pide la ruta de cada rol y ve un presupuesto sembrado', async () => {
  for (const rol of ['admin', 'tecnico']) {
    const { texto, pedidas } = await montar(rol, CON_UNO);
    assert.deepEqual(pedidas, [rol === 'admin' ? 'home' : 'inicio'],
      `🔴 NO PUDE MIRAR: con rol ${rol} el Inicio pidió ${JSON.stringify(pedidas)}.`);
    assert.match(texto, /Cliente Sembrado 1390y/,
      `🔴 NO PUDE MIRAR: el presupuesto sembrado no sale en el bloque (${rol}): «${texto}». Sin esto, un «no sale el vacío» no dice nada.`);
    assert.ok(!texto.includes(VACIO_ADMIN) && !texto.includes(VACIO_TECNICO),
      `🔴 con un presupuesto en la lista sale un cartel de vacío (${rol}): «${texto}».`);
  }
});

test('SCRUM-1390y ① · el RÓTULO depende del rol: el admin conserva el suyo, el Técnico lee el firmado', async () => {
  for (const escenario of [VACIA, CON_UNO]) {
    const admin = await montar('admin', escenario);
    assert.ok(admin.texto.startsWith(ROTULO_ADMIN), `🔴 el admin no lee «${ROTULO_ADMIN}»: «${admin.texto}».`);
    assert.ok(!admin.texto.includes(ROTULO_TECNICO), `🔴 al admin le sale el rótulo del Técnico: «${admin.texto}».`);
    const tec = await montar('tecnico', escenario);
    assert.ok(tec.texto.startsWith(ROTULO_TECNICO),
      `🔴 el Técnico no lee el rótulo firmado «${ROTULO_TECNICO}» (SCRUM-1390 c.17962): «${tec.texto}».`);
    assert.ok(!tec.texto.includes(ROTULO_ADMIN), `🔴 al Técnico le sigue saliendo «${ROTULO_ADMIN}»: «${tec.texto}».`);
  }
});

test('SCRUM-1390y ② · el VACÍO depende del rol: cada uno lee el que le toca, y no el del otro', async () => {
  const admin = await montar('admin', VACIA);
  assert.ok(admin.texto.includes(VACIO_ADMIN), `🔴 el vacío del admin no es «${VACIO_ADMIN}»: «${admin.texto}».`);
  assert.ok(!admin.texto.includes(VACIO_TECNICO), `🔴 al admin le sale el vacío del Técnico: «${admin.texto}».`);
  const tec = await montar('tecnico', VACIA);
  assert.ok(tec.texto.includes(VACIO_TECNICO),
    `🔴 el vacío del Técnico no es el firmado (SCRUM-1390 c.17963, «1-Firmo la 1»): «${tec.texto}».`);
  assert.ok(!tec.texto.includes(VACIO_ADMIN), `🔴 al Técnico le sigue saliendo «${VACIO_ADMIN}»: «${tec.texto}».`);
});

test('SCRUM-1390y ③ · si la carga FALLA, el Técnico ve el error bajo SU rótulo, no el vacío (c.20438, punto 4)', async () => {
  const tec = await montar('tecnico', CAE);
  assert.ok(tec.texto.includes(ERROR), `🔴 con un 500 el Técnico no ve el estado de error: «${tec.texto}».`);
  assert.ok(!tec.texto.includes(VACIO_TECNICO), `🔴 con un 500 el Técnico lee «no tienes presupuestos»: «${tec.texto}».`);
  assert.ok(tec.texto.startsWith(ROTULO_TECNICO), `🔴 encima del error no está el rótulo del Técnico: «${tec.texto}».`);
});

test('SCRUM-1390y ④ · un 200 SIN la lista no es «no tienes presupuestos»: va al estado de error (c.20438, punto 2)', async () => {
  const tec = await montar('tecnico', SIN_LISTA);
  assert.ok(!tec.texto.includes(VACIO_TECNICO),
    `🔴 una respuesta sin \`recentActivity\` le dice al Técnico que no tiene presupuestos: «${tec.texto}».`);
  assert.ok(tec.texto.includes(ERROR), `🔴 una respuesta sin \`recentActivity\` no llega al estado de error: «${tec.texto}».`);
  const admin = await montar('admin', SIN_LISTA);
  assert.ok(!admin.texto.includes(VACIO_ADMIN),
    `🔴 una respuesta sin \`recentActivity\` le dice al admin «${VACIO_ADMIN}»: «${admin.texto}».`);
});
