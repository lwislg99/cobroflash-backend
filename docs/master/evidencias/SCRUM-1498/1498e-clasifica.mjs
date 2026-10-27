// 1498e-clasifica.mjs <meta.json> <carpeta de logs> <salida.json> [--bajar]
// Solo LECTURA. Para cada job del meta-guard que acabó en `failure` (y, como calibración, los `success`),
// baja su log (con --bajar) y lo clasifica por lo que IMPRIME el propio instrumento
// (scripts/meta-guard-mutaciones.mjs), anclado al INICIO de la línea, nunca por subcadena suelta:
// «CIEGO» aparece dentro del NOMBRE de muchos tests que pasan (cicatriz ③ del encargo).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [metaJson, dir, salida, ...resto] = process.argv.slice(2);
const bajar = resto.includes('--bajar');
const REPO = 'repos/lwislg99/cobroflash-backend';
const { filas } = JSON.parse(fs.readFileSync(metaJson, 'utf8'));
fs.mkdirSync(dir, { recursive: true });

// Quita el sello de hora de GitHub («2026-10-27T12:21:30.7914134Z ») y nada más.
const sinHora = (l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, '');

export function clasificaLog(texto) {
  const L = texto.split(/\r?\n/).map(sinHora);
  const r = { lineas: L.length, codigo: null, corte: null, resumen: null, mudos: [], ciegos: [], ciegoTemprano: [], ilegibles: false, muertos: false, pasadaViva: false };
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    let m;
    if ((m = /^##\[error\]Process completed with exit code (\d+)\./.exec(l))) r.codigo = Number(m[1]);
    if (l.startsWith('🔴 CORTO YO, ANTES DEL TECHO')) r.corte = l;
    if ((m = /^vivas (\d+) · mudas (\d+) · ciegas (\d+)/.exec(l))) r.resumen = { vivas: +m[1], mudas: +m[2], ciegas: +m[3] };
    // Las listas finales («🔴 CIEGO:», «🔴 GUARDS MUDOS») van por stderr y se INTERCALAN con el stdout
    // (medido en el job 120891543300: «coste por guard» y el corte caen dentro de la lista). Por eso el
    // veredicto por guard se lee de las líneas de stdout «  ? <guard> · CIEGO» y «  ✖ <guard> · MUDO»,
    // que salen una por mutación y en orden; el MOTIVO se busca después, por el nombre del guard.
    if ((m = /^ {2}\? (\S+) · CIEGO/.exec(l))) r.ciegos.push(m[1]);
    if ((m = /^ {2}✖ (\S+) · MUDO$/.exec(l))) r.mudos.push(m[1]);
    if (l.startsWith('🔴 CIEGO · ')) r.ciegoTemprano.push(l);
    if (/^🔴 \d+ DECLARACI/.test(l)) r.ilegibles = true;
    if (l.startsWith('☠ FICHEROS MUERTOS')) r.muertos = true;
    if (l.startsWith('🔴 CIEGO · HAY OTRA PASADA VIVA')) r.pasadaViva = true;
  }
  r.motivos = [...new Set(r.ciegos)].flatMap((g) => L.filter((l) => l.startsWith(`  · ${g} · `)).map((l) => l.slice(4)));
  // Control de coherencia con el propio resumen del instrumento: ciegas = guards CIEGO + el corte.
  r.cuadra = r.resumen ? r.resumen.ciegas === r.ciegos.length + (r.corte ? 1 : 0) && r.resumen.mudas === r.mudos.length : null;
  return r;
}

// Clase principal, en orden de lo que más pesa para quien lo lee: un guard que no cae es un hallazgo.
export function clase(r, pasoFallido) {
  if (pasoFallido && pasoFallido !== 'Cada guard cae con la mutación que declara') return `otra: paso «${pasoFallido}»`;
  if (r.codigo === null && r.resumen === null) return 'SIN LEER (log sin código ni resumen)';
  if (r.mudos.length || (r.resumen && r.resumen.mudas > 0)) return 'H · guard que no cae (MUDO)';
  const ciegosNoCorte = r.ciegos;
  if (r.corte && ciegosNoCorte.length === 0) return 'P · presupuesto agotado (CORTO YO), sin otro CIEGO';
  if (r.motivos.some((c) => /salida cortada/i.test(c))) return 'S · salida cortada (1610b)';
  if (r.muertos) return 'M · fichero muerto al mutar';
  if (r.ciegoTemprano.length || r.ilegibles || ciegosNoCorte.length) return 'C · CIEGO por otra causa';
  return 'otra: sin marca reconocida';
}

// CONTROL SEMBRADO (cicatriz ② del encargo): logs FABRICADOS aquí, no tomados del árbol. Cada uno tiene
// que salir en su clase; y el mismo log sin sus marcas tiene que salir «SIN LEER», no en una clase.
if (resto.includes('--control')) {
  const H = 'Z ';
  const t = (...ls) => ls.map((l) => `2026-10-27T00:00:00.0000000${H}${l}`).join('\n');
  const casos = [
    ['H', t('  ✔ a.test.mjs · x', '  ✖ b.test.mjs · MUDO', '🔴 GUARDS MUDOS — pasan en verde:', '  · b.test.mjs · m', 'vivas 1 · mudas 1 · ciegas 0 · ficheros muertos 0', '##[error]Process completed with exit code 1.')],
    ['P', t('  ✔ a.test.mjs · CONTROL: dice CIEGO', '🔴 CORTO YO, ANTES DEL TECHO: llevo 1696 s', '🔴 CIEGO:', '', '  · 🔴 CORTO YO, ANTES DEL TECHO: llevo 1696 s', 'vivas 1 · mudas 0 · ciegas 1 · ficheros muertos 0', '##[error]Process completed with exit code 2.')],
    ['C', t('  ? c.test.mjs · CIEGO', '🔴 CIEGO:', 'coste por guard: intercalado', '  · c.test.mjs · el test «t» NO aparece EN VERDE', 'vivas 1 · mudas 0 · ciegas 1 · ficheros muertos 0', '##[error]Process completed with exit code 2.')],
    ['S', t('  ? d.test.mjs · CIEGO', '🔴 CIEGO:', '  · d.test.mjs · CIEGO · salida cortada: 3 de 9 líneas', 'vivas 1 · mudas 0 · ciegas 1 · ficheros muertos 0', '##[error]Process completed with exit code 2.')],
  ];
  let mal = 0;
  for (const [esperada, log] of casos) {
    const r = clasificaLog(log); const c = clase(r, 'Cada guard cae con la mutación que declara');
    const vacio = clase(clasificaLog(log.split('\n').map((l) => l.replace(/(✖|\?|🔴|vivas|##\[error\]).*/, 'nada')).join('\n')), 'Cada guard cae con la mutación que declara');
    const ok = c.startsWith(esperada) && r.cuadra === true && vacio.startsWith('SIN LEER');
    if (!ok) mal++;
    console.log(`  control ${esperada}: ${c} · cuadra ${r.cuadra} · sin marcas → ${vacio} · ${ok ? 'OK' : 'MAL'}`);
  }
  console.log(`CONTROL SEMBRADO: ${casos.length - mal} de ${casos.length} bien`);
  process.exit(mal ? 1 : 0);
}

const sel = filas.filter((f) => f.job && (f.job.fin === 'failure' || f.job.fin === 'success'));
const out = [];
for (const f of sel) {
  const p = path.join(dir, `${f.job.id}.log`);
  if (bajar && !fs.existsSync(p)) {
    const t = execFileSync('gh', ['api', '--allow-escape-sequences', `${REPO}/actions/jobs/${f.job.id}/logs`], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    fs.writeFileSync(p, t);
  }
  const texto = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const r = clasificaLog(texto);
  const pasoFallido = (f.job.pasos.find((s) => s.fin === 'failure') || {}).nombre || null;
  const dur = (new Date(f.job.finHora) - new Date(f.job.inicio)) / 1000;
  out.push({ run: f.run, job: f.job.id, evento: f.evento, rama: f.rama, sha: f.sha.slice(0, 9), creado: f.creado, fin: f.job.fin,
    durS: dur, bytes: Buffer.byteLength(texto), pasoFallido, clase: f.job.fin === 'success' ? '(success)' : clase(r, pasoFallido), ...r });
}
fs.writeFileSync(salida, JSON.stringify(out, null, 1));
const fallos = out.filter((o) => o.fin === 'failure');
const ok = out.filter((o) => o.fin === 'success');
console.log(`POBLACION failure=${fallos.length} success(calibracion)=${ok.length} · logs vacios=${out.filter((o) => o.bytes === 0).length}`);
const cuenta = {};
for (const o of fallos) cuenta[o.clase] = (cuenta[o.clase] || 0) + 1;
for (const [k, v] of Object.entries(cuenta).sort()) console.log(`  ${String(v).padStart(3)} de ${fallos.length} · ${k}`);
const suma = Object.values(cuenta).reduce((a, b) => a + b, 0);
console.log(`suma de clases = ${suma} (tiene que ser ${fallos.length})`);
console.log(`COHERENCIA con el resumen del instrumento (ciegas = guards «?» + corte; mudas = guards «✖»): cuadra ${out.filter((o) => o.cuadra === true).length} · no cuadra ${out.filter((o) => o.cuadra === false).length} · sin resumen ${out.filter((o) => o.cuadra === null).length}`);
console.log(`CALIBRACION success: con resumen y codigo null/0 = ${ok.filter((o) => o.resumen && !o.codigo).length} de ${ok.length} · con mudas>0 = ${ok.filter((o) => o.resumen && o.resumen.mudas).length} (tiene que ser 0)`);
