// scripts/verificacion-s5/intentar-pasar-la-puerta.mjs — SCRUM-842 · carril de VERIFICACIÓN
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// REVISIÓN ADVERSARIA DE LA PUERTA QUE DESPIERTA AL ROBOT. NO LA ARREGLA: INTENTA PASARLA.
//
// `claude.yml` lleva `allowed_bots: "yaqu-bot[bot]"`, y esa línea DESACTIVA la comprobación de
// permisos que la acción hace por defecto. Lo único que queda entre un comentario y un robot con
// `contents: write` sobre este repositorio PÚBLICO es `decidir()` de `puerta-avisador-rojo.mjs`.
// Lo escribió y lo probó la misma sesión, así que aquí se prueba desde fuera y en contra.
//
// ⛔ REGLA 9: esto REPORTA, no arregla. Lo que haya que cambiar lo cambia la Sesión 5.
//
// ── EL SUELO, Y ES LA MITAD QUE DECIDE ───────────────────────────────────────────────────────
// 🔴 «Ningún intento ha pasado» no vale por sí solo: puede significar que la puerta es buena o
// que mis intentos son malos, y las dos cosas se escriben igual. Por eso el mismo juego se lanza
// contra una PUERTA SEMBRADA FLOJA a propósito —una que trate «sin dato» como «no es fork» y que
// ignore el permiso—. Si mis intentos tampoco la pasan a ella, no miden nada y hay que decirlo.
//
//     🔒 Un cero de un instrumento que no ha demostrado saber decir «aquí hay uno» es «no he
//        mirado», no «no hay nada».
//
// USO: node scripts/verificacion-s5/intentar-pasar-la-puerta.mjs
// ═════════════════════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { decidir } = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'puerta-avisador-rojo.mjs')).href);

const BOT = 'yaqu-bot[bot]';
const ok = { repoBase: 'lwislg99/cobroflash-backend', repoOrigen: 'lwislg99/cobroflash-backend' };

/**
 * Los INTENTOS. Cada uno es «a ver si consigo que despierte», y cada uno ataca un eje distinto:
 * el estado del CI, la procedencia del PR, el permiso del autor y la marca de idempotencia.
 * Los que llevan `null`/`''` son la pregunta que de verdad importa: **¿falla cerrado o abierto
 * cuando el dato no llega?** — que es como fallan las integraciones de verdad, no con un «no».
 */
const INTENTOS = [
  ['CI vacío', { ...ok, conclusionCI: '', autor: BOT, permisoAutor: 'write', marcaActual: 'm' }],
  ['CI unknown', { ...ok, conclusionCI: 'unknown', autor: BOT, permisoAutor: 'write', marcaActual: 'm' }],
  ['CI null', { ...ok, conclusionCI: null, autor: BOT, permisoAutor: 'write', marcaActual: 'm' }],
  ['fork declarado', { conclusionCI: 'failure', repoBase: 'lwislg99/cobroflash-backend', repoOrigen: 'ajeno/cobroflash-backend', autor: BOT, permisoAutor: 'write', marcaActual: 'm' }],
  ['fork con repo null', { conclusionCI: 'failure', repoBase: 'lwislg99/cobroflash-backend', repoOrigen: null, autor: BOT, permisoAutor: 'write', marcaActual: 'm' }],
  ['fork sin repoBase', { conclusionCI: 'failure', repoBase: null, repoOrigen: 'lwislg99/cobroflash-backend', autor: BOT, permisoAutor: 'write', marcaActual: 'm' }],
  ['permiso vacío', { ...ok, conclusionCI: 'failure', autor: 'ajeno', permisoAutor: '', marcaActual: 'm' }],
  ['permiso unknown', { ...ok, conclusionCI: 'failure', autor: 'ajeno', permisoAutor: 'unknown', marcaActual: 'm' }],
  ['permiso read', { ...ok, conclusionCI: 'failure', autor: 'ajeno', permisoAutor: 'read', marcaActual: 'm' }],
  // 🔴 El nombre del bot SIN los corchetes: es el error de comparación más fácil de cometer.
  ['bot imitado (sin [bot])', { ...ok, conclusionCI: 'failure', autor: 'yaqu-bot', permisoAutor: 'none', marcaActual: 'm' }],
  ['sin marca', { ...ok, conclusionCI: 'failure', autor: BOT, permisoAutor: 'write', marcaActual: '' }],
];

/** La puerta SEMBRADA FLOJA. No es la de nadie: existe para calibrar los intentos. */
const floja = (e = {}) => {
  if (e.conclusionCI === 'success') return { avisar: false, codigo: 'VERDE' };
  // El descuido clásico: «sin dato» se lee como «no es fork» en vez de como fork.
  if (e.repoBase && e.repoOrigen && e.repoBase !== e.repoOrigen) return { avisar: false, codigo: 'FORK' };
  return { avisar: true, codigo: 'AVISA' };
};

const correr = (puerta) => INTENTOS.map(([n, e]) => ({ n, r: puerta(e) }));

console.log('CONTRA LA PUERTA REAL (`decidir` de puerta-avisador-rojo.mjs):');
const real = correr(decidir);
for (const { n, r } of real) {
  console.log(`  ${r.avisar ? '🔴 PASA   ' : 'cerrado  '}${n.padEnd(24)}${r.avisar ? '' : '→ ' + r.codigo}`);
}
const pasanReal = real.filter((x) => x.r.avisar);
console.log(`  intentos que PASAN: ${pasanReal.length} de ${INTENTOS.length}`);

console.log('\nSUELO · contra una puerta SEMBRADA FLOJA (sin dato = no es fork, permiso ignorado):');
const pasanFloja = correr(floja).filter((x) => x.r.avisar);
console.log(`  intentos que PASAN: ${pasanFloja.length} de ${INTENTOS.length}`);
console.log(`  la pasan por: ${pasanFloja.slice(0, 5).map((x) => x.n).join(' · ')}`);

console.log('');
if (pasanFloja.length === 0) {
  console.log('🔴 CIEGO: mis intentos no pasan ni una puerta floja. No miden nada, y el resultado');
  console.log('   de arriba no significa «la puerta es buena»: significa «no he sabido probarla».');
  process.exit(2);
}
console.log(pasanReal.length === 0
  ? '✅ La puerta real cierra los ' + INTENTOS.length + ' intentos, y el cero está MEDIDO: los mismos'
    + '\n   intentos pasan ' + pasanFloja.length + ' veces contra una puerta floja.'
  : '🔴 HALLAZGO: ' + pasanReal.length + ' intento(s) despiertan al robot. Ver arriba.');
