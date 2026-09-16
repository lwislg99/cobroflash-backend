// docs/master/evidencias/SCRUM-600f/censo-600-paso0.mjs — PASO 0 de SCRUM-600f
//
//   node docs/master/evidencias/SCRUM-600f/censo-600-paso0.mjs      (desde la raíz del repo)
//
// EVIDENCIA, NO GUARD. Es el instrumento con el que se midió el apéndice 600f de
// `docs/master/SCRUM-600.md`, subido porque «si no está en git, no existe» (A8). No corre en la
// tanda ni vigila nada: responde, sobre el árbol en el que se ejecute, a las tres preguntas del
// PASO 0 montando las pantallas con el banco de vistas — no leyendo el código.
//
//   ① la puerta: qué hace «Nueva factura» en la lista
//   ② qué capacidades pinta la página de factura frente a la de presupuesto (control con suelo)
//   ③ plantillas CON un merchant que las tiene — sin ellas la tira no se pinta y el censo miente
//
// Límites declarados: el mini-DOM no agrega el texto de los hijos de un botón, y el serializador no
// conserva el `value` de los inputs. Por eso se compara SIEMPRE contra el presupuesto montado igual.
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const { cargarDashboard, pintarVista, todos } = await import(new URL('../../../../tests/_banco-vistas.mjs', import.meta.url));
const { serializar } = await import(new URL('../../../../scripts/_pagina-panel.mjs', import.meta.url));

const txt = (n) => String((n && (n.textContent || n._texto)) || '');
const clases = (n) => String((n && n.className) || '').split(/\s+/);
const espera = (ms) => new Promise((res) => setTimeout(res, ms));

const PLANTILLAS = [
  { id: 1, name: 'Cambio de grifo', lines: [{ description: 'Grifo monomando', quantity: 1, unitPrice: 45, tax: 21 }] },
  { id: 2, name: 'Desatasco', lines: [{ description: 'Desatasco con máquina', quantity: 1, unitPrice: 90, tax: 21 }] },
];
const conPlantillas = (url) => {
  const u = String(url || '');
  if (/\/admin\/templates/.test(u)) return PLANTILLAS;
  if (/\/admin\/merchant/.test(u)) return { id: 1, name: 'Fontanería Soler' };
  return [];
};

async function montar(opciones, preparar, fn, ...args) {
  const banco = cargarDashboard(RAIZ, opciones);
  preparar(banco);
  const r = await pintarVista(banco, fn, ...args);
  if (r.error) throw r.error;
  await espera(50);
  return { banco, r, nodos: todos(r.contenedor), html: serializar(r.contenedor) };
}

const PRESUPUESTO = [() => {}, 'renderQuotesView', null, false];
const FACTURA = [(b) => { b.ctx.appDocumentoSuelto = 'factura'; }, 'renderDocumentoSueltoView'];
const JUSTIFICANTE = [(b) => { b.ctx.appDocumentoSuelto = 'justificante'; }, 'renderDocumentoSueltoView'];

let ciego = false;

// ① LA PUERTA
console.log('═══ ① LA PUERTA ═══');
try {
  const banco = cargarDashboard(RAIZ, {});
  banco.ctx.appDocumentoSuelto = 'factura';
  const llamadas = [];
  let modalViejo = false;
  banco.ctx.renderAppView = (v) => llamadas.push(v);
  banco.ctx.openNuevaFacturaModal = () => { modalViejo = true; };
  const r = await pintarVista(banco, 'renderInvoicesView');
  if (r.error) throw r.error;
  const boton = todos(r.contenedor).find((n) => n.tagName === 'BUTTON' && /Nueva factura|Nuevo justificante/.test(txt(n)));
  if (!boton) { ciego = true; console.log('🔴 CIEGO: no encuentro el botón «Nueva factura»'); }
  else {
    boton.disparar('click');
    await espera(20);
    console.log(`«${txt(boton)}» → renderAppView(${JSON.stringify(llamadas)}) · abre el modal viejo: ${modalViejo ? 'SÍ' : 'NO'}`);
  }
} catch (e) { ciego = true; console.log(`🔴 la lista de facturas no monta: ${e && e.message || e}`); }

// ② CAPACIDADES, sin plantillas
console.log('\n═══ ② CAPACIDADES DE LA PÁGINA ═══');
const CAPACIDADES = [
  ['vista previa', /vista previa/i],
  ['«3. Condiciones»', /3\. Condiciones/],
  ['«4. Envío»', /4\. Env[ií]o/],
  ['botón Usar plantilla', /Usar plantilla/],
  ['botón Guardar plantilla', /Guardar como plantilla/],
  ['pie «Presupuesto válido»', /Presupuesto válido/],
  ['modal-overlay', /modal-overlay/],
];
const casos = [];
for (const [etiqueta, def] of [['PRESUPUESTO', PRESUPUESTO], ['FACTURA', FACTURA], ['JUSTIFICANTE', JUSTIFICANTE]]) {
  try { casos.push({ etiqueta, ...(await montar({}, ...def)) }); }
  catch (e) { casos.push({ etiqueta, error: String(e && e.message || e) }); }
}
console.log('capacidad'.padEnd(26) + casos.map((c) => c.etiqueta.padEnd(14)).join(''));
for (const [nombre, re] of CAPACIDADES) {
  const g = new RegExp(re.source, re.flags + 'g');
  console.log(nombre.padEnd(26) + casos.map((c) => String(c.error ? 'ERROR' : (c.html.match(g) || []).length).padEnd(14)).join(''));
}
console.log('nodos'.padEnd(26) + casos.map((c) => String(c.error ? '-' : c.nodos.length).padEnd(14)).join(''));
const p = casos[0];
if (p.error || !/3\. Condiciones/.test(p.html) || !/4\. Env[ií]o/.test(p.html)) {
  ciego = true;
  console.log('🔴 CIEGO: el presupuesto no muestra Condiciones y Envío; los ceros de factura no dicen nada.');
} else console.log('✅ SUELO: el presupuesto sí muestra Condiciones y Envío → un 0 en factura es ausencia real.');

// ③ PLANTILLAS, con un merchant que las tiene
console.log('\n═══ ③ PLANTILLAS CON PLANTILLAS GUARDADAS ═══');
for (const [etiqueta, def] of [['PRESUPUESTO (control)', PRESUPUESTO], ['FACTURA', FACTURA]]) {
  try {
    const { nodos, html } = await montar({ datos: conPlantillas }, ...def);
    const tira = nodos.find((n) => clases(n).includes('quote-plantillas'));
    const hijos = tira ? todos(tira) : [];
    const rotulo = hijos.find((n) => clases(n).includes('quote-plantillas__label'));
    const fichas = hijos.filter((n) => n.tagName === 'BUTTON');
    console.log(`${etiqueta.padEnd(22)} tira: ${tira ? 'SÍ' : 'NO'} · rótulo: ${rotulo ? '«' + txt(rotulo) + '»' : '(ninguno)'} · fichas: ${fichas.length} · «Usar plantilla»: ${/Usar plantilla|Ver las \d+/.test(html) ? 'SÍ' : 'NO'} · «Guardar como plantilla»: ${/Guardar como plantilla/.test(html) ? 'SÍ' : 'NO'}`);
  } catch (e) { ciego = true; console.log(`🔴 ${etiqueta} no monta: ${e && e.message || e}`); }
}

console.log(ciego ? '\n🔴 HAY CEGUERAS ARRIBA: este censo NO responde entero.' : '\n✅ censo completo');
process.exit(ciego ? 2 : 0);
