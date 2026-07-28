// SCRUM-37 (mec. 1) — LA REGLA DEL PLAN DICE LO MISMO EN EL FRONT Y EN EL SERVIDOR.
// Sin gate: solo lee ficheros y compara dos funciones puras. Ni BD ni red.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE TEST ES EL CORAZÓN DEL TICKET, y no el formulario
//
// La pantalla tiene que delatar el descuadre MIENTRAS se edita —no con un 409 después de
// guardar—, y para eso hay que calcular en el navegador. Eso **duplica una regla de dinero**,
// que es el patrón que ya mordió dos veces este mes: `vat_default` pisando el IVA por línea, y
// el total guardado ganando al bruto de las líneas (SCRUM-141). Dos fuentes de verdad que
// empiezan de acuerdo y se separan sin que nadie lo note.
//
// LO QUE **NO** SIRVE COMO GUARD: comprobar que el front «menciona» los emitidos, o que existe
// una variable con cierto nombre. Eso ata la forma del código, no la verdad — y pasa en verde
// el día que la fórmula cambia conservando los nombres.
//
// LO QUE SÍ: pasar las MISMAS entradas a las dos implementaciones y exigir que coincidan. Si
// alguien toca una y no la otra, este test lo dice, dé igual cómo lo haya escrito. Las dos
// hablan en las mismas unidades a propósito (`percentage` = FRACCIÓN, suma en céntimos con el
// mismo redondeo): comparar manzanas con manzanas es lo que hace posible el diferencial.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateCustomBillingPlan,
  validarEdicionPlan,
} from '../dist/modules/quotes/domain/billingPlan.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'api.js'), 'utf8');

// El front es vanilla y no se importa: se evalúa la función en un ámbito de mentira.
const planTramosEstado = (() => {
  const ini = API.indexOf('function planTramosEstado');
  const fin = API.indexOf('window.planTramosEstado');
  assert.ok(ini !== -1 && fin > ini, 'no se encontró planTramosEstado en api.js');
  // eslint-disable-next-line no-new-func
  return new Function(`${API.slice(ini, fin)}; return planTramosEstado;`)();
})();

const T = (label, pct) => ({ label, percentage: pct });

// Casos elegidos para tocar TODAS las ramas de las dos implementaciones, incluidos los bordes
// de redondeo — que es donde dos fórmulas «equivalentes» dejan de serlo.
const CASOS = [
  { que: 'plan válido de 2 tramos', plan: [T('Señal', 0.3), T('Resto', 0.7)] },
  { que: 'plan válido de 3 tramos', plan: [T('A', 0.3), T('B', 0.3), T('C', 0.4)] },
  { que: 'un solo tramo al 100 %', plan: [T('Todo', 1)] },
  { que: 'suma de menos (99 %)', plan: [T('A', 0.3), T('B', 0.69)] },
  { que: 'suma de más (101 %)', plan: [T('A', 0.5), T('B', 0.51)] },
  { que: 'el error clásico: reparte 100 % de LO QUE QUEDA', plan: [T('Señal', 0.3), T('Resto', 1)] },
  { que: 'etiqueta vacía', plan: [T('  ', 0.5), T('B', 0.5)] },
  { que: 'porcentaje cero', plan: [T('A', 0), T('B', 1)] },
  { que: 'porcentaje negativo', plan: [T('A', -0.2), T('B', 1.2)] },
  { que: 'porcentaje no numérico', plan: [T('A', 'mucho'), T('B', 0.5)] },
  { que: 'lista vacía', plan: [] },
  { que: 'decimales que redondean justo', plan: [T('A', 0.333), T('B', 0.333), T('C', 0.334)] },
  { que: 'tercios que NO cuadran', plan: [T('A', 0.333), T('B', 0.333), T('C', 0.333)] },
];

test('SCRUM-37 · front y servidor aceptan y rechazan EXACTAMENTE los mismos planes', () => {
  const discrepancias = [];
  for (const c of CASOS) {
    const back = validateCustomBillingPlan(c.plan).ok;
    const front = planTramosEstado(c.plan, 0).ok;
    if (back !== front) discrepancias.push(`«${c.que}» → servidor=${back} front=${front}`);
  }
  assert.deepEqual(
    discrepancias,
    [],
    `🔴 LAS DOS VERDADES SE HAN SEPARADO (${discrepancias.length}): ${discrepancias.join(' · ')}.\n` +
      `Es el patrón de vat_default y de SCRUM-141: la pantalla y el servidor empiezan de ` +
      `acuerdo y divergen sin que nadie lo note. El pro vería un ✓ verde y recibiría un 409 al ` +
      `guardar, o —peor— vería un error donde no lo hay y no se atrevería a reajustar.`,
  );
});

// ── El invariante de los emitidos, también en las dos ────────────────────────────────────

test('SCRUM-37 · el front cuenta los emitidos igual que el servidor', () => {
  const actual = [T('Señal', 0.3), T('Fase 1', 0.3), T('Final', 0.4)];

  // 1 tramo ya facturado: el plan puede crecer y reajustar lo que queda, pero no encoger por
  // debajo de lo emitido ni cambiar el tramo emitido.
  const casos = [
    { que: 'reajusta lo que queda (obra que crece)', nuevo: [T('Señal', 0.3), T('Fase 1', 0.2), T('Final', 0.3), T('Extra', 0.2)] },
    { que: 'toca el tramo YA facturado', nuevo: [T('Señal', 0.5), T('Fase 1', 0.2), T('Final', 0.3)] },
    { que: 'cambia la etiqueta del emitido', nuevo: [T('Anticipo', 0.3), T('Fase 1', 0.3), T('Final', 0.4)] },
    { que: 'encoge por debajo de lo emitido', nuevo: [] },
    { que: 'reajuste válido sin crecer', nuevo: [T('Señal', 0.3), T('Fase 1', 0.5), T('Final', 0.2)] },
  ];

  const discrepancias = [];
  for (const c of casos) {
    const back = validarEdicionPlan(actual, c.nuevo, 1).ok;
    // El front no compara tramo a tramo (eso lo bloquea la UI dejando los emitidos de solo
    // lectura); lo que SÍ debe coincidir es la aritmética: suma y tamaño mínimo.
    const front = planTramosEstado(c.nuevo, 1).ok;
    const soloAritmetica = !/emitido|facturad/i.test(
      (validarEdicionPlan(actual, c.nuevo, 1)).message || '',
    );
    if (soloAritmetica && back !== front) {
      discrepancias.push(`«${c.que}» → servidor=${back} front=${front}`);
    }
  }
  assert.deepEqual(discrepancias, [], `🔴 la aritmética del front y la del servidor divergen: ${discrepancias.join(' · ')}`);
});

test('SCRUM-37 · el front NO deja encoger el plan por debajo de lo ya facturado', () => {
  // La cara que más fácil se pierde: si el front dejara de contar los emitidos, este caso
  // pasaría a verde en pantalla y el pro solo se enteraría por el 409.
  const r = planTramosEstado([T('Único', 1)], 3);
  assert.equal(
    r.ok,
    false,
    '🔴 el front acepta un plan de 1 tramo habiendo 3 facturados. Esas 3 facturas existen con ' +
      'su stageLabel: el plan puede crecer hacia adelante, nunca encoger hacia atrás (regla 29).',
  );
  assert.match(r.error, /facturado/i, 'y el motivo debe decir por qué, no un error genérico');
});

// ── La suma cuenta los emitidos: el error natural del pro ────────────────────────────────

test('SCRUM-37 · repartir el 100 % «de lo que queda» se delata', () => {
  // Con la señal del 30 % ya facturada, el pro reparte 100 % entre los dos que quedan. Suma
  // 130 %. Es EL error que este ticket viene a hacer visible mientras se edita.
  const r = planTramosEstado([T('Señal', 0.3), T('Fase 1', 0.5), T('Final', 0.5)], 1);
  assert.equal(r.ok, false, '🔴 no se delata el 130 %');
  assert.equal(r.sumaPct, 130, 'y la pantalla puede decir CUÁNTO suma, no solo que está mal');
});

// ── Una sola copia en el front ───────────────────────────────────────────────────────────

test('SCRUM-37 · no hay una segunda copia de la regla en el front', () => {
  const quotesView = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesView.js'), 'utf8');
  assert.ok(
    /planTramosEstado\(/.test(quotesView),
    '🔴 `quotesView.js` (editor de SCRUM-27) ha vuelto a tener su propia copia de la regla. ' +
      'Eran dos y ahora serían tres: cada copia es una que puede separarse del servidor, y el ' +
      'test diferencial solo vigila la que está en api.js.',
  );
  assert.ok(
    !/sumCents !== 100/.test(quotesView),
    '🔴 la aritmética de la suma ha vuelto a quotesView.js en vez de delegar en api.js',
  );
});

// ── La pantalla: bloquea los emitidos, no los esconde, y manda la forma correcta ─────────

test('SCRUM-37 · el editor bloquea los emitidos CON MOTIVO y no los oculta', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesDetailView.js'), 'utf8');
  assert.ok(/ya facturado/.test(vista), '🔴 falta el motivo visible en el tramo bloqueado (patrón SCRUM-89)');
  assert.ok(
    /t\.emitido \|\| !esAdmin/.test(vista),
    '🔴 los tramos emitidos deben deshabilitarse, no filtrarse fuera de la lista: si se ocultan, ' +
      'el pro ve un plan que no suma 100 % y cree que la pantalla está rota',
  );
  assert.ok(
    !/filter\(\(t\) => !t\.emitido\)/.test(vista),
    '🔴 se están OCULTANDO los emitidos en vez de bloquearlos',
  );
});

test('SCRUM-37 · el PATCH manda `percentage`, que es lo que el servidor lee', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesDetailView.js'), 'utf8');
  // La API SIRVE `percent` y el endpoint ESPERA `percentage`. Mandar `percent` da un error que
  // parece del usuario («porcentaje mayor que 0») y es de fontanería.
  assert.ok(
    /percentage:\s*\(Number\(t\.pct\)/.test(vista),
    '🔴 el payload del PATCH no construye `percentage`. El servidor leería undefined y ' +
      'devolvería «el tramo debe tener un porcentaje mayor que 0», que suena a culpa del pro.',
  );
});

test('SCRUM-37 · guardar está deshabilitado mientras el plan no cuadre', () => {
  const vista = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'quotesDetailView.js'), 'utf8');
  assert.ok(
    /btnGuardar\.disabled = !est\.ok/.test(vista),
    '🔴 el descuadre debe delatarse MIENTRAS se edita, no con un 409 después de guardar. El 409 ' +
      'del servidor es la red, no la forma de enterarse.',
  );
});
