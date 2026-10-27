// docs/master/evidencias/scrum1502b/veredictos.mjs — SCRUM-1511
//
// LAS MARCAS ANCLADAS Y RASTREABLES, CON LO QUE CITAN, POR EL CAMINO DEL PROPIO TRINQUETE.
//
// El trinquete sólo exporta `congeladas()` y `porNivel()`. Para no escribir un segundo censo, este
// guion copia su fuente a una carpeta temporal, le reescribe los `import` relativos a rutas
// absolutas, le AÑADE una línea que exporta `veredictos`, y la importa. Es el mismo código; no se
// toca el fichero seguido. Control: los recuentos por nivel tienen que ser los de `porNivel()`.
//
// Uso:  node veredictos.mjs <carpeta temporal> <salida.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const [TMP, SALIDA] = process.argv.slice(2);
if (!TMP || !SALIDA) { console.error('uso: veredictos.mjs <tmp> <salida.json>'); process.exit(2); }

const ORIGEN = path.join(RAIZ, 'tests', 'scrum921c-firma-con-respaldo-en-codigo.test.mjs');
let fuente = fs.readFileSync(ORIGEN, 'utf8');
const abs = (r) => pathToFileURL(path.join(RAIZ, 'tests', r)).href;
let reescritos = 0;
fuente = fuente.replace(/from '(\.\/[^']+)'/g, (_, r) => { reescritos += 1; return `from '${abs(r)}'`; });
if (reescritos !== 3) { console.error(`🔴 esperaba reescribir 3 import relativos y fueron ${reescritos}`); process.exit(1); }
fuente = fuente.replace("path.resolve(import.meta.dirname, '..')", JSON.stringify(RAIZ));
fuente += '\nexport { veredictos };\n';
const copia = path.join(TMP, 'copia-del-trinquete.mjs');
fs.writeFileSync(copia, fuente);
const m = await import(pathToFileURL(copia).href);

const v = m.veredictos();
const niveles = m.porNivel();
const cuenta = {};
for (const x of v) cuenta[x.respaldo.nivel] = (cuenta[x.respaldo.nivel] || 0) + 1;
for (const n of ['anclado', 'rastreable', 'documental', 'sin-respaldo']) {
  if ((cuenta[n] || 0) !== (niveles[n] || 0)) { console.error(`🔴 ${n}: ${cuenta[n]} aquí, ${niveles[n]} en porNivel()`); process.exit(1); }
}
const RE_ANCLA = /SCRUM-(\d+)\s*[·,—-]?\s*comentario\s+(\d{3,})/gi;
const filas = v.filter((x) => ['anclado', 'rastreable'].includes(x.respaldo.nivel)).map((x) => ({
  donde: x.donde, nivel: x.respaldo.nivel, texto: x.texto,
  anclas: [...x.texto.matchAll(RE_ANCLA)].map((a) => `SCRUM-${a[1]} comentario ${a[2]}`),
  tickets: [...new Set([...x.texto.matchAll(/SCRUM-(\d+)/gi)].map((a) => `SCRUM-${a[1]}`))],
  docs: [...new Set([...x.texto.matchAll(/docs\/[\w./-]+/g)].map((a) => a[0]))],
}));
fs.writeFileSync(SALIDA, JSON.stringify({ niveles, filas }, null, 1));
const r = filas.filter((f) => f.nivel === 'rastreable');
console.log(`POBLACION anclado=${cuenta.anclado} rastreable=${cuenta.rastreable} (porNivel coincide)`);
console.log(`rastreables: con ticket=${r.filter((f) => f.tickets.length).length} · sólo docs/=${r.filter((f) => !f.tickets.length).length} · tickets distintos=${new Set(r.flatMap((f) => f.tickets)).size}`);
for (const f of filas.filter((x) => x.nivel === 'anclado')) console.log(`${f.donde}\t${f.anclas.join(' | ')}`);
