// Muta SOLO el compilado (dist/, que git ignora): quita la guarda de «ya sellada» de applyVeriFactu,
// o la restaura. No toca src/.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [, , raiz, orden] = process.argv;
const f = `${raiz}/dist/modules/invoicing/domain/verifactu.service.js`;
const copia = `${f}.original-1507`;
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
if (orden === 'mutar') {
  if (!existsSync(copia)) copyFileSync(f, copia);
  const antes = readFileSync(copia, 'utf8');
  const patron = 'if (yaSellada?.vfHash) {';
  const veces = antes.split(patron).length - 1;
  console.log('ocurrencias del patron:', veces);
  if (veces !== 1) { console.log('CIEGO: se esperaba 1'); process.exit(2); }
  writeFileSync(f, antes.replace(patron, 'if (false) {'));
  console.log('mutado', sha(copia), '->', sha(f));
} else if (orden === 'restaurar') {
  copyFileSync(copia, f);
  console.log('restaurado', sha(f), 'igual que la copia', sha(copia), sha(f) === sha(copia));
} else { console.log('orden desconocida'); process.exit(2); }
