// SCRUM-1648b · El control del NO-AFLOJAR, por script y no a ojo: compara dos salidas de mide.mjs
// caso a caso, por IDENTIDAD (herramienta + forma + familia), no por posición.
// Uso: node compara.mjs <salida de antes> <salida de después>
// Sale 0 si ningún caso que antes daba BLOQUEA pasa a «deja»; 1 si alguno pasa; 2 si no pudo mirar.
import fs from 'node:fs';

const [ANTES, DESPUES] = process.argv.slice(2);
const leer = (f) => {
  const filas = new Map();
  for (const linea of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const c = linea.split('\t');
    if (c.length < 6 || !/^(ok|MAL)\s*$/.test(c[0]) || !/^(deja|BLOQUEA)$/.test(c[4])) continue; // la cabecera no es un caso
    filas.set(`${c[1]} · ${c[2]} · ${c[3]}`, { debe: c[4], visto: c[5], ok: c[0].trim() === 'ok' });
  }
  return filas;
};
const antes = leer(ANTES);
const despues = leer(DESPUES);
if (antes.size === 0 || despues.size === 0) { console.log(`CIEGO: antes=${antes.size} después=${despues.size} filas leídas`); process.exit(2); }

const bloqueabaAntes = [...antes].filter(([, f]) => f.visto === 'BLOQUEA');
const aflojados = [];
const destrabados = [];
const sinPareja = [];
for (const [id, a] of antes) {
  const d = despues.get(id);
  if (!d) { sinPareja.push(id); continue; }
  if (a.visto === 'BLOQUEA' && d.visto !== 'BLOQUEA') (a.debe === 'deja' ? destrabados : aflojados).push(id);
}
const nuevos = [...despues.keys()].filter((id) => !antes.has(id));
const mal = (m) => [...m].filter(([, f]) => !f.ok).map(([id]) => id);

console.log(`POBLACION\tantes=${antes.size}\tdespués=${despues.size}\tbloqueaba_antes=${bloqueabaAntes.length}\tsin_pareja=${sinPareja.length}\tnuevos=${nuevos.length}`);
console.log(`MAL\tantes=${mal(antes).length}\tdespués=${mal(despues).length}`);
for (const id of mal(despues)) console.log(`  sigue MAL\t${id}\tdebe=${despues.get(id).debe}\tvisto=${despues.get(id).visto}`);
for (const id of destrabados) console.log(`  DESTRABADO (debía dejar y bloqueaba)\t${id}`);
for (const id of nuevos) console.log(`  caso NUEVO\t${id}\t${despues.get(id).ok ? 'ok' : 'MAL'}`);
for (const id of aflojados) console.log(`  🔴 AFLOJADO (bloqueaba, debía bloquear y ahora deja)\t${id}`);
console.log(`VEREDICTO\taflojados=${aflojados.length}\tdestrabados=${destrabados.length}`);
if (sinPareja.length) { console.log(`CIEGO: ${sinPareja.length} casos de antes no están después`); process.exit(2); }
process.exit(aflojados.length ? 1 : 0);
