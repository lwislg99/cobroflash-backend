// docs/master/evidencias/scrum1785/vista-previa.mjs — SCRUM-1785 · la medición de la VISTA PREVIA.
//
// Monta el editor de presupuestos REAL (`renderQuotesView`) en el banco de vistas de Node, elige un
// cliente con los cuatro datos y, para cada casilla de «Datos del cliente en el documento»,
// la desmarca y lee el texto del bloque «Cliente» de «Así lo verá el cliente».
//
// Uso:  node docs/master/evidencias/scrum1785/vista-previa.mjs
// Sale 0 si la vista previa respeta las casillas, 1 si alguna fuga, 2 si no supo medir (CIEGO).
// `quotesView.js` es del carril S2: esto MIDE, no arregla.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { cargarDashboard, pintarVista, todos } = await import(pathToFileURL(path.join(RAIZ, 'tests/_banco-vistas.mjs')).href);

const CLIENTE = { id: 5, name: 'QA1785NOMBRE', phone: '600178511', mobile: '600178511', email: 'qa1785@correo.es', taxId: 'X1785000Z' };
const DATOS = [
  { key: 'name', rotulo: 'Nombre', valor: CLIENTE.name },
  { key: 'phone', rotulo: 'Teléfono', valor: CLIENTE.phone },
  { key: 'taxId', rotulo: 'NIF', valor: CLIENTE.taxId },
  { key: 'email', rotulo: 'Email', valor: CLIENTE.email },
];
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');

async function montar() {
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url) => {
      const u = String(url);
      let cuerpo = {};
      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', clausulasPresupuesto: [] };
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
  // `RAIZ_1785` = otra raíz con `public/` (p. ej. una copia con un arreglo probado fuera del árbol).
  const b = cargarDashboard(process.env.RAIZ_1785 || RAIZ, { red });
  b.ctx.appMerchantId = 1;
  b.ctx.renderAppView = () => {};
  const r = await pintarVista(b, 'renderQuotesView', { name: 'x', currency: 'EUR', lines: [{ concept: 'Bajante1785', qty: 1, price: 80 }] });
  if (r.error) throw new Error('CIEGO: la vista no monta: ' + r.error.message);
  await respirar();
  const sel = todos(r.contenedor).find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  if (!sel) throw new Error('CIEGO: no hay selector de cliente');
  sel.value = String(CLIENTE.id);
  sel.disparar('change');
  return r.contenedor;
}
const bloqueCliente = (c) => {
  const bl = todos(c).find((x) => String(x.className || '').includes('preview-client-block'));
  return bl ? todos(bl).map(texto).join(' | ') : null;
};
function casillaDe(c, rotulo) {
  const lbl = todos(c).find((x) => x.tagName === 'LABEL' && todos(x).some((h) => texto(h).trim() === rotulo)
    && todos(x).some((h) => h.tagName === 'INPUT' && h.type === 'checkbox'));
  return lbl ? todos(lbl).find((h) => h.tagName === 'INPUT' && h.type === 'checkbox') : null;
}

let fugas = 0;
try {
  const base = await montar();
  const t0 = bloqueCliente(base);
  if (t0 == null || !t0.includes(CLIENTE.name)) throw new Error('CIEGO: el bloque «Cliente» no está o no lleva ni el nombre: ' + t0);
  console.log('CONTROL (todo marcado) · bloque Cliente =', JSON.stringify(t0));
  for (const d of DATOS) {
    console.log(`  · ${d.rotulo} visible sin ocultar: ${t0.includes(d.valor) ? 'sí' : 'NO (la vista previa nunca lo pinta)'}`);
  }
  for (const d of DATOS) {
    const c = await montar();
    const chk = casillaDe(c, d.rotulo);
    if (!chk) throw new Error('CIEGO: no encuentro la casilla ' + d.rotulo);
    chk.checked = false;
    chk.disparar('change');
    await respirar();
    const t = bloqueCliente(c);
    const fuga = t.includes(d.valor);
    if (fuga) fugas++;
    console.log(`${fuga ? 'FUGA ' : 'ok   '} · «${d.rotulo}» desmarcado → bloque Cliente = ${JSON.stringify(t)}`);
  }
} catch (e) {
  console.log(String(e.message || e));
  process.exit(2);
}
console.log(`población: 4 casillas · fugas: ${fugas}`);
process.exit(fugas ? 1 : 0);
