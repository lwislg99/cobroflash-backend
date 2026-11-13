// SCRUM-1076b · Los plazos de 130, 111, 115, 347 y 390 se citan en CONTABILIDAD.md §10 y los comprueba el MISMO script
// que el 303 (`docs/verificacion/comprobar-citas-contabilidad.mjs`), con cinco fuentes nuevas.
//
// Lo que se exige aqui, sobre fuentes FABRICADAS en el temporal del sistema (las reales no estan en git):
//   · las cinco ORDEN<modelo> son OBLIGATORIAS: si falta una, sale 3 (FUENTE ILEGIBLE) y la nombra; no se calla;
//   · una norma consolidada que NUNCA se ha modificado (la Orden EHA/586/2011 del 111, medido el 13-nov-2026) no lleva el
//     formulario de redacciones con `name="id"`: el BOE solo la identifica en sus metadatos ELI (`id_local`). Se reconoce
//     por ese mismo id, y una pagina con el `id_local` de OTRA norma sigue saliendo 3.
// Y, sin fuentes: cada fila de la §10 sale de su orden, con su ancla en `anclas-citas-contabilidad.json`.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = process.env.COMPROBADOR_CITAS ?? path.join(RAIZ, 'docs/verificacion/comprobar-citas-contabilidad.mjs');
const BOE = { LIVA: 'BOE-A-1992-28740', RIVA: 'BOE-A-1992-28925', LIRPF: 'BOE-A-2006-20764', RIRPF: 'BOE-A-2007-6820', RFACT: 'BOE-A-2012-14696', ORDEN303: 'BOE-A-2008-20953',
  ORDEN130: 'BOE-A-2007-6032', ORDEN111: 'BOE-A-2011-4948', ORDEN115: 'BOE-A-2000-21430', ORDEN347: 'BOE-A-2008-16973', ORDEN390: 'BOE-A-2009-18472' };
const CITA = 'El Impuesto se exigirá al tipo del 21 por ciento, salvo lo dispuesto en el artículo siguiente.';
const CITA111 = 'en los veinte primeros días naturales de los meses de abril, julio, octubre y enero, de prueba.';

const bloque = (id, texto, version) => `<div class="bloque" id="${id}"><p class="parrafo">${texto}</p>` +
  (version ? `<form><input type="radio" name="p" id="lab${version}" value="${version}" checked="checked"/></form>` : '') + '</div>';
const pagina = (k, bloques) => `<html><body><form><input type="hidden" name="id" value="${BOE[k]}"></form>${bloques.join('')}</body></html>`;
// Como sirve el BOE una norma sin redacciones: sin formulario, con el id solo en los metadatos ELI.
const paginaSinRedacciones = (id, bloques) => `<html><head><meta about="https://www.boe.es/eli/es/o/x/con/1" ` +
  `property="http://data.europa.eu/eli/ontology#id_local" content="${id}" datatype="http://www.w3.org/2001/XMLSchema#string"/></head>` +
  `<body>${bloques.join('')}</body></html>`;

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1076b-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let nMontajes = 0;
const escribe = (rel, contenido) => fs.writeFileSync(path.join(TMP, rel), contenido);

function montar(pagina111) {
  const rel = String(++nMontajes);
  fs.mkdirSync(path.join(TMP, rel, 'fuentes'), { recursive: true });
  for (const k of Object.keys(BOE)) escribe(path.join(rel, 'fuentes', k + '.html'), pagina(k, [bloque('a1', `Texto de ${k}.`)]));
  escribe(path.join(rel, 'fuentes', 'LIVA.html'), pagina('LIVA', [bloque('a90', CITA, '20120714')]));
  escribe(path.join(rel, 'fuentes', 'ORDEN111.html'), pagina111 ?? paginaSinRedacciones(BOE.ORDEN111, [bloque('a3', CITA111)]));
  escribe(path.join(rel, 'doc.md'), `«${CITA}»\n«${CITA111}»\n`);
  const dir = path.join(TMP, rel);
  return { rel, fuentes: path.join(dir, 'fuentes'), doc: path.join(dir, 'doc.md'), anclas: path.join(dir, 'anclas.json') };
}
const correr = (m, ...extra) => {
  const r = spawnSync(process.execPath, [SCRIPT, m.doc, m.fuentes, '--anclas', m.anclas, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

test('SCRUM-1076b · control positivo: una norma sin redacciones (solo id ELI) se lee, y su cita se fija y se comprueba', () => {
  const m = montar();
  const f = correr(m, '--fijar');
  assert.equal(f.code, 0, f.out);
  const r = correr(m);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /"encontradas": 2/);
  const a = JSON.parse(fs.readFileSync(m.anclas, 'utf8')).anclas;
  assert.deepEqual(a.map((x) => [x.fuente, x.bloques]).sort(), [['LIVA', ['a90@20120714']], ['ORDEN111', ['a3@original']]]);
});

test('SCRUM-1076b · 🔴 el id ELI de OTRA norma no vale: sale 3 y nombra la fuente', () => {
  const m = montar(paginaSinRedacciones(BOE.ORDEN130, [bloque('a3', CITA111)]));
  const r = correr(m);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, /ORDEN111: no es el consolidado BOE-A-2011-4948/);
});

const ORDENES = ['ORDEN130', 'ORDEN111', 'ORDEN115', 'ORDEN347', 'ORDEN390'];
const falta = casosEscritos(ORDENES, (k) => `SCRUM-1076b · 🔴 sin ${k}.html sale 3 (FUENTE ILEGIBLE) y la nombra: la fuente del plazo es obligatoria`, (k) => {
  const m = montar();
  fs.rmSync(path.join(m.fuentes, k + '.html'));
  const r = correr(m);
  assert.equal(r.code, 3, r.out);
  assert.match(r.out, new RegExp(`${k}: no se puede leer`));
  assert.doesNotMatch(r.out, /encontradas|control_ancla/);
});
test('SCRUM-1076b · 🔴 sin ORDEN130.html sale 3 (FUENTE ILEGIBLE) y la nombra: la fuente del plazo es obligatoria', falta(0));
test('SCRUM-1076b · 🔴 sin ORDEN111.html sale 3 (FUENTE ILEGIBLE) y la nombra: la fuente del plazo es obligatoria', falta(1));
test('SCRUM-1076b · 🔴 sin ORDEN115.html sale 3 (FUENTE ILEGIBLE) y la nombra: la fuente del plazo es obligatoria', falta(2));
test('SCRUM-1076b · 🔴 sin ORDEN347.html sale 3 (FUENTE ILEGIBLE) y la nombra: la fuente del plazo es obligatoria', falta(3));
test('SCRUM-1076b · 🔴 sin ORDEN390.html sale 3 (FUENTE ILEGIBLE) y la nombra: la fuente del plazo es obligatoria', falta(4));
falta.todos();

test('SCRUM-1076b · cada fila de plazos de CONTABILIDAD.md §10 tiene su ancla en SU orden (sin fuentes)', () => {
  const norm = (s) => s.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim().replace(/\s*(\(\.\.\.\)|\.\.\.|…)\s*/g, ' ');
  const md = fs.readFileSync(path.join(RAIZ, 'docs/producto/CONTABILIDAD.md'), 'utf8');
  const s10 = md.slice(md.indexOf('\n## 10 · Plazos de presentación'));
  assert.ok(s10.length > 1, 'control: la §10 existe');
  const filas = [...s10.matchAll(/^\| (\d{3}) \| [^|]+ \| «([^»]+)» \|$/gm)].map((x) => [x[1], x[2]]);
  assert.deepEqual(filas.map((f) => f[0]), ['130', '111', '115', '347', '390'], 'una fila por modelo, en este orden');
  const anclas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/verificacion/anclas-citas-contabilidad.json'), 'utf8')).anclas;
  const porSha = new Map(anclas.map((a) => [a.sha, a]));
  for (const [modelo, cita] of filas) {
    const a = porSha.get(crypto.createHash('sha256').update(norm(cita)).digest('hex').slice(0, 16));
    assert.ok(a, `el plazo del ${modelo} no tiene ancla: fijarla contra las fuentes bajadas por curl`);
    assert.equal(a.fuente, `ORDEN${modelo}`, `el plazo del ${modelo} tiene que salir de su orden, no de ${a.fuente}`);
  }
});
