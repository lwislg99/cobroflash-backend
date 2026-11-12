// Sonda S3 · SCRUM-1335 · ¿una pérdida en las DOS zonas deja rastro en el instrumento?
// Uso: node sonda.mjs <ruta absoluta a scripts/_trinquete-de-zona.mjs> <dir de sembrados>
// Sólo lee el instrumento: importa sus funciones y las corre sobre ficheros sembrados FUERA del árbol.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , modulo, dir] = process.argv;
const T = await import(pathToFileURL(modulo).href);
fs.mkdirSync(dir, { recursive: true });

const CAB = `import test from 'node:test';\nconst ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;\n`;
const MUDO = (cond) => `if (${cond}) process.stdout.write = () => true;\n`;
const tres = (p) => [1, 2, 3].map((i) => `test('${p} ${i}', () => {});`).join('\n') + '\n';
const SEMBRADOS = {
  'normal.test.mjs': CAB + tres('normal'),
  'mudo-en-midway.test.mjs': CAB + MUDO("ZONA === 'Pacific/Midway'") + tres('midway'),
  'mudo-en-las-dos.test.mjs': CAB + MUDO('true') + tres('dos'),
  'mudo-a-mitad-en-las-dos.test.mjs': CAB
    + "test('mitad 1', () => {});\ntest('mitad 2', () => {});\n"
    + "test('mitad 3 enmudece', () => { process.stdout.write = () => true; });\n"
    + "test('mitad 4', () => {});\ntest('mitad 5', () => {});\n",
};
const rutas = Object.entries(SEMBRADOS).map(([n, c]) => { const r = path.join(dir, n); fs.writeFileSync(r, c); return r; });

const medidas = T.ZONAS.map((zona) => T.medirEnZona({
  zona, ficheros: rutas, raiz: T.RAIZ, salida: path.join(dir, `${zona.replace(/\W/g, '_')}.json`),
}));
for (const m of medidas) {
  console.log(`\n== ${m.zona} ok=${m.ok} ${m.porque ?? ''} · claves ${m.veredictos?.size}`);
  for (const [k, v] of m.veredictos ?? []) console.log(`   ${v.padEnd(8)} ${k.replace(/^.*sonda-doble\//, '')}`);
}
const t = compararSeguro(medidas);
function compararSeguro(ms) { return ms.every((m) => m.ok) ? T.compararZonas(ms) : null; }
console.log('\n== compararZonas');
console.log(`   cambian ${t?.cambian.length} · sinComparar ${t?.sinComparar.length}`);
for (const c of t?.sinComparar ?? []) console.log(`   sinComparar: ${c.clave.replace(/^.*sonda-doble\//, '')}  ${c.porZona.map((p) => `${p.zona}=${p.veredicto}`).join(' ')}`);
const esperadas = { 'normal.test.mjs': 3, 'mudo-en-midway.test.mjs': 3, 'mudo-en-las-dos.test.mjs': 3, 'mudo-a-mitad-en-las-dos.test.mjs': 5 };
console.log('\n== por fichero: pruebas DECLARADAS en el fuente vs claves con nombre de prueba vistas');
for (const [n, e] of Object.entries(esperadas)) {
  const visto = medidas.map((m) => [...(m.veredictos ?? new Map()).keys()].filter((k) => k.includes(`/${n}::`) && !k.endsWith(n)).length);
  const enLaLista = new Set([...(t?.cambian ?? []), ...(t?.sinComparar ?? [])].filter((c) => c.fichero.endsWith(n)).map((c) => c.clave)).size;
  console.log(`   ${n.padEnd(36)} declaradas ${e} · vistas ${visto.join(' / ')} · en alguna lista del instrumento ${enLaLista}`);
}
