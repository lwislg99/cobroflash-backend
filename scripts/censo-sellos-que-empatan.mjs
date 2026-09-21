// scripts/censo-sellos-que-empatan.mjs — SCRUM-880
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⛔ SOLO LECTURA. NO ESCRIBE NI UNA FILA. NO TOCA EL CAMINO DE EMISIÓN.
//
// SCRUM-880 lleva un STOP FISCAL: se mide y se propone, no se arregla (regla 38). Este script
// contesta la única pregunta que decide la prisa — **¿cuántos sellos comparten segundo hoy?** —
// y lo hace contra la base que el guard de destino clasifica como DESARROLLO.
//
// 🔴 EL HOST PARECE STAGING Y NO LO ES, y conviene saberlo antes de leer un número de aquí:
// `DATABASE_URL_DEV` vive en `acela.proxy.rlwy.net`, el mismo host que `_db-guard.mjs` declara
// como `STAGING_HOST`. Lo que decide es el DESTINO —el nombre de la base—, que es como SCRUM-418
// dejó el criterio. `describirBD` lo dice en la cabecera de la salida: si ahí no pone DESARROLLO,
// este script se niega a leer.
//
// ── QUÉ SE CUENTA, Y POR QUÉ ESA UNIDAD ────────────────────────────────────────────────────
//
// Los dos sellos se persisten como `new Date(formatFechaHoraHuso(new Date()))`, y ese formateador
// trunca al SEGUNDO (`verifactu.service.ts:66-75`). O sea que **los milisegundos guardados son
// siempre 0, por construcción**: dos registros del mismo segundo son indistinguibles para el
// `>` estricto que desempata la cadena (`:481`).
//
// Se cuenta por MERCHANT, porque la cadena es por merchant: dos sellos del mismo segundo de
// merchants distintos no compiten por nada.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import process from 'node:process';
import { PrismaClient } from '@prisma/client';
import { parseBDSegura } from './_db-guard.mjs';
import { DESTINOS_ESPERADOS, exigirDestinoCorrecto, nombreDeWorktree } from './_clave-vs-destino.mjs';

const CLAVE = 'DATABASE_URL_DEV';
const url = process.env[CLAVE];

function morir(motivo) {
  console.error(`🔴 ${motivo}`);
  process.exit(2);
}

if (!url) morir(`falta ${CLAVE} en el entorno de este árbol.`);
if (!parseBDSegura(url)) morir('la URL de la base es ilegible.');

// 🔴 EL DESTINO LO DECIDE EL GUARD DE LA CASA, NO UNA EXPRESIÓN ESCRITA AQUÍ. La primera versión
// miraba si el texto de `describirBD` contenía «DESARROLLO» y se negaba a leer la base buena: ese
// texto es host/base, no la clasificación. Quien clasifica es `_clave-vs-destino.mjs` (SCRUM-418),
// que compara la clave con su destino DECLARADO — y ahí `DATABASE_URL_DEV` promete
// `acela.proxy.rlwy.net/yaqu_dev_javier`, que se llama DESARROLLO aunque el host sea el mismo que
// usa staging. Reescribir ese criterio aquí sería una segunda verdad que mantener.
const COMO_SE_LLAMA = DESTINOS_ESPERADOS[CLAVE]?.comoSeLlama;
if (COMO_SE_LLAMA !== 'DESARROLLO') {
  morir(`«${CLAVE}» promete «${COMO_SE_LLAMA}» y este script SOLO lee DESARROLLO. El encargo `
    + 'prohíbe staging y producción incluso para mirar.');
}
try {
  exigirDestinoCorrecto(CLAVE, url, nombreDeWorktree(process.cwd()));
} catch (e) {
  morir(String(e.message));
}

const prisma = new PrismaClient({ datasourceUrl: url });

/** Segundos, que es la resolución a la que de verdad se guardan los sellos. */
const seg = (d) => Math.floor(new Date(d).getTime() / 1000);

try {
  const invoices = await prisma.invoice.findMany({
    where: { OR: [{ vfHash: { not: null } }, { vfAnulHash: { not: null } }] },
    select: {
      id: true, merchantId: true, number: true,
      vfHash: true, vfTimestamp: true, createdAt: true,
      vfAnulHash: true, vfAnulTimestamp: true,
    },
    orderBy: { id: 'asc' },
  });

  // Cada REGISTRO sellado es una fila de la cadena: un alta y una anulación son dos registros.
  const registros = [];
  for (const i of invoices) {
    if (i.vfHash) registros.push({ tipo: 'ALTA', id: i.id, merchantId: i.merchantId, numero: i.number, sello: i.vfTimestamp ?? i.createdAt, conFallback: i.vfTimestamp == null });
    if (i.vfAnulHash && i.vfAnulTimestamp) registros.push({ tipo: 'ANULACION', id: i.id, merchantId: i.merchantId, numero: i.number, sello: i.vfAnulTimestamp, conFallback: false });
  }

  const totalFacturas = await prisma.invoice.count();
  console.log(`\npoblación: ${totalFacturas} facturas en la base · ${invoices.length} con algún sello · `
    + `${registros.length} REGISTROS sellados (${registros.filter((r) => r.tipo === 'ALTA').length} altas · `
    + `${registros.filter((r) => r.tipo === 'ANULACION').length} anulaciones)`);

  // 🔴 SUELO: con cero registros sellados no hay nada que medir, y eso se DICE. Un cero que
  // significa «la cadena está vacía» y un cero que significa «no he sabido leer» se leen igual.
  if (registros.length === 0) {
    console.log('\n⚠️ CERO registros sellados en DESARROLLO. El empate no puede haber ocurrido aquí,');
    console.log('   y este cero NO dice nada sobre otros entornos: dice que esta base está vacía');
    console.log('   de cadena. La medición del MECANISMO va aparte, en el banco de la tanda.');
  }

  // ¿Cuántos milisegundos distintos de 0 hay? Si alguno no es 0, la premisa del ticket
  // —«se guardan sin milisegundos»— habría dejado de ser cierta y habría que rehacer todo.
  const conMilis = registros.filter((r) => new Date(r.sello).getMilliseconds() !== 0);
  console.log(`sellos con milisegundos != 0: ${conMilis.length} de ${registros.length}`
    + (conMilis.length ? '  🔴 la premisa del ticket ha dejado de ser cierta' : '  (coherente con el truncado al segundo)'));

  // Los que comparten SEGUNDO con otro registro del MISMO merchant.
  const porMerchantSegundo = new Map();
  for (const r of registros) {
    const k = `${r.merchantId}@${seg(r.sello)}`;
    if (!porMerchantSegundo.has(k)) porMerchantSegundo.set(k, []);
    porMerchantSegundo.get(k).push(r);
  }
  const grupos = [...porMerchantSegundo.entries()].filter(([, v]) => v.length > 1);
  const enEmpate = grupos.reduce((n, [, v]) => n + v.length, 0);

  console.log(`\nregistros que COMPARTEN segundo con otro del mismo merchant: ${enEmpate} `
    + `en ${grupos.length} grupo(s)`);
  for (const [k, v] of grupos) {
    console.log(`  ${k} → ${v.map((r) => `${r.tipo} #${r.id} (${r.numero})`).join(' + ')}`);
  }

  // Y el caso que de verdad bifurca: un ALTA y una ANULACION en el mismo segundo del mismo
  // merchant. Los demás empates no rompen nada porque el desempate sólo compara esos dos lados.
  const bifurcan = grupos.filter(([, v]) => v.some((r) => r.tipo === 'ALTA') && v.some((r) => r.tipo === 'ANULACION'));
  console.log(`\n🔴 grupos con ALTA y ANULACION en el MISMO segundo (los que bifurcan): ${bifurcan.length}`);
  for (const [k, v] of bifurcan) console.log(`  ${k} → ${v.map((r) => r.tipo).join(' + ')}`);
} finally {
  await prisma.$disconnect();
}
