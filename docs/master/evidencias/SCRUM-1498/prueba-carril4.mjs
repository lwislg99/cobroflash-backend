import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const [W, T] = process.argv.slice(2);
for (const nombre of ['j3-prueba','jv-j3','jv-j3bc']) {
  const tr = `${T}/tr-${nombre}.jsonl`;
  fs.writeFileSync(tr, JSON.stringify({ type: 'agent-name', agentName: nombre }) + '\n');
  const entrada = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: `${W}/.github/workflows/ci.yml` }, transcript_path: tr, cwd: W });
  const h = spawnSync('node', ['.claude/hooks/carril.mjs'], { cwd: W, input: entrada, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: W } });
  console.log(`nombre ${nombre} -> salida ${h.status} · ${String(h.stderr).split('\n')[0].slice(0, 150)}`);
}
