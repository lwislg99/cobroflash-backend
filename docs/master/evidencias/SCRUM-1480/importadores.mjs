// Para cada fichero pedido de scripts/: quién lo importa (AST) en scripts/, tests/ y .claude/hooks/.
// Uso: node importadores.mjs <raíz> <lista>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const [raiz, lista] = process.argv.slice(2);
const ts = createRequire(path.join(raiz, 'package.json'))('typescript');
const todos = execFileSync('git', ['-C', raiz, 'ls-files', '-z', 'scripts', 'tests', '.claude/hooks'], { encoding: 'utf8', maxBuffer: 1 << 27 }).split('\0').filter((f) => /\.(mjs|cjs|js|ts)$/.test(f));
const set = new Set(todos);
const quien = new Map();
let leidos = 0;
for (const f of todos) {
  const info = ts.preProcessFile(readFileSync(path.join(raiz, f), 'utf8'), true, true); leidos++;
  for (const imp of info.importedFiles) {
    if (!imp.fileName.startsWith('.')) continue;
    const d = path.posix.normalize(path.posix.join(path.posix.dirname(f), imp.fileName));
    const c = [d, d + '.mjs', d + '.js'].find((x) => set.has(x));
    if (c) { if (!quien.has(c)) quien.set(c, []); quien.get(c).push(f); }
  }
}
const pedidos = readFileSync(lista, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
console.log(`POBLACIÓN · ${leidos} ficheros leídos por AST (scripts/, tests/, .claude/hooks/) · ${pedidos.length} pedidos`);
console.log(`CONTROL · scripts/_suelo-de-la-tanda.mjs lo importa scripts/suelo-de-la-tanda.mjs: ${(quien.get('scripts/_suelo-de-la-tanda.mjs') ?? []).includes('scripts/suelo-de-la-tanda.mjs') ? 'SÍ' : 'NO → CIEGO'}`);
for (const p of pedidos) {
  const q = quien.get(p) ?? [];
  const sc = q.filter((x) => x.startsWith('scripts/'));
  const te = q.filter((x) => x.startsWith('tests/'));
  console.log(`${String(q.length).padStart(3)} importadores (scripts ${sc.length}, tests ${te.length}) · ${p}${sc.length && sc.length <= 4 ? '  ← ' + sc.map((x) => x.replace('scripts/', '')).join(', ') : ''}`);
}
console.log('EXIT=0');
