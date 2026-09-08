// tests/scrum728b-aviso-legible.test.mjs — SCRUM-728
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// TODA RUTA QUE RESERVA UN NÚMERO TRADUCE EL CERROJO SATURADO. SIN GATE.
//
// El test que lo demuestra corriendo (`scrum728-serie-ocupada-postgres.test.mjs`) necesita una
// base y vive detrás de `SERIE_PG_URL`. **Un ticket cuyo único guard está detrás de un gate es un
// ticket cuyo guard el CI no ejecuta nunca** (SCRUM-296). Éste corre siempre.
//
// Y vigila las dos mitades:
//   ① que las rutas que reservan número traduzcan el fallo del cerrojo, en vez de devolver el
//      `internal_error` que el panel pintaba como «API 500: internal_error»;
//   ② que el reconocimiento siga siendo por IDENTIDAD de UN código de Prisma. Si alguien lo
//      ensancha a «cualquier error», el profesional recibirá «inténtalo otra vez» ante fallos que
//      no se arreglan reintentando — un error técnico cambiado por una mentira amable.
//
// ⛔ Y el tercero: que nadie suba el timeout por la puerta de atrás. Está medido por qué no —a 20 s
// el usuario 22 esperaría 19 segundos—, y el guard de `scrum728-seccion-critica-de-la-serie` (③)
// ya lo vigila para `$transaction`. Aquí se vigila el otro sitio donde podría colarse: el módulo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULO = 'src/modules/invoicing/domain/cerrojoSaturado.ts';

/** 🔴 Sin `return` en el callback: `forEachChild` corta en cuanto recibe algo truthy. */
function buscar(n, ok, out = []) {
  if (ok(n)) out.push(n);
  ts.forEachChild(n, (h) => { buscar(h, ok, out); });
  return out;
}
function arbol(rel) {
  const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return { fuente, sf: ts.createSourceFile(rel, fuente, ts.ScriptTarget.Latest, true) };
}
const ficherosTs = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficherosTs(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
};

const RESERVAN = /^allocate(Albaran|Invoice|Quote)Number$/;

/**
 * Las rutas cuya transacción RESERVA un número: la población que puede devolver el P2028 del
 * cerrojo. Se derivan del árbol, no de una lista a mano — una lista se queda vieja en silencio.
 */
function rutasQueReservan() {
  const out = [];
  for (const f of ficherosTs(path.join(RAIZ, 'src'))) {
    const rel = path.relative(RAIZ, f).split(path.sep).join('/');
    if (!/\/routes\//.test(rel)) continue;
    const { sf } = arbol(rel);
    for (const tx of buscar(sf, (n) => ts.isCallExpression(n)
      && ts.isPropertyAccessExpression(n.expression)
      && /\$transaction$/.test(n.expression.getText(sf)))) {
      if (!buscar(tx, (m) => ts.isCallExpression(m) && ts.isIdentifier(m.expression)
        && RESERVAN.test(m.expression.text)).length) continue;
      let a = tx.parent; let ruta = null;
      while (a) {
        if (ts.isCallExpression(a) && ts.isPropertyAccessExpression(a.expression)
          && /^router\.(post|put|patch)$/.test(a.expression.getText(sf))
          && a.arguments[0] && ts.isStringLiteral(a.arguments[0])) { ruta = a.arguments[0].text; break; }
        a = a.parent;
      }
      if (ruta) out.push({ fichero: rel, ruta });
    }
  }
  return out;
}

/**
 * Las que NO traducen, y por qué. Cada exención va con su motivo: una excepción sin motivo es una
 * excepción que nadie vuelve a mirar.
 */
const SIN_TRADUCIR = {
  '/:token/decision':
    'lo dispara el CLIENTE FINAL, no un profesional, y esta ruta no es «crear un documento»: es la '
    + 'ACEPTACIÓN del presupuesto, que ya ha salido bien cuando la emisión falla. Su camino de fallo '
    + 'es otro y está decidido en SCRUM-814: la aceptación se conserva y la factura queda pendiente. '
    + 'Enseñarle aquí «no hemos podido crear el documento» sería contarle un problema nuestro sobre '
    + 'algo que él sí completó.',
  '/:id/convertir-en-factura':
    'PENDIENTE, declarado y no olvidado: hoy sigue devolviendo `internal_error` ante el cerrojo '
    + 'saturado. No entra en esta tanda porque su `catch` mezcla varios modos de fallo del camino '
    + 'de emisión fiscal y separarlos es otro trabajo, no un renglón. Sale en este mismo mensaje '
    + 'para que no se pierda.',
  '/:id/invoice-manual':
    'PENDIENTE, mismo motivo que el anterior: emisión manual (SCRUM-178), `catch` con varios modos.',
};

test('SCRUM-728 · 🔴 SUELO: el análisis encuentra las rutas que reservan número', () => {
  const rutas = rutasQueReservan();
  assert.ok(rutas.length >= 6,
    `🔴 sólo ${rutas.length} rutas reservan número y sabemos que hay al menos seis. El analizador `
    + 'no está mirando — y un cero aquí NO es «no hay», es «no supe ver».');
  assert.ok(rutas.some((r) => r.ruta === '/:id/albaranes'),
    '🔴 CONTROL POSITIVO: no encuentra `POST /:id/albaranes`, que es la víctima del ticket.');
});

test('SCRUM-728 · 🔴 toda ruta que reserva número traduce el cerrojo saturado (o lo declara)', () => {
  const sinCubrir = [];
  for (const r of rutasQueReservan()) {
    const { fuente } = arbol(r.fichero);
    if (/esCerrojoSaturado\(/.test(fuente)) continue;      // el fichero lo trata
    if (SIN_TRADUCIR[r.ruta]) continue;                    // exención declarada, con motivo
    sinCubrir.push(`${r.fichero}  ${r.ruta}`);
  }
  assert.deepEqual(sinCubrir, [],
    '🔴 HAY RUTAS QUE RESERVAN NÚMERO Y NO TRADUCEN EL CERROJO SATURADO:\n    '
    + sinCubrir.join('\n    ')
    + '\n\n  Ante seis creaciones simultáneas del mismo merchant, la que espera revienta con P2028 y'
    + '\n  esa ruta le devolvería `internal_error` — que el panel pinta como «API 500:'
    + '\n  internal_error». Un identificador interno en la cara de un profesional.'
    + '\n\n  O se traduce (`esCerrojoSaturado` + `cuerpoCerrojoSaturado`), o se declara en'
    + '\n  `SIN_TRADUCIR` con su motivo. Lo que no vale es dejarlo sin decidir.');
});

test('SCRUM-728 · 🔴 se reconoce UN código, por identidad — no «cualquier error»', () => {
  const { sf, fuente } = arbol(MODULO);
  const literales = buscar(sf, (n) => ts.isStringLiteral(n)).map((n) => n.text);
  assert.ok(literales.includes('P2028'),
    '🔴 el módulo ya no reconoce `P2028`. Ése es el código de «transacción expirada», el que '
    + 'salió en las cuatro caídas medidas en SCRUM-728 — las cuatro esperando el cerrojo.');

  // 🔴 NO ES UNA NEGACIÓN SUELTA (SCRUM-237): se comprueba que SÍ compara contra `e.code` y que
  // NO se apoya en el texto del mensaje, que está en inglés y cambia entre versiones.
  assert.match(fuente, /e\.code === TRANSACCION_EXPIRADA/,
    '🔴 el reconocimiento ya no compara el `code` del error.');
  assert.ok(!/message.*includes|includes.*Transaction already closed|\.test\(.*message/i.test(fuente),
    '🔴 se está reconociendo por el TEXTO del mensaje. Ese texto está en inglés, cambia entre '
    + 'versiones de Prisma y lleva dentro los milisegundos de cada caída.');
  assert.match(fuente, /instanceof Prisma\.PrismaClientKnownRequestError/,
    '🔴 ya no se acota a los errores conocidos de Prisma: entraría cualquier cosa con un `.code`.');
});

test('SCRUM-728 · 🔴 el módulo NO sube el timeout por la puerta de atrás', () => {
  // A 20 s daría margen para 22 simultáneas y el usuario 22 esperaría 19 segundos: se cambiaría
  // un fallo rápido por una espera larga. Medido en SCRUM-728, no opinado.
  const { sf } = arbol(MODULO);
  const props = buscar(sf, (n) => ts.isPropertyAssignment(n) && ts.isIdentifier(n.name)
    && ['timeout', 'maxWait'].includes(n.name.text));
  assert.deepEqual(props.map((p) => p.getText(sf)), [],
    '🔴 el módulo del aviso fija `timeout` o `maxWait`. Este ticket existe PORQUE subirlo no es la '
    + 'salida: aplaza en vez de arreglar, y el coste es lineal.');
});

test('SCRUM-728 · 🔴 el texto es el APROBADO, palabra por palabra, y tiene su registro', () => {
  const { sf } = arbol(MODULO);
  const decl = buscar(sf, (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)
    && n.name.text === 'COPY_CERROJO_SATURADO');
  assert.equal(decl.length, 1, '🔴 no existe la constante `COPY_CERROJO_SATURADO`.');
  assert.ok(decl[0].initializer && ts.isStringLiteral(decl[0].initializer),
    '🔴 el texto no es un literal: no se puede comprobar cuál es.');
  assert.equal(decl[0].initializer.text,
    'No hemos podido crear el documento. Inténtalo otra vez en unos segundos.',
    '🔴 el texto aprobado ha cambiado. Es microcopy oficial firmada el 8-sep-2026 (regla 30): si '
    + 'hace falta otro, se firma otro.');

  const registro = path.join(RAIZ, 'docs', 'microcopy', '2026-09-08-SCRUM-728-serie-ocupada.md');
  assert.ok(fs.existsSync(registro),
    '🔴 falta el registro de la aprobación. Un texto oficial sin registro es un texto que nadie '
    + 'puede comprobar que se firmara.');
  assert.match(fs.readFileSync(registro, 'utf8'), /\*\*Aprobado por el fundador\*\*/,
    '🔴 el registro no lleva la firma del fundador.');
});

test('SCRUM-728 · 📌 el test con base existe y conserva sus controles', () => {
  const conBase = path.join(RAIZ, 'tests', 'scrum728-serie-ocupada-postgres.test.mjs');
  assert.ok(fs.existsSync(conBase),
    '🔴 falta `tests/scrum728-serie-ocupada-postgres.test.mjs`. Este guard vigila la FORMA; el que '
    + 'demuestra que el aviso sale es aquél.');
  const t = fs.readFileSync(conBase, 'utf8');
  for (const [aguja, porque] of [
    ['reintento crea UNO', 'sin él, nadie comprueba que el usuario que reintenta no acabe con dos documentos'],
    ['POSITIVO', 'sin él, el arreglo podría estar tapando cualquier error con «inténtalo otra vez»'],
    ['contadorAntes', 'sin él, nadie comprueba que el fallo no consumió un número de la serie'],
  ]) {
    assert.ok(t.includes(aguja), `🔴 el test con base ha perdido «${aguja}»: ${porque}.`);
  }
});
