// tests/scrum1196-fecha-de-la-politica.test.mjs — SCRUM-1196 (L6)
//
// LA POLÍTICA DICE CUÁNDO SE ACTUALIZÓ, Y ESA FECHA NO PUEDE QUEDARSE ATRÁS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PASÓ, Y LO HIZO EL ORQUESTADOR
//
// El 30-sep-2026 se publicó SCRUM-1154: la política pasó a nombrar a Google (Gemini) y dejó de
// nombrar a Anthropic. **La cabecera siguió diciendo «Última actualización: 23 de julio de 2026».**
//
// No es un detalle de estilo. El §9 de la propia página promete, con esas palabras: «Publicaremos
// cualquier cambio en esta misma página, **indicando la fecha de la última actualización**». Así que
// la página estaba incumpliendo una promesa suya, publicada, en un documento legal.
//
// Lo cazó J4 censando, no yo revisando lo que acababa de publicar. El literal de L6 estaba **firmado
// desde el 29-sep** (SCRUM-1196, comentario 17453) y no se aplicó ni con 1154.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ SE COMPARA CONTRA GIT Y NO CONTRA UNA FECHA ESCRITA AQUÍ
//
// Un guard que dijera «la fecha es el 30 de septiembre» caducaría en el momento en que alguien
// vuelva a tocar la página: pasaría a exigir una fecha vieja, y para arreglarlo habría que editar el
// guard. Eso convierte el guard en una nota.
//
// El invariante de verdad es: **la fecha que la página DICE no puede ser anterior al último cambio
// que la página TUVO**. Eso se le pregunta a git, que es quien lo sabe. Así el guard no caduca, y el
// día que alguien cambie el §5 sin tocar la cabecera, cae.
//
// ⚠️ Lo que este guard NO distingue: un cambio de contenido de uno de formato. Si alguien reindenta
// el fichero, exigirá mover la fecha igual. Para una página legal eso me parece el lado bueno del
// error, y se dice aquí para que nadie lo descubra creyendo que es un fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELATIVA = 'public/privacidad.html';
const PAGINA = path.join(RAIZ, RELATIVA);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** La fecha que la página DICE, como `Date`, o `null` si no la dice en la forma firmada. */
function fechaQueDiceLaPagina(html) {
  const m = html.match(/Última actualización:\s*(\d{1,2}) de ([a-zé]+) de (\d{4})/i);
  if (!m) return null;
  const mes = MESES.indexOf(m[2].toLowerCase());
  return mes === -1 ? null : new Date(Date.UTC(Number(m[3]), mes, Number(m[1])));
}

/** El último cambio que la página TUVO, según git. `null` si git no puede contestar. */
function ultimoCambioSegunGit() {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', RELATIVA],
      { cwd: RAIZ, encoding: 'utf8' }).trim();
    return iso ? new Date(iso) : null;
  } catch {
    return null;
  }
}

const html = fs.readFileSync(PAGINA, 'utf8');

test('SCRUM-1196 · SUELO: la página dice su fecha, en la forma firmada', () => {
  const f = fechaQueDiceLaPagina(html);
  assert.ok(f,
    '🔴 la política no dice su fecha de última actualización en la forma firmada («<día> de <mes> de '
    + '<año>»). Su propio §9 promete indicarla: sin ella, la página incumple lo que promete.');
  assert.ok(html.includes('indicando la fecha de la última actualización'),
    '🔴 el §9 ya no promete indicar la fecha. Si esa promesa se retira, este guard sobra — pero '
    + 'retirarla es texto legal y necesita firma (regla 39). No se borra este assert: se pregunta.');
});

test('SCRUM-1196 · 🔴 EL QUE DECIDE: la fecha NO es anterior al último cambio de la página', () => {
  const dice = fechaQueDiceLaPagina(html);
  const cambio = ultimoCambioSegunGit();

  // Sin git no hay veredicto: se dice, no se da por bueno. Un guard que se calla cuando no puede
  // medir es indistinguible de uno que aprueba.
  assert.ok(cambio,
    '🔴 CIEGO: git no ha podido decir cuándo cambió la página por última vez. Esto NO es un aprobado.');

  // Se compara por DÍA: el commit trae hora y la página sólo el día.
  const soloDia = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  assert.ok(soloDia(dice) >= soloDia(cambio),
    `🔴 LA POLÍTICA SE HA QUEDADO ATRÁS. Dice que se actualizó el ${dice.toISOString().slice(0, 10)} y `
    + `su último cambio es del ${cambio.toISOString().slice(0, 10)}.\n`
    + '  El §9 promete «indicando la fecha de la última actualización», así que la página estaría '
    + 'incumpliendo lo que ella misma publica.\n'
    + '  Esto NO se arregla tocando el guard: se mueve la fecha de la cabecera al día en que se '
    + 'publica el cambio. El literal está firmado en SCRUM-1196 (c. 17453).');
});

test('SCRUM-1196 · CONTROL: el lector de fechas distingue de verdad, no da todo por bueno', () => {
  // Sin esto, los dos casos de arriba pasarían con un lector que devolviera siempre la fecha de hoy.
  assert.equal(
    fechaQueDiceLaPagina('Última actualización: 23 de julio de 2026').toISOString().slice(0, 10),
    '2026-07-23', 'lee bien una fecha real');
  assert.equal(
    fechaQueDiceLaPagina('Última actualización: 1 de enero de 2027').toISOString().slice(0, 10),
    '2027-01-01', 'y otra distinta, para que no sea una constante disfrazada');
  assert.equal(fechaQueDiceLaPagina('Última actualización: 23 de brumario de 2026'), null,
    '🔴 un mes que no existe tiene que salir null, no colarse como una fecha cualquiera');
  assert.equal(fechaQueDiceLaPagina('esta página no dice su fecha'), null,
    '🔴 y un texto sin fecha también');
});
