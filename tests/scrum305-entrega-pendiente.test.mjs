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

import { resumenEntrega, COPY_ENTREGA, fraseDeCuenta } from '../dist/modules/jobs/domain/entregaPendiente.js';

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

/** Los cinco textos FIRMADOS por el asesor el 5-ago-2026. Retocarlos es decisión suya. */
const COPY_FIRMADA = {
  hay_adicionales: 'Este trabajo tiene presupuestos adicionales. Todavía no podemos decir qué queda por entregar.',
  sin_presupuesto: 'Este trabajo no tiene presupuesto con el que comparar lo entregado.',
  nada_atribuible: 'Las líneas entregadas no salen del presupuesto, así que no podemos calcular qué queda.',
  sinAtribuir: {
    singular: 'línea entregada que no sale del presupuesto',
    plural: 'líneas entregadas que no salen del presupuesto',
  },
  enPartesSinFirmar: {
    singular: 'línea en un albarán sin firmar, que todavía no cuenta como entregada',
    plural: 'líneas en albaranes sin firmar, que todavía no cuentan como entregadas',
  },
};

test('SCRUM-305 · la copy FIRMADA está, ranura a ranura, y el marcador se ha retirado', () => {
  for (const motivo of ['hay_adicionales', 'sin_presupuesto', 'nada_atribuible']) {
    assert.equal(COPY_ENTREGA[motivo], COPY_FIRMADA[motivo],
      `🔴 LA RANURA «${motivo}» YA NO DICE SU TEXTO FIRMADO.\n` +
      `     firmado:  ${JSON.stringify(COPY_FIRMADA[motivo])}\n` +
      `     y ahora:  ${JSON.stringify(COPY_ENTREGA[motivo])}\n\n` +
      '  Lo firmó el asesor: cambiarlo —aunque sea una letra— es decisión suya.');
  }
  for (const cuenta of ['sinAtribuir', 'enPartesSinFirmar']) {
    assert.deepEqual({ ...COPY_ENTREGA[cuenta] }, COPY_FIRMADA[cuenta],
      `🔴 la ranura «${cuenta}» ya no dice sus dos formas firmadas`);
  }
  assert.equal(JSON.stringify(COPY_ENTREGA).includes(MARCA), false,
    '🔴 queda un marcador en una copy YA FIRMADA: se despliega tal cual y se lee en producción.');
});

test('SCRUM-305 · 🔴 nunca «(s)»: singular y plural son frases distintas, y el número decide', () => {
  // «1 línea(s)» es una cadena que delata que la escribió un programa, y quien la lee es un
  // fontanero, no un formulario. Aquí cambia el sustantivo Y el verbo, así que se alterna la frase
  // entera — mismo criterio con el que SCRUM-303 quitó su `línea(s)`.
  assert.equal(fraseDeCuenta('sinAtribuir', 1), '1 línea entregada que no sale del presupuesto');
  assert.equal(fraseDeCuenta('sinAtribuir', 3), '3 líneas entregadas que no salen del presupuesto');
  assert.equal(fraseDeCuenta('enPartesSinFirmar', 1),
    '1 línea en un albarán sin firmar, que todavía no cuenta como entregada');
  assert.equal(fraseDeCuenta('enPartesSinFirmar', 2),
    '2 líneas en albaranes sin firmar, que todavía no cuentan como entregadas');
  assert.equal(fraseDeCuenta('sinAtribuir', 0), '0 líneas entregadas que no salen del presupuesto',
    '🔴 el cero va en plural en español: «0 líneas», no «0 línea»');

  assert.equal(/\((s|es|a|as)\)/i.test(JSON.stringify(COPY_ENTREGA)), false,
    '🔴 ha vuelto el «(s)». No es una abreviatura: es una cadena que delata que la escribió un ' +
    'programa, en un aviso que lee alguien con el móvil en la mano y las manos sucias.');

  // Y la concordancia es de VERDAD: pegarle una «s» al singular no habría cambiado el verbo
  // («que no sale» → «que no salen»), que es justo lo que hace falta y lo que el «(s)» no da.
  for (const cuenta of ['sinAtribuir', 'enPartesSinFirmar']) {
    assert.notEqual(COPY_ENTREGA[cuenta].plural, COPY_ENTREGA[cuenta].singular + 's',
      `🔴 el plural de «${cuenta}» es el singular + «s»: entonces el verbo no concuerda y estamos ` +
      'en el mismo sitio que con el «(s)», solo que disimulado.');
  }
});

test('SCRUM-305 · en pantalla se dice «albarán», no «parte»', () => {
  // Ese objeto se llama Albarán en el menú, en el listado global y en la tabla del Trabajo. Un
  // segundo nombre para la misma cosa se lo cobra al profesional, y no hay motivo.
  const copy = JSON.stringify(COPY_ENTREGA).toLowerCase();
  assert.equal(/\bpartes?\b/.test(copy), false,
    '🔴 la copy vuelve a decir «parte». En pantalla ese documento es un ALBARÁN; «parte» vale para ' +
    'hablar entre nosotros, no para la pantalla.');
  assert.match(copy, /albar[aá]n/, '🔴 la frase de los partes sin firmar ya no nombra el albarán');
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
