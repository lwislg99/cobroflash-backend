// docs/master/evidencias/SCRUM-1396/censo-nombres-repetidos.mjs — SCRUM-1396
//
// EL CENSO DE A QUIÉN AFECTA, y es una sonda APARTE del arreglo a propósito: no usa el enlace de
// símbolos que el arreglo mete en `scripts/_censo-mkdtemp.mjs`. Mide por CONTENCIÓN —¿el borrado
// que el censo atribuye a una creación está dentro del bloque donde se declara la variable de esa
// creación?—, que es otro algoritmo. Si las dos sondas discrepan, la discrepancia es el dato.
//
// Qué cuenta, sobre el árbol que se le pase (por defecto, el de este fichero):
//   · ficheros nuestros con alguna llamada a `mkdtemp*`;
//   · de ésos, cuántos tienen DOS O MÁS creaciones que van al MISMO nombre;
//   · y de esas creaciones, cuántas salen hoy GARANTIZADA y a cuántas se les atribuye un borrado
//     que cae FUERA del bloque donde vive su variable.
//
// No escribe nada, no crea temporales y no ejecuta ningún test.
// Uso:  node docs/master/evidencias/SCRUM-1396/censo-nombres-repetidos.mjs [raíz]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { censar, DECLARADAS } from '../../../../scripts/_censo-mkdtemp.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(process.argv[2] || path.join(AQUI, '..', '..', '..', '..'));

const censo = censar(RAIZ);
const porFichero = new Map();
for (const l of censo.nuestras) {
  if (!porFichero.has(l.fichero)) porFichero.set(l.fichero, []);
  porFichero.get(l.fichero).push(l);
}

/** El bloque que delimita una declaración `const`/`let`: el Block, el cuerpo de función o el fichero. */
const esAmbito = (n) => ts.isBlock(n) || ts.isSourceFile(n) || ts.isModuleBlock(n) || ts.isCaseBlock(n)
  || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)
  || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
const ambitoDe = (n) => { for (let p = n.parent; p; p = p.parent) if (esAmbito(p)) return p; return null; };
const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);

/** Para cada creación de un fichero: dónde se declara su variable y qué borrados caen dentro. */
function mirar(fichero, llamadas) {
  const fuente = fs.readFileSync(path.join(RAIZ, fichero), 'utf8');
  const sf = ts.createSourceFile(fichero, fuente, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const lineaDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const nodosPorLinea = new Map(); // línea → llamadas (mkdtemp y rm) que empiezan en ella
  const ver = (n) => {
    if (ts.isCallExpression(n)) {
      const e = n.expression;
      const nombre = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '';
      if (/^(mkdtemp(Sync)?|rmSync|rm|rmdirSync|rmdir)$/.test(nombre)) {
        const l = lineaDe(n);
        if (!nodosPorLinea.has(l)) nodosPorLinea.set(l, []);
        nodosPorLinea.get(l).push({ nodo: n, nombre });
      }
    }
    ts.forEachChild(n, ver);
  };
  ts.forEachChild(sf, ver);

  return llamadas.map((l) => {
    const crea = (nodosPorLinea.get(l.linea) || []).find((x) => /^mkdtemp/.test(x.nombre));
    if (!crea) return { ...l, forma: 'CIEGO: no encuentro la creación en su línea', fuera: [], dentro: [] };
    // ¿Cómo llega el directorio al nombre? Declaración (`const dir = …`) o asignación (`dir = …`).
    let decl = null; let asigna = false; let propiedad = false;
    for (let p = crea.nodo.parent; p; p = p.parent) {
      if (ts.isVariableDeclaration(p)) { decl = p; break; }
      if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) { asigna = true; break; }
      if (ts.isPropertyAssignment(p)) { propiedad = true; break; }
      if (esFuncion(p) || ts.isBlock(p)) break;
    }
    const forma = decl ? 'declaración' : asigna ? 'asignación' : propiedad ? 'propiedad' : 'otra';
    const ambito = decl ? ambitoDe(decl) : null;
    const dentro = []; const fuera = [];
    for (const lb of l.borradoEn) {
      const borrados = (nodosPorLinea.get(lb) || []).filter((x) => /^rm/.test(x.nombre));
      // El borrado está DENTRO si cuelga del bloque donde se declaró la variable.
      const cuelga = ambito && borrados.some((b) => { for (let p = b.nodo.parent; p; p = p.parent) if (p === ambito) return true; return false; });
      (cuelga ? dentro : fuera).push(lb);
    }
    return { ...l, forma, dentro, fuera, ambitoLinea: ambito ? lineaDe(ambito) : null, ambitoEsFichero: !!(ambito && ts.isSourceFile(ambito)) };
  });
}

const conTemporales = [...porFichero.keys()].sort();
const repetidos = [];
for (const f of conTemporales) {
  const porNombre = new Map();
  for (const l of porFichero.get(f)) {
    if (!l.destino) continue;
    if (!porNombre.has(l.destino)) porNombre.set(l.destino, []);
    porNombre.get(l.destino).push(l);
  }
  const grupos = [...porNombre.entries()].filter(([, v]) => v.length >= 2);
  if (grupos.length) repetidos.push({ fichero: f, grupos });
}

console.log('CENSO DE NOMBRES REPETIDOS · SCRUM-1396');
console.log(`  raíz ............................ ${RAIZ}`);
console.log(`  ficheros mirados ................ ${censo.ficheros}`);
console.log(`  llamadas a mkdtemp* ............. ${censo.llamadas.length} (nuestras ${censo.nuestras.length} · ajenas ${censo.ajenas.length} · declaradas ${censo.declaradas.length} de ${DECLARADAS.size})`);
console.log(`  por categoría (nuestras) ........ GARANTIZADA ${censo.GARANTIZADA.length} · NO_GARANTIZADA ${censo.NO_GARANTIZADA.length} · SIN_LIMPIEZA ${censo.SIN_LIMPIEZA.length} · ESCAPA ${censo.ESCAPA.length} · FABRICA ${censo.FABRICA.length}`);
console.log(`  ficheros con temporales ......... ${conTemporales.length}`);
console.log('');

let creacionesRepetidas = 0; let garantizadasRepetidas = 0; let conBorradoFuera = 0; let soloFuera = 0; let ciegas = 0; let sinDeclaracion = 0;
const filas = [];
for (const { fichero, grupos } of repetidos) {
  const miradas = mirar(fichero, grupos.flatMap(([, v]) => v));
  for (const m of miradas) {
    creacionesRepetidas++;
    if (m.categoria === 'GARANTIZADA') garantizadasRepetidas++;
    if (/^CIEGO/.test(m.forma)) ciegas++;
    else if (m.forma !== 'declaración') sinDeclaracion++;
    if (m.fuera.length) conBorradoFuera++;
    const tapada = m.forma === 'declaración' && m.borradoEn.length > 0 && m.dentro.length === 0;
    if (tapada) soloFuera++;
    filas.push(`  ${tapada ? '🔴' : m.forma !== 'declaración' ? '❓' : '· '} ${fichero}:${m.linea} · ${m.destino} · ${m.categoria} · ${m.forma}`
      + (m.forma === 'declaración' ? ` · su bloque empieza en la línea ${m.ambitoLinea}${m.ambitoEsFichero ? ' (el fichero)' : ''}` : '')
      + ` · borrados dentro [${m.dentro.join(', ')}] · fuera [${m.fuera.join(', ')}]`);
  }
}
console.log(`CREACIONES QUE COMPARTEN NOMBRE CON OTRA DE SU FICHERO: ${creacionesRepetidas}, en ${repetidos.length} fichero(s)`);
for (const f of filas) console.log(f);
console.log('');
console.log('LA LÍNEA');
console.log(`  ${conTemporales.length} ficheros con temporales · ${repetidos.length} con nombres repetidos (${creacionesRepetidas} creaciones, ${garantizadasRepetidas} GARANTIZADA hoy)`);
console.log(`  ${conBorradoFuera} creaciones con algún borrado atribuido FUERA de su bloque · ${soloFuera} que SÓLO tienen borrados de fuera (🔴: fuga que el censo da por buena)`);
console.log(`  no juzgables por contención: ${sinDeclaracion} (el directorio llega por asignación o propiedad, ❓) · ciegas: ${ciegas}`);
