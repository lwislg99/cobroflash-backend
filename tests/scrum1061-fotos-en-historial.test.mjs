// tests/scrum1061-fotos-en-historial.test.mjs — SCRUM-1061 (CRM-18)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL HISTORIAL DEL CLIENTE CONTABA LAS FOTOS DEL TRABAJO, PERO NO LAS ENSEÑABA
//
// La mitad de servidor (agregar por TRABAJO, no por albarán, con tope e ids) la prueba
// `tests/scrum980-historial-del-cliente.test.mjs` contra Postgres real (gateado). Aquí se mide
// el EFECTO en la ficha 360: dado lo que el servidor YA devuelve, ¿la pantalla pinta las
// miniaturas, el «+n más», y respeta «ausente ≠ vacío» (sin fotos, ni un hueco)?
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATS_VACIAS = { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 };

const CLIENTE = {
  id: 7061, name: 'Cliente QA 1061', phone: telefonoDePrueba(1061), mobile: null, email: null,
  notes: null, portalToken: null, createdAt: '2026-01-10T00:00:00.000Z', waOptOut: false,
  taxId: null, legalName: null, companyId: null, contactKind: null, tipoDestinatario: null,
  billingPeriodicity: 'NINGUNA', tags: null, internalRef: null,
  billingAddress: null, billingCity: null, billingPostalCode: null, billingProvince: null, billingCountry: null,
};

function trabajo(id, extra) {
  return {
    id, titulo: 'Trabajo ' + id, estado: 'terminado', scheduledAt: null,
    createdAt: '2026-09-01T00:00:00.000Z', partes: [], albaranes: [], ...extra,
  };
}

async function montarFicha(historialTrabajos) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) {
        return { customer: CLIENTE, quotes: [], invoices: [], events: [], stats: STATS_VACIAS };
      }
      if (/\/admin\/customers\/\d+\/historial$/.test(u)) return { trabajos: historialTrabajos, partesSueltos: [] };
      return { ...CLIENTE };
    },
  });
  assert.deepEqual(banco.fallos, [], 'un script del panel no cargó: nada de lo de abajo mediría');
  const r = await pintarVista(banco, 'renderCustomer360View', CLIENTE.id);
  assert.equal(r.error, null, `la ficha 360 no montó: ${r.error && r.error.message}`);
  // La pestaña «Trabajos» NO es la que se pinta por defecto (esa es «Presupuestos»,
  // `renderTab('quotes')` al final del montaje): hay que pulsarla para que la tabla del
  // historial —y sus miniaturas— lleguen al DOM.
  const tabJobs = r.contenedor.querySelector('[data-key="jobs"]');
  assert.ok(tabJobs, '🔴 CIEGO: no encuentro la pestaña «Trabajos» (¿no llegó `historial`?).');
  tabJobs.dispararClick();
  return r;
}

test('SCRUM-1061 · 🔴 SUELO: un trabajo con fotos pinta el bloque de miniaturas', async () => {
  const r = await montarFicha([trabajo(1, { fotos: { ids: [901, 902, 903], total: 5 } })]);
  const galeria = todos(r.contenedor).find((n) => String(n.className || '').split(/\s+/).includes('historial-fotos-mini'));
  assert.ok(galeria, '🔴 CIEGO: no encuentro .historial-fotos-mini con un trabajo que SÍ tiene fotos.');
});

test('SCRUM-1061 · pinta hasta 3 miniaturas (una por foto, con su enlace y su alt) y el «+n más» si sobran', async () => {
  const r = await montarFicha([trabajo(1, { fotos: { ids: [901, 902, 903], total: 5 } })]);
  const enlaces = todos(r.contenedor).filter((n) => String(n.className || '').split(/\s+/).includes('historial-foto-mini'));
  assert.equal(enlaces.length, 3, `🔴 esperaba 3 miniaturas (el tope de SCRUM-1060); hay ${enlaces.length}.`);
  assert.deepEqual(enlaces.map((a) => a.href).sort(), ['/admin/attachments/901', '/admin/attachments/902', '/admin/attachments/903'].sort(),
    '🔴 el href de la miniatura no sale de `GET /admin/attachments/:id`.');
  assert.equal(enlaces[0].target, '_blank');
  const img = enlaces[0].querySelector('img');
  assert.ok(img, '🔴 CIEGO: la miniatura no tiene <img> dentro.');
  assert.equal(img.getAttribute('src') || img.src, '/admin/attachments/901');
  assert.equal(img.alt, 'Foto del trabajo', '🔴 el `alt` no es el texto firmado.');

  const mas = todos(r.contenedor).find((n) => String(n.className || '').split(/\s+/).includes('historial-fotos-mas'));
  assert.ok(mas, '🔴 CIEGO: con total=5 e ids=3 tiene que salir el «+n más».');
  assert.equal(mas.textContent, '+2 más', '🔴 el texto del «+n más» no es el firmado (con la cifra correcta: 5-3=2).');
  assert.equal(mas.getAttribute('aria-label'), '2 fotos más', '🔴 el aria-label no es el firmado.');
});

test('SCRUM-1061 · 🔴 con exactamente 3 fotos (total === tope), NO sale «+n más»', async () => {
  const r = await montarFicha([trabajo(1, { fotos: { ids: [1, 2, 3], total: 3 } })]);
  const mas = todos(r.contenedor).find((n) => String(n.className || '').split(/\s+/).includes('historial-fotos-mas'));
  assert.equal(mas, undefined, '🔴 con total === ids.length no debería sobrar ninguna, y sin embargo sale «+n más».');
});

test('SCRUM-1061 · 🔴 un trabajo SIN fotos no pinta nada nuevo (ausente ≠ vacío)', async () => {
  const r = await montarFicha([trabajo(1, {})]); // sin la clave `fotos`, como la manda el servidor
  const galeria = todos(r.contenedor).find((n) => String(n.className || '').split(/\s+/).includes('historial-fotos-mini'));
  assert.equal(galeria, undefined, '🔴 un trabajo sin la clave `fotos` no debería pintar el bloque de miniaturas.');
});

test('SCRUM-1061 · una foto que falla al cargar se retira, no rompe la ficha (queda oculta, no un icono roto)', async () => {
  const r = await montarFicha([trabajo(1, { fotos: { ids: [901], total: 1 } })]);
  const img = todos(r.contenedor).find((n) => n.tagName === 'IMG');
  assert.ok(img, '🔴 CIEGO: no encuentro la <img>.');
  assert.equal(typeof img.onerror, 'function', '🔴 la <img> no tiene manejador de error enganchado.');
  img.onerror(); // simula el fallo de carga que dispararía el navegador
  assert.equal(img.hidden, true, '🔴 al fallar la carga, la foto tenía que ocultarse (no dejar el icono roto).');
});
