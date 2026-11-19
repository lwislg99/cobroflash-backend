// SCRUM-1756h (CSP paso 3 · restos del panel, filas de J3) · LAS VISTAS DE J3 SIN `style="…"` EN CADENAS.
//
// Con `style-src 'self'` aplicada, un `style="…"` metido por `innerHTML` no pinta (medido en Chrome,
// SCRUM-1756 c.22122). El censo 1756g dio 228 en los cinco ficheros de J3; el AST de este tramo da 229:
// el 229.º es `settingsView.js:1048`, `'style="width:100%">'`, que ABRE una cadena concatenada y el
// censo, que exigía un blanco delante (`\sstyle=`), no veía. Por eso aquí el contador NO pide blanco.
//
// Cada `style="V"` pasó a una clase `j3e-<7 hex del sha1 de V>` con V BYTE A BYTE en el bloque
// «/* J3: SCRUM-1756h … */» de `public/dashboard/css/styles.css` (contenedor de S2, regla de los
// contenedores, decidido en c.22127). Guion: `docs/master/evidencias/SCRUM-1756/1756h-transformar.mjs.txt`.
//
// QUÉ MIRA:
//   ① en cada fichero, 0 `style="` dentro de una cadena o plantilla (AST de typescript: un comentario no cuenta);
//   ② cada clase `j3e-` usada tiene su regla en el bloque, y sha1(declaraciones) da su nombre: si cambia una
//      declaración, cambia el hash y no casa; y el bloque no tiene reglas que nadie use;
//   ③ el conjunto de declaraciones del bloque es el medido en HEAD antes de mover (181, sha-256 congelado);
//   ④ el ancho de la barra de WhatsApp (un dato, no una clase) se pone por CSSOM tras pintar;
//   ⑤ ningún `className =` pisa un elemento de cadena que lleve clase `j3e-` (los dos que lo hacían usan classList).
// CONTROL SEMBRADO: el mismo contador sobre un fuente fabricado (un `style=` en cadena, otro que abre una
// cadena concatenada y otro en un comentario) TIENE que dar 2; si da otra cosa, está ciego.
//
// ⚠️ NO mide el aspecto: las capturas con la CSP aplicada quedan NO MEDIDAS (registro, tramo 1756h).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve un `style=` a una cadena del tutorial.
    fichero: 'public/dashboard/js/tutorial.js',
    de: '<button class="j3e-bf35b15 tut-acc" data-i="${i}">',
    a: '<button class="tut-acc" style="display:block" data-i="${i}">',
    cae: 'SCRUM-1756h · tutorial.js: 0 style= dentro de cadenas',
  },
  {
    // La hoja pierde la última regla del bloque J3.
    fichero: 'public/dashboard/css/styles.css',
    de: '.j3e-dd1c338:not(#j3-sin-id):not(#j3-sin-id){margin:10px 0 0;font-size:13px;line-height:1.5;color:#6b756f}\n',
    a: '',
    cae: 'SCRUM-1756h · cada clase j3e- usada tiene su regla y su hash casa',
  },
  {
    // La barra de WhatsApp pierde su ancho.
    fichero: 'public/dashboard/js/settingsView.js',
    de: "  card.querySelector('[data-j3-ancho]').style.width = `${pct}%`;\n",
    a: '',
    cae: 'SCRUM-1756h · settingsView.js: el ancho de la barra va por CSSOM',
  },
  {
    // Vuelve el className que borraba la clase de los botones Sí/No del alta.
    fichero: 'public/dashboard/js/onboardingView.js',
    de: "btnSi.classList.toggle('btn-primary', elegido); btnSi.classList.toggle('btn-secondary', !elegido);",
    a: "btnSi.className = elegido ? 'btn-primary' : 'btn-secondary';",
    cae: 'SCRUM-1756h · ningún className = pisa un elemento con clase j3e-',
  },
];

const RAIZ = path.resolve(import.meta.dirname, '..');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const FICH = (n) => `public/dashboard/js/${n}.js`;
const TODOS = ['onboardingView', 'plansView', 'settingsView', 'teamView', 'tutorial'].map(FICH);

/** Trozos de texto de cadena (comillas y plantillas) de un fuente JS, por AST. */
function cadenas(src, nombre) {
  const sf = ts.createSourceFile(nombre, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const K = ts.SyntaxKind;
  const tipos = [K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail];
  const out = [];
  (function walk(n) {
    if (tipos.includes(n.kind)) out.push(src.slice(n.getStart(sf), n.getEnd()));
    ts.forEachChild(n, walk);
  })(sf);
  return out;
}
const styleEnCadenas = (src, nombre) => cadenas(src, nombre).reduce((s, t) => s + (t.match(/style="/g) || []).length, 0);

const BLOQUE_INI = '/* J3: SCRUM-1756h ·';
const BLOQUE_FIN = '/* J3: fin del bloque SCRUM-1756h */';
function bloque() {
  const css = leer('public/dashboard/css/styles.css');
  const a = css.indexOf(BLOQUE_INI);
  const b = css.indexOf(BLOQUE_FIN);
  assert.ok(a >= 0 && b > a, 'CIEGO: no encuentro el bloque J3 de 1756h en styles.css');
  const reglas = new Map();
  for (const m of css.slice(a, b).matchAll(/^\.(j3e-[0-9a-f]{7}):not\(#j3-sin-id\):not\(#j3-sin-id\)\{([^}]*)\}$/gm)) reglas.set(m[1], m[2]);
  return reglas;
}
const usadas = () => new Set(TODOS.flatMap((f) => [...leer(f).matchAll(/\bj3e-[0-9a-f]{7}\b/g)].map((m) => m[0])));
const sha1 = (v) => crypto.createHash('sha1').update(v).digest('hex').slice(0, 7);

test('SCRUM-1756h · CONTROL: el contador ve un style= en cadena y el que abre una cadena, y no el del comentario', () => {
  const siembra = "// <b style=\"x:y\"> en comentario\nconst a = `<i style=\"c:d\">`;\nconst b = '<p ' +\n  'style=\"e:f\">';\n";
  assert.equal(styleEnCadenas(siembra, 'siembra.js'), 2);
});

test('SCRUM-1756h · onboardingView.js: 0 style= dentro de cadenas', () => {
  assert.equal(styleEnCadenas(leer(FICH('onboardingView')), 'onboardingView.js'), 0);
});
test('SCRUM-1756h · plansView.js: 0 style= dentro de cadenas', () => {
  assert.equal(styleEnCadenas(leer(FICH('plansView')), 'plansView.js'), 0);
});
test('SCRUM-1756h · settingsView.js: 0 style= dentro de cadenas', () => {
  assert.equal(styleEnCadenas(leer(FICH('settingsView')), 'settingsView.js'), 0);
});
test('SCRUM-1756h · teamView.js: 0 style= dentro de cadenas', () => {
  assert.equal(styleEnCadenas(leer(FICH('teamView')), 'teamView.js'), 0);
});
test('SCRUM-1756h · tutorial.js: 0 style= dentro de cadenas', () => {
  assert.equal(styleEnCadenas(leer(FICH('tutorial')), 'tutorial.js'), 0);
});

test('SCRUM-1756h · cada clase j3e- usada tiene su regla y su hash casa', () => {
  const reglas = bloque();
  const u = usadas();
  assert.ok(u.size > 0, 'CIEGO: ninguna clase j3e- en los cinco ficheros');
  const sinRegla = [...u].filter((c) => !reglas.has(c));
  assert.deepEqual(sinRegla, [], 'clases usadas sin regla en el bloque');
  const malHash = [...reglas].filter(([c, v]) => 'j3e-' + sha1(v) !== c).map(([c]) => c);
  assert.deepEqual(malHash, [], 'reglas cuyas declaraciones ya no dan su nombre');
  const huerfanas = [...reglas.keys()].filter((c) => !u.has(c));
  assert.deepEqual(huerfanas, [], 'reglas del bloque que no usa nadie');
});

test('SCRUM-1756h · las declaraciones del bloque son las 181 medidas antes de mover', () => {
  const v = [...bloque().values()].sort();
  assert.equal(v.length, 181);
  assert.equal(crypto.createHash('sha256').update(v.join('\n')).digest('hex'), '7a4e3f14ecb0f02c5218647ed54c4a0ec380a8fb3e56ed148752a801c832bae4');
});

test('SCRUM-1756h · settingsView.js: el ancho de la barra va por CSSOM', () => {
  const src = leer(FICH('settingsView'));
  assert.match(src, /data-j3-ancho="\$\{pct\}"/);
  assert.ok(src.includes("card.querySelector('[data-j3-ancho]').style.width = `${pct}%`;"), 'falta el ancho por CSSOM');
});

test('SCRUM-1756h · ningún className = pisa un elemento con clase j3e-', () => {
  const pisados = [];
  for (const f of TODOS) {
    const src = leer(f);
    const ids = new Set([...src.matchAll(/id="([\w-]+)"[^<>]*class="j3e-|class="j3e-[^"]*"[^<>]*id="([\w-]+)"/g)].map((m) => m[1] || m[2]));
    assert.ok(f !== FICH('onboardingView') || ids.has('ob-serie-si'), 'CIEGO: no veo ob-serie-si con su clase j3e-');
    for (const m of src.matchAll(/(\w+)\s*=\s*[\w.]*(?:getElementById\('([\w-]+)'\)|querySelector\('#([\w-]+)'\))/g)) {
      const id = m[2] || m[3];
      if (ids.has(id) && new RegExp(`\\b${m[1]}\\.className\\s*=[^=]`).test(src)) pisados.push(`${f}: ${m[1]} (#${id})`);
    }
  }
  assert.deepEqual(pisados, []);
});
