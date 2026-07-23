// tests/scrum113-migracion-fixtures.test.mjs — SCRUM-113 fase 2
//
// EL RATCHET DE LA MIGRACIÓN. Enumera los ficheros de test que crean merchants a mano y
// falla si aparece uno NUEVO con el patrón viejo.
//
// Lo que justifica esto no es el contador: es que un fichero nuevo salga ROJO EL PRIMER
// DÍA. Eso corta el crecimiento aunque la migración de los 24 tarde meses — igual que la
// red de SCRUM-55 no arregló las 79 rutas abiertas, pero garantizó que la 125 no naciera
// abierta. Por eso el ratchet va ANTES que la migración: si migras primero, entre medias
// puede nacer el fichero 25 con el patrón viejo y nadie se entera.
//
// SIN GATE, en `npm test` normal: solo lee ficheros de tests/. No toca BD ni compila nada
// (regla 3 del runbook).
//
// ── EL RIESGO PROPIO DE ESTE RATCHET ────────────────────────────────────────────────
// La heurística de detección puede MENTIR EN LA DIRECCIÓN PEOR: decir "0 pendientes"
// cuando quedan 5, porque el regex no reconoce un `createMany`, un factory local o un
// helper propio. Un contador que baja porque se quedó ciego es indistinguible de uno que
// baja porque el trabajo se hizo — y el primero es exactamente el "verde falso" de
// SCRUM-103.
//
// Contra eso va CONOCIDOS_AL_MEDIR: los 24 ficheros censados en el recon de SCRUM-79.
// Cada uno tiene que seguir siendo clasificable como «crea a mano» O «usa el helper». Si
// uno deja de encajar en ninguna de las dos, el detector está CIEGO y el test lo dice con
// esas palabras — no asume que se migró solo. Es la regla 2 del runbook (toda comprobación
// por ausencia necesita antes un assert de que lo buscado existe cuando debe) aplicada al
// propio detector.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no `url.pathname`: la ruta del repo puede llevar espacios (aquí los
// lleva) y el pathname los trae como %20, con lo que readdirSync no encuentra el
// directorio. Falla ruidosamente, que es lo bueno — pero mejor no pisarlo.
const DIR = path.dirname(fileURLToPath(import.meta.url));

/** Crea merchants a mano, sin pasar por el helper. */
const CREA_A_MANO = /prisma\.merchant\.(create|createMany|upsert)\b/;
/** Usa la infraestructura de SCRUM-113 (import del helper). */
const USA_HELPER = /_merchant-fixture\.mjs/;

/**
 * CENSO DE CALIBRACIÓN — los 24 ficheros que creaban merchants a mano cuando se midió
 * (recon de SCRUM-79, 23-jul-2026). NO es la lista de pendientes: es la guarda contra que
 * el detector se quede ciego. Un fichero de aquí que no encaje en ninguna de las dos
 * categorías significa que el regex dejó de reconocerlo, no que se haya migrado.
 *
 * Solo se toca si un fichero se BORRA del repo, y entonces con su motivo.
 */
const CONOCIDOS_AL_MEDIR = [
  'albaran.test.mjs', 'pdfs.test.mjs', 'scrum104-clientes-referenciados.test.mjs',
  'scrum17-recapitulativa.test.mjs', 'scrum22-operario-readpath.test.mjs',
  'scrum24-operarios-metrics.test.mjs', 'scrum25-export-zip.test.mjs',
  'scrum25-exports.test.mjs', 'scrum47-enviar-albaran-wa.test.mjs',
  'scrum49-firma-remota.test.mjs', 'scrum50-bot-albaranes.test.mjs',
  'scrum57-operario-propagacion.test.mjs', 'scrum66-tipo-operacion.test.mjs',
  'scrum68-evidencias-firma.test.mjs', 'scrum72-pdfs-privados.test.mjs',
  'scrum73-verifactu-gate.test.mjs', 'scrum74-recibo-token.test.mjs',
  'scrum76-email-adjunto.test.mjs', 'scrum85-pay-routes-token.test.mjs',
  'scrum90-pay-bank-mp-token.test.mjs', 'scrum92-login-operario.test.mjs',
  'scrum94-register-teammember.test.mjs', 'tenancy-permisos.test.mjs',
  'webhooks-idempotencia.test.mjs',
  // ALTA POSTERIOR AL RECON. scrum106 no existía al medir: nació con el patrón viejo y lo
  // cazó este ratchet el día que se mergeó. Migrado ya, entra en el censo porque éste
  // protege a TODO fichero que se sepa que crea merchants, no solo a los 24 originales.
  // Sin esto quedaría fuera del guard: si mañana se reescribe de una forma que el detector
  // no reconozca, nadie se enteraría. Añadirlo NO toca el ratchet (no es un pendiente);
  // solo amplía la cobertura de la calibración.
  'scrum106-trabajos-fecha.test.mjs',
];

/**
 * PENDIENTES DE MIGRAR a withMerchant. Solo mengua.
 * Sacar uno → bajar MIGRACION_MAX EN EL MISMO COMMIT (ver la nota del tope).
 */
export const MIGRACION_PENDIENTE = [
  'albaran.test.mjs',
  'scrum17-recapitulativa.test.mjs',
  // MIGRADOS — tanda 1: scrum24-operarios-metrics · tanda 2: scrum22-operario-readpath
  // tanda 3 (exports): scrum104-clientes-referenciados, scrum25-exports, scrum25-export-zip
  // tanda 4 (grupo A, en curso): pdfs, scrum50-bot-albaranes
  'scrum47-enviar-albaran-wa.test.mjs',
  'scrum49-firma-remota.test.mjs',
  'scrum57-operario-propagacion.test.mjs', 'scrum66-tipo-operacion.test.mjs',
  'scrum68-evidencias-firma.test.mjs', 'scrum72-pdfs-privados.test.mjs',
  'scrum73-verifactu-gate.test.mjs', 'scrum74-recibo-token.test.mjs',
  'scrum76-email-adjunto.test.mjs', 'scrum85-pay-routes-token.test.mjs',
  'scrum90-pay-bank-mp-token.test.mjs', 'scrum92-login-operario.test.mjs',
  'scrum94-register-teammember.test.mjs', 'tenancy-permisos.test.mjs',
  'webhooks-idempotencia.test.mjs',
];

/**
 * Tope del ratchet. VA SIEMPRE AL LÍMITE EXACTO, sin holgura: es eso lo que hace que
 * muerda. Dejarlo alto tras migrar una tanda NO pone el test en rojo — deja huecos libres
 * para que alguien aparque un fichero nuevo sin que nadie se entere. Es la lección literal
 * de SCRUM-103 (el ratchet de rutas se dejó en 25 con 24 entradas).
 */
// 24 → 23 (tanda 1) → 22 (tanda 2) → 19 (tanda 3: los tres de exports)
export const MIGRACION_MAX = 17;

/**
 * Fecha límite. Pasada, el test falla mientras queden pendientes.
 * DECIDIDA por el fundador el 23-jul-2026, en coherencia con el 30-sep de SCRUM-55.
 * Moverla vuelve a requerir su OK: es una decisión, no un despiste, y queda en el diff.
 */
export const MIGRAR_ANTES_DE = '2026-10-31';

const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.mjs'));
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const clasificar = (f) => {
  const s = leer(f);
  return { manual: CREA_A_MANO.test(s), helper: USA_HELPER.test(s) };
};

test('SCRUM-113: el detector NO está ciego (guarda de calibración)', (t) => {
  const invisibles = CONOCIDOS_AL_MEDIR
    .filter((f) => fs.existsSync(path.join(DIR, f)))
    .filter((f) => {
      const c = clasificar(f);
      return !c.manual && !c.helper;
    });

  assert.equal(
    invisibles.length, 0,
    `\n\n🔴 DETECTOR CIEGO: ${invisibles.length} fichero(s) del censo ya no encajan en ninguna categoría.\n` +
      invisibles.map((f) => `   · ${f}`).join('\n') + `\n\n` +
      `Creaban merchants a mano cuando se midió (SCRUM-79) y ahora ni crean a mano ni usan\n` +
      `el helper. Lo más probable NO es que se migraran: es que el regex dejó de reconocer\n` +
      `cómo lo hacen (un createMany, un factory local, un helper propio).\n\n` +
      `NO los quites del censo para poner esto en verde. Un contador que baja porque se quedó\n` +
      `ciego es indistinguible de uno que baja porque el trabajo se hizo — y es el peor de los\n` +
      `dos, porque nadie vuelve a mirarlo (SCRUM-103).\n`,
  );

  const migrados = CONOCIDOS_AL_MEDIR.filter((f) => fs.existsSync(path.join(DIR, f)) && clasificar(f).helper);
  t.diagnostic(`censo ${CONOCIDOS_AL_MEDIR.length} · migrados ${migrados.length} · pendientes ${MIGRACION_PENDIENTE.length}`);
});

test('SCRUM-113: ningún fichero NUEVO nace con el patrón viejo', () => {
  const aMano = ficheros.filter((f) => clasificar(f).manual);
  const nuevos = aMano.filter((f) => !MIGRACION_PENDIENTE.includes(f));

  assert.equal(
    nuevos.length, 0,
    `\n\n🔴 Fichero(s) de test creando merchants A MANO sin estar en la lista de pendientes:\n` +
      nuevos.map((f) => `   · ${f}`).join('\n') + `\n\n` +
      `Un test nuevo NO se aparca: usa withMerchant de tests/_merchant-fixture.mjs.\n` +
      `Crear el merchant fuera del try deja huérfanos en staging en cuanto algo falle, y\n` +
      `la lista de pendientes SOLO MENGUA — no es donde se mete lo que se escribe hoy.\n`,
  );
});

test('SCRUM-113: la lista de pendientes solo mengua (ratchet + caducidad)', (t) => {
  assert.ok(
    MIGRACION_PENDIENTE.length <= MIGRACION_MAX,
    `\n\n🔴 La lista de pendientes ha CRECIDO: ${MIGRACION_PENDIENTE.length} > ${MIGRACION_MAX}.\n` +
      `Solo puede menguar. Si migras una tanda, baja MIGRACION_MAX en el MISMO commit.\n`,
  );

  // Entrada muerta: sigue listada pero ya no crea a mano. Hay que sacarla Y bajar el tope;
  // si no, el hueco queda libre para que otro fichero ocupe su sitio sin que nadie lo vea.
  const yaMigrados = MIGRACION_PENDIENTE
    .filter((f) => fs.existsSync(path.join(DIR, f)))
    .filter((f) => !clasificar(f).manual);

  assert.equal(
    yaMigrados.length, 0,
    `\n\n🔴 ${yaMigrados.length} fichero(s) siguen en la lista de pendientes pero YA NO crean a mano:\n` +
      yaMigrados.map((f) => `   · ${f}`).join('\n') + `\n\n` +
      `Sácalos de MIGRACION_PENDIENTE y baja MIGRACION_MAX a ${MIGRACION_PENDIENTE.length - yaMigrados.length} en el mismo commit.\n` +
      `Dejarlos infla el contador y deja holgura en el ratchet: el tope tiene que ir apretado.\n`,
  );

  const hoy = new Date().toISOString().slice(0, 10);
  if (MIGRACION_PENDIENTE.length > 0) {
    assert.ok(
      hoy <= MIGRAR_ANTES_DE,
      `\n\n🔴 CADUCÓ el plazo para migrar los tests a withMerchant.\n` +
        `   Hoy ${hoy} · plazo ${MIGRAR_ANTES_DE} · quedan ${MIGRACION_PENDIENTE.length}.\n\n` +
        `No es un fallo del código: es la señal de que "se migra por tandas" se volvió "nunca".\n` +
        `Migra o mueve la fecha con el OK del fundador — pero que sea una decisión.\n`,
    );
    t.diagnostic(`pendientes de migrar: ${MIGRACION_PENDIENTE.length}/${MIGRACION_MAX} · plazo ${MIGRAR_ANTES_DE}`);
  } else {
    t.diagnostic('migración completa: ningún test crea merchants a mano 🎉');
  }
});
