// SCRUM-1596b · Censo de ENVÍOS de WhatsApp por AST: cada llamada a una función que habla con el
// proveedor, con la función que la contiene. Sirve para ver que retirar `sendPaymentConfirmation`
// no cambia ningún envío que se pueda ejecutar: la única que desaparece es la suya.
//
// Uso:  node docs/master/evidencias/SCRUM-1596/envios-1596b.mjs [--ref <commit>] [--sin-sembrado]
//   --ref <commit>   lee los ficheros de ese commit (git) en vez del árbol de trabajo.
//   --sin-sembrado   quita el fichero sembrado: tiene que salir CIEGO (2).
// Población: los .ts de src/. Sale 0 con el censo impreso, 2 si sale ciego.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const requiere = createRequire(path.join(RAIZ, 'package.json'));
const ts = requiere('typescript');
const args = process.argv.slice(2);
const REF = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : null;
const SIN_SEMBRADO = args.includes('--sin-sembrado');

const ENVIAN = new Set(['sendWhatsAppTemplate', 'sendWhatsAppText', 'sendWhatsAppWindowFirst', 'sendWhatsAppCtaUrl', 'sendWhatsAppDocument']);

function ficherosDelArbol(dir) {
  const fuera = [];
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) fuera.push(...ficherosDelArbol(rel));
    else if (rel.endsWith('.ts')) fuera.push(rel);
  }
  return fuera;
}
const git = (...a) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 28 });
const lista = REF
  ? git('ls-tree', '-r', '--name-only', REF, '--', 'src').split('\n').filter((f) => f.endsWith('.ts'))
  : ficherosDelArbol('src');
const leer = (f) => (REF ? git('show', `${REF}:${f}`) : fs.readFileSync(path.join(RAIZ, f), 'utf8'));

function censar(nombre, texto) {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
  const fuera = [];
  const visitar = (n, dentro) => {
    let aqui = dentro;
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) aqui = n.name.getText(sf);
    else if (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) aqui = n.name.getText(sf);
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const id = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
      if (id && ENVIAN.has(id)) fuera.push(`${nombre} · ${aqui ?? '(módulo)'} → ${id}`);
    }
    ts.forEachChild(n, (h) => visitar(h, aqui));
  };
  visitar(sf, null);
  return fuera;
}

const SEMBRADO = 'src/__sembrado_1596b__.ts';
const fuentes = lista.map((f) => [f, leer(f)]);
if (!SIN_SEMBRADO) fuentes.push([SEMBRADO, "export async function sembrada() { await sendWhatsAppText({}); }\n// sendWhatsAppTemplate( en un comentario\nconst x = 'sendWhatsAppTemplate(';\n"]);

const todas = fuentes.flatMap(([f, t]) => censar(f, t));
const sembradas = todas.filter((l) => l.startsWith(SEMBRADO));
console.log(`población: ${lista.length} ficheros .ts de src/ · ${REF ? `commit ${REF}` : 'árbol de trabajo'}`);
if (sembradas.length !== 1) {
  console.log(`CIEGO: el sembrado tiene 1 llamada (y un comentario y una cadena que no lo son) y se ven ${sembradas.length}.`);
  process.exit(2);
}
const reales = todas.filter((l) => !l.startsWith(SEMBRADO)).sort();
if (reales.length === 0) { console.log('CIEGO: ningún envío en src/.'); process.exit(2); }
console.log(`sembrado: 1 de 1 · envíos reales: ${reales.length}`);
for (const l of reales) console.log(`  ${l}`);
