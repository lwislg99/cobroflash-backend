// ② ¿CUANTOS DOCUMENTOS «PARA APROBAR / PENDIENTE» HAY, Y CUANTOS ESTAN ENLAZADOS?
//
// El numero decide si SCRUM-547 fue un caso o el patron. Si son varios, el entregable no es el
// enlace: es lo que hace CAER cuando falta.
//
// ⚠️ Todo en node y sobre puntos de codigo: el grep de Git Bash normaliza CRLF, y una clase con
// acento devuelve cero donde hay cinco.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.argv[2];

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function md(dir, out = []) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) { md(rel, out); continue; }
    if (/\.md$/i.test(e.name)) out.push(rel);
  }
  return out;
}
const docs = md('docs').sort();

// ── QUE CUENTA COMO «ESPERA UNA APROBACION» ─────────────────────────────────────────────
// 🔴 DOS SEÑALES, y se derivan del arbol, no de una lista de nombres:
//   ① el NOMBRE del fichero lo dice (PARA_APROBAR, PENDIENTE, SIN_APLICAR, SIN_APROBAR…)
//   ② o el CUERPO lo dice de si mismo en sus primeras lineas (la cabecera de estado)
// Un criterio solo por nombre caduca en cuanto alguien llame distinto al siguiente.
const RE_NOMBRE = /(para_aprobar|pendiente|sin_aplicar|sin_aprobar|por_aprobar|para_validar)/i;
const RE_CUERPO = /\b(para aprobar|pendiente de aprobar|pendiente del fundador|sin aprobar|esperando aprobacion|para que (lo )?apruebes|falta que (lo )?apruebes)\b/;

const esperan = [];
for (const d of docs) {
  const txt = fs.readFileSync(path.join(RAIZ, d), 'utf8');
  const cabecera = norm(txt.split('\n').slice(0, 25).join('\n'));
  const porNombre = RE_NOMBRE.test(path.basename(d));
  const porCuerpo = RE_CUERPO.test(cabecera);
  if (porNombre || porCuerpo) esperan.push({ doc: d, porNombre, porCuerpo });
}

// ── ¿ESTAN ENLAZADOS DESDE DONDE EL FUNDADOR MIRA? ──────────────────────────────────────
// «Donde mira» no me lo invento: son los dos documentos que la casa senala como su puerta —
// el master (fuente unica) y el de pendientes del fundador.
const PUERTAS = ['docs/YAQU_MASTER.md', 'docs/PENDIENTES_FUNDADOR.md'];
const textoPuertas = PUERTAS.map((p) => {
  try { return fs.readFileSync(path.join(RAIZ, p), 'utf8'); } catch { return ''; }
}).join('\n');

// 🔴 CONTROL DEL INSTRUMENTO: tiene que VER un documento que SI esta enlazado y NO ver uno
// inventado. Sin las dos mitades, un buscador que dijera «ninguno» a todo pasaria.
const CEBO_SI = 'DECLARACION_RESPONSABLE.md';
const CEBO_NO = 'ZZZ_NO_EXISTE_ESTE_DOC.md';
const ve = textoPuertas.includes(CEBO_SI);
const noVe = !textoPuertas.includes(CEBO_NO);
console.log('CONTROL DEL INSTRUMENTO');
console.log('  ve un documento que SI esta enlazado : ' + (ve ? 'SI  OK' : 'NO  🔴 CIEGO'));
console.log('  no ve uno inventado                  : ' + (noVe ? 'OK' : '🔴'));
if (!ve || !noVe) { console.log('\n🔴 el instrumento no pasa su control: nada de abajo significa nada.'); process.exit(2); }

console.log('\nPOBLACION');
console.log('  .md bajo docs/                       : ' + docs.length);
console.log('  de ellos, «esperan una aprobacion»   : ' + esperan.length);

// 🔴 SUELO: si el criterio no encuentra ninguno, es el criterio, no el arbol.
if (!esperan.length) { console.log('\n🔴 SUELO: CERO documentos a la espera. El criterio esta roto.'); process.exit(2); }

const enlazado = (d) => textoPuertas.includes(path.basename(d)) || textoPuertas.includes(d);
const sinEnlazar = esperan.filter((e) => !enlazado(e.doc));

// 🔴 DOS POBLACIONES, Y NO SE JUZGAN IGUAL. `docs/master/` es el REGISTRO: una entrada por
// ticket, que se referencia por su ticket y no por una lista de pendientes. Meterlas en el mismo
// saco infla el hallazgo y hace que el guard pida enlazar 500 entradas de registro. Se cuentan
// aparte, y se dicen — no se esconden.
const esRegistro = (d) => d.startsWith('docs/master/');
const deAprobacion = esperan.filter((e) => !esRegistro(e.doc));
const delRegistro = esperan.filter((e) => esRegistro(e.doc));

console.log('\nEL REPARTO — documentos de APROBACION (fuera del registro)');
const sinEnlazarAprob = deAprobacion.filter((e) => !enlazado(e.doc));
console.log('  total                                          : ' + deAprobacion.length);
console.log('  enlazados desde el master o PENDIENTES_FUNDADOR : ' + (deAprobacion.length - sinEnlazarAprob.length));
console.log('  🔴 SIN enlazar                                  : ' + sinEnlazarAprob.length);

console.log('\nTODOS, para que el reparto no sea una seleccion mia:');
for (const e of deAprobacion) {
  console.log('  ' + (enlazado(e.doc) ? '✅' : '🔴') + '  ' + e.doc
    + '   [' + (e.porNombre ? 'nombre' : '') + (e.porNombre && e.porCuerpo ? '+' : '') + (e.porCuerpo ? 'cuerpo' : '') + ']');
}

console.log('\nY las entradas de REGISTRO que el criterio tambien toca (' + delRegistro.length + '), contadas aparte:');
for (const e of delRegistro) console.log('  ·  ' + e.doc);
console.log('  No son documentos de aprobacion: son la entrada de su ticket. Exigirles enlace desde');
console.log('  PENDIENTES_FUNDADOR seria pedir que se enlacen ~500 entradas de registro.');
