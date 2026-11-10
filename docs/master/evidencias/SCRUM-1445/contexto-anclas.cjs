// Imprime ±N líneas alrededor de cada ancla ausente no-NEGATIVA del censo.
const fs = require('node:fs');
const path = require('node:path');
const [raiz, n = '5'] = process.argv.slice(2);
const { filasA } = JSON.parse(fs.readFileSync(path.join(require('node:os').tmpdir(), 'scrum1445-censo-anclas.json'), 'utf8'));
const vistos = new Set();
for (const x of filasA.filter((x) => x.presente !== 'SÍ' && x.uso !== 'NEGATIVO')) {
  const clave = `${x.test}:${x.linea}`;
  if (vistos.has(clave)) continue; vistos.add(clave);
  const lineas = fs.readFileSync(path.join(raiz, 'tests', x.test), 'utf8').split(/\r?\n/);
  const a = Math.max(0, x.linea - 1 - Number(n)), b = Math.min(lineas.length, x.linea + Number(n));
  console.log(`\n===== ${clave}  →  ${x.objetivo}  ${JSON.stringify(x.literal)}`);
  for (let i = a; i < b; i++) console.log(`${String(i + 1).padStart(4)}${i + 1 === x.linea ? '>' : ' '} ${lineas[i].slice(0, 150)}`);
}
