// scripts/equipo/version-declarada.mjs — SCRUM-1874 (D) · ¿a qué versión pertenece este registro?
//
//   node scripts/equipo/version-declarada.mjs            informe de la rama (sale 0 mientras sea INFORMATIVO)
//   node scripts/equipo/version-declarada.mjs --raiz R   lo mismo, sobre otro repositorio (lo usa el test)
//
// ── QUÉ HUECO CIERRA ─────────────────────────────────────────────────────────────────────────────
// Medido por S5 el 26-nov-2026 (propuesta «PR sin versión»): 373 PR en 15 días, mediana de
// apertura a merge 27 min, y sólo 16 tickets con etiqueta `version-*`. Con esa velocidad, la
// versión de una pieza no se puede reconstruir después: o se declara al escribir el registro, o se
// pierde. El orquestador decidió (SCRUM-1874): la declaración va en el REGISTRO, que lo ven este
// comando en local y el CI, no en el cuerpo del PR.
//
// ── LA REGLA ─────────────────────────────────────────────────────────────────────────────────────
// Todo `docs/master/SCRUM-*.md` que la rama CREA lleva una línea, al principio de línea:
//
//     Versión: 1.1 (SCRUM-1835)            ← la de `docs/equipo/version-en-curso`
//     Versión: mantenimiento (SCRUM-1859)  ← lo que no es de ninguna versión
//
// Una versión que no es la del fichero (ni «mantenimiento») cuenta como NO declarada: una pieza
// atribuida a una versión cerrada falsea el panel igual que una sin atribuir.
//
// ── «NUEVO» SE LE PREGUNTA AL CAMBIO, NO AL REGISTRO ───────────────────────────────────────────────
// Lección de SCRUM-1340: si la condición la cumple el propio registro (una fecha, una ruta), el que
// no da datos queda exento. Aquí «nuevo» = git lo da como AÑADIDO desde la base de la rama
// (`baseDeLaRama`, el motor de SCRUM-533/723, no un segundo `merge-base`) + los sin rastrear. En un
// PR el checkout es el commit de mezcla, y la cuenta sale igual (ver `tests/_base-de-la-rama.mjs`).
// Sin base resoluble NO sale «0 registros nuevos»: sale NO PUDE MIRAR, con salida 2 (la familia).
//
// ── 🔴 INFORMATIVO HASTA EL 4-DIC-2026 (decisión del orquestador, SCRUM-1874) ────────────────────
// Cuenta y avisa (en el CI, como `::warning` sobre el fichero), y sale 0 aunque falten líneas. Se
// pasa a obligatorio cuando se haya medido cuántos no declaran: el cambio es `OBLIGATORIO = true`,
// en su PR. Un «no pude mirar» sale 2 SIEMPRE: el job es `continue-on-error`, así que no bloquea,
// pero se ve distinto de un verde.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseDeLaRama } from '../../tests/_base-de-la-rama.mjs';

export const OBLIGATORIO = false;
export const INFORMATIVO_HASTA = '2026-12-04';
export const FICHERO_EN_CURSO = 'docs/equipo/version-en-curso';
export const MANTENIMIENTO = { nombre: 'mantenimiento', ticket: 'SCRUM-1859' };

/** Un registro de `docs/master/`, por su ruta con `/`. */
export const ES_REGISTRO = /^docs\/master\/SCRUM-[^/]+\.md$/;

/** `1.1 (SCRUM-1835)` → `{ nombre: '1.1', ticket: 'SCRUM-1835' }`; el ticket es opcional. `null` si no casa. */
export function parsearVersion(texto) {
  const m = /^(\S+)(?:\s+\((SCRUM-\d+)\))?$/.exec(String(texto ?? '').trim());
  return m ? { nombre: m[1], ticket: m[2] || null } : null;
}

/**
 * La versión en curso, de su fichero de UNA línea. Devuelve `{ version }` o `{ error }`: un fichero
 * que falta, vacío o con más de una línea no da una versión por defecto, porque cualquiera que se
 * inventara aquí daría por buenos registros que nadie ha comprobado.
 */
export function leerVersionEnCurso(raiz) {
  let texto;
  try { texto = fs.readFileSync(path.join(raiz, FICHERO_EN_CURSO), 'utf8'); } catch { return { error: `no existe ${FICHERO_EN_CURSO}` }; }
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lineas.length !== 1) return { error: `${FICHERO_EN_CURSO} debe tener UNA línea y tiene ${lineas.length}` };
  const v = parsearVersion(lineas[0]);
  if (!v || !v.ticket) return { error: `${FICHERO_EN_CURSO}: «${lineas[0].trim()}» no tiene la forma «1.1 (SCRUM-1835)»` };
  if (v.nombre === MANTENIMIENTO.nombre) return { error: `${FICHERO_EN_CURSO} no puede ser «mantenimiento»: nombra la versión que se está construyendo` };
  return { version: v, texto: lineas[0].trim() };
}

/** Las líneas `Versión:` del texto (también `**Versión:**`), en orden. Parte por líneas: CRLF no la esconde. */
export function lineasDeVersion(texto) {
  const out = [];
  for (const l of String(texto ?? '').split(/\r?\n/)) {
    const m = /^(?:\*\*)?Versión:(?:\*\*)?\s*(.*?)\s*$/.exec(l);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * El veredicto de UN registro contra la versión en curso.
 * `{ ok: true, como: 'en-curso' | 'mantenimiento' }` o `{ ok: false, motivo }`.
 */
export function juzgarRegistro(texto, enCurso) {
  const lineas = lineasDeVersion(texto);
  if (lineas.length === 0) return { ok: false, motivo: 'sin línea «Versión:»' };
  if (lineas.length > 1) return { ok: false, motivo: `${lineas.length} líneas «Versión:» (una pieza es de UNA versión)` };
  const v = parsearVersion(lineas[0]);
  if (!v) return { ok: false, motivo: `«Versión: ${lineas[0]}» no tiene la forma «1.1 (SCRUM-1835)» ni «mantenimiento (SCRUM-1859)»` };
  if (v.nombre === MANTENIMIENTO.nombre) {
    return !v.ticket || v.ticket === MANTENIMIENTO.ticket
      ? { ok: true, como: 'mantenimiento' }
      : { ok: false, motivo: `«mantenimiento» va con ${MANTENIMIENTO.ticket}, no con ${v.ticket}` };
  }
  if (v.nombre !== enCurso.nombre) return { ok: false, motivo: `nombra la ${v.nombre}; la en curso es la ${enCurso.nombre} (${FICHERO_EN_CURSO})` };
  if (v.ticket && v.ticket !== enCurso.ticket) return { ok: false, motivo: `la ${v.nombre} es ${enCurso.ticket}, no ${v.ticket}` };
  return { ok: true, como: 'en-curso' };
}

const git = (raiz, args) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * Los registros que la rama CREA: añadidos desde su base (commiteados o no) + sin rastrear.
 * `{ base, ficheros }`, o `{ base: null, motivo }` si no hay base contra la que preguntar.
 */
export function registrosNuevos(raiz) {
  const base = baseDeLaRama(raiz);
  if (!base) return { base: null, motivo: 'sin base de la rama (no resuelven origin/main, origin/HEAD ni main): no se sabe qué es nuevo' };
  let anadidos; let sinRastrear;
  try {
    anadidos = git(raiz, ['-c', 'core.quotepath=false', 'diff', '--name-only', '--no-renames', '--diff-filter=A', base.sha, '--', 'docs/master/']);
    sinRastrear = git(raiz, ['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard', '--', 'docs/master/']);
  } catch (e) {
    return { base: null, motivo: `git no contestó (${String(e.message).split('\n')[0]})` };
  }
  const ficheros = [...new Set(`${anadidos}\n${sinRastrear}`.split(/\r?\n/).map((s) => s.trim()).filter((s) => ES_REGISTRO.test(s)))].sort();
  return { base, ficheros };
}

/** El informe entero, como datos: lo usan la línea de órdenes y el test. */
export function medirRama(raiz) {
  const enCurso = leerVersionEnCurso(raiz);
  if (enCurso.error) return { ciego: enCurso.error };
  const nuevos = registrosNuevos(raiz);
  if (!nuevos.base) return { ciego: nuevos.motivo };
  const filas = nuevos.ficheros.map((f) => {
    let texto = null;
    try { texto = fs.readFileSync(path.join(raiz, f), 'utf8'); } catch { /* borrado en el disco tras añadirse */ }
    return { fichero: f, ...(texto === null ? { ok: false, motivo: 'no se pudo leer del disco' } : juzgarRegistro(texto, enCurso.version)) };
  });
  return { enCurso: enCurso.texto, base: nuevos.base, filas, sinDeclarar: filas.filter((f) => !f.ok) };
}

// ── La cáscara que habla. Lo que decide está arriba y es puro o casi. ─────────────────────────────
function main() {
  // `--raiz` sólo lo usa el test (un repo temporal); por defecto, el árbol de este fichero.
  const iRaiz = process.argv.indexOf('--raiz');
  const raiz = iRaiz > 0 ? path.resolve(process.argv[iRaiz + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const enCi = process.env.GITHUB_ACTIONS === 'true';
  const modo = OBLIGATORIO ? 'OBLIGATORIO' : `INFORMATIVO hasta el ${INFORMATIVO_HASTA}: cuenta y avisa, no bloquea`;
  console.log(`VERSIÓN DECLARADA (SCRUM-1874) · ${modo}`);
  const r = medirRama(raiz);
  if (r.ciego) {
    console.log(`🔴 NO PUDE MIRAR · ${r.ciego}. Esto NO es «todos declaran».`);
    if (enCi) console.log(`::warning::versión declarada: NO PUDE MIRAR · ${r.ciego}`);
    process.exit(2);
  }
  console.log(`  versión en curso ... ${r.enCurso}   (${FICHERO_EN_CURSO})`);
  console.log(`  base de la rama .... ${r.base.sha.slice(0, 12)} (merge-base con ${r.base.ref})`);
  console.log(`  registros NUEVOS ... ${r.filas.length} · declaran ${r.filas.length - r.sinDeclarar.length} · sin declarar ${r.sinDeclarar.length}`);
  for (const f of r.filas) console.log(`   ${f.ok ? '✔' : '⚠️'} ${f.fichero}   ${f.ok ? f.como : f.motivo}`);
  if (!r.filas.length) console.log('   (esta rama no crea ningún registro en docs/master/)');
  for (const f of r.sinDeclarar) {
    if (enCi) console.log(`::warning file=${f.fichero}::SCRUM-1874 · ${f.motivo}. Añade «Versión: ${r.enCurso}» o «Versión: mantenimiento (${MANTENIMIENTO.ticket})».`);
  }
  if (r.sinDeclarar.length) {
    console.log(`\n  Se arregla con una línea en el registro: «Versión: ${r.enCurso}» o «Versión: mantenimiento (${MANTENIMIENTO.ticket})».`);
    if (OBLIGATORIO) process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
