// scripts/backup-bd.mjs — SCRUM-242
//
// EL BACKUP DE LA BASE, CON SU RESTAURACIÓN COMPROBADA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES CÓDIGO Y NO UNA CASILLA
//
// La copia automática de Railway exige plan Pro. Así que la copia la hace esto — y al hacerla
// nosotros, la parte que de verdad importa deja de ser opcional: **comprobar que se puede
// restaurar**. Un backup que nunca se ha restaurado no es un backup, es un fichero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 NINGUNA CADENA DE CONEXIÓN SALE DE AQUÍ. NI REAL NI DE EJEMPLO.
//
// Todo lo que toca una URL pasa por `_db-guard.mjs`:
//   · `describirBD()`      → la etiqueta que SÍ se imprime: `host/base`, sin usuario ni contraseña.
//   · `partirBDParaHijo()` → la URL sin contraseña para el argv y la contraseña para el entorno
//                            del hijo, partida en el único módulo exento (SCRUM-408).
//   · `redactarSecretos()` → última línea antes de imprimir cualquier error ajeno: la URL viaja en
//                            `e.input`, `e.spawnargs` y en el volcado del objeto, no solo en
//                            `.message`.
// Y no hay ninguna URL de ejemplo en los comentarios: la que se escribe «para ilustrar» es la que
// alguien copia y pega con datos reales.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LAS VARIABLES, Y CUÁL ES DECISIÓN DEL FUNDADOR
//
//   DATABASE_URL              (o BACKUP_BD_URL)  · qué base se copia.
//   BACKUP_PG_BIN             · carpeta con `pg_dump`/`pg_restore`/`psql`. Sin esto no hay backup.
//   BACKUP_VERIFICACION_URL   · una base VACÍA donde restaurar para comprobar. 🔴 Sin ella el
//                               backup NO se puede llamar backup, y el script sale con error.
//   BACKUP_DESTINO_TIPO/RUTA  · 🛑 el destino externo. **No lo elige este script**: es coste
//                               recurrente (regla 36) y lo decide el fundador. Aquí solo se lee.
//
// ⚠️ `BACKUP_VERIFICACION_URL` tiene que apuntar a una base DESECHABLE. El script restaura con
// `--clean`, así que lo que haya dentro se pierde: por eso se niega a usar la misma base de origen.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describirBD, partirBDParaHijo, redactarSecretos, parseBDSegura, PROD_HOST } from './_db-guard.mjs';
import {
  tablasDelInventario, veredictoDelBackup, destinoDeclarado, VERIFICADO, NO_VERIFICADO, CIEGO,
} from './_backup-nucleo.mjs';

// 🔴 `backups/` y NO `.backups/`: es la carpeta que `.gitignore` YA ignora, con su motivo escrito
// al lado —«dumps cifrados locales (datos de prod — JAMÁS al repo)»—. Mi primer valor por defecto
// llevaba punto y **no estaba ignorado**: un volcado de la base de clientes habría entrado en el
// repo en el siguiente `git add -A`. Reutilizar la convención que ya existe es más seguro que
// añadir una segunda y acordarse de ignorarla.
const SALIDA = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

function abortar(motivo) {
  console.error(`\n🔴 ${motivo}`);
  console.error('   Sin esto NO se puede afirmar que haya copia. Se sale con error a propósito:');
  console.error('   un backup que no se puede demostrar es peor que ninguno, porque se confía en él.');
  process.exit(1);
}

/** Ejecuta un binario de Postgres con la contraseña SOLO en el entorno del hijo, nunca en argv. */
function pg(binDir, nombre, args, password, opciones = {}) {
  const exe = path.join(binDir, process.platform === 'win32' ? `${nombre}.exe` : nombre);
  if (!fs.existsSync(exe)) abortar(`no encuentro \`${nombre}\` en la carpeta de BACKUP_PG_BIN`);
  try {
    return execFileSync(exe, args, {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      ...opciones,
      env: { ...process.env, PGPASSWORD: password, ...(opciones.env || {}) },
    });
  } catch (e) {
    // 🔴 `redactarSecretos` sobre el OBJETO, no sobre `.message`: en un exit≠0 la URL va en el
    // mensaje Y en `spawnargs`, y el volcado del objeto es lo que la publicaría.
    console.error(`🔴 fallo de \`${nombre}\`:`, redactarSecretos(e));
    return null;
  }
}

/** Cuenta las tablas de una base. `null` si no se pudo contar — que NO es cero. */
function contarTablas(binDir, urlSinPass, password) {
  const salida = pg(binDir, 'psql', [
    urlSinPass, '-tAc',
    "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  ], password);
  if (salida === null) return null;
  const n = Number(String(salida).trim());
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const urlOrigen = process.env.BACKUP_BD_URL || process.env.DATABASE_URL;
  if (!parseBDSegura(urlOrigen)) abortar('no hay una URL de base legible en `BACKUP_BD_URL`/`DATABASE_URL`');

  const binDir = process.env.BACKUP_PG_BIN;
  if (!binDir || !fs.existsSync(binDir)) {
    abortar('falta `BACKUP_PG_BIN` (carpeta con pg_dump/pg_restore/psql). No se puede volcar nada.');
  }

  // 🛑 PRODUCCION NO SE TOCA, NI PARA LEER (GO del fundador, 12-ago-2026). Un volcado de prod se
  // lleva la base de clientes entera a disco: eso es una decision suya en cada ocasion, no algo
  // que este script pueda hacer porque alguien exporto una variable.
  if (parseBDSegura(urlOrigen).host === PROD_HOST) {
    abortar('el ORIGEN apunta a PRODUCCION. Este script no vuelca produccion: un volcado se lleva ' +
      'la base de clientes entera a disco. Apunta a staging.');
  }

  const origen = partirBDParaHijo(urlOrigen);
  console.log(`▶ base de origen: ${describirBD(urlOrigen)}`);   // host/base y nada más

  // ── ① EL VOLCADO ─────────────────────────────────────────────────────────────────────
  fs.mkdirSync(SALIDA, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const fichero = path.join(SALIDA, `yaqu-${sello}.dump`);

  // Formato `custom` (-Fc): ya viene COMPRIMIDO (zlib, -Z 9) y —lo que importa— tiene INVENTARIO,
  // así que se puede leer sin restaurar. Un `.sql` plano + gzip no permite comprobar nada sin
  // descomprimirlo entero y aun así no dice qué tablas trae.
  const dump = pg(binDir, 'pg_dump', ['-Fc', '-Z', '9', '--no-owner', '--no-acl', '-f', fichero, origen.urlSinPass], origen.password);
  if (dump === null || !fs.existsSync(fichero)) abortar('el volcado no se ha creado');
  const bytes = fs.statSync(fichero).size;
  console.log(`▶ volcado: ${path.basename(fichero)} · ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  if (bytes === 0) abortar('el volcado tiene 0 bytes');

  // ── ② ¿SE PUEDE LEER? — inventario, no `existsSync` ─────────────────────────────────
  const inventario = pg(binDir, 'pg_restore', ['--list', fichero], origen.password);
  const tablasVolcado = tablasDelInventario(inventario);
  console.log(`▶ inventario legible: ${tablasVolcado ? `${tablasVolcado.size} tablas` : '🔴 NO'}`);

  const tablasOrigen = contarTablas(binDir, origen.urlSinPass, origen.password);
  console.log(`▶ tablas en origen: ${tablasOrigen ?? '🔴 no se pudo contar'}`);

  // ── ③ 🔴 LA RESTAURACIÓN, que es lo que convierte el fichero en un backup ────────────
  let tablasDestino = null;
  const urlVerif = process.env.BACKUP_VERIFICACION_URL;
  if (!parseBDSegura(urlVerif)) {
    console.log('▶ restauración: 🔴 SIN `BACKUP_VERIFICACION_URL` — no se ha restaurado nada');
  } else if (describirBD(urlVerif) === describirBD(urlOrigen)) {
    abortar('`BACKUP_VERIFICACION_URL` apunta a la MISMA base que el origen. Se restaura con '
      + '`--clean`: eso borraría la base que se acaba de copiar.');
  } else if (parseBDSegura(urlVerif).host === PROD_HOST) {
    abortar('`BACKUP_VERIFICACION_URL` apunta a PRODUCCIÓN. Se restaura con `--clean`.');
  } else {
    const verif = partirBDParaHijo(urlVerif);
    console.log(`▶ restaurando en: ${describirBD(urlVerif)}`);

    // 🔴 EL DESTINO TIENE QUE ESTAR VACÍO, Y SE COMPRUEBA ANTES DE ESCRIBIR NADA.
    //
    // `pg_restore --clean` borra lo que encuentre. Si esa base no estaba vacía, lo que había NO
    // era lo que se esperaba —otra copia, un experimento de alguien, una base en uso— y
    // machacarlo no se deshace. Y además invalida la prueba: restaurar sobre algo distinto de
    // cero hace que el recuento final no diga lo que parece.
    const yaHabia = contarTablas(binDir, verif.urlSinPass, verif.password);
    if (yaHabia === null) {
      abortar('no se pudo contar las tablas del destino ANTES de restaurar. Sin saber si estaba '
        + 'vacío no se escribe: `--clean` es destructivo y no se deshace.');
    }
    if (yaHabia > 0) {
      abortar(`el destino de verificación NO estaba vacío: tiene ${yaHabia} tablas. No se ha `
        + 'escrito nada. Restaurar encima de algo que no esperabas es destructivo y no se '
        + 'deshace — vacíalo a conciencia o apunta a otra base desechable.');
    }
    console.log('▶ destino vacío antes de restaurar: sí (0 tablas)');

    pg(binDir, 'pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-acl', '-d', verif.urlSinPass, fichero], verif.password);
    tablasDestino = contarTablas(binDir, verif.urlSinPass, verif.password);
    console.log(`▶ tablas tras restaurar: ${tablasDestino ?? '🔴 no se pudo contar'}`);
  }

  // ── ④ EL VEREDICTO ───────────────────────────────────────────────────────────────────
  const v = veredictoDelBackup(tablasOrigen, tablasVolcado, tablasDestino);
  const destino = destinoDeclarado();
  console.log(`\n▶ destino externo: ${destino.hayDestino ? `${destino.tipo} → ${destino.ruta}` : `(ninguno) ${destino.motivo}`}`);
  console.log(`\n═══ ${v.estado} · ${v.motivo}`);

  if (v.estado === VERIFICADO) {
    console.log('   El volcado se ha restaurado en una base vacía y el recuento cuadra.');
    if (!destino.hayDestino) {
      console.log('   ⚠️ Queda EN DISCO: sin destino externo, una copia en la misma máquina no es una copia.');
    }
    process.exit(0);
  }
  if (v.estado === NO_VERIFICADO) {
    abortar('NO_VERIFICADO — ' + v.motivo);
  }
  abortar('CIEGO — ' + v.motivo);
}

main().catch((e) => {
  console.error('🔴 error inesperado:', redactarSecretos(e));
  process.exit(1);
});
