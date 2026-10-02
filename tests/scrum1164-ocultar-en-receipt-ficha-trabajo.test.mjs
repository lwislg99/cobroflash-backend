// tests/scrum1164-ocultar-en-receipt-ficha-trabajo.test.mjs — SCRUM-1164 (parte del panel, S4)
//
// En modo `receipt` (INVOICING_ES_ENABLED en OFF: todo merchant ES real hoy) YaQu ni factura ni
// cobra (regla 24). La ficha del Trabajo tenía cinco afirmaciones que en ese modo son falsas
// (filas A, B, C y F del censo de S0, SCRUM-1164 comentario 17240). Decisión del orquestador: se
// OCULTAN, no se reescriben. Y ocultar no es borrar: en `fiscal`/`demo` tienen que seguir saliendo.
//
// Por eso cada afirmación se mide en LOS DOS modos sobre el mismo Trabajo: si sólo se mirara
// `receipt`, una ficha que no montara o que hubiera perdido el texto para todos saldría verde.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Un Trabajo con presupuesto aceptado, un albarán FIRMADO y VALORADO sin facturar y nada cobrado:
// es el que dispara los huecos «sin facturar», el foco «Te falta por cobrar» y el chip de cobro.
const JOB = {
  id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
  customer: { id: 5, name: 'Cliente Uno', phone: null, mobile: null },
  asignados: [], operario: null, gastos: [], notes: '', invoices: [],
  quote: null, direccion: null, totalAceptado: 500, totalCobrado: 0, estadoCobro: 'Pendiente',
  tipoOperacion: 'OPERACIONES_SUELTAS',
  albaranes: [{
    id: 7, numero: 'ALB-2026-0001', estado: 'firmado', modoValoracion: 'VALORADO', facturado: false,
    fecha: '2026-09-02T09:00:00Z', lineas: [{ concepto: 'Termostato', cantidad: 1 }],
    totales: { total: 300 },
  }],
};

async function pulsar(nodo) {
  const fns = (nodo._oyentes && nodo._oyentes.click) || [];
  assert.ok(fns.length > 0, `🔴 CIEGO: «${nodo.textContent}» no tiene ningún oyente de clic`);
  await Promise.all(fns.map((fn) => fn.call(nodo, { type: 'click', target: nodo, preventDefault() {}, stopPropagation() {} })));
}

/** Monta la ficha REAL en el modo dado y devuelve el texto de todo el documento. */
async function montar(modo, { abrirAlta = false } = {}) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async () => JOB;
  banco.ctx.appUserRole = 'admin';
  banco.ctx.appModoEmision = modo;
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta en modo ${modo} (${r.error && r.error.message})`);
  const doc = banco.ctx.document;
  if (abrirAlta) {
    const btn = [...doc.querySelectorAll('button')].find((b) => String(b.textContent).trim() === '+ Nuevo albarán');
    assert.ok(btn, '🔴 CIEGO: no encuentro «+ Nuevo albarán»');
    await pulsar(btn);
    assert.ok(doc.querySelectorAll('.modal-overlay').length > 0, '🔴 CIEGO: la hoja de alta no abrió');
  }
  // Todo lo pintado, por los dos caminos que usa la vista: `textContent` y el `innerHTML` que el
  // mini-DOM guarda tal cual (los chips de la cabecera se escriben así).
  const texto = todos(doc.body).map((n) => `${n.textContent || ''} ${typeof n.innerHTML === 'string' ? n.innerHTML : ''}`).join('\n');
  return { doc, texto };
}

const AFIRMACIONES = [
  ['A · hueco', 'entregados sin facturar'],
  ['A · acción', 'Facturar lo entregado'],
  ['C · nota del tipo de trabajo', 'Nos ayuda a preparar tus facturas correctamente'],
  ['F · foco de la franja', 'Te falta por cobrar'],
];

const caso = casosEscritos(AFIRMACIONES, ([fila, literal]) => `SCRUM-1164 · ${fila}: sale en fiscal y en demo, y en receipt NO`, async ([fila, literal]) => {
  for (const modo of ['fiscal', 'demo']) {
    const { texto } = await montar(modo);
    assert.ok(texto.includes(literal), `🔴 CONTROL: en ${modo} «${literal}» tiene que seguir saliendo — ocultar no es borrar`);
  }
  const { texto } = await montar('receipt');
  assert.ok(!texto.includes(literal), `🔴 en receipt la ficha sigue afirmando «${literal}»`);
});
test('SCRUM-1164 · A · hueco: sale en fiscal y en demo, y en receipt NO', caso(0));
test('SCRUM-1164 · A · acción: sale en fiscal y en demo, y en receipt NO', caso(1));
test('SCRUM-1164 · C · nota del tipo de trabajo: sale en fiscal y en demo, y en receipt NO', caso(2));
test('SCRUM-1164 · F · foco de la franja: sale en fiscal y en demo, y en receipt NO', caso(3));
caso.todos();

test('SCRUM-1164 · F · el chip «Pendiente» sale en fiscal y en receipt NO; «Aceptado» (dato medido) sigue', async () => {
  const chip = (texto) => texto.includes('>Pendiente</span>');
  assert.ok(chip((await montar('fiscal')).texto), '🔴 CONTROL: en fiscal falta el chip de cobro «Pendiente»');
  const { texto } = await montar('receipt');
  assert.ok(!chip(texto), '🔴 en receipt sigue el chip «Pendiente»: el cobrado por YaQu no se mueve nunca de 0');
  assert.ok(texto.includes('Aceptado'), '🔴 en receipt se ha callado también el DATO medido «Aceptado», y sólo había que callar el derivado');
});

test('SCRUM-1164 · B · la nota «…y puedes facturarlo» de la hoja de alta: en fiscal sí, en receipt NO', async () => {
  const literal = 'Tú sigues viendo los precios y puedes facturarlo.';
  assert.ok((await montar('fiscal', { abrirAlta: true })).texto.includes(literal), '🔴 CONTROL: en fiscal la nota tiene que salir');
  assert.ok(!(await montar('receipt', { abrirAlta: true })).texto.includes(literal), '🔴 en receipt la hoja sigue prometiendo facturar');
});

test('SCRUM-1164 · con el modo DESCONOCIDO (null) no se calla nada: ocultar es sólo para `receipt`', async () => {
  const { texto } = await montar(null);
  assert.ok(texto.includes('Te falta por cobrar'), '🔴 con el modo sin saber se ha ocultado el foco: el criterio es `=== receipt`');
});
