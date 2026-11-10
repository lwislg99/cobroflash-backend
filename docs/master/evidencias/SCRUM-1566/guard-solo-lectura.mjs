// SCRUM-1566 (c) · GUARD ESTÁTICO: un fichero .sql que va a producción sólo puede LEER.
// Uso: node guard-solo-lectura.mjs <fichero.sql>   → exit 0 si pasa; exit 1 con el motivo si no.
//
// Es la PRIMERA de dos barreras. La segunda la pone Postgres: el fichero abre `BEGIN … READ ONLY` y
// cualquier escritura dentro falla con el error 25006 (lo prueba `probar-consulta.mjs`).
//
// Qué exige, sobre el texto SIN comentarios, SIN literales '…' y SIN identificadores "…" (así una
// columna o un rótulo que se llame «update» no lo engaña, y un comentario tampoco lo calla):
//   · la primera sentencia es `BEGIN … READ ONLY` y la última `ROLLBACK`;
//   · en medio, sólo `SET LOCAL <tiempo de espera>`, `WITH …` y `SELECT …`;
//   · ninguna palabra que escriba, bloquee, consuma una secuencia o cambie la sesión.
import fs from 'node:fs';

export function motivoDeRechazo(sql) {
  const limpio = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ')   // cuerpos $$…$$ (no debería haber ninguno)
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '"x"');
  const sentencias = limpio.split(';').map((s) => s.trim()).filter(Boolean);
  if (sentencias.length < 3) return `sólo ${sentencias.length} sentencias: falta BEGIN, consulta o ROLLBACK`;
  if (!/^BEGIN\b[\s\S]*\bREAD\s+ONLY\b/i.test(sentencias[0]) || /\bREAD\s+WRITE\b/i.test(sentencias[0])) return 'la primera sentencia no es BEGIN … READ ONLY';
  if (!/^ROLLBACK$/i.test(sentencias.at(-1))) return 'la última sentencia no es ROLLBACK';
  for (const s of sentencias.slice(1, -1)) {
    if (/^SET\s+LOCAL\s+(statement_timeout|lock_timeout|idle_in_transaction_session_timeout)\b/i.test(s)) continue;
    if (!/^(WITH|SELECT)\b/i.test(s)) return `sentencia no permitida: «${s.slice(0, 60)}…»`;
  }
  const prohibida = /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE|PREPARE|LOCK|VACUUM|ANALYZE|CLUSTER|REINDEX|REFRESH|COMMIT|INTO|NOTIFY|LISTEN|NEXTVAL|SETVAL|SET_CONFIG|PG_ADVISORY_\w+|PG_TRY_ADVISORY_\w+|LO_\w+|DBLINK\w*|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_RELOAD_CONF|PG_SLEEP\w*|PG_READ_FILE|PG_READ_BINARY_FILE|PG_LS_DIR)\b/i;
  const m = prohibida.exec(sentencias.slice(1, -1).join(';'));
  if (m) return `palabra prohibida: ${m[1].toUpperCase()}`;
  return null;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const f = process.argv[2];
  if (!f) { console.log('Uso: node guard-solo-lectura.mjs <fichero.sql>'); process.exit(2); }
  const motivo = motivoDeRechazo(fs.readFileSync(f, 'utf8'));
  if (motivo) { console.log(`✖ RECHAZADA: ${motivo}`); process.exit(1); }
  console.log('✔ sólo lectura: BEGIN READ ONLY · SET LOCAL de tiempos · WITH/SELECT · ROLLBACK');
}
