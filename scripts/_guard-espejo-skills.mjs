// scripts/_guard-espejo-skills.mjs — SCRUM-1089
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ESPEJO NO TENÍA GUARDIÁN, Y SÍ TENÍA UN LECTOR
//
// `.claude/skills/` es lo que carga esta sesión (comprobado ejercitando la skill, no leyendo
// sobre ella: SCRUM-1089). `.agents/skills/` es el espejo para Codex — y Javier confirmó
// (SCRUM-1089, comentario 16600) que `D:\MILLONARIO\cobroFlash\...` es la máquina de Luis: el
// espejo SÍ tiene un lector real, hoy.
//
// El defecto medido: dos pares (`yaqu-verifactu-sif`, `yaqu-release-check`) se copiaron a mano
// el 29-jun-2026 y nunca se volvieron a sincronizar. `.claude/` recibió 3 correcciones más
// (SCRUM-538, 20-ago-2026) que el espejo nunca vio — Luis llevaba desde el 29-jun leyendo como
// construido un envío a la AEAT, una FSM `VfSubmission` y una cola que pausa, ninguno de los
// tres real. Sin este guard, la próxima corrección a `.claude/` se vuelve a quedar sin espejar
// y nadie lo nota hasta que alguien vuelva a diffar las dos carpetas a mano.
//
// ⛔ SOLO LECTURA: compara, no copia ni corrige. Sincronizar el contenido es del ticket que
// gobierna la skill (S0, firma del fundador si es materia fiscal); esto solo impide que la
// próxima divergencia se congele en silencio.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ SE EXCLUYE `impeccable`
//
// Ya está gobernada por hash propio en `skills-lock.json` (mecanismo previo, independiente).
// Meterla aquí sería un segundo árbitro sobre la misma pareja de ficheros — y si algún día
// discrepan, ¿cuál manda? Se deja fuera por construcción, no por comodidad.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POBLACIÓN Y SUELO
//
// La población es "toda skill con `SKILL.md` presente en LAS DOS carpetas, sin las excluidas" —
// se deriva del árbol, no de una lista escrita a mano que envejecería el día que alguien añada
// un tercer par. Si cualquiera de las dos carpetas no existe, o la población sale vacía
// (hoy se conocen 4 pares: cero sería señal de que algo se leyó mal, no de que el espejo se
// vació), el censo se declara CIEGO — «no pude mirar» y «está todo igual» no pueden salir por
// la misma línea (A3, A21).
// ═════════════════════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Gobernada por su propio hash en `skills-lock.json`: un segundo árbitro aquí sobraría. */
export const EXCLUIDAS = Object.freeze(['impeccable']);

function rutaSkillMd(dirSkills, nombre) {
  return path.join(dirSkills, nombre, 'SKILL.md');
}

function sha256DeFichero(rutaAbs) {
  return crypto.createHash('sha256').update(fs.readFileSync(rutaAbs)).digest('hex');
}

/**
 * Skills con `SKILL.md` en AMBAS carpetas, sin las excluidas. `null` si alguna carpeta no
 * existe — lo distingue del array vacío para que el llamador pueda declarar CIEGO sin
 * confundirlo con "no hay nada que comparar".
 */
export function poblacionEspejada(dirClaude, dirAgents) {
  if (!fs.existsSync(dirClaude) || !fs.existsSync(dirAgents)) return null;
  const tieneSkillMd = (dir, nombre) => fs.existsSync(rutaSkillMd(dir, nombre));
  const enClaude = fs.readdirSync(dirClaude).filter((n) => tieneSkillMd(dirClaude, n));
  const enAgents = new Set(fs.readdirSync(dirAgents).filter((n) => tieneSkillMd(dirAgents, n)));
  return enClaude.filter((n) => enAgents.has(n) && !EXCLUIDAS.includes(n)).sort();
}

/** El censo: por cada skill de la población, si `.claude/` y `.agents/` coinciden byte a byte. */
export function censar(dirClaude, dirAgents) {
  const poblacion = poblacionEspejada(dirClaude, dirAgents);
  if (poblacion === null) {
    const faltante = !fs.existsSync(dirClaude) ? dirClaude : dirAgents;
    return { ciego: `🔴 CIEGO: no existe «${faltante}». "No pude mirar" no es "está igual".`, poblacion: [], filas: [] };
  }
  if (poblacion.length === 0) {
    return {
      ciego: '🔴 CIEGO: ninguna skill en común entre .claude/skills y .agents/skills (fuera de '
        + `las excluidas: ${EXCLUIDAS.join(', ')}). Hoy se conocen 4 pares espejados (SCRUM-1089); `
        + 'población 0 es señal de que algo se leyó mal, no de que el espejo se vació.',
      poblacion: [],
      filas: [],
    };
  }
  const filas = poblacion.map((skill) => {
    const hashClaude = sha256DeFichero(rutaSkillMd(dirClaude, skill));
    const hashAgents = sha256DeFichero(rutaSkillMd(dirAgents, skill));
    return { skill, igual: hashClaude === hashAgents, hashClaude, hashAgents };
  });
  return { ciego: null, poblacion, filas };
}

/** El veredicto: ok solo si no está ciego y las dos copias de CADA skill son idénticas. */
export function verificar(censo) {
  if (censo.ciego) return { ok: false, mensaje: censo.ciego };
  const divergen = censo.filas.filter((f) => !f.igual);
  if (!divergen.length) {
    return {
      ok: true,
      mensaje: `✅ espejo sincronizado: ${censo.filas.length} skill(s) idénticas byte a byte `
        + `(${censo.poblacion.join(', ')}).`,
    };
  }
  const detalle = divergen
    .map((f) => `   · ${f.skill}: sha256 distinto (${f.hashClaude.slice(0, 8)}… vs ${f.hashAgents.slice(0, 8)}…)`)
    .join('\n');
  return {
    ok: false,
    mensaje: `🔴 EL ESPEJO DE SKILLS DIVERGE (.claude/skills/ vs .agents/skills/):\n${detalle}\n\n`
      + '   `.claude/skills/` es la fuente que carga esta sesión; `.agents/skills/` es el espejo que\n'
      + '   lee Codex en otra máquina (Luis; SCRUM-1089, comentario 16600). Si diverge, Luis lee una\n'
      + '   versión vieja de una skill fiscal sin saberlo. Sincroniza copiando byte a byte:\n'
      + '   `.claude/skills/<skill>/SKILL.md` → `.agents/skills/<skill>/SKILL.md`.',
  };
}
