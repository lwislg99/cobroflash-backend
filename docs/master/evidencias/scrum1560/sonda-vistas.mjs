// Sonda SCRUM-1560 · cada vista del banco, montada con los datos de ANTES (el `DATOS` viejo del censo)
// y con los de AHORA (`_datos-del-censo.mjs`): nodos, error al montar, catch atrapados y rutas sin
// contrato. `node <sonda> <raíz-del-árbol> [antes|ahora]`.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const MODO = process.argv[3] || 'ahora';
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } = await imp('scripts/_pagina-panel.mjs');
const { cargarDashboard, pintarVista, todos } = await imp('tests/_banco-vistas.mjs');

let datos, args, dc = null;
if (MODO === 'antes') {
  datos = (url) => {
    const u = String(url || '');
    if (/\/admin\/customers\/\d+\/detail/.test(u)) return DETALLE_360_DE_MUESTRA;
    if (u.includes('/admin/merchant')) return { id: 1, name: 'Fontanería Soler' };
    if (/\/admin\/customers/.test(u)) return CLIENTES_DE_MUESTRA;
    if (/\/admin\/products\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Grifo', price: 100, cost: 60, description: '', providerId: null, itemKind: null, active: true }] };
    if (/\/admin\/providers\b/.test(u)) return { ok: true, items: [{ id: 1, name: 'Proveedor QA', phone: '', email: '', notes: '' }] };
    if (/\/billing\/plans/.test(u)) return { plans: [], currentPlan: null, founding: null };
    if (/\/albaranes\//.test(u)) return { id: 1, estado: 'borrador', lines: [], items: [] };
    if (/\/admin\/jobs\//.test(u)) return TRABAJO_DE_MUESTRA;
    return [];
  };
  args = ARGUMENTOS_DE_VISTA;
} else {
  const m = await imp('scripts/_datos-del-censo.mjs');
  dc = m.datosDelCenso();
  datos = dc.datos;
  args = m.ARGUMENTOS_DEL_CENSO;
}
const b0 = cargarDashboard(RAIZ);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
for (const fn of VISTAS) {
  if (dc) dc.enVista(fn);
  const b = cargarDashboard(RAIZ, { datos });
  let r;
  try { r = await pintarVista(b, fn, ...(args[fn] || [])); } catch (e) { console.log(`${fn.padEnd(30)} LANZA ${String(e.message).slice(0, 120)}`); continue; }
  const n = r.contenedor ? todos(r.contenedor).length : 0;
  const atr = b.reg.atrapados.map((a) => `${a.sitio}: ${a.mensaje.slice(0, 80)}`);
  console.log(`${fn.padEnd(30)} nodos ${String(n).padStart(4)} ${r.error ? '· ERROR ' + String(r.error.message).slice(0, 90) : ''}${atr.length ? ' · catch: ' + atr.join(' | ') : ''}`);
}
if (dc) {
  console.log(`\nSIN CONTRATO (${dc.sinContrato.size}):`);
  for (const [k, s] of dc.sinContrato) console.log(`  ${k} ← ${[...s].join(', ')}`);
}
