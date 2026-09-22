// Cuenta bytes de control (todos menos TAB, LF, CR; y DEL) por fichero. Control positivo: un
// fichero fabricado con un NUL tiene que dar 1, y uno limpio 0 — si no, el contador está ciego.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const contar = (b) => { let n = 0; for (const x of b) if ((x < 32 && x !== 9 && x !== 10 && x !== 13) || x === 127) n++; return n; };
const d = mkdtempSync(path.join(os.tmpdir(), 'j6-ctl-'));
try {
  writeFileSync(path.join(d, 'con.txt'), Buffer.from([97, 0, 98, 10]));
  writeFileSync(path.join(d, 'sin.txt'), 'a\tb\r\n');
  const pos = contar(readFileSync(path.join(d, 'con.txt'))); const neg = contar(readFileSync(path.join(d, 'sin.txt')));
  console.log(`CONTROL fabricado: con-NUL=${pos} (debe 1) · limpio=${neg} (debe 0) → ${pos === 1 && neg === 0 ? 'OK' : 'CIEGO'}`);
} finally { rmSync(d, { recursive: true, force: true }); }
const raiz = process.argv[2];
const ficheros = process.argv.slice(3);
console.log(`POBLACION ficheros=${ficheros.length} raiz=${raiz}`);
for (const f of ficheros) {
  const b = readFileSync(path.join(raiz, f));
  const nul = b.filter((x) => x === 0).length;
  console.log(`${f} bytes=${b.length} control=${contar(b)} NUL=${nul}`);
}
console.log('EXIT=0');
