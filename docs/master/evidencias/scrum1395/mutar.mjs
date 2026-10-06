// SCRUM-1395 · banco de mutaciones del trinquete «el filtro sin suelo no crece».
// Uso (desde la raiz, con el arbol COMMITEADO):  node docs/master/evidencias/scrum1395/mutar.mjs
// Cada mutacion se aplica, se corre `tests/scrum719…`, se apunta QUE casos caen y se devuelve el
// arbol byte a byte. Primero va la BASE sin mutar: sin ella, un caso inestable se lee como muerte.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const T = (f) => path.join(RAIZ, 'tests', f);
const GUARD = 'tests/scrum719-el-suelo-de-los-doce.test.mjs';
const JSON_H = T('_filtro-sin-suelo-heredados.json');
const S589 = T('scrum589-nombre-por-documento.test.mjs');
const S719 = T('scrum719-el-suelo-de-los-doce.test.mjs');
const NUEVO = T('scrum9395-test-inventado-sin-suelo.test.mjs');
const FUENTE_NUEVO = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { soloEjecutable } from './_guard-texto.mjs';\n"
  + "test('inventado', () => { assert.ok(!/PROHIBIDO/.test(soloEjecutable('const a = 1;'))); });\n";

const env = { ...process.env };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'NO_COLOR']) delete env[k];
const sha = (p) => (fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'NO-EXISTE');
const correr = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', GUARD], { cwd: RAIZ, encoding: 'utf8', env, timeout: 180000 });
  const s = `${r.stdout || ''}${r.stderr || ''}`;
  const n = (k) => Number((s.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1]);
  return { exit: r.status, tests: n('tests'), fail: n('fail'), caidos: [...s.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]) };
};
const cambiar = (p, de, a) => {
  const t = fs.readFileSync(p, 'utf8');
  if (t.split(de).length !== 2) throw new Error(`ancla de la mutacion no encontrada exactamente una vez en ${path.basename(p)}: ${de}`);
  fs.writeFileSync(p, t.replace(de, a), 'utf8');
};
const heredados = () => JSON.parse(fs.readFileSync(JSON_H, 'utf8'));
const escribirH = (h) => fs.writeFileSync(JSON_H, `${JSON.stringify(h, null, 2)}\n`, 'utf8');

const MUTACIONES = [
  ['M1 nace un test que llama a soloEjecutable sin suelo', '② un test NUEVO', () => fs.writeFileSync(NUEVO, FUENTE_NUEVO, 'utf8')],
  ['M2 nace ese test y se le cuela en la lista (sin tocar el techo)', '③ la lista de heredados', () => {
    fs.writeFileSync(NUEVO, FUENTE_NUEVO, 'utf8');
    const h = heredados(); h.ficheros.push(path.basename(NUEVO)); escribirH(h);
  }],
  ['M3 se cuela en la lista Y se sube el techo (las dos manos): el trinquete NO puede verlo', null, () => {
    fs.writeFileSync(NUEVO, FUENTE_NUEVO, 'utf8');
    const h = heredados(); h.ficheros.push(path.basename(NUEVO)); escribirH(h);
    cambiar(S719, 'const TECHO_HEREDADOS_1395 = 85;', 'const TECHO_HEREDADOS_1395 = 86;');
  }],
  ['M4 se borra un heredado de la lista sin arreglarlo', '② un test NUEVO', () => { const h = heredados(); h.ficheros.shift(); escribirH(h); }],
  ['M5 un nombre de mas en la lista (un fichero que no llama al filtro)', '③ la lista de heredados', () => {
    const h = heredados(); h.ficheros.push('pdfs.test.mjs'); escribirH(h);
  }],
  ['M6 scrum589 vuelve a la forma sin suelo', '④ `scrum589`', () => {
    cambiar(S589, "ejecutableDe(src, { ancla: 'dfNote.textContent', donde: VISTA })", 'soloEjecutable(src)');
    cambiar(S589, "import { ejecutableDe } from './_guard-texto.mjs';", "import { soloEjecutable } from './_guard-texto.mjs';");
  }],
  ['M7 la lista pierde por que se toleran', '③ la lista de heredados', () => { const h = heredados(); delete h.porQueSeToleran; escribirH(h); }],
];

const PIEZAS = [JSON_H, S589, S719];
const antes = PIEZAS.map((p) => [p, fs.readFileSync(p)]);
const shaAntes = PIEZAS.map(sha).join(' ');
const restaurar = () => { for (const [p, b] of antes) fs.writeFileSync(p, b); fs.rmSync(NUEVO, { force: true }); };

console.log(`POBLACION: ${MUTACIONES.length} mutaciones sobre ${GUARD}`);
const base = correr();
console.log(`BASE sin mutar: exit=${base.exit} tests=${base.tests} fail=${base.fail}`);
if (base.exit !== 0 || !base.tests) { console.log('CIEGO: la base no esta verde, no se muta nada'); process.exit(2); }
let vivas = 0; let mudas = 0; let esperadasMudas = 0;
try {
  for (const [nombre, debeCaer, aplicar] of MUTACIONES) {
    restaurar();
    aplicar();
    const aplicada = PIEZAS.map(sha).join(' ') !== shaAntes || fs.existsSync(NUEVO);
    const r = correr();
    const cae = r.caidos.some((c) => debeCaer && c.includes(debeCaer));
    let veredicto;
    if (!aplicada) veredicto = 'CIEGA (la mutacion no cambio nada)';
    else if (debeCaer === null) { veredicto = r.exit === 0 ? 'MUDA, y se DECLARA: es el limite del trinquete' : 'cae (no se esperaba)'; if (r.exit === 0) esperadasMudas++; }
    else if (cae) { veredicto = 'VIVA'; vivas++; } else { veredicto = 'MUDA  <-- el trinquete no la ve'; mudas++; }
    console.log(`\n${nombre}\n   aplicada=${aplicada} exit=${r.exit} tests=${r.tests} fail=${r.fail} -> ${veredicto}`);
    for (const c of r.caidos) console.log(`   cae: ${c}`);
  }
} finally { restaurar(); }
const igual = PIEZAS.map(sha).join(' ') === shaAntes && !fs.existsSync(NUEVO);
console.log(`\nVIVAS ${vivas} · MUDAS ${mudas} · mudas declaradas ${esperadasMudas} · de ${MUTACIONES.length}`);
console.log(`ARBOL devuelto byte a byte: ${igual ? 'SI' : 'NO  <-- MIRAR A MANO'}`);
console.log(`EXIT=${igual && !mudas ? 0 : 1}`);
process.exit(igual && !mudas ? 0 : 1);
