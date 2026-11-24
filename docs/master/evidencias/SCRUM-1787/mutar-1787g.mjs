// docs/master/evidencias/SCRUM-1787/mutar-1787g.mjs — SCRUM-1787g · EL ROJO del guard de la ficha de factura.
//
// Uso (desde la raíz del árbol):  node docs/master/evidencias/SCRUM-1787/mutar-1787g.mjs
//
// `scripts/guard-ficha-de-factura.mjs` es un guard de navegador: no es un fichero de `node --test`, así
// que el catálogo `MUTACIONES_QUE_ME_TUMBAN` + `aplicarUna` (que juzga por NOMBRE de test) no lo puede
// mutar. Esto es la «Mutaciones: una vez → <guion>» de la A3: en git, repetible.
//
// Primero la BASE sin mutar (tiene que salir 0). Después, una a una, tres mutaciones —cada una imita
// el defecto que el guard promete cazar— y cada una tiene que dar salida 1 (hallazgo, no ciego) y
// nombrar lo suyo. Restaura en `finally` y comprueba los BYTES contra los originales de disco.
//
// Salidas: 0 las tres caen · 1 alguna NO cae (mudo) · 2 la base no sale verde o una mutación no aplica
// · 3 no se pudo restaurar un fichero (hay que mirar el árbol a mano).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const GUARD = path.join('scripts', 'guard-ficha-de-factura.mjs');
const CSS = 'public/dashboard/css/styles.css';
const VISTA = 'public/dashboard/js/invoiceDetailView.js';

// El bloque `@media` de SCRUM-1787e, entero: se quita y la tabla de conceptos vuelve a ser la de antes.
const MEDIA_1787E = /@media \(max-width: 640px\) \{\r?\n  \.j1-fac-conceptos thead \{ display:none; \}[\s\S]*?\r?\n\}\r?\n/;

export const MUTACIONES = [
  { id: 'sin el @media de 1787e (lo que había antes de #3300)', fichero: CSS, cambiar: (s) => s.replace(MEDIA_1787E, ''), espera: /movil → el dato \d de 5/ },
  { id: 'línea de progreso escondida', fichero: CSS, cambiar: (s) => s.replace('.j1-prog { display:flex;', '.j1-prog { display:none;'), espera: /la línea de progreso no se ve/ },
  { id: '«Siguiente paso» fuera de la ficha', fichero: VISTA, cambiar: (s) => s.replace("actionsSec.className = 'detail-next';", "actionsSec.className = 'detail-next-x';"), espera: /escritorio → el bloque «Siguiente paso» no se ve/ },
];

const correr = () => spawnSync(process.execPath, [GUARD], { cwd: RAIZ, encoding: 'utf8', timeout: 240_000 });

const base = correr();
console.log(`BASE sin mutar → salida ${base.status}`);
if (base.status !== 0) { console.error((base.stdout || '') + (base.stderr || '')); process.exit(2); }

let mudas = 0; let ciegas = 0;
for (const m of MUTACIONES) {
  const abs = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(abs);
  const mutado = m.cambiar(original.toString('utf8'));
  if (mutado === original.toString('utf8')) { console.error(`✖ ${m.id} → NO APLICA: el texto a mutar no está`); ciegas += 1; continue; }
  let r;
  try {
    fs.writeFileSync(abs, mutado);
    r = correr();
  } finally {
    fs.writeFileSync(abs, original);
    if (!fs.readFileSync(abs).equals(original)) { console.error(`☠ NO RESTAURADO: ${m.fichero}`); process.exit(3); }
  }
  const salida = (r.stdout || '') + (r.stderr || '');
  const cae = r.status === 1 && m.espera.test(salida);
  console.log(`${cae ? '✔ CAE ' : '✖ MUDA'} · ${m.id} → salida ${r.status}${cae ? '' : ' · no nombra ' + m.espera}`);
  if (cae) console.log('       ' + salida.split('\n').filter((l) => m.espera.test(l)).map((l) => l.trim()).join('\n       '));
  if (!cae) { mudas += 1; console.error(salida.split('\n').filter((l) => /·|→/.test(l)).slice(-6).join('\n')); }
}
console.log(`${MUTACIONES.length} mutaciones · ${MUTACIONES.length - mudas - ciegas} caen · ${mudas} mudas · ${ciegas} no aplican`);
process.exit(ciegas ? 2 : mudas ? 1 : 0);
