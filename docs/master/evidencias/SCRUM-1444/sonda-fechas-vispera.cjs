// SÓLO LEE. ¿Cambia de DÍA una fecha pintada con `toLocaleDateString` sin zona? Las MISMAS expresiones que usa src/.
// Se lanza a sí misma en procesos hijo con TZ distinta (TZ sólo vale puesta en el entorno del hijo).
const { spawnSync } = require('node:child_process');
if (process.argv[2] === 'hijo') {
  const instantes = {
    'verano · 3-oct 00:30 en Madrid (2-oct 22:30Z)': new Date('2026-10-02T22:30:00Z'),
    'invierno · 15-ene 00:30 en Madrid (14-ene 23:30Z)': new Date('2026-01-14T23:30:00Z'),
    'mediodía · 2-oct 12:00Z (control)': new Date('2026-10-02T12:00:00Z'),
    'fecha sola «2026-10-03» (medianoche UTC)': new Date('2026-10-03'),
  };
  const formas = {
    "es-ES por defecto (albaranes.routes:1282,1534 · recapitulativa:89)": (d) => d.toLocaleDateString('es-ES'),
    "es largo (pdf.service:1137 · albaranPdf:362 · receipt:293)": (d) => d.toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' }),
    "es-ES con zona Europe/Madrid (lo que hace ventanaDeFirma:183)": (d) => d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' }),
  };
  const out = {};
  for (const [ni, d] of Object.entries(instantes)) { out[ni] = {}; for (const [nf, f] of Object.entries(formas)) out[ni][nf] = f(d); }
  process.stdout.write(JSON.stringify(out));
} else {
  for (const tz of ['UTC', 'Europe/Madrid']) {
    const r = spawnSync(process.execPath, [__filename, 'hijo'], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    console.log(`\n##### proceso con TZ=${tz}`);
    for (const [ni, fs] of Object.entries(JSON.parse(r.stdout))) { console.log('  ' + ni); for (const [nf, v] of Object.entries(fs)) console.log('     ' + v.padEnd(22) + nf); }
  }
}
