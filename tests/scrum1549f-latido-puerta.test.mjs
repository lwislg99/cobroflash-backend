// SCRUM-1549f · EL LATIDO DICE SI LA PUERTA DEL LANZADOR DEJA LANZAR, Y LO DICE EN TRES RESPUESTAS, NO EN DOS.
//
// El 29-oct-2026 la copia instalada de `sesion.mjs` dejó de ser idéntica a `main` al mergear #2981 (10:53:28Z) y la
// puerta se cerró, correctamente, 6 h 38 min: el equipo pasó de 14 sesiones a 0 y ningún instrumento lo dijo
// (SCRUM-1549e). La puerta da el MISMO código 2 a «ALTERADO» y a «no pude comprobar», sin versión, sin desde cuándo
// y sin remedio.
//
// Aquí se comprueba lo que la sección puede hacer mal:
//   · dar «al día» a una copia que no lo está;
//   · no decir DESDE CUÁNDO está cerrada (el merge que la cambió) ni qué versión es la copia;
//   · no reconocer la copia estropeada por el `>` de PowerShell, o dar un remedio que no diga `cmd`;
//   · confundir «no pude mirar» con «al día» o con «alterada»: tienen que salir 2, 0 y 1.
//
// 🔴 EL BANCO ES UN REPOSITORIO SINTÉTICO en el temporal y una instalación de mentira a su lado: no depende de la
// instalación de esta máquina, ni de cómo esté `main` de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { seccionPuerta, medirPuerta, juzgarCopia, estropicio, blobDe } from '../scripts/equipo/puerta.mjs';
import { salidaDe, SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO } from '../scripts/equipo/latido.mjs';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El rojo, declarado: lo ejecuta `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Toda copia sale «al día».
    fichero: 'scripts/equipo/puerta.mjs',
    de: "  if (blob === blobDe(main)) return { estado: 'AL-DIA', blob };",
    a: "  if (blob) return { estado: 'AL-DIA', blob };",
    cae: 'SCRUM-1549f · 🔴 EL CASO DEL 29-OCT: copia de la versión anterior → PUERTA CERRADA, con su versión, el merge que la cerró y el remedio por cmd',
  },
  {
    // «Desde cuándo» apunta a la versión de la copia, no al merge que la cambió.
    fichero: 'scripts/equipo/puerta.mjs',
    de: '    if (i > 0) return { estado: \'ATRASADA\', blob, es: versiones[i], cerradaPor: versiones[i - 1], saltos: i };',
    a: '    if (i > 0) return { estado: \'ATRASADA\', blob, es: versiones[i], cerradaPor: versiones[i], saltos: i };',
    cae: 'SCRUM-1549f · 🔴 EL CASO DEL 29-OCT: copia de la versión anterior → PUERTA CERRADA, con su versión, el merge que la cerró y el remedio por cmd',
  },
  {
    // La copia hecha con el `>` de PowerShell deja de reconocerse.
    fichero: 'scripts/equipo/puerta.mjs',
    de: '  if (propio.length >= 2 && propio[0] === 0xff && propio[1] === 0xfe) {',
    a: '  if (propio.length >= 2 && propio[0] === 0x00 && propio[1] === 0xfe) {',
    cae: 'SCRUM-1549f · 🔴 la copia de main hecha desde PowerShell (UTF-16) sale AJENA y dice que es PowerShell',
  },
  {
    // «No pude mirar» deja de ser ciego.
    fichero: 'scripts/equipo/puerta.mjs',
    de: "  const ciega = (motivo) => ({ nombre: 'PUERTA', pudo: false, motivo, alertas: [], poblacion: null });",
    a: "  const ciega = (motivo) => ({ nombre: 'PUERTA', pudo: true, motivo, alertas: [], poblacion: null });",
    cae: 'SCRUM-1549f · 🔴 FAIL-CLOSED: sin instalación, sin config.json o sin poder leer main, la sección sale «no pude mirar» (salida 2)',
  },
];

const RUTA = 'scripts/equipo/sesion.mjs';
const V1 = '// lanzador v1\nexport const a = 1;\n';
const V2 = '// lanzador v2\nexport const a = 2;\n';

/** Un repositorio con dos versiones del lanzador en su primer padre (y un commit en medio que no lo toca), y una instalación al lado. */
function banco() {
  const base = temporal('scrum1549f-');
  const repo = path.join(base, 'repo'), dir = path.join(base, 'instalacion');
  const g = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.mkdirSync(path.join(base, 'repo', 'scripts', 'equipo'), { recursive: true });
  fs.mkdirSync(path.join(base, 'instalacion'));
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'banco@yaqu.test'); g('config', 'user.name', 'Banco'); g('config', 'commit.gpgsign', 'false'); g('config', 'core.autocrlf', 'false');
  const commit = (rel, texto, msg) => { fs.writeFileSync(path.join(base, 'repo', rel), texto); g('add', '-A'); g('commit', '-q', '-m', msg); return g('rev-parse', 'HEAD').trim(); };
  const c1 = commit(RUTA, V1, 'v1');
  commit('otro.txt', 'x\n', 'no toca el lanzador');
  const c2 = commit(RUTA, V2, 'v2');
  g('update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.writeFileSync(path.join(base, 'instalacion', 'config.json'), JSON.stringify({ repo: repo.replace(/\\/g, '/') }));
  const instalar = (bytes) => fs.writeFileSync(path.join(base, 'instalacion', 'sesion.mjs'), bytes);
  return { base, repo, dir, c1, c2, instalar };
}

test('SCRUM-1549f · AL DÍA: la copia idéntica a origin/main → verde, con tamaño y sha256, salida 0', () => {
  const b = banco();
  b.instalar(Buffer.from(V2));
  const s = seccionPuerta(medirPuerta({ dir: b.dir }));
  assert.equal(s.pudo, true);
  assert.deepEqual(s.alertas, []);
  assert.match(s.poblacion, /AL DÍA/);
  assert.match(s.poblacion, new RegExp(`${Buffer.byteLength(V2)} B, sha256 `));
  assert.equal(salidaDe([s]), SALIDA_OK);
});

test('SCRUM-1549f · 🔴 EL CASO DEL 29-OCT: copia de la versión anterior → PUERTA CERRADA, con su versión, el merge que la cerró y el remedio por cmd', () => {
  const b = banco();
  b.instalar(Buffer.from(V1));
  const s = seccionPuerta(medirPuerta({ dir: b.dir }));
  assert.equal(s.pudo, true);
  assert.equal(s.alertas.length, 1);
  const l = s.alertas[0].linea;
  assert.match(l, /PUERTA CERRADA/);
  assert.match(l, /ATRASADA 1 versión/);
  assert.ok(l.includes(`es la de ${b.c1.slice(0, 9)}`), l);
  assert.ok(l.includes(`CERRADA desde el merge ${b.c2.slice(0, 9)}`), l);
  assert.match(l, /desde \*\*cmd\*\*, NUNCA desde PowerShell/);
  assert.ok(l.includes(`show origin/main:${RUTA} > "`), l);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1549f · 🔴 la copia de main hecha desde PowerShell (UTF-16) sale AJENA y dice que es PowerShell', () => {
  const b = banco();
  b.instalar(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(V2, 'utf16le')]));
  const s = seccionPuerta(medirPuerta({ dir: b.dir }));
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /AJENA: no es ninguna de las últimas 2 versiones de main/);
  assert.match(s.alertas[0].linea, /UTF-16 con BOM \(el `>` de PowerShell\)/);
  assert.equal(salidaDe([s]), SALIDA_AVISO);
});

test('SCRUM-1549f · las otras dos formas de estropear main (BOM UTF-8, CRLF) se nombran; una copia cualquiera, no', () => {
  const main = Buffer.from(V2);
  assert.match(estropicio(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), main]), main), /BOM/);
  assert.match(estropicio(Buffer.from(V2.replace(/\n/g, '\r\n')), main), /CRLF/);
  assert.equal(estropicio(Buffer.from('otra cosa\n'), main), null);
  // Sin historial legible, el veredicto sale igual (ALTERADA) y no se inventa «desde cuándo».
  const j = juzgarCopia({ propio: Buffer.from(V1), main, versiones: null });
  assert.equal(j.estado, 'AJENA');
  assert.equal(j.recorridas, null);
  assert.equal(blobDe(Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('SCRUM-1549f · 🔴 FAIL-CLOSED: sin instalación, sin config.json o sin poder leer main, la sección sale «no pude mirar» (salida 2)', () => {
  const b = banco();
  b.instalar(Buffer.from(V2));
  const sin = seccionPuerta(medirPuerta({ dir: path.join(b.base, 'no-existe') }));
  fs.writeFileSync(path.join(b.base, 'instalacion', 'config.json'), '{roto');
  const rota = seccionPuerta(medirPuerta({ dir: b.dir }));
  fs.writeFileSync(path.join(b.base, 'instalacion', 'config.json'), JSON.stringify({ repo: path.join(b.base, 'no-es-repo').replace(/\\/g, '/') }));
  const sinMain = seccionPuerta(medirPuerta({ dir: b.dir }));
  for (const s of [sin, rota, sinMain, seccionPuerta(undefined)]) {
    assert.equal(s.pudo, false, s.motivo);
    assert.match(s.motivo, /NO SÉ si la puerta deja lanzar/);
    assert.equal(salidaDe([s]), SALIDA_CIEGO);
  }
});

test('SCRUM-1549f · las TRES respuestas salen con TRES salidas distintas (0, 1, 2), que es lo que la puerta no hace', () => {
  const b = banco();
  b.instalar(Buffer.from(V2));
  const alDia = salidaDe([seccionPuerta(medirPuerta({ dir: b.dir }))]);
  b.instalar(Buffer.from(V1));
  const alterada = salidaDe([seccionPuerta(medirPuerta({ dir: b.dir }))]);
  const ciega = salidaDe([seccionPuerta(medirPuerta({ dir: path.join(b.base, 'no-existe') }))]);
  assert.deepEqual([alDia, alterada, ciega], [SALIDA_OK, SALIDA_AVISO, SALIDA_CIEGO]);
});

test('SCRUM-1549f · una instalación DENTRO de un árbol de git es puerta cerrada (DESDE-UN-ARBOL), no «al día»', () => {
  const b = banco();
  const dentro = path.join(b.base, 'repo', 'instalacion');
  fs.mkdirSync(dentro);
  fs.writeFileSync(path.join(dentro, 'config.json'), JSON.stringify({ repo: b.repo.replace(/\\/g, '/') }));
  fs.writeFileSync(path.join(dentro, 'sesion.mjs'), V2);
  const s = seccionPuerta(medirPuerta({ dir: dentro }));
  assert.equal(s.alertas.length, 1);
  assert.match(s.alertas[0].linea, /DESDE-UN-ARBOL/);
});

test('SCRUM-1549f · el latido CORRE la sección: la mide, la pinta y la cuenta para la salida', () => {
  const codigo = fs.readFileSync(path.join(RAIZ, 'scripts', 'equipo', 'latido.mjs'), 'utf8')
    .split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');
  assert.match(codigo, /import \{ seccionPuerta, medirPuerta \} from '\.\/puerta\.mjs';/);
  assert.match(codigo, /const sPue = seccionPuerta\(intentar\(\(\) => medirPuerta\(\)\)\);/);
  assert.match(codigo, /secciones\.push\(sVM, sTG, sPue\);/);
});
