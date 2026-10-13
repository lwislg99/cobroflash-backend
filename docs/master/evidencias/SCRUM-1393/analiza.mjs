// analiza.mjs <dir de datos> — SOLO LEE los cuatro ficheros de datos y cruza:
//   commit de main (primer padre)  x  su corrida del CI por push  x  los despliegues de Railway.
// No hace red. Uso: node analiza.mjs [dir de los datos; por defecto, esta carpeta]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
const lee = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const { runs } = lee('datos-push-main.json');
const suites = lee('datos-jobs.json');
const { despliegues, tomada } = lee('datos-despliegues.json');
const commits = fs.readFileSync(path.join(dir, 'datos-main-primer-padre.txt'), 'utf8').split(/\r?\n/).filter(Boolean)
  .map((l) => { const [sha, fecha] = l.split(' '); return { sha, fecha }; });

const OBLIG = 'build + tests';
const DESDE = Date.parse('2026-09-07T00:00:00Z');
const min = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
const r1 = (x) => Math.round(x * 10) / 10;
const cuantil = (v, q) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const resumen = (v) => (v.length ? `n=${v.length} · min ${r1(Math.min(...v))} · p50 ${r1(cuantil(v, 0.5))} · p90 ${r1(cuantil(v, 0.9))} · max ${r1(Math.max(...v))}` : 'n=0');
const cuenta = (lista, f) => { const m = {}; for (const x of lista) { const k = f(x); m[k] = (m[k] || 0) + 1; } return m; };
const tabla = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `    ${String(n).padStart(5)}  ${k}`).join('\n');

// ── 1 · cada corrida, clasificada por el JOB obligatorio (no por la conclusion de la corrida) ──
function clase(r) {
  const s = suites[r.suite];
  const ob = s ? s.nodes.filter((n) => n.name.startsWith(OBLIG)) : [];
  const o = ob.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))[0];
  if (o && o.status === 'COMPLETED' && o.conclusion === 'SUCCESS') return { c: 'VERDE', o };
  if (o && o.status === 'COMPLETED' && o.conclusion === 'FAILURE') return { c: 'ROJO', o };
  if (r.estado !== 'completed') return { c: 'CORRIENDO-O-EN-COLA', o };
  if (r.jobs === 0 && r.fin === 'cancelled') return { c: 'CANCELADA-0-JOBS', o };
  if (r.jobs === 0 && r.fin === 'failure') return { c: 'FAILURE-0-JOBS', o };
  if (r.jobs === 0) return { c: `OTRA-0-JOBS(${r.fin})`, o };
  return { c: `CON-JOBS-SIN-VEREDICTO(${o ? o.conclusion : 'obligatorio ausente'})`, o };
}
for (const r of runs) Object.assign(r, { k: clase(r) });
const creados = runs.map((r) => r.creado).sort();
const utc = (iso) => new Date(iso).toISOString().slice(0, 16) + 'Z';
console.log(`POBLACION corridas del CI por push a main=${runs.length} (${creados[0]} .. ${creados.at(-1)}) · suites con jobs leidas=${Object.keys(suites).length} · despliegues=${despliegues.length} · commits de main (primer padre)=${commits.length} · datos tomados ${tomada}`);

console.log('\n== A · LAS CORRIDAS, por lo que dijo el JOB obligatorio ==');
console.log(tabla(cuenta(runs, (r) => r.k.c)));
console.log('  y cruzado con la conclusion de la CORRIDA (lo que se ve en la lista de Actions):');
console.log(tabla(cuenta(runs, (r) => `${r.k.c}  <-  corrida ${r.estado}/${r.fin} · jobs ${r.jobs === 0 ? '0' : '>0'}`)));

// ── 2 · por COMMIT de main ──
const PRIORIDAD = ['VERDE', 'ROJO', 'CORRIENDO-O-EN-COLA'];
const porSha = new Map();
for (const r of runs) { if (!porSha.has(r.sha)) porSha.set(r.sha, []); porSha.get(r.sha).push(r); }
function claseDeSha(sha) {
  const rs = porSha.get(sha);
  if (!rs) return { c: 'SIN-CORRIDA', r: null };
  for (const p of PRIORIDAD) { const r = rs.find((x) => x.k.c === p); if (r) return { c: p, r }; }
  return { c: rs[0].k.c, r: rs[0] };
}
const enVentana = commits.filter((c) => Date.parse(c.fecha) >= DESDE);
for (const c of enVentana) Object.assign(c, { k: claseDeSha(c.sha) });
console.log(`\n== B · LOS COMMITS DE main (primer padre, desde 2026-09-07): ${enVentana.length} ==`);
console.log(tabla(cuenta(enVentana, (c) => c.k.c)));
const verdes = enVentana.filter((c) => c.k.c === 'VERDE').length;
console.log(`  con veredicto propio (VERDE o ROJO): ${enVentana.filter((c) => /^(VERDE|ROJO)$/.test(c.k.c)).length} de ${enVentana.length} · VERDE sobre ESE commit: ${verdes} (${r1(100 * verdes / enVentana.length)} %)`);
const multi = [...porSha.values()].filter((v) => v.length > 1).length;
console.log(`  shas con mas de una corrida: ${multi} · corridas cuyo sha NO es un commit de primer padre de main: ${runs.filter((r) => !commits.some((c) => c.sha === r.sha)).length}`);

// ── 3 · FAILURE con 0 jobs: cuantas, desde cuando, y en que se distinguen ──
const f0 = runs.filter((r) => r.k.c === 'FAILURE-0-JOBS');
console.log(`\n== C · CORRIDAS failure CON 0 JOBS: ${f0.length} ==`);
for (const r of f0) console.log(`    ${r.creado} · run ${r.id} · ${r.sha.slice(0, 8)} · intento ${r.intento} · creada->tocada ${r1(min(r.creado, r.tocado))} min`);
console.log('  por dia: ' + JSON.stringify(cuenta(f0, (r) => r.creado.slice(0, 10))));
const c0 = runs.filter((r) => r.k.c === 'CANCELADA-0-JOBS');
console.log(`  comparacion · creada->tocada (min): FAILURE-0-JOBS ${resumen(f0.map((r) => min(r.creado, r.tocado)))}`);
console.log(`                                       CANCELADA-0-JOBS ${resumen(c0.map((r) => min(r.creado, r.tocado)))}`);
console.log(`  failure CON jobs y obligatorio VERDE (rojo de un informativo): ${runs.filter((r) => r.fin === 'failure' && r.k.c === 'VERDE').length} · failure con obligatorio ROJO: ${runs.filter((r) => r.fin === 'failure' && r.k.c === 'ROJO').length} · failure en total: ${runs.filter((r) => r.fin === 'failure').length}`);

// ── 4 · los ROJOS del obligatorio en main: cuanto tarda en NACER y cuanto hasta el siguiente VERDE ──
const orden = [...enVentana].reverse(); // del mas viejo al mas nuevo
const idx = new Map(orden.map((c, i) => [c.sha, i]));
const veredictos = runs.filter((r) => /^(VERDE|ROJO)$/.test(r.k.c) && idx.has(r.sha)).map((r) => ({ r, t: r.k.o.completedAt, i: idx.get(r.sha) }));
const rojos = veredictos.filter((v) => v.r.k.c === 'ROJO').sort((a, b) => a.t.localeCompare(b.t));
console.log(`\n== D · ROJOS DEL OBLIGATORIO SOBRE UN COMMIT DE main: ${rojos.length} ==`);
const nacer = []; const hastaVerde = []; const debajo = []; const desplegadosMientras = [];
const sinProbarDebajo = []; const latidosVivos = [];
const episodios = [];
// las pasadas del latido de arranque EN ESTA MAQUINA (equipo de Javier); existe desde el 1-oct-2026
const fLatido = path.join(dir, 'datos-latido-pasadas.txt');
const latidos = fs.existsSync(fLatido) ? fs.readFileSync(fLatido, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l).cuando).sort() : [];
const conVeredicto = new Set(veredictos.map((w) => w.i));
for (const v of rojos) {
  const c = orden[v.i];
  const tNace = min(v.r.creado, v.t);
  // commits de main inmediatamente DEBAJO que no tuvieron veredicto propio: este rojo es su primera prueba
  let sp = 0; for (let j = v.i - 1; j >= 0 && !conVeredicto.has(j); j--) sp++;
  sinProbarDebajo.push(sp);
  // commits de main que ya habian entrado ENCIMA cuando el rojo se pudo leer
  const encima = orden.filter((x, j) => j > v.i && Date.parse(x.fecha) <= Date.parse(v.t)).length;
  // primer veredicto VERDE de un commit IGUAL o POSTERIOR, terminado despues de este rojo
  const sig = veredictos.filter((w) => w.r.k.c === 'VERDE' && w.i >= v.i && w.t > v.t).sort((a, b) => a.t.localeCompare(b.t))[0];
  const tVerde = sig ? min(v.t, sig.t) : null;
  const dep = despliegues.filter((d) => Date.parse(d.creado) >= Date.parse(c.fecha) && (!sig || Date.parse(d.creado) <= Date.parse(sig.t))).length;
  nacer.push(tNace); debajo.push(encima); if (tVerde !== null) hastaVerde.push(tVerde); desplegadosMientras.push(dep);
  const lat = latidos.length && v.t >= latidos[0] ? latidos.filter((t) => t >= v.t && (!sig || t <= sig.t)).length : null;
  if (lat !== null) latidosVivos.push(lat);
  episodios.push(`    ${c.sha.slice(0, 8)} · entra ${utc(c.fecha)} · rojo legible ${utc(v.t)} (+${r1(tNace)} min) · ${sp} sin probar debajo · ${encima} ya encima · siguiente VERDE ${sig ? `+${r1(tVerde)} min (${orden[sig.i].sha.slice(0, 8)})` : 'NINGUNO en la ventana'} · despliegues entre medias ${dep} · latidos de arranque mientras vivio ${lat === null ? 'n/a (anterior al rastro)' : lat}`);
}
console.log(episodios.join('\n'));
console.log(`  commits SIN veredicto propio justo debajo del rojo (el rojo es su primera prueba; no se sabe de cual es): ${resumen(sinProbarDebajo)} · rojos con alguno debajo: ${sinProbarDebajo.filter((x) => x > 0).length} de ${rojos.length}`);
console.log(`  latido de arranque (rastro de ESTA maquina: ${latidos.length} pasadas, ${latidos[0] || '-'} .. ${latidos.at(-1) || '-'}): rojos posteriores al primer rastro ${latidosVivos.length} · con AL MENOS una pasada mientras el rojo era el ultimo veredicto ${latidosVivos.filter((x) => x > 0).length} · con ninguna ${latidosVivos.filter((x) => x === 0).length}`);
const huecos = latidos.slice(1).map((t, i) => min(latidos[i], t));
console.log(`  cada cuanto corre ese latido (min entre dos pasadas seguidas): ${resumen(huecos)} · huecos de mas de 60 min: ${huecos.filter((h) => h > 60).length} · de mas de 8 h: ${huecos.filter((h) => h > 480).length}`);
console.log(`  push -> rojo LEGIBLE (min): ${resumen(nacer)}`);
console.log(`  commits ya encima cuando el rojo se puede leer: ${resumen(debajo)}`);
console.log(`  rojo legible -> siguiente VERDE de main (min): ${resumen(hastaVerde)} · sin verde posterior: ${rojos.length - hastaVerde.length}`);
console.log(`  despliegues a produccion entre que entra el commit rojo y el siguiente verde: ${resumen(desplegadosMientras)} · suma ${desplegadosMientras.reduce((a, b) => a + b, 0)}`);
// y lo mismo para TODO veredicto: cuanto tarda main en decir algo de un commit
const todosV = veredictos.map((v) => min(v.r.creado, v.t));
console.log(`  (referencia) push -> veredicto del obligatorio, VERDE o ROJO (min): ${resumen(todosV)}`);

// ── 5 · PRODUCCION: que se desplego, y que se sabia de ese commit ──
const estadosDe = (d) => d.estados.map((s) => s.e);
console.log(`\n== E · DESPLIEGUES A PRODUCCION: ${despliegues.length} (entorno unico: ${[...new Set(despliegues.map((d) => d.entorno))].join(' | ')}) ==`);
console.log('  por el conjunto de estados que Railway le conto a GitHub:');
console.log(tabla(cuenta(despliegues, (d) => [...new Set(estadosDe(d))].sort().join('+') || '(sin estados)')));
const exito = (d) => d.estados.find((s) => s.e === 'SUCCESS');
const servidos = despliegues.filter(exito).map((d) => ({ d, t: exito(d).t })).sort((a, b) => a.t.localeCompare(b.t));
console.log(`  llegaron a SUCCESS (se sirvieron): ${servidos.length} de ${despliegues.length} · shas distintos servidos: ${new Set(servidos.map((s) => s.d.sha)).size}`);
console.log(`  shas desplegados que NO son commit de primer padre de main: ${servidos.filter((s) => !commits.some((c) => c.sha === s.d.sha)).length}`);
for (const s of servidos) {
  s.k = claseDeSha(s.d.sha);
  const o = s.k.r && s.k.r.k.o;
  s.veredictoT = o && o.completedAt ? o.completedAt : null;
  s.antes = s.veredictoT ? Date.parse(s.t) < Date.parse(s.veredictoT) : null;
}
console.log('  lo que el CI de main dijo (alguna vez) de ESE commit servido:');
console.log(tabla(cuenta(servidos, (s) => s.k.c)));
const conV = servidos.filter((s) => s.veredictoT);
console.log(`  de los ${conV.length} servidos cuyo commit tuvo veredicto: servido ANTES de tenerlo ${conV.filter((s) => s.antes).length} · despues ${conV.filter((s) => !s.antes).length}`);
console.log(`  adelanto del despliegue sobre el veredicto (min, positivo = se sirvio antes): ${resumen(conV.map((s) => min(s.t, s.veredictoT)))}`);
console.log(`  merge -> servido (min): ${resumen(servidos.map((s) => { const c = commits.find((x) => x.sha === s.d.sha); return c ? min(c.fecha, s.t) : null; }).filter((x) => x !== null))}`);

// tiempo sirviendo cada clase: desde su SUCCESS hasta el SUCCESS del siguiente
const fin = Date.parse(tomada);
const tiempo = {}; let total = 0;
servidos.forEach((s, i) => {
  const hasta = i + 1 < servidos.length ? Date.parse(servidos[i + 1].t) : fin;
  const m = (hasta - Date.parse(s.t)) / 60000;
  s.minSirviendo = m;
  tiempo[s.k.c] = (tiempo[s.k.c] || 0) + m; total += m;
});
console.log(`  TIEMPO que produccion sirvio cada clase de commit (horas, de ${r1(total / 60)} h en total):`);
console.log(Object.entries(tiempo).sort((a, b) => b[1] - a[1]).map(([k, m]) => `    ${String(r1(m / 60)).padStart(7)} h  ${String(r1(100 * m / total)).padStart(5)} %  ${k}`).join('\n'));
const servidosRojos = servidos.filter((s) => s.k.c === 'ROJO');
console.log(`  commits con el obligatorio en ROJO sobre main que se SIRVIERON: ${servidosRojos.length}`);
for (const s of servidosRojos) console.log(`    ${s.d.sha.slice(0, 8)} · servido ${s.t.slice(0, 16)}Z · rojo legible ${s.veredictoT.slice(0, 16)}Z · ${s.antes ? 'servido ANTES de poder saberse' : 'servido con el rojo YA legible'} · sirvio ${r1(s.minSirviendo)} min hasta el siguiente despliegue`);
// rachas de despliegues seguidos sin un commit VERDE propio
let racha = 0; let peor = 0; let peorDesde = null; let desde = null; let peorMin = 0; let acum = 0;
for (const s of servidos) {
  if (s.k.c === 'VERDE') { racha = 0; acum = 0; desde = null; continue; }
  if (!racha) desde = s.t; racha++; acum += s.minSirviendo;
  if (racha > peor) { peor = racha; peorDesde = desde; peorMin = acum; }
}
// ── 5bis · COBERTURA: lo servido, ¿estaba cubierto por un VERDE de ese commit o de uno POSTERIOR ya terminado? ──
// (un verde de un descendiente prueba el arbol que contiene a este commit; es la lectura mas generosa)
const verdesT = veredictos.filter((w) => w.r.k.c === 'VERDE');
let minSinCubrir = 0; let nuncaCubiertos = 0; let cubiertosAlServir = 0; const esperaCobertura = [];
servidos.forEach((s, i) => {
  const hasta = i + 1 < servidos.length ? Date.parse(servidos[i + 1].t) : fin;
  const yo = idx.get(s.d.sha);
  const cub = yo === undefined ? null : verdesT.filter((w) => w.i >= yo).map((w) => Date.parse(w.t)).sort((a, b) => a - b)[0];
  const desde = Date.parse(s.t);
  if (cub !== undefined && cub !== null && cub <= desde) { cubiertosAlServir++; return; }
  if (cub === undefined || cub === null || cub >= hasta) { nuncaCubiertos++; minSinCubrir += (hasta - desde) / 60000; return; }
  minSinCubrir += (cub - desde) / 60000; esperaCobertura.push((cub - desde) / 60000);
});
console.log(`  COBERTURA de lo servido (verde de ESE commit o de uno posterior, ya terminado):`);
console.log(`    ya cubierto al empezar a servirse: ${cubiertosAlServir} de ${servidos.length} (${r1(100 * cubiertosAlServir / servidos.length)} %)`);
console.log(`    se cubrio MIENTRAS se servia: ${esperaCobertura.length} · espera (min) ${resumen(esperaCobertura)}`);
console.log(`    SUSTITUIDO por otro despliegue sin haber estado cubierto ni un minuto: ${nuncaCubiertos} de ${servidos.length} (${r1(100 * nuncaCubiertos / servidos.length)} %)`);
console.log(`    horas de produccion sirviendo algo SIN cubrir: ${r1(minSinCubrir / 60)} de ${r1(total / 60)} (${r1(100 * minSinCubrir / total)} %)`);
console.log(`    VERDE propio y servido DESPUES de conocerse: ${servidos.filter((s) => s.k.c === 'VERDE' && s.antes === false).length} de ${servidos.length}`);
console.log(`  racha mas larga de despliegues seguidos cuyo commit no tiene VERDE propio: ${peor} (desde ${peorDesde}, ${r1(peorMin / 60)} h)`);

// ── 6 · CONTROLES ──
console.log('\n== F · CONTROLES ==');
const cebo = '0000000000000000000000000000000000000000';
console.log(`  control a CERO · corridas del sha ${cebo.slice(0, 8)}…: ${runs.filter((r) => r.sha === cebo).length} · despliegues: ${despliegues.filter((d) => d.sha === cebo).length} · commits: ${commits.filter((c) => c.sha === cebo).length}`);
for (const p of ['cadf00bc', 'cae4c5cc', '965e3d05']) {
  const rs = runs.filter((r) => r.sha.startsWith(p));
  const ds = despliegues.filter((d) => d.sha.startsWith(p));
  console.log(`  caso conocido ${p}: corridas ${rs.length} [${rs.map((r) => `${r.id} corrida=${r.fin} jobs=${r.jobs} -> ${r.k.c}`).join(' ; ')}] · despliegues ${ds.length} [${ds.map((d) => [...new Set(estadosDe(d))].join('+')).join(' ; ')}]`);
}
console.log('EXIT=0');
