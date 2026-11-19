// tests/scrum1756i-panel-j2-sin-style-en-linea.test.mjs — SCRUM-1756i (CSP paso 3 · panel, filas J2)
//
// LAS CUATRO VISTAS J2 DEL PANEL SIN `style="…"` EN SUS CADENAS. Con `style-src 'self'` aplicada
// (`src/core/http/csp.ts`) un atributo `style` que llega por `innerHTML` NO PINTA (medido en Chrome,
// SCRUM-1756g c.22122). El censo 1756g contó 61 en `cobrosView.js`, `csvImport.js`,
// `customerDetailView.js` y `customersView.js`; son **62**: se le escapaba `csvImport.js:78`, una
// cadena que EMPIEZA por `style="…"` porque su `<textarea` va en la cadena anterior (jv-j2d4, c.22134).
// Medido el 19-nov-2026 sobre `origin/main` = `3dfeeaa99`.
//
// Receta: cada `style=` pasa a una clase del bloque `/* J2: SCRUM-1756i */` de
// `public/dashboard/css/styles.css` (la hoja que el índice ya carga) con la MISMA declaración,
// byte a byte. Los dos colores que se calculaban (KPI y eventos) pasan a modificadores de color.
//
// QUÉ MIRA:
//   ① por AST (typescript), las cadenas de los 4 ficheros —literales, plantillas y sus trozos— llevan
//     0 `style=`; los comentarios no cuentan;
//   ② cada `style=` de main (copiado abajo, con su línea) tiene en el bloque J2 una regla con esa
//     declaración EXACTA, y su clase la usa el fichero de donde salió;
//   ③ las cuatro clases que PERDÍAN contra la cascada (lo midió el navegador: `.table th`,
//     `.table td` ×2, y el `@media` de `.modal-overlay .modal`) llevan el selector que les gana;
//   ④ el índice del panel carga la hoja (`hojasDeLaPagina`, el extractor único: SCRUM-676).
// Control POSITIVO sembrado: una fuente fabricada con las tres formas de `style=` (literal, trozo de
// plantilla y cadena que EMPIEZA por él) TIENE que dar 3; si da 0, el contador está CIEGO.
//
// ⚠️ NO mide el aspecto: eso lo midió el navegador (estilos computados main ↔ rama, elemento a
// elemento), y está en el registro (`docs/master/SCRUM-1756.md`, tramo 1756i) con su guion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { hojasDeLaPagina } from './_scripts-de-la-pagina.mjs';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una devuelve una pieza del arreglo a
// como estaba, y tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve un `style=` literal: el aviso del importador recupera su atributo.
    fichero: 'public/dashboard/js/csvImport.js',
    de: `'<div class="alert csv-oculto" id="csv-alert"></div>',`,
    a: `'<div class="alert" id="csv-alert" style="display:none"></div>',`,
    cae: 'SCRUM-1756i · las cadenas de las cuatro vistas J2 llevan 0 style=',
  },
  {
    // Vuelve un `style=` dentro de una plantilla con sustituciones: el color del evento.
    fichero: 'public/dashboard/js/customerDetailView.js',
    de: "<div class=\"c360-evento-titulo ${EV_COLOR[ev.type] || 'c360-tinta'}\">",
    a: "<div style=\"font-size:13.5px;font-weight:600;color:${EV_COLOR[ev.type] || 'var(--ink)'}\">",
    cae: 'SCRUM-1756i · las cadenas de las cuatro vistas J2 llevan 0 style=',
  },
  {
    // La hoja pierde la regla de una clase: el avatar se queda sin su tamaño.
    fichero: 'public/dashboard/css/styles.css',
    de: '.c360-avatar { width:52px;',
    a: '.c360-avatar-perdida { width:52px;',
    cae: 'SCRUM-1756i · cada style= de main tiene en la hoja su declaración exacta y su clase en el fichero',
  },
  {
    // La cabecera del importe vuelve a la especificidad que PERDÍA contra `.table th`.
    fichero: 'public/dashboard/css/styles.css',
    de: '.table th.cobros-th-importe { text-align:right }',
    a: '.cobros-th-importe { text-align:right }',
    cae: 'SCRUM-1756i · las cuatro clases que perdían contra la cascada llevan el selector que les gana',
  },
];

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS = (f) => path.join(RAIZ, 'public', 'dashboard', 'js', f + '.js');
const FICHEROS = ['cobrosView', 'csvImport', 'customerDetailView', 'customersView'];
const HOJA = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'css', 'styles.css'), 'utf8');
const INICIO_BLOQUE = '/* J2: SCRUM-1756i';
const FIN_BLOQUE = '/* ── J3 · SCRUM-1577b';
const BLOQUE = HOJA.includes(INICIO_BLOQUE) && HOJA.includes(FIN_BLOQUE)
  ? HOJA.slice(HOJA.indexOf(INICIO_BLOQUE), HOJA.indexOf(FIN_BLOQUE)) : '';

/** Los `style=` que hay DENTRO de cadenas (literal, plantilla o trozo de plantilla), por AST. */
function styleEnCadenas(fuente, nombre = 'x.js') {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hallados = [];
  const CADENA = new Set([ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail]);
  const visitar = (n) => {
    if (CADENA.has(n.kind)) {
      for (const m of n.text.matchAll(/(?:^|[^\w-])style\s*=/g)) {
        hallados.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 + ':' + m.index);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return hallados;
}

// Los 62 `style=` de las cuatro vistas en `origin/main` = 3dfeeaa99, COPIADOS con su línea:
// [fichero, línea en main, valor del atributo]. Es la referencia del byte a byte.
const DE_MAIN = [
  ["cobrosView", 487, "text-align:right"],
  ["csvImport", 30, "max-width:600px"],
  ["csvImport", 32, "display:none"],
  ["csvImport", 66, "font-size:13px;color:var(--neutral-500);margin:0 0 12px"],
  ["csvImport", 70, "border:2px dashed var(--neutral-300);border-radius:10px;padding:18px;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:8px"],
  ["csvImport", 71, "font-size:13px;color:var(--neutral-500)"],
  ["csvImport", 72, "color:var(--green-600);font-weight:600;text-decoration:underline"],
  ["csvImport", 74, "display:none"],
  ["csvImport", 76, "text-align:center;font-size:12px;color:var(--neutral-400);margin:4px 0"],
  ["csvImport", 78, "width:100%;padding:8px 10px;border:1.5px solid var(--neutral-200);border-radius:8px;font-size:12px;font-family:monospace;resize:vertical"],
  ["csvImport", 79, "width:100%;margin-top:8px"],
  ["csvImport", 145, "margin:0 0 6px;font-size:16px;color:var(--neutral-900)"],
  ["csvImport", 146, "font-size:13px;color:var(--neutral-500);margin:0 0 12px"],
  ["csvImport", 147, "padding:12px 14px;border:1px solid var(--neutral-200);border-radius:12px;background:var(--neutral-50);font-family:monospace;font-size:13px;color:var(--neutral-900);overflow-wrap:break-word"],
  ["csvImport", 148, "display:flex;gap:8px;margin-top:14px"],
  ["csvImport", 149, "flex:1"],
  ["csvImport", 150, "flex:1"],
  ["csvImport", 182, "padding:8px 0;border-bottom:1px solid var(--neutral-100)"],
  ["csvImport", 183, "display:flex;align-items:center;gap:10px"],
  ["csvImport", 184, "font-family:monospace;font-size:12px;color:var(--neutral-900);min-width:0;flex:1;overflow-wrap:break-word"],
  ["csvImport", 185, "color:var(--neutral-400)"],
  ["csvImport", 186, "flex:1;min-height:44px;padding:11px 13px;border:1px solid var(--neutral-200);border-radius:12px;font-size:13px"],
  ["csvImport", 191, "font-size:12px;color:var(--neutral-500);margin:6px 0 0"],
  ["csvImport", 199, "margin:0 0 12px;font-size:16px;color:var(--neutral-900)"],
  ["csvImport", 201, "width:100%;margin-top:14px"],
  ["csvImport", 240, "font-size:14px;color:var(--neutral-900);margin:0 0 4px"],
  ["csvImport", 244, "width:100%;margin-top:14px"],
  ["csvImport", 251, "padding:6px 0;border-bottom:1px solid var(--neutral-100);font-size:13px;color:var(--neutral-700)"],
  ["csvImport", 257, "margin:14px 0 6px;font-size:16px;color:var(--neutral-900)"],
  ["csvImport", 258, "font-size:13px;color:var(--neutral-500);margin:0 0 10px"],
  ["csvImport", 259, "max-height:220px;overflow-y:auto;border:1px solid var(--neutral-200);border-radius:12px;padding:0 12px"],
  ["csvImport", 260, "width:100%;margin-top:12px"],
  ["csvImport", 261, "width:100%;margin-top:8px"],
  ["customerDetailView", 379, "color:var(--neutral-400);padding:24px"],
  ["customerDetailView", 454, "display:flex;align-items:center;gap:14px;flex:1;min-width:0"],
  ["customerDetailView", 455, "width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--green-500),#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:var(--green-900);flex-shrink:0"],
  ["customerDetailView", 457, "margin:0 0 4px;font-size:18px;font-weight:800;color:var(--neutral-900)"],
  ["customerDetailView", 458, "font-size:13px;color:var(--neutral-500);display:flex;gap:12px;flex-wrap:wrap"],
  ["customerDetailView", 463, "color:var(--neutral-400)"],
  ["customerDetailView", 465, "font-size:12.5px;color:var(--neutral-500);margin-top:6px;font-style:italic"],
  ["customerDetailView", 469, "display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0"],
  ["customerDetailView", 623, "font-size:18px${color ? ';color:' + color : ''}"],
  ["customerDetailView", 645, "margin:0 0 14px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em"],
  ["customerDetailView", 665, "flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--neutral-50);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px"],
  ["customerDetailView", 666, "flex:1;min-width:0"],
  ["customerDetailView", 667, "font-size:13.5px;font-weight:600;color:${EV_COLOR[ev.type] || 'var(--ink)'}"],
  ["customerDetailView", 668, "font-size:12.5px;color:var(--muted);margin-top:1px"],
  ["customerDetailView", 670, "flex-shrink:0;font-size:11.5px;color:var(--muted);white-space:nowrap"],
  ["customerDetailView", 758, "text-align:center;color:var(--neutral-400);padding:24px"],
  ["customerDetailView", 763, "font-weight:600"],
  ["customerDetailView", 764, "color:var(--muted)"],
  ["customerDetailView", 786, "text-align:center;color:var(--neutral-400);padding:24px"],
  ["customerDetailView", 791, "text-decoration:none"],
  ["customerDetailView", 794, "font-weight:600"],
  ["customerDetailView", 795, "color:var(--muted)"],
  ["customerDetailView", 799, "display:flex;gap:6px;align-items:center"],
  ["customerDetailView", 1472, "flex-direction:column;gap:10px"],
  ["customerDetailView", 1496, "font-size:12px;color:var(--muted);margin-top:4px"],
  ["customerDetailView", 1505, "resize:vertical"],
  ["customerDetailView", 1506, "display:flex;align-items:center;gap:8px;font-size:13px;color:var(--neutral-600)"],
  ["customerDetailView", 1509, "display:none"],
  ["customersView", 757, "margin-top:14px"],
];
// Los dos que se calculaban: su parte fija es una clase y el color, un modificador.
const CALCULADOS = {
  "font-size:18px${color ? ';color:' + color : ''}": { base: 'font-size:18px', clase: 'c360-kpi-valor' },
  "font-size:13.5px;font-weight:600;color:${EV_COLOR[ev.type] || 'var(--ink)'}": { base: 'font-size:13.5px;font-weight:600', clase: 'c360-evento-titulo' },
};
const MODIFICADORES = [
  ['.c360-verde', 'color:var(--green-600)'], ['.c360-rojo', 'color:var(--red-600)'], ['.c360-tinta', 'color:var(--ink)'],
];

// El bloque J2 de la hoja, regla a regla: [fichero que usa la clase, selector, declaración].
const REGLAS = [
  ["cobrosView", ".table th.cobros-th-importe", "text-align:right"],
  ["customersView", ".clientes-vacio-cta", "margin-top:14px"],
  ["csvImport", ".modal-overlay .modal.csv-modal", "max-width:600px"],
  ["csvImport", ".csv-oculto", "display:none"],
  ["csvImport", ".csv-guia", "font-size:13px;color:var(--neutral-500);margin:0 0 12px"],
  ["csvImport", ".csv-dropzone", "border:2px dashed var(--neutral-300);border-radius:10px;padding:18px;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:8px"],
  ["csvImport", ".csv-dropzone-texto", "font-size:13px;color:var(--neutral-500)"],
  ["csvImport", ".csv-dropzone-enlace", "color:var(--green-600);font-weight:600;text-decoration:underline"],
  ["csvImport", ".csv-separador", "text-align:center;font-size:12px;color:var(--neutral-400);margin:4px 0"],
  ["csvImport", ".csv-pegar", "width:100%;padding:8px 10px;border:1.5px solid var(--neutral-200);border-radius:8px;font-size:12px;font-family:monospace;resize:vertical"],
  ["csvImport", ".csv-boton-8", "width:100%;margin-top:8px"],
  ["csvImport", ".csv-boton-12", "width:100%;margin-top:12px"],
  ["csvImport", ".csv-boton-14", "width:100%;margin-top:14px"],
  ["csvImport", ".csv-titulo-6", "margin:0 0 6px;font-size:16px;color:var(--neutral-900)"],
  ["csvImport", ".csv-titulo-12", "margin:0 0 12px;font-size:16px;color:var(--neutral-900)"],
  ["csvImport", ".csv-titulo-rechazos", "margin:14px 0 6px;font-size:16px;color:var(--neutral-900)"],
  ["csvImport", ".csv-muestra", "padding:12px 14px;border:1px solid var(--neutral-200);border-radius:12px;background:var(--neutral-50);font-family:monospace;font-size:13px;color:var(--neutral-900);overflow-wrap:break-word"],
  ["csvImport", ".csv-botonera", "display:flex;gap:8px;margin-top:14px"],
  ["csvImport", ".csv-flex1", "flex:1"],
  ["csvImport", ".csv-columna", "padding:8px 0;border-bottom:1px solid var(--neutral-100)"],
  ["csvImport", ".csv-columna-fila", "display:flex;align-items:center;gap:10px"],
  ["csvImport", ".csv-columna-nombre", "font-family:monospace;font-size:12px;color:var(--neutral-900);min-width:0;flex:1;overflow-wrap:break-word"],
  ["csvImport", ".csv-flecha", "color:var(--neutral-400)"],
  ["csvImport", ".csv-campo-select", "flex:1;min-height:44px;padding:11px 13px;border:1px solid var(--neutral-200);border-radius:12px;font-size:13px"],
  ["csvImport", ".csv-columna-aviso", "font-size:12px;color:var(--neutral-500);margin:6px 0 0"],
  ["csvImport", ".csv-resumen", "font-size:14px;color:var(--neutral-900);margin:0 0 4px"],
  ["csvImport", ".csv-rechazo", "padding:6px 0;border-bottom:1px solid var(--neutral-100);font-size:13px;color:var(--neutral-700)"],
  ["csvImport", ".csv-guia-10", "font-size:13px;color:var(--neutral-500);margin:0 0 10px"],
  ["csvImport", ".csv-rechazos-lista", "max-height:220px;overflow-y:auto;border:1px solid var(--neutral-200);border-radius:12px;padding:0 12px"],
  ["customerDetailView", ".c360-vacio", "color:var(--neutral-400);padding:24px"],
  ["customerDetailView", ".c360-identidad", "display:flex;align-items:center;gap:14px;flex:1;min-width:0"],
  ["customerDetailView", ".c360-avatar", "width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--green-500),#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:var(--green-900);flex-shrink:0"],
  ["customerDetailView", ".c360-nombre", "margin:0 0 4px;font-size:18px;font-weight:800;color:var(--neutral-900)"],
  ["customerDetailView", ".c360-datos", "font-size:13px;color:var(--neutral-500);display:flex;gap:12px;flex-wrap:wrap"],
  ["customerDetailView", ".c360-desde", "color:var(--neutral-400)"],
  ["customerDetailView", ".c360-notas", "font-size:12.5px;color:var(--neutral-500);margin-top:6px;font-style:italic"],
  ["customerDetailView", ".c360-cabecera-acciones", "display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0"],
  ["customerDetailView", ".c360-kpi-valor", "font-size:18px"],
  ["customerDetailView", ".c360-verde", "color:var(--green-600)"],
  ["customerDetailView", ".c360-rojo", "color:var(--red-600)"],
  ["customerDetailView", ".c360-tinta", "color:var(--ink)"],
  ["customerDetailView", ".c360-actividad-titulo", "margin:0 0 14px;font-size:13px;font-weight:700;color:var(--neutral-600);text-transform:uppercase;letter-spacing:.04em"],
  ["customerDetailView", ".c360-evento-icono", "flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--neutral-50);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px"],
  ["customerDetailView", ".c360-evento-cuerpo", "flex:1;min-width:0"],
  ["customerDetailView", ".c360-evento-titulo", "font-size:13.5px;font-weight:600"],
  ["customerDetailView", ".c360-evento-detalle", "font-size:12.5px;color:var(--muted);margin-top:1px"],
  ["customerDetailView", ".c360-evento-hora", "flex-shrink:0;font-size:11.5px;color:var(--muted);white-space:nowrap"],
  ["customerDetailView", ".table td.c360-tabla-vacia", "text-align:center;color:var(--neutral-400);padding:24px"],
  ["customerDetailView", ".c360-celda-numero", "font-weight:600"],
  ["customerDetailView", ".table td.c360-celda-fecha", "color:var(--muted)"],
  ["customerDetailView", ".c360-sin-subrayado", "text-decoration:none"],
  ["customerDetailView", ".c360-celda-acciones", "display:flex;gap:6px;align-items:center"],
  ["customerDetailView", ".c360-editar-cuerpo", "flex-direction:column;gap:10px"],
  ["customerDetailView", ".c360-ayuda", "font-size:12px;color:var(--muted);margin-top:4px"],
  ["customerDetailView", ".c360-redimensionable", "resize:vertical"],
  ["customerDetailView", ".c360-casilla", "display:flex;align-items:center;gap:8px;font-size:13px;color:var(--neutral-600)"],
  ["customerDetailView", ".c360-oculto", "display:none"],
];
// Las cuatro que el navegador vio PERDER con el selector a secas, y la regla a la que ganaba el atributo.
const ESPECIFICIDAD = [
  ['.table th.cobros-th-importe', '.table th {'],
  ['.table td.c360-celda-fecha', '.table td {'],
  ['.table td.c360-tabla-vacia', '.table td {'],
  ['.modal-overlay .modal.csv-modal', '.modal-overlay .modal,'],
];
const claseDe = (selector) => selector.slice(selector.lastIndexOf('.') + 1);
const reglaEnHoja = (selector, decl) => BLOQUE.includes(`\n${selector} { ${decl} }\n`);

test('SCRUM-1756i · control positivo sembrado: el contador ve las tres formas de style=', () => {
  const sembrado = [
    "const a = '<p style=\"color:red\">x</p>';",
    'const b = `<div class="k" style="width:${w}px">`;',
    "const c = ['<textarea id=\"t\"', 'style=\"resize:vertical\"></textarea>'];",
    '// un style="x" en un comentario no cuenta',
    "el.style.display = 'none'; const d = 'font-style=no';",
  ].join('\n');
  assert.equal(styleEnCadenas(sembrado).length, 3, 'el contador por AST no ve los style= sembrados: está CIEGO');
  assert.equal(DE_MAIN.length, 62, 'la referencia de main son 62 style= (61 del censo 1756g + csvImport.js:78)');
  assert.ok(BLOQUE.length > 1000, 'SUELO: no encuentro el bloque J2 de la hoja');
});

test('SCRUM-1756i · las cadenas de las cuatro vistas J2 llevan 0 style=', () => {
  const porFichero = {};
  for (const f of FICHEROS) porFichero[f] = styleEnCadenas(fs.readFileSync(JS(f), 'utf8'), f + '.js');
  const cuentas = Object.fromEntries(FICHEROS.map((f) => [f, porFichero[f].length]));
  const total = Object.values(cuentas).reduce((a, b) => a + b, 0);
  assert.deepEqual({ total, ...cuentas }, { total: 0, cobrosView: 0, csvImport: 0, customerDetailView: 0, customersView: 0 },
    `style= en cadenas (línea:posición): ${JSON.stringify(porFichero)}`);
});

test('SCRUM-1756i · cada style= de main tiene en la hoja su declaración exacta y su clase en el fichero', () => {
  const falta = [];
  for (const [fichero, linea, valor] of DE_MAIN) {
    const calc = CALCULADOS[valor];
    const decl = calc ? calc.base : valor;
    const reglas = REGLAS.filter((r) => r[0] === fichero && r[2] === decl && (!calc || claseDe(r[1]) === calc.clase));
    if (reglas.length === 0) { falta.push(`${fichero}:${linea} «${valor}» sin regla en la tabla`); continue; }
    const fuente = fs.readFileSync(JS(fichero), 'utf8');
    if (!reglas.some((r) => reglaEnHoja(r[1], r[2]) && fuente.includes(claseDe(r[1])))) {
      falta.push(`${fichero}:${linea} «${decl}»: la hoja no lleva su regla o el fichero no usa la clase`);
    }
  }
  for (const [sel, decl] of MODIFICADORES) if (!reglaEnHoja(sel, decl)) falta.push(`modificador ${sel} { ${decl} }`);
  for (const r of REGLAS) if (!reglaEnHoja(r[1], r[2])) falta.push(`regla ${r[1]} { ${r[2]} } no está en el bloque`);
  assert.deepEqual(falta, []);
});

test('SCRUM-1756i · las cuatro clases que perdían contra la cascada llevan el selector que les gana', () => {
  for (const [selector, rival] of ESPECIFICIDAD) {
    assert.ok(HOJA.includes(rival), `SUELO: la hoja ya no lleva la regla rival «${rival}»`);
    assert.ok(BLOQUE.includes(`\n${selector} {`), `«${selector}» no está en el bloque J2: a secas pierde contra «${rival}»`);
  }
});

test('SCRUM-1756i · el índice del panel carga la hoja que lleva las clases', () => {
  const indice = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'index.html'), 'utf8');
  const hojas = hojasDeLaPagina(indice);
  assert.deepEqual(hojas.ilegibles, [], 'el extractor no sabe leer un <link> del índice');
  assert.ok(hojas.locales.includes('./css/styles.css'), `el índice no carga ./css/styles.css: ${JSON.stringify(hojas.locales)}`);
});
