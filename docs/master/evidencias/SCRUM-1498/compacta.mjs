// compacta.mjs <entrada.json> <salida.json> runs|jobs — reescribe lo que dejan recoge.mjs y jobs.mjs con un run por linea
// (el mismo contenido; se vuelve a leer para comprobar que sigue siendo JSON y que no se pierde ninguno).
import fs from 'node:fs';
const [a, b, modo] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(a, 'utf8'));
if (modo === 'runs') {
  fs.writeFileSync(b, `{"evento":${JSON.stringify(j.evento)},"desde":${JSON.stringify(j.desde)},"hasta":${JSON.stringify(j.hasta)},"porDia":${JSON.stringify(j.porDia)},"runs":[\n${j.runs.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`);
} else {
  fs.writeFileSync(b, `{\n${Object.entries(j).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n')}\n}\n`);
}
const vuelta = JSON.parse(fs.readFileSync(b, 'utf8'));
const antes = modo === 'runs' ? j.runs.length : Object.keys(j).length;
const despues = modo === 'runs' ? vuelta.runs.length : Object.keys(vuelta).length;
console.log(`${b} · ${fs.statSync(b).size} bytes · elementos ${antes} -> ${despues}`);
process.exit(antes === despues && antes > 0 ? 0 : 1);
