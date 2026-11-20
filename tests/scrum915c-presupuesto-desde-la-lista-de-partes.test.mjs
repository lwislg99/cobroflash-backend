// SCRUM-915c · «+ Nuevo presupuesto» TAMBIÉN EN LA FILA DEL PARTE FIRMADO (pestaña «Partes» de la ficha).
//
// Orden del fundador (20-nov-2026): la puerta que 915b puso DENTRO del parte, «que apareciese también
// a fuera». Firma del orquestador (c.21978, 20-nov ~16:15):
//   ① la plantilla la arma `window.partePlantillaDelPresupuesto` (parteDetailView, S4, rama 1762d);
//   ② sin esa función NO se pinta botón (fallback defensivo: el botón despierta al mergear S4);
//   ③ si la función devuelve null (facturado / sin líneas) → plantilla de la ficha, sólo `deTrabajo`;
//   ④ el botón SÓLO en la fila con estado 'firmado'.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ayerISO = new Date(Date.now() - 2 * 86400000).toISOString();

function job(partes, extra = {}) {
  return {
    id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
    customer: { id: 3, name: 'IES' }, asignados: [], operario: null,
    albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null,
    partes, ...extra,
  };
}

const FIRMADO = { id: 11, numero: 'PT-2026-011', estado: 'firmado', fecha: ayerISO };
const BORRADOR = { id: 12, numero: 'PT-2026-012', estado: 'borrador', fecha: ayerISO };
const PARTE_11 = { id: 11, jobId: 7, customerId: 3, puedeEditarContenido: { ok: false }, puedeEditarPrecios: { ok: true }, lineas: [{ bloque: 'mano_obra', descripcion: 'Revisión', unds: 2 }] };

/**
 * `helper`: lo que vale `window.partePlantillaDelPresupuesto` tras cargar el panel.
 *   'real' → el de parteDetailView, si existe; `undefined` → se BORRA; una función → ésa.
 */
async function montar(j, { helper, rol = 'admin', parteFalla = false } = {}) {
  const banco = cargarDashboard(RAIZ);
  const pedidas = [];
  const vistas = [];
  const llamadas = [];
  banco.ctx.apiRequest = async (u, opts) => {
    pedidas.push(u);
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe', timezone: 'UTC' };
    const uno = /\/admin\/partes\/(\d+)$/.exec(u);
    if (uno) {
      if (parteFalla) throw new Error('red');
      return { ...PARTE_11, id: Number(uno[1]) };
    }
    if (/\/admin\/partes/.test(u)) return { partes: j.partes.map((p) => ({ ...p, jobId: j.id })) };
    if (/gastos/.test(u)) return [];
    return j;
  };
  banco.ctx.appUserRole = rol;
  if (helper !== 'real') {
    if (typeof helper === 'function') {
      banco.ctx.partePlantillaDelPresupuesto = (parte) => { llamadas.push(JSON.parse(JSON.stringify(parte))); return helper(parte); };
    } else {
      banco.ctx.partePlantillaDelPresupuesto = undefined;
    }
  }
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message})`);
  banco.ctx.renderAppView = (v, p) => vistas.push({ v, p: JSON.parse(JSON.stringify(p)) });
  return { ...r, banco, pedidas, vistas, llamadas };
}

const texto = (n) => String(n.textContent || '').trim();
const esperar = () => new Promise((res) => setTimeout(res, 0));
const botonDeLaFila = (r, id) => todos(r.contenedor).find((n) => n.getAttribute && n.getAttribute('data-parte-fila-presupuesto') === String(id));
const PLANTILLA = { deTrabajo: { jobId: 7, customerId: 3 }, lines: [{ concept: 'Revisión', qty: 2 }] };

test('SCRUM-915c · fila FIRMADA: «+ Nuevo presupuesto», 44px, y al pulsar pide el parte y abre el editor con la plantilla de S4', async () => {
  const r = await montar(job([FIRMADO, BORRADOR]), { helper: () => PLANTILLA });
  const b = botonDeLaFila(r, 11);
  assert.ok(b, '🔴 la fila del parte firmado no lleva la puerta al presupuesto');
  assert.equal(texto(b), '+ Nuevo presupuesto', '🔴 el rótulo no es el de 915b/1190 (cero texto nuevo)');
  assert.ok(/\bjob-toolbar-btn-44\b/.test(b.className), '🔴 sin la clase de 44px (SCRUM-962)');
  assert.ok(/\bbtn-secondary\b/.test(b.className), '🔴 la puerta de la fila es SECUNDARIA');
  const sec = todos(r.contenedor).find((n) => (n.dataset && n.dataset.seccion === 'partes') || (n.getAttribute && n.getAttribute('data-seccion') === 'partes'));
  assert.ok(sec && todos(sec).includes(b), '🔴 el botón no vive en la sección «Partes»');
  b.click();
  await esperar(); await esperar();
  assert.ok(r.pedidas.includes('/admin/partes/11'), '🔴 no pidió el parte: la lista no trae candados ni líneas');
  assert.equal(r.llamadas.length, 1, '🔴 la plantilla no la decidió la función de S4');
  assert.equal(r.llamadas[0].id, 11);
  assert.deepEqual(r.vistas, [{ v: 'quotes-new', p: { template: PLANTILLA } }]);
});

test('SCRUM-915c · 🔴 negativo: la fila BORRADOR no lleva la puerta', async () => {
  const r = await montar(job([FIRMADO, BORRADOR]), { helper: () => PLANTILLA });
  assert.equal(botonDeLaFila(r, 12), undefined, '🔴 un borrador ofrece presupuesto: sus líneas aún se están apuntando');
});

test('SCRUM-915c · 🔴 sin `window.partePlantillaDelPresupuesto` no se pinta botón (fallback defensivo ②)', async () => {
  const r = await montar(job([FIRMADO]), { helper: undefined });
  assert.equal(botonDeLaFila(r, 11), undefined, '🔴 botón sin la función de S4: armaría la plantilla otra cosa');
});

test('SCRUM-915c · la función de S4 dice NO (null) → plantilla de la ficha, sólo deTrabajo (③)', async () => {
  const r = await montar(job([FIRMADO]), { helper: () => null });
  botonDeLaFila(r, 11).click();
  await esperar(); await esperar();
  assert.deepEqual(r.vistas, [{ v: 'quotes-new', p: { template: { deTrabajo: { jobId: 7, customerId: 3 } } } }]);
});

test('SCRUM-915c · el parte no llega → plantilla de la ficha, y el botón no se queda deshabilitado', async () => {
  const r = await montar(job([FIRMADO]), { helper: () => PLANTILLA, parteFalla: true });
  const b = botonDeLaFila(r, 11);
  b.click();
  await esperar(); await esperar();
  assert.deepEqual(r.vistas, [{ v: 'quotes-new', p: { template: { deTrabajo: { jobId: 7, customerId: 3 } } } }]);
  assert.equal(b.disabled, false);
});

test('SCRUM-915c · técnico: no se le ofrece (SCRUM-89, veta de dinero)', async () => {
  const r = await montar(job([FIRMADO]), { helper: () => PLANTILLA, rol: 'tecnico' });
  assert.equal(botonDeLaFila(r, 11), undefined);
});

// La integración con la función REAL de S4: despierta sola cuando 1762d llegue a main.
const banco0 = cargarDashboard(RAIZ);
const hayReal = typeof banco0.ctx.partePlantillaDelPresupuesto === 'function';
test('SCRUM-915c · con la función REAL de parteDetailView, la fila firmada lleva sus líneas al editor',
  { skip: hayReal ? false : 'window.partePlantillaDelPresupuesto aún no está en parteDetailView (S4, rama scrum-1762d)' },
  async () => {
    const r = await montar(job([FIRMADO]), { helper: 'real' });
    botonDeLaFila(r, 11).click();
    await esperar(); await esperar();
    assert.equal(r.vistas.length, 1);
    assert.equal(r.vistas[0].v, 'quotes-new');
    assert.deepEqual(r.vistas[0].p.template, PLANTILLA, '🔴 la función real no lleva las líneas del parte firmado');
  });
