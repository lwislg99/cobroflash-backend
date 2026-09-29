// tests/scrum1171-whatsapp-y-llamar-en-el-trabajo.test.mjs — SCRUM-1171 · mitad de FRONT (S2)
//
// EN LA FICHA DEL TRABAJO, UN CLIENTE CON SOLO MÓVIL SE QUEDABA SIN 📞 Y SIN 💬.
//
// `bloqueCliente` (jobRailBlocks.js) sacaba los dos enlaces de `customer.phone`. La mitad de servidor
// (en main) ya manda `customer.numeroWhatsApp = canalDeWhatsApp(customer)`. Aquí:
//   · 📞 sale de `contactoDelCliente` (api.js), el MISMO criterio que la lista y la ficha de Clientes;
//   · 💬 sale de `numeroWhatsApp`, el número que elige el SERVIDOR. El front no decide a quién se escribe.
//
// Se mide EL VIAJE: cliente → `canalDeWhatsApp` REAL (de `dist`, la misma llamada que hace
// `jobs.routes.ts`) → detalle del Trabajo → `renderJobDetailView` con el dashboard ENTERO (api.js de
// verdad) → los enlaces del bloque CLIENTE. Tres clientes (aceptación #4) + el de fijo y móvil.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { canalDeWhatsApp } = await import(pathToFileURL(path.join(RAIZ, 'dist/core/contacto/canalDeWhatsApp.js')).href);

// Números de prueba de rango no asignable (SCRUM-262): nunca un móvil real.
const FIJO = '34910000001';
const MOVIL = '34700000002';

/** Lo que devuelve el detalle del Trabajo: el cliente con `numeroWhatsApp` como lo añade la ruta. */
function detalleCon(customer) {
  const c = { id: 5, name: 'Cliente Uno', ...customer };
  return {
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer: { ...c, numeroWhatsApp: canalDeWhatsApp(c) || null },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: '',
    quote: null, direccion: null, totalAceptado: 0, totalCobrado: 0,
  };
}

async function enlacesDelCliente(customer) {
  const job = detalleCon(customer);
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  // Control de ceguera: el bloque CLIENTE tiene que estar (con el nombre), o «no hay enlace» no dice nada.
  assert.ok(n.some((x) => /Cliente Uno/.test(String(x.textContent || ''))), '🔴 CIEGO: el bloque Cliente no se ha pintado');
  const hrefs = n.map((x) => (x.getAttribute && x.getAttribute('href')) || x.href || '').filter(Boolean).map(String);
  return {
    tel: hrefs.filter((h) => h.startsWith('tel:')),
    wa: hrefs.filter((h) => h.includes('wa.me')),
  };
}

test('SCRUM-1171 · 🔴 cliente con SOLO MÓVIL: hay 📞 y 💬, los dos al móvil', async () => {
  const { tel, wa } = await enlacesDelCliente({ phone: null, mobile: MOVIL });
  assert.deepEqual(tel, [`tel:+${MOVIL}`], '🔴 sin fijo no se puede llamar al cliente desde el Trabajo');
  assert.deepEqual(wa, [`https://wa.me/${MOVIL}`], '🔴 sin fijo no se le puede escribir por WhatsApp');
});

test('SCRUM-1171 · cliente con SOLO FIJO: 📞 y 💬 al fijo (canalDeWhatsApp cae al fijo)', async () => {
  const { tel, wa } = await enlacesDelCliente({ phone: FIJO, mobile: null });
  assert.deepEqual(tel, [`tel:+${FIJO}`]);
  assert.deepEqual(wa, [`https://wa.me/${FIJO}`]);
});

test('SCRUM-1171 · cliente SIN NÚMERO: ni 📞 ni 💬 (nunca un enlace muerto)', async () => {
  const { tel, wa } = await enlacesDelCliente({ phone: null, mobile: null });
  assert.deepEqual(tel, []);
  assert.deepEqual(wa, []);
});

test('SCRUM-1171 · 🔴 fijo Y móvil: dos 📞 (como en Clientes) y 💬 al que elige el SERVIDOR (el móvil)', async () => {
  const { tel, wa } = await enlacesDelCliente({ phone: FIJO, mobile: MOVIL });
  assert.deepEqual(tel, [`tel:+${FIJO}`, `tel:+${MOVIL}`], 'el fijo sigue llamando al fijo; el móvil se añade');
  assert.deepEqual(wa, [`https://wa.me/${canalDeWhatsApp({ phone: FIJO, mobile: MOVIL })}`],
    '🔴 el WhatsApp del Trabajo no va al número que usa el envío real');
});
