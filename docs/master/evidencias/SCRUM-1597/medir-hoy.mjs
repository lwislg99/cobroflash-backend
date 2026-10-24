// SCRUM-1597b · ¿Quién usa `plantillasDeHoy`, el filtro nuevo y la cifra `templateToday`? SÓLO MIDE.
//
// Censo por AST (compilador de TypeScript) en src/, tests/, scripts/ y public/: cada identificador
// EXACTO (un prefijo no casa) y cada cadena con el nombre, con su papel y la función que lo envuelve.
// Contesta la pregunta del encargo: si el arreglo cambia otra cifra que no sea el «Hoy» del panel.
//
// Controles: SUELO de población; un fichero SEMBRADO en memoria (1 llamada, 1 lectura de
// `.templateToday`, un prefijo y un comentario que no cuentan); un nombre inexistente que da 0.
//
// Uso:  node docs/master/evidencias/SCRUM-1597/medir-hoy.mjs [--sin-sembrado] [--esperado-roto]
// Sale 0 si todo cuadra, 1 si algo no cuadra, 2 si sale ciego.
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SIN_SEMBRADO = process.argv.includes('--sin-sembrado');
const ROTO = process.argv.includes('--esperado-roto');
const ts = createRequire(path.join(RAIZ, 'package.json'))('typescript');
const hablar = console.log;

const HOY = 'plantillasDeHoy';
const FILTRO = 'sinLosAvisosAlProfesional';
const CIFRA = 'templateToday';
const INEXISTENTE = 'sondaNoExiste1597b';
const NOMBRES = [HOY, FILTRO, CIFRA, INEXISTENTE];
const SUELO = 1000; // 2.411 ficheros en esta población el 23-oct (medir-builder.mjs, c.20634)

const noCuadran = [];
function anotar(nombre, real, esperado) {
  const fallos = Object.entries(esperado).filter(([k, v]) => JSON.stringify(real[k]) !== JSON.stringify(v))
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
    else if (/\.(ts|js|mjs|cjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function funcionQueEnvuelve(n) {
  for (let p = n.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText();
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && p.initializer
      && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) return p.name.text;
  }
  return 'nivel superior';
}

function censar(fichero, texto) {
  const sf = ts.createSourceFile(fichero, texto, ts.ScriptTarget.Latest, true);
  const out = [];
  const sitio = (n) => `${path.relative(RAIZ, fichero).replace(/\\/g, '/')}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const ver = (n) => {
    if (ts.isIdentifier(n) && NOMBRES.includes(n.text)) {
      const p = n.parent;
      let papel = 'referencia';
      if (ts.isFunctionDeclaration(p) && p.name === n) papel = 'declaracion';
      else if (ts.isCallExpression(p) && p.expression === n) papel = 'llamada';
      else if (ts.isPropertyAccessExpression(p) && p.name === n) papel = 'lectura';
      else if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name === n) papel = 'clave';
      out.push({ nombre: n.text, papel, dentro: funcionQueEnvuelve(n), sitio: sitio(n) });
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && NOMBRES.includes(n.text)) {
      out.push({ nombre: n.text, papel: 'cadena', dentro: funcionQueEnvuelve(n), sitio: sitio(n) });
    }
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return out;
}

const poblacion = ['src', 'tests', 'scripts', 'public'].flatMap((d) => ficheros(path.join(RAIZ, d)));
hablar(`== CENSO POR AST · población: ${poblacion.length} ficheros (src, tests, scripts, public) ==`);
anotar('S0 SUELO de población', { porEncimaDelSuelo: poblacion.length >= SUELO }, { porEncimaDelSuelo: true });

const sembrados = SIN_SEMBRADO ? [] : censar(path.join(RAIZ, 'sembrado-1597b.ts'),
  `function f() { return ${HOY}(1, "UTC", new Date()); }\nconst v = data.${CIFRA};\nconst p = ${HOY}Extra;\n// ${HOY} en un comentario\n`);
const sem = { llamadas: sembrados.filter((h) => h.papel === 'llamada').length, lecturas: sembrados.filter((h) => h.papel === 'lectura').length, total: sembrados.length };
anotar('C0 SEMBRADO: 1 llamada, 1 lectura; el prefijo y el comentario no cuentan', sem, { llamadas: 1, lecturas: 1, total: 2 });
if (sem.total === 0) { hablar('CIEGO: el censo no ve el fichero sembrado.'); process.exit(2); }

const todos = [];
for (const f of poblacion) {
  const texto = fs.readFileSync(f, 'utf8');
  if (NOMBRES.some((n) => texto.includes(n))) todos.push(...censar(f, texto));
}
anotar('C1 CERO: un nombre que no existe', { apariciones: todos.filter((h) => h.nombre === INEXISTENTE).length }, { apariciones: 0 });

for (const n of [HOY, FILTRO, CIFRA]) {
  hablar(`\n-- ${n} --`);
  for (const h of todos.filter((x) => x.nombre === n)) hablar(`   ${h.papel.padEnd(11)} ${h.sitio.padEnd(62)} ${h.dentro}`);
}

hablar('\n== LO QUE SE PREGUNTA ==');
const en = (n, papel, dir) => todos.filter((h) => h.nombre === n && h.papel === papel && h.sitio.startsWith(dir + '/'));
anotar('P1 llamadas a plantillasDeHoy en src/, por función', { funciones: en(HOY, 'llamada', 'src').map((h) => h.dentro).sort() },
  { funciones: ROTO ? ['getWhatsAppMetrics'] : ['getWhatsAppMetrics', 'reservarPlantilla'] });
anotar('P2 llamadas al filtro nuevo en src/, por función', { funciones: en(FILTRO, 'llamada', 'src').map((h) => h.dentro).sort() },
  { funciones: ['getWhatsAppMetrics', 'reservarPlantilla'] });
anotar('P3 quién LEE `.templateToday` en public/ (la cifra que cambia)', { sitios: en(CIFRA, 'lectura', 'public').map((h) => h.sitio.split(':')[0]) },
  // Las dos de `reportsView.js:821`: el número y su plural. La primera versión esperaba 3, escrito
  // antes de contar; se corrigió leyendo la línea, no la salida.
  { sitios: ['public/dashboard/js/reportsView.js', 'public/dashboard/js/reportsView.js'] });
anotar('P4 quién LEE `.templateToday` en src/ y scripts/', { src: en(CIFRA, 'lectura', 'src').length, scripts: en(CIFRA, 'lectura', 'scripts').length },
  { src: 0, scripts: 0 });

hablar(`\n${noCuadran.length ? `ROJO: no cuadran ${noCuadran.length}: ${noCuadran.join(' · ')}` : 'TODO CUADRA'}`);
process.exit(noCuadran.length ? 1 : 0);
