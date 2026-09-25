// tests/scrum786-irreversibles-44px.test.mjs — SCRUM-786
//
// DECISIÓN DEL FUNDADOR (21-sep-2026, comentario 16266): opción ③ — reglas de 44px ACOTADAS POR
// CONTENEDOR, en orden A→B, empezando por los IRREVERSIBLES (Borrar, Emitir; regla 29). NUNCA se
// toca `.btn-sm` en general (eso es lo que hacía peligroso este ticket: la clase la comparte toda
// la app). Mismo patrón opt-in que SCRUM-962 (`.job-toolbar-btn-44`): una clase nueva, aplicada
// botón a botón.
//
// Este fichero prueba TRES cosas, cada una por separado:
//  ① la clase nueva existe en el CSS con 44px y NO toca la regla global `.btn-sm` (30px).
//  ② los DOS botones irreversibles elegidos para este incremento —«Borrar» en Proveedores y
//     Plantillas, «Emitir» en el detalle del Albarán— la llevan puesta, EN EL DOM REAL (banco de
//     SCRUM-417, no el fuente).
//  ③ CONTROL: un botón hermano en el MISMO contenedor, que no es irreversible, NO la lleva. Sin
//     esto, un `classList.add` puesto en el sitio equivocado (todo el toolbar en vez de un botón)
//     pasaría igual de verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');

const botones = (contenedor) => todos(contenedor).filter((n) => n.tagName === 'BUTTON');

// ═══ ① EL CSS ═════════════════════════════════════════════════════════════════════════════

test('SCRUM-786 · SUELO: el fichero de estilos se lee entero', () => {
  assert.ok(CSS.length > 50000, '🔴 CIEGO: styles.css vino demasiado corto.');
});

test('SCRUM-786 · ① la clase opt-in existe, con 44px, UNA sola vez', () => {
  const veces = CSS.split('.accion-irreversible-btn-44 { min-height: 44px; }').length - 1;
  assert.equal(veces, 1,
    '🔴 falta (o está duplicada) `.accion-irreversible-btn-44 { min-height: 44px; }` en styles.css.');
});

test('SCRUM-786 · ① `.btn-sm` global SIGUE en 30px — no se tocó (eso es lo que hacía peligroso este ticket)', () => {
  assert.match(CSS, /\.btn\.btn-sm\s*\{\s*padding:\s*5px 12px;\s*font-size:\s*12\.5px;\s*min-height:\s*30px;\s*\}/,
    '🔴 la regla global de `.btn-sm` cambió — este ticket NO debía tocarla (regla del fundador, comentario 16266).');
});

// ═══ ② LOS DOS BOTONES, EN EL DOM REAL ══════════════════════════════════════════════════════

test('SCRUM-786 · ② «Borrar» proveedor lleva la clase de 44px, y «Editar»/«Activar» hermanos NO', async () => {
  const banco = cargarDashboard(RAIZ, {
    datos: (u) => {
      if (/\/admin\/merchant/.test(u)) return { id: 1 };
      if (/\/admin\/providers/.test(u)) {
        return { ok: true, items: [{ id: 5, name: 'ZZPROVEEDOR de prueba', phone: telefonoDePrueba(786), email: 'p@x.com', isActive: true }] };
      }
      return {};
    },
  });
  const r = await pintarVista(banco, 'renderProvidersView');
  assert.equal(r.error, null, `🔴 la lista de Proveedores revienta al abrirse: ${r.error && r.error.message}`);

  const bs = botones(r.contenedor);
  const borrar = bs.filter((b) => b.textContent === 'Borrar');
  assert.equal(borrar.length, 1,
    `🔴 SUELO: no encuentro exactamente un botón «Borrar» de proveedor (encontrados: ${borrar.length}). El fixture no llegó a pintar la fila.`);
  assert.ok(borrar[0].className.includes('accion-irreversible-btn-44'),
    `🔴 «Borrar» proveedor no lleva \`accion-irreversible-btn-44\` (className: "${borrar[0].className}").`);

  const hermanos = bs.filter((b) => b.textContent === 'Editar' || b.textContent === 'Desactivar' || b.textContent === 'Activar');
  assert.ok(hermanos.length > 0, '🔴 SUELO: no encuentro los botones hermanos de la misma fila (Editar/Activar-Desactivar).');
  for (const h of hermanos) {
    assert.ok(!h.className.includes('accion-irreversible-btn-44'),
      `🔴 CONTROL: «${h.textContent}» (no es irreversible) TAMBIÉN lleva la clase — se puso en todo el contenedor, no en el botón.`);
  }
});

// ⚠️ «Borrar» plantilla NO se mide por el banco: `templatesView.js` localiza su celda con
// `tr.querySelector('td:last-child')`, y el mini-DOM de `_banco-vistas.mjs:76` declara sin
// rodeos que las PSEUDOCLASES («:last-child» incluida) no las soporta — no es un hueco que abra
// este ticket, y arreglarlo es tocar infraestructura compartida de otros carriles. Se mide por
// FUENTE, anclado a la línea completa (no al nombre de la clase suelto, que casaría con
// cualquier mención) y con un control de que el ancla sabe decir que NO.
test('SCRUM-786 · ② «Borrar» plantilla lleva la clase de 44px en el fuente (el banco no soporta `:last-child`)', () => {
  const FUENTE = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/templatesView.js'), 'utf8');
  const ANCLA = "btnDel.className = 'btn-danger btn-sm accion-irreversible-btn-44';";
  assert.equal(FUENTE.split(ANCLA).length - 1, 1,
    `🔴 falta (o está duplicada) \`${ANCLA}\` en templatesView.js.`);
  // Control: el mismo hermano SIN la clase no casa por accidente.
  assert.equal("btnDel.className = 'btn-danger btn-sm';".split(ANCLA).length - 1, 0,
    '🔴 el ancla no discrimina: casa incluso sin la clase nueva puesta.');
  // Y los hermanos de la misma fila (Usar, Renombrar) NO se tocaron.
  assert.match(FUENTE, /btnUse\.className = 'btn-primary btn-sm';/,
    '🔴 CONTROL: «Usar» cambió de clase — el ticket no debía tocarlo.');
  assert.match(FUENTE, /btnRename\.className = 'btn-ghost btn-sm';/,
    '🔴 CONTROL: «Renombrar» cambió de clase — el ticket no debía tocarlo.');
});

test('SCRUM-786 · ② «Emitir» del albarán en borrador lleva la clase de 44px, y «Descargar PDF»/«Editar líneas» hermanos NO', async () => {
  const ALBARAN = Object.freeze({
    id: 77, jobId: 7, numero: 'ALB-786-1', estado: 'borrador', version: 1,
    fecha: '2026-09-01T09:00:00.000Z', modoValoracion: 'VALORADO',
    lineas: [{ concepto: 'ZZCONCEPTO prueba', cantidad: 1, unidad: 'ud', precioUnitario: 100, tipoIva: 21 }],
    totales: { base: 100, cuota: 21, total: 121 },
    notas: null, lugarEntrega: null, fechaEntrega: null,
    firmadoPorNombre: null, firmadoPorCalidad: null, firmadoAt: null,
    pdfUrl: '/admin/albaranes/77/pdf', facturado: false,
    customer: { id: 9, name: 'ZZCLIENTE prueba' },
  });
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (ruta) => {
    if (/\/admin\/albaranes\/77$/.test(ruta)) return ALBARAN;
    if (/\/admin\/jobs\/7$/.test(ruta)) return { id: 7, titulo: 'Trabajo', customer: ALBARAN.customer };
    return {};
  };

  const r = await pintarVista(banco, 'renderAlbaranDetailView', 77);
  assert.equal(r.error, null, `🔴 el detalle del albarán revienta al abrirse: ${r.error && r.error.message}`);

  const bs = botones(r.contenedor);
  const emitir = bs.filter((b) => b.dataset && b.dataset.accion === 'btnEmitir');
  assert.equal(emitir.length, 1,
    `🔴 SUELO: no encuentro exactamente un botón «Emitir» en el albarán en borrador (encontrados: ${emitir.length}). El registro de acciones no resolvió como se esperaba.`);
  assert.ok(emitir[0].className.includes('accion-irreversible-btn-44'),
    `🔴 «Emitir» no lleva \`accion-irreversible-btn-44\` (className: "${emitir[0].className}").`);

  const hermanos = bs.filter((b) => b.dataset && (b.dataset.accion === 'btnPdf' || b.dataset.accion === 'btnEditarLineas'));
  assert.ok(hermanos.length > 0, '🔴 SUELO: no encuentro los botones hermanos del mismo toolbar (btnPdf/btnEditarLineas).');
  for (const h of hermanos) {
    assert.ok(!h.className.includes('accion-irreversible-btn-44'),
      `🔴 CONTROL: «${h.dataset.accion}» (no es irreversible) TAMBIÉN lleva la clase — se puso en todo el toolbar, no en «Emitir».`);
  }
});
