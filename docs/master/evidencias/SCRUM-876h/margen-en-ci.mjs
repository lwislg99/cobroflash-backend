// ¿Cuánto tarda en salir la línea de scrum17 tras la de scrum1515 en el log del obligatorio?
// El reporter `spec` imprime por orden de fichero: la línea de un fichero sale cuando ÉL y todos los
// anteriores han terminado. Así que la hora de la línea de scrum1515 es (como pronto) su final, y si
// las de scrum17 salen en la MISMA ráfaga es que scrum17 ya había terminado antes: corrieron a la vez.
// Uso: node margen-en-ci.mjs <log de gh run view --log>...
import fs from 'node:fs';

const leer = (ruta) => {
  const b = fs.readFileSync(ruta);
  return (b[0] === 0xff && b[1] === 0xfe ? b.toString('utf16le') : b.toString('utf8')).split(/\r?\n/);
};
const hora = (l) => { const m = l.match(/(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+)Z/); return m ? Date.parse(m[1].slice(0, 23) + 'Z') : NaN; };
console.log(`POBLACION · ${process.argv.length - 2} log(s)`);
for (const ruta of process.argv.slice(2)) {
  const l = leer(ruta);
  const i1515 = l.findIndex((x) => /[✔✖] SCRUM-1515 · el merchant que crea nuestro guion/.test(x));
  const i17a = l.findIndex((x) => /[✔✖﹣] mesNaturalKey\/Label: YYYY-MM y etiqueta legible/.test(x));
  const i17z = l.findIndex((x) => /[✔✖﹣] SCRUM-17: consolidar/.test(x));
  const nombre = ruta.replace(/^.*[\\/]/, '');
  if (i1515 < 0 || i17a < 0 || i17z < 0) { console.log(`${nombre} · CIEGO: 1515 en ${i1515}, scrum17 en ${i17a}..${i17z} (de ${l.length} líneas)`); continue; }
  const t1515 = hora(l[i1515]);
  const t17 = hora(l[i17a]);
  const dur1515 = (l[i1515].match(/\(([\d.]+)ms\)/) || [])[1];
  // La línea anterior a la primera de scrum17: si sale a la vez, a scrum17 no lo retrasaba nadie más que él.
  const tAntes = hora(l[i17a - 1]);
  const entre = l.slice(i1515 + 1, i17a).filter((x) => /[✔✖﹣] /.test(x)).length;
  const estado17 = /﹣/.test(l[i17z]) ? 'SALTADO' : /✔/.test(l[i17z]) ? 'ok' : 'CAE';
  const estado1515 = /✔/.test(l[i1515]) ? 'ok' : 'CAE';
  console.log(`${nombre} · 1515=${estado1515} (${Math.round(dur1515)} ms) · scrum17=${estado17} · líneas de test entre los dos: ${entre} · la de scrum17 sale ${t17 - t1515} ms DESPUÉS de la de 1515 · y ${t17 - tAntes} ms después de la línea anterior a ella`);
}
