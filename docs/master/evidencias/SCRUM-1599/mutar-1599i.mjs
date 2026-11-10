// SCRUM-1599i · las mutaciones de los lotes 2 y 3 del diseño B, CON BASE. La lista NO vive aquí: cada test
// la declara en `MUTACIONES_CON_BASE`, al lado de `MUTACIONES_QUE_ME_TUMBAN` (la del meta-guard), como hace
// SCRUM-1390e. No van a la del meta-guard porque su job corre SIN base: un caso saltado en la pasada limpia
// es CIEGO (PUERTA 1a de `scripts/meta-guard-mutaciones.mjs`) y el job saldría con 2.
// La lista se lee por AST (importar el test lo ejecutaría). Por fichero: una pasada LIMPIA con el banco; por
// mutación: su texto tiene que salir UNA vez en el src, se transpila a su sitio en dist/, se corre el test con
// el banco (banco-1599h), y dist/ se restaura comprobando que vuelve byte a byte. MUERE si su caso `cae` cae;
// VIVE si no; CIEGA si el texto no sale una vez, si su caso no pasó en la limpia o si el banco no devuelve casos.
// Uso: node mutar-1599i.mjs <raíz del árbol, con dist/> <dir del banco (banco.mjs + ddl.sql)> <tests/f.test.mjs>...
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [raiz, banco, ...tests] = process.argv.slice(2);
if (!raiz || !banco || tests.length === 0) { console.log('CIEGO: faltan argumentos · EXIT=2'); process.exit(2); }
const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const opciones = { ...ts.convertCompilerOptionsFromJson(JSON.parse(fs.readFileSync(path.join(raiz, 'tsconfig.json'), 'utf8')).compilerOptions, raiz).options, sourceMap: false };

function declaradas(test) {
  const sf = ts.createSourceFile(test, fs.readFileSync(path.join(raiz, test), 'utf8'), ts.ScriptTarget.Latest, true);
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (d.name.getText(sf) !== 'MUTACIONES_CON_BASE' || !d.initializer || !ts.isArrayLiteralExpression(d.initializer)) continue;
      return d.initializer.elements.map((o) => Object.fromEntries(o.properties.map((p) => {
        if (!ts.isStringLiteralLike(p.initializer)) throw new Error(`${test}: un campo no es literal`);
        return [p.name.getText(sf), p.initializer.text];
      })));
    }
  }
  return [];
}

function pasar(test, etiqueta) {
  const salida = path.join(banco, `mut-${path.basename(test)}-${etiqueta}.json`);
  fs.rmSync(salida, { force: true });
  spawnSync(process.execPath, [path.join(banco, 'banco.mjs'), raiz, path.join(banco, 'ddl.sql'), salida, test], { cwd: banco, encoding: 'utf8' });
  return fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, 'utf8'))[0]?.casos ?? {} : {};
}

// Qué aserción cayó (un caso puede caer por otra cosa que lo mutado): el primer `error:` del TAP del caso.
function porQue(test) {
  const tap = path.join(banco, `tap-${path.basename(test)}.tap`);
  const lineas = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  const i = lineas.findIndex((l) => /^\s+error: /.test(l));
  if (i < 0) return '(sin línea error: en el TAP)';
  // `error: |-` es un bloque YAML: el mensaje va en la línea siguiente.
  const linea = /\|-?\s*$/.test(lineas[i]) ? `error: ${(lineas[i + 1] || '').trim()}` : lineas[i].trim();
  return linea.slice(0, 160);
}

let n = 0; let vivas = 0; let ciegas = 0;
for (const test of tests) {
  const lista = declaradas(test);
  if (!lista.length) { console.log(`CIEGO · ${test} no declara MUTACIONES_CON_BASE`); ciegas++; continue; }
  const limpia = pasar(test, 'limpia');
  const okLimpia = Object.entries(limpia).filter(([, v]) => v === 'ok').map(([k]) => k);
  console.log(`== ${test} · limpia: ${okLimpia.length} ok de ${Object.keys(limpia).length}`);
  for (const [i, m] of lista.entries()) {
    n++;
    const etiqueta = `M${n} · ${m.fichero} · «${m.de.trim().slice(0, 60)}» → «${m.a.trim().slice(0, 50)}»`;
    const src = fs.readFileSync(path.join(raiz, m.fichero), 'utf8');
    const veces = src.split(m.de).length - 1;
    if (veces !== 1) { console.log(`CIEGO · ${etiqueta} · el texto sale ${veces} veces`); ciegas++; continue; }
    if (!okLimpia.some((k) => k.includes(m.cae))) { console.log(`CIEGO · ${etiqueta} · «${m.cae}» no pasó en la limpia`); ciegas++; continue; }
    const js = path.join(raiz, 'dist', m.fichero.replace(/^src\//, '').replace(/\.ts$/, '.js'));
    const original = fs.readFileSync(js);
    let casos;
    try {
      fs.writeFileSync(js, ts.transpileModule(src.replace(m.de, m.a), { compilerOptions: opciones }).outputText);
      casos = pasar(test, `m${i}`);
    } finally {
      fs.writeFileSync(js, original);
    }
    if (!fs.readFileSync(js).equals(original)) { console.log('🔴 dist/ NO quedó restaurado · EXIT=3'); process.exit(3); }
    const total = Object.keys(casos).length;
    if (!total) { console.log(`CIEGO · ${etiqueta} · el banco no devolvió casos`); ciegas++; continue; }
    const caen = Object.entries(casos).filter(([, v]) => v === 'not ok').map(([k]) => k);
    const suyo = caen.some((k) => k.includes(m.cae));
    if (!suyo) vivas++;
    console.log(`${suyo ? 'MUERE' : '🔴 VIVE'} · ${etiqueta} · ${caen.length} de ${total} caen · su caso («${m.cae}») ${suyo ? 'cae' : 'NO cae'}`);
    for (const c of caen) console.log('    · ' + c.slice(0, 120));
    if (caen.length) console.log('      ' + porQue(test));
  }
}
console.log(`POBLACION=${n} mutaciones en ${tests.length} ficheros · vivas=${vivas} · ciegas=${ciegas} · dist restaurado byte a byte · EXIT=${ciegas || vivas || !n ? 2 : 0}`);
process.exit(ciegas || vivas || !n ? 2 : 0);
