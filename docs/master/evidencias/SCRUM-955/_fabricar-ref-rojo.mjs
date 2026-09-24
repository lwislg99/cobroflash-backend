// Script DESECHABLE, solo para la prueba en ROJO del censo (no forma parte del expediente).
// Lee tests/verifactu.test.mjs de origin/main, le quita el vector oficial de la AEAT, y escribe
// el resultado a un fichero temporal para construir un blob/commit fabricado con git plumbing.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const repo = process.argv[2];
const outPath = process.argv[3];
const vector = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
const content = execFileSync('git', ['-C', repo, 'show', 'origin/main:tests/verifactu.test.mjs'], { encoding: 'utf8' });
if (!content.includes(vector)) {
  console.error('VECTOR NO ENCONTRADO — el fabricado no probaría nada');
  process.exit(1);
}
const modificado = content.split(vector).join('VECTOR_BORRADO_PARA_PRUEBA_ROJA_SCRUM955');
fs.writeFileSync(outPath, modificado, 'utf8');
console.log('escrito:', outPath, 'bytes:', modificado.length);
