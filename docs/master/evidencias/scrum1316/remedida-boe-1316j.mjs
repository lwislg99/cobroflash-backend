// SCRUM-1316j · re-medición del BOE (API de datos abiertos), 23-nov-2026.
// Uso: node remedida-boe-1316j.mjs <carpeta de salida FUERA del árbol>
// Baja cada recurso, guarda el cuerpo crudo en la carpeta de salida, e imprime por recurso:
// código HTTP, bytes, sha256, cabecera Date y los recuentos de cada cadena buscada.
// Controles: «zzqx» tiene que dar 0 en todo (negativo); el sumario del 13-nov tiene que traer
// BOE-A-2026-23755 (positivo sembrado por el propio instrumento: si no lo ve, el lector de
// sumarios está CIEGO y los ceros de los días nuevos no valen).
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) { console.error('falta la carpeta de salida'); process.exit(2); }
mkdirSync(out, { recursive: true });

const B = 'https://www.boe.es/datosabiertos/api';
const recursos = [
  ['liva-metadatos', `${B}/legislacion-consolidada/id/BOE-A-1992-28740/metadatos`],
  ['liva-a91', `${B}/legislacion-consolidada/id/BOE-A-1992-28740/texto/bloque/a91`],
  ['rdl29-metadatos', `${B}/legislacion-consolidada/id/BOE-A-2026-20823/metadatos`],
  ['rdl29-analisis', `${B}/legislacion-consolidada/id/BOE-A-2026-20823/analisis`],
  ['sumario-20261113', `${B}/boe/sumario/20261113`],
];
for (const d of ['19', '20', '21', '23']) recursos.push([`sumario-202611${d}`, `${B}/boe/sumario/202611${d}`]);

const buscar = [
  'BOE-A-2026-20823', 'Real Decreto-ley 29/2026', 'BOE-A-2026-23755',
  'tarjeta de crédito o débito, transferencia bancaria, cheque nominativo',
  '1 de diciembre de 2026', 'corrección de errores', 'Ley 37/1992', 'zzqx',
];

let fallos = 0;
for (const [nombre, url] of recursos) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/xml' } });
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(join(out, `${nombre}.xml`), buf);
    const txt = buf.toString('utf8');
    const sha = createHash('sha256').update(buf).digest('hex');
    const cuentas = buscar.map((s) => `${s}=${txt.split(s).length - 1}`).join(' · ');
    const extra = [];
    for (const tag of ['fecha_actualizacion', 'estatus_derogacion', 'vigencia_agotada']) {
      const m = txt.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      if (m) extra.push(`${tag}=${m[1]}`);
    }
    const versiones = [...txt.matchAll(/<version[^>]*id_norma="([^"]+)"[^>]*fecha_vigencia="([^"]*)"/g)].map((m) => `${m[1]}@${m[2]}`);
    if (versiones.length) extra.push(`versiones=${versiones.length} última=${versiones.at(-1)}`);
    const items = (txt.match(/<item>/g) || []).length;
    if (nombre.startsWith('sumario')) extra.push(`items=${items}`);
    console.log(`${nombre} · HTTP ${r.status} · ${buf.length} B · sha256 ${sha} · Date ${r.headers.get('date')}`);
    console.log(`   ${cuentas}`);
    if (extra.length) console.log(`   ${extra.join(' · ')}`);
    if (r.status !== 200 && !nombre.startsWith('sumario-2026112')) fallos++;
  } catch (e) {
    console.log(`${nombre} · ERROR ${e.message}`); fallos++;
  }
}
console.log(`recursos=${recursos.length} · fallos=${fallos}`);
process.exit(fallos ? 1 : 0);
