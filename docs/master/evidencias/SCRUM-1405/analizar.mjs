// docs/master/evidencias/SCRUM-1405/analizar.mjs — SCRUM-1405
//
// Lee los artefactos del workflow desechable `exp-1405` y saca las tablas del registro.
//
//   node docs/master/evidencias/SCRUM-1405/analizar.mjs <carpeta de fuera del árbol> <run> [<run>…]
//
// Baja cada run con `gh run download` (si no está ya), y escribe en la carpeta:
//   tandas.tsv              una fila por tanda entera: brazo, salida, recuento, ausentes, rojos, testigo, sonda
//   rojos.tsv               qué rojos trae cada tanda y cuáles faltan respecto al conjunto de referencia
//   sonda-por-fichero.tsv   por fichero de tests/: bytes escritos, bytes SIN escribir al salir, qué seguía vivo
// y por pantalla, el resumen por brazo con su población y la prueba exacta de Fisher.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [carpeta, ...runs] = process.argv.slice(2);
if (!carpeta || runs.length === 0) { console.error('uso: node analizar.mjs <carpeta de fuera del árbol> <run> [<run>…]'); process.exit(2); }
const REPO = 'lwislg99/cobroflash-backend';
const env = { ...process.env, NO_COLOR: '1' };
for (const k of ['FORCE_COLOR', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT']) delete env[k];

const leer = (ruta) => { try { return fs.readFileSync(ruta, 'utf8'); } catch { return null; } };
const numero = (texto, clave) => { const m = new RegExp(`^# ${clave} (\\d+)`, 'm').exec(texto || ''); return m ? Number(m[1]) : null; };
const mediana = (l) => { const o = [...l].sort((a, b) => a - b); return o.length ? o[Math.floor((o.length - 1) / 2)] : null; };

// ── bajar ─────────────────────────────────────────────────────────────────────────────────
const dirs = [];
for (const run of runs) {
  const destino = path.join(carpeta, `run-${run}`);
  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
    execFileSync('gh', ['run', 'download', run, '-R', REPO, '-D', destino], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  }
  for (const n of fs.readdirSync(destino)) if (/^exp1405-tanda-/.test(n)) dirs.push({ run, celda: n.replace('exp1405-tanda-', ''), dir: path.join(destino, n) });
}
dirs.sort((a, b) => (a.celda + a.run).localeCompare(b.celda + b.run));
console.log(`POBLACIÓN · runs ${runs.join(', ')} · ${dirs.length} tandas con artefacto`);

// ── una fila por tanda ────────────────────────────────────────────────────────────────────
const SEMBRADOS = [
  'zz1405 · suelto · ROJO SEMBRADO',
  'zz1405 · cola · caso 080',
  'zz1405 · copia de scrum834-puerta-avisador-rojo · ROJO SEMBRADO AL FINAL',
  'zz1405 · copia de vigia-atascados · ROJO SEMBRADO AL FINAL',
  'zz1405 · copia de scrum524b-trinquete-de-la-tabla · ROJO SEMBRADO AL FINAL',
];
const tandas = [];
const sondas = []; // { run, celda, brazo, ...fila de sonda }
for (const d of dirs) {
  const tap = leer(path.join(d.dir, 'tanda.tap'));
  const senal = leer(path.join(d.dir, 'senal.txt')) || '';
  const brazo = (leer(path.join(d.dir, 'brazo.txt')) || d.celda.replace(/-\d+$/, '')).trim();
  const t0 = Number(leer(path.join(d.dir, 't0.txt'))); const t1 = Number(leer(path.join(d.dir, 't1.txt')));
  const registro = /\[señal de nombres v\d+\] (.*)$/m.exec(senal);
  const campos = registro ? Object.fromEntries(registro[1].trim().split(/\s+/).map((p) => p.split('=')).filter((p) => p.length === 2)) : {};
  const bloques = [...senal.matchAll(/tests\/(\S+\.test\.mjs) · faltan (AL MENOS )?(\d+) de (\d+) \((\w+)\)/g)].map((m) => ({ fichero: m[1], faltan: Number(m[3]), de: Number(m[4]), forma: m[5] }));
  const ficherosQuePierden = [...new Map(bloques.map((b) => [b.fichero, b])).values()];
  const rojos = tap ? [...tap.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].replace(/ x{20,}.*$/, '')) : [];
  const testigo = (leer(path.join(d.dir, 'testigo.txt')) || '').split('\n').filter(Boolean);
  const colaInformados = tap ? new Set([...tap.matchAll(/^(?:not ok|ok) \d+ - zz1405 · cola · caso (\d+)/gm)].map((m) => m[1])) : new Set();
  const colaEjecutados = new Set(testigo.filter((l) => l.startsWith('cola ')).map((l) => l.split(' ')[1]));
  const sj = leer(path.join(d.dir, 'sonda.jsonl'));
  const filasSonda = sj ? sj.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  for (const s of filasSonda) sondas.push({ run: d.run, celda: d.celda, brazo, ...s });
  const conPend = filasSonda.filter((s) => Math.max(s.pendientes ?? 0, s.cola ?? 0) > 0);
  tandas.push({
    run: d.run, celda: d.celda, brazo,
    salida: (leer(path.join(d.dir, 'salida.txt')) || 'SIN SALIDA').trim(),
    segundos: Number.isFinite(t1 - t0) && t0 ? t1 - t0 : '',
    con_resumen: tap && numero(tap, 'tests') !== null ? 'sí' : 'NO',
    tap_tests: numero(tap, 'tests') ?? '', tap_pass: numero(tap, 'pass') ?? '', tap_fail: numero(tap, 'fail') ?? '', tap_skipped: numero(tap, 'skipped') ?? '',
    senal_medible: campos.medible ?? 'SIN SEÑAL', ausentes: campos.ausentes ?? '', ficheros_con_ausentes: campos.ficheros_con_ausentes ?? '', declarados: campos.declarados ?? '',
    rojos: rojos.length, sembrados_en_tap: SEMBRADOS.filter((s) => rojos.some((r) => r.startsWith(s))).length,
    cola_ejecutados: colaEjecutados.size, cola_informados: colaInformados.size,
    cola_ausentes_ejecutados: [...colaEjecutados].filter((n) => !colaInformados.has(n)).length,
    // lo mismo, leído del OTRO reportero (spec, por la salida estándar): ¿pierde lo mismo que el TAP?
    cola_informados_spec: new Set([...(leer(path.join(d.dir, 'tanda-spec.log')) || '').matchAll(/[✔✖] zz1405 · cola · caso (\d+)/g)].map((m) => m[1])).size,
    sonda_filas: filasSonda.length || '', sonda_con_pendientes: filasSonda.length ? conPend.length : '',
    sonda_bloqueante: filasSonda.length ? [...new Set(filasSonda.map((s) => s.bloqueante))].join('|') : '',
    donde: ficherosQuePierden.map((b) => `${b.fichero.replace('.test.mjs', '')} ${b.faltan}/${b.de} ${b.forma}`).join(' | '),
    _rojos: rojos, _pierden: ficherosQuePierden.map((b) => b.fichero), _pend: conPend.map((s) => s.fichero),
  });
}
const aTsv = (filas, cab) => cab.join('\t') + '\n' + filas.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n';
const CAB = Object.keys(tandas[0] || {}).filter((k) => !k.startsWith('_'));
fs.writeFileSync(path.join(carpeta, 'tandas.tsv'), aTsv(tandas, CAB));

// ── por brazo ─────────────────────────────────────────────────────────────────────────────
const cuenta = (lista) => { const m = {}; for (const x of lista) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort().map(([k, v]) => `${k}×${v}`).join(' ') || '(nada)'; };
const brazos = [...new Set(tandas.map((t) => t.brazo))].sort();
console.log('\n── POR BRAZO (tanda entera, con rojos sembrados) ──');
const resumen = {};
for (const b of brazos) {
  const g = tandas.filter((t) => t.brazo === b);
  const med = g.filter((t) => t.senal_medible === 'si');
  const pierden = med.filter((t) => Number(t.ausentes) > 0);
  const seg = g.map((t) => Number(t.segundos)).filter((x) => x > 0);
  // La señal de nombres es un SUELO (no ve los nombres construidos en bucle, 1339d ④). La segunda
  // sonda es el recuento: el mismo árbol declara los mismos casos, así que una tanda por debajo
  // del máximo de TODAS las tandas ha perdido casos, los nombre la señal o no.
  const maximo = Math.max(...tandas.map((t) => Number(t.tap_tests) || 0));
  const cortas = g.filter((t) => Number(t.tap_tests) < maximo);
  resumen[b] = { n: med.length, pierden: pierden.length, nRecuento: g.length, cortas: cortas.length };
  console.log(`${b} · POR RECUENTO: ${cortas.length} de ${g.length} tandas por debajo del máximo de las ${tandas.length} (${maximo}) · casos que faltan por recuento ${cortas.reduce((a, t) => a + (maximo - Number(t.tap_tests)), 0)}`);
  console.log(`${b} · ${g.length} tandas · medibles ${med.length} · CON AUSENTES ${pierden.length} de ${med.length} · casos ausentes ${pierden.reduce((a, t) => a + Number(t.ausentes), 0)}`
    + ` · # tests ${cuenta(g.map((t) => t.tap_tests))} · salidas ${cuenta(g.map((t) => t.salida))} · sin resumen ${g.filter((t) => t.con_resumen === 'NO').length}`
    + ` · segundos ${Math.min(...seg)}–${mediana(seg)}–${Math.max(...seg)} (mín–mediana–máx)`);
  const fich = cuenta(pierden.flatMap((t) => t._pierden.map((f) => f.replace('.test.mjs', ''))));
  if (pierden.length) console.log(`   pierden: ${fich}`);
}

// ── Fisher exacto, una cola: ¿pierde MÁS el brazo «con»? ──────────────────────────────────
function logFact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
function hiper(a, b, c, d) { return Math.exp(logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d) - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d)); }
function fisherUnaCola(a, b, c, d) { // a = con y pierde, b = con y no, c = sin y pierde, d = sin y no
  let p = 0;
  for (let x = a; x <= Math.min(a + b, a + c); x++) { const bb = a + b - x; const cc = a + c - x; const dd = d - (x - a); if (bb < 0 || cc < 0 || dd < 0) continue; p += hiper(x, bb, cc, dd); }
  return p;
}
const fisher = (rot, con, sin) => {
  if (!con || !sin) { console.log(`${rot}: falta un brazo, no se calcula`); return; }
  const p = fisherUnaCola(con.pierden, con.n - con.pierden, sin.pierden, sin.n - sin.pierden);
  console.log(`${rot}: con ${con.pierden} de ${con.n} · sin ${sin.pierden} de ${sin.n} · Fisher exacto a una cola p = ${p.toExponential(2)} (1 de cada ${Math.round(1 / p).toLocaleString('es-ES')})`);
};
console.log('\n── SI EL FLAG NO INFLUYERA, ¿CUÁNTAS VECES SALDRÍA ESTE REPARTO? ──');
fisher('este experimento, con vs sin (por la señal de nombres)', resumen.con, resumen.sin);
const porRecuento = (r) => (r ? { n: r.nRecuento, pierden: r.cortas } : null);
fisher('este experimento, con vs sin (por recuento)', porRecuento(resumen.con), porRecuento(resumen.sin));
fisher('con el flag: tubería normal vs bloqueante (por recuento)', porRecuento(resumen.con), porRecuento(resumen['con-bloqueante']));
fisher('control del instrumento: el del 1-oct (4 de 6 vs 0 de 6) tiene que dar 3,0e-2', { n: 6, pierden: 4 }, { n: 6, pierden: 0 });
if (resumen.con && resumen.sin) fisher('los dos juntos (árboles distintos: es una suma, no una réplica)', { n: resumen.con.n + 6, pierden: resumen.con.pierden + 4 }, { n: resumen.sin.n + 6, pierden: resumen.sin.pierden });
if (resumen['con-bloqueante']) fisher('con el flag: tubería normal vs tubería bloqueante', resumen.con, resumen['con-bloqueante']);

// ── el veredicto: los rojos ───────────────────────────────────────────────────────────────
console.log('\n── EL VEREDICTO: ¿SALEN LOS MISMOS ROJOS EN TODAS? ──');
const clave = (t) => [...t._rojos].sort().join('\n');
const porConjunto = new Map();
for (const t of tandas) porConjunto.set(clave(t), (porConjunto.get(clave(t)) || 0) + 1);
const referencia = [...porConjunto.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split('\n').filter(Boolean) || [];
console.log(`conjuntos distintos de rojos: ${porConjunto.size} · el más repetido tiene ${referencia.length} rojos y sale en ${Math.max(0, ...porConjunto.values())} de ${tandas.length} tandas`);
const filasRojos = [];
for (const t of tandas) {
  const faltan = referencia.filter((r) => !t._rojos.includes(r));
  const sobran = t._rojos.filter((r) => !referencia.includes(r));
  filasRojos.push({ run: t.run, celda: t.celda, brazo: t.brazo, salida: t.salida, rojos: t.rojos, sembrados_en_tap: t.sembrados_en_tap, faltan: faltan.length, sobran: sobran.length, cuales_faltan: faltan.join(' | '), cuales_sobran: sobran.join(' | ') });
}
fs.writeFileSync(path.join(carpeta, 'rojos.tsv'), aTsv(filasRojos, Object.keys(filasRojos[0] || {})));
for (const b of brazos) {
  const g = filasRojos.filter((f) => f.brazo === b);
  console.log(`${b} · ${g.length} tandas · con salida 0: ${g.filter((f) => f.salida === '0').length} · los 5 sembrados en el TAP: ${cuenta(g.map((f) => f.sembrados_en_tap))} · tandas a las que les FALTA algún rojo de referencia: ${g.filter((f) => f.faltan > 0).length} · con rojos de más: ${g.filter((f) => f.sobran > 0).length}`);
  for (const f of g.filter((x) => x.faltan > 0 || x.sobran > 0)) console.log(`   ${f.celda} (salida ${f.salida}) NO trae: ${f.cuales_faltan || '(nada)'} · y trae de más: ${f.cuales_sobran || '(nada)'}`);
}
console.log(`rojos de referencia (${referencia.length}):`);
for (const r of referencia) console.log(`   ${r}`);

// ── el testigo de la cola sembrada ────────────────────────────────────────────────────────
console.log('\n── EL TESTIGO, DENTRO DE LA TANDA (zz1405-rojo-en-la-cola: 80 casos) ──');
for (const b of brazos) {
  const g = tandas.filter((t) => t.brazo === b);
  console.log(`${b} · ${g.length} tandas · ejecutados ${cuenta(g.map((t) => t.cola_ejecutados))} · informados en el TAP ${cuenta(g.map((t) => t.cola_informados))} · informados en el spec ${cuenta(g.map((t) => t.cola_informados_spec))} · TAP y spec discrepan en ${g.filter((t) => t.cola_informados !== t.cola_informados_spec).length} · tandas con casos ejecutados y NO informados: ${g.filter((t) => t.cola_ausentes_ejecutados > 0).length}`);
}

// ── la sonda ──────────────────────────────────────────────────────────────────────────────
if (sondas.length) {
  console.log('\n── LA SONDA: BYTES SIN ESCRIBIR AL SALIR, POR FICHERO ──');
  const deTests = sondas.filter((s) => /\.test\.mjs$/.test(s.fichero));
  console.log(`filas de sonda ${sondas.length} · de ficheros .test.mjs ${deTests.length}`);
  const porFichero = new Map();
  for (const s of deTests) {
    const k = `${s.brazo}\t${s.fichero}`;
    if (!porFichero.has(k)) porFichero.set(k, []);
    porFichero.get(k).push(s);
  }
  const BASE = new Set(['PipeWrap', 'TTYWrap']);
  const filas = [];
  for (const [k, l] of porFichero) {
    const [brazo, fichero] = k.split('\t');
    const pend = l.map((s) => Math.max(s.pendientes ?? 0, s.cola ?? 0));
    const vivos = {};
    for (const s of l) for (const [r, n] of Object.entries(s.recursos || {})) if (!BASE.has(r)) vivos[r] = Math.max(vivos[r] || 0, n);
    filas.push({
      brazo, fichero, filas: l.length,
      escritos_mediana: mediana(l.map((s) => s.escritos ?? 0)), total_mediana: mediana(l.map((s) => (s.escritos ?? 0) + Math.max(s.pendientes ?? 0, s.cola ?? 0))),
      ms_mediana: mediana(l.map((s) => s.ms ?? 0)),
      veces_con_pendientes: pend.filter((p) => p > 0).length, pendientes_max: Math.max(...pend),
      codigos: cuenta(l.map((s) => s.codigo)), vivos_al_salir: Object.entries(vivos).map(([r, n]) => `${r}×${n}`).join(' '),
    });
  }
  filas.sort((a, b) => a.brazo.localeCompare(b.brazo) || b.total_mediana - a.total_mediana);
  fs.writeFileSync(path.join(carpeta, 'sonda-por-fichero.tsv'), aTsv(filas, Object.keys(filas[0])));
  for (const b of [...new Set(filas.map((f) => f.brazo))]) {
    const g = filas.filter((f) => f.brazo === b);
    const conPend = g.filter((f) => f.veces_con_pendientes > 0);
    const conVivos = g.filter((f) => f.vivos_al_salir);
    console.log(`${b} · ${g.length} ficheros distintos · con bytes SIN ESCRIBIR al salir alguna vez: ${conPend.length} · con algo vivo al salir (aparte de las tuberías): ${conVivos.length}`);
    for (const f of conPend.sort((x, y) => y.veces_con_pendientes - x.veces_con_pendientes).slice(0, 40)) console.log(`   pendientes · ${f.fichero} · ${f.veces_con_pendientes} de ${f.filas} · máx ${f.pendientes_max} B · escribe ${f.total_mediana} B en ${f.ms_mediana} ms`);
    const tipos = cuenta(conVivos.flatMap((f) => f.vivos_al_salir.split(' ').map((x) => x.split('×')[0])));
    if (conVivos.length) console.log(`   vivos al salir, por tipo (ficheros): ${tipos}`);
  }
  // ③ qué tienen los 18 que pierden en el CI de cada día (SCRUM-1339e): su sitio en la lista de los
  // que MÁS ESCRIBEN. Los sembrados (zz1405-) no cuentan: no existen en el árbol de verdad.
  const tsv18 = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'SCRUM-1339', 'e-por-fichero.tsv');
  const texto18 = leer(decodeURIComponent(tsv18));
  const porBytes = filas.filter((f) => f.brazo === 'con-sonda' && !f.fichero.startsWith('zz1405')).sort((a, b) => b.total_mediana - a.total_mediana);
  if (texto18 && porBytes.length) {
    const los18 = new Set(texto18.split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')[0]));
    const rangos = porBytes.map((f, i) => ({ ...f, rango: i + 1 })).filter((f) => los18.has(f.fichero));
    const peor = Math.max(...rangos.map((f) => f.rango));
    const asc = [...porBytes].reverse();
    const q = (p) => asc[Math.min(asc.length - 1, Math.floor(asc.length * p))].total_mediana;
    // si los 18 fueran ficheros cualesquiera, ¿cuántas veces caerían todos entre los `peor` primeros?
    let logP = 0;
    for (let i = 0; i < rangos.length; i++) logP += Math.log((peor - i) / (porBytes.length - i));
    console.log(`\n── ③ LOS ${los18.size} QUE PIERDEN, EN LA LISTA DE LOS QUE MÁS ESCRIBEN (brazo con-sonda · ${porBytes.length} ficheros de tests/) ──`);
    console.log(`bytes que escribe un fichero hacia su padre: mediana ${q(0.5)} · p90 ${q(0.9)} · p99 ${q(0.99)} · máximo ${porBytes[0].total_mediana} · por encima de 65.536 (lo que cabe en una tubería de Linux): ${porBytes.filter((f) => f.total_mediana > 65536).length}`);
    console.log(`de los ${los18.size}, presentes en este árbol ${rangos.length} · todos entre los ${peor} primeros de ${porBytes.length} · entre los 10 primeros ${rangos.filter((f) => f.rango <= 10).length} · entre los 25 primeros ${rangos.filter((f) => f.rango <= 25).length}`);
    console.log(`si fueran ${rangos.length} ficheros cualesquiera, caerían todos entre los ${peor} primeros 1 vez de cada 10^${Math.round(-logP / Math.LN10)}`);
    for (const f of rangos) console.log(`   puesto ${f.rango} · ${f.fichero} · ${f.total_mediana} B en ${f.ms_mediana} ms · con bytes pendientes ${f.veces_con_pendientes} de ${f.filas}`);
    console.log(`los 25 primeros (★ = es de los ${los18.size}):`);
    porBytes.slice(0, 25).forEach((f, i) => console.log(`   ${i + 1} ${los18.has(f.fichero) ? '★' : '·'} ${f.fichero} · ${f.total_mediana} B en ${f.ms_mediana} ms · pendientes ${f.veces_con_pendientes} de ${f.filas}`));
  } else {
    console.log(`\n── ③ NO PUDE MIRAR los 18: ${texto18 ? 'no hay brazo con-sonda' : 'no encuentro ' + tsv18}`);
  }
  // lo que cuesta: cuánto vive cada fichero hasta salir, con el flag y sin él (medianas por fichero)
  const vida = (b) => new Map(filas.filter((f) => f.brazo === b).map((f) => [f.fichero, f.ms_mediana]));
  const conV = vida('con-sonda'); const sinV = vida('sin-sonda');
  if (conV.size && sinV.size) {
    const comunes = [...conV.keys()].filter((k) => sinV.has(k));
    const total = (m) => comunes.reduce((a, k) => a + m.get(k), 0);
    console.log(`\n── LO QUE VIVE CADA FICHERO HASTA SALIR (ms, mediana por fichero; ${comunes.length} ficheros en los dos brazos) ──`);
    console.log(`suma con el flag ${total(conV)} ms · suma sin el flag ${total(sinV)} ms · diferencia ${total(sinV) - total(conV)} ms (repartida entre los hilos del runner)`);
    const delta = comunes.map((k) => ({ k, d: sinV.get(k) - conV.get(k), con: conV.get(k), sin: sinV.get(k) })).sort((a, b) => b.d - a.d);
    console.log(`ficheros que viven más de 1 s MÁS sin el flag: ${delta.filter((x) => x.d > 1000).length} · más de 5 s: ${delta.filter((x) => x.d > 5000).length}`);
    for (const x of delta.slice(0, 15)) console.log(`   +${x.d} ms · ${x.k} · con ${x.con} · sin ${x.sin}`);
  }
  // el cruce que decide: en cada tanda con sonda, ¿los que pierden son los que tenían bytes pendientes?
  console.log('\n── EL CRUCE: PERDER CASOS (señal de nombres) × TENER BYTES PENDIENTES (sonda), por tanda ──');
  for (const t of tandas.filter((x) => x.sonda_filas)) {
    const pierden = new Set(t._pierden); const pend = new Set(t._pend);
    const ambos = [...pierden].filter((f) => pend.has(f));
    console.log(`${t.celda} · filas de sonda ${t.sonda_filas} · pierden ${pierden.size} · con pendientes ${pend.size} · las dos cosas ${ambos.length} · pierden SIN pendientes ${[...pierden].filter((f) => !pend.has(f)).join(', ') || '0'} · pendientes y la señal no ve pérdida ${[...pend].filter((f) => !pierden.has(f)).join(', ') || '0'}`);
  }
}
console.log(`\nEXIT=0 · ${tandas.length} tandas · tablas en ${carpeta}`);
