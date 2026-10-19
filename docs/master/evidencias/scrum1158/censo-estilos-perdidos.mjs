// docs/master/evidencias/scrum1158/censo-estilos-perdidos.mjs — SCRUM-1158, segunda cara (c.17197)
//
// ¿Cuántas declaraciones de estilo EN LÍNEA tiene el producto en el mini-DOM del banco que
// `serializar` (`scripts/_pagina-panel.mjs`) NO emite?
//
//   node docs/master/evidencias/scrum1158/censo-estilos-perdidos.mjs <raíz del árbol>
//
// `serializar` escribe `style="<cssText>;display:<display>"` y se salta `_attrs.style`. Pero el
// banco NO mantiene `cssText`: un `style="min-height:44px"` del marcado se reparte en propiedades
// sueltas (`setAttribute`, SCRUM-1038) y un `el.style.minHeight = '44px'` por JS también. Las dos
// cosas llegan a `.style` y ninguna a la página que mide el navegador.
//
// Para cada vista que monta el banco (mismos datos que `censo-hidden-desacorde.mjs`), y cada nodo,
// una declaración está PERDIDA si `.style[prop]` tiene valor y la regla `prop:valor` no aparece en el
// `style="…"` que emite `serializar` para ese nodo. Se separa por origen (marcado / JS) y por
// propiedad, y se cuentan los INTERACTIVOS (selector de `guard:objetivo-tactil`) que la llevan o que
// están dentro de un nodo que la lleva, porque ésos son los que el censo táctil mide.
//
// CONTROL POSITIVO: un nodo con `style.minHeight = '44px'` TIENE que salir perdido con el `serializar`
// de hoy, o sale 2. SUELO: menos de 10 vistas montadas, sale 2.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.argv[2];
if (!raiz) { console.error('uso: censo-estilos-perdidos.mjs <raíz del árbol>'); process.exit(2); }
const imp = (r) => import(pathToFileURL(path.join(raiz, r)).href);
const { cargarDashboard, pintarVista, todos, nodo } = await imp('tests/_banco-vistas.mjs');
const { serializar, CLIENTES_DE_MUESTRA, DETALLE_360_DE_MUESTRA, TRABAJO_DE_MUESTRA, ARGUMENTOS_DE_VISTA } = await imp('scripts/_pagina-panel.mjs');

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

const NO_SON_DECLARACION = new Set(['cssText', 'setProperty', 'getPropertyValue', 'removeProperty']);
const guion = (p) => p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const estiloEmitido = (n) => {
  const abre = serializar(n).split('>')[0];
  const m = abre.match(/\sstyle="([^"]*)"/);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
};
/** Las declaraciones de `.style` que no llegan a lo serializado: [{ prop, valor, origen }]. */
const perdidas = (n, emitir = estiloEmitido) => {
  if (!n.style) return [];
  const emitido = emitir(n).replace(/\s+/g, '');
  const delMarcado = new Set();
  for (const decl of String((n._attrs && n._attrs.style) || '').split(';')) {
    const i = decl.indexOf(':'); if (i === -1) continue;
    delMarcado.add(decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
  }
  const out = [];
  for (const [prop, valor] of Object.entries(n.style)) {
    if (NO_SON_DECLARACION.has(prop) || typeof valor !== 'string' || valor === '') continue;
    if (emitido.includes(`${guion(prop)}:${valor.replace(/\s+/g, '')}`)) continue;
    out.push({ prop: guion(prop), valor, origen: delMarcado.has(prop) ? 'marcado' : 'js' });
  }
  return out;
};

// CONTROL POSITIVO del DETECTOR, independiente del `serializar` que se mida: con un emisor que no
// emite nada, una declaración puesta TIENE que salir perdida; sin declaraciones, ninguna. Y se
// imprime qué hace con ese mismo nodo el `serializar` del árbol medido (antes: 1; después: 0).
{
  const reg = { porId: new Map() };
  const c = nodo('button', reg); c.style.minHeight = '44px';
  const m = nodo('button', reg); m.setAttribute('style', 'min-height:44px');
  const v = nodo('button', reg);
  const mudo = () => '';
  if (perdidas(c, mudo).length !== 1 || perdidas(m, mudo).length !== 1 || perdidas(v, mudo).length !== 0) {
    console.error('CIEGO: el detector no ve el control (min-height por JS y por marcado)'); process.exit(2);
  }
  console.log(`CONTROL POSITIVO · emisor mudo: JS 1 perdida, marcado 1, sin estilo 0 — de acuerdo · con el serializar de este árbol: JS ${perdidas(c).length}, marcado ${perdidas(m).length}`);
}

const b0 = cargarDashboard(raiz);
const VISTAS = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
const filas = [];
const noMontadas = [];
const porProp = new Map();
for (const fn of VISTAS) {
  let r;
  try { r = await pintarVista(cargarDashboard(raiz, { datos: DATOS }), fn, ...(ARGUMENTOS_DE_VISTA[fn] || [])); } catch { noMontadas.push(fn); continue; }
  if (r.error) { noMontadas.push(fn); continue; }
  const nodos = todos(r.contenedor).filter((n) => n && n.tagName && n.tagName !== '#TEXT');
  if (nodos.length < 20) { noMontadas.push(fn); continue; }
  const fila = { fn, nodos: nodos.length, nodosConPerdida: 0, decl: 0, marcado: 0, js: 0, interactivosTocados: new Set(), detalle: [] };
  for (const n of nodos) {
    const p = perdidas(n);
    if (!p.length) continue;
    fila.nodosConPerdida++;
    for (const d of p) {
      fila.decl++; fila[d.origen]++;
      porProp.set(d.prop, (porProp.get(d.prop) || 0) + 1);
    }
    for (const d of todos(n)) if (d && d.tagName && esInteractivo(d)) fila.interactivosTocados.add(d);
    const quien = `<${n.tagName.toLowerCase()}${n._id ? '#' + n._id : ''}${n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : ''}>`;
    fila.detalle.push(`${quien} ${p.map((d) => `${d.prop}:${d.valor} (${d.origen})`).join('; ')}`);
  }
  filas.push(fila);
}

console.log(`POBLACION · vistas que publica el banco: ${VISTAS.length} · montadas: ${filas.length} · no montadas: ${noMontadas.length} (${noMontadas.join(', ')})`);
const tot = { nodos: 0, decl: 0, marcado: 0, js: 0, inter: 0 };
for (const f of filas) {
  tot.nodos += f.nodosConPerdida; tot.decl += f.decl; tot.marcado += f.marcado; tot.js += f.js; tot.inter += f.interactivosTocados.size;
  if (!f.decl) continue;
  console.log(`${f.fn} · ${f.nodos} nodos · ${f.nodosConPerdida} con pérdida · ${f.decl} declaraciones (marcado ${f.marcado}, js ${f.js}) · interactivos que la llevan o están dentro ${f.interactivosTocados.size}`);
  for (const d of f.detalle) console.log(`   ${d}`);
}
console.log(`POR PROPIEDAD · ${[...porProp].sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p} ${c}`).join(' · ')}`);
const conPerdida = filas.filter((f) => f.decl).length;
console.log(`TOTAL · vistas con pérdida ${conPerdida} de ${filas.length} · nodos ${tot.nodos} · declaraciones ${tot.decl} (marcado ${tot.marcado}, js ${tot.js}) · interactivos tocados ${tot.inter}`);
let salida = 0;
if (filas.length < 10) { console.error(`CIEGO: sólo ${filas.length} vistas montadas`); salida = 2; }
console.log(`EXIT=${salida}`);
process.exit(salida);
