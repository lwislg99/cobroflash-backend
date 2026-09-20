// SCRUM-917e · El fixture y el banco COMPARTIDOS del detalle del Trabajo.
//
// Hermano de `scripts/_trabajos-917.mjs` (917c, la lista). Vive aparte por la misma razón: el
// PASO 0 que mide el detalle de HOY y el guard que lo juzga DESPUÉS tienen que ver exactamente
// los mismos datos, o la comparación «antes → después» compara dos pantallas distintas y no dice
// nada. Un fixture copiado y pegado se desincroniza el primer día.
//
// La pantalla la pinta el PRODUCTO en un navegador de verdad: se cargan los MISMOS scripts que
// declara `public/dashboard/index.html`, en su orden, y sólo se dobla `apiRequest`. NO sirve un
// mini-DOM serializado: en 917c eso dio 982 px para cuatro listas distintas y el instrumento se
// cazó por el número, no por la vista.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scriptsDelDashboard, hojasDelDashboard } from '../tests/_banco-vistas.mjs';

export const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// El caso del inventario (docs/prototipos/SCRUM-917/inventario-hoy.md §2): Trabajo 3099, María
// López, agendado y PAGADO. Es el que destapa las dos cosas que el rediseño viene a arreglar —
// «590,00 €» siete veces y «QUÉ FALTA PARA COBRAR» en un Trabajo que no debe nada— así que es el
// que tiene que estar, y con esos valores exactos.
export const JOB_PAGADO = {
  id: 3099,
  status: 'scheduled',
  createdAt: '2026-09-01T09:00:00Z',
  scheduledAt: '2026-09-25T08:00:00Z',
  titulo: '',                       // sin nombre propio: el detalle cae al del cliente
  customer: { id: 41, name: 'María López', phone: '600111222', email: 'maria@example.com' },
  asignados: [],
  operario: null,
  direccion: 'C/ Alcalá 120, Madrid',
  notes: '',
  albaranes: [],
  gastos: [],
  invoices: [],
  quote: { id: 5, numero: 5, currency: 'EUR', estado: 'accepted' },
  totalAceptado: 590,
  totalCobrado: 590,
};

// Segundo caso: lo que falta SÍ es dinero. Sirve de control — si la tarjeta de huecos se
// comportara igual en los dos, no estaría mirando el estado, estaría pintando siempre lo mismo.
export const JOB_A_MEDIAS = {
  ...JOB_PAGADO,
  id: 3100,
  status: 'in_progress',
  customer: { id: 42, name: 'Talleres Ortega SL', phone: '600333444', email: null },
  totalAceptado: 417.45,
  totalCobrado: 100,
};

// Tercer caso: sin presupuesto aceptado. Hoy no se nombra, y el prototipo le da un hueco propio.
export const JOB_SIN_PRESUPUESTO = {
  ...JOB_PAGADO,
  id: 3101,
  status: 'in_progress',
  customer: { id: 43, name: 'Ana Ruiz', phone: null, email: null },
  quote: null,
  totalAceptado: null,
  totalCobrado: 0,
};

export const CASOS = [JOB_PAGADO, JOB_A_MEDIAS, JOB_SIN_PRESUPUESTO];
const POR_ID = new Map(CASOS.map((j) => [j.id, j]));

/**
 * Levanta el servidor que sirve el dashboard real y contesta `/admin/*` con los casos de arriba.
 * Devuelve `{ base, cerrar }`. El puerto lo elige el sistema (0): dos sesiones a la vez no chocan.
 */
export async function levantarBanco({ conEquipo = false } = {}) {
  const scripts = scriptsDelDashboard(RAIZ);
  const hojas = hojasDelDashboard(RAIZ);
  const equipo = conEquipo ? [{ id: 1, name: 'Javier P.' }, { id: 2, name: 'Lucía M.' }] : [];

  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u.startsWith('/admin/team')) return json(res, equipo);
    if (u.startsWith('/admin/merchant')) return json(res, { name: 'Epipe', currency: 'EUR' });
    if (u.startsWith('/admin/partes')) return json(res, { partes: [] });
    if (/gastos/.test(u)) return json(res, { gastos: [] });
    // 🔴 SIN COMODÍN. La primera versión de este banco acababa en
    // `if (u.startsWith('/admin/')) return json(res, JOB_PAGADO)`, y eso convirtió una llamada mal
    // hecha (`/admin/jobs/NaN`) en una respuesta perfectamente válida: los tres casos pintaron el
    // mismo Trabajo y los otros dos dieron «0 veces» de sus propios importes, que es exactamente la
    // forma de un hallazgo. Un id que este banco no conoce tiene que RUIDO, no un trabajo de más.
    const m = u.match(/^\/admin\/jobs\/([^/?]+)$/);
    if (m) {
      const j = POR_ID.get(Number(m[1]));
      if (j) return json(res, j);
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: `el banco no conoce el trabajo «${m[1]}»` }));
    }

    // Cualquier OTRO `/admin/*` contesta un objeto vacío. Hace falta: sin él, el arranque del
    // dashboard no encuentra su sesión y NAVEGA a la pantalla de entrada; el banco acaba sirviendo
    // un .html de verdad y `#view` no existe. Pero devuelve `{}`, nunca un Trabajo: el comodín que
    // devolvía `JOB_PAGADO` es justo el que convirtió `/admin/jobs/NaN` en una respuesta buena.
    if (u.startsWith('/admin/')) return json(res, {});

    const cand = u === '/' ? null : path.join(RAIZ, 'public', u.replace(/^\//, ''));
    if (cand && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      // El tipo se deduce de la extensión. Servir un .html como `application/javascript` hace que
      // Chrome lo pinte como TEXTO dentro de un <pre>, y entonces «no existe #view» parece un fallo
      // de la vista cuando es del banco. Me costó una vuelta entera hoy.
      const tipo = cand.endsWith('.css') ? 'text/css'
        : cand.endsWith('.html') ? 'text/html'
        : cand.endsWith('.json') ? 'application/json'
        : 'application/javascript';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(cand));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>detalle</title>
${hojas.map((h) => `<link rel="stylesheet" href="/${path.relative(path.join(RAIZ, 'public'), h).replace(/\\/g, '/')}">`).join('\n')}
<body><div class="app-main"><div id="view"></div></div>
${scripts.map((s) => `<script src="/dashboard/${s}"></script>`).join('\n')}
<script>
  window.appUserRole = 'admin';
  window.appUserName = 'Epipe';
  window.__navegaciones = [];
  window.renderAppView = function (v, o) { window.__navegaciones.push({ vista: v, opts: o }); };
</script></body>`);
  });

  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${srv.address().port}/`,
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}

function json(res, o) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(o));
}

/**
 * Pinta el detalle de un Trabajo y NO devuelve hasta que la pantalla existe de verdad.
 * Devuelve el número de nodos, que es el TESTIGO DE EJECUCIÓN (A21): si la cobaya no llegó a
 * pintarse, un censo de «0 importes repetidos» se lee exactamente igual que una pantalla
 * arreglada. Quien llame comprueba el testigo antes de creerse ningún cero.
 */
export async function pintarDetalle(page, jobId) {
  return page.evaluate(async (id) => {
    const c = document.getElementById('view');
    c.innerHTML = '';
    window.__navegaciones = [];
    if (typeof window.renderJobDetailView !== 'function') return { ok: false, por: 'sin renderJobDetailView' };
    // 🔴 El id va A PELO. La firma es `renderJobDetailView(container, jobId, altaAlbaran)`
    // (jobDetailView.js:483) y dentro hace `Number(jobId)`. Pasarle `{ jobId: id }` NO da error:
    // `Number({})` es NaN, la petición sale a `/admin/jobs/NaN` y cualquier banco con un comodín
    // `/admin/*` contesta con SU trabajo de siempre. Los tres casos salen idénticos y los ceros de
    // los otros dos se leen como hallazgos. Me pasó en la primera pasada del PASO 0, y sigue
    // pasando hoy en `scripts/capturar-detalle-trabajo.mjs:69`, que pasa `{ jobId: 7 }`.
    try { await window.renderJobDetailView(c, id); } catch (e) { return { ok: false, por: 'error: ' + e.message }; }
    await new Promise((r) => setTimeout(r, 700));
    const nodos = c.querySelectorAll('*').length;
    return { ok: nodos > 20, por: nodos <= 20 ? `solo ${nodos} nodos` : '', nodos };
  }, jobId);
}
