// Sonda S4 · 23-oct · SOLO GET. Baja el PDF de un albarán de la cuenta QA y saca su texto
// (pdfkit, fuentes estándar: streams Flate + cadenas hex/literales en TJ/Tj).
// CONTROL POSITIVO: el número del albarán (de su GET JSON) tiene que salir en el texto; si no,
// el extractor no sabe leer este PDF y lo que diga de las fechas no vale: sale CIEGO (exit 2).
// Uso: node sonda-pdf-albaran.mjs <repo> <id>...
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, ...ids] = process.argv.slice(2);
const { peticion, RUTA_SESION } = await import(pathToFileURL(path.join(repo, 'scripts/qa/sesion-panel.mjs')).href);
const cookie = fs.readFileSync(RUTA_SESION, 'utf8').trim();
const salida = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function textoDelPdf(buf) {
  const crudo = buf.toString('latin1');
  let ops = '';
  const re = /stream\r?\n/g; let m;
  while ((m = re.exec(crudo))) {
    const ini = m.index + m[0].length; const fin = crudo.indexOf('endstream', ini);
    try { ops += zlib.inflateSync(buf.subarray(ini, fin)).toString('latin1') + '\n'; } catch { /* no Flate */ }
  }
  // Cada bloque BT…ET → una línea; dentro, las cadenas <hex> y (literal) en orden.
  const lineas = [];
  for (const bt of ops.split(/\bBT\b/).slice(1)) {
    const cuerpo = bt.split(/\bET\b/)[0];
    let s = '';
    for (const t of cuerpo.matchAll(/<([0-9a-fA-F]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
      if (t[1]) s += Buffer.from(t[1], 'hex').toString('latin1');
      else s += t[2].replace(/\\([()\\])/g, '$1');
    }
    if (s.trim()) lineas.push(s);
  }
  return lineas;
}

let codigo = 0;
for (const id of ids) {
  const rj = await peticion(fetch, 'GET', `/admin/albaranes/${id}`, { cookie });
  const j = await rj.json();
  const a = j.albaran || j;
  const rp = await peticion(fetch, 'GET', `/admin/albaranes/${id}/pdf`, { cookie });
  const fecha = rp.headers.get('date');
  const buf = Buffer.from(await rp.arrayBuffer());
  fs.writeFileSync(path.join(salida, `albaran-${id}.pdf`), buf);
  const lineas = textoDelPdf(buf);
  fs.writeFileSync(path.join(salida, `albaran-${id}.txt`), lineas.join('\n'));
  const control = a.numero && lineas.some((l) => l.includes(a.numero));
  console.log(`#${id} ${a.numero} · estado ${a.estado} · firmadoAt ${a.firmadoAt} · fecha ${a.fecha}`);
  console.log(`  GET pdf → ${rp.status} · ${buf.length} B · Date ${fecha} · ${lineas.length} líneas · control «${a.numero}»: ${control ? 'SÍ' : 'NO'}`);
  if (!control) { console.log('  CIEGO: el extractor no ve el número; nada de lo de abajo vale.'); codigo = 2; continue; }
  for (const l of lineas) if (/Firmado el|Sello temporal|Fecha|\d{2}\/\d{2}\/\d{4}/.test(l)) console.log(`  · ${l}`);
}
process.exit(codigo);
