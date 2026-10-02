#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/d-mutaciones.mjs — SCRUM-1339d
//
// VER CAER cada mutación que declara un test, de una en una y a mano, sin lanzar el meta-guard
// entero (404 mutaciones). ⚠️ MUTA ficheros del árbol: se lanza con TODO commiteado, restaura en
// un `finally` y comprueba los BYTES después de cada una; al final imprime `git status`.
//
//   node d-mutaciones.mjs <raíz del repo> <tests/el-fichero.test.mjs>
//
// Lee la declaración por AST, sin importar el test (importarlo lo ejecutaría). Primero la BASE sin
// mutar: sin ella, un test inestable que cae se lee como un mutante que muere.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [raiz, relTest] = process.argv.slice(2);
if (!raiz || !relTest) { console.error('uso: node d-mutaciones.mjs <raíz del repo> <tests/x.test.mjs>'); process.exit(2); }
const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

function declaradas() {
  const codigo = fs.readFileSync(path.join(raiz, relTest), 'utf8');
  const sf = ts.createSourceFile(relTest, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let texto = null;
  (function recorrer(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'MUTACIONES_QUE_ME_TUMBAN' && n.initializer) texto = n.initializer.getText(sf);
    ts.forEachChild(n, recorrer);
  })(sf);
  if (texto === null) throw new Error(`${relTest} no declara MUTACIONES_QUE_ME_TUMBAN`);
  return new Function('return ' + texto)();
}

function pasada(etiqueta) {
  const tap = path.join(os.tmpdir(), `scrum1339d-mut-${process.pid}-${etiqueta}.tap`);
  fs.rmSync(tap, { force: true });
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR', 'GITHUB_ACTIONS', 'GITHUB_STEP_SUMMARY']) delete env[k];
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, relTest], { cwd: raiz, env, encoding: 'utf8' });
  if (!fs.existsSync(tap)) return { ciego: `no dejó TAP (salida ${r.status})` };
  const lineas = fs.readFileSync(tap, 'utf8').split('\n');
  fs.rmSync(tap, { force: true });
  const num = (k) => { const l = lineas.find((x) => new RegExp(`^# ${k} \\d+`).test(x)); return l ? Number(l.match(/\d+/)[0]) : null; };
  const caidos = lineas.filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''));
  const pasados = lineas.filter((l) => /^ok \d+ - /.test(l)).map((l) => l.replace(/^ok \d+ - /, ''));
  if (num('tests') === null) return { ciego: `el TAP no tiene resumen (salida ${r.status})` };
  return { salida: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), caidos, pasados };
}

const muts = declaradas();
console.log(`POBLACIÓN: ${muts.length} mutaciones declaradas en ${relTest}`);
const base = pasada('base');
if (base.ciego) { console.log(`BASE CIEGA: ${base.ciego}`); console.log('EXIT=3'); process.exit(3); }
console.log(`BASE sin mutar: tests ${base.tests} · pass ${base.pass} · fail ${base.fail} · salida ${base.salida}`);
if (base.fail !== 0) { console.log('LA BASE YA CAE: no se muta nada.'); console.log('EXIT=3'); process.exit(3); }

let vivas = 0; let mudas = 0; let ciegas = 0;
for (const [i, m] of muts.entries()) {
  const ruta = path.join(raiz, m.fichero);
  const original = fs.readFileSync(ruta);
  const texto = original.toString('utf8');
  const veces = texto.split(m.de).length - 1;
  const enLaBase = base.pasados.includes(m.cae);
  if (veces !== 1 || !enLaBase) {
    ciegas++;
    console.log(`  ${i + 1}. CIEGA · ${m.fichero} · el ancla aparece ${veces} vez/veces · el test «cae» ${enLaBase ? 'está' : 'NO está'} entre los pasados de la base`);
    continue;
  }
  let r;
  try {
    fs.writeFileSync(ruta, texto.replace(m.de, m.a));
    const aplicado = sha(fs.readFileSync(ruta)) !== sha(original);
    r = pasada(`m${i + 1}`);
    r.aplicado = aplicado;
  } finally {
    fs.writeFileSync(ruta, original);
  }
  const restaurado = sha(fs.readFileSync(ruta)) === sha(original);
  if (!restaurado) { console.log(`🔴 NO SE RESTAURÓ ${m.fichero}`); console.log('EXIT=3'); process.exit(3); }
  if (r.ciego || !r.aplicado) { ciegas++; console.log(`  ${i + 1}. CIEGA · ${m.fichero} · ${r.ciego ?? 'la mutación no cambió el fichero'}`); continue; }
  const cayo = r.caidos.includes(m.cae);
  const aparece = cayo || r.pasados.includes(m.cae);
  if (cayo) vivas++; else if (aparece) mudas++; else ciegas++;
  console.log(`  ${i + 1}. ${cayo ? 'VIVA ' : aparece ? 'MUDA ' : 'CIEGA'} · ${m.fichero} · mutada: tests ${r.tests} · fail ${r.fail} (de ${base.tests} en la base) · restaurado: sí`);
  console.log(`       cae: «${m.cae.slice(0, 110)}»${cayo ? '' : aparece ? ' — PASÓ con la mutación puesta' : ' — NO APARECE en la pasada mutada'}`);
  if (cayo && r.caidos.length > 1) console.log(`       además cayeron ${r.caidos.length - 1}: ${r.caidos.filter((x) => x !== m.cae).map((x) => '«' + x.slice(0, 60) + '»').join(' ')}`);
}
console.log(`vivas ${vivas} · mudas ${mudas} · ciegas ${ciegas} · de ${muts.length}`);
const estado = spawnSync('git', ['status', '--porcelain', '--', 'scripts', 'tests'], { cwd: raiz, encoding: 'utf8' }).stdout.trim();
console.log(`git status de scripts/ y tests/ al acabar: ${estado === '' ? 'limpio' : '\n' + estado}`);
console.log(`EXIT=${mudas || ciegas ? 1 : 0}`);
process.exit(mudas || ciegas ? 1 : 0);
