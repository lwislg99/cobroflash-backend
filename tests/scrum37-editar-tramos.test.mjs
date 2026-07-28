// SCRUM-37 (mecanismo 1) — editar los tramos que QUEDAN de un plan de cobro.
//
// EL INVARIANTE VA ANTES QUE LA UI, y no es orden estético: si la pantalla fuera primero, el
// candado acabaría siendo «lo que la UI no deja pulsar», y eso se lo salta cualquier llamada a
// la API. Aquí se prueba la decisión, sin BD y sin navegador.
//
// LAS DOS CARAS, que es lo que de verdad protege este fichero:
//   · rechaza tocar un tramo YA EMITIDO (está congelado en su Invoice con su stageLabel);
//   · ACEPTA editar el siguiente, el que aún no se ha emitido.
// La segunda es la que suele faltar. Sin ella, un candado que congelara el plan entero en cuanto
// hay una factura seguiría verde — y el único que se enteraría sería el pro, justo a quien este
// ticket viene a desbloquear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validarEdicionPlan } from '../dist/modules/quotes/domain/billingPlan.js';

// Plan de tres tramos: señal 30 %, avance 40 %, final 30 % (porcentajes en FRACCIÓN).
const PLAN = [
  { percentage: 0.3, label: 'Señal' },
  { percentage: 0.4, label: 'Avance de obra' },
  { percentage: 0.3, label: 'Final' },
];

test('SCRUM-37: con la señal ya facturada, SÍ se pueden reajustar los tramos que quedan', () => {
  // El caso de uso entero: la obra crece, se cobró la señal y hay que repartir distinto el resto.
  const nuevo = [
    { percentage: 0.3, label: 'Señal' },          // intacto: ya facturado
    { percentage: 0.5, label: 'Avance de obra' }, // sube
    { percentage: 0.2, label: 'Final' },          // baja
  ];
  const r = validarEdicionPlan(PLAN, nuevo, 1);
  assert.equal(r.ok, true,
    '🔴 CANDADO DE MÁS: con una factura emitida se ha congelado TAMBIÉN lo que queda por ' +
    `facturar. Eso deja al pro sin poder reajustar su obra, que es el ticket entero. (${r.message || ''})`);
});

test('SCRUM-37: y también se puede AÑADIR un tramo nuevo al final', () => {
  const nuevo = [
    { percentage: 0.3, label: 'Señal' },
    { percentage: 0.3, label: 'Avance de obra' },
    { percentage: 0.2, label: 'Final' },
    { percentage: 0.2, label: 'Ampliación acordada' },
  ];
  assert.equal(validarEdicionPlan(PLAN, nuevo, 1).ok, true, 'una obra que crece añade tramos');
});

test('SCRUM-37: un tramo YA EMITIDO no se toca — ni su porcentaje ni su etiqueta', () => {
  const cambiaPct = [
    { percentage: 0.5, label: 'Señal' }, // ← ya facturada al 30 %
    { percentage: 0.2, label: 'Avance de obra' },
    { percentage: 0.3, label: 'Final' },
  ];
  const r1 = validarEdicionPlan(PLAN, cambiaPct, 1);
  assert.equal(r1.ok, false,
    '🔴 se ha dejado cambiar el porcentaje de un tramo ya facturado: su Invoice dice otra cosa (regla 29)');
  assert.equal(r1.error, 'tramo_emitido_intocable');
  assert.match(r1.message, /Señal/, 'el mensaje tiene que decir QUÉ tramo, no un índice');

  const cambiaLabel = [
    { percentage: 0.3, label: 'Anticipo' }, // ← la factura emitida lleva "Señal" en stageLabel
    { percentage: 0.4, label: 'Avance de obra' },
    { percentage: 0.3, label: 'Final' },
  ];
  assert.equal(validarEdicionPlan(PLAN, cambiaLabel, 1).error, 'tramo_emitido_intocable',
    'la etiqueta también está congelada: viaja en el stageLabel de la factura');
});

test('SCRUM-37: no se pueden BORRAR tramos ya facturados', () => {
  const r = validarEdicionPlan(PLAN, [{ percentage: 1, label: 'Todo' }], 2);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'tramo_emitido_intocable');
  assert.match(r.message, /2 tramo/, 'el mensaje dice cuántos hay facturados');
});

test('SCRUM-37: EL DESCUADRE SILENCIOSO — el plan suma 100 % contando lo YA EMITIDO', () => {
  // Trampa realista: el pro reparte el 100 % «de lo que queda» y se olvida de la señal cobrada.
  const soloElResto = [
    { percentage: 0.3, label: 'Señal' },
    { percentage: 0.6, label: 'Avance de obra' },
    { percentage: 0.4, label: 'Final' },
  ]; // suma 130 %
  const r = validarEdicionPlan(PLAN, soloElResto, 1);
  assert.equal(r.ok, false,
    '🔴 DESCUADRE SILENCIOSO: se ha aceptado un plan que reparte más del total. No se vería ' +
    'hasta la última factura, y para entonces hay documentos emitidos por medio (SCRUM-141).');
  assert.equal(r.error, 'plan_invalido');
});

test('SCRUM-37: sin nada emitido, el plan entero es editable', () => {
  const otro = [{ percentage: 0.5, label: 'Mitad' }, { percentage: 0.5, label: 'Resto' }];
  assert.equal(validarEdicionPlan(PLAN, otro, 0).ok, true,
    'antes de facturar nada no hay nada congelado: el plan es del pro');
});

test('SCRUM-37: entradas basura no se cuelan como plan válido', () => {
  for (const basura of [null, undefined, [], 'plan', 42, [{ percentage: 1 }], [{ label: 'x', percentage: 0 }]]) {
    assert.equal(validarEdicionPlan(PLAN, basura, 1).ok, false, `${JSON.stringify(basura)} no es un plan`);
  }
});
