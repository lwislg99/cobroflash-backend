// tests/scrum1781b-prefijo-en-alta-y-ajustes.test.mjs — SCRUM-1781b
//
// EL PREFIJO APARTE, CON +34 PRESELECCIONADO, EN LAS TRES PANTALLAS DE J3 QUE PIDEN UN WHATSAPP
//
// Orden del fundador (SCRUM-1781): «Cuando se une un nuevo merchant y le pueda poner número de
// whatsapp tiene que salir el prefijo a parte para seleccionar y preseleccionado el +34 español.
// También cuando crees clientes». Clientes → «Nuevo cliente» ya lo tenía (SCRUM-578/590, carril J2;
// medido en c.22259). Aquí van las tres de J3:
//
//   · alta del comercio, paso 1, «Tu WhatsApp»       (`onboardingView.js`, `#ob-phone`)
//   · alta del comercio, primer cliente, «Su WhatsApp» (`onboardingView.js`, `#ob-cust-phone`)
//   · Configuración → WhatsApp del comercio            (`settingsView.js`, `whatsappPhone`)
//
// Se EJECUTA, no se lee: el banco de vistas carga los scripts reales del panel en orden. Y lo que
// se compara no es contra una cadena escrita aquí, sino contra LO QUE GUARDA CLIENTES con el mismo
// prefijo y lo mismo tecleado: «el formato guardado es el mismo que en Clientes» se mide en las dos
// pantallas a la vez, así que si una de las dos cambia de regla, cae.
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

const NACIONAL = tramoNacionalDePrueba(10000001);
const COMPLETO = telefonoDePrueba(10000001); // '34' + NACIONAL

/**
 * Los casos: el prefijo elegido y lo que teclea el profesional. Tres comportamientos distintos:
 * España por defecto, el número pegado CON su prefijo (no se duplica) y otro país.
 */
const CASOS = [
  { prefijo: '34', tecleado: NACIONAL },
  { prefijo: '34', tecleado: COMPLETO },
  { prefijo: '52', tecleado: NACIONAL },
];

/** El `<select>` de prefijo que comparte fila con `input`, o falla diciendo qué hay. */
function selectorJuntoA(input, donde) {
  assert.ok(input, `🔴 CIEGO: no encuentro el campo del teléfono en ${donde}`);
  const fila = input._padre;
  assert.ok(fila && String(fila.className).split(/\s+/).includes('campo-telefono'),
    `🔴 ${donde}: el teléfono no va en una fila .campo-telefono con su prefijo (como en Clientes)`);
  const sel = fila.hijos.filter((n) => n.tagName === 'SELECT' && String(n.className).split(/\s+/).includes('prefijo-pais'));
  assert.equal(sel.length, 1, `🔴 ${donde}: esperaba UN selector .prefijo-pais junto al teléfono y hay ${sel.length}`);
  assert.ok(sel[0].hijos.length > 100,
    `🔴 CIEGO: el selector de ${donde} tiene ${sel[0].hijos.length} opciones; no es el de prefijosPais.js (222)`);
  return sel[0];
}

// ─── Clientes (J2) · la referencia: lo que guarda «Nuevo cliente» en el móvil (WhatsApp) ───────
async function loQueGuardaClientes({ prefijo, tecleado }) {
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
  return JSON.parse(alta.opciones.body).mobile;
}

// ─── Alta del comercio (J3) ─────────────────────────────────────────────────────────────────
function montarAsistente() {
  const peticiones = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      peticiones.push({ url, cuerpo: opts?.body ? JSON.parse(opts.body) : null });
      return /\/admin\/products$/.test(url) ? [] : {};
    },
  });
  assert.equal(typeof banco.ctx.showOnboardingWizard, 'function', '🔴 CIEGO: el panel no publica showOnboardingWizard');
  const abiertos = [];
  banco.ctx.openQuickQuoteModal = (datos) => { abiertos.push(datos); };
  banco.ctx.showOnboardingWizard(() => {});
  const id = (x) => banco.reg.porId.get(x) || null;
  const pulsar = async (x) => {
    const n = id(x);
    assert.ok(n, `🔴 CIEGO: no existe #${x}`);
    for (const f of n._oyentes.click || []) await f.call(n, { type: 'click', target: n, preventDefault() {}, stopPropagation() {} });
  };
  return { banco, id, pulsar, peticiones, abiertos };
}

async function loQueGuardaElAltaDelComercio({ prefijo, tecleado }) {
  const a = montarAsistente();
  const sel = selectorJuntoA(a.id('ob-phone'), 'el alta (Tu WhatsApp)');
  assert.equal(sel.value, '34', '🔴 el alta no abre con +34 preseleccionado');
  a.id('ob-name').value = 'Fontanería Pepe';
  sel.value = prefijo;
  a.id('ob-phone').value = tecleado;
  await a.pulsar('ob-next');
  const conTelefono = a.peticiones.filter((p) => p.cuerpo && 'whatsappPhone' in p.cuerpo);
  assert.equal(conTelefono.length, 1, `🔴 CIEGO: el paso 1 mandó ${conTelefono.length} guardados con whatsappPhone`);
  return { guardado: conTelefono[0].cuerpo.whatsappPhone, a };
}

async function loQueLlevaElPrimerCliente({ prefijo, tecleado }) {
  const a = montarAsistente();
  a.id('ob-name').value = 'Fontanería Pepe';
  await a.pulsar('ob-next');
  // Hasta el último paso: el que pinta su propio pie (#ob-wow). Tope, para no colgarse.
  for (let i = 0; i < 6 && !a.id('ob-wow'); i++) {
    if (a.id('ob-serie-no')) await a.pulsar('ob-serie-no');
    await a.pulsar('ob-next');
  }
  assert.ok(a.id('ob-wow'), '🔴 CIEGO: no llegué al paso del primer cliente');
  const sel = selectorJuntoA(a.id('ob-cust-phone'), 'el primer cliente (Su WhatsApp)');
  assert.equal(sel.value, '34', '🔴 el primer cliente no abre con +34 preseleccionado');
  sel.value = prefijo;
  a.id('ob-cust-phone').value = tecleado;
  await a.pulsar('ob-wow');
  assert.equal(a.abiertos.length, 1, '🔴 CIEGO: «Enviar mi primera cotización» no abrió el presupuesto');
  return a.abiertos[0].customerPhone;
}

// ─── Configuración (J3) ─────────────────────────────────────────────────────────────────────
async function montarConfiguracion(whatsappPhone) {
  const puts = [];
  const banco = cargarDashboard(RAIZ, {
    datos: (url, opts) => {
      if (!/\/admin\/merchant$/.test(url)) return [];
      if (opts && opts.method === 'PUT') { puts.push(JSON.parse(opts.body)); return {}; }
      return { name: 'Pepe', legalName: 'Pepe SL', taxId: 'B00000000', address: 'C/ Falsa 1', whatsappPhone, defaultCurrency: 'EUR' };
    },
  });
  const r = await pintarVista(banco, 'renderSettingsView');
  assert.equal(r.error, null, `🔴 CIEGO: Configuración no se monta: ${r.error && r.error.message}`);
  await respiro();
  const nodos = todos(r.contenedor);
  const campos = nodos.filter((n) => n.tagName === 'INPUT' && n.name === 'whatsappPhone');
  assert.equal(campos.length, 1, `🔴 CIEGO: esperaba UN campo whatsappPhone en Configuración y hay ${campos.length}`);
  const input = campos[0];
  const sel = selectorJuntoA(input, 'Configuración');
  const guardar = async () => {
    const form = nodos.find((n) => n._oyentes && (n._oyentes.submit || []).length);
    assert.ok(form, '🔴 CIEGO: no encuentro el formulario de Configuración');
    await form._oyentes.submit[0]({ preventDefault() {} });
    await respiro();
    assert.equal(puts.length, 1, '🔴 CIEGO: guardar no mandó un PUT');
    return puts.pop().whatsappPhone;
  };
  return { input, sel, guardar };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1781b · ① el alta del comercio: prefijo aparte, +34, y guarda lo mismo que Clientes', async () => {
  let medidos = 0;
  for (const c of CASOS) {
    const ref = await loQueGuardaClientes(c);
    assert.ok(ref && /^\d+$/.test(ref), `🔴 CIEGO: Clientes guardó «${ref}»`);
    const { guardado } = await loQueGuardaElAltaDelComercio(c);
    assert.equal(guardado, ref, `🔴 alta con +${c.prefijo} y «${c.tecleado}»: guarda «${guardado}», Clientes «${ref}»`);
    medidos++;
  }
  assert.equal(medidos, CASOS.length);
});

test('SCRUM-1781b · ② el primer cliente del alta: prefijo aparte, +34, y lleva lo mismo que Clientes', async () => {
  let medidos = 0;
  for (const c of CASOS) {
    const ref = await loQueGuardaClientes(c);
    const lleva = await loQueLlevaElPrimerCliente(c);
    assert.equal(lleva, ref, `🔴 primer cliente con +${c.prefijo} y «${c.tecleado}»: lleva «${lleva}», Clientes «${ref}»`);
    medidos++;
  }
  assert.equal(medidos, CASOS.length);
});

test('SCRUM-1781b · ③ Configuración: prefijo aparte, +34 sin número, y guarda lo mismo que Clientes', async () => {
  // Sin número guardado: España.
  const vacio = await montarConfiguracion('');
  assert.equal(vacio.sel.value, '34', '🔴 Configuración sin número no preselecciona +34');
  assert.equal(vacio.input.value, '');

  let medidos = 0;
  for (const c of CASOS) {
    const ref = await loQueGuardaClientes(c);
    const p = await montarConfiguracion('');
    p.sel.value = c.prefijo;
    p.input.value = c.tecleado;
    const guardado = await p.guardar();
    assert.equal(guardado, ref, `🔴 Configuración con +${c.prefijo} y «${c.tecleado}»: guarda «${guardado}», Clientes «${ref}»`);
    medidos++;
  }
  assert.equal(medidos, CASOS.length);
});

test('SCRUM-1781b · ④ Configuración reparte lo guardado y, sin tocar nada, lo devuelve IGUAL', async () => {
  const GUARDADOS = [COMPLETO, '52' + NACIONAL];
  for (const g of GUARDADOS) {
    const p = await montarConfiguracion(g);
    const esperado = g.startsWith('52') ? '52' : '34';
    assert.equal(p.sel.value, esperado, `🔴 «${g}» se abre con +${p.sel.value}, no con +${esperado}`);
    assert.equal(p.input.value, g.slice(esperado.length), `🔴 «${g}» no se reparte: el campo enseña «${p.input.value}»`);
    assert.equal(await p.guardar(), g, `🔴 guardar sin tocar nada ha cambiado «${g}»`);
  }
  // Uno que no empieza por ningún prefijo conocido se deja ENTERO (la regla de Clientes).
  const raro = await montarConfiguracion('0' + NACIONAL);
  assert.equal(raro.sel.value, '34');
  assert.equal(raro.input.value, '0' + NACIONAL);
});

test('SCRUM-1781b · ⑤ el alta, al volver ATRÁS, reparte lo tecleado y no duplica el prefijo', async () => {
  const { a } = await loQueGuardaElAltaDelComercio({ prefijo: '52', tecleado: NACIONAL });
  await a.pulsar('ob-back');
  const sel = selectorJuntoA(a.id('ob-phone'), 'el alta al volver');
  assert.equal(sel.value, '52', '🔴 al volver, el prefijo elegido se ha perdido');
  assert.equal(a.id('ob-phone').value, NACIONAL, '🔴 al volver, el número sale con el prefijo dentro');
});
