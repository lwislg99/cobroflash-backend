// tests/scrum907-cobrado-de-mas.test.mjs — SCRUM-907 (D2 de SCRUM-883).
//
// Si se cobra MÁS de lo aceptado, la ficha del Trabajo decía «Te falta por cobrar 0,00 €» y el rail
// «Pendiente 0,00 €», sin ningún aviso: `Math.max(0, aceptado − cobrado)` escondía el exceso.
// Medido en SCRUM-883 (C3): cobrado 628,60 € sobre 539,05 € aceptados.
//
// DECIDIDO (SCRUM-907): aviso si lo cobrado supera lo aceptado en MÁS de 0,02 € —el margen de
// redondeo ya aceptado en SCRUM-141—, en las DOS piezas (la sección «Qué falta para cobrar» y el
// bloque «Dinero» del rail). Literal firmado por delegación (SCRUM-887, comentario 15697, L4):
// «Has cobrado {importe} más de lo aceptado.»
//
// El cálculo es puro y se ejecuta aquí; lo que se lee del fuente es solo el cableado del render.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { soloEjecutable } from './_guard-texto.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(import.meta.url);
const G5 = require_(path.join(RAIZ, 'public/dashboard/js/jobCobroHuecos.js'));
const BLOQUES = require_(path.join(RAIZ, 'public/dashboard/js/jobRailBlocks.js'));
const VISTA = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8'), { almohadillaEsComentario: false });

const fmt = (n) => `${Number(n).toFixed(2).replace('.', ',')} €`;
/** Un Trabajo sin huecos: todo facturado y pagado. Así el aviso no puede colarse por otro motivo. */
const trabajo = (aceptado, cobrado) => ({
  totalAceptado: aceptado,
  totalCobrado: cobrado,
  albaranes: [],
  invoices: [{ id: 1, total: cobrado, status: 'paid' }],
});

test('SCRUM-907 · el literal firmado, carácter a carácter', () => {
  assert.equal(G5.avisoCobradoDeMas('89,55 €'), 'Has cobrado 89,55 € más de lo aceptado.');
});

test('SCRUM-907 · 🔴 cobrado > aceptado + 0,02 € → hay exceso, en céntimos exactos', () => {
  // El caso medido en SCRUM-883: 628,60 sobre 539,05.
  assert.equal(G5.importesDeCobro(trabajo(539.05, 628.60)).cobradoDeMas, 89.55);
  // Justo por encima del margen: 3 céntimos SÍ avisan.
  assert.equal(G5.importesDeCobro(trabajo(100, 100.03)).cobradoDeMas, 0.03);
  // Y lo que se enseña hoy no cambia: la fila «Te falta por cobrar» sigue en 0.
  assert.equal(G5.importesDeCobro(trabajo(539.05, 628.60)).faltaPorCobrar, 0);
});

test('SCRUM-907 · NEGATIVO: una diferencia de 1-2 céntimos NO avisa (margen de SCRUM-141)', () => {
  assert.equal(G5.importesDeCobro(trabajo(100, 100.01)).cobradoDeMas, 0);
  assert.equal(G5.importesDeCobro(trabajo(100, 100.02)).cobradoDeMas, 0);
  // Coma flotante: 0,1 + 0,2 no es 0,3, y eso no puede convertirse en un aviso de un céntimo.
  assert.equal(G5.importesDeCobro(trabajo(0.3, 0.1 + 0.2)).cobradoDeMas, 0);
});

test('SCRUM-907 · POSITIVO: cobrado ≤ aceptado → sin aviso, y los importes de siempre', () => {
  const i = G5.importesDeCobro(trabajo(853.05, 300));
  assert.equal(i.cobradoDeMas, 0);
  assert.equal(i.faltaPorCobrar, 853.05 - 300);
  assert.equal(G5.importesDeCobro(trabajo(100, 100)).cobradoDeMas, 0);
  // Sin importe aceptado no hay nada contra lo que medir (misma regla que «Pendiente», SCRUM-363).
  assert.equal(G5.importesDeCobro(trabajo(0, 300)).cobradoDeMas, 0);
});

test('SCRUM-907 · 🔴 la sección «Qué falta para cobrar» se pinta aunque no haya huecos, si se ha cobrado de más', () => {
  assert.deepEqual(G5.huecosDeCobro(trabajo(539.05, 628.60)), [], 'CONTROL: el caso no tiene huecos');
  assert.equal(G5.seccionCobroVisible(trabajo(539.05, 628.60)), true,
    '🔴 sin huecos la sección no se pinta, y el aviso de cobro de más no llegaría a verse');
  assert.equal(G5.seccionCobroVisible(trabajo(100, 100.02)), false, '🔴 un redondeo de 2 céntimos saca la sección');
  assert.equal(G5.seccionCobroVisible(trabajo(100, 100)), false, '🔴 todo cobrado y cuadrado ya no esconde la sección');
});

test('SCRUM-907 · 🔴 el bloque «Dinero» del rail lleva el aviso como línea, con el importe formateado', () => {
  const b = BLOQUES.bloqueDinero(trabajo(539.05, 628.60), fmt);
  const aviso = b.lineas.find((l) => l.aviso === true);
  assert.ok(aviso, '🔴 el rail no avisa del cobro de más');
  assert.equal(aviso.texto, 'Has cobrado 89,55 € más de lo aceptado.');
  // «Pendiente» sigue como hoy.
  assert.equal(b.lineas.find((l) => l.etiqueta === 'Pendiente').texto, '0,00 €');
  // NEGATIVO y POSITIVO en el rail.
  assert.ok(!BLOQUES.bloqueDinero(trabajo(100, 100.02), fmt).lineas.some((l) => l.aviso), '🔴 avisa por 2 céntimos');
  assert.ok(!BLOQUES.bloqueDinero(trabajo(853.05, 300), fmt).lineas.some((l) => l.aviso), '🔴 avisa sin cobro de más');
});

test('SCRUM-907 · 🔴 la ficha PINTA los dos avisos (cableado del render)', () => {
  const desde = VISTA.indexOf('function pintarQueFaltaParaCobrar(');
  const cuerpo = VISTA.slice(desde, VISTA.indexOf('\nfunction ', desde + 10));
  assert.match(cuerpo, /i\.cobradoDeMas\s*>\s*0/, '🔴 «Qué falta para cobrar» no mira el cobro de más');
  assert.match(cuerpo, /avisoCobradoDeMas\(\s*fmt\(\s*i\.cobradoDeMas\s*,\s*moneda\s*\)\s*\)/,
    '🔴 «Qué falta para cobrar» no pinta el literal con el importe formateado');
  const rail = VISTA.slice(VISTA.indexOf('function pintarBloqueRail('));
  assert.match(rail.slice(0, rail.indexOf('\nfunction ', 10)), /linea\.aviso/, '🔴 el rail no distingue la línea de aviso');
});
