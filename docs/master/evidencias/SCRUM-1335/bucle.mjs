// N pasadas del HIJO del trinquete con UN fichero, por zona; cuenta claves por pasada.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [,, raiz, fichero, nStr, dir] = process.argv;
const N = Number(nStr);
const hijo = path.join(raiz, 'scripts', '_trinquete-de-zona-hijo.mjs');
const lista = path.join(dir, 'lista.json');
fs.writeFileSync(lista, JSON.stringify([path.join(raiz, fichero)]));
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS; delete env.FORCE_COLOR;
for (const zona of ['Pacific/Kiritimati', 'Pacific/Midway']) {
  const hist = new Map(); let ciegos = 0;
  for (let i = 0; i < N; i++) {
    const dest = path.join(dir, 'm.json'); fs.rmSync(dest, { force: true });
    const r = spawnSync(process.execPath, [hijo, lista, dest, raiz], { cwd: raiz, env: { ...env, TZ: zona }, encoding: 'utf8' });
    let n = null; try { const j = JSON.parse(fs.readFileSync(dest, 'utf8')); n = j.zonaVista === zona ? j.veredictos.length : null; } catch {}
    if (n === null) { ciegos++; continue; }
    hist.set(n, (hist.get(n) || 0) + 1);
  }
  console.log(zona, '· pasadas', N, '· ciegas', ciegos, '· claves→veces', JSON.stringify([...hist].sort((a, b) => a[0] - b[0])));
}
