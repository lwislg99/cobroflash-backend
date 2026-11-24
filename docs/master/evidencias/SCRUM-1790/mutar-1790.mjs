// docs/master/evidencias/SCRUM-1790/mutar-1790.mjs — la mutación de SCRUM-1790, repetible.
//
// Uso:  node docs/master/evidencias/SCRUM-1790/mutar-1790.mjs
//
// El rojo de SCRUM-1790 vive en un guion de navegador (`aviso-pegado-al-borde.mjs`), sin nombre de
// test: el catálogo `MUTACIONES_QUE_ME_TUMBAN` + `aplicarUna` (que juzga por NOMBRE) no lo puede
// mutar (A10, SCRUM-1787g). Esto es la «Mutaciones: una vez → <guion>» de la A3: en git, repetible.
//
// Primero la BASE sin mutar (tiene que salir 0). Después se quita la línea del arreglo y el guion
// tiene que salir 1 (hallazgo, no ciego) nombrando el aviso fuera de la pantalla. Restaura en
// `finally` y compara los BYTES con el original leído de disco.
//
// Salidas: 0 la mutación cae · 1 NO cae (mudo) · 2 la base no sale verde o la mutación no aplica
// · 3 no se pudo restaurar el fichero (hay que mirar el árbol a mano).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..', '..', '..');
const FICHERO = path.join(RAIZ, 'public', 'dashboard', 'js', 'settingsView.js');
const GUION = path.join(AQUI, 'aviso-pegado-al-borde.mjs');
const LINEA = 'caja.scrollIntoView({ block: "nearest", behavior: "instant" });';

function correr() {
  const r = spawnSync(process.execPath, [GUION], { cwd: RAIZ, encoding: 'utf8', timeout: 180000 });
  return { codigo: r.status, salida: (r.stdout || '') + (r.stderr || '') };
}

const base = correr();
console.log(`  BASE sin mutar → salida ${base.codigo}`);
if (base.codigo !== 0) { console.error(base.salida); process.exit(2); }

const ORIGINAL = fs.readFileSync(FICHERO);
const texto = ORIGINAL.toString('utf8');
const veces = texto.split(LINEA).length - 1;
if (veces !== 1) { console.error(`  🔴 la línea del arreglo aparece ${veces} veces (se esperaba 1): no se muta nada`); process.exit(2); }

let mutada;
try {
  fs.writeFileSync(FICHERO, texto.replace(LINEA, '/* MUTACIÓN SCRUM-1790: sin desplazar la caja */'));
  mutada = correr();
} finally {
  fs.writeFileSync(FICHERO, ORIGINAL);
  if (Buffer.compare(fs.readFileSync(FICHERO), ORIGINAL) !== 0) {
    console.error('  🔴 NO SE PUDO RESTAURAR settingsView.js: mira el árbol a mano');
    process.exit(3);
  }
}
console.log(`  MUTADA (sin la línea del arreglo) → salida ${mutada.codigo}`);
const nombra = /el aviso queda fuera de la pantalla/.test(mutada.salida);
console.log(`  restaurado: bytes idénticos · nombra «el aviso queda fuera de la pantalla»: ${nombra ? 'sí' : 'NO'}`);
if (mutada.codigo === 1 && nombra) { console.log('  ✔ la mutación cae'); process.exit(0); }
console.error(mutada.salida);
process.exit(mutada.codigo === 2 ? 2 : 1);
