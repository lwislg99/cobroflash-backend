#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/d-hermanos.mjs — SCRUM-1339d · SÓLO LECTURA.
//
// LA SEGUNDA SONDA, independiente de la señal: compara los TAP de dos jobs que probaron el MISMO
// árbol, línea a línea (multiconjunto de nombres), SIN mirar ningún fuente. Lo que un hermano
// trae y el otro no es lo que se perdió DE VERDAD; la señal sólo puede nombrar la parte de eso
// que el árbol declara con nombre literal. La diferencia entre las dos es el punto ciego, medido.
//
//   node d-hermanos.mjs <d-contra-los-tap.tsv> <carpeta de taps> <raíz del repo>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tsv, taps, raiz] = process.argv.slice(2);
if (!tsv || !taps || !raiz) { console.error('uso: node d-hermanos.mjs <d-contra-los-tap.tsv> <carpeta de taps> <raíz del repo>'); process.exit(2); }
const m = await import(pathToFileURL(path.join(raiz, 'scripts', '_senal-de-nombres.mjs')).href);

const L = fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean);
const c = L.shift().split('\t');
const filas = L.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [c[i], v]))).filter((x) => x.medible === 'sí');
const grupos = new Map();
for (const x of filas) { if (!grupos.has(x.arbol)) grupos.set(x.arbol, []); grupos.get(x.arbol).push(x); }

let pares = 0; let jobs = 0; let cuadran = 0; let conCiego = 0; let perdidasDeVerdad = 0; let nombradas = 0; let mudos = 0;
console.log(`POBLACIÓN: ${filas.length} jobs medibles · ${grupos.size} árboles · con más de un job: ${[...grupos.values()].filter((g) => g.length > 1).length}`);
for (const [arbol, g] of grupos) {
  if (g.length < 2) continue;
  pares++;
  const leidos = g.map((x) => ({ x, t: m.leerTap(fs.readFileSync(path.join(taps, `${x.id}.tap`), 'utf8')) }));
  // el «completo» del árbol: para cada nombre, el MÁXIMO de veces que lo trae algún hermano
  const completo = new Map();
  // (la línea de un fichero entero —`ok N - tests/x.test.mjs`— no es un caso: sale justo cuando
  //  el fichero NO informó de los suyos, así que contarla sería contar la pérdida como registro)
  const esEntrada = (t, n) => t.entradasDeFichero.some((e) => n.split(/[\\/]/).pop() === e.fichero);
  for (const { t } of leidos) for (const [n, k] of t.nombres) if (!esEntrada(t, n)) completo.set(n, Math.max(completo.get(n) ?? 0, k));
  const total = [...completo.values()].reduce((a, b) => a + b, 0);
  for (const { x, t } of leidos) {
    jobs++;
    const faltan = [];
    for (const [n, k] of completo) { const d = k - (t.nombres.get(n) ?? 0); if (d > 0) faltan.push([n, d]); }
    const perdidos = faltan.reduce((a, [, d]) => a + d, 0);
    const senal = Number(x.ausentes) + Number(x.dudosos);
    perdidasDeVerdad += perdidos; nombradas += senal;
    const estado = perdidos === senal ? 'CUADRA' : perdidos > senal ? `CIEGO: la señal nombra ${senal} de ${perdidos}` : `🔴 LA SEÑAL NOMBRA MÁS (${senal}) DE LO QUE FALTA (${perdidos})`;
    if (perdidos === senal) cuadran++; else if (perdidos > senal) conCiego++;
    if (perdidos > 0 && senal === 0) mudos++;
    console.log(`  ${arbol} ${x.id} [${x.intento}] ${x.evento} ${x.conclusion} · tests ${t.tests} · unión de hermanos ${total} · perdidos frente a la unión ${perdidos} · señal ${senal} · ${estado}`);
    if (perdidos !== senal) for (const [n, d] of faltan.slice(0, 40)) console.log(`        ${d}× ${n.slice(0, 150)}`);
  }
}
console.log(`RESUMEN: ${pares} árboles con hermanos · ${jobs} jobs · cuadran ${cuadran} · con pérdidas que la señal no nombra enteras ${conCiego} · con pérdida y señal MUDA (0 nombrados) ${mudos}`);
console.log(`         casos perdidos frente a la unión ${perdidasDeVerdad} · nombrados por la señal ${nombradas}`);
console.log('EXIT=0');
