// docs/master/evidencias/SCRUM-1396/los-que-cambian.mjs — SCRUM-1396
//
// De cada llamada que deja de salir GARANTIZADA al emparejar por variable, enseña lo que hay que
// LEER para juzgarla, en vez de agruparlas por parecido: la línea que crea, la función que la
// contiene, por dónde sale el directorio, y el texto de cada borrado que antes se le atribuía —con
// su cobertura— y de los que se le siguen atribuyendo.
//
// Y cuenta los LLAMADORES de la función que crea: cuántas veces se la llama en su fichero y cuántas
// de esas llamadas tienen un borrado cubierto en su misma función. Es una cuenta por contención, no
// una prueba: dice dónde mirar.
//
// No escribe nada. Uso:  node docs/master/evidencias/SCRUM-1396/los-que-cambian.mjs [raíz]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { censar as censarAntes } from './censo-por-nombre-c92d8182.mjs';
import { censar as censarAhora } from '../../../../scripts/_censo-mkdtemp.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(process.argv[2] || path.join(AQUI, '..', '..', '..', '..'));
const clave = (l) => `${l.fichero}:${l.linea}`;
const antes = new Map(censarAntes(RAIZ).nuestras.map((l) => [clave(l), l]));
const ahora = censarAhora(RAIZ);
const cambian = ahora.nuestras.filter((l) => antes.has(clave(l)) && antes.get(clave(l)).categoria !== l.categoria);

const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
const funcionDe = (n) => { for (let p = n.parent; p; p = p.parent) if (esFuncion(p)) return p; return null; };
const nombreDe = (f) => !f ? null : ts.isFunctionDeclaration(f) && f.name ? f.name.text
  : f.parent && ts.isVariableDeclaration(f.parent) && ts.isIdentifier(f.parent.name) ? f.parent.name.text : null;
const cubierto = (n) => {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isBlock(p) && p.parent && ts.isTryStatement(p.parent) && p.parent.finallyBlock === p) return 'finally';
    if (ts.isCallExpression(p)) {
      const e = p.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (/^after(Each|All)?$/.test(nombre)) return 'hook';
      if (/^(on|once)$/.test(nombre)) return 'on';
    }
  }
  return null;
};

console.log(`LOS QUE CAMBIAN · ${cambian.length} de ${ahora.nuestras.length} llamadas nuestras`);
const resumen = [];
for (const l of cambian) {
  const fuente = fs.readFileSync(path.join(RAIZ, l.fichero), 'utf8');
  const lineas = fuente.split(/\r?\n/);
  const sf = ts.createSourceFile(l.fichero, fuente, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  let crea = null; const llamadas = []; const borrados = [];
  const ver = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (/^mkdtemp(Sync)?$/.test(nombre) && lineaDe(n) === l.linea) crea = n;
      if (/^(rmSync|rm|rmdirSync|rmdir)$/.test(nombre)) borrados.push(n);
      if (ts.isIdentifier(e)) llamadas.push(n);
    }
    ts.forEachChild(n, ver);
  };
  ts.forEachChild(sf, ver);
  const fn = crea ? funcionDe(crea) : null;
  const nombreFn = nombreDe(fn);
  // Los llamadores de la función que crea, y si en SU función hay algún borrado cubierto.
  const suyas = nombreFn ? llamadas.filter((c) => c.expression.text === nombreFn) : [];
  const conBorrado = suyas.filter((c) => {
    const f = funcionDe(c);
    return borrados.some((b) => cubierto(b) && (f ? funcionDe(b) === f || (() => { for (let p = b.parent; p; p = p.parent) if (p === f) return true; return false; })() : !funcionDe(b)));
  });
  const sinBorrado = suyas.filter((c) => !conBorrado.includes(c));
  console.log('');
  console.log(`${clave(l)} · ${l.destino} · ${antes.get(clave(l)).categoria} → ${l.categoria}`);
  console.log(`   crea ......... ${lineas[l.linea - 1].trim().slice(0, 150)}`);
  console.log(`   dentro de .... ${fn ? `${nombreFn || '(función sin nombre)'}, línea ${lineaDe(fn)}` : 'el fichero, fuera de toda función'}`);
  for (const b of l.borradoEn) console.log(`   se le atribuye  ${b}: ${lineas[b - 1].trim().slice(0, 130)}`);
  for (const b of l.borradoAjenoEn) console.log(`   ya no ......... ${b}: ${lineas[b - 1].trim().slice(0, 130)}`);
  if (nombreFn) console.log(`   llamadores ... ${suyas.length} de ${nombreFn}() en este fichero · ${conBorrado.length} con un borrado cubierto en su función · ${sinBorrado.length} sin él${sinBorrado.length ? ' (líneas ' + sinBorrado.map(lineaDe).join(', ') + ')' : ''}`);
  resumen.push({ l, nombreFn, llamadores: suyas.length, sin: sinBorrado.length });
}
console.log('');
console.log('RESUMEN');
const por = (c) => resumen.filter((r) => r.l.categoria === c);
console.log(`  ESCAPA ........... ${por('ESCAPA').length} · con función nombrada ${por('ESCAPA').filter((r) => r.nombreFn).length} · con algún llamador SIN borrado cubierto en su función: ${por('ESCAPA').filter((r) => r.sin > 0).length}`);
console.log(`  NO_GARANTIZADA ... ${por('NO_GARANTIZADA').length}`);
console.log(`  SIN_LIMPIEZA ..... ${por('SIN_LIMPIEZA').length}`);
