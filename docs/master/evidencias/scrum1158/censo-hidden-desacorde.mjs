// docs/master/evidencias/scrum1158/censo-hidden-desacorde.mjs — SCRUM-1158
//
// ¿Cuántos elementos pinta el banco de vistas con la visibilidad EQUIVOCADA por `hidden`?
//
//   node docs/master/evidencias/scrum1158/censo-hidden-desacorde.mjs <raíz del árbol>
//
// Monta cada vista que publica el banco (`render*View`), con los MISMOS datos de muestra que
// `scripts/censo-objetivo-tactil-panel.mjs`, y compara, nodo a nodo, dos cosas:
//
//   · lo que diría el NAVEGADOR: si el producto asignó `el.hidden = x` por JS, manda `x` (la
//     asignación llega siempre después del marcado); si no, manda el atributo del marcado;
//   · lo que SERIALIZA `scripts/_pagina-panel.mjs`, que es lo que miden los guards de navegador:
//     `hidden` sale sólo si está en `_attrs`.
//
// Dos clases de desacuerdo, y no pesan igual:
//   · VISIBLE_DE_MAS — el producto lo oculta y el banco lo pinta: un guard acusa algo que no existe;
//   · OCULTO_DE_MAS  — el producto lo enseña y el banco lo oculta: un guard NO ve algo que existe.
//     Ésta es la que da VERDES HUECOS.
//
// Y cuántos INTERACTIVOS (el selector de `guard:objetivo-tactil`) caen dentro de cada subárbol mal
// pintado, porque ésos son los que el guard cuenta o deja de contar.
//
// ⚠️ Con el banco arreglado el desacuerdo es 0 por construcción (la propiedad ES el atributo): en el
// DESPUÉS este censo sólo prueba que el arreglo llegó a las vistas, no que los guards cambien. Eso
// se mide aparte, con `npm run censo:tactil-panel` antes y después.
//
// SUELO: si monta menos de 10 vistas, o la de Presupuestos (la del caso del ticket) no monta, sale 2.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.argv[2];
if (!raiz) { console.error('uso: censo-hidden-desacorde.mjs <raíz del árbol>'); process.exit(2); }
const imp = (r) => import(pathToFileURL(path.join(raiz, r)).href);
const { cargarDashboard, pintarVista, todos } = await imp('tests/_banco-vistas.mjs');
const { serializar, CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } = await imp('scripts/_pagina-panel.mjs');

// Copia de `DATOS` de `censo-objetivo-tactil-panel.mjs` (no está exportado): misma población.
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

const esInteractivo = (n) => {
  const t = n.tagName;
  const at = (k) => (n._attrs && Object.prototype.hasOwnProperty.call(n._attrs, k) ? n._attrs[k] : null);
  if (t === 'BUTTON' || t === 'SUMMARY') return true;
  if (t === 'A') return at('href') !== null || !!n.href;
  if (t === 'INPUT') return ['submit', 'button', 'checkbox'].includes(String(at('type') ?? n.type ?? ''));
  return at('role') === 'button';
};

/** Lo que diría el navegador. Una propiedad de DATOS propia = la asignó el producto por JS. */
const ocultoEnNavegador = (n) => {
  const d = Object.getOwnPropertyDescriptor(n, 'hidden');
  if (d && 'value' in d) return !!d.value;
  if (d && d.get) return !!n.hidden; // banco ya arreglado: la propiedad ES el atributo
  return !!(n._attrs && Object.prototype.hasOwnProperty.call(n._attrs, 'hidden'));
};
const ocultoSerializado = (n) => /^<[\w-]+(?:\s[^>]*)?\shidden(?:[\s=>])/.test(serializar(n).split('>')[0] + '>');

// CONTROL POSITIVO del detector de lo serializado: un nodo con el atributo TIENE que salir oculto y
// uno sin él, visible. Si no, el «0 desacuerdos» de abajo no significaría nada.
{
  const { nodo } = await imp('tests/_banco-vistas.mjs');
  const reg = { porId: new Map() };
  const si = nodo('span', reg); si.setAttribute('hidden', '');
  const no = nodo('span', reg);
  if (!ocultoSerializado(si) || ocultoSerializado(no)) { console.error('CIEGO: el detector de `hidden` serializado no distingue el control'); process.exit(2); }
  console.log('CONTROL POSITIVO · <span hidden> → oculto, <span> → visible: de acuerdo');
}

const b0 = cargarDashboard(raiz);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
const filas = [];
const noMontadas = [];
for (const fn of VISTAS) {
  let r;
  try { r = await pintarVista(cargarDashboard(raiz, { datos: DATOS }), fn, ...(ARGUMENTOS_DE_VISTA[fn] || [])); } catch (e) { noMontadas.push(fn); continue; }
  if (r.error) { noMontadas.push(fn); continue; }
  const nodos = todos(r.contenedor).filter((n) => n && n.tagName && n.tagName !== '#TEXT');
  if (nodos.length < 20) { noMontadas.push(fn); continue; }
  const fila = { fn, nodos: nodos.length, visibleDeMas: [], ocultoDeMas: [], interactivosAfectados: 0 };
  for (const n of nodos) {
    const nav = ocultoEnNavegador(n);
    const ser = ocultoSerializado(n);
    if (nav === ser) continue;
    const quien = `<${n.tagName.toLowerCase()}${n._id ? '#' + n._id : ''}${n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : ''}>`;
    (nav ? fila.visibleDeMas : fila.ocultoDeMas).push(quien);
    fila.interactivosAfectados += todos(n).filter((d) => d && d.tagName && esInteractivo(d)).length;
  }
  filas.push(fila);
}

console.log(`POBLACION · vistas que publica el banco: ${VISTAS.length} · montadas: ${filas.length} · no montadas: ${noMontadas.length} (${noMontadas.join(', ')})`);
const tot = { vm: 0, om: 0, ia: 0 };
for (const f of filas) {
  tot.vm += f.visibleDeMas.length; tot.om += f.ocultoDeMas.length; tot.ia += f.interactivosAfectados;
  if (!f.visibleDeMas.length && !f.ocultoDeMas.length) continue;
  console.log(`${f.fn} · ${f.nodos} nodos · VISIBLE_DE_MAS ${f.visibleDeMas.length} · OCULTO_DE_MAS ${f.ocultoDeMas.length} · interactivos dentro ${f.interactivosAfectados}`);
  for (const q of f.visibleDeMas) console.log(`   visible de más: ${q}`);
  for (const q of f.ocultoDeMas) console.log(`   oculto de más:  ${q}`);
}
const conDesacuerdo = filas.filter((f) => f.visibleDeMas.length + f.ocultoDeMas.length).length;
console.log(`TOTAL · vistas con desacuerdo ${conDesacuerdo} de ${filas.length} · VISIBLE_DE_MAS ${tot.vm} · OCULTO_DE_MAS ${tot.om} · interactivos dentro ${tot.ia}`);
let salida = 0;
if (filas.length < 10) { console.error(`CIEGO: sólo ${filas.length} vistas montadas`); salida = 2; }
if (!filas.some((f) => f.fn === 'renderQuotesView')) { console.error('CIEGO: no montó renderQuotesView, la del caso del ticket'); salida = 2; }
console.log(`EXIT=${salida}`);
process.exit(salida);
