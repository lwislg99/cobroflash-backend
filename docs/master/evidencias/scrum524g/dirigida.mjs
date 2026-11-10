// Corre los tests seleccionados por tests-que-cubren (lista en argv[2]) y deja el TAP en argv[3].
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const lista = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((l) => l.trim())
  .filter((l) => /^tests\/.+\.test\.mjs$/.test(l));
for (const f of lista) if (!fs.existsSync(f)) { console.error('NO EXISTE ' + f); process.exit(3); }
console.log(`# ficheros ${lista.length}`);
const env = { ...process.env };
delete env.FORCE_COLOR; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-concurrency=4',
  '--test-reporter=tap', `--test-reporter-destination=${process.argv[3]}`, ...lista],
  { stdio: 'inherit', env, maxBuffer: 1 << 28 });
console.log(`# node --test sale ${r.status}`);
process.exit(r.status ?? 9);
