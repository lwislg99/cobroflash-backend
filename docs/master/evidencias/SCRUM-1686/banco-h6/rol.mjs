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
export const COPIADO_DE = process.env.COPIADO_DE || 'PENDIENTE: SHA de origin/main con 1662+1707 dentro';
const OPERARIO = process.env.OPERARIO_QA || 'Operario QA';

// ── copia de src/modules/jobs/domain/albaranParaElRol.ts (rama del operario) ──
const pendienteOp = (p) => ({ index: p?.index, concepto: p?.concepto, unidad: p?.unidad, servida: p?.servida, facturada: p?.facturada, pendiente: p?.pendiente });
const lineaOp = (l) => ({ concepto: l?.concepto, cantidad: l?.cantidad, unidad: l?.unidad, ...(typeof l?.quoteLineIndex === 'number' ? { quoteLineIndex: l.quoteLineIndex } : {}) });
export function albaranParaElOperario(a) {
  const out = { ...a };
  if ('lineas' in a) out.lineas = Array.isArray(a.lineas) ? a.lineas.map(lineaOp) : [];
  if ('pendientes' in a) out.pendientes = Array.isArray(a.pendientes) ? a.pendientes.map(pendienteOp) : [];
  if ('totales' in a) out.totales = null;
  if ('importePendienteDeFacturar' in a) out.importePendienteDeFacturar = null;
  return out;
}
// ── copia de src/modules/jobs/domain/trabajoParaElRol.ts (rama del operario) ──
export function trabajoParaElOperario(t) {
  const out = { ...t, notes: null, totalCobrado: null, estadoCobro: null, remaining: null, nextStage: null, pendingStagesCount: 0, hasCustomPlan: false, invoices: [] };
  if ('charge' in t) out.charge = null;
  if (Array.isArray(t.albaranes)) out.albaranes = t.albaranes.map(albaranParaElOperario);
  return out;
}
const esSuyo = (t) => JSON.stringify(t.asignados || t.assignedUser || t.assignedUserName || '').includes(OPERARIO);

export async function vestir(s, rol) {
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
    if (/^\/admin\/albaranes(\/\d+)?$/.test(p)) {
      const { r, j } = await json(route);
      if (!j || r.status() >= 400) return route.fulfill({ response: r });
      const fila = (f) => ({ ...albaranParaElOperario(f), ...('total' in f ? { total: null } : {}) });
      let out;
      if (Array.isArray(j)) out = j.map(fila);
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
  porCobrar: /por\s+cobrar/gi, cobrado: /cobrado/gi, teFalta: /te\s+falta/gi, pendiente: /pendiente/gi, parcial: /parcial/gi,
  pagado: /pagado/gi, factura: /factur/gi, euros: /\d[\d.]*,\d\d\s€/g, ceroEuros: /\b0,00\s€/g, deImporte: /\bde\s+\d/gi,
  notasInternas: /notas\s+internas/gi, queHayQueHacer: /qué\s+hay\s+que\s+hacer/gi,
  basura: /\bNaN\b|\bundefined\b|\bnull\b|\[object Object\]/g,
};
export function cuentas(texto) {
  const o = {};
  for (const [k, re] of Object.entries(VOCABULARIO)) o[k] = (texto.match(re) || []).length;
  return o;
}
