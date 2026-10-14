// tests/scrum534r-el-p1-se-ve-entero.test.mjs — SCRUM-534r
//
// /legal/alcance-beta servía el P1 roto: el asterisco de VERI*FACTU partía la negrita del
// markdown y el usuario leía «La *», media frase en cursiva y «**» colgando (medido con el
// readLegalDoc real sobre main 11ca1e05f: versión 17275d59e185). El fundador autorizó reparar
// cómo se VE sin cambiar una palabra (SCRUM-534 c.19585, «Ok»).
//
// Este guard pasa ALCANCE_BETA.md por el readLegalDoc REAL de dist (el mismo que sirve la página
// y calcula su versión) y exige que en el TEXTO VISIBLE no quede ningún asterisco que no sea el
// de la marca VERI*FACTU. El positivo se SIEMBRA (la línea rota, en un docs/legal de usar y tirar),
// para que el día que el documento cambie el detector no se quede mudo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const MODULO = require.resolve(path.join(RAIZ, 'dist', 'modules', 'system', 'app', 'routes', 'legalPages.routes.js'));

// Literal firmado (SCRUM-534 c.19585, P1), hasta el corte de línea del fichero.
const P1_CABEZA = 'La facturación con sistema VERI*FACTU se activará al cerrar la declaración responsable';

function textoVisible(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function asteriscosSueltos(visible) {
  return (visible.replaceAll('VERI*FACTU', '').match(/\*/g) || []).length;
}
// El módulo fija LEGAL_DIR con process.cwd() AL CARGARSE: cambiar de directorio después no lo
// mueve. Para servir desde otra raíz se carga una instancia nueva con esa raíz como cwd.
function servirDesde(raiz) {
  const antes = process.cwd();
  process.chdir(raiz);
  try {
    delete require.cache[MODULO];
    return require(MODULO).readLegalDoc('ALCANCE_BETA.md');
  } finally {
    process.chdir(antes);
    delete require.cache[MODULO];
  }
}

test('SCRUM-534r · el P1 de /legal/alcance-beta se sirve sin asteriscos sueltos y con su literal', () => {
  const doc = servirDesde(RAIZ);
  assert.ok(doc && doc.html.length > 500, `🔴 no se pudo servir ALCANCE_BETA.md: ${JSON.stringify(doc)?.slice(0, 80)}`);
  const visible = textoVisible(doc.html);
  assert.equal(asteriscosSueltos(visible), 0,
    `🔴 el texto servido lleva asteriscos sueltos: el markdown se ha partido. Líneas:\n${visible.split('\n').filter((l) => asteriscosSueltos(l)).join('\n')}`);
  assert.ok(visible.includes(P1_CABEZA), `🔴 el P1 firmado (c.19585) no se lee entero en pantalla: falta «${P1_CABEZA}»`);
});

test('SCRUM-534r · control sembrado: la línea rota de main da asteriscos sueltos y no lee el P1', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum534r-'));
  try {
    fs.mkdirSync(path.join(tmp, 'docs', 'legal'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'docs', 'legal', 'ALCANCE_BETA.md'),
      '- La **facturación con sistema VERI*FACTU se activará al cerrar la declaración responsable**\n');
    const visible = textoVisible(servirDesde(tmp).html);
    assert.ok(!visible.includes('del fabricante'), `🔴 el control leyó el documento REAL, no el sembrado: «${visible.slice(0, 120)}»`);
    assert.equal(asteriscosSueltos(visible), 3, `el detector no ve la rotura sembrada: «${visible}»`);
    assert.ok(!visible.includes(P1_CABEZA), 'el control sembrado debería NO leer el P1');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
