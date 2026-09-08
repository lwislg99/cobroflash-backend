// SCRUM-727 · UN NOMBRE DE VISTA QUE EL ROUTER NO ATIENDE NO FALLA: TE MANDA A INICIO.
//
// Medido en la lista de Trabajos: el botón de la acción siguiente —el que dice qué toca hacer con
// el dinero de ese trabajo— llamaba a `renderAppView('job-detail', …)`. El router no tiene ese
// caso: tiene `jobs-detail`. Y el `switch` termina en un `default:` que pinta **Inicio**.
//
// 🔒 Por eso no lo cazó nadie: no hay excepción, no hay pantalla en blanco, no hay nada en la
// consola. Pulsas la acción del dinero y apareces en la portada, como si te hubieras equivocado tú.
//
// Es la misma avería que SCRUM-720b (`opts` donde el parámetro se llama `options`) y de la misma
// familia que SCRUM-176b: **un nombre parecido no es el nombre**. Aquí sobraba una `s`.
//
// EL MECANISMO, y no el caso: se comparan LOS DOS CONJUNTOS —lo que el front pide y lo que el
// router atiende— y se exige que pedir sea un subconjunto de atender. Un nombre nuevo mal escrito
// cae solo, sin que nadie tenga que acordarse de este ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { soloCodigo } from './_solo-codigo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(AQUI, '..', 'public', 'dashboard', 'js');

/** Los nombres que ALGUIEN pide, con el fichero y la línea donde los pide. */
function vistasPedidas() {
  const pedidas = [];
  for (const f of fs.readdirSync(JS).filter((n) => n.endsWith('.js'))) {
    // Sin comentarios: si no, este mismo fichero y los comentarios que explican la avería
    // cuentan como llamadas. Es la trampa de la autorreferencia, que ya mordió cuatro veces.
    const lineas = soloCodigo(fs.readFileSync(path.join(JS, f), 'utf8')).split('\n');
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(/renderAppView\(\s*['"]([a-z0-9-]+)['"]/g)) {
        pedidas.push({ vista: m[1], donde: `${f}:${i + 1}` });
      }
    });
  }
  return pedidas;
}

/** Los nombres que el router SÍ atiende. */
function vistasAtendidas() {
  const app = soloCodigo(fs.readFileSync(path.join(JS, 'app.js'), 'utf8'));
  return new Set([...app.matchAll(/case\s+['"]([a-z0-9-]+)['"]\s*:/g)].map((m) => m[1]));
}

test('SCRUM-727 · SUELO: se encuentran las dos listas', () => {
  const pedidas = vistasPedidas();
  const atendidas = vistasAtendidas();
  // Un barrido que no encuentra nada aprueba cualquier cosa. Los dos lados tienen que existir.
  assert.ok(
    pedidas.length >= 15,
    `🔴 CIEGO: solo ${pedidas.length} llamadas a renderAppView. El barrido no está leyendo el ` +
      'dashboard: no puede decir que todo esté bien porque no ha mirado.',
  );
  assert.ok(
    atendidas.size >= 20,
    `🔴 CIEGO: solo ${atendidas.size} casos en el router. Si el switch se ha reescrito de otra ` +
      'forma, este guard dejó de mirar lo que cree que mira.',
  );
});

test('SCRUM-727 · toda vista que se pide EXISTE en el router', () => {
  const atendidas = vistasAtendidas();
  const huerfanas = vistasPedidas().filter((p) => !atendidas.has(p.vista));

  assert.deepEqual(
    huerfanas.map((h) => `${h.vista}   ← pedida en ${h.donde}`),
    [],
    '🔴 SE PIDE UNA VISTA QUE EL ROUTER NO ATIENDE. No da error: el `switch` cae en su\n' +
      '   `default:` y el usuario acaba en INICIO, sin un aviso ni una traza. Nombres atendidos:\n' +
      `   ${[...atendidas].sort().join(', ')}`,
  );
});
