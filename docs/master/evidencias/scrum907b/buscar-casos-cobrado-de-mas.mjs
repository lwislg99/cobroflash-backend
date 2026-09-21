// docs/master/evidencias/scrum907b/buscar-casos-cobrado-de-mas.mjs — SCRUM-907b
//
// BARRIDO DE SOLO LECTURA sobre staging: ¿hay algún Trabajo con cobrado > aceptado?
//
// Para qué sirve guardarlo: el veredicto de SCRUM-907 no necesitó fabricar un fixture porque este
// barrido encontró el caso REAL (job 3102). Un fixture demuestra que el código funciona con lo que
// tú le pusiste; el caso real demuestra que funciona con lo que hay. Quien vuelva a tocar la ficha
// del Trabajo —SCRUM-915 la rediseña entera— vuelve a correr esto y tiene sujeto sin inventar nada.
//
//   node docs/master/evidencias/scrum907b/buscar-casos-cobrado-de-mas.mjs
//
// NO ESCRIBE NADA. Regla 9: no imprime ninguna URL ni ningún secreto, sólo el nombre de la base,
// ids y cifras.
//
// ⚠️ DOS TRAMPAS MEDIDAS AL ESCRIBIRLO, y por eso está así:
//   · NADA DE SQL CRUDO. El primer intento hizo `select … from "Job"` y se estrelló con
//     `relation "Job" does not exist`: el nombre del MODELO de Prisma no es el de la TABLA.
//   · El campo es `titulo`, no `title`. El modelo lo tiene en castellano.
//   En los dos casos el error fue el mismo: adivinar el nombre en vez de preguntárselo al esquema.
import { prismaStaging } from '../../../../tests/banco-scrum911/_entorno.mjs';

const { db, base, host } = await prismaStaging();
console.log(`  base: ${base}  ·  host reconocido como staging: ${host ? 'sí' : 'no'}`);

// CONTROL: sin Trabajos, un «0 candidatos» no significa «no hay»: significa «no he mirado».
const total = await db.job.count();
console.log(`  POBLACIÓN: ${total} Trabajos en la base.`);
if (total === 0) {
  console.error('  🔴 CIEGO: sin Trabajos, este barrido no puede decir nada.');
  await db.$disconnect();
  process.exit(2);
}

const jobs = await db.job.findMany({
  select: { id: true, merchantId: true, titulo: true, totalAceptado: true, totalCobrado: true },
  orderBy: { id: 'desc' },
});

const n = (v) => (v == null ? 0 : Number(v));
// En CÉNTIMOS enteros, igual que `cobradoDeMas` en `public/dashboard/js/jobCobroHuecos.js`: si el
// barrido contara en coma flotante encontraría excesos de un céntimo que el aviso no pinta, y el
// instrumento y la pantalla dejarían de hablar de lo mismo.
const cent = (v) => Math.round(n(v) * 100);

const conAceptado = jobs.filter((j) => n(j.totalAceptado) > 0);
const deMas = conAceptado.filter((j) => cent(j.totalCobrado) - cent(j.totalAceptado) > 2);
// CONTROL NEGATIVO: el caso contrario. Si salieran 0 en LOS DOS lados, el instrumento no
// discrimina — no es que no haya casos, es que no mira.
const deMenos = conAceptado.filter((j) => cent(j.totalCobrado) < cent(j.totalAceptado));

console.log(`  con totalAceptado > 0: ${conAceptado.length}`);
console.log(`  CANDIDATOS (cobrado > aceptado + 0,02 EUR): ${deMas.length}`);
for (const j of deMas) {
  const exceso = (cent(j.totalCobrado) - cent(j.totalAceptado)) / 100;
  console.log(`     · job ${j.id} · merchant ${j.merchantId} · «${j.titulo}» · aceptado ${n(j.totalAceptado)} · cobrado ${n(j.totalCobrado)} · exceso ${exceso}`);
}
console.log(`  CONTROL NEGATIVO (cobrado < aceptado, el caso normal): ${deMenos.length}`);

await db.$disconnect();
