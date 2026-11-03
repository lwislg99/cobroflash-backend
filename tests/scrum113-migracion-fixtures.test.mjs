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
// (principio 3 de docs/QA/SUITE_REGRESION.md, sección «Escribir verificaciones»: «una red que
// solo funciona cuando alguien se acuerda de levantarla no es una red»).
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
// esas palabras — no asume que se migró solo. Es el principio 2 de docs/QA/SUITE_REGRESION.md,
// sección «Escribir verificaciones» (toda comprobación
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
  // ÍDEM, y conviene dejar escrito POR QUÉ, porque volverá a pasar: `scrum51` se ESCRIBIÓ el
  // 16-jul, SIETE DÍAS ANTES de que existiera este ratchet (23-jul), y se MERGEÓ a main el
  // 27-jul. Desde el punto de vista de main nació con el patrón viejo, así que el guard hizo
  // exactamente su trabajo — pero saltó DESPUÉS del merge, dejando main en rojo, porque no
  // hay CI que corra `npm test` sobre el PR. No es un fallo del ratchet ni del detector: una
  // rama larga anterior a una regla nueva solo choca con ella al aterrizar. Migrado al
  // detectarlo; entra en el censo para que el detector lo siga cubriendo.
  'scrum51-job-sin-quote.test.mjs',
];

/**
 * SUELO DEL CENSO — el censo SOLO CRECE. Se sube al añadir un fichero, nunca se baja.
 *
 * El censo protege al detector de quedarse ciego, pero hasta ahora NADIE LO PROTEGÍA A ÉL:
 * quitarle una entrada dejaba los tres asserts en verde y reducía la cobertura en silencio.
 * Su propio mensaje de error dice «NO los quites del censo para poner esto en verde» — y no
 * había nada que lo hiciera cumplir. Una prohibición escrita sin mecanismo detrás es
 * exactamente lo que este fichero existe para no repetir.
 *
 * Se descubrió rompiéndolo sin querer: un replace mal dirigido sacó `scrum72` del censo
 * (25 → 24) y ningún assert se quejó. Lo que saltó fue el del tope, por un descuadre
 * distinto; si aquel replace hubiera acertado en la lista, el daño al censo habría pasado
 * inadvertido.
 *
 * Si un fichero se BORRA del repo de verdad, se baja este suelo A PROPÓSITO y en el mismo
 * commit, con el motivo escrito — igual que MIGRACION_MAX.
 *
 * ── SCRUM-124 · CONVENCIÓN ACEPTADA ─────────────────────────────────────────────────────
 * El mensaje del guard dice «NO bajes CENSO_MIN para que esto pase» y NADA lo hace cumplir.
 * Es deliberado, no un descuido: bajar esta línea aparece en el diff de un PR y alguien lo
 * revisa. La regresión es infinita —el suelo del suelo del suelo— y aquí es donde para.
 *
 * El criterio no es «¿tiene mecanismo?» sino «¿cuánto cuesta el atajo y quién lo vería?»:
 * olvidarse de una entrada del censo no aparece en ningún sitio (→ mecanismo, este suelo);
 * bajar el suelo a propósito sí aparece (→ convención, esta nota).
 */
export const CENSO_MIN = 26; // 25 -> 26 al entrar scrum51 en el censo (migrado, no aparcado)

/**
 * PENDIENTES DE MIGRAR a withMerchant. Solo mengua.
 *
 * ⚠️ SI MIGRAS UN FICHERO, SÁCALO DE AQUÍ Y BAJA `MIGRACION_MAX` TÚ, EN TU MISMO COMMIT.
 *
 * Aunque la campaña de migración sea de otro carril: **estas dos líneas son la otra mitad
 * de la migración**, no el trabajo de nadie. Un fichero migrado que sigue contado como
 * pendiente es otra forma del estado «a medias» —el que parece hecho y no lo está— y
 * además deja holgura en el ratchet, que es justo lo que el tope evita. Si esperas a que
 * otro actualice la lista, `main` se queda ROJO entre tu commit y el suyo.
 *
 * ESTAS DOS LÍNEAS son la ÚNICA excepción: censo, asserts y fecha los sigue tocando quien
 * escribió el ratchet (carril B, SCRUM-113).
 * (SCRUM-1644, 3-nov-2026: los asserts y la fecha los tocó el puesto S3 del equipo de Luis por
 * encargo de su orquestador, con la decisión delegada por el fundador que consta junto a
 * `MIGRAR_ANTES_DE`. «Carril B» ya no existe como tal: el dueño de este fichero se lee en
 * `docs/equipo/dos-equipos.md`, y quien lo cambie avisa al otro equipo en Jira.)
 *
 * ── SCRUM-124 · CONVENCIÓN ACEPTADA ─────────────────────────────────────────────────────
 * Ese reparto de propiedad no tiene mecanismo, y no puede tenerlo: un test no sabe quién
 * edita. Se acepta porque tocar el censo o un assert aparece en el diff, y porque el coste
 * de saltárselo es bajo y reversible. Lo que sí tiene mecanismo es el EFECTO de saltárselo
 * mal — sacar un fichero de la lista sin bajar el tope lo caza la igualdad exacta de abajo.
 *
 * Origen: al migrar `scrum94` (23-jul-2026) el reparto por FICHERO chocó con la atomicidad
 * que este ratchet exige — quien migraba no era dueño de la lista. Se resolvió a favor de
 * la atomicidad: la regla NO se relaja, lo que cambia es quién la cumple. Con reparto por
 * fichero, quien migra es el único que puede cumplirla.
 */
// MIGRADOS hasta hoy (23-jul-2026) — 22 de 25. Por tandas:
//   t1 scrum24 · t2 scrum22 · t3 scrum104, scrum25-exports, scrum25-export-zip, scrum106
//   t4 pdfs, scrum50, scrum73, scrum76, scrum92 · (scrum94 lo migró la sesión 1)
//   t5 scrum49, scrum72
//   t7 scrum57, scrum66, albaran, scrum68, scrum85, scrum90, tenancy-permisos, scrum47
//
// ── SCRUM-125 · LA UNIDAD DEL CONTADOR: FICHEROS, NO SITIOS DE CREACIÓN ──────────────────
// `MIGRACION_PENDIENTE.length` (y `MIGRACION_MAX`) cuentan FICHEROS. La unidad REAL de trabajo es
// el SITIO de creación manual de merchant (los `create`/`createMany`/`upsert` que caza el regex
// `CREA_A_MANO`; NO se escribe aquí junto, o este mismo fichero se auto-clasificaría `manual` — el
// detector lee TODOS los `tests/*.test.mjs`, incluido éste). Un fichero puede tener varios:
// `albaran` y `tenancy-permisos` tenían 2 cada uno → en el pico, 8 ficheros pendientes eran
// 9 sitios (~12% de desvío). HOY el desvío es 0: los 3 pendientes tienen 1 sitio cada uno (medido,
// no estimado — ojo: scrum17 tiene 12 bloques `test()` pero UN solo sitio, así que "contar bloques"
// sería aún MÁS inexacto que contar ficheros).
//
// POR QUÉ SE APROXIMA A PROPÓSITO — no lo "arregles" contando sitios:
//  · La CONTENCIÓN (un fichero nuevo con el patrón viejo sale rojo el primer día) y el DETECTOR
//    (un fichero a medias sigue marcando `manual` y NO puede salir de la lista) trabajan POR
//    FICHERO — les da igual la unidad. Solo la lectura humana de «cuánto queda» se resiente, y solo
//    durante una campaña VIVA. Ésta está cerrada (22/25, quedan 3, todos de 1 sitio).
//  · Contar sitios obliga a pasar el detector de booleano a contador de matches, y `createMany`
//    (1 llamada / N merchants), los bucles y las factories NO casan → reintroduce la CEGUERA que
//    este fichero existe para evitar (SCRUM-103). Campaña cerrada: payoff cero, downside real.
//
// ── SCRUM-1644 (3-nov-2026) · DE TRES PENDIENTES A UNO: los otros dos NO eran «pendientes» ──────
// Hasta el 31-oct la lista tenía tres, y el plazo los medía a los tres. Dos de ellos no podían
// migrar NUNCA por su propio motivo, escrito aquí mismo desde julio: `scrum74` (migrarlo borra la
// evidencia de SCRUM-79) y `webhooks-idempotencia` (espera a SCRUM-63). Contarlos como deuda con
// fecha garantizaba que el plazo caducara, y caducó: desde el 1-nov el obligatorio cayó en TODOS
// los PR de los dos equipos. Salen de aquí a `FUERA_DEL_PLAZO`, más abajo, CON su motivo y con su
// propio trinquete. Siguen contados, siguen vigilados: lo único que cambia es que una fecha no
// puede vencer por algo que no depende de nadie que pueda cumplirla.
export const MIGRACION_PENDIENTE = [
  'scrum17-recapitulativa.test.mjs',   // consolidación fiscal — con su dueño
];

/**
 * FUERA DEL PLAZO — crean merchants a mano A SABIENDAS, y el plazo de la migración NO les aplica.
 * SCRUM-1644. Tiene las MISMAS dos mitades que `MIGRACION_PENDIENTE` (un trinquete necesita las
 * dos): igualdad exacta con `FUERA_DEL_PLAZO_MAX`, y una entrada que deje de crear a mano tiene
 * que salir. Sin eso, reclasificar habría abierto una segunda puerta para aparcar ficheros, y el
 * trinquete se habría vuelto un colador.
 *
 * Dos clases, y no hay más:
 *  · EXCEPCION_PERMANENTE — no se migra NUNCA, y el motivo es una decisión tomada, no una deuda.
 *  · BLOQUEADA — se migra cuando se cierre `ticket`; su plazo cuelga de ese ticket, no de una fecha.
 */
export const FUERA_DEL_PLAZO = [
  {
    fichero: 'scrum74-recibo-token.test.mjs',
    clase: 'EXCEPCION_PERMANENTE',
    motivo: 'su throw en el finally es la evidencia que sostiene la hipótesis de SCRUM-79; '
      + 'migrarlo haría desaparecer el síntoma sin arreglar la causa',
  },
  {
    fichero: 'webhooks-idempotencia.test.mjs',
    clase: 'BLOQUEADA',
    ticket: 'SCRUM-63',
    motivo: 'depende del seed demo, sin resolver: se migra cuando se cierre SCRUM-63',
  },
];

/** Tope de `FUERA_DEL_PLAZO`. Igualdad exacta, como `MIGRACION_MAX`: sólo mengua. */
export const FUERA_DEL_PLAZO_MAX = 2;

const CLASES_FUERA_DEL_PLAZO = ['EXCEPCION_PERMANENTE', 'BLOQUEADA'];

/**
 * Tope del ratchet. VA SIEMPRE AL LÍMITE EXACTO, sin holgura: es eso lo que hace que
 * muerda. Dejarlo alto tras migrar una tanda NO pone el test en rojo — deja huecos libres
 * para que alguien aparque un fichero nuevo sin que nadie se entere. Es la lección literal
 * de SCRUM-103 (el ratchet de rutas se dejó en 25 con 24 entradas).
 */
// 24 → 23 (t1) → 22 (t2) → 19 (t3) → 13 (t4 + scrum94 sesión 1) → 11 (t5) → 3 (t7)
//   → 1 (SCRUM-1644: no se migró ninguno; scrum74 y webhooks-idempotencia pasaron a FUERA_DEL_PLAZO)
//
// El número salió de CONTAR la lista fusionada, no de elegir rama. Este rebase trajo tres
// conflictos seguidos en esta línea (16 de la sesión 1 sacando scrum94, contra 15 y 14 del
// carril B sacando scrum73/scrum76 y scrum92), y en ninguno el valor correcto era el de
// una de las dos ramas. Es el escenario exacto que el assert de IGUALDAD EXACTA vino a
// hacer ruidoso: con `<=` cualquiera de esos números habría pasado en verde, dejando
// huecos libres.
export const MIGRACION_MAX = 1;

/**
 * Fecha límite. Pasada, el test falla mientras queden pendientes.
 * DECIDIDA por el fundador el 23-jul-2026, en coherencia con el 30-sep de SCRUM-55.
 * Moverla vuelve a requerir su OK: es una decisión, no un despiste, y queda en el diff.
 *
 * SCRUM-1644 · '2026-10-31' → '2026-12-15', y la decisión tiene dueño y localizador:
 *  · el fundador DELEGÓ sus decisiones el 3-nov-2026, literal: «todo lo que tenia que decididr yo
 *    decidelo tu si puedes» (turno type:user `6b2bcf7c-aa53-4a8d-9d10-ab31e3faa10b`, ts
 *    2026-11-03T07:38:24.106Z, transcripción `ed676fd1-feb4-4658-bda2-01f4bf9fb3fc.jsonl`);
 *  · con esa delegación, el orquestador del equipo de Luis decidió la opción ② de SCRUM-1644
 *    (reclasificar, no sólo mover la fecha) y eligió el 15-dic: seis semanas, para que el dueño de
 *    la consolidación fiscal pueda coger `scrum17`. La fecha es SUYA, no de quien escribe esto.
 */
export const MIGRAR_ANTES_DE = '2026-12-15';

/**
 * SCRUM-1644 · EL AVISO ANTES DE CADUCAR. Hasta el 31-oct este guard sólo hablaba el día DESPUÉS,
 * y ese día bloqueó a los dos equipos de golpe: la información existía, pero llegaba tarde. A
 * `DIAS_DE_AVISO` días o menos del plazo sale un aviso VISIBLE que NO bloquea (diagnóstico y
 * anotación `::warning` en el log del CI); pasada la fecha, sigue fallando exactamente como antes.
 * Es apretar el guard, no aflojarlo: el rojo no se mueve ni un día, se le añade un preaviso.
 */
export const DIAS_DE_AVISO = 14;

const DIA_MS = 24 * 60 * 60 * 1000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const comoDia = (s) => {
  const ms = FECHA.test(String(s)) ? Date.parse(`${s}T00:00:00Z`) : NaN;
  // Fail-closed: una fecha que no sé leer NO es «en plazo». «No pude mirar» y «no hay nada» no
  // pueden salir iguales.
  if (!Number.isFinite(ms)) throw new Error(`🔴 SCRUM-113: no sé leer la fecha «${s}» (se espera AAAA-MM-DD)`);
  return ms;
};

/**
 * Veredicto PURO del plazo: no lee el reloj ni el entorno, así sus casos se prueban con un `hoy`
 * fijo en cualquier máquina. Estados: `completo` (no queda nada) · `en-plazo` · `aviso` (faltan
 * `diasDeAviso` días o menos, el propio día del plazo incluido) · `caducado` (hoy > plazo).
 */
export function veredictoDelPlazo({ hoy, plazo, pendientes, diasDeAviso = DIAS_DE_AVISO }) {
  const dias = Math.round((comoDia(plazo) - comoDia(hoy)) / DIA_MS);
  if (pendientes === 0) return { estado: 'completo', dias };
  if (dias < 0) return { estado: 'caducado', dias };
  if (dias <= diasDeAviso) return { estado: 'aviso', dias };
  return { estado: 'en-plazo', dias };
}

/**
 * Aplica el veredicto: `caducado` LANZA (el rojo de siempre, con su mensaje de siempre); `aviso`
 * llama a `avisar(mensaje)` y NO lanza; el resto calla. Devuelve el veredicto.
 */
export function comprobarPlazo({ hoy, plazo, pendientes, avisar = () => {}, diasDeAviso = DIAS_DE_AVISO }) {
  const v = veredictoDelPlazo({ hoy, plazo, pendientes, diasDeAviso });
  assert.ok(
    v.estado !== 'caducado',
    `\n\n🔴 CADUCÓ el plazo para migrar los tests a withMerchant.\n` +
      `   Hoy ${hoy} · plazo ${plazo} · quedan ${pendientes}.\n\n` +
      `No es un fallo del código: es la señal de que "se migra por tandas" se volvió "nunca".\n` +
      `Migra o mueve la fecha con el OK del fundador — pero que sea una decisión.\n`,
  );
  if (v.estado === 'aviso') {
    avisar(
      `⚠️ SCRUM-113: el plazo para migrar a withMerchant vence el ${plazo} y faltan ${v.dias} día(s); ` +
        `quedan ${pendientes} pendiente(s). Hoy NO bloquea; el día ${plazo} pasado, el obligatorio cae ` +
        `en TODOS los PR. Migra, o que alguien con la decisión mueva la fecha, ANTES.`,
    );
  }
  return v;
}

const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.mjs'));
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const clasificar = (f) => {
  const s = leer(f);
  return { manual: CREA_A_MANO.test(s), helper: USA_HELPER.test(s) };
};

test('SCRUM-113: el detector NO está ciego (guarda de calibración)', (t) => {
  // El censo solo crece. Sin esto, quitarle entradas reduce la cobertura EN SILENCIO —
  // los otros asserts siguen verdes porque solo recorren lo que quede en la lista.
  assert.ok(
    CONOCIDOS_AL_MEDIR.length >= CENSO_MIN,
    `\n\n🔴 EL CENSO HA MENGUADO: ${CONOCIDOS_AL_MEDIR.length} entradas, el suelo es ${CENSO_MIN}.\n\n` +
      `El censo es lo que impide que el detector se quede ciego, así que quitarle entradas\n` +
      `no pone nada en rojo: reduce la cobertura sin que se note. Por eso solo puede crecer.\n\n` +
      `Si has llegado aquí tras un replace o un merge, es casi seguro que la edición cayó en\n` +
      `el sitio equivocado: los nombres de fichero aparecen DOS veces en este fichero (aquí y\n` +
      `en MIGRACION_PENDIENTE), y una sustitución de texto golpea la PRIMERA. Repón la entrada\n` +
      `y edita con precisión — NO bajes CENSO_MIN para que esto pase.\n\n` +
      `Solo se baja si un fichero se BORRÓ del repo de verdad, a propósito y con el motivo.\n`,
  );

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
  const declarados = new Set([...MIGRACION_PENDIENTE, ...FUERA_DEL_PLAZO.map((e) => e.fichero)]);
  const nuevos = aMano.filter((f) => !declarados.has(f));

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
  // IGUALDAD EXACTA, no `<=`. Con `<=`, una lista de 14 con el tope en 16 pasa en verde y
  // deja DOS huecos libres para aparcar sin que nadie lo vea — la holgura silenciosa de
  // SCRUM-103, que aquí llegaría por la puerta de atrás: al mergear dos ramas que migran a
  // la vez, la línea del tope da conflicto (17→15 vs 17→16) y quien lo resuelva puede
  // quedarse con cualquiera de los dos números mientras la lista ya tiene 14. Con `===`
  // ese merge sale ROJO y hay que hacer la cuenta; con `<=` habría salido verde y flojo.
  assert.equal(
    MIGRACION_PENDIENTE.length, MIGRACION_MAX,
    MIGRACION_PENDIENTE.length > MIGRACION_MAX
      // SCRUM-124: decía «una ruta nueva se declara, no se aparca» — frase traída tal cual
      // del ratchet de rutas de SCRUM-55. Aquí no hay rutas: hay ficheros de test. Copiar
      // la plantilla trajo también su vocabulario, y un mensaje que habla de otra cosa manda
      // a quien lo lee a buscar donde no es.
      ? `\n\n🔴 La lista de pendientes ha CRECIDO: ${MIGRACION_PENDIENTE.length} > ${MIGRACION_MAX}.\n` +
        `Solo puede menguar. Un test nuevo se escribe con withMerchant, no se aparca aquí.\n`
      : `\n\n🔴 HOLGURA en el ratchet: ${MIGRACION_PENDIENTE.length} pendientes con el tope en ${MIGRACION_MAX}.\n` +
        `Sobran ${MIGRACION_MAX - MIGRACION_PENDIENTE.length} hueco(s), y un hueco libre es sitio para aparcar\n` +
        `un fichero nuevo sin que el test se queje. Baja MIGRACION_MAX a ${MIGRACION_PENDIENTE.length}.\n\n` +
        `Si vienes de resolver un merge entre dos tandas: el número NO es el de ninguna de las\n` +
        `dos ramas, es el largo real de la lista ya fusionada. Haz la cuenta, no elijas un lado.\n`,
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
  const v = comprobarPlazo({
    hoy,
    plazo: MIGRAR_ANTES_DE,
    pendientes: MIGRACION_PENDIENTE.length,
    avisar: (m) => {
      t.diagnostic(m);
      // Una línea que EMPIEZA por `::warning` la convierte GitHub en anotación del run. Fuera del
      // CI es una línea de texto más: no hace falta (ni conviene, scrum702) leer el entorno.
      console.log(`::warning title=SCRUM-113 plazo a ${DIAS_DE_AVISO} días o menos::${m}`);
    },
  });
  if (v.estado === 'completo') {
    t.diagnostic('migración completa: ningún test crea merchants a mano 🎉');
  } else {
    t.diagnostic(`pendientes de migrar: ${MIGRACION_PENDIENTE.length}/${MIGRACION_MAX} · plazo ${MIGRAR_ANTES_DE} · faltan ${v.dias} día(s)`);
  }
});

test('SCRUM-1644: FUERA_DEL_PLAZO también sólo mengua, y cada entrada lleva su motivo', () => {
  // Las dos mitades del trinquete, igual que MIGRACION_PENDIENTE. Sin ellas, reclasificar abre una
  // segunda puerta para aparcar ficheros sin que caiga nada.
  assert.equal(
    FUERA_DEL_PLAZO.length, FUERA_DEL_PLAZO_MAX,
    FUERA_DEL_PLAZO.length > FUERA_DEL_PLAZO_MAX
      ? `\n\n🔴 FUERA_DEL_PLAZO ha CRECIDO: ${FUERA_DEL_PLAZO.length} > ${FUERA_DEL_PLAZO_MAX}.\n` +
        `Sólo puede menguar. Sacar un fichero del plazo no es la forma de aparcarlo: un test nuevo se\n` +
        `escribe con withMerchant.\n`
      : `\n\n🔴 HOLGURA en FUERA_DEL_PLAZO: ${FUERA_DEL_PLAZO.length} entradas con el tope en ${FUERA_DEL_PLAZO_MAX}.\n` +
        `Baja FUERA_DEL_PLAZO_MAX a ${FUERA_DEL_PLAZO.length} en el mismo commit.\n`,
  );

  const malDeclaradas = FUERA_DEL_PLAZO.filter((e) =>
    !CLASES_FUERA_DEL_PLAZO.includes(e.clase)
    || !(typeof e.motivo === 'string' && e.motivo.trim().length >= 20)
    || (e.clase === 'BLOQUEADA' && !/^SCRUM-\d+$/.test(String(e.ticket))));
  assert.deepEqual(
    malDeclaradas.map((e) => e.fichero), [],
    `\n\n🔴 Entradas de FUERA_DEL_PLAZO sin clase válida (${CLASES_FUERA_DEL_PLAZO.join(' | ')}), sin\n` +
      `motivo escrito, o BLOQUEADA sin el ticket del que cuelga. Una excepción sin su porqué es una\n` +
      `deuda escondida.\n`,
  );

  const enLasDos = FUERA_DEL_PLAZO.filter((e) => MIGRACION_PENDIENTE.includes(e.fichero));
  assert.deepEqual(enLasDos.map((e) => e.fichero), [], '🔴 un fichero no puede estar pendiente Y fuera del plazo a la vez');

  const yaNoCreanAMano = FUERA_DEL_PLAZO
    .filter((e) => fs.existsSync(path.join(DIR, e.fichero)))
    .filter((e) => !clasificar(e.fichero).manual);
  assert.deepEqual(
    yaNoCreanAMano.map((e) => e.fichero), [],
    `\n\n🔴 Estas entradas de FUERA_DEL_PLAZO ya NO crean merchants a mano: sácalas y baja\n` +
      `FUERA_DEL_PLAZO_MAX en el mismo commit (si es BLOQUEADA, mira si su ticket se cerró).\n`,
  );
});

test('SCRUM-1644: el plazo AVISA a 14 días o menos, sin bloquear, y cae al pasar la fecha', async (t) => {
  const plazo = '2026-12-15';
  const restar = (dias) => new Date(Date.parse(`${plazo}T00:00:00Z`) - dias * DIA_MS).toISOString().slice(0, 10);
  const probar = (hoy, pendientes = 1) => {
    const avisos = [];
    const v = comprobarPlazo({ hoy, plazo, pendientes, avisar: (m) => avisos.push(m) });
    return { v, avisos };
  };

  await t.test('a 10 días: SALE el aviso y NO falla', () => {
    const { v, avisos } = probar(restar(10));
    assert.equal(v.estado, 'aviso');
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /faltan 10 día/);
  });

  await t.test('a 30 días: NO sale nada', () => {
    const { v, avisos } = probar(restar(30));
    assert.equal(v.estado, 'en-plazo');
    assert.deepEqual(avisos, []);
  });

  await t.test('con la fecha pasada: FALLA, como antes de SCRUM-1644', () => {
    assert.throws(() => probar(restar(-1)), /CADUCÓ el plazo/);
  });

  await t.test('los bordes: el día 14 avisa, el 15 calla, el propio día del plazo avisa y no cae', () => {
    assert.equal(probar(restar(14)).avisos.length, 1);
    assert.equal(probar(restar(15)).avisos.length, 0);
    const delDia = probar(plazo);
    assert.equal(delDia.v.estado, 'aviso');
    assert.match(delDia.avisos[0], /faltan 0 día/);
  });

  await t.test('sin pendientes no avisa ni cae, aunque la fecha haya pasado', () => {
    const { v, avisos } = probar(restar(-30), 0);
    assert.equal(v.estado, 'completo');
    assert.deepEqual(avisos, []);
  });

  await t.test('una fecha que no sé leer NO cuenta como «en plazo»', () => {
    assert.throws(() => comprobarPlazo({ hoy: restar(30), plazo: '15-12-2026', pendientes: 1 }), /no sé leer la fecha/);
    assert.throws(() => comprobarPlazo({ hoy: 'hoy', plazo, pendientes: 1 }), /no sé leer la fecha/);
  });
});

// SCRUM-1644 · las mutaciones que el meta-guard (scripts/meta-guard-mutaciones.mjs) aplica en el CI.
// Son el control ③ del encargo puesto en el camino por defecto: si un día reclasificar convierte
// este trinquete en un colador, alguna de estas deja de tumbarlo y el meta-guard lo dice MUDO.
// Las anclas acaban en salto de línea real, que en el literal de abajo es `\n`: así la declaración
// no se cita a sí misma. Y `prisma.merchant\x2ecreate` va escapado para que ESTE fichero no case
// con CREA_A_MANO (se leería «crea a mano» y caería él solo).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Un cuarto fichero aparcado en la lista de pendientes, sin tocar el tope.
    fichero: 'tests/scrum113-migracion-fixtures.test.mjs',
    de: "  'scrum17-recapitulativa.test.mjs',   // consolidación fiscal — con su dueño\n];\n",
    a: "  'scrum17-recapitulativa.test.mjs',   // consolidación fiscal — con su dueño\n  'scrum22-operario-readpath.test.mjs',\n];\n",
    cae: 'SCRUM-113: la lista de pendientes solo mengua (ratchet + caducidad)',
  },
  {
    // Un fichero aparcado en FUERA_DEL_PLAZO, sin tocar su tope: la segunda puerta, cerrada.
    fichero: 'tests/scrum113-migracion-fixtures.test.mjs',
    de: "    motivo: 'depende del seed demo, sin resolver: se migra cuando se cierre SCRUM-63',\n  },\n];\n",
    a: "    motivo: 'depende del seed demo, sin resolver: se migra cuando se cierre SCRUM-63',\n  },\n  { fichero: 'scrum22-operario-readpath.test.mjs', clase: 'EXCEPCION_PERMANENTE', motivo: 'aparcado para que el test pase en verde' },\n];\n",
    cae: 'SCRUM-1644: FUERA_DEL_PLAZO también sólo mengua, y cada entrada lleva su motivo',
  },
  {
    // Un fichero que vuelve a crear merchants a mano sin estar en ninguna lista.
    fichero: 'tests/scrum22-operario-readpath.test.mjs',
    de: "import test from 'node:test';\n",
    a: "import test from 'node:test';\n// prisma.merchant\x2ecreate({ data: {} })\n",
    cae: 'SCRUM-113: ningún fichero NUEVO nace con el patrón viejo',
  },
  {
    // El aviso que deja de salir: el preaviso de SCRUM-1644, desactivado.
    fichero: 'tests/scrum113-migracion-fixtures.test.mjs',
    de: '  if (dias <= diasDeAviso) return { estado: \'aviso\', dias };\n',
    a: '',
    cae: 'SCRUM-1644: el plazo AVISA a 14 días o menos, sin bloquear, y cae al pasar la fecha',
  },
  {
    // El rojo del día después, aflojado a un aviso: lo que NO se puede hacer nunca.
    fichero: 'tests/scrum113-migracion-fixtures.test.mjs',
    de: '  if (dias < 0) return { estado: \'caducado\', dias };\n',
    a: '  if (dias < 0) return { estado: \'aviso\', dias };\n',
    cae: 'SCRUM-1644: el plazo AVISA a 14 días o menos, sin bloquear, y cae al pasar la fecha',
  },
];
