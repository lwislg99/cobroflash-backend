// tests/banco-scrum825/medir-pagina-por-modo.mjs — SCRUM-825 D1 (panel), medicion de la pregunta B
//
// Monta la PAGINA del documento suelto (renderDocumentoSueltoView, la misma que llama el router en
// `#invoices-new`) con cada valor de `appDocumentoSuelto` y cuenta que dice sobre la factura.
// Uso: node tests/banco-scrum825/medir-pagina-por-modo.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from '../_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const red = {
  navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  fetch: async (url) => {
    const u = String(url);
    let cuerpo = {};
    if (/\/admin\/customers/.test(u)) cuerpo = [{ id: 7, name: 'Cliente de prueba' }];
    else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR' };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  },
};
for (const modo of ['factura', 'no']) {
  const banco = cargarDashboard(RAIZ, { red });
  banco.ctx.appDocumentoSuelto = modo;
  banco.ctx.appMerchantId = 1;
  const r = await pintarVista(banco, 'renderDocumentoSueltoView');
  if (r.error) { console.log(modo, 'NO MONTA:', r.error.message); continue; }
  const dicen = new Set();
  for (const n of todos(r.contenedor)) for (const via of ['textContent', 'title']) {
    const v = n[via]; if (typeof v === 'string' && /factura/i.test(v) && v.trim().length < 80) dicen.add(v.trim());
  }
  console.log(`appDocumentoSuelto=${JSON.stringify(modo)} -> nodos=${todos(r.contenedor).length} · dice «factura» en:`, [...dicen]);
}
