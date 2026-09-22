import fs from 'node:fs';
const SP = process.argv[2];
const m = new Map();
for (const f of ['runs3.json', 'runs1.json', 'runs2.json']) {
  for (const r of JSON.parse(fs.readFileSync(`${SP}/${f}`, 'utf8')).workflow_runs) m.set(String(r.id), r);
}
const filas = [];
for (const f of fs.readdirSync(SP).filter((x) => /^jobs-\d+\.json$/.test(x))) {
  const id = f.match(/\d+/)[0];
  const j = JSON.parse(fs.readFileSync(`${SP}/${f}`, 'utf8'));
  const mg = j.jobs.find((x) => /meta.?guard/i.test(x.name));
  const run = m.get(id);
  filas.push({ id, creado: run ? run.created_at : '?', rama: run ? (run.head_branch || '') : '?',
    mg: mg ? mg.conclusion : 'NO EXISTE' });
}
filas.sort((a, b) => a.creado.localeCompare(b.creado));
console.log('LOS 28 FALLOS DE ci.yml DESDE EL MERGE DE LA 866, con el veredicto de su job meta-guard:\n');
for (const x of filas) {
  const marca = x.mg === 'failure' ? '🔴 MUDO ' : (x.mg === 'success' ? '   verde' : '   ' + x.mg);
  console.log(`${marca}  ${x.creado}  ${x.id}  ${x.rama.slice(0, 40)}`);
}
const mudos = filas.filter((x) => x.mg === 'failure');
console.log(`\nMUDOS: ${mudos.length} de ${filas.length} fallos consultados UNO A UNO`);
console.log('sus horas: ' + mudos.map((x) => x.creado.slice(11, 19)).join(' · '));
