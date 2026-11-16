// tests/scrum1686h4-inicio-operario.test.mjs — SCRUM-1686 H4 · EL INICIO DEL OPERARIO
//
// Sin gate: monta el Inicio en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// Las dos firmas del fundador, 11-nov-2026, en SCRUM-1686:
//   · c.21549 — «Sí a los dos — Firma el texto "Esto es lo que tienes hoy." y el primer bloque pasa
//     a ser su trabajo de hoy.»
//   · c.21551 — «Sí, los mismos — "Para hoy" · "N trabajos"/"1 trabajo" · "Nada para hoy." se usan
//     tal cual en el bloque del Inicio del operario. Mismo significado, misma palabra en las dos
//     pantallas.»
// «Mismo significado» se comprueba por EFECTO: el bloque cuenta lo mismo que la cifra «Para hoy» de
// la lista de Trabajos (en curso + agendado hoy, `resumenDeLaLista`, jobsView.js), porque la PINTA la
// misma función. El admin no cambia: conserva su saludo y no pide `/admin/jobs` desde el Inicio.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los literales, copiados de su firma. Si alguien los cambia en la vista sin otra firma, cae.
const SALUDO_ADMIN = 'Esto es lo que pasa hoy en tu negocio.';
const SALUDO_OPERARIO = 'Esto es lo que tienes hoy.';
const ROTULO = 'Para hoy';
const VACIO = 'Nada para hoy.';

/** Mediodía LOCAL de hoy + `dias`: «hoy» es el de quien mira (mismoDiaLocal, jobsView.js). */
function mediodia(dias) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

const EN_CURSO = { id: 1, status: 'en_curso', scheduledAt: mediodia(-2), customer: { name: 'Cliente En Curso H4' }, importeReferencia: 500, totalCobrado: 0 };
const HOY = { id: 2, status: 'agendado', scheduledAt: mediodia(0), customer: { name: 'Cliente Hoy H4' } };
const MANANA = { id: 3, status: 'agendado', scheduledAt: mediodia(1), customer: { name: 'Cliente Mañana H4' } };
const TERMINADO = { id: 4, status: 'terminado', scheduledAt: mediodia(-1), customer: { name: 'Cliente Terminado H4' }, importeReferencia: 300, totalCobrado: 0 };

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const texto = (n) => todos(n).map((x) => String(x.textContent || '')).join(' ').replace(/\s+/g, ' ').trim();

/** Monta el Inicio con `rol`; `trabajos` = `{ status, cuerpo }` de `GET /admin/jobs`. */
async function montar(rol, trabajos) {
  const pedidas = [];
  const fetch = async (url) => {
    const u = String(url);
    let status = 200;
    let cuerpo = [];
    if (/\/admin\/jobs(\?|$)/.test(u)) {
      pedidas.push('jobs');
      ({ status, cuerpo } = trabajos);
    } else if (/\/admin\/metrics\/(home|inicio)$/.test(u)) {
      cuerpo = { pendingCount: 0, quotesAwaiting: 0, pendingRequests: 0, weekly: {}, sparkline: [], recentActivity: [] };
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
  const nodos = todos(v.contenedor);
  const porId = (id) => nodos.find((n) => n.id === id || (n.getAttribute && n.getAttribute('id') === id)) || null;
  const saludo = v.contenedor.querySelector('.home-greeting');
  assert.ok(saludo, `🔴 NO PUDE MIRAR: con rol ${rol} el Inicio no tiene saludo (.home-greeting).`);
  return { v, nodos, porId, saludo: texto(saludo), pedidas };
}

const LISTA = { status: 200, cuerpo: [EN_CURSO, HOY, MANANA, TERMINADO] };

test('SCRUM-1686 H4 ⓪ · CONTROL: el operario pide sus trabajos y el bloque enseña los de hoy sembrados', async () => {
  const { porId, pedidas } = await montar('tecnico', LISTA);
  assert.deepEqual(pedidas, ['jobs'], `🔴 NO PUDE MIRAR: el Inicio del operario pidió ${JSON.stringify(pedidas)} y no /admin/jobs.`);
  const bloque = porId('home-hoy');
  assert.ok(bloque, '🔴 no hay bloque #home-hoy en el Inicio del operario (c.21549: «el primer bloque pasa a ser su trabajo de hoy»).');
  const t = texto(bloque);
  assert.match(t, /Cliente Hoy H4/, `🔴 NO PUDE MIRAR: el trabajo agendado hoy no sale en el bloque: «${t}».`);
});

test('SCRUM-1686 H4 ① · el saludo va por rol (c.21549) y el admin conserva el suyo', async () => {
  const op = await montar('tecnico', LISTA);
  assert.ok(op.saludo.includes(SALUDO_OPERARIO), `🔴 el operario no lee «${SALUDO_OPERARIO}»: «${op.saludo}».`);
  assert.ok(!op.saludo.includes('tu negocio'), `🔴 al operario se le sigue hablando de «tu negocio»: «${op.saludo}».`);
  const ad = await montar('admin', LISTA);
  assert.ok(ad.saludo.includes(SALUDO_ADMIN), `🔴 el admin perdió su saludo: «${ad.saludo}».`);
  assert.ok(!ad.saludo.includes(SALUDO_OPERARIO), `🔴 el admin lee el saludo del operario: «${ad.saludo}».`);
});

test('SCRUM-1686 H4 ② · el bloque va ANTES del héroe y de las acciones rápidas (primer bloque, c.21549)', async () => {
  const { nodos, porId, v } = await montar('tecnico', LISTA);
  const hoy = nodos.indexOf(porId('home-hoy'));
  const heroe = nodos.indexOf(porId('home-hero'));
  const rapidas = nodos.indexOf(v.contenedor.querySelector('[data-home-block="quick"]'));
  assert.ok(hoy >= 0 && heroe >= 0 && rapidas >= 0, `🔴 NO PUDE MIRAR: posiciones hoy=${hoy} héroe=${heroe} rápidas=${rapidas}.`);
  assert.ok(hoy < heroe && hoy < rapidas, `🔴 el trabajo de hoy no es el primer bloque: hoy=${hoy} héroe=${heroe} rápidas=${rapidas}.`);
});

test('SCRUM-1686 H4 ③ · mismo significado que la lista (c.21551): en curso + agendado hoy, con sus literales', async () => {
  const dos = texto((await montar('tecnico', LISTA)).porId('home-hoy'));
  assert.ok(dos.includes(ROTULO), `🔴 falta el rótulo «${ROTULO}»: «${dos}».`);
  assert.match(dos, /(^|\s)2 trabajos/, `🔴 con uno en curso y uno agendado hoy debe decir «2 trabajos»: «${dos}».`);
  assert.match(dos, /Cliente En Curso H4/, `🔴 el trabajo EN CURSO no cuenta como de hoy, y en la lista sí: «${dos}».`);
  assert.ok(!/Cliente Mañana H4|Cliente Terminado H4/.test(dos), `🔴 entra un trabajo que no es de hoy: «${dos}».`);

  const uno = texto((await montar('tecnico', { status: 200, cuerpo: [HOY, MANANA] })).porId('home-hoy'));
  assert.match(uno, /(^|\s)1 trabajo(\s|$)/, `🔴 con uno solo debe decir «1 trabajo»: «${uno}».`);

  const cero = texto((await montar('tecnico', { status: 200, cuerpo: [MANANA] })).porId('home-hoy'));
  assert.ok(cero.includes(VACIO) && /(^|\s)0 trabajos/.test(cero), `🔴 sin nada para hoy debe decir «0 trabajos» y «${VACIO}»: «${cero}».`);
});

test('SCRUM-1686 H4 ④ · el bloque es SU trabajo de hoy: ni «Por cobrar» ni importes', async () => {
  // Control positivo: EN_CURSO y TERMINADO llevan 800 € por cobrar; la lista de Trabajos los pinta.
  const t = texto((await montar('tecnico', LISTA)).porId('home-hoy'));
  assert.ok(!t.includes('Por cobrar') && !/€/.test(t), `🔴 el bloque de hoy enseña dinero: «${t}».`);
});

test('SCRUM-1686 H4 ⑤ · si los trabajos no cargan, NO dice «Nada para hoy.» (no pude mirar ≠ no hay nada)', async () => {
  const { porId } = await montar('tecnico', { status: 500, cuerpo: { error: 'boom' } });
  const bloque = porId('home-hoy');
  const t = bloque ? texto(bloque) : '';
  assert.ok(!t.includes(VACIO) && !/trabajos?/.test(t), `🔴 con la carga caída el bloque afirma algo: «${t}».`);
});

test('SCRUM-1686 H4 ⑥ · el admin no cambia: sin bloque de hoy y sin pedir /admin/jobs desde el Inicio', async () => {
  const { porId, pedidas } = await montar('admin', LISTA);
  const bloque = porId('home-hoy');
  assert.equal(bloque ? texto(bloque) : '', '', '🔴 el admin ve el bloque del operario.');
  assert.deepEqual(pedidas, [], `🔴 el Inicio del admin pide /admin/jobs: ${JSON.stringify(pedidas)}.`);
});
