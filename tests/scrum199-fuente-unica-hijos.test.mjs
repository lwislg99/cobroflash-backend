// tests/scrum199-fuente-unica-hijos.test.mjs — SCRUM-199
//
// UNA sola fuente para «qué hijos/ficheros de la tanda son especiales»: HIJOS_SPEC en
// scripts/_evidencia-tanda.mjs. AISLADOS, CLAVES_HIJOS y el invariante de orden se DERIVAN de él;
// el runner y el verificador lo IMPORTAN. Este guard impide que cualquiera de esas listas reaparezca
// a mano — es el CUARTO caso del patrón «dos listas que deben cuadrar y nada las ata» de esta semana
// (MODELOS_POR_MERCHANT, CODEOWNERS↔ZONA_ROJA, los aislados, el suelo). La unificación arregla el
// estado de HOY; este guard es lo que impide la regresión de MAÑANA — sin él, se arregla una quinta vez.
//
// SIN GATE: solo lee fuente y datos puros; no toca BD, red ni disco (más allá de leer los .mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFuente } from './_guard-texto.mjs';
import { HIJOS_SPEC, AISLADOS, CLAVES_HIJOS, pesadoEsElUltimo } from '../scripts/_evidencia-tanda.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Los dos ficheros que ANTES tenían una copia a mano de la lista de aislados/claves.
const CONSUMIDORES = ['scripts/test-staging-gated.mjs', 'scripts/verificar-evidencia-tanda.mjs'];

test('SCRUM-199 · AISLADOS, CLAVES_HIJOS y el orden se DERIVAN del spec (no se repiten)', () => {
  assert.deepEqual(AISLADOS, HIJOS_SPEC.filter((h) => h.aislado).map((h) => h.fichero),
    'AISLADOS tiene que ser exactamente los ficheros de los hijos aislados');
  assert.deepEqual(CLAVES_HIJOS, HIJOS_SPEC.map((h) => h.clave),
    'CLAVES_HIJOS tiene que ser exactamente las claves del spec, en su orden de ejecución');
  assert.equal(pesadoEsElUltimo(), true,
    'el hijo pesado tiene que ir el ÚLTIMO del spec (invariante de orden Windows/DLL de Prisma)');
});

test('SCRUM-199 · ni el runner ni el verificador re-listan aislados/claves a mano', () => {
  // leerFuente quita comentarios (SCRUM-193): así este guard NO se caza a sí mismo con la prosa que
  // explica la prohibición — la trampa exacta que _guard-texto.mjs existe para cerrar (SCRUM-176).
  // Son .mjs → el `#` NO se filtra (bien: aquí no hay campos privados, y _guard-texto lo decide por
  // extensión, no a ciegas).
  for (const rel of CONSUMIDORES) {
    // SUELO (SCRUM-719): el ancla es LO QUE ESTE MISMO GUARD EXIGE — que el consumidor importe
    // del spec. Si `_evidencia-tanda` no sobrevive al filtro, las tres prohibiciones de abajo
    // son ciertas por vacías, no porque el fichero esté limpio.
    const fuente = leerFuente(path.join(RAIZ, rel), { ancla: '_evidencia-tanda' });

    // (1) Ningún NOMBRE de fichero .test.mjs a mano: los aislados viven SOLO en HIJOS_SPEC. El sufijo
    //     `.test.mjs` del filtro `readdir` NO casa: el patrón exige un NOMBRE (empieza por `\w`) antes
    //     del `.test.mjs`, y `'.test.mjs'` empieza por punto.
    assert.doesNotMatch(fuente, /['"][\w][\w.\-]*\.test\.mjs['"]/,
      `${rel}: hay un fichero .test.mjs escrito a mano — los aislados se DERIVAN de HIJOS_SPEC, no se re-listan (SCRUM-199)`);

    // (2) Ninguna RE-DECLARACIÓN local de AISLADOS/CLAVES_HIJOS: se importan del spec. El `import {…}`
    //     no lleva const/let/var delante, así que no casa; una copia local (`const AISLADOS = […]`) sí.
    assert.doesNotMatch(fuente, /\b(?:const|let|var)\s+(?:AISLADOS|CLAVES_HIJOS)\b/,
      `${rel}: re-declara AISLADOS/CLAVES_HIJOS — tienen que importarse de _evidencia-tanda.mjs (SCRUM-199)`);

    // (3) Ninguna CLAVE de hijo como literal de cadena: en el runner las claves vienen de `s.clave`.
    //     LIMITACIÓN CONOCIDA: una clave que fuese una palabra común podría dar falso positivo — falla
    //     hacia el lado seguro (obliga a usar el spec). Hoy (a55, bot, qa, scrum180) son distintivas.
    for (const clave of CLAVES_HIJOS) {
      assert.doesNotMatch(fuente, new RegExp(`['"]${clave}['"]`),
        `${rel}: la clave '${clave}' aparece como literal — las claves salen de HIJOS_SPEC (SCRUM-199)`);
    }
  }
});
