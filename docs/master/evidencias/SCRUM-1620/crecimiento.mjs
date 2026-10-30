// Declaraciones del censo del meta-guard en `origin/main` en varias fechas, con el lector del meta-guard.
// Un `git archive` por fecha (un solo proceso), extraído en un temporal, y el lector sobre sus tests/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const raiz = process.cwd();
const m = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
for (const fecha of process.argv.slice(2)) {
  const sha = execFileSync('git', ['rev-list', '-1', `--before=${fecha}`, 'origin/main'], { encoding: 'utf8' }).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-'));
  try {
    const tar = path.join(dir, 't.tar');
    execFileSync('git', ['archive', '-o', tar, sha, 'tests/']);
    // `tar` de Git lee `C:` como un host remoto: se extrae con ruta relativa desde el propio temporal.
    execFileSync('tar', ['-xf', 't.tar'], { cwd: dir });
    const c = m.censoConPoblacion(path.join(dir, 'tests'));
    const decl = c.censo.reduce((n, x) => n + x.mutaciones.length, 0);
    console.log(`${fecha} · ${sha.slice(0, 9)} · ${c.poblacion} ficheros · ${c.declarantes} declarantes · ${decl} declaraciones`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
