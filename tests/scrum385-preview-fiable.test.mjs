// SCRUM-385 · EL PREVIEW DE MIGRACIÓN NO PUEDE MENTIR EN SILENCIO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL INCIDENTE
//
// El 5-ago-2026, preparando la migración de SCRUM-300, `prisma migrate diff` devolvió **cero
// bytes con exit 0** — que es indistinguible de un diff legítimo sin cambios. El preview
// obligatorio antes de tocar producción decía «no hay nada que aplicar» mientras la migración
// real añadía cuatro columnas.
//
// La causa medida NO fue una subida de versión del proyecto: `prisma` está fijado en `^6.18.0`
// y siempre lo estuvo. En un worktree con `node_modules` a medio instalar, **`npx prisma` se
// descargó `prisma@latest` (7.9.1) de la red sin decir nada**, y esa versión renombró los flags.
//
// 🔴 POR ESO EL ARREGLO NO ES «FIJAR LA VERSIÓN»: ya estaba fijada. Fijarla en `package.json` no
// protege de que `npx` ejecute otra cosa. Y el siguiente fallo puede no ser un `npx` traicionero.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE VIGILA ESTE FICHERO
//
// El CONTROL POSITIVO PERMANENTE: antes de creerse un «no hay cambios», se le pide a la
// herramienta un diff que OBLIGATORIAMENTE tiene que traer contenido —el esquema entero contra
// vacío— y se comprueba que lo trae. Si ese sale vacío, la herramienta no responde y se FALLA.
//
// ⚠️ LOS DOS TESTS DE ABAJO SOLO VALEN JUNTOS, y ésa es la idea:
//
//   · el POSITIVO solo prueba que la herramienta contesta cuando tiene algo que decir;
//   · el NEGATIVO solo prueba que un vacío legítimo se reconoce como tal.
//
//   Por separado, cualquiera de los dos lo pasa un preview roto: uno que siempre devuelve
//   contenido pasa el positivo, y uno que siempre devuelve vacío pasa el negativo. Juntos
//   distinguen los DOS VACÍOS, que es justo lo que no se supo distinguir el 5-ago.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  controlPositivo,
  previewMigracion,
  clasificarSalida,
  rutaCliLocal,
  ejecutorLocal,
  sentenciasDestructivas,
  SCHEMA_POR_DEFECTO,
} from '../scripts/preview-migracion.mjs';

// ── Ejecutores de mentira, para poder apuntar el guard a una herramienta rota ────────────────
//
// Se inyectan en vez de tocar el CLI de verdad: probar un guard requiere poder AVERIARLO a
// voluntad, y no se puede averiar prisma en el disco de todos.

/** La avería exacta del 5-ago: exit 0 y cero bytes. */
const cliMudo = () => ({ ok: true, salida: '', error: '' });
/** Una herramienta que ni arranca (binario ausente, permisos, ruta mala). */
const cliAusente = () => ({ ok: false, salida: '', error: 'command not found' });
/** Una que contesta a todo con el vacío legítimo — pasa el negativo, falla el positivo. */
const cliSiempreVacio = () => ({ ok: true, salida: '-- This is an empty migration.\n', error: '' });
/** Una sana: al control le da tablas; a lo demás, el vacío legítimo. */
const cliSano = (args) =>
  args.includes('--from-empty')
    ? { ok: true, salida: 'CREATE TABLE "a" ();\nCREATE TABLE "b" ();\n', error: '' }
    : { ok: true, salida: '-- This is an empty migration.\n', error: '' };

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ① CONTROL POSITIVO — y contra el CLI DE VERDAD, no contra un doble
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-385 · el CLI de Prisma que se ejecuta es el LOCAL, y existe', () => {
  // `npx prisma` se baja otro de la red cuando el local falta. Aquí se exige que exista por ruta:
  // si esto falla, lo que corría el preview no era el CLI del proyecto.
  const bin = rutaCliLocal();
  assert.ok(bin, '🔴 no hay CLI de Prisma en node_modules: el preview estaría ejecutando lo que `npx` decida bajarse');
  assert.ok(fs.existsSync(bin));
});

test('SCRUM-385 · CONTROL POSITIVO: la herramienta responde al esquema entero contra vacío', () => {
  // Este es el test que faltaba el 5-ago. Corre el CLI DE VERDAD: un doble no probaría nada de
  // lo que se rompió. Si esto se pone rojo, ningún «no hay cambios» de este repo vale.
  const r = controlPositivo(ejecutorLocal(), SCHEMA_POR_DEFECTO);
  assert.ok(r.ok, r.motivo);
  // Un suelo con número, no un «>0»: si un día devolviera dos tablas de veinticuatro, también
  // sería una herramienta a medio contestar.
  assert.ok(r.tablas >= 20, `🔴 el control positivo solo vio ${r.tablas} tablas: la herramienta contesta a medias`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ② CONTROL NEGATIVO — un vacío LEGÍTIMO existe y hay que reconocerlo
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-385 · CONTROL NEGATIVO: dos esquemas idénticos dan vacío, y ese vacío es legítimo', () => {
  // Con el CLI de verdad y el mismo fichero a los dos lados. Sin este test, la reacción natural
  // al incidente sería «todo vacío es sospechoso», y entonces el preview daría la alarma cada vez
  // que no hubiera nada que migrar — una alarma que salta siempre se acaba ignorando.
  const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scrum385-')), 'igual.prisma');
  fs.copyFileSync(SCHEMA_POR_DEFECTO, copia);

  const r = previewMigracion({ desde: copia });
  assert.ok(r.ok, `el preview falló: ${r.error || r.control.motivo}`);
  assert.equal(r.clase, 'sin_cambios', '🔴 un diff de un esquema contra sí mismo tiene que salir «sin cambios»');
  assert.equal(sentenciasDestructivas(r.sql).length, 0);
});

test('SCRUM-385 · los DOS vacíos se distinguen: uno lo dice con palabras, el otro son cero bytes', () => {
  assert.equal(clasificarSalida(''), 'sospechoso', 'cero bytes NO es «no hay cambios»: es no saber');
  assert.equal(clasificarSalida('-- This is an empty migration.'), 'sin_cambios');
  assert.equal(clasificarSalida('ALTER TABLE "x" ADD COLUMN "y" TEXT;'), 'con_cambios');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ③ ROJO POR EL MECANISMO — apuntando el guard a una herramienta rota
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-385 · con el CLI mudo, el guard dice QUE NO RESPONDE — no «no hay cambios»', () => {
  // La avería exacta: exit 0, cero bytes. Lo que se comprueba no es solo que falle, sino QUÉ dice
  // al fallar: si dijera «no hay cambios» habría reproducido el incidente en vez de cazarlo.
  const r = controlPositivo(cliMudo);
  assert.equal(r.ok, false, '🔴 un CLI que devuelve cero bytes con exit 0 tiene que caer');
  assert.match(r.motivo, /LA HERRAMIENTA NO RESPONDE/,
    '🔴 el mensaje no nombra la avería: quien lo lea creerá que el problema es suyo');
  assert.match(r.motivo, /NO significa «no hay cambios»/,
    '🔴 el mensaje no descarta la lectura peligrosa, que es la que costó el incidente');
  assert.match(r.motivo, /CERO BYTES/);
});

test('SCRUM-385 · el preview NUNCA informa de «sin cambios» si el control no pasó', () => {
  // El invariante del ticket, en una línea: sin control positivo, no hay veredicto tranquilizador.
  for (const cli of [cliMudo, cliAusente, cliSiempreVacio]) {
    const r = previewMigracion({ ejecutor: cli });
    assert.equal(r.ok, false);
    assert.notEqual(r.clase, 'sin_cambios',
      '🔴 se está informando de «sin cambios» con la herramienta sin verificar');
  }
});

test('SCRUM-385 · un CLI que SIEMPRE devuelve vacío pasa el negativo y cae en el positivo', () => {
  // La prueba de que los dos tests se necesitan. `cliSiempreVacio` produce un vacío con la frase
  // legítima: el control NEGATIVO por sí solo lo daría por bueno.
  assert.equal(clasificarSalida('-- This is an empty migration.'), 'sin_cambios'); // el negativo pasa…
  assert.equal(controlPositivo(cliSiempreVacio).ok, false);                        // …y el positivo lo caza
});

test('SCRUM-385 · un CLI sano pasa los dos', () => {
  // Control del control: si los dobles rotos cayeran por algo ajeno a la avería (una firma mal
  // puesta, por ejemplo), este test también caería y se vería que el guard mide otra cosa.
  const r = controlPositivo(cliSano);
  assert.ok(r.ok);
  assert.equal(r.tablas, 2);
  assert.equal(previewMigracion({ ejecutor: cliSano }).clase, 'sin_cambios');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ④ EL VEREDICTO DESTRUCTIVO, sobre SQL de verdad
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-385 · las sentencias destructivas se nombran una a una', () => {
  const sql = [
    'ALTER TABLE "a" ADD COLUMN "x" TEXT;',
    'ALTER TABLE "a" DROP COLUMN "y";',
    'ALTER TABLE "a" ALTER COLUMN "z" SET NOT NULL;',
  ].join('\n');
  const malas = sentenciasDestructivas(sql);
  assert.equal(malas.length, 2, '🔴 el escáner no ve las dos destructivas');
  assert.ok(malas.some((l) => /DROP/.test(l)) && malas.some((l) => /SET NOT NULL/.test(l)));
  // Y el control negativo del escáner: una migración aditiva no dispara nada.
  assert.equal(sentenciasDestructivas('ALTER TABLE "a" ADD COLUMN "x" TEXT;').length, 0);
});
