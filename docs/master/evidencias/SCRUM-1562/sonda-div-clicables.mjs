// docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs — SCRUM-1562 (S3, 18-oct-2026)
//
//   node docs/master/evidencias/SCRUM-1562/sonda-div-clicables.mjs [raiz-del-arbol]
//
// ¿LOS ELEMENTOS NO NATIVOS QUE RECIBEN CLIC EN EL PANEL SE PUEDEN USAR CON TECLADO? SÓLO LEE.
//
// Monta cada `render*View` del banco de vistas con los datos del censo táctil (los de SCRUM-1560,
// con su argumento si es una ficha) y recorre su mini-DOM. Saca cada nodo que recibe clic —oyente
// guardado por el banco (`_oyentes`), atributo `onclick` o propiedad `onclick`— y que NO es un
// control nativo (button, a con href, input, select, textarea, summary, option, label). De cada uno
// imprime `tabindex`, `role`, oyentes de teclado (propios o de un antecesor), los controles nativos
// que lleva DENTRO (para ver si hay alternativa) y el FICHERO que define su handler: se busca el
// texto del handler en `public/`, línea a línea de la más larga a la más corta, hasta una que esté
// en un solo fichero. El dueño se saca después con `node scripts/carriles.mjs de <fichero>`.
//
// CONTROL: la actividad de Inicio (`DIV.activity-item`, homeView.js) tiene tabindex=0, role=button
// y keydown; si la sonda la sacara sin ellos, no sabría mirar.
//
// LO QUE NO VE: sólo el estado montado (sin modales ni pestañas abiertas); los oyentes puestos en
// `document` (el banco no los guarda); cuántas filas hay en producción (el patrón es por fila); el
// ancho (es el mismo DOM a cualquier ancho, y el CSS no da teclado); y si otra pantalla —el buscador
// global— abre esos detalles con teclado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'));
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const { cargarDashboard, pintarVista, todos } = await imp('tests/_banco-vistas.mjs');
const { datosDelCenso, ARGUMENTOS_DEL_CENSO } = await imp('scripts/_datos-del-censo.mjs');

const NATIVOS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'OPTION', 'LABEL']);
// Un <a> es nativo si lleva href, por atributo O por propiedad (el banco guarda `a.href = …` aparte).
const esNativo = (n) => NATIVOS.has(n.tagName) || (n.tagName === 'A' && ((n.getAttribute && n.getAttribute('href') != null) || !!n.href));
const attr = (n, k) => (n.getAttribute ? n.getAttribute(k) : null);
const oyentes = (n, t) => ((n._oyentes && n._oyentes[t]) || []);
const fuentes = [];
(function recorre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) recorre(p); else if (p.endsWith('.js')) fuentes.push([path.relative(RAIZ, p).replace(/\\/g, '/'), fs.readFileSync(p, 'utf8')]);
  }
})(path.join(RAIZ, 'public'));
const ficheroDe = (texto) => {
  const lineas = [...new Set(String(texto).split('\n').map((l) => l.trim()).filter((l) => l.length > 15))].sort((a, b) => b.length - a.length);
  let mejor = null;
  for (const l of lineas) {
    const quien = fuentes.filter(([, s]) => s.includes(l)).map(([f]) => f);
    if (quien.length === 1) return quien[0];
    if (quien.length > 1 && (!mejor || quien.length < mejor.length)) mejor = quien;
  }
  return mejor ? 'AMBIGUO: ' + mejor.join(' | ') : '(no encontrado)';
};
const dentroDeNativo = (n) => { let p = n._padre; while (p) { if (esNativo(p)) return true; p = p._padre; } return false; };
const teclasArriba = (n) => { let p = n._padre; while (p) { if (['keydown', 'keyup', 'keypress'].some((t) => oyentes(p, t).length)) return nombre(p); p = p._padre; } return null; };
const nombre = (n) => n.tagName + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).join('.') : '');
// `textContent` del banco devuelve sólo el texto propio: se junta el de los descendientes.
const textoDe = (n) => todos(n).map((x) => x._texto || '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 40);
const nativosDentro = (n) => todos(n).filter((x) => x !== n && x.tagName && esNativo(x)).map((x) => `${x.tagName}«${textoDe(x).slice(0, 18)}»`);

const b0 = cargarDashboard(RAIZ);
const vistas = Object.keys(b0.ctx).filter((k) => /^render[A-Z].*View$/.test(k) && typeof b0.ctx[k] === 'function').sort();
const filas = [];
let montadas = 0;
for (const fn of vistas) {
  const dc = datosDelCenso();
  dc.enVista(fn);
  let r;
  try { r = await pintarVista(cargarDashboard(RAIZ, { datos: dc.datos }), fn, ...(ARGUMENTOS_DEL_CENSO[fn] || [])); } catch (e) { console.log(`⚠️ ${fn} no monta: ${e.message.slice(0, 60)}`); continue; }
  if (r.error) { console.log(`⚠️ ${fn} no monta: ${String(r.error.message).slice(0, 60)}`); continue; }
  montadas++;
  for (const n of todos(r.contenedor)) {
    if (!n.tagName) continue;
    const clic = oyentes(n, 'click');
    const onclickAttr = attr(n, 'onclick');
    const onclickProp = typeof n.onclick === 'function' ? n.onclick : null;
    if (!clic.length && onclickAttr == null && !onclickProp) continue;
    if (esNativo(n)) continue;
    const src = String(clic[0] || onclickProp || onclickAttr);
    const tab = attr(n, 'tabindex') ?? (typeof n.tabIndex === 'number' ? String(n.tabIndex) : null);
    filas.push({
      vista: fn, el: nombre(n), texto: textoDe(n), tabindex: tab, role: attr(n, 'role'),
      teclas: ['keydown', 'keyup', 'keypress'].filter((t) => oyentes(n, t).length).join('+') || null,
      teclasArriba: teclasArriba(n), dentroDeNativo: dentroDeNativo(n), nativosDentro: nativosDentro(n),
      fichero: ficheroDe(src), raiz: n === r.contenedor, handler: src.replace(/\s+/g, ' ').slice(0, 160),
    });
  }
}
console.log(`vistas: ${vistas.length} · montadas: ${montadas} · elementos NO nativos con clic: ${filas.length}`);
for (const f of filas) console.log(JSON.stringify(f));
