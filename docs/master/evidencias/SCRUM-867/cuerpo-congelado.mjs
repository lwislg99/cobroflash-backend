// docs/master/evidencias/SCRUM-867/cuerpo-congelado.mjs — SCRUM-867
//
//   node docs/master/evidencias/SCRUM-867/cuerpo-congelado.mjs    (desde la raíz, árbol limpio)
//
// 🔴 POR QUÉ EXISTE. El control que decidía SCRUM-600b era: «la PÁGINA emite EXACTAMENTE lo mismo
// que el MODAL», byte a byte. Al retirar el modal, ese control se queda sin comparador — y es la
// prueba de que reutilizar la pantalla no cambió el camino de emisión (regla 38). No se borra: se
// CONGELA. Pero una constante congelada sólo vale si está MEDIDA, no recordada.
//
// Esto la mide: restaura del árbol de ANTES (`77ce9d1e`, la base de esta rama) el modal, el
// `<script>` del índice y la línea del banco; emite con LAS DOS pantallas con la misma entrada;
// compara los dos cuerpos; y vuelve a dejar el árbol como estaba, verificándolo byte a byte.
//
// Cada medición corre en un proceso aparte: Node cachea los módulos, y aquí los ficheros cambian
// entre una y otra.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const ANTES = '77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb';   // origin/main al partir la rama
const MODAL_REL = 'public/dashboard/js/nuevaFacturaModal.js';
const TOCADOS = ['public/dashboard/index.html', 'tests/_banco-vistas.mjs'];
const AYUDANTE = path.join(RAIZ, 'docs', 'master', 'evidencias', 'SCRUM-867', '_emite.mjs');

const abs = (rel) => path.join(RAIZ, rel);
const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
const AHORA = new Map(TOCADOS.map((rel) => [rel, fs.readFileSync(abs(rel))]));

function emitirCon(quien) {
  try {
    const salida = execFileSync(process.execPath, [AYUDANTE, quien], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = salida.match(/^CUERPO=(.*)$/m);
    return m ? m[1] : `🔴 sin cuerpo · ${salida.trim().split('\n').slice(-3).join(' | ')}`;
  } catch (e) {
    return `🔴 no midió · ${String(e.stdout || '').trim().split('\n').slice(-2).join(' | ')}`;
  }
}

function restaurar() {
  for (const [rel, bytes] of AHORA) fs.writeFileSync(abs(rel), bytes);
  if (fs.existsSync(abs(MODAL_REL))) fs.unlinkSync(abs(MODAL_REL));
  const igual = [...AHORA].every(([rel, bytes]) => Buffer.compare(fs.readFileSync(abs(rel)), bytes) === 0);
  return igual && !fs.existsSync(abs(MODAL_REL));
}

let cuerpoPagina = '';
let cuerpoModal = '';
try {
  // ① CON EL ÁRBOL DE HOY (el modal ya retirado): lo que emite la página.
  cuerpoPagina = emitirCon('pagina');
  console.log(`① página, árbol de hoy:\n   ${cuerpoPagina}`);

  // ② CON EL ÁRBOL DE ANTES: el modal vuelve, y se le pide lo mismo.
  for (const rel of [...TOCADOS, MODAL_REL]) fs.writeFileSync(abs(rel), git('show', `${ANTES}:${rel}`));
  cuerpoModal = emitirCon('modal');
  const cuerpoPaginaAntes = emitirCon('pagina');
  console.log(`② modal, árbol de ${ANTES.slice(0, 8)}:\n   ${cuerpoModal}`);
  console.log(`   (y la página, en ese mismo árbol: ${cuerpoPaginaAntes})`);
} finally {
  const limpio = restaurar();
  console.log(`\nárbol restaurado byte a byte: ${limpio ? 'sí' : '🔴 NO'}`);
  if (!limpio) process.exit(3);
}

const iguales = cuerpoPagina === cuerpoModal && !cuerpoPagina.startsWith('🔴');
console.log(iguales
  ? `\n✅ EL CUERPO CONGELADO ES EL DEL MODAL, medido:\n   ${cuerpoPagina}`
  : `\n🔴 los dos cuerpos NO coinciden — no se puede congelar nada:\n   página: ${cuerpoPagina}\n   modal : ${cuerpoModal}`);
process.exit(iguales ? 0 : 1);
