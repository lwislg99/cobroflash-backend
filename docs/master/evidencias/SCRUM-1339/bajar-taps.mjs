#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/bajar-taps.mjs
//
// Baja los artefactos `tanda-tap` (el TAP de «build + tests», que el CI sube SIEMPRE desde
// SCRUM-695, con 7 días de retención) y deja uno por run en <destino>/<run_id>-<artifact_id>.tap.
// SOLO LECTURA contra GitHub: no relanza nada, no toca ningún workflow.
//
//   node bajar-taps.mjs <carpeta destino>
//
// Deja además <destino>/artefactos.tsv con la POBLACIÓN: cuántos lista GitHub, cuántos caducados,
// cuántos bajados y cuántos fallidos. Un cero bajado no es «no hay»: es que no supe mirar.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import zlib from 'node:zlib';

const REPO = 'lwislg99/cobroflash-backend';
const destino = process.argv[2];
if (!destino) { console.error('uso: node bajar-taps.mjs <carpeta destino>'); process.exit(2); }
fs.mkdirSync(destino, { recursive: true });

const gh = (args, opciones = {}) => execFileSync('gh', args, { maxBuffer: 256 * 1024 * 1024, ...opciones });

// ── ① la lista, paginada ────────────────────────────────────────────────────────────────────
const artefactos = [];
let total = null;
for (let pagina = 1; pagina < 100; pagina++) {
  const r = JSON.parse(gh(['api', `repos/${REPO}/actions/artifacts?name=tanda-tap&per_page=100&page=${pagina}`]).toString('utf8'));
  total = r.total_count;
  if (!r.artifacts.length) break;
  for (const a of r.artifacts) {
    artefactos.push({
      id: a.id, bytes: a.size_in_bytes, caducado: a.expired, creado: a.created_at,
      run: a.workflow_run?.id, sha: a.workflow_run?.head_sha, rama: a.workflow_run?.head_branch,
    });
  }
  if (artefactos.length >= total) break;
}
console.log(`POBLACION: GitHub dice ${total} artefactos tanda-tap · listados ${artefactos.length} · caducados ${artefactos.filter((a) => a.caducado).length}`);

// ── ② un zip de UN fichero, descomprimido sin dependencias ─────────────────────────────────
// Se lee el directorio central (el final del zip), no la cabecera local: con el bit 3 puesto, la
// cabecera local lleva los tamaños a cero y `unzip` a mano se queda con un fichero vacío.
function descomprimir(zip) {
  let fin = -1;
  for (let i = zip.length - 22; i >= 0; i--) if (zip.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('zip sin fin de directorio central');
  const entradas = zip.readUInt16LE(fin + 10);
  if (entradas !== 1) throw new Error(`zip con ${entradas} entradas, esperaba 1`);
  const dc = zip.readUInt32LE(fin + 16);
  if (zip.readUInt32LE(dc) !== 0x02014b50) throw new Error('directorio central ilegible');
  const metodo = zip.readUInt16LE(dc + 10);
  const comprimido = zip.readUInt32LE(dc + 20);
  const real = zip.readUInt32LE(dc + 24);
  const local = zip.readUInt32LE(dc + 42);
  const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const cuerpo = zip.subarray(inicio, inicio + comprimido);
  const salida = metodo === 0 ? cuerpo : zlib.inflateRawSync(cuerpo);
  if (salida.length !== real) throw new Error(`tamaño ${salida.length} ≠ declarado ${real}`);
  return salida;
}

// ── ③ bajar, de 6 en 6 ─────────────────────────────────────────────────────────────────────
const pendientes = artefactos.filter((a) => !a.caducado);
let bajados = 0; let yaEstaban = 0; const fallidos = [];
async function uno(a) {
  const ruta = path.join(destino, `${a.run}-${a.id}.tap`);
  if (fs.existsSync(ruta) && fs.statSync(ruta).size > 0) { yaEstaban++; a.tap = fs.statSync(ruta).size; return; }
  try {
    const zip = await new Promise((ok, mal) => execFile('gh', ['api', `repos/${REPO}/actions/artifacts/${a.id}/zip`],
      { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 }, (e, out) => (e ? mal(e) : ok(out))));
    const tap = descomprimir(zip);
    fs.writeFileSync(ruta, tap);
    a.tap = tap.length; bajados++;
  } catch (e) { fallidos.push(a.id); a.error = String(e.message).split('\n')[0].slice(0, 120); }
}
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < pendientes.length) await uno(pendientes[i++]); }));

fs.writeFileSync(path.join(destino, 'artefactos.tsv'),
  ['artifact\trun\tsha\trama\tcreado\tcaducado\tzip_bytes\ttap_bytes\terror',
    ...artefactos.map((a) => [a.id, a.run, a.sha, a.rama, a.creado, a.caducado, a.bytes, a.tap ?? '', a.error ?? ''].join('\t'))].join('\n') + '\n');
console.log(`BAJADOS ${bajados} · ya estaban ${yaEstaban} · fallidos ${fallidos.length} · sin caducar ${pendientes.length}`);
console.log(`EXIT=${fallidos.length ? 1 : 0}`);
process.exit(fallidos.length ? 1 : 0);
