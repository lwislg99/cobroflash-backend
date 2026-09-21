// SONDA · qué escribe por stdout el HIJO de node:test para scrum859, mensaje a mensaje y con su tamaño.
// Reproduce el hijo que lanza run() (NODE_TEST_CONTEXT=child-v8 + --test-force-exit + --test-timeout),
// pero con stdout a FICHERO (escritura síncrona: aquí no se pierde nada) para ver el flujo ENTERO.
// Uso: node sonda-bytes.mjs <raiz-del-arbol> <etiqueta>
import { spawnSync } from 'node:child_process';
import { readFileSync, openSync, closeSync, writeFileSync } from 'node:fs';
import v8 from 'node:v8';
import path from 'node:path';
const RAIZ = process.argv[2];
const ETQ = process.argv[3] || 'x';
const T = process.env.J6_908C_DIR || '.'; // directorio de trabajo del banco (fuera del árbol)
const salida = `${T}/sonda-${ETQ}.bin`;
const fd = openSync(salida, 'w');
const env = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, NODE_TEST_CONTEXT: 'child-v8' };
const r = spawnSync(process.execPath, ['--test-force-exit', '--test-timeout=300000',
  path.join(RAIZ, 'tests', 'scrum859-identidad-y-motivo-cerrado.test.mjs')],
{ cwd: RAIZ, env, stdio: ['ignore', fd, 'pipe'], encoding: 'utf8' });
closeSync(fd);
const buf = readFileSync(salida);
const s = new v8.Serializer(); s.writeHeader(); const H = s.releaseBuffer().length; const HS = 4 + H;
const msgs = [];
let i = 0; let basura = 0;
while (i + HS <= buf.length) {
  const size = buf.readUInt32BE(i + H);
  const fin = i + HS + size;
  if (fin > buf.length) break;
  const d = new v8.Deserializer(buf.subarray(i + HS, fin)); d.readHeader();
  let ev; try { ev = d.readValue(); } catch { basura++; }
  msgs.push({ off: i, bytes: HS + size, type: ev?.type, name: ev?.data?.name, nesting: ev?.data?.nesting });
  i = fin;
}
console.log(`POBLACION bytes-stdout=${buf.length} mensajes=${msgs.length} sobrante=${buf.length - i} basura=${basura} status=${r.status}`);
const utiles = msgs.filter((m) => m.type === 'test:pass' || m.type === 'test:fail');
console.log(`test:pass=${utiles.filter((m) => m.type === 'test:pass').length} test:fail=${utiles.filter((m) => m.type === 'test:fail').length}`);
let acum = 0;
for (const m of msgs) {
  acum += m.bytes;
  if (m.type === 'test:pass' || m.type === 'test:fail' || m.bytes > 4096)
    console.log(`${String(m.off).padStart(8)} ${String(m.bytes).padStart(7)}B acum=${String(acum).padStart(7)} ${m.type} ${String(m.name).slice(0, 90)}`);
}
const tipos = {};
for (const m of msgs) tipos[m.type] = (tipos[m.type] || 0) + m.bytes;
console.log('bytes por tipo:', JSON.stringify(tipos));
writeFileSync(`${T}/sonda-${ETQ}.json`, JSON.stringify(msgs, null, 1));
console.log('EXIT=0');
