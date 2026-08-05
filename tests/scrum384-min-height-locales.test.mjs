// tests/scrum384-min-height-locales.test.mjs — SCRUM-384
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// DOS `min-height` LOCALES QUE LA BASE YA RESUELVE — Y POR QUÉ ERA UN TICKET
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-352 subió el target táctil a 44 px en móvil para las variantes SUELTAS
// (`.btn-primary:not(.btn-sm)` y compañía), que es lo que arregló el defecto de base. A partir de
// ahí, dos remedios locales sobraban:
//
//   · `reportsView.js` — `style="min-height:44px"` en el botón de filtro. Redundante **y DAÑINO**:
//     al ser inline gana siempre, así que a 1280 px forzaba 44 donde la casa da 36. Ese botón era
//     8 px más alto que sus hermanos en escritorio y **nadie lo decidió**.
//   · `styles.css` — `.qq-modal .btn{-primary,-secondary}` repitiendo 44 px dentro de su media de
//     móvil. Redundante a secas: escondía de dónde venía el 44.
//
// > **Vigilar un motivo muerto es no vigilar; obedecer un parche muerto es peor: sigue actuando.**
//
// ⚠️ LO QUE **NO** SE RETIRÓ, y este fichero lo fija para que el siguiente no lo confunda:
//
//   · `.qq-modal .field input` — los INPUT no los toca la base. Fuera del sheet valen 42 px y en
//     móvil suben a 44: retirarlo los habría bajado. MEDIDO, no supuesto.
//   · `.qq-modal .modal-footer > div:last-child { flex-direction: column-reverse }` + los botones
//     a `width:100%` — **DISEÑO DELIBERADO**: apila los botones para que «Enviar por WhatsApp»
//     quede dominante arriba. La prueba de que no es un parche que compita con el `flex-wrap: wrap`
//     de SCRUM-350 es que **se aplica a un DIV DENTRO del pie, no al pie**: son dos contenedores
//     distintos, y `wrap` no da esto — daría dos filas alineadas a la derecha, no dos botones a
//     ancho completo.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD QUE HACE SEGURA LA RETIRADA
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Al quitar los remedios locales, esos botones dependen ENTERAMENTE de la base. Si alguien toca
// SCRUM-352, se quedan sin target táctil en móvil y no habría nada que lo dijera — el remedio que
// antes los tapaba ya no está. Por eso el primer test de este fichero no mira lo retirado: mira
// que **lo que sostiene lo retirado sigue en pie**.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { parsearReglas } from './_censo-anillo-foco.mjs';
import { minHeightDe } from './_censo-target-tactil.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
const REPORTS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/reportsView.js'), 'utf8');
const REGLAS = parsearReglas(CSS);

const MOVIL = 390;
const ESCRITORIO = 1280;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SOSTIENE LA RETIRADA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-384 · la BASE sigue dando 44 px en móvil a las variantes sueltas (SCRUM-352)', () => {
  for (const clases of [['btn'], ['btn-primary'], ['btn-secondary'], ['btn', 'btn-primary']]) {
    const r = minHeightDe(REGLAS, clases, MOVIL);
    assert.equal(
      r?.px, 44,
      `🔴 \`.${clases.join('.')}\` mide ${r?.px ?? '¿?'} px a ${MOVIL} px, no 44.\n`
      + 'SCRUM-384 RETIRÓ los remedios locales que tapaban esto (el inline de `reportsView` y la '
      + 'repetición de `.qq-modal`) precisamente porque la base ya lo resolvía. Si la base cede, '
      + 'esos botones se quedan sin target táctil y ya no hay nada que los sujete: o se devuelve '
      + 'la regla a la base, o este ticket hay que revertirlo entero.',
    );
  }
});

test('SCRUM-384 · y en ESCRITORIO la casa dice 36, que es lo que el inline pisaba', () => {
  // DESIGN.md pide ≥44 px EN MÓVIL. Con ratón, 36 cumple — por eso forzar 44 a 1280 no era
  // «de más», era otro alto que nadie decidió.
  for (const clases of [['btn'], ['btn-primary'], ['btn-secondary']]) {
    assert.equal(
      minHeightDe(REGLAS, clases, ESCRITORIO)?.px, 36,
      `🔴 \`.${clases.join('.')}\` ya no mide 36 px a ${ESCRITORIO} px`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO RETIRADO NO VUELVE
// ═══════════════════════════════════════════════════════════════════════════════════════════

// La forma que devuelve `parsearReglas`: { selectores: string[], decls: Map, medias: string[] }.
// `decls` es un Map — un `JSON.stringify` lo enseña como `{}` y hace creer que la regla está
// vacía. (Lo pagué escribiendo este fichero: el navegador decía 44 px y mi lector decía «no hay
// regla». Cuando el analizador y la realidad discrepan, el roto es el analizador.)
const declara = (r, prop) => r.decls instanceof Map ? r.decls.get(prop) : r.decls?.[prop];

/** Reglas con `min-height` cuyo selector cuelga de `.qq-modal`, con su media. */
function minHeightsDeQqModal() {
  const out = [];
  for (const r of REGLAS) {
    if (!declara(r, 'min-height')) continue;
    for (const sel of r.selectores) {
      if (/^\.qq-modal\b/.test(sel.trim())) out.push({ selector: sel.trim(), medias: r.medias });
    }
  }
  return out;
}

test('SCRUM-384 · `.qq-modal` ya no repite el min-height de los BOTONES', () => {
  // Se mira el selector parseado, no el texto del fichero: el comentario que explica la retirada
  // menciona `.qq-modal .btn-primary`, y un `grep` lo tomaría por la declaración (SCRUM-203).
  const botones = minHeightsDeQqModal().filter((r) => /\.btn(\b|-)/.test(r.selector));
  assert.deepEqual(
    botones, [],
    '🔴 ha vuelto un `min-height` para botones dentro de `.qq-modal`: '
    + JSON.stringify(botones) + '.\n'
    + 'La base (SCRUM-352) ya les da 44 px en móvil. Repetirlo aquí no cambia el resultado y '
    + 'esconde de dónde viene el 44 — y el día que alguien lo lea creerá que esta modal necesita '
    + 'algo especial que no necesita.',
  );
});

test('SCRUM-384 · CONTROL: el `min-height` del INPUT de la qq-modal SIGUE, y hace falta', () => {
  const inputs = minHeightsDeQqModal().filter((r) => /input/.test(r.selector));
  assert.ok(
    inputs.length >= 1,
    '🔴 se ha retirado DE MÁS: `.qq-modal .field input` necesita su regla. Los INPUT no los toca '
    + 'la base — fuera del sheet valen 42 px y en móvil suben a 44. Sin ella, los campos del '
    + 'bottom sheet bajan a 42 y el ticket habría roto lo que decía limpiar.',
  );
});

test('SCRUM-384 · `reportsView.js` no vuelve a fijar `min-height` en línea', () => {
  // AST: se buscan asignaciones a `style.cssText` / `style.minHeight`, no la cadena suelta.
  const sf = ts.createSourceFile('reportsView.js', REPORTS, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const culpables = [];
  (function recorrer(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isPropertyAccessExpression(n.left)) {
      const prop = n.left.name.text;
      const enStyle = /\bstyle$/.test(n.left.expression.getText(sf));
      const texto = n.right.getText(sf);
      if ((prop === 'minHeight' && enStyle) || (prop === 'cssText' && enStyle && /min-height/.test(texto))) {
        culpables.push(`línea ${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
      }
    }
    n.forEachChild(recorrer);
  })(sf);

  assert.deepEqual(
    culpables, [],
    '🔴 ha vuelto un `min-height` EN LÍNEA en `reportsView.js` (' + culpables.join(', ') + ').\n'
    + 'Un estilo inline gana a toda la hoja: repite en móvil lo que la base ya da y **pisa** el '
    + '36 px de escritorio, dejando ese botón más alto que sus hermanos sin que nadie lo decida. '
    + 'Si de verdad hace falta un alto distinto, va al CSS con su motivo, no en el atributo.',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LO QUE NO SE TOCA · el diseño deliberado de la qq-modal, FIJADO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-384 · el apilado del pie de la qq-modal es DISEÑO y sigue intacto', () => {
  const apilado = REGLAS.find((r) =>
    r.selectores.some((s) => /\.qq-modal\s+\.modal-footer\s*>\s*div:last-child/.test(s))
    && declara(r, 'flex-direction') === 'column-reverse');

  assert.ok(
    apilado,
    '🔴 SE HA RETIRADO EL APILADO DEL PIE DE LA QQ-MODAL, y eso NO era un parche.\n'
    + 'Pone los botones a ancho completo en móvil para que «Enviar por WhatsApp» quede DOMINANTE '
    + 'ARRIBA: es jerarquía, no layout de emergencia. La prueba de que no compite con el '
    + '`flex-wrap: wrap` de SCRUM-350 es que se aplica a un DIV DENTRO del pie, no al pie — son '
    + 'dos contenedores distintos, y `wrap` daría dos filas alineadas a la derecha, no esto.',
  );
  assert.ok(
    (apilado.medias || []).some((m) => /max-width:\s*639px/.test(m)),
    '🔴 el apilado se ha salido de su media de móvil: en escritorio el pie va en fila',
  );

  const anchoCompleto = REGLAS.find((r) =>
    r.selectores.some((s) => /\.qq-modal\s+\.modal-footer\s+\.btn-primary/.test(s))
    && declara(r, 'width') === '100%');
  assert.ok(
    anchoCompleto,
    '🔴 falta el `width: 100%` de los botones del pie: sin él, `column-reverse` los apila pero '
    + 'estrechos, que es un tercer aspecto que nadie ha diseñado',
  );
});

test('SCRUM-384 · CONTROL NEGATIVO: lo que no se toca no cambia a ninguna anchura', () => {
  // Si estas medidas se movieran, el cambio habría alcanzado a botones que no son suyos — que es
  // el riesgo real de tocar una hoja compartida.
  const esperado = [
    { clases: ['btn', 'btn-sm'], movil: 30, escritorio: 30 },
    { clases: ['btn-ghost', 'btn-sm'], movil: 30, escritorio: 30 },
    { clases: ['btn', 'btn-lg'], movil: 44, escritorio: 44 },
    { clases: ['btn-ghost'], movil: 44, escritorio: 36 },
    { clases: ['btn-danger'], movil: 44, escritorio: 36 },
  ];
  for (const { clases, movil, escritorio } of esperado) {
    assert.equal(minHeightDe(REGLAS, clases, MOVIL)?.px, movil,
      `🔴 \`.${clases.join('.')}\` cambió a ${MOVIL} px: el cambio alcanzó a quien no debía`);
    assert.equal(minHeightDe(REGLAS, clases, ESCRITORIO)?.px, escritorio,
      `🔴 \`.${clases.join('.')}\` cambió a ${ESCRITORIO} px: el cambio alcanzó a quien no debía`);
  }
});
