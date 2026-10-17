// Sonda SCRUM-1559 · ¿qué pierde `serializar()` respecto del DOM del banco, y con qué criterio?
// Uso: node sonda-serializar.mjs <raiz-del-arbol>
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { serializar, paginaDeClientes, CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } = await imp('scripts/_pagina-panel.mjs');
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

// La etiqueta de apertura que emite el serializador PARA ESTE NODO (sin hijos).
function apertura(n) {
  const s = serializar(n);
  return s.slice(0, s.indexOf('>') + 1);
}
const attrsDe = (tag) => new Set([...tag.matchAll(/\s([\w:-]+)(?==|\s|>)/g)].map((m) => m[1].toLowerCase()));

const CAMPOS = ['href', 'name', 'src', 'title', 'placeholder', 'download', 'value', 'role', 'tabIndex', 'htmlFor', 'ariaLabel'];
const b0 = cargarDashboard(RAIZ);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();

const tot = {};
const porVista = [];
for (const fn of VISTAS) {
  let r;
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: DATOS }), fn, ...(ARGUMENTOS_DE_VISTA[fn] || [])); }
  catch (e) { porVista.push({ fn, nomonta: e.message.slice(0, 60) }); continue; }
  if (r.error) { porVista.push({ fn, nomonta: r.error.message.slice(0, 60) }); continue; }
  const nodos = todos(r.contenedor).filter((n) => n && n.tagName && n.tagName !== '#TEXT');
  if (nodos.length < 20) { porVista.push({ fn, nomonta: `${nodos.length} nodos` }); continue; }
  const fila = { fn, nodos: nodos.length, perdidos: {}, textoTapado: 0, aDom: 0, aHrefDom: 0, aHrefSer: 0, ejemplos: [] };
  for (const n of nodos) {
    const at = attrsDe(apertura(n));
    for (const c of CAMPOS) {
      const v = n[c];
      if (v === undefined || v === null || v === '' || v === false || (c === 'tabIndex' && (v === -1 || v === 0 && n._tabIndexNoPuesto))) continue;
      if (typeof v === 'function' || typeof v === 'object') continue;
      const nombreAttr = { tabIndex: 'tabindex', htmlFor: 'for', ariaLabel: 'aria-label' }[c] || c.toLowerCase();
      if (!at.has(nombreAttr)) {
        fila.perdidos[c] = (fila.perdidos[c] || 0) + 1;
        tot[c] = (tot[c] || 0) + 1;
        if (fila.ejemplos.length < 4) fila.ejemplos.push(`${n.tagName}.${c}=${String(v).slice(0, 30)}`);
      }
    }
    // `type` nacido del MARCADO: vive en `_attrs` y el serializador sólo lee el campo.
    if (n._attrs && n._attrs.type && !at.has('type')) {
      fila.perdidos['type(marcado)'] = (fila.perdidos['type(marcado)'] || 0) + 1;
      tot['type(marcado)'] = (tot['type(marcado)'] || 0) + 1;
      if (fila.ejemplos.length < 6) fila.ejemplos.push(`${n.tagName}[type=${n._attrs.type}]`);
    }
    // Texto propio TAPADO por hijos: el serializador emite hijos y descarta `_texto`/`_html`.
    if (n.hijos && n.hijos.length && n._texto && !n._html) fila.textoTapado++;
    if (n.tagName === 'A') { fila.aDom++; if (n.href || (n.getAttribute && n.getAttribute('href'))) fila.aHrefDom++; }
  }
  const html = serializar(r.contenedor);
  fila.aHrefSer = (html.match(/<a\s[^>]*\bhref=/g) || []).length;
  porVista.push(fila);
}

// CONTROL POSITIVO: un <a> con href puesto por MARCADO y otro por setAttribute tienen que salir;
// y uno con href por PROPIEDAD es el que se mide.
const bc = cargarDashboard(RAIZ);
const doc = bc.ctx.document;
const caja = doc.createElement('div');
caja.innerHTML = '<a href="/marcado">m</a>';
const a2 = doc.createElement('a'); a2.setAttribute('href', '/setattr'); a2.textContent = 's'; caja.appendChild(a2);
const a3 = doc.createElement('a'); a3.href = '/propiedad'; a3.textContent = 'p'; caja.appendChild(a3);
const ser = serializar(caja);
console.log('CONTROL:', ser);
console.log('  marcado sale:', ser.includes('/marcado'), '· setAttribute sale:', ser.includes('/setattr'), '· propiedad sale:', ser.includes('/propiedad'));

console.log('\nVISTA | nodos | <a> DOM | <a href> DOM | <a href> serializado | perdidos por campo | texto tapado | ejemplos');
for (const f of porVista) {
  if (f.nomonta) { console.log(`${f.fn} | NO MONTA: ${f.nomonta}`); continue; }
  console.log(`${f.fn} | ${f.nodos} | ${f.aDom} | ${f.aHrefDom} | ${f.aHrefSer} | ${JSON.stringify(f.perdidos)} | ${f.textoTapado} | ${f.ejemplos.join(', ')}`);
}
console.log('\nTOTAL perdidos por campo:', JSON.stringify(tot));
