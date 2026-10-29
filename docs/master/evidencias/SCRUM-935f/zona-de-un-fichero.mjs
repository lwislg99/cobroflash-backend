// Mide UN fichero de test en las dos zonas del trinquete con su propia maquinaria
// (`medirEnZona` + `compararZonas`), y dice si cambia de veredicto.
//   node zona-de-un-fichero.mjs <raiz> <tests/fichero.test.mjs>
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [raiz, rel] = process.argv.slice(2);
const T = await import(pathToFileURL(path.join(raiz, 'scripts/_trinquete-de-zona.mjs')).href);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zona1-'));
try {
  const ficheros = [path.join(raiz, rel)];
  const medidas = T.ZONAS.map((zona) => T.medirEnZona({ zona, ficheros, raiz, salida: path.join(dir, `${zona.replace(/\W/g, '_')}.json`) }));
  for (const m of medidas) console.log(`  ${m.zona ?? ''} ok=${m.ok} pruebas=${m.veredictos?.size} zonaVista=${m.zonaVista} ${m.porque ?? ''}`);
  const r = medidas.every((m) => m.ok) ? T.compararZonas(medidas) : null;
  if (!r) {
    console.log('NO SE PUDO MEDIR');
    process.exitCode = 2;
  } else {
    console.log(`CAMBIAN DE VEREDICTO: ${r.cambian.length} · sin comparar: ${r.sinComparar.length}`);
    for (const c of r.cambian) console.log(`  🔴 ${c.prueba}\n     ${c.porZona.map((p) => `${p.zona} → ${p.veredicto}`).join('  ·  ')}`);
  }
} finally {
  // El borrado va en `finally`: si `medirEnZona` lanza, la carpeta no se queda en TMPDIR.
  fs.rmSync(dir, { recursive: true, force: true });
}
