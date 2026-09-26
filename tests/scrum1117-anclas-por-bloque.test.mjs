// SCRUM-1117 · Las citas del BOE de CONTABILIDAD.md llevaban URL y hash y NO anclaban nada: la URL del consolidado sirve
// siempre la version vigente y el hash de la pagina cambia en cada descarga. El comprobador ancla ahora cada cita a la
// redaccion vigente DEL BLOQUE del que sale (`docs/verificacion/anclas-citas-contabilidad.json`).
//
// Estos casos corren el comprobador de verdad sobre fuentes FABRICADAS (en el temporal del sistema, fuera del arbol): las
// reales no estan en git. Lo que se exige, ademas del verde:
//   · que un cambio de redaccion del bloque SALTE (2), y que una fecha anclada vieja tambien;
//   · que «no pude leer la fuente» salga por su propio codigo (3) y no diga nada de citas ni de anclas: si se confundiera
//     con «no ha cambiado», el comprobador diria «todo en orden» el dia que se caiga la red;
//   · que una cita nueva sin fijar o un ancla huerfana salgan (4), no se den por buenas.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = process.env.COMPROBADOR_CITAS ?? path.join(RAIZ, 'docs/verificacion/comprobar-citas-contabilidad.mjs');
const BOE = { LIVA: 'BOE-A-1992-28740', RIVA: 'BOE-A-1992-28925', LIRPF: 'BOE-A-2006-20764', RIRPF: 'BOE-A-2007-6820', RFACT: 'BOE-A-2012-14696', ORDEN303: 'BOE-A-2008-20953' };
const CITA = 'El Impuesto se exigirá al tipo del 21 por ciento, salvo lo dispuesto en el artículo siguiente.';
const OTRA = 'Se aplicará el tipo del 10 por ciento a las operaciones siguientes, que son de prueba.';

const bloque = (id, texto, version) => `<div class="bloque" id="${id}"><p class="parrafo">${texto}</p>` +
  (version ? `<form><input type="radio" name="p" id="lab${version}" value="${version}" checked="checked"/></form>` : '') + '</div>';
const pagina = (k, bloques) => `<html><body><form><input type="hidden" name="id" value="${BOE[k]}"></form>${bloques.join('')}</body></html>`;

// Un solo temporal para todo el fichero, fuera del arbol, y se borra aunque un caso falle.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1117-'));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let nMontajes = 0;
// Toda escritura de los casos pasa por aqui, con la ruta RELATIVA al temporal: asi el censo de SCRUM-824/864 ve de
// donde cuelga cada fichero (un `m.fuentes` no lo sabe seguir).
const escribe = (rel, contenido) => fs.writeFileSync(path.join(TMP, rel), contenido);

function montar({ versionA90 = '20120714', md = `«${CITA}»\n`, liva } = {}) {
  const rel = String(++nMontajes);
  const dir = path.join(TMP, rel);
  fs.mkdirSync(dir);
  const fuentes = path.join(dir, 'fuentes');
  fs.mkdirSync(fuentes);
  for (const k of Object.keys(BOE)) fs.writeFileSync(path.join(fuentes, k + '.html'), pagina(k, [bloque('a1', `Texto de ${k}.`)]));
  fs.writeFileSync(path.join(fuentes, 'LIVA.html'), liva ?? pagina('LIVA', [bloque('a90', CITA, versionA90), bloque('a91', OTRA, '20241221')]));
  fs.writeFileSync(path.join(dir, 'doc.md'), md);
  return { rel, dir, fuentes, doc: path.join(dir, 'doc.md'), anclas: path.join(dir, 'anclas.json') };
}
const correr = (m, ...extra) => {
  const r = spawnSync(process.execPath, [SCRIPT, m.doc, m.fuentes, '--anclas', m.anclas, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

test('SCRUM-1117 · control positivo: fijar y volver a comprobar sin cambios sale 0, con los dos controles OK', () => {
  const m = montar();
  assert.equal(correr(m, '--fijar').code, 0);
  const r = correr(m);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /"control_ancla": "OK/);
  assert.match(r.out, /"anclas_guardadas": 1/);
  const a = JSON.parse(fs.readFileSync(m.anclas, 'utf8')).anclas;
  assert.deepEqual(a.map((x) => [x.fuente, x.bloques]), [['LIVA', ['a90@20120714']]]);
});

test('SCRUM-1117 · 🔴 el BOE publica una redaccion nueva del bloque: SALTA con 2 y nombra la cita', () => {
  const m = montar();
  correr(m, '--fijar');
  escribe(path.join(m.rel, 'fuentes', 'LIVA.html'), pagina('LIVA', [bloque('a90', CITA, '20260122'), bloque('a91', OTRA, '20241221')]));
  const r = correr(m);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /NORMA CAMBIADA >> El Impuesto se exigirá.*anclada: LIVA a90@20120714.*hoy: LIVA a90@20260122/);
});

test('SCRUM-1117 · 🔴 una cita anclada a una fecha de bloque VIEJA: SALTA con 2', () => {
  const m = montar();
  correr(m, '--fijar');
  const j = JSON.parse(fs.readFileSync(m.anclas, 'utf8'));
  j.anclas[0].bloques = ['a90@20081230'];
  escribe(path.join(m.rel, 'anclas.json'), JSON.stringify(j));
  const r = correr(m);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /NORMA CAMBIADA/);
});

test('SCRUM-1117 · 🔴 un bloque que cambia y NO lleva la cita no hace saltar nada (por bloque, no por pagina)', () => {
  const m = montar();
  correr(m, '--fijar');
  escribe(path.join(m.rel, 'fuentes', 'LIVA.html'), pagina('LIVA', [bloque('a90', CITA, '20120714'), bloque('a91', OTRA, '20260122')]));
  const r = correr(m);
  assert.equal(r.code, 0, r.out);
});

for (const [nombre, escribir] of [
  ['fichero vacio', (rel) => escribe(rel, '')],
  ['pagina de error servida con 200 (sin el id del consolidado)', (rel) => escribe(rel, '<html><body><h1>Servicio no disponible</h1></body></html>')],
  ['otra norma (id distinto)', (rel) => escribe(rel, pagina('RIVA', [bloque('a90', CITA, '20120714')]))],
  ['fichero que no existe', (rel) => fs.rmSync(path.join(TMP, rel))],
]) {
  test(`SCRUM-1117 · 🔴 FUENTE ILEGIBLE (${nombre}): sale 3, por su propio camino, sin afirmar nada de citas ni anclas`, () => {
    const m = montar();
    correr(m, '--fijar');
    escribir(path.join(m.rel, 'fuentes', 'LIVA.html'));
    const r = correr(m);
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /FUENTE ILEGIBLE/);
    assert.doesNotMatch(r.out, /norma_cambiada|encontradas|control_ancla/);
  });
}

test('SCRUM-1117 · 🔴 FUENTE ILEGIBLE gana a NORMA CAMBIADA: con la red caida no se informa de nada mas', () => {
  const m = montar();
  correr(m, '--fijar');
  escribe(path.join(m.rel, 'fuentes', 'LIVA.html'), pagina('LIVA', [bloque('a90', CITA, '20260122')]));
  escribe(path.join(m.rel, 'fuentes', 'RFACT.html'), '');
  assert.equal(correr(m).code, 3);
});

test('SCRUM-1117 · 🔴 cita nueva sin fijar, y ancla huerfana: salen 4, no se dan por buenas', () => {
  const m = montar();
  correr(m, '--fijar');
  escribe(path.join(m.rel, 'doc.md'), `«${CITA}»\n«${OTRA}»\n`);
  const nueva = correr(m);
  assert.equal(nueva.code, 4, nueva.out);
  assert.match(nueva.out, /SIN ANCLA >> Se aplicará el tipo del 10/);

  const m2 = montar({ md: `«${CITA}»\n«${OTRA}»\n` });
  correr(m2, '--fijar');
  escribe(path.join(m2.rel, 'doc.md'), `«${CITA}»\n`);
  const huerfana = correr(m2);
  assert.equal(huerfana.code, 4, huerfana.out);
  assert.match(huerfana.out, /HUERFANA >> Se aplicará el tipo del 10/);
});

test('SCRUM-1117 · --fijar se niega a escribir si una cita no aparece (unas anclas asi mentirian)', () => {
  const m = montar({ md: `«${CITA}»\n«Esta frase no esta en ninguna fuente fabricada, a proposito.»\n` });
  const r = correr(m, '--fijar');
  assert.equal(r.code, 1, r.out);
  assert.equal(fs.existsSync(m.anclas), false);
});

test('SCRUM-1117 · las anclas reales del repo cubren las citas de CONTABILIDAD.md (mismo conjunto de sha, sin fuentes)', async () => {
  const crypto = await import('node:crypto');
  const norm = (s) => s.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim().replace(/\s*(\(\.\.\.\)|\.\.\.|…)\s*/g, ' ');
  const md = fs.readFileSync(path.join(RAIZ, 'docs/producto/CONTABILIDAD.md'), 'utf8');
  const citas = [...md.matchAll(/«([^»]{25,}?)»/g)].map((m) => crypto.createHash('sha256').update(norm(m[1])).digest('hex').slice(0, 16));
  const anclas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/verificacion/anclas-citas-contabilidad.json'), 'utf8')).anclas;
  assert.ok(citas.length > 0, 'control: el documento tiene citas');
  assert.deepEqual([...new Set(citas)].sort(), anclas.map((a) => a.sha).sort(),
    'una cita de CONTABILIDAD.md sin ancla (o un ancla sin cita): fijar con --fijar contra las fuentes bajadas por curl');
});
