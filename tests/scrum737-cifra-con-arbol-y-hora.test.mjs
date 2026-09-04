// tests/scrum737-cifra-con-arbol-y-hora.test.mjs — SCRUM-737
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN NÚMERO NECESITA SU UNIDAD, SU ÁRBOL Y SU HORA
//
// LA VÍCTIMA, y es de hoy: S3 escribió siete cifras y a los 90 minutos SEIS ya eran otras. Un
// número en un comentario no tiene fecha de caducidad visible, y el que lo lee no sabe que ya no
// vale — pero lo usa igual para decidir.
//
// ── LA JERARQUÍA, QUE NO ES MÍA: LA TENÍA ESCRITA LA CASA ────────────────────────────────
//   ① DERIVAR — que la cuente el guard. Donde el número vive en un mensaje interpolable,
//      desaparece del texto (SCRUM-498).
//   ② REFORMULAR — que la frase deje de decir un número. **Una frase sin número no se
//      desincroniza** (SCRUM-680), y es mejor que atarla: no hay nada que mantener.
//   ③ ATAR al recuento derivado, cuando derivar es imposible (SCRUM-498).
//   ④ ANCLAR con fecha o sha visible: un número CON su hora **no es el defecto**.
//   ⑤ RETIRAR, si no sostiene el argumento.
//
// ⛔ LO QUE NO VALE, y es la tentación entera: «actualizar» la cifra al valor de hoy. Eso
// reproduce el defecto mañana, y encima con aspecto de arreglo.
//
// ── LAS DOS INSTANCIAS MEDIDAS, Y CÓMO SE TRATÓ CADA UNA ─────────────────────────────────
//   · `scrum667` daba el total de marcas de microcopy «de hoy», desglosado en tres poblaciones —
//     un ESTADO del árbol, y derivable: lo cuenta `scripts/censo-marcadores.mjs`. → ② remite al
//     censo, sin escribir la cifra.
//   · `scrum709` daba el recuento de tests en verde del día de la PR #982 — un HECHO HISTÓRICO,
//     no derivable. El número no sostenía el argumento (que la suite estuviera verde ya lo dice).
//     → ⑤ retirado.
//
// Dos familias distintas y dos tratamientos distintos: por eso la jerarquía tiene cinco escalones
// y no uno.
//
// ⚠️ Y NINGUNA DE LAS DOS CIFRAS SE REPRODUCE AQUÍ, aunque explicarlas invitara a hacerlo. Pasó:
// la primera versión de esta cabecera copiaba la frase original entera y **el guard se cazó a sí
// mismo**, con razón. Un guard de texto se caza en el comentario que explica la prohibición, y la
// salida no es eximirse: es describir la cifra sin escribirla.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  censo, cifrasSinAncla, tamanoPoblacion, llevaAncla, POBLACION, CEBO, CEBO_ESPERADO,
} from './_cifras-sin-ancla.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/**
 * 🔴 EL CENSO CONGELADO. 78 cifras sin ancla el 4-sep-2026, tras retirar las dos de
 * `scrum667` y `scrum709` (eran 80). **No puede SUBIR.** Si BAJA, se actualiza aquí y se anota
 * cuál se arregló — un censo que encoge en silencio deja de vigilar sin que nadie lo sepa.
 */
const CENSO_CONGELADO = 78;

/** Suelo de población: si el barrido lee menos ficheros que esto, no está mirando el árbol. */
const MINIMO_FICHEROS = 700;

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO — un cero puede ser «no hay» o «no supe mirar», y no son lo mismo
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-737 · 🔴 SUELO: el barrido LEE el árbol, y la autoprueba acierta las dos del cebo', () => {
  const n = tamanoPoblacion(RAIZ);
  assert.ok(n >= MINIMO_FICHEROS,
    `🔴 CIEGO: la población son ${n} ficheros y se esperaban al menos ${MINIMO_FICHEROS}. ` +
    `El barrido no está llegando al árbol (población declarada: ${POBLACION.map((p) => p.dir + '/*' + p.ext).join(', ')}).`);

  // La autoprueba: sobre fuente sintética, el detector tiene que acertar EXACTAMENTE dos.
  const r = cifrasSinAncla('cebo.js', CEBO).map((c) => ({ linea: c.linea, cifra: c.cifra }));
  assert.deepEqual(r, CEBO_ESPERADO,
    '🔴 EL DETECTOR NO MIDE LO QUE DICE. Sobre el cebo debe ver las dos afirmaciones de recuento ' +
    'sin fecha y NINGUNA de las cuatro legítimas.');

  const total = censo(RAIZ).length;
  assert.ok(total > 0,
    '🔴 CERO. Un censo que no encuentra ni una cifra sin ancla sobre 850 ficheros no está midiendo: ' +
    'está roto. «No hay defecto» y «no supe mirar» son el mismo número con significados opuestos.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO NO CRECE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-737 · 🔴 el censo de cifras SIN ancla no crece, y si baja hay que anotarlo', () => {
  const todas = censo(RAIZ);
  const detalle = todas
    .map((c) => `   ${c.fichero}:${c.linea}  [${c.cifra}]  ${c.frase.slice(0, 90)}`)
    .join('\n');

  assert.ok(todas.length <= CENSO_CONGELADO,
    `🔴 HAY ${todas.length} CIFRAS SIN ANCLA Y EL CENSO ESTABA EN ${CENSO_CONGELADO}.\n` +
    'Has escrito un número en un comentario que afirma un recuento del árbol y no dice de cuándo es.\n' +
    'NO lo «actualices» al valor de hoy: eso reproduce el defecto mañana. Elige, en este orden:\n' +
    '  ① DERIVARLO (que lo cuente el guard)  ② REFORMULAR para que la frase no diga número\n' +
    '  ③ ATARLO al recuento derivado  ④ ANCLARLO con fecha o sha  ⑤ RETIRARLO si no aporta\n' +
    detalle);

  assert.equal(todas.length, CENSO_CONGELADO,
    `✅ EL CENSO HA BAJADO a ${todas.length} (estaba en ${CENSO_CONGELADO}). Es una buena noticia, ` +
    'pero hay que escribirla: actualiza `CENSO_CONGELADO` y anota cuál se arregló y cómo. ' +
    'Un censo que encoge sin que nadie lo mire deja de vigilar en silencio.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS ARREGLADAS NO VUELVEN
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-737 · las dos instancias arregladas NO reaparecen', () => {
  const vuelven = censo(RAIZ)
    .filter((c) => /scrum667-marcador-visible|scrum709-microcopy-por-fichero/.test(c.fichero))
    .map((c) => `${c.fichero}:${c.linea} [${c.cifra}] ${c.frase.slice(0, 80)}`);

  assert.deepEqual(vuelven, [],
    '🔴 HA VUELTO UNA CIFRA A UN FICHERO YA ARREGLADO. `scrum667` remite al censo y `scrum709` ' +
    'retiró el recuento a propósito; volver a escribirlo deshace SCRUM-737 en el mismo sitio.\n     ' +
    vuelven.join('\n     '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// CONTROL NEGATIVO — lo que deliberadamente NO debe hacerlo caer
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-737 · CONTROL NEGATIVO: fecha visible, numeración y datos de caso NO son el defecto', () => {
  const INOCUAS = [
    ['// el 4-sep-2026 el censo veía 99 ficheros', 'número CON fecha: seguirá siendo cierto mañana'],
    ['// Medido sobre 2026-09-04: 21 modelos', 'fecha ISO, misma razón'],
    ['// ── Caso 2: el cliente escribe ───', 'numeración de secciones, no un recuento'],
    ['// las 4 rutas de webhook quedan cubiertas', 'descripción de lo que el test cubre'],
    ['// 2h a 45€ (21% IVA) + 1 material', 'datos de un caso de prueba'],
    ['const url = "http://ejemplo.com/25 marcas hoy";', 'está dentro de una CADENA, no es comentario'],
    ['// SCRUM-498 y SCRUM-680 lo dejaron escrito', 'identificadores de ticket'],
  ];
  for (const [linea, porque] of INOCUAS) {
    const r = cifrasSinAncla('x.js', linea);
    assert.deepEqual(r, [],
      `🔴 FALSO POSITIVO — ${porque}:\n     ${linea}\n     ` +
      'Un censo que acusa a lo legítimo se desactiva solo, porque quien lo lee deja de creerlo.');
  }

  // Y el reconocedor de anclas, por separado.
  assert.equal(llevaAncla('medido el 4-sep-2026'), true);
  assert.equal(llevaAncla('medido el 2026-09-04'), true);
  assert.equal(llevaAncla('origin/main = 1304643497934441f88950e441182b7e344dbb57'), true);
  assert.equal(llevaAncla('hoy hay 25 marcas'), false, '🔴 «hoy» NO es un ancla: es lo contrario.');
});
