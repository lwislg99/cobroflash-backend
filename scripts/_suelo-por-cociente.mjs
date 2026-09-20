// scripts/_suelo-por-cociente.mjs — SCRUM-949
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║ El suelo no es un número: es el ACUERDO entre dos sondas independientes de la población.   ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
//
// ── EL DEFECTO QUE CIERRA (SCRUM-940) ─────────────────────────────────────────────────────
// Un suelo escrito a mano (`SUELO_FICHEROS = 40`) nace con la población de su día y ENVEJECE SOLO:
// la población crece y el número se queda quieto. El 17-sep-2026 `public-js-parsea` decía 40 con
// 96 ficheros reales — su recorrido podía perder 56 sin que nada lo dijera.
//
// ── LA FORMA ──────────────────────────────────────────────────────────────────────────────
// Dos sondas de la MISMA población, por mecanismos distintos:
//   · VISTOS   — lo que el instrumento recorre de verdad (su propio colector, no una copia);
//   · CENSADOS — lo que otra fuente independiente dice que existe.
//
//     cociente = |vistos ∩ censados| / |vistos ∪ censados|
//
// El umbral se deriva de la población en cada ejecución, así que CRECER lo mueve solo. Y como el
// denominador es la UNIÓN, ninguna de las dos sondas puede quedarse ciega en silencio: si el
// colector deja de ver, sobran censados; si el censo deja de ver, sobran vistos. En los dos casos
// el cociente baja y el mensaje NOMBRA lo que falta de cada lado.
//
// 🔴 POR QUÉ ESTO NO ES EL ESPEJO QUE DESCARTÓ SCRUM-810 («derivar el suelo de la población de hoy
// es circular: un suelo que se recalcula solo no es un suelo, es un espejo»): aquello es circular
// cuando la población la mide LA MISMA sonda que se vigila. Aquí la mide otra, y la prueba de que
// no es un espejo es el rojo: dejar ciego al colector hace saltar el suelo (tests/scrum949-…).
//
// ── EL COCIENTE MÍNIMO NO SE ELIGE, Y TAMPOCO SE SACA DEL HISTORIAL ──────────────────────────
// Para una población de FICHEROS la segunda sonda es git, y se le pregunta por lo que hay EN EL
// DISCO: indexados + sin indexar (también ignorados) − borrados sin indexar. Así absorbe por
// construcción todo cambio HONESTO —alta sin `git add`, borrado sin `git rm`, renombre, `git rm`,
// `git rm --cached`— porque lo ve igual que el colector. Lo único que separa las dos sondas es que
// una de las dos esté ciega, y por eso el mínimo es 1.
//
// Un cociente fijo por debajo de 1 se midió y se descartó: está en docs/master/SCRUM-949.md, con
// la serie de 688 commits que lo decide (docs/master/evidencias/scrum949/).
//
// ⚠️ LÍMITE, dicho aquí y no descubierto en un rojo raro: el censo de git sólo existe para
// poblaciones de ficheros. Una población que no es un conjunto de rutas (declaraciones, rutas del
// router, tests de un TAP) necesita su propia segunda sonda, y su propia derivación del mínimo.
import { execFileSync } from 'node:child_process';

// A22: el separador de `-z` se construye; escrito en el fuente aterrizaría como un NUL literal.
const NUL = String.fromCharCode(0);

/**
 * La segunda sonda para una población de ficheros: lo que git sabe que hay EN EL DISCO bajo
 * `carpeta` (ruta relativa a `raiz`), filtrado por `esDeLaPoblacion(rutaPosix)`.
 *
 * Devuelve un `Set` de rutas posix relativas a `raiz`, o `null` si git no contesta. `null` NO es
 * una población vacía: es no haber podido preguntar, y quien llama tiene que tratarlo como CIEGO.
 */
export function censoDeGit(raiz, carpeta, esDeLaPoblacion) {
  const lista = (modo) => execFileSync('git', ['ls-files', '-z', ...modo, '--', carpeta],
    { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] })
    .split(NUL).filter(Boolean);
  let enDisco; let borrados;
  try {
    // `--others` SIN `--exclude-standard`: también los ignorados, porque el colector los recorre.
    enDisco = lista(['--cached', '--others']);
    borrados = new Set(lista(['--deleted']));
  } catch { return null; }
  return new Set(enDisco.filter((p) => !borrados.has(p) && esDeLaPoblacion(p)));
}

/** Las dos sondas, cruzadas por CONJUNTO (A3: comparar cuentas deja pasar «pierdo una, gano otra»). */
export function medirCociente(vistos, censados) {
  const a = new Set(vistos);
  const b = new Set(censados);
  const universo = new Set([...a, ...b]);
  const acuerdo = [...universo].filter((p) => a.has(p) && b.has(p)).length;
  return {
    universo: universo.size,
    vistos: a.size,
    censados: b.size,
    acuerdo,
    // 🔴 Cero sobre cero es CERO, no uno: dos sondas vacías no están de acuerdo, no han mirado.
    cociente: universo.size ? acuerdo / universo.size : 0,
    noVistos: [...b].filter((p) => !a.has(p)).sort(),
    noCensados: [...a].filter((p) => !b.has(p)).sort(),
  };
}

/** El menor acuerdo que cumple el mínimo, con la MISMA comparación que el aserto (sin redondeos). */
export function umbralDe(universo, minimo) {
  for (let u = 0; u <= universo; u++) if (universo && u / universo >= minimo) return u;
  return universo + 1; // inalcanzable: con población cero no hay acuerdo que valga
}

const TOPE_DE_NOMBRES = 40;
const nombrar = (xs) => xs.slice(0, TOPE_DE_NOMBRES).map((p) => `        ${p}`).join('\n')
  + (xs.length > TOPE_DE_NOMBRES ? `\n        … y ${xs.length - TOPE_DE_NOMBRES} más` : '');

/**
 * El resumen POR CARPETA va antes de la lista, y lo pidió el primer rojo: con 95 perdidos, la lista
 * cortada en 40 enseñaba sólo `dashboard/js` y escondía que también faltaba `public/js/` entera.
 * Una ceguera suele ser estructural —una carpeta que el recorrido dejó de mirar—, y eso se lee aquí.
 */
function porCarpeta(xs) {
  const n = new Map();
  for (const p of xs) {
    const d = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : './';
    n.set(d, (n.get(d) || 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([d, k]) => `${d} ${k}`).join(' · ');
}

/** Una línea con la población DECLARADA (A3: un instrumento dice sobre cuántos ha mirado). */
export function poblacionDeclarada(nombre, m, minimo) {
  return `suelo por cociente · «${nombre}» · población ${m.universo} `
    + `(recorrido ${m.vistos} · censo ${m.censados}) · de acuerdo ${m.acuerdo} · `
    + `cociente ${m.cociente.toFixed(4)} · mínimo ${minimo} → umbral ${umbralDe(m.universo, minimo)}`;
}

/** El mensaje del suelo. Siempre se puede pedir; sólo se lee cuando el aserto cae. */
export function explicarCociente(nombre, m, minimo) {
  if (!m.universo) {
    return `🔴 CIEGO · «${nombre}»: CERO en las dos sondas. No hay población que mirar, y eso no es `
      + 'acuerdo: es no haber mirado nada. Comprueba la carpeta y el checkout.';
  }
  const partes = [`🔴 CIEGO · ${poblacionDeclarada(nombre, m, minimo)}`];
  if (m.noVistos.length) {
    partes.push(`    · el RECORRIDO no ve ${m.noVistos.length} que el censo sí tiene — por carpeta: `
      + `${porCarpeta(m.noVistos)}\n${nombrar(m.noVistos)}`);
  }
  if (m.noCensados.length) {
    partes.push(`    · el CENSO no tiene ${m.noCensados.length} que el recorrido sí ve — por carpeta: `
      + `${porCarpeta(m.noCensados)}\n${nombrar(m.noCensados)}`);
  }
  partes.push('    Lo honesto —un fichero nuevo sin `git add`, un borrado, un renombre, `git rm`— lo ven\n'
    + '    igual las dos sondas y no llega aquí. Si llega, una de las dos está CIEGA: arregla el\n'
    + '    recorrido (o el censo) ANTES de creerte nada de lo que diga el guard.');
  return partes.join('\n');
}
