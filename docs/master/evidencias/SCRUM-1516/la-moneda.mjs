// SCRUM-1516, segundo asunto · MEDICIÓN: ¿qué filas del censo de SCRUM-1390 cambian de veredicto
// entre corridas IDÉNTICAS, y por qué?
//
// Corre el censo N veces de tres maneras, siempre en una COPIA fuera del árbol:
//   rol          · el fichero tal cual, eje del rol
//   rol-fecha    · el eje del rol con UNA sustitución: el `canon` que de verdad cambia las fechas por
//                  'FECHA'. No es un arreglo que se entregue: es la medición de qué pasaría.
//   comercio     · el fichero tal cual, eje del comercio
// En las tres copias se quita el recorte a 520 caracteres de la consulta impresa, para poder contar
// las filas que llevan una fecha sin que el corte se coma ninguna.
//
// Uso: node la-moneda.mjs <raiz del arbol, con dist/> [N, por defecto 10]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = process.argv[2]; const N = Number(process.argv[3] || 10);
if (!raiz || !fs.existsSync(path.join(raiz, 'dist', 'app.js')) || !(N >= 2)) { console.log('CIEGO: falta la raiz del arbol con dist/, o N < 2'); console.log('EXIT=2'); process.exit(2); }
const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, '..', '..', '..', 'evidencias', 'scrum1390', 'censo-que-ve-el-tecnico.mjs.txt'), 'utf8');

const veces = (s, t) => s.split(t).length - 1;
const cambia = (s, de, a, cuantas) => { if (veces(s, de) !== cuantas) { console.log('CIEGO: «' + de + '» casa ' + veces(s, de) + ' veces y esperaba ' + cuantas); console.log('EXIT=2'); process.exit(2); } return s.split(de).join(a); };
const CANON = "const canon = (x) => JSON.stringify(x, (k, v) => (v instanceof Date ? 'FECHA' : v));";
// JSON.stringify llama a toJSON ANTES de pasar el valor al reemplazador: dentro de un objeto, `v` ya
// es un texto. El valor sin convertir está en `this[k]`.
const CANON_QUE_LEE = "const canon = (x) => JSON.stringify(x, function (k, v) { return this[k] instanceof Date ? 'FECHA' : v; });";
const sinCorte = cambia(fuente, '.slice(0, 520)', '', 2);
const MANERAS = [
  { n: 'rol', fuente: sinCorte, eje: [] },
  { n: 'rol-fecha', fuente: cambia(sinCorte, CANON, CANON_QUE_LEE, 1), eje: [] },
  { n: 'comercio', fuente: sinCorte, eje: ['--eje=comercio'] },
];

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
const RUTA = /^(GET|POST|PUT|PATCH|DELETE)\s+(\/admin\S*)/;
// Una corrida → Map «MÉTODO ruta» → { v, fecha: ¿su consulta impresa lleva una fecha o 'FECHA'? }
function leer(salida) {
  const filas = new Map(); let seccion = null; let actual = null;
  for (const l of salida.split('\n')) {
    if (l.startsWith('-- ')) { seccion = null; actual = null; continue; } // tablas y controles: ya no son filas
    const s = /^== (\S+) · \d+/.exec(l); if (s) { seccion = s[1]; continue; }
    if (!seccion) continue;
    const r = RUTA.exec(l);
    if (r) { actual = { v: seccion, fecha: false }; filas.set(r[1] + ' ' + r[2], actual); continue; }
    if (actual && (ISO.test(l) || l.includes('"FECHA"'))) actual.fecha = true;
  }
  return filas;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1516-moneda-'));
const entorno = { ...process.env }; for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete entorno[k];
const res = {};
try {
  for (const m of MANERAS) {
    const f = path.join(tmp, m.n + '.mjs'); fs.writeFileSync(f, m.fuente);
    res[m.n] = { corridas: [], salidas: [], ms: [] };
    for (let i = 0; i < N; i++) {
      const t0 = Date.now();
      const out = spawnSync(process.execPath, [f, raiz, ...m.eje], { encoding: 'utf8', env: entorno, maxBuffer: 64 * 1024 * 1024 });
      res[m.n].ms.push(Date.now() - t0); res[m.n].salidas.push(out.status); res[m.n].corridas.push(leer(String(out.stdout || '')));
    }
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

let ciego = false;
const reparto = (m, ruta) => { const c = {}; for (const co of res[m].corridas) { const v = (co.get(ruta) || {}).v || 'NO-FIGURA'; c[v] = (c[v] || 0) + 1; } return c; };
const pinta = (c) => Object.entries(c).sort((a, b) => b[1] - a[1]).map(([v, n]) => n + ' ' + v).join(' · ');
const MONEDA = 'GET /admin/products/frequent-concepts';
console.log('N = ' + N + ' corridas idénticas por manera · copias fuera del árbol · temporal borrado: ' + !fs.existsSync(tmp));
for (const m of MANERAS) {
  const R = res[m.n]; const rutas = [...new Set(R.corridas.flatMap((c) => [...c.keys()]))];
  const tam = [...new Set(R.corridas.map((c) => c.size))];
  if (!rutas.length || tam.length !== 1) ciego = true;
  const inestables = rutas.filter((r) => Object.keys(reparto(m.n, r)).length > 1);
  const conFecha = rutas.filter((r) => R.corridas.some((c) => (c.get(r) || {}).fecha));
  console.log('\n== ' + m.n + ' · filas leídas por corrida: ' + tam.join('/') + ' · códigos de salida: ' + pinta(R.salidas.reduce((a, s) => { a['sale ' + s] = (a['sale ' + s] || 0) + 1; return a; }, {}))
    + ' · ' + Math.round(R.ms.reduce((a, b) => a + b, 0) / N) + ' ms de media');
  console.log('   filas que CAMBIAN de veredicto entre corridas: ' + inestables.length + ' de ' + rutas.length);
  for (const r of inestables) console.log('      ' + r + ' → ' + pinta(reparto(m.n, r)));
  console.log('   filas cuya consulta impresa lleva una fecha: ' + conFecha.length + ' de ' + rutas.length + (m.n === 'comercio' ? '  (en este eje sólo se imprime la consulta de las que cruzan)' : '  (sólo se imprime en NO-DISTINGUE y RECORTA)'));
  for (const r of conFecha) console.log('      ' + r + ' → ' + pinta(reparto(m.n, r)));
  console.log('   control, la fila señalada · ' + MONEDA + ' → ' + pinta(reparto(m.n, MONEDA)));
  if (reparto(m.n, MONEDA)['NO-FIGURA']) ciego = true;
}
// ── ¿Qué cambia si el `canon` lee las fechas? Se compara el veredicto MÁS REPETIDO de cada fila.
const moda = (m, r) => Object.entries(reparto(m, r)).sort((a, b) => b[1] - a[1])[0][0];
const todas = [...new Set(res.rol.corridas.flatMap((c) => [...c.keys()]))];
const mueve = todas.filter((r) => moda('rol', r) !== moda('rol-fecha', r));
console.log('\n== rol contra rol-fecha · filas cuyo veredicto más repetido cambia al leer las fechas: ' + mueve.length + ' de ' + todas.length);
for (const r of mueve) console.log('      ' + r + ' · tal cual: ' + pinta(reparto('rol', r)) + ' · leyendo fechas: ' + pinta(reparto('rol-fecha', r)));
console.log('EXIT=' + (ciego ? 2 : 0)); process.exit(ciego ? 2 : 0);
