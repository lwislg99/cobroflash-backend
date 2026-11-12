// Sólo GET: qué partes de la cuenta QA siguen editables. Imprime id, estado y si se puede tocar.
import { abrir } from './lib.mjs';
const s = await abrir(1280, 800);
await s.page.goto('https://yaqu.app/dashboard/', { waitUntil: 'networkidle' });
const r = await s.page.evaluate(async () => {
  const me = await fetch('/admin/me', { credentials: 'include' }).then((x) => x.json()).catch(() => null);
  const out = { merchantId: me && (me.merchantId || (me.merchant && me.merchant.id)), partes: [] };
  for (const ruta of ['/admin/partes', '/admin/jobs']) {
    const x = await fetch(ruta, { credentials: 'include' });
    out[ruta] = x.status;
    if (x.ok && ruta === '/admin/partes') {
      const j = await x.json();
      const lista = Array.isArray(j) ? j : (j.partes || j.items || j.data || []);
      out.partes = lista.map((p) => ({ id: p.id, estado: p.estado, jobId: p.jobId }));
    }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
for (const p of r.partes.slice(0, 20)) {
  const d = await s.page.evaluate(async (id) => {
    const x = await fetch('/admin/partes/' + id, { credentials: 'include' });
    if (!x.ok) return { id, http: x.status };
    const j = await x.json();
    return { id, estado: j.estado, editable: !!(j.puedeEditarContenido && j.puedeEditarContenido.ok), lineas: (j.lineas || []).length };
  }, p.id);
  console.log(JSON.stringify(d));
}
console.log(s.log.join('\n'));
await s.browser.close();
