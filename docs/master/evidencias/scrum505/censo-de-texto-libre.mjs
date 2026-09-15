// docs/master/evidencias/scrum505/censo-de-texto-libre.mjs — SCRUM-505
//
// ¿CUANTOS CAMPOS DE TEXTO LIBRE HAY, Y EN CUANTOS PODRIA CABER UN DATO PERSONAL?
//
// El ticket habla de QUINCE columnas sin decidir. Pero ese numero es de la familia «la columna ES
// un dato personal». La otra familia —«texto libre que PUEDE contener uno»— no esta contada, y es
// la que el guard no sabe mirar. **Ese numero, no el 15, es el tamano real.**
//
// 🔒 Un guard que mira la etiqueta no ve el contenido.
//
// SE DERIVA DEL DMMF, no del fichero: entre `schema.prisma` y lo que la aplicacion ve hay un
// `generate` que puede no haberse corrido. Leer el texto del schema mediria el fichero, no el
// modelo (leccion de SCRUM-729, cuya primera sonda se hizo contra el .d.ts y salio rota).
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const { Prisma } = await import(new URL('../../../../node_modules/@prisma/client/index.js', import.meta.url).href);
const { CAMPOS_PERSONALES } = await import(new URL('../../../../dist/modules/system/domain/anonimizarMerchant.js', import.meta.url).href);

const modelos = Prisma.dmmf.datamodel.models;
if (!modelos || !modelos.length) {
  console.log('🔴 CENSO CIEGO: el DMMF no trae modelos. No es «no hay campos».');
  process.exit(3);
}

const enMinuscula = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// ── Lo que el guard YA cubre, derivado del modulo real y no reescrito aqui ────────────────
const cubiertos = new Set();
for (const [modelo, campos] of Object.entries(CAMPOS_PERSONALES)) {
  for (const c of campos) cubiertos.add(`${modelo}.${c}`);
}

// ── Que cuenta como TEXTO LIBRE ──────────────────────────────────────────────────────────
//
// 🔴 El criterio es por FORMA del campo, no por su nombre: un campo se considera texto libre si
// es `String` y NO es de los que tienen forma cerrada (id, enum, url, token, hash, fecha…). Y se
// declara al reves de como tienta hacerlo: en vez de listar «los que parecen notas», se EXCLUYE lo
// que tiene forma conocida y lo demas entra. Listar los que parecen notas seria volver a mirar la
// etiqueta, que es justo el defecto que este ticket denuncia.
const FORMA_CERRADA = /^(id|.*Id|.*Token|.*Hash|.*Url|.*At|number|numero|type|tipo|kind|status|estado|currency|locale|role|rol|slug|codigo|code|provider|.*Key|.*Code)$/;

const textoLibre = [];
const cerrados = [];
for (const m of modelos) {
  const modelo = enMinuscula(m.name);
  for (const f of m.fields) {
    if (f.kind !== 'scalar' || f.type !== 'String') continue;
    const clave = `${modelo}.${f.name}`;
    const fila = { clave, modelo, campo: f.name, cubierto: cubiertos.has(clave) };
    if (FORMA_CERRADA.test(f.name)) cerrados.push(fila); else textoLibre.push(fila);
  }
}

// ── SUELO: si no ve ningun campo de texto libre, esta CIEGO ──────────────────────────────
if (textoLibre.length === 0) {
  console.log('🔴 CENSO CIEGO: cero campos de texto libre. El ticket nombra al menos tres');
  console.log('   (job.notes, quote.internalNotes, expense.notes), asi que un cero aqui es el');
  console.log('   instrumento roto, no el esquema limpio.');
  process.exit(3);
}

// ── CONTROL POSITIVO: los que el ticket nombra tienen que salir ──────────────────────────
const DEL_TICKET = ['job.notes', 'quote.internalNotes', 'expense.notes'];
const vistos = DEL_TICKET.filter((x) => textoLibre.some((t) => t.clave === x));
console.log('CONTROL POSITIVO — los tres de texto libre que el ticket nombra:');
for (const x of DEL_TICKET) {
  console.log(`   ${x}: ${textoLibre.some((t) => t.clave === x) ? 'VISTO ✅' : '🔴 NO LO VE'}`);
}
if (vistos.length !== DEL_TICKET.length) {
  console.log('🔴 El censo no ve los que ya sabemos que estan. Su numero no vale.');
  process.exit(3);
}

console.log('');
console.log(`MODELOS: ${modelos.length}`);
console.log(`CAMPOS String: ${textoLibre.length + cerrados.length}`);
console.log(`  · de forma CERRADA (id, token, hash, url, estado…): ${cerrados.length}`);
console.log(`  · 🔴 TEXTO LIBRE: ${textoLibre.length}   <- el tamano real`);
console.log('');

const sinCubrir = textoLibre.filter((t) => !t.cubierto);
console.log(`DE ESOS ${textoLibre.length} DE TEXTO LIBRE:`);
console.log(`   cubiertos hoy por CAMPOS_PERSONALES: ${textoLibre.length - sinCubrir.length}`);
console.log(`   🔴 SIN CUBRIR: ${sinCubrir.length}`);
console.log('');
console.log('   ⚠️ Y «cubierto» aqui significa que el guard REDACTA esa columna entera al');
console.log('      anonimizar. NO significa que sepa mirar lo que hay dentro de los demas.');
console.log('');
console.log('LOS SIN CUBRIR, por modelo:');
const porModelo = new Map();
for (const t of sinCubrir) {
  if (!porModelo.has(t.modelo)) porModelo.set(t.modelo, []);
  porModelo.get(t.modelo).push(t.campo);
}
for (const [modelo, campos] of [...porModelo].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`   ${modelo}: ${campos.join(', ')}`);
}
