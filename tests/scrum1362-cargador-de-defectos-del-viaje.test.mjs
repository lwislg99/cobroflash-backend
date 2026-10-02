// SCRUM-1362 · el cargador de los defectos declarados del viaje de la firma FALLA CERRADO.
//
// Cada control escribe un JSON roto de una manera y exige que el cargador diga `ok: false` con su
// motivo. Si alguno pasara como bueno, el trinquete de SCRUM-1351 leería una lista que no es la
// declarada — vacía, o con una clave pisada — sin que nada se pusiera rojo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leerDefectosDeclarados, defectosDeclarados, RUTA_DEFECTOS } from './_defectos-viaje-firma.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

function conFichero(contenido, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1362-'));
  const ruta = path.join(dir, 'defectos.json');
  try {
    if (contenido !== null) fs.writeFileSync(ruta, contenido);
    return fn(ruta);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('SCRUM-1362 · control positivo: el JSON del repositorio se lee y trae defectos con su dónde', () => {
  const r = leerDefectosDeclarados();
  assert.equal(r.ok, true, r.motivo);
  assert.ok(r.defectos.length > 0 || /vacio_a_proposito/.test(fs.readFileSync(RUTA_DEFECTOS, 'utf8')));
  assert.deepEqual([...defectosDeclarados()], [...r.defectos]);
});

test('SCRUM-1362 · un JSON bien formado se lee tal cual (el cargador no rechaza por sistema)', () => {
  conFichero('{"defectos":{"a":"x · S2","b":"y · S4"}}', (ruta) => {
    assert.deepEqual(leerDefectosDeclarados(ruta), { ok: true, defectos: ['a', 'b'] });
  });
});

const ROTOS = [
  ['el fichero no existe', null, /no se puede leer/],
  ['no es JSON', '{"defectos": {', /no es JSON válido/],
  ['falta la sección', '{"leeme":"x"}', /falta `defectos`/],
  ['la sección es una lista', '{"defectos":["a"]}', /falta `defectos`/],
  ['un valor vacío', '{"defectos":{"a":"  "}}', /no venir vacío/],
  ['un valor que no es texto', '{"defectos":{"a":1}}', /no venir vacío/],
  ['una clave repetida', '{"defectos":{"a":"x","a":"y"}}', /repite "a"/],
  ['vacía sin motivo', '{"defectos":{}}', /VACÍO/],
  ['vacía con el motivo en blanco', '{"defectos":{},"vacio_a_proposito":" "}', /VACÍO/],
  ['con motivo de vacío y sin estar vacía', '{"defectos":{"a":"x"},"vacio_a_proposito":"ya no queda"}', /una de las dos cosas sobra/],
];

const caso2 = casosEscritos(ROTOS, ([caso, contenido, motivo]) => `SCRUM-1362 · 🔴 ${caso}: el cargador dice que NO sabe, y por qué`, ([caso, contenido, motivo]) => {
  conFichero(contenido, (ruta) => {
    const r = leerDefectosDeclarados(ruta);
    assert.equal(r.ok, false, `«${caso}» se ha leído como bueno`);
    assert.match(r.motivo, motivo);
    assert.throws(() => defectosDeclarados(ruta), /CIEGO/, 'y para el test es un error, nunca una lista');
  });
});
test('SCRUM-1362 · 🔴 el fichero no existe: el cargador dice que NO sabe, y por qué', caso2(0));
test('SCRUM-1362 · 🔴 no es JSON: el cargador dice que NO sabe, y por qué', caso2(1));
test('SCRUM-1362 · 🔴 falta la sección: el cargador dice que NO sabe, y por qué', caso2(2));
test('SCRUM-1362 · 🔴 la sección es una lista: el cargador dice que NO sabe, y por qué', caso2(3));
test('SCRUM-1362 · 🔴 un valor vacío: el cargador dice que NO sabe, y por qué', caso2(4));
test('SCRUM-1362 · 🔴 un valor que no es texto: el cargador dice que NO sabe, y por qué', caso2(5));
test('SCRUM-1362 · 🔴 una clave repetida: el cargador dice que NO sabe, y por qué', caso2(6));
test('SCRUM-1362 · 🔴 vacía sin motivo: el cargador dice que NO sabe, y por qué', caso2(7));
test('SCRUM-1362 · 🔴 vacía con el motivo en blanco: el cargador dice que NO sabe, y por qué', caso2(8));
test('SCRUM-1362 · 🔴 con motivo de vacío y sin estar vacía: el cargador dice que NO sabe, y por qué', caso2(9));
caso2.todos();

test('SCRUM-1362 · la lista vacía SÓLO vale con su motivo escrito', () => {
  conFichero('{"defectos":{},"vacio_a_proposito":"el último se arregló en SCRUM-0000"}', (ruta) => {
    assert.deepEqual(leerDefectosDeclarados(ruta), { ok: true, defectos: [] });
  });
});
