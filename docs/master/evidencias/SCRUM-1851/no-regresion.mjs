// SCRUM-1851 · control de no-regresión del helper `tests/_guard-texto.mjs`.
//
// Pasa CADA fichero JS/TS del árbol por el helper VIEJO y por el NUEVO y compara la salida byte a
// byte (sha256). Por cada fichero, cuatro salidas: `soloEjecutable` con la almohadilla en true y en
// false, `leerFuente` (que decide por la ruta) y `literalesDeCadena`. En JS/TS tienen que salir
// IDÉNTICAS todas. Después pasa los .css con la opción nueva, para decir cuáles cambian hoy.
//
// Controles sembrados: un CSS con `url(https://…)` TIENE que cambiar (si no cambia, el comparador
// está ciego), y un JS con su comentario final NO tiene que cambiar.
//
// Uso:  node docs/master/evidencias/SCRUM-1851/no-regresion.mjs <raíz> <helper viejo> [<tsv de salida>]
// El helper viejo es el de antes del arreglo, copiado a un fichero aparte.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const [raiz, rutaVieja, tsv] = process.argv.slice(2);
if (!raiz || !rutaVieja) { console.error('uso: no-regresion.mjs <raíz> <helper viejo> [<tsv>]'); process.exit(2); }
const viejo = await import(pathToFileURL(path.resolve(rutaVieja)).href);
const nuevo = await import(pathToFileURL(path.join(path.resolve(raiz), 'tests', '_guard-texto.mjs')).href);
if (viejo.soloEjecutable === nuevo.soloEjecutable) { console.error('CIEGO: viejo y nuevo son el mismo módulo'); process.exit(2); }

const FUERA = new Set(['node_modules', 'dist', '.git', 'coverage']);
const recorrer = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (FUERA.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(abs, out);
    else if (e.isFile()) out.push(abs);
  }
  return out;
};
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const seguro = (f) => { try { return f(); } catch (e) { return `THROW:${e.message}`; } };
const salidas = (h, texto, abs) => [
  seguro(() => h.soloEjecutable(texto)),
  seguro(() => h.soloEjecutable(texto, { almohadillaEsComentario: false })),
  seguro(() => h.leerFuente(abs)),
  seguro(() => JSON.stringify(h.literalesDeCadena(texto))),
];

const todos = recorrer(path.resolve(raiz));
const JS = todos.filter((f) => /\.(m?js|cjs|ts|tsx|jsx)$/i.test(f));
const CSS = todos.filter((f) => /\.css$/i.test(f));

const porGrupo = new Map();
const distintos = [];
const filasTsv = ['fichero\tsha256(soloEjecutable)\tsha256(alm=false)\tsha256(leerFuente)\tsha256(literales)\tigual'];
let huella = crypto.createHash('sha256');
for (const abs of JS) {
  const rel = path.relative(raiz, abs).replace(/\\/g, '/');
  const texto = fs.readFileSync(abs, 'utf8');
  const a = salidas(viejo, texto, abs).map(sha);
  const b = salidas(nuevo, texto, abs).map(sha);
  const igual = a.every((x, k) => x === b[k]);
  if (!igual) distintos.push(rel);
  const grupo = `${rel.split('/')[0]} · ${path.extname(rel)}`;
  porGrupo.set(grupo, (porGrupo.get(grupo) || 0) + 1);
  filasTsv.push(`${rel}\t${b.join('\t')}\t${igual ? 'sí' : 'NO'}`);
  huella.update(`${rel}\0${b.join('')}\n`);
}
huella = huella.digest('hex');

const cssCambian = [];
for (const abs of CSS) {
  const texto = fs.readFileSync(abs, 'utf8');
  const antes = viejo.soloEjecutable(texto, { almohadillaEsComentario: false });
  const despues = nuevo.soloEjecutable(texto, { almohadillaEsComentario: false, barraDobleEsComentario: false });
  const lf = sha(seguro(() => viejo.leerFuente(abs))) !== sha(seguro(() => nuevo.leerFuente(abs)));
  if (antes !== despues || lf) cssCambian.push(path.relative(raiz, abs).replace(/\\/g, '/'));
}

// Controles sembrados.
const CSS_SEMBRADO = '.uno { color: red; }\n.dos { background: url(https://x.y/z.png); }\n.tres { color: blue; }\n';
const JS_SEMBRADO = 'const x = 1; // comentario final\n';
const cssSembradoCambia = viejo.soloEjecutable(CSS_SEMBRADO, { almohadillaEsComentario: false })
  !== nuevo.soloEjecutable(CSS_SEMBRADO, { almohadillaEsComentario: false, barraDobleEsComentario: false });
const jsSembradoIgual = viejo.soloEjecutable(JS_SEMBRADO) === nuevo.soloEjecutable(JS_SEMBRADO);

console.log(`POBLACIÓN JS/TS: ${JS.length} ficheros (de ${todos.length} recorridos; fuera: ${[...FUERA].join(', ')})`);
for (const [g, n] of [...porGrupo].sort((x, y) => y[1] - x[1])) console.log(`  ${g}\t${n}`);
console.log(`comparaciones: ${JS.length} × 4 salidas = ${JS.length * 4}`);
console.log(`DISTINTOS: ${distintos.length}${distintos.length ? `\n  ${distintos.join('\n  ')}` : ''}`);
console.log(`huella de la población (sha256 de fichero+salidas nuevas): ${huella}`);
console.log(`POBLACIÓN CSS: ${CSS.length} · cambian con la opción nueva: ${cssCambian.length}${cssCambian.length ? ` (${cssCambian.join(', ')})` : ''}`);
console.log(`control sembrado CSS (TIENE que cambiar): ${cssSembradoCambia ? 'cambia ✔' : 'NO cambia ✖ CIEGO'}`);
console.log(`control sembrado JS (NO tiene que cambiar): ${jsSembradoIgual ? 'igual ✔' : 'cambia ✖'}`);
if (tsv) fs.writeFileSync(tsv, filasTsv.join('\n') + '\n');
const ok = JS.length > 0 && distintos.length === 0 && cssSembradoCambia && jsSembradoIgual;
process.exit(ok ? 0 : 1);
