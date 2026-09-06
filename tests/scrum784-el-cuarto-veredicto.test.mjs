// tests/scrum784-el-cuarto-veredicto.test.mjs — SCRUM-784
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL META-GUARD NO DISTINGUÍA «ESTE TEST NO CAYÓ» DE «NO HUBO TEST».
//
// `cayo(resultado, nombre)` busca el nombre declarado entre los caídos. Cuando el RADIO de una
// mutación mata el fichero entero, `node:test` emite **un solo** `test:fail` cuyo `name` es **LA
// RUTA del fichero**, no el nombre de un test. `cayo()` no lo encontraba y el meta-guard dictaba
// **MUDO** —«pasa en verde sobre el defecto que dice vigilar»— sobre un guard que SÍ se puso rojo.
//
// Las TRES formas, medidas el 6-sep-2026 con el mismo guard y la misma línea mutada:
//
//     A · sin mutar .................... pasados 7 · caídos 0
//     B · un test cae, el fichero VIVE . pasados 4 · caídos 3   ← los tres son NOMBRES de test
//     C · el fichero MUERE ............. pasados 0 · caídos 1   ← el caído es LA RUTA del fichero
//
// ── POR QUÉ NO LO TAPABA SCRUM-748 ──────────────────────────────────────────────────────────
// Aquella cerró el fichero que muere en la PASADA LIMPIA (PUERTA 1: sin el test en verde, no se
// muta). Aquí la línea base está VERDE —7 pasados— y el fichero muere DESPUÉS de mutar.
//
// ⛔ Y LO QUE ESTE GUARD TAMBIÉN VIGILA: que el arreglo NO se haya hecho relajando `cayo()`. Un
// `cayo()` que aceptara cualquier fallo como caída convertiría el instrumento en un sello de goma,
// que es justo lo contrario del ticket.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cayo, murioElFichero, paso } from '../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YO = 'scrum784-el-cuarto-veredicto.test.mjs';
const RUTA_YO = path.join(RAIZ, 'tests', YO);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ① EL DETECTOR · las tres formas, y la que decide provocada
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-784 · 🔴 un caído que es LA RUTA del fichero es una MUERTE, no un silencio', () => {
  // C · el caso del ticket: `node:test` no reporta ni un nombre de test.
  assert.equal(murioElFichero({ pasados: [], caidos: [RUTA_YO] }, YO), true,
    '🔴 el fichero murió al mutar y el meta-guard no lo ve: dictaría MUDO sobre un guard que SÍ '
    + 'se puso rojo. Es la falsa acusación de SCRUM-784.');

  // B · CONTROL NEGATIVO, y es el que decide que esto sirva: con el fichero VIVO y tests caídos,
  // esto NO puede dispararse. Si se disparara, toda mutación que tumba un test se leería como
  // muerte de fichero y el veredicto perdería sentido.
  assert.equal(murioElFichero({
    pasados: ['SCRUM-784 · otro'],
    caidos: ['SCRUM-784 · 🔴 un caído que es LA RUTA del fichero es una MUERTE, no un silencio'],
  }, YO), false,
    '🔴 un NOMBRE de test se está leyendo como la ruta del fichero.');

  // A · sin caídos no hay nada que interpretar.
  assert.equal(murioElFichero({ pasados: ['x'], caidos: [] }, YO), false);

  // Y la ruta de OTRO fichero tampoco: la pregunta es si murió ESTE guard.
  assert.equal(murioElFichero({ caidos: [path.join(RAIZ, 'tests', 'utils.test.mjs')] }, YO), false,
    '🔴 la muerte de otro fichero se está atribuyendo a este guard.');
});

test('SCRUM-784 · 🔴 la ruta se compara NORMALIZADA: la unidad en minúscula es la misma ruta', () => {
  // 🔴 ESTO NO ES UN ADORNO: la primera versión del detector comparaba con `path.resolve` y dio
  // **false** sobre el caso real por esto exactamente. Medido: `realpathSync` CONSERVA la
  // mayúscula de la unidad y `realpathSync.native` la NORMALIZA.
  const enMinuscula = RUTA_YO.charAt(0).toLowerCase() + RUTA_YO.slice(1);
  assert.notEqual(enMinuscula, RUTA_YO,
    '🔴 este caso no está probando nada: las dos rutas ya eran idénticas. (¿No es Windows?)');
  assert.equal(murioElFichero({ caidos: [enMinuscula] }, YO), true,
    '🔴 la misma ruta con la unidad en minúscula se lee como otro fichero. Con eso, una muerte '
    + 'real volvería a salir MUDA.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ② ⛔ EL ARREGLO NO PUEDE SER RELAJAR `cayo()`
// ─────────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-784 · ⛔ `cayo()` sigue exigiendo EL NOMBRE declarado, ni uno más', () => {
  // Un fallo que NO es el nombre declarado no es una caída, aunque el fichero esté en rojo. Si
  // esto pasara a `true`, el meta-guard firmaría cualquier rojo como «el guard vigila».
  assert.equal(cayo({ caidos: [RUTA_YO] }, 'un test que no ha caído'), false,
    '🔴 `cayo()` acepta la muerte del fichero como si fuera la caída del test declarado: eso es '
    + 'un sello de goma, y es justo lo que SCRUM-784 NO se podía permitir.');
  assert.equal(cayo({ caidos: ['SCRUM-784 · otro test cualquiera'] }, 'el mío'), false,
    '🔴 `cayo()` acepta la caída de OTRO test como si fuera la del declarado.');

  // CONTROL POSITIVO: con el nombre declarado entre los caídos, sí. Sin esto, un `cayo()` que
  // devolviera `false` siempre pasaría los dos asertos de arriba.
  assert.equal(cayo({ caidos: ['SCRUM-784 · el mío, entero'] }, 'el mío'), true,
    '🔴 `cayo()` ya no reconoce el nombre declarado: no estaría reconociendo NINGUNA caída.');

  // Y `paso()` mira los PASADOS, que es de donde sale la línea base de SCRUM-748.
  assert.equal(paso({ pasados: ['SCRUM-784 · el mío, entero'] }, 'el mío'), true);
  assert.equal(paso({ pasados: [] }, 'el mío'), false);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA MUTACIÓN QUE ME TUMBA (SCRUM-745)
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // El detector deja de ver la muerte: se vuelve al MUDO falso de SCRUM-784.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return (resultado?.caidos || []).some((n) => rutaRealDe(n) === objetivo);',
    a: '  return false;',
    cae: 'un caído que es LA RUTA del fichero es una MUERTE, no un silencio',
  },
  {
    // El detector se dispara con cualquier caída: toda mutación que tumba un test se leería como
    // muerte de fichero, y el cuarto veredicto se comería a los otros tres.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return (resultado?.caidos || []).some((n) => rutaRealDe(n) === objetivo);',
    a: '  return (resultado?.caidos || []).length > 0;',
    cae: 'un caído que es LA RUTA del fichero es una MUERTE, no un silencio',
  },
  {
    // Se vuelve a comparar con la ruta SIN normalizar la unidad: el defecto que se midió a mano.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: 'const rutaRealDe = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };',
    a: 'const rutaRealDe = (p) => { try { return fs.realpathSync(p); } catch { return null; } };',
    cae: 'la ruta se compara NORMALIZADA: la unidad en minúscula es la misma ruta',
  },
  {
    // 🔴 `cayo()` relajado a «cualquier rojo vale»: el sello de goma que el ticket prohíbe.
    fichero: 'scripts/meta-guard-mutaciones.mjs',
    de: '  return (resultado?.caidos || []).some((n) => n.includes(nombre));',
    a: '  return (resultado?.caidos || []).length > 0;',
    cae: '`cayo()` sigue exigiendo EL NOMBRE declarado, ni uno más',
  },
];
