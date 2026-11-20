// SCRUM-1725j · las CUATRO exigencias que cambiaron con el lavado, vistas en ROJO en cada instrumento
// que las lleva: los dos tests de la tanda y los dos guards de navegador.
//
// NO trae lista propia (guard SCRUM-1387): cada mutación es una de las que declaran los catálogos
// `MUTACIONES_QUE_ME_TUMBAN` de `tests/scrum1725j-lista-lavado.test.mjs` y de
// `tests/scrum1739-una-rellena-por-tarjeta.test.mjs`, leídas con `mutacionesDeclaradas` (el lector
// por AST del meta-guard) y elegidas por su línea `de`. El meta-guard ya comprueba que cada una
// tumba SU test; este guion mide ADEMÁS lo que el meta-guard no corre, los guards de navegador:
//
//   · scripts/guard-lista-trabajos-917.mjs      B.5 (solo «Sin importe») y C.2 (el «⋯» de EN CURSO)
//   · scripts/guard-escalera-por-estado.mjs     ① EN CURSO (la acción, por identidad, dentro del «⋯»)
//
// Mide la BASE sin mutar; después, por cada mutación: inyecta, mide los cuatro instrumentos y
// RESTAURA el fichero comprobándolo byte a byte. Lo que cada mutación TIENE que tumbar está escrito
// abajo, en `PLAN`; lo que tumbe de más se imprime y no decide.
// Uso, desde la raíz del repo:   node docs/master/evidencias/SCRUM-1725/c1725j-exigencias-mutacion.mjs
// Sale 0 si la base está verde y cada mutación tumba todo lo que su fila dice; 1 si algo no cae;
// 3 si quedó ciego o no pudo restaurar. La mutación NUNCA se commitea.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const T1725J = 'tests/scrum1725j-lista-lavado.test.mjs';
const T1739 = 'tests/scrum1739-una-rellena-por-tarjeta.test.mjs';

const INSTRUMENTOS = [
  { nombre: '1725j', args: ['--test', '--test-force-exit', '--test-reporter=tap', T1725J], ver: /^not ok|^# (tests|pass|fail) / },
  { nombre: '1739', args: ['--test', '--test-force-exit', '--test-reporter=tap', T1739], ver: /^not ok|^# (tests|pass|fail) / },
  { nombre: 'guard-917', args: ['scripts/guard-lista-trabajos-917.mjs'], ver: /🔴|NO SUPE|comprobaciones/ },
  { nombre: 'guard-escalera', args: ['scripts/guard-escalera-por-estado.mjs'], ver: /🔴|NO SUPE|^en_curso|veredicto/ },
];

// Qué exigencia imita cada mutación, de qué catálogo sale, y a quién TIENE que tumbar.
const PLAN = [
  { catalogo: T1725J, de: "    linea('jobs-importe-falta jobs-importe-sin', 'Sin importe');", que: 'b) vuelve la segunda frase bajo «Sin importe»', caeEn: ['1725j', 'guard-917'] },
  { catalogo: T1725J, de: '  if (escaleraAlMenu) menu.push(escaleraAlMenu);', que: 'c) y d) el albarán vuelve a la fila EN CURSO y sale del «⋯»', caeEn: ['1725j', 'guard-917', 'guard-escalera'] },
  { catalogo: T1725J, de: "  const tresPuntos = menu.length && typeof overflowMenu === 'function' ? overflowMenu(menu) : null;", que: 'c) el albarán sigue en el «⋯», pero el ÚLTIMO', caeEn: ['1725j', 'guard-917'] },
  { catalogo: T1725J, de: "    bSiguiente.dataset.accion = 'escalera';", que: 'd) la acción pierde su identidad data-accion="escalera"', caeEn: ['1725j', 'guard-escalera'] },
  { catalogo: T1739, de: '  celda.appendChild(bDetalle);', que: 'a) vuelven los dos órdenes: «Ver detalle» delante en un sin agendar', caeEn: ['1739'] },
];

const mutaciones = PLAN.map((fila) => {
  const suyas = mutacionesDeclaradas(fs.readFileSync(fila.catalogo, 'utf8'), fila.catalogo).filter((m) => m.de === fila.de);
  if (suyas.length !== 1) {
    console.error(`🔴 CIEGO: el catálogo de ${fila.catalogo} declara ${suyas.length} mutaciones sobre «${fila.de.trim()}» (esperaba 1).`);
    process.exit(3);
  }
  return { ...fila, ...suyas[0] };
});

const entorno = { ...process.env };
delete entorno.FORCE_COLOR;
const medir = (rotulo) => {
  console.log(`\n── ${rotulo} ──`);
  const salidas = {};
  for (const i of INSTRUMENTOS) {
    const r = spawnSync(process.execPath, i.args, { encoding: 'utf8', env: entorno });
    console.log(`${i.nombre} · exit ${r.status}`);
    ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).filter((l) => i.ver.test(l.trim())).forEach((l) => console.log('   ' + l.trim()));
    salidas[i.nombre] = r.status;
  }
  return salidas;
};

const base = medir('BASE (sin mutar)');
const baseVerde = INSTRUMENTOS.every((i) => base[i.nombre] === 0);
if (!baseVerde) {
  console.error(`\n🔴 la BASE no está verde (${JSON.stringify(base)}): sobre una base roja, un mutante que cae no dice nada. No inyecto.`);
  process.exit(1);
}

const filas = [];
for (const m of mutaciones) {
  const original = fs.readFileSync(m.fichero);
  const texto = original.toString('utf8');
  const veces = texto.split(m.de).length - 1;
  if (veces !== 1) {
    console.error(`🔴 CIEGO: «${m.de.trim()}» aparece ${veces} veces en ${m.fichero} (esperaba 1). No inyecto.`);
    process.exit(3);
  }
  let salidas = null;
  let restaurado = false;
  try {
    fs.writeFileSync(m.fichero, texto.replace(m.de, m.a));
    const aplicada = fs.readFileSync(m.fichero, 'utf8').includes(m.a);
    console.log(`\ninyección aplicada: ${aplicada ? 'SÍ' : 'NO'} (${m.fichero}, tomada del catálogo de ${m.catalogo})`);
    if (!aplicada) throw new Error('la inyección no se aplicó');
    salidas = medir(`MUTADO · ${m.que}`);
  } finally {
    fs.writeFileSync(m.fichero, original);
    restaurado = Buffer.compare(fs.readFileSync(m.fichero), original) === 0;
    console.log(`restaurado byte a byte: ${restaurado ? 'SÍ' : '🔴 NO'}`);
  }
  if (!restaurado) process.exit(3);
  // `null` es un instrumento que no llegó a salir: ciego, no «cayó».
  const ciegos = INSTRUMENTOS.filter((i) => salidas[i.nombre] === null).map((i) => i.nombre);
  if (ciegos.length) {
    console.error(`🔴 CIEGO: ${ciegos.join(', ')} no devolvió código de salida con la mutación «${m.que}».`);
    process.exit(3);
  }
  filas.push({ m, salidas });
}

console.log('\n══ VEREDICTO ══');
console.log(`base verde: ${INSTRUMENTOS.map((i) => `${i.nombre} ${base[i.nombre]}`).join(' · ')}`);
let faltan = 0;
for (const { m, salidas } of filas) {
  const cayeron = INSTRUMENTOS.filter((i) => salidas[i.nombre] !== 0).map((i) => i.nombre);
  const sinCaer = m.caeEn.filter((n) => !cayeron.includes(n));
  const deMas = cayeron.filter((n) => !m.caeEn.includes(n));
  faltan += sinCaer.length;
  console.log(`${sinCaer.length ? '🔴' : '✅'} ${m.que}`);
  console.log(`     tenía que tumbar: ${m.caeEn.join(', ')} · tumbó: ${cayeron.join(', ') || '(ninguno)'}${deMas.length ? ` · de más: ${deMas.join(', ')}` : ''}${sinCaer.length ? ` · 🔴 NO CAYÓ: ${sinCaer.join(', ')}` : ''}`);
}
const exigidas = mutaciones.reduce((a, m) => a + m.caeEn.length, 0);
console.log(`\npoblación: ${mutaciones.length} mutaciones × ${INSTRUMENTOS.length} instrumentos · ${exigidas} caídas exigidas · ${exigidas - faltan} vistas`);
process.exit(faltan ? 1 : 0);
