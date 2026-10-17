import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { serializar } = await imp('scripts/_pagina-panel.mjs');
const P = await imp('scripts/_pagina-panel.mjs');
const { cargarDashboard, pintarVista } = await imp('tests/_banco-vistas.mjs');
const M = await imp('scripts/_datos-del-censo.mjs');
const modo = process.argv[3];
const viejo = (url) => { const u = String(url || '');
  if (/\/admin\/customers\/\d+\/detail/.test(u)) return P.DETALLE_360_DE_MUESTRA;
  if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
  if (/\/admin\/customers/.test(u)) return P.CLIENTES_DE_MUESTRA;
  if (/\/admin\/products\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Grifo', price: 100, cost: 60, description: '', providerId: null, itemKind: null, active: true }] };
  if (/\/admin\/providers\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Proveedor QA', phone: '', email: '', notes: '' }] };
  if (/\/billing\/plans/.test(u)) return { plans: [], currentPlan: null, founding: null };
  if (/\/albaranes\//.test(u)) return { id: 1, estado: 'borrador', lines: [], items: [] };
  if (/\/admin\/jobs\//.test(u)) return P.TRABAJO_DE_MUESTRA;
  return []; };
const datos = modo === 'antes' ? viejo : M.datosDelCenso().datos;
const args = modo === 'antes' ? P.ARGUMENTOS_DE_VISTA : M.ARGUMENTOS_DEL_CENSO;
const b0 = cargarDashboard(RAIZ);
const V = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k)).sort();
let total = 0;
for (const fn of V) {
  const r = await pintarVista(cargarDashboard(RAIZ, { datos }), fn, ...(args[fn] || []));
  if (r.error || !r.contenedor) continue;
  const h = serializar(r.contenedor);
  const m = h.match(/\bundefined\b|\bNaN\b/g) || [];
  if (m.length) { total += m.length; console.log(fn, m.length, [...h.matchAll(/.{0,50}\b(undefined|NaN)\b.{0,20}/g)].slice(0, 3).map((x) => x[0]).join(' ‖ ')); }
}
console.log('TOTAL', total);