#!/usr/bin/env node
// scripts/censo-mudez.mjs — SCRUM-719
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿QUÉ GUARDS SIGUEN EN VERDE MIRANDO LA NADA?
//
// Un guard que afirma una negación —«en este fichero no aparece X»— pasa igual si el texto que
// mira está vacío. No hay forma de inyectar el token prohibido de setenta guards distintos, así
// que se hace lo uniforme: se rompe `soloEjecutable` para que devuelva la cadena vacía y se corre
// cada guard. **Uno vivo tiene que ponerse ROJO.** Si sigue verde, está mudo.
//
// ── 🔴 LO QUE ESTE CENSO AÑADE, Y ES EL TICKET ENTERO ────────────────────────────────────
// La primera versión (SCRUM-700b) dio 15 mudos y hubo que apartar tres A MANO por ser módulos
// auxiliares sin tests propios. Separar a mano es justo lo que este repo lleva tickets
// desterrando: **«no encuentro» y «no he mirado» tienen que salir por puertas distintas, y el
// instrumento tiene que saber cuál es cuál sin que nadie se lo diga.**
//
// Aquí salen por CUATRO puertas y las cuatro se DECIDEN MIDIENDO:
//
//   VIVO       se pone rojo con el filtro vacío. Su negación tiene respaldo.
//   MUDO       sigue verde con el filtro vacío. Pasaría igual sobre un fichero vacío.
//   CIEGO      la tanda no ejecutó NI UN test. Verde por no mirar, que no es por no encontrar.
//   NO APLICA  nunca llegó a llamar al filtro. La mutación no le alcanza, así que su verde no
//              dice nada de él.
//
// ── 🔴 POR QUÉ «NO APLICA» SE MIDE Y NO SE DEDUCE DEL FUENTE ─────────────────────────────
// La primera versión de ESTE script sí lo deducía —buscaba `soloEjecutable(` en el código sin
// comentarios— y se equivocó dos veces seguidas, las dos hacia el mismo lado:
//
//   ① Cinco ficheros (`scrum226`, `scrum402`, `scrum403`, `scrum409`, `scrum480`) sólo NOMBRAN el
//      helper en un comentario; dos conservan además el `import` sin usarlo. Un censo sobre el
//      texto crudo se los cree. (Autorreferencia: el sitio natural donde se escribe el nombre del
//      helper es el comentario que explica por qué se usa.)
//   ② `scrum201-citas-aeat` SÍ llama a `leerFuente`, pero con `{ conComentarios: true }`, que
//      devuelve el texto **sin pasar por el filtro**. Al fuente eso no se le ve: es una decisión
//      de tiempo de ejecución. Contarlo habría inflado el hallazgo con un guard sano.
//
// Así que la pregunta «¿llegó a llamar al filtro?» se la contesta el propio filtro: en la pasada
// limpia se instrumenta para que AVISE la primera vez que lo llaman de verdad. Medido, no leído.
//
// ── ⛔ LA MUTACIÓN NUNCA SE COMMITEA ─────────────────────────────────────────────────────
// El helper se restaura en un `finally` **y se verifica byte a byte** antes de salir. Si la
// verificación fallara, el censo sale con código 3 gritándolo: dejar `soloEjecutable` roto en el
// árbol es peor que cualquier hallazgo que este script pueda dar.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// 🔴 SCRUM-808 · LA MISMA red que el meta-guard, no una parecida (regla 2).
import {
  marcaDe, marcarEnVuelo, borrarMarca, restaurarDesdeMarca, instalarRedDeSeguridad,
} from './_marca-de-arbol.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELPER = path.join(RAIZ, 'tests', '_guard-texto.mjs');
const DIR = path.join(RAIZ, 'tests');
const FIRMA = 'export function soloEjecutable(fuente, { almohadillaEsComentario = true } = {}) {\n';
const MARCA = '__FILTRO_LLAMADO__';

/**
 * Candidatos: los que MENCIONAN el helper. Quién lo llama de verdad lo decide la medición.
 *
 * 🔴 LA LISTA DE NOMBRES INCLUYE `ejecutableDe`/`ejecutablesDe`, Y NO ES UN DETALLE. Al poner el
 * suelo a los trece mudos, nueve de ellos pasaron de importar `soloEjecutable` a importar
 * `ejecutableDe` — y este censo, que buscaba el nombre VIEJO, dejó de verlos: la población cayó
 * de 82 a 73 y el veredicto pasó a «0 mudos» en parte POR NO MIRAR. El mismo defecto que el
 * censo persigue, dentro del censo, causado por su propio arreglo. Lo cazó que el número de
 * candidatos bajara exactamente en 9, que eran los 9 migrados.
 *
 * Si mañana nace otro envoltorio del filtro, SU NOMBRE VA AQUÍ en el mismo commit.
 */
const FICHEROS = fs.readdirSync(DIR)
  .filter((f) => /\.test\.mjs$/.test(f))
  .filter((f) => /soloEjecutable|ejecutableDe|ejecutablesDe|leerFuente|literalesDeCadena/.test(fs.readFileSync(path.join(DIR, f), 'utf8')))
  .sort();

console.log(`Guards que mencionan el filtro de comentarios: ${FICHEROS.length}`);
if (FICHEROS.length < 20) {
  console.error('🔴 CIEGO: la población es demasiado pequeña. Eso no es «hay pocos guards»: es que '
    + 'el censo no está mirando donde cree, y su cero se leería como limpieza.');
  process.exit(2);
}

/** Corre un fichero y devuelve `{ verde, tests, llamoAlFiltro }`. `tests: 0` es CEGUERA. */
function correr(fichero) {
  // 🔴 `spawnSync` y NO `execFileSync`: aquel devuelve SÓLO stdout, así que en una tanda VERDE
  // la marca del filtro —que va por stderr— se perdía y tres guards que SÍ llaman salían como
  // «NO APLICA». El instrumento mintió hacia el lado cómodo: menos hallazgos.
  const r = spawnSync(process.execPath, ['--test', path.join('tests', fichero)],
    { cwd: RAIZ, encoding: 'utf8', timeout: 180000 });
  const salida = `${r.stdout || ''}${r.stderr || ''}`;
  const verde = r.status === 0;
  const m = salida.match(/^\D*tests (\d+)/m);
  return { verde, tests: m ? Number(m[1]) : 0, llamoAlFiltro: salida.includes(MARCA) };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-808 · LA REPARACIÓN VA **ANTES** DE CAPTURAR `ORIGINAL`. No es un detalle de orden:
// es el defecto que se midió al escribir esto.
//
// La primera versión reparaba DESPUÉS de leer el helper. Consecuencia, reproducida: la pasada
// leía el fichero TODAVÍA MUTADO, lo tomaba como su línea base, y a partir de ahí su propio
// `finally` «restauraba» **a un estado mutado**. El resto se volvía permanente y encima se
// apilaba: dos líneas de instrumentación una debajo de otra, y la marca nueva guardando como
// «original» unos bytes que ya llevaban la mutación de la pasada muerta.
//
// O sea: el remedio, mal ordenado, CONVERTÍA un resto reparable en uno definitivo.
// ═════════════════════════════════════════════════════════════════════════════════════════
const DIR_MARCA = marcaDe('censo-mudez');
const pendiente = restaurarDesdeMarca(DIR_MARCA);
if (pendiente.sucios.length) {
  console.error('🔴🔴 EL ÁRBOL SE QUEDÓ SUCIO DE UNA PASADA ANTERIOR Y NO HE PODIDO REPARARLO.');
  for (const s of pendiente.sucios) console.error(`   · ${s}`);
  console.error(`   La dejó una pasada muerta (pid ${pendiente.pid}, ${pendiente.cuando}). Los bytes `
    + `originales siguen en \`${path.relative(RAIZ, DIR_MARCA)}\`. MÍRALO A MANO: no se mide nada `
    + 'sobre un árbol mutado.');
  process.exit(3);
}
if (pendiente.reparadas.length) {
  console.error(`⚠️ UNA PASADA ANTERIOR MURIÓ CON LA MUTACIÓN PUESTA (pid ${pendiente.pid}, `
    + `${pendiente.cuando}). Devuelto a sus bytes: \`${pendiente.reparadas.join('` y `')}\`.`);
}

const ORIGINAL = fs.readFileSync(HELPER, 'utf8');
if (ORIGINAL.split(FIRMA).length !== 2) {
  console.error('🔴 CIEGO: no encuentro la firma de `soloEjecutable`. Sin poder mutar no hay medida, '
    + 'y un censo que no puede mutar tiene que decirlo, no devolver «cero mudos».');
  process.exit(2);
}
const conCuerpo = (linea) => ORIGINAL.replace(FIRMA, FIRMA + linea);

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-808 · LA RED, Y ES **LA MISMA PIEZA** QUE LA DEL META-GUARD, NO UNA PARECIDA.
//
// Lo de abajo restaura en un `finally`, y **una terminación no ejecuta ese `finally`**.
// Reproducido antes de tocar nada: lanzado y matado a mitad, `tests/_guard-texto.mjs` se queda
// con la línea de instrumentación puesta —una que **escribe en `stderr` en CADA llamada al
// filtro**—. Y ese fichero está VERSIONADO y lo usan decenas de guards: aquí un resto no se
// queda en un fichero cualquiera, se queda en algo que otro mergea sin mirar. Es PEOR que el
// caso que originó el ticket.
//
// La comprobación posterior («y se COMPRUEBA, no se supone») tampoco corre si el proceso muere:
// vive después del `finally`, en el mismo hilo que ya no existe.
//
// ⛔ Y por eso NO se le ha escrito una red propia: dos implementaciones del mismo remedio son la
// regla 2, y dentro de seis meses una de las dos está rota sin que nadie lo sepa. Se importa
// `_marca-de-arbol.mjs`, con SU carpeta y SU lista en vuelo — dos marcas en el mismo sitio se
// pisarían.
//
// ⚠️ Lo que la red NO hace, y queda declarado igual que en el meta-guard: en Windows no llega
// señal atrapable y un hijo desprendido muere con el padre, así que entre el kill y la siguiente
// invocación **el árbol sigue mutado**. Lo que cambia es que ahora SE DICE.
// ═════════════════════════════════════════════════════════════════════════════════════════
const EN_VUELO = [];
const PIEZAS = [{ ruta: 'tests/_guard-texto.mjs', abs: HELPER, ORIGINAL: Buffer.from(ORIGINAL, 'utf8') }];

const resultado = [];
marcarEnVuelo(PIEZAS, DIR_MARCA);
EN_VUELO.push(...PIEZAS);
instalarRedDeSeguridad(undefined, EN_VUELO, DIR_MARCA);
try {
  // ── ① PASADA LIMPIA E INSTRUMENTADA ──────────────────────────────────────────────────
  // El comportamiento no cambia: sólo avisa la primera vez que lo llaman. De aquí salen las dos
  // cosas que la mutación NO puede decir: cuántos tests corren, y si el filtro llegó a usarse.
  fs.writeFileSync(HELPER, conCuerpo(
    `  if (!globalThis.__filtroVisto) { globalThis.__filtroVisto = 1; process.stderr.write('${MARCA}\\n'); }\n`,
  ), 'utf8');
  console.log('\n① Pasada limpia e instrumentada — cuántos tests corre cada uno, y si llama al filtro');
  const antes = new Map();
  for (const f of FICHEROS) antes.set(f, correr(f));
  const usan = FICHEROS.filter((f) => antes.get(f).llamoAlFiltro);
  console.log(`   llaman al filtro de verdad: ${usan.length} · sólo lo mencionan: ${FICHEROS.length - usan.length}`);

  // ── ② PASADA MUTADA ──────────────────────────────────────────────────────────────────
  fs.writeFileSync(HELPER, conCuerpo("  return ''; // SCRUM-719 mutación de medida\n"), 'utf8');
  console.log('\n② Pasada mutada — `soloEjecutable` devuelve la cadena vacía');
  for (const f of FICHEROS) {
    const a = antes.get(f);
    if (a.tests === 0) { resultado.push({ f, clase: 'CIEGO', tests: 0 }); continue; }
    if (!a.llamoAlFiltro) { resultado.push({ f, clase: 'NO APLICA', tests: a.tests }); continue; }
    if (!a.verde) { resultado.push({ f, clase: 'YA ROJO', tests: a.tests }); continue; }
    resultado.push({ f, clase: correr(f).verde ? 'MUDO' : 'VIVO', tests: a.tests });
  }
} finally {
  fs.writeFileSync(HELPER, ORIGINAL, 'utf8');
  EN_VUELO.length = 0; // ya no hay nada que la red tenga que devolver
}

// ⛔ Y se COMPRUEBA, no se supone: el `finally` pudo correr con el disco lleno.
if (fs.readFileSync(HELPER, 'utf8') !== ORIGINAL) {
  console.error('🔴🔴 `tests/_guard-texto.mjs` NO ha quedado como estaba. NO COMMITEES NADA. '
    + `Los bytes originales están en \`${path.relative(RAIZ, DIR_MARCA)}\`, y la marca se queda `
    + 'ahí: la siguiente pasada intentará repararlo y, si no puede, lo volverá a decir.');
  process.exit(3);
}
// Cuadró: la marca se retira. Sólo aquí, y sólo después de haberlo verificado.
borrarMarca(DIR_MARCA);

// ── ③ EL VEREDICTO, por sus cuatro puertas ──────────────────────────────────────────────
const de = (c) => resultado.filter((r) => r.clase === c);
console.log('\n════════ VEREDICTO ════════');
for (const c of ['VIVO', 'MUDO', 'CIEGO', 'NO APLICA', 'YA ROJO']) {
  console.log(`  ${c.padEnd(10)} ${de(c).length}`);
}
for (const [clase, titulo] of [
  ['MUDO', '🔴 MUDOS — su negación pasaría igual sobre un fichero vacío'],
  ['CIEGO', '⚠️ CIEGOS — no ejecutaron ni un test. Verde por no mirar'],
  ['NO APLICA', '📌 NO APLICA — nunca llamaron al filtro; su verde no dice nada de ellos'],
]) {
  if (!de(clase).length) continue;
  console.log(`\n${titulo}:`);
  for (const r of de(clase)) console.log(`    ${r.f}${r.tests ? `  (${r.tests} tests)` : ''}`);
}

console.log(`\n✓ \`tests/_guard-texto.mjs\` comprobado idéntico al original.`);
process.exit(de('MUDO').length ? 1 : 0);
