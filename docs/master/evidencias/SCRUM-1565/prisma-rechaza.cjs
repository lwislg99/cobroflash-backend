// SCRUM-1565 · ¿Una fecha inválida en `planExpiresAt` REVIENTA o ENTRA como basura? Se mide con el
// cliente de Prisma DE VERDAD, sin base: la URL apunta a un puerto cerrado de loopback, así que nada
// sale de la máquina y no se escribe en ninguna base.
//
//   node docs/master/evidencias/SCRUM-1565/prisma-rechaza.cjs
//
// Dos casos con la MISMA llamada, que sólo cambian en la fecha:
//   · CONTROL: una fecha válida pasa la validación y llega a intentar conectar (error de conexión).
//   · CASO:    `new Date(undefined * 1000)` — lo que hace hoy la ruta con un payload `clover` — se
//              rechaza ANTES de conectar, con el mensaje que guarda el panel de Stripe (SCRUM-809c).
// Si el control no diera error de CONEXIÓN, el instrumento no estaría midiendo la validación: lo dice.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasourceUrl: 'postgresql://nadie:nada@127.0.0.1:1/no_existe_test' });

async function intentar(fecha) {
  try {
    await prisma.merchant.update({ where: { id: 46 }, data: { planExpiresAt: fecha } });
    return 'SIN ERROR';
  } catch (e) {
    return String(e && e.message || e).replace(/\s+/g, ' ').replace(/^.*?invocation in \S+/, '…'); // la ruta de tu máquina, fuera
  }
}

(async () => {
  const control = await intentar(new Date(1_900_000_000 * 1000));
  const caso = await intentar(new Date(undefined * 1000));
  // El arreglo: sin fecha se pasa `undefined`, que para Prisma es «no toques la columna». Si fuera un
  // valor que la validación rechaza, también se vería aquí; tiene que llegar a conectar, como el control.
  const arreglo = await intentar(undefined);
  console.log('CONTROL (fecha válida):', control);
  console.log('CASO (current_period_end ausente):', caso);
  console.log('ARREGLO (planExpiresAt: undefined):', arreglo);
  const conecta = (m) => /Can't reach database server/.test(m);
  const controlConecta = conecta(control);
  const casoValida = /Provided Date object is invalid/.test(caso);
  const arregloConecta = conecta(arreglo);
  console.log(`veredicto: control llega a conectar = ${controlConecta} · caso rechazado por validación = ${casoValida} · arreglo llega a conectar = ${arregloConecta}`);
  await prisma.$disconnect().catch(() => {});
  process.exit(controlConecta && casoValida && arregloConecta ? 0 : 1);
})();
