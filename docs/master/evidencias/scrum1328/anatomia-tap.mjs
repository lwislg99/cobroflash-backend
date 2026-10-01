// anatomia-tap.mjs — SCRUM-1328 · que tramos tiene un TAP, byte a byte. Solo LEE.
// Uso: node anatomia-tap.mjs <fichero.tap> [...]
// Dice: poblacion (bytes), tramos de NUL (desde, hasta, largo), y de cada tramo de TEXTO: donde
// empieza, cuanto mide, sus cabeceras `TAP version`, sus lineas de recuento `# tests N`, y el primer
// y ultimo numero de caso de nivel superior (`ok N` / `not ok N` a principio de linea).
import fs from 'node:fs';

for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f);
  console.log(`\n=== ${f}`);
  console.log(`POBLACION bytes=${b.length}`);
  const tramos = [];
  let i = 0;
  while (i < b.length) {
    const nul = b[i] === 0;
    let j = i;
    while (j < b.length && (b[j] === 0) === nul) j++;
    tramos.push({ nul, desde: i, hasta: j });
    i = j;
  }
  const totalNul = tramos.filter((t) => t.nul).reduce((a, t) => a + (t.hasta - t.desde), 0);
  console.log(`NUL total=${totalNul} (${(100 * totalNul / b.length).toFixed(1)} %) en ${tramos.filter((t) => t.nul).length} tramo(s); tramos de texto=${tramos.filter((t) => !t.nul).length}`);
  for (const t of tramos) {
    const largo = t.hasta - t.desde;
    if (t.nul) { console.log(`  [NUL ] ${t.desde}..${t.hasta} largo=${largo}`); continue; }
    const s = b.subarray(t.desde, t.hasta).toString('utf8');
    const lineas = s.split('\n');
    const cab = [];
    const rec = [];
    let off = t.desde;
    let primero = null; let ultimo = null; let nOk = 0; let nNo = 0; let saltos = 0;
    const planes = [];
    for (const l of lineas) {
      if (/^TAP version/.test(l)) cab.push(off);
      const r = l.match(/^# (tests|pass|fail|skipped|cancelled) (\d+)/);
      if (r) rec.push(`${r[1]}=${r[2]}@${off}`);
      const p = l.match(/^1\.\.(\d+)/);
      if (p) planes.push(`1..${p[1]}@${off}`);
      const m = l.match(/^(not ok|ok) (\d+)/);
      if (m) {
        const n = Number(m[2]);
        if (primero === null) primero = n;
        ultimo = n;
        if (m[1] === 'ok') nOk++; else nNo++;
        if (/# SKIP/.test(l)) saltos++;
      }
      off += Buffer.byteLength(l, 'utf8') + 1;
    }
    console.log(`  [TEXT] ${t.desde}..${t.hasta} largo=${largo}`);
    console.log(`         cabeceras TAP en: ${cab.join(', ') || '(ninguna)'}`);
    console.log(`         casos nivel superior: ok=${nOk} not_ok=${nNo} skip=${saltos} primero=${primero} ultimo=${ultimo}`);
    console.log(`         planes: ${planes.join(' ') || '(ninguno)'}`);
    console.log(`         recuentos: ${rec.join(' ') || '(ninguno)'}`);
    const pri = lineas.filter((l) => /^(not ok|ok) \d+/.test(l)).slice(0, 2).map((l) => l.slice(0, 110));
    const ult = lineas.filter((l) => /^(not ok|ok) \d+/.test(l)).slice(-1).map((l) => l.slice(0, 110));
    console.log(`         primeros: ${JSON.stringify(pri)}`);
    console.log(`         ultimo:   ${JSON.stringify(ult)}`);
    console.log(`         empieza con: ${JSON.stringify(s.slice(0, 90))}`);
  }
}
