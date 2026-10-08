// docs/master/evidencias/scrum1502b/sujetos-de-control.mjs — SCRUM-1502, tramo 2
//
// LOS DOS SUJETOS DE CONTROL DEL ESPÍA. Se corren ANTES que el sujeto de verdad.
//
//   node --import ./espia.mjs sujetos-de-control.mjs quieto   → tiene que dar CERO salidas
//   node --import ./espia.mjs sujetos-de-control.mjs sale     → tiene que dar las CINCO puertas
//
// «quieto» lee un fichero y nada más: si el espía le apunta una salida, el espía inventa.
// «sale» intenta salir por cada puerta (a un puerto cerrado de la propia máquina, a un nombre que
// no existe y a un proceso de node que acaba solo): si el espía no las ve, es ciego y su cero
// sobre el sujeto de verdad no vale nada.
import fs from 'node:fs';
import net from 'node:net';
import dns from 'node:dns';
import https from 'node:https';
import { spawnSync } from 'node:child_process';

const modo = process.argv[2];
fs.readFileSync(import.meta.filename, 'utf8');
const calla = (f) => { try { f(); } catch { /* con ESPIA_BLOQUEA lanza: es lo esperado */ } };

if (modo === 'sale') {
  calla(() => { const s = net.connect(9, '127.0.0.1'); s.on('error', () => {}); s.destroy(); });
  calla(() => dns.lookup('no-existe.invalid', () => {}));
  calla(() => { const r = https.request('https://no-existe.invalid/'); r.on('error', () => {}); r.destroy(); });
  calla(() => { fetch('https://no-existe.invalid/').catch(() => {}); });
  calla(() => spawnSync(process.execPath, ['-e', '0']));
  calla(() => process.env.JIRA_TOKEN_DE_CONTROL);
} else if (modo !== 'quieto') {
  console.error('modo: quieto | sale'); process.exit(2);
}
setTimeout(() => process.exit(0), 300);
