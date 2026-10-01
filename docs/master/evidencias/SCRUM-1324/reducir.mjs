// docs/master/evidencias/SCRUM-1324/reducir.mjs — SCRUM-1324
//
// Del historial crudo que deja `recoger.mjs` (runs.json, 1,5 MB, fuera del árbol) saca el historial
// REDUCIDO que lee el test: sólo los workflows que hablan del estado de `main` (los que disparan con
// `push` o `schedule`), y de cada run sólo lo que usa la señal — cuándo, qué commit y la conclusión
// de cada job. No se inventa ni se corrige nada: es un recorte.
//
//   node docs/master/evidencias/SCRUM-1324/reducir.mjs <runs.json> <salida.jsonl>
//
// FORMATO de la salida (una línea por run, para que un diff se pueda leer):
//   línea 1  → { tomada, desde, repo, workflows: [{ nombre, jobs: [...] }], codigos }
//   resto    → [ índice del workflow, evento, creado (ISO), sha (8), "una letra por job" ]
// La letra de cada job va en el ORDEN de `workflows[i].jobs`; qué significa cada una, en `codigos`.
import { readFileSync, writeFileSync } from 'node:fs';

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error('uso: node reducir.mjs <runs.json> <salida.jsonl>');
  process.exit(2);
}

export const CODIGOS = {
  s: 'success', f: 'failure', c: 'cancelled', k: 'skipped', p: 'pendiente', '?': 'sin-leer', '-': 'ausente',
};
const LETRA = { success: 's', failure: 'f', cancelled: 'c', skipped: 'k' };
const EVENTOS_DE_MAIN = new Set(['push', 'schedule', 'workflow_dispatch']);

const d = JSON.parse(readFileSync(entrada, 'utf8'));
const deMain = d.runs.filter((r) => EVENTOS_DE_MAIN.has(r.event));
const fuera = {};
for (const r of d.runs) if (!EVENTOS_DE_MAIN.has(r.event)) fuera[`${r.wf} (${r.event})`] = (fuera[`${r.wf} (${r.event})`] || 0) + 1;

const workflows = [];
const indice = new Map();
for (const r of deMain) {
  if (!indice.has(r.wf)) { indice.set(r.wf, workflows.length); workflows.push({ nombre: r.wf, jobs: [] }); }
  const w = workflows[indice.get(r.wf)];
  for (const j of r.jobs || []) if (!w.jobs.includes(j.name)) w.jobs.push(j.name);
}

const lineas = [JSON.stringify({ tomada: d.tomada, desde: d.desde, repo: d.repo, workflows, codigos: CODIGOS })];
for (const r of deMain) {
  const w = workflows[indice.get(r.wf)];
  const letras = w.jobs.map((nombre) => {
    if (r.jobs === null) return '?';
    const j = r.jobs.find((x) => x.name === nombre);
    if (!j) return '-';
    if (j.status !== 'completed') return 'p';
    const l = LETRA[j.conclusion];
    if (!l) throw new Error(`conclusión que no conozco: ${j.conclusion} (run ${r.id}, job ${nombre})`);
    return l;
  }).join('');
  lineas.push(JSON.stringify([indice.get(r.wf), r.event, r.creado, r.sha.slice(0, 8), letras]));
}
writeFileSync(salida, `${lineas.join('\n')}\n`);

console.log(`POBLACION crudo=${d.runs.length} runs · reducido=${deMain.length} runs de ${workflows.length} workflows`);
for (const w of workflows) console.log(`  ${w.nombre}: ${deMain.filter((r) => r.wf === w.nombre).length} runs · jobs: ${w.jobs.join(' | ')}`);
console.log(`  FUERA (reactivos, no hablan del estado de main): ${JSON.stringify(fuera)}`);
console.log('EXIT=0');
