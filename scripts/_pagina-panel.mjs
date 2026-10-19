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

// 🔴 SCRUM-1559 · EL BANCO GUARDA CADA DATO EN DOS SITIOS, y esto leía cada uno de UNO solo. Un
// atributo reflejado puesto por PROPIEDAD (`a.href = …`) vive en el campo y no en `_attrs`, así que
// no salía: el censo selecciona `a[href]` y 18 enlaces de 5 vistas eran invisibles (Informes 5 de 5,
// Clientes 10 de 10). Son los reflejados del banco (`REFLEJADOS` en `tests/_banco-vistas.mjs`) que
// no tienen ya su línea aquí, más `htmlFor`. Si están los dos, manda `_attrs`, como hasta hoy: el
// banco no sabe cuál se escribió el último. `value` NO va: en el navegador la propiedad no es el
// atributo, y para la geometría no cuenta.
const REFLEJADOS_POR_PROPIEDAD = [['href', 'href'], ['src', 'src'], ['name', 'name'], ['title', 'title'],
  ['placeholder', 'placeholder'], ['download', 'download'], ['htmlFor', 'for']];

/** El árbol del mini-DOM a HTML. Conserva clases, ids, atributos, dataset y `style`. */
export function serializar(n) {
  if (!n || !n.tagName) return '';
  if (n.tagName === '#TEXT') return esc(n._texto || n.textContent || '');
  const t = n.tagName.toLowerCase();
  const attrs = n._attrs || {};
  const at = [];
  if (n.className) at.push(`class="${esc(n.className)}"`);
  if (n._id) at.push(`id="${esc(n._id)}"`);
  // SCRUM-1559 · el `type` del MARCADO vive en `_attrs` y no en el campo: `<input type="checkbox">`
  // salía `<input>`, un cuadro de texto (las 9 casillas de Exportar).
  const tipo = n.type || attrs.type;
  if (tipo) at.push(`type="${esc(tipo)}"`);
  for (const [campo, nombre] of REFLEJADOS_POR_PROPIEDAD) {
    const v = n[campo];
    if (typeof v === 'string' && v !== '' && !Object.prototype.hasOwnProperty.call(attrs, nombre)) at.push(`${nombre}="${esc(v)}"`);
  }
  if (n.checked) at.push('checked');
  if (n.disabled) at.push('disabled');
  // 🔴 SCRUM-1158 (cara 2) · antes salían sólo `cssText` y `display`. Pero el banco NO mantiene
  // `cssText`: un `style="min-height:44px"` del marcado se reparte en propiedades sueltas
  // (`setAttribute`, SCRUM-1038) y un `el.style.minHeight` por JS también, y ninguna llegaba a la
  // página. Medido sobre f4910603: 876 declaraciones perdidas en 16 de 18 vistas, 824 del MARCADO
  // (`docs/master/evidencias/scrum1158/censo-estilos-perdidos.mjs`). Ahora sale cada propiedad.
  const decl = [];
  for (const [k, v] of Object.entries(n.style || {})) {
    if (k === 'cssText' || typeof v !== 'string' || v === '') continue;
    decl.push(`${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v}`);
  }
  const junto = [(n.style && n.style.cssText) || '', ...decl].filter(Boolean).join(';');
  if (junto) at.push(`style="${esc(junto)}"`);
  for (const [k, v] of Object.entries(attrs)) {
    if (['class', 'id', 'type', 'style'].includes(k)) continue;
    at.push(`${esc(k)}="${esc(v)}"`);
  }
  for (const [k, v] of Object.entries(n.dataset || {})) {
    at.push(`data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${esc(v)}"`);
  }
  const abre = `<${t}${at.length ? ' ' + at.join(' ') : ''}>`;
  if (VACIO.has(n.tagName)) return abre;
  let dentro = '';
  // SCRUM-1559 · texto propio Y hijos (`btn.textContent = 'Nuevo cliente'; btn.appendChild(kbd)`, o
  // `<p>Tu plan incluye <strong>…</strong>` del marcado): salen los dos, el texto delante, que es
  // donde lo deja el navegador. Antes salía sólo el hijo y el CTA de Clientes se medía como «N».
  // Con `_html` puesto NO: ahí `_texto` puede ser de antes del `innerHTML` (medido: 0 casos hoy).
  if (n.hijos && n.hijos.length) dentro = (n._texto && !n._html ? esc(n._texto) : '') + n.hijos.map(serializar).join('');
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
//
// 🔴 SCRUM-1560d · CON LA FORMA DEL SERVIDOR. Cada fila lleva TODAS las claves de
// `CUSTOMER_SELECT_NO_TOKEN` (`src/modules/system/customerAdmin.ts`, el `select` de `listCustomers`),
// a su valor de «no declarado». Hasta SCRUM-1560d llevaba siete. Y Carmen Ruiz tenía `tags: []`, que el servidor
// no puede devolver: `normalizarTags` convierte la lista vacía en `null` («no se declararon»).
// Las tres opcionales (`ultimaVisita`, `saldoPendiente`, `garantiaRetenida`) faltan a propósito: el
// servidor las OMITE cuando no hay, y ausente no es cero.
const clienteDelServidor = (c) => ({
  merchantId: 1, mobile: null, legalName: null, taxId: null, waOptOut: false, updatedAt: c.createdAt,
  contactKind: null, companyId: null, tipoDestinatario: null, billingPeriodicity: 'NINGUNA',
  recargoEquivalencia: null, dtoPorDefecto: null, billingAddress: null, billingCity: null,
  billingPostalCode: null, billingProvince: null, billingCountry: null, internalRef: null,
  ...c,
});
export const CLIENTES_DE_MUESTRA = [
  clienteDelServidor({ id: 1, name: 'Administración de Fincas Soler y Asociados', phone: '34000000001', email: 'admin@fincassoler.es', notes: 'Portal 3, escalera B', tags: ['administrador'], createdAt: '2026-01-15T10:00:00Z' }),
  clienteDelServidor({ id: 2, name: 'Carmen Ruiz', phone: '34000000002', email: 'carmen@ejemplo.es', notes: '', tags: null, createdAt: '2026-02-20T10:00:00Z' }),
  clienteDelServidor({ id: 3, name: 'Comunidad de Propietarios Av. del Puerto 118', phone: '34000000003', email: 'cp118@ejemplo.es', notes: 'Factura a nombre de la comunidad', tags: ['moroso'], createdAt: '2026-03-05T10:00:00Z' }),
];

// ═══ SCRUM-795 · EL DETALLE DE LA FICHA 360 ═══════════════════════════════════════════════════
//
// La 360 pide `/admin/customers/:id/detail` y DESESTRUCTURA seis cosas de la respuesta; servirle
// la lista de arriba la revienta en `invoices[0]` y mediría una pantalla que no existe. El cliente
// NO se inventa otra vez: es el primero de `CLIENTES_DE_MUESTRA` —una copia a mano de un fixture
// es la avería que este repo ya conoce (tres listas de zona roja que habían derivado)—.
//
// Vive aquí y no dentro del guard porque lo usan DOS instrumentos: `guard-objetivo-tactil` (que
// vigila) y `censo-objetivo-tactil-panel` (que cuenta). Si cada uno llevara el suyo, el día que
// uno cambie el número del censo y el veredicto del guard dejarían de hablar de la misma pantalla.
//
// 🔴 SCRUM-1560d · CON LA FORMA DE `GET /admin/customers/:id/detail` (`customersAdmin.routes.ts`).
// El `select` del cliente de la 360 NO es el de la lista: no lleva `merchantId`, `updatedAt`,
// `recargoEquivalencia` ni `dtoPorDefecto`, y sí `portalToken` y `portalUrl`. Se DERIVA del primero
// de la lista quitando y poniendo, no se copia. Sin portal (`null`): como hasta hoy, que no lo traía.
// Los importes de `quotes` e `invoices` son `Decimal` en la base y viajan como TEXTO; `acceptedAt` y
// `paidAt` viajan siempre. `stats` lleva sus ocho cifras y cuadran con las listas (hasta SCRUM-1560d
// decía 3 presupuestos y servía 1). `events` son filas de `CustomerEvent` tal cual.
const { merchantId: _m, updatedAt: _u, recargoEquivalencia: _r, dtoPorDefecto: _d, ...CLIENTE_360 } = CLIENTES_DE_MUESTRA[0];
export const DETALLE_360_DE_MUESTRA = Object.freeze({
  customer: { ...CLIENTE_360, portalToken: null, portalUrl: null },
  quotes: [{ id: 11, quoteNumber: 'P-2026-0011', status: 'accepted', total: '1234.56', currency: 'EUR', createdAt: '2026-04-02T09:00:00.000Z', acceptedAt: '2026-04-02T10:00:00.000Z' }],
  invoices: [{ id: 21, number: 'F-2026-0021', status: 'paid', total: '999.99', currency: 'EUR', createdAt: '2026-04-09T09:00:00.000Z', paidAt: '2026-04-10T09:00:00.000Z', pdfUrl: '/x.pdf' }],
  stats: { totalQuotes: 1, acceptedQuotes: 1, totalBilled: 999.99, totalPaid: 999.99, totalPending: 0, pendingCount: 0, totalExpenses: 0, profit: 999.99 },
  events: [{ id: 1, merchantId: 1, customerId: 1, type: 'quote_accepted', title: 'Presupuesto aceptado', detail: 'P-2026-0011', meta: null, createdAt: '2026-04-02T10:00:00.000Z' }],
});

// ═══ SCRUM-848 · EL TRABAJO DE MUESTRA, Y POR QUÉ HACÍA FALTA ════════════════════════════════
//
// Hasta hoy la ficha de Trabajo se montaba con lo que el banco devuelve por defecto: `{}` en el
// guard y `[]` en el censo. O sea, **un Trabajo SIN `status`** — un objeto que el producto no puede
// producir: `Job.status` tiene `@default("pendiente_agendar")` en el esquema.
//
// Eso pasó desapercibido mientras `jobNextAction` caía al nivel 5 con cualquier estado. SCRUM-823
// le puso la puerta `JOB_ESTADOS_CON_DOCUMENTOS` —a propósito, y bien— y entonces un Trabajo sin
// estado dejó de tener acción de héroe: la ficha perdió su `BUTTON.btn-primary` y el suelo de
// `guard:objetivo-tactil` saltó diciendo que encontraba 5 donde el censo midió 6.
//
// 🔴 EL GUARD TENÍA RAZÓN, y el defecto NO estaba en el producto: estaba en que la superficie
// medida no era una pantalla que exista. Medido: con `status: 'en_curso'` la escalera devuelve
// «+ Nuevo albarán»; con `'pendiente_agendar'`, «Agendar». Los cinco estados reales dan CTA. El
// único que no lo da es el que el banco fabricaba.
//
// Vive aquí, junto a `DETALLE_360_DE_MUESTRA` y por el mismo motivo: lo usan los DOS instrumentos
// —el que vigila y el que cuenta—, y con un fixture cada uno acabarían hablando de dos pantallas.
//
// 🔴 SCRUM-1560d · CON LA FORMA DE `serializeJobDetail` (`jobs.routes.ts`): la base de `serializeJob`
// más `customer` ampliado, `invoices`, `charge`, `albaranes`, `asignados` y `entregaPendiente`. Llevaba
// `title`, y el servidor manda `titulo`: la ficha nunca vio su nombre. El ESCENARIO no cambia: un
// Trabajo SIN presupuesto (`quote: null`, como hasta hoy), que es la salida temprana del serializador
// y por eso `charge: null` y la entrega `sin_eje`. Sin presupuesto no hay dinero aceptado: los cuatro
// del eje de cobro valen lo que da `estadoCobroFor` con todo a cero, `null`.
export const TRABAJO_DE_MUESTRA = Object.freeze({
  id: 1,
  titulo: 'Reforma de baño',
  tituloPropio: 'Reforma de baño',
  scheduledAt: null, assignedUserId: null, notes: null, createdAt: '2026-10-01T09:00:00.000Z', direccion: null,
  totalAceptado: null, totalCobrado: 0, estadoCobro: null, importeReferencia: null,
  operarioId: null, operario: null, asignados: Object.freeze([]), tipoOperacion: 'TRABAJO_UNICO',
  quote: null, remaining: null, nextStage: null, pendingStagesCount: 0, hasCustomPlan: false,
  charge: null, entregaPendiente: Object.freeze({ estado: 'sin_eje', motivo: null, calculable: false }),
  // `en_curso` y no otro: es el estado en el que la ficha ofrece MÁS —admite documentos (SCRUM-823)
  // y sigue teniendo el rail entero—, así que es el que deja más superficie que medir. Un fixture
  // para un guard de objetivos táctiles se elige por eso: por lo que hace VISIBLE.
  status: 'en_curso',
  // El teléfono va en el RANGO IMPOSIBLE `34 0XX XXX XXX`, como los de arriba: ningún abonado
  // español empieza por 0, así que un dato de prueba nunca puede ser el número de alguien.
  // 🔴 Lo escribí primero como `+34600000000` —con pinta real— teniendo esa regla tres párrafos
  // más arriba en este mismo fichero, y me cazó `guard` de SCRUM-262. Queda aquí anotado: leer la
  // norma y aplicarla son dos actos distintos, y el mecanismo existe porque el primero no basta.
  // SCRUM-1560d · el `customer` del detalle: `CUSTOMER_SELECT` (id, name, phone, mobile) más email,
  // taxId, notes y `numeroWhatsApp` (`canalDeWhatsApp`: con el móvil vacío, el fijo).
  customer: Object.freeze({ id: 5, name: 'Ana Ruiz', phone: '34000000005', mobile: null, email: null, taxId: null, notes: null, numeroWhatsApp: '34000000005' }),
  albaranes: Object.freeze([]),
  invoices: Object.freeze([]),
});

/** Los argumentos que el PRODUCTO le pasa a cada vista. Hoy sólo la 360 necesita uno (`app.js:314`). */
export const ARGUMENTOS_DE_VISTA = Object.freeze({
  renderCustomer360View: [DETALLE_360_DE_MUESTRA.customer.id],
});

/**
 * Monta `renderCustomersView` y devuelve `{ html, aviso }`.
 *
 * 🔴 SE SELECCIONA UNA FILA A PROPÓSITO. Con cero seleccionados la barra del móvil está en
 * `display:none`, y un guard que la midiera oculta sacaría 0×0 y lo llamaría defecto. Aquí se
 * pulsa una casilla con el mecanismo del producto para que la barra EXISTA cuando se mide.
 *
 * Si algo de esto no sale, se devuelve `aviso` y el llamador DECIDE — este módulo no traga.
 */
/**
 * `seleccionar: false` deja la lista con CERO marcados. Lo estrena SCRUM-792, que mide justo el
 * caso contrario al de siempre: qué se puede pulsar ANTES de haber marcado nada. Por defecto sigue
 * marcando una fila, porque `guard:objetivo-tactil` cuenta con la barra abierta para medirla.
 */
export async function paginaDeClientes(raiz, { extra = '', seleccionar = true } = {}) {
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
  if (seleccionar) {
    filas[0].checked = true;
    filas[0].disparar('change');
  }

  return { html: serializar(r.contenedor) + extra, aviso: null, casillasDeFila: filas.length };
}

/**
 * SCRUM-791 · UNA VISTA CUALQUIERA DEL PANEL, montada y serializada.
 *
 * `paginaDeClientes` sigue existiendo y NO se toca: necesita seleccionar una fila con el
 * mecanismo del producto para que la barra del móvil exista, y eso es suyo. Esto es para las
 * vistas que no piden ese gesto.
 *
 * 🔴 EL SUELO NO ES DECORATIVO. Una vista que monta pero pinta cuatro nodos NO es una superficie
 * medida: es una pantalla que no llegó a pintarse, y medirla daría un cero que parece un
 * cumplimiento. Por eso se exige un mínimo de nodos y, si no llega, se devuelve `aviso` y decide
 * quien llama. Es la misma lección que dejó escrita SCRUM-787 con sus ocho vistas sin fixture.
 */
export async function paginaDeVista(raiz, nombreFn, { datos = null, minimoNodos = 20, extra = '', args = [], preparar = null } = {}) {
  let r;
  try {
    // SCRUM-795 · `args` son los argumentos que el producto le pasa a la vista (la ficha 360 va con
    // su id, como en `app.js:314`). Sin `args` esto llama igual que siempre.
    r = await pintarVista(cargarDashboard(raiz, datos ? { datos } : {}), nombreFn, ...args);
  } catch (e) {
    return { html: null, aviso: `${nombreFn} reventó al montarse: ${String(e.message).slice(0, 90)}` };
  }
  if (r.error) return { html: null, aviso: `${nombreFn} no monta: ${String(r.error.message).slice(0, 90)}` };
  const nodos = todos(r.contenedor).length;
  if (nodos < minimoNodos) {
    return { html: null, aviso: `${nombreFn} montó ${nodos} nodos (mínimo ${minimoNodos}): está a medias con estos datos` };
  }
  // SCRUM-915d · `preparar` deja al que llama poner la superficie en el estado que quiere medir
  // ANTES de serializar (p. ej. el editor con sus pasos abiertos). Sin `preparar`, igual que siempre.
  if (typeof preparar === 'function') preparar(r.contenedor);
  return { html: serializar(r.contenedor) + extra, aviso: null, nodos };
}
