// SCRUM-1022c · LA PANTALLA DE IMPORTAR DICE LO FIRMADO, NO UNO PARECIDO.
//
// El servidor lee `.xlsx` desde SCRUM-1022 (#1723) y la pantalla no lo ofrecía. Ahora lo ofrece con
// tres textos firmados en SCRUM-1022 comentario 17016 (registro:
// docs/microcopy/2026-09-25-SCRUM-1022-importar-xlsx.md). Aquí se comprueba que lo que PINTA el
// código es exactamente eso, con `constaAprobado()` —que mira quién firma—, nunca a ojo.
//
// Que el `accept` ofrezca el `.xlsx` y que el servidor lo lea lo mide `scrum985` (su censo de
// «Excel» en `public/`); aquí sólo el texto.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constaAprobado } from './_microcopy-aprobada.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const sinEtiquetas = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * El HTML del primer paso del modal, tal como lo arma `pintarElegir`: un array de cadenas entre
 * comillas simples unidas. Pura sobre el fuente, para poder fabricarle un caso.
 */
export function htmlDelPasoElegir(fuente) {
  const ini = fuente.indexOf('function pintarElegir()');
  assert.ok(ini >= 0, '🔴 no encuentro `pintarElegir` en csvImport.js');
  const fin = fuente.indexOf("].join('')", ini);
  assert.ok(fin > ini, '🔴 no encuentro el final del array de `pintarElegir`');
  const cadenas = [...fuente.slice(ini, fin).matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  return cadenas.join('');
}

/** Los dos textos del paso: el párrafo de arriba y el de la zona de arrastrar. */
export function textosDelPaso(html) {
  const parrafo = html.match(/<p\b[^>]*>(.*?)<\/p>/);
  const zona = html.match(/<div id="csv-dropzone"[^>]*>\s*<div\b[^>]*>(.*?)<\/div>/);
  return { parrafo: parrafo && sinEtiquetas(parrafo[1]), zona: zona && sinEtiquetas(zona[1]) };
}

test('SCRUM-1022c · el modal, el botón y su tooltip pintan los literales FIRMADOS (constaAprobado)', () => {
  const importar = leer('public/dashboard/js/csvImport.js');
  const clientes = leer('public/dashboard/js/customersView.js');
  const { parrafo, zona } = textosDelPaso(htmlDelPasoElegir(importar));
  const tooltip = clientes.match(/importBtn\.title\s*=\s*"([^"]*)"/);
  const boton = clientes.match(/const importBtn = createElement\("button", "[^"]*", "([^"]*)"\)/);
  const titulo = importar.match(/titulo:\s*'([^']*)'/);
  const vistos = [parrafo, zona, tooltip && tooltip[1], boton && boton[1], titulo && titulo[1]];
  assert.ok(vistos.every(Boolean), `🔴 CIEGO: no veo alguno de los cinco textos: ${JSON.stringify(vistos)}`);

  for (const texto of vistos) {
    assert.notDeepEqual(constaAprobado(texto), [],
      `🔴 «${texto}» no consta aprobado en docs/microcopy/ (regla 30/39)`);
  }
});

test('SCRUM-1022c · CONTROL NEGATIVO: un texto parecido, o el de antes, NO consta aprobado', () => {
  // Si esto saliera aprobado, el test de arriba estaría midiendo «hay algo escrito», no la firma.
  assert.deepEqual(constaAprobado('Sube el .csv o el .xlsx de tu Excel.'), []);
  assert.deepEqual(constaAprobado('📂 Arrastra tu fichero CSV o haz click para elegirlo'), []);
  assert.deepEqual(constaAprobado('Importar clientes desde un fichero CSV o un Excel'), []);
  assert.deepEqual(constaAprobado('⬆ Importar CSV'), []);
  assert.deepEqual(constaAprobado('⬆ Importar clientes desde CSV'), []);
});

test('SCRUM-1022c · CONTROL: el extractor ve los textos y quita las etiquetas', () => {
  const fabricado = [
    'function pintarElegir() {', "  paso.innerHTML = [",
    "    '<p style=\"x\">', 'Sube <strong>esto</strong> ', 'y más.', '</p>',",
    "    '<div id=\"csv-dropzone\" style=\"y\">', '<div style=\"z\">', 'Arrastra <span>aquí</span>', '</div>',",
    "  ].join('');",
  ].join('\n');
  assert.deepEqual(textosDelPaso(htmlDelPasoElegir(fabricado)), { parrafo: 'Sube esto y más.', zona: 'Arrastra aquí' });
});
