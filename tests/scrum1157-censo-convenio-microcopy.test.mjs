// tests/scrum1157-censo-convenio-microcopy.test.mjs — SCRUM-1157
//
// LA RED DE `scripts/_censo-convenio-microcopy.mjs`: que un texto del panel sin firma legible en
// su fuente salga ACUSADO aunque nadie le haya puesto el marcador en pantalla, y que lo que la
// sonda no sabe leer salga CIEGO — nunca «0 hallazgos» (la familia del 26-sep: «no pude mirar» y
// «no hay nada» daban el mismo resultado).
//
// Cuatro partes:
//   ① el árbol real contra `_censo-convenio-microcopy-declarados.json` (trinquete de dos mitades);
//   ② control POSITIVO con el caso real (`QR_COPY`, texto literal) y NEGATIVO DERIVADO de él;
//   ③ se prueba FALLANDO: un literal sin firmar inyectado en el árbol real → rojo con qué hacer;
//   ④ fail-closed: sintaxis rota, comentario ambiguo, `...spread`, resolución caducada → CIEGO, y
//      la CLI sale ≠ 0 SIN imprimir nada parcial por stdout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RAIZ, CARPETA, DECLARADOS_JSON, censar, censarFuente, compararConDeclarados, leerDeclarados,
  claseDeComentario, cuantosDice,
} from '../scripts/_censo-convenio-microcopy.mjs';

const CLI = path.join(RAIZ, 'scripts', '_censo-convenio-microcopy.mjs');

// El caso del ticket, LITERAL como estaba en `settingsView.js` el 28-sep-2026 (origin/main
// dedc9292). Se copia aquí a propósito: el día que J3 firme el QR el árbol cambia, y el control
// positivo tiene que seguir probando que la sonda VE este patrón.
const QR_COPY_28SEP = `const QR_COPY = {
  // [PENDIENTE microcopy oficial] — etiquetas de los tres selectores, aún sin aprobar.
  formato: 'Formato',
  tamano: 'Tamaño',
  color: 'Color',
  colorNegro: 'Negro',
  colorMarca: 'Color de marca',
  descargar: '⬇ Descargar QR',
  // APROBADOS (fundador, 29-jul-2026) — literales, no se tocan:
  ayudaSvg: 'Elige SVG si vas a imprimirlo grande (furgoneta, cartel): no se pixela.',
  errorGenerico: 'No hemos podido generar el QR con esas opciones. Prueba a cambiar el color o el tamaño.',
};
`;
const PENDIENTES_QR = ['color', 'colorMarca', 'colorNegro', 'descargar', 'formato', 'tamano'];

function clasesDe(fuente, rel = 'public/x.js', ambiguos = {}) {
  const r = censarFuente(rel, fuente, ambiguos);
  assert.deepEqual(r.ciegos, [], 'la fuente de control no debería salir CIEGA');
  return Object.fromEntries(r.hojas.map((h) => [h.id.split(' · ')[1], h.clase]));
}

function fuentesReales() {
  const out = new Map();
  (function anda(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.js')) out.set(path.relative(RAIZ, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8'));
    }
  })(path.join(RAIZ, CARPETA));
  return out;
}

// ── ① el árbol real ──────────────────────────────────────────────────────────────────────────────
test('SCRUM-1157 ① el árbol real no sale CIEGO y declara su población', () => {
  const r = censar();
  assert.equal(r.estado, 'OK', 'CIEGO:\n' + (r.ciegos || []).map((c) => `  ${c.id}\n    ${c.motivo}`).join('\n'));
  // La población se contrasta con una SEGUNDA sonda (este mismo test recorre `public/`), no con
  // un suelo escrito a mano.
  assert.equal(r.poblacion.ficheros, fuentesReales().size, 'el censo no miró todos los .js de public/');
  assert.ok(r.poblacion.objetos > 0 && r.poblacion.hojas > 0, `población vacía: ${JSON.stringify(r.poblacion)}`);
});

test('SCRUM-1157 ① trinquete: lo acusado == lo declarado, en las dos direcciones', () => {
  const r = censar();
  assert.equal(r.estado, 'OK');
  const { nuevas, sobran } = compararConDeclarados(r, leerDeclarados());
  const msg = [
    ...nuevas.map((h) => `NUEVA  ${h.id} (${h.clase})${h.sinMotivo ? ' — declarada SIN motivo' : ''}`),
    ...sobran.map((h) => `SOBRA  ${h.id} (${h.clase})`),
  ].join('\n');
  assert.equal(nuevas.length, 0,
    `${msg}\n\nNUEVA = texto del panel sin firma legible en el fuente. Mándalo a firmar (S4, regla 39); si YA ` +
    'está firmado, escribe encima `// APROBADO por <quién> el <fecha> (<referencia>)`, o al final de su ' +
    'misma línea, detrás de la coma (`k: \'x\', // APROBADO por …`; SCRUM-1157b). Sólo si queda ' +
    `pendiente de verdad, decláralo en «acusadas» de ${DECLARADOS_JSON} con su motivo.`);
  assert.equal(sobran.length, 0,
    `${msg}\n\nSOBRA = ya no sale acusado (se firmó o se borró): muévelo a «retiradas» de ${DECLARADOS_JSON} ` +
    'con el motivo y la referencia. La bajada se declara, no se borra sin más.');
});

test('SCRUM-1157 ① cada retirada lleva motivo', () => {
  for (const r of leerDeclarados().retiradas || []) assert.ok(r.id && r.motivo, `retirada sin id o sin motivo: ${JSON.stringify(r)}`);
});

// ── ② controles con el caso real ─────────────────────────────────────────────────────────────────
test('SCRUM-1157 ② control POSITIVO: los seis textos del QR salen PENDIENTE y los dos firmados, APROBADO', () => {
  const c = clasesDe(QR_COPY_28SEP);
  for (const k of PENDIENTES_QR) assert.equal(c[`QR_COPY.${k}`], 'PENDIENTE', `QR_COPY.${k}`);
  assert.equal(c['QR_COPY.ayudaSvg'], 'APROBADO');
  assert.equal(c['QR_COPY.errorGenerico'], 'APROBADO');
  assert.equal(Object.keys(c).length, 8);
});

test('SCRUM-1157 ② control NEGATIVO, derivado del positivo: con la firma puesta, cero acusados', () => {
  // Se deriva transformando el caso real, no se escribe aparte: si el caso cambia, cambia con él.
  const firmado = QR_COPY_28SEP.replace(/\/\/ \[PENDIENTE microcopy oficial\][^\n]*/, '// APROBADOS por el fundador el 28-sep-2026 (control del test)');
  assert.notEqual(firmado, QR_COPY_28SEP, 'la derivación no cambió nada: el control negativo sería el positivo');
  const r = censar({ textos: new Map([['public/x.js', firmado]]), ambiguos: {} });
  assert.equal(r.estado, 'OK');
  assert.equal(r.poblacion.hojas, 8, 'el negativo tiene que mirar las MISMAS ocho hojas');
  assert.deepEqual(r.acusadas, []);
});

test('SCRUM-1157 ② lo que la sonda NO debe tomar por firma', () => {
  assert.equal(claseDeComentario('// un albarán FIRMADO se aterriza en el duplicado'), null, 'FIRMADO como ESTADO');
  assert.equal(claseDeComentario('// sella el contenido FIRMADO por el cliente'), null, 'FIRMADO por el cliente');
  assert.equal(claseDeComentario('// Ni un rótulo de esta pantalla está aprobado'), null, 'minúsculas en prosa');
  assert.equal(claseDeComentario('// FIRMADO el 16-sep-2026 por\n// el fundador'), 'APROBADO', 'firma partida en dos líneas');
  assert.equal(claseDeComentario('// Todavía SIN APROBAR'), 'AMBIGUO');
  assert.equal(claseDeComentario('// antes caía al marcador `[PENDIENTE microcopy oficial]`'), 'AMBIGUO', 'el marcador CITADO no declara');
  // Un objeto con un comentario de ESTADO encima no entra en el censo.
  const r = censarFuente('public/x.js', '// un parte FIRMADO no se edita\nconst X = { a: "texto" };\n', {});
  assert.equal(r.objetos, 0);
});

test('SCRUM-1157 ② APROBADO en singular no se hereda; en plural con cuenta, gobierna a esos N', () => {
  const singular = clasesDe('const T = {\n  // APROBADO por el fundador (SCRUM-1)\n  a: "A",\n  b: "B",\n};\n');
  assert.deepEqual(singular, { 'T.a': 'APROBADO', 'T.b': 'SIN_COMENTARIO' });
  const cuenta = clasesDe('const T = {\n  // Los dos literales están FIRMADOS (com. 1)\n  a: "A",\n  b: "B",\n  c: "C",\n};\n');
  assert.deepEqual(cuenta, { 'T.a': 'APROBADO', 'T.b': 'APROBADO', 'T.c': 'SIN_COMENTARIO' });
  assert.equal(cuantosDice('// los cinco textos de las dos firmas'), 5);
  assert.equal(cuantosDice('// APROBADOS'), Infinity);
});

// SCRUM-1157b · la regla 1 de la cabecera no funcionaba: con la coma entre el valor y el
// comentario, TS deja de buscar comentarios «de detrás» en la coma, y los «de delante» no cogen
// los de la misma línea. S4 marcó 22 hojas así y las 22 salieron SIN_COMENTARIO.
test('SCRUM-1157b · regla 1: `k: \'x\', // APROBADO` (misma línea, detrás de la coma) firma a esa clave y sólo a ella', () => {
  const src = 'const T = {\n  // [PENDIENTE microcopy oficial]\n'
    + '  a: "A", // APROBADO por el fundador (SCRUM-1)\n'
    + '  b: "B",\n'
    + '  c: "C" // APROBADO por el fundador (SCRUM-1)\n};\n';
  assert.deepEqual(clasesDe(src), { 'T.a': 'APROBADO', 'T.b': 'PENDIENTE', 'T.c': 'APROBADO' });
  // Un objeto cuyo ÚNICO convenio va en esa forma también tiene que ENTRAR en el censo.
  const solo = 'const U = {\n  a: "A", // APROBADO por el fundador (SCRUM-1)\n  b: "B",\n};\n';
  assert.deepEqual(clasesDe(solo), { 'U.a': 'APROBADO', 'U.b': 'SIN_COMENTARIO' });
});

// ── ③ se prueba FALLANDO sobre el árbol real ─────────────────────────────────────────────────────
test('SCRUM-1157 ③ un literal sin firmar inyectado en el árbol real sale como NUEVA', () => {
  const textos = fuentesReales();
  const rel = 'public/dashboard/js/settingsView.js';
  const original = textos.get(rel);
  assert.ok(original && original.includes('const QR_COPY = {'), `${rel} ya no tiene QR_COPY: rehaz esta mutación sobre otro objeto del censo`);
  // Delante del primer comentario: nada lo gobierna.
  textos.set(rel, original.replace('const QR_COPY = {', "const QR_COPY = {\n  inyectado1157: 'Texto nuevo sin firma',"));
  const r = censar({ textos });
  assert.equal(r.estado, 'OK');
  const { nuevas, sobran } = compararConDeclarados(r, leerDeclarados());
  assert.deepEqual(nuevas.map((h) => [h.id, h.clase]), [[`${rel} · QR_COPY.inyectado1157`, 'SIN_COMENTARIO']]);
  assert.deepEqual(sobran, []);
  // Y revertido, verde otra vez (la BASE sin mutar: sin ella, un rojo inestable parece el mutante).
  textos.set(rel, original);
  const base = compararConDeclarados(censar({ textos }), leerDeclarados());
  assert.deepEqual([base.nuevas.length, base.sobran.length], [0, 0]);
});

// ── ④ fail-closed ────────────────────────────────────────────────────────────────────────────────
test('SCRUM-1157 ④ lo que no sabe leer sale CIEGO y SIN hojas', () => {
  const casos = {
    'sintaxis rota': 'const X = { a: "x", \n',
    'comentario ambiguo sin resolver': 'const X = {\n  // ya no lleva `[PENDIENTE microcopy oficial]`: APROBADO\n  a: "x",\n};\n',
    '...spread': 'const X = {\n  // APROBADOS por el fundador\n  a: "x",\n  ...OTRO,\n};\n',
  };
  for (const [nombre, fuente] of Object.entries(casos)) {
    const r = censar({ textos: new Map([['public/x.js', fuente]]), ambiguos: {} });
    assert.equal(r.estado, 'CIEGO', nombre);
    assert.ok(r.ciegos.length > 0, nombre);
    assert.equal(r.hojas, undefined, `${nombre}: un CIEGO no devuelve hojas parciales`);
  }
  const caducada = censar({ textos: new Map([['public/x.js', QR_COPY_28SEP]]), ambiguos: { 'public/x.js · NADA': { clase: 'APROBADO', motivo: 'x' } } });
  assert.equal(caducada.estado, 'CIEGO', 'una resolución que ya no casa con nada es CIEGO');
  const vacio = censar({ textos: new Map(), ambiguos: {} });
  assert.equal(vacio.estado, 'CIEGO', 'un censo sobre cero ficheros no es un verde');
});

test('SCRUM-1157 ④ la CLI: CIEGO sale ≠ 0 y no imprime NADA por stdout; la población vacía también es CIEGO', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1157-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.writeFileSync(path.join(tmp, DECLARADOS_JSON), JSON.stringify({ ambiguos: {}, acusadas: {}, retiradas: [] }));
    fs.mkdirSync(path.join(tmp, 'public'));
    const vacio = spawnSync(process.execPath, [CLI, '--raiz', tmp], { encoding: 'utf8' });
    assert.notEqual(vacio.status, 0, 'población vacía no puede salir 0');
    assert.equal(vacio.stdout, '');
    assert.match(vacio.stderr, /CIEGO/);
    fs.writeFileSync(path.join(tmp, 'public', 'x.js'), 'const X = { a: "x", \n');
    const roto = spawnSync(process.execPath, [CLI, '--raiz', tmp], { encoding: 'utf8' });
    assert.notEqual(roto.status, 0);
    assert.equal(roto.stdout, '', 'un CIEGO no imprime nada parcial');
    assert.match(roto.stderr, /no parsea limpio/);
    // Control de que la CLI SÍ imprime cuando puede mirar (si no, «stdout vacío» no probaría nada).
    fs.writeFileSync(path.join(tmp, 'public', 'x.js'), QR_COPY_28SEP);
    const ok = spawnSync(process.execPath, [CLI, '--raiz', tmp], { encoding: 'utf8' });
    assert.match(ok.stdout, /población: 1 ficheros/);
    assert.match(ok.stdout, /PENDIENTE 6/);
    assert.equal(ok.status, 1, 'seis acusadas sin declarar: el trinquete sale rojo');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
