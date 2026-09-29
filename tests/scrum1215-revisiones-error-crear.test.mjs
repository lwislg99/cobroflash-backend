// tests/scrum1215-revisiones-error-crear.test.mjs — SCRUM-1215, lote 4 (revisiones del presupuesto)
//
// `errorCrear` («No se ha podido crear la revisión. Vuelve a intentarlo.») está FIRMADO desde
// SCRUM-688 y NO SE PINTABA NUNCA: `cablearCrearRevision` solo lo usaba si `e.message` venía
// vacío, y el `apiRequest` real SIEMPRE lanza con mensaje — `API 500: internal_error` si el
// servidor no manda uno, o el del navegador (`Failed to fetch`, en inglés) si no hay red. El
// profesional leía la tripa del sistema en lugar del texto aprobado (SCRUM-1215 c.17371).
//
// Condición del orquestador (GO sobre c.17371): el mensaje del servidor se pinta SOLO cuando viene
// en `data.message` —un mensaje escrito para una persona—; todo lo demás cae en `errorCrear`.
//
// Se mide el VIAJE: ficha montada en el banco, clic en «Crear revisión», la respuesta pasa por el
// `apiRequest` REAL de `api.js` (el banco solo pone el `fetch`), y se lee el aviso pintado.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APROBADO = 'No se ha podido crear la revisión. Vuelve a intentarlo.';

const UNA = [
  { id: 1, revision: 0, numero: 'P7', status: 'sent', firmado: false, total: '100.00', createdAt: '2026-09-20T10:00:00.000Z', vigente: true },
];
const presupuesto = {
  id: 1, number: 7, quoteNumber: 7, revision: 0, numeroConRevision: 'P7', revisiones: UNA, vigenteId: 1,
  status: 'sent', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1215', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
};

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300, status, statusText: status === 500 ? 'Internal Server Error' : 'Conflict',
  headers: { get: () => 'application/json' },
  json: async () => cuerpo,
  blob: async () => ({}), text: async () => JSON.stringify(cuerpo),
});

/** `alPost` decide qué contesta el servidor al POST de la revisión. */
async function avisoTrasCrear(alPost) {
  const posts = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? presupuesto : []),
    red: {
      fetch: async (url, opts) => {
        const u = String(url);
        const metodo = String((opts && opts.method) || 'GET').toUpperCase();
        if (metodo === 'POST' && /\/admin\/quotes\/\d+\/revisiones$/.test(u)) { posts.push(u); return alPost(); }
        return respuesta(200, /\/admin\/quotes\/1$/.test(u) ? presupuesto : []);
      },
    },
  });
  banco.ctx.appUserRole = 'admin';
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
  const btn = todos(r.contenedor).filter((n) => attr(n, 'data-revision-crear') != null);
  assert.equal(btn.length, 1, 'CIEGO: el admin no ve «Crear revisión»; no hay viaje que medir');
  btn[0].click();
  await new Promise((ok) => setTimeout(ok, 60));
  assert.equal(posts.length, 1, 'CIEGO: el clic no llegó a hacer el POST');
  const avisos = todos(r.contenedor).filter((n) => attr(n, 'data-revision-error') === '1');
  assert.equal(avisos.length, 1, `CIEGO: se esperaba UN aviso de error tras el fallo; hay ${avisos.length}`);
  return avisos[0].textContent;
}

test('SCRUM-1215 · 🔴 un 500 SIN mensaje pinta el texto firmado, no «API 500: internal_error»', async () => {
  const t = await avisoTrasCrear(() => respuesta(500, { error: 'internal_error' }));
  assert.equal(t, APROBADO);
});

test('SCRUM-1215 · 🔴 sin red pinta el texto firmado, no el del navegador', async () => {
  const t = await avisoTrasCrear(() => { throw new TypeError('Failed to fetch'); });
  assert.equal(t, APROBADO);
});

test('SCRUM-1215 · un rechazo con `message` humano del servidor se enseña TAL CUAL', async () => {
  // Es el caso de `RevisionNoCreable` (quotesAdmin.routes.ts): el motivo lo escribe el dominio.
  const motivo = 'Un presupuesto sin número no tiene una serie de la que ser revisión.';
  const t = await avisoTrasCrear(() => respuesta(409, { error: 'quote_sin_numero', message: motivo }));
  assert.equal(t, motivo);
});
