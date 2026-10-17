// Sonda SCRUM-1559 · los nodos con texto PROPIO y además hijos: ¿qué texto se come el serializador?
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { serializar, CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } = await imp('scripts/_pagina-panel.mjs');
const { cargarDashboard, pintarVista, todos } = await imp('tests/_banco-vistas.mjs');
const DATOS = (url) => {
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
const b0 = cargarDashboard(RAIZ);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
const INTER = new Set(['A', 'BUTTON', 'SUMMARY', 'INPUT', 'LABEL']);
for (const fn of VISTAS) {
  let r;
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: DATOS }), fn, ...(ARGUMENTOS_DE_VISTA[fn] || [])); } catch { continue; }
  if (r.error) continue;
  const nodos = todos(r.contenedor).filter((n) => n && n.tagName && n.tagName !== '#TEXT');
  if (nodos.length < 20) continue;
  for (const n of nodos) {
    if (n._html && n._texto && String(n._html).trim() !== String(n._texto).trim()) {
      console.log(`RANCIO? ${fn} | ${n.tagName}.${String(n.className || '').split(' ')[0]} | hijos=${n.hijos.length} | _html=«${String(n._html).slice(0, 50).replace(/\s+/g, ' ')}» | _texto=«${n._texto.slice(0, 40)}»`);
    }
    if (!(n.hijos && n.hijos.length && n._texto)) continue;
    const ser = serializar(n);
    const sale = ser.includes(n._texto.slice(0, 12).replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    const dentroInter = (() => { let p = n; while (p) { if (INTER.has(p.tagName)) return p.tagName; p = p._padre; } return '-'; })();
    console.log(`${fn} | ${n.tagName}.${String(n.className || '').split(' ')[0]} | html=${n._html ? 'sí' : 'no'} | texto=«${n._texto.slice(0, 40)}» | hijos=${n.hijos.map((h) => h.tagName).join(',')} | sale=${sale} | interactivo=${dentroInter}`);
  }
}
