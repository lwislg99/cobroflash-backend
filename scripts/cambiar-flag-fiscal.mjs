#!/usr/bin/env node
// scripts/cambiar-flag-fiscal.mjs — SCRUM-218b
//
// LA PUERTA DE AL LADO. `cambiarFlagFiscal()` (SCRUM-218) hace el cambio con constancia, pero
// una función que nadie puede invocar no sustituye al UPDATE a mano: si el fundador no tiene
// forma de usarla, seguirá cambiando el flag con SQL directo y `cambio_flag` no se escribirá
// jamás. Mecanismo construido, puerta de al lado abierta. Esto es la puerta.
//
// NO hay ruta HTTP a propósito: cambiar el flag de OTRO merchant cruza tenancy y su gate de
// permisos es una decisión que no se inventa aquí. Un script que ejecuta un humano con acceso
// a la base no necesita ese gate — ya lo tiene por tener la credencial.
//
// ── LAS TRES PUERTAS, Y NINGUNA ES CEREMONIA ─────────────────────────────────────────────
//  1. `DATABASE_URL` EN EL ENTORNO. No se lee `.env` a propósito: `.env` apunta a PRODUCCIÓN,
//     y "ser amables" leyéndolo es exactamente cómo se enciende la facturación del merchant
//     equivocado con un mensaje bonito delante. Sin destino elegido, no se ejecuta.
//  2. `FLAG_CONFIRM=<hostname>` — hay que NOMBRAR la base. Patrón de `seed-video`/`seed-demo`:
//     no se prohíbe apuntar a producción, se obliga a decirlo. Deja de ser posible por accidente.
//  3. `--email` con el email EXACTO del merchant. Un id es un número que se confunde; un email
//     hay que ir a buscarlo. Lo valida el servicio, no este script.
//
// ⚠️ La URL de la base NUNCA se parsea a mano (R7, SCRUM-196): `parseBDSegura`/`describirBD` de
// `_db-guard.mjs` son los únicos que la tocan, y no hay camino por el que devuelvan la cadena.
//
// USO:
//   DATABASE_URL=<url> FLAG_CONFIRM=<hostname> node scripts/cambiar-flag-fiscal.mjs \
//     --merchant 7 --flag INVOICING_ES_ENABLED --valor on --email pro@ejemplo.es
import { describirBD, parseBDSegura, redactarSecretos } from './_db-guard.mjs';

const abortar = (msg) => { console.error('\n❌ ABORTADO: ' + msg + '\n'); process.exit(1); };

// ── PUERTA 1 y 2: la base, elegida y nombrada ────────────────────────────────────────────
// Va ANTES de construir el cliente Prisma: así no existe un orden de llamadas en el que algo
// consulte la base sin haber pasado por aquí.
function confirmarDestino() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    abortar(
      'DATABASE_URL no está definida EN EL ENTORNO.\n\n' +
      '  Ojo: eso no significa "sin destino". Prisma cargaría `.env`, que apunta a PRODUCCIÓN,\n' +
      '  y este script cambia el INTERRUPTOR FISCAL de un merchant.\n\n' +
      '  Elige la base a mano y nómbrala:\n\n' +
      '    DATABASE_URL=<url-de-la-bd> FLAG_CONFIRM=<hostname-de-esa-bd> \\\n' +
      '      node scripts/cambiar-flag-fiscal.mjs --merchant <id> --flag <FLAG> --valor on|off --email <email>',
    );
  }

  const bd = parseBDSegura(dbUrl); // jamás `new URL` suelto: su error lleva la contraseña dentro
  if (!bd) abortar('DATABASE_URL no es una URL válida. (No se imprime: llevaría la credencial.)');

  if (process.env.FLAG_CONFIRM !== bd.host) {
    abortar(
      `Confirma la base de forma EXPLÍCITA. DATABASE_URL apunta a:\n\n    ${describirBD(dbUrl)}\n\n` +
      `  Si es la correcta, re-ejecuta nombrándola:\n\n` +
      `    FLAG_CONFIRM=${bd.host} node scripts/cambiar-flag-fiscal.mjs …\n\n` +
      '  Si NO es la que querías, no toques FLAG_CONFIRM: cambia DATABASE_URL.',
    );
  }
  return bd;
}

function argumento(nombre) {
  const i = process.argv.indexOf('--' + nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BD = confirmarDestino();

const merchantId = Number(argumento('merchant'));
const flag = argumento('flag');
const valorRaw = (argumento('valor') || '').toLowerCase();
const email = argumento('email');

if (!Number.isInteger(merchantId)) abortar('Falta --merchant <id> (entero).');
if (!flag) abortar('Falta --flag <INVOICING_ES_ENABLED|SIF_ENABLED>.');
if (valorRaw !== 'on' && valorRaw !== 'off') abortar('Falta --valor on|off.');
if (!email) abortar('Falta --email <email exacto del merchant> (la confirmación).');
const valorNuevo = valorRaw === 'on';

const { prisma } = await import('../dist/core/db/prisma.js');
const { cambiarFlagFiscal } = await import('../dist/modules/system/domain/flagFiscal.service.js');
const { isFlagEnabled } = await import('../dist/core/flags.js');

const leerEfectivo = async () => {
  const m = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, email: true, country: true, flags: true },
  });
  return m ? { merchant: m, valor: isFlagEnabled(flag, { merchant: m }) } : null;
};

console.log(`\n🎯 Base de datos: ${describirBD(process.env.DATABASE_URL)}`);
console.log(`🏷️  Flag: ${flag} · merchant #${merchantId} · valor pedido: ${valorNuevo ? 'ON' : 'OFF'}`);

// ⚠️ TODO lo que toca la base va DENTRO del try, incluida la primera lectura. Estaba fuera y
// se vio el precio al probarlo: un fallo de conexión salía por el manejador de excepciones no
// capturadas y volcaba el OBJETO de error entero. Aquí no llevaba credencial, pero R7 dice
// justo que eso no se comprueba por suerte — el volcado del objeto ES el vector. Ahora
// cualquier error de aquí abajo sale por `abortar`, redactado.
try {
  const antes = await leerEfectivo();
  if (!antes) abortar(`No existe el merchant #${merchantId} en ${BD.host}/${BD.base}.`);
  console.log(`\n── VALOR EFECTIVO ANTES ─────────────────────────────`);
  console.log(`   ${flag} = ${antes.valor ? 'ON' : 'OFF'}   (merchant: ${antes.merchant.email})`);

  const r = await cambiarFlagFiscal({
    merchantId,
    flag,
    valorNuevo,
    confirmacion: email,
    // El actor es un humano con acceso a la base ejecutando un script: no hay sesión ni
    // teamMemberId. Se dice lo que es en vez de disfrazarlo de propietario.
    actor: { tipo: 'sistema', teamMemberId: null, ref: 'script:cambiar-flag-fiscal' },
  }, prisma);

  const despues = await leerEfectivo();
  console.log(`\n── VALOR EFECTIVO DESPUÉS ───────────────────────────`);
  console.log(`   ${flag} = ${despues.valor ? 'ON' : 'OFF'}   (cambio: ${r.anterior ? 'ON' : 'OFF'} → ${r.nuevo ? 'ON' : 'OFF'})`);

  // LA FILA. Sin esto el script diría "hecho" y habría que creérselo — que es justo lo que
  // este ticket viene a cerrar. Se lee de la base, no del retorno de la función.
  const fila = await prisma.auditLog.findFirst({
    where: { merchantId, action: 'cambio_flag' },
    orderBy: { id: 'desc' },
  });
  console.log(`\n── FILA DE AUDITORÍA ESCRITA ────────────────────────`);
  if (!fila) {
    console.error('   ⚠️  NO se encontró la fila. Esto no debería poder pasar: revísalo.');
    process.exit(1);
  }
  console.log(`   id=${fila.id} · action=${fila.action} · merchant=${fila.merchantId}`);
  console.log(`   entidad=${fila.entityType}#${fila.entityId} · momento=${fila.createdAt.toISOString()}`);
  console.log(`   meta=${JSON.stringify(fila.meta)}`);
  console.log('\n✅ Hecho, y con constancia.\n');
} catch (e) {
  // El servicio lanza `ErrorCambioFlag` con código estable; Prisma lanza lo suyo. En los dos
  // casos se REDACTA antes de imprimir y NUNCA se vuelca el objeto: su inspección es lo que
  // publica la credencial (R7), no el `.message`.
  abortar(`${e?.codigo ? e.codigo + ' — ' : ''}${redactarSecretos(e?.message ?? 'error desconocido')}`);
} finally {
  await prisma.$disconnect().catch(() => {});
}
