// jobs.mjs <runs.json> <salida.json> — check-runs (nombre, conclusion, horas) de cada run CON jobs. Solo lectura.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const con = runs.filter((r) => r.jobs > 0);
const consulta = 'query($ids:[ID!]!){nodes(ids:$ids){... on CheckSuite{id checkRuns(first:30){totalCount nodes{name status conclusion startedAt completedAt}}}}}';
const sal = {};
for (let i = 0; i < con.length; i += 50) {
  const args = ['api', 'graphql', '-f', `query=${consulta}`];
  for (const r of con.slice(i, i + 50)) args.push('-f', `ids[]=${r.suite}`);
  const r = JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
  for (const n of r.data.nodes) if (n) sal[n.id] = n.checkRuns;
}
fs.writeFileSync(process.argv[3], JSON.stringify(sal));
const truncados = Object.values(sal).filter((c) => c.totalCount > c.nodes.length).length;
console.log(`POBLACION suites pedidas=${con.length} recibidas=${Object.keys(sal).length} truncadas=${truncados}`);
