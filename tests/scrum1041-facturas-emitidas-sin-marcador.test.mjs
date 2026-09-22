// tests/scrum1041-facturas-emitidas-sin-marcador.test.mjs — SCRUM-1041
//
// LOS 4 TEXTOS DE LA CARD «FACTURAS EMITIDAS» (exportView.js), FIRMADOS POR EL FUNDADOR
// (com. 16306/16307 de SCRUM-1041), YA NO LLEVAN `[PENDIENTE microcopy oficial]`.
//
// ⚠️ ALCANCE — sólo `exportView.js`. Los 5 avisos del libro (`libroRegistroView.js`) NO se
// tocan: `docs/legal/PREGUNTAS_ASESOR.md` §21 los separó el 19-ago-2026 de los 16 que sí se
// aprobaron porque afirman algo sobre la INTEGRIDAD del libro (dictamen fiscal, no microcopy de
// producto) y esperan al asesor, no al orquestador. Este test comprueba también que SIGUEN
// marcados — es el control POSITIVO: si el detector dejara de ver marcadores, este test caería
// aquí antes que en ningún otro sitio.
//
// Por AST, no por texto (SCRUM-203): un marcador dentro de un COMENTARIO no llega a la pantalla
// y no cuenta — mismo criterio que `tests/scrum402-marcador-no-se-pinta.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public/dashboard/js');
const MARCA = '[PENDIENTE';

/** Marcadores que viven en un LITERAL (los que pueden pintarse) — mismo criterio que SCRUM-402. */
function marcadoresEnLiterales(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallados = [];
  const v = (n) => {
    const trozos = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      ? [n]
      : ts.isTemplateExpression(n) ? [n.head, ...n.templateSpans.map((s) => s.literal)] : [];
    if (trozos.some((t) => t.text.includes(MARCA))) {
      hallados.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return hallados;
}

const leer = (nombre) => fs.readFileSync(path.join(DIR_JS, nombre), 'utf8');

test('SCRUM-1041 · SUELO: el detector VE marcadores donde sabemos que los hay (libroRegistroView.js)', () => {
  const hallados = marcadoresEnLiterales(leer('libroRegistroView.js'), 'libroRegistroView.js');
  assert.ok(hallados.length > 0,
    '🔴 ESCÁNER CIEGO: si no ve ni uno solo aquí, su "cero" en exportView.js no significa nada.');
});

test('SCRUM-1041 · CONTROL NEGATIVO: un marcador dentro de un comentario no cuenta', () => {
  const falso = '// [PENDIENTE microcopy oficial] esto es un comentario\nconst x = "ok";';
  assert.equal(marcadoresEnLiterales(falso, 'x.js').length, 0,
    '🔴 el detector acusa a un comentario: cobraría un impuesto sobre la claridad del código.');
});

test('SCRUM-1041 · ROJO histórico: con el texto de antes, el detector SÍ caía', () => {
  const viejo = leer('exportView.js').replace(
    'Un CSV con las facturas que has emitido en un trimestre.',
    '[PENDIENTE microcopy oficial]',
  );
  assert.notEqual(viejo, leer('exportView.js'), '🔴 la sustitución no encontró el texto nuevo: el fixture no vale.');
  assert.ok(marcadoresEnLiterales(viejo, 'exportView.js').length > 0,
    '🔴 con el marcador puesto a mano el detector no lo ve: no es que el ticket esté hecho, es que el test está ciego.');
});

test('SCRUM-1041 · exportView.js: CERO marcadores pintables (los 4 de la card «Facturas emitidas»)', () => {
  const hallados = marcadoresEnLiterales(leer('exportView.js'), 'exportView.js');
  assert.deepEqual(hallados, [],
    `🔴 exportView.js todavía tiene marcador en la(s) línea(s) ${hallados.join(', ')}.`);
});

test('SCRUM-1041 · los 4 textos aprobados están, literales, en exportView.js', () => {
  const vista = leer('exportView.js');
  const APROBADOS = [
    'Un CSV con las facturas que has emitido en un trimestre.',
    '>Año</label>',
    '>Trimestre</label>',
    '>Descargar CSV</button>',
  ];
  for (const t of APROBADOS) {
    assert.ok(vista.includes(t),
      `🔴 no encuentro el texto aprobado exacto «${t}» en exportView.js. Un renombre también es ` +
      'microcopy nueva y la aprueba el fundador (regla 30).');
  }
});

test('SCRUM-1041 · libroRegistroView.js: los 5 avisos del bloque B SIGUEN marcados (no se han tocado)', () => {
  const vista = leer('libroRegistroView.js');
  const MARCADOR = '[PENDIENTE microcopy oficial]';
  // Las 5 ranuras exactas de docs/legal/PREGUNTAS_ASESOR.md §21.1-21.5.
  for (const fragmento of [
    'no ha salido ningún asiento',
    'no se han podido leer',
    'que no son de este negocio',
    'no aparece como asiento',
    'Albarán posterior al sello',
  ]) {
    assert.ok(vista.includes(fragmento),
      `🔴 falta el texto del aviso «${fragmento}» — ¿se ha tocado el bloque B sin querer?`);
  }
  // La constante `MARCADOR` (el ÚNICO literal fuente con el texto: los 5 avisos lo heredan vía
  // `rotulo()` en tiempo de ejecución, no lo llevan cada uno escrito) tiene que seguir ahí.
  const hallados = marcadoresEnLiterales(vista, 'libroRegistroView.js');
  assert.ok(hallados.length >= 1,
    '🔴 libroRegistroView.js ya no tiene NINGÚN literal con marcador: el bloque B (dictamen fiscal, ' +
    'docs/legal/PREGUNTAS_ASESOR.md §21) no se toca hasta que conteste el asesor.');
  assert.match(vista, /function rotulo\(t\) \{ return MARCADOR \+ ' ' \+ t; \}/,
    '🔴 falta `rotulo()`: el bloque B lo usa para anteponer el marcador a los 5 avisos.');
});
