// tests/scrum1080-cobro-profesional.test.mjs — SCRUM-1080
//
// Guarda que nadie prometa COBRO al PROFESIONAL (regla 24 enmendada, SCRUM-612c) en su propia app
// (`public/dashboard/**`) ni en los emails de ciclo de vida (`lifecycle.service.ts`) sin
// condicionarlo por el modo de emisión. El discriminador promesa-vs-condición vive y se explica en
// `_copy-cobro-profesional.mjs` (léelo antes de tocar esto: ahí está el porqué de la granularidad
// por FICHERO, no por función).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recolectarCopyProfesional, promesasDeCobro } from './_copy-cobro-profesional.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SCRUM-1080 · SUELO: el censo LEE de verdad (población + condición + detector)', () => {
  const corpus = recolectarCopyProfesional(RAIZ);
  // Población declarada: public/dashboard/** (84 .js + 2 .html a fecha de este commit) +
  // lifecycle.service.ts. Un número muy por debajo de eso es el árbol viejo o el recorrido roto.
  assert.ok(corpus.length >= 50, `🔴 censo vacío o roto: ${corpus.length} ficheros — no está recorriendo`);

  const lc = corpus.find((c) => c.rel === 'src/modules/messaging/domain/lifecycle.service.ts');
  assert.ok(lc, '🔴 lifecycle.service.ts no entró en el censo');
  assert.ok(lc.condicionado,
    '🔴 SUELO (condición): lifecycle.service.ts debería condicionar por modo de emisión hoy ' +
    '(usa getEmissionMode desde SCRUM-1029/#1650) y el detector dice que no — no está leyendo.');

  const sv = corpus.find((c) => c.rel === 'public/dashboard/js/settingsView.js');
  assert.ok(sv, '🔴 settingsView.js no entró en el censo');
  assert.ok(sv.condicionado,
    '🔴 SUELO (condición): settingsView.js gatea su tarjeta por appModoEmision desde #1650 y el ' +
    'detector dice que no.');

  // Control positivo del DETECTOR de promesas: una frase canónica debe caer.
  assert.equal(promesasDeCobro('Vas a cobrar antes de empezar').length, 1,
    '🔴 SUELO (detector): no reconoce una promesa canónica de cobro — un "0 problemas" de abajo no ' +
    'significaría nada.');
});

test('SCRUM-1080 · ninguna promesa de cobro al profesional sin condicionar por el modo de emisión', () => {
  const corpus = recolectarCopyProfesional(RAIZ);
  const problemas = [];
  let ficherosConGate = 0;

  for (const { rel, texto, condicionado } of corpus) {
    if (condicionado) { ficherosConGate++; continue; }
    for (const h of promesasDeCobro(texto)) {
      problemas.push(`${rel}:${h.linea} [${h.marcador}] «${h.frag}»`);
    }
  }

  // SUELO: si NINGÚN fichero de la población condiciona hoy, el detector de condición está ciego
  // y el "sin problemas" de abajo no demuestra nada (podría estar leyendo todo como condicionado
  // por accidente, o nada en absoluto).
  assert.ok(ficherosConGate >= 1,
    `🔴 SUELO: 0 de ${corpus.length} ficheros condicionan por modo de emisión — el detector de ` +
    'condición no lee, o el censo está vacío.');

  assert.deepEqual(problemas, [],
    'Promesa(s) de cobro al profesional SIN condicionar por modo de emisión (regla 24, ' +
    'SCRUM-612c):\n' + problemas.join('\n') +
    '\n\nEl texto sustituto lo firma un jefe (regla 39) — no se reescribe aquí. Se condiciona por ' +
    '`modoEmision`/`getEmissionMode`, igual que las 6 superficies ya gateadas en SCRUM-1029/#1650.');
});
