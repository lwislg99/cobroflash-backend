// docs/master/evidencias/SCRUM-1514b/comparar.mjs — SCRUM-1514b
//
// Compara dos salidas del censo `--eje=comercio` FILA A FILA y dice cuáles se han movido.
//
// Una FILA es una línea de ruta (`MÉTODO /admin/…  → estado …`) más sus líneas de detalle (las
// sangradas que la siguen) y el apartado bajo el que cae (`== CRUZA`, `== FILTRA`, …).
//
// LO ÚNICO QUE SE NORMALIZA, y se declara: el sufijo al azar de los códigos de referido que
// propone `GET /admin/referral` (`NEGOCIO26XXX`). Dos corridas del MISMO código difieren en esos
// tres caracteres y en nada más (control de cero: `antes.txt` contra `antes-repetida.txt`).
//
// Uso: node comparar.mjs <antes.txt> <despues.txt> [--espera="POST /admin/invoices/:id/resend-whatsapp"]
// Sale 0 si las filas movidas son EXACTAMENTE las esperadas; 1 si se mueve cualquier otra o si
// la esperada no se mueve; 3 (CIEGO) si alguna salida no trae filas.
import fs from 'node:fs';

const [antesF, despuesF] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const espera = (process.argv.find((a) => a.startsWith('--espera=')) || '').slice('--espera='.length);
const esperadas = espera ? espera.split('|').map((s) => s.trim().replace(/\s+/g, ' ')) : [];

function filas(fichero) {
  const texto = fs.readFileSync(fichero, 'utf8').replace(/\r/g, '').replace(/NEGOCIO26[A-Z0-9]{3}/g, 'NEGOCIO26###');
  const mapa = new Map();
  let apartado = '(sin apartado)';
  let actual = null;
  for (const linea of texto.split('\n')) {
    const cab = /^== ([A-ZÁÉÍÓÚÑ-]+) · /.exec(linea);
    if (cab) { apartado = cab[1]; actual = null; continue; }
    const ruta = /^(GET|POST|PUT|PATCH|DELETE)\s+(\/admin\S*)\s+→\s*(.*)$/.exec(linea);
    if (ruta) {
      actual = `${ruta[1]} ${ruta[2]}`;
      if (mapa.has(actual)) throw new Error(`fila repetida: ${actual}`);
      mapa.set(actual, `[${apartado}] → ${ruta[3]}`);
      continue;
    }
    if (actual && /^\s+\S/.test(linea)) mapa.set(actual, mapa.get(actual) + '\n' + linea);
    else actual = null;
  }
  return mapa;
}

const a = filas(antesF);
const d = filas(despuesF);
console.log(`POBLACIÓN: ${a.size} filas en ${antesF} · ${d.size} filas en ${despuesF} · ${fs.statSync(antesF).size} B y ${fs.statSync(despuesF).size} B`);
if (a.size === 0 || d.size === 0) { console.log('CIEGO: una de las dos salidas no trae filas'); process.exit(3); }

const movidas = [];
for (const k of new Set([...a.keys(), ...d.keys()])) {
  if (a.get(k) !== d.get(k)) movidas.push(k);
}
const iguales = [...a.keys()].filter((k) => d.has(k) && a.get(k) === d.get(k)).length;
console.log(`IDÉNTICAS: ${iguales} · MOVIDAS: ${movidas.length}`);
for (const k of movidas) {
  console.log(`\n· ${k}`);
  console.log(`    antes:   ${(a.get(k) ?? '(no figura)').replace(/\n/g, '\n             ')}`);
  console.log(`    después: ${(d.get(k) ?? '(no figura)').replace(/\n/g, '\n             ')}`);
}

const deMas = movidas.filter((k) => !esperadas.includes(k));
const deMenos = esperadas.filter((k) => !movidas.includes(k));
console.log(`\nESPERADAS: ${esperadas.length ? esperadas.join(' | ') : '(ninguna)'}`);
console.log(`se mueve alguna que no se esperaba: ${deMas.length ? 'SÍ → ' + deMas.join(' | ') : 'no'}`);
console.log(`alguna esperada NO se mueve: ${deMenos.length ? 'SÍ → ' + deMenos.join(' | ') : 'no'}`);
const salida = deMas.length || deMenos.length ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
