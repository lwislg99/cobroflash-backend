// SCRUM-367 · CADA LÍNEA DE ALBARÁN ATADA A SU LÍNEA DE PRESUPUESTO.
//
// Sin gate: `validarLineas` es puro y se importa de `dist/`; el prellenado se lee del front. Ni BD,
// ni red, ni navegador.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL PUNTO EXACTO DONDE SE PERDÍA
//
// `validarLineas` **reconstruye cada línea campo a campo**, así que se comía cualquier extra. Se
// podía guardar el índice al crear y desaparecía **en la primera edición**, en silencio: el
// mecanismo se quedaba verde y vacío, y C6 respondería «no queda nada por entregar» sobre una
// correspondencia que ya no existe.
//
// Por eso EL test de este ticket no es «se guarda»: es **«sobrevive a la edición»**.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarLineas } from '../dist/modules/jobs/domain/albaran.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const linea = (extra = {}) => ({ concepto: 'Bajante PVC 110', cantidad: 3, unidad: 'm', ...extra });

test('SCRUM-367 · SUELO: `validarLineas` acepta una línea normal y devuelve lo que se le dio', () => {
  const v = validarLineas([linea()], 'SIN_VALORAR');
  assert.ok(v.ok, `🔴 ESCÁNER CIEGO: la línea base ni siquiera valida (${v.error}). Todos los tests ` +
    'de abajo estarían midiendo un rechazo, no la conservación del índice.');
  assert.equal(v.lineas.length, 1);
  assert.equal(v.lineas[0].concepto, 'Bajante PVC 110');
});

test('SCRUM-367 · EL TEST: el `quoteLineIndex` SOBREVIVE a la edición', () => {
  // Primera pasada: se crea con origen.
  const creada = validarLineas([linea({ quoteLineIndex: 4 })], 'SIN_VALORAR');
  assert.ok(creada.ok, `🔴 no valida al crear: ${creada.error}`);
  assert.equal(
    creada.lineas[0].quoteLineIndex, 4,
    '🔴 el índice se pierde YA al crear: `validarLineas` reconstruye la línea campo a campo y se ' +
      'come el campo nuevo.',
  );

  // Segunda pasada: la línea guardada vuelve a pasar por el validador — que es lo que ocurre en
  // CADA edición del albarán. Aquí es donde desaparecía.
  const editada = validarLineas(creada.lineas, 'SIN_VALORAR');
  assert.ok(editada.ok, `🔴 no valida al editar: ${editada.error}`);
  assert.equal(
    editada.lineas[0].quoteLineIndex, 4,
    '🔴 EL ÍNDICE SE PIERDE AL EDITAR.\n\n' +
      '  Es el fallo mudo que este ticket existe para cerrar: el albarán se guarda igual, nadie ve\n' +
      '  un error, y la línea deja de saber de qué partida del presupuesto salió. C6 respondería\n' +
      '  «no queda nada por entregar» sobre una correspondencia que ya no existe.',
  );

  // Y una tercera, porque un albarán se edita más de una vez.
  const otraVez = validarLineas(editada.lineas, 'SIN_VALORAR');
  assert.equal(otraVez.lineas[0].quoteLineIndex, 4, '🔴 se pierde a la tercera pasada');
});

test('SCRUM-367 · una línea SIN origen es válida: es la añadida en obra', () => {
  const v = validarLineas([linea()], 'SIN_VALORAR');
  assert.ok(v.ok, `🔴 una línea sin \`quoteLineIndex\` debería valer: ${v.error}`);
  assert.equal(
    v.lineas[0].quoteLineIndex, undefined,
    '🔴 se inventa un origen para una línea que no lo tenía. La AUSENCIA es el dato: distingue lo ' +
      'añadido en obra de lo que venía del presupuesto, que es justo lo que SCRUM-257 no pudo hacer.',
  );
  // Mezcladas en el mismo albarán, cada una conserva lo suyo.
  const mixto = validarLineas([linea({ quoteLineIndex: 0 }), linea({ concepto: 'Codo 90º extra' })], 'SIN_VALORAR');
  assert.equal(mixto.lineas[0].quoteLineIndex, 0, '🔴 el índice 0 se pierde (`0` es falsy: familia SCRUM-271)');
  assert.equal(mixto.lineas[1].quoteLineIndex, undefined, '🔴 la línea de obra hereda un origen que no tiene');
});

test('SCRUM-367 · un enlace ROTO se rechaza, nunca se guarda como si fuera bueno', () => {
  // Fuera de rango: el presupuesto tiene 3 líneas (índices 0..2).
  const fuera = validarLineas([linea({ quoteLineIndex: 7 })], 'SIN_VALORAR', 3);
  assert.equal(
    fuera.ok, false,
    '🔴 se acepta un `quoteLineIndex` que no existe en el presupuesto. Un enlace roto es PEOR que ' +
      'ningún enlace, porque C6 se lo creería y respondería sobre la partida equivocada.',
  );
  assert.match(String(fuera.error), /quoteLineIndex 7 no existe/, '🔴 el error no dice cuál es el índice malo');

  // Dentro de rango sí entra.
  const dentro = validarLineas([linea({ quoteLineIndex: 2 })], 'SIN_VALORAR', 3);
  assert.ok(dentro.ok, `🔴 ESCÁNER CIEGO: el último índice válido se rechaza (${dentro.error}) — ` +
    'entonces el test de arriba pasaba porque se rechaza TODO, no porque discrimine.');
  assert.equal(dentro.lineas[0].quoteLineIndex, 2);

  // Y basura de forma, siempre.
  for (const malo of [-1, 1.5, 'dos', {}, []]) {
    const v = validarLineas([linea({ quoteLineIndex: malo })], 'SIN_VALORAR');
    assert.equal(v.ok, false, `🔴 se acepta quoteLineIndex=${JSON.stringify(malo)}`);
  }
});

test('SCRUM-367 · familia SCRUM-271: un origen ausente no se convierte en el índice 0', () => {
  // `Number('')` es 0. Si el vacío se convirtiera antes de descartarse, una línea añadida en obra
  // quedaría atada a la PRIMERA partida del presupuesto — y silenciosamente.
  for (const vacio of ['', null, undefined]) {
    const v = validarLineas([linea({ quoteLineIndex: vacio })], 'SIN_VALORAR');
    assert.ok(v.ok, `🔴 quoteLineIndex=${JSON.stringify(vacio)} debería tratarse como ausente`);
    assert.equal(
      v.lineas[0].quoteLineIndex, undefined,
      `🔴 quoteLineIndex=${JSON.stringify(vacio)} se convirtió en ${v.lineas[0].quoteLineIndex}: una ` +
        'línea de obra quedaría atada a la primera partida del presupuesto, en silencio.',
    );
  }
});

test('SCRUM-367 · el prellenado ata al índice de ORIGEN, no al de salida', () => {
  const front = leer('public/dashboard/js/jobDetailView.js');
  // El prellenado DESCARTA las líneas que no pueden ser línea de albarán, así que las dos listas se
  // desalinean en cuanto se cae una. Usar la posición de salida ataría la línea 3 del albarán a la
  // 3 del presupuesto cuando en realidad es la 4 — un enlace desplazado, peor que ninguno.
  // ⚠️ Recorte con LOS DOS EXTREMOS comprobados. La primera versión buscaba el siguiente
  // `\nfunction ` y lo siguiente es `async function`, así que el final salía -1 y `slice(i, -1)`
  // se habría tragado el fichero entero — un rojo (o un verde) sobre código que no es el medido.
  const i = front.indexOf('function lineasDeQuoteParaAlbaran');
  assert.ok(i >= 0, '🔴 ESCÁNER CIEGO: no se encuentra `lineasDeQuoteParaAlbaran`. ¿Se renombró?');
  const j = front.indexOf('async function renderJobDetailView', i + 1);
  assert.ok(j > i, '🔴 ESCÁNER CIEGO: no se encuentra el FINAL del recorte. Sin los dos extremos el ' +
    'guard mediría un trozo de fichero que no es el prellenado.');
  const cuerpo = front.slice(i, j);
  assert.ok(cuerpo.length > 200 && cuerpo.length < 3000,
    `🔴 ESCÁNER CIEGO: el recorte mide ${cuerpo.length} caracteres — no es el cuerpo de la función.`);

  assert.ok(
    /for \(let i = 0; i < lines\.length; i\+\+\)/.test(cuerpo),
    '🔴 el prellenado volvió a iterar sin índice: no puede atar la línea a su origen.',
  );
  assert.ok(
    /quoteLineIndex: i\b/.test(cuerpo),
    '🔴 el prellenado no ata `quoteLineIndex` al índice del PRESUPUESTO.',
  );
  assert.ok(
    !/out\.length/.test(cuerpo),
    '🔴 el índice sale de la lista de SALIDA, no de la de entrada: con una línea descartada, todas ' +
      'las siguientes quedarían atadas a la partida equivocada.',
  );
});

test('SCRUM-367 · las rutas validan el rango contra el presupuesto REAL, no contra el cliente', () => {
  for (const [f, ruta] of [
    ['src/modules/jobs/app/routes/jobs.routes.ts', 'creación'],
    ['src/modules/jobs/app/routes/albaranes.routes.ts', 'edición'],
  ]) {
    const txt = leer(f);
    assert.ok(
      /contarLineasDePresupuesto\(/.test(txt),
      `🔴 la ruta de ${ruta} no cuenta las líneas del presupuesto: el rango de \`quoteLineIndex\` ` +
        'se estaría creyendo lo que manda el cliente.',
    );
    assert.ok(
      /validarLineas\([^)]*nLineasQuote\)/.test(txt),
      `🔴 la ruta de ${ruta} cuenta las líneas pero no se las pasa al validador: mide y no usa.`,
    );
  }
});

test('SCRUM-367 · NO se ha tocado prisma/schema.prisma', () => {
  // `Albaran.lineas` ya es `Json`, así que el campo cabe sin migración. Si hubiera hecho falta
  // tocar el schema, este ticket paraba: es dominio exclusivo del fundador y cambiaría el coste de
  // la decisión.
  const schema = leer('prisma/schema.prisma');
  assert.ok(
    !/quoteLineIndex/.test(schema),
    '🔴 `quoteLineIndex` ha aparecido en `prisma/schema.prisma`. Este ticket se decidió PORQUE no ' +
      'hacía falta migración; si ahora hace falta, para y repórtalo.',
  );
  assert.ok(
    /lineas\s+Json/.test(schema),
    '🔴 ESCÁNER CIEGO: `Albaran.lineas` ya no es `Json` — la premisa entera del ticket («cabe sin ' +
      'migración») ha dejado de ser cierta.',
  );
});
