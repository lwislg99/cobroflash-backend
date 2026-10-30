// docs/master/evidencias/SCRUM-1527/1527h/juntar.mjs — SCRUM-1527h · una lista con el positivo dentro
//
//     node docs/master/evidencias/SCRUM-1527/1527h/juntar.mjs <salida.json> <vieja.json> <nueva.json>
//
// La lista de 1527g (22-oct 00:00Z → lectura del 27-oct 13:09Z) lleva dentro el colgado conocido
// 119769715166; la nueva (jobs.mjs desde el 27-oct 13:09Z) no lleva ninguno. Sin él, recuento.mjs y
// s3-reproduce-hoy.mjs no tienen positivo. Se juntan por id de job: si un job sale en las dos (creado
// entre las 13:09:00Z y la hora de lectura de 1527g), gana la NUEVA, que lo leyó terminado.
// Sale 2 si alguna lista está vacía.
import { readFileSync, writeFileSync } from 'node:fs';

const [salida, vieja, nueva] = process.argv.slice(2);
if (!salida || !vieja || !nueva) { console.error('uso: juntar.mjs <salida.json> <vieja.json> <nueva.json>'); process.exit(2); }
const a = JSON.parse(readFileSync(vieja, 'utf8'));
const b = JSON.parse(readFileSync(nueva, 'utf8'));
if (!a.length || !b.length) { console.error(`lista vacía: vieja ${a.length} · nueva ${b.length}`); process.exit(2); }
const porId = new Map(a.map((x) => [x.job, x]));
const repetidos = b.filter((x) => porId.has(x.job)).map((x) => `${x.job}: ${porId.get(x.job).conclusion ?? porId.get(x.job).status} → ${x.conclusion ?? x.status}`);
for (const x of b) porId.set(x.job, x);
const todos = [...porId.values()].sort((x, y) => x.creado.localeCompare(y.creado));
writeFileSync(salida, JSON.stringify(todos, null, 1));
console.log(`vieja ${a.length} · nueva ${b.length} · en las dos ${repetidos.length}${repetidos.length ? ` (${repetidos.join(', ')})` : ''} · juntas ${todos.length}`);
