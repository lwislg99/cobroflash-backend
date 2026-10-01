// docs/master/evidencias/scrum1344/migrar.mjs — SCRUM-1344
//
// CÓMO SE MIGRARON LOS ARNESES SIN ROL, para que no dependa de la mano de nadie.
//
//     node docs/master/evidencias/scrum1344/migrar.mjs            (dice qué haría)
//     node docs/master/evidencias/scrum1344/migrar.mjs --aplicar
//
// Para cada arnés que el censo por AST clasifica «sin-rol», envuelve el literal del `req` en
// `reqDeSesion({ rol: 'admin', … })` y añade el import. NO toca nada más: ni una aserción, ni el
// orden de las claves, ni el número de líneas del fichero (el import se añade en la MISMA línea
// del último import, porque hay documentos que citan estos tests por `fichero:línea`).
//
// Dos pasadas, por un motivo: en `pedir(db, { merchantId, query })` el literal de fuera es una
// bolsa de opciones y el `req` de verdad se arma DENTRO de `pedir`. La primera pasada envuelve solo
// los literales que NO se le pasan a una función del propio fichero; se vuelve a censar, y lo que
// siga sin rol (el `req` que una función local reenvía tal cual) se envuelve en la segunda.
//
// El rol es `admin` porque es el del propietario, el llamante por defecto de `requireAuth`. Si con
// `admin` un test deja de pasar, NO se toca la aserción: se para y se mira (está en el registro).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const aplicar = process.argv.includes('--aplicar');
const { analizarFuente, clasificar, mapaDeRouters, ficherosDeTests, CLASES, CONSTRUCTOR } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_censo-arneses-de-router.mjs')).href);
const mapa = await mapaDeRouters(RAIZ);
const IMPORT = `import { ${CONSTRUCTOR} } from './_arnes-de-router.mjs';`;

/** Los sitios sin rol de una fuente. Los de `{ merchantId, ...resto }` cuentan: en un fichero que no nombra `userRole`, el rol no viene en `resto`. */
function sinRolEn(fichero, fuente) {
  const fila = analizarFuente(fichero, fuente);
  return { clase: clasificar(fila, mapa).clase, sitios: fila.sitios.filter((x) => x.rol === 'sin-rol' || x.rol === 'indeterminado') };
}

function envolver(fuente, sitios) {
  let s = fuente;
  for (const sitio of [...sitios].sort((a, b) => b.desde - a.desde)) {
    const literal = s.slice(sitio.desde, sitio.hasta);
    if (!literal.startsWith('{') || !literal.endsWith('}')) throw new Error(`no es un literal: ${literal.slice(0, 40)}`);
    const resto = literal.slice(1);
    s = s.slice(0, sitio.desde) + `${CONSTRUCTOR}({ rol: 'admin',` + (/^\s/.test(resto) ? '' : ' ') + resto + ')' + s.slice(sitio.hasta);
  }
  return s;
}

function conImport(fuente, fichero) {
  if (fuente.includes(IMPORT)) return fuente;
  const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const imports = sf.statements.filter((n) => ts.isImportDeclaration(n));
  if (imports.length === 0) throw new Error(`${fichero}: no tiene ningún import estático al que pegarse`);
  const fin = imports[imports.length - 1].end;
  return fuente.slice(0, fin) + ' ' + IMPORT + fuente.slice(fin);
}

const informe = [];
let tocados = 0;
let aMano = 0;
for (const fichero of ficherosDeTests(RAIZ)) {
  let fuente = fs.readFileSync(path.join(RAIZ, 'tests', fichero), 'utf8');
  let { clase, sitios } = sinRolEn(fichero, fuente);
  if (clase !== CLASES.K) continue;
  const lineasAntes = fuente.split('\n').length;
  let envueltos = 0;
  for (const pasada of [1, 2]) {
    const literales = sitios.filter((x) => x.forma !== 'asignacion' && (pasada === 2 || !x.pasaA));
    if (literales.length === 0) continue;
    fuente = conImport(envolver(fuente, literales), fichero);
    envueltos += literales.length;
    ({ clase, sitios } = sinRolEn(fichero, fuente));
  }
  const quedan = sitios.filter((x) => x.forma === 'asignacion').length;
  if (quedan) aMano++;
  const lineasDespues = fuente.split('\n').length;
  if (lineasDespues !== lineasAntes) throw new Error(`${fichero}: cambia el número de líneas (${lineasAntes} → ${lineasDespues})`);
  informe.push(`${fichero} · ${envueltos} literal(es) envuelto(s) · queda ${clase}${quedan ? ` · ${quedan} asignación(es) \`req.merchantId =\` que se migran A MANO` : ''}`);
  if (aplicar && envueltos) { fs.writeFileSync(path.join(RAIZ, 'tests', fichero), fuente); tocados++; }
}
console.log(`POBLACION=${informe.length} arneses sin rol`);
for (const l of informe) console.log(l);
console.log(`${aplicar ? 'ESCRITOS' : 'SE ESCRIBIRÍAN'}: ${aplicar ? tocados : informe.length} · con algo que migrar a mano: ${aMano}`);
console.log('EXIT=0');
process.exit(0);
