// docs/master/evidencias/scrum665-eje-codigo/desglose-pdfurl.mjs — SCRUM-665, punto 3 del
// encargo J1 del 22-sep-2026.
//
// LA MEDICIÓN 2 QUE FALTA: de las facturas EMITIDAS (vf_estado = 'sellado'), cuántas tienen
// `pdf_url` en el formato válido (`/admin/invoices/<id>/pdf`, D4) frente a las que están en
// 'PENDING_PDF'/'PENDING%' (nunca generado) o en un formato legado (estático viejo).
//
// 🔴 LO QUE ESTO NO PUEDE DECIR: aunque `pdf_url` esté en formato válido, NADA de esto
// "persiste" en el sentido de sobrevivir un redeploy — no hay almacenamiento externo en el
// árbol (grep de package.json, 22-sep-2026: cero SDKs de S3/Cloudinary/GCS/Azure/R2/MinIO).
// La columna solo dice si el disco EFÍMERO tenía el fichero la última vez que se escribió esta
// fila; si ese disco se ha reciclado desde entonces (redeploy de Railway), da igual el formato:
// `ensureInvoicePdf` lo regenera con el código de HOY. Por eso "persiste" se mide aquí como
// proxy (formato de `pdf_url`), no como hecho confirmado — confirmar el fichero en el disco
// real de cada entorno exige entrar al contenedor, fuera del alcance de un script local.
//
// ⛔ La URL de conexión nunca se imprime ni viaja en argv (SCRUM-195).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const CLAVE = process.argv[2]; // DATABASE_URL_DEV | DATABASE_URL_STAGING | DATABASE_URL (prod)
if (!CLAVE) {
  console.error('uso: node desglose-pdfurl.mjs <NOMBRE_DE_LA_VARIABLE_DE_ENTORNO>');
  process.exit(2);
}
const url = process.env[CLAVE];
if (!url) { console.error('🔴 no hay ' + CLAVE + ' en el entorno de este árbol'); process.exit(2); }

const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const [huella] = await prisma.$queryRaw`
    SELECT pg_postmaster_start_time()::text AS arranque,
           (SELECT count(*) FROM invoices)  AS total_filas`;
  console.log('── SOBRE QUÉ BASE ──────────────────────────────────────');
  console.log('   clave usada             : ' + CLAVE);
  console.log('   pg_postmaster_start_time : ' + huella.arranque);
  console.log('   filas en invoices (todas): ' + huella.total_filas);
  console.log('');

  const filas = await prisma.$queryRaw`
    SELECT
      count(*) FILTER (WHERE vf_estado = 'sellado')                                          AS emitidas,
      count(*) FILTER (WHERE vf_estado = 'sellado' AND pdf_url LIKE 'PENDING%')               AS emitidas_pending,
      count(*) FILTER (WHERE vf_estado = 'sellado' AND pdf_url = '/admin/invoices/' || id || '/pdf') AS emitidas_formato_valido,
      count(*) FILTER (
        WHERE vf_estado = 'sellado'
          AND pdf_url NOT LIKE 'PENDING%'
          AND pdf_url <> '/admin/invoices/' || id || '/pdf'
      )                                                                                        AS emitidas_formato_legado
    FROM invoices`;

  const r = filas[0];
  console.log('── FACTURAS EMITIDAS (vf_estado = sellado) ────────────────────────────');
  console.log('   total emitidas ........................: ' + r.emitidas);
  console.log('   pdf_url en PENDING_PDF/PENDING% ........: ' + r.emitidas_pending + '  (nunca generado; regenera SIEMPRE con el código de hoy)');
  console.log('   pdf_url formato válido (/admin/.../pdf) : ' + r.emitidas_formato_valido + '  (regenera SI el fichero ya no está en el disco efímero)');
  console.log('   pdf_url formato legado (estático/otro) .: ' + r.emitidas_formato_legado + '  (D4: se trata como inválido → regenera SIEMPRE)');
  console.log('');
  console.log('   🔴 "Formato válido" ≠ "persiste": sin almacenamiento externo, ninguna fila');
  console.log('      sobrevive garantizada a un redeploy. Confirmar el fichero real exige mirar');
  console.log('      el disco del contenedor de ese entorno, no esta base.');
} finally {
  await prisma.$disconnect();
}
