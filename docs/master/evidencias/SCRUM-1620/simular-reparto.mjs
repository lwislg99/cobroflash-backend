// Simula repartir el censo del meta-guard en K partes con los costes MEDIDOS de un job entero.
// Uso: node simular-reparto.mjs <costes.json> [factorRunnerLento]
import fs from 'node:fs';
import crypto from 'node:crypto';
const filas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const lento = Number(process.argv[3] || 1);
const FUERA = 73; // lo que el job gasta fuera del paso (máximo medido, SCRUM-935e)
const TECHO = 1800; const MARGEN = 105;
// El orden del censo es el de readdirSync, que libuv ordena con strcmp (no localeCompare).
const orden = [...filas].sort((a, b) => (a.g < b.g ? -1 : a.g > b.g ? 1 : 0));
const total = orden.reduce((n, f) => n + f.s, 0) * lento;
console.log(`censo: ${orden.length} guards · ${orden.reduce((n, f) => n + f.muts, 0)} veredictos · ${total.toFixed(0)} s (factor ${lento})`);
const metodos = {
  'por turno (i % K, orden del censo)': (f, i, K) => i % K,
  'por huella del nombre (sha1 % K)': (f, i, K) => parseInt(crypto.createHash('sha1').update(f.g).digest('hex').slice(0, 8), 16) % K,
  'por tramos contiguos': (f, i, K) => Math.min(K - 1, Math.floor(i * K / orden.length)),
};
for (const K of [2, 3, 4]) {
  for (const [nombre, fn] of Object.entries(metodos)) {
    const partes = Array.from({ length: K }, () => ({ s: 0, g: 0 }));
    orden.forEach((f, i) => { const p = partes[fn(f, i, K)]; p.s += f.s * lento; p.g++; });
    const peor = Math.max(...partes.map((p) => p.s));
    console.log(`K=${K} · ${nombre.padEnd(38)} partes ${partes.map((p) => `${p.s.toFixed(0)}s/${p.g}g`).join(' · ')} · peor ${peor.toFixed(0)} s · margen al presupuesto (${TECHO - MARGEN}) ${(TECHO - MARGEN - peor).toFixed(0)} s · job ≈ ${(peor + FUERA).toFixed(0)} s`);
  }
}
