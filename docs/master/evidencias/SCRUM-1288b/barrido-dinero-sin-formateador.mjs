// SCRUM-1288 · barrido de las formas que el censo de SCRUM-1452 DECLARA no ver: ¿hay hoy en src/ un valor
// pegado a una moneda que NO pasa por un formateador de la casa ni es un `toFixed(2)` (ése ya lo caza)?
// Sólo lee y parsea. Uso: node barrido-dinero-sin-formateador.mjs <raíz>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const raiz = path.resolve(process.argv[2]);
const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const MONEDA_AL_EMPEZAR = /^\s?(?:€|&euro;|EUR\b|euros?\b)/i;
const NOMBRE_DE_MONEDA = /^(?:currency|moneda|cur|divisa)$/i;
const FORMATEADOR = /^(?:format\w*|fmt\w*|money\w*|euros?\w*|importe\w*|esc\w*|escapeHtml)$/i;

const ficheros = [];
const andar = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) andar(p); else if (/\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) ficheros.push(p); } };
andar(path.join(raiz, 'src'));
if (ficheros.length === 0) { console.log('🔴 CIEGO: cero ficheros'); process.exit(2); }

const sinPar = (x) => { while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x)) x = x.expression; return x; };
const esSuma = (n) => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken;
/** Aplana un texto en piezas: { lit } o { expr }. */
const piezas = (n, out = []) => {
  n = sinPar(n);
  if (esSuma(n)) { piezas(n.left, out); piezas(n.right, out); } else if (ts.isTemplateExpression(n)) {
    out.push({ lit: n.head.text });
    for (const s of n.templateSpans) { out.push({ expr: s.expression }); out.push({ lit: s.literal.text }); }
  } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push({ lit: n.text });
  else out.push({ expr: n });
  return out;
};
const esMoneda = (p) => (p.lit !== undefined ? MONEDA_AL_EMPEZAR.test(p.lit)
  : (() => { const x = sinPar(p.expr); return (ts.isIdentifier(x) && NOMBRE_DE_MONEDA.test(x.text)) || (ts.isPropertyAccessExpression(x) && NOMBRE_DE_MONEDA.test(x.name.text)); })());
const nombreDeLlamada = (x) => { x = sinPar(x); if (!ts.isCallExpression(x)) return null; const c = x.expression; return ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null; };

const filas = [];
let textosConMoneda = 0;
for (const f of ficheros) {
  const rel = path.relative(raiz, f).split(path.sep).join('/');
  const sf = ts.createSourceFile(rel, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rec = (n) => {
    if (ts.isTemplateExpression(n) || esSuma(n)) {
      let padre = n.parent; while (padre && ts.isParenthesizedExpression(padre)) padre = padre.parent;
      if (!(padre && esSuma(padre))) {
        const ps = piezas(n);
        for (let i = 0; i < ps.length - 1; i++) {
          if (!ps[i].expr) continue;
          // la pieza siguiente es la moneda, o un literal « » y la de después una referencia a la moneda
          const sig = ps[i + 1]; const sig2 = ps[i + 2];
          const pegada = esMoneda(sig) || (sig.lit !== undefined && /^\s?$/.test(sig.lit) && sig2 && sig2.expr && esMoneda(sig2));
          if (!pegada) continue;
          textosConMoneda++;
          const x = sinPar(ps[i].expr);
          const llamada = nombreDeLlamada(x);
          let clase;
          if (llamada && FORMATEADOR.test(llamada)) clase = 'FORMATEADOR';
          else if (llamada === 'toFixed') clase = `toFixed(${x.arguments[0]?.getText(sf) ?? ''})`;
          else if (llamada) clase = `llamada ${llamada}`;
          else clase = 'VALOR CRUDO';
          const { line } = sf.getLineAndCharacterOfPosition(x.getStart(sf));
          filas.push({ rel, linea: line + 1, clase, valor: x.getText(sf).replace(/\s+/g, ' ').slice(0, 70) });
        }
      }
    }
    ts.forEachChild(n, rec);
  };
  rec(sf);
}
const porClase = {};
for (const f of filas) (porClase[f.clase.replace(/^llamada .*/, 'llamada (otra)')] ??= []).push(f);
console.log(`POBLACION · ${ficheros.length} ficheros de src/ · valores pegados a una moneda dentro de un texto: ${textosConMoneda}`);
for (const [c, l] of Object.entries(porClase)) console.log(`  ${c}: ${l.length}`);
for (const f of filas.filter((x) => x.clase !== 'FORMATEADOR')) console.log(`  · ${f.rel}:${f.linea} [${f.clase}] ${f.valor}`);
