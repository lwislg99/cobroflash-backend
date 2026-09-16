// scripts/verificacion-s5/ramas-sin-mergear.mjs — SCRUM-637 · punto 2 del ticket
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LAS RAMAS REMOTAS QUE **NO** ESTÁN EN `origin/main`, CON SU EDAD Y SU URL DE COMPARE.
//
// Sólo LEE. No borra, no empuja, no toca ninguna rama. El que borra es `ramas-borrables.mjs`.
//
// ── QUÉ HUECO CIERRA, MEDIDO ─────────────────────────────────────────────────────────────────
// `ramas-borrables.mjs` —el otro script de este mismo ticket— contesta la pregunta contraria:
// lista POR NOMBRE las mergeadas, y de las que NO lo están imprime **sólo un recuento**
// (`sin mergear: 86`) sin un nombre ni una fecha. Corrido el 8-sep-2026 sobre `origin/main` =
// 2f123b70: **cero fechas en toda su salida y cero apariciones** de
// `scrum-614-censo-rutas-sin-rol`, que ese mismo día era una rama sin mergear con trabajo vivo.
//
// O sea: lo que se puede tirar se ve con detalle, y lo que está esperando a alguien no se ve. El
// ticket lo dice desde el otro lado: «trece ramas de agosto con trabajo terminado que nadie sabe
// que están ahí».
//
// ── POR QUÉ ES UN FICHERO NUEVO Y NO UNA SECCIÓN MÁS DE `ramas-borrables.mjs` ─────────────────
// 1. Aquél tiene `--ejecutar`, y **borra ramas de verdad**. Quien sólo quiere mirar qué hay
//    pendiente no debería tener que ejecutar la herramienta que las destruye.
// 2. Su suelo y sus controles están calibrados para otra pregunta («¿qué se puede tirar?»), y
//    mezclar dos suelos en un script es cómo un cero de una mitad pasa por bueno en la otra.
// 3. Y por construcción: así **las mergeadas se siguen listando exactamente igual que antes**.
//    Un fichero que no se toca no puede regresionar.
//
// ── 🔴 LA CLASIFICACIÓN NO SE VUELVE A ESCRIBIR: ES LA DE SCRUM-804 ──────────────────────────
// `instantanea()` + `alcanzabilidadDe()` de `scripts/_censo-alcanzabilidad.mjs`, tal cual. Ese
// módulo ya resolvió tres cosas que reescribirlas aquí volvería a romper:
//   · congela el sha de `origin/main` y mide todo contra ESE objeto (el desajuste 454/453);
//   · pregunta a granel (0,30 s frente a 52,6 s rama a rama, medido allí);
//   · y tiene TRES respuestas, no dos: dentro, fuera y **no se sabe** — una ref rota no aparece
//     ni en `--merged` ni en `--no-merged`, y ese tercer valor está provocado, no deducido.
//
// ⚠️ ESTO NO DUPLICA EL CENSO DE SCRUM-804, y la diferencia es la unidad: aquél da un veredicto
// **por TICKET** (¿el trabajo de SCRUM-n está en main?) cruzando ramas, entradas de `docs/master`
// y números. Esto es una lista **por RAMA**, sin mirar tickets ni documentos: una rama sin número
// —hay 18 hoy— no tiene veredicto en 804 y sí sale aquí. Se comparte el clasificador, no la
// pregunta.
//
// ── LA EDAD, QUE ES EL DATO QUE FALTABA ──────────────────────────────────────────────────────
// La instantánea de 804 no trae fechas, así que se leen aquí en UNA llamada. No se toca
// `_censo-alcanzabilidad.mjs`: es de otro ticket, lo usan otros censos y sus tests fijan su forma.
//
// 🔴 Y SE CRUZAN CON LA INSTANTÁNEA, QUE MANDA. Son dos lecturas de un espacio de refs compartido
// por ~24 worktrees, así que pueden discrepar. La regla es explícita: la población es la de la
// instantánea; una rama sin fecha se marca `(sin fecha)` y una fecha sin rama se descarta. Así una
// carrera entre las dos lecturas produce un hueco VISIBLE, nunca una fila inventada.
//
// USO:
//   node scripts/verificacion-s5/ramas-sin-mergear.mjs           todas, la más vieja primero
//   node scripts/verificacion-s5/ramas-sin-mergear.mjs --dias 7  sólo las de 7 días o más
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { instantanea, alcanzabilidadDe, PREFIJO_ORIGIN } from '../_censo-alcanzabilidad.mjs';

/** Ramas que nunca son «trabajo pendiente»: son el tronco o un puntero a él. */
export const INTOCABLES = new Set(['main', 'master', 'HEAD']);

/**
 * La edad en días enteros. `ahora` entra por parámetro para que el test no dependa del reloj.
 *
 * Devuelve `null` —y no 0— cuando la fecha no se puede leer: un cero diría «de hoy», que es
 * exactamente lo contrario de «no lo sé», y esa confusión ordenaría la lista al revés.
 */
export function edadEnDias(fechaIso, ahora) {
  const t = Date.parse(String(fechaIso || ''));
  if (!Number.isFinite(t)) return null;
  return Math.floor((ahora.getTime() - t) / 86400000);
}

/**
 * La URL de compare de una rama, DERIVADA del remoto real.
 *
 * 🔴 No se escribe el nombre del repositorio a mano, y ése es literalmente el defecto que abrió
 * este ticket: el asesor construyó dos días URLs a partir del número del ticket en vez de leer la
 * identidad real, y GitHub contestaba «There isn't anything to compare».
 *
 * Acepta las dos formas en que git guarda un remoto de GitHub (HTTPS y SSH). Lo que no reconozca
 * devuelve `null` y quien lo pinte enseña el nombre a secas: media línea de menos es mejor que una
 * URL inventada que no abre.
 */
export function urlDeCompare(remoto, rama) {
  const s = String(remoto || '').trim().replace(/\.git$/, '');
  const m = s.match(/^https?:\/\/github\.com\/(.+)$/) || s.match(/^git@github\.com:(.+)$/);
  if (!m || !rama) return null;
  return `https://github.com/${m[1]}/compare/main...${encodeURIComponent(rama)}?expand=1`;
}

/**
 * Ordena por edad DESCENDENTE: lo más viejo primero, que es lo que nadie mira.
 *
 * Las de edad desconocida van al FINAL y no se mezclan con las nuevas: no saber la fecha no es
 * ser reciente. Empate a días → por nombre, para que dos corridas seguidas den la misma lista.
 */
export function ordenarPorEdad(filas) {
  return filas.slice().sort((a, b) => {
    if (a.dias === null && b.dias === null) return a.rama.localeCompare(b.rama);
    if (a.dias === null) return 1;
    if (b.dias === null) return -1;
    if (b.dias !== a.dias) return b.dias - a.dias;
    return a.rama.localeCompare(b.rama);
  });
}

/**
 * EL SUELO, como función pura para que el test lo pueda ejercitar sin git.
 *
 * 🔴 Una lista vacía NO es «no hay nada pendiente»: con ~550 ramas vivas y 86 fuera de main
 * medidas el 8-sep-2026, un cero aquí significa que el instrumento dejó de ver. Y el modo de fallo
 * que lo produce es conocido y silencioso: un clon superficial de una sola rama devuelve una lista
 * corta sin que git dé error (SCRUM-388).
 *
 * Devuelve `{ ciego, motivo }`. Se declara ciego también si la instantánea no supo resolver la
 * referencia, porque entonces no hay contra qué medir — y eso NO es «no hay trabajo fuera».
 */
export function suelo({ incapaz = null, totalRefs = 0, sinMergear = 0 } = {}) {
  if (incapaz) return { ciego: true, motivo: incapaz };
  if (totalRefs === 0) {
    return { ciego: true, motivo: 'no se ha leído NINGUNA ref de `origin/*`. Un clon superficial '
      + 'devuelve una lista corta sin fallar (SCRUM-388): esto no es «no hay ramas».' };
  }
  if (sinMergear === 0) {
    return { ciego: true, motivo: 'CERO ramas fuera de `main` sobre ' + totalRefs + ' refs leídas. '
      + 'El 8-sep-2026 había 86. Un cero aquí es el instrumento, no el árbol.' };
  }
  return { ciego: false, motivo: null };
}

// ── De aquí abajo, la cáscara que lee y habla. Todo lo que decide está arriba y es puro. ──────

function main() {
  const argv = process.argv.slice(2);
  const iDias = argv.indexOf('--dias');
  const minDias = iDias >= 0 ? Number(argv[iDias + 1]) : 0;

  const inst = instantanea({ raiz: process.cwd() });

  // Las fechas, en UNA llamada. Se indexan por refname COMPLETO, que es la clave con la que la
  // instantánea identifica cada rama — el nombre corto se presta a la confusión de `origin/HEAD`,
  // que git abrevia a `origin` y que ya costó un ref de más en el censo de 804.
  const fechas = new Map();
  try {
    const salida = execFileSync('git',
      ['for-each-ref', '--format=%(refname)%09%(committerdate:iso8601-strict)', PREFIJO_ORIGIN],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const linea of salida.split(/\r?\n/)) {
      const [refname, fecha] = linea.split('\t');
      if (refname && fecha) fechas.set(refname.trim(), fecha.trim());
    }
  } catch { /* sin fechas: cada fila lo dirá por su cuenta, y el suelo sigue mandando */ }

  const alcanzable = inst.incapaz ? () => null : alcanzabilidadDe(inst);
  const ahora = new Date();

  const fuera = inst.ramas.filter((r) => !INTOCABLES.has(r.nombre) && alcanzable(r.nombre) === false);

  const piso = suelo({ incapaz: inst.incapaz, totalRefs: inst.ramas.length, sinMergear: fuera.length });
  if (piso.ciego) {
    console.log('🔴 CIEGO: ' + piso.motivo);
    process.exit(2);
  }

  let remoto = '';
  try { remoto = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim(); } catch { remoto = ''; }

  const filas = ordenarPorEdad(fuera.map((r) => {
    const fecha = fechas.get(r.refname) || null;
    return { rama: r.nombre, objeto: r.objeto, fecha, dias: edadEnDias(fecha, ahora), url: urlDeCompare(remoto, r.nombre) };
  }));

  // ── CONTROLES, antes de enseñar nada ────────────────────────────────────────────────────────
  const conMain = filas.filter((f) => INTOCABLES.has(f.rama));
  const coladas = filas.filter((f) => alcanzable(f.rama) === true);
  console.log(`origin/main = ${inst.sha.slice(0, 8)} · ${inst.ramas.length} refs leídas · ${filas.length} FUERA de main`);
  console.log(`CONTROL · ninguna mergeada en la lista: ${coladas.length === 0 ? '✅' : '🔴 ' + coladas.map((f) => f.rama).join(', ')}`);
  console.log(`CONTROL · main fuera de la lista: ${conMain.length === 0 ? '✅' : '🔴'}`);
  if (coladas.length || conMain.length) process.exit(2);

  const mostradas = filas.filter((f) => (f.dias === null ? true : f.dias >= minDias));
  const sinFecha = filas.filter((f) => f.dias === null).length;
  console.log(`\nSIN MERGEAR: ${filas.length}` + (minDias > 0 ? ` · mostradas con ${minDias}+ días: ${mostradas.length}` : '')
    + (sinFecha ? ` · sin fecha legible: ${sinFecha}` : '') + '\n');

  for (const f of mostradas) {
    const edad = f.dias === null ? '  (sin fecha)' : String(f.dias).padStart(4) + ' d';
    console.log(`${edad}  ${(f.fecha || '').slice(0, 10).padEnd(10)}  ${f.rama}`);
    if (f.url) console.log(`             ${f.url}`);
  }

  console.log('\n══ Sólo lectura: aquí no se ha borrado ni empujado nada. ═════════════════════════');
  console.log('La URL de cada rama es su COMPARE, copiable tal cual — se deriva del remoto, no se');
  console.log('construye con el número del ticket (que es el defecto que abrió SCRUM-637).');
}

// Sólo corre si lo invocan directamente: importarlo desde el test no debe disparar nada.
if (process.argv[1] && process.argv[1].endsWith('ramas-sin-mergear.mjs')) main();
