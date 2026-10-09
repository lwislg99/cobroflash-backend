// SCRUM-1215f · EN EL BLOQUE DE LAS DOS FIRMAS DEL PARTE, LA FIRMA VIAJA CON SU CLAVE.
//
// El censo de SCRUM-1157 lee quién firma cada texto del panel. Cuando la firma se dice una vez, en
// plural y CONTANDO («los cinco textos… FIRMADOS»), la reparte entre las N primeras claves que
// encuentra debajo, por orden del fuente (`scripts/_censo-convenio-microcopy.mjs`, la variable
// `restantes`; lo fija `tests/scrum1157-censo-convenio-microcopy.test.mjs`, caso ②). No sabe
// CUÁLES eran esas N.
//
// Medido el 9-oct-2026 en `parteDetailView.js`, que es de S4: el bloque decía «los cinco textos de
// las dos firmas», y como una de las cinco llevaba además su firma propia, a la cuenta le sobraba
// un hueco y se lo daba a `conLaPrimeraFirmaQuedaFijo` — que es del 28-sep (SCRUM-653 comentario
// 17354), no de aquel día. Estaba firmada, pero el censo la aprobaba por el motivo equivocado. Y
// una clave NUEVA, sin firma de nadie, escrita la primera del bloque, salía APROBADO.
//
// La cura está en el fuente: cada una de las seis lleva su marca EN SU LÍNEA (regla 1 del censo,
// la única que no cuenta ni mira el orden) y la cabecera ya no firma en plural.
//
// Todo se mide con el censo de verdad sobre copias del fuente mutadas EN MEMORIA: aquí no se
// escribe en el árbol.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { censarFuente, leerDeclarados } from '../scripts/_censo-convenio-microcopy.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REL = 'public/dashboard/js/parteDetailView.js';
const FUENTE = fs.readFileSync(path.join(RAIZ, REL), 'utf8');
const EOL = FUENTE.includes('\r\n') ? '\r\n' : '\n';

const LAS_SEIS = [
  'firmarTecnico',
  'yaFirmoElCliente',
  'yaFirmoElTecnico',
  'faltaLaFirmaDelCliente',
  'faltaLaFirmaDelTecnico',
  'conLaPrimeraFirmaQuedaFijo',
];
const NUEVA = 'claveQueNadieHaFirmado';
const LINEA_NUEVA = `    ${NUEVA}: 'Texto que nadie ha firmado',`;

const idDe = (clave) => `${REL} · TEXTOS.${clave}`;
const esLaLineaDe = (clave) => new RegExp(`^\\s*${clave}:\\s`);

/** Las clases que el censo da a las hojas de `TEXTOS` en este fuente. CIEGO → el test cae. */
function clases(fuente) {
  const r = censarFuente(REL, fuente, leerDeclarados(RAIZ).ambiguos || {});
  assert.deepEqual(r.ciegos, [], '🔴 CIEGO: el censo de SCRUM-1157 no ha podido leer el fuente');
  const mapa = new Map();
  for (const h of r.hojas) mapa.set(h.id, h.clase);
  return mapa;
}

/** El fuente con `linea` metida justo ANTES de la línea de `clave`. */
function conLineaAntesDe(clave, linea) {
  const lineas = FUENTE.split(EOL);
  const i = lineas.findIndex((l) => esLaLineaDe(clave).test(l));
  assert.ok(i >= 0, `🔴 CIEGO: no encuentro la línea de \`${clave}\` en ${REL}`);
  lineas.splice(i, 0, linea);
  return lineas.join(EOL);
}

test('SCRUM-1215f · SUELO: el censo lee el parte, ve las seis y sabe acusar', () => {
  const base = clases(FUENTE);
  assert.ok(base.size >= 60, `🔴 SUELO: el censo ve ${base.size} hojas en \`TEXTOS\` del parte; son más de 60`);
  for (const clave of LAS_SEIS) {
    assert.ok(base.has(idDe(clave)), `🔴 SUELO: el censo no ve \`${clave}\`: lo de abajo no mediría nada`);
  }
  assert.ok(!base.has(idDe(NUEVA)), `🔴 SUELO: \`${NUEVA}\` ya existe en el fuente: la cobaya no vale`);
  // El control de que este censo, sobre este fichero, sabe decir «sin firma»: una clave nueva al
  // final del objeto, lejos de cualquier comentario.
  const alFinal = clases(FUENTE.replace(/(\r?\n)\s*conLaPrimeraFirmaQuedaFijo: [^\r\n]*/, (l) => l + EOL + EOL + LINEA_NUEVA));
  assert.equal(alFinal.get(idDe(NUEVA)), 'SIN_COMENTARIO',
    '🔴 SUELO: una clave nueva sin firma, detrás del bloque, no sale acusada: el censo no sabe acusar aquí');
});

test('SCRUM-1215f · las seis de las dos firmas salen APROBADO', () => {
  const base = clases(FUENTE);
  for (const clave of LAS_SEIS) {
    assert.equal(base.get(idDe(clave)), 'APROBADO', `🔴 \`${clave}\` no cita su firma: el censo la acusa`);
  }
});

test('SCRUM-1215f · 🔴 una clave nueva sin firma, la PRIMERA del bloque, sale acusada y no le quita la firma a ninguna', () => {
  const r = clases(conLineaAntesDe('firmarTecnico', LINEA_NUEVA));
  assert.equal(r.get(idDe(NUEVA)), 'SIN_COMENTARIO',
    '🔴 un texto que nadie ha firmado sale APROBADO por estar el primero del bloque: la firma se reparte por posición');
  for (const clave of LAS_SEIS) {
    assert.equal(r.get(idDe(clave)), 'APROBADO',
      `🔴 al entrar una clave nueva arriba, \`${clave}\` pierde su firma: la tenía por el sitio y no por su nombre`);
  }
});

test('SCRUM-1215f · 🔴 una clave nueva sin firma, delante de CUALQUIERA de las seis, sale acusada', () => {
  for (const clave of LAS_SEIS) {
    const r = clases(conLineaAntesDe(clave, LINEA_NUEVA));
    assert.equal(r.get(idDe(NUEVA)), 'SIN_COMENTARIO',
      `🔴 la clave nueva, puesta delante de \`${clave}\`, sale ${r.get(idDe(NUEVA))}: hereda una firma que no es suya`);
    for (const otra of LAS_SEIS) {
      assert.equal(r.get(idDe(otra)), 'APROBADO', `🔴 con la nueva delante de \`${clave}\`, \`${otra}\` pierde su firma`);
    }
  }
});

// NO hay aquí un caso de «cambiar de orden las seis»: se escribió y se quitó. Con el fuente de
// antes TAMBIÉN pasaba (la cuenta de cinco más la firma propia de una cubrían justo a las seis, en
// cualquier orden), así que no distinguía el arreglo de la avería: un verde sin control.

test('SCRUM-1215f · 🔴 CONTROL: sin su marca, cada una de las seis sale acusada (no la sostiene otra firma)', () => {
  for (const clave of LAS_SEIS) {
    const lineas = FUENTE.split(EOL);
    const i = lineas.findIndex((l) => esLaLineaDe(clave).test(l));
    // La línea acaba donde acaba su literal (`…',`): lo que venga detrás es su marca. Se corta por
    // el final del literal, no buscando el comentario (SCRUM-694: nada de filtros de comentario a mano).
    const finDelLiteral = lineas[i].lastIndexOf("',");
    assert.ok(finDelLiteral > 0, `🔴 CIEGO: la línea de \`${clave}\` no acaba en un literal entre comillas simples`);
    const sinMarca = lineas[i].slice(0, finDelLiteral + 2);
    assert.notEqual(sinMarca, lineas[i], `🔴 \`${clave}\` no lleva nada detrás de su literal: la marca no viaja con ella`);
    lineas[i] = sinMarca;
    assert.equal(clases(lineas.join(EOL)).get(idDe(clave)), 'SIN_COMENTARIO',
      `🔴 a \`${clave}\` se le quita la marca de su línea y sigue saliendo APROBADO: la aprueba otra cosa, por el sitio`);
  }
});
