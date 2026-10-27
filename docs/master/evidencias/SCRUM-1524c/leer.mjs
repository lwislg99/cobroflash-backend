// SCRUM-1524c · LEE cada una de las 25 citas contra la línea a la que apunta HOY, en el árbol.
//
// No es el censo de SCRUM-1524 y no puede serlo: el censo compara con el día en que la cita entró en
// el documento, así que una cita recién corregida le sale «intacta» esté bien o mal (c.19280).
// Aquí, por cada fila de la tabla:
//   1. el documento, en su línea, LLEVA el literal `nuevo` (la cita está escrita);
//   2. la coordenada que hay DENTRO de `nuevo` es la del rango de la fila (no se lee un número y se
//      comprueba otro);
//   3. la primera línea del rango, en el fichero citado, CONTIENE `espera` (y la última, `espera2`).
// y se imprime la frase junto a lo que hay en la línea, para leerlo con los ojos.
//
// CONTROLES, los dos sembrados por el propio instrumento, no prestados del árbol:
//   · POSITIVO: dos citas fabricadas ROTAS (una apunta una línea más arriba, otra a un fichero que no
//     existe). Tienen que salir ROTAS. Si no salen, o si se lanzan con --sin-rotas, dice CIEGO y sale 2
//     sin dar ninguna cifra.
//   · CERO DERIVADO: una cita fabricada BUENA. No puede salir rota.
//   node docs/master/evidencias/SCRUM-1524c/leer.mjs [--sin-rotas]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TABLA } from './tabla.mjs';

const cache = new Map();
const leer = (p) => { if (!cache.has(p)) cache.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : null); return cache.get(p); };

function juzgar(f) {
  const motivos = [];
  const doc = leer(f.doc);
  const frase = doc ? (doc[f.linea - 1] ?? '') : '';
  if (!doc) motivos.push('el documento no existe');
  else if (!frase.includes(f.nuevo)) motivos.push('la línea del documento no lleva la cita');
  // `nuevo` puede llevar más de una coordenada (la fila 39 lleva dos): tiene que estar la de la fila.
  const coords = [...f.nuevo.matchAll(/:(\d+)(?:-(\d+))?`/g)].map((m) => [Number(m[1]), Number(m[2] || m[1])]);
  const [a, b] = f.rango;
  if (!coords.some((c) => c[0] === a && c[1] === b)) motivos.push(`la cita dice ${coords.map((c) => c.join('-')).join(', ') || 'nada'} y la fila ${a}-${b}`);
  const hoy = leer(f.fichero);
  let visto = [];
  if (!hoy) motivos.push('el fichero citado no existe');
  else {
    if (b > hoy.length) motivos.push('fuera de rango');
    visto = hoy.slice(a - 1, b);
    if (!(visto[0] || '').includes(f.espera)) motivos.push(`la línea ${a} no contiene «${f.espera}»`);
    if (f.espera2 && !(visto[visto.length - 1] || '').includes(f.espera2)) motivos.push(`la línea ${b} no contiene «${f.espera2}»`);
  }
  return { motivos, frase, visto, a };
}

// ── los controles, en un directorio desechable ──────────────────────────────────────────────────
// El borrado va en un `finally`: en el camino feliz no se ejecutaba si `juzgar` o una escritura
// lanzaban, y el directorio se quedaba en TMPDIR (lo cazó `tests/scrum864c`, en rojo en el PR #2369).
// Lo que NO cubre: un proceso matado a lo bruto no ejecuta ningún `finally`.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1524c-'));
let ROTAS = [];
let rotasVistas = 0;
let buenaMarcada = true;
try {
  const cod = path.join(tmp, 'codigo.ts');
  const docS = path.join(tmp, 'doc.md');
  fs.writeFileSync(cod, 'uno\ndos\nconst testigo = 1;\ncuatro\n');
  fs.writeFileSync(docS, 'buena `codigo.ts:3`\nrota `codigo.ts:2`\nrota `nohay.ts:1`\n');
  const BUENA = { doc: docS, linea: 1, nuevo: '`codigo.ts:3`', fichero: cod, rango: [3, 3], espera: 'const testigo' };
  ROTAS = process.argv.includes('--sin-rotas') ? [] : [
    { doc: docS, linea: 2, nuevo: '`codigo.ts:2`', fichero: cod, rango: [2, 2], espera: 'const testigo' },
    { doc: docS, linea: 3, nuevo: '`nohay.ts:1`', fichero: path.join(tmp, 'nohay.ts'), rango: [1, 1], espera: 'const testigo' },
  ];
  rotasVistas = ROTAS.filter((f) => juzgar(f).motivos.length > 0).length;
  buenaMarcada = juzgar(BUENA).motivos.length > 0;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
if (rotasVistas !== 2 || ROTAS.length !== 2) {
  console.log(`CIEGO · control positivo: ${rotasVistas} rotas vistas de ${ROTAS.length} sembradas (hacen falta 2 de 2). No se da ninguna cifra.`);
  console.log('EXIT=2');
  process.exit(2);
}
if (buenaMarcada) { console.log('CIEGO · el cero derivado falla: la cita buena sembrada sale rota.'); console.log('EXIT=2'); process.exit(2); }

// ── las 25 ──────────────────────────────────────────────────────────────────────────────────────
const porClase = { N: 0, L: 0, 0: 0 };
let malas = 0;
let lejosDelCenso = 0;
console.log(`POBLACION · ${TABLA.length} citas (${TABLA.filter((f) => f.doc.includes('AUDITORIA')).length} auditoría, ${TABLA.filter((f) => f.doc.includes('PREGUNTAS')).length} preguntas) · control: 2 rotas vistas de 2, 0 buenas marcadas de 1`);
for (const f of TABLA) {
  const r = juzgar(f);
  porClase[f.clase]++;
  if (r.motivos.length) malas++;
  const censo = f.censo && f.censo !== f.rango[0] ? ` · ⚠️ el censo daba ${f.censo}` : '';
  if (censo) lejosDelCenso++;
  const i = r.frase.indexOf(f.nuevo);
  const ventana = r.frase.slice(Math.max(0, i - 170), i + f.nuevo.length + 130).trim();
  console.log(`\n[${r.motivos.length ? 'ROTA' : 'bien'}] ${f.doc.split('/').pop()}:${f.linea} · clase ${f.clase} · ${f.viejo === f.nuevo ? 'sin tocar' : 'tocada'}${censo}`);
  console.log(`  FRASE: …${ventana}…`);
  r.visto.slice(0, 4).forEach((s, k) => console.log(`  ${String(r.a + k).padStart(5)}: ${s.trim().slice(0, 170)}`));
  for (const mo of r.motivos) console.log(`  ✗ ${mo}`);
}
console.log(`\nRESULTADO · ${TABLA.length - malas} bien de ${TABLA.length} · ${malas} rotas · clases N=${porClase.N} L=${porClase.L} 0=${porClase[0]} · ${lejosDelCenso} con destino distinto del que daba el censo`);
console.log(`EXIT=${malas ? 1 : 0}`);
process.exit(malas ? 1 : 0);
