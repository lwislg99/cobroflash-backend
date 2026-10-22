// SOLO SELECT contra DATABASE_URL_DEV (yaqu_dev_javier): ¿los FK que faltan en *_assignees se podrían
// añadir sin chocar con filas huérfanas? No imprime la URL.
const fs = require('node:fs');
const COMPARTIDO = 'C:/Users/Javier Pereira/cobroflash-backend';
const env = fs.readFileSync(COMPARTIDO + '/.env', 'utf8');
const url = env.split(/\r?\n/).find((l) => /^DATABASE_URL_DEV\s*=/.test(l)).replace(/^DATABASE_URL_DEV\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '');
if (!/acela\.proxy\.rlwy\.net(:\d+)?\/yaqu_dev_javier(\?|$)/.test(url)) { console.error('PARO: no es dev'); process.exit(4); }
const { PrismaClient } = require(COMPARTIDO + '/node_modules/@prisma/client');
const p = new PrismaClient({ datasourceUrl: url });
const q = (s) => p.$queryRawUnsafe(s);
(async () => {
  await q('SET TRANSACTION READ ONLY').catch(() => {});
  const out = {};
  out.db = (await q('SELECT current_database() AS db'))[0].db;
  out.fks = await q(`SELECT conrelid::regclass::text AS tabla, count(*)::int AS fks FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text IN ('quote_assignees','invoice_assignees','quotes','invoices') GROUP BY 1 ORDER BY 1`);
  out.filas = await q(`SELECT 'quote_assignees' AS t, count(*)::int AS n FROM quote_assignees UNION ALL SELECT 'invoice_assignees', count(*)::int FROM invoice_assignees`);
  out.huerfanos = await q(`
    SELECT 'qa.quote_id' AS col, count(*)::int AS n FROM quote_assignees a LEFT JOIN quotes x ON x.id=a.quote_id WHERE x.id IS NULL
    UNION ALL SELECT 'qa.team_member_id', count(*)::int FROM quote_assignees a LEFT JOIN team_members x ON x.id=a.team_member_id WHERE x.id IS NULL
    UNION ALL SELECT 'ia.invoice_id', count(*)::int FROM invoice_assignees a LEFT JOIN invoices x ON x.id=a.invoice_id WHERE x.id IS NULL
    UNION ALL SELECT 'ia.team_member_id', count(*)::int FROM invoice_assignees a LEFT JOIN team_members x ON x.id=a.team_member_id WHERE x.id IS NULL`);
  out.tablas_public = (await q(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`))[0].n;
  out.existe_customer_sites = (await q(`SELECT to_regclass('public.customer_sites')::text AS r`))[0].r;
  out.existe_equipments = (await q(`SELECT to_regclass('public.equipments')::text AS r`))[0].r;
  console.log(JSON.stringify(out, null, 1));
  await p.$disconnect();
})().catch(async (e) => { console.error(String(e.message).split(url).join('<URL>').slice(0, 600)); await p.$disconnect(); process.exit(1); });
