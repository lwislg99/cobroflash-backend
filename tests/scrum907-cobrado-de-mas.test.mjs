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
// SCRUM-917e · el aviso ya no es una línea de un constructor puro: se mide MONTADO.
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

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

/** El Trabajo del DOM montado. Sin albaranes ni gastos: el aviso no puede colarse por otro sitio. */
const JOB_BASE = {
  id: 7, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'Francisco Jiménez' }, asignados: [], operario: null,
  albaranes: [], gastos: [], notes: '', quote: { currency: 'EUR' }, direccion: null, invoices: [],
};

async function montarDetalle(job) {
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    if (/\/admin\/team/.test(u)) return [];
    if (/\/admin\/merchant/.test(u)) return { name: 'Epipe' };
    if (/\/admin\/partes/.test(u)) return { partes: [] };
    if (/gastos/.test(u)) return [];
    return job;
  };
  banco.ctx.appUserRole = 'admin';
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la vista no monta (${r.error && r.error.message}). Una pantalla que no se pinta «no avisa» igual que una arreglada.`);
  return r;
}

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

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 RE-ANCLADO EN SCRUM-917e (corte D), 20-sep-2026.
//
// QUÉ SUPERFICIE DESAPARECIÓ: el aviso como LÍNEA del bloque «Dinero» del rail. Ese bloque ya no
// lleva importes —«Cobrado» y «Pendiente» se fueron a la franja del cuerpo, medido: el mismo
// «590,00 €» se leía siete veces—, y el aviso se fue con ellos: una columna de 220 px no es donde
// se explica un cobro de más.
//
// QUÉ PRINCIPIO SOBREVIVE, Y ES UN OK ESTRECHO: el aviso SE SIGUE DANDO, **con su importe
// formateado**, en las dos piezas donde el cliente lo puede leer. 🔴 NO vale rebajarlo a «el
// texto está en pantalla»: el contrato de SCRUM-887 es la línea CON la cifra, y un control más
// débil que el contrato que dice proteger es peor que no tener control — da la tranquilidad sin
// dar la garantía. (Es el error propio del corte D: su control de no-pérdida decía «sigue en
// pantalla» y pasó en verde mientras rompía nueve contratos.)
//
// DÓNDE VIVE AHORA: la sección «Qué falta para cobrar», que para eso `seccionCobroVisible`
// devuelve `true` cuando hay exceso aunque no quede ningún otro hueco. Se mide sobre el DOM
// MONTADO, no en el fuente: el cableado ya lo lee el test de abajo, y leer el fuente dos veces no
// prueba que el nodo llegue a pintarse.
test('SCRUM-907 · 🔴 la ficha PINTA el aviso con su importe formateado, y el rail ya no lo repite', async () => {
  const r = await montarDetalle({ ...JOB_BASE, totalAceptado: 539.05, totalCobrado: 628.60,
    invoices: [{ id: 1, total: 628.60, status: 'paid' }] });

  // 🔴 El literal se compara con el espacio fino inseparable NORMALIZADO: `Intl.NumberFormat`
  // mete un U+202F delante del €, y un literal tecleado a mano daría «0 apariciones» de un texto
  // que está en pantalla (trampa medida en el PASO 0 de SCRUM-917).
  const normal = (s) => String(s || '').replace(/[  ]/g, ' ').trim();
  const textos = todos(r.contenedor).map((n) => normal(n.textContent));
  assert.ok(
    textos.includes('Has cobrado 89,55 € más de lo aceptado.'),
    '🔴 EL AVISO DE COBRO DE MÁS NO ESTÁ EN LA PANTALLA CON SU IMPORTE. Se cobraron 628,60 € ' +
      'sobre 539,05 € aceptados y la franja dice «Cobrado del todo», que es verdad y no es toda ' +
      'la verdad. Textos con dinero encontrados: ' +
      JSON.stringify(textos.filter((t) => /€/.test(t)).slice(0, 8)),
  );

  // NEGATIVO: sin exceso el aviso no aparece — si no, el positivo de arriba mediría una pantalla
  // que avisa siempre.
  const ok = await montarDetalle({ ...JOB_BASE, totalAceptado: 853.05, totalCobrado: 300 });
  assert.ok(
    !todos(ok.contenedor).some((n) => /Has cobrado/.test(String(n.textContent || ''))),
    '🔴 avisa de un cobro de más que no existe.',
  );

  // Y el rail NO lo repite: el aviso se dice una vez, donde se explica.
  assert.equal(BLOQUES.bloqueDinero(trabajo(539.05, 628.60), fmt), null,
    '🔴 el bloque DINERO del rail ha vuelto a pintar el aviso (o los importes). La misma verdad ' +
      'dicha dos veces en la misma pantalla no informa: informa de que la pantalla no elige.');
  assert.ok(!BLOQUES.bloqueDinero(trabajo(100, 100.02), fmt), '🔴 el rail vuelve a hablar de dinero');
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
