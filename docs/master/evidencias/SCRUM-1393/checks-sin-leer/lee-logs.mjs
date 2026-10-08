// lee-logs.mjs <datos-pr.json> <carpeta de logs, FUERA del arbol> [PR de control verde]
// Solo LECTURA. Baja (si no esta ya) el log de cada job no obligatorio que GitHub da por `failure`
// o `cancelled` en la punta de un PR de la poblacion, y saca la linea en la que el propio job dice
// que le paso. La conclusion de GitHub tiene dos valores; el log del meta-guard tiene cuatro
// (vivas, mudas, ciegas, ficheros muertos), y solo «mudas» quiere decir que un guard NO cae.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [fDatos, dir, control] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(fDatos, 'utf8'));
fs.mkdirSync(dir, { recursive: true });
const log = (id) => {
  const f = path.join(dir, `${id}.log`);
  if (!fs.existsSync(f) || !fs.statSync(f).size) {
    fs.writeFileSync(f, execFileSync('gh', ['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${id}/logs`], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }));
  }
  // Cada linea trae delante la hora del runner: se guarda aparte para medir silencios.
  // El log trae los escapes de color del runner (por eso se pide con --allow-escape-sequences): se
  // quitan al leer, para que la salida de este guion no lleve bytes de control (lo vigila scrum942).
  return fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => ({ hora: l.slice(0, 28), txt: l.slice(29).replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') }));
};

const jobs = [];
for (const pr of d.prs) for (const r of pr.runs) for (const j of r.jobs) {
  if (j.fin === 'failure' || j.fin === 'cancelled' || j.fin === 'timed_out') jobs.push({ pr: pr.n, ...j, ultimo: j.intento === r.intento });
}
jobs.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.pr - b.pr);

function lee(j) {
  const L = log(j.id);
  const sal = [];
  const err = L.filter((l) => l.txt.startsWith('##[error]')).map((l) => l.txt.slice(9, 170));
  if (/^meta-guard/.test(j.nombre)) {
    const resumen = L.filter((l) => /^vivas \d+ · mudas \d+/.test(l.txt)).map((l) => l.txt);
    const marcas = {};
    for (const l of L) { const m = /^ {2}(\?|☠|✖) (\S+)/.exec(l.txt); if (m) marcas[`${m[1]} ${m[2]}`] = (marcas[`${m[1]} ${m[2]}`] || 0) + 1; }
    const vivas = L.filter((l) => /^ {2}✔ /.test(l.txt)).length;
    sal.push(`resumen del propio meta-guard: ${resumen.length === 1 ? resumen[0] : `NO HAY UNA SOLA LINEA DE RESUMEN (${resumen.length})`}`);
    sal.push(`lineas ✔ contadas aqui: ${vivas} · marcadas: ${Object.entries(marcas).map(([k, v]) => `${k} ×${v}`).join(' ; ') || 'ninguna'}`);
  }
  if (/^trinquete/.test(j.nombre)) {
    const i = L.findIndex((l) => l.txt.startsWith('##[error]'));
    const antes = L.slice(0, i).filter((l) => l.txt.trim()).pop();
    sal.push(`ultima linea con texto antes del error: «${antes?.txt.trim().slice(0, 120)}» a las ${antes?.hora} · el error llega a las ${L[i]?.hora} (${((new Date(L[i]?.hora) - new Date(antes?.hora)) / 60000).toFixed(1)} min de silencio)`);
  }
  if (/^constancia/.test(j.nombre) || /^abrir-pr/.test(j.nombre)) {
    for (const l of L.filter((x) => /NO PUDE|^GraphQL:|No se pudo/.test(x.txt)).slice(0, 2)) sal.push(`dice: ${l.txt.slice(0, 200)}`);
  }
  sal.push(`##[error]: ${err.join(' | ') || 'ninguno'}`);
  return sal;
}

console.log(`POBLACION: ${jobs.length} jobs failure/cancelled en ${new Set(jobs.map((j) => j.pr)).size} PR (de ${d.prs.length}), TODOS los intentos, obligatorio incluido · logs en ${path.basename(dir)}`);
let leidos = 0;
for (const j of jobs) {
  console.log(`\n#${j.pr} · «${j.nombre}» · ${j.fin} · job ${j.id} · intento ${j.intento}${j.ultimo ? '' : ' (tapado por un intento posterior)'}`);
  for (const l of lee(j)) console.log(`   ${l}`);
  leidos++;
}
console.log(`\nLEIDOS ${leidos} de ${jobs.length}`);

if (control) {
  const pr = d.prs.find((x) => String(x.n) === String(control));
  const j = pr?.runs.flatMap((r) => r.jobs).find((x) => /^meta-guard/.test(x.nombre) && x.fin === 'success');
  console.log(`\nCONTROL · el meta-guard de un PR que este metodo da por verde entero (#${control}, job ${j?.id ?? 'NO ENCONTRADO'}):`);
  if (j) for (const l of lee(j)) console.log(`   ${l}`);
}
