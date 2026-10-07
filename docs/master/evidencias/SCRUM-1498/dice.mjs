// dice.mjs <push.json> <desde> <hasta> — que dice CADA run cancelado sin jobs de si mismo en su pagina publica.
// Control: los runs CON jobs de la misma ventana deben dar 0. Solo lectura (GET de paginas publicas).
import fs from 'node:fs';
const { runs } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const [desde, hasta] = process.argv.slice(3);
const l = runs.filter((r) => r.creado >= desde && r.creado < hasta && r.estado === 'completed');
const FRASE = /Canceling since a higher priority waiting request for ([^\s<"]+) exists/;
const mira = async (r) => {
  const res = await fetch(`https://github.com/lwislg99/cobroflash-backend/actions/runs/${r.id}`);
  const html = await res.text();
  const m = html.match(FRASE);
  return { http: res.status, bytes: html.length, grupo: m ? m[1] : null };
};
for (const [nombre, sel] of [['cancelado-0-jobs', (r) => r.fin === 'cancelled' && r.jobs === 0], ['con jobs (control)', (r) => r.jobs > 0]]) {
  const lista = l.filter(sel);
  const cuenta = {};
  let ciegos = 0;
  for (const r of lista) {
    const d = await mira(r);
    if (d.http !== 200 || d.bytes < 50000) { ciegos++; continue; }
    const k = d.grupo ?? '(sin la frase)';
    cuenta[k] = (cuenta[k] || 0) + 1;
    if (nombre.startsWith('cancelado') && !d.grupo) console.log(`  SIN FRASE ${r.id} ${r.sha.slice(0, 8)} ${r.creado}`);
    await new Promise((ok) => setTimeout(ok, 250));
  }
  console.log(`«${nombre}» · poblacion ${lista.length} · no pude mirar ${ciegos} · ${JSON.stringify(cuenta)}`);
}
