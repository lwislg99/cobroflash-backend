// docs/master/evidencias/SCRUM-1257e/mutar-tanda.mjs — EL ROJO PRIMERO del test de la tanda.
//
// Uso:  node docs/master/evidencias/SCRUM-1257e/mutar-tanda.mjs      (con `dist/` construido)
//
// Aplica las MUTACIONES_QUE_ME_TUMBAN de `tests/scrum1257e-modo-en-ajustes-tres-modos.test.mjs`
// contra ese mismo test, una a una, y comprueba que cae el caso que cada una nombra en `cae`: es lo
// que hace `npm run meta:mutaciones` sobre toda la casa, acotado a este fichero. Restaura por bytes.
// El hijo corre sin NODE_TEST_CONTEXT / NODE_OPTIONS / FORCE_COLOR: con ellos no ejecuta nada.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1257e-modo-en-ajustes-tres-modos.test.mjs';
const { mutacionesDeclaradas } = await import(pathToFileURL(path.join(RAIZ, 'scripts/meta-guard-mutaciones.mjs')).href);
const suyas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
console.log('declaradas: ' + suyas.length);
// El lector descarta EN SILENCIO una declaración que no sabe leer (una `a` concatenada): visto aquí.
if (suyas.length !== 4) { console.log('CIEGO: el test declara 4 mutaciones y el lector ve ' + suyas.length); process.exit(2); }
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let mal = 0;
for (const m of suyas) {
  const F = path.join(RAIZ, m.fichero);
  const orig = fs.readFileSync(F);
  const txt = orig.toString('utf8');
  if (txt.split(m.de).length !== 2) { console.log('ANCLA no unica: ' + m.cae); mal++; continue; }
  fs.writeFileSync(F, txt.replace(m.de, m.a));
  let r;
  try {
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
    r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, encoding: 'utf8', env });
  } finally { fs.writeFileSync(F, orig); }
  if (sha(fs.readFileSync(F)) !== sha(orig)) { console.log('NO RESTAURADO'); process.exit(3); }
  const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((x) => x[1]);
  const total = (r.stdout.match(/^# tests (\d+)/m) || [])[1];
  const ok = caidos.some((c) => c.includes(m.cae));
  if (!ok) mal++;
  console.log(`${ok ? 'OK ' : 'MAL'} cae «${m.cae}» · tests ${total} · caidos: ${JSON.stringify(caidos)}`);
}
process.exit(mal ? 1 : 0);
