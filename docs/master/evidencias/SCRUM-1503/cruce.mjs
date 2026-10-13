// docs/master/evidencias/SCRUM-1503/cruce.mjs — SCRUM-1503
//
// EL CRUCE. Por cada test, compara lo que LISTÓ AL EJECUTARSE (la sonda, `sonda-fs.mjs`) con lo
// que la herramienta le atribuye leyendo su fuente (`analizarArbol` y `razonDe`, los de
// `scripts/_tests-que-cubren.mjs`: no se copian, se importan).
//
// La pregunta, por test y por fichero seguido por git:
//   «este test listó en ejecución el directorio donde vive este fichero;
//    si alguien TOCA el fichero, ¿la herramienta trae el test?»
// Un par (test, fichero) con respuesta NO es un par CIEGO. Un test con algún par ciego entra en
// la población que pide el ticket.
//
//   node docs/master/evidencias/SCRUM-1503/cruce.mjs --crudo <dir> [<dir> …]   consolida las salidas de la
//                                                   sonda en `sonda-consolidada.json` y cruza
//   node docs/master/evidencias/SCRUM-1503/cruce.mjs                          cruza desde el consolidado
//   … [--tsv <fichero>]   la tabla por test
//
// DE QUÉ NO RESPONDE, DICHO:
//   · Listar un directorio no es depender del contenido de cada fichero suyo: es el techo, no la cifra.
//   · Un hijo que limpia su entorno no lleva sonda: lo que liste no se ve (se cuentan los tests que lanzan node).
//   · Una enumeración hecha por git (`git ls-files`, `git grep`) se ve como proceso, sin su directorio de
//     trabajo: se cuenta aparte y no entra en los pares.
//   · Un test que SALTA (gateado) o muere al cargar no lista nada: se cuentan aparte.
//
// Sólo LEE el árbol (escribe el consolidado y el TSV). Primera línea: población. Última: EXIT.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analizarArbol, razonDe, motivosParaNoFiarse } from '../../../../scripts/_tests-que-cubren.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const CONSOLIDADO = path.join(AQUI, 'sonda-consolidada.json');
const args = process.argv.slice(2);
const iCrudo = args.indexOf('--crudo');
const iTsv = args.indexOf('--tsv');
const tsvRuta = iTsv >= 0 ? args[iTsv + 1] : null;
const crudos = [];
if (iCrudo >= 0) for (let i = iCrudo + 1; i < args.length && !args[i].startsWith('--'); i += 1) crudos.push(args[i]);

const NADIE = '(nadie del repositorio en la pila)';
const GIT_ENUMERA = /^git(\.exe)? (ls-files|ls-tree|grep)\b/;

// ── 1 · consolidar ───────────────────────────────────────────────────────────────────────────
if (crudos.length) {
  const porTest = {};
  for (const dir of crudos) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.fin.json')).sort()) {
      const fin = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const jsonl = path.join(dir, f.replace(/\.fin\.json$/, '.jsonl'));
      let lineas = [];
      try { lineas = fs.readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { lineas = []; }
      const dirs = new Map();
      let testigos = 0;
      let lanzaNode = 0;
      const gitEnum = new Set();
      for (const l of lineas) {
        if (l.t === 'testigo') testigos += 1;
        if (l.t === 'dir') {
          const k = `${l.por}\t${l.ruta}`;
          dirs.set(k, Boolean(dirs.get(k)) || Boolean(l.rec));
        }
        if (l.t === 'proc') {
          // La ruta de node lleva espacios («Program Files»): no se parte por espacios.
          if (/(^|[\\/])node(\.exe)?(\s|$)/i.test(l.orden)) lanzaNode += 1;
          const m = GIT_ENUMERA.exec(l.orden);
          if (m) gitEnum.add(`git ${m[2]}`);
        }
      }
      // por → [[ruta, recursivo 0/1], …]
      const agrupado = {};
      for (const [k, rec] of dirs) {
        const [por, ruta] = k.split('\t');
        (agrupado[por] ||= []).push(rec ? [ruta, 1] : [ruta]);
      }
      porTest[fin.test] = {
        fin: { codigo: fin.codigo, colgado: fin.colgado, tests: fin.tests, pass: fin.pass, fail: fin.fail, skipped: fin.skipped },
        testigos, lanzaNode, gitEnum: [...gitEnum].sort(), dirs: agrupado,
      };
    }
  }
  const ordenado = Object.fromEntries(Object.keys(porTest).sort().map((k) => [k, porTest[k]]));
  fs.writeFileSync(CONSOLIDADO, `${JSON.stringify(ordenado)}\n`);
}

// ── 2 · cruzar ───────────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(CONSOLIDADO)) {
  console.log('POBLACION: 0 · no hay `sonda-consolidada.json`: corre la sonda y pasa `--crudo`.');
  console.log('EXIT=2');
  process.exit(2);
}
const sonda = JSON.parse(fs.readFileSync(CONSOLIDADO, 'utf8'));
const arbol = analizarArbol(RAIZ);
const motivos = motivosParaNoFiarse(arbol);
const seguidos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0').filter(Boolean);
const dirDe = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.');
const directos = new Map();
const dirsSeguidos = new Set(['.']);
for (const f of seguidos) {
  const d = dirDe(f);
  if (!directos.has(d)) directos.set(d, []);
  directos.get(d).push(f);
  for (let p = d; p !== '.'; p = dirDe(p)) dirsSeguidos.add(p);
}
const bajo = (d) => (d === '.' ? seguidos : seguidos.filter((f) => f.startsWith(`${d}/`)));

console.log(`POBLACION: ${arbol.tests.length} tests en disco · ${Object.keys(sonda).length} con salida de la sonda · ${seguidos.length} ficheros seguidos por git en ${dirsSeguidos.size} directorios · motivos para no fiarse del analisis: ${motivos.length}`);

const filas = [];
const cuenta = { sinSonda: 0, sinTestigo: 0, sinRecuento: 0, colgados: 0, todoSaltado: 0, conRojo: 0, lanzanNode: 0 };
const ciegosPorFichero = new Map();
for (const t of arbol.tests) {
  const s = sonda[t];
  const d = arbol.porTest.get(t);
  const siempre = d.noSe.length > 0;
  if (!s) { cuenta.sinSonda += 1; filas.push({ t, estado: 'SIN-SONDA', siempre }); continue; }
  let estado = 'VISTO';
  if (!s.testigos) { estado = 'SIN-TESTIGO'; cuenta.sinTestigo += 1; }
  else if (s.fin.colgado) { estado = 'COLGADO'; cuenta.colgados += 1; }
  else if (s.fin.tests === null) { estado = 'SIN-RECUENTO'; cuenta.sinRecuento += 1; }
  else if (s.fin.tests > 0 && s.fin.skipped === s.fin.tests) { estado = 'TODO-SALTADO'; cuenta.todoSaltado += 1; }
  else if (s.fin.fail > 0) { estado = 'CON-ROJO'; cuenta.conRojo += 1; }
  if (s.lanzaNode) cuenta.lanzanNode += 1;

  const propios = new Map(); // ruta → { rec, por:Set }
  let deLaAplicacion = 0;
  let sinDueno = 0;
  for (const [por, lista] of Object.entries(s.dirs)) {
    if (por === NADIE) { sinDueno += lista.length; continue; }
    if (por.startsWith('dist/')) { deLaAplicacion += lista.length; continue; }
    for (const [ruta, rec] of lista) {
      if (!propios.has(ruta)) propios.set(ruta, { rec: false, por: new Set() });
      const p = propios.get(ruta);
      p.rec = p.rec || Boolean(rec);
      p.por.add(por);
    }
  }
  const seguidosListados = [...propios.keys()].filter((r) => dirsSeguidos.has(r));
  const ficherosCiegos = new Set();
  const dirsCiegos = new Set();
  const porQuien = new Set();
  if (!siempre) {
    for (const ruta of seguidosListados) {
      const p = propios.get(ruta);
      const candidatos = p.rec ? bajo(ruta) : (directos.get(ruta) || []);
      let alguno = false;
      for (const f of candidatos) {
        if (razonDe(d, f)) continue;
        ficherosCiegos.add(f);
        alguno = true;
      }
      if (alguno) { dirsCiegos.add(ruta); for (const q of p.por) porQuien.add(q); }
    }
  }
  for (const f of ficherosCiegos) ciegosPorFichero.set(f, (ciegosPorFichero.get(f) || 0) + 1);
  filas.push({
    t, estado, siempre,
    listados: propios.size, seguidosListados: seguidosListados.length, raiz: propios.has('.'),
    dirsCiegos: dirsCiegos.size, ficherosCiegos: ficherosCiegos.size,
    porHelper: [...porQuien].some((q) => q !== t), porQuien: [...porQuien].sort(),
    gitEnum: s.gitEnum, deLaAplicacion, sinDueno,
    conjunto: ficherosCiegos,
  });
}

const vistos = filas.filter((f) => f.estado !== 'SIN-SONDA');
const listan = vistos.filter((f) => f.seguidosListados > 0);
const ciegos = filas.filter((f) => f.ficherosCiegos > 0).sort((a, b) => b.ficherosCiegos - a.ficherosCiegos || a.t.localeCompare(b.t));
const pct = (n, de) => (de ? `${((100 * n) / de).toFixed(1)} %` : 's/d');

console.log('\n── ESTADOS de la sonda (un test que no corrió no lista nada: su cero no vale)');
console.log(`   sin salida de la sonda: ${cuenta.sinSonda} · sin testigo: ${cuenta.sinTestigo} · sin recuento en su TAP: ${cuenta.sinRecuento} · cortados por el techo: ${cuenta.colgados} · todo saltado: ${cuenta.todoSaltado} · con algun rojo: ${cuenta.conRojo}`);
console.log(`   lanzan algun proceso node (un hijo que limpia su entorno no lleva sonda): ${cuenta.lanzanNode}`);

console.log('\n── LO QUE LISTAN AL EJECUTARSE');
console.log(`   listan algun directorio SEGUIDO por git, desde un fichero del repositorio que no es dist/: ${listan.length} de ${vistos.length}`);
console.log(`     de ellos, la herramienta los mete SIEMPRE (cubo NO_SE): ${listan.filter((f) => f.siempre).length}`);
console.log(`     de ellos, NO estan en NO_SE: ${listan.filter((f) => !f.siempre).length}`);
console.log(`   listan la RAIZ del repositorio: ${vistos.filter((f) => f.raiz).length} (en NO_SE: ${vistos.filter((f) => f.raiz && f.siempre).length} · fuera de NO_SE: ${vistos.filter((f) => f.raiz && !f.siempre).length})`);

console.log('\n── ① LA POBLACION: tests con algun par CIEGO (listan el directorio de un fichero y tocarlo no los trae)');
console.log(`   ${ciegos.length} de ${vistos.length} tests`);
const tramos = [[1, 9], [10, 99], [100, 999], [1000, Infinity]];
for (const [a, b] of tramos) {
  const n = ciegos.filter((f) => f.ficherosCiegos >= a && f.ficherosCiegos <= b).length;
  console.log(`     con ${a}${b === Infinity ? ' o mas' : `-${b}`} ficheros ciegos: ${n}`);
}
console.log(`   de los ${ciegos.length}: listan la raiz ${ciegos.filter((f) => f.raiz).length} · el listado lo hace OTRO fichero (un helper) en ${ciegos.filter((f) => f.porHelper).length}`);
console.log(`   ficheros seguidos con algun test ciego: ${ciegosPorFichero.size} de ${seguidos.length} (${pct(ciegosPorFichero.size, seguidos.length)})`);
const reparto = [...ciegosPorFichero.values()].sort((x, y) => x - y);
if (reparto.length) console.log(`   tests ciegos por fichero: minimo ${reparto[0]} · mediana ${reparto[Math.floor(reparto.length / 2)]} · maximo ${reparto[reparto.length - 1]}`);
console.log('\n   los 30 primeros, por ficheros ciegos:');
for (const f of ciegos.slice(0, 30)) {
  console.log(`     ${String(f.ficherosCiegos).padStart(5)} ficheros · ${String(f.dirsCiegos).padStart(4)} directorios · raiz ${f.raiz ? 'SI' : 'no'} · ${f.t}${f.porHelper ? `  ← lista ${f.porQuien.filter((q) => q !== f.t).join(', ')}` : ''}`);
}

console.log('\n── ①b · enumeran con git en ejecucion (ls-files, ls-tree, grep) y NO estan en NO_SE  [sin directorio de trabajo: puede ser un repositorio de usar y tirar]');
const porGit = vistos.filter((f) => f.gitEnum.length && !f.siempre);
console.log(`   ${porGit.length} tests (y ${vistos.filter((f) => f.gitEnum.length && f.siempre).length} que si estan en NO_SE)`);
for (const f of porGit.slice(0, 20)) console.log(`     ${f.t} · ${f.gitEnum.join(', ')}`);

console.log('\n── FUERA DE LA CUENTA, dicho');
console.log(`   tests con listados hechos por dist/ (la aplicacion, no el test): ${vistos.filter((f) => f.deLaAplicacion).length} · con listados sin nadie del repositorio en la pila: ${vistos.filter((f) => f.sinDueno).length}`);

// ── 3 · controles ────────────────────────────────────────────────────────────────────────────
const fila = (t) => filas.find((f) => f.t === t);
const TOCADO = 'docs/master/evidencias/SCRUM-1339/h-entradas.mjs';
const c622 = fila('tests/scrum622-desconocido-no-es-verde.test.mjs');
const c976 = fila('tests/scrum976-guards-entrada-con-techo.test.mjs');
const c713 = fila('tests/scrum713c-trinquete-de-estilos-en-js.test.mjs');
const cInv = fila('tests/scrum99999-inventado.test.mjs');
const sinRaiz = new Set();
for (const f of ciegos) if (!f.raiz) for (const x of f.conjunto) sinRaiz.add(x);
console.log(`\n   sin contar los ${ciegos.filter((f) => f.raiz).length} que listan la raiz: ficheros seguidos con algun test ciego: ${sinRaiz.size} de ${seguidos.length} (${pct(sinRaiz.size, seguidos.length)})`);
const estadoDe = (e) => filas.filter((f) => f.estado === e).map((f) => f.t.replace(/^tests\//, '').replace(/\.test\.mjs$/, ''));
console.log(`   cortado por el techo: ${estadoDe('COLGADO').join(', ') || '(ninguno)'}`);
console.log(`   con algun rojo bajo la sonda: ${estadoDe('CON-ROJO').join(', ') || '(ninguno)'}`);
const traenElTocado = ciegos.filter((f) => f.conjunto.has(TOCADO));
console.log('\n── CONTROLES');
console.log(`   positivo · scrum622 esta en la poblacion: ${Boolean(c622 && c622.ficherosCiegos > 0)} (lista la raiz: ${Boolean(c622 && c622.raiz)} · directorios ciegos: ${c622 ? c622.dirsCiegos : 's/d'} · ficheros ciegos: ${c622 ? c622.ficherosCiegos : 's/d'})`);
console.log(`   positivo · «${TOCADO}» es ciego para scrum622: ${Boolean(c622 && c622.conjunto.has(TOCADO))}`);
console.log(`   a cero · scrum976 (la herramienta lo mete siempre) NO esta en la poblacion: ${Boolean(c976 && c976.ficherosCiegos === 0)} (lista ${c976 ? c976.seguidosListados : 's/d'} directorios seguidos: su cero NO prueba nada si es 0)`);
console.log(`   a cero · scrum713c (lista un directorio, NO esta en NO_SE y la herramienta SI lo ve) NO esta en la poblacion: ${Boolean(c713 && !c713.siempre && c713.seguidosListados > 0 && c713.ficherosCiegos === 0)} (lista ${c713 ? c713.seguidosListados : 's/d'} directorios seguidos)`);
console.log(`   a cero · un nombre inventado: ${cInv ? 'ESTA (mal)' : 'no esta'}`);
console.log(`   tests para los que «${TOCADO}» es ciego (lo que la dirigida de #2280 no trajo y lista su carpeta): ${traenElTocado.length}`);
for (const f of traenElTocado) console.log(`     ${f.t}`);

if (tsvRuta) {
  const cab = ['test', 'estado', 'cubo', 'dirs_listados', 'dirs_seguidos', 'lista_raiz', 'dirs_ciegos', 'ficheros_ciegos', 'por_helper', 'lista_quien', 'git_enumera'];
  const lineas = filas.map((f) => [f.t, f.estado, f.siempre ? 'NO_SE' : 'resto', f.listados ?? '', f.seguidosListados ?? '', f.raiz ? 'si' : 'no',
    f.dirsCiegos ?? '', f.ficherosCiegos ?? '', f.porHelper ? 'si' : 'no', (f.porQuien || []).join(' '), (f.gitEnum || []).join(' ')].join('\t'));
  fs.writeFileSync(tsvRuta, `${cab.join('\t')}\n${lineas.join('\n')}\n`);
  console.log(`\nTSV: ${lineas.length} filas`);
}

const controles = Boolean(c622 && c622.ficherosCiegos > 0 && c622.conjunto.has(TOCADO) && c976 && c976.ficherosCiegos === 0 && !cInv
  && c713 && !c713.siempre && c713.seguidosListados > 0 && c713.ficherosCiegos === 0);
let salida = 2;
if (controles && !motivos.length && !cuenta.sinSonda) salida = 0;
console.log(`\nEXIT=${salida}`);
process.exit(salida);
