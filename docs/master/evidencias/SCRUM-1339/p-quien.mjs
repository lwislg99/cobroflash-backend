// docs/master/evidencias/SCRUM-1339/p-quien.mjs — SCRUM-1339p · SÓLO LECTURA (API de GitHub).
//
// ¿QUIÉN RECOGE EL 2 DEL META-GUARD? Tres preguntas, medidas por separado:
//   ① ¿es un check requerido? (las reglas vivas de `main`)
//   ② de las ejecuciones que salieron con 2 sobre la punta con la que un PR entró: ¿el 2 ya
//      estaba dicho cuando se mergeó («sale con 2 y entra igual»), o llegó después («no espera»)?
//      Y lo mismo para las que salieron con 0, que es el grupo de comparación.
//   ③ el único workflow que reacciona al CI en rojo («Avisador de PR en rojo»): qué veredicto
//      dio en cada una de esas ejecuciones.
//
//   node p-quien.mjs <p-filas.json (salida de p-leer.mjs)> <carpeta para los logs del avisador, FUERA del árbol> <salida.json>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [fFilas, dir, fSalida] = process.argv.slice(2);
if (!fFilas || !dir || !fSalida) { console.error('uso: node p-quien.mjs <p-filas.json> <logs del avisador> <salida.json>'); process.exit(2); }
const REPO = 'repos/lwislg99/cobroflash-backend';
const OBLIGATORIO_ESPERADO = 'build + tests (con banco desechable)';
const META = /^meta-guard/;
let llamadas = 0;
const gh = (...a) => { llamadas += 1; return execFileSync('gh', ['api', ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); };
const api = (ruta) => JSON.parse(gh(ruta));
let mal = 0;
const exige = (ok, txt) => { console.log(`${ok ? '✅' : '🔴'} ${txt}`); if (!ok) mal += 1; };
const por = (a, k) => a.reduce((o, x) => { const v = k(x); o[v] = (o[v] || 0) + 1; return o; }, {});
const pinta = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k}: ${n}`).join(' · ');
fs.mkdirSync(dir, { recursive: true });

const ahora = new Date(/^date: (.*)$/im.exec(gh('-i', 'zen'))[1]).toISOString();
const filas = JSON.parse(fs.readFileSync(fFilas, 'utf8'));
console.log(`HORA (cabecera Date de GitHub): ${ahora} · población: ${filas.length} ejecuciones del job del meta-guard (la de p-leer.mjs)`);

// ── ① ¿Es requerido? ─────────────────────────────────────────────────────────────────────────
console.log('\n① LAS REGLAS VIVAS DE main');
const reglas = api(`${REPO}/rules/branches/main`);
const req = reglas.filter((r) => r.type === 'required_status_checks').flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
console.log(`  tipos de regla: ${reglas.map((r) => r.type).join(', ')}`);
console.log(`  checks requeridos (${req.length}): ${req.map((c) => `«${c}»`).join(', ') || 'NINGUNO LEÍDO'}`);
exige(req.includes(OBLIGATORIO_ESPERADO), `POSITIVO: la lista trae «${OBLIGATORIO_ESPERADO}» (si no, no he leído reglas: he leído otra cosa)`);
const metaRequerido = req.some((c) => META.test(c));
console.log(`  ¿hay algún requerido que empiece por «meta-guard»? ${metaRequerido ? 'SÍ' : 'NO'}`);

// ── ② ¿Sale con 2 y entra igual, o no espera? ────────────────────────────────────────────────
console.log('\n② LAS EJECUCIONES DE pull_request FRENTE AL MERGE DE SU PR');
const dePr = filas.filter((f) => f.evento === 'pull_request');
const prs = new Map();
for (const n of new Set(dePr.map((f) => f.pr))) {
  if (!n) continue;
  const p = api(`${REPO}/pulls/${n}`);
  prs.set(n, { merged: p.merged, mergedAt: p.merged_at, head: p.head.sha, estado: p.state, por: p.merged_by?.login ?? null, auto: p.auto_merge ? 'armado' : null });
}
const jobsDe = new Map();
for (const run of new Set(filas.map((f) => f.run))) {
  const js = api(`${REPO}/actions/runs/${run}/jobs?filter=all&per_page=100`).jobs;
  jobsDe.set(run, js);
}
// El obligatorio de ese mismo run, en TODOS sus intentos (un relanzamiento sólo repite lo que cayó,
// así que el meta-guard puede ser del intento 1 y el obligatorio verde del 2).
for (const f of filas) {
  const obs = (jobsDe.get(f.run) || []).filter((j) => j.name === OBLIGATORIO_ESPERADO).sort((a, b) => a.run_attempt - b.run_attempt);
  f.obligatorio = obs.length ? obs.map((j) => j.conclusion ?? `(${j.status})`).join(' → ') : '(no está)';
  f.obligatorioFinal = obs.length ? obs.at(-1).conclusion ?? `(${obs.at(-1).status})` : '(no está)';
}
for (const f of dePr) {
  const p = prs.get(f.pr);
  f.clase = !p ? 'sin PR'
    : !p.merged ? `PR no mergeado (${p.estado})`
      : p.head !== f.sha ? 'el PR entró con OTRA punta'
        : f.estado === 'SIN VEREDICTO' ? 'entró con esta punta · meta-guard SIN VEREDICTO (cancelado)'
          : f.acabo <= p.mergedAt ? 'entró con esta punta · meta-guard YA ACABADO al mergear'
            : 'entró con esta punta · meta-guard TODAVÍA CORRIENDO al mergear';
  f.mergedAt = p?.mergedAt ?? null;
  f.segundos = p?.mergedAt && f.acabo ? Math.round((Date.parse(p.mergedAt) - Date.parse(f.acabo)) / 1000) : null;
}
console.log(`  ${dePr.length} ejecuciones de pull_request en ${prs.size} PR · PR mergeados: ${[...prs.values()].filter((p) => p.merged).length} · quién mergea: ${pinta(por([...prs.values()].filter((p) => p.merged), (p) => p.por))}`);
const tabla = {};
for (const f of dePr) { const o = (tabla[f.clase] ??= { CIEGO: 0, VERDE: 0, 'SIN VEREDICTO': 0 }); o[f.estado] += 1; }
console.log('  clase · salió con 2 (CIEGO) · salió con 0 (VERDE) · sin veredicto');
for (const [k, o] of Object.entries(tabla).sort()) console.log(`    ${k} · ${o.CIEGO} · ${o.VERDE} · ${o['SIN VEREDICTO']}`);
exige(Object.values(tabla).reduce((s, o) => s + o.CIEGO + o.VERDE + o['SIN VEREDICTO'], 0) === dePr.length, `SUMA: las clases dan ${Object.values(tabla).reduce((s, o) => s + o.CIEGO + o.VERDE + o['SIN VEREDICTO'], 0)} = ${dePr.length}`);
const entraron = dePr.filter((f) => f.clase.startsWith('entró con esta punta') && f.estado !== 'SIN VEREDICTO');
const ya = entraron.filter((f) => f.clase.includes('YA ACABADO'));
const corriendo = entraron.filter((f) => f.clase.includes('TODAVÍA'));
const yaRojo = ya.filter((f) => f.estado === 'CIEGO');
console.log(`\n  LAS DOS COSAS, SEPARADAS, sobre las ${entraron.length} ejecuciones con veredicto cuya punta es la que entró:`);
console.log(`   · «NO ESPERA»: el PR se mergeó con el meta-guard todavía corriendo en ${corriendo.length} de ${entraron.length} → de ellas acabaron con 2: ${corriendo.filter((f) => f.estado === 'CIEGO').length} · con 0: ${corriendo.filter((f) => f.estado === 'VERDE').length}`);
console.log(`   · «SALE CON 2 Y ENTRA IGUAL»: el meta-guard ya había acabado en ${ya.length} de ${entraron.length} → de ellas con el 2 YA DICHO antes del merge: ${yaRojo.length} · con 0: ${ya.length - yaRojo.length}`);
for (const f of yaRojo) console.log(`       #${f.pr} · job ${f.job} · meta-guard acabó ${f.acabo} con failure · merge ${f.mergedAt} (${f.segundos} s después) · obligatorio ${f.obligatorio} · sin juzgar: ${[...new Set(f.sinJuzgar.map((x) => x.guard.replace('.test.mjs', '')))].join(', ')}`);
{
  const raras = entraron.filter((f) => f.obligatorioFinal !== 'success');
  console.log(`   · COHERENCIA: de las ${entraron.length}, el obligatorio de ese mismo run acabó en success en ${entraron.length - raras.length} (a la primera en ${entraron.filter((f) => f.obligatorio === 'success').length})${raras.length ? ' · las que NO: ' + raras.map((f) => `#${f.pr} run ${f.run} obligatorio «${f.obligatorio}» · mergeó ${prs.get(f.pr).por}`).join(' | ') : ''}`);
}
const seg = corriendo.map((f) => -f.segundos).sort((a, b) => a - b);
if (seg.length) console.log(`   · cuánto le faltaba al meta-guard al mergear, en las ${seg.length}: de ${seg[0]} a ${seg.at(-1)} s (mediana ${seg[seg.length >> 1]} s)`);
// Controles del encargo sobre ESTA pata: los dos PR que el orquestador nombra.
for (const [n, etiqueta] of [[2354, 'jv-j6b'], [2323, 'jv-j4b']]) {
  const suyas = dePr.filter((f) => f.pr === n);
  console.log(`   · #${n} (${etiqueta}): ${suyas.map((f) => `job ${f.job} ${f.estado} → ${f.clase}${f.segundos !== null ? ` (${f.segundos} s)` : ''}`).join(' | ') || 'NO ESTÁ'}`);
}

// ── ②bis · push a main: ahí no hay nada que bloquear ─────────────────────────────────────────
const dePush = filas.filter((f) => f.evento === 'push' && f.estado !== 'SIN VEREDICTO').sort((a, b) => (a.creado < b.creado ? -1 : 1));
let racha = 0; let maxR = 0;
for (const f of dePush) { racha = f.estado === 'CIEGO' ? racha + 1 : 0; maxR = Math.max(maxR, racha); }
console.log(`\n②bis EN main (push): ${dePush.filter((f) => f.estado === 'CIEGO').length} de ${dePush.length} salen con 2 · racha más larga de rojos seguidos entre las que ejecutaron: ${maxR} · secuencia (R rojo, V verde): ${dePush.map((f) => (f.estado === 'CIEGO' ? 'R' : 'V')).join('')}`);

// ── ③ El avisador ────────────────────────────────────────────────────────────────────────────
console.log('\n③ «Avisador de PR en rojo» (workflow_run del CI): QUÉ HIZO CON CADA 2');
const desde = filas.map((f) => f.creado).sort()[0];
const av = [];
let declarados = null;
for (let pag = 1; pag < 30; pag += 1) {
  const r = api(`${REPO}/actions/workflows/avisador-rojo.yml/runs?per_page=100&page=${pag}&created=${encodeURIComponent('>=' + desde)}`);
  declarados ??= r.total_count;
  av.push(...r.workflow_runs);
  if (r.workflow_runs.length < 100) break;
}
console.log(`  runs del avisador creados desde ${desde}: GitHub declara ${declarados} · traídos ${av.length} · por conclusión: ${pinta(por(av, (r) => r.conclusion ?? `(${r.status})`))}`);
const corridos = av.filter((r) => r.conclusion === 'success' || r.conclusion === 'failure');
const veredictos = [];
for (const r of corridos) {
  const f = path.join(dir, `${r.id}.log`);
  if (!fs.existsSync(f) || !fs.statSync(f).size) {
    try {
      const job = api(`${REPO}/actions/runs/${r.id}/jobs?per_page=100`).jobs[0];
      fs.writeFileSync(f, gh('--allow-escape-sequences', `${REPO}/actions/jobs/${job.id}/logs`));
    } catch (e) { veredictos.push({ run: r.id, bytes: 0, codigo: 'LOG ILEGIBLE', sha: null, ci: null }); continue; }
  }
  const crudo = fs.readFileSync(f, 'utf8');
  const L = crudo.split(/\r?\n/).map((l) => l.slice(29).replace(/\\x1b\[[0-9;]*[A-Za-z]/g, ''));
  const sha = L.map((l) => /^\s*SHA: ([0-9a-f]{40})$/.exec(l)?.[1]).filter(Boolean)[0] ?? null;
  const ci = L.map((l) => /^\s*RUN_ID: (\d+)$/.exec(l)?.[1]).filter(Boolean)[0] ?? null;
  const v = L.map((l) => /^veredicto: (.*)$/.exec(l)?.[1]).filter((x) => x !== undefined)[0];
  const motivo = L.map((l) => /^([A-Z][A-Z-]+) — (.*)$/.exec(l)).filter(Boolean)[0];
  veredictos.push({ run: r.id, bytes: Buffer.byteLength(crudo), codigo: (v ?? '').trim() || (motivo?.[1] ?? 'SIN VEREDICTO LEÍDO'), motivo: motivo?.[2] ?? null, sha, ci, avisado: L.some((l) => /AVISADO/.test(l)) });
}
const pesosAv = veredictos.map((v) => v.bytes).sort((a, b) => a - b);
exige(veredictos.length > 0 && pesosAv[0] > 2000, `TAMAÑO antes de contar: ${veredictos.length} logs del avisador (los que ejecutaron), de ${pesosAv[0]} a ${pesosAv.at(-1)} B`);
exige(veredictos.every((v) => v.ci), `IDENTIDAD: cada log del avisador nombra el run de CI que lo disparó (RUN_ID) en ${veredictos.filter((v) => v.ci).length} de ${veredictos.length}`);
console.log(`  veredicto del avisador en los ${veredictos.length} que ejecutaron: ${pinta(por(veredictos, (v) => v.codigo))}`);
const porCi = new Map(veredictos.map((v) => [String(v.ci), v]));
const ciegos = filas.filter((f) => f.estado === 'CIEGO');
for (const f of ciegos) f.avisador = porCi.get(String(f.run)) ?? null;
console.log(`  de las ${ciegos.length} ejecuciones con 2: con run del avisador que ejecutó ${ciegos.filter((f) => f.avisador).length} · sin él ${ciegos.filter((f) => !f.avisador).length}`);
console.log(`  qué dijo el avisador de las ${ciegos.length}: ${pinta(por(ciegos, (f) => `${f.evento} → ${f.avisador ? f.avisador.codigo : '(no ejecutó o no se encontró)'}`))}`);
console.log(`  LO QUE DECIDE — el 2 del meta-guard A SOLAS (obligatorio de ese run en success) frente a acompañado de un obligatorio rojo:`);
for (const [k, n] of Object.entries(por(ciegos, (f) => `obligatorio ${f.obligatorio} · ${f.evento} → avisador ${f.avisador ? f.avisador.codigo : '(no ejecutó o no se encontró)'}`)).sort()) console.log(`    ${n} · ${k}`);
const solas = ciegos.filter((f) => f.obligatorioFinal === 'success');
console.log(`  A SOLAS: ${solas.length} de ${ciegos.length} · de ellas el avisador PUBLICÓ aviso en ${solas.filter((f) => f.avisador?.avisado).length} · con el obligatorio también rojo: ${ciegos.length - solas.length}, y de ellas avisó en ${ciegos.filter((f) => f.obligatorioFinal !== 'success' && f.avisador?.avisado).length}`);
const nombranMeta = ciegos.filter((f) => f.avisador?.avisado);
// Control positivo de este lector: ¿sabe ver un AVISADO cuando lo hay, en toda la ventana?
const avisados = veredictos.filter((v) => v.avisado || v.codigo === 'AVISAR');
console.log(`  POSITIVO del lector: avisos publicados en toda la ventana (por cualquier rojo): ${avisados.length}${avisados.length ? ' → CI ' + avisados.slice(0, 8).map((v) => v.ci).join(', ') : ' — CERO: este lector no ha visto ni un aviso, así que su «0 avisados» de arriba no distingue «no avisa por el meta-guard» de «no sé leer un aviso»'}`);
if (nombranMeta[0]) console.log(`  el motivo literal de uno de los avisos publicados sobre una ejecución con 2: «${nombranMeta[0].avisador.codigo} — ${nombranMeta[0].avisador.motivo.slice(0, 260)}»`);

fs.writeFileSync(fSalida, JSON.stringify({ ahora, requeridos: req, filas: filas.map((f) => ({ pr: f.pr, run: f.run, job: f.job, evento: f.evento, estado: f.estado, acabo: f.acabo, clase: f.clase ?? null, mergedAt: f.mergedAt ?? null, segundos: f.segundos ?? null, obligatorio: f.obligatorio ?? null, obligatorioFinal: f.obligatorioFinal ?? null, avisador: f.avisador ? { run: f.avisador.run, codigo: f.avisador.codigo, motivo: f.avisador.motivo } : null })), avisador: veredictos }, null, 1));
console.log(`\n${llamadas} llamadas a la API`);
console.log(mal ? `🔴 ${mal} control(es) NO se cumplen: lo de arriba no vale` : 'controles: todos se cumplen');
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
