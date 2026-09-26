// scripts/equipo/ancla.mjs — SCRUM-1152 · el ancla de medición (SCRUM-267), sin teclearla a mano
//
//   node scripts/equipo/ancla.mjs
//
// Imprime, lista para pegar en el encabezado de `docs/master/SCRUM-N.md`, la línea EXACTA que
// exige `tests/scrum267-ancla-de-medicion.test.mjs` (`RE_ANCLA`):
//
//   **Medido contra:** `origin/main` = `<sha40>` · <instante ISO-8601>
//
// ── POR QUÉ EXISTE (26-sep-2026) ─────────────────────────────────────────────────────────────
// El ancla lleva CINCO tumbados en dos días (#1793, #1795, S2, y dos veces esta sesión el mismo
// turno), y las cinco veces por el MISMO motivo: un dato que se teclea a mano y del que es fácil
// olvidar la mitad (el sha sin el instante, o al revés). Un número que se DERIVA no caduca por
// olvido — es la misma lección que ya escribió el equipo de Javier sobre sus propios contadores.
//
// ── DE DÓNDE SALE CADA CAMPO, Y POR QUÉ ──────────────────────────────────────────────────────
//   · El sha: `git rev-parse origin/main`, LOCAL. Si no has hecho `git fetch origin` antes (A1),
//     es el `origin/main` que tu árbol conoce, no el de GitHub — este script no fetchea por ti:
//     fetchear es una acción de red que decide quien lo llama, no un generador de texto.
//   · El instante: la cabecera `Date:` de `gh api -i zen` (A14). NUNCA el reloj de la máquina —
//     medido una vez 5 min 33 s adelantado (15-sep-2026), y aquí importa más que en ningún sitio:
//     es exactamente el dato cuya ausencia originó el ticket.
//
// ── FALLA CERRADO ─────────────────────────────────────────────────────────────────────────────
// Si no se puede leer el sha, o si ningún `gh` responde, NO se imprime un ancla a medias ni se
// rellena con el reloj local: se dice NO PUDE MIRAR y sale con 2. Un ancla generada a medias es
// peor que una escrita a mano y a medias, porque parece de fiar.
//
// Salida: 0 = ancla impresa en stdout · 2 = NO PUDE MIRAR (el motivo va a stderr).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Los binarios de `gh` que se prueban en orden: el del PATH primero, luego la ruta fija de esta
 * máquina (SCRUM-360: `gh` no está en el PATH de las sesiones de Windows). */
export const RUTAS_GH = ['gh', 'C:\\Program Files\\GitHub CLI\\gh.exe'];

function gitReal(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', error: r.error };
}

function ghReal(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', error: r.error };
}

/** El sha de 40 hex de `origin/main`, o `null` si no se pudo leer uno válido. */
export function shaDeOriginMain(git = gitReal) {
  const r = git(['rev-parse', 'origin/main']);
  if (r.error || r.status !== 0) return null;
  const sha = r.stdout.trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/**
 * El instante de GitHub, ISO-8601 con `Z`. Prueba cada binario de `RUTAS_GH` en orden: un binario
 * que no existe (ENOENT) prueba el siguiente; uno que existe pero responde mal NO prueba otro —
 * eso ya no es «no está en el PATH», es un fallo de verdad, y no se enmascara reintentando.
 */
export function instanteDeGithub(gh = ghReal, rutas = RUTAS_GH) {
  for (const bin of rutas) {
    const r = gh(bin, ['api', '-i', 'zen']);
    if (r.error) continue; // este binario no existe: se prueba el siguiente
    if (r.status !== 0) return null;
    const m = /^date:\s*(.+)\r?$/im.exec(r.stdout);
    if (!m) return null;
    const d = new Date(m[1].trim());
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return null;
}

/** `{ok:true, linea}` o `{ok:false, motivo}`. Nunca rellena un campo que no pudo leer. */
export function generarAncla({ git = gitReal, gh = ghReal, rutasGh = RUTAS_GH } = {}) {
  const sha = shaDeOriginMain(git);
  if (!sha) return { ok: false, motivo: 'no se pudo leer un sha de 40 hex de `git rev-parse origin/main`' };
  const instante = instanteDeGithub(gh, rutasGh);
  if (!instante) return { ok: false, motivo: 'no se pudo leer la hora de GitHub (`gh api -i zen`): ningún `gh` respondió bien' };
  return { ok: true, linea: `**Medido contra:** \`origin/main\` = \`${sha}\` · ${instante}` };
}

function esElScriptEjecutado() {
  if (!process.argv[1]) return false;
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (esElScriptEjecutado()) {
  const r = generarAncla();
  if (!r.ok) {
    process.stderr.write(`NO PUDE MIRAR: ${r.motivo}\n`);
    process.exit(2);
  } else {
    process.stdout.write(`${r.linea}\n`);
    process.exit(0);
  }
}
