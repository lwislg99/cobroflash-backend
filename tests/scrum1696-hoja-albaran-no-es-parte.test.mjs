// SCRUM-1696 (T3 de la ③ de SCRUM-1686) · LA HOJA DE ALTA DEL ALBARÁN DEJA DE LLAMARLO «PARTE».
//
// Confusión ① del fundador (SCRUM-1686 c.21447): la palabra «parte» nombraba a DOS documentos. La
// casilla y la frase de la hoja de alta del ALBARÁN (`buildAlbEditor`) y la frase bajo la barra de
// Documentos de la ficha hablaban del albarán con el nombre del otro.
//
// Textos FIRMADOS: tanda N1-N13 de SCRUM-1686 (c.21470), firma del fundador «si firmo» (c.21471,
// ~12:05 local, alcance: los trece TAL CUAL):
//   N8  · Ficha del trabajo y hoja de «Nuevo albarán» · QUITAR «El parte sigue sin ser una factura.»
//         (está en los dos sitios; firmarlo vale para los dos).
//   N12 · Hoja de «Nuevo albarán», casilla · «Incluir precios en el albarán» (sustituye a «Incluir
//         precios en el parte»).
//
// Lo que se fija:
//   ① «El parte sigue sin ser una factura.» no queda en NINGÚN código ejecutable del panel (N8: los
//     dos sitios, y ninguno nuevo);
//   ② la casilla dice «Incluir precios en el albarán», UNA vez, y DENTRO de `buildAlbEditor` (la
//     decisión de SCRUM-917 com. 16142 no se mueve: cambia el rótulo, no el sitio);
//   ③ el literal viejo «Incluir precios en el parte» no queda en ningún código ejecutable del panel;
//   ④ la casilla sigue gobernando lo que gobernaba: `modoValoracion` VALORADO / SIN_VALORAR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ejecutableDe } from './_guard-texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');
const VISTA_TXT = fs.readFileSync(path.join(DIR_JS, 'jobDetailView.js'), 'utf8');

const N8_QUITADO = 'El parte sigue sin ser una factura.';
const N12 = 'Incluir precios en el albarán';
const N12_VIEJO = 'Incluir precios en el parte';

// Todo el JS del panel. `jobDetailView.js`, sólo la parte EJECUTABLE, con SUELO (`buildAlbEditor`
// tiene que sobrevivir al filtro): sus comentarios citan el texto viejo a propósito. El resto, el
// texto CRUDO —comentarios incluidos—, que es más estricto y no depende de ningún filtro.
const FICHEROS = fs.readdirSync(DIR_JS).filter((f) => f.endsWith('.js'));
const EJECUTABLE = FICHEROS.map((f) => {
  const crudo = fs.readFileSync(path.join(DIR_JS, f), 'utf8');
  return {
    f,
    src: f === 'jobDetailView.js'
      ? ejecutableDe(crudo, { ancla: 'function buildAlbEditor', almohadillaEsComentario: false })
      : crudo,
  };
});

function buildAlbEditor() {
  const sf = ts.createSourceFile('v.js', VISTA_TXT, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let editor = null;
  const busca = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'buildAlbEditor') editor = n;
    ts.forEachChild(n, busca);
  };
  busca(sf);
  assert.ok(editor, '🔴 ESCÁNER CIEGO: no encuentro `buildAlbEditor` en jobDetailView.js.');
  return ejecutableDe(editor.getText(sf), { ancla: 'SIN_VALORAR', almohadillaEsComentario: false });
}

test('SCRUM-1696 · control positivo: el escáner ve el JS del panel', () => {
  assert.ok(FICHEROS.length > 20, `🔴 ESCÁNER CIEGO: sólo ${FICHEROS.length} ficheros en public/dashboard/js.`);
  assert.ok(FICHEROS.includes('jobDetailView.js'), '🔴 ESCÁNER CIEGO: falta jobDetailView.js.');
  // Que `soloEjecutable` deja pasar literales: la casilla tiene que verse con un rótulo u otro.
  const vista = EJECUTABLE.find((x) => x.f === 'jobDetailView.js').src;
  assert.ok(vista.includes(N12) || vista.includes(N12_VIEJO),
    '🔴 ESCÁNER CIEGO: no veo la casilla de precios con ningún rótulo; el filtro de comentarios se come los literales.');
});

test('SCRUM-1696 ① · N8: «El parte sigue sin ser una factura.» no sale en ninguna pantalla', () => {
  const con = EJECUTABLE.filter((x) => x.src.includes(N8_QUITADO)).map((x) => x.f);
  assert.deepEqual(con, [],
    `🔴 «${N8_QUITADO}» sigue en ${con.join(', ')}. N8 (SCRUM-1686 c.21470, firmado c.21471) lo QUITA ` +
      'de la ficha del trabajo y de la hoja de «Nuevo albarán»: habla del albarán con el nombre del parte.');
});

test('SCRUM-1696 ② · N12: la casilla dice «Incluir precios en el albarán», una vez, dentro de la hoja de alta', () => {
  const vista = EJECUTABLE.find((x) => x.f === 'jobDetailView.js').src;
  const n = vista.split(N12).length - 1;
  assert.equal(n, 1, `🔴 «${N12}» aparece ${n} veces en jobDetailView.js; es UNA casilla (SCRUM-917 com. 16142).`);
  const dentro = buildAlbEditor();
  assert.equal(dentro.split(N12).length - 1, 1,
    `🔴 «${N12}» no está DENTRO de \`buildAlbEditor\`: cambia el rótulo, no el sitio.`);
});

test('SCRUM-1696 ③ · el rótulo viejo «Incluir precios en el parte» no queda en el panel', () => {
  const con = EJECUTABLE.filter((x) => x.src.includes(N12_VIEJO)).map((x) => x.f);
  assert.deepEqual(con, [], `🔴 «${N12_VIEJO}» sigue en ${con.join(', ')}; N12 lo sustituye.`);
});

test('SCRUM-1696 ④ · la casilla sigue gobernando el modo de valoración del albarán', () => {
  const dentro = buildAlbEditor();
  const iCasilla = dentro.indexOf(N12);
  assert.ok(iCasilla > 0, '🔴 sin la casilla no hay nada que medir.');
  const antes = dentro.slice(Math.max(0, iCasilla - 900), iCasilla);
  assert.match(antes, /chk\.type\s*=\s*'checkbox'/, '🔴 el rótulo ya no acompaña a la casilla.');
  assert.match(antes, /'VALORADO'\s*:\s*'SIN_VALORAR'/, '🔴 la casilla dejó de cambiar VALORADO / SIN_VALORAR.');
});
