#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1520/b-los-cinco.mjs — SCRUM-1520b
//
// De los 11 obligatorios del 8-oct (#2298, #2300 a #2309), 6 salieron verdes con nombres ausentes.
// Para cada FICHERO que pierde nombres en alguno, la pregunta es una: ¿el corte cae en el mismo
// caso en todos los jobs que corrieron ese mismo fichero, o salta?
//
//   · Un fichero cuyo proceso se va con exit(0) escrito en el código corta SIEMPRE en el mismo
//     caso: no puede salir completo en un job vecino con el mismo blob.
//   · La cola perdida (SCRUM-1339, SCRUM-1405) unas veces corta y otras no.
//
// SÓLO LEE: logs ya bajados (fuera del árbol) y blobs de git. No ejecuta ningún test.
//
//   node b-los-cinco.mjs <raíz del árbol> <carpeta de logs: pr<N>-job<ID>.log> [--sin-siembra]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const SIN_SIEMBRA = args.includes('--sin-siembra');
const [raiz, carpeta] = args.filter((a) => !a.startsWith('--'));
if (!raiz || !carpeta) { console.log('uso: node b-los-cinco.mjs <raiz> <carpeta de logs> [--sin-siembra]'); process.exit(2); }

const m = await import(pathToFileURL(path.join(raiz, 'scripts', '_senal-de-nombres.mjs')).href);
const NL = String.fromCharCode(10);
const LOG_COMPLETO = 1_700_000; // un log completo pesa ~1,78 MB; uno de 215 B es un job corriendo
const MARCAS = ['✔', '✖', '﹣'];
const INICIO = '▶';

const git = (a) => {
  const r = spawnSync('git', a, { cwd: raiz, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');

// ── una línea del reporter spec, ANCLADA: sello de hora, sangría, marca, nombre, duración ─────
// Sin anclar, «✔» y «✖» salen de más: están dentro del NOMBRE de tests que pasan.
// Y anclar NO basta: 20 líneas por log empiezan por «✔» y las escribe un test por su salida
// («✔ 1 saludo → menú»). Un resultado del reporter acaba SIEMPRE en su duración; esas no. La
// primera versión de este lector no lo pedía y la suma le salió 20 de más en los 11 logs.
const RE_CASO = /^\S+Z ( *)([✔✖﹣▶]) (.*)$/u;
// Un salto lleva detrás su motivo, no la palabra SKIP: «(0.7ms) # sin QA_DB_TEST=1 · …». La
// segunda versión pedía «# SKIP» y perdió los 93 saltados; lo cazó la misma suma.
const RE_DURACION = / \(\d+(\.\d+)?ms\)( # .*)?$/u;
const sinCola = (resto) => resto.replace(RE_DURACION, '');
function leerLog(texto) {
  const lineas = texto.split(NL).map((l) => l.replace(/\r$/, ''));
  const ini = lineas.findIndex((l) => /##\[group\]Run npm test /.test(l));
  let fin = lineas.findIndex((l, i) => i > ini && /##\[group\]Run /.test(l));
  if (ini < 0 || fin < 0) return null;
  const paso = lineas.slice(ini, fin);
  const casos = [];
  const cuenta = { '✔': 0, '✖': 0, '﹣': 0, '▶': 0 };
  let sueltas = 0;
  let impresas = 0; // empiezan por una marca y no son un resultado: las imprime un test
  for (const l of paso) {
    const c = RE_CASO.exec(l);
    if (c && (c[2] === INICIO || RE_DURACION.test(c[3]))) { cuenta[c[2]]++; casos.push({ nivel: c[1].length, marca: c[2], nombre: sinCola(c[3]) }); }
    else if (c) impresas++;
    if (MARCAS.some((x) => l.includes(x))) sueltas++;
  }
  const num = (clave) => { const l = paso.find((x) => new RegExp(`Z ℹ ${clave} \\d+$`).test(x)); return l ? Number(/(\d+)$/.exec(l)[1]) : null; };
  const resumen = Object.fromEntries(['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((k) => [k, num(k)]));
  const registro = lineas.map((l) => m.registroDesdeLinea(l.replace(/^\S+Z /, ''))).find(Boolean) ?? null;
  const dictado = lineas.filter((l) => !l.includes('##[')).map((l) => /tests\/(\S+\.test\.mjs) · faltan (\d+) de (\d+) \((\w+)\) · posiciones (\d+)(?:–(\d+))?/u.exec(l)).filter(Boolean)
    .map((x) => ({ fichero: x[1], faltan: Number(x[2]), de: Number(x[3]), forma: x[4], desde: Number(x[5]), hasta: Number(x[6] ?? x[5]) }));
  const merge = lineas.map((l) => /HEAD is now at \w+ Merge (\w{40}) into (\w{40})/.exec(l)).find(Boolean);
  const veredicto = paso.filter((l) => /TANDA SIN VEREDICTO/.test(l)).length;
  return { lineas: lineas.length, paso: paso.length, casos, cuenta, sueltas, impresas, resumen, registro, dictado, cabeza: merge?.[1] ?? null, base: merge?.[2] ?? null, veredicto };
}

// ── qué le pasa a UN fichero en UN log ──────────────────────────────────────────────────────
function mirar(log, declaradas) {
  const conResultado = new Map();
  const conInicio = new Set();
  for (const c of log.casos) {
    if (c.marca === INICIO) conInicio.add(c.nombre);
    else conResultado.set(c.nombre, (conResultado.get(c.nombre) ?? 0) + 1);
  }
  const fuera = declaradas.filter((d) => !conResultado.has(d.nombre));
  if (fuera.length === 0) return { estado: 'COMPLETO', fuera };
  const ultima = declaradas.at(-1).posicion;
  const esCola = fuera.every((d, i) => d.posicion === ultima - (fuera.length - 1 - i));
  const dentro = fuera.filter((d) => conInicio.has(d.nombre)).map((d) => d.posicion);
  return { estado: esCola ? 'COLA' : 'HUECOS', fuera, desde: fuera[0].posicion, hasta: fuera.at(-1).posicion, corte: dentro.length ? `DENTRO (inicio sin resultado en ${dentro.join(',')})` : 'ENTRE' };
}

// ── la población ────────────────────────────────────────────────────────────────────────────
const ficheros = fs.readdirSync(carpeta).filter((f) => /^pr\d+-job\d+\.log$/.test(f)).sort();
console.log(`POBLACIÓN · ${ficheros.length} logs en la carpeta · node ${process.version} · ${process.platform}`);
console.log('');
console.log('── ① cada log: tamaño ANTES de contar, y la suma (anclado y con duración: ✔ + ✖ + ﹣ = «ℹ tests»)');
console.log(['pr', 'job', 'bytes', 'lineas', 'paso', 'i_tests', 'pass', 'fail', 'skip', 'ancl_ok', 'ancl_x', 'ancl_skip', 'SUMA', 'ancl_sin_duracion', 'sin_anclar', 'senal_ausentes', 'senal_tap', 'sin_veredicto'].join('\t'));
const logs = [];
let ciegos = 0;
for (const f of ficheros) {
  const [, pr, job] = /^pr(\d+)-job(\d+)\.log$/.exec(f);
  const buf = fs.readFileSync(path.join(carpeta, f));
  if (buf.length < LOG_COMPLETO) { ciegos++; console.log(`${pr}\t${job}\t${buf.length}\tCIEGO: pesa menos que un log completo, no se cuenta`); continue; }
  const log = leerLog(buf.toString('utf8'));
  if (!log || log.resumen.tests == null || !log.registro) { ciegos++; console.log(`${pr}\t${job}\t${buf.length}\tCIEGO: sin paso de la tanda, sin «ℹ tests» o sin registro de la señal`); continue; }
  const suma = log.cuenta['✔'] + log.cuenta['✖'] + log.cuenta['﹣'];
  log.sumaCuadra = suma === log.resumen.tests && log.cuenta['✔'] === log.resumen.pass && log.cuenta['✖'] === log.resumen.fail && log.cuenta['﹣'] === log.resumen.skipped;
  Object.assign(log, { pr, job, bytes: buf.length });
  logs.push(log);
  console.log([pr, job, buf.length, log.lineas, log.paso, log.resumen.tests, log.resumen.pass, log.resumen.fail, log.resumen.skipped, log.cuenta['✔'], log.cuenta['✖'], log.cuenta['﹣'],
    log.sumaCuadra ? 'CUADRA' : `NO CUADRA (${suma})`, log.impresas, log.sueltas, log.registro.ausentes, log.registro.tapTests, log.veredicto].join('\t'));
}
const descuadres = logs.filter((l) => !l.sumaCuadra).length;
console.log(`   leídos ${logs.length} de ${ficheros.length} · ciegos ${ciegos} · sumas que NO cuadran ${descuadres}`);
console.log('');

// ── ② los ficheros que algún job dictó como ausentes, cruzados contra los 11 ────────────────
const afectados = [...new Set(logs.flatMap((l) => l.dictado.map((d) => d.fichero)))].sort();
console.log(`── ② ${afectados.length} ficheros dictados por la señal en algún job, mirados en los ${logs.length} logs`);
const fuentes = new Map(); // fichero → Map(sha del blob → declaradas)
const declaradasDe = (log, fichero) => {
  const enCabeza = git(['show', `${log.cabeza}:tests/${fichero}`]);
  const enBase = git(['show', `${log.base}:tests/${fichero}`]);
  if (!enCabeza) return { error: 'no pude leer el blob de la cabeza' };
  const blob = sha1(enCabeza);
  const mismoEnBase = enBase ? sha1(enBase) === blob : null;
  if (!fuentes.has(fichero)) fuentes.set(fichero, new Map());
  if (!fuentes.get(fichero).has(blob)) fuentes.get(fichero).set(blob, m.llamadasDeclaradas(enCabeza.toString('utf8'), fichero).filter((x) => x.clase === 'literal'));
  return { blob, mismoEnBase, declaradas: fuentes.get(fichero).get(blob), codigo: enCabeza.toString('utf8') };
};

let discrepancias = 0;
const filas = [];
for (const fichero of afectados) {
  console.log(`══ tests/${fichero}`);
  const vistos = [];
  for (const log of logs) {
    const d = declaradasDe(log, fichero);
    if (d.error) { console.log(`   #${log.pr}\tNO PUDE MIRAR: ${d.error}`); vistos.push({ pr: log.pr, estado: 'SIN MIRAR' }); continue; }
    const repetidos = d.declaradas.length - new Set(d.declaradas.map((x) => x.nombre)).size;
    const r = mirar(log, d.declaradas);
    const dicho = log.dictado.find((x) => x.fichero === fichero) ?? null;
    // El cruce: lo que saco del reporter spec tiene que ser lo que la señal sacó del TAP.
    const coincide = dicho ? (r.estado !== 'COMPLETO' && r.fuera.length === dicho.faltan && r.desde === dicho.desde && r.hasta === dicho.hasta) : r.estado === 'COMPLETO';
    if (!coincide) discrepancias++;
    // Control de cero: los mismos nombres con 8 hex de su sha1 detrás no pueden aparecer.
    const inventados = d.declaradas.filter((x) => log.casos.some((c) => c.nombre === x.nombre + ' ·' + sha1(x.nombre).slice(0, 8))).length;
    vistos.push({ pr: log.pr, blob: d.blob, estado: r.estado, desde: r.desde ?? null, corte: r.corte ?? null, n: d.declaradas.length });
    console.log(`   #${log.pr}\tblob ${d.blob.slice(0, 10)}${d.mismoEnBase === false ? ' (≠ base: el merge puede no ser este blob)' : ''}\tdeclara ${d.declaradas.length}${repetidos ? ` (${repetidos} nombre(s) repetido(s))` : ''}\t`
      + (r.estado === 'COMPLETO' ? `COMPLETO ${d.declaradas.length} de ${d.declaradas.length}` : `${r.estado} · faltan ${r.fuera.length} · posiciones ${r.desde}–${r.hasta} · corte ${r.corte}`)
      + `\tseñal: ${dicho ? `faltan ${dicho.faltan} de ${dicho.de} (${dicho.forma}) ${dicho.desde}–${dicho.hasta}` : 'no lo nombra'} → ${coincide ? 'COINCIDE' : '🔴 NO COINCIDE'}\tcero: ${inventados}`);
  }
  const blobs = new Set(vistos.map((v) => v.blob).filter(Boolean));
  const cortados = vistos.filter((v) => v.estado === 'COLA' || v.estado === 'HUECOS');
  const completos = vistos.filter((v) => v.estado === 'COMPLETO');
  const sitios = [...new Set(cortados.map((v) => `${v.desde}/${v.corte.split(' ')[0]}`))];
  const codigo = git(['show', `${logs[0].cabeza}:tests/${fichero}`])?.toString('utf8') ?? '';
  const salidas = (codigo.match(/process\.exit\s*\(|process\.exitCode\s*=|process\.kill\s*\(|process\.abort\s*\(/g) ?? []).length;
  const veredicto = blobs.size !== 1 ? 'NO COMPARABLE: el blob cambia entre jobs'
    : completos.length > 0 ? 'SALTA: el mismo blob sale completo en otros jobs'
      : sitios.length > 1 ? 'SALTA: se corta siempre, en sitios distintos' : 'FIJO: se corta en todos, en el mismo caso';
  filas.push({ fichero, blobs: blobs.size, cortados: cortados.map((v) => `#${v.pr}@${v.desde}`).join(' '), completos: completos.length, de: vistos.length, sitios: sitios.join(' '), salidas, veredicto });
  console.log(`   → blobs distintos ${blobs.size} · cortado en ${cortados.length} de ${vistos.length} (${cortados.map((v) => `#${v.pr} desde ${v.desde}, ${v.corte.split(' ')[0]}`).join(' · ')}) · completo en ${completos.length} · texto de salida de proceso en el fichero: ${salidas} · ${veredicto}`);
  console.log('');
}

console.log('── ③ resumen por fichero');
console.log(['fichero', 'blobs', 'cortado_en', 'completo_en', 'sitios(pos/corte)', 'texto_salida', 'veredicto'].join('\t'));
for (const f of filas) console.log([f.fichero, f.blobs, f.cortados, `${f.completos} de ${f.de}`, f.sitios, f.salidas, f.veredicto].join('\t'));
console.log('');
console.log('── ④ resumen por obligatorio');
for (const log of logs) {
  const suma = log.dictado.reduce((a, d) => a + d.faltan, 0);
  console.log(`   #${log.pr}\tausentes ${log.registro.ausentes}\tficheros ${log.dictado.length}\tsuma de los dictados ${suma} ${suma === log.registro.ausentes ? '=' : '≠'} registro\t${log.dictado.map((d) => `${d.fichero.replace('.test.mjs', '')} ${d.desde}–${d.hasta}`).join(' · ') || '—'}`);
}
console.log('');

// ── ⑤ el positivo SEMBRADO: una cola quitada a mano de un log completo tiene que verse ──────
// Se fabrica aquí, no se toma prestado del árbol. Sin siembra (--sin-siembra) esto dice CIEGO.
console.log('── ⑤ controles del instrumento');
let controlesMal = 0;
const limpio = logs.find((l) => l.registro.ausentes === 0);
const sujeto = afectados[0];
if (!limpio || !sujeto) { console.log('   CIEGO: no hay log con 0 ausentes o no hay fichero afectado: no puedo sembrar'); controlesMal++; }
else {
  const d = declaradasDe(limpio, sujeto);
  const K = 3;
  const victimas = new Set(d.declaradas.slice(-K).map((x) => x.nombre));
  const sembrado = { ...limpio, casos: SIN_SIEMBRA ? limpio.casos : limpio.casos.filter((c) => !(victimas.has(c.nombre) && c.marca !== INICIO)) };
  const quitadas = limpio.casos.length - sembrado.casos.length;
  const antes = mirar(limpio, d.declaradas);
  const despues = mirar(sembrado, d.declaradas);
  const entro = quitadas === K;
  const visto = despues.estado === 'COLA' && despues.fuera.length === K && despues.desde === d.declaradas.at(-K).posicion;
  console.log(`   siembra sobre #${limpio.pr}, tests/${sujeto}: quitadas ${quitadas} líneas de resultado (veneno ${entro ? 'ENTRÓ' : 'NO ENTRÓ'}) · antes ${antes.estado} · después ${despues.estado}${despues.fuera.length ? ` desde ${despues.desde}` : ''} → ${!entro ? 'CIEGO' : visto && antes.estado === 'COMPLETO' ? 'VE' : '🔴 NO VE'}`);
  if (!entro || !visto || antes.estado !== 'COMPLETO') controlesMal++;
}
// El «0» de texto de salida de proceso en los ficheros afectados necesita su positivo: el mismo
// patrón, sobre todos los tests de la misma cabeza, tiene que encontrar alguno.
const RE_SALIDA = /process\.exit\s*\(|process\.exitCode\s*=|process\.kill\s*\(|process\.abort\s*\(/;
const arbol = (git(['ls-tree', '-r', '--name-only', logs[0]?.cabeza ?? 'HEAD', 'tests/'])?.toString('utf8') ?? '').split(NL).filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f));
let conSalida = 0;
for (const f of arbol) if (RE_SALIDA.test(git(['show', `${logs[0].cabeza}:${f}`])?.toString('utf8') ?? '')) conSalida++;
console.log(`   positivo del texto de salida: ${conSalida} de ${arbol.length} tests de la cabeza de #${logs[0]?.pr} lo contienen → ${conSalida > 0 ? 'VE' : 'CIEGO'} (es recuento de texto: no sigue imports ni procesos hijos)`);
if (conSalida === 0) controlesMal++;
console.log(`   sumas ancladas que no cuadran: ${descuadres} de ${logs.length} · cruces con la señal que no coinciden: ${discrepancias} · logs ciegos: ${ciegos}`);
const mal = controlesMal + descuadres + discrepancias + ciegos;
console.log(`EXIT=${mal ? 2 : 0}`);
process.exit(mal ? 2 : 0);
