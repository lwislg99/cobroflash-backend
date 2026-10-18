// tests/scrum1206d-un-solo-rotulo-en-el-rail.test.mjs — SCRUM-1206d
//
// En el rail de la ficha del albarán convivían DOS estilos de rótulo para filas del mismo nivel:
// TRABAJO, CLIENTE, DIRECCIÓN y FACTURACIÓN en versalitas (`.detail-total-label`) y Presupuesto,
// Observaciones y Fotos en gris y minúscula (`.detail-rail-etiqueta`). Medido en yaqu.app el
// 17-oct-2026 (albaranes #46 y #48, cuenta QA): 11,5 px / 700 / mayúsculas frente a 13 px / 400.
//
// ⚠️ La CAUSA no es un descuido de una fila: `DESIGN.md` no dice qué estilo de rótulo lleva un rail
// (define «Label» en MAYÚSCULAS para KPI, cabeceras de tabla y secciones del sidebar, y un rótulo de
// campo sin mayúsculas). Con la laguna, cada fila nueva copió la clase que tenía más a mano. La
// decisión de alinear la minoría con la mayoría es del ORQUESTADOR (17-oct-2026), no de una norma.
//
// Se pinta la pantalla de verdad con TODAS las filas que el rail sabe pintar y se exige que sus
// rótulos compartan UNA sola clase.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Las clases de rótulo que existen en el panel. Si mañana aparece otra, este detector no la ve:
// por eso el SUELO de abajo cuenta los rótulos esperados por su TEXTO, no por su clase.
const CLASES_DE_ROTULO = ['detail-total-label', 'detail-rail-etiqueta', 'detail-section-title'];

// Las ocho filas con rótulo que el rail pinta cuando hay dato para todas.
const ESPERADOS = ['Trabajo', 'Cliente', 'Dirección', 'Facturación', 'Pendiente de facturar', 'Presupuesto', 'Observaciones', 'Fotos'];

const ALBARAN = Object.freeze({
  id: 13, numero: 'AB260013', estado: 'emitido', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'parcial',
  quote: { id: 7, number: 7 }, invoiceId: null,
  job: { id: 1, titulo: 'Reforma baño', direccion: 'C/ Mayor, 3' }, customer: { name: 'Ana Ruiz' },
  pendientes: [{ pendiente: 1 }],
  docHeaderText: 'Acceso por el patio', notas: 'Se deja la llave de paso cerrada.',
  lineas: [{ concepto: 'Tubería', cantidad: 2 }],
});

function red(alb) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async (url) => {
      const u = String(url);
      if (/\/admin\/albaranes\/13$/.test(u)) return resp(200, alb);
      if (/\/admin\/albaranes\/13\/fotos$/.test(u)) return resp(200, [{ id: 501 }]);
      return resp(200, []);
    },
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

const clases = (n) => (typeof n.className === 'string' ? n.className.split(' ') : []);

test('SCRUM-1206d · todos los rótulos del rail del albarán llevan la MISMA clase', async () => {
  const banco = cargarDashboard(RAIZ, { red: red(ALBARAN) });
  banco.ctx.appModoEmision = 'fiscal';
  const v = await pintarVista(banco, 'renderAlbaranDetailView', ALBARAN.id);
  assert.ok(!v.error, `🔴 SUELO: la ficha no se pinta: ${v.error && v.error.message}`);
  // Las fotos llegan en una segunda petición, sin esperarla: se le da un turno para que pinte su fila.
  await new Promise((r) => setTimeout(r, 30));

  const nodos = todos(v.contenedor);
  const rail = nodos.find((n) => clases(n).includes('detail-rail'));
  assert.ok(rail, '🔴 SUELO: no encuentro el rail (`.detail-rail`) en la ficha');
  const rotulos = todos(rail)
    .filter((n) => clases(n).some((c) => CLASES_DE_ROTULO.includes(c)))
    .map((n) => ({ texto: n.textContent, clase: clases(n).filter((c) => CLASES_DE_ROTULO.includes(c)).join(' ') }));

  // SUELO: están TODAS las filas. Sin esto, un rail con una sola fila daría «una sola clase» siempre.
  assert.deepEqual(rotulos.map((r) => r.texto).sort(), [...ESPERADOS].sort(),
    '🔴 SUELO: el rail no pinta las ocho filas con rótulo; la comparación de clases no probaría nada');

  const distintas = [...new Set(rotulos.map((r) => r.clase))];
  assert.deepEqual(distintas, ['detail-total-label'],
    '🔴 conviven varios estilos de rótulo en el MISMO rail: '
    + rotulos.map((r) => `${r.texto} → ${r.clase}`).join(' · ')
    + '. Un rótulo nuevo del rail usa `CLASE_ROTULO_RAIL` (albaranDetailView.js), no la clase que haya más a mano.');
});
