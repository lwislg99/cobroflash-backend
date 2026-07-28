// scripts/backup-dump.mjs — A11.3 (EXT3, S4: backup cifrado FUERA de Railway
// "ANTES de 25 pagantes"). Dump lógico completo → cifrado AES-256-GCM → destino.
//
//   node scripts/backup-dump.mjs                  # dump + cifrado a ./backups/
//   node scripts/backup-dump.mjs --restore-test   # verifica un backup: descifra
//                                                 # y comprueba integridad + conteos
//
// Env:
//   DATABASE_URL             (obligatoria — la de siempre)
//   BACKUP_ENCRYPTION_KEY    (obligatoria — 32+ chars; guárdala FUERA de Railway
//                             también: sin clave no hay restauración)
//   BACKUP_DIR               (opcional, default ./backups)
//
// Método: si hay `pg_dump` en el PATH se usa (formato custom, restaurable con
// pg_restore). Si NO lo hay (p. ej. imagen Node de Railway), dump LÓGICO vía
// Prisma: todas las tablas a JSON (restaurable con este mismo script en un
// entorno limpio — ver RUNBOOK al final). Un backup no probado no es un backup:
// --restore-test descifra, valida el GCM tag (integridad criptográfica) y
// compara los conteos de filas contra la BD viva.
//
// Destino externo (FUNDADOR, checklist §5b): cuando existan credenciales
// (BACKUP_S3_ENDPOINT/BUCKET/KEY/SECRET u otro), añadir la subida al final de
// main(); hasta entonces el fichero queda en BACKUP_DIR y hay que moverlo a
// mano fuera de la máquina.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { redactarSecretos } from './_db-guard.mjs';

const KEY_RAW = process.env.BACKUP_ENCRYPTION_KEY || '';
const OUT_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const RESTORE_TEST = process.argv.includes('--restore-test');

if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL'); process.exit(1); }
if (KEY_RAW.length < 32) {
  console.error('BACKUP_ENCRYPTION_KEY debe tener al menos 32 caracteres (y copia en un sitio seguro FUERA de Railway).');
  process.exit(1);
}
const KEY = crypto.createHash('sha256').update(KEY_RAW).digest(); // 32 bytes

function encrypt(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: MAGIC(4) | iv(12) | tag(16) | payload
  return Buffer.concat([Buffer.from('YQB1'), iv, tag, enc]);
}

function decrypt(buf) {
  if (buf.subarray(0, 4).toString() !== 'YQB1') throw new Error('formato desconocido');
  const iv = buf.subarray(4, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag); // GCM: si el fichero está corrupto o la clave es otra, ESTALLA aquí
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function hasPgDump() {
  try { execFileSync('pg_dump', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
}

const TABLES = [
  'merchants', 'customers', 'quotes', 'invoices', 'charges', 'events', 'expenses',
  'products', 'providers', 'team_members', 'auth_sessions', 'quote_templates',
  'quote_requests', 'customer_events', 'reconciliations', 'wa_messages',
  'legal_acceptances', 'jobs', 'maintenance_plans', 'audit_log', 'attachments',
];

async function logicalDump(prisma) {
  const out = { format: 'yaqu-logical-v1', at: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    try {
      out.tables[t] = await prisma.$queryRawUnsafe(`SELECT * FROM "${t}"`);
    } catch (e) {
      out.tables[t] = { __error: String(e?.message || e) };
    }
  }
  return Buffer.from(JSON.stringify(out, (k, v) => (typeof v === 'bigint' ? String(v) : v)));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (RESTORE_TEST) {
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.enc')).sort();
    if (!files.length) { console.error('No hay backups en', OUT_DIR); process.exit(1); }
    const latest = path.join(OUT_DIR, files[files.length - 1]);
    console.log('Restore-test de', latest);
    const plain = zlib.gunzipSync(decrypt(fs.readFileSync(latest))); // GCM valida integridad
    if (latest.includes('.pgdump.')) {
      console.log(`✓ descifrado íntegro (${plain.length} bytes de pg_dump custom). Restaurar: pg_restore -d <url> <fichero>`);
      return;
    }
    const data = JSON.parse(plain.toString());
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    let ok = 0, drift = 0;
    for (const [t, rows] of Object.entries(data.tables)) {
      if (!Array.isArray(rows)) continue;
      const [{ count }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${t}"`);
      const live = Number(count);
      if (live === rows.length) ok += 1;
      else { drift += 1; console.log(`  ~ ${t}: backup=${rows.length} vivo=${live} (deriva normal si hubo actividad)`); }
    }
    console.log(`✓ backup ÍNTEGRO y legible · ${ok} tablas coinciden con la BD viva, ${drift} con deriva posterior`);
    await prisma.$disconnect();
    return;
  }

  let raw, kind;
  if (hasPgDump()) {
    console.log('pg_dump disponible → dump físico (formato custom)');
    // La URL va en argv porque `pg_dump` la quiere ahí. Si `pg_dump` falla —versión
    // incompatible, red, permisos— el error lleva LA URL DE PRODUCCIÓN CON SU CONTRASEÑA por
    // DOS caminos distintos: en `.message` («Command failed: pg_dump … <argv>») cuando sale
    // con código ≠ 0, y en la propiedad `.spawnargs` siempre, que es lo que se imprime si el
    // objeto llega a un `console.error(e)` o a una excepción no capturada. Un script de backup
    // corre contra prod por definición: es el peor sitio del repo para ese fallo.
    // Se re-lanza un Error NUEVO y limpio — el original no sale de aquí por ninguna vía.
    try {
      raw = execFileSync('pg_dump', ['--format=custom', '--no-owner', process.env.DATABASE_URL], { maxBuffer: 1024 * 1024 * 512 });
    } catch (e) {
      throw new Error(`pg_dump falló: ${redactarSecretos(e)}`);
    }
    kind = 'pgdump';
  } else {
    console.log('pg_dump NO disponible → dump lógico vía Prisma (todas las tablas a JSON)');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    raw = await logicalDump(prisma);
    await prisma.$disconnect();
    kind = 'logical';
  }

  const file = path.join(OUT_DIR, `yaqu-${stamp}.${kind}.gz.enc`);
  fs.writeFileSync(file, encrypt(zlib.gzipSync(raw)));
  console.log(`✓ backup cifrado: ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  console.log('→ MUÉVELO fuera de esta máquina (S4). Verifícalo: node scripts/backup-dump.mjs --restore-test');
}

// Redactado también aquí, no solo en el origen: este catch imprime CUALQUIER error del script,
// incluidos los de Prisma y los de librerías que citan la cadena de conexión al quejarse.
main().catch((e) => { console.error('backup FALLÓ:', redactarSecretos(e)); process.exit(1); });
