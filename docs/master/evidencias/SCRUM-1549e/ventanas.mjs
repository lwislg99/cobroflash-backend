// Para cada merge a main que tocó sesion.mjs: cuánto tardó la copia instalada en volver a casar,
// contando como refresco cada pasada de arranque.cmd registrada en arranque.log (la copia va antes
// del node que escribe la línea). Población: los merges de `git log --first-parent` y las líneas de log.
import fs from 'node:fs';
const [ficheroMerges, log, refrescoManual] = process.argv.slice(2);
const merges = fs.readFileSync(ficheroMerges, 'utf8').trim().split('\n').map((l) => {
  const [sha, cuando, ...r] = l.split(' ');
  return { sha, cuando: new Date(cuando), pr: (r.join(' ').match(/#\d+/) || [''])[0] };
}).reverse();
const pasadas = fs.readFileSync(log, 'utf8').split('\n').map((l) => { try { return new Date(JSON.parse(l).cuando); } catch { return null; } }).filter(Boolean);
if (refrescoManual) pasadas.push(new Date(refrescoManual));
pasadas.sort((a, b) => a - b);
console.log(`pasadas en el log: ${pasadas.length} · primera ${pasadas[0]?.toISOString()} · última ${pasadas.at(-2)?.toISOString()}`);
for (let i = 0; i < merges.length; i++) {
  const m = merges[i];
  const sig = pasadas.find((p) => p > m.cuando);
  const otro = merges[i + 1] && sig && merges[i + 1].cuando < sig ? ' (otro merge antes del refresco)' : '';
  const h = sig ? ((sig - m.cuando) / 3.6e6).toFixed(1) + ' h' : 'SIN REFRESCO';
  console.log(`${m.cuando.toISOString()} ${m.sha} ${m.pr.padEnd(6)} → ${sig ? sig.toISOString() : '-'}  cerrada ${h}${otro}`);
}
