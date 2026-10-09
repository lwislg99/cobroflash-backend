// Cruza las lineas de veredicto del log del meta-guard en CI con las declaraciones del arbol.
// USO: node cruce-log.mjs <raiz del arbol> <log>
// Compara CONJUNTOS (guard + cae), no cuentas. Controles: una pareja inventada tiene que dar 0.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2]);
const LOG = process.argv[3];
const m = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const { poblacion, censo } = m.censoConPoblacion();
const decl = [];
for (const c of censo) for (const mu of c.mutaciones) decl.push({ guard: c.guard, cae: mu.cae, fichero: mu.fichero });
const clave = (g, c) => g + ' · ' + c;

const lineas = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).map((l) => l.replace(/^\S+Z\s/, ''));
const marca = (g) => lineas.filter((l) => l.startsWith('  ' + g + ' '));
const vivasLog = marca('✔').map((l) => l.slice(4).replace(/\s+\(\+\d+ test\(s\) más caídos\)$/, ''));
const otras = lineas.filter((l) => /^\s*✔ /.test(l) && !l.startsWith('  ✔ '));
console.log('POBLACION · ficheros de test del arbol: ' + poblacion + ' · declarantes: ' + censo.filter((c) => c.mutaciones.length).length + ' · declaraciones: ' + decl.length);
console.log('LOG · lineas «  ✔ »: ' + vivasLog.length + ' · «  ✖ »: ' + marca('✖').length + ' · «  ? »: ' + marca('?').length + ' · «  ☠ »: ' + marca('☠').length + ' · lineas con ✔ que NO son de veredicto: ' + otras.length);
for (const o of otras) console.log('     otra: ' + o.slice(0, 160));

// multiconjuntos
const cuenta = (xs) => { const mp = new Map(); for (const x of xs) mp.set(x, (mp.get(x) || 0) + 1); return mp; };
const D = cuenta(decl.map((d) => clave(d.guard, d.cae)));
const L = cuenta(vivasLog);
let soloD = 0; let soloL = 0;
for (const [k, n] of D) { const d = n - (L.get(k) || 0); if (d > 0) { soloD += d; console.log('   SOLO EN EL ARBOL (x' + d + '): ' + k.slice(0, 170)); } }
for (const [k, n] of L) { const d = n - (D.get(k) || 0); if (d > 0) { soloL += d; console.log('   SOLO EN EL LOG  (x' + d + '): ' + k.slice(0, 170)); } }
console.log('CRUCE · declaraciones sin su linea viva en el log: ' + soloD + ' · lineas vivas del log sin declaracion en el arbol: ' + soloL);
console.log('PAREJAS DISTINTAS (guard, cae): ' + D.size + ' de ' + decl.length + ' declaraciones · repetidas: ' + (decl.length - D.size));
console.log('CONTROL A CERO · la pareja inventada «scrum9999-no-existe.test.mjs · nada»: en el arbol ' + (D.get(clave('scrum9999-no-existe.test.mjs', 'nada')) || 0) + ' · en el log ' + (L.get(clave('scrum9999-no-existe.test.mjs', 'nada')) || 0));
const primero = decl[0];
console.log('CONTROL POSITIVO · la primera declaracion del arbol («' + clave(primero.guard, primero.cae).slice(0, 90) + '»): en el log ' + (L.get(clave(primero.guard, primero.cae)) || 0));

// Que muta cada declaracion: a donde apunta `fichero`
const zona = (f) => (f.startsWith('tests/') ? 'tests/' : f.startsWith('src/') ? 'src/' : f.startsWith('scripts/') ? 'scripts/' : f.startsWith('public/') ? 'public/' : f.startsWith('docs/') ? 'docs/' : f.startsWith('.github/') ? '.github/' : f.startsWith('.claude/') ? '.claude/' : f.includes('/') ? f.split('/')[0] + '/' : '(raiz)');
const z = cuenta(decl.map((d) => zona(String(d.fichero).replace(/\\/g, '/'))));
console.log('QUE SE MUTA · por carpeta del fichero mutado: ' + JSON.stringify(Object.fromEntries([...z].sort((a, b) => b[1] - a[1]))));
const distintos = new Set(decl.map((d) => String(d.fichero).replace(/\\/g, '/')));
console.log('FICHEROS MUTADOS distintos: ' + distintos.size + ' · de ellos en src/: ' + [...distintos].filter((f) => f.startsWith('src/')).length + ' · en public/: ' + [...distintos].filter((f) => f.startsWith('public/')).length);
const seMutaASiMismo = decl.filter((d) => String(d.fichero).replace(/\\/g, '/') === 'tests/' + d.guard).length;
console.log('DECLARACIONES que mutan EL PROPIO fichero del test: ' + seMutaASiMismo + ' de ' + decl.length);
