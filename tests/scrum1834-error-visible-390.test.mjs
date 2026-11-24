// tests/scrum1834-error-visible-390.test.mjs — SCRUM-1834 (puesto S2, 24-nov-2026)
//
// LA VÍCTIMA: el profesional que, en el móvil (390 px), pulsa «Marcar como PAGADA» en una factura
// con línea al 10 % sin decir cómo lo cobró. El candado de SCRUM-1804 funcionaba (ni PUT, ni
// preguntas), pero el MOTIVO —T3, «Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.»—
// se pintaba en la barra de estado de ARRIBA de la ficha (`setStatus`) mientras el foco bajaba al
// selector. Medido en vivo en la r42 de SCRUM-1804b: top −196 px con scrollY 688, fuera de la
// pantalla (docs/master/evidencias/SCRUM-1804/r42-vivo/trabajo-sin-elegir-390-tal-cual.png).
// A 1280 se veía por casualidad: la ficha cabe entera.
//
// LA CURA (decisión de S2, registro docs/master/SCRUM-1834.md): T3 se pinta JUNTO al selector,
// dentro de su mismo envoltorio, igual que T4 (el aviso de efectivo, que sí se ve a 390). El foco
// va al selector, y el navegador desplaza hasta el foco: lo que está pegado a él entra en pantalla
// a cualquier ancho. No se desplaza a la barra de arriba: eso apartaría el selector de la vista.
//
// 🔴 EL BANCO NO MAQUETA (mismo límite que declara scrum792): el «top dentro de la pantalla» no se
// mide aquí, se mide en navegador (registro, r42). Aquí se ata la CAUSA estructural, que es la que
// se rompe sola: dónde vive el nodo de T3 respecto al selector que recibe el foco.
//
// El texto NO es de este ticket (regla 39): es `window.COPY_IVA_10.eligeMetodo` (firmado c.22438).
// Aquí se copia SOLO para compararlo byte a byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Las mutaciones que tienen que tumbarme (SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: 'errorMetodo.hidden = false;',
    a: 'setStatus(\'error\', window.COPY_IVA_10.eligeMetodo);',
    cae: 'SCRUM-1834 · 🔴 sin medio, T3 sale JUNTO al selector que recibe el foco, y en ningún otro sitio',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: 'selMetodo.setAttribute(\'aria-describedby\', errorMetodo.id + \' \' + avisoEfectivo.id);',
    a: 'selMetodo.setAttribute(\'aria-describedby\', avisoEfectivo.id);',
    cae: 'SCRUM-1834 · 🔴 sin medio, T3 sale JUNTO al selector que recibe el foco, y en ningún otro sitio',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: 'if (window.metodoElegido(selMetodo)) errorMetodo.hidden = true;',
    a: '',
    cae: 'SCRUM-1834 · al elegir un medio, T3 se va (y T4 sigue a lo suyo)',
  },
];

const T3 = 'Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.';

const METODOS = [
  { valor: 'bizum_manual', rotulo: 'Bizum' }, { valor: 'card', rotulo: 'tarjeta' },
  { valor: 'transfer', rotulo: 'transferencia' }, { valor: 'cash', rotulo: 'efectivo' },
];

function trabajoCon(factura) {
  return {
    id: 1834, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'ZZ reforma baño',
    customer: { id: 5, name: 'ZZCLIENTE Ejemplo', phone: null, mobile: null },
    asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
    quote: null, direccion: null, totalAceptado: 160.5, totalCobrado: 0, estadoCobro: 'Pendiente',
    tipoOperacion: 'OPERACIONES_SUELTAS',
    invoices: [{
      id: 91, number: 'F-2026-0091', status: 'pending', type: 'F1', total: 160.5, currency: 'EUR',
      createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: null, payToken: null,
      stageLabel: null, rectifiesId: null, envioDocumento: null,
      ...factura,
    }],
  };
}

async function ficha(factura) {
  const banco = cargarDashboard(RAIZ);
  const job = trabajoCon(factura);
  const llamadas = [];
  banco.ctx.apiRequest = async (u, o) => { llamadas.push({ u: String(u), o: o || {} }); return o && o.method === 'PUT' ? { ok: true } : job; };
  banco.ctx.appUserRole = 'admin';
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.appMetodosDeclarables = METODOS;
  banco.ctx.confirm = () => true;
  banco.ctx.prompt = () => '160.50';
  const r = await pintarVista(banco, 'renderJobDetailView', 1834);
  assert.equal(r.error, null, `🔴 SUELO: la ficha del trabajo no monta (${r.error && r.error.message})`);
  const nodos = () => todos(banco.ctx.document.body);
  const sel = nodos().find((n) => n.tagName === 'SELECT' && n._id === 'metodo-cobro-inv-91') || null;
  const boton = nodos().find((n) => n.tagName === 'BUTTON' && String(n.textContent || '').trim() === 'Marcar como PAGADA');
  // El usuario pulsa «Marcar como PAGADA» con la pestaña de documentos ABIERTA: se abre la pestaña
  // dueña del botón (la que nombra su tabpanel), no se le quita `hidden` a todo.
  let panel = boton; while (panel && !(panel.getAttribute && panel.getAttribute('role') === 'tabpanel')) panel = panel._padre;
  if (panel) {
    const idPanel = panel._id || panel.id;
    const pestana = nodos().find((n) => n.getAttribute && n.getAttribute('role') === 'tab' && n.getAttribute('aria-controls') === idPanel);
    assert.ok(pestana, `🔴 CIEGO: no encuentro la pestaña que abre «${idPanel}»`);
    await pulsar(pestana);
    assert.equal(panel.hidden, false, `🔴 CIEGO: pulsar la pestaña no abre «${idPanel}»`);
  }
  return { nodos, sel, boton, llamadas };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, preventDefault() {}, stopPropagation() {} })));
}

/** Un nodo se VE si ni él ni ningún antepasado está `hidden` o con `display:none`. */
function seVe(n) {
  for (let p = n; p; p = p._padre) {
    if (p.hidden === true) return false;
    if (p.style && p.style.display === 'none') return false;
  }
  return true;
}
const conT3 = (nodos) => nodos().filter((n) => String(n.textContent || '') === T3 && seVe(n));

test('SCRUM-1834 · 🔴 sin medio, T3 sale JUNTO al selector que recibe el foco, y en ningún otro sitio', async () => {
  const f = await ficha({ conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'] });
  assert.ok(f.sel, '🔴 CIEGO: no encuentro el selector «¿Cómo lo has cobrado?»');
  assert.ok(f.boton, '🔴 CIEGO: no encuentro «Marcar como PAGADA»');
  assert.equal(conT3(f.nodos).length, 0, '🔴 T3 se ve ANTES de pulsar');
  await pulsar(f.boton);
  const vistos = conT3(f.nodos);
  assert.equal(vistos.length, 1, `🔴 T3 se ve en ${vistos.length} sitios (esperado 1, junto al selector)`);
  const t3 = vistos[0];
  // EL CASO 390: el foco va al selector, y lo que se ve tiene que estar a su lado. Hoy está en la
  // barra de arriba (statusBox), fuera del envoltorio del selector.
  assert.equal(t3._padre, f.sel._padre, '🔴 T3 no está junto al selector: a 390 queda fuera de pantalla (barra de arriba)');
  const id = t3._id || t3.id;
  const describe = String(f.sel.getAttribute('aria-describedby') || '').split(/\s+/);
  assert.ok(id && describe.includes(id), '🔴 el selector no nombra a T3 en aria-describedby: el lector de pantalla no lo asocia');
  assert.equal(t3.getAttribute('role'), 'alert', '🔴 T3 no se anuncia (role=alert)');
  const clases = String(t3.className).split(/\s+/);
  assert.ok(clases.includes('alert') && clases.includes('error'), '🔴 T3 no es el componente de siempre (.alert.error, AB3)');
  // El candado de SCRUM-1804 sigue: ni PUT.
  assert.equal(f.llamadas.filter((l) => l.o.method === 'PUT').length, 0, '🔴 se ha mandado el PUT sin medio de cobro');
});

test('SCRUM-1834 · al elegir un medio, T3 se va (y T4 sigue a lo suyo)', async () => {
  const f = await ficha({ conIvaAlDiez: true, metodosConAvisoIvaAlDiez: ['cash'] });
  await pulsar(f.boton);
  assert.equal(conT3(f.nodos).length, 1, '🔴 CIEGO: T3 no ha salido al pulsar sin medio');
  f.sel.value = 'cash';
  f.sel.disparar('change');
  assert.equal(conT3(f.nodos).length, 0, '🔴 con el medio ya elegido, T3 sigue diciendo que elija');
  const t4 = f.nodos().find((n) => n._id === 'metodo-cobro-inv-91-aviso');
  assert.ok(t4 && t4.hidden === false, '🔴 al elegir efectivo T4 ya no sale');
});

test('SCRUM-1834 · POSITIVO: sin línea al 10 % no hay T3 en ningún sitio, ni nodo escondido', async () => {
  const f = await ficha({ conIvaAlDiez: false });
  assert.equal(f.sel, null);
  assert.equal(f.nodos().filter((n) => String(n.textContent || '') === T3).length, 0, '🔴 sin 10 % hay un nodo con T3');
  await pulsar(f.boton);
  assert.equal(f.llamadas.filter((l) => l.o.method === 'PUT').length, 1, '🔴 control: sin 10 % el PUT tiene que salir');
});
