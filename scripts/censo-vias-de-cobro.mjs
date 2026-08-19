// scripts/censo-vias-de-cobro.mjs — SCRUM-519 · A CUÁNTOS TOCA LA DISCREPANCIA, CONTADO.
//
// Uso:  npm run censo:vias-de-cobro
//
// ── PARA QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// La tarjeta «Tu cuenta, lista para cobrar» (`settingsView.js:990`) y el aviso de la pantalla de
// cobro (`decidirAvisoBizum`) no miran los mismos campos, así que pueden decirle cosas distintas
// al mismo profesional. Antes de cambiar nada hay que saber **a cuántos les pasa**: puede que a
// ninguno —y entonces esto es una limpieza— o puede que a la mitad.
//
// Los números que circulan (13 merchants, 7 sin teléfono) son del 13-ago-2026 y NO se dan por
// buenos: este script los vuelve a contar contra la base que se le indique, y dice contra cuál.
//
// ── 🔴 EL SUELO, Y ES LO MÁS IMPORTANTE DE ESTE FICHERO ──────────────────────────────────────
// Si el censo devuelve CERO merchants, NO imprime «ningún afectado»: **sale por «no supe mirar»
// con código 1**. Un cero aquí se leería como «esto no toca a nadie» y es la mentira más cara
// posible en este ticket — se cerraría la discrepancia como cosmética teniendo profesionales
// reales detrás.
//
// ── LEE Y NADA MÁS ───────────────────────────────────────────────────────────────────────────
// Un solo `findMany` de cuatro campos no sensibles. Ni escribe, ni migra, ni toca el esquema. Y
// antes de contar imprime **host y base** (nunca usuario ni contraseña) para que quede escrito
// contra qué se midió: un censo sin su población declarada no es un dato.
import { PrismaClient } from '@prisma/client';

/** Un teléfono sirve si es una cadena con algo dentro. MISMO criterio que el dominio del aviso
 *  (`avisoBizumSinTelefono.ts`), y por eso se escribe igual: `null` no es «no tiene», es «no se
 *  pudo leer», y colapsarlos aquí falsearía el censo justo en el caso que más importa. */
function telefonoUtil(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return null;
}

function describirConexion() {
  const bruto = process.env.DATABASE_URL;
  if (!bruto) return null;
  try {
    const u = new URL(bruto);
    return { host: u.hostname, base: u.pathname.replace(/^\//, '') };
  } catch { return { host: '(no parseable)', base: '(no parseable)' }; }
}

const conexion = describirConexion();
if (!conexion) {
  console.error('🔴 NO SUPE MIRAR: no hay `DATABASE_URL` en el entorno, así que no se ha contado');
  console.error('   nada. Esto NO significa «ningún merchant afectado».');
  process.exit(1);
}

console.log('');
console.log('  SCRUM-519 · CENSO DE VÍAS DE COBRO');
console.log('  ' + '─'.repeat(92));
console.log(`  base medida: host=${conexion.host}  base=${conexion.base}   (credenciales NO impresas)`);

const prisma = new PrismaClient();
let merchants;
try {
  merchants = await prisma.merchant.findMany({
    select: { id: true, iban: true, bizumPhone: true, whatsappPhone: true, connectStatus: true },
    orderBy: { id: 'asc' },
  });
} catch (e) {
  console.error(`\n  🔴 NO SUPE MIRAR: la consulta falló (${e?.message || e}).`);
  console.error('     Un fallo de lectura NO se cuenta como «cero afectados».');
  await prisma.$disconnect();
  process.exit(1);
}
await prisma.$disconnect();

// 🔴 EL SUELO. Va antes que cualquier cifra: si no hay a quién contar, no hay censo que dar.
if (merchants.length === 0) {
  console.error('\n  🔴 CIEGO, QUE NO ES «NADIE AFECTADO»: la tabla `merchants` ha devuelto CERO filas');
  console.error(`     en host=${conexion.host} base=${conexion.base}.`);
  console.error('     O la base está vacía, o se ha apuntado a la que no era. En ninguno de los dos');
  console.error('     casos se puede concluir que la discrepancia no toca a nadie.');
  process.exit(1);
}

/** Las OCHO combinaciones exactas de los tres campos. Excluyentes y exhaustivas: suman el total. */
const cajas = new Map();
let ilegibles = 0;
for (const m of merchants) {
  const b = telefonoUtil(m.bizumPhone);
  const w = telefonoUtil(m.whatsappPhone);
  if (b === null || w === null) { ilegibles += 1; continue; }
  const clave = `${m.iban ? 'IBAN' : '—'} · ${b ? 'bizumPhone' : '—'} · ${w ? 'whatsappPhone' : '—'}`;
  const caja = cajas.get(clave) || { n: 0, ids: [] };
  caja.n += 1; caja.ids.push(m.id);
  cajas.set(clave, caja);
}

console.log('  ' + '─'.repeat(92));
console.log('  IBAN · bizumPhone · whatsappPhone'.padEnd(48) + 'merchants');
for (const [clave, caja] of [...cajas].sort((a, b) => b[1].n - a[1].n)) {
  console.log('  ' + clave.padEnd(46) + String(caja.n).padStart(6));
}
if (ilegibles) console.log('  ' + '(algún teléfono ILEGIBLE — ni cadena ni nulo)'.padEnd(46) + String(ilegibles).padStart(6));

// ── QUE LOS NÚMEROS CUADREN ──────────────────────────────────────────────────────────────────
const sumaCajas = [...cajas.values()].reduce((a, c) => a + c.n, 0) + ilegibles;
console.log('  ' + '─'.repeat(92));
console.log('  ' + 'TOTAL'.padEnd(46) + String(sumaCajas).padStart(6));
if (sumaCajas !== merchants.length) {
  console.error(`\n  🔴 EL CENSO NO CUADRA: las categorías suman ${sumaCajas} y se han leído `
    + `${merchants.length} merchants. Un censo cuyas categorías no suman su total no es un censo.`);
  process.exit(1);
}

// ── LAS DOS LECTURAS. NO SE ELIGE NINGUNA: se cuentan las dos. ───────────────────────────────
//
// La discrepancia sólo se puede medir así, porque cada pantalla contesta una pregunta distinta y
// las dos respuestas son defendibles. Quien decida qué significa «listo para cobrar» necesita
// estos dos números delante, no uno.
const cuenta = (f) => merchants.filter(f).length;
const bizumReal = (m) => telefonoUtil(m.bizumPhone) === true || telefonoUtil(m.whatsappPhone) === true;

const soloIban = cuenta((m) => !!m.iban && !bizumReal(m));
const soloWa = cuenta((m) => !m.iban && !telefonoUtil(m.bizumPhone) && telefonoUtil(m.whatsappPhone) === true);
const sinNada = cuenta((m) => !m.iban && !bizumReal(m));
const conTarjeta = cuenta((m) => String(m.connectStatus || 'none') === 'active');

console.log('');
console.log('  LO QUE SEPARA A LAS DOS PANTALLAS');
console.log('  ' + '─'.repeat(92));
console.log(`  la tarjeta dice ✅ y Bizum está BLOQUEADO (sólo IBAN, sin teléfono):  ${soloIban}`);
console.log(`  puede cobrar por Bizum y la tarjeta NO lo cuenta (sólo whatsappPhone): ${soloWa}`);
console.log(`  sin ninguna vía de cobro manual (ni IBAN ni teléfono):                 ${sinNada}`);
console.log(`  con tarjeta activa en Stripe (connectStatus=active):                   ${conTarjeta}`);
console.log('');
console.log('  ⚠️ Los dos primeros números son las DOS LECTURAS del ticket, y no se elige entre');
console.log('     ellas aquí: qué significa «listo para cobrar» lo decide el fundador.');
console.log('');
