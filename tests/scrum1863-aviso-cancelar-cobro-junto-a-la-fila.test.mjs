// tests/scrum1863-aviso-cancelar-cobro-junto-a-la-fila.test.mjs — SCRUM-1863 (puesto S2, 25-nov-2026)
//
// Hallazgo de la r42 en vivo de SCRUM-1808b (yaqu.app, 25-nov, 390 px): «Cancelar cobro» vive en el «⋯»
// de la fila de la factura, abajo de la ficha del trabajo; sus errores iban a la barra de estado de ARRIBA
// (`setStatus`) y, tras el 409 `document_already_paid`, el aviso quedaba en top −100 con scrollY 592: el
// usuario no veía nada. Arreglo: espejo de T3 (SCRUM-1834) — un `p.alert.error[role=alert]` DENTRO de la
// fila de esa factura, delante de sus acciones.
//
// Literales FIRMADOS (SCRUM-1532 c.22430 / c.22455; el del 409, SCRUM-1800 c.22496 ①). Aquí se copian SOLO
// para compararlos byte a byte. SCRUM-1863 no cambia ni añade ningún texto: cambia DÓNDE se pinta.
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
    de: 'acts.parentNode.insertBefore(errorCancelar, acts);',
    a: '',
    cae: 'SCRUM-1863 · 🔴 cada error de «Cancelar cobro» se pinta DENTRO de la fila de su factura, con role=alert, y no en la barra de arriba',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: "errorCancelar.setAttribute('role', 'alert');",
    a: '',
    cae: 'SCRUM-1863 · 🔴 cada error de «Cancelar cobro» se pinta DENTRO de la fila de su factura, con role=alert, y no en la barra de arriba',
  },
  {
    fichero: 'public/dashboard/js/jobDetailView.js',
    de: 'if (!errorCancelar) {',
    a: 'if (true) {',
    cae: 'SCRUM-1863 · un segundo fallo REESCRIBE el aviso de la fila: nunca dos avisos apilados',
  },
];

const BOTON = 'Cancelar cobro';
const YA_NO_PENDIENTE = 'Este cobro ya no está pendiente.';
const YA_PAGADO = 'Este documento ya consta como pagado: su cobro no se puede cancelar.';
const GENERICO = 'Error actualizando estado: inténtalo de nuevo';
const NUMERO = 'F-2026-1863';

function trabajo() {
  return {
    id: 1863, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'ZZ caldera',
    customer: { id: 5, name: 'ZZCLIENTE Ejemplo', phone: '34000000001', mobile: null },
    asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
    quote: null, direccion: null, totalAceptado: 100, totalCobrado: 0, estadoCobro: 'Pendiente',
    tipoOperacion: 'OPERACIONES_SUELTAS',
    invoices: [{
      id: 863, number: NUMERO, status: 'pending', type: 'F1', total: 100, currency: 'EUR',
      createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: 1863, payToken: 'tok-1863',
      stageLabel: null, rectifiesId: null, envioDocumento: null, estadoDelCobro: 'pending',
    }],
  };
}

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} })));
}

/** Monta la ficha; cada POST de cancelar falla con el siguiente cuerpo de `fallos`. */
async function ficha(fallos) {
  const banco = cargarDashboard(RAIZ);
  const job = trabajo();
  const cola = [...fallos];
  banco.ctx.apiRequest = async (u, o) => {
    if (o && o.method === 'POST' && /\/admin\/charges\/1863\/cancel$/.test(String(u))) {
      const e = new Error('fallo'); e.data = cola.shift(); throw e;
    }
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.confirm = () => true;
  const r = await pintarVista(banco, 'renderJobDetailView', 1863);
  assert.equal(r.error, null, `🔴 SUELO: la ficha del trabajo no monta (${r.error && r.error.message})`);
  const body = banco.ctx.document.body;
  const texto = (n) => String(n.textContent || '').trim();
  const clases = (n) => String(n.className || '').split(/\s+/);
  // La fila de la factura: el `.job-doc-row` que contiene sus acciones (el trabajo lleva UNA factura).
  // Se busca subiendo por `parentNode`: el banco no da `textContent` a lo que nace de un `innerHTML`, así
  // que buscarla por su número la deja CIEGA (medido al escribir este test).
  const acts = todos(body).find((n) => clases(n).includes('jobdet-inv-actions'));
  assert.ok(acts, '🔴 CIEGO: no encuentro las acciones de la factura');
  let fila = acts;
  while (fila && !clases(fila).includes('job-doc-row')) fila = fila.parentNode;
  assert.ok(fila, '🔴 CIEGO: las acciones de la factura no cuelgan de ningún .job-doc-row');
  const abrirMenu = async () => {
    const k = todos(acts).find((n) => clases(n).includes('overflow-trigger'));
    if (k) await pulsar(k);
  };
  const boton = () => todos(body).find((n) => n.tagName === 'BUTTON' && texto(n) === BOTON) || null;
  const conTexto = (t) => todos(body).filter((n) => texto(n) === t && !todos(n).some((h) => h !== n && texto(h) === t));
  const dentroDeLaFila = (n) => { for (let p = n; p; p = p.parentNode) if (p === fila) return true; return false; };
  return { body, fila, abrirMenu, boton, conTexto, dentroDeLaFila, clases };
}

test('SCRUM-1863 · 🔴 cada error de «Cancelar cobro» se pinta DENTRO de la fila de su factura, con role=alert, y no en la barra de arriba', async () => {
  const casos = [
    [{ error: 'charge_not_pending' }, YA_NO_PENDIENTE],
    [{ error: 'document_already_paid' }, YA_PAGADO],
    [{ error: 'internal_error', message: 'TEXTO CRUDO DEL SERVIDOR' }, GENERICO],
  ];
  for (const [fallo, literal] of casos) {
    const f = await ficha([fallo]);
    // CONTROL POSITIVO del instrumento `dentroDeLaFila`: «Marcar como PAGADA», buscado desde el body y no
    // desde la fila, SÍ está en ella; el body (que contiene la barra de estado de arriba) NO.
    const marcar = f.conTexto('Marcar como PAGADA')[0];
    assert.ok(marcar && f.dentroDeLaFila(marcar), '🔴 CONTROL POSITIVO: el instrumento no ve dentro de la fila');
    assert.equal(f.dentroDeLaFila(f.body), false, '🔴 CONTROL NEGATIVO: el instrumento cree que el body está en la fila');
    await f.abrirMenu();
    const b = f.boton();
    assert.ok(b, '🔴 CIEGO: no encuentro «Cancelar cobro»');
    await pulsar(b);
    const avisos = f.conTexto(literal);
    assert.equal(avisos.length, 1, `🔴 con ${fallo.error} el literal «${literal}» sale ${avisos.length} veces (debe salir UNA)`);
    const a = avisos[0];
    assert.ok(f.dentroDeLaFila(a), `🔴 con ${fallo.error} el aviso NO está en la fila de la factura (a 390 queda fuera de pantalla: r42 de SCRUM-1808b)`);
    assert.equal(a.getAttribute('role'), 'alert', `🔴 con ${fallo.error} el aviso no es role=alert (el lector de pantalla no lo anuncia)`);
    assert.ok(f.clases(a).includes('alert') && f.clases(a).includes('error'), '🔴 el aviso no es un `.alert.error` del inventario AB3');
    assert.notEqual(a.hidden, true, '🔴 el aviso existe pero está escondido');
    assert.equal(b.disabled, false, '🔴 tras un fallo el botón se queda deshabilitado');
  }
});

test('SCRUM-1863 · un segundo fallo REESCRIBE el aviso de la fila: nunca dos avisos apilados', async () => {
  const f = await ficha([{ error: 'document_already_paid' }, { error: 'charge_not_pending' }]);
  await f.abrirMenu();
  await pulsar(f.boton());
  assert.equal(f.conTexto(YA_PAGADO).length, 1, '🔴 CIEGO: el primer fallo no pinta su aviso');
  await f.abrirMenu();
  await pulsar(f.boton());
  assert.equal(f.conTexto(YA_PAGADO).length, 0, '🔴 tras el segundo fallo sigue el aviso del primero');
  assert.equal(f.conTexto(YA_NO_PENDIENTE).length, 1, '🔴 el segundo fallo no pinta su aviso');
  const enLaFila = (n) => f.dentroDeLaFila(n) && n.getAttribute && n.getAttribute('role') === 'alert';
  const alertas = [];
  (function recorrer(n) { for (const h of n.children || []) { if (enLaFila(h)) alertas.push(h); recorrer(h); } })(f.fila);
  assert.equal(alertas.length, 1, `🔴 la fila apila ${alertas.length} avisos tras dos fallos`);
});
