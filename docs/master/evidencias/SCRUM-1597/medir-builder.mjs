// SCRUM-1597 ① · ¿Quién llama a `buildPaymentConfirmation`? SÓLO MIDE: no toca `src/`.
//
// Censo por AST (compilador de TypeScript) en src/, tests/, scripts/ y public/. Cada llamada se
// clasifica por DÓNDE vive: la función que la envuelve en src/ y scripts/, y el `test('…')` que la
// envuelve en tests/. Así se contestan las dos preguntas del encargo por separado:
//   · ¿la llama la hermana `sendPaymentConfirmationInvoice`? (llamadas dentro de su cuerpo)
//   · ¿la usa un test que NO es de ella misma? (el nombre del test, a la vista, lo decide quien lee)
//
// Controles: un fichero SEMBRADO en memoria (2 llamadas, más un prefijo y un comentario que no
// cuentan); un nombre inexistente que da 0; un SUELO de población; y la hermana del builder,
// `buildPaymentConfirmationInvoice`, que tiene que tener al menos una llamada en src/.
//
// Uso:  node docs/master/evidencias/SCRUM-1597/medir-builder.mjs [--sin-sembrado] [--esperado-roto]
//   --sin-sembrado   quita el sembrado: tiene que salir CIEGO (2).
//   --esperado-roto  cambia un esperado a propósito: tiene que salir ROJO (1).
// Sale 0 si todo cuadra, 1 si algo no cuadra, 2 si el instrumento sale ciego.
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const SIN_SEMBRADO = process.argv.includes('--sin-sembrado');
const ROTO = process.argv.includes('--esperado-roto');
const hablar = console.log;
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');

const OBJETIVO = 'buildPaymentConfirmation';
const HERMANA = 'buildPaymentConfirmationInvoice';
const INEXISTENTE = 'sondaNoExiste1597';
const NOMBRES = [OBJETIVO, HERMANA, INEXISTENTE];
const EXT = /\.(ts|js|mjs|cjs)$/;
const SUELO = 1000; // el árbol tenía 2.411 ficheros en esta población el 23-oct (c.20601)

const noCuadran = [];
function anotar(nombre, real, esperado) {
  const fallos = Object.entries(esperado).filter(([k, v]) => !(k in real) || JSON.stringify(real[k]) !== JSON.stringify(v))
    .map(([k, v]) => `${k}: esperado ${JSON.stringify(v)}, salió ${JSON.stringify(real[k])}`);
  if (fallos.length) noCuadran.push(nombre);
  hablar(`${fallos.length ? 'ROJO  ' : 'cuadra'} ${nombre}  ${JSON.stringify(real)}${fallos.length ? '  <<< ' + fallos.join(' | ') : ''}`);
}

function ficheros(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...ficheros(p));
    else if (EXT.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Lo que envuelve al nodo: el `test('…')` si lo hay (gana sobre todo), si no la función o método
 *  más cercano, y si no la `const` de nivel superior. La primera versión se paraba en la `const`
 *  más cercana y daba «const pc» para una llamada que vive dentro de un test. */
function contenedor(n) {
  let funcion = null; let constante = null;
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && ['test', 'it', 'describe'].includes(p.expression.text)
      && p.arguments[0] && (ts.isStringLiteral(p.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(p.arguments[0]))) {
      return `test «${p.arguments[0].text}»`;
    }
    if (!funcion && (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) funcion = `función ${p.name.getText()}`;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) constante = `const ${p.name.text}`;
  }
  return funcion || constante || 'nivel superior';
}

/** Cada identificador EXACTAMENTE igual a uno de los nombres (un prefijo no casa), con su papel. */
function censar(nombreFichero, texto) {
  const sf = ts.createSourceFile(nombreFichero, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  const ver = (n) => {
    if (ts.isIdentifier(n) && NOMBRES.includes(n.text)) {
      const p = n.parent;
      let papel = 'referencia';
      if (ts.isFunctionDeclaration(p) && p.name === n) papel = 'declaracion';
      else if (ts.isImportSpecifier(p) || ts.isImportClause(p)) papel = 'import';
      else if (ts.isCallExpression(p) && p.expression === n) papel = 'llamada';
      else if (ts.isPropertyAccessExpression(p) && p.name === n && ts.isCallExpression(p.parent) && p.parent.expression === p) papel = 'llamada';
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      out.push({ nombre: n.text, papel, dentro: contenedor(n), sitio: `${path.relative(RAIZ, nombreFichero).replace(/\\/g, '/')}:${line + 1}` });
    }
    // Una cadena con el nombre exacto también es un uso (un catálogo por nombre se rompe al retirarlo).
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && NOMBRES.includes(n.text)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
      out.push({ nombre: n.text, papel: 'cadena', dentro: contenedor(n), sitio: `${path.relative(RAIZ, nombreFichero).replace(/\\/g, '/')}:${line + 1}` });
    }
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return out;
}

const poblacion = ['src', 'tests', 'scripts', 'public'].flatMap((d) => ficheros(path.join(RAIZ, d)));
hablar(`== CENSO POR AST · población: ${poblacion.length} ficheros (src, tests, scripts, public) ==`);
anotar('S0 SUELO de población', { porEncimaDelSuelo: poblacion.length >= SUELO }, { porEncimaDelSuelo: true });

const sembrados = SIN_SEMBRADO ? [] : censar(path.join(RAIZ, 'sembrado-1597.ts'),
  `import { ${OBJETIVO} } from "x";\nfunction f() { ${OBJETIVO}({}); }\nconst b = { x: 1 };\nb.${OBJETIVO}();\n`
  + `const p = ${OBJETIVO}Extra;\n// ${OBJETIVO} en un comentario no cuenta\n`);
const llamadasSembradas = sembrados.filter((h) => h.papel === 'llamada').length;
anotar('C0 SEMBRADO: 2 llamadas, 1 import; el prefijo y el comentario no cuentan', { llamadas: llamadasSembradas, total: sembrados.length }, { llamadas: 2, total: 3 });
if (llamadasSembradas === 0) { hablar('CIEGO: el censo no ve el fichero sembrado.'); process.exit(2); }

const todos = [];
for (const f of poblacion) {
  const texto = fs.readFileSync(f, 'utf8');
  if (!NOMBRES.some((n) => texto.includes(n))) continue;
  todos.push(...censar(f, texto));
}
anotar('C1 CERO: un nombre que no existe', { apariciones: todos.filter((h) => h.nombre === INEXISTENTE).length }, { apariciones: 0 });

for (const n of [OBJETIVO, HERMANA]) {
  hablar(`\n-- ${n} --`);
  for (const h of todos.filter((x) => x.nombre === n)) hablar(`   ${h.papel.padEnd(11)} ${h.sitio.padEnd(58)} ${h.dentro}`);
}
const del = (n, papel, dir) => todos.filter((h) => h.nombre === n && h.papel === papel && h.sitio.startsWith(dir + '/'));
anotar('C2 POSITIVO: la hermana del builder tiene llamada en src/', { llamadasEnSrc: del(HERMANA, 'llamada', 'src').length >= 1 }, { llamadasEnSrc: true });

hablar('\n== LO QUE SE PREGUNTA ==');
const llamadas = todos.filter((h) => h.nombre === OBJETIVO && h.papel === 'llamada');
const porDir = (d) => llamadas.filter((h) => h.sitio.startsWith(d + '/')).length;
anotar('P1 llamadas a buildPaymentConfirmation por carpeta', { src: porDir('src'), tests: porDir('tests'), scripts: porDir('scripts'), public: porDir('public') },
  { src: ROTO ? 1 : 0, tests: 5, scripts: 1, public: 0 });
// Positivo de P2: la misma pregunta, hecha sobre el builder de la hermana, TIENE que dar 1.
anotar('C3 POSITIVO de P2: buildPaymentConfirmationInvoice dentro de sendPaymentConfirmationInvoice',
  { llamadas: todos.filter((h) => h.nombre === HERMANA && h.papel === 'llamada' && h.dentro === 'función sendPaymentConfirmationInvoice').length }, { llamadas: 1 });
anotar('P2 dentro de sendPaymentConfirmationInvoice', { llamadas: llamadas.filter((h) => h.dentro === 'función sendPaymentConfirmationInvoice').length }, { llamadas: 0 });
const tests = [...new Set(llamadas.filter((h) => h.sitio.startsWith('tests/')).map((h) => `${h.sitio.split(':')[0]} · ${h.dentro}`))];
hablar(`   tests que la llaman (${tests.length}):`);
for (const t of tests) hablar(`      ${t}`);

hablar(`\n${noCuadran.length ? `ROJO: no cuadran ${noCuadran.length}: ${noCuadran.join(' · ')}` : 'TODO CUADRA'}`);
process.exit(noCuadran.length ? 1 : 0);
