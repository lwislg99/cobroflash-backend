import fs from 'fs'; import ts from 'typescript'; import crypto from 'crypto';
for (const f of process.argv.slice(2)) {
  const sf = ts.createSourceFile('x.ts', fs.readFileSync(f,'utf8'), ts.ScriptTarget.Latest, true);
  const c = {}; const v = (n) => { if (ts.isFunctionDeclaration(n) && n.name && n.body) c[n.name.text] = n.body.getText(sf); ts.forEachChild(n, v); }; v(sf);
  const h = (s) => s ? crypto.createHash('sha256').update(s).digest('hex').slice(0,16) + ' (' + s.length + ' B)' : 'NO ENCONTRADA';
  console.log(f.split(/[\/]/).pop(), '· funciones', Object.keys(c).length, '· generateInvoicePdf', h(c.generateInvoicePdf), '· generateQuotePdf', h(c.generateQuotePdf));
}
