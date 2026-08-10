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
// Prisma: todas las tablas a JSON.
//
// ⚠️ SCRUM-242 · AQUÍ HABÍA UNA PROMESA FALSA, y se retiró en vez de dejarla: esta línea decía
// que el dump lógico era «restaurable con este mismo script en un entorno limpio — ver RUNBOOK al
// final». **Ese RUNBOOK nunca existió** (una sola mención en el fichero: la promesa), y
// `docs/RUNBOOKS.md` tampoco tenía procedimiento de restauración.
//
// Y la promesa era doble, porque este script **no restaura**: sus dos modos son volcar y
// `--restore-test`, y NINGUNO escribe de vuelta en la base. `--restore-test` VERIFICA —descifra,
// valida el tag GCM y compara conteos—, que no es lo mismo.
//
// Quien leía la cabecera se quedaba tranquilo y no lo buscaba hasta necesitarlo, que es a las tres
// de la mañana con la base caída.
//
// ── ESTADO REAL HOY, y por eso vuelve a haber un puntero ───────────────────────────────────────
// El procedimiento es **`docs/RUNBOOKS.md` §R14** y quien escribe de vuelta es
// **`scripts/backup-restore.mjs`**. Se probó de punta a punta contra una base desechable —volcar,
// vaciar, restaurar, comparar, emitir— y la prueba **encontró dos fallos que hacían este volcado
// lógico irrestaurable**: los tipos (JSON no tiene fechas ni decimales) y el orden de inserción.
// Ninguno se veía leyendo el código. Evidencia: `docs/evidencias/scrum242-restauracion.md`.
//
// La diferencia con la promesa anterior es que esta apunta a documentos que existen y a una prueba
// que se puede abrir. Lo vigila `tests/scrum242-scripts-no-prometen-documentos.test.mjs`.
//
// Lo que sigue SIN resolver es lo otro que midió el ticket: **nadie dispara este script** (0
// invocaciones frente a 11/7/5 de otros). Un backup restaurable que nadie genera sigue sin salvar
// la base.
//
// Un backup no probado no es un backup:
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
// SCRUM-408 · el parseo seguro y la redacción viven en UN solo sitio (SCRUM-195/226).
import { partirBDParaHijo, redactarSecretos } from './_db-guard.mjs';
// SCRUM-242 · el códec de bytes lo comparten volcado y restauración: ver `_backup-codec.mjs`.
import { FORMATO_ACTUAL, esBinario, codificarBinario } from './_backup-codec.mjs';

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

// SCRUM-241: esta lista es EXACTAMENTE las tablas del schema, y la ata el guard
// tests/scrum241-backup-tablas.test.mjs (deriva las tablas de @@map / nombre de modelo). Un modelo
// nuevo cuya tabla no esté aquí sale ROJO — antes esta lista derivaba en silencio y el dump lógico
// perdía tablas mudamente (`wa_messages` no existía; faltaban albaranes y bot_sessions).
const TABLES = [
  'merchants', 'customers', 'quotes', 'invoices', 'charges', 'events', 'expenses',
  'products', 'providers', 'team_members', 'auth_sessions', 'quote_templates',
  'quote_requests', 'customer_events', 'reconciliations', 'whatsapp_messages',
  'legal_acceptances', 'jobs', 'maintenance_plans', 'audit_log', 'attachments',
  'bot_sessions', 'albaranes', 'albaran_lineas_facturadas',
];

async function logicalDump(prisma) {
  const out = { format: FORMATO_ACTUAL, at: new Date().toISOString(), tables: {} };
  const fallos = [];
  for (const t of TABLES) {
    try {
      out.tables[t] = await prisma.$queryRawUnsafe(`SELECT * FROM "${t}"`);
    } catch (e) {
      fallos.push(`${t}: ${String(e?.message || e)}`);
    }
  }
  // SCRUM-241: FAIL-CLOSED. Antes se guardaba `{__error}` por tabla y el dump se anunciaba «con
  // éxito»: un backup parcial que miente sobre estar completo es peor que uno que falla a gritos
  // (misma doctrina que el preflight con su exit 2). Si UNA sola tabla no se vuelca, no hay backup:
  // se lanza, `main().catch` sale ≠ 0 y NO se escribe fichero.
  if (fallos.length) {
    throw new Error(`backup lógico INCOMPLETO: ${fallos.length} tabla(s) no se pudieron volcar:\n  ${fallos.join('\n  ')}`);
  }
  // ⚠️ EL BASE64 NO ES COSMÉTICO: ES EL TECHO DEL BACKUP. Sin él, un byte de fichero ocupa ~12,5
  // caracteres (`{"0":137,…}`) y como todo esto acaba en UNA cadena, `MAX_STRING_LENGTH` se alcanza
  // a los ~41 MB de fotos — OCHO, con `FOTO_MAX_BYTES` a 5 MB. Y no se degrada: LANZA, y el
  // fail-closed de arriba no escribe fichero. En base64 el factor es 1,34× y el techo ~400 MB.
  return Buffer.from(JSON.stringify(out, (k, v) => {
    if (typeof v === 'bigint') return String(v);
    if (esBinario(v)) return codificarBinario(v);
    return v;
  }));
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
    const tablas = data.tables || {};
    // SCRUM-241: SUELO, ANTES de tocar la BD (así un dump roto se caza sin conexión). Un {__error}
    // —tabla que reventó al volcar— es FALLO, no algo que saltar con `continue`; y traer MENOS
    // tablas de las esperadas es «no miré», no «todo bien». Un cero que puede significar las dos
    // cosas no es una verificación.
    const faltan = TABLES.filter((t) => !(t in tablas));
    const erroneas = Object.keys(tablas).filter((t) => !Array.isArray(tablas[t]));
    if (faltan.length || erroneas.length) {
      console.error('✗ restore-test FALLÓ: el backup NO está completo/íntegro (SCRUM-241).');
      if (faltan.length) console.error(`  faltan ${faltan.length} tabla(s) esperada(s): ${faltan.join(', ')}`);
      // SCRUM-408 · redactado: `erroneas` sale de la salida de `pg_restore`, que puede traer la
      // cadena de conexión dentro de su propio mensaje de error.
      if (erroneas.length) console.error(redactarSecretos(`  ${erroneas.length} tabla(s) con error en el volcado (no son filas): ${erroneas.join(', ')}`));
      process.exit(1);
    }
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    let ok = 0, drift = 0;
    for (const [t, rows] of Object.entries(tablas)) {
      const [{ count }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${t}"`);
      const live = Number(count);
      if (live === rows.length) ok += 1;
      else { drift += 1; console.log(`  ~ ${t}: backup=${rows.length} vivo=${live} (deriva normal si hubo actividad)`); }
    }
    // SUELO nº2: se verificaron al menos las tablas esperadas — un conteo menor sería «no miré».
    if (ok + drift < TABLES.length) {
      console.error(`✗ restore-test FALLÓ: verificadas ${ok + drift} tablas, esperadas ${TABLES.length}.`);
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log(`✓ backup ÍNTEGRO y legible · ${ok} tablas coinciden con la BD viva, ${drift} con deriva posterior`);
    await prisma.$disconnect();
    return;
  }

  let raw, kind;
  if (hasPgDump()) {
    console.log('pg_dump disponible → dump físico (formato custom)');
    // SCRUM-196: la contraseña NO va en argv. Un secreto en argv es visible por CUALQUIER usuario
    // de la máquina vía `ps` (/proc/<pid>/cmdline) Y —si pg_dump falla— en el mensaje de
    // execFileSync («Command failed: <cmd con TODOS los args>», verificado con canario). Redactar
    // el mensaje taparía solo esa 2ª vía y dejaría `ps` abierta: el arreglo de raíz es SACAR la
    // contraseña de argv. Se pasa por PGPASSWORD (entorno del hijo) y a pg_dump una URL SIN
    // contraseña (conserva host/usuario/base/params, que no son secretos).
    //
    // ⚠️ CONTRAINTUITIVO, NO lo «simplifiques» de vuelta: pasar la URL como ARGUMENTO (no por una
    // línea de shell) es la práctica CORRECTA contra inyección de shell — y es JUSTO esa buena
    // práctica la que mete el secreto en argv (visible en `ps`) y en e.message. Volver a una línea
    // de shell cambiaría una fuga de credenciales por una inyección: peor. La salida es PGPASSWORD.
    //
    // VÍA QUE QUEDA ABIERTA, declarada (esto NO la cierra): el entorno vive en /proc/<pid>/environ,
    // mode 0400 → legible por el DUEÑO del proceso y root, NO por otros usuarios (argv en `ps` sí).
    // Se mueve el secreto de world-visible a owner-only. Elegido sobre un fichero .pgpass: misma
    // exposición owner-only, pero sin fichero temporal que crear/chmod/limpiar ni el riesgo de que
    // un crash lo deje en disco.
    // SCRUM-408 · EL PARSEO NO SE HACE AQUÍ. `partirBDParaHijo` vive en `_db-guard.mjs`, el único
    // módulo cuyo `new URL` está dentro de un `try` cuyo `catch` NO TOCA EL ERROR.
    //
    // Lo de antes no fugaba —su `catch` imprimía un texto fijo—, pero esa seguridad dependía de
    // que ESE catch siguiera siendo correcto para siempre, en un fichero que edita cualquiera. Esa
    // apuesta ya se perdió una vez, con una credencial de producción por medio: el arreglo es que
    // el parseo viva en un solo sitio, no que cada sitio lo haga con cuidado.
    const partes = partirBDParaHijo(process.env.DATABASE_URL);
    if (!partes) {
      console.error('backup FALLÓ: DATABASE_URL no es una URL válida (no se vuelca la cadena).');
      process.exit(1);
    }
    const { urlSinPass, password: pgPassword } = partes;
    raw = execFileSync('pg_dump', ['--format=custom', '--no-owner', urlSinPass], {
      env: { ...process.env, PGPASSWORD: pgPassword },
      maxBuffer: 1024 * 1024 * 512,
    });
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

main().catch((e) => { console.error('backup FALLÓ:', redactarSecretos(e?.message || e)); process.exit(1); });
