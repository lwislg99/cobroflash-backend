// scripts/_pagina-del-panel.mjs — SCRUM-782
//
// LA PÁGINA DEL PANEL PARA LOS GUARDS DE NAVEGADOR: una vista del dashboard, montada por su
// propio código y SERIALIZADA a HTML para poder servirla a un navegador de verdad.
//
// ── POR QUÉ ESTO Y NO CARGAR EL DASHBOARD ENTERO ────────────────────────────────────────────
// `public/dashboard/index.html` necesita sesión y API. Un guard que levante todo eso mide, sobre
// todo, la infraestructura. Aquí se monta la vista con el BANCO (`tests/_banco-vistas.mjs`, el
// mismo que usa la suite) y se serializa el árbol resultante: lo que llega al navegador es el
// marcado que produce el PRODUCTO, con el CSS del árbol, y sobre eso se mide.
//
// ⚠️ QUÉ NO ES: no es la pantalla en producción. No hay JS vivo en la página servida, así que
// esto NO puede medir comportamiento — sólo GEOMETRÍA (cajas y áreas de toque), que es
// exactamente para lo que lo usa `guard:objetivo-tactil`.
//
// `scripts/` importando de `tests/` no es nuevo: ya lo hacen `censo-internos-de-prisma`,
// `censo-tablero-vs-arbol` y `diagnostico-dependencias`.
import { cargarDashboard, pintarVista, todos } from '../tests/_banco-vistas.mjs';

const VACIO = new Set(['INPUT', 'IMG', 'BR', 'HR']);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** El árbol del mini-DOM a HTML. Conserva clases, ids, atributos, dataset y `style`. */
export function serializar(n) {
  if (!n || !n.tagName) return '';
  if (n.tagName === '#TEXT') return esc(n._texto || n.textContent || '');
  const t = n.tagName.toLowerCase();
  const at = [];
  if (n.className) at.push(`class="${esc(n.className)}"`);
  if (n._id) at.push(`id="${esc(n._id)}"`);
  if (n.type) at.push(`type="${esc(n.type)}"`);
  if (n.checked) at.push('checked');
  if (n.disabled) at.push('disabled');
  const css = (n.style && n.style.cssText) || '';
  const disp = (n.style && n.style.display) || '';
  const junto = [css, disp ? `display:${disp}` : ''].filter(Boolean).join(';');
  if (junto) at.push(`style="${esc(junto)}"`);
  for (const [k, v] of Object.entries(n._attrs || {})) {
    if (['class', 'id', 'type', 'style'].includes(k)) continue;
    at.push(`${esc(k)}="${esc(v)}"`);
  }
  for (const [k, v] of Object.entries(n.dataset || {})) {
    at.push(`data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${esc(v)}"`);
  }
  const abre = `<${t}${at.length ? ' ' + at.join(' ') : ''}>`;
  if (VACIO.has(n.tagName)) return abre;
  let dentro = '';
  if (n.hijos && n.hijos.length) dentro = n.hijos.map(serializar).join('');
  else if (n._html) dentro = n._html;
  else if (n._texto) dentro = esc(n._texto);
  return abre + dentro + `</${t}>`;
}

/**
 * Tres clientes con nombres de largo distinto: el corto y el largo estiran celdas distintas.
 *
 * 🔴 LOS TELÉFONOS VAN EN EL RANGO IMPOSIBLE `34 0XX XXX XXX` (SCRUM-262): ningún abonado español
 * empieza por 0, así que un dato de prueba nunca puede ser el número de alguien. La primera
 * versión usó números con pinta real y el guard de la casa la cazó — con razón.
 */
export const CLIENTES_DE_MUESTRA = [
  { id: 1, name: 'Administración de Fincas Soler y Asociados', phone: '34000000001', email: 'admin@fincassoler.es', notes: 'Portal 3, escalera B', tags: ['administrador'], createdAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Carmen Ruiz', phone: '34000000002', email: 'carmen@ejemplo.es', notes: '', tags: [], createdAt: '2026-02-20T10:00:00Z' },
  { id: 3, name: 'Comunidad de Propietarios Av. del Puerto 118', phone: '34000000003', email: 'cp118@ejemplo.es', notes: 'Factura a nombre de la comunidad', tags: ['moroso'], createdAt: '2026-03-05T10:00:00Z' },
];

/**
 * Monta `renderCustomersView` y devuelve `{ html, aviso }`.
 *
 * 🔴 SE SELECCIONA UNA FILA A PROPÓSITO. Con cero seleccionados la barra del móvil está en
 * `display:none`, y un guard que la midiera oculta sacaría 0×0 y lo llamaría defecto. Aquí se
 * pulsa una casilla con el mecanismo del producto para que la barra EXISTA cuando se mide.
 *
 * Si algo de esto no sale, se devuelve `aviso` y el llamador DECIDE — este módulo no traga.
 */
export async function paginaDeClientes(raiz, { extra = '' } = {}) {
  const banco = cargarDashboard(raiz, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/customers/.test(u)) return CLIENTES_DE_MUESTRA;
      if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
      return [];
    },
  });
  const r = await pintarVista(banco, 'renderCustomersView');
  if (r.error) return { html: null, aviso: 'la vista de clientes no monta: ' + r.error.message };
  const nodos = todos(r.contenedor);
  if (nodos.length < 40) return { html: null, aviso: `la vista montó ${nodos.length} nodos: está a medias` };

  const TODOS_LABEL = 'Seleccionar todos';
  const enTd = (x) => { let p = x._padre; while (p) { if (p.tagName === 'TD') return true; p = p._padre; } return false; };
  const filas = nodos.filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox'
    && n.getAttribute && n.getAttribute('aria-label') && n.getAttribute('aria-label') !== TODOS_LABEL && enTd(n));
  if (filas.length === 0) return { html: null, aviso: 'no hay casillas de fila que medir' };
  filas[0].checked = true;
  filas[0].disparar('change');

  return { html: serializar(r.contenedor) + extra, aviso: null, casillasDeFila: filas.length };
}
