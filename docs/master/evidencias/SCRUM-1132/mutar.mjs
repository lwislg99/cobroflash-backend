// docs/master/evidencias/SCRUM-1132/mutar.mjs — EL ROJO de la pestaña «Notas», en la tanda Y en navegador.
//
// Uso (desde la raíz, con `dist/` compilado):  node docs/master/evidencias/SCRUM-1132/mutar.mjs
//
// SIN LISTA PROPIA (SCRUM-1387). Las mutaciones son las MUTACIONES_QUE_ME_TUMBAN de
// `tests/scrum1132-notas-en-la-ficha.test.mjs`, leídas con el lector del meta-guard (por AST, sin
// ejecutar el test). `npm run meta:mutaciones` las aplica contra ese test; esto las aplica contra el
// test (tiene que caer el caso de su `cae`) y contra `guard:notas-en-la-ficha` (tiene que salir 1), una
// cada vez, y RESTAURA el fichero por bytes (sha256 antes = sha256 después, o sale con 3).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1132-notas-en-la-ficha.test.mjs';
const GUARD = 'scripts/guard-notas-en-la-ficha.mjs';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const correr = (args) => spawnSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8', timeout: 240000 });

const suyas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
if (suyas.length !== 8) { console.log(`CIEGO: esperaba las 8 mutaciones de ${TEST} y leo ${suyas.length}`); process.exit(2); }

// BASE sin mutar: los dos en verde, o no hay nada que medir.
const baseTest = correr(['--test', TEST]);
const baseGuard = correr([GUARD]);
console.log(`base · test salida ${baseTest.status} · guard salida ${baseGuard.status}`);
if (baseTest.status !== 0 || baseGuard.status !== 0) { console.log('CIEGO: la base no está en verde'); process.exit(2); }

let mal = 0;
for (const m of suyas) {
  const ruta = path.join(RAIZ, m.fichero);
  const antes = fs.readFileSync(ruta);
  const texto = antes.toString('utf8');
  if (!texto.includes(m.de)) { console.log(`CIEGO · ${m.a.slice(0, 40)} · el texto a mutar no está en ${m.fichero}`); mal++; continue; }
  let t;
  let g;
  try {
    fs.writeFileSync(ruta, texto.replace(m.de, m.a));
    t = correr(['--test', '--test-reporter=spec', TEST]);
    g = correr([GUARD]);
  } finally {
    fs.writeFileSync(ruta, antes);
    if (sha(fs.readFileSync(ruta)) !== sha(antes)) { console.log(`🔴 NO SE RESTAURÓ ${m.fichero}`); process.exit(3); }
  }
  const salidaTest = (t.stdout || '') + (t.stderr || '');
  const caeEnTest = t.status !== 0 && salidaTest.split('\n').some((l) => /^\s*✖/.test(l) && l.includes(m.cae));
  const caeEnGuard = g.status === 1;
  if (!caeEnTest || !caeEnGuard) mal++;
  console.log(`${caeEnTest && caeEnGuard ? 'OK ' : 'MAL'} · ${m.fichero} · «${m.de.trim().slice(0, 50)}» · test ${caeEnTest ? 'cae' : 'NO cae'} (${t.status}) · guard ${caeEnGuard ? 'cae' : 'NO cae'} (${g.status})`);
}
console.log(`MAL ${mal} de ${suyas.length}`);
process.exit(mal ? 1 : 0);
