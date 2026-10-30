// SCRUM-1502j · de un solo uso. Foto del nivel de CADA marca, para comparar antes/después de anclar.
//
//   node niveles.mjs <raíz> <salida.json>          → foto
//   node niveles.mjs --compara <antes.json> <después.json>
//
// La foto lleva dos mediciones que NO son la misma:
//   · `guard`: congeladas() y porNivel() de scrum921c, por su propio camino (lo que decide el CI);
//   · `marcas`: el nivel de cada marca con el lector de la sonda de 1502h (mismo MARCA y EXCLUIR que
//     docs/master/evidencias/scrum1502i/dieciocho.mjs). Esta NO aplica el filtro de negación del
//     guard: cuenta una «sin-respaldo» de más (21 contra 20, medido en 1502h y 1502i).
// La identidad de una marca es fichero + su ordinal dentro del fichero, NO la línea: un ancla añade
// una línea y mueve las de debajo (tramo 7, el caso de scrum320:252 → :253).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[2] === '--compara') {
  const [a, d] = process.argv.slice(3).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  const idx = (f) => new Map(f.marcas.map((m) => [m.clave, m]));
  const A = idx(a), D = idx(d);
  console.log(`guard antes   congeladas=${a.guard.congeladas.length} porNivel=${JSON.stringify(a.guard.porNivel)}`);
  console.log(`guard después congeladas=${d.guard.congeladas.length} porNivel=${JSON.stringify(d.guard.porNivel)}`);
  console.log(`congeladas idénticas como conjunto: ${JSON.stringify([...a.guard.congeladas].sort()) === JSON.stringify([...d.guard.congeladas].sort())}`);
  console.log(`marcas antes=${A.size} después=${D.size}`);
  let cambios = 0;
  for (const [k, m] of A) {
    const n = D.get(k);
    if (!n) { console.log(`SALE   ${m.donde} (${m.nivel})`); cambios++; continue; }
    if (n.nivel !== m.nivel) { console.log(`CAMBIA ${m.donde} → ${n.donde}: ${m.nivel} → ${n.nivel}`); cambios++; }
  }
  for (const [k, n] of D) if (!A.has(k)) { console.log(`ENTRA  ${n.donde} (${n.nivel})`); cambios++; }
  console.log(`cambios=${cambios}`);
  process.exit(0);
}

const [RAIZ, SALIDA] = process.argv.slice(2);
if (!RAIZ || !SALIDA) { console.error('uso: niveles.mjs <raíz> <salida.json>'); process.exit(2); }
const imp = (p) => import(pathToFileURL(path.join(RAIZ, p)).href);
const guard = await imp('tests/scrum921c-firma-con-respaldo-en-codigo.test.mjs');
const { marcasDe } = await imp('tests/_procedencia-aprobacion.mjs');
const { indiceDeFuentes, respaldoDe } = await imp('tests/_respaldo-de-firma.mjs');
const { loQueSeLee } = await imp('tests/_cita-declarada.mjs');
const MARCA = /(?:aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+el\s+fundador|\bel\s+fundador\s+(?:lo\s+|la\s+|los\s+|las\s+|ya\s+|s[ií]\s+)*(?:decide|decidi[oó]|aprueba|aprob[oó]|autoriza|autoriz[oó]|firma|firm[oó]|valida|valid[oó])(?![A-Za-z0-9_áéíóúüñÁÉÍÓÚÜÑ])/i;
const EXCLUIR = /^tests\/(_procedencia-aprobacion|_respaldo-de-firma|_censo-firmas-autorizacion|_microcopy-aprobada|scrum387-|scrum921)/;
const marcas = marcasDe(RAIZ, { dirs: ['src', 'public', 'tests', 'scripts'], marca: MARCA, excluir: EXCLUIR, literalesTras: 45 });
const indice = indiceDeFuentes(RAIZ);
const ordinal = new Map();
const filas = [];
for (const b of marcas) {
  const t = loQueSeLee(b.texto, b.fichero);
  if (!MARCA.test(t)) continue;
  const i = ordinal.get(b.fichero) ?? 0;
  ordinal.set(b.fichero, i + 1);
  filas.push({ clave: `${b.fichero}#${i}`, donde: `${b.fichero}:${b.linea}`, nivel: respaldoDe({ ...b, texto: t }, indice).nivel });
}
const foto = { guard: { congeladas: guard.congeladas(), porNivel: guard.porNivel(), SIN_RESPALDO: guard.SIN_RESPALDO }, marcas: filas };
fs.writeFileSync(SALIDA, JSON.stringify(foto, null, 1));
const cuenta = {};
for (const f of filas) cuenta[f.nivel] = (cuenta[f.nivel] ?? 0) + 1;
console.log(`FOTO marcas=${marcas.length} afirman=${filas.length} fuentes=${indice.length} niveles=${JSON.stringify(cuenta)} · guard congeladas=${foto.guard.congeladas.length} porNivel=${JSON.stringify(foto.guard.porNivel)}`);
