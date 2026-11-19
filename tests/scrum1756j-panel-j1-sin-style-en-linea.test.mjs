// tests/scrum1756j-panel-j1-sin-style-en-linea.test.mjs — SCRUM-1756j (CSP paso 3 · panel, fila J1)
//
// LAS VISTAS DE FACTURAS DEL PANEL SIN `style="` EN SUS CADENAS. Con `style-src 'self'` aplicada
// (SCRUM-1637) el navegador no pinta un `style=` metido por `innerHTML` (medido en Chrome por 1756g,
// c.22122). Censo de 1756g sobre `origin/main` = e37a7051f: 28 `style="` dentro de cadenas en los tres
// ficheros de J1 (invoiceDetailView 8 · invoicesView 5 · puertaSerie 15). Receta de SCRUM-1756: cada
// `style=` pasa a una clase con las MISMAS declaraciones, en el bloque `/* J1: SCRUM-1756j … */` de
// `public/dashboard/css/styles.css` (contenedor de S2: el otro equipo añade SOLO su bloque marcado).
//
// QUÉ MIRA:
//   ① con el AST de typescript, 0 `style=` dentro de cadenas (literal, plantilla y sus trozos) en los
//      tres ficheros; el mismo patrón que el censo de 1756g (`1756g-censo.mjs.txt`, RX.style_attr);
//   ② cada ocurrencia de main (copiadas aquí con su línea; cuántas, lo ata el control) tiene su
//      marcado nuevo en el fichero, y su regla en el bloque J1 con EXACTAMENTE las declaraciones del
//      atributo: ni una de más, ni una de menos, byte a byte (`!important` donde el bloque lo declara);
//   ③ los `display:none` que el guion enciende con `el.style.display` NO llevan `!important` (si lo
//      llevaran, el guion ya no podría enseñarlos), y el error de anular se enseña con 'block'.
// Control POSITIVO sembrado: una fuente fabricada con 4 `style=` en cadenas y 1 en un comentario TIENE
// que dar 4; si da 0 el contador está CIEGO. Control cero: una fuente sin ninguno da 0.
//
// ⚠️ NO mide el aspecto en un navegador: eso va en el registro (`docs/master/SCRUM-1756.md`, tramo 1756j).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const HOJA = 'public/dashboard/css/styles.css';
const DETALLE = 'public/dashboard/js/invoiceDetailView.js';
const LISTA = 'public/dashboard/js/invoicesView.js';
const PUERTA = 'public/dashboard/js/puertaSerie.js';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo a
// como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve un `style=` a una cadena de innerHTML.
    fichero: 'public/dashboard/js/puertaSerie.js',
    de: `'<div id="ps-detalle" class="j1-ps-detalle">'`,
    a: `'<div id="ps-detalle" style="display:none">'`,
    cae: 'SCRUM-1756j · los tres ficheros de J1 llevan 0 style= dentro de sus cadenas',
  },
  {
    // La regla pierde una declaración del atributo: el campo del número se queda sin su ancho.
    fichero: 'public/dashboard/css/styles.css',
    de: '#puerta-serie .j1-ps-numero { width:100%; min-height:44px;',
    a: '#puerta-serie .j1-ps-numero { min-height:44px;',
    cae: 'SCRUM-1756j · cada style= de main tiene su clase y su regla con las mismas declaraciones',
  },
  {
    // La regla pierde el !important: el modal vuelve a perder contra `.modal` como no perdía el atributo.
    fichero: 'public/dashboard/css/styles.css',
    de: '.j1-anul-modal { max-width:460px !important; }',
    a: '.j1-anul-modal { max-width:460px; }',
    cae: 'SCRUM-1756j · cada style= de main tiene su clase y su regla con las mismas declaraciones',
  },
  {
    // El error de anular se vuelve a enseñar con '' y la clase lo deja oculto.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "err.style.display = 'block';",
    a: "err.style.display = '';",
    cae: 'SCRUM-1756j · los display:none que enciende el guion siguen pudiendo encenderse',
  },
];

// ── El contador: el de 1756g (RX.style_attr) sobre los trozos de CADENA del AST ────────────────────
const STYLE_ATTR = /\sstyle\s*=\s*\\?["']/gi;
function styleEnCadenas(nombre, fuente) {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const K = ts.SyntaxKind;
  const tipos = [K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail];
  const hallados = [];
  (function visitar(n) {
    if (tipos.includes(n.kind)) {
      const texto = fuente.slice(n.getStart(sf), n.end);
      for (const m of texto.matchAll(STYLE_ATTR)) hallados.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 + ':' + m[0]);
    }
    ts.forEachChild(n, visitar);
  })(sf);
  return hallados;
}

// ── Las 28 de `e37a7051f`, copiadas: qué había, qué hay ahora, y la regla que la sustituye ─────────
// `decl` es el valor del atributo de main TAL CUAL; `imp` dice si el bloque J1 lo declara !important.
const C = (fichero, linea, antes, ahora, selector, decl, imp) => ({ fichero, linea, antes, ahora, selector, decl, imp });
const CAMBIOS = [
  C(DETALLE, 122, '<span style="font-size:16px;font-weight:700;color:var(--ink)">', '<span class="j1-fac-numero">', '.j1-fac-numero', 'font-size:16px;font-weight:700;color:var(--ink)', true),
  C(DETALLE, 234, '<dd style="color:var(--muted)">Sin datos.</dd>', '<dd class="j1-fac-sin-datos">Sin datos.</dd>', '.j1-fac-sin-datos', 'color:var(--muted)', true),
  C(DETALLE, 824, '<div class="modal" style="max-width:460px" role="dialog"', '<div class="modal j1-anul-modal" role="dialog"', '.j1-anul-modal', 'max-width:460px', true),
  C(DETALLE, 828, '<select id="anul-motivo" style="width:100%">', '<select id="anul-motivo" class="j1-anul-motivo">', '.j1-anul-motivo', 'width:100%', true),
  C(DETALLE, 834, '<div class="alert warning" style="margin-top:12px">', '<div class="alert warning j1-anul-aviso">', '.j1-anul-aviso', 'margin-top:12px', true),
  C(DETALLE, 836, '<ul style="margin:6px 0 0;padding-left:18px">', '<ul class="j1-anul-lista">', '.j1-anul-lista', 'margin:6px 0 0;padding-left:18px', true),
  C(DETALLE, 846, '<div class="alert" id="anul-err" style="display:none;margin-top:12px"></div>', '<div class="alert j1-anul-err" id="anul-err"></div>', '.j1-anul-err', 'display:none;margin-top:12px', true),
  C(DETALLE, 848, '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">', '<div class="j1-anul-acciones">', '.j1-anul-acciones', 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px', true),
  C(LISTA, 491, '<th style="width:36px" class="col-hide-mobile">', '<th class="col-hide-mobile j1-fac-col-check">', '.j1-fac-col-check', 'width:36px', true),
  C(LISTA, 494, '<th style="text-align:right">Total</th>', '<th class="j1-fac-col-total">Total</th>', '.j1-fac-col-total', 'text-align:right', true),
  C(LISTA, 515, '<span id="bulk-count" style="font-size:13.5px;font-weight:600"></span>', '<span id="bulk-count" class="j1-bulk-count"></span>', '.j1-bulk-count', 'font-size:13.5px;font-weight:600', true),
  C(LISTA, 517, '<button id="bulk-cancel-btn" class="btn-ghost btn-sm" style="color:rgba(255,255,255,.7)">', '<button id="bulk-cancel-btn" class="btn-ghost btn-sm j1-bulk-cancelar">', '.j1-bulk-cancelar', 'color:rgba(255,255,255,.7)', true),
  C(LISTA, 658, '<button id="inv-empty-cta" class="btn-primary btn-sm" style="margin-top:14px">', '<button id="inv-empty-cta" class="btn-primary btn-sm j1-fac-vacio-cta">', '.j1-fac-vacio-cta', 'margin-top:14px', true),
  C(PUERTA, 143, '<h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:var(--ink)">', '<h3 class="j1-ps-titulo">', '#puerta-serie .j1-ps-titulo', 'margin:0 0 4px;font-size:15px;font-weight:700;color:var(--ink)', false),
  C(PUERTA, 144, '<p style="margin:0 0 10px;font-size:13px;color:#6b756f">', '<p class="j1-ps-ayuda">', '#puerta-serie .j1-ps-ayuda', 'margin:0 0 10px;font-size:13px;color:#6b756f', false),
  C(PUERTA, 145, '<div id="ps-elec" style="display:flex;gap:10px;margin:4px 0 16px">', '<div id="ps-elec" class="j1-ps-elec">', '#puerta-serie .j1-ps-elec', 'display:flex;gap:10px;margin:4px 0 16px', false),
  C(PUERTA, 146, '<button type="button" id="ps-si" class="btn-secondary" style="flex:1;min-height:44px">', '<button type="button" id="ps-si" class="btn-secondary j1-ps-opcion">', '#puerta-serie .j1-ps-opcion', 'flex:1;min-height:44px', false),
  C(PUERTA, 147, '<button type="button" id="ps-no" class="btn-secondary" style="flex:1;min-height:44px">', '<button type="button" id="ps-no" class="btn-secondary j1-ps-opcion">', '#puerta-serie .j1-ps-opcion', 'flex:1;min-height:44px', false),
  C(PUERTA, 149, '<div id="ps-detalle" style="display:none">', '<div id="ps-detalle" class="j1-ps-detalle">', '#puerta-serie .j1-ps-detalle', 'display:none', false),
  C(PUERTA, 150, '<label for="ps-numero" style="font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px">', '<label for="ps-numero" class="j1-ps-etiqueta">', '#puerta-serie .j1-ps-etiqueta', 'font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px', false),
  C(PUERTA, 151, 'aria-describedby="ps-numero-ayuda" style="width:100%;min-height:44px;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px"/>', 'aria-describedby="ps-numero-ayuda" class="j1-ps-numero"/>', '#puerta-serie .j1-ps-numero', 'width:100%;min-height:44px;padding:11px 13px;border:1px solid #cdd2cb;border-radius:9px;font-size:14px', false),
  C(PUERTA, 152, '<p id="ps-numero-ayuda" style="font-size:12px;color:#6b756f;margin:6px 0 0">', '<p id="ps-numero-ayuda" class="j1-ps-numero-ayuda">', '#puerta-serie .j1-ps-numero-ayuda', 'font-size:12px;color:#6b756f;margin:6px 0 0', false),
  C(PUERTA, 153, '<div id="ps-previa" aria-live="polite" style="margin-top:14px;background:#f4f7f4;border:1px solid #cdd2cb;border-radius:10px;padding:12px;display:none">', '<div id="ps-previa" aria-live="polite" class="j1-ps-previa">', '#puerta-serie .j1-ps-previa', 'margin-top:14px;background:#f4f7f4;border:1px solid #cdd2cb;border-radius:10px;padding:12px;display:none', false),
  C(PUERTA, 154, `'<p style="margin:0 0 4px;font-size:13px;color:#333c37">Tu primera`, `'<p class="j1-ps-previa-texto">Tu primera`, '#puerta-serie .j1-ps-previa-texto', 'margin:0 0 4px;font-size:13px;color:#333c37', false),
  C(PUERTA, 155, '<strong id="ps-previa-numero" style="font-size:15px;white-space:nowrap">', '<strong id="ps-previa-numero" class="j1-ps-previa-numero">', '#puerta-serie .j1-ps-previa-numero', 'font-size:15px;white-space:nowrap', false),
  C(PUERTA, 156, `'<p style="margin:0;font-size:12px;color:#6b756f">Compruébalo`, `'<p class="j1-ps-previa-aviso">Compruébalo`, '#puerta-serie .j1-ps-previa-aviso', 'margin:0;font-size:12px;color:#6b756f', false),
  C(PUERTA, 160, '<p id="ps-error" role="alert" style="display:none;font-size:13px;color:#b91c1c;margin:10px 0 0">', '<p id="ps-error" role="alert" class="j1-ps-error">', '#puerta-serie .j1-ps-error', 'display:none;font-size:13px;color:#b91c1c;margin:10px 0 0', false),
  C(PUERTA, 161, '<button type="button" id="ps-guardar" class="btn-primary" style="min-height:44px;margin-top:14px;display:none">', '<button type="button" id="ps-guardar" class="btn-primary j1-ps-guardar">', '#puerta-serie .j1-ps-guardar', 'min-height:44px;margin-top:14px;display:none', false),
];
// El `display:none` del error de anular va en su PROPIA regla, sin !important (③).
const DISPLAY_DEL_ERROR = { selector: '.modal .j1-anul-err', decl: 'display:none' };

/** El bloque J1 de la hoja, entre su cabecera y su cierre; null si no está o está dos veces. */
function bloqueJ1(hoja) {
  const ini = '/* J1: SCRUM-1756j';
  const fin = '/* J1: fin del bloque SCRUM-1756j */';
  if (hoja.split(ini).length !== 2 || hoja.split(fin).length !== 2) return null;
  const a = hoja.indexOf(ini);
  const b = hoja.indexOf(fin);
  return b > a ? hoja.slice(a, b) : null;
}
/** Las declaraciones de UNA regla con ese selector exacto (null si no hay una y solo una). */
function declaracionesDe(bloque, selector) {
  // Comentarios CSS fuera con un recorrido, no con `.replace(/…/)`: un filtro propio más lo cuenta el
  // trinquete de SCRUM-700 (el sitio único es `soloEjecutable`, y ese es de JS, no de CSS).
  let sin = '';
  for (let i = 0; i < bloque.length;) {
    if (bloque.startsWith('/*', i)) {
      const f = bloque.indexOf('*/', i + 2);
      i = f === -1 ? bloque.length : f + 2;
    } else sin += bloque[i++];
  }
  const reglas = [...sin.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === selector);
  if (reglas.length !== 1) return null;
  return reglas[0][2].split(';').map((d) => d.trim()).filter(Boolean);
}
const esperadas = (decl, imp) => decl.split(';').map((d) => (imp ? d + ' !important' : d));

test('SCRUM-1756j · control positivo sembrado: el contador ve 4 style= en cadenas y no el del comentario', () => {
  const sembrada = [
    '// <b style="x:y"> en un comentario: no cuenta',
    "const a = '<p style=\"color:red\">a</p>';",
    'const b = `<i style="x:y">${a}<u style="x:y">${a}</u><s style=\\"x:y\\"></s>`;',
  ].join('\n');
  assert.equal(styleEnCadenas('sembrada.js', sembrada).length, 4, 'el contador no ve los style= sembrados: está CIEGO');
  assert.deepEqual(styleEnCadenas('cero.js', "const c = '<p class=\"styles\">sin nada</p>';"), [], 'control cero');
  assert.equal(CAMBIOS.length, 28, 'la población es la del censo de 1756g: 28');
});

test('SCRUM-1756j · los tres ficheros de J1 llevan 0 style= dentro de sus cadenas', () => {
  for (const f of [DETALLE, LISTA, PUERTA]) {
    assert.deepEqual(styleEnCadenas(f, leer(f)), [], `${f} lleva style= dentro de una cadena: con la CSP aplicada no se pinta`);
  }
});

test('SCRUM-1756j · cada style= de main tiene su clase y su regla con las mismas declaraciones', () => {
  const bloque = bloqueJ1(leer(HOJA));
  assert.ok(bloque, `${HOJA} no tiene UN bloque «/* J1: SCRUM-1756j … */» con su cierre`);
  const fuentes = Object.fromEntries([DETALLE, LISTA, PUERTA].map((f) => [f, leer(f)]));
  for (const c of CAMBIOS) {
    assert.ok(!fuentes[c.fichero].includes(c.antes), `${c.fichero}:${c.linea} sigue con «${c.antes}»`);
    assert.equal(fuentes[c.fichero].split(c.ahora).length, 2, `${c.fichero}:${c.linea}: «${c.ahora}» tiene que estar UNA vez`);
    const decls = declaracionesDe(bloque, c.selector);
    assert.ok(decls, `el bloque J1 no tiene UNA regla «${c.selector}»`);
    // El error de anular reparte su atributo en dos reglas: el `display:none`, en la suya (③).
    const separada = c.selector === '.j1-anul-err' ? [DISPLAY_DEL_ERROR.decl] : [];
    const quedan = c.decl.split(';').filter((d) => !separada.includes(d)).join(';');
    assert.deepEqual(decls, esperadas(quedan, c.imp),
      `«${c.selector}» no lleva las declaraciones de «style="${c.decl}"» (${c.fichero}:${c.linea})`);
    if (separada.length) assert.deepEqual(declaracionesDe(bloque, DISPLAY_DEL_ERROR.selector), separada, `falta «${DISPLAY_DEL_ERROR.selector} { display:none; }»`);
  }
});

test('SCRUM-1756j · los display:none que enciende el guion siguen pudiendo encenderse', () => {
  const bloque = bloqueJ1(leer(HOJA));
  assert.ok(bloque, 'SUELO: no hay bloque J1');
  // Los que el guion enciende con `el.style.display = 'block'`: su `display:none` no puede ser !important.
  for (const sel of ['#puerta-serie .j1-ps-detalle', '#puerta-serie .j1-ps-previa', '#puerta-serie .j1-ps-error', '#puerta-serie .j1-ps-guardar', DISPLAY_DEL_ERROR.selector]) {
    const d = declaracionesDe(bloque, sel) || [];
    assert.ok(d.includes('display:none'), `«${sel}» no nace oculto`);
  }
  const puerta = leer(PUERTA);
  for (const enc of ["detalle.style.display = elegido ? 'block' : 'none';", "guardar.style.display = 'block';", "error.style.display = 'block';", "previa.style.display = 'block';"]) {
    assert.ok(puerta.includes(enc), `${PUERTA}: falta «${enc}», que es lo que enseña lo que la clase oculta`);
  }
  // El de anular se enseñaba con '' (vuelta al display de `.alert`, que es block): con la clase, '' lo deja oculto.
  const detalle = leer(DETALLE);
  assert.ok(detalle.includes("err.style.display = 'block';"), `${DETALLE}: el error de anular se enseña con 'block'`);
  assert.ok(!detalle.includes("err.style.display = '';"), `${DETALLE}: con '' el error de anular ya no se ve`);
});
