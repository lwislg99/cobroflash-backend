// SÓLO LEE. Identidades `ruta::nombre` escritas en tests/ y scripts/ (por AST: sólo literales, no comentarios),
// y si `nombre` sigue apareciendo como identificador en `ruta` hoy.
const fs = require('node:fs');
const path = require('node:path');
const [raiz, tsPath] = process.argv.slice(2);
const ts = require(tsPath);
const RE = /^((?:src|public|scripts)\/[\w./-]+\.(?:ts|js|mjs|cjs))::([A-Za-z_$][\w$]*)$/;
const filas = [];
for (const dir of ['tests', 'scripts']) {
  for (const f of fs.readdirSync(path.join(raiz, dir)).filter((x) => /\.(mjs|cjs|js)$/.test(x))) {
    const fuente = fs.readFileSync(path.join(raiz, dir, f), 'utf8');
    const sf = ts.createSourceFile(f, fuente, ts.ScriptTarget.Latest, true);
    (function rec(n) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        const m = RE.exec(n.text);
        if (m) {
          const abs = path.join(raiz, m[1]);
          const existe = fs.existsSync(abs);
          const vive = existe && new RegExp(`(?<![\\w$])${m[2].replace(/\$/g, '\\$')}(?![\\w$])`).test(fs.readFileSync(abs, 'utf8'));
          filas.push({ donde: `${dir}/${f}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`, identidad: n.text, existe, vive });
        }
      }
      n.forEachChild(rec);
    })(sf);
  }
}
const muertas = filas.filter((x) => !x.vive);
console.log(`POBLACIÓN: ${filas.length} identidades fichero::nombre en tests/ y scripts/ · ${new Set(filas.map((x) => x.identidad)).size} distintas · sin su nombre en el fichero hoy: ${muertas.length}`);
for (const x of muertas) console.log(`${x.donde} | ${x.identidad} | fichero ${x.existe ? 'existe' : 'NO existe'}`);
