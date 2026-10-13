// prueba-carril.mjs — le da al hook de carril de main EXACTAMENTE la escritura de J3a y mira si la habria parado.
// No escribe nada en ningun arbol: el hook solo lee. Control: la misma escritura en su carpeta de evidencias.
import { spawnSync } from 'node:child_process';
const W = 'C:\\Users\\Javier Pereira\\cobroflash-backend\\.claude\\worktrees\\j3-censo-tablero-07oct';
const T = 'C:\\Users\\Javier Pereira\\.claude\\projects\\C--Users-Javier-Pereira-cobroflash-backend--claude-worktrees-j3-censo-tablero-07oct\\cc648ac4-e326-4329-941f-d9c2659596c3.jsonl';
const casos = [
  ['la escritura real de J3a (scripts/equipo/)', `${W}\\scripts\\equipo\\tabla-ya-esta.mjs`],
  ['control: donde acabo (docs/master/evidencias/)', `${W}\\docs\\master\\evidencias\\SCRUM-1496\\tabla-ya-esta.mjs`],
];
for (const [nombre, fichero] of casos) {
  const entrada = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: fichero }, transcript_path: T, cwd: W });
  const env = { ...process.env, CLAUDE_PROJECT_DIR: 'C:\\Users\\Javier Pereira\\cobroflash-jv3' };
  const r = spawnSync('node', ['.claude/hooks/carril.mjs'], { cwd: W, input: entrada, encoding: 'utf8', env });
  console.log(`== ${nombre}\n   salida=${r.status}\n   ${(r.stderr || '(sin mensaje)').trim().split('\n').join('\n   ')}`);
}
