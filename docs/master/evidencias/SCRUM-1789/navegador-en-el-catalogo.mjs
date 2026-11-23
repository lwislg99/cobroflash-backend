// docs/master/evidencias/SCRUM-1789/navegador-en-el-catalogo.mjs — SCRUM-1789c · EL JUICIO QUE LE FALTA
// al meta-guard para un guard de navegador, probado FUERA del meta-guard (que es de S3) y sobre el
// guard real `scripts/guard-ficha-de-factura.mjs`.
//
// Uso (desde la raíz del árbol):  node docs/master/evidencias/SCRUM-1789/navegador-en-el-catalogo.mjs
//
// Lo que mide, en este orden:
//   ① LO DE HOY: `correr()` del meta-guard (lo importa, no lo copia) sobre dos guards sembrados FUERA
//     del árbol, uno que sale 1 (hallazgo) y otro que sale 2 (CIEGO). Hoy los dos salen como UN caso
//     «caído» con el nombre del fichero: el catálogo no los distingue, y una declaración con
//     `cae: '<nombre del fichero>'` contaría un CIEGO como VIVA.
//   ② LA PROPUESTA: `resultadoDeNavegador` + `juicioDeNavegador`, tal cual irían al driver. Salida 0 →
//     base verde; salida 1 → cada línea de la salida es un «caído» (así `cae` es el texto del
//     hallazgo, como en `mutar-1787g.mjs`); salida ≥ 2 o sin código → CIEGO, nunca caído.
//   ③ ROJO PRIMERO sobre el guard real: la BASE sin mutar (tiene que salir 0), la mutación que el
//     guard declararía (tiene que salir VIVA), una mutación INOCUA sobre la misma ancla (tiene que
//     salir MUDA) y el guard sembrado que sale 2 (tiene que salir CIEGO).
//
// Restaura en `finally` y comprueba los BYTES contra los originales de disco.
// Salidas: 0 los cuatro veredictos son los esperados · 1 alguno no · 2 la base no sale 0 o un ancla
// no está · 3 no se pudo restaurar un fichero (hay que mirar el árbol a mano).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const { correr, cayo } = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'meta-guard-mutaciones.mjs')).href);

// ── ② LA PROPUESTA (lo que iría a scripts/meta-guard-mutaciones.mjs) ──────────────────────────────
export const esGuardDeNavegador = (g) => /^scripts[\\/]guard-[^\\/]+\.mjs$/.test(g);
export function resultadoDeNavegador({ status, stdout = '', stderr = '' }) {
  const lineas = `${stdout}\n${stderr}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const vacio = { pasados: [], caidos: [], saltados: [], errores: {} };
  if (status === 0) return { ...vacio, codigo: 0, pasados: ['(salida 0)'] };
  if (status === 1) return { ...vacio, codigo: 1, caidos: lineas };
  return { ...vacio, codigo: status, ciegoDelGuard: `salió ${status ?? 'sin código (plazo o señal)'}: NO SUPO MEDIR` };
}
export function juicioDeNavegador(tras, cae) {
  if (tras.ciegoDelGuard) return { veredicto: 'CIEGO', por: tras.ciegoDelGuard };
  if (tras.codigo === 0) return { veredicto: 'MUDO', por: 'salió 0 con la mutación puesta' };
  return cayo(tras, cae)
    ? { veredicto: 'VIVO', por: tras.caidos.find((l) => l.includes(cae)) }
    : { veredicto: 'MUDO', por: `salió 1, pero ninguna línea nombra «${cae}»` };
}
const correrNavegador = (guard) => resultadoDeNavegador(
  spawnSync(process.execPath, [path.join(RAIZ, guard)], { cwd: RAIZ, encoding: 'utf8', timeout: 300_000 }));

// ── ① LO DE HOY ────────────────────────────────────────────────────────────────────────────────────
// El helper de la casa lo borra al salir el proceso, salga como salga (scrum864c).
const { temporal } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_temporal.mjs')).href);
const dirSembrado = temporal('scrum1789c-');
const sembrado = (n, cod, txt) => {
  const f = path.join(dirSembrado, `guard-${n}.mjs`);
  fs.writeFileSync(f, `console.error(${JSON.stringify(txt)}); process.exit(${cod});\n`);
  return f;
};
const fRojo = sembrado('rojo', 1, '· la línea de progreso no se ve: sembrado');
const fCiego = sembrado('ciego', 2, 'NO SUPE MEDIR: sembrado');
const hoyRojo = await correr(fRojo);
const hoyCiego = await correr(fCiego);
const igualesHoy = hoyRojo.caidos.length === 1 && hoyCiego.caidos.length === 1
  && cayo(hoyRojo, 'guard-rojo.mjs') && cayo(hoyCiego, 'guard-ciego.mjs')
  && !cayo(hoyRojo, 'la línea de progreso no se ve');
console.log(`① HOY, correr() del meta-guard: salida 1 → caídos ${JSON.stringify(hoyRojo.caidos.map((c) => path.basename(c)))} · `
  + `salida 2 → caídos ${JSON.stringify(hoyCiego.caidos.map((c) => path.basename(c)))} · `
  + `${igualesHoy ? 'INDISTINGUIBLES (y el texto del hallazgo no llega)' : 'distintos: la premisa ya no se cumple'}`);

// ── ③ ROJO PRIMERO, sobre el guard real ───────────────────────────────────────────────────────────
const GUARD = 'scripts/guard-ficha-de-factura.mjs';
if (!esGuardDeNavegador(GUARD) || esGuardDeNavegador('tests/scrum1.test.mjs')) { console.error('✖ esGuardDeNavegador no separa'); process.exit(2); }
const CSS = 'public/dashboard/css/styles.css';
const ANCLA = '.j1-prog { display:flex;';
const CASOS = [
  { id: 'declarada (línea de progreso escondida)', de: ANCLA, a: '.j1-prog { display:none;', cae: 'la línea de progreso no se ve', espera: 'VIVO' },
  { id: 'inocua (un espacio más en la misma regla)', de: ANCLA, a: '.j1-prog {  display:flex;', cae: 'la línea de progreso no se ve', espera: 'MUDO' },
];

const base = correrNavegador(GUARD);
console.log(`③ BASE sin mutar → salida ${base.codigo}`);
if (base.codigo !== 0) { console.error(base.ciegoDelGuard || base.caidos.slice(-6).join('\n')); process.exit(2); }

let malos = 0;
const abs = path.join(RAIZ, CSS);
for (const c of CASOS) {
  const original = fs.readFileSync(abs);
  const texto = original.toString('utf8');
  if (texto.split(c.de).length !== 2) { console.error(`✖ ${c.id}: el ancla no está UNA vez en ${CSS}`); process.exit(2); }
  let tras;
  try {
    fs.writeFileSync(abs, texto.replace(c.de, c.a));
    tras = correrNavegador(GUARD);
  } finally {
    fs.writeFileSync(abs, original);
    if (!fs.readFileSync(abs).equals(original)) { console.error(`☠ NO RESTAURADO: ${CSS}`); process.exit(3); }
  }
  const j = juicioDeNavegador(tras, c.cae);
  const bien = j.veredicto === c.espera;
  if (!bien) malos += 1;
  console.log(`   ${bien ? '✔' : '✖'} ${c.id} → salida ${tras.codigo} · ${j.veredicto} (esperado ${c.espera}) · ${j.por}`);
}
const jCiego = juicioDeNavegador(resultadoDeNavegador(spawnSync(process.execPath, [fCiego], { encoding: 'utf8' })), 'la línea de progreso no se ve');
const bienCiego = jCiego.veredicto === 'CIEGO';
if (!bienCiego) malos += 1;
console.log(`   ${bienCiego ? '✔' : '✖'} sembrado que sale 2 → ${jCiego.veredicto} (esperado CIEGO) · ${jCiego.por}`);
if (!igualesHoy) malos += 1;
console.log(`${CASOS.length + 2} comprobaciones · ${malos} distintas de lo esperado`);
process.exit(malos ? 1 : 0);
