import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const [W, T] = process.argv.slice(2);
for (const nombre of ['j3-prueba', 'jv-j3']) {
  const tr = `${T}/tr-${nombre}.jsonl`;
  fs.writeFileSync(tr, JSON.stringify({ type: 'agent-name', agentName: nombre }) + '\n');
  const entrada = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: `${W}/scripts/equipo/tabla-ya-esta.mjs` }, transcript_path: tr, cwd: W });
  const h = spawnSync('node', ['.claude/hooks/carril.mjs'], { cwd: W, input: entrada, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: 'C:/Users/Javier Pereira/cobroflash-jv3' } });
  console.log(`nombre ${nombre} -> salida ${h.status} · ${String(h.stderr).split('\n')[0].slice(0, 150)}`);
}
