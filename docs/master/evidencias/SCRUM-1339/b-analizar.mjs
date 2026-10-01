#!/usr/bin/env node
// SÓLO LECTURA. Mide, sobre el TAP que el job TIENE DENTRO (el artefacto `tanda-tap`):
//   ① si llega entero (NUL, resúmenes en la raíz, nombres = `# tests N`)
//   ② la señal de SCRUM-1339 («todo nombre literal que el árbol PROBADO declara aparece en el TAP»)
//   ③ las entradas de fichero (lo que mira SCRUM-702/1380) con su duration_ms
//   node analizar.mjs <carpeta> <raíz del repo>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [carpeta, raiz] = process.argv.slice(2);
const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const git = (args, input) => execFileSync('git', args, { cwd: raiz, input, maxBuffer: 1024 * 1024 * 1024 });
const gitOk = (args) => { try { return git(args).toString('utf8').trim(); } catch { return null; } };

const leeTsv = (f) => { const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); const c = L.shift().split('\t'); return L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))); };
const filas = leeTsv(path.join(carpeta, 'bajados.tsv'));

// ── nombres declarados, por AST, en el orden del fuente ────────────────────────────────────
function declarados(codigo, nombre) {
  const sf = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const llamadas = [];
  (function recorrer(x) {
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && ['test', 'it'].includes(x.expression.text)) {
      const a = x.arguments[0];
      llamadas.push(a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? a.text : null);
    }
    ts.forEachChild(x, recorrer);
  })(sf);
  return llamadas;
}
const cacheArbol = new Map();
function declaradosDelArbol(arbol) {
  if (cacheArbol.has(arbol)) return cacheArbol.get(arbol);
  const rutas = git(['ls-tree', '-r', '--name-only', arbol, 'tests/']).toString('utf8').split('\n').filter((r) => /^tests\/[^/]+\.test\.mjs$/.test(r));
  const salida = git(['cat-file', '--batch'], rutas.map((r) => `${arbol}:${r}`).join('\n') + '\n');
  const porFichero = new Map(); const mapa = new Map(); let p = 0; let total = 0;
  for (const r of rutas) {
    const fin = salida.indexOf(10, p);
    const cab = salida.subarray(p, fin).toString('utf8').split(' ');
    const n = Number(cab[2]);
    if (cab[1] !== 'blob' || !Number.isFinite(n)) throw new Error(`cat-file: cabecera inesperada para ${r}: ${cab.join(' ')}`);
    const ll = declarados(salida.subarray(fin + 1, fin + 1 + n).toString('utf8'), r);
    porFichero.set(path.basename(r), ll); total += ll.length;
    for (const nombre of ll) if (nombre !== null) { if (!mapa.has(nombre)) mapa.set(nombre, []); mapa.get(nombre).push(path.basename(r)); }
    p = fin + 1 + n + 1;
  }
  const d = { mapa, porFichero, ficheros: rutas.length, total };
  cacheArbol.set(arbol, d); return d;
}

// ── el TAP ────────────────────────────────────────────────────────────────────────────────
const norm = (s) => s.replace(/\s+/g, ' ').trim();
function leeTap(ruta) {
  const buf = fs.readFileSync(ruta);
  let nul = 0; for (const b of buf) if (b === 0) nul++;
  const lineas = buf.toString('utf8').split('\n');
  const resumenes = lineas.filter((l) => /^# tests \d+\s*$/.test(l));
  const nombres = new Map(); let lineasOk = 0; const entradas = [];
  lineas.forEach((l, i) => {
    const m = l.match(/^\s*(?:not )?ok \d+ - (.*)$/);
    if (!m) return;
    lineasOk++;
    let n = m[1].replace(/ # (?:SKIP|TODO)\b.*$/, '');
    n = n.replace(/\\#/g, '#').replace(/\\\\/g, '\\');
    const k = norm(n); nombres.set(k, (nombres.get(k) || 0) + 1);
    const e = l.match(/^(?:not )?ok \d+ - (\S+\.test\.mjs)\s*$/);
    if (e) { let ms = null; for (let j = i + 1; j <= i + 6 && j < lineas.length; j++) { const d = lineas[j].trim().match(/^duration_ms:\s*([\d.]+)$/); if (d) { ms = Number(d[1]); break; } } entradas.push({ fichero: path.basename(e[1]), ms, notOk: /^not ok/.test(l) }); }
  });
  const num = (k) => { const l = lineas.filter((x) => new RegExp(`^# ${k} \\d+\\s*$`).test(x)).at(-1); return l ? Number(l.match(/\d+/)[0]) : null; };
  return { bytes: buf.length, nul, resumenes: resumenes.length, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), lineasOk, nombres, entradas };
}

// ── el commit que el job PROBÓ (del log), y de él su árbol ─────────────────────────────────
function probado(f, logDe) {
  const log = logDe.get(f.run);
  if (!log) return { arbol: null, de: 'sin log' };
  const txt = fs.readFileSync(log, 'latin1');
  const m = txt.match(/HEAD is now at [0-9a-f]+ Merge ([0-9a-f]{40}) into ([0-9a-f]{40})/);
  if (m) {
    const [, cabeza, base] = m;
    for (const c of [cabeza, base]) if (gitOk(['cat-file', '-e', `${c}^{commit}`]) === null) return { arbol: null, de: `falta ${c.slice(0, 8)} en local`, cabeza, base };
    const arbol = gitOk(['merge-tree', '--write-tree', base, cabeza]);
    if (!arbol || !/^[0-9a-f]{40}$/.test(arbol.split('\n')[0])) return { arbol: null, de: 'merge-tree no dio árbol', cabeza, base };
    return { arbol: arbol.split('\n')[0], de: 'fusión', cabeza, base };
  }
  if (f.evento === 'push') {
    const a = gitOk(['rev-parse', `${f.sha}^{tree}`]);
    return a ? { arbol: a, de: 'push', cabeza: f.sha } : { arbol: null, de: 'falta el sha en local' };
  }
  return { arbol: null, de: 'sin línea de fusión en el log' };
}

const logDe = new Map();
for (const f of filas) { const l = path.join(carpeta, 'logs', `${f.id}.log`); if (fs.existsSync(l)) logDe.set(f.run, l); }

const out = []; const detalle = [];
for (const f of filas) {
  const ruta = path.join(carpeta, 'taps', `${f.id}.tap`);
  if (!fs.existsSync(ruta)) { out.push({ ...f, estado: 'SIN TAP' }); continue; }
  const t = leeTap(ruta);
  const entero = t.nul === 0 && t.resumenes === 1 && t.tests !== null && t.lineasOk === t.tests;
  const fila = { id: f.id, creado: f.creado, run: f.run, intento: `${f.intento}/${f.intentos}`, evento: f.evento, rama: f.rama, conclusion: f.conclusion, bytes: t.bytes, nul: t.nul, resumenes: t.resumenes, tests: t.tests, fail: t.fail, lineasOk: t.lineasOk, entero: entero ? 'sí' : 'NO', entradas: t.entradas.map((e) => `${e.fichero}@${e.ms === null ? '?' : Math.round(e.ms)}ms${e.notOk ? '(not ok)' : ''}`).join(' ') };
  if (entero) {
    const p = probado(f, logDe);
    fila.arbol = p.arbol ? p.arbol.slice(0, 12) : `— (${p.de})`;
    if (p.arbol) {
      const d = declaradosDelArbol(p.arbol);
      fila.declaradas = d.total; fila.literales = d.mapa.size;
      const faltan = [...d.mapa.keys()].filter((n) => !t.nombres.has(norm(n)));
      fila.faltan = faltan.length;
      const porF = new Map();
      for (const n of faltan) for (const fi of d.mapa.get(n)) { if (!porF.has(fi)) porF.set(fi, []); porF.get(fi).push(n); }
      const trozos = [];
      for (const [fi, ns] of porF) {
        const ll = d.porFichero.get(fi); const aus = ll.map((n) => (n === null ? null : !t.nombres.has(norm(n))));
        const primero = aus.indexOf(true);
        const lit = aus.filter((x) => x !== null).length;
        const cola = aus.slice(primero).every((x) => x !== false);
        const todo = aus.every((x) => x !== false);
        const esEntrada = t.entradas.some((e) => e.fichero === fi);
        trozos.push(`${fi}×${ns.length}/${ll.length}:${todo ? 'ENTERO' : cola ? 'cola' : 'MEDIO'}${esEntrada ? '+entrada' : ''}`);
        detalle.push([f.id, f.run, f.intento, f.conclusion, fi, ns.length, ll.length, lit, primero + 1, todo ? 'entero' : cola ? 'cola' : 'medio', esEntrada ? 'con entrada de fichero' : 'sin entrada'].join('\t'));
      }
      fila.donde = trozos.join(' ');
    }
  }
  out.push(fila);
}
const cab = ['id', 'creado', 'run', 'intento', 'evento', 'rama', 'conclusion', 'bytes', 'nul', 'resumenes', 'tests', 'fail', 'lineasOk', 'entero', 'entradas', 'arbol', 'declaradas', 'literales', 'faltan', 'donde'];
fs.writeFileSync(path.join(carpeta, 'analisis.tsv'), cab.join('\t') + '\n' + out.map((f) => cab.map((k) => f[k] ?? '').join('\t')).join('\n') + '\n');
fs.writeFileSync(path.join(carpeta, 'faltan-por-fichero.tsv'), ['artefacto', 'run', 'intento', 'conclusion', 'fichero', 'faltan', 'llamadas', 'literales', 'primer_ausente', 'forma', 'entrada'].join('\t') + '\n' + detalle.join('\n') + '\n');

const conTap = out.filter((f) => f.bytes);
const enteros = conTap.filter((f) => f.entero === 'sí');
const medidos = enteros.filter((f) => Number.isFinite(f.faltan));
console.log(`POBLACIÓN: ${filas.length} artefactos · con TAP en disco ${conTap.length}`);
console.log(`① ENTEROS (0 NUL, 1 resumen, líneas ok = # tests): ${enteros.length} de ${conTap.length}`);
const rotos = conTap.filter((f) => f.entero !== 'sí');
console.log(`   no enteros: ${rotos.length} · con NUL ${rotos.filter((f) => f.nul > 0).length} · el último no entero: ${rotos.map((f) => f.creado).sort().at(-1) || '—'} · el primero entero: ${enteros.map((f) => f.creado).sort()[0] || '—'}`);
for (const f of rotos.filter((f) => f.nul === 0)) console.log(`   no entero SIN NUL: ${f.id} ${f.creado} resumenes=${f.resumenes} tests=${f.tests} lineasOk=${f.lineasOk} ${f.conclusion}`);
console.log(`② SEÑAL POR NOMBRES sobre el TAP del job: árbol probado resuelto en ${medidos.length} de ${enteros.length} enteros`);
const sinArbol = enteros.filter((f) => !Number.isFinite(f.faltan));
const motivos = {}; for (const f of sinArbol) motivos[f.arbol] = (motivos[f.arbol] || 0) + 1; if (sinArbol.length) console.log('   sin árbol:', JSON.stringify(motivos));
const conFalta = medidos.filter((f) => f.faltan > 0);
console.log(`   jobs con 0 nombres ausentes: ${medidos.length - conFalta.length} · con alguno: ${conFalta.length}`);
console.log(`   de los ${conFalta.length}: verdes (success) ${conFalta.filter((f) => f.conclusion === 'success').length} · fail=0 en la tanda ${conFalta.filter((f) => f.fail === 0).length}`);
for (const f of conFalta) console.log(`   ${f.id} run ${f.run} [${f.intento}] ${f.evento} ${f.conclusion} tests=${f.tests} fail=${f.fail} faltan=${f.faltan} → ${f.donde}`);
console.log(`③ ENTRADAS DE FICHERO en TAP enteros: ${enteros.filter((f) => f.entradas).length} jobs`);
for (const f of enteros.filter((f) => f.entradas)) console.log(`   ${f.id} run ${f.run} [${f.intento}] ${f.conclusion} → ${f.entradas}`);
console.log('EXIT=0');
