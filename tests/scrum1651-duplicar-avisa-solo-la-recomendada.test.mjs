// SCRUM-1651 · DUPLICAR UN PRESUPUESTO CON VARIAS OPCIONES COPIA SÓLO LA RECOMENDADA, Y LO DICE.
//
// El editor (`renderQuotesView`) no tiene opciones: de un presupuesto de tres sólo recibe las
// líneas de la recomendada. El profesional creía tener una copia de todo. La mitad ① («que
// Duplicar arrastre las tres») NO se construye: medido el 2-nov, el servidor ignora `lines` si
// el alta lleva `tiers`, así que tiraría lo que el profesional editara (registro, tramo 1).
// Lo que entra es la ②: un aviso, visible en el editor que abre «Duplicar».
//
// Se mide en el BANCO montando las dos vistas de verdad y encadenándolas: lo que `duplicateQuote`
// le pasa al editor es lo que el editor recibe. Sin leer el fuente.
//
// Texto: decisión delegada del orquestador, SCRUM-1651 comentario 21372 (docs/microcopy/).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AVISO = 'Se duplica sólo la opción recomendada.';

const respirar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const LINEAS_RECOMENDADA = [{ concept: 'Instalación eléctrica (completa)', qty: 1, price: 900, tax: 21 }];
const TRES_OPCIONES = [
  { id: 'good', name: 'Básica', recommended: false, lines: [{ concept: 'Instalación eléctrica (básica)', qty: 1, price: 600 }] },
  { id: 'better', name: 'Completa', recommended: true, lines: LINEAS_RECOMENDADA },
  { id: 'best', name: 'Premium', recommended: false, lines: [{ concept: 'Instalación eléctrica (premium)', qty: 1, price: 1400 }] },
];

function detalleCon(tiers) {
  return {
    id: 12, number: 12, currency: 'EUR', lines: LINEAS_RECOMENDADA, tiers,
    paymentTerms: 'FULL_UPFRONT', discountGlobalAmount: null,
  };
}

function banco(detalle) {
  return cargarDashboard(RAIZ, {
    datos: (url) => {
      if (/\/admin\/merchant$/.test(url)) return { id: 7, name: 'Electricidad Pepe', country: 'ES' };
      if (/\/admin\/quotes\/\d+$/.test(url)) return detalle;
      return [];
    },
  });
}

/** Duplica de verdad y abre el editor con lo que «Duplicar» le pasa. Devuelve el editor montado. */
async function duplicarYAbrir(tiers) {
  const b = banco(detalleCon(tiers));
  const navegaciones = [];
  b.ctx.renderAppView = (vista, opciones) => { navegaciones.push({ vista, opciones }); };
  assert.equal(typeof b.ctx.duplicateQuote, 'function', '🔴 SUELO: el banco no ve `duplicateQuote`');
  await b.ctx.duplicateQuote(12);
  assert.equal(navegaciones.length, 1, '🔴 SUELO: «Duplicar» no ha abierto el editor');
  assert.equal(navegaciones[0].vista, 'quotes-new');
  const r = await pintarVista(b, 'renderQuotesView', navegaciones[0].opciones.template);
  assert.equal(r.error, null, `🔴 SUELO: el editor no monta: ${r.error && r.error.message}`);
  // Se espera a que lleguen merchant y clientes: es ahí donde `setAlert(null, "")` vaciaba el
  // aviso de «Plantilla cargada». El aviso de 1651 tiene que SEGUIR después de eso.
  await respirar(20);
  const n = todos(r.contenedor);
  const linea = n.find((x) => x.tagName === 'INPUT' && x.value === LINEAS_RECOMENDADA[0].concept);
  assert.ok(linea, '🔴 SUELO: la copia no ha cargado la línea de la recomendada (sin ella no se mide nada)');
  return n;
}

const avisosConElTexto = (n) => n.filter((x) => (x.textContent || '').trim() === AVISO);

test('SCRUM-1651 · 🔴 duplicar un presupuesto de tres opciones abre el editor DICIENDO que sólo va la recomendada', async () => {
  const n = await duplicarYAbrir(TRES_OPCIONES);
  const avisos = avisosConElTexto(n);
  assert.equal(avisos.length, 1, `🔴 el editor no lleva el aviso «${AVISO}» (o lo lleva ${avisos.length} veces)`);
  assert.equal(avisos[0].hidden, false, '🔴 el aviso está en el DOM pero OCULTO: el profesional no lo ve');
  assert.match(String(avisos[0].className), /\balert\b/, 'el aviso usa el componente de aviso de la casa');
  assert.match(String(avisos[0].className), /\bwarning\b/, 'y en su tono de aviso, no de éxito');
});

test('SCRUM-1651 · CONTROL: duplicar un presupuesto SIN opciones no avisa de nada', async () => {
  const n = await duplicarYAbrir(null);
  const visibles = avisosConElTexto(n).filter((x) => x.hidden !== true);
  assert.equal(visibles.length, 0, '🔴 avisa de opciones perdidas en un presupuesto que no tenía');
});

test('SCRUM-1651 · CONTROL: con una sola opción no se pierde nada, y no avisa', async () => {
  const n = await duplicarYAbrir([TRES_OPCIONES[1]]);
  const visibles = avisosConElTexto(n).filter((x) => x.hidden !== true);
  assert.equal(visibles.length, 0, '🔴 avisa con una sola opción, donde la copia ya es completa');
});

test('SCRUM-1651 · CONTROL: el editor abierto a pelo («Nuevo presupuesto») no avisa', async () => {
  const b = banco(detalleCon(null));
  const r = await pintarVista(b, 'renderQuotesView');
  assert.equal(r.error, null);
  await respirar(20);
  const visibles = avisosConElTexto(todos(r.contenedor)).filter((x) => x.hidden !== true);
  assert.equal(visibles.length, 0, '🔴 el editor vacío avisa de un duplicado que no existe');
});
