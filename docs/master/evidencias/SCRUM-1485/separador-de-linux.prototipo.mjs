// PROTOTIPO (SCRUM-1485, no está en el repo): hace que en Windows `path` y compañía devuelvan rutas con «/»,
// como en el CI. Se carga con `node --import <este fichero> --test <test>`.
// NO es Linux: sólo cambia el SEPARADOR de lo que devuelven estas funciones. Ni mayúsculas, ni permisos,
// ni finales de línea, ni `import.meta.dirname`, ni lo que devuelve `fs.readdirSync({ recursive })`.
import path from 'node:path';
import url from 'node:url';
import os from 'node:os';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

if (path.sep === '\\') {
  const aBarra = (s) => (typeof s === 'string' ? s.replace(/\\/g, '/') : s);
  let dentro = 0;
  const envuelve = (obj, nombres) => {
    for (const n of nombres) {
      const original = obj[n];
      if (typeof original !== 'function') continue;
      // Las funciones de `path` se llaman entre sí POR EL OBJETO (relative → resolve): la de dentro tiene
      // que ver «\», o la cuenta sale mal («..C:/Users/…», medido). Sólo se convierte la llamada de fuera.
      obj[n] = function envuelta(...a) {
        if (dentro) return original.apply(this, a);
        dentro++;
        try { return aBarra(original.apply(this, a)); } finally { dentro--; }
      };
      for (const k of Object.keys(original)) obj[n][k] = original[k];
      Object.defineProperty(obj[n], 'name', { value: n });
    }
  };
  envuelve(path, ['join', 'relative', 'resolve', 'normalize', 'dirname', 'format']);
  envuelve(url, ['fileURLToPath']);
  envuelve(os, ['tmpdir', 'homedir']);
  envuelve(fs, ['mkdtempSync', 'realpathSync']);
  const cwd = process.cwd.bind(process);
  process.cwd = () => aBarra(cwd());
  path.sep = '/';
  syncBuiltinESMExports();
  process.stderr.write('# separador-de-linux: ACTIVO (path.sep = «/»)\n');
} else {
  process.stderr.write('# separador-de-linux: esta máquina ya usa «/»; no hace nada\n');
}
