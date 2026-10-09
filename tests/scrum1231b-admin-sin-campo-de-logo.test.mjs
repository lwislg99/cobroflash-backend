// tests/scrum1231b-admin-sin-campo-de-logo.test.mjs — SCRUM-1231b
//
// `public/admin.html` YA NO TIENE EL CAMPO «Logo (URL opcional)», NI MANDA `logoUrl`.
//
// ── LO MEDIDO EN EL PASO 0 (9-oct-2026, yaqu.app, build 85d8d01e, cuenta QA) ──────────────
//   Desde SCRUM-1231 el servidor sólo admite como logo una imagen subida. El campo de texto de
//   esta página seguía ahí y su valor viajaba SIEMPRE en el `PUT /admin/merchant`:
//     · con una URL pegada      → 400, y la página sólo dice que no se pudo guardar;
//     · VACÍO (quien no tiene logo) → 400 también: `logoUrl: ''` no es una imagen subida.
//   O sea: el campo no podía guardar nada y además tumbaba el guardado de todo el formulario.
//   Las dos respuestas del servidor están vistas en producción (`docs/master/SCRUM-1231.md`, 1231b).
//
// ── QUÉ ATA ESTE FICHERO, Y QUÉ NO ────────────────────────────────────────────────────────
//   Lee la página y su script POR ESTRUCTURA (el HTML sin comentarios; el script por AST), no por
//   texto suelto: el comentario que explica por qué se retiró el campo NOMBRA lo que se retiró.
//   No ejecuta la página: lo que la página hace al guardar lo mide la sonda de la entrega.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ADMIN = path.join(RAIZ, 'public', 'admin.html');

function leerPagina() {
  let crudo;
  try { crudo = fs.readFileSync(ADMIN, 'utf8'); } catch (e) {
    assert.fail(`🔴 no se pudo leer public/admin.html (${e && e.code ? e.code : e}). «No está» y «no supe mirar» son el mismo verde.`);
  }
  const scripts = [];
  // Los scripts en línea se apartan ANTES de quitar comentarios: `<!--` dentro de un script es código.
  const sinScripts = crudo.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, (_, attrs, cuerpo) => {
    if (!/\ssrc\s*=/.test(attrs || '')) scripts.push(cuerpo);
    return '';
  });
  const html = sinScripts.replace(/<!--[\s\S]*?-->/g, '');
  return { html, script: scripts.join('\n;\n') };
}

/** Los `id="…"` del marcado. */
const idsDe = (html) => new Set([...html.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));

/** El formulario del perfil, del `<form id="merchant-form">` a su `</form>`. */
function formularioDelPerfil(html) {
  const m = /<form\s+id="merchant-form"[^>]*>([\s\S]*?)<\/form>/.exec(html);
  assert.ok(m, '🔴 SUELO: no se encuentra `<form id="merchant-form">`: el instrumento no está mirando el formulario del perfil.');
  return m[1];
}

function arbolDelScript(script) {
  assert.ok(script.trim().length > 500, '🔴 SUELO: admin.html no trae script en línea (o es mínimo): no hay nada que analizar.');
  return ts.createSourceFile('admin-inline.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/** Las claves del objeto `payload` que arma `saveMerchant`. */
function clavesDelCuerpo(sf) {
  let claves = null;
  (function anda(n, dentro) {
    const aqui = dentro || (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'saveMerchant');
    if (aqui && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'payload'
      && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      claves = n.initializer.properties.map((p) => (p.name ? p.name.getText(sf) : p.getText(sf)));
    }
    ts.forEachChild(n, (h) => anda(h, aqui));
  })(sf, false);
  return claves;
}

/** Los literales que el script pasa a `getElementById('…')`. */
function idsQuePideElScript(sf) {
  const ids = [];
  (function anda(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'getElementById'
      && n.arguments.length === 1 && ts.isStringLiteralLike(n.arguments[0])) {
      ids.push(n.arguments[0].text);
    }
    ts.forEachChild(n, anda);
  })(sf);
  return ids;
}

test('SCRUM-1231b · 🔴 el formulario del perfil no ofrece pegar un logo', () => {
  const { html } = leerPagina();
  const form = formularioDelPerfil(html);

  // SUELO: el formulario sigue siendo un formulario.
  const controles = [...form.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(controles.length >= 5,
    `🔴 SUELO: el formulario del perfil sólo tiene ${controles.length} controles. O se ha vaciado, o no es el que se cree.`);

  const deLogo = controles.filter((c) => /\b(id|name)\s*=\s*"[^"]*logo[^"]*"/i.test(c));
  assert.deepEqual(deLogo, [],
    '🔴 EL FORMULARIO DEL PERFIL VUELVE A TENER UN CAMPO DE LOGO. El servidor sólo admite como logo una ' +
    'imagen subida (SCRUM-1231): un campo de texto aquí no puede guardar nada, y si viaja vacío tumba ' +
    'el guardado de todo el formulario con un 400.');
  assert.doesNotMatch(form, /<label\b[^>]*\bfor\s*=\s*"[^"]*logo[^"]*"/i,
    '🔴 queda una etiqueta de un campo de logo que ya no existe.');
  // Hermano del `doesNotMatch`: la misma forma SÍ casa con un campo que sigue estando.
  assert.match(form, /<label\b[^>]*\bfor\s*=\s*"merchant-name"/,
    '🔴 ESCÁNER CIEGO: el patrón de etiqueta no encuentra ni la del nombre, que está.');
});

test('SCRUM-1231b · 🔴 el guardado del perfil no manda `logoUrl`', () => {
  const sf = arbolDelScript(leerPagina().script);
  const claves = clavesDelCuerpo(sf);
  assert.ok(Array.isArray(claves),
    '🔴 SUELO: no se encuentra el objeto `payload` de `saveMerchant`. Si el guardado ha cambiado de forma, este test ya no mira nada.');
  assert.ok(claves.includes('name') && claves.length >= 5,
    `🔴 SUELO: el cuerpo del guardado sólo lleva [${claves.join(', ')}]. No es el cuerpo que se cree.`);
  assert.ok(!claves.includes('logoUrl'),
    '🔴 EL GUARDADO VUELVE A MANDAR `logoUrl`. Desde esta página sólo puede ser texto escrito a mano, y el ' +
    `servidor lo rechaza —también vacío— tumbando el resto del formulario. Cuerpo: [${claves.join(', ')}].`);
});

test('SCRUM-1231b · ✅ todo lo que el script busca por id existe en la página', () => {
  // Por qué va aquí: quitar un campo y dejar la línea que lo lee no da ningún error al cargar el
  // fichero; revienta al ejecutarse (`null.value`) y la página dice que no pudo cargar el perfil.
  const { html, script } = leerPagina();
  const ids = idsDe(html);
  const pedidos = idsQuePideElScript(arbolDelScript(script));
  assert.ok(pedidos.length >= 15 && ids.size >= 15,
    `🔴 SUELO: ${pedidos.length} búsquedas por id en el script y ${ids.size} ids en el marcado. El instrumento no está viendo la página.`);
  const huerfanos = [...new Set(pedidos.filter((id) => !ids.has(id)))];
  assert.deepEqual(huerfanos, [],
    `🔴 EL SCRIPT BUSCA ELEMENTOS QUE LA PÁGINA NO TIENE: ${huerfanos.join(', ')} (de ${pedidos.length} búsquedas). ` +
    'Esa línea revienta al ejecutarse.');
});
