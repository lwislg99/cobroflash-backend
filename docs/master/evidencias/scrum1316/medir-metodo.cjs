// SCRUM-1316d · SOLO LECTURA. Transacción READ ONLY. Uso: node medir-metodo.cjs STAGING|DEV
const path = require('path');
const raiz = 'C:/Users/Javier Pereira/cobroflash-jv-j2eb';
require(path.join(raiz, 'node_modules/dotenv')).config({ path: path.join(raiz, '.env') });
const { PrismaClient } = require(path.join(raiz, 'node_modules/@prisma/client'));
const cual = process.argv[2];
const url = process.env['DATABASE_URL_' + cual];
if (!url) { console.log('CIEGO: sin clave', cual); process.exit(2); }
const db = new PrismaClient({ datasources: { db: { url } } });
const Q = {
  control_total_facturas: `SELECT count(*)::int n FROM invoices`,
  control_total_cobros: `SELECT count(*)::int n FROM charges`,
  facturas_por_estado: `SELECT status, count(*)::int n FROM invoices GROUP BY 1 ORDER BY 1`,
  // pagadas: ¿el método lo sabe un cargo pagado, o se marcó a mano?
  pagadas_por_origen: `SELECT CASE WHEN c.id IS NOT NULL AND c.status='paid' THEN 'cargo_pagado' WHEN i.charge_id IS NOT NULL THEN 'cargo_no_pagado' ELSE 'sin_cargo' END origen,
       CASE WHEN i.paid_via IS NULL OR btrim(i.paid_via)='' THEN 'paid_via_NULL' ELSE 'paid_via=' || i.paid_via END pv,
       coalesce(c.method,'-') metodo_cargo, count(*)::int n
     FROM invoices i LEFT JOIN charges c ON c.id=i.charge_id WHERE i.status='paid' GROUP BY 1,2,3 ORDER BY 1,2,3`,
  cobros_pagados_por_metodo: `SELECT method, count(*)::int n FROM charges WHERE status='paid' GROUP BY 1 ORDER BY 1`,
  apuntes_por_metodo: `SELECT coalesce(metodo,'NULL') metodo, fecha_origen, tipo, count(*)::int n FROM invoice_payments GROUP BY 1,2,3 ORDER BY 1,2,3`,
};
(async () => {
  console.log('BASE', cual);
  for (const [k, sql] of Object.entries(Q)) {
    try {
      const r = await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return tx.$queryRawUnsafe(sql);
      });
      console.log('##', k, JSON.stringify(r));
    } catch (e) { console.log('##', k, 'ERROR', String(e.message || e).split('\n').slice(-2).join(' ').slice(0, 200)); }
  }
  await db.$disconnect();
})();
