// Recorrido final de Trabajos (S4, 12-nov-2026) · VESTIR EL ROL sobre el banco de SCRUM-1658.
//
// La cookie QA es de ADMIN. El operario se SIMULA en dos capas, y las dos se declaran en cada medida:
//   1. FRONT  · `GET /admin/me` → userRole 'tecnico' (patrón de sonda-parte / sonda-trabajos).
//   2. CABLE  · lo que el servidor le recorta al operario REAL y a la cookie de admin no: cada respuesta
//      de trabajos y albaranes pasa por una COPIA LITERAL de `trabajoParaElRol` / `albaranParaElRol`
//      (el SHA de main del que se copió va en COPIADO_DE; se re-copia si main se mueve ahí), `/admin/team`
//      → 403 y la lista trae sólo SUS trabajos.
// LO QUE ESTO NO MIDE: que el servidor de yaqu.app recorte de verdad (eso sólo lo ve una sesión del
// operario real) ni sus 403 de escritura. Cada escritura hecha «como operario» sale con la cookie de
// admin: se APUNTA (s.escrituras) para casarla a mano con TECNICO_ALLOWED de adminRouteDeclarations.ts.
//
// 16-nov-2026 · DOS MODOS DE CABLE (`RECORTE=`), porque el tramo 0 midió que el paquete entró A MEDIAS:
//   · `hoy`  (por defecto) = lo que hace PRODUCCIÓN hoy: `trabajoParaElRol` de main sólo vacía `notes`
//     (#3151). El dinero del trabajo y los precios del albarán SIGUEN viajando al operario real.
//   · `1707` = lo que hará cuando entre #3153: además vacía el cobro del trabajo y los precios, totales e
//     importes de los albaranes. Sirve para cazar cifras FALSAS del front («0,00 €», «NaN») ANTES del merge.
//
// 16-nov-2026, 16:02Z · #3153 ENTRÓ en main (6ffa662fd03ad6994f08c9816de6f0c7307e14d0) y se desplegó: desde entonces
// el modo que describe PRODUCCIÓN es `1707`, y pasa a ser el de por defecto. El modo que se llamaba `hoy` dejó de
// ser verdad ese minuto (un nombre con fecha dentro caduca): se llama `antes-de-3153` y sólo sirve para repetir
// las medidas del tramo 2 tal y como se tomaron. Las copias de abajo se cotejaron a mano con
// `trabajoParaElRol.ts` y `albaranParaElRol.ts` de origin/main 4e2aaab3a55ed4779d9b6272751767940de39f38: iguales.
export const RECORTE = process.env.RECORTE === 'antes-de-3153' ? 'antes-de-3153' : '1707';
export const COPIADO_DE = process.env.COPIADO_DE || (RECORTE === '1707'
  ? 'origin/main @ 4e2aaab3a55ed4779d9b6272751767940de39f38 (trabajoParaElRol + albaranParaElRol, #3153 dentro)'
  : 'origin/main @ 37947dc1522a094320a4499eac28800f38cdc659 (ANTES de #3153: sólo notes: null)');
const OPERARIO = process.env.OPERARIO_QA || 'Operario QA';
// El contexto lo abre SIEMPRE el banco de SCRUM-1658, que bloquea el service worker (`serviceWorkers: 'block'`).
// Este fichero intercepta yaqu.app con `.route(`, y eso sólo vale si el SW no puede pedir por su cuenta
// (SCRUM-1233g). Por eso el rol NO se viste sobre un contexto que venga de fuera: se abre y se viste aquí,
// en `abrirVestido`. El 16-nov el CI lo dio CIEGO: `vestir(s)` recibía el contexto de `paso2.mjs`, que
// importaba la librería en caliente, y desde este fichero no se veía quién lo abría.
import { abrir } from '../../SCRUM-1658/banco/lib.mjs';

// ── copia de src/modules/jobs/domain/albaranParaElRol.ts (rama del operario) ──
const pendienteOp = (p) => ({ index: p?.index, concepto: p?.concepto, unidad: p?.unidad, servida: p?.servida, facturada: p?.facturada, pendiente: p?.pendiente });
const lineaOp = (l) => ({ concepto: l?.concepto, cantidad: l?.cantidad, unidad: l?.unidad, ...(typeof l?.quoteLineIndex === 'number' ? { quoteLineIndex: l.quoteLineIndex } : {}) });
export function albaranParaElOperario(a) {
  if (RECORTE !== '1707') return a; // antes de #3153 main no recortaba el albarán
  const out = { ...a };
  if ('lineas' in a) out.lineas = Array.isArray(a.lineas) ? a.lineas.map(lineaOp) : [];
  if ('pendientes' in a) out.pendientes = Array.isArray(a.pendientes) ? a.pendientes.map(pendienteOp) : [];
  if ('totales' in a) out.totales = null;
  if ('importePendienteDeFacturar' in a) out.importePendienteDeFacturar = null;
  return out;
}
// ── copia de src/modules/jobs/domain/trabajoParaElRol.ts (rama del operario) ──
export function trabajoParaElOperario(t) {
  if (RECORTE !== '1707') return { ...t, notes: null }; // copia de main ANTES de #3153 (sólo #3151)
  const out = { ...t, notes: null, totalCobrado: null, estadoCobro: null, remaining: null, nextStage: null, pendingStagesCount: 0, hasCustomPlan: false, invoices: [] };
  if ('charge' in t) out.charge = null;
  if (Array.isArray(t.albaranes)) out.albaranes = t.albaranes.map(albaranParaElOperario);
  return out;
}
// LOS TRES EJES del servidor (`GET /admin/jobs`, jobs.routes.ts de main: operarioId · assignedUserId · tabla
// puente, que la respuesta trae como `asignados`). El 12-nov esto miraba sólo `asignados` por NOMBRE y dejaba
// fuera al trabajo que el operario abre él mismo (nace con `operarioId` = el suyo): medido el 16-nov con el #83.
const OPERARIO_ID = Number(process.env.OPERARIO_ID || 30);
const esSuyo = (t) => t.operarioId === OPERARIO_ID || t.assignedUserId === OPERARIO_ID
  || (Array.isArray(t.asignados) && t.asignados.some((a) => a && (a.id === OPERARIO_ID || a.name === OPERARIO)));

/** Abre el navegador con el banco de SCRUM-1658 (SW bloqueado) y le viste el rol. Es la ÚNICA puerta de `vestir`. */
export async function abrirVestido(ancho, alto, rol) {
  const s = await abrir(ancho, alto);
  await vestir(s, rol);
  return s;
}

async function vestir(s, rol) {
  s.rol = rol || 'admin';
  s.escrituras = [];
  s.recortes = [];
  s.page.on('response', (r) => {
    const q = r.request(); const u = new URL(r.url());
    if (u.hostname === 'yaqu.app' && q.method() !== 'GET') s.escrituras.push(`${q.method()} ${u.pathname} → ${r.status()}`);
  });
  if (s.rol === 'admin') return;
  const json = async (route) => { const r = await route.fetch(); let j = null; try { j = await r.json(); } catch { /* no es JSON */ } return { r, j }; };
  await s.ctx.route('**/admin/**', async (route) => {
    const u = new URL(route.request().url()); const p = u.pathname; const m = route.request().method();
    if (p === '/admin/me' && m === 'GET') {
      const { r, j } = await json(route);
      if (!j) return route.fulfill({ response: r });
      return route.fulfill({ response: r, json: { ...j, userRole: s.rol, isOwner: false } });
    }
    if (p === '/admin/team') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"forbidden"}' });
    if (/^\/admin\/jobs(\/\d+)?$/.test(p)) {
      const { r, j } = await json(route);
      if (!j || r.status() >= 400) return route.fulfill({ response: r });
      let out;
      if (Array.isArray(j)) out = j.filter(esSuyo).map(trabajoParaElOperario);
      else if (Array.isArray(j.jobs)) out = { ...j, jobs: j.jobs.filter(esSuyo).map(trabajoParaElOperario) };
      else if (j.job) out = { ...j, job: trabajoParaElOperario(j.job) };
      else out = trabajoParaElOperario(j);
      s.recortes.push(`${m} ${p}`);
      return route.fulfill({ response: r, json: out });
    }
    if (RECORTE === '1707' && /^\/admin\/albaranes(\/\d+)?$/.test(p)) {
      const { r, j } = await json(route);
      if (!j || r.status() >= 400) return route.fulfill({ response: r });
      const fila = (f) => ({ ...albaranParaElOperario(f), ...('total' in f ? { total: null } : {}) });
      let out;
      if (Array.isArray(j)) out = j.map(fila);
      else if (Array.isArray(j.filas)) out = { ...j, filas: j.filas.map(fila) }; // `filaDeAlbaranParaElRol` (GET /admin/albaranes)
      else if (Array.isArray(j.albaranes)) out = { ...j, albaranes: j.albaranes.map(fila) };
      else if (j.albaran) out = { ...j, albaran: albaranParaElOperario(j.albaran) };
      else out = albaranParaElOperario(j);
      s.recortes.push(`${m} ${p}`);
      return route.fulfill({ response: r, json: out });
    }
    return route.continue();
  });
}

// Lo que se cuenta en CADA medida. Con /i y \s: las cabeceras salen en mayúsculas por CSS y el € lleva
// espacio duro (lección de la regla 42 de #3127: dos patrones dieron un cero falso).
const VOCABULARIO = {
  porCobrar: /por\s+cobrar/gi, cobrado: /cobrado/gi, teFalta: /\bte\s+falta/gi, /* con \b: «par-te\nFalta la firma» del parte daba 1 falso (16-nov) */ pendiente: /pendiente/gi, parcial: /parcial/gi,
  pagado: /pagado/gi, factura: /factur/gi, euros: /\d[\d.]*,\d\d\s€/g, ceroEuros: /\b0,00\s€/g, deImporte: /\bde\s+\d/gi,
  notasInternas: /notas\s+internas/gi, queHayQueHacer: /qué\s+hay\s+que\s+hacer/gi,
  basura: /\bNaN\b|\bundefined\b|\bnull\b|\[object Object\]/g,
};
export function cuentas(texto) {
  const o = {};
  for (const [k, re] of Object.entries(VOCABULARIO)) o[k] = (texto.match(re) || []).length;
  return o;
}
