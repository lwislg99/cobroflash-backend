#!/usr/bin/env node
// scripts/censo-tablero-vs-arbol.mjs — SCRUM-738
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// QUÉ TICKETS TIENEN SU TRABAJO EN `main`. UNA PROPUESTA PARA CONTRASTAR CON EL TABLERO.
//
// EL DEFECTO: el tablero refleja una INTENCIÓN y se lee como si reflejara hechos. En un solo día
// se encargaron diez tickets ya mergeados; cuatro sesiones pararon a decirlo, una vuelta cada una.
// El coste no son las vueltas: es que **la parada depende de que alguien se dé cuenta**.
//
// ⛔ ESTO PROPONE, NUNCA ACTÚA. No cierra tickets y no toca el tablero. Imprime y nada más.
//
// ── 🔴 ESTO ES SUPERFICIE, NO MOTOR — Y MI PASO 0 SE EQUIVOCÓ ───────────────────────────────
//
// Llegué a escribir un censo entero antes de encontrar que **el motor ya existía**:
// `tests/_censo-tickets.mjs` (SCRUM-388) contesta desde agosto «¿qué hay en `main` de un ticket?»
// con las MISMAS tres fuentes —commits que lo nombran, entrada de máster, ramas— y además con su
// propio suelo (`comprobarSuelo`) y su medida de capacidad. Lo busqué en `scripts/censo-*` y no
// miré en `tests/`. Mi motor se retiró entero: **la misma regla implementada dos veces es cómo
// una de las dos se queda atrás.**
//
// Lo que sí faltaba, y es lo único que este ticket añade:
//   ① la ENUMERACIÓN — `censarTicket` responde por UN ticket; nadie preguntaba por todos;
//   ② el discriminador de NÚMERO COMPARTIDO, que se arregló DENTRO del motor (ver abajo);
//   ③ la ventana de presentación, para que la propuesta sea contrastable por un humano.
//
// ── 🔴 NINGUNA SEÑAL BASTA SOLA ────────────────────────────────────────────────────────────
// Una rama puede existir SIN mergear, y una entrada de máster puede ser DE OTRO TICKET: medido,
// `docs/master/SCRUM-684.md` existe y su primer título dice `# SCRUM-683`. Con el número
// compartido ninguna señal es fiable, y el motor devuelve `NO_MEDIBLE` en vez de `ENTERO`.
//
// ── ⛔ POR IDENTIDAD, NUNCA POR SUBSTRING ───────────────────────────────────────────────────
// «72» casa con 720, 727 y 1727. Los números se extraen con delimitadores y se comparan enteros.
//
// USO:
//   node scripts/censo-tablero-vs-arbol.mjs             → la propuesta de los últimos 7 días
//   node scripts/censo-tablero-vs-arbol.mjs --dias=30   → otra ventana
//   node scripts/censo-tablero-vs-arbol.mjs --json      → el censo entero, para otro programa
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { censarTicket, comprobarSuelo } from '../tests/_censo-tickets.mjs';
// SCRUM-804 · LA DIMENSIÓN QUE FALTABA: dónde está el trabajo, no sólo si algo lo nombra.
//
// ⚠️ ESTE IMPORT CIERRA UN CICLO, y se declara en vez de descubrirse: `_rastro-del-ticket.mjs`
// importa `_censo-alcanzabilidad.mjs`, que importa `numeroDeRama` de ESTE fichero. En ESM es
// benigno porque las tres son declaraciones de función (hoisted) y ninguna se usa durante la
// evaluación del módulo — sólo dentro de funciones. Comprobado ejecutándolo, no razonándolo.
// La alternativa era copiar `numeroDeRama` a un cuarto sitio, que es peor: la misma regla escrita
// dos veces es cómo una de las dos se queda atrás (lección del PASO 0 de este mismo ticket).
import { rastroDeLosTickets, RASTRO, esCiego } from './_rastro-del-ticket.mjs';

const RAIZ = process.cwd();

/**
 * El número de ticket de un nombre de rama, o `null`.
 *
 * ⛔ ANCLADO Y CON DELIMITADOR: `scrum-72-x` da 72 y `scrum-727-x` da 727. Y `scrum-684b-…` da
 * 684, porque la letra es una FASE del mismo ticket, no otro número.
 */
export function numeroDeRama(nombre) {
  const m = /^scrum-0*(\d+)[a-z]?-/.exec(String(nombre ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** El número de un nombre de fichero de máster (`SCRUM-714.md`), o `null`. */
export function numeroDeEntrada(fichero) {
  const m = /^SCRUM-0*(\d+)\.md$/.exec(String(fichero ?? '').trim());
  return m ? Number(m[1]) : null;
}

/**
 * Los números a censar, DERIVADOS de dos fuentes del árbol: ramas remotas ya traídas y ficheros de
 * `docs/master/`. Ninguna lista a mano: envejecería el día que nace el siguiente ticket.
 */
export function numerosDelArbol(raiz = RAIZ) {
  const refs = execFileSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'],
    { cwd: raiz, encoding: 'utf8' }).split('\n').map((s) => s.replace(/^origin\//, '').trim()).filter(Boolean);
  const dir = path.join(raiz, 'docs', 'master');
  const entradas = fs.existsSync(dir) ? fs.readdirSync(dir) : [];

  const numeros = new Set();
  for (const r of refs) { const n = numeroDeRama(r); if (n) numeros.add(n); }
  for (const f of entradas) { const n = numeroDeEntrada(f); if (n) numeros.add(n); }
  return { numeros: [...numeros].sort((a, b) => a - b), refs: refs.length, entradas: entradas.length };
}

/** La fecha del commit más reciente entre la evidencia de un ticket, o `null`. */
export function ultimaFecha(fila) {
  const fechas = (fila.commits || []).map((c) => c.fecha).filter(Boolean).sort();
  return fechas.length ? fechas[fechas.length - 1] : null;
}

/**
 * La POBLACIÓN declarada, SIN correr el motor.
 *
 * ⚠️ Va aparte de `censar()` por una razón medida: el motor consulta git POR TICKET, y con 444
 * tickets el censo entero tarda ~10 minutos. Un test que sólo necesita saber sobre qué se ha
 * calculado no puede pagar eso — metido en `npm test` se lo cobraría a las nueve sesiones en cada
 * tanda. Lo caro se queda en el CLI; lo barato es lo que la suite ejercita.
 */
export function poblacionDe(raiz = RAIZ) {
  const { numeros, refs, entradas } = numerosDelArbol(raiz);
  return {
    ramasTraidas: refs,
    entradasDeMaster: entradas,
    ticketsCensados: numeros.length,
    frontera: 'números derivados de ramas remotas ya traídas + ficheros de docs/master/',
    noMide: 'el ESTADO EN EL TABLERO: eso lo pone un humano al contrastar',
    motor: 'tests/_censo-tickets.mjs (SCRUM-388) — esta pieza sólo enumera y presenta',
  };
}

export function censar({ raiz = RAIZ } = {}) {
  const { numeros } = numerosDelArbol(raiz);
  const filas = numeros.map((n) => {
    const r = censarTicket(n, { raiz });
    return { ...r, numero: n, ultima: ultimaFecha(r) };
  });
  return { poblacion: poblacionDe(raiz), filas };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
// ⚠️ `fileURLToPath` y NO `new URL(...).pathname`: esta ruta tiene un ESPACIO («Javier Pereira»)
// y el `pathname` lo devuelve percent-codificado (`Javier%20Pereira`), así que la comparación
// fallaba en silencio y el CLI no imprimía nada. Es exactamente el defecto de SCRUM-730, y me ha
// mordido a mí quince minutos después de reportarlo.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const censo = censar();
  const p = censo.poblacion;

  // 🔴 SCRUM-775 · EL SUELO SE COMPRUEBA ANTES DE INFORMAR POR CUALQUIERA DE LAS DOS BOCAS.
  //
  // La ruta `--json` salía con **0 siempre**, y salía ANTES del suelo. Su propia cabecera dice
  // «para otro programa»: un programa que lea esa salida no tenía forma de distinguir «medido» de
  // «no supe medir» sin parsear prosa — que es el mismo defecto por la puerta de atrás.
  //
  // Medido antes de tocarlo: NADIE consume esa ruta (`git grep 'censo-tablero-vs-arbol.*--json'`
  // sólo casa con el comentario de uso de este mismo fichero), así que cambiarle el código de
  // salida no rompe ningún llamador. El suelo viaja además DENTRO del JSON, para que no haya que
  // deducirlo del código de salida.
  const suelo = comprobarSuelo({ raiz: RAIZ });

  // SCRUM-804 · la dimensión se calcula AQUÍ ARRIBA, antes de que se bifurquen las dos bocas.
  // Si se calculara sólo en la de texto, la salida `--json` —cuya cabecera dice «para otro
  // programa»— seguiría publicando tickets EN RAMA VIVA como si su trabajo estuviera en `main`,
  // y el consumidor no tendría forma de distinguirlo. Es el mismo defecto de SCRUM-775 (el suelo
  // que salía después del `--json`) por la misma puerta.
  const rastro = rastroDeLosTickets({ raiz: RAIZ, traer: true });
  const rastroDe = (n) => (rastro.porTicket.get(n) || {}).rastro || RASTRO.SIN_RASTRO;

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 SCRUM-804 · LA DIMENSIÓN NO ES DUEÑA DEL `exit` DEL CENSO, Y ESO SE APRENDIÓ CAYENDO
  //
  // Aquí puse `|| esCiego(rastro.resumen)` dentro de `noSeFia`, y el meta-guard salió **MUDO**:
  //
  //     scrum775 · el guard NO cayó. Test que debía ponerse rojo:
  //     «SCRUM-775 · 🔴 EL QUE DECIDE: con el censo encogido el CLI sale con 2 y DICE por qué»
  //
  // Medido provocándolo (mutación ① aplicada a mano, test corrido, fuente restaurado byte a byte):
  // con el término de `suelo` neutralizado, el CLI **seguía saliendo con 2** sobre el árbol
  // encogido, porque MI término ya lo ponía a `true` por su cuenta. O sea que el fallo del suelo
  // AJENO había dejado de ser observable: **dos condiciones independientes compartiendo un solo
  // `exit` hacen incazable una mutación sobre cualquiera de las dos.**
  //
  // ⛔ NO se arregla relajando el suelo de SCRUM-775 —ése chilla bien— sino devolviéndole la
  // propiedad de su decisión: `noSeFia` vuelve a ser SÓLO del censo, exactamente como estaba.
  //
  // ¿Y qué pasa cuando MI dimensión no se puede medir? Que no se imprime su lista. Es la salida
  // honesta y además la única segura: una lista vacía y una lista no medida se leen igual, así
  // que no se enseña ninguna. Matar el informe entero —incluida la propuesta del censo, que sí se
  // pudo medir— por una sección que no, era desproporcionado; y encima cegaba a otro guard.
  const ramasFiables = !esCiego(rastro.resumen);

  // 🔴 Y SI NO ES FIABLE, NO FILTRA. Retirar filas de la propuesta usando una dimensión que no se
  // ha podido medir es dejar caer tickets en silencio — el mismo defecto que este censo persigue,
  // cometido con la pieza nueva.
  const soloRamaViva = (f) => ramasFiables
    && f.fuentes.length === 1 && f.fuentes[0] === 'ramas' && rastroDe(f.numero) === RASTRO.EN_RAMA_VIVA;

  const noSeFia = p.ticketsCensados === 0 || suelo.length > 0;

  if (process.argv.includes('--json')) {
    const filas = censo.filas.map((f) => ({
      ...f,
      rastro: rastroDe(f.numero),
      ramasVivas: (rastro.porTicket.get(f.numero) || { ramas: [] }).ramas.filter((r) => r.clase === 'viva'),
    }));
    console.log(JSON.stringify({
      ...censo, filas, suelo, sueloRamaViva: rastro.suelo, ramas: rastro.resumen,
      shaMedido: rastro.inst.sha, fiable: !noSeFia,
      // Dos banderas y no una: `fiable` es del CENSO y `ramasFiables` de la DIMENSIÓN. Un
      // programa tiene que poder saber que el censo se midió y la dimensión no — con una sola
      // bandera tendría que elegir entre tirar todo o creerse la mitad no medida.
      ramasFiables,
    }, null, 2));
    process.exit(noSeFia ? 2 : 0);
  }

  console.log(`\nPOBLACIÓN — ${p.ticketsCensados} tickets, de ${p.ramasTraidas} ramas traídas y `
    + `${p.entradasDeMaster} entradas de máster.`);
  console.log(`  Motor: ${p.motor}`);
  console.log(`  ⚠️ NO mide ${p.noMide}.\n`);

  // 🔴 EL SUELO, ANTES DE NADA, y se usa el del propio motor: un censo vacío no dice «el tablero
  // está al día», dice «no supe mirar».
  //
  // ── 🔴 SCRUM-775 · ESTA MITAD DEL SUELO NO PUDO DISPARARSE NUNCA ────────────────────────────
  //
  // Aquí ponía `(suelo && suelo.ok === false)`, y `comprobarSuelo` devuelve un **ARRAY** de
  // problemas (`[]` cuando el árbol está sano). Un array no tiene `.ok`, así que la expresión era
  // `undefined === false` → **siempre falsa**. De las dos condiciones sólo vivía la primera.
  //
  // Provocado el 6-sep-2026 antes de tocar nada, sobre un clon de la fixture de la casa con
  // `docs/master/` encogido de 28 entradas a 3 y el historial intacto (111 commits):
  //
  //     comprobarSuelo(...)  →  ["docs/master/ solo tiene 3 entradas SCRUM-*.md"]   (1 problema)
  //     el CLI               →  exit 0, informe completo, stderr VACÍO
  //
  // O sea: el censo encogió un 89 %, su propio suelo lo vio, y esto informó igual. Es el defecto
  // que este fichero existe para cazar —«no supe mirar» leído como «no hay desfase»— cometido por
  // el propio fichero.
  //
  // ⚠️ Se compara por LONGITUD y no por `.ok`, `.length > 0` y no truthiness del array: `[]` es
  // truthy en JS, así que `if (suelo)` habría sido el mismo defecto con otra cara — saltaría
  // SIEMPRE, que es la avería contraria y se desactiva en una tarde.
  //
  // Y ahora se IMPRIMEN los motivos: un suelo que salta sin decir por qué obliga a reproducirlo.
  if (noSeFia) {
    console.error('🔴 CENSO VACÍO O SIN CAPACIDAD DE MEDIR. No significa «no hay desfase»: '
      + 'significa que no se ha visto ni una rama ni una entrada de máster.');
    if (p.ticketsCensados === 0) console.error('   · CERO tickets censados.');
    for (const m of suelo) console.error(`   · ${m}`);
    // SCRUM-804 · el suelo de la dimensión de rama viva se imprime AQUÍ, y no en un `if` propio
    // más abajo: `noSeFia` ya lo incluye, así que aquel bloque nacía INALCANZABLE — la condición
    // que su propio código hace imposible de satisfacer, que es un modo de fallo ya pagado aquí.
    for (const m of rastro.suelo) console.error(`   · rama viva: ${m}`);
    console.error(`   árbol: ${RAIZ}`);
    process.exit(2);
  }

  const DIAS = Number((process.argv.find((a) => a.startsWith('--dias=')) || '--dias=7').split('=')[1]);
  const corte = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 SCRUM-804 · LA DIMENSIÓN QUE FALTABA, Y EL FALSO POSITIVO QUE QUITA
  //
  // Este censo cuenta la EXISTENCIA de una rama como fuente. Existir no es estar mergeada, así que
  // un ticket cuya ÚNICA evidencia es una rama sin mergear salía `ENTERO` y se imprimía debajo del
  // titular «tienen trabajo suyo en `main`» — donde no hay ni una línea suya.
  //
  // Medido el 8-sep-2026, y no es hipotético: los cuatro tickets que originaron SCRUM-804 (819,
  // 816, 820 y 821) salían los cuatro `ENTERO` con `ramas` como única fuente, y cuatro sesiones se
  // encargaron de ellos y pararon una por una. Ése es el coste de este falso positivo.
  //
  // ⛔ NO se retira a nadie por tener una rama viva: 600, 597 y 595 tienen trabajo EN `main` **y**
  // rama viva a la vez, y siguen siendo propuesta legítima. Lo que se retira es el caso exacto del
  // defecto: **`ramas` como única fuente Y ninguna de ellas mergeada** (`soloRamaViva`, arriba).
  const enMain = censo.filas
    .filter((f) => f.veredicto === 'ENTERO' || f.veredicto === 'PARCIAL')
    .filter((f) => !soloRamaViva(f));
  const enRamaViva = censo.filas.filter(soloRamaViva);
  const recientes = enMain.filter((f) => f.ultima && f.ultima >= corte)
    .sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));

  // Los motivos NO fatales se dicen igual — pero por **stdout**, con el informe, y no por stderr.
  //
  // 🔴 ME LO CAZÓ SCRUM-775, QUE EXIGE stderr VACÍO SOBRE UN ÁRBOL SANO. Y tiene razón: un aviso
  // por el canal de errores convierte «he mirado y no había ninguna viva» en algo que un CI lee
  // como avería. La salvedad es parte del informe, no una queja del instrumento.
  for (const m of rastro.suelo) console.log(`⚠️  rama viva · ${m}`);

  if (!ramasFiables) {
    // 🔴 NO SE IMPRIME LISTA. Una lista vacía y una lista NO MEDIDA se leen exactamente igual, y
    // la segunda dice lo contrario de lo que parece. El censo sí se pudo medir, así que su
    // propuesta sigue abajo y el `exit` no cambia: lo que falta es esta sección, y se dice.
    console.log('═══ 🔴 SCRUM-804 · EN RAMA VIVA · NO SE HA PODIDO MEDIR ═══');
    for (const m of rastro.suelo) console.log(`    · ${m}`);
    console.log('    No se enseña la lista a propósito: vacía y no-medida son el mismo texto y');
    console.log('    significan lo contrario. El resto del informe sí está medido.\n');
  } else {

  console.log('═══ 🔴 SCRUM-804 · EN RAMA VIVA · su trabajo NO está en `main` ═══');
  console.log('    Tienen rama en el remoto SIN MERGEAR y ninguna otra evidencia. El tablero puede');
  console.log('    decir que están por hacer y estar construidos enteros: es la otra mitad del');
  console.log('    desfase, y la que hace que una sesión los reconstruya desde cero.');
  console.log(`    (+N) = commits que esa rama tiene FUERA de \`main\` — el tamaño del trabajo vivo.\n`);
  for (const f of enRamaViva.sort((a, b) => b.numero - a.numero)) {
    const ramas = (rastro.porTicket.get(f.numero) || { ramas: [] }).ramas
      .filter((r) => r.clase === 'viva')
      .map((r) => `${r.nombre} (+${r.adelanto})`).join(' · ');
    console.log(`  ${f.ticket}`.padEnd(15) + ramas);
  }
  console.log(`\n  → ${enRamaViva.length} ticket(s) con trabajo vivo sin mergear, sobre `
    + `${rastro.resumen.vivas} ramas vivas de ${rastro.resumen.total} remotas.`);
  console.log('  ⚠️ Cuántos de ésos siguen ABIERTOS en el tablero NO se contesta aquí: este censo no');
  console.log('     lee Jira. Se cruza a mano, y así queda dicho de qué mitad responde cada uno.\n');
  } // fin del `else` de `ramasFiables`

  console.log('═══ PROPUESTA · tienen trabajo suyo en `main` ═══');
  console.log('    Contrástalo con el tablero: si alguno figura como NO hecho, ahí está el desfase.');
  console.log(`    ⚠️ Ordenado por su último commit y acotado a ${DIAS} días (\`--dias=N\`). La ventana`);
  console.log('       es de PRESENTACIÓN: no lee el tablero y no descarta a nadie del censo.\n');
  for (const f of recientes) {
    console.log(`  ${f.ticket}`.padEnd(15) + String(f.ultima).padEnd(12)
      + f.veredicto.padEnd(9) + f.fuentes.join(' · '));
  }
  console.log(`\n  → ${recientes.length} en la ventana, de ${enMain.length} con trabajo en \`main\`, `
    + `sobre ${p.ticketsCensados} censados.\n`);

  const noMedibles = censo.filas.filter((f) => f.veredicto === 'NO_MEDIBLE');
  console.log('═══ 🔴 NO SE PROPONEN, y por qué — los falsos positivos evitados ═══\n');
  for (const f of noMedibles) console.log(`  ${f.ticket}`.padEnd(15) + f.porque);
  const nada = censo.filas.filter((f) => f.veredicto === 'NADA');
  console.log(`\n  ── sin ninguna evidencia que los nombre: ${nada.length}\n`);

  console.log('⛔ Esto es una PROPUESTA. No se ha cerrado nada y no se ha tocado el tablero.');
}
