// tests/banco-scrum1257/censo-vocabulario-justificante.mjs — SCRUM-1257
//
// Censo: literales (no comentarios) con el vocabulario del justificante, en public/dashboard.
// No es un test (no acaba en .test.mjs): es el instrumento del expediente, y se sube para que se
// pueda repetir. Uso, desde la raíz del repo:
//
//   node tests/banco-scrum1257/censo-vocabulario-justificante.mjs "$PWD" <raíz a medir>
//
// El primer argumento es de dónde se carga `typescript` (este repo). El segundo es el árbol medido:
// el propio repo, o un `git archive origin/main public` extraído aparte para medir main.
// El recuento de comentarios es APROXIMADO: el escáner suelto no distingue plantillas.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2] + '/');
const ts = require('typescript');

const [, , REPO, RAIZ] = process.argv;
const RE = /justificante|documento de cobro|comprobante de (pago|cobro)/i;
const dir = path.join(RAIZ, 'public/dashboard/js');
const out = [];
let comentarios = 0;

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // comentarios: se cuentan aparte
  const sc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, src);
  for (let k = sc.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = sc.scan()) {
    if ((k === ts.SyntaxKind.SingleLineCommentTrivia || k === ts.SyntaxKind.MultiLineCommentTrivia) && RE.test(sc.getTokenText())) comentarios++;
    // el escáner suelto no sabe de plantillas/regex; solo sirve para contar comentarios aproximados
  }
  const visit = (n) => {
    const k = n.kind;
    if (k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral
      || k === ts.SyntaxKind.TemplateHead || k === ts.SyntaxKind.TemplateMiddle || k === ts.SyntaxKind.TemplateTail) {
      const t = n.text ?? '';
      if (RE.test(t)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        out.push({ f, line: line + 1, t: t.replace(/\s+/g, ' ').trim() });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
// index.html: texto plano
const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8').split('\n');
html.forEach((l, i) => { if (RE.test(l) && !/^\s*<!--/.test(l)) out.push({ f: 'index.html', line: i + 1, t: l.trim().slice(0, 300) }); });

console.log(`literales: ${out.length} · comentarios (aprox): ${comentarios}`);
for (const o of out) console.log(`${o.f}:${o.line}\t${o.t}`);
