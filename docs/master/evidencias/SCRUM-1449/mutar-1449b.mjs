// mutar-1449b.mjs — SCRUM-1449b · cada pieza del arreglo, quitada de una en una, tiene que tumbar el test.
// Uso (desde la raíz del repo, con el TypeScript del checkout al que cuelga este árbol):
//   node docs/master/evidencias/SCRUM-1449/mutar-1449b.mjs <ruta a typescript/bin/tsc>
//
// La lista NO vive aquí: es `MUTACIONES_QUE_ME_TUMBAN` del test, leída por AST con
// `mutacionesDeclaradas` del meta-guard (SCRUM-1387: el catálogo de la casa es el destino obligatorio).
// Esto sólo la ejecuta en local y deja la salida al lado; la red que la corre es `npm run meta:mutaciones`.
// Muta el fuente, compila con --noCheck, corre el test y RESTAURA en `finally`.
// Primero la BASE sin mutar (A3): si la base no sale verde, todo es CIEGO.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const TSC = process.argv[2];
const TEST = 'tests/scrum1449b-la-pagina-de-mercado-pago.test.mjs';
const MUTANTES = mutacionesDeclaradas(readFileSync(TEST, 'utf8'), TEST);
if (!MUTANTES.length) { console.log('CIEGO: el test no declara ninguna mutación'); process.exit(2); }
const ficheros = [...new Set(MUTANTES.map((m) => m.fichero))];
const originales = new Map(ficheros.map((f) => [f, readFileSync(f, 'utf8')]));
const entorno = { ...process.env }; delete entorno.NODE_TEST_CONTEXT; delete entorno.NODE_OPTIONS;

function correr() {
  const c = spawnSync(process.execPath, [TSC, '--noCheck', '-p', '.'], { encoding: 'utf8', env: entorno });
  if (c.status !== 0) return { veredicto: 'CIEGO (no compila)' };
  const t = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST], { encoding: 'utf8', env: entorno });
  const n = (k) => Number((new RegExp(`^# ${k} (\\d+)$`, 'm').exec(t.stdout) || [])[1]);
  const total = n('tests'), pass = n('pass'), fail = n('fail');
  if (!(total > 0) || pass + fail !== total) return { veredicto: `CIEGO (tests=${total} pass=${pass} fail=${fail})` };
  const caidos = [...t.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { veredicto: fail ? 'ROJO' : 'VERDE', total, pass, fail, caidos };
}

const filas = [];
try {
  const base = correr();
  filas.push(['BASE sin mutar', base, null]);
  if (base.veredicto !== 'VERDE') throw new Error('la base no sale verde: todo lo demás sería CIEGO');
  for (const m of MUTANTES) {
    const original = originales.get(m.fichero);
    const veces = original.split(m.de).length - 1;
    const nombre = `${m.fichero} · «${m.de.slice(0, 50).replace(/\n/g, '⏎')}»`;
    if (veces !== 1) { filas.push([nombre, { veredicto: `CIEGO (el trozo aparece ${veces} veces)` }, m.cae]); continue; }
    writeFileSync(m.fichero, original.replace(m.de, m.a));
    const r = correr();
    writeFileSync(m.fichero, original);
    // Cae el que DECLARA, no otro cualquiera: el `cae` es subcadena del nombre real del test.
    if (r.veredicto === 'ROJO' && !r.caidos.some((c) => c.includes(m.cae))) r.veredicto = 'OTRO';
    filas.push([nombre, r, m.cae]);
  }
} finally {
  for (const [f, o] of originales) writeFileSync(f, o);
  spawnSync(process.execPath, [TSC, '--noCheck', '-p', '.'], { env: entorno });
}
for (const [nombre, r, cae] of filas) {
  console.log(`${r.veredicto.padEnd(8)} · ${nombre}${r.total ? ` · ${r.fail}/${r.total} caen` : ''}${cae ? ` · declara que cae «${cae}»` : ''}`);
}
const vivos = filas.slice(1).filter(([, r]) => r.veredicto !== 'ROJO').length;
const restaurado = [...originales].every(([f, o]) => readFileSync(f, 'utf8') === o);
console.log(`POBLACION: ${MUTANTES.length} mutantes declarados + base · vivos, ciegos u otro = ${vivos} · restaurado = ${restaurado}`);
process.exit(vivos || !restaurado ? 1 : 0);
