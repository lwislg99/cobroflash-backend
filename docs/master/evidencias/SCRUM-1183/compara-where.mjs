import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
let iguales = 0; const distintas = [];
for (let i = 0; i < a.out.length; i++) {
  const x = JSON.stringify(a.out[i]), y = JSON.stringify(b.out[i]);
  if (x === y) iguales++; else distintas.push(a.out[i].p);
}
console.log(`${a.modo} vs ${b.modo} · ${a.out.length} peticiones · idénticas ${iguales} · distintas ${distintas.length}${distintas.length ? ': ' + distintas.join(' ') : ''}`);
// Lo que llega a la base en jobs.csv con rango: ¿por qué campo filtra de verdad?
const j = a.out.find((o) => o.p === '/x/jobs.csv?from=2026-01-01&to=2026-03-31');
console.log('jobs.csv con rango → where que llega a prisma.job:', JSON.stringify(j.llamadas.find((l) => l.modelo === 'job').where));
const c = a.out.find((o) => o.p === '/x/charges.csv?status=paid&from=2026-01-01');
console.log('charges.csv status+from → where:', JSON.stringify(c.llamadas.find((l) => l.modelo === 'charge').where));
const q = a.out.find((o) => o.p === '/x/quotes.csv?status=accepted');
console.log('quotes.csv status → where:', JSON.stringify(q.llamadas.find((l) => l.modelo === 'quote').where));
