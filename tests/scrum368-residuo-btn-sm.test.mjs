// tests/scrum368-residuo-btn-sm.test.mjs — SCRUM-368 · el residuo de contraste, contado.
//
// EL NÚMERO DE BOTONES PEQUEÑOS QUE NO CUMPLEN AA NO PUEDE SUBIR EN SILENCIO.
//
// ── QUÉ ES ESTO ──────────────────────────────────────────────────────────────
// A1 (texto grande) salvó los botones primarios normales: con >=18,66px y peso >=700 el umbral
// de WCAG SC 1.4.3 baja a 3:1 y el 3,30 de blanco sobre --brand cumple. Pero a un botón PEQUEÑO
// no se le puede poner letra de 18,66px sin dejar de ser pequeño, así que los `btn-primary
// btn-sm` se quedan en 12,5px/600 → umbral 4,5 → siguen en 3,30 y NO cumplen.
//
// Eso es un residuo conocido, no un olvido. Y un residuo aceptado sin contador se convierte en
// un residuo creciente: por eso se cuenta aquí, con su reparto, y el test cae si sube O si baja.
//
// ── POR QUÉ NO LO VE EL GUARD DE NAVEGADOR ───────────────────────────────────
// `npm run guard:contraste` mide las páginas HTML estáticas, y estos botones viven en las vistas
// del dashboard que se generan por JS con datos de sesión. Su censo sale del árbol del front,
// que es la misma vía por la que SCRUM-352 contó los 185 conjuntos sin base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fuentesDeFront, censarUsosDeBoton } from './_censo-clases-de-boton.mjs';
import { parsearReglas, censarClasesDeBoton } from './_censo-anillo-foco.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const HOJA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');

const CLASES = censarClasesDeBoton(parsearReglas(HOJA));
const FUENTES = fuentesDeFront(fs, path, RAIZ);
const CENSO = censarUsosDeBoton(FUENTES, CLASES);

/** Conjuntos que son botón PRIMARIO **y** pequeño: el residuo. */
const RESIDUO = CENSO.conjuntos.filter(
  (c) => c.clases.includes('btn-primary') && c.clases.includes('btn-sm'),
);

// Medido el 5-ago-2026 en el árbol del front. Si cambia, hay que mirarlo y anotarlo.
//
// ⚠ SON 35 SITIOS, NO 28. El 28 que aparece en la entrada del máster cuenta RÓTULOS DISTINTOS
// (textos únicos); éste cuenta CONJUNTOS DE CLASES, o sea sitios donde se escribe la combinación.
// Varios sitios comparten rótulo, y algunos no tienen texto literal extraíble. El número que
// importa para «cuántos botones no cumplen» es éste: 35.
const ESPERADO = 35;

test('SUELO: el censo del front sigue viendo botones', () => {
  assert.ok(CENSO.conjuntos.length > 50,
    `el censo vio ${CENSO.conjuntos.length} conjuntos: está ciego y un residuo de 0 no significaría nada`);
  assert.ok(CLASES.includes('btn-primary') && CLASES.includes('btn-sm'),
    `faltan clases derivadas del CSS: ${CLASES.join(', ')}`);
});

test('el residuo de btn-sm primarios NO ha crecido', () => {
  const detalle = [...new Set(RESIDUO.map((c) => `${c.fichero}:${c.linea}`))].sort();
  assert.equal(
    RESIDUO.length, ESPERADO,
    `el residuo de contraste era ${ESPERADO} y ahora es ${RESIDUO.length}.\n\n` +
    `  Son botones \`btn-primary btn-sm\`: 12,5px/600, blanco sobre --brand = 3,30:1, umbral 4,5.\n` +
    `  NO cumplen AA y se aceptaron a sabiendas (SCRUM-368), pero el número no puede subir en\n` +
    `  silencio: un residuo aceptado sin contador es un residuo creciente.\n\n` +
    `  Si SUBIÓ: alguien añadió un botón primario pequeño más. ¿Hace falta que sea primario?\n` +
    `  Si BAJÓ: enhorabuena — actualiza ESPERADO y anota la mejora.\n\n` +
    `  Sitios:\n    ${detalle.join('\n    ')}`,
  );
});

test('NINGÚN btn-sm primario está en una página pública', () => {
  // Es lo que acota el daño: el residuo vive detrás del login, no en la cara que ve un
  // desconocido. Si eso deja de ser cierto, la decisión de aceptarlo cambia de peso.
  const publicos = RESIDUO.filter((c) => !c.fichero.includes('public/dashboard/'));
  assert.deepEqual(
    publicos.map((c) => `${c.fichero}:${c.linea}`), [],
    'un botón primario pequeño ha aparecido FUERA del dashboard, o sea en superficie pública. ' +
    'El residuo se aceptó porque ninguno lo estaba: con éste, esa razón deja de valer.',
  );
});

test('CONTROL NEGATIVO: los btn-sm que NO son primarios no cuentan como residuo', () => {
  // El residuo es de contraste (blanco sobre verde), no de tamaño. Un `btn-secondary btn-sm`
  // es texto oscuro sobre blanco: 17,52:1. Si el censo los metiera, el número no significaría nada.
  const otros = CENSO.conjuntos.filter(
    (c) => c.clases.includes('btn-sm') && !c.clases.includes('btn-primary'),
  );
  assert.ok(otros.length > 0, 'no hay btn-sm no primarios: el control negativo no prueba nada');
  for (const c of otros) {
    assert.ok(!RESIDUO.includes(c), `${c.fichero}:${c.linea} no es primario y está contado como residuo`);
  }
});
