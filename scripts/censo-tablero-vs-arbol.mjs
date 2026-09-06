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
  const noSeFia = p.ticketsCensados === 0 || suelo.length > 0;

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ...censo, suelo, fiable: !noSeFia }, null, 2));
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
    console.error(`   árbol: ${RAIZ}`);
    process.exit(2);
  }

  const DIAS = Number((process.argv.find((a) => a.startsWith('--dias=')) || '--dias=7').split('=')[1]);
  const corte = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);
  const enMain = censo.filas.filter((f) => f.veredicto === 'ENTERO' || f.veredicto === 'PARCIAL');
  const recientes = enMain.filter((f) => f.ultima && f.ultima >= corte)
    .sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));

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
