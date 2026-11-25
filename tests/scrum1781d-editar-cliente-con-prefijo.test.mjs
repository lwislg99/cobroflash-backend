// tests/scrum1781d-editar-cliente-con-prefijo.test.mjs — SCRUM-1781d
//
// «EDITAR CLIENTE» (FICHA DEL CLIENTE) CON EL PREFIJO APARTE, COMO «NUEVO CLIENTE»
//
// Decisión del fundador: SCRUM-1781 c.22392 («1-Ok todos si», a la pregunta 2 de c.22259). Revisa
// la decisión de SCRUM-590 que dejaba esta pantalla sin selector. Y firma del rótulo: c.22402
// («1-OK Sí»): «Teléfono (E.164 sin +)» pasa a «Teléfono», solo QUITAR.
//
// Se EJECUTA, no se lee: el banco de vistas monta la ficha 360 real, pulsa «Editar» y pulsa
// «Guardar cambios». Lo que se compara no es una cadena escrita aquí: es LO QUE GUARDA «NUEVO
// CLIENTE» (customersView.js) con el mismo prefijo y lo mismo tecleado. Si una de las dos pantallas
// cambia de regla, cae.
//
// ⛔ Ningún número real: rango imposible `340…` (SCRUM-262, `_telefonos-prueba.mjs`).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { telefonoDePrueba, tramoNacionalDePrueba } from '../scripts/_telefonos-prueba.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const respiro = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

const NACIONAL = tramoNacionalDePrueba(10000002);
const COMPLETO = telefonoDePrueba(10000002); // '34' + NACIONAL
const MEXICO = '52' + NACIONAL;

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «Vuelve a pedir la cadena entera»: el guardado ignora el selector y manda lo tecleado tal cual.
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: "    const phone = numeroConPrefijo($('#e360-phone'), selPrefijoTelefono);\n",
    a: "    const phone = $('#e360-phone').value.trim();\n",
    cae: 'cambiar solo el número guarda lo que guardaría «Nuevo cliente»',
  },
  {
    // Al abrir ya no se reparte: el campo enseña la cadena entera con el prefijo dentro.
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: "  repartirConPrefijo(customer.phone || '', $('#e360-phone'), selPrefijoTelefono);\n",
    a: "  $('#e360-phone').value = customer.phone || '';\n",
    cae: 'al abrir, el número guardado se parte en prefijo + resto',
  },
  {
    // Vuelve el rótulo de antes de la firma c.22402.
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: '<div class="field"><label>Teléfono</label><input type="text" id="e360-phone"/></div>',
    a: '<div class="field"><label>Teléfono (E.164 sin +)</label><input type="text" id="e360-phone"/></div>',
    cae: 'el rótulo es «Teléfono», sin «(E.164 sin +)»',
  },
];

const CASOS = [
  { prefijo: '34', tecleado: NACIONAL },
  { prefijo: '34', tecleado: COMPLETO },
  { prefijo: '52', tecleado: NACIONAL },
];

const BASE = {
  id: 7811, name: 'Cliente QA 1781d', email: 'qa1781d@example.test', notes: '', portalToken: null,
  createdAt: '2026-11-01T00:00:00.000Z', waOptOut: false, taxId: null, legalName: null, companyId: null,
  contactKind: 'PERSONA', tipoDestinatario: null, billingPeriodicity: 'NINGUNA',
};

/** El `<select>` de prefijo que comparte fila con `input`, o falla diciendo qué hay. */
function selectorJuntoA(input, donde) {
  assert.ok(input, `🔴 CIEGO: no encuentro el campo ${donde}`);
  const fila = input._padre;
  assert.ok(fila && String(fila.className).split(/\s+/).includes('campo-telefono'),
    `🔴 ${donde}: no va en una fila .campo-telefono con su prefijo (como en «Nuevo cliente»)`);
  const sel = fila.hijos.filter((n) => n.tagName === 'SELECT' && String(n.className).split(/\s+/).includes('prefijo-pais'));
  assert.equal(sel.length, 1, `🔴 ${donde}: esperaba UN selector .prefijo-pais junto al campo y hay ${sel.length}`);
  assert.ok(sel[0].hijos.length > 100,
    `🔴 CIEGO: el selector de ${donde} tiene ${sel[0].hijos.length} opciones; no es el de prefijosPais.js`);
  return sel[0];
}

/** Monta la ficha 360 con `customer`, pulsa «Editar» y devuelve los controles y `guardar()`. */
async function abrirEditar(customer) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opciones) => {
      const u = String(url || '');
      peticiones.push({ url: u, opciones });
      if (/\/admin\/customers\/\d+\/detail$/.test(u)) {
        return { customer, quotes: [], invoices: [], events: [], stats: { totalQuotes: 0, acceptedQuotes: 0, totalBilled: 0, totalPaid: 0, totalExpenses: 0, profit: 0 } };
      }
      if (/\/admin\/customers\/\d+$/.test(u)) return { ...customer };
      return [];
    },
  });
  assert.deepEqual(banco.fallos, [], '🔴 CIEGO: un script del panel no cargó');
  const r = await pintarVista(banco, 'renderCustomer360View', customer.id);
  assert.equal(r.error, null, `🔴 CIEGO: la ficha 360 no montó: ${r.error && r.error.message}`);
  const porId = (id) => todos(banco.ctx.document.body).find((n) => n.id === id) || null;
  const editar = porId('btn-edit-360');
  assert.ok(editar && typeof editar.onclick === 'function', '🔴 CIEGO: no encuentro «Editar» en la ficha 360');
  editar.onclick();
  const phone = porId('e360-phone');
  const mobile = porId('e360-mobile');
  assert.ok(phone && mobile, '🔴 CIEGO: pulsar «Editar» no abrió el modal con Teléfono y Móvil');
  const guardar = async () => {
    const btn = porId('e360-save');
    assert.ok(btn && typeof btn.onclick === 'function', '🔴 CIEGO: el modal no tiene «Guardar cambios»');
    await btn.onclick();
    await respiro();
    const put = peticiones.find((p) => p.opciones?.method === 'PUT' && /\/admin\/customers\/\d+$/.test(p.url));
    assert.ok(put, '🔴 CIEGO: guardar no produjo un PUT');
    return JSON.parse(put.opciones.body);
  };
  const modal = todos(banco.ctx.document.body).find((n) => String(n.className || '').split(/\s+/).includes('c360-editar-cuerpo'));
  return {
    phone, mobile, guardar, modal,
    selPhone: selectorJuntoA(phone, 'Teléfono'),
    selMobile: selectorJuntoA(mobile, 'Móvil (WhatsApp)'),
  };
}

/** La referencia: lo que guarda «Nuevo cliente» en el móvil con ese prefijo y ese tecleado. */
async function loQueGuardaNuevoCliente({ prefijo, tecleado }) {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opciones) => {
      peticiones.push({ url: String(url || ''), opciones });
      return url && /\/admin\/customers$/.test(String(url)) ? { id: 1, name: 'Cliente' } : [];
    },
  });
  const r = await pintarVista(banco, 'renderCustomersView');
  assert.equal(r.error, null, `🔴 CIEGO: Clientes no montó: ${r.error && r.error.message}`);
  banco.ctx.altaClienteModal.abrirNuevo({});
  const nodos = todos(banco.ctx.document.body);
  const uno = (nombre) => {
    const n = nodos.filter((x) => x.name === nombre);
    assert.equal(n.length, 1, `🔴 CIEGO: esperaba UN control \`${nombre}\` en Clientes y hay ${n.length}`);
    return n[0];
  };
  uno('name').value = 'Reformas Ejemplo SL';
  uno('prefijoPaisMovil').value = prefijo;
  uno('mobile').value = tecleado;
  const form = nodos.filter((n) => n.tagName === 'FORM' && (n._oyentes.submit || []).length);
  assert.equal(form.length, 1, '🔴 CIEGO: no encuentro el formulario de Clientes');
  form[0].disparar('submit');
  await respiro();
  const alta = peticiones.find((p) => /\/admin\/customers$/.test(p.url) && p.opciones?.method === 'POST');
  assert.ok(alta, '🔴 CIEGO: Clientes no mandó el alta');
  const ref = JSON.parse(alta.opciones.body).mobile;
  assert.ok(ref && /^\d+$/.test(ref), `🔴 CIEGO: «Nuevo cliente» guardó «${ref}»`);
  return ref;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1781d · al abrir, el número guardado se parte en prefijo + resto', async () => {
  const e = await abrirEditar({ ...BASE, phone: COMPLETO, mobile: MEXICO });
  assert.equal(e.selPhone.value, '34', `🔴 «${COMPLETO}» se abre con +${e.selPhone.value}, no con +34`);
  assert.equal(e.phone.value, NACIONAL, `🔴 el Teléfono enseña «${e.phone.value}», no «${NACIONAL}»`);
  assert.equal(e.selMobile.value, '52', `🔴 «${MEXICO}» se abre con +${e.selMobile.value}, no con +52`);
  assert.equal(e.mobile.value, NACIONAL, `🔴 el Móvil enseña «${e.mobile.value}», no «${NACIONAL}»`);
});

test('SCRUM-1781d · sin número guardado, +34 preseleccionado; uno que no casa se deja ENTERO con +34', async () => {
  const vacio = await abrirEditar({ ...BASE, phone: null, mobile: null });
  assert.equal(vacio.selPhone.value, '34');
  assert.equal(vacio.selMobile.value, '34');
  assert.equal(vacio.phone.value, '');
  assert.equal(vacio.mobile.value, '');
  // Ningún prefijo de país empieza por 0: es el caso «no casa» (la regla de «Nuevo cliente»).
  const raro = await abrirEditar({ ...BASE, phone: '0' + NACIONAL, mobile: null });
  assert.equal(raro.selPhone.value, '34');
  assert.equal(raro.phone.value, '0' + NACIONAL);
});

test('SCRUM-1781d · guardar sin tocar nada devuelve el MISMO número (ida y vuelta sin pérdida)', async () => {
  for (const [phone, mobile] of [[COMPLETO, MEXICO], [MEXICO, COMPLETO]]) {
    const e = await abrirEditar({ ...BASE, phone, mobile });
    const cuerpo = await e.guardar();
    assert.equal(cuerpo.phone, phone, `🔴 guardar sin tocar nada cambió el Teléfono «${phone}» → «${cuerpo.phone}»`);
    assert.equal(cuerpo.mobile, mobile, `🔴 guardar sin tocar nada cambió el Móvil «${mobile}» → «${cuerpo.mobile}»`);
  }
});

test('SCRUM-1781d · cambiar solo el número guarda lo que guardaría «Nuevo cliente»', async () => {
  let medidos = 0;
  for (const c of CASOS) {
    const ref = await loQueGuardaNuevoCliente(c);
    const e = await abrirEditar({ ...BASE, phone: COMPLETO, mobile: COMPLETO });
    e.selPhone.value = c.prefijo;
    e.phone.value = c.tecleado;
    e.selMobile.value = c.prefijo;
    e.mobile.value = c.tecleado;
    const cuerpo = await e.guardar();
    assert.equal(cuerpo.phone, ref, `🔴 Teléfono con +${c.prefijo} y «${c.tecleado}»: guarda «${cuerpo.phone}», «Nuevo cliente» «${ref}»`);
    assert.equal(cuerpo.mobile, ref, `🔴 Móvil con +${c.prefijo} y «${c.tecleado}»: guarda «${cuerpo.mobile}», «Nuevo cliente» «${ref}»`);
    medidos++;
  }
  assert.equal(medidos, CASOS.length);
});

test('SCRUM-1781d · cliente sin móvil: el móvil NO viaja (SCRUM-590)', async () => {
  const e = await abrirEditar({ ...BASE, phone: COMPLETO, mobile: null });
  const cuerpo = await e.guardar();
  assert.ok(!Object.prototype.hasOwnProperty.call(cuerpo, 'mobile'),
    `🔴 un cliente sin móvil manda «mobile: ${JSON.stringify(cuerpo.mobile)}»: el prefijo solo no es un móvil`);
  assert.equal(cuerpo.phone, COMPLETO, '🔴 CIEGO: el positivo (el Teléfono sí viaja) no está');
});

test('SCRUM-1781d · el rótulo es «Teléfono», sin «(E.164 sin +)» (firma c.22402)', async () => {
  const e = await abrirEditar({ ...BASE, phone: COMPLETO, mobile: null });
  assert.ok(e.modal, '🔴 CIEGO: no encuentro el cuerpo del modal');
  const rotulos = todos(e.modal).filter((n) => n.tagName === 'LABEL').map((n) => String(n.textContent || '').trim());
  assert.ok(rotulos.includes('Móvil (WhatsApp)'), `🔴 CIEGO: el lector de rótulos no ve «Móvil (WhatsApp)»: ${JSON.stringify(rotulos)}`);
  assert.ok(rotulos.includes('Teléfono'), `🔴 no hay rótulo «Teléfono»: ${JSON.stringify(rotulos)}`);
  assert.ok(!rotulos.some((t) => t.includes('E.164 sin +')), `🔴 sigue «(E.164 sin +)»: ${JSON.stringify(rotulos)}`);
});
