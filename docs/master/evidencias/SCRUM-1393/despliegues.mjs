// despliegues.mjs <desde YYYY-MM-DD> <salida.json> — SOLO LECTURA.
// Los despliegues que Railway le cuenta a GitHub (API de deployments), del mas nuevo al mas viejo,
// hasta pasar la fecha `desde`. De cada uno: sha, entorno, cuando se creo y TODOS sus estados con hora.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [desde, salida] = process.argv.slice(2);
const limite = Date.parse(desde + 'T00:00:00Z');
const consulta = `query($c:String){repository(owner:"lwislg99",name:"cobroflash-backend"){deployments(first:100,after:$c,orderBy:{field:CREATED_AT,direction:DESC}){pageInfo{hasNextPage endCursor} nodes{databaseId commitOid createdAt environment task creator{login} statuses(first:20){totalCount nodes{state createdAt}}}}}}`;
const todos = [];
let cursor = null;
let paginas = 0;
for (;;) {
  const args = ['api', 'graphql', '-f', `query=${consulta}`];
  if (cursor) args.push('-f', `c=${cursor}`);
  const r = JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
  const d = r.data.repository.deployments;
  paginas++;
  let fuera = false;
  for (const n of d.nodes) {
    if (Date.parse(n.createdAt) < limite) { fuera = true; break; }
    todos.push({
      id: n.databaseId, sha: n.commitOid, creado: n.createdAt, entorno: n.environment, tarea: n.task,
      quien: n.creator && n.creator.login,
      nEstados: n.statuses.totalCount,
      estados: n.statuses.nodes.map((s) => ({ e: s.state, t: s.createdAt })),
    });
  }
  process.stderr.write(`pagina ${paginas}: ${todos.length}\n`);
  if (fuera || !d.pageInfo.hasNextPage) break;
  cursor = d.pageInfo.endCursor;
  if (paginas > 80) break;
}
fs.writeFileSync(salida, JSON.stringify({ desde, tomada: new Date().toISOString(), despliegues: todos }, null, 1));
const truncados = todos.filter((d) => d.nEstados > d.estados.length).length;
const entornos = [...new Set(todos.map((d) => d.entorno))];
console.log(`POBLACION despliegues=${todos.length} paginas=${paginas} con-estados-truncados=${truncados} entornos=${JSON.stringify(entornos)} mas-viejo=${todos.at(-1)?.creado} mas-nuevo=${todos[0]?.creado}`);
