// tests/scrum786d-albaran-pdf-y-lineas-44.test.mjs — SCRUM-786d
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// «DESCARGAR PDF» Y «EDITAR LÍNEAS» DE LA FICHA DEL ALBARÁN LLEGAN A 44 px.
//
// Hermano de SCRUM-786/962/1172/1142 (Borrar proveedor/plantilla, Emitir albarán, la ficha del
// Trabajo, Anular/Rectificar factura): mismo patrón, opt-in por botón, sin tocar `.btn-sm` global
// (`styles.css` es de S2; esta pantalla, `albaranDetailView.js`, es de S4).
//
// Re-medido el 19-oct-2026 con `censo:tactil-panel` tras el cambio a rejilla de 1206e
// (`docs/producto/ESTADO-DEL-PRODUCTO.md`, fila «2 controles táctiles de la ficha del albarán»,
// que quedó «NO CONSTA si siguen» a la espera de esta medida):
//                                 929 px   390 px
//   «Descargar PDF»               30,5     30,5
//   «Editar líneas»               30,5     30,5
// con el opt-in (`job-toolbar-btn-44`, ya en uso en SCRUM-962/1172): 44,5 en los dos anchos.
//
// Los dos sólo coinciden con «Emitir» en `borrador` (único estado de `ALBARAN_ACTION_REGISTRY`
// donde `btnPdf` y `btnEditarLineas` son `secundaria` a la vez): ésa es la fila que mide este test.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASE = 'job-toolbar-btn-44';

const ALB = Object.freeze({
  id: 46, numero: 'AB260001', estado: 'borrador', modoValoracion: 'SIN_VALORAR', estadoFacturacion: 'sin_facturar',
  quote: null, invoiceId: null, job: { id: 76, titulo: 'Trabajo QA', direccion: null }, customer: { name: 'Cliente QA' },
  pendientes: [], lineas: [{ concepto: 'Tubería', cantidad: 2 }],
  enviadoParaFirma: false, entregaParaFirmar: { estado: 'nunca_enviado', fallo: null, at: null }, firmaToken: null,
});

async function montar() {
  const banco = cargarDashboard(RAIZ, {
    red: {
      fetch: async (url) => ({
        ok: true, status: 200, statusText: '200', headers: { get: () => 'application/json' },
        json: async () => (/\/admin\/albaranes\/46$/.test(String(url)) ? ALB : []),
        text: async () => '', blob: async () => ({}),
      }),
      navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    },
  });
  banco.ctx.appModoEmision = 'fiscal';
  const r = await pintarVista(banco, 'renderAlbaranDetailView', ALB.id);
  assert.equal(r.error, null, `🔴 la ficha del albarán revienta al abrirse: ${r.error && r.error.message}`);
  const botones = todos(r.contenedor).filter((n) => n.tagName === 'BUTTON');
  return { botones };
}

const porAccion = (lista, id) => lista.filter((b) => b.dataset && b.dataset.accion === id);
const clases = (c) => String(c).trim().split(/\s+/).sort();

test('SCRUM-786d · SUELO: en `borrador` la ficha pinta «Emitir», «Descargar PDF» y «Editar líneas» juntos', async () => {
  const { botones } = await montar();
  assert.equal(porAccion(botones, 'btnEmitir').length, 1, '🔴 CIEGO: no está «Emitir».');
  assert.equal(porAccion(botones, 'btnPdf').length, 1, '🔴 CIEGO: no está «Descargar PDF».');
  assert.equal(porAccion(botones, 'btnEditarLineas').length, 1, '🔴 CIEGO: no está «Editar líneas».');
});

test('SCRUM-786d · «Descargar PDF» y «Editar líneas» llevan el opt-in de 44 px sobre sus clases de siempre', async () => {
  const { botones } = await montar();
  const [pdf] = porAccion(botones, 'btnPdf');
  const [lineas] = porAccion(botones, 'btnEditarLineas');
  assert.deepEqual(clases(pdf.className), clases(`btn-secondary btn-sm ${CLASE}`), `🔴 «Descargar PDF» tiene className "${pdf.className}".`);
  assert.deepEqual(clases(lineas.className), clases(`btn-secondary btn-sm ${CLASE}`), `🔴 «Editar líneas» tiene className "${lineas.className}".`);
});

test('SCRUM-786d · CONTROL: «Emitir» sigue con SU clase (irreversible), no con la de éstos', async () => {
  const { botones } = await montar();
  const [emitir] = porAccion(botones, 'btnEmitir');
  assert.ok(!String(emitir.className).includes(CLASE), `🔴 «Emitir» lleva también ${CLASE}: "${emitir.className}".`);
  assert.match(emitir.className, /\baccion-irreversible-btn-44\b/, `🔴 «Emitir» perdió su propia clase: "${emitir.className}".`);
});

test('SCRUM-786d · la regla del opt-in ya existe en `styles.css` (no se toca; es de S2) y `.btn-sm` global sigue en 30', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.match(css, /\.job-toolbar-btn-44\s*\{\s*min-height:\s*44px;\s*\}/, '🔴 falta la regla del opt-in (se esperaba ya existente, de SCRUM-962).');
  assert.match(css, /\.btn\.btn-sm \{[^}]*min-height: 30px;/, '🔴 se tocó `.btn-sm` global (SCRUM-352).');
});
