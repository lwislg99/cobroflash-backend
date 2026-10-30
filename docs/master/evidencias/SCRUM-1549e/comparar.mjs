// Compara byte a byte la copia instalada con origin/main, como lo hace puertaDeIntegridad.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const [repo, instalada, ruta = 'scripts/equipo/sesion.mjs'] = process.argv.slice(2);
const main = execFileSync('git', ['-C', repo, 'show', `origin/main:${ruta}`], { maxBuffer: 1 << 26 });
const propio = fs.readFileSync(instalada);
const h = (b) => crypto.createHash('sha256').update(b).digest('hex');
const blob = (b) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
console.log(JSON.stringify({
  main: { bytes: main.length, sha256: h(main), blob: blob(main) },
  instalada: { bytes: propio.length, sha256: h(propio), blob: blob(propio), mtime: fs.statSync(instalada).mtime },
  identicas: main.equals(propio),
}, null, 1));
