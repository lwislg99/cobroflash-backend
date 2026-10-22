// tests/scrum962c-censo-tactil-poblacion-vara-etiqueta.test.mjs — SCRUM-962c
//
// `censo:tactil-panel` estaba roto en las DOS direcciones (medido por S2, SCRUM-962 tramos 962b y
// 962b (2)): se le escapaban 42 controles y, de sus 72 cortos, sólo 8 incumplían DESIGN.md tal cual.
// Cuatro averías, y cada una tiene aquí su caso, contra medidas FABRICADAS (sin navegador):
//   ⒜ la población: campos y radios dentro, sin perder nada de lo que miden los guards;
//   ⒝ lo que no se pinta en ningún estado sale como SIN MIRAR, no desaparece;
//   ⒞ la vara es la de DESIGN.md §5 (44 en móvil, 36 en escritorio) y `btn-sm` va aparte;
//   ⒟ una casilla envuelta por su etiqueta se mide por la etiqueta; con `for` separado, no.
// Y las sondas: con lo que habría devuelto el censo VIEJO, `juzgarSondas` tiene que fallar por cada
// avería. Un control que el instrumento roto también pasa no es un control.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERACTIVOS, minimoPara } from '../scripts/_medidor-de-toque.mjs';
import {
  CONTROLES, CAMPOS, CASILLAS, POBLACION, ARBITRO_ETIQUETA, SONDAS_HTML,
  veredicto, distintosCon, sinMirar, juzgarSondas,
} from '../scripts/_censo-distintos.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const partes = (sel) => sel.split(',').map((s) => s.trim());

// Cada mutación reintroduce UNA avería del censo viejo; `cae` es el test que tiene que tumbarla.
// Las corre el meta-guard, y `docs/master/evidencias/SCRUM-962c/mutar.mjs` las toma de aquí.
const D = 'scripts/_censo-distintos.mjs';
const C = 'scripts/censo-objetivo-tactil-panel.mjs';
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: D, de: "if (m.tocable >= minimoPara(ancho)) return 'cumple';", a: "if (m.tocable >= 44) return 'cumple';", cae: '⒞ la vara es la de DESIGN.md §5: depende del ancho' },
  { fichero: D, de: "if (m.clase === 'control' && esBtnSm(m.sel)) return 'exento';", a: '', cae: '⒞ btn-sm va APARTE' },
  { fichero: D, de: "if (m.clase === 'campo') return 'campo';", a: '', cae: '⒜ un campo bajo la vara NO es corto' },
  { fichero: D, de: 'if (!vistos.has(k) && !sin.has(k))', a: 'if (!sin.has(k))', cae: '⒝ SIN MIRAR' },
  { fichero: D, de: "export const POBLACION = CONTROLES + ', ' + CAMPOS;", a: 'export const POBLACION = INTERACTIVOS;', cae: '⒜ la población contiene TODO' },
  { fichero: D, de: ".filter((s) => s !== 'input[type=\"checkbox\"]' && s !== 'input[type=\"radio\"]')", a: '.filter(() => true)', cae: '⒟ el árbitro de la etiqueta NO contiene las casillas' },
  { fichero: D, de: 'debe(!(env && sue) || env.tocable !== sue.tocable,', a: 'debe(true,', cae: 'las sondas CAZAN al censo viejo' },
  { fichero: D, de: "debe(rs.sinPintar.some((s) => s.id === '__sonda-oculta'),", a: 'debe(true,', cae: 'las sondas CAZAN al censo viejo' },
  { fichero: D, de: "debe(campo && campo.clase === 'campo' && v('__sonda-campo') === 'campo',", a: 'debe(true,', cae: 'las sondas CAZAN al censo viejo' },
  { fichero: C, de: 'lab && lab.control === el && pinta(lab)', a: 'lab && pinta(lab)', cae: 'el censo usa todo esto' },
  { fichero: C, de: 'pagina(s.html + SONDAS_HTML)', a: "pagina(s.html + '<button id=\"__sonda\">.</button>')", cae: 'el censo usa todo esto' },
  { fichero: C, de: 'if (estadosFallidos.length) noSupe(', a: 'if (false) noSupe(', cae: 'el censo usa todo esto' },
];

test('⒜ la población contiene TODO lo que miden los guards, y además campos y radios', () => {
  const pob = partes(POBLACION);
  for (const s of partes(INTERACTIVOS)) assert.ok(pob.includes(s), `se ha perdido «${s}» de INTERACTIVOS`);
  for (const s of ['select', 'textarea', 'input[type="radio"]']) assert.ok(pob.includes(s), `falta «${s}»`);
  assert.ok(pob.some((s) => s.startsWith('input:not(')), 'faltan los input de texto, fecha, número, color…');
  // Los campos no se tragan las casillas ni los botones: cada elemento es de UNA clase.
  for (const t of ['checkbox', 'radio', 'submit', 'button', 'hidden', 'color', 'file', 'range']) assert.match(CAMPOS, new RegExp(`:not\\(\\[type="${t}"\\]\\)`), `CAMPOS acepta type=${t}`);
  assert.deepEqual(partes(CASILLAS), ['input[type="checkbox"]', 'input[type="radio"]']);
  // Una muestra de color es un botón que abre un selector, no un campo sin vara (962b (2) nº 3).
  for (const t of ['radio', 'color', 'file', 'range']) assert.ok(partes(CONTROLES).includes(`input[type="${t}"]`), `type=${t} no es control`);
});

test('⒟ el árbitro de la etiqueta NO contiene las casillas (si las tuviera, la etiqueta nunca sería suya)', () => {
  const arb = partes(ARBITRO_ETIQUETA);
  assert.equal(arb[0], 'label');
  for (const c of partes(CASILLAS)) assert.ok(!arb.includes(c), `«${c}» en el árbitro de la etiqueta`);
  assert.ok(arb.includes('a[href]') && arb.includes('select'), 'un enlace o un campo dentro de la etiqueta tiene que quitarle el toque');
});

const m = (clase, sel, tocable) => ({ clase, sel, tocable });

test('⒞ la vara es la de DESIGN.md §5: depende del ancho', () => {
  assert.equal(minimoPara(390), 44);
  assert.equal(minimoPara(929), 36);
  assert.equal(veredicto(m('control', 'BUTTON', 40), 390), 'corto');
  assert.equal(veredicto(m('control', 'BUTTON', 40), 929), 'cumple', 'a 929 se mide contra 36, no contra 44');
  assert.equal(veredicto(m('control', 'BUTTON', 35.9), 929), 'corto');
  assert.equal(veredicto(m('control', 'BUTTON', 43.9), 768), 'corto', 'el corte de 768 es aún móvil');
  assert.equal(veredicto(m('control', 'BUTTON', 44), 390), 'cumple');
});

test('⒞ btn-sm va APARTE (exento por §5), y sólo btn-sm: un btn-primary corto es corto', () => {
  assert.equal(veredicto(m('control', 'BUTTON.btn.btn-secondary.btn-sm', 30.5), 390), 'exento');
  assert.equal(veredicto(m('control', 'A.btn-secondary.btn-sm', 31), 929), 'exento');
  assert.equal(veredicto(m('control', 'BUTTON.btn-primary', 30.5), 390), 'corto');
  assert.equal(veredicto(m('control', 'BUTTON.btn-smx', 30.5), 390), 'corto', 'una subcadena no es la clase');
  assert.equal(veredicto(m('casilla', 'INPUT[checkbox].btn-sm', 17), 390), 'corto', 'la exención es de botones');
});

test('⒜ un campo bajo la vara NO es corto: DESIGN.md no le da altura, va en su propia cuenta', () => {
  assert.equal(veredicto(m('campo', 'SELECT.input', 38.9), 390), 'campo');
  assert.equal(veredicto(m('campo', 'SELECT.input', 45), 390), 'cumple');
});

test('distintosCon cuenta cada veredicto por separado y un elemento a dos anchuras es UNO', () => {
  const res = [
    { fn: 'v', ancho: 929, medidos: [{ i: 0, sel: 'BUTTON', texto: 'a', tocable: 40, veredicto: 'cumple' }, { i: 1, sel: 'SELECT', texto: 'b', tocable: 38, veredicto: 'cumple' }] },
    { fn: 'v', ancho: 390, medidos: [{ i: 0, sel: 'BUTTON', texto: 'a', tocable: 40, veredicto: 'corto' }, { i: 1, sel: 'SELECT', texto: 'b', tocable: 38, veredicto: 'campo' }] },
  ];
  assert.deepEqual([...distintosCon(res, 'corto').keys()], ['v|0']);
  assert.deepEqual([...distintosCon(res, 'campo').keys()], ['v|1']);
  assert.equal(distintosCon(res, 'exento').size, 0);
});

test('⒝ SIN MIRAR: lo que no se pinta en NINGÚN estado ni anchura, y sólo eso', () => {
  const s = (i, txt) => ({ i, sel: 'BUTTON', clase: 'control', texto: txt });
  const res = [
    // montaje: 0 medido; 1, 2 y 3 sin pintar; 4 no tocable
    { fn: 'cfg', ancho: 390, estado: null, medidos: [{ i: 0 }], sinPintar: [s(1, 'pestaña'), s(2, 'nunca'), s(3, 'sólo en escritorio')], noTocables: [{ i: 4 }] },
    // al abrir la pestaña, 1 se pinta
    { fn: 'cfg', ancho: 390, estado: 'avisos', medidos: [{ i: 1 }], sinPintar: [s(2, 'nunca'), s(3, 'sólo en escritorio')], noTocables: [] },
    { fn: 'cfg', ancho: 929, estado: null, medidos: [{ i: 3 }], sinPintar: [s(2, 'nunca')], noTocables: [] },
  ];
  assert.deepEqual([...sinMirar(res).keys()], ['cfg|2']);
  assert.equal(sinMirar(res).get('cfg|2').texto, 'nunca');
  // Lo mismo en otra pantalla es otro elemento.
  assert.equal(sinMirar([...res, { fn: 'otra', ancho: 390, medidos: [], sinPintar: [s(2, 'x')], noTocables: [] }]).size, 2);
  assert.throws(() => sinMirar([{ fn: 'v', medidos: [], noTocables: [], sinPintar: [{ texto: 'sin i' }] }]), /sin posición/);
});

// ── LAS SONDAS ────────────────────────────────────────────────────────────────────────────────
// Lo que devuelve MEDIR sobre la página con SONDAS_HTML cuando el censo funciona. Las cifras son
// las de la pasada real del 22-oct sobre el árbol de esta rama (16-17 px una casilla, 60 la etiqueta).
const sano = (ancho) => ({
  medidos: [
    { id: '__sonda', clase: 'control', sel: 'BUTTON', tocable: 12 },
    { id: '__sonda-campo', clase: 'campo', sel: 'SELECT', tocable: 20 },
    { id: '__sonda-40', clase: 'control', sel: 'BUTTON', tocable: 40 },
    { id: '__sonda-sm', clase: 'control', sel: 'BUTTON.btn.btn-secondary.btn-sm', tocable: 30 },
    { id: '__sonda-envuelta', clase: 'casilla', sel: 'INPUT[checkbox]', tocable: 60, tocablePropio: 17, viaEtiqueta: true },
    { id: '__sonda-suelta', clase: 'casilla', sel: 'INPUT[checkbox]', tocable: 17, tocablePropio: 17, viaEtiqueta: false },
  ],
  sinPintar: [{ id: '__sonda-oculta', i: 99 }],
  noTocables: [],
  ancho,
});
const sin = (rs, id) => ({ ...rs, medidos: rs.medidos.filter((x) => x.id !== id) });
const con = (rs, id, cambio) => ({ ...rs, medidos: rs.medidos.map((x) => (x.id === id ? { ...x, ...cambio } : x)) });

test('las sondas de un censo sano pasan a las dos anchuras', () => {
  assert.deepEqual(juzgarSondas(sano(390), 390), []);
  assert.deepEqual(juzgarSondas(sano(929), 929), []);
});

test('las sondas CAZAN al censo viejo, avería por avería', () => {
  const caza = (rs, ancho, patron, que) => {
    const f = juzgarSondas(rs, ancho);
    assert.ok(f.some((x) => patron.test(x)), `${que}: no lo caza (${JSON.stringify(f)})`);
  };
  caza(sin(sano(390), '__sonda-campo'), 390, /⒜/, 'población sin select (el selector viejo)');
  caza(con(sano(390), '__sonda-campo', { clase: 'control' }), 390, /⒜/, 'el select contado como control');
  caza({ ...sano(390), sinPintar: [] }, 390, /⒝/, 'lo oculto desaparece');
  // ⒞ la vara vieja (44 fijo) vive en `veredicto`, no en los datos: la caza la mutación de abajo
  // («a 929 se mide contra 36»), y aquí la de una sonda que no mide lo que dice.
  caza(con(sano(929), '__sonda-40', { tocable: 44.2 }), 929, /⒞ botón de 40/, 'la sonda de 40 que no mide 40 no prueba la vara');
  caza(con(sano(390), '__sonda-sm', { sel: 'BUTTON.btn.btn-secondary' }), 390, /⒞ btn-sm/, 'btn-sm sin separar');
  caza(con(sano(390), '__sonda-envuelta', { tocable: 17, viaEtiqueta: false }), 390, /⒟ casilla ENVUELTA/, 'la casilla medida sola');
  caza(con(sano(390), '__sonda-envuelta', { tocable: 17, viaEtiqueta: false }), 390, /salen IGUAL/, 'las dos iguales');
  caza(con(sano(390), '__sonda-suelta', { tocable: 60, viaEtiqueta: true }), 390, /⒟ casilla con etiqueta SEPARADA/, 'la etiqueta separada contada como suya');
  caza(sin(sano(390), '__sonda'), 390, /12 px/, 'la superficie no se mide');
});

test('las sondas que se inyectan son las que se juzgan (mismos id, y la oculta va en display:none)', () => {
  for (const id of ['__sonda', '__sonda-campo', '__sonda-40', '__sonda-sm', '__sonda-envuelta', '__sonda-suelta', '__sonda-oculta']) {
    assert.ok(SONDAS_HTML.includes(`id="${id}"`), `falta la sonda ${id}`);
  }
  assert.match(SONDAS_HTML, /<select id="__sonda-campo"/);
  assert.match(SONDAS_HTML, /<label [^>]*><input type="checkbox" id="__sonda-envuelta">/, 'la envuelta tiene que estar DENTRO de su label');
  assert.match(SONDAS_HTML, /<input type="checkbox" id="__sonda-suelta"><label for="__sonda-suelta"/, 'la suelta, FUERA, con for');
  assert.match(SONDAS_HTML, /<div style="display:none"><button id="__sonda-oculta">/);
  assert.match(SONDAS_HTML, /id="__sonda-sm" class="[^"]*\bbtn-sm\b/);
});

test('el censo usa todo esto: mide POBLACION, juzga las sondas y sale 2 si fallan (código sin comentarios)', () => {
  const f = soloCodigo(fs.readFileSync(path.join(RAIZ, 'scripts/censo-objetivo-tactil-panel.mjs'), 'utf8'), 'censo-objetivo-tactil-panel.mjs');
  assert.match(f, /\[POBLACION, CAMPOS, CASILLAS, ARBITRO_ETIQUETA, INTERACTIVOS\]/, 'MEDIR ya no recibe la población nueva');
  assert.match(f, /pagina\(s\.html \+ SONDAS_HTML\)/, 'las sondas ya no se inyectan');
  assert.match(f, /juzgarSondas\(await page\.evaluate\(EVAL\), ancho\)/, 'las sondas ya no se juzgan');
  assert.match(f, /if \(sondasFallidas\.length\) \{\s*noSupe\(/, 'una sonda fallida ya no hace salir con 2');
  assert.match(f, /if \(estadosFallidos\.length\) noSupe\(/, 'un estado que no abre ya no hace salir con 2');
  assert.match(f, /m\.veredicto = veredicto\(m, r\.ancho\)/, 'los medidos ya no se juzgan con la vara de §5');
  assert.match(f, /sinMirar\(resultados\)/, 'lo no mirado ya no se cuenta');
  assert.match(f, /lab\.control === el/, '⒟ la etiqueta ya no exige controlar a la casilla');
  // El resumen del CI copia de «EL NÚMERO» hasta «SIN .btn-sm» (ci.yml): la última línea tiene que seguir ahí.
  const i = f.indexOf('═══ EL NÚMERO ═══');
  assert.ok(i > 0 && f.indexOf('SIN .btn-sm', i) > i, 'el bloque del número ya no acaba en «SIN .btn-sm» y el resumen del CI se lo comería entero');
});
