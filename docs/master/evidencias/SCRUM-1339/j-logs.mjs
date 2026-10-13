// docs/master/evidencias/SCRUM-1339/j-logs.mjs — SCRUM-1339j · SÓLO LECTURA.
//
// De los 53 PR del barrido de SCRUM-1393b (`datos-pr.json`), el job del meta-guard de la punta de
// cada uno: ¿qué dijo de las DOS mutaciones de un guard, y con qué números?
//
//   node j-logs.mjs <datos-pr.json> <carpeta de logs, FUERA del árbol> [guard=scrum859-identidad-y-motivo-cerrado.test.mjs]
//
// Tres estados por log, y un cuarto que no es ninguno: VERDE, CIEGO, ROJO y SIN VEREDICTO (el log
// no trae la línea de resumen del meta-guard: no llegó, se canceló o está vacío).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [fDatos, dir, GUARD = 'scrum859-identidad-y-motivo-cerrado.test.mjs'] = process.argv.slice(2);
if (!fDatos || !dir) { console.error('uso: node j-logs.mjs <datos-pr.json> <carpeta de logs> [guard]'); process.exit(2); }
const d = JSON.parse(fs.readFileSync(fDatos, 'utf8'));
fs.mkdirSync(dir, { recursive: true });

function lineas(id) {
  const f = path.join(dir, `${id}.log`);
  if (!fs.existsSync(f) || !fs.statSync(f).size) {
    try {
      fs.writeFileSync(f, execFileSync('gh', ['api', '--allow-escape-sequences', `repos/lwislg99/cobroflash-backend/actions/jobs/${id}/logs`], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }));
    } catch (e) { return { bytes: 0, L: [], error: String(e.message).split('\n')[0].slice(0, 120) }; }
  }
  const crudo = fs.readFileSync(f, 'utf8');
  return { bytes: Buffer.byteLength(crudo), L: crudo.split(/\r?\n/).map((l) => ({ hora: l.slice(0, 28), txt: l.slice(29).replace(/\u001b\[[0-9;]*[A-Za-z]/g, '') })) };
}

function estadoDe(m) {
  if (!m) return 'SIN VEREDICTO';
  const [mudas, ciegas, muertos] = [Number(m[2]), Number(m[3]), Number(m[4])];
  if (mudas > 0) return 'ROJO';
  if (ciegas + muertos > 0) return 'CIEGO';
  if (mudas === 0 && ciegas === 0 && muertos === 0) return 'VERDE';
  return 'SIN VEREDICTO';
}

/** Lo que un log dice de `guard`. PURA: recibe las líneas ya sin hora ni color. */
export function leer(L, guard) {
  const resumen = L.filter((l) => /^vivas \d+ · mudas \d+/.test(l.txt)).map((l) => l.txt);
  const m = resumen.length === 1 ? /^vivas (\d+) · mudas (\d+) · ciegas (\d+) · ficheros muertos (\d+)/.exec(resumen[0]) : null;
  const marcas = L.filter((l) => /^ {2}(✔|\?|☠|✖) /.test(l.txt));
  // El verde se AFIRMA con sus tres ceros delante; lo que no encaje en nada no es verde.
  const estado = estadoDe(m);
  const suyas = marcas.filter((l) => l.txt.slice(4).startsWith(guard));
  const detalle = [];
  L.forEach((l, i) => {
    if (!l.txt.startsWith(`  · ${guard} · `)) return;
    // Las líneas «    → …» del caso. No siempre van pegadas: salen por stderr y el resumen por
    // stdout, y en un log (#2247) el runner las intercaló con 5 líneas de por medio.
    const bloque = [l.txt, ...L.slice(i + 1, i + 13).filter((x) => x.txt.startsWith('    → ')).map((x) => x.txt)].join('\n');
    const declarado = /«([^»]+)»/.exec(l.txt)?.[1] ?? null;
    const rec = /Recuento: (\d+) pasados · (\d+) caídos · (\d+) saltados\. Y en la LIMPIA: (\d+) pasados · (\d+) caídos/.exec(bloque);
    const faltan = /FALTAN (\d+) de los (\d+) tests/.exec(bloque);
    const nombres = (/\(la mutada trae \d+\): (.*?)\. La salida de la pasada mutada/s.exec(bloque)?.[1] || '').match(/«[^»]+»/g) || [];
    const ms = /resumen SÍ llegó en (\d+) ms/.exec(bloque)?.[1] ?? null;
    const causa = /NO APARECE en la pasada mutada/.test(bloque) ? 'NO APARECE en la mutada'
      : /NO aparece EN VERDE en la pasada limpia/.test(bloque) ? 'no en verde en la LIMPIA'
        : /ÁRBOL SE MOVIÓ/.test(bloque) ? 'el árbol se movió'
          : /EL FICHERO SALIÓ ROJO POR SU RUTA/.test(bloque) ? 'fichero rojo por su ruta'
            : '(otra: leer el log)';
    detalle.push({ declarado, causa, mutada: rec ? `${rec[1]}p+${rec[2]}c+${rec[3]}s` : null, limpia: rec ? `${rec[4]}p+${rec[5]}c` : null, faltan: faltan ? `${faltan[1]} de ${faltan[2]}` : null, nombres, ms });
  });
  return {
    estado, resumen: resumen[0] || null, vivasDichas: m ? Number(m[1]) : null,
    vivasContadas: marcas.filter((l) => l.txt.startsWith('  ✔ ')).length,
    suyas: suyas.map((l) => ({ marca: l.txt[2], hora: l.hora, txt: l.txt.slice(4 + guard.length + 3, 4 + guard.length + 3 + 70) })),
    detalle,
    node: L.find((l) => /^node: v/.test(l.txt))?.txt.slice(6) ?? null,
    imagen: L.find((l) => /^Version: \d{8}\./.test(l.txt))?.txt.slice(9) ?? null,
    guardsNombrados: new Set(marcas.map((l) => /^ {2}. (\S+)/.exec(l.txt)?.[1]).filter(Boolean)),
  };
}

// ── CONTROLES DE LA FUNCIÓN, sobre logs FABRICADOS, antes de leer ninguno de verdad ──────────
{
  const T = (...x) => x.map((txt) => ({ hora: '', txt }));
  const G = 'cobaya.test.mjs';
  const verde = leer(T(`  ✔ ${G} · uno`, `  ✔ ${G} · dos`, 'vivas 2 · mudas 0 · ciegas 0 · ficheros muertos 0'), G);
  const ciego = leer(T(`  ✔ ${G} · uno`, `  ? ${G} · CIEGO`, `  · ${G} · no se pudo juzgar si el guard cae. Test que debía ponerse rojo: «dos» — NO SÉ`,
    '    → en la pasada MUTADA ese test: NO APARECE en la pasada mutada (…). Recuento: 3 pasados · 1 caídos · 0 saltados. Y en la LIMPIA: 6 pasados · 0 caídos.',
    // Intercaladas a propósito, como en el log de #2247: la primera versión las quería pegadas.
    '', 'árbol VIGILADO durante las 2 mediciones', 'ℹ 1 test(s) cayeron ADEMÁS del nombrado.',
    '    → 🔴 FALTAN 2 de los 6 tests que SÍ aparecieron en la pasada limpia (la mutada trae 4): «dos», «tres». La salida de la pasada mutada se CORTÓ. resumen SÍ llegó en 77 ms: x',
    'vivas 1 · mudas 0 · ciegas 1 · ficheros muertos 0'), G);
  const rojo = leer(T(`  ✖ ${G} · MUDO`, 'vivas 0 · mudas 1 · ciegas 0 · ficheros muertos 0'), G);
  const vacio = leer(T(''), G);
  const cortado = leer(T(`  ✔ ${G} · uno`), G);
  const ok = verde.estado === 'VERDE' && verde.suyas.length === 2 && ciego.estado === 'CIEGO' && ciego.detalle[0]?.mutada === '3p+1c+0s'
    && ciego.detalle[0]?.faltan === '2 de 6' && ciego.detalle[0]?.nombres.length === 2 && ciego.detalle[0]?.ms === '77'
    && rojo.estado === 'ROJO' && vacio.estado === 'SIN VEREDICTO' && cortado.estado === 'SIN VEREDICTO';
  console.log(`CONTROL de la función sobre 5 logs fabricados (verde, ciego, rojo, vacío, cortado sin resumen): ${ok ? 'los 5 salen en su estado' : '🔴 NO SALEN — no se sigue'}`);
  if (!ok) { console.log(JSON.stringify({ verde, ciego, rojo, vacio, cortado }, (k, v) => (v instanceof Set ? [...v] : v), 1)); console.log('EXIT=3'); process.exit(3); }
}

const jobs = [];
for (const pr of d.prs) for (const r of pr.runs) for (const j of r.jobs) {
  if (/^meta-guard/.test(j.nombre) && j.intento === r.intento) jobs.push({ pr: pr.n, id: j.id, fin: j.fin, creado: r.creado, mergeado: pr.mergeado });
}
jobs.sort((a, b) => a.pr - b.pr || a.id - b.id);
console.log(`POBLACIÓN: ${d.prs.length} PR en datos-pr.json (recogido ${d.recogido}) · ${jobs.length} jobs «meta-guard» en el último intento de la punta, en ${new Set(jobs.map((j) => j.pr)).size} PR · guard mirado: ${GUARD}`);

const filas = [];
for (const j of jobs) {
  const { bytes, L, error } = lineas(j.id);
  filas.push({ ...j, bytes, nLineas: L.length, error, ...leer(L, GUARD) });
}

// ── CONTROL DE CERO DERIVADO y su POSITIVO, sobre los logs de verdad ─────────────────────────
const todos = new Set(); for (const f of filas) for (const g of f.guardsNombrados) todos.add(g);
const mayor = Math.max(...[...todos].map((g) => Number(/^scrum(\d+)/.exec(g)?.[1] || 0)));
const delMayor = [...todos].find((g) => g.startsWith(`scrum${mayor}`));
const inventado = delMayor.replace(`scrum${mayor}`, `scrum${mayor + 1}`);
const cuentaDe = (g) => filas.reduce((s, f) => s + (f.guardsNombrados.has(g) ? 1 : 0), 0);
console.log(`CONTROL DE CERO (derivado): el guard de número más alto que nombran los logs es «${delMayor}» → en ${cuentaDe(delMayor)} logs; con el número más uno, «${inventado}» → en ${cuentaDe(inventado)} logs`);
console.log(`POSITIVO: guards distintos nombrados en los ${filas.length} logs: ${todos.size} · logs con ${GUARD} nombrado: ${cuentaDe(GUARD)} · logs de 0 bytes: ${filas.filter((f) => !f.bytes).length} · el menor: ${Math.min(...filas.map((f) => f.bytes))} B · el mayor: ${Math.max(...filas.map((f) => f.bytes))} B`);
console.log(`POSITIVO: logs en los que las ✔ contadas aquí coinciden con las «vivas» que dice el resumen: ${filas.filter((f) => f.vivasDichas !== null && f.vivasDichas === f.vivasContadas).length} de ${filas.filter((f) => f.vivasDichas !== null).length} con resumen`);

const por = (k) => filas.reduce((o, f) => { const v = typeof k === 'function' ? k(f) : f[k]; o[v] = (o[v] || 0) + 1; return o; }, {});
const pinta = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ');
console.log(`\nESTADO DEL JOB (por su propio resumen, no por GitHub): ${pinta(por('estado'))}`);
console.log(`ESTADO SEGÚN GITHUB: ${pinta(por('fin'))}`);
console.log(`node del runner: ${pinta(por('node'))}`);
console.log(`imagen del runner: ${pinta(por('imagen'))}`);

// ── EL GUARD, mutación a mutación ────────────────────────────────────────────────────────────
const forma = (f) => (f.estado === 'SIN VEREDICTO' ? 'SIN VEREDICTO' : f.suyas.map((s) => s.marca).join('') || '(no lo nombra)');
console.log(`\nLAS MARCAS DE ${GUARD} en cada log, en el orden en que salen (✔ viva · ? ciega · ☠ muerto · ✖ muda): ${pinta(por(forma))}`);
const ciegas = filas.filter((f) => f.detalle.length);
console.log(`\nLOGS CON ALGÚN VEREDICTO SIN JUZGAR DE ESE GUARD: ${ciegas.length}`);
for (const f of ciegas) {
  for (const x of f.detalle) {
    const hueco = f.suyas.length === 2 ? ((new Date(f.suyas[1].hora) - new Date(f.suyas[0].hora)) / 1000).toFixed(2) : '?';
    console.log(`  #${f.pr} · job ${f.id} · ${f.estado} · ${f.resumen}\n     declarado: «${x.declarado}»\n     causa que escribe el instrumento: ${x.causa} · mutada ${x.mutada} · limpia ${x.limpia} · faltan ${x.faltan} · resumen en ${x.ms} ms · ${hueco} s entre sus dos marcas · node ${f.node} · imagen ${f.imagen}\n     ausentes: ${x.nombres.map((n) => n.slice(0, 44) + '…»').join(' ')}`);
  }
}
// ¿Cuántas causas MEDIDAS? La firma junta todo lo que el log dice del caso, no sólo el fichero.
const firmas = {};
for (const f of ciegas) for (const x of f.detalle) { const k = [x.declarado, x.causa, x.mutada, x.limpia, x.faltan, x.nombres.join('|')].join(' ¦ '); (firmas[k] ??= []).push(f.pr); }
console.log(`\nFIRMAS DISTINTAS (declarado ¦ causa ¦ recuento mutada ¦ limpia ¦ faltan ¦ nombres ausentes): ${Object.keys(firmas).length}`);
for (const [k, v] of Object.entries(firmas)) console.log(`  ×${v.length} (PR ${v.map((n) => '#' + n).join(' ')}): ${k.split(' ¦ ').slice(0, 5).join(' ¦ ')}`);

// Los que NO ciegan, para el contraste: ¿en qué se diferencian, que se pueda leer en el log?
const sanas = filas.filter((f) => f.estado !== 'SIN VEREDICTO' && !f.detalle.length && f.suyas.length === 2);
const seg = (f) => (new Date(f.suyas[1].hora) - new Date(f.suyas[0].hora)) / 1000;
const rango = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? `${s[0].toFixed(2)}–${s[Math.floor(s.length / 2)].toFixed(2)}–${s.at(-1).toFixed(2)}` : '(ninguno)'; };
console.log(`\nCONTRASTE · segundos entre la marca de la mutación 1 y la de la mutación 2 (mín–mediana–máx): las que NO ciegan (${sanas.length}): ${rango(sanas.map(seg))} · las que ciegan (${ciegas.filter((f) => f.suyas.length === 2).length}): ${rango(ciegas.filter((f) => f.suyas.length === 2).map(seg))}`);
const cruce = (k) => { const o = {}; for (const f of filas.filter((x) => x.estado !== 'SIN VEREDICTO')) { const v = f[k]; o[v] ??= { ciega: 0, no: 0 }; o[v][f.detalle.length ? 'ciega' : 'no'] += 1; } return Object.entries(o).map(([v, x]) => `${v}: ${x.ciega} ciegan de ${x.ciega + x.no}`).join(' · '); };
console.log(`CONTRASTE · por node: ${cruce('node')}`);
console.log(`CONTRASTE · por imagen: ${cruce('imagen')}`);
console.log(`\nLISTA (PR · job · GitHub · resumen propio · marcas del guard):`);
for (const f of filas) console.log(`  #${f.pr} · ${f.id} · ${f.fin} · ${f.estado} · ${f.resumen ?? `sin resumen (${f.bytes} B, ${f.nLineas} líneas${f.error ? ', ' + f.error : ''})`} · ${forma(f)}`);
console.log('EXIT=0');
