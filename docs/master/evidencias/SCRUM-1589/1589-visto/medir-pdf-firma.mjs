// SCRUM-1589 · VISTO en yaqu.app (S4, 29-oct-2026). SÓLO GET. Baja el PDF de los albaranes que se
// le pasen (cuenta QA) y mide, en el content stream, la caja de la imagen de la firma (matriz `cm`
// que precede a `Do`) y la línea «Firmado por:» (`Tm` de su bloque BT, con la altura de la
// Helvetica-Bold a 9 pt). Todo en coordenadas de la página (PDF, origen abajo).
// CONTROL: el número del albarán tiene que salir en el texto; si no, el lector no sabe leer este
// PDF y sale CIEGO. Y el gemelo sin firmar NO debe tener imagen ni «Firmado por:».
// Uso: node medir-pdf-firma.mjs <dir-salida> <id>...   (lee la cookie de la sesión QA)
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const [out, ...ids] = process.argv.slice(2);
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().split(';')[0];
const h = { cookie: cookie.startsWith('pf_session=') ? cookie : `pf_session=${cookie}` };

function streams(buf) {
  const crudo = buf.toString('latin1'); const res = []; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(crudo))) {
    const ini = m.index + m[0].length; const fin = crudo.indexOf('endstream', ini);
    try { res.push(zlib.inflateSync(buf.subarray(ini, fin)).toString('latin1')); } catch { /* imagen u otro */ }
  }
  return res;
}
const cadena = (c) => [...c.matchAll(/<([0-9a-fA-F]+)>|\(((?:\\.|[^\\)])*)\)/g)].map((t) => (t[1] ? Buffer.from(t[1], 'hex').toString('latin1') : t[2].replace(/\\([()\\])/g, '$1'))).join('');

let codigo = 0;
for (const id of ids) {
  const a = await (await fetch(`https://yaqu.app/admin/albaranes/${id}`, { headers: h })).json().then((j) => j.albaran || j);
  const rp = await fetch(`https://yaqu.app/admin/albaranes/${id}/pdf`, { headers: h });
  const buf = Buffer.from(await rp.arrayBuffer());
  fs.writeFileSync(path.join(out, `albaran-${id}.pdf`), buf);
  const crudo = buf.toString('latin1');
  const altoPagina = Number((crudo.match(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+([\d.]+)/) || [])[1]);
  const creado = (crudo.match(/\/CreationDate\s*\(([^)]*)\)/) || [])[1];
  const ops = streams(buf).filter((s) => /\bBT\b|\bDo\b/.test(s)).join('\n');
  // ⚠️ pdfkit abre la página con `1 0 0 -1 0 <alto> cm`: el espacio de usuario va de ARRIBA ABAJO.
  // Una imagen es `w 0 0 -h x f cm`: ocupa de f−h (arriba) a f (abajo). Cada bloque de texto
  // se vuelve a invertir (`q 1 0 0 -1 0 <alto> cm BT … Tm`), así que su base, de arriba abajo, es
  // alto − y. Todo lo de abajo se da en ese sentido: «arriba» es el número menor.
  // (Primera versión de esta sonda: tomaba los dos en el mismo sentido y daba «se pisan 169 pt».
  // Se vio leyendo los operadores crudos, y se corrigió antes de usar ninguna cifra.)
  const imagenes = [...ops.matchAll(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+cm\s*\/(\w+)\s+Do/g)].map((m) => {
    const [aa, , , d, e, f] = m.slice(1, 7).map(Number);
    return { nombre: m[7], ancho: aa, alto: Math.abs(d), x: e, yArriba: Math.min(f, f + d), yAbajo: Math.max(f, f + d) };
  });
  const textos = [];
  for (const bt of ops.split(/\bBT\b/).slice(1)) {
    const cuerpo = bt.split(/\bET\b/)[0];
    const tm = cuerpo.match(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm/);
    const tf = cuerpo.match(/\/\w+\s+([\d.]+)\s+Tf/);
    textos.push({ t: cadena(cuerpo), x: tm && Number(tm[5]), y: tm && Number(tm[6]), size: tf && Number(tf[1]) });
  }
  const control = a.numero && textos.some((t) => t.t.includes(a.numero));
  const firmadoPor = textos.find((t) => /^Firmado por/.test(t.t));
  console.log(`#${id} ${a.numero} · estado ${a.estado} · firmadoAt ${a.firmadoAt} · GET pdf ${rp.status} · ${buf.length} B · Date ${rp.headers.get('date')} · CreationDate ${creado} · alto página ${altoPagina}`);
  console.log(`  control «${a.numero}» en el texto: ${control ? 'SÍ' : 'NO'} · ${textos.length} bloques de texto · ${imagenes.length} imágenes`);
  if (!control) { console.log('  CIEGO: el lector no ve el número; lo de abajo no vale.'); codigo = 2; continue; }
  for (const im of imagenes) console.log(`  imagen /${im.nombre}: ${im.ancho.toFixed(2)} × ${im.alto.toFixed(2)} pt · x ${im.x.toFixed(2)} · de arriba ${im.yArriba.toFixed(2)} a abajo ${im.yAbajo.toFixed(2)}`);
  if (firmadoPor) {
    // Línea de 9 pt de Helvetica-Bold: ascendente 718/1000 sobre la base (pdfkit coloca la base
    // en cursor + ascendente, así que el techo de la línea ES el cursor).
    const s = firmadoPor.size || 9;
    const base = altoPagina - firmadoPor.y; const techo = base - 0.718 * s;
    console.log(`  «${firmadoPor.t.slice(0, 60)}» · ${s} pt · base a ${base.toFixed(2)} · techo de la línea a ${techo.toFixed(2)}`);
    const firma = imagenes.filter((im) => im.yAbajo <= base).sort((p, q) => q.yAbajo - p.yAbajo)[0];
    if (firma) {
      const hueco = techo - firma.yAbajo;
      console.log(`  HUECO entre el pie de la imagen y el techo de «Firmado por»: ${hueco.toFixed(2)} pt → ${hueco >= 0 ? 'NO SE PISAN' : 'SE PISAN ' + (-hueco).toFixed(2) + ' pt'}`);
    } else console.log('  ninguna imagen encima de «Firmado por»');
  } else console.log('  sin «Firmado por:» en el texto');
}
process.exit(codigo);
