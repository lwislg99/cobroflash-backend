// Precarga (--import) para medir QUÉ ficheros de test corren A LA VEZ: cada proceso apunta cuándo
// arranca y cuándo sale, en el fichero que diga MARCAS_876H (fuera del árbol). No toca nada más.
// El proceso padre de `node --test` también la carga: se le distingue porque su argv[1] no es un test.
import fs from 'node:fs';
import path from 'node:path';

const destino = process.env.MARCAS_876H;
const yo = process.argv[1] ? path.basename(process.argv[1]) : '(sin argv[1])';
if (destino && /\.test\.mjs$/.test(yo)) {
  const apunta = (que) => { try { fs.appendFileSync(destino, `${que}\t${Date.now()}\t${process.pid}\t${yo}\n`); } catch { /* medir no rompe al sujeto */ } };
  apunta('ARRANCA');
  process.on('exit', () => apunta('SALE'));
}
