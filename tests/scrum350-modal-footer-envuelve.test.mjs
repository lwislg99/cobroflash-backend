// tests/scrum350-modal-footer-envuelve.test.mjs — SCRUM-350, guard estructural, sin gate.
//
// EL PIE DE LOS MODALES ENVUELVE, Y NADIE LO DESHACE SIN QUE ALGO SE PONGA ROJO.
//
// `.modal-footer` es `display:flex` y los botones llevan `white-space:nowrap` (styles.css): sin
// `flex-wrap`, ni el texto del botón parte ni la fila se parte, así que lo que no cabe se SALE
// —y como el pie alinea a `flex-end`, se sale por la IZQUIERDA, fuera de la pantalla y sin
// scroll que lo alcance. Medido a 390 px (iPhone estándar) el primer botón empezaba en x=-83.
//
// Este fichero vigila tres cosas distintas, y las tres hacen falta:
//   1. QUÉ HAY — censo derivado de los pies, con suelo por forma de escritura. El arreglo es
//      CSS compartido: alcanza a todos a la vez, así que saber cuántos son es parte del cambio.
//   2. QUE SIGUE ARREGLADO — `flex-wrap: wrap` en la regla compartida y de primer nivel.
//   3. LA OTRA CARA — que el arreglo no se cuele reescribiendo el pie: las otras cuatro
//      declaraciones son las que decidían el aspecto de los nueve pies que YA cabían, y
//      moverlas es exactamente el fallo que este ticket no debe cometer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censarPiesDeModal, fuentesDeFront, ficherosQueNombranElPie, declaracionesDeRegla,
} from './_censo-modal-footer.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const CSS = path.join(RAIZ, 'public/dashboard/css/styles.css');

const FUENTES = fuentesDeFront(fs, path, RAIZ);
const CENSO = censarPiesDeModal(FUENTES);
const HOJA = fs.readFileSync(CSS, 'utf8');

// ── SUELOS, medidos HOY sobre `main` ─────────────────────────────────────────
// No son cifras de gusto: son lo que hay, fijado. Si un detector deja de reconocer su forma,
// el conteo baja y esto cae. Un cero de «no hay pies» y uno de «no supe mirar» son el mismo
// número y significan lo contrario.
const SUELO_TOTAL = 10;
const SUELO_PLANTILLA = 5;     // HTML dentro de template literals
const SUELO_CREATE = 4;        // document.createElement + .className
const SUELO_HELPER = 1;        // createElement(tag, clase, texto) propio de la vista

test('SCRUM-350 · SUELO: el censo encuentra los pies de modal', () => {
  assert.ok(CENSO.pies.length >= SUELO_TOTAL,
    `🔴 el censo solo vio ${CENSO.pies.length} pies (esperados ≥${SUELO_TOTAL}). O ha ` +
    'desaparecido un modal, o el analizador dejó de reconocerlo. Las dos cosas son rojo.');
  assert.ok(FUENTES.length >= 40,
    `🔴 solo ${FUENTES.length} ficheros de front escaneados: el barrido no está llegando.`);
});

test('SCRUM-350 · SUELO: el censo ve las TRES formas de escribir un pie', () => {
  const p = CENSO.porOrigen;
  assert.ok((p.plantilla || 0) >= SUELO_PLANTILLA,
    `🔴 solo ${p.plantilla || 0} pies escritos como HTML en plantilla (esperados ≥${SUELO_PLANTILLA}).`);
  assert.ok((p.createElement || 0) >= SUELO_CREATE,
    `🔴 solo ${p.createElement || 0} pies construidos con document.createElement (esperados ≥${SUELO_CREATE}).`);
  assert.ok((p.helper || 0) >= SUELO_HELPER,
    `🔴 ningún pie visto por el helper createElement(tag, clase, texto). Es la forma que usa ` +
    'customersView, y un censo que solo mirase las otras dos la perdería entera.');
});

test('SCRUM-350 · SUELO: ningún pie censado se queda sin botones', () => {
  // Un pie con 0 botones no existe en este producto: significa que el analizador encontró el
  // contenedor y perdió su contenido, que es justo el caso en el que el censo daría verde
  // sobre un modal sin haberlo mirado.
  const vacios = CENSO.pies.filter((p) => p.nBotones === 0);
  assert.deepEqual(vacios.map((p) => `${p.fichero}:${p.linea}`), [],
    '🔴 hay pies censados sin ningún botón resuelto: el censo los está viendo a medias.');
});

test('SCRUM-350 · COBERTURA: nadie usa `.modal-footer` fuera de lo que el censo mira', () => {
  // El suelo de arriba dice «encontré 10». Este dice «y no hay un undécimo en un sitio donde
  // ni miro». Sin él, un modal nuevo en otra carpeta entraría sin que nada se enterase.
  const mirados = new Set(FUENTES.map((f) => f.ruta));
  const nombran = ficherosQueNombranElPie(fs, path, RAIZ)
    .filter((f) => !f.endsWith('.css'));   // styles.css es quien DEFINE la clase
  const ciegos = nombran.filter((f) => !mirados.has(f));
  assert.deepEqual(ciegos, [],
    `🔴 estos ficheros usan .modal-footer y el censo no los está mirando: ${ciegos.join(', ')}. ` +
    'El arreglo es CSS compartido: un pie fuera del censo es un pie que nadie ha medido.');
});

// ── EL ARREGLO ───────────────────────────────────────────────────────────────

test('SCRUM-350 · `.modal-footer` envuelve en vez de desbordar', () => {
  const d = declaracionesDeRegla(HOJA, '.modal-footer');
  assert.ok(d, '🔴 no se encontró la regla `.modal-footer` de primer nivel en styles.css.');
  assert.equal(d['flex-wrap'], 'wrap',
    '🔴 `.modal-footer` volvió a quedarse sin `flex-wrap: wrap`. Con los botones en ' +
    '`white-space: nowrap`, lo que no cabe se sale por la izquierda de la pantalla.');
});

test('SCRUM-350 · LA OTRA CARA: el pie no se rediseña para arreglar uno solo', () => {
  // Nueve de los diez pies YA cabían. `flex-wrap: wrap` es un no-op cuando los botones entran
  // en una línea — por eso los deja idénticos. Cambiar `justify-content`, el `gap`, el
  // `padding` o pasar a `column` SÍ los movería a todos: sería «arreglar» uno y estropear
  // nueve, que es peor que el defecto de partida.
  const d = declaracionesDeRegla(HOJA, '.modal-footer');
  assert.equal(d.display, 'flex');
  assert.equal(d['justify-content'], 'flex-end');
  assert.equal(d.gap, '8px');
  assert.equal(d.padding, '0 24px 20px');
  assert.equal(d['flex-direction'], undefined,
    '🔴 `.modal-footer` ha pasado a apilar en columna: eso reordena los diez pies del ' +
    'dashboard, no solo el que se rompía.');
});

// ── PROBADO EN ROJO ──────────────────────────────────────────────────────────
// Comprobar que el analizador encuentra lo que espera solo prueba que espera lo que encuentra.
// Aquí se le QUITA la cosa vigilada y se exige que el resultado cambie.

test('SCRUM-350 · ROJO: si un pie deja de llevar la clase, el censo lo pierde', () => {
  const victima = 'public/dashboard/js/nuevaFacturaModal.js';
  const mutadas = FUENTES.map((f) =>
    f.ruta === victima ? { ...f, texto: f.texto.replace(/'modal-footer'/g, "'pie-cualquiera'") } : f);
  const tras = censarPiesDeModal(mutadas);
  assert.equal(tras.pies.length, CENSO.pies.length - 1,
    '🔴 quitarle la clase a un pie NO bajó el conteo: el censo no está mirando lo que dice ' +
    'mirar, y su suelo sería un adorno.');
  assert.ok(!tras.pies.some((p) => p.fichero === victima),
    '🔴 el pie mutado sigue apareciendo en el censo.');
});

test('SCRUM-350 · ROJO: si un pie pierde un botón, el censo lo nota', () => {
  const victima = 'public/dashboard/js/jobDetailView.js';
  const mutadas = FUENTES.map((f) =>
    f.ruta === victima ? { ...f, texto: f.texto.replace('footer.append(cancelar, emitir);', 'footer.append(cancelar);') } : f);
  const tras = censarPiesDeModal(mutadas);
  const antes = CENSO.pies.find((p) => p.fichero === victima);
  const ahora = tras.pies.find((p) => p.fichero === victima);
  assert.equal(antes.nBotones, 2);
  assert.equal(ahora.nBotones, 1,
    '🔴 quitar un botón del pie no cambió el censo: no está leyendo los botones de verdad.');
});

test('SCRUM-350 · ROJO: el guard del CSS cae si se quita `flex-wrap`', () => {
  const sinArreglo = HOJA.replace(/^\s*flex-wrap: wrap;\s*$/m, '');
  const d = declaracionesDeRegla(sinArreglo, '.modal-footer');
  assert.equal(d['flex-wrap'], undefined,
    '🔴 el guard sigue viendo `flex-wrap` con la línea quitada: está leyendo otra cosa ' +
    '(el comentario, u otra regla), no la declaración.');
});

// ── CONTROLES NEGATIVOS ──────────────────────────────────────────────────────

test('SCRUM-350 · control negativo: el guard NO se conforma con la palabra en un comentario', () => {
  // El comentario que explica el arreglo, encima de la propia regla, contiene la cadena
  // «flex-wrap». Un guard escrito con `includes()` se cazaría a sí mismo y daría verde con la
  // regla vacía. Este lee declaraciones, así que el comentario no le vale.
  assert.ok(/flex-wrap/.test(HOJA.match(/\/\*[^*]*SCRUM-350[\s\S]*?\*\//)?.[0] || ''),
    'este control asume que el comentario de SCRUM-350 menciona flex-wrap; si ya no, sobra.');
  const soloComentario = HOJA.replace(/^\s*flex-wrap: wrap;\s*$/m, '');
  assert.ok(soloComentario.includes('flex-wrap'),
    'el comentario sigue ahí: es justo la trampa que este control comprueba.');
  assert.equal(declaracionesDeRegla(soloComentario, '.modal-footer')['flex-wrap'], undefined,
    '🔴 el guard aceptó una MENCIÓN en un comentario como si fuera la declaración.');
});

test('SCRUM-350 · control negativo: `flex-wrap` dentro de un @media no cuenta como arreglo', () => {
  // Arreglarlo solo bajo `max-width: 639px` dejaría el componente compartido roto fuera de esa
  // ventana. La regla que vale es la de primer nivel.
  const movido = HOJA
    .replace(/^\s*flex-wrap: wrap;\s*$/m, '')
    .replace('@media (max-width: 639px) {', '@media (max-width: 639px) {\n  .modal-footer { flex-wrap: wrap; }');
  assert.ok(movido.includes('.modal-footer { flex-wrap: wrap; }'), 'la mutación debe haberse aplicado');
  assert.equal(declaracionesDeRegla(movido, '.modal-footer')['flex-wrap'], undefined,
    '🔴 el guard dio por bueno un `flex-wrap` que solo existe dentro de una media query.');
});

test('SCRUM-350 · control negativo: el censo no confunde otros contenedores con el pie', () => {
  // `.modal-share` y `.modal-body` también son contenedores flex de un modal, y `.modal-share`
  // hasta lleva `flex-wrap: wrap`. Ninguno es el pie: si el censo los tragase, el conteo
  // subiría y el suelo dejaría de significar nada.
  const share = declaracionesDeRegla(HOJA, '.modal-share');
  assert.equal(share['flex-wrap'], 'wrap', 'suposición del control: .modal-share ya envolvía');
  assert.ok(CENSO.pies.every((p) => p.clasesDelPie.split(/\s+/).includes('modal-footer')),
    '🔴 el censo ha metido como pie algo que no lleva la clase `modal-footer`.');
});
