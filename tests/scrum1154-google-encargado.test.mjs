// tests/scrum1154-google-encargado.test.mjs — SCRUM-1154
//
// LA POLÍTICA DE PRIVACIDAD NOMBRA A QUIEN RECIBE LOS DATOS, Y SÓLO A ÉSE.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ PASÓ
//
// El §5 de `public/privacidad.html` listaba a **Anthropic** como encargado y **no nombraba a
// Google**, mientras el código mandaba a Gemini el texto de los presupuestos, el dictado de los
// partes y la FOTO ENTERA de los tickets de gasto. La política decía lo contrario de lo que hacía
// el programa.
//
// SCRUM-950 se cerró «Finalizada» sin aplicar su §5 y el defecto sobrevivió al cierre. La razón de
// que sobreviviera la midió J6 el 29-sep-2026: **ningún test fijaba esa lista**. Por eso este
// fichero existe.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 DOS DECISIONES DE DISEÑO, Y LAS DOS SON EL GUARD
//
// ① EL TEXTO NO SE ESCRIBE AQUÍ: SE LEE DE SU FIRMA. Lo que se compara contra la página es el
//    literal del registro de aprobación (`docs/microcopy/…-SCRUM-1154-…md`), no una copia que yo
//    teclee. Si alguien reescribe el texto de la página —aunque sea para mejorarlo— deja de
//    coincidir con lo firmado y esto cae. Eso es la regla 39 convertida en comprobación, y además
//    hace imposible que este fichero y la firma se separen sin que nadie lo note.
//
// ② NO SE PARSEA HTML, NI CON REGEX NI CON LITERALES DE ETIQUETA. La primera versión troceaba la
//    lista con `<li>`/`<strong>` y el trinquete de SCRUM-553 saltó: el repo lleva la cuenta de los
//    extractores con el `>` pegado y no deja que suba. **No se ensanchó el tope** — se cambió esto.
//    Se acota por los TÍTULOS visibles de las secciones, que son texto del documento y no marcado.
//
// 🔴 Y la trampa que todo esto esquiva: buscar «google» a secas da verde por el motivo equivocado,
// porque `fonts.googleapis.com` aparece en 7 de las 9 páginas de `public/` y NO es esto. Hay un
// caso dedicado que lo demuestra. (Google Fonts y Cloudflare SÍ son huecos reales del §5 —medidos
// en el comentario 17317— pero piden ticket propio y no son éste.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aprobacionesDeMicrocopy } from './_microcopy-aprobada.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGINA = path.join(RAIZ, 'public', 'privacidad.html');

/** Los títulos VISIBLES que acotan el §5. Texto del documento, no marcado. */
const TITULO_ENCARGADOS = 'Con quién compartimos los datos';
const TITULO_SIGUIENTE = 'Conservación';

/** El §5 acotado por sus títulos. Las afirmaciones de este fichero se hacen AHÍ y no fuera. */
function seccionDeEncargados(html) {
  const desde = html.indexOf(TITULO_ENCARGADOS);
  assert.notEqual(desde, -1,
    `🔴 no aparece «${TITULO_ENCARGADOS}» en la página: el guard no sabe dónde mirar y cualquier `
    + 'cosa que dijera sería una ceguera con cara de veredicto.');
  const hasta = html.indexOf(TITULO_SIGUIENTE, desde);
  assert.notEqual(hasta, -1, `🔴 no aparece «${TITULO_SIGUIENTE}»: el §5 no tiene final que acotar.`);
  return html.slice(desde, hasta);
}

/**
 * La ficha VIGENTE del texto de Google: por ticket Y ranura (SCRUM-1306). Por ticket a secas, el
 * `.find` se quedaba con la PRIMERA ficha de SCRUM-1154, que es la más antigua (el barrido va por
 * nombre y el nombre empieza por la fecha): el día que el texto se vuelva a firmar, habría seguido
 * comprobando el viejo. Una firma nueva trae ranura nueva, y entonces se cambia ESTA constante.
 */
const FICHA_VIGENTE = { ticket: 'SCRUM-1154', ranura: 'encargados-privacidad' };

/** El literal tal como lo FIRMÓ el fundador, leído de su registro de aprobación. */
function textoFirmadoDeGoogle(opciones) {
  const registro = aprobacionesDeMicrocopy(opciones)
    .find((a) => a.ticket === FICHA_VIGENTE.ticket && a.ranura === FICHA_VIGENTE.ranura);
  assert.ok(registro, '🔴 no existe el registro de aprobación de SCRUM-1154 en `docs/microcopy/`.');
  assert.equal(registro.aprobada, true,
    `🔴 el registro de SCRUM-1154 no cuenta como aprobado (firmante: ${registro.firmante}). `
    + 'Un texto legal publicado necesita la firma del fundador (regla 39).');
  const literal = registro.literales.find((l) => l.includes('Google (Gemini)'));
  assert.ok(literal, '🔴 el registro de SCRUM-1154 no contiene ningún literal que nombre a Google (Gemini).');
  return literal;
}

const html = fs.readFileSync(PAGINA, 'utf8');

test('SCRUM-1154 · SUELO: el §5 se acota y contiene la lista de verdad', () => {
  // Sin esto, todos los «X no está» de abajo serían ciertos por no saber mirar. Cero y «no supe
  // mirar» no son el mismo número.
  const seccion = seccionDeEncargados(html);
  for (const esperado of ['Meta Platforms', 'Stripe', 'Resend', 'Railway']) {
    assert.ok(seccion.includes(esperado),
      `🔴 el §5 acotado no contiene a «${esperado}», que SÍ está en la política. Está mirando otra `
      + 'parte del documento.');
  }
  assert.ok(!seccion.includes(TITULO_SIGUIENTE), 'y el corte no se pasa a la sección siguiente');
});

test('SCRUM-1154 · Google (Gemini) figura como encargado, con el texto FIRMADO', () => {
  const firmado = textoFirmadoDeGoogle();
  assert.ok(seccionDeEncargados(html).includes(firmado),
    '🔴 el §5 no contiene —carácter a carácter— el texto que el fundador firmó para Google (Gemini). '
    + 'El programa le manda el texto de los presupuestos, el dictado de los partes y la foto entera '
    + 'de los tickets de gasto: la política estaría diciendo algo distinto de lo que hace el programa.');

  for (const camino of ['dictado', 'ticket', 'Transferencia internacional']) {
    assert.ok(firmado.includes(camino),
      `🔴 el texto firmado ya no menciona «${camino}». Ése es justo el camino que la versión L1 se `
      + 'dejaba fuera, y por el que hubo que volver a firma.');
  }
});

test('SCRUM-1154 · 🔴 EL QUE DECIDE: `fonts.googleapis.com` NO cuenta como nombrar a Google', () => {
  // El control que separa este guard de uno que daría verde por el motivo equivocado.
  const conFuentesSinFila = html.replace(textoFirmadoDeGoogle(), '')
    .replace(TITULO_ENCARGADOS, `${TITULO_ENCARGADOS} (con fuentes de fonts.googleapis.com cargadas)`);
  const seccion = seccionDeEncargados(conFuentesSinFila);
  assert.ok(seccion.includes('fonts.googleapis.com'), 'el caso sí mete las fuentes: si no, no prueba nada');
  assert.ok(!seccion.includes('Google (Gemini)'),
    '🔴 el guard cuenta `fonts.googleapis.com` como nombrar a Google. Mide la palabra en vez del '
    + 'encargado, y entonces su verde no dice nada sobre la política.');
  assert.ok(seccion.includes('Railway'), 'y sigue viendo a los demás: el caso no vació la sección por accidente');
});

test('SCRUM-1154 · Anthropic NO figura en el §5: hoy no recibe nada', () => {
  // Sólo se usaría si faltara GEMINI_API_KEY, y ANTHROPIC_API_KEY ni está puesta. El «proveedor de
  // respaldo» se midió y NO EXISTE: con un 429 de Google, cero llamadas. Una política lista a quien
  // RECIBE datos.
  assert.ok(!/anthropic/i.test(seccionDeEncargados(html)),
    '🔴 Anthropic ha vuelto al §5. Hoy no recibe ningún dato, y listar a quien no recibe nada dice '
    + 'algo falso sobre dónde van los datos del profesional. Si se ha ENCENDIDO de verdad, esto no '
    + 'se arregla borrando el assert: vuelve a firma del fundador (regla 39).');

  // El positivo de esa negación, con el MISMO detector y sobre la MISMA página: si se mete el
  // nombre, tiene que verlo. Sin esto, un «no está» pasaría igual midiendo el trozo equivocado.
  const conAnthropic = html.replace(TITULO_ENCARGADOS, `${TITULO_ENCARGADOS} — incluido Anthropic`);
  assert.ok(/anthropic/i.test(seccionDeEncargados(conAnthropic)),
    '🔴 el detector no encuentra a Anthropic cuando SÍ está: su «no está» no vale nada.');
});

test('SCRUM-1306 · 🔴 CONTROL: con una ficha MÁS ANTIGUA del mismo ticket, el guard sigue leyendo la vigente', () => {
  // Carpeta temporal: escribir una ficha de mentira en docs/microcopy/ la vería cualquier guard que
  // corra en paralelo. La vigente se copia tal cual; la antigua lleva la misma firma y otro literal.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1306-'));
  try {
    const vigente = aprobacionesDeMicrocopy()
      .find((a) => a.ticket === FICHA_VIGENTE.ticket && a.ranura === FICHA_VIGENTE.ranura);
    fs.copyFileSync(path.join(RAIZ, 'docs', 'microcopy', vigente.nombre), path.join(dir, vigente.nombre));
    const ANTIGUA = '2026-09-01-SCRUM-1154-version-anterior.md';
    const VIEJO = '<li><strong>Google (Gemini)</strong> — texto anterior, ya superado.</li>';
    fs.writeFileSync(path.join(dir, ANTIGUA), '# Versión anterior (control de SCRUM-1306)\n\n'
      + '**Aprobado por el fundador** el 1-sep-2026, en **SCRUM-1154**.\n\n'
      + '| Ranura | Texto aprobado |\n|---|---|\n| `anterior` | `' + VIEJO + '` |\n');
    const o = { dir };
    const todas = aprobacionesDeMicrocopy(o);
    assert.equal(todas.find((a) => a.ruta.includes('SCRUM-1154')).nombre, ANTIGUA,
      'el caso sí planta el problema: por ticket a secas, la primera ficha es la antigua');
    const antigua = todas.find((a) => a.nombre === ANTIGUA);
    assert.ok(antigua.aprobada && antigua.literales.includes(VIEJO),
      'y la antigua cuenta como firmada, con su literal: si no, el caso no prueba nada');
    assert.equal(textoFirmadoDeGoogle(o), textoFirmadoDeGoogle(),
      '🔴 con una ficha más antigua del mismo ticket, el guard ha pasado a leer la ANTIGUA. Tiene que '
      + 'elegir la ficha vigente por ticket y ranura (SCRUM-1306), no la primera del ticket.');
    assert.notEqual(textoFirmadoDeGoogle(o), VIEJO, 'y el literal que devuelve no es el superado');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
