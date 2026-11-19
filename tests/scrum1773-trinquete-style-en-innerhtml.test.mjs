// tests/scrum1773-trinquete-style-en-innerhtml.test.mjs — SCRUM-1773 (A23 · sale del censo SCRUM-1756g)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// GUARD TRINQUETE · `style="` y `on*=` DENTRO DE CADENAS en `public/dashboard/js/**`.
//
// Por qué: con la política `style-src 'self'; script-src 'self'` del paso 3 de la CSP, un
// `style="…"` o un `onclick="…"` que el panel mete por `innerHTML` NO PINTA y NO CORRE (medido en
// Chrome, SCRUM-1756 c.22122). El censo 1756g (main e37a7051f, 18-nov-2026) dio 880 + 6 en 36 ficheros que la tabla original
// no listaba. Este guard no arregla ninguno: CONGELA el número de cada fichero para que solo baje.
//
// Cómo cuenta (A23 casillas 2, 3 y 5): por AST de typescript, igual que `1756g-censo.mjs.txt`
// (`rangosTs`): solo cuenta un acierto si EMPIEZA dentro de un literal de cadena o de plantilla.
// Un `style=` en un comentario, en una expresión regular o en código (`el.style = 'x'`) no cuenta.
// La diferencia con el censo: el censo exigía un blanco delante (`\sstyle=`) y no veía la cadena
// concatenada que ABRE con el atributo (`'style="width:100%">'`, el caso de SCRUM-1756 c.22142).
// Aquí delante vale un blanco o una COMILLA (la que abre la cadena, o la que cierra el atributo de
// antes): así `data-style=` no cuenta, ni un `«style="…"»` citado en un comentario HTML de una
// plantilla (`exportView.js`, el único que la primera versión de este guard contaba de más).
//
// Las dos mitades del trinquete (A23 casilla 7):
//   · SUBE o NUEVO → rojo: un fichero con más que su número, o uno que no está en la tabla con n > 0.
//   · BAJA → rojo también, hasta que se RECONGELA: se baja el número en la tabla y se añade una línea
//     fechada en `HISTORIAL` con el total nuevo. Una bajada que nadie anotó es un instrumento roto
//     hasta que se demuestre lo contrario (SCRUM-814).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');
export const DIR = 'public/dashboard/js';

// ── lo que cuenta ──────────────────────────────────────────────────────────────────────────────
const RX_STYLE = /(?<=[\s'"`])style\s*=\s*\\?["']/gi;
const RX_ON = /(?<=[\s'"`])on[a-z]{3,}\s*=\s*\\?["']/gi;
const NODOS_CADENA = ['StringLiteral', 'NoSubstitutionTemplateLiteral', 'TemplateHead', 'TemplateMiddle', 'TemplateTail'];
export const SUBE = (hoy, antes) => hoy > antes;
export const CUENTA_COMO_NUEVO = (hoy) => hoy.style + hoy.on > 0;

/** Rangos [inicio, fin) de los literales de cadena/plantilla del fichero, por AST. */
function rangosDeCadena(ruta, txt) {
  const sf = ts.createSourceFile(ruta, txt, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tipos = new Set(NODOS_CADENA.map((k) => ts.SyntaxKind[k]));
  const r = [];
  (function v(n) {
    if (tipos.has(n.kind)) r.push([n.getStart(sf), n.end]);
    ts.forEachChild(n, v);
  })(sf);
  return r;
}

/** { style: [líneas], on: [líneas] } de un fichero: una entrada por acierto dentro de una cadena. */
export function medirTexto(ruta, txt) {
  const r = rangosDeCadena(ruta, txt);
  const dentro = (i) => r.some(([a, b]) => i >= a && i < b);
  const linea = (i) => txt.slice(0, i).split('\n').length;
  const out = { style: [], on: [] };
  for (const [k, rx] of [['style', RX_STYLE], ['on', RX_ON]]) {
    for (const m of txt.matchAll(rx)) if (dentro(m.index)) out[k].push(linea(m.index));
  }
  return out;
}

/** Recorre `<raiz>/public/dashboard/js/**` (todo `.js`). Devuelve la población y cada fichero. */
export function medirArbol(raiz = RAIZ) {
  const base = path.join(raiz, DIR);
  const ficheros = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.name.endsWith('.js')) ficheros.push(p);
    }
  })(base);
  const porFichero = {};
  for (const abs of ficheros.sort()) {
    const rel = path.relative(raiz, abs).split(path.sep).join('/');
    porFichero[rel] = medirTexto(rel, fs.readFileSync(abs, 'utf8'));
  }
  return { poblacion: ficheros.length, porFichero };
}

/** Compara la medida con lo congelado. `congelada` = { style: {f: n}, on: {f: n} }. */
export function comparar(congelada, porFichero) {
  const suben = [], nuevos = [], bajan = [];
  const ficheros = new Set([...Object.keys(porFichero), ...Object.keys(congelada.style), ...Object.keys(congelada.on)]);
  for (const f of [...ficheros].sort()) {
    const lin = porFichero[f] || { style: [], on: [] };
    const hoy = { style: lin.style.length, on: lin.on.length };
    const conocido = Object.hasOwn(congelada.style, f) || Object.hasOwn(congelada.on, f);
    if (!conocido) {
      if (CUENTA_COMO_NUEVO(hoy)) nuevos.push({ f, hoy, lin });
      continue;
    }
    for (const k of ['style', 'on']) {
      const antes = congelada[k][f] ?? 0;
      if (SUBE(hoy[k], antes)) suben.push({ f, k, antes, hoy: hoy[k], lineas: lin[k] });
      else if (hoy[k] < antes) bajan.push({ f, k, antes, hoy: hoy[k] });
    }
  }
  return { suben, nuevos, bajan };
}

const RECETA = 'RECETA (SCRUM-1756 c.22127): la regla va como CLASE en el bloque de tu puesto al final de '
  + '`public/dashboard/css/styles.css` (regla de los contenedores, `docs/equipo/dos-equipos.md`) y la cadena '
  + 'lleva `class="…"`; un valor calculado se pone por CSSOM (`el.style.x = …`) después de pintar, y un '
  + '`on*=` pasa a `addEventListener`. Ni hoja nueva ni `style=` en línea.';

// ── lo congelado ───────────────────────────────────────────────────────────────────────────────
// Una línea por fichero y UN número por línea (scrum710b). Un fichero que no está aquí vale 0.
export const CONGELADA_STYLE = {
  'public/dashboard/js/aiQuoteAssistant.js': 19,
  'public/dashboard/js/albaranDetailView.js': 1,
  'public/dashboard/js/api.js': 10,
  'public/dashboard/js/app.js': 2,
  'public/dashboard/js/estadoFirma.js': 1,
  'public/dashboard/js/expensesView.js': 27,
  'public/dashboard/js/exportView.js': 32,
  'public/dashboard/js/facturasRecibidasView.js': 4,
  'public/dashboard/js/globalSearch.js': 20,
  'public/dashboard/js/homeView.js': 108,
  'public/dashboard/js/jobDetailView.js': 18,
  'public/dashboard/js/jobNuevoModal.js': 7,
  'public/dashboard/js/parteDetailView.js': 19,
  'public/dashboard/js/parteOficinaView.js': 11,
  'public/dashboard/js/productsView.js': 21,
  'public/dashboard/js/providersView.js': 10,
  'public/dashboard/js/quoteRequestsView.js': 16,
  'public/dashboard/js/quoteRevisiones.js': 10,
  'public/dashboard/js/quotesDetailView.js': 38,
  'public/dashboard/js/quotesListView.js': 3,
  'public/dashboard/js/quotesView.js': 13,
  'public/dashboard/js/reportsView.js': 161,
  'public/dashboard/js/signaturePad.js': 5,
  'public/dashboard/js/templatesView.js': 9,
};
export const CONGELADA_ON = {
  'public/dashboard/js/expensesView.js': 1,
  'public/dashboard/js/globalSearch.js': 2,
  'public/dashboard/js/homeView.js': 1,
  'public/dashboard/js/quotesDetailView.js': 1,
  'public/dashboard/js/templatesView.js': 1,
};

// Cada recongelación añade una línea fechada con el total que deja la tabla. El guard exige que la
// tabla sume exactamente lo que dice la ÚLTIMA línea: bajar un número sin fecharlo da rojo.
export const HISTORIAL = [
  // Congelación inicial (main 6cabd3d42, 19-nov-2026): 24 ficheros de 98. Frente al censo 1756g (880 + 6 en 36): 1756h (J3),
  // 1756i (J2) y 1756j (J1) ya bajaron a 0 sus doce ficheros (−228, −61 y −28), y `quoteRequestsView.js` lleva
  // 2 más (+2), dos cadenas concatenadas que abren con `'style="` y la regex del censo no veía.
  { fecha: '2026-11-19', ticket: 'SCRUM-1773', sha: '6cabd3d42c1e0c7ba531a91ab94471c17c288949', style: 565, on: 6 },
];

const CONGELADA = { style: CONGELADA_STYLE, on: CONGELADA_ON };
const suma = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const MEDIDA = medirArbol();

// ── siembra (fuera del árbol: el árbol no se mueve, A23 y PUERTA 0 del meta-guard) ────────────────
const SIEMBRA = [
  '// un style="x" y un onclick="y" en comentario: no cuentan',
  'const a = \'<td \' + \'style="width:100%">\' + x;      // la forma concatenada (c.22142): cuenta',
  'const b = `<b style="color:red" onclick="go()">${a}</b>`; // plantilla: style 1, on 1',
  'const c = \'<i data-style="z">\';                       // data-style no es style',
  'el.style = \'display:none\';                            // código, no cadena',
  'const d = /style="/;                                   // expresión regular, no cadena',
  'const e = `<!-- sin «style="x"» -->`;                  // citado tras «, no es un atributo',
  '',
].join('\n');
const CERO = SIEMBRA.split('\n').filter((l) => !/cuenta$|on 1$/.test(l)).join('\n');

function arbolSembrado(contenidos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1773-'));
  fs.mkdirSync(path.join(raiz, DIR), { recursive: true });
  for (const [n, t] of Object.entries(contenidos)) fs.writeFileSync(path.join(raiz, DIR, n), t);
  try { return medirArbol(raiz); } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
test('SCRUM-1773 · SUELO: la población no es cero y hay algo que contar (si no, CIEGO, no verde)', () => {
  assert.ok(MEDIDA.poblacion > 0, `🔴 CIEGO: he leído 0 ficheros .js en ${DIR}. No es «limpio»: es no haber mirado.`);
  const total = Object.values(MEDIDA.porFichero).reduce((a, x) => a + x.style.length + x.on.length, 0);
  assert.ok(total > 0 || suma(CONGELADA_STYLE) + suma(CONGELADA_ON) === 0,
    `🔴 CIEGO: ${MEDIDA.poblacion} ficheros y 0 aciertos con la tabla en ${suma(CONGELADA_STYLE)}: el contador se ha descarriado.`);
});

test('SCRUM-1773 · CONTROL POSITIVO sembrado: la forma concatenada, la plantilla y el on*= se cuentan', () => {
  const m = arbolSembrado({ 'siembra.js': SIEMBRA });
  const s = m.porFichero[`${DIR}/siembra.js`];
  assert.equal(m.poblacion, 1, '🔴 el árbol sembrado no tiene su fichero: el control no ha mirado nada.');
  assert.deepEqual({ style: s.style.length, on: s.on.length }, { style: 2, on: 1 },
    `🔴 CIEGO: la siembra lleva 2 style= y 1 on*= dentro de cadenas y salen ${JSON.stringify(s)}.`);
  assert.deepEqual(s.style, [2, 3], '🔴 las líneas de la siembra no son las de la forma concatenada y la plantilla.');
});

test('SCRUM-1773 · CONTROL CERO: comentario, código, regex y data-style= no cuentan', () => {
  const m = arbolSembrado({ 'cero.js': CERO });
  const s = m.porFichero[`${DIR}/cero.js`];
  assert.ok(CERO.includes('data-style') && CERO.includes('el.style') && CERO.includes('/style="/') && CERO.includes('«style='),
    '🔴 el control cero ha perdido sus casos: un cero sobre nada no es un control.');
  assert.deepEqual(s, { style: [], on: [] }, `🔴 cuenta lo que no es una cadena: ${JSON.stringify(s)}.`);
});

test('SCRUM-1773 · un fichero NUEVO con style= en una cadena cae (sembrado)', () => {
  const sembrado = { ...MEDIDA.porFichero, [`${DIR}/siembra.js`]: medirTexto('siembra.js', SIEMBRA) };
  const { nuevos } = comparar(CONGELADA, sembrado);
  assert.deepEqual(nuevos.map((x) => x.f), [`${DIR}/siembra.js`],
    '🔴 un fichero que no está en la tabla y trae style= en una cadena NO sale como nuevo.');
});

test('SCRUM-1773 · un fichero congelado que SUBE una unidad cae (sembrado)', () => {
  const f = Object.keys(CONGELADA_STYLE)[0];
  assert.ok(f, '🔴 CIEGO: la tabla está vacía y no hay fichero sobre el que sembrar la subida.');
  const lin = MEDIDA.porFichero[f];
  const sembrado = { ...MEDIDA.porFichero, [f]: { style: [...lin.style, 9999], on: lin.on } };
  const { suben } = comparar(CONGELADA, sembrado);
  assert.deepEqual(suben.map((x) => `${x.f}:${x.k}`), [`${f}:style`], '🔴 una subida de una unidad no cae.');
});

test('SCRUM-1773 · 🔴 EL TRINQUETE sobre el árbol: ningún fichero SUBE y no entra ninguno NUEVO', () => {
  const { suben, nuevos } = comparar(CONGELADA, MEDIDA.porFichero);
  const msg = [];
  const donde = (f, ls) => ls.map((l) => `${f}:${l}`).join(', ') || '—';
  for (const x of suben) msg.push(`  · ${x.f} · ${x.k}: congelado ${x.antes}, hoy ${x.hoy} · todas las de hoy: ${donde(x.f, x.lineas)}`);
  for (const x of nuevos) msg.push(`  · ${x.f} · NUEVO · style= en ${donde(x.f, x.lin.style)} · on*= en ${donde(x.f, x.lin.on)}`);
  assert.equal(msg.length, 0,
    `🔴 HA ENTRADO style=/on*= en cadenas de ${DIR} (población ${MEDIDA.poblacion} ficheros). Con la CSP del paso 3 `
    + `no pinta ni corre:\n${msg.join('\n')}\n${RECETA}`);
});

test('SCRUM-1773 · 🔴 EL TRINQUETE no baja en silencio: una bajada se RECONGELA con línea fechada', () => {
  const { bajan } = comparar(CONGELADA, MEDIDA.porFichero);
  assert.equal(bajan.length, 0,
    `🔴 ha BAJADO (buena noticia) y hay que ANOTARLO:\n${bajan.map((x) => `  · ${x.f} · ${x.k}: ${x.antes} → ${x.hoy}`).join('\n')}\n`
    + 'Baja el número en CONGELADA_STYLE/CONGELADA_ON (o quita la fila si llega a 0) y añade a HISTORIAL una línea '
    + 'con la fecha, el ticket, el sha de origin/main medido y el total nuevo. Si nadie ha quitado nada, el contador '
    + 'se ha descarriado: eso no se recongela, se arregla.');
});

test('SCRUM-1773 · la tabla suma lo que dice la última línea fechada de HISTORIAL', () => {
  const ult = HISTORIAL.at(-1);
  assert.ok(ult && /^\d{4}-\d{2}-\d{2}$/.test(ult.fecha) && /^SCRUM-\d+/.test(ult.ticket) && /^[0-9a-f]{40}$/.test(ult.sha),
    '🔴 HISTORIAL sin una última línea con fecha AAAA-MM-DD, ticket y sha de 40.');
  assert.deepEqual({ style: suma(CONGELADA_STYLE), on: suma(CONGELADA_ON) }, { style: ult.style, on: ult.on },
    '🔴 la tabla no suma lo que dice la última línea de HISTORIAL: se ha cambiado un número sin fecharlo.');
  for (const t of [CONGELADA_STYLE, CONGELADA_ON]) for (const [f, n] of Object.entries(t)) {
    assert.ok(Number.isInteger(n) && n > 0, `🔴 ${f}: ${n} — una fila a 0 se quita, no se deja.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS MUTACIONES QUE ME TUMBAN (SCRUM-745 · SCRUM-1387). Cada una afloja el instrumento por un lado.
// ═════════════════════════════════════════════════════════════════════════════════════════════
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① vuelve el punto ciego del censo 1756g: exigir un blanco delante del atributo.
    fichero: 'tests/scrum1773-trinquete-style-en-innerhtml.test.mjs',
    de: 'const RX_STYLE = /(?<=[\\s\'"`])style\\s*=\\s*\\\\?["\']/gi;',
    a: 'const RX_STYLE = /\\sstyle\\s*=\\s*\\\\?["\']/gi;',
    cae: 'SCRUM-1773 · CONTROL POSITIVO sembrado: la forma concatenada, la plantilla y el on*= se cuentan',
  },
  {
    // ② deja de mirar las plantillas: solo cuentan las cadenas de comillas.
    fichero: 'tests/scrum1773-trinquete-style-en-innerhtml.test.mjs',
    de: "const NODOS_CADENA = ['StringLiteral', 'NoSubstitutionTemplateLiteral', 'TemplateHead', 'TemplateMiddle', 'TemplateTail'];",
    a: "const NODOS_CADENA = ['StringLiteral'];",
    cae: 'SCRUM-1773 · 🔴 EL TRINQUETE no baja en silencio: una bajada se RECONGELA con línea fechada',
  },
  {
    // ③ un fichero nuevo deja de contar: el panel podría crecer por ficheros sin tabla.
    fichero: 'tests/scrum1773-trinquete-style-en-innerhtml.test.mjs',
    de: 'export const CUENTA_COMO_NUEVO = (hoy) => hoy.style + hoy.on > 0;',
    a: 'export const CUENTA_COMO_NUEVO = (hoy) => false;',
    cae: 'SCRUM-1773 · un fichero NUEVO con style= en una cadena cae (sembrado)',
  },
  {
    // ④ el trinquete se afloja una unidad por fichero.
    fichero: 'tests/scrum1773-trinquete-style-en-innerhtml.test.mjs',
    de: 'export const SUBE = (hoy, antes) => hoy > antes;',
    a: 'export const SUBE = (hoy, antes) => hoy > antes + 1;',
    cae: 'SCRUM-1773 · un fichero congelado que SUBE una unidad cae (sembrado)',
  },
];
