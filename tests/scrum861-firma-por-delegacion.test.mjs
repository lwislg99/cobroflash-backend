// tests/scrum861-firma-por-delegacion.test.mjs — SCRUM-861
//
// LA FIRMA DELEGADA: EL ORÁCULO APRENDE LA DELEGACIÓN ESCRITA, SIN AFLOJAR SCRUM-726.
//
// ── EL HUECO ────────────────────────────────────────────────────────────────────────────────
// El fundador delegó por escrito, y de forma permanente, la aprobación de microcopy en el
// orquestador (`docs/equipo/limites-del-fundador.md` §«Delegación permanente»). El oráculo no lo
// sabía: `constaAprobado` sólo contaba `firmante === 'fundador'`. Una ficha aprobada por quien SÍ
// puede aprobar quedaba como pendiente — y la única salida «que pasaba» era escribir «Aprobado por
// el fundador» sin serlo. Eso no se hace: se enseña al oráculo la firma de verdad.
//
// ── LO QUE NO SE AFLOJA ─────────────────────────────────────────────────────────────────────
// SCRUM-726 dice «por QUIÉN firma, no por quién escribe». La firma delegada sigue siendo una firma
// con nombre y con respaldo, y cuenta SÓLO si se dan las tres cosas a la vez:
//
//   1. la línea exacta «Aprobado por el orquestador por delegación del fundador», fuera de cita;
//   2. EN ESA MISMA LÍNEA, la referencia al comentario de Jira donde se aprobó el texto
//      (`SCRUM-NNN comentario NNNNN`) — sin ella no hay forma de ir a comprobarla;
//   3. que la delegación SIGA VIGENTE: la sección «Delegación permanente» de
//      `limites-del-fundador.md` con su línea de microcopy. Si el fundador la retira, esas firmas
//      dejan de contar solas, sin tocar ni una ficha.
//
// «Aprobado por el orquestador» a secas, «por el asesor», «por la Sesión 4», «por Claude»: siguen
// sin contar, igual que hoy. Y la firma del fundador sigue exactamente igual, con o sin delegación.
//
// ── DÓNDE SE CREA CADA COSA, Y POR QUÉ ESTÁ ESCRITO ASÍ ─────────────────────────────────────
// Todo se crea en `os.tmpdir()`, nunca en `docs/`: un registro de mentira en el directorio real lo
// vería cualquier guard que corriera a la vez. Y cada escritura se hace AQUÍ, en el test, sobre
// `e.raiz` / `e.dir` — no dentro de un ayudante que recibe la ruta por parámetro. Así lo exige
// SCRUM-824: su censo tiene que PODER DEMOSTRAR de dónde cuelga cada temporal, y no atraviesa
// parámetros ni desestructuración. La primera versión de este fichero escribía desde ayudantes
// `(dir, …)` y el censo la contó, con razón, como «sin probar». Los ayudantes ahora sólo devuelven
// TEXTO; quien escribe en disco se ve.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { temporal } from './_temporal.mjs';

import {
  aprobacionesDeMicrocopy, constaAprobado, literalesAprobados, pendientesDeFirma,
  firmanteDe, firmaDelegadaDe, delegacionVigente,
} from './_microcopy-aprobada.mjs';

const LINEA_DE_MICROCOPY = '- **Los textos de microcopy que haya que aprobar los aprueba el orquestador**\n'
  + '  (dentro de la regla 30: siguen sin poder inventarse a nivel de sesión).\n';

/** El contenido de un `limites-del-fundador.md` de prueba, con la delegación dentro o fuera. */
const cuerpoDeLimites = (variante) => ({
  vigente: '# Límites\n\n## Datos\n\n- algo\n\n## Delegación permanente\n\n'
    + 'El fundador ha delegado, por escrito y de forma permanente:\n\n' + LINEA_DE_MICROCOPY
    + '- **Lo que sea claramente decisión del orquestador, la toma el orquestador**\n\n'
    + '## Cómo quiere trabajar\n\n- lo que sea\n',
  // La sección entera retirada.
  sinSeccion: '# Límites\n\n## Datos\n\n- algo\n\n## Cómo quiere trabajar\n\n- lo que sea\n',
  // La sección sigue, pero sin la línea de microcopy.
  sinLinea: '# Límites\n\n## Delegación permanente\n\n'
    + '- **Lo que sea claramente decisión del orquestador, la toma el orquestador**\n\n'
    + '## Cómo quiere trabajar\n\n- lo que sea\n',
  // La línea existe, pero FUERA de la sección: no es la delegación, es otra cosa escrita.
  lineaFuera: '# Límites\n\n## Delegación permanente\n\n- otra cosa\n\n## Historia\n\n' + LINEA_DE_MICROCOPY,
}[variante]);

/** El contenido de una ficha de `docs/microcopy/` de prueba. */
const cuerpoDeFicha = (firma, texto, { citada = false } = {}) =>
  `# Ficha\n\n${citada ? '> ' + firma : firma}\n\n## Texto aprobado, literal\n\n> ${texto}\n`;

const TEXTO_DELEGADO = 'Texto que aprobó el orquestador por delegación';
const TEXTO_DEL_FUNDADOR = 'Texto que firmó el fundador en persona';
const FIRMA_DELEGADA_OK = '**Aprobado por el orquestador por delegación del fundador** el 15-sep-2026 — SCRUM-600 comentario 15357.';
const FICHA = '2026-09-15-SCRUM-600-delegada.md';

/** Un directorio de trabajo en `os.tmpdir()`, con su carpeta de fichas. */
const escenario = () => {
  const raiz = temporal('scrum861-');
  const dir = path.join(raiz, 'microcopy');
  fs.mkdirSync(dir);
  return { raiz, dir };
};

const opciones = (dir, limites) => ({ dir, congelado: false, limites });

// ═══ SUELO ══════════════════════════════════════════════════════════════════════════════════

test('SCRUM-861 · SUELO: la delegación real está vigente y el detector la ve', () => {
  // Si esto fallara con el documento real intacto, el detector estaría ciego y cualquier «no
  // cuenta» de abajo sería ceguera, no rigor.
  assert.equal(delegacionVigente(), true,
    '🔴 `docs/equipo/limites-del-fundador.md` tiene hoy la sección «Delegación permanente» con la '
    + 'línea de microcopy y el detector no la encuentra: está CIEGO.');
});

// ═══ a) CUENTA ══════════════════════════════════════════════════════════════════════════════

test('SCRUM-861 · a) firma delegada, con referencia y con la sección presente → CUENTA', () => {
  const e = escenario();
  fs.writeFileSync(path.join(e.dir, FICHA), cuerpoDeFicha(FIRMA_DELEGADA_OK, TEXTO_DELEGADO));
  const limites = path.join(e.raiz, 'limites-vigente.md');
  fs.writeFileSync(limites, cuerpoDeLimites('vigente'));
  const o = opciones(e.dir, limites);

  const [reg] = aprobacionesDeMicrocopy(o);
  assert.equal(reg.firmante, 'orquestador', '🔴 el firmante registrado de una firma delegada es «orquestador»');
  assert.deepEqual(reg.delegacion, { referencia: 'SCRUM-600 comentario 15357' });
  assert.deepEqual(constaAprobado(TEXTO_DELEGADO, o), ['docs/microcopy/' + FICHA],
    '🔴 una firma delegada completa y vigente NO cuenta: la delegación escrita no llega al oráculo.');
  assert.ok(literalesAprobados(o).includes(TEXTO_DELEGADO));
  assert.deepEqual(pendientesDeFirma(o), [], '🔴 una firma válida no puede quedar como pendiente');
});

// ═══ b) SECCIÓN RETIRADA ════════════════════════════════════════════════════════════════════

test('SCRUM-861 · b) la misma firma con la delegación RETIRADA → CAE', () => {
  const e = escenario();
  fs.writeFileSync(path.join(e.dir, FICHA), cuerpoDeFicha(FIRMA_DELEGADA_OK, TEXTO_DELEGADO));
  for (const variante of ['sinSeccion', 'sinLinea', 'lineaFuera']) {
    const limites = path.join(e.raiz, 'limites-' + variante + '.md');
    fs.writeFileSync(limites, cuerpoDeLimites(variante));
    const o = opciones(e.dir, limites);
    assert.equal(delegacionVigente({ limites }), false, `🔴 «${variante}» se lee como delegación vigente`);
    assert.deepEqual(constaAprobado(TEXTO_DELEGADO, o), [],
      `🔴 con la delegación ${variante}, la firma delegada SIGUE contando. Si el fundador la retira, `
      + 'esas firmas tienen que dejar de valer solas.');
    assert.equal(pendientesDeFirma(o).length, 1, `🔴 con «${variante}» la ficha debería listarse como pendiente`);
  }
  // Y sin fichero de límites en absoluto: tampoco cuenta, y no revienta.
  const o = opciones(e.dir, path.join(e.raiz, 'no-existe.md'));
  assert.deepEqual(constaAprobado(TEXTO_DELEGADO, o), []);
});

// ═══ c) SIN REFERENCIA ══════════════════════════════════════════════════════════════════════

test('SCRUM-861 · c) la misma firma SIN referencia al comentario de Jira → CAE', () => {
  const e = escenario();
  const limites = path.join(e.raiz, 'limites-vigente.md');
  fs.writeFileSync(limites, cuerpoDeLimites('vigente'));
  const casos = {
    'sin referencia': '**Aprobado por el orquestador por delegación del fundador** el 15-sep-2026.',
    'referencia a medias': '**Aprobado por el orquestador por delegación del fundador** — SCRUM-600, en Jira.',
    'referencia en OTRA línea': '**Aprobado por el orquestador por delegación del fundador** el 15-sep-2026.\n\nVer SCRUM-600 comentario 15357.',
  };
  for (const [nombre, firma] of Object.entries(casos)) {
    fs.rmSync(e.dir, { recursive: true, force: true });
    fs.mkdirSync(e.dir);
    const contenido = cuerpoDeFicha(firma, TEXTO_DELEGADO);
    fs.writeFileSync(path.join(e.dir, FICHA), contenido);
    assert.equal(firmaDelegadaDe(contenido), null, `🔴 «${nombre}» se lee como firma delegada completa`);
    assert.deepEqual(constaAprobado(TEXTO_DELEGADO, opciones(e.dir, limites)), [],
      `🔴 «${nombre}» cuenta como aprobación. Sin la referencia al comentario no hay forma de ir a comprobarla.`);
  }
});

// ═══ d) OTROS FIRMANTES ═════════════════════════════════════════════════════════════════════

test('SCRUM-861 · d) «por el orquestador» a secas, «por el asesor», «por la Sesión 4», «por Claude» → CAEN', () => {
  const e = escenario();
  const limites = path.join(e.raiz, 'limites-vigente.md');
  fs.writeFileSync(limites, cuerpoDeLimites('vigente'));
  const firmas = [
    '**Aprobado por el orquestador** el 15-sep-2026 — SCRUM-600 comentario 15357.',
    '**Aprobado por el asesor** el 15-sep-2026 — SCRUM-600 comentario 15357.',
    '**Aprobado por la Sesión 4** el 15-sep-2026 — SCRUM-600 comentario 15357.',
    '**Aprobado por Claude** el 15-sep-2026 — SCRUM-600 comentario 15357.',
    // La delegación dicha al revés tampoco es la frase.
    '**Aprobado por delegación del fundador** el 15-sep-2026 — SCRUM-600 comentario 15357.',
  ];
  for (const firma of firmas) {
    fs.rmSync(e.dir, { recursive: true, force: true });
    fs.mkdirSync(e.dir);
    fs.writeFileSync(path.join(e.dir, '2026-09-15-SCRUM-600-otra.md'), cuerpoDeFicha(firma, TEXTO_DELEGADO));
    assert.deepEqual(constaAprobado(TEXTO_DELEGADO, opciones(e.dir, limites)), [],
      `🔴 «${firma}» cuenta como aprobación, y la referencia de Jira no la convierte en delegada.`);
  }
});

// ═══ e) DENTRO DE UNA CITA ══════════════════════════════════════════════════════════════════

test('SCRUM-861 · e) la firma delegada DENTRO de una cita (>) → NO cuenta, igual que hoy', () => {
  const e = escenario();
  const contenido = cuerpoDeFicha(FIRMA_DELEGADA_OK, TEXTO_DELEGADO, { citada: true });
  fs.writeFileSync(path.join(e.dir, '2026-09-15-SCRUM-600-citada.md'), contenido);
  const limites = path.join(e.raiz, 'limites-vigente.md');
  fs.writeFileSync(limites, cuerpoDeLimites('vigente'));
  assert.equal(firmaDelegadaDe(contenido), null, '🔴 una firma citada se lee como firma: las citas son historia, no firma');
  assert.notEqual(firmanteDe(contenido), 'orquestador');
  assert.deepEqual(constaAprobado(TEXTO_DELEGADO, opciones(e.dir, limites)), [],
    '🔴 una firma delegada escrita dentro de una cita cuenta como aprobación.');
});

// ═══ f) CONTROL: EL FUNDADOR, INTACTO ═══════════════════════════════════════════════════════

test('SCRUM-861 · f) CONTROL: la firma del fundador sigue contando, con o sin delegación', () => {
  const e = escenario();
  fs.writeFileSync(path.join(e.dir, '2026-09-15-SCRUM-111-fundador.md'),
    cuerpoDeFicha('**Aprobado por el fundador** el 15-sep-2026, en **SCRUM-111**.', TEXTO_DEL_FUNDADOR));
  for (const variante of ['vigente', 'sinSeccion']) {
    const limites = path.join(e.raiz, 'limites-' + variante + '.md');
    fs.writeFileSync(limites, cuerpoDeLimites(variante));
    assert.deepEqual(constaAprobado(TEXTO_DEL_FUNDADOR, opciones(e.dir, limites)), ['docs/microcopy/2026-09-15-SCRUM-111-fundador.md'],
      `🔴 con la delegación «${variante}», la firma del FUNDADOR ha dejado de contar. Retirar la `
      + 'delegación no puede tocar lo que firmó él.');
  }
});

test('SCRUM-861 · f) CONTROL: todo lo que hoy firma el fundador en el árbol real sigue contando', () => {
  // Contra los registros REALES, sin opciones: cada ficha del fundador y el registro congelado.
  //
  // ⚠️ UN BARRIDO, NO UNO POR LITERAL. La primera versión llamaba a `constaAprobado` por cada
  // literal (~195), y cada llamada vuelve a leer TODAS las fichas y `limites-del-fundador.md`:
  // medido, 2051 ms en local para un solo test, en una tanda que en CI tiene 10 minutos de techo
  // y se quedó sin tiempo en el PR de este ticket. La comprobación literal a literal se hace
  // contra `literalesAprobados()` —la misma pregunta, `aprobada`— leída una vez; y la función
  // pública `constaAprobado` se sigue ejercitando, una vez por registro.
  const reales = aprobacionesDeMicrocopy();
  const delFundador = reales.filter((a) => a.firmante === 'fundador');
  assert.ok(delFundador.length >= 10, `🔴 CIEGO: sólo ${delFundador.length} registros del fundador`);
  const aprobados = new Set(literalesAprobados());
  for (const a of delFundador) {
    assert.equal(a.aprobada, true, `🔴 ${a.ruta} lo firma el fundador y ya no cuenta como aprobado`);
    for (const l of a.literales) {
      assert.ok(aprobados.has(l), `🔴 «${l}» (${a.ruta}) ha dejado de constar aprobado`);
    }
    if (a.literales.length) {
      assert.ok(constaAprobado(a.literales[0]).includes(a.ruta),
        `🔴 «${a.literales[0]}» (${a.ruta}) no consta por la función pública que usan los guards`);
    }
  }
});
