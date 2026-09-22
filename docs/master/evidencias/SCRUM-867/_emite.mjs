// docs/master/evidencias/SCRUM-867/_emite.mjs — ayudante de `cuerpo-congelado.mjs`
//
//   node docs/master/evidencias/SCRUM-867/_emite.mjs pagina|modal
//
// Monta UNA de las dos pantallas del documento suelto en el banco, teclea la MISMA entrada y
// escribe por salida estándar el cuerpo que sale hacia `POST /admin/invoices`, con el prefijo
// `CUERPO=`. Vive en un proceso aparte a propósito: el instrumento que lo llama restaura ficheros
// del árbol entre una medición y otra, y Node cachea los módulos ya importados.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const { cargarDashboard, pintarVista, todos } = await import(new URL('../../../../tests/_banco-vistas.mjs', import.meta.url));

const QUIEN = process.argv[2];
const CLIENTE = '7';
const LINEA = { concepto: 'Mano de obra', cantidad: '2', precio: '50' };
const respirar = () => new Promise((r) => setTimeout(r, 80));
const texto = (n) => String((n && n.textContent) || (n && n._html && !/</.test(n._html) ? n._html : ''));

const enviado = [];
const red = {
  navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  fetch: async (url, opts) => {
    if (opts && opts.method === 'POST') enviado.push({ url: String(url), body: opts.body });
    const u = String(url);
    let cuerpo = { factura: { id: 1 } };
    if (/\/admin\/customers/.test(u)) cuerpo = [{ id: Number(CLIENTE), name: 'Cliente de prueba' }];
    else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR' };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  },
};

const banco = cargarDashboard(RAIZ, { red });
banco.ctx.appDocumentoSuelto = 'factura';
banco.ctx.appMerchantId = 1;
banco.ctx.renderAppView = () => {};

let nodos = [];
if (QUIEN === 'modal') {
  if (typeof banco.ctx.openNuevaFacturaModal !== 'function') {
    console.log('ERROR=el modal no está publicado en este árbol');
    process.exit(3);
  }
  banco.ctx.openNuevaFacturaModal(function () {});
  await respirar();
  nodos = todos(banco.ctx.document.body);
  const sel = nodos.find((x) => x.tagName === 'SELECT');
  sel.value = CLIENTE;
  const pon = (clase, v) => { nodos.find((x) => String(x.className || '').includes(clase)).value = v; };
  pon('nf-concepto', LINEA.concepto);
  pon('nf-cantidad', LINEA.cantidad);
  pon('nf-precio', LINEA.precio);
} else {
  const r = await pintarVista(banco, 'renderQuotesView', null, true);
  if (r.error) { console.log(`ERROR=${r.error.message}`); process.exit(3); }
  nodos = todos(r.contenedor);
  const sel = nodos.find((x) => x.tagName === 'SELECT' && x.name === 'customer_id');
  sel.value = CLIENTE;
  sel.disparar('change');
  const conceptos = nodos.filter((x) => x.tagName === 'INPUT' && x.placeholder === 'Concepto / servicio');
  const numeros = nodos.filter((x) => x.tagName === 'INPUT' && x.type === 'number');
  conceptos[0].value = LINEA.concepto;
  numeros[0].value = LINEA.cantidad;
  numeros[1].value = LINEA.precio;
}

const emitir = nodos.find((x) => x.tagName === 'BUTTON' && /^Emitir/.test(texto(x)));
if (!emitir) { console.log('ERROR=no hay acción primaria de emisión'); process.exit(3); }
emitir.disparar('click');
await respirar();

const altas = enviado.filter((x) => /\/admin\/invoices/.test(x.url));
if (altas.length !== 1) { console.log(`ERROR=altas=${altas.length}`); process.exit(3); }
console.log(`CUERPO=${altas[0].body}`);
