// 1498e-obligatorio-del-mismo-run.mjs <clas.json> <carpeta de logs> — Solo LECTURA.
// Para cada FAILURE del meta-guard de clase C (un guard sin línea base), baja el log del job obligatorio
// («build + tests (con banco desechable)») del MISMO run y enseña qué dice allí del test que el meta-guard
// encontró caído en su pasada limpia. Es la pregunta que el propio meta-guard manda hacer:
// «si allí también cae, es un rojo del árbol; si allí pasa, falla sólo en el entorno de este job».
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [clasJson, dir] = process.argv.slice(2);
const REPO = 'repos/lwislg99/cobroflash-backend';
const OBLIGATORIO = 'build + tests (con banco desechable)';
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const clas = JSON.parse(fs.readFileSync(clasJson, 'utf8')).filter((o) => o.fin === 'failure' && o.clase.startsWith('C'));
console.log(`POBLACION clase C = ${clas.length}`);
for (const o of clas) {
  const jobs = JSON.parse(gh(['api', `${REPO}/actions/runs/${o.run}/jobs?per_page=100`])).jobs;
  const ob = jobs.find((j) => j.name === OBLIGATORIO);
  // El test que el meta-guard dio por caído, sacado de SU texto: «el test «X» NO aparece EN VERDE».
  const nombres = [...new Set(o.motivos.map((c) => (/el test «(.+?)» NO aparece/.exec(c) || [])[1]).filter(Boolean))];
  const ficheros = [...new Set(o.ciegos)];
  console.log(`\n## run ${o.run} · ${o.rama} · meta-guard ${o.job} · guard(s) sin base: ${ficheros.join(', ')} · test(s): ${nombres.map((n) => `«${n}»`).join(', ') || '(sin nombre de test)'}`);
  if (!ob) { console.log('   obligatorio: NO ESTÁ en el run'); continue; }
  console.log(`   obligatorio ${ob.id}: ${ob.status}/${ob.conclusion}`);
  if (ob.status !== 'completed') continue;
  const p = path.join(dir, `ob-${ob.id}.log`);
  if (!fs.existsSync(p)) fs.writeFileSync(p, gh(['api', '--allow-escape-sequences', `${REPO}/actions/jobs/${ob.id}/logs`]));
  const L = fs.readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, ''));
  console.log(`   log del obligatorio: ${fs.statSync(p).size} B · ${L.length} líneas · centinela de veredicto: ${L.some((l) => /^ℹ (tests|pass|fail) \d+/.test(l)) ? 'sí' : 'NO'}`);
  for (const n of nombres) {
    const hits = L.filter((l) => l.includes(n));
    // Anclado al INICIO del caso (cicatriz ③): «✔ <nombre>» pasa, «✖ <nombre>» cae, con la sangría que sea.
    const pasa = hits.filter((l) => /^\s*✔ /.test(l)).length;
    const cae = hits.filter((l) => /^\s*✖ /.test(l)).length;
    console.log(`   «${n}» en el obligatorio: ${hits.length} línea(s) · empiezan por ✔ ${pasa} · por ✖ ${cae}`);
  }

}
