#!/usr/bin/env node
// scripts/preflight-migracion.mjs — SCRUM-395 · LA PUERTA DE ANTES.
//
// Se corre ANTES de aplicar cualquier fichero de SQL a una base. Hace dos comprobaciones, y las
// dos nacen del mismo incidente (7-ago-2026, migración de C5):
//
//   ① ¿estoy en la rama que creo?   → el árbol se movió bajo los pies de la migración
//   ② ¿qué dice este SQL?           → `--accept-data-loss` NO cubre `db execute --file`
//
// ESTO NO EJECUTA NINGUNA MIGRACIÓN. No abre conexión, no lee `.env`, no toca ninguna base.
// Es la puerta, no el paso.
//
//   node scripts/preflight-migracion.mjs --rama <rama-esperada> --sql <fichero.sql>
//   node scripts/preflight-migracion.mjs --rama <rama> --sql <f.sql> --autoriza <huella>:<motivo>
//
// El código de salida es el contrato: 0 = puedes aplicar · 1 = NO apliques.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preflightRama, COINCIDE } from './_preflight-migracion.mjs';
import { clasificarFichero, informe } from './_clasificador-sql.mjs';

export function ejecutar(argv, { cwd = process.cwd() } = {}) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const rama = arg('--rama');
  const sql = arg('--sql');
  const autorizaciones = argv
    .map((a, i) => (a === '--autoriza' ? argv[i + 1] : null))
    .filter(Boolean)
    .map((v) => {
      const [huella, ...resto] = String(v).split(':');
      return { huella: huella.trim(), motivo: resto.join(':').trim() || '(sin motivo escrito)', autorizadaPor: os.userInfo().username };
    });

  const lineas = [];
  let fallos = 0;

  // ── ① RAMA ────────────────────────────────────────────────────────────────
  const r = preflightRama(rama, { cwd });
  lineas.push(r.veredicto === COINCIDE ? `  ${r.mensaje}` : `\n${r.mensaje}\n`);
  if (r.veredicto !== COINCIDE) fallos++;

  // ── ② SQL ─────────────────────────────────────────────────────────────────
  if (!sql) {
    lineas.push('\n🔴 NO SE DECLARÓ NINGÚN FICHERO DE SQL (`--sql`). No hay nada que clasificar,\n' +
      '   y un preflight sin objeto no puede salir en verde.\n');
    fallos++;
  } else {
    const abs = path.isAbsolute(sql) ? sql : path.join(cwd, sql);
    if (!fs.existsSync(abs)) {
      lineas.push(`\n🔴 EL FICHERO DE SQL NO EXISTE: ${sql}\n   Un fichero que no está no es un fichero limpio.\n`);
      fallos++;
    } else {
      const c = clasificarFichero(fs.readFileSync(abs, 'utf8'), { autorizaciones });
      lineas.push(informe(c));
      if (!c.ok) fallos++;
    }
  }

  return { fallos, salida: lineas.join('\n') };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
// `fileURLToPath`, no comparar `import.meta.url` con `argv[1]` a pelo: la ruta de este repo lleva
// un espacio y esa comparación cruda convierte el guard en un NO-OP con exit 0 (SCRUM-235).
const esCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esCli) {
  const r = ejecutar(process.argv.slice(2));
  console.log('\n[preflight de migración] SCRUM-395');
  console.log(r.salida);
  if (r.fallos > 0) {
    console.error(`\n❌ ${r.fallos} bloqueo(s). NO apliques este SQL.\n`);
    process.exit(1);
  }
  console.log('\n✅ preflight en verde: rama declarada = rama real, y todas las sentencias son aditivas.\n');
}
if (!esCli && process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.error('🔴 se ejecutó como script pero NO se reconoció como CLI (SCRUM-235).');
  process.exit(1);
}
