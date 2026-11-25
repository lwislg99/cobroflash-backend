// SCRUM-1778b: aplica en docs/YAQU_MASTER.md:660 el literal A firmado (SCRUM-1778 c.22238),
// COPIADO del bloque ```text de §2 del fichero de evidencia, no tecleado.
// Uso: node aplica1778b.mjs <raiz-del-arbol>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const raiz = process.argv[2];
const ev = fs.readFileSync(path.join(raiz, 'docs/master/evidencias/SCRUM-1778/1778a-literal-propuesto.md'), 'utf8');
const masterPath = path.join(raiz, 'docs/YAQU_MASTER.md');
const buf = fs.readFileSync(masterPath);
const master = buf.toString('utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fallo = (m) => { console.error('PARA: ' + m); process.exit(1); };

// Bloques ```text ... ``` de la evidencia: [0] = ANTES (§1), [1] = A (§2), [2] = B (§3).
const bloques = [...ev.matchAll(/```text\n([^\n]*)\n```/g)].map((m) => m[1]);
if (bloques.length !== 3) fallo(`esperaba 3 bloques text en la evidencia, hay ${bloques.length}`);
const [antesEv, literalA] = bloques;
if (!ev.split('## 2 ·')[1].includes(literalA)) fallo('el bloque A no esta en §2');

if (master.includes('\r')) fallo('el master trae CR');
const lineas = master.split('\n');
const l660 = lineas[659];
if (sha(l660 + '\n') !== 'a17ded309bfcc495ee7680a6c413194d84ba2bd550ed439ba34e3e95ae6c3454') fallo('sha256 de la 660 no es el de §1');
if (l660 !== antesEv) fallo('la 660 no es el ANTES de §1');

const fraseVieja = "Modelo: `Attachment {entityType, entityId, url, kind:'photo'|'audio', createdAt}`.";
if (l660.split(fraseVieja).length !== 2) fallo('la frase vieja no aparece exactamente una vez en la 660');

// Unica adaptacion (encargo; medida en el registro): 1005b esta en main desde #3262.
const clausulaVieja = 'el código lo cumplirá con SCRUM-1005b: hasta entonces solo se escriben `photo` y `audio`';
const clausulaNueva = 'el código lo cumple desde SCRUM-1005b (20-nov-2026)';
const marcaFecha = '<fecha de la firma>';
if (literalA.split(clausulaVieja).length !== 2) fallo('la clausula 1005b no aparece una vez en A');
if (literalA.split(marcaFecha).length !== 2) fallo('<fecha de la firma> no aparece una vez en A');
const literalFinal = literalA.replace(clausulaVieja, clausulaNueva).replace(marcaFecha, '20-nov-2026');

const nueva = l660.replace(fraseVieja, literalFinal);
lineas[659] = nueva;
const salida = lineas.join('\n');
fs.writeFileSync(masterPath, salida, 'utf8');

const despues = salida.split('\n');
let distintas = 0;
for (let i = 0; i < Math.max(lineas.length, despues.length); i++) if (master.split('\n')[i] !== despues[i]) distintas++;
console.log(JSON.stringify({
  lineasAntes: master.split('\n').length, lineasDespues: despues.length, lineasDistintas: distintas,
  bytesAntes: buf.length, bytesDespues: Buffer.byteLength(salida), crDespues: (salida.match(/\r/g) || []).length,
  sha660Despues: sha(nueva + '\n'), prefijoIgual: nueva.startsWith(l660.split(fraseVieja)[0]),
  sufijoIgual: nueva.endsWith(l660.split(fraseVieja)[1]),
}, null, 1));
