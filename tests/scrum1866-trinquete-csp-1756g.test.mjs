// tests/scrum1866-trinquete-csp-1756g.test.mjs — SCRUM-1866 · el TRINQUETE del censo CSP de SCRUM-1756g.
//
// El censo 1756g (`docs/master/SCRUM-1756.md`, tramo g) midió lo que bloquea el paso 3 de la CSP
// (`style-src 'self'` y `script-src 'self'` aplicadas): por fichero de src/** + public/** (fuera el correo,
// src/modules/messaging/**), las ocurrencias VIVAS de `<style`, `style="`, `<script>` sin src y `on*=`.
// Este test congela esa tabla (`tests/_scrum1866-congelada.json`, con el sha del que nace) y cae si una
// columna SUBE en un fichero, o si un fichero sin fila trae alguna > 0. Si una BAJA, también cae: pide
// recongelar en el mismo PR (un número de deuda que baja solo es un instrumento roto hasta que se mira).
// El clasificador es la sonda 2 del guion de 1756g, en `tests/_scrum1866-csp-1756g.mjs`: no hay otro censo.
// CIEGO (salida 2, nunca verde): `typescript` no carga, git no da la población, la población sale vacía,
// un fichero no se puede leer, la tabla congelada no se puede leer o la siembra no se caza.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  cargarTs, listaGit, censar, censarSiembra, comparar, comoLinea, serializar, COLUMNAS, ESPERADO_SIEMBRA,
} from './_scrum1866-csp-1756g.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CONGELADA = 'tests/_scrum1866-congelada.json';

// Las del meta-guard (`scripts/meta-guard-mutaciones.mjs`): cada una tiene que tumbar el caso que nombra.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Una vista de J que está a 0 vuelve a meter un `style="` en su cadena de innerHTML.
    fichero: 'public/dashboard/js/invoicesView.js',
    de: '<th class="j1-fac-col-total">Importe</th>',
    a: '<th class="j1-fac-col-total" style="width:1px">Importe</th>',
    cae: 'SCRUM-1866 · ninguna columna SUBE',
  },
  {
    // Un fichero que ya tiene fila sube en otra columna: un `onclick=` en admin.
    fichero: 'public/admin.html',
    de: '<button type="submit" id="qq-btn">',
    a: '<button type="submit" id="qq-btn" onclick="x()">',
    cae: 'SCRUM-1866 · ninguna columna SUBE',
  },
  {
    // La tabla congelada sube una cifra a mano: ahora el árbol «baja» y hay que recongelar.
    fichero: 'tests/_scrum1866-congelada.json',
    de: '"public/admin.html": {"style_tag":1,"style_attr":4,',
    a: '"public/admin.html": {"style_tag":1,"style_attr":5,',
    cae: 'SCRUM-1866 · ninguna cifra BAJA sin recongelar',
  },
  {
    // El clasificador deja de contar lo que va en cadenas (casi todo el panel): la siembra lo caza.
    fichero: 'tests/_scrum1866-csp-1756g.mjs',
    de: "const vivo = (l) => l === 'cadena' || ",
    a: "const vivo = (l) => l === 'nada' || ",
    cae: 'SCRUM-1866 · controles: la siembra',
  },
  {
    // El correo entra en la población: la siembra de messaging lo caza.
    fichero: 'tests/_scrum1866-csp-1756g.mjs',
    de: "export const CORREO = 'src/modules/messaging/';",
    a: "export const CORREO = 'src/modules/mensajeria/';",
    cae: 'SCRUM-1866 · controles: la siembra',
  },
];

// ── Una sola medición, al cargar; lo que no se puede mirar va a `ciego` ─────────────────────────────
const ciego = [];
const { ts, error: errTs } = cargarTs(RAIZ);
if (!ts) ciego.push(`typescript no carga: ${errTs}`);
let congelada = null;
try {
  congelada = JSON.parse(fs.readFileSync(path.join(RAIZ, CONGELADA), 'utf8'));
  if (typeof congelada?.medidoSobre !== 'string' || typeof congelada?.ficheros !== 'object') throw new Error('sin medidoSobre o sin ficheros');
} catch (e) { ciego.push(`${CONGELADA} no se puede leer: ${e.message}`); congelada = null; }
const lista = listaGit(RAIZ);
if (!lista) ciego.push('git ls-files no contesta');
let sha = '(sin sha)';
try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch { /* lo dice la línea */ }

/** Problemas de los controles sembrados: lista vacía = la siembra se caza ENTERA. */
function fallosDeLaSiembra(s) {
  const f = [];
  if (s.texto === 0) f.push('la siembra no tiene ficheros: el instrumento no ha mirado nada');
  for (const [p, esp] of Object.entries(ESPERADO_SIEMBRA)) {
    const got = s.tabla[p] ?? {};
    for (const k of COLUMNAS) if ((got[k] ?? 0) !== esp[k]) f.push(`${p}:${k} da ${got[k] ?? 0}, esperado ${esp[k]}`);
  }
  if ('public/cero.html' in s.tabla) f.push(`el cero (<link>, <script src>, class="styles") da ${JSON.stringify(s.tabla['public/cero.html'])}`);
  if (s.correo !== 1 || Object.keys(s.tabla).some((p) => p.startsWith('src/modules/messaging/'))) f.push('el correo de la siembra no queda fuera');
  return f;
}

let censo = null, siembra = null;
if (ts && lista) {
  const t0 = Date.now();
  censo = censar(ts, RAIZ, lista);
  siembra = censarSiembra(ts);
  console.log(`SCRUM-1866 · censo en ${Date.now() - t0} ms`);
  if (censo.texto === 0) ciego.push('la población sale vacía');
  if (censo.noLeidos.length) ciego.push(`no pude leer ${censo.noLeidos.length}: ${censo.noLeidos.slice(0, 5).join(', ')}`);
  const fs1 = fallosDeLaSiembra(siembra);
  if (fs1.length) ciego.push('la siembra no se caza: ' + fs1.join(' · '));
}
const POBLACION = censo
  ? `sobre ${censo.texto} ficheros de texto (git ls-files src public = ${censo.total}, fuera correo ${censo.correo}), sha ${sha}; tabla congelada sobre ${congelada?.medidoSobre ?? '(ninguna)'} · ${Object.keys(censo.tabla).length} ficheros con cifra hoy`
  : `sin población, sha ${sha}`;
console.log(`SCRUM-1866 · POBLACIÓN ${POBLACION}`);
if (ciego.length) { console.error('SCRUM-1866 · CIEGO: ' + ciego.join(' | ')); process.exitCode = 2; }
const noCiego = () => assert.deepEqual(ciego, [], `🔴 CIEGO (no es un verde): ${ciego.join(' | ')}`);

test('SCRUM-1866 · controles: la siembra fabricada en un temporal CAZA las cuatro columnas, el cero da 0 y el correo queda fuera', () => {
  noCiego();
  assert.deepEqual(fallosDeLaSiembra(siembra), []);
  assert.equal(Object.keys(siembra.tabla).length, Object.keys(ESPERADO_SIEMBRA).length, `🔴 la siembra da ficheros de más: ${JSON.stringify(siembra.tabla)}`);
});

test('SCRUM-1866 · sin siembra el control dice CIEGO, no verde', () => {
  noCiego();
  const vacia = censarSiembra(ts, { sinSiembra: true });
  assert.equal(vacia.texto, 0);
  assert.ok(fallosDeLaSiembra(vacia).length > 0, '🔴 una siembra vacía pasa los controles: el positivo no discrimina');
});

test('SCRUM-1866 · rojo sembrado: una copia temporal de la población con un style=" y un onclick= más da EXACTAMENTE esas dos subidas', () => {
  noCiego();
  const conFila = Object.keys(censo.tabla).sort()[0];
  const sinFila = lista.filter((p) => /^public\/.*\.js$/.test(p) && !(p in censo.tabla)).sort()[0];
  assert.ok(conFila && sinFila, `🔴 no encuentro dónde sembrar: con fila ${conFila}, sin fila ${sinFila}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1866-${process.pid}-`));
  try {
    for (const p of lista) {
      if (p.startsWith('src/modules/messaging/') || !/\.(ts|m?js|html|css)$/.test(p)) continue;
      fs.mkdirSync(path.join(dir, path.dirname(p)), { recursive: true });
      let txt = fs.readFileSync(path.join(RAIZ, p), 'utf8');
      if (p === conFila) txt += '\n<p style="color:red">siembra 1866</p>\n';
      if (p === sinFila) txt += '\nconst s1866 = \'<b onclick="x()">siembra</b>\';\n';
      fs.writeFileSync(path.join(dir, p), txt);
    }
    const copia = censar(ts, dir, lista.filter((p) => !p.startsWith('src/modules/messaging/')));
    const { subidas, bajadas } = comparar(censo.tabla, copia.tabla);
    assert.deepEqual(bajadas, [], `🔴 la copia no reproduce el árbol: ${bajadas.map(comoLinea).join(', ')}`);
    assert.deepEqual(subidas.map(comoLinea).sort(), [
      `${conFila}:style=":${censo.tabla[conFila].style_attr}→${censo.tabla[conFila].style_attr + 1}`,
      `${sinFila}:on*=:0→1 (sin fila en la tabla: fichero nuevo o que estaba a 0)`,
    ].sort());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SCRUM-1866 · ninguna columna SUBE en ningún fichero de src/** + public/** (ni fichero sin fila con cifra > 0)', () => {
  noCiego();
  const { subidas } = comparar(congelada.ficheros, censo.tabla);
  assert.deepEqual(subidas.map(comoLinea), [],
    `🔴 SUBE (${POBLACION}). Con la CSP aplicada (paso 3, SCRUM-1756) esto deja CSS sin pintar o un botón mudo: `
    + 'pásalo a una clase en la hoja o a un addEventListener en un .js servido, no a la tabla.');
});

test('SCRUM-1866 · ninguna cifra BAJA sin recongelar la tabla en el mismo PR', () => {
  noCiego();
  const { subidas, bajadas } = comparar(congelada.ficheros, censo.tabla);
  if (bajadas.length === 0) return;
  let propuesta = '(no se propone: hay subidas, mira el caso anterior)';
  if (subidas.length === 0) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-1866-${process.pid}-`));
    propuesta = path.join(dir, '_scrum1866-congelada.json');
    const { ficheros: _viejos, ...meta } = congelada;
    fs.writeFileSync(propuesta, serializar({ ...meta, medidoSobre: sha, fecha: `${new Date().toISOString()} (reloj de la máquina que recongeló)` }, censo.tabla));
  }
  assert.fail(`✅ BAJA, que es la dirección buena, pero la tabla no lo sabe:\n    ${bajadas.map(comoLinea).join('\n    ')}\n`
    + `    Recongélala en ESTE PR: cp '${propuesta}' ${CONGELADA}  (${POBLACION})`);
});
