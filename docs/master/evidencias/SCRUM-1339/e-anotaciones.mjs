#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/e-anotaciones.mjs — SCRUM-1339e · SÓLO LECTURA.
//
// LA TASA, DESDE FUERA, CON `gh` (SCRUM-1339 c.17954 ②). Dos instrumentos sobre los mismos jobs:
//
//   (A) lo que el PASO de `ci.yml` dejó escrito en su propio run: la anotación `::notice` con la
//       línea de registro (`[señal de nombres v1] medible=… ausentes=…`). Se lee de la API de
//       anotaciones del check-run. Es lo que habrá el 15-oct, y no pide bajar ningún TAP.
//   (B) el recálculo que hace `d-contra-los-tap.mjs` con el TAP del artefacto contra el árbol que
//       el job probó. Vale también para los jobs ANTERIORES al paso (que no tienen anotación).
//
// Donde los dos existen tienen que decir lo mismo; donde discrepan, la discrepancia es el dato.
//
//   node e-anotaciones.mjs <carpeta del banco> <raíz del repo> [<salida> [<desde ISO> [<sha de main> [<corte ISO>]]]]
//
// Con «corte» (la hora del último artefacto del banco anterior) parte los jobs en «ventana ya
// medida» y «nuevos». Con «desde» añade la cuenta POR COMMIT de la línea principal (primer padre), que es la
// población que nombra la decisión de c.17935: «los últimos 50 runs del obligatorio en `main`».
//
// El banco es el de `b-bajar.mjs` (`bajados.tsv`) ya pasado por `d-contra-los-tap.mjs`
// (`d-contra-los-tap.tsv` en la carpeta de salida). Las anotaciones se guardan en
// `<banco>/anot/<job>.json` para no volver a pedirlas.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [carpeta, raiz, salida = carpeta, desde = null, main = 'origin/main', corte = null] = process.argv.slice(2);
if (!carpeta || !raiz) { console.error('uso: node e-anotaciones.mjs <carpeta del banco> <raíz del repo> [<salida> [<desde ISO> [<sha de main> [<corte ISO>]]]]'); process.exit(2); }
const m = await import(pathToFileURL(path.join(raiz, 'scripts', '_senal-de-nombres.mjs')).href);

const REPO = 'lwislg99/cobroflash-backend';
const GUION = 'scripts/senal-de-nombres.mjs';
const env = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR; delete env.NODE_OPTIONS; delete env.NODE_TEST_CONTEXT;
const leeTsv = (f) => { const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); const c = L.shift().split('\t'); return L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))); };
const gitOk = (args) => { try { execFileSync('git', args, { cwd: raiz, stdio: 'ignore' }); return true; } catch { return false; } };

fs.mkdirSync(path.join(carpeta, 'anot'), { recursive: true });
/** Las anotaciones de un check-run. `null` si no se pudieron pedir: NO es «no tiene». */
function anotacionesDe(job) {
  const cache = path.join(carpeta, 'anot', `${job}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  try {
    const texto = execFileSync('gh', ['api', `repos/${REPO}/check-runs/${job}/annotations?per_page=100`], { env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
    const lista = JSON.parse(texto);
    if (!Array.isArray(lista)) return null;
    fs.writeFileSync(cache, JSON.stringify(lista));
    return lista;
  } catch { return null; }
}

const bajados = leeTsv(path.join(carpeta, 'bajados.tsv'));
const recalculo = new Map(leeTsv(path.join(salida, 'd-contra-los-tap.tsv')).map((x) => [x.id, x]));

// CONTROL del instrumento (A), antes de fiarse de un «no tiene anotación»: el check-run
// 110514502040 (run 36905130761, la punta de #2118) lleva la `::notice` del paso — leída por la
// API el 1-oct (c.17978). Si aquí no se ve, el lector está ciego y no se sigue.
const TESTIGO = '110514502040';
const delTestigo = anotacionesDe(TESTIGO);
const veElTestigo = Array.isArray(delTestigo) && delTestigo.some((a) => m.registroDesdeLinea(a.message) !== null);
console.log(`CONTROL POSITIVO del lector de anotaciones: check-run ${TESTIGO} → ${delTestigo === null ? 'NO SE PUDO PEDIR' : `${delTestigo.length} anotaciones, con línea de registro: ${veElTestigo ? 'sí' : 'NO'}`}`);
if (!veElTestigo) { console.log('EL LECTOR NO VE UNA ANOTACIÓN QUE EXISTE: no se mide nada.'); console.log('EXIT=3'); process.exit(3); }

const filas = [];
for (const f of bajados) {
  const b = recalculo.get(f.id) ?? null;
  const fila = {
    id: f.id, creado: f.creado, run: f.run, intento: `${f.intento}/${f.intentos}`, evento: f.evento, rama: f.rama, job: f.job, conclusion: f.conclusion,
    b_medible: b ? b.medible : 'sin fila', b_ausentes: b ? b.ausentes : '', b_dudosos: b ? b.dudosos : '', b_donde: b ? b.donde : '',
  };
  // ¿El árbol que el job probó TENÍA el paso? Se mira el árbol (12 hex en la tabla del recálculo),
  // no la hora: una hora es una tolerancia disfrazada. Sin árbol resuelto no se juzga.
  const arbol = b && /^[0-9a-f]{12}$/.test(b.arbol) ? b.arbol : null;
  fila.paso_en_el_arbol = arbol === null ? '?' : gitOk(['cat-file', '-e', `${arbol}:${GUION}`]) ? 'sí' : 'no';
  const an = f.job ? anotacionesDe(f.job) : null;
  if (an === null) { fila.a_estado = 'no pude pedir las anotaciones'; filas.push(fila); continue; }
  fila.anotaciones = an.length;
  const conRegistro = an.map((a) => ({ a, r: m.registroDesdeLinea(a.message) })).filter((x) => x.r !== null);
  const sinMedir = an.filter((a) => String(a.title ?? '').includes(`${m.TITULO} · NO PUDE MEDIR`));
  if (conRegistro.length > 1) fila.a_estado = `${conRegistro.length} líneas de registro`;
  else if (conRegistro.length === 1) {
    const { a, r } = conRegistro[0];
    Object.assign(fila, { a_estado: 'registro', a_titulo: a.title ?? '', a_medible: r.medible ? 'sí' : 'NO', a_ausentes: r.ausentes ?? '', a_dudosos: r.dudosos ?? '', a_linea: a.message.split('\n')[0] });
    fila.registro = r;
    fila.avisos = an.filter((x) => x.annotation_level === 'warning' && String(x.title ?? '').startsWith(m.TITULO)).length;
  } else if (sinMedir.length) fila.a_estado = 'NO PUDE MEDIR sin línea de registro';
  else fila.a_estado = 'sin anotación de la señal';
  filas.push(fila);
}

const cab = ['id', 'creado', 'run', 'intento', 'evento', 'rama', 'job', 'conclusion', 'paso_en_el_arbol', 'anotaciones', 'a_estado', 'a_titulo', 'a_medible', 'a_ausentes', 'a_dudosos', 'avisos', 'b_medible', 'b_ausentes', 'b_dudosos', 'b_donde'];
fs.writeFileSync(path.join(salida, 'e-anotaciones.tsv'), cab.join('\t') + '\n' + filas.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n');

const n = (lista, f) => lista.filter(f).length;
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)} %` : 'sin base');
console.log(`POBLACIÓN: ${filas.length} artefactos (uno por job «build + tests» que llegó a guardar su TAP) · ${new Set(filas.map((f) => f.run)).size} runs · ${filas[0]?.creado} → ${filas.at(-1)?.creado}`);
console.log(`  por evento: push ${n(filas, (f) => f.evento === 'push')} · pull_request ${n(filas, (f) => f.evento === 'pull_request')} · otro ${n(filas, (f) => !['push', 'pull_request'].includes(f.evento))}`);
console.log(`  anotaciones: pedidas ${n(filas, (f) => f.a_estado !== 'no pude pedir las anotaciones')} · no pude pedir ${n(filas, (f) => f.a_estado === 'no pude pedir las anotaciones')}`);

// ── ① EL PASO, ¿HABLA SIEMPRE? (c.17935 ③: la línea sale siempre, también con 0) ────────────
const conPaso = filas.filter((f) => f.paso_en_el_arbol === 'sí');
const sinPaso = filas.filter((f) => f.paso_en_el_arbol === 'no');
console.log(`① ¿HABLA EL PASO? árbol con el paso ${conPaso.length} · sin el paso ${sinPaso.length} · árbol sin resolver ${n(filas, (f) => f.paso_en_el_arbol === '?')}`);
const callados = conPaso.filter((f) => f.a_estado === 'sin anotación de la señal');
const otros = conPaso.filter((f) => f.a_estado !== 'registro' && !callados.includes(f));
console.log(`   con el paso en el árbol: dejaron UNA línea de registro ${n(conPaso, (f) => f.a_estado === 'registro')} de ${conPaso.length} · CALLADOS (ninguna anotación de la señal) ${callados.length} · otra cosa ${otros.length}`);
for (const f of callados) console.log(`   CALLADO ${f.id} run ${f.run} [${f.intento}] ${f.evento} ${f.conclusion} job ${f.job} (${f.anotaciones ?? '?'} anotaciones) · recálculo: medible=${f.b_medible} ausentes=${f.b_ausentes}`);
for (const f of otros) console.log(`   OTRA COSA ${f.id} run ${f.run} [${f.intento}] ${f.evento} ${f.conclusion} job ${f.job} → ${f.a_estado} (${f.anotaciones ?? '?'} anotaciones) · recálculo: medible=${f.b_medible} ausentes=${f.b_ausentes}`);
// control negativo: un árbol SIN el paso no puede traer línea de registro
const fantasmas = sinPaso.filter((f) => f.a_estado === 'registro');
console.log(`   control negativo — sin el paso en el árbol y CON línea de registro: ${fantasmas.length} de ${sinPaso.length} (tiene que ser 0)`);

// ── ② LOS DOS INSTRUMENTOS, SOBRE LOS MISMOS JOBS ─────────────────────────────────────────
const ambos = filas.filter((f) => f.a_estado === 'registro' && f.a_medible === 'sí' && f.b_medible === 'sí');
const igual = ambos.filter((f) => String(f.a_ausentes) === String(f.b_ausentes) && String(f.a_dudosos) === String(f.b_dudosos));
console.log(`② CRUCE anotación (A) ↔ recálculo (B): comparables ${ambos.length} · misma cifra de ausentes y dudosos ${igual.length} de ${ambos.length}`);
for (const f of ambos.filter((x) => !igual.includes(x))) console.log(`   DISCREPA ${f.id} run ${f.run} job ${f.job}: A ausentes=${f.a_ausentes} dudosos=${f.a_dudosos} · B ausentes=${f.b_ausentes} dudosos=${f.b_dudosos} → ${f.b_donde}`);
const soloUno = filas.filter((f) => f.a_estado === 'registro' && (f.a_medible === 'sí') !== (f.b_medible === 'sí'));
console.log(`   medible en uno y no en el otro: ${soloUno.length}`);
for (const f of soloUno) console.log(`   ${f.id} run ${f.run} job ${f.job}: A medible=${f.a_medible} · B medible=${f.b_medible}`);

// ── ③ LA TASA POR LAS ANOTACIONES (A) ─────────────────────────────────────────────────────
// Un job con el paso y sin registro entra como `null`: `tasaDeRegistros` lo cuenta «sin medir»,
// nunca como limpio.
const registrosDe = (lista) => lista.map((f) => f.registro ?? null);
const push = conPaso.filter((f) => f.evento === 'push' && f.rama === 'main');
console.log(`③ TASA POR LAS ANOTACIONES (sólo jobs cuyo árbol tiene el paso: ${conPaso.length})`);
console.log(`   push a main (${push.length}):`);
console.log('   ' + m.lineaDeTasa(m.tasaDeRegistros(registrosDe(push))));
console.log(`   todos los jobs, PR y main (${conPaso.length}):`);
console.log('   ' + m.lineaDeTasa(m.tasaDeRegistros(registrosDe(conPaso))));
const medidosA = conPaso.filter((f) => f.a_estado === 'registro' && f.a_medible === 'sí');
const conAus = medidosA.filter((f) => Number(f.a_ausentes) > 0);
console.log(`   con ausentes: ${conAus.length} de ${medidosA.length} medidos (${pct(conAus.length, medidosA.length)}) · de ellos con el job en success: ${n(conAus, (f) => f.conclusion === 'success')}`);
console.log(`   jobs en success medidos: ${n(medidosA, (f) => f.conclusion === 'success')} · de ellos con ausentes ${n(conAus, (f) => f.conclusion === 'success')} (${pct(n(conAus, (f) => f.conclusion === 'success'), n(medidosA, (f) => f.conclusion === 'success'))})`);
// ¿cada job con ausentes lleva al menos un `::warning` de la señal? (avisar, no sólo contar)
const sinAviso = conAus.filter((f) => !(f.avisos > 0));
console.log(`   con ausentes y SIN ningún ::warning de la señal: ${sinAviso.length} de ${conAus.length} (tiene que ser 0)`);
const conAvisoSinAusentes = medidosA.filter((f) => Number(f.a_ausentes) === 0 && Number(f.a_dudosos) === 0 && f.avisos > 0);
console.log(`   completos (0 ausentes, 0 dudosos) y CON algún ::warning de la señal: ${conAvisoSinAusentes.length} de ${medidosA.length - conAus.length} (tiene que ser 0)`);

// ── ④ POR COMMIT DE `main`, CON EL RECÁLCULO (B): vale también para antes del paso ─────────
// El denominador son los COMMITS de la línea principal, no los artefactos: un commit cuyo run
// se canceló antes de guardar el TAP no tiene artefacto, y sin esta lista no se vería que falta.
if (desde) {
  const punta = execFileSync('git', ['rev-parse', main], { cwd: raiz, encoding: 'utf8' }).trim();
  const commits = execFileSync('git', ['log', '--first-parent', '--format=%H %cI', `--since=${desde}`, punta], { cwd: raiz, encoding: 'utf8' })
    .split('\n').filter(Boolean).map((l) => { const [sha, fecha] = l.split(' '); return { sha, fecha: new Date(fecha).toISOString() }; });
  const shaDe = new Map(bajados.map((f) => [f.id, f.sha]));
  const dePush = filas.filter((f) => f.evento === 'push' && f.rama === 'main');
  const porCommit = commits.map((c) => {
    const suyos = dePush.filter((f) => shaDe.get(f.id) === c.sha);
    const medibles = suyos.filter((f) => f.b_medible === 'sí');
    const estado = !suyos.length ? 'sin artefacto' : !medibles.length ? 'no medible' : medibles.some((f) => Number(f.b_ausentes) > 0) ? 'con ausentes' : 'limpio';
    return { ...c, estado, jobs: suyos.length, ausentes: medibles.map((f) => f.b_ausentes).join('+'), conclusion: suyos.map((f) => f.conclusion).join('+'), donde: medibles.map((f) => f.b_donde).filter(Boolean).join(' | ') };
  });
  const cab2 = ['sha', 'fecha', 'estado', 'jobs', 'conclusion', 'ausentes', 'donde'];
  fs.writeFileSync(path.join(salida, 'e-commits-de-main.tsv'), cab2.join('\t') + '\n' + porCommit.map((c) => cab2.map((k) => c[k] ?? '').join('\t')).join('\n') + '\n');
  const medidos = porCommit.filter((c) => ['con ausentes', 'limpio'].includes(c.estado));
  const malos = porCommit.filter((c) => c.estado === 'con ausentes');
  const huerfanos = dePush.filter((f) => !commits.some((c) => c.sha === shaDe.get(f.id)));
  console.log(`④ POR COMMIT DE main (primer padre de ${punta.slice(0, 8)}, desde ${desde}): ${commits.length} commits`);
  console.log(`   sin artefacto ${n(porCommit, (c) => c.estado === 'sin artefacto')} · no medible ${n(porCommit, (c) => c.estado === 'no medible')} · medidos ${medidos.length}`);
  console.log(`   CON AUSENTES: ${malos.length} de ${medidos.length} medidos (${pct(malos.length, medidos.length)}) · sobre TODOS los commits: ${pct(malos.length, commits.length)} (suelo: lo no medido no cuenta como limpio ni como perdido)`);
  console.log(`   artefactos de push a main cuyo commit no está en la lista: ${huerfanos.length}`);
  // la ventana de c.17935: los últimos 50 medidos (o los que haya)
  const ventana = medidos.slice(0, m.VENTANA_DE_RUNS);
  const enVentana = ventana.filter((c) => c.estado === 'con ausentes').length;
  console.log(`   VENTANA de c.17935 (los ${m.VENTANA_DE_RUNS} últimos medidos; hay ${ventana.length}): ${enVentana} de ${ventana.length} con ausentes (${pct(enVentana, ventana.length)}) · ${ventana.length >= m.VENTANA_DE_RUNS ? (enVentana / ventana.length < m.UMBRAL_DE_BLOQUEO ? 'por DEBAJO' : 'por ENCIMA') + ` del ${100 * m.UMBRAL_DE_BLOQUEO} %` : `ventana INCOMPLETA: faltan ${m.VENTANA_DE_RUNS - ventana.length} para poder decirlo como lo pide la decisión`}`);
  // y partido en antes / después de que entrara el paso (el árbol del commit lo dice, no la hora)
  for (const [rotulo, tiene] of [['con el paso de la señal en el árbol', true], ['anteriores al paso', false]]) {
    const g = medidos.filter((c) => gitOk(['cat-file', '-e', `${c.sha}:${GUION}`]) === tiene);
    console.log(`   · ${rotulo}: ${n(g, (c) => c.estado === 'con ausentes')} de ${g.length} con ausentes (${pct(n(g, (c) => c.estado === 'con ausentes'), g.length)})`);
  }
  for (const c of malos) console.log(`   ${c.sha.slice(0, 8)} ${c.fecha} ${c.conclusion} ausentes=${c.ausentes} → ${c.donde}`);
} else {
  console.log('④ POR COMMIT DE main: no se pidió (falta el cuarto argumento, «desde»)');
}

// ── ⑤ TODOS LOS JOBS, CON EL RECÁLCULO (B): la cifra comparable con las de 1339b y 1339d ────
const medB = filas.filter((f) => f.b_medible === 'sí');
const conAusB = (g) => n(g, (f) => Number(f.b_ausentes) > 0);
const verdes = medB.filter((f) => f.conclusion === 'success');
console.log(`⑤ TODOS LOS JOBS, CON EL RECÁLCULO: medibles ${medB.length} de ${filas.length} · con ausentes ${conAusB(medB)} (${pct(conAusB(medB), medB.length)})`);
console.log(`   en success: ${verdes.length} · de ellos con ausentes ${conAusB(verdes)} (${pct(conAusB(verdes), verdes.length)})`);
for (const ev of ['push', 'pull_request']) {
  const g = medB.filter((f) => f.evento === ev);
  console.log(`   ${ev}: ${conAusB(g)} de ${g.length} con ausentes (${pct(conAusB(g), g.length)})`);
}
// lo NUEVO respecto a lo ya medido: «corte» es la hora del último artefacto del banco anterior
if (corte) {
  const antes = medB.filter((f) => f.creado <= corte);
  const despues = medB.filter((f) => f.creado > corte);
  console.log(`   hasta ${corte} (ventana que ya cubrían 1339b y 1339d): ${conAusB(antes)} de ${antes.length} con ausentes (${pct(conAusB(antes), antes.length)})`);
  console.log(`   después de ${corte} (NUEVO): ${conAusB(despues)} de ${despues.length} con ausentes (${pct(conAusB(despues), despues.length)})`);
}
// qué ficheros pierden, y cuántas veces: de aquí sale a quién se parece el reproductor (1339f)
const porFichero = new Map();
for (const f of medB) {
  for (const trozo of String(f.b_donde).split(' | ').filter(Boolean)) {
    const mm = /^tests\/(\S+) · faltan (?:AL MENOS )?(\d+) de (\d+) \((\w+)\)/.exec(trozo);
    if (!mm) { console.log(`   ⚠️ no supe leer este bloque: ${trozo.slice(0, 80)}`); continue; }
    const x = porFichero.get(mm[1]) ?? { fichero: mm[1], veces: 0, declarados: mm[3], faltan: [], formas: new Set() };
    x.veces++; x.faltan.push(Number(mm[2])); x.formas.add(mm[4]); porFichero.set(mm[1], x);
  }
}
const tabla = [...porFichero.values()].sort((a, b) => b.veces - a.veces || a.fichero.localeCompare(b.fichero));
fs.writeFileSync(path.join(salida, 'e-por-fichero.tsv'), 'fichero\tveces\tdeclarados\tfaltan_min\tfaltan_max\tformas\n'
  + tabla.map((x) => [x.fichero, x.veces, x.declarados, Math.min(...x.faltan), Math.max(...x.faltan), [...x.formas].join(',')].join('\t')).join('\n') + '\n');
const bloques = tabla.reduce((a, x) => a + x.veces, 0);
const deCola = tabla.reduce((a, x) => a + (x.formas.size === 1 && x.formas.has('cola') ? x.veces : 0), 0);
console.log(`   ficheros distintos que pierden casos: ${tabla.length} · bloques ${bloques} · de ficheros que SÓLO pierden la cola: ${deCola} → e-por-fichero.tsv`);
for (const x of tabla.slice(0, 15)) console.log(`     ${String(x.veces).padStart(3)}× ${x.fichero} (declara ${x.declarados}; faltan de ${Math.min(...x.faltan)} a ${Math.max(...x.faltan)}; ${[...x.formas].join(',')})`);
console.log('EXIT=0');
