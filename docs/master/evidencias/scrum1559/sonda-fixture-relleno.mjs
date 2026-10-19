// Sonda SCRUM-1559 · ¿qué rutas le piden las vistas al banco del censo, y cuáles caen en el `return []`
// de relleno? Una respuesta que el servidor nunca daría mide una pantalla que no existe.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } = await imp('scripts/_pagina-panel.mjs');
const { cargarDashboard, pintarVista, todos } = await imp('tests/_banco-vistas.mjs');
let vista = '';
const relleno = new Map();
const servidas = new Map();
const anota = (m, u) => { const k = u.replace(/\d+/g, ':n').split('?')[0]; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(vista); };
const DATOS = (url) => {
  const u = String(url || '');
  if (/\/admin\/customers\/\d+\/detail/.test(u)) { anota(servidas, u); return DETALLE_360_DE_MUESTRA; }
  if (u.includes('/admin/merchant')) { anota(servidas, u); return { id: 1, name: 'Fontanería Soler' }; }
  if (/\/admin\/customers/.test(u)) { anota(servidas, u); return CLIENTES_DE_MUESTRA; }
  if (/\/admin\/products\b/.test(u)) { anota(servidas, u); return { ok: true, items: [] }; }
  if (/\/admin\/providers\b/.test(u)) { anota(servidas, u); return { ok: true, items: [] }; }
  if (/\/billing\/plans/.test(u)) { anota(servidas, u); return { plans: [], currentPlan: null, founding: null }; }
  if (/\/albaranes\//.test(u)) { anota(servidas, u); return { id: 1, estado: 'borrador', lines: [], items: [] }; }
  if (/\/admin\/jobs\//.test(u)) { anota(servidas, u); return TRABAJO_DE_MUESTRA; }
  anota(relleno, u || '(sin url)');
  return [];
};
const b0 = cargarDashboard(RAIZ);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
const montan = [];
for (const fn of VISTAS) {
  vista = fn;
  let r;
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: DATOS }), fn, ...(ARGUMENTOS_DE_VISTA[fn] || [])); } catch { continue; }
  if (!r.error && todos(r.contenedor).length >= 20) montan.push(fn);
}
// CONTROL: una ruta servida a propósito tiene que salir en «servidas», y una inventada en «relleno».
vista = '(control)'; DATOS('/admin/customers'); DATOS('/admin/ruta-que-no-existe-1559');
console.log(`vistas: ${VISTAS.length} · montan ≥20 nodos: ${montan.length}`);
console.log(`control · servida vista: ${servidas.has('/admin/customers')} · inventada en relleno: ${relleno.has('/admin/ruta-que-no-existe-:n')}`);
console.log(`\nRUTAS QUE RECIBEN EL RELLENO \`[]\` (${relleno.size}):`);
for (const [k, s] of [...relleno].sort()) console.log(`  ${k}  ←  ${[...s].filter((v) => v !== '(control)').join(', ')}`);
console.log(`\nRUTAS SERVIDAS CON FIXTURE (${servidas.size}):`);
for (const [k, s] of [...servidas].sort()) console.log(`  ${k}  ←  ${[...s].filter((v) => v !== '(control)').join(', ')}`);
