// docs/master/evidencias/SCRUM-1324/barrido.mjs — SCRUM-1324
//
// Pasa el vigía por CADA instante del historial real (uno por run) y dice qué avisos habrían
// saltado, cuándo empezó cada uno y cuándo se apagó. Es la respuesta a «con los datos de entonces,
// ¿se habría disparado?», sin fabricar nada. Sólo lee el fixture.
//
//   node docs/master/evidencias/SCRUM-1324/barrido.mjs [historial.jsonl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  leerHistorial, veredicto, umbralDeRojos, umbralDeRunsSinEjecutar, umbralDeHorasDeCron,
  serieDe, rachasRojas, JOBS_DE_MAIN,
} from '../../../../scripts/vigia-silencio-de-main.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const fichero = process.argv[2] || join(RAIZ, 'tests', 'fixtures', 'scrum1324-historial-main.jsonl');
const h = leerHistorial(readFileSync(fichero, 'utf8'));
const OBLIGATORIOS = ['build + tests (con banco desechable)'];
const horas = (a, b) => ((Date.parse(b) - Date.parse(a)) / 3600000).toFixed(1);

console.log(`POBLACION runs=${h.runs.length} · ${h.runs[0].creado} → ${h.runs.at(-1).creado} · tomada ${h.tomada}`);

const r = umbralDeRojos(h.runs);
console.log(`\numbral de rojos seguidos (derivado): ${r.umbral}`);
for (const d of r.detalle) console.log(`  N=${d.N}: peor job «${d.job}» · ${d.rojos} rojos de ${d.fuera} fuera de rachas ≥${d.N} (${(100 * d.p).toFixed(1)} %) → ${d.esperadas.toFixed(2)} rachas por azar en 30 días`);
const s = umbralDeRunsSinEjecutar(h.runs);
console.log(`umbral de runs sin ejecutar (derivado): ${s.umbral} · hueco máximo ${s.hueco} en «${s.job}»`);
const c = umbralDeHorasDeCron(h.runs);
console.log(`umbral de horas de cron (derivado): ${c.umbral} · hueco máximo ${c.horas.toFixed(1)} h en «${c.job}» desde ${c.desde}`);

console.log('\nrachas rojas por job (tamaño → cuántas):');
for (const j of JOBS_DE_MAIN) {
  const dist = {};
  for (const x of rachasRojas(serieDe(h.runs, j.workflow, j.job))) dist[x.tamano] = (dist[x.tamano] || 0) + 1;
  console.log(`  ${j.workflow} / ${j.job}: ${JSON.stringify(dist)}`);
}

// El barrido: un instante por run, más «tomada», más una rejilla de 30 minutos (un cron se mide en
// horas, y entre dos runs suyos también pasa el tiempo). En cada uno, el conjunto de avisos.
const rejilla = [];
for (let t = Date.parse(h.runs[0].creado); t <= Date.parse(h.tomada); t += 30 * 60000) rejilla.push(new Date(t).toISOString().replace(".000Z", "Z"));
const instantes = [...new Set([...h.runs.map((x) => x.creado), ...rejilla, h.tomada])].sort();
const abiertos = new Map();
const episodios = [];
for (const ahora of instantes) {
  const v = veredicto({ runs: h.runs, ahora, obligatorios: OBLIGATORIOS });
  const ahoraAvisan = new Map(v.avisos.map((f) => [`${f.estado} · ${f.workflow} / ${f.job}`, f]));
  for (const [k, f] of ahoraAvisan) if (!abiertos.has(k)) abiertos.set(k, { clave: k, desde: ahora, motivo: f.motivo });
  for (const [k, e] of [...abiertos]) if (!ahoraAvisan.has(k)) { episodios.push({ ...e, hasta: ahora }); abiertos.delete(k); }
}
for (const e of abiertos.values()) episodios.push({ ...e, hasta: null });
episodios.sort((a, b) => a.desde.localeCompare(b.desde));

console.log(`\nEPISODIOS DE AVISO sobre ${instantes.length} instantes: ${episodios.length}`);
for (const e of episodios) {
  console.log(`  ${e.desde} → ${e.hasta ?? 'SIGUE VIVO'} (${horas(e.desde, e.hasta ?? h.tomada)} h) · ${e.clave}`);
}

const fin = veredicto({ runs: h.runs, ahora: h.tomada, obligatorios: OBLIGATORIOS });
console.log(`\nESTADO en ${h.tomada}:`);
for (const f of fin.filas) console.log(`  ${f.estado.padEnd(14)} ${f.obligatorio ? 'OBLIG.' : '      '} ${f.workflow} / ${f.job} · ${f.ejecuciones}/${f.runs} · ${f.motivo || f.ultima}`);
console.log(`sin declarar: ${JSON.stringify(fin.sinDeclarar)}`);
console.log('EXIT=0');
