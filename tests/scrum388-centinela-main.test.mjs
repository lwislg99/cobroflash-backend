// tests/scrum388-centinela-main.test.mjs — SCRUM-388
//
// EL CENTINELA: el censo corriendo contra `main` DE VERDAD.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTE FICHERO NO FIJA NINGÚN VEREDICTO, Y ESA ES LA DECISIÓN
//
// La primera versión fijaba los de cuatro tickets reales (298, 293, 294, 354). Se retiró, y no por
// gusto: **un test que fija el estado actual convierte un defecto en un requisito.** «SCRUM-354 →
// NADA» se pondría rojo el día que alguien construya A9 —o sea, el día que se hace el trabajo
// BIEN— y quien lo encontrara tendría delante un test exigiéndole que A9 siga sin empezar. Ya nos
// pasó con el test que falló cuando el import se ARREGLÓ.
//
// Que el censo sepa CLASIFICAR lo prueba `scrum388-censo-mecanismo.test.mjs` contra fixtures
// congelados. Eso no caduca.
//
// Lo que queda aquí es lo único que `main` puede aportar sin caducar: **que el mecanismo siga
// sabiendo leer este repositorio**. Es una prueba de humo, no un inventario.
//
//   · Si `docs/master/` se mueve, si cambia el formato de los mensajes de commit, si la convención
//     de ramas deja de ser `scrum-<n>-<slug>` → el censo se queda ciego y ESTO lo dice.
//   · Si alguien construye un ticket que antes no tenía nada → esto **NO** se pone rojo. Es una
//     buena noticia, y una buena noticia no puede romper la suite.
//
// ⚠️ SI ESTE FICHERO CAE: **RE-MIDE, NO ARREGLES EL TEST.** Lo que ha cambiado es cómo se puede
// leer el repositorio, y el censo mide sobre esa lectura. Ajustar el umbral para que vuelva a
// pasar es apagar la alarma en vez de mirar el fuego.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { censarTicket, comprobarSuelo } from './_censo-tickets.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

test('SCRUM-388 · CENTINELA: el censo todavía sabe leer este repositorio', () => {
  const problemas = comprobarSuelo({ raiz: RAIZ });
  assert.deepEqual(problemas, [],
    '🔴 EL CENSO YA NO PUEDE MIRAR ESTE REPOSITORIO:\n   · ' + problemas.join('\n   · ') +
    '\n\n  ⚠️ RE-MIDE, NO ARREGLES EL TEST. Algo ha cambiado en cómo se lee el repo — la ruta de\n' +
    '  `docs/master/`, el acceso al historial de `origin/main`, o el propio fetch. Un censo que no\n' +
    '  sabe mirar devuelve «no hay trabajo pendiente», que es idéntico a lo que devuelve uno sano.');
});

test('SCRUM-388 · CENTINELA: las tres fuentes siguen produciendo evidencia en `main`', () => {
  // No se fija QUÉ ticket tiene qué, sino que **cada fuente sigue encontrando algo en alguna
  // parte**. Si un buscador se rompe —o la convención cambia— deja de aportar y aquí se ve, sin
  // depender de que ningún ticket concreto siga como estaba.
  //
  // El barrido va sobre un rango amplio a propósito: cualquier ticket sirve de testigo, así que
  // ninguno en particular puede hacer caer esto al avanzar su estado.
  const vistas = new Set();
  for (let n = 280; n <= 400; n++) {
    for (const f of censarTicket(n, { raiz: RAIZ }).fuentes) vistas.add(f);
    if (vistas.size === 3) break;
  }
  for (const fuente of ['commits', 'docs/master', 'ramas']) {
    assert.ok(vistas.has(fuente),
      `🔴 la fuente «${fuente}» no encuentra evidencia en NINGÚN ticket del rango 280-400.\n\n` +
      '  ⚠️ RE-MIDE, NO ARREGLES EL TEST. No significa que no haya trabajo: significa que ese\n' +
      '  buscador ha dejado de reconocer lo que mira. Los sospechosos, por orden: la convención de\n' +
      '  ramas (`scrum-<n>-<slug>`), el ticket en el ASUNTO del commit, o la ruta `docs/master/`.\n' +
      `  Fuentes que sí responden: [${[...vistas].join(', ')}]`);
  }
});

test('SCRUM-388 · CENTINELA: medir `main` no revienta ni con huecos del rango', () => {
  // Barrido de humo: números que existen, que no existen y de longitudes distintas. Lo que se
  // sostiene es que ninguno lanza y que todos devuelven un veredicto del conjunto cerrado.
  const VALIDOS = ['ENTERO', 'PARCIAL', 'NADA'];
  for (const n of [1, 42, 298, 354, 388, 999, 99999]) {
    const r = censarTicket(n, { raiz: RAIZ });
    assert.ok(VALIDOS.includes(r.veredicto),
      `🔴 SCRUM-${n} devolvió «${r.veredicto}», que no es uno de los tres veredictos`);
    assert.ok(typeof r.porque === 'string' && r.porque.length > 0,
      `🔴 SCRUM-${n} devolvió un veredicto sin motivo: un veredicto sin su evidencia es una opinión`);
  }
});
