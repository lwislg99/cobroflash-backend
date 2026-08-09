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
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import {
  adquirirLock, soltarLock, leerMarcaCruda, parsearLock, parsearContexto, leerComentarioSchema,
  esMarcaDeStaging, tieneSufijoIlegible, formatearDuracion,
  lineasDeContexto, decidirVigencia, cederLock, TTL_POR_DEFECTO_MS, CODIGO_SALIDA_LOCK_AJENO,
} from './_staging-lock.mjs';
import { assertSafeStagingUrl, STAGING_HOST } from './_db-guard.mjs';
// SCRUM-253 · la identidad de la sesión, derivada del árbol de trabajo.
// ⚠️ ESTE IMPORT FALTABA, y llegó así a `main`: SCRUM-253 cambió el `const dueño = …` de abajo y
// puso el import en los otros TRES consumidores, no en éste. `turno:tomar` reventaba con
// `ReferenceError: dueñoActual is not defined` teniendo la suite en 1196 verdes — porque ningún
// test ejecuta este CLI. Lo cierra el guard de `tests/scrum258-nota-por-sesion.test.mjs`.
import { dueñoActual } from './_identidad-sesion.mjs';
import { guardarNota, leerNota, borrarNota } from './_turno-nota.mjs';

// Dónde se recuerda la marca propia entre `tomar` y `soltar`. El pid cambia entre invocaciones,
// así que `soltar` no puede recomponerla: o se recuerda, o se pasa a mano. Si el fichero se
// pierde, el TTL sigue siendo el mecanismo que de verdad libera el turno.
// SCRUM-249 · la nota vive en `_turno-nota.mjs` para que el runner gateado escriba y lea
// EXACTAMENTE la misma. Antes solo la escribia este CLI, y por eso una tanda que moria mal
// dejaba el turno secuestrado hasta el TTL: nadie podia recomponer su marca (lleva el PID).

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

if (!['estado', 'tomar', 'soltar', 'ceder', 'quien-soy'].includes(modo)) {
  console.error('\nuso:  node scripts/turno-staging.mjs estado');
  console.error('      node scripts/turno-staging.mjs tomar  [--ref <rama-o-ticket>] [--minutos <N>]');
  console.error('      node scripts/turno-staging.mjs soltar [--marca <marca>]');
  console.error('      node scripts/turno-staging.mjs ceder  --a <id-de-sesion> [--minutos <N>]');
  console.error('      node scripts/turno-staging.mjs quien-soy');
  console.error('\n  soltar = «he terminado, queda libre para quien lo pille».');
  console.error('  ceder  = «he terminado y es TUYO»: nadie más puede cogerlo (SCRUM-268).\n');
  process.exit(2);
}

// SCRUM-268 · `quien-soy` va ANTES de exigir la URL de staging: lo único que hace es decir cómo
// te llamas, y eso es lo que le pasas a quien te va a ceder el turno. Pedirle el entorno de la
// base para responder a eso sería un obstáculo sin motivo.
if (modo === 'quien-soy') {
  const yo = dueñoActual();
  console.log(`\n${yo}\n`);
  console.log('  Identificador de ESTA sesión: la máquina y el árbol de trabajo (SCRUM-253).');
  console.log('  Pásaselo a quien te vaya a ceder el turno para que lo escriba a tu nombre:');
  console.log(`      node scripts/turno-staging.mjs ceder --a ${yo}\n`);
  process.exit(0);
}

// SCRUM-383 · el turno se toma sobre LA BASE DE PRUEBAS DE ESTE CARRIL, que es donde vive el
// marcador (el turno se escribe DENTRO de la base, no en un servicio aparte). Por eso hay DOS
// turnos y no uno: el del árbol principal en `yaqu_dev_javier` y el que comparten b1/b2/b3 en
// `railway`. No es un descuido — el reparto por carril es deliberado (23-jul-2026).
const urlStaging = process.env.DATABASE_URL_TESTS;
if (!urlStaging) {
  console.error('\n❌ falta DATABASE_URL_TESTS en el entorno. Sin ella no hay turno.\n');
  process.exit(2);
}
{
  // La misma allowlist INCONDICIONAL que el runner: este script escribe sobre la barrera de
  // SCRUM-118. El contrato devuelve `safe`, no `ok` — leerlo mal da un rechazo con motivo vacío.
  const check = assertSafeStagingUrl(urlStaging, process.env.DATABASE_URL);
  if (!check.safe) {
    console.error(`\n❌ DATABASE_URL_TESTS no es una URL de pruebas segura (${check.reason}).`);
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
      // SCRUM-266 · UNA sola decisión, y por eso ya no puede contradecirse consigo misma. Antes
      // el título salía de `estaRancio` con 45 min SUPUESTOS y la señal de vida de abajo salía
      // del compromiso PUBLICADO: con `GATED_CHILD_TIMEOUT_MS=60` esta pantalla llegaba a decir
      // «⏳ RANCIO (se reclama solo)» y dos líneas después «Señal de vida: VIVO».
      const ctx = parsearContexto(await leerComentarioSchema(cliente), lock.dueño);
      const veredicto = decidirVigencia({ lock, contexto: ctx, ahoraMs, ttlSupuestoMs: TTL_POR_DEFECTO_MS });
      const rancio = !veredicto.vigente;
      console.log(`\n${rancio ? '⏳' : '🔒'} Turno ${rancio ? 'RANCIO (se reclama solo)' : 'TOMADO'} en la base "${db}".`);
      console.log(`   Lo tiene «${lock.dueño}» desde ${lock.desdeIso} (hace ${formatearDuracion(ahoraMs - lock.desdeMs)}).`);
      process.stdout.write(lineasDeContexto(ctx, ahoraMs));
      console.log(`   Veredicto: ${rancio ? 'RANCIO' : 'VIGENTE'} — ${veredicto.motivo}.`);
      if (veredicto.base === 'ttl-supuesto') {
        console.log('   ⚠️  Decidido por TTL SUPUESTO, no por lo que declaró su dueño: ese turno no publica');
        console.log('      compromiso (código anterior a SCRUM-249). Si esa tanda corre con un');
        console.log('      GATED_CHILD_TIMEOUT_MS alto, su TTL real puede ser mayor y seguir VIVA.');
      }
      console.log('');
    }
  }

  if (modo === 'tomar') {
    const minutos = Number(opcion('minutos')) > 0 ? Number(opcion('minutos')) : 15;
    const ref = opcion('ref') || ramaActual();
    // SCRUM-253 · la MISMA identidad que usa el runner, y por eso la tanda que lances después
    // adopta este turno en vez de darse `exit 5` contra sí misma. Sale del árbol de trabajo: no
    // hay nada que exportar ni copiar.
    const dueño = dueñoActual();
    const r = await adquirirLock(cliente, {
      dueño, ttlMs: TTL_POR_DEFECTO_MS,
      tipo: 'suelto', ref, finPrevistoMs: Date.now() + minutos * 60 * 1000,
      // SCRUM-249 · un turno SUELTO no tiene hijos, o sea que no hay senal de progreso que lo
      // renueve: el compromiso es la ventana que declara el humano. Si se le pasa, sale VENCIDO
      // -- que es exactamente lo que se quiere saber de un `tomar` que alguien olvido soltar.
      señalAntesDeMs: Date.now() + minutos * 60 * 1000,
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
      guardarNota({ marca: r.marca, db: r.db });
    } catch { /* si no se puede recordar, queda `soltar --marca`; y el TTL por debajo */ }

    console.log(`\n✅ Turno TOMADO sobre la base "${r.db}" para «${ref}» (~${minutos} min).`);
    if (r.reclamado) {
      console.log('   (estaba tomado por otra sesión y se reclamó)');
      // SCRUM-266 · reclamar NUNCA es silencioso, y menos cuando se decidió con una suposición.
      // Antes, `tomar` con su TTL de 45 min se llevaba el turno de una tanda viva que lo sostenía
      // con un TTL derivado mayor — sin decir nada. Ahora se dice SIEMPRE con qué se decidió.
      console.log(`   Motivo: ${r.vigenciaPrevia?.motivo ?? '(sin motivo registrado)'}`);
      if (r.vigenciaPrevia?.base === 'ttl-supuesto') {
        console.log('   ⚠️  SE DECIDIÓ POR TTL SUPUESTO, no por lo que declaró su dueño.');
        console.log('      Ese turno no publicaba compromiso (código anterior a SCRUM-249), así que');
        console.log('      su TTL real puede ser MAYOR que el supuesto aquí y la tanda seguir viva.');
        console.log('      Si era una tanda gateada con GATED_CHILD_TIMEOUT_MS alto, suéltalo y avisa.');
      }
    }
    if (!r.contextoEscrito) console.log(`   ⚠️ el contexto no se pudo escribir (${r.contextoMotivo}); el turno SÍ es tuyo.`);
    console.log(`   Suéltalo con:  node scripts/turno-staging.mjs soltar`);
    console.log(`   MARCA=${r.marca}\n`);
  }

  if (modo === 'ceder') {
    // SCRUM-268 · CEDER ≠ SOLTAR. Soltar abre una carrera que gana el bucle esperador; ceder deja
    // el turno escrito A NOMBRE de alguien, así que la cola acordada existe donde una máquina
    // puede leerla y no solo en la conversación.
    const destinatario = opcion('a');
    if (!destinatario) {
      console.error('\n❌ falta a quién. Uso: ceder --a <id-de-sesion>');
      console.error('   Ese id lo da la OTRA sesión con:  node scripts/turno-staging.mjs quien-soy\n');
      process.exit(2);
    }
    // Se valida la FORMA, no la existencia: no hay forma de saber si esa sesión existe, y no hace
    // falta — si nunca llega, la ventana vence y el turno vuelve al común. Lo que sí se impide es
    // escribir en el marcador algo que luego no se pueda releer (el marcador es la barrera).
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(destinatario)) {
      console.error(`\n❌ «${destinatario}» no tiene forma de identificador de sesión.`);
      console.error('   Pídeselo tal cual a la otra sesión:  node scripts/turno-staging.mjs quien-soy\n');
      process.exit(2);
    }
    const minutos = Number(opcion('minutos')) > 0 ? Number(opcion('minutos')) : 30;

    let marcaPropia = opcion('marca');
    if (!marcaPropia) {
      marcaPropia = leerNota();
      if (!marcaPropia) {
        console.error('\n❌ no sé cuál era tu marca: no hay nota guardada y no se pasó --marca.');
        console.error('   Solo puede ceder quien tiene el turno. Mira `estado`.\n');
        process.exit(2);
      }
    }

    const r = await cederLock(cliente, {
      marcaPropia, dueño: dueñoActual(), destinatario,
      ventanaMs: minutos * 60 * 1000, ref: opcion('ref') || ramaActual(),
    });

    if (!r.ok) {
      const explica = {
        'a-mi-mismo': 'te lo estás cediendo a ti mismo; si querías conservarlo, no hagas nada',
        'no-es-staging': `la base "${r.db}" no lleva el marcador de staging`,
        'no-es-la-mia': `el marcador ya no es el tuyo (actual: ${JSON.stringify(r.marcaActual)})`,
        ajeno: `ese turno es de «${r.lock?.dueño}», no tuyo: no se cede lo que no se tiene`,
      }[r.motivo] ?? r.motivo;
      console.error(`\n❌ NO se cedió: ${explica}.\n`);
      process.exit(2);
    }

    borrarNota(); // ya no es nuestro: la nota describiría un turno de otro
    console.log(`\n🤝 Turno CEDIDO a «${r.destinatario}» sobre la base "${r.db}".`);
    console.log(`   Reservado a su nombre hasta ${new Date(r.finMs).toISOString()} (~${minutos} min).`);
    console.log('   Nadie más puede cogerlo mientras tanto — tampoco un bucle esperador.');
    console.log('   Si no lo recoge, la reserva vence y el turno vuelve a quedar libre solo.');
    if (!r.contextoEscrito) {
      console.log(`   ⚠️ el contexto no se pudo escribir (${r.contextoMotivo}): el turno SÍ está a su`);
      console.log('      nombre, pero `estado` lo describirá como un turno normal suyo, no como cesión.');
    }
    console.log('');
  }

  if (modo === 'soltar') {
    let marcaPropia = opcion('marca');
    if (!marcaPropia) {
      try {
        marcaPropia = leerNota();
        if (!marcaPropia) throw new Error('sin nota');
      } catch {
        console.error('\n❌ no sé cuál era tu marca: no hay nota guardada y no se pasó --marca.');
        console.error('   Mira `estado` y pásala con --marca "<marca>", o espera al TTL.\n');
        process.exit(2);
      }
    }
    // SCRUM-258 · el dueño viaja con la petición: soltar comprueba que el turno es MÍO. Sin esto,
    // una marca ajena —de la nota compartida por toda la máquina, o pegada a mano en `--marca`—
    // soltaba el turno VIVO de otra sesión en silencio.
    const r = await soltarLock(cliente, { marcaPropia, dueño: dueñoActual() });
    if (r.soltado) {
      console.log(`\n✅ Turno SOLTADO sobre la base "${r.db}" (marcador limpio).\n`);
      borrarNota();
    } else if (r.motivo === 'ajeno') {
      console.log(`\n⛔ NO se soltó: ese turno es de «${r.lock.dueño}», no tuyo.`);
      console.log(`   La marca que pasaste coincide con el marcador, pero el turno no es de esta sesión.`);
      console.log('   Soltarlo dejaría a esa tanda escribiendo sobre una base que figura libre.');
      console.log('   Si de verdad hay que romperlo (sesión muerta), eso es cosa de marcar-staging.mjs.\n');
    } else {
      console.log(`\n⚠️  No se soltó: el marcador ya no era el tuyo (actual: ${JSON.stringify(r.marcaActual)}).`);
      console.log('   Puede que caducara y otra sesión lo reclamara. No se le quita a nadie.\n');
    }
  }
} finally {
  await cliente.$disconnect().catch(() => {});
}
