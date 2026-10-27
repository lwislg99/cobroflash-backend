// SCRUM-1395 · el censo ESTATICO del filtro sin suelo, enfrentado al veredicto de `censo:mudez`.
// Uso (desde la raiz):  node docs/master/evidencias/scrum1395/censo-estatico.mjs [salida-del-censo-de-mudez.txt]
// Solo lee. Dice su poblacion, y si se le da la salida del censo de mudez cruza las dos listas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const { censoDelFiltro, FORMAS } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_censo-filtro-sin-suelo.mjs')).href);

const c = censoDelFiltro(RAIZ);
const n = (clase) => c.de(clase).length;
console.log(`POBLACION: ${c.enDisco} ficheros *.test.mjs en tests/ · ${c.usan.length} usan el filtro por un import de _guard-texto.mjs`);
console.log(`  sin suelo ${n(FORMAS.SIN_SUELO)} · sin juzgar ${n(FORMAS.SIN_JUZGAR)} · con suelo ${n(FORMAS.CON_SUELO)} · no filtra ${n(FORMAS.NO_FILTRA)}`);
console.log(`  modulos de apoyo (_*.mjs) que llaman al filtro, contados y no juzgados: ${c.envoltorios.length} · ${c.envoltorios.map((e) => e.fichero).join(' ')}`);
for (const control of ['scrum589-nombre-por-documento.test.mjs', 'scrum149-sin-lineas-no-sella.test.mjs', 'scrum9999-inventado.test.mjs']) {
  const f = c.filas.find((x) => x.fichero === control);
  console.log(`  CONTROL ${control}: ${f ? `${f.clase} · ${f.sitios.map((s) => `${s.exportado}@${s.linea}=${s.forma}`).join(' ')}` : 'NO ESTA'}`);
}

const salida = process.argv[2];
if (salida) {
  const txt = fs.readFileSync(salida, 'utf8');
  const bloque = (titulo) => {
    const i = txt.indexOf(titulo);
    if (i === -1) return [];
    const out = [];
    for (const l of txt.slice(i).split(/\r?\n/).slice(1)) {
      const m = l.match(/^\s{4}(\S+\.test\.mjs)/);
      if (!m) break;
      out.push(m[1]);
    }
    return out;
  };
  const mudos = bloque('MUDOS');
  const noAplica = bloque('NO APLICA —');
  const pob = Number((txt.match(/mencionan el filtro de comentarios: (\d+)/) || [])[1]);
  console.log(`\nCENSO DE MUDEZ (${path.basename(salida)}): poblacion ${pob} · mudos ${mudos.length} · no aplica ${noAplica.length}`);
  const sinSuelo = new Set(c.sinSuelo.map((x) => x.fichero));
  const usan = new Set(c.usan.map((x) => x.fichero));
  console.log(`  mudos que el censo estatico da por «sin suelo»: ${mudos.filter((f) => sinSuelo.has(f)).length} de ${mudos.length}${mudos.filter((f) => !sinSuelo.has(f)).map((f) => `  <-- NO LO VE: ${f}`).join('')}`);
  console.log(`  «no aplica» que el estatico cree que usan el filtro: ${noAplica.filter((f) => usan.has(f)).map((f) => `${f}=${c.filas.find((x) => x.fichero === f).clase}`).join(' · ') || 'ninguno'}`);
  console.log(`  sin suelo y NO mudos hoy (vivos por otra asercion, o no aplica): ${[...sinSuelo].filter((f) => !mudos.includes(f)).length}`);
}
if (process.argv.includes('--lista')) for (const x of c.sinSuelo) console.log(`    ${x.fichero}`);
console.log('EXIT=0');
