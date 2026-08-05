// tests/scrum305-entrega-pendiente.test.mjs — SCRUM-305 (C6)
//
// «QUEDAN 3»: qué falta por entregar contra el presupuesto firmado. Lo que este fichero deja
// demostrado, en el orden en que importa:
//
//   ① EL ROJO OBLIGATORIO — quitar el enlace de una línea cambia EL NÚMERO **y** sube la cuenta de
//      no atribuidas. Si solo cambia una de las dos, el resumen no está diciendo lo que creemos.
//   ② CON ADICIONALES NO HAY NÚMERO. Un «quedan 3» calculado solo contra el original en un Trabajo
//      con adicionales dice que queda MENOS de lo que queda: el profesional cierra la obra creyendo
//      que lo entregó todo.
//   ③ EL NÚMERO NUNCA SALE SOLO: lo no contado viaja con él, siempre, también cuando no hay número.
//   ④ SOLO CUENTA LO FIRMADO. Un borrador no es una entrega; un emitido es una entrega sin
//      confirmar. Contar de más encoge el «quedan», que es la dirección peligrosa.
//   ⑤ ESTE MÓDULO NO ES EL DE FACTURACIÓN, y no lo importa. Dos ejes, dos preguntas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { resumenEntrega, COPY_ENTREGA } from '../dist/modules/jobs/domain/entregaPendiente.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const F_DOMINIO = path.join(RAIZ, 'src', 'modules', 'jobs', 'domain', 'entregaPendiente.ts');
const MARCA = '[PENDIENTE microcopy oficial]';

// ── LA OBRA DE PRUEBA ────────────────────────────────────────────────────────────────────
//
// Presupuesto de tres partidas y dos partes firmados que entregan a medias. Es el caso de una obra
// por fases, que es donde C6 sirve para algo.

const PRESUPUESTO = [
  { concept: 'Bajante de PVC', qty: 12, price: 30, tax: 0.21 },
  { concept: 'Grifería monomando', qty: 4, price: 90, tax: 0.21 },
  { concept: 'Alicatado', qty: 20, price: 45, tax: 0.21 },
];

/** Dos partes FIRMADOS: 9 de 12 de la bajante, 4 de 4 de grifería, nada de alicatado. */
const FIRMADOS = () => [
  {
    estado: 'firmado', modoValoracion: 'SIN_VALORAR',
    lineas: [
      { concepto: 'Bajante de PVC', cantidad: 5, unidad: 'ud', quoteLineIndex: 0 },
      { concepto: 'Grifería monomando', cantidad: 4, unidad: 'ud', quoteLineIndex: 1 },
    ],
  },
  {
    estado: 'firmado', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Bajante de PVC', cantidad: 4, unidad: 'ud', quoteLineIndex: 0 }],
  },
];

const base = (extra = {}) => ({
  lineasPresupuestoOriginal: PRESUPUESTO,
  hayAdicionales: false,
  albaranes: FIRMADOS(),
  ...extra,
});

// ── ① 🔴 EL ROJO OBLIGATORIO ─────────────────────────────────────────────────────────────

test('SCRUM-305 · ① 🔴 quitar el enlace de UNA línea cambia el número Y sube lo no atribuido', () => {
  const antes = resumenEntrega(base());
  assert.equal(antes.calculable, true);
  assert.equal(antes.lineas[0].pendiente, 3, '🔴 la obra de prueba no da «quedan 3» de la bajante');
  assert.equal(antes.sinAtribuir, 0);

  // Se le quita el enlace a la línea de 4 unidades del segundo parte. Sigue entregada, sigue
  // firmada: lo único que se pierde es SABER a qué partida del presupuesto pertenece.
  const albaranes = FIRMADOS();
  delete albaranes[1].lineas[0].quoteLineIndex;
  const despues = resumenEntrega(base({ albaranes }));

  assert.equal(despues.calculable, true);
  assert.notEqual(despues.lineas[0].pendiente, antes.lineas[0].pendiente,
    '🔴 EL NÚMERO NO SE HA MOVIDO al perder un enlace. Entonces no se está calculando con los ' +
    'enlaces, y «quedan 3» sale de otra cosa.');
  assert.equal(despues.lineas[0].pendiente, 7, '🔴 sin esas 4 unidades atribuidas, quedan 7 de 12');
  assert.equal(despues.sinAtribuir, antes.sinAtribuir + 1,
    '🔴 LA CUENTA DE NO ATRIBUIDAS NO HA SUBIDO. El número cambió y nadie dice por qué: eso es ' +
    'exactamente «quedan 7 y no ha pasado nada más», una afirmación que nadie ha comprobado.');

  // Las DOS cosas a la vez. Si solo se moviera una, el resumen mentiría por omisión.
  assert.ok(despues.lineas[0].pendiente > antes.lineas[0].pendiente && despues.sinAtribuir > antes.sinAtribuir,
    '🔴 el número y lo no contado tienen que moverse JUNTOS: son las dos mitades de la misma frase');
});

// ── ② CON ADICIONALES, NO HAY NÚMERO ─────────────────────────────────────────────────────

test('SCRUM-305 · ② 🔴 con presupuestos ADICIONALES no se da número, y se dice por qué', () => {
  const r = resumenEntrega(base({ hayAdicionales: true }));
  assert.equal(r.calculable, false,
    '🔴 SE ESTÁ DANDO UN NÚMERO EN UN TRABAJO CON ADICIONALES.\n\n' +
    '  El índice de línea apunta al presupuesto ORIGINAL y no dice de cuál es, así que ese número\n' +
    '  sale FALSO en la dirección peligrosa: dice que queda MENOS de lo que queda, y el\n' +
    '  profesional cierra la obra creyendo que lo ha entregado todo.');
  assert.equal(r.motivo, 'hay_adicionales');
  assert.equal('pendienteTotal' in r, false, '🔴 el informe no calculable sigue trayendo un total');

  // Y es la PRIMERA puerta: da igual lo bien que cuadre todo lo demás.
  const perfecto = resumenEntrega({
    lineasPresupuestoOriginal: PRESUPUESTO,
    hayAdicionales: true,
    albaranes: [{ estado: 'firmado', modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'x', cantidad: 12, quoteLineIndex: 0 }] }],
  });
  assert.equal(perfecto.calculable, false, '🔴 con todo enlazado y firmado, los adicionales siguen mandando');
});

// ── ③ EL NÚMERO NUNCA SALE SOLO ──────────────────────────────────────────────────────────

test('SCRUM-305 · ③ lo NO CONTADO viaja siempre: con número y sin él', () => {
  const conNumero = resumenEntrega(base());
  for (const campo of ['sinAtribuir', 'enPartesSinFirmar', 'albaranesValorados']) {
    assert.equal(typeof conNumero[campo], 'number', `🔴 falta «${campo}» en el informe CON número`);
  }
  const sinNumero = resumenEntrega(base({ hayAdicionales: true }));
  for (const campo of ['sinAtribuir', 'enPartesSinFirmar', 'albaranesValorados']) {
    assert.equal(typeof sinNumero[campo], 'number',
      `🔴 falta «${campo}» en el informe SIN número. «No puedo contestar» también tiene que decir ` +
      'qué se ha quedado fuera: si no, se lee como «no pasa nada más».');
  }
});

test('SCRUM-305 · ③ el albarán VALORADO no da número: ahí el enlace no se escribe NUNCA', () => {
  // Medido en el prellenado: en VALORADO devuelve cero líneas porque `validarLineas` exige precio
  // en todas y el presupuesto llega sin él. Así que sus líneas se teclean, y sin enlace.
  const r = resumenEntrega(base({
    albaranes: [{
      estado: 'firmado', modoValoracion: 'VALORADO',
      lineas: [{ concepto: 'Bajante de PVC', cantidad: 9, unidad: 'm', precioUnitario: 30, tipoIva: 21 }],
    }],
  }));
  assert.equal(r.calculable, false, '🔴 se está dando número sobre entregas que no se pueden atribuir');
  assert.equal(r.motivo, 'nada_atribuible');
  assert.equal(r.sinAtribuir, 1);
  assert.equal(r.albaranesValorados, 1,
    '🔴 el informe no dice que el parte era VALORADO, que es LA razón de que no haya enlaces');

  // Y el contraste: sin ninguna entrega, «queda todo» sí es una respuesta buena.
  const vacio = resumenEntrega(base({ albaranes: [] }));
  assert.equal(vacio.calculable, true, '🔴 un Trabajo sin partes todavía debe poder decir que queda todo');
  assert.equal(vacio.pendienteTotal, 36);
});

// ── ④ SOLO CUENTA LO FIRMADO ─────────────────────────────────────────────────────────────

test('SCRUM-305 · ④ un parte SIN FIRMAR no descuenta, y se declara aparte', () => {
  const albaranes = FIRMADOS();
  albaranes.push({
    estado: 'emitido', modoValoracion: 'SIN_VALORAR',
    lineas: [{ concepto: 'Alicatado', cantidad: 20, unidad: 'm2', quoteLineIndex: 2 }],
  });
  const r = resumenEntrega(base({ albaranes }));

  assert.equal(r.lineas[2].pendiente, 20,
    '🔴 UN PARTE EMITIDO Y SIN FIRMAR HA DESCONTADO. Contar de más encoge el «quedan», que es la ' +
    'dirección peligrosa: el cliente todavía no ha confirmado esa entrega.');
  assert.equal(r.enPartesSinFirmar, 1,
    '🔴 lo que vive en partes sin firmar no se declara: el pro no sabe que hay 20 m esperando firma');

  // Y al firmarlo, descuenta y deja de estar pendiente de firma. Sin esto, el assert de arriba
  // pasaría igual con un módulo que no cuenta NADA.
  albaranes[2].estado = 'firmado';
  const firmado = resumenEntrega(base({ albaranes }));
  assert.equal(firmado.lineas[2].pendiente, 0, '🔴 al firmar, la entrega no descuenta');
  assert.equal(firmado.enPartesSinFirmar, 0);
});

test('SCRUM-305 · entregar de MÁS no da negativo: no queda nada, y no se inventa un −8', () => {
  const r = resumenEntrega(base({
    albaranes: [{ estado: 'firmado', modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'x', cantidad: 20, quoteLineIndex: 0 }] }],
  }));
  assert.equal(r.lineas[0].entregada, 20);
  assert.equal(r.lineas[0].pendiente, 0, '🔴 «quedan −8» no es una frase que nadie pueda usar');
});

test('SCRUM-305 · un enlace que no es un entero ≥ 0 NO se usa: cuenta como no atribuida', () => {
  // El servidor valida el rango al guardar, pero este módulo recibe Json y no se fía: un índice
  // basura atribuiría cantidades a la partida equivocada, que es peor que no atribuirlas.
  for (const malo of ['0', -1, 1.5, null, undefined, {}]) {
    const r = resumenEntrega(base({
      albaranes: [{ estado: 'firmado', modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'x', cantidad: 5, quoteLineIndex: malo }] }],
    }));
    assert.equal(r.calculable, false, `🔴 el enlace basura ${JSON.stringify(malo)} se ha usado como índice`);
    assert.equal(r.sinAtribuir, 1);
  }
});

// ── ⑤ DOS EJES, DOS MÓDULOS ──────────────────────────────────────────────────────────────

test('SCRUM-305 · ⑤ este módulo NO importa el de facturación: son preguntas distintas', () => {
  const sf = ts.createSourceFile('x.ts', fs.readFileSync(F_DOMINIO, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = sf.statements
    .filter((s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier))
    .map((s) => s.moduleSpecifier.text);
  assert.deepEqual(imports.filter((m) => /albaranFacturacion/.test(m)), [],
    '🔴 EL EJE DE ENTREGA HA EMPEZADO A IMPORTAR EL DE FACTURACIÓN.\n\n' +
    '  `pendientePorLinea` contesta cuánto queda por FACTURAR de lo servido; esto contesta cuánto\n' +
    '  queda por ENTREGAR de lo presupuestado. Reutilizarlo por parecerse es volver a tener dos\n' +
    '  fuentes de verdad para dos preguntas que no se contestan igual.');
  assert.deepEqual(imports, [], '🔴 este módulo era PURO: no importaba nada. Revisa qué ha entrado.');
});

// ── MICROCOPY ────────────────────────────────────────────────────────────────────────────

test('SCRUM-305 · todo lo que se vería lleva marcador, y hay una frase por motivo', () => {
  const motivos = ['hay_adicionales', 'sin_presupuesto', 'nada_atribuible'];
  for (const m of motivos) {
    assert.ok(typeof COPY_ENTREGA[m] === 'string' && COPY_ENTREGA[m].startsWith(MARCA),
      `🔴 el motivo «${m}» no tiene frase marcada. Un motivo sin texto llega a la pantalla como un ` +
      'código, y un código en la cara del profesional no explica nada.');
  }
  for (const [ranura, texto] of Object.entries(COPY_ENTREGA)) {
    assert.ok(texto.startsWith(MARCA),
      `🔴 «${ranura}» ha perdido el marcador: es microcopy SIN APROBAR (regla 30) hasta que la firme el asesor.`);
  }
  // Y las dos cuentas de lo no contado también tienen su frase: el número no puede salir solo.
  assert.ok(COPY_ENTREGA.sinAtribuir && COPY_ENTREGA.enPartesSinFirmar,
    '🔴 falta la frase de alguna de las dos cuentas de lo no contado');
});

test('SCRUM-305 · el número va DESNUDO: aquí no se inventa una unidad', () => {
  // Medido: la línea de presupuesto no tiene campo de unidad y la del albarán la exige, con `'ud'`
  // por defecto y editable. «Quedan 3», nunca «quedan 3 metros».
  const r = resumenEntrega(base());
  assert.equal('unidad' in r.lineas[0], false,
    '🔴 el informe trae una unidad. El presupuesto no tiene ninguna con la que contrastarla: la del ' +
    'albarán es texto libre que el profesional puede cambiar sin que nada se entere.');
  const copy = Object.values(COPY_ENTREGA).join(' ');
  assert.equal(/\b(metros|unidades|horas|m2|m²)\b/i.test(copy), false,
    '🔴 la microcopy nombra una unidad concreta, y este módulo no sabe cuál es');
});
