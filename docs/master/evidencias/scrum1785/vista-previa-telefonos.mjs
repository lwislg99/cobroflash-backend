// docs/master/evidencias/scrum1785/vista-previa-telefonos.mjs — SCRUM-1785 (relevo jv-j1gm, 21-nov-2026)
//
// Gemela de `pdf-telefonos.mjs` para la VISTA PREVIA («Así lo verá el cliente»): QUÉ número sale,
// de QUIÉN es y CÓMO se rotula el del comercio, con «Teléfono» oculto y sin ocultar. Monta el
// editor REAL (`renderQuotesView`) en el banco de vistas con un comercio que tiene nombre comercial,
// razón social y WhatsApp, y lee el texto de los bloques del comercio y del cliente.
//
// Uso:  node docs/master/evidencias/scrum1785/vista-previa-telefonos.mjs
// Sale 0 si supo medir los dos casos; 2 (CIEGO) si no. NO juzga: imprime lo que hay.
// `quotesView.js` es del carril S2: esto MIDE, no arregla.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { cargarDashboard, pintarVista, todos } = await import(pathToFileURL(path.join(RAIZ, 'tests/_banco-vistas.mjs')).href);

const TEL_CLIENTE = '600178511';
const TEL_COMERCIO = '611178522';
const CLIENTE = { id: 5, name: 'QA1785NOMBRE', phone: TEL_CLIENTE, mobile: TEL_CLIENTE, email: 'qa1785@correo.es', taxId: 'X1785000Z' };
const MERCHANT = { id: 1, name: 'QAComercial1785', legalName: 'QARazon1785SL', whatsappPhone: TEL_COMERCIO, defaultCurrency: 'EUR', clausulasPresupuesto: [] };
const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const texto = (n) => String(n.textContent || '');

async function montar() {
  const red = {
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
    fetch: async (url) => {
      const u = String(url);
      let cuerpo = {};
      if (/\/admin\/customers/.test(u)) cuerpo = [CLIENTE];
      else if (/\/admin\/merchant$/.test(u)) cuerpo = MERCHANT;
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
    },
  };
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
  await respirar();
  return r.contenedor;
}
// Solo las HOJAS (nodos sin hijos con texto propio), para no contar cada línea dos veces.
const bloque = (c, clase) => {
  const bl = todos(c).find((x) => String(x.className || '').split(/\s+/).includes(clase));
  if (!bl) return null;
  return todos(bl).filter((n) => n !== bl && !todos(n).some((h) => h !== n && texto(h).trim())).map((n) => texto(n).trim()).filter(Boolean);
};
function casillaDe(c, rotulo) {
  const lbl = todos(c).find((x) => x.tagName === 'LABEL' && todos(x).some((h) => texto(h).trim() === rotulo)
    && todos(x).some((h) => h.tagName === 'INPUT' && h.type === 'checkbox'));
  return lbl ? todos(lbl).find((h) => h.tagName === 'INPUT' && h.type === 'checkbox') : null;
}

try {
  for (const ocultar of [false, true]) {
    const c = await montar();
    if (ocultar) {
      const chk = casillaDe(c, 'Teléfono');
      if (!chk) throw new Error('CIEGO: no encuentro la casilla Teléfono');
      chk.checked = false;
      chk.disparar('change');
      await respirar();
    }
    const com = bloque(c, 'preview-merchant-block');
    const cli = bloque(c, 'preview-client-block');
    if (!com || !cli || !com.some((l) => l.includes(MERCHANT.name))) throw new Error('CIEGO: sin bloques o sin el nombre del comercio: ' + JSON.stringify({ com, cli }));
    console.log(`${ocultar ? '«Teléfono» OCULTO' : 'sin ocultar      '} · comercio = ${JSON.stringify(com)}`);
    console.log(`                   · cliente  = ${JSON.stringify(cli)}`);
    console.log(`                   · tel. CLIENTE visible: ${cli.concat(com).some((l) => l.includes(TEL_CLIENTE)) ? 'SÍ' : 'no'} · tel. COMERCIO visible: ${com.some((l) => l.includes(TEL_COMERCIO)) ? 'SÍ' : 'no'}`);
  }
} catch (e) {
  console.log(String(e.message || e));
  process.exit(2);
}
console.log('población: 2 montajes del editor real');
process.exit(0);
