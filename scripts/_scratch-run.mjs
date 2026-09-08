// scripts/_scratch-run.mjs — SCRUM-242 · lanzar algo CONTRA LA BASE DESECHABLE, y solo contra ella.
//
//   node scripts/_scratch-run.mjs <comando> [args…]
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// La prueba de restauración necesita una BD, y la única legítima es `postgres-scratch`. Pero su
// URL vive en el MISMO `.env` que la de producción, así que hacerlo a mano es exactamente el
// escenario que SCRUM-196 pagó con una credencial rotada:
//
//   · `DATABASE_URL=$(…) npx prisma …` mete la cadena en la línea del shell (historial, y de ahí
//     a cualquier volcado de diagnóstico);
//   · un `console.log` de depuración la publica;
//   · un error de `execFileSync` la lleva en `.message` y en `.spawnargs`.
//
// Aquí la URL **se lee del fichero y se pasa SOLO por el entorno del hijo**. No entra en argv, no
// se imprime, y el proceso muere si el destino no es el que debe ser.
//
// ── EL CANDADO, Y ES LO IMPORTANTE ─────────────────────────────────────────────────────────
// Antes de arrancar nada se comprueba que el host NO es producción ni staging, usando la MISMA
// lista que el resto del proyecto (`_db-guard.mjs`). Si el `.env` cambiara y `SCRATCH_DATABASE_URL`
// apuntara a otro sitio, esto **para** en vez de escribir.
//
// Es fail-closed: sin variable, sin parseo o con host prohibido, no se ejecuta nada.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describirBD, destinoDesechable } from './_db-guard.mjs';

// El `.env` del checkout principal: los worktrees no tienen el suyo.
const CANDIDATOS = ['.env', '.env.local', '../cobroflash-backend/.env', '../cobroflash-backend/.env.local'];

function leerScratch() {
  for (const f of CANDIDATOS) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/^SCRATCH_DATABASE_URL=(.*)$/m);
    if (m) return { url: m[1].trim().replace(/^['"]|['"]$/g, ''), fichero: f };
  }
  return null;
}

const encontrado = leerScratch();
if (!encontrado) {
  console.error('🔴 SCRATCH_DATABASE_URL no está en ningún .env conocido. No se ejecuta nada.');
  process.exit(1);
}

// SCRUM-746 (fase B) · EL CANDADO ES EL MISMO, y ahora vive en `_db-guard.mjs`.
// No cambia lo que decide: ni producción ni staging, y fail-closed si no se puede leer. Lo que
// cambia es que **ya no vive sólo aquí**: `backup-restore.mjs` —que es quien escribe— lo llama
// también, porque tiene entrada propia y no comprobaba haber llegado por este runner.
const veredicto = destinoDesechable(encontrado.url);
if (!veredicto.ok) {
  console.error(`🔴 SCRATCH_DATABASE_URL → ${veredicto.etiqueta}: ${veredicto.motivo} No se ejecuta nada.`);
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('uso: node scripts/_scratch-run.mjs <comando> [args…]');
  process.exit(2);
}

console.log(`→ contra la base DESECHABLE (${describirBD(encontrado.url)}), leída de ${encontrado.fichero}`);
const r = spawnSync(cmd, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  // La URL entra por el ENTORNO del hijo, nunca por su argv.
  env: { ...process.env, DATABASE_URL: encontrado.url },
});
process.exit(r.status ?? 1);
