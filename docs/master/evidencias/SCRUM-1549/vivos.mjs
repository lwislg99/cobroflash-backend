// Identidad que carril.mjs calcularía AHORA para cada sesión viva (claude agents --json). Sólo lee.
// Uso: claude agents --json > <tmp>/agents.json && node docs/master/evidencias/SCRUM-1549/vivos.mjs "$PWD" <tmp>/agents.json
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const [REPO, AGENTES] = process.argv.slice(2);
const { identidad } = await import(pathToFileURL(path.join(REPO, '.claude/hooks/carril.mjs')).href);
const proyectos = path.join(os.homedir(), '.claude', 'projects');
const carpetas = fs.readdirSync(proyectos).map((d) => path.join(proyectos, d));
for (const a of JSON.parse(fs.readFileSync(AGENTES, 'utf8'))) {
  const jsonl = carpetas.map((c) => path.join(c, `${a.sessionId}.jsonl`)).find((f) => fs.existsSync(f)) ?? null;
  const id = identidad({ proyecto: a.cwd, transcript: jsonl });
  const exigir = id.carpetaRota || !id.puesto ? 'CAERÍA' : 'pasa';
  console.log(`${a.name} | ${a.kind} | transcript ${jsonl ? 'sí' : 'NO'} | nombre-transcript «${id.nombre}» | carpeta ${id.carpeta} | porNombre ${id.porNombre} | puesto ${id.puesto} | con --exigir-identidad: ${exigir}`);
}
