// j3a.mjs <dir de transcripts> — que herramienta escribio en scripts/equipo/ y que hooks dejaron rastro. Solo lectura.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
  const lineas = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean);
  const cuenta = { lineas: lineas.length };
  let cwd0 = null, nombre = null;
  const escrituras = [], hooks = {};
  for (const l of lineas) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (!cwd0 && o.cwd) cwd0 = o.cwd;
    if (o.type === 'agent-name') nombre = o.agentName ?? o.name ?? JSON.stringify(o).slice(0, 120);
    const h = o.hookName ?? o.hook_name ?? o.attachment?.hookName ?? o.attachment?.hookEvent;
    if (h) hooks[h] = (hooks[h] || 0) + 1;
    for (const c of o.message?.content ?? []) {
      if (c?.type !== 'tool_use') continue;
      cuenta[c.name] = (cuenta[c.name] || 0) + 1;
      const fp = c.input?.file_path;
      if (fp && /scripts[\\/]equipo[\\/]/.test(fp)) escrituras.push(`${o.timestamp} ${c.name} ${fp} (cwd ${o.cwd})`);
      const cmd = c.input?.command;
      if (cmd && /scripts\/equipo\/tabla|git mv|mv .*scripts\/equipo/.test(cmd)) escrituras.push(`${o.timestamp} ${c.name}: ${cmd.slice(0, 160)}`);
    }
  }
  console.log(`== ${f}\n   cwd inicial: ${cwd0} · nombre: ${nombre}\n   herramientas: ${JSON.stringify(cuenta)}\n   rastro de hooks: ${JSON.stringify(hooks)}`);
  for (const e of escrituras) console.log('   ' + e);
}
