// scripts/clean-staging-tests.mjs — SCRUM-79
// Borra de STAGING los merchants EFÍMEROS que dejan los tests gateados cuando fallan a
// medio camino (el `finally` no llega a correr si el proceso muere o el assert revienta
// antes). Se acumulan y ensucian el entorno: llegamos a 26 de 28 merchants huérfanos.
//
// Criterio de borrado — deliberadamente ESTRECHO: solo merchants cuyo email termina en
// `@test.local`, que es el dominio sintético que usan TODOS los tests (qa-*@test.local).
// Ningún merchant real puede tener ese dominio. Nunca se borra por nombre ni por fecha.
//
// Uso:
//   node scripts/clean-staging-tests.mjs           → DRY RUN (solo lista, no borra)
//   node scripts/clean-staging-tests.mjs --apply   → borra de verdad
//
// ⚠️ GUARD ANTI-PRODUCCIÓN (SCRUM-118: por pertenencia — ver scripts/_db-guard.mjs, mismo
// patrón que scripts/seed-staging.mjs y tests/_staging-db.mjs): aborta si la URL no
// pertenece al host de staging. Además exige DATABASE_URL_STAGING explícita: no se hereda
// la DATABASE_URL del .env "por si acaso".
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { assertSafeStagingUrl } from './_db-guard.mjs';
import { leerMarcaCruda, parsearLock } from './_staging-lock.mjs'; // SCRUM-260: LEER marcador (read-only; no edito _staging-lock ni turno-staging)
import { registrar, ioDeCliente, mensajeAviso } from './_rastro-limpieza.mjs'; // SCRUM-260: constancia + aviso

const TEST_EMAIL_DOMAIN = '@test.local';
const APPLY = process.argv.includes('--apply');

const url = process.env.DATABASE_URL_STAGING;
if (!url) {
  console.error('❌ Falta DATABASE_URL_STAGING. Este script NO usa DATABASE_URL (podría ser prod).');
  process.exit(1);
}
const urlCheck = assertSafeStagingUrl(url, process.env.DATABASE_URL);
if (!urlCheck.safe) {
  console.error(`❌ DATABASE_URL_STAGING no es una URL de staging segura (${urlCheck.reason}) — abortado.`);
  process.exit(1);
}
process.env.DATABASE_URL = url;

const prisma = new PrismaClient();

async function main() {
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`⏱  latencia SELECT 1: ${Date.now() - t0} ms`);

  const huerfanos = await prisma.merchant.findMany({
    where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  if (!huerfanos.length) {
    console.log('✅ No hay merchants de test huérfanos.');
    return;
  }

  console.log(`\n${huerfanos.length} merchants de test (${TEST_EMAIL_DOMAIN}):`);
  for (const m of huerfanos) {
    console.log(`  #${m.id}  ${m.name}  ${m.email}  ${m.createdAt.toISOString().slice(0, 10)}`);
  }

  // SCRUM-260 · CONSTANCIA — se deja el rastro ANTES de borrar nada (R4): si un delete revienta a
  // mitad, la fila con «qué se iba a barrer + qué turno estaba vigente» ya está a salvo. Vale para
  // dry-run (applied=dry-run) y para --apply. Best-effort (R5): si la constancia falla, la limpieza
  // sigue y la barrera anti-prod no se toca.
  const ids = huerfanos.map((m) => m.id);
  const jobsPrevistos = await prisma.job.count({ where: { merchantId: { in: ids } } }).catch(() => NaN);
  const { marca } = await leerMarcaCruda(prisma).catch(() => ({ marca: null }));

  // SCRUM-260 · AVISO (avisa, NO bloquea): las dos señales de que estas fixtures pueden ser de una
  // tanda viva — el turno vigente Y el nº de @test.local vivos. El segundo cubre lo que el turno NO
  // ve: un gateado suelto tiene fixtures y NO toma el turno. Es manual: se avisa y se sigue.
  const lock = marca ? parsearLock(marca) : null;
  console.log('\n' + mensajeAviso({ dueñoTurno: lock?.dueño ?? null, merchantsVivos: huerfanos.length }));

  const rastro = await registrar(ioDeCliente(prisma), {
    ranAt: new Date().toISOString(),
    turnMarker: marca ?? null, // null → «NO CONSTA» explícito en el rastro
    applied: APPLY,
    merchantsCount: huerfanos.length,
    merchantEmails: huerfanos.map((m) => m.email),
    jobsCount: jobsPrevistos,
  });
  console.log(rastro.ok
    ? `📝 rastro dejado en COMMENT ON SCHEMA yaqu_rastro (turno vigente: ${marca ? 'consta' : 'NO CONSTA'})`
    : `⚠️  no se pudo dejar rastro: ${rastro.motivo}`);

  if (!APPLY) {
    console.log('\n🔎 DRY RUN — no se ha borrado nada. Repite con --apply para borrarlos.');
    return;
  }

  const where = { merchantId: { in: ids } };

  // Hijos antes que padres. `.catch` por si alguna tabla no existe en este entorno:
  // limpiar es best-effort, nunca debe dejar el proceso a medias por una tabla.
  const pasos = [
    // SCRUM-113: `event` VA EL PRIMERO y no tiene merchantId propio — cuelga de charge, con
    // FK RESTRICT. Sin este paso, `charge` no se puede borrar, y sin charge tampoco el
    // merchant: el script fallaba justo con los huérfanos de scrum74 (que crean un event
    // 'invoiced'), o sea con LOS ÚNICOS que había que limpiar. La herramienta de limpieza
    // no podía limpiar los huérfanos que motivaron SCRUM-79.
    ['event', () => prisma.event.deleteMany({ where: { charge: { merchantId: { in: ids } } } })],
    ['authSession', () => prisma.authSession.deleteMany({ where })],
    ['auditLog', () => prisma.auditLog.deleteMany({ where })],
    ['albaran', () => prisma.albaran.deleteMany({ where })],
    ['invoice', () => prisma.invoice.deleteMany({ where })],
    ['job', () => prisma.job.deleteMany({ where })],
    ['quote', () => prisma.quote.deleteMany({ where })],
    ['charge', () => prisma.charge.deleteMany({ where })],
    ['expense', () => prisma.expense.deleteMany({ where })],
    ['quoteRequest', () => prisma.quoteRequest.deleteMany({ where })],
    ['customerEvent', () => prisma.customerEvent.deleteMany({ where })],
    ['customer', () => prisma.customer.deleteMany({ where })],
    ['teamMember', () => prisma.teamMember.deleteMany({ where })],
    ['product', () => prisma.product.deleteMany({ where })],
    ['provider', () => prisma.provider.deleteMany({ where })],
    ['quoteTemplate', () => prisma.quoteTemplate.deleteMany({ where })],
  ];

  console.log('');
  for (const [tabla, fn] of pasos) {
    const r = await fn().catch((e) => {
      console.log(`  ⚠️  ${tabla}: ${e.message.split('\n')[0]}`);
      return null;
    });
    if (r && r.count) console.log(`  ${tabla}: ${r.count} borrados`);
  }

  // SCRUM-113: este borrado iba SIN .catch, así que una FK viva reventaba el script y lo
  // dejaba a medias — hijos borrados, merchants en pie y un stack trace por toda respuesta.
  // Mismo defecto que el `finally` de scrum74 (SCRUM-79): la limpieza que falla a mitad es
  // peor que la que no corre, porque deja el estado a medio camino y sin diagnóstico.
  const del = await prisma.merchant.deleteMany({ where: { id: { in: ids } } }).catch((e) => {
    console.log(`  ⚠️  merchant: ${e.message.split('\n')[0]}`);
    console.log('     Queda alguna FK viva: mira qué tabla la nombra y añádela a `pasos`.');
    return { count: 0 };
  });
  console.log(`  merchant: ${del.count} borrados`);

  const t1 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  console.log(`\n⏱  latencia SELECT 1 tras la limpieza: ${Date.now() - t1} ms`);
  console.log(`✅ Limpieza terminada (${del.count} merchants de test).`);
}

main()
  // SCRUM-196: e?.message en vez del objeto entero — reduce superficie. NO es fuga hoy (Prisma no
  // mete la contraseña en el mensaje de sus errores), pero eso es propiedad de la versión de
  // Prisma que tenemos, no una garantía nuestra. Imprimir el error entero era superficie de más.
  .catch((e) => { console.error(e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
