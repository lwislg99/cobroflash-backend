// docs/master/evidencias/SCRUM-1560f/b-estados.mjs — SCRUM-1560f · ¿QUÉ ESTADOS NO PINTAN NADA CON LOS DATOS DE MUESTRA?
//
// POBLACIÓN: todas las `render*View` que publica el banco (`cargarDashboard`), montadas con
// `datosDelCenso()` y `ARGUMENTOS_DEL_CENSO`, como las montan sus consumidores; y, dentro de
// Configuración, cada panel con `data-submenu` (las pestañas), que es un ESTADO de la vista y no una
// vista. Por cada una: nodos pintados y controles (button/a/input/select/textarea/summary). El texto no:
// el mini-DOM no convierte en texto lo que se pinta con `innerHTML` (lo dice `scrum1559g`).
//
// Esto es el mini-DOM, sin maquetación: no da píxeles. «0 nodos» es «no pintó nada», que es lo que
// en el navegador mide 0 px; lo contrario no vale (un panel con nodos puede medir 0 px igual).
//
// CONTROL POSITIVO: Inicio tiene que pintar más de 20 nodos y la vista de Configuración tiene que
// tener al menos 5 paneles; si no, sale CIEGO (código 2).
//
//   node docs/master/evidencias/SCRUM-1560f/b-estados.mjs
import path from 'node:path';
import { cargarDashboard, pintarVista, todos } from '../../../../tests/_banco-vistas.mjs';
import { datosDelCenso, ARGUMENTOS_DEL_CENSO } from '../../../../scripts/_datos-del-censo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../../../..');
const CONTROLES = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

const b0 = cargarDashboard(RAIZ);
const vistas = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();

const filas = [];
let paneles = [];
for (const fn of vistas) {
  const dc = datosDelCenso();
  dc.enVista(fn);
  const r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || []));
  if (r.error) { filas.push({ fn, error: String(r.error.message || r.error).slice(0, 80) }); continue; }
  await esperar();
  const ns = todos(r.contenedor).slice(1);
  filas.push({ fn, nodos: ns.length, controles: ns.filter((n) => CONTROLES.has(n.tagName)).length, pedidas: dc.pedidasDe(fn) });
  if (fn === 'renderSettingsView') {
    paneles = ns.filter((n) => n.dataset && n.dataset.submenu && n.tagName !== 'BUTTON').map((p) => {
      const d = todos(p).slice(1);
      return { panel: p.dataset.submenu, nodos: d.length, controles: d.filter((n) => CONTROLES.has(n.tagName)).length };
    });
  }
}

const inicio = filas.find((f) => f.fn === 'renderHomeView');
if (!inicio || !(inicio.nodos > 20) || paneles.length < 5) {
  console.log(`CIEGO · Inicio: ${inicio ? inicio.nodos : 'no está'} nodos · paneles de Configuración: ${paneles.length}`);
  process.exit(2);
}

console.log(`POBLACIÓN · ${vistas.length} vistas del banco, montadas con datosDelCenso · ${paneles.length} paneles de Configuración`);
console.log('\nVISTAS (nodos · controles · peticiones):');
for (const f of filas) console.log(f.error ? `  ${f.fn}  REVIENTA: ${f.error}` : `  ${f.fn.padEnd(34)} ${String(f.nodos).padStart(5)} · ${String(f.controles).padStart(3)} · ${f.pedidas}`);
console.log('\nPANELES DE CONFIGURACIÓN (nodos · controles):');
for (const p of paneles) console.log(`  ${String(p.panel).padEnd(24)} ${String(p.nodos).padStart(5)} · ${String(p.controles).padStart(3)}`);
const vacias = filas.filter((f) => !f.error && f.nodos < 20).map((f) => `${f.fn} (${f.nodos})`);
const panelesVacios = paneles.filter((p) => p.controles === 0).map((p) => `${p.panel} (${p.nodos} nodos)`);
console.log(`\nVISTAS bajo 20 nodos: ${vacias.length ? vacias.join(', ') : 'ninguna'}`);
console.log(`PANELES sin ningún control: ${panelesVacios.length ? panelesVacios.join(', ') : 'ninguno'}`);
