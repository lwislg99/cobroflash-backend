// tests/scrum1722c-la-hoja-del-parte-pide-su-ancho.test.mjs — SCRUM-1722c
//
// EL PARTE SE SALÍA 61 px POR LA DERECHA EN UN MÓVIL DE 390, Y NO SE PODÍA DESPLAZAR.
//
// Medido en yaqu.app el 16-nov-2026 (parte PT-2026-014, abierto desde un trabajo con dirección): la hoja
// medía 451 px en una ventana de 390, y como `html, body` llevan `overflow-x: clip`, lo de la derecha
// —«Salida», «Kilómetros», los recuadros de firma— se perdía sin barra para alcanzarlo.
//
// LA CAUSA, probada en el DOM vivo (vaciando un solo resumen la hoja volvía a 390):
//   · `.main` es un flex en COLUMNA; su hijo `.view-container` se ESTIRA al ancho de la pantalla…
//   · …salvo que lleve márgenes `auto`: entonces deja de estirarse y mide LO QUE MIDE SU CONTENIDO.
//   · SCRUM-1722 centró la hoja del parte con `margin-inline: auto` y un `max-width`, sin pedirle ancho.
//   · Un contenido que no parte —la línea «Obra y referencia» con una dirección larga, `nowrap`— la
//     ensanchaba por encima de la ventana; uno corto (el parte FIRMADO) la encogía (los 18 px de margen
//     frente a 12 del 12-nov, y los 362 px a 1280 que SCRUM-1722b arregló sólo desde 1024).
// EL ARREGLO: la regla que la centra le pide también `width: 100%`. Con ancho definido, el contenido largo
// se recorta con sus puntos suspensivos DENTRO de la hoja, que es para lo que el resumen los lleva.
//
// QUÉ MIRA ESTE TEST Y QUÉ NO. Lee `styles.css` SIN comentarios y recorre TODAS sus reglas, también las de
// dentro de `@media`. No ejecuta un navegador: los píxeles los mide la sonda
// `docs/evidencias/scrum1722b/sonda-parte.mjs.txt`, que desde este ticket lleva el caso de la obra larga
// como control positivo y sale con código 1 si algo desborda (sus medidas, en `docs/evidencias/scrum1722c/`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const SONDA = fs.readFileSync(path.join(RAIZ, 'docs/evidencias/scrum1722b/sonda-parte.mjs.txt'), 'utf8');

/** La hoja del parte: el contenedor que tiene la cabecera del parte como hija directa. */
const HOJA = '*:has(> header.parte-cabecera)';

/** Todas las reglas, en orden, con el `@media` que las envuelve (o `null`). Sin comentarios. */
function reglas(css) {
  const out = [];
  const recorrer = (t, medio) => {
    let i = 0;
    while (i < t.length) {
      const abre = t.indexOf('{', i);
      if (abre < 0) break;
      const preludio = t.slice(i, abre).trim();
      let prof = 1, j = abre + 1;
      while (j < t.length && prof > 0) { if (t[j] === '{') prof++; else if (t[j] === '}') prof--; j++; }
      const cuerpo = t.slice(abre + 1, j - 1);
      if (preludio.startsWith('@media') || preludio.startsWith('@supports')) recorrer(cuerpo, preludio);
      else if (!preludio.startsWith('@')) out.push({ selectores: preludio.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), cuerpo, medio });
      i = j;
    }
  };
  recorrer(css.replace(/\/\*[\s\S]*?\*\//g, ''), null);
  return out;
}
/** Las declaraciones de un cuerpo, como mapa propiedad → valor (la última gana, como en CSS). */
function declaraciones(cuerpo) {
  const d = new Map();
  for (const trozo of cuerpo.split(';')) {
    const k = trozo.indexOf(':');
    if (k < 0) continue;
    d.set(trozo.slice(0, k).trim().toLowerCase(), trozo.slice(k + 1).trim().toLowerCase());
  }
  return d;
}
const REGLAS = reglas(CSS);
const DE_LA_HOJA = REGLAS.filter((r) => r.selectores.includes(HOJA));
/** ¿Esta regla le quita el estirado a un hijo de un flex en columna? (márgenes laterales `auto`) */
function centraConAuto(d) {
  if (d.get('margin-inline') === 'auto' || d.get('margin-left') === 'auto' || d.get('margin-right') === 'auto') return true;
  const m = d.get('margin');
  if (!m) return false;
  const partes = m.split(/\s+/); // margin: a | a b | a b c | a b c d → el lateral es el 2º (o el 1º si va solo)
  return (partes.length === 1 ? partes[0] : partes[1]) === 'auto' || partes[3] === 'auto';
}

test('SCRUM-1722c · población: el CSS se ha leído y la hoja del parte tiene reglas que mirar', () => {
  assert.ok(REGLAS.length > 1000, `sólo ${REGLAS.length} reglas leídas de styles.css: el lector está roto, no el CSS`);
  assert.ok(DE_LA_HOJA.length >= 1, `ninguna regla con el selector «${HOJA}»: si la hoja ha cambiado de selector, este test ya no mira nada`);
  assert.ok(DE_LA_HOJA.some((r) => r.medio === null), 'la hoja no tiene regla BASE (fuera de @media): el móvil es justo lo que se quedaría sin mirar');
});

test('SCRUM-1722c · la premisa: `.main` es un flex en columna (por eso un hijo con márgenes auto deja de estirarse)', () => {
  const main = REGLAS.filter((r) => r.medio === null && r.selectores.includes('.main')).map((r) => declaraciones(r.cuerpo));
  assert.ok(main.length >= 1, 'no encuentro la regla base de `.main`');
  assert.ok(main.some((d) => d.get('display') === 'flex'), '`.main` ya no es flex: la causa de SCRUM-1722c hay que volver a medirla en navegador');
  assert.ok(main.some((d) => d.get('flex-direction') === 'column'), '`.main` ya no va en columna: la causa de SCRUM-1722c hay que volver a medirla en navegador');
});

test('SCRUM-1722c · la hoja del parte se CENTRA (si no, este test vigila una regla que ya no existe)', () => {
  const base = DE_LA_HOJA.filter((r) => r.medio === null).map((r) => declaraciones(r.cuerpo));
  assert.ok(base.some(centraConAuto), 'la regla base de la hoja ya no lleva márgenes laterales `auto`: revisa si este test sigue teniendo sentido');
});

test('SCRUM-1722c · toda regla que centra la hoja del parte con márgenes auto le pide `width: 100%`', () => {
  const centran = DE_LA_HOJA.filter((r) => centraConAuto(declaraciones(r.cuerpo)));
  assert.ok(centran.length >= 1, 'ninguna regla de la hoja centra con auto: el control positivo de arriba debería haber caído antes');
  for (const r of centran) {
    const d = declaraciones(r.cuerpo);
    assert.equal(d.get('width'), '100%',
      `«${HOJA}» ${r.medio ? 'en ' + r.medio : '(regla base)'} lleva márgenes auto y NO pide ancho: la hoja mide lo que mida su contenido `
      + '(451 px en un móvil de 390 con una dirección larga). Cuerpo: ' + r.cuerpo.replace(/\s+/g, ' ').trim());
  }
});

test('SCRUM-1722c · el ancho que pide la regla base no lo quita ninguna regla posterior de la hoja', () => {
  // `width: auto` (o cualquier otro ancho) en una regla de la hoja más abajo devolvería el defecto a ese tramo.
  const quitan = DE_LA_HOJA.filter((r) => { const w = declaraciones(r.cuerpo).get('width'); return w !== undefined && w !== '100%'; });
  assert.deepEqual(quitan.map((r) => `${r.medio || 'base'} → ${r.cuerpo.replace(/\s+/g, ' ').trim()}`), []);
});

test('SCRUM-1722c · la sonda del parte mide el borde REAL y lleva la obra larga como control positivo', () => {
  const sinComentarios = SONDA.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  // El `desbordeX` del 12-nov era `html.scrollWidth − clientWidth`, que bajo `overflow-x: clip` da 0 con la hoja en 451.
  assert.ok(!/desbordeX:\s*document\.documentElement\.scrollWidth/.test(sinComentarios),
    'la sonda vuelve a medir `desbordeX` con html.scrollWidth: bajo `overflow-x: clip` eso dice 0 aunque la hoja se salga');
  assert.match(sinComentarios, /getBoundingClientRect\(\)[\s\S]{0,400}c\.right > max/, 'la sonda ya no busca la caja más a la derecha de la vista');
  assert.match(sinComentarios, /obra-larga-REAL/, 'falta el caso REAL con obra larga (el control positivo)');
  assert.match(sinComentarios, /obra-larga-SIMULADO/, 'falta el caso con la obra larga inyectada');
  assert.match(sinComentarios, /process\.exit\(rojas\.length \|\| ciegas\.length \? 1 : 0\)/, 'la sonda ya no sale con código 1 cuando algo desborda o no pudo mirar');
});
