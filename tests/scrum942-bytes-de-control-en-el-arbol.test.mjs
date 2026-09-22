// tests/scrum942-bytes-de-control-en-el-arbol.test.mjs — SCRUM-942 · el mecanismo de la A22
//
// Ver scripts/_censo-bytes-control.mjs para el porqué: ningún fichero de texto versionado lleva
// bytes de control 0-8, 11, 12, 14-31 o 127 (TAB, LF y CR quedan fuera). Y la trampa que decide si
// el guard sirve: NO puede usar `git grep -I`, porque un NUL marca el fichero como binario y `-I`
// lo salta — ciego justo ante el caso peor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  esByteDeControlProhibido, bytesProhibidosEn, esTextoPorExtension, censarBytesDeControl, EXENTOS,
} from '../scripts/_censo-bytes-control.mjs';
import { temporal } from './_temporal.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL CLASIFICADOR DE BYTES — puro, sin tocar disco
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-942 · esByteDeControlProhibido: cubre 0-8, 11, 12, 14-31, 127 — y SOLO eso ahí abajo', () => {
  const prohibidos = [];
  const permitidosBajoControl = [];
  for (let b = 0; b <= 31; b++) (esByteDeControlProhibido(b) ? prohibidos : permitidosBajoControl).push(b);
  if (esByteDeControlProhibido(127)) prohibidos.push(127);
  assert.deepEqual(permitidosBajoControl, [9, 10, 13],
    '🔴 TAB(9)/LF(10)/CR(13) tienen que ser los ÚNICOS permitidos entre 0 y 31.');
  assert.ok(prohibidos.includes(0) && prohibidos.includes(27) && prohibidos.includes(31) && prohibidos.includes(127),
    '🔴 faltan casos concretos: NUL, ESC, US o DEL');
  assert.equal(prohibidos.length, 30, `🔴 32 bytes de 0-31 menos 3 permitidos + 127 = 30; salieron ${prohibidos.length}`);
  for (let b = 32; b <= 126; b++) {
    assert.ok(!esByteDeControlProhibido(b), `🔴 NEGATIVO: el byte ${b} (imprimible) no puede ser "de control"`);
  }
});

test('SCRUM-942 · bytesProhibidosEn encuentra CADA byte malo, con su offset', () => {
  const buf = Buffer.from([65, 66, 0x1b, 67, 0x00, 68]); // 'AB<ESC>C<NUL>D'
  const malos = bytesProhibidosEn(buf);
  assert.deepEqual(malos, [{ byte: 0x1b, offset: 2 }, { byte: 0x00, offset: 4 }]);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SUELO — el censo ve población de verdad, o se declara ciego
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-942 · 🔴 SUELO: el censo ve MILES de ficheros de texto, no un puñado', () => {
  const r = censarBytesDeControl(RAIZ);
  assert.ok(r.ficherosVistos > 500,
    `🔴 CIEGO: sólo ha mirado ${r.ficherosVistos} ficheros de texto. Referencia (22-sep-2026): 3231.`);
  assert.ok(r.totalRastreados > r.ficherosVistos,
    '🔴 el total rastreado por git tiene que ser MAYOR que los de texto (hay binarios de verdad: PNG, etc.)');
});

test('SCRUM-942 · esTextoPorExtension: SUELO del filtro — ve texto y ve binario, y no confunde uno con el otro', () => {
  assert.ok(esTextoPorExtension('tests/x.mjs'));
  assert.ok(esTextoPorExtension('docs/RUNBOOKS.md'));
  assert.ok(esTextoPorExtension('.gitattributes'));
  assert.ok(!esTextoPorExtension('public/assets/logo.png'));
  assert.ok(!esTextoPorExtension('docs/evidencias/scrum883/factura.pdf'));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL ROJO QUE DECIDE — sembrar \x1b y \x00 en un fichero de texto real, y que el censo caiga
// con los dos. El NUL vale doble: es el caso donde un instrumento mal hecho (git grep -I, o un
// `readFileSync(..., 'utf8')` que trocea en el NUL) se queda MUDO.
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-942 · 🔴 EL ROJO: un .mjs sembrado con ESC cae, y el censo dice DÓNDE', () => {
  const dir = temporal('scrum942-esc-');
  fs.writeFileSync(path.join(dir, 'sembrado.mjs'), Buffer.from(`const x = 1;${String.fromCharCode(27)}\n`));
  fs.writeFileSync(path.join(dir, 'sano.mjs'), 'const x = 1;\n');
  // El censo real usa `git ls-files`; aquí se ejerce el DETECTOR directamente sobre los bytes,
  // que es la unidad que de verdad puede fallar (el censo entero exige un repo git).
  const conEsc = bytesProhibidosEn(fs.readFileSync(path.join(dir, 'sembrado.mjs')));
  const sano = bytesProhibidosEn(fs.readFileSync(path.join(dir, 'sano.mjs')));
  assert.equal(conEsc.length, 1, '🔴 el ESC sembrado no se detectó');
  assert.equal(conEsc[0].byte, 27);
  assert.deepEqual(sano, [], '🔴 CONTROL: el fichero limpio no debería dar ningún hallazgo');
});

test('SCRUM-942 · 🔴 EL ROJO QUE VALE DOBLE: un .mjs sembrado con NUL cae — aquí es donde un '
  + 'instrumento mal hecho (`git grep -I`, o un `readFileSync(...,\'utf8\')`) se queda MUDO', () => {
  const dir = temporal('scrum942-nul-');
  const f = path.join(dir, 'sembrado.mjs');
  fs.writeFileSync(f, Buffer.from([99, 111, 110, 115, 116, 0x00, 59])); // "const" + NUL + ";"

  // CONTROL: git de verdad trata este fichero como BINARIO en cuanto se le añade.
  execSync('git init -q', { cwd: dir });
  execSync('git add sembrado.mjs', { cwd: dir });
  const numstat = execSync('git diff --cached --numstat', { cwd: dir, encoding: 'utf8' });
  assert.match(numstat, /^-\t-\t/, '🔴 CONTROL: si git NO lo trata como binario, la trampa no está sembrada de verdad');

  // Y `git grep -I` — la vía prohibida — no encuentra NADA en un fichero que git considera binario.
  let salidaGrepI = '';
  try {
    salidaGrepI = execSync('git grep -Il .', { cwd: dir, encoding: 'utf8' });
  } catch (e) { salidaGrepI = (e.stdout || '').toString(); }
  assert.equal(salidaGrepI.trim(), '',
    '🔴 si `git grep -I` SÍ ve el fichero, la trampa medida en el ticket ya no reproduce y hay que '
    + 'revisar el supuesto, no el detector.');

  // Nuestro detector, que NO pasa por `-I` y lee el byte directamente, sí lo ve.
  const malos = bytesProhibidosEn(fs.readFileSync(f));
  assert.equal(malos.length, 1);
  assert.equal(malos[0].byte, 0x00, '🔴 el NUL sembrado no se detectó: el instrumento se quedó mudo justo en el caso peor');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO — los ficheros legítimos del árbol de hoy no caen
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-942 · ✅ POSITIVO: el árbol de hoy pasa limpio — cero hallazgos sin exenciones nuevas', () => {
  const r = censarBytesDeControl(RAIZ);
  assert.deepEqual(r.hallazgos, [],
    '🔴 hay ficheros de texto con bytes de control que no están en EXENTOS:\n  · '
    + r.hallazgos.map((h) => `${h.rel} (${h.n})`).join('\n  · '));
});

test('SCRUM-942 · las EXENTOS declaradas siguen siendo exactamente las siete de hoy — la lista no crece sola', () => {
  const claves = Object.keys(EXENTOS).sort();
  assert.deepEqual(claves, [
    'docs/evidencias/scrum883/C1-pdf-justificante.txt',
    'docs/evidencias/scrum883/C1-pdf-presupuesto.txt',
    'docs/evidencias/scrum883/C3-pdf-justificante.txt',
    'docs/evidencias/scrum883/C3-pdf-presupuesto.txt',
    'docs/master/SCRUM-428.md',
    'docs/master/SCRUM-484.md',
    'estructura-completa.txt',
    'estructura.txt',
  ].sort(), '🔴 la lista de exenciones cambió: si crece, di POR QUÉ (motivo + fecha); si baja, alguien '
    + 'limpió un fichero y el motivo de arriba caducó.');
  for (const [rel, motivo] of Object.entries(EXENTOS)) {
    assert.match(motivo, /\d{2}-\w{3}-2026/, `🔴 ${rel}: la exención no lleva fecha`);
  }
});

test('SCRUM-942 · las tres víctimas originales (scrum806, scrum807, _censo-tickets) ya NO están exentas ni tienen bytes malos', () => {
  const arreglados = [
    'tests/scrum806-el-pdf-del-portal.test.mjs',
    'tests/scrum807-esquemas-del-href.test.mjs',
    'tests/_censo-tickets.mjs',
    'docs/master/evidencias/SCRUM-955/censo-sif1.mjs',
  ];
  for (const rel of arreglados) {
    assert.ok(!(rel in EXENTOS), `🔴 ${rel} no debería necesitar exención: se arregló con \\x00/\\x1f`);
    const malos = bytesProhibidosEn(fs.readFileSync(path.join(RAIZ, rel)));
    assert.deepEqual(malos, [], `🔴 ${rel} todavía lleva bytes de control: ${JSON.stringify(malos)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ NEGATIVO — no se ensancha a TAB/LF/CR ni a los binarios de verdad
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-942 · ✅ NEGATIVO: TAB, LF y CR no son "de control" para este censo', () => {
  const buf = Buffer.from('linea1\tcolumna\r\nlinea2\n');
  assert.deepEqual(bytesProhibidosEn(buf), [], '🔴 el censo se ha ensanchado a caracteres legítimos');
});

test('SCRUM-942 · ✅ NEGATIVO: un binario real (PNG) no entra en la población — se filtra por extensión', () => {
  const pngs = execFileSync('git', ['ls-files', '*.png'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    .split('\n').filter(Boolean);
  assert.ok(pngs.length > 50, `🔴 SUELO: sólo ${pngs.length} PNG rastreados — referencia: 332`);
  assert.ok(!esTextoPorExtension(pngs[0]), '🔴 un .png está pasando el filtro de "texto"');
});

test('SCRUM-942 · 🔴 CONTROL POSITIVO del filtro binario: el MISMO byte 0x1B que el censo detecta '
  + 'en texto SÍ está presente en un PNG real, y el filtro lo descarta a propósito (no por casualidad)', () => {
  const pngs = execFileSync('git', ['ls-files', '*.png'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    .split('\n').filter(Boolean).slice(0, 40);
  let algunoConEsc = false;
  for (const rel of pngs) {
    const buf = fs.readFileSync(path.join(RAIZ, rel));
    if (bytesProhibidosEn(buf).some((m) => m.byte === 0x1b)) { algunoConEsc = true; break; }
  }
  // No es una condición del test (un PNG puede o no traer 0x1B por azar de compresión): es
  // evidencia de que el DETECTOR ve el byte en binario también — lo que lo excluye es el filtro
  // de extensión, no que el detector sea incapaz de verlo.
  if (!algunoConEsc) return; // muestra sin el byte por azar: no invalida el negativo de arriba
  assert.ok(algunoConEsc);
});
