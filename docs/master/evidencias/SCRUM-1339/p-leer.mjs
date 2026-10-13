// docs/master/evidencias/SCRUM-1339/p-leer.mjs — SCRUM-1339p · SÓLO LECTURA.
//
// La aritmética del 27 %: de las ejecuciones del job del meta-guard que salen con 2, ¿CUÁNTAS
// son de cada guard? Cuenta por separado MARCAS (una por mutación sin juzgar) y LOGS (una por
// ejecución), que es justo lo que el tramo 1339n mezcló en su apartado ④.
//
//   node p-leer.mjs <n-datos.json> <carpeta de logs, FUERA del árbol> <positivos: jobs,por,comas> <cero: job> [salida.json]
//
// La población es la de `n-listar.mjs` (1339n), sin tocar. Los logs se bajan con `j-logs.mjs`.
// El lector de estado es `leer` de `j-logs.mjs` reducido a lo que aquí hace falta: la línea de
// resumen y las marcas ANCLADAS al inicio de la línea del instrumento (no se cuenta la cruz).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// `p-blobs.mjs` importa `leerLog` de aqui: lo de abajo solo corre si este fichero es el que se lanza.
const LANZADO = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const [fDatos, dir, positivos = '', cero = '', fSalida = ''] = LANZADO ? process.argv.slice(2) : [];
if (LANZADO && (!fDatos || !dir)) { console.error('uso: node p-leer.mjs <n-datos.json> <logs> <positivos> <cero> [salida.json]'); process.exit(2); }
const d = LANZADO ? JSON.parse(fs.readFileSync(fDatos, 'utf8')) : null;
let mal = 0;
const exige = (ok, txt) => { console.log(`${ok ? '✅' : '🔴'} ${txt}`); if (!ok) mal += 1; };
const por = (a, k) => a.reduce((o, x) => { const v = k(x); o[v] = (o[v] || 0) + 1; return o; }, {});
const pinta = (o) => Object.entries(o).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k}: ${n}`).join(' · ');

/** Lo que un log dice. PURA: recibe el texto crudo. */
export function leerLog(crudo) {
  const L = crudo.split(/\r?\n/).map((l) => l.slice(29).replace(/\\x1b\[[0-9;]*[A-Za-z]/g, ''));
  const res = L.filter((l) => /^vivas \d+ · mudas \d+/.test(l));
  const m = res.length === 1 ? /^vivas (\d+) · mudas (\d+) · ciegas (\d+) · ficheros muertos (\d+)/.exec(res[0]) : null;
  const marcas = L.map((l) => /^ {2}(✔|\?|☠|✖) (\S+)/.exec(l)).filter(Boolean).map((x) => ({ marca: x[1], guard: x[2] }));
  let estado = 'SIN VEREDICTO';
  if (m) {
    const [vivas, mudas, ciegas, muertos] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    // Cada estado se AFIRMA por su condición; ninguno es «lo que queda». Antes VERDE era el resto
    // de «ni muda ni ciega», y un resumen con los cuatro recuentos a cero —una pasada que no juzgó
    // NADA— salía VERDE. Lo cazó `tests/scrum622` en el obligatorio de #2361: desconocido no es verde.
    if (mudas > 0) estado = 'ROJO';
    else if (ciegas + muertos > 0) estado = 'CIEGO';
    else if (vivas > 0) estado = 'VERDE';
  }
  // El motivo que el instrumento escribe de cada mutación sin juzgar, por guard.
  const motivos = [];
  L.forEach((l, i) => {
    const x = /^ {2}· (\S+) · (.*)$/.exec(l);
    if (!x) return;
    // Las líneas «    → …» del caso: hasta el motivo siguiente. No siempre van pegadas (salen por
    // stderr y el resto por stdout; lo midió 1339j en #2247), así que se saltan las intercaladas.
    const cola = [];
    for (const y of L.slice(i + 1, i + 14)) { if (/^ {2}· \S+ · /.test(y)) break; if (y.startsWith('    → ')) cola.push(y); }
    const t = [x[2], ...cola].join('\n');
    const forma = /NO aparece EN VERDE en la pasada limpia/.test(t) ? 'A · el declarado no llegó en la LIMPIA (no se mutó nada)'
      : /NO APARECE en la pasada mutada/.test(t) ? 'B · el declarado no llegó en la MUTADA'
        : /EL FICHERO SALIÓ ROJO POR SU RUTA/.test(t) ? 'C · el fichero salió rojo y el caso que cayó no llegó con nombre'
          : /no ha reportado ni un nombre de test/.test(t) ? 'D · ni un nombre de test'
            : /ÁRBOL SE MOVIÓ/.test(t) ? 'E · el árbol se movió'
              : `OTRA: ${x[2].slice(0, 90)}`;
    const limpiaA = /Recuento de la LIMPIA: (\d+) pasados · (\d+) caídos · (\d+) saltados/.exec(t);
    const limpiaB = /Y en la LIMPIA: (\d+) pasados · (\d+) caídos/.exec(t);
    const mutadaB = /Recuento: (\d+) pasados · (\d+) caídos · (\d+) saltados/.exec(t);
    const mutadaC = /de la pasada MUTADA SÍ llegaron (\d+) tests con nombre \((\d+) pasados · (\d+) caídos/.exec(t);
    const faltan = /FALTAN (\d+) de los (\d+) tests/.exec(t) || /faltan (\d+) de los (\d+) de la limpia/.exec(t);
    motivos.push({
      guard: x[1], causa: forma, declarado: /«([^»]+)»/.exec(x[2])?.[1] ?? null,
      limpia: limpiaA ? `${limpiaA[1]}p+${limpiaA[2]}c` : limpiaB ? `${limpiaB[1]}p+${limpiaB[2]}c` : faltan ? `${faltan[2]} en total` : null,
      mutada: mutadaB ? `${mutadaB[1]}p+${mutadaB[2]}c` : mutadaC ? `${mutadaC[2]}p+${mutadaC[3]}c` : null,
      faltan: faltan ? `${faltan[1]} de ${faltan[2]}` : null,
      cita1405: /SCRUM-1405/.test(t),
    });
  });
  return { estado, resumen: m ? { vivas: Number(m[1]), mudas: Number(m[2]), ciegas: Number(m[3]), muertos: Number(m[4]) } : null, marcas, motivos };
}

if (LANZADO) {
// ── Control de la función, sobre logs FABRICADOS aquí (el positivo se siembra) ───────────────
{
  const h = '2026-10-13T00:00:00.0000000Z ';
  const fab = (ls) => ls.map((l) => h + l).join('\n');
  const casos = [
    ['verde', fab(['  ✔ a.test.mjs · viva', 'vivas 1 · mudas 0 · ciegas 0 · ficheros muertos 0']), 'VERDE', 0],
    ['ciego con DOS marcas del mismo guard', fab(['  ✔ a.test.mjs · viva', '  ? b.test.mjs · CIEGO', '  ? b.test.mjs · CIEGO', 'vivas 1 · mudas 0 · ciegas 2 · ficheros muertos 0']), 'CIEGO', 2],
    ['rojo', fab(['  ✖ a.test.mjs · MUDA', 'vivas 0 · mudas 1 · ciegas 0 · ficheros muertos 0']), 'ROJO', 0],
    ['vacío', '', 'SIN VEREDICTO', 0],
    ['cortado sin resumen', fab(['  ? b.test.mjs · CIEGO']), 'SIN VEREDICTO', 1],
    ['la marca DENTRO de un nombre no cuenta', fab(['  ✔ a.test.mjs · viva «el test ? raro ☠»', 'vivas 1 · mudas 0 · ciegas 0 · ficheros muertos 0']), 'VERDE', 0],
    ['resumen con los cuatro recuentos a cero', fab(['vivas 0 · mudas 0 · ciegas 0 · ficheros muertos 0']), 'SIN VEREDICTO', 0],
  ];
  const fallos = casos.filter(([, txt, est, n]) => { const r = leerLog(txt); return r.estado !== est || r.marcas.filter((x) => x.marca === '?' || x.marca === '☠').length !== n; });
  exige(fallos.length === 0, `CONTROL de la función sobre ${casos.length} logs fabricados (verde, ciego con dos marcas de UN guard, rojo, vacío, cortado, marca dentro de un nombre, resumen todo a cero): ${casos.length - fallos.length} de ${casos.length} en su estado y con su número de marcas${fallos.length ? ' · fallan: ' + fallos.map((c) => c[0]).join(', ') : ''}`);
}

// ── Población ────────────────────────────────────────────────────────────────────────────────
const filas = d.prs.map((p) => {
  const j = p.runs[0].jobs[0];
  const f = path.join(dir, `${j.id}.log`);
  const bytes = fs.existsSync(f) ? fs.statSync(f).size : 0;
  const r = leerLog(bytes ? fs.readFileSync(f, 'utf8') : '');
  return { pr: p.n, run: p.run, intento: p.runs[0].intento, evento: p.evento, sha: p.sha, creado: p.runs[0].creado, job: String(j.id), github: j.fin, acabo: j.acabo, bytes, ...r };
});
console.log(`\nPOBLACIÓN: ${filas.length} ejecuciones del job del meta-guard en ${new Set(filas.map((f) => f.run)).size} runs · de ${filas.map((f) => f.creado).sort()[0]} a ${filas.map((f) => f.creado).sort().at(-1)} · lista recogida ${d.recogido} (la de 1339n, sin volver a listar)`);
console.log(`  por su propio resumen: ${pinta(por(filas, (f) => f.estado))}`);
console.log(`  por la conclusión de GitHub: ${pinta(por(filas, (f) => f.github))}`);
const juzgadas = filas.filter((f) => f.estado !== 'SIN VEREDICTO');
const ciegos = juzgadas.filter((f) => f.estado === 'CIEGO');
exige(filas.every((f) => (f.estado === 'CIEGO') === (f.github === 'failure') && (f.estado === 'VERDE') === (f.github === 'success')), `LAS DOS LECTURAS COINCIDEN, ejecución a ejecución: CIEGO ↔ failure y VERDE ↔ success en ${filas.filter((f) => (f.estado === 'CIEGO') === (f.github === 'failure') && (f.estado === 'VERDE') === (f.github === 'success')).length} de ${filas.length}`);
const pesos = juzgadas.map((f) => f.bytes).sort((a, b) => a - b);
exige(pesos[0] > 100000, `TAMAÑO antes de contar: los ${juzgadas.length} logs con veredicto pesan de ${pesos[0]} a ${pesos.at(-1)} B (mediana ${pesos[pesos.length >> 1]}) · los ${filas.length - juzgadas.length} sin veredicto, de ${Math.min(...filas.filter((f) => f.estado === 'SIN VEREDICTO').map((f) => f.bytes))} a ${Math.max(...filas.filter((f) => f.estado === 'SIN VEREDICTO').map((f) => f.bytes))} B`);
const sin = (f) => f.marcas.filter((x) => x.marca === '?' || x.marca === '☠');
exige(juzgadas.every((f) => f.marcas.filter((x) => x.marca === '✔').length === f.resumen.vivas && f.marcas.filter((x) => x.marca === '?').length === f.resumen.ciegas && f.marcas.filter((x) => x.marca === '☠').length === f.resumen.muertos && f.marcas.filter((x) => x.marca === '✖').length === f.resumen.mudas), `SUMA: las marcas ✔, ?, ☠ y ✖ contadas dan vivas, ciegas, muertos y mudas del resumen en ${juzgadas.filter((f) => f.marcas.filter((x) => x.marca === '✔').length === f.resumen.vivas && f.marcas.filter((x) => x.marca === '?').length === f.resumen.ciegas && f.marcas.filter((x) => x.marca === '☠').length === f.resumen.muertos).length} de ${juzgadas.length} logs`);
exige(juzgadas.every((f) => sin(f).length === f.motivos.length), `SUMA: cada marca sin juzgar tiene su línea de motivo en ${juzgadas.filter((f) => sin(f).length === f.motivos.length).length} de ${juzgadas.length} logs`);

console.log('\nCONTROLES DEL ENCARGO');
for (const id of positivos.split(',').filter(Boolean)) {
  const f = filas.find((x) => x.job === id);
  exige(f?.estado === 'CIEGO' && f.github === 'failure', `POSITIVO que TIENE que salir: job ${id} → ${f ? `#${f.pr} · ${f.bytes} B · ${f.estado} · GitHub ${f.github} · ${sin(f).map((x) => x.marca + ' ' + x.guard).join(', ')}` : 'NO ESTÁ EN LA POBLACIÓN'}`);
}
{
  const f = filas.find((x) => x.job === cero);
  exige(f?.estado === 'VERDE' && f.github === 'success' && sin(f).length === 0 && f.bytes > 100000, `CERO que NO debe salir: job ${cero} → ${f ? `#${f.pr} · ${f.bytes} B · ${f.estado} · GitHub ${f.github} · marcas sin juzgar ${sin(f).length}` : 'NO ESTÁ EN LA POBLACIÓN'}`);
}

// ── ① La aritmética ──────────────────────────────────────────────────────────────────────────
console.log(`\n① LA ARITMÉTICA · ${ciegos.length} ejecuciones salen con 2 de ${juzgadas.length} con veredicto = ${(100 * ciegos.length / juzgadas.length).toFixed(1)} % · con alguna MUDA: ${juzgadas.filter((f) => f.resumen.mudas > 0).length}`);
const g = {};
for (const f of ciegos) for (const x of sin(f)) { const o = (g[x.guard] ??= { marcas: 0, logs: new Set(), ciega: 0, muerto: 0 }); o.marcas += 1; o.logs.add(f.job); o[x.marca === '?' ? 'ciega' : 'muerto'] += 1; }
console.log('  guard · MARCAS (mutaciones sin juzgar) · LOGS (ejecuciones) · de ellas ? y ☠');
for (const [k, o] of Object.entries(g).sort((a, b) => b[1].logs.size - a[1].logs.size)) console.log(`    ${k} · ${o.marcas} marcas · ${o.logs.size} logs · ? ${o.ciega} · ☠ ${o.muerto}`);
const totMarcas = Object.values(g).reduce((s, o) => s + o.marcas, 0);
const totLogs = Object.values(g).reduce((s, o) => s + o.logs.size, 0);
exige(totMarcas === ciegos.reduce((s, f) => s + f.resumen.ciegas + f.resumen.muertos, 0), `SUMA: ${totMarcas} marcas en total = las ciegas más los muertos que suman los ${ciegos.length} resúmenes (${ciegos.reduce((s, f) => s + f.resumen.ciegas + f.resumen.muertos, 0)})`);
const combi = por(ciegos, (f) => [...new Set(sin(f).map((x) => x.guard.replace('.test.mjs', '')))].sort().join(' + '));
console.log(`  las ${ciegos.length}, por QUÉ guards llevan (cada ejecución en UNA fila):`);
for (const [k, n] of Object.entries(combi).sort((a, b) => b[1] - a[1])) console.log(`    ${n} · ${k}`);
exige(Object.values(combi).reduce((s, n) => s + n, 0) === ciegos.length, `SUMA: las filas de arriba dan ${Object.values(combi).reduce((s, n) => s + n, 0)} = ${ciegos.length}`);
console.log(`  logs por guard sumados: ${totLogs} · menos ${ciegos.length} ejecuciones = ${totLogs - ciegos.length} que llevan DOS guards a la vez (contadas dos veces en esa suma)`);
exige(ciegos.filter((f) => new Set(sin(f).map((x) => x.guard)).size > 1).length === totLogs - ciegos.length && ciegos.every((f) => new Set(sin(f).map((x) => x.guard)).size <= 2), `SUMA: ejecuciones con dos guards a la vez, contadas una a una: ${ciegos.filter((f) => new Set(sin(f).map((x) => x.guard)).size > 1).length} · con tres o más: ${ciegos.filter((f) => new Set(sin(f).map((x) => x.guard)).size > 2).length}`);

// ── ② Firmas, guard a guard ──────────────────────────────────────────────────────────────────
console.log('\n② LA FIRMA DE CADA GUARD (causa que escribe el instrumento · recuento · qué test declarado)');
for (const k of Object.keys(g).sort((a, b) => g[b].logs.size - g[a].logs.size)) {
  const ms = ciegos.flatMap((f) => f.motivos.filter((x) => x.guard === k).map((x) => ({ ...x, job: f.job, pr: f.pr })));
  console.log(`  ${k} · ${ms.length} motivos en ${new Set(ms.map((x) => x.job)).size} logs`);
  console.log(`     causa: ${pinta(por(ms, (x) => x.causa))}`);
  console.log(`     recuento limpia / mutada / faltan: ${pinta(por(ms, (x) => `${x.limpia ?? '—'} / ${x.mutada ?? '—'} / ${x.faltan ?? '—'}`))}`);
  console.log(`     por log (limpia, nº de motivos): ${pinta(por([...new Set(ms.map((x) => x.job))].map((j) => { const a = ms.filter((x) => x.job === j); return `${[...new Set(a.map((x) => x.limpia ?? '—'))].join('|')} × ${a.length}`; }), (s) => s))}`);
  const decl = por(ms, (x) => x.declarado ?? '(sin nombre)');
  for (const [t, n] of Object.entries(decl).sort((a, b) => b[1] - a[1])) console.log(`     ${n} × «${t.slice(0, 110)}»`);
  if (new Set(ms.map((x) => x.job)).size <= 12) console.log(`     jobs: ${[...new Set(ms.map((x) => `#${x.pr}/${x.job}`))].join(' ')}`);
}

// ── ③ Cuántas veces sale ENTERO cada guard, en la misma población ────────────────────────────
console.log('\n③ EL MISMO GUARD, ENTERO EN OTRAS EJECUCIONES (todas sus mutaciones ✔)');
for (const k of Object.keys(g).sort((a, b) => g[b].logs.size - g[a].logs.size)) {
  const con = juzgadas.filter((f) => f.marcas.some((x) => x.guard === k));
  const entero = con.filter((f) => f.marcas.filter((x) => x.guard === k).every((x) => x.marca === '✔'));
  const formas = por(con, (f) => f.marcas.filter((x) => x.guard === k).map((x) => x.marca).join(''));
  console.log(`  ${k}: nombrado en ${con.length} · entero en ${entero.length} · sin juzgar del todo o en parte en ${con.length - entero.length} · formas: ${pinta(formas)}`);
}

if (fSalida) fs.writeFileSync(fSalida, JSON.stringify(filas.map((f) => ({ pr: f.pr, run: f.run, intento: f.intento, evento: f.evento, sha: f.sha, creado: f.creado, job: f.job, acabo: f.acabo, github: f.github, bytes: f.bytes, estado: f.estado, resumen: f.resumen, sinJuzgar: sin(f), motivos: f.motivos })), null, 1));
console.log(mal ? `\n🔴 ${mal} control(es) NO se cumplen: lo de arriba no vale` : '\ncontroles: todos se cumplen');
console.log(`EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
}
