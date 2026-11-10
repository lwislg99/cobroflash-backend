// docs/master/evidencias/SCRUM-1527/1527g/recuento.mjs — SCRUM-1527g · las colgadas del obligatorio desde el 22-oct
//
//     node docs/master/evidencias/SCRUM-1527/1527g/recuento.mjs <jobs.json> [corteISO]
//
// Lee la lista de jobs «build + tests» que deja `jobs.mjs` (mismo esquema que el jobs.json de
// s3-reproduce-hoy.mjs) y la cuenta por la duración del paso «Tests». No baja logs: los logs de los
// sospechosos se leen con el instrumento de la casa (s3-reproduce-hoy.mjs --de-cache).
//
// POR QUÉ LA DURACIÓN BASTA PARA SEÑALAR: el vigía (scripts/tanda-con-veredicto.mjs) sólo escribe
// «TANDA SIN VEREDICTO» tras 15 min de silencio, y ci.yml no cambia ese tope; así que una colgada
// con aviso deja el paso en 900 s o más. Y una colgada SIN aviso sólo puede ser un job cancelado
// por el techo de 25 min con el paso «Tests» empezado: se listan aparte.
//
// Sale 0 si pudo contar; 2 si la lista está vacía o no trae ningún paso de 900 s o más cuando el
// corte deja dentro el colgado conocido del 22-oct (control positivo: job 119769715166).
import { readFileSync } from 'node:fs';

const [fichero, corte] = process.argv.slice(2);
if (!fichero) { console.error('uso: recuento.mjs <jobs.json> [corteISO]'); process.exit(2); }
const jobs = JSON.parse(readFileSync(fichero, 'utf8'));
const POSITIVO = 119769715166;
const fallos = [];
if (!jobs.length) fallos.push('la lista de jobs está vacía');

const duracionJob = (x) => (x.jobInicio && x.jobFin ? (Date.parse(x.jobFin) - Date.parse(x.jobInicio)) / 1000 : null);
const cuenta = (a, k) => a.reduce((c, x) => ((c[k(x)] = (c[k(x)] ?? 0) + 1), c), {});
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ');

const conPaso = jobs.filter((x) => x.paso !== null && x.paso !== 'skipped');
const sinPaso = jobs.filter((x) => x.paso === null || x.paso === 'skipped');
const largos = conPaso.filter((x) => x.dur !== null && x.dur >= 900);
const cancelados = conPaso.filter((x) => x.conclusion === 'cancelled');

console.log(`SCRUM-1527g · población: ${jobs.length} jobs «build + tests» con reintentos · ${fmt(cuenta(jobs, (x) => x.conclusion ?? x.status))}`);
console.log(`creados de ${jobs.map((x) => x.creado).sort()[0]} a ${jobs.map((x) => x.creado).sort().at(-1)} · ${new Set(jobs.map((x) => x.run)).size} ejecuciones`);
console.log(`con paso «Tests»: ${conPaso.length} (${fmt(cuenta(conPaso, (x) => x.paso))}) · ${fmt(cuenta(conPaso, (x) => x.evento))}`);
console.log(`sin paso «Tests» (no corrieron: CIEGO): ${sinPaso.length} (${fmt(cuenta(sinPaso, (x) => x.conclusion ?? x.status))})`);
const durs = conPaso.filter((x) => x.dur !== null && x.paso !== 'cancelled').map((x) => x.dur).sort((a, b) => a - b);
console.log(`paso «Tests» terminado: ${durs.length} · de ${durs[0]} a ${durs.at(-1)} s · mediana ${durs[durs.length >> 1]} s · de 800 s o más: ${durs.filter((d) => d >= 800).length}`);
console.log(`paso «Tests» de 900 s o más (las únicas que pueden llevar el aviso): ${largos.length}`);
for (const x of largos) console.log(`   job ${x.job} · ${x.creado} · ${x.evento} · ${x.rama} · paso ${x.paso} en ${x.dur} s`);
console.log(`cancelados con el paso «Tests» empezado: ${cancelados.length} · paso más largo ${Math.max(...cancelados.map((x) => x.dur ?? 0))} s · job más largo ${Math.max(...cancelados.map(duracionJob))} s (techo 1.500 s)`);
if (corte) {
  for (const [rotulo, f] of [['antes del', (x) => Date.parse(x.creado) < Date.parse(corte)], ['desde el', (x) => Date.parse(x.creado) >= Date.parse(corte)]]) {
    const a = conPaso.filter(f);
    console.log(`${rotulo} corte ${corte}: ${a.length} con paso «Tests» (${fmt(cuenta(a, (x) => x.paso))}) · de 900 s o más: ${a.filter((x) => x.dur >= 900).length}`);
  }
}
// Dentro de la ventana es por FECHA, no por estar en la lista: si la lista lo ha perdido, eso es CIEGO.
const positivoDentro = jobs.length > 0 && jobs.map((x) => x.creado).sort()[0] <= '2026-10-22T10:21:15Z';
console.log(`control positivo (${POSITIVO}): ${positivoDentro ? (largos.some((x) => x.job === POSITIVO) ? 'sale, de 900 s o más' : 'NO SALE') : 'fuera de la ventana'}`);
if (positivoDentro && !largos.some((x) => x.job === POSITIVO)) fallos.push(`el colgado conocido ${POSITIVO} no sale de 900 s o más`);
if (fallos.length) { console.log('CIEGO:'); for (const f of fallos) console.log(`   · ${f}`); process.exitCode = 2; }
