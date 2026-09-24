// docs/master/evidencias/scrum951a/mutar.mjs — SCRUM-951a · las mutaciones declaradas, una a una
//
//   node docs/master/evidencias/scrum951a/mutar.mjs tests/<fichero>.test.mjs
//
// Lo que hace `meta:mutaciones` para UN fichero (aquél tarda más de una hora para todos):
//   0 · BASE: corre el test sin mutar. Si no sale verde, PARA: sin base, un inestable parece un
//       mutante muerto.
//   1 · por cada entrada de MUTACIONES_QUE_ME_TUMBAN: exige que `de` aparezca UNA vez, aplica `a`,
//       corre el test y exige ver «✖ <cae>» (el test que la declaración dice que cae, y no otro);
//   2 · restaura el fichero byte a byte y lo COMPRUEBA (mismo contenido que antes de mutar).
// Declara su población: cuántas mutaciones leyó y cuántas cayeron. Sale con 0 solo si cayeron todas.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const test = process.argv[2];
if (!test) { console.error('uso: node mutar.mjs tests/<fichero>.test.mjs'); process.exit(2); }

const env = { ...process.env };
delete env.FORCE_COLOR;
delete env.NODE_TEST_CONTEXT;
const correr = () => spawnSync(process.execPath, ['--test', '--test-reporter=spec', test], { cwd: RAIZ, encoding: 'utf8', env });

const { MUTACIONES_QUE_ME_TUMBAN: muts } = await import(pathToFileURL(path.join(RAIZ, test)).href);
if (!Array.isArray(muts) || muts.length === 0) { console.log('NO-PUDE-MIRAR: el fichero no declara mutaciones'); process.exit(2); }

const base = correr();
if (base.status !== 0) { console.log(`NO-PUDE-MIRAR: la BASE no sale verde (salida ${base.status})`); process.exit(2); }
console.log(`BASE verde · ${muts.length} mutaciones declaradas`);

let caidas = 0;
for (const [i, m] of muts.entries()) {
  const f = path.join(RAIZ, m.fichero);
  const antes = fs.readFileSync(f);
  const texto = antes.toString('utf8');
  const veces = texto.split(m.de).length - 1;
  if (veces !== 1) { console.log(`#${i + 1} CIEGA: «de» aparece ${veces} veces en ${m.fichero}`); continue; }
  fs.writeFileSync(f, texto.replace(m.de, m.a));
  let r;
  try { r = correr(); } finally { fs.writeFileSync(f, antes); }
  if (!fs.readFileSync(f).equals(antes)) { console.log(`#${i + 1} 🔴 NO SE RESTAURÓ ${m.fichero}: PARO`); process.exit(2); }
  const vista = (r.stdout || '').split('\n').some((l) => l.startsWith('✖ ') && l.includes(m.cae));
  console.log(`#${i + 1} ${vista && r.status !== 0 ? 'CAE' : 'VIVE'} · ${m.fichero} · «${m.cae}»`);
  if (vista && r.status !== 0) caidas += 1;
}
console.log(`${caidas} de ${muts.length} cayeron`);
process.exit(caidas === muts.length ? 0 : 1);
