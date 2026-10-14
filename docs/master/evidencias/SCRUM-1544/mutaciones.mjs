// docs/master/evidencias/SCRUM-1544/mutaciones.mjs — SCRUM-1544
//
// Cinco mutaciones de UNA sustitución, declaradas con el código ya quieto (después del commit de
// la feature), sobre `tests/_censo-por-posicion.mjs` y `tests/scrum710b-…test.mjs`. Cada una dice
// ANTES de correr qué caso tiene que caer. Primero la BASE sin mutar. Se restaura escribiendo el
// contenido original, y al final se comprueba por CONTENIDO (sha256) que el árbol quedó igual.
//
// Uso: node docs/master/evidencias/SCRUM-1544/mutaciones.mjs      (requiere árbol limpio)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CENSO = 'tests/_censo-por-posicion.mjs';
const GUARD = 'tests/scrum710b-anclaje-por-identidad.test.mjs';
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, f))).digest('hex');

const MUTACIONES = [
  { nombre: 'el censo deja de leer el join', fichero: CENSO,
    de: "&& n.expression.name.text === 'join' && n.arguments.length === 1",
    a: "&& n.expression.name.text === 'join' && n.arguments.length === 99",
    cae: 'una cita TROCEADA con todas sus piezas escritas' },
  { nombre: 'un número escrito pasa a ser un hueco', fichero: CENSO,
    de: 'if (ts.isNumericLiteral(n)) return n.text;',
    a: 'if (ts.isNumericLiteral(n)) return HUECO;',
    cae: 'una cita TROCEADA con todas sus piezas escritas' },
  { nombre: 'un nombre se lee como si fuera el número (el censo «aprende» constantes)', fichero: CENSO,
    de: '  resto.push(n);\n  return HUECO;\n}',
    a: "  resto.push(n);\n  return ts.isIdentifier(n) ? '12' : HUECO;\n}",
    cae: 'EL LÍMITE: con una pieza en un nombre' },
  { nombre: 'el literal con la cita entera se cuenta dos veces', fichero: CENSO,
    de: '    resto.push(n);\n    return HUECO;\n  }\n  if (ts.isNumericLiteral(n))',
    a: '    resto.push(n);\n    return n.text;\n  }\n  if (ts.isNumericLiteral(n))',
    cae: 'los anclajes por NÚMERO DE LÍNEA no crecen' },
  { nombre: 'se retira de la lista uno de los tres que el censo no veía', fichero: GUARD,
    de: "  ['tests/scrum398-vocabulario-de-cobro.test.mjs  reports.routes.ts', 1],\n",
    a: '',
    cae: 'los anclajes por NÚMERO DE LÍNEA no crecen' },
];

function corre() {
  const tap = path.join(os.tmpdir(), `scrum1544-mut-${process.pid}.tap`);
  fs.rmSync(tap, { force: true });
  const env = { ...process.env };
  for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete env[k];
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, GUARD],
    { cwd: RAIZ, env, encoding: 'utf8' });
  const t = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  fs.rmSync(tap, { force: true });
  const casos = t.split(/\r?\n/).filter((l) => /^(not ok|ok) \d+ - /.test(l));
  return { exit: r.status, total: casos.length, caidos: casos.filter((l) => l.startsWith('not ok')).map((l) => l.replace(/^not ok \d+ - /, '')) };
}

const antes = { [CENSO]: sha(CENSO), [GUARD]: sha(GUARD) };
const base = corre();
console.log(`BASE sin mutar · exit ${base.exit} · ${base.total} casos · caen ${base.caidos.length}`);
if (base.exit !== 0 || base.total === 0) { console.log('🔴 CIEGO: la base no está en verde o no dio casos. EXIT=2'); process.exit(2); }

let mal = 0;
for (const m of MUTACIONES) {
  const ruta = path.join(RAIZ, m.fichero);
  const original = fs.readFileSync(ruta, 'utf8');
  const veces = original.split(m.de).length - 1;
  if (veces !== 1) { console.log(`🔴 CIEGA «${m.nombre}»: el texto a mutar aparece ${veces} veces, no 1`); mal++; continue; }
  let r;
  try {
    fs.writeFileSync(ruta, original.replace(m.de, m.a));
    const aplicada = fs.readFileSync(ruta, 'utf8') !== original;
    r = corre();
    r.aplicada = aplicada;
  } finally { fs.writeFileSync(ruta, original); }
  const esperado = r.caidos.some((c) => c.includes(m.cae));
  const veredicto = !r.aplicada ? 'CIEGA (no se aplicó)' : r.total !== base.total ? `CIEGA (${r.total} casos, la base dio ${base.total})`
    : esperado ? 'MUERE donde se dijo' : r.caidos.length ? 'muere, pero NO donde se dijo' : 'VIVA';
  if (veredicto !== 'MUERE donde se dijo') mal++;
  console.log(`${veredicto} · «${m.nombre}» · ${m.fichero} · exit ${r.exit} · caen ${r.caidos.length} de ${r.total}`
    + ` · se esperaba «${m.cae}»`);
  for (const c of r.caidos) console.log(`      cae: ${c}`);
}
const igual = sha(CENSO) === antes[CENSO] && sha(GUARD) === antes[GUARD];
console.log(`árbol tras las mutaciones: ${igual ? 'IGUAL por sha256 en los dos ficheros' : '🔴 DISTINTO'}`);
console.log(`mutaciones: ${MUTACIONES.length} · como se dijo: ${MUTACIONES.length - mal} · EXIT=${mal || !igual ? 1 : 0}`);
process.exit(mal || !igual ? 1 : 0);
