#!/usr/bin/env node
// scripts/turno-staging.mjs — SCRUM-232: el turno de staging, SUELTO y consultable.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO QUE CIERRA
//
// `RUNBOOKS.md` documentaba cómo LIBERAR el turno a mano, pero no cómo TOMARLO: lo tomaba solo
// `npm run test:staging:gated`, al arrancar. Así que sostenerlo durante cualquier otra operación
// contra staging —un `npm install` en el árbol compartido, una semilla, una conciliación—
// obligaba a improvisar un script cada vez. Se improvisó dos veces el 30-jul-2026, y la segunda
// se descubrió que `assertSafeStagingUrl` devuelve `{safe}` y no `{ok}`: leerlo mal daba un
// rechazo con motivo vacío. Un procedimiento que hay que reinventar en cada uso no es un
// procedimiento.
//
// Y `estado` es el modo que da sentido a SCRUM-232: quien llega y ve el turno tomado puede
// PREGUNTAR qué está corriendo sin lanzar una tanda para averiguarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE NO HACE, y es deliberado
//
// NO rompe locks ajenos. Para eso está `marcar-staging.mjs`, que es el único con esa
// responsabilidad, y solo se usa sabiendo que la otra sesión está muerta. Este script se limita
// a tomar lo que está libre, soltar lo propio y contar lo que hay.
//
//   node scripts/turno-staging.mjs estado
//   node scripts/turno-staging.mjs tomar  [--ref <rama-o-ticket>] [--minutos <N>]
//   node scripts/turno-staging.mjs soltar [--marca <marca>]
//
// Regla 9: no imprime NUNCA la URL. Solo el nombre de la base y el marcador.
import 'dotenv/config';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import {
  adquirirLock, soltarLock, leerMarcaCruda, parsearLock, parsearContexto, leerComentarioSchema,
  esMarcaDeStaging, tieneSufijoIlegible, estaRancio, idDeSesion, formatearDuracion,
  lineasDeContexto, TTL_POR_DEFECTO_MS, CODIGO_SALIDA_LOCK_AJENO,
} from './_staging-lock.mjs';
import { assertSafeStagingUrl, STAGING_HOST } from './_db-guard.mjs';

// Dónde se recuerda la marca propia entre `tomar` y `soltar`. El pid cambia entre invocaciones,
// así que `soltar` no puede recomponerla: o se recuerda, o se pasa a mano. Si el fichero se
// pierde, el TTL sigue siendo el mecanismo que de verdad libera el turno.
const FICHERO_MARCA = path.join(os.tmpdir(), 'yaqu-turno-staging.json');

const args = process.argv.slice(2);
const modo = args[0];
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

function ramaActual() {
  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  const n = r.status === 0 ? (r.stdout || '').trim() : '';
  return n && n !== 'HEAD' ? n : 'sin-ref';
}

if (!['estado', 'tomar', 'soltar'].includes(modo)) {
  console.error('\nuso:  node scripts/turno-staging.mjs estado');
  console.error('      node scripts/turno-staging.mjs tomar  [--ref <rama-o-ticket>] [--minutos <N>]');
  console.error('      node scripts/turno-staging.mjs soltar [--marca <marca>]\n');
  process.exit(2);
}

const urlStaging = process.env.DATABASE_URL_STAGING;
if (!urlStaging) {
  console.error('\n❌ falta DATABASE_URL_STAGING en el entorno. Sin ella no hay turno.\n');
  process.exit(2);
}
{
  // La misma allowlist INCONDICIONAL que el runner: este script escribe sobre la barrera de
  // SCRUM-118. El contrato devuelve `safe`, no `ok` — leerlo mal da un rechazo con motivo vacío.
  const check = assertSafeStagingUrl(urlStaging, process.env.DATABASE_URL);
  if (!check.safe) {
    console.error(`\n❌ DATABASE_URL_STAGING no es una URL de staging segura (${check.reason}).`);
    console.error(`   Solo se opera contra el host de STAGING: ${STAGING_HOST}.\n`);
    process.exit(2);
  }
}

const cliente = new PrismaClient({ datasources: { db: { url: urlStaging } } });

try {
  if (modo === 'estado') {
    const { db, marca, ahoraMs } = await leerMarcaCruda(cliente);
    if (!esMarcaDeStaging(marca)) {
      console.log(`\n⚠️  La base "${db}" NO lleva el marcador de staging (leído: ${JSON.stringify(marca)}).`);
      console.log('   Marcarla es cosa de scripts/marcar-staging.mjs, no de este script.\n');
      process.exit(2);
    }
    const lock = parsearLock(marca);
    if (!lock) {
      console.log(`\n✅ Turno LIBRE en la base "${db}".`);
      if (tieneSufijoIlegible(marca)) {
        console.log('   (el marcador trae un sufijo que no se entiende; se reescribirá al tomarlo)');
      }
      console.log('');
    } else {
      const rancio = estaRancio(lock, ahoraMs, TTL_POR_DEFECTO_MS);
      const ctx = parsearContexto(await leerComentarioSchema(cliente), lock.dueño);
      console.log(`\n${rancio ? '⏳' : '🔒'} Turno ${rancio ? 'RANCIO (se reclama solo)' : 'TOMADO'} en la base "${db}".`);
      console.log(`   Lo tiene «${lock.dueño}» desde ${lock.desdeIso} (hace ${formatearDuracion(ahoraMs - lock.desdeMs)}).`);
      process.stdout.write(lineasDeContexto(ctx, ahoraMs));
      console.log('');
    }
  }

  if (modo === 'tomar') {
    const minutos = Number(opcion('minutos')) > 0 ? Number(opcion('minutos')) : 15;
    const ref = opcion('ref') || ramaActual();
    const dueño = idDeSesion(os.hostname(), process.pid);
    const r = await adquirirLock(cliente, {
      dueño, ttlMs: TTL_POR_DEFECTO_MS,
      tipo: 'suelto', ref, finPrevistoMs: Date.now() + minutos * 60 * 1000,
    });

    if (!r.ok && r.motivo === 'no-es-staging') {
      console.error(`\n❌ la base "${r.db}" NO lleva el marcador de staging (leído: ${JSON.stringify(r.marca)}).\n`);
      process.exit(2);
    }
    if (!r.ok && r.motivo === 'ocupado') {
      console.error(`\n❌ EL TURNO ESTÁ TOMADO en la base "${r.db}" — no se toca.`);
      console.error(`   Lo tiene «${r.lock.dueño}» desde ${r.lock.desdeIso} (hace ${formatearDuracion(r.ahoraMs - r.lock.desdeMs)}).`);
      process.stderr.write(lineasDeContexto(r.contexto, r.ahoraMs));
      console.error('   Romper un lock ajeno reproduce el problema que el turno evita. Espera o usa `estado`.\n');
      process.exit(CODIGO_SALIDA_LOCK_AJENO);
    }

    try {
      fs.writeFileSync(FICHERO_MARCA, JSON.stringify({ marca: r.marca, db: r.db }), 'utf8');
    } catch { /* si no se puede recordar, queda `soltar --marca`; y el TTL por debajo */ }

    console.log(`\n✅ Turno TOMADO sobre la base "${r.db}" para «${ref}» (~${minutos} min).`);
    if (r.reclamado) console.log('   (estaba tomado por una sesión rancia; se reclamó)');
    if (!r.contextoEscrito) console.log(`   ⚠️ el contexto no se pudo escribir (${r.contextoMotivo}); el turno SÍ es tuyo.`);
    console.log(`   Suéltalo con:  node scripts/turno-staging.mjs soltar`);
    console.log(`   MARCA=${r.marca}\n`);
  }

  if (modo === 'soltar') {
    let marcaPropia = opcion('marca');
    if (!marcaPropia) {
      try {
        marcaPropia = JSON.parse(fs.readFileSync(FICHERO_MARCA, 'utf8')).marca;
      } catch {
        console.error('\n❌ no sé cuál era tu marca: no hay nota guardada y no se pasó --marca.');
        console.error('   Mira `estado` y pásala con --marca "<marca>", o espera al TTL.\n');
        process.exit(2);
      }
    }
    const r = await soltarLock(cliente, { marcaPropia });
    if (r.soltado) {
      console.log(`\n✅ Turno SOLTADO sobre la base "${r.db}" (marcador limpio).\n`);
      try { fs.unlinkSync(FICHERO_MARCA); } catch { /* da igual */ }
    } else {
      console.log(`\n⚠️  No se soltó: el marcador ya no era el tuyo (actual: ${JSON.stringify(r.marcaActual)}).`);
      console.log('   Puede que caducara y otra sesión lo reclamara. No se le quita a nadie.\n');
    }
  }
} finally {
  await cliente.$disconnect().catch(() => {});
}
