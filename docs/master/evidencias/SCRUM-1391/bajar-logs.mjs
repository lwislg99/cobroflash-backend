// bajar-logs.mjs — SCRUM-1391 · baja los logs de CI sobre los que se midieron las distancias.
// Seis corridas de `main` del 1-oct-2026 (las seis que habían terminado al medir), dos jobs de cada
// una: el meta-guard y el obligatorio. Los logs NO están en git (10 MB); se rebajan por id.
//   node docs/master/evidencias/SCRUM-1391/bajar-logs.mjs <carpeta de destino, fuera del árbol>
// ⚠️ Sin `--allow-escape-sequences`, `gh api` se niega a escribir el log y deja un fichero de 0 bytes
// con salida 1: por eso cada bajada dice sus bytes, y 0 bytes es CIEGO.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DESTINO = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('uso: node bajar-logs.mjs <carpeta de destino>'); process.exit(2); }
fs.mkdirSync(DESTINO, { recursive: true });
// corrida · cabeza de main · job del meta-guard · job «build + tests (con banco desechable)»
const CORRIDAS = [
  ['36875190979', '7cf88466', '110413280648', '110413280454'],
  ['36879091133', '5fb7630a', '110426973175', '110426973276'],
  ['36880659605', '7580bcc8', '110434910722', '110434910882'],
  ['36883824732', '8c0bf728', '110442528066', '110442527616'],
  ['36886428643', '204d117b', '110450807409', '110450807387'],
  ['36886780786', 'cadf00bc', '110459324104', '110459324095'],
];
console.log('POBLACION: ' + CORRIDAS.length + ' corridas de main · ' + CORRIDAS.length * 2 + ' logs');
let ciegos = 0;
for (const [corrida, cabeza, meta, obligatorio] of CORRIDAS) {
  for (const [prefijo, job] of [['meta', meta], ['bt', obligatorio]]) {
    const destino = path.join(DESTINO, prefijo + '-' + corrida + '.log');
    let bytes = 0;
    try {
      const out = execFileSync('gh', ['api', '--allow-escape-sequences', 'repos/lwislg99/cobroflash-backend/actions/jobs/' + job + '/logs'], { maxBuffer: 256 * 1024 * 1024 });
      fs.writeFileSync(destino, out);
      bytes = out.length;
    } catch (e) { console.log('   ' + String(e.message).split('\n')[0].slice(0, 120)); }
    if (!bytes) ciegos += 1;
    console.log((bytes ? 'bajado ' : 'CIEGO  ') + path.basename(destino) + ' · ' + cabeza + ' · job ' + job + ' · ' + bytes + ' bytes');
  }
}
console.log('EXIT=' + (ciegos ? 2 : 0));
process.exit(ciegos ? 2 : 0);
