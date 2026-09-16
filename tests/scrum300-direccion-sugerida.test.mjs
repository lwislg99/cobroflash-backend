// tests/scrum300-direccion-sugerida.test.mjs — SCRUM-300 (C5)
//
// LO QUE FIJA ESTE FICHERO: que la precarga del lugar de entrega SUGIERE y NUNCA RELLENA, y que
// sigue existiendo después de que alguien vuelva a mover `buildAlbEditor`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ EXISTE, Y NO ES UNA FORMALIDAD
//
// Este comportamiento YA SE PERDIÓ UNA VEZ, en silencio, y así es como pasó:
//
//   `buildAlbEditor` vivía ANIDADA dentro de `renderJobDetailView` y cogía `job` por CLAUSURA.
//   SCRUM-386/320 la sacó al NIVEL SUPERIOR — un movimiento correcto— y con eso desapareció la
//   clausura de la que colgaba `job.direccion`. Al rebasar C5 sobre ese main, git marcó 397
//   líneas en conflicto cuando la rama solo aportaba 58: las otras 339 eran la misma función en
//   otro sitio. Aceptar cualquiera de los dos lados perdía trabajo sin una sola línea de aviso.
//
// La regla que salió de ahí —«el campo que se pierde vive en el código que se mueve»— está en
// `docs/METODO_YAQU.md`. Este fichero es su red: el día que la función se mueva otra vez, esto
// se pone rojo en vez de dejar que la precarga se evapore.
//
// Y por eso el bloque se EXTRAE DEL FICHERO PUBLICADO por AST y se EJECUTA, en lugar de copiarlo
// aquí: un guard que re-declara lo que vigila verifica su propia opinión, no el código que se
// publica.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA_P = 'public/dashboard/js/jobDetailView.js';
const VISTA = fs.readFileSync(path.join(RAIZ, VISTA_P), 'utf8');
const SF = ts.createSourceFile(VISTA_P, VISTA, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

// ── EL EXTRACTOR ────────────────────────────────────────────────────────────────────────
// Del AST, no de `grep`: un guard de texto se caza a sí mismo en el comentario que explica la
// prohibición, y aquí arriba hay comentarios que nombran `job.direccion` a propósito.
function bloqueDeEntrega() {
  let fn = null;
  const buscaFn = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.getText(SF) === 'buildAlbEditor') fn = n;
    ts.forEachChild(n, buscaFn);
  };
  buscaFn(SF);
  if (!fn?.body) return null;

  // Las sentencias del cuerpo, desde `const rotAlb = …` hasta el `if (rotAlb… && rotAlb…)`.
  const sts = fn.body.statements;
  const iIni = sts.findIndex(
    (s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(SF) === 'rotAlb'),
  );
  const iFin = sts.findIndex(
    (s) => ts.isIfStatement(s) && /rotAlb\.lugarEntrega\s*&&\s*rotAlb\.fechaEntrega/.test(s.expression.getText(SF)),
  );
  if (iIni < 0 || iFin < 0 || iFin < iIni) return null;
  return VISTA.slice(sts[iIni].getStart(SF), sts[iFin].getEnd());
}

// ── EL DOM FALSO ────────────────────────────────────────────────────────────────────────
// Lo mínimo que el bloque toca. No hay jsdom en el repo y no se añade una dependencia por esto
// (regla 36): lo aprueba el fundador, y para cuatro `createElement` no hace falta.
function domFalso() {
  const creados = [];
  const nuevo = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(),
      style: { cssText: '' },
      children: [],
      textContent: '',
      appendChild(h) { this.children.push(h); return h; },
    };
    creados.push(el);
    return el;
  };
  return { creados, document: { createElement: nuevo } };
}

/** Ejecuta EL BLOQUE REAL y devuelve el input del lugar de entrega. */
function ejecutar({ alb, ctx }) {
  const bloque = bloqueDeEntrega();
  assert.ok(
    bloque && bloque.includes('lugarEntrega'),
    '🔴 ESCÁNER CIEGO: no se pudo extraer el bloque de LUGAR/FECHA de `buildAlbEditor`. Sin esto, ' +
      'todos los asserts de abajo se ejecutarían sobre nada y pasarían sin comprobar. Si la función ' +
      'se movió o se renombró, ARREGLA EL EXTRACTOR — no borres el test.',
  );
  const { creados, document } = domFalso();
  const box = { children: [], appendChild(h) { this.children.push(h); return h; } };
  const sandbox = {
    document,
    box,
    alb,
    ctx,
    window: {
      // Los rótulos llegan servidos por `/admin/me` (regla 30). Aquí solo hacen falta PRESENTES:
      // su texto lo vigila `scrum300-firmante-ids-y-microcopy.test.mjs`, no este fichero.
      appAlbaranRotulos: { lugarEntrega: 'rot-lugar', fechaEntrega: 'rot-fecha' },
      appAlbaranAyudas: { lugarEntrega: 'ayuda-lugar', fechaEntrega: 'ayuda-fecha' },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(bloque, sandbox);
  const lugar = creados.find((e) => e.tagName === 'INPUT' && e.type === 'text');
  assert.ok(lugar, '🔴 el bloque corrió pero no creó el input de lugar de entrega');
  return lugar;
}

// ── LOS DOS SENTIDOS ────────────────────────────────────────────────────────────────────

test('SCRUM-300 · CON dirección: aparece la sugerencia, y solo como placeholder', () => {
  const lugar = ejecutar({ alb: {}, ctx: { direccionSugerida: 'Calle Mayor 3' } });
  assert.equal(lugar.placeholder, 'Calle Mayor 3', '🔴 la sugerencia no llegó al placeholder');
  assert.equal(
    lugar.value, '',
    '🔴 LA SUGERENCIA RELLENÓ EL CAMPO. Es el suelo del ticket: una dirección equivocada en un ' +
      'documento de entrega es peor que ninguna. Sugiere, no rellena.',
  );
});

test('SCRUM-300 · SIN dirección: no aparece nada, y no revienta', () => {
  const lugar = ejecutar({ alb: {}, ctx: {} });
  assert.ok(!lugar.placeholder, `🔴 sin dirección no debe haber sugerencia, y hay «${lugar.placeholder}»`);
  assert.equal(lugar.value, '', '🔴 sin dirección el campo tiene que salir vacío');
});

test('SCRUM-300 · la sugerencia NO pisa lo que el profesional ya escribió', () => {
  const lugar = ejecutar({ alb: { lugarEntrega: 'Nave 4, polígono' }, ctx: { direccionSugerida: 'Calle Mayor 3' } });
  assert.equal(lugar.value, 'Nave 4, polígono', '🔴 se perdió el lugar de entrega guardado');
  assert.ok(
    !lugar.placeholder,
    '🔴 con valor escrito no se pone placeholder: el guard es `!lugarEl.value` y existe para esto.',
  );
});

// ── LA FORMA, QUE ES LO QUE SE DEGRADA EN SILENCIO ──────────────────────────────────────

test('SCRUM-300 · `direccionSugerida` NUNCA se asigna a un `.value`', () => {
  // El control que no puede darme la ejecución: que nadie, en NINGÚN sitio del fichero, escriba
  // la sugerencia dentro del valor. Es la regresión que convertiría «sugiere» en «rellena».
  const malas = [];
  const visita = (n) => {
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(n.left) &&
      n.left.name.getText(SF) === 'value' &&
      /direccionSugerida/.test(n.right.getText(SF))
    ) {
      malas.push(n.getText(SF));
    }
    ts.forEachChild(n, visita);
  };
  visita(SF);
  assert.deepEqual(
    malas, [],
    `🔴 la sugerencia se está escribiendo en un \`.value\`: ${malas.join(' · ')}`,
  );
});

test('SCRUM-300 · SUELO: el editor recibe un DATO, no el `job` entero', () => {
  // Dos cosas a la vez, y las dos importan:
  //   · que algún call site siga pasando `direccionSugerida` (si no, la precarga no llega nunca);
  //   · que `buildAlbEditor` no vuelva a leer `job.` por dentro — pasarle el Job le daría acceso a
  //     media pantalla e invitaría al acoplamiento siguiente.
  let pasa = false;
  const buscaProp = (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText(SF) === 'direccionSugerida') pasa = true;
    if (ts.isShorthandPropertyAssignment(n) && n.name.getText(SF) === 'direccionSugerida') pasa = true;
    ts.forEachChild(n, buscaProp);
  };
  buscaProp(SF);
  assert.ok(
    pasa,
    '🔴 NADIE pasa ya `direccionSugerida`. La precarga existe en el editor pero no la alimenta ' +
      'nadie: exactamente la forma de perderla sin que salte nada.',
  );

  let fn = null;
  const buscaFn = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.getText(SF) === 'buildAlbEditor') fn = n;
    ts.forEachChild(n, buscaFn);
  };
  buscaFn(SF);
  assert.ok(fn, '🔴 ESCÁNER CIEGO: no encuentro `buildAlbEditor`');

  const usosDeJob = [];
  const buscaJob = (n) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'job') {
      usosDeJob.push(n.getText(SF));
    }
    ts.forEachChild(n, buscaJob);
  };
  buscaJob(fn.body);
  assert.deepEqual(
    usosDeJob, [],
    `🔴 \`buildAlbEditor\` vuelve a leer el Job por dentro (${usosDeJob.join(' · ')}). Está en el ` +
      'nivel superior: no tiene esa clausura, y si hoy funciona es por un parámetro nuevo que ' +
      'mañana nadie recordará pasar. Un dato concreto en `ctx`, no el objeto entero.',
  );
});
