// scripts/equipo/huerfanos.mjs — SCRUM-946 · el censo de trabajo huérfano en los worktrees
//
//   node scripts/equipo/huerfanos.mjs [--horas <N>] [--json] [--repo <ruta>]
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────────────────────
// El 17-sep-2026, hacia las 20:27Z, las siete sesiones del equipo se quedaron sin uso a la vez
// (límite de la CUENTA, sin aviso previo) y tres dejaron trabajo que nadie sabía que existía: un
// commit de SCRUM-932 sin empujar, once ficheros de 931 sin commitear y el borrador del prototipo
// de Gastos. No se perdió nada, pero solo porque a la mañana siguiente tres sesiones nuevas
// midieron antes de creerse su encargo. El prototipo de este censo encontró además tres commits
// de `wt-scrum-895` del 17-sep que no estaban en ningún remoto y que nadie buscaba.
//
// ── LO QUE HACE, Y SU ÚNICA AMBICIÓN ──────────────────────────────────────────────────────────
// NO evita perder trabajo: lo hace VISIBLE. Recorre `git worktree list` y clasifica cada árbol:
//
//   SIN-EMPUJAR    commits alcanzables desde HEAD que no están en NINGUNA rama remota.
//                  Se listan SIEMPRE, sea cual sea su edad: es lo que se pierde si el disco se va,
//                  y hoy son pocos.
//   SUCIO          cambios sin commitear (modificados o sin seguir) cuyo fichero más reciente se
//                  tocó dentro de la ventana (`--horas`, 72 por defecto). Los más viejos se CUENTAN
//                  en una línea y no se listan: un censo que grita 40 veces al día no lo lee nadie,
//                  y entonces da igual que tenga razón.
//   NO-PUDE-MIRAR  la ruta no existe, git falló o una salida no se entendió. NUNCA cuenta como
//                  limpio: «no supe mirar» y «no hay nada» son el mismo silencio en pantalla y lo
//                  contrario en significado.
//
// Declara la POBLACIÓN en cada pasada (cuántos worktrees miró). Un censo que dice «nada» sin decir
// sobre cuántos no ha dicho nada.
//
// ── LO QUE NO HACE, Y ES LA MITAD DEL DISEÑO ──────────────────────────────────────────────────
// No borra, no empuja, no commitea, no cambia de rama, no hace `fetch`. Solo mira y cuenta: un
// censo que arregla cosas deja de ser un censo. Por eso solo usa órdenes de git de LECTURA.
// Tampoco imprime contenido de ningún fichero: solo nombres de worktree, ramas, cuentas y fechas.
//
// ⚠️ Mide contra las ramas remotas QUE ESTE CLON CONOCE (`--remotes`): no hace `fetch`, así que un
// commit empujado desde otra máquina y aún no traído saldría como SIN-EMPUJAR. Es el lado seguro.
// ⚠️ Mira el HEAD de cada worktree, no las ramas locales sin worktree.
//
// Salida: 0 = nada que salvar · 1 = hay algo listado · 2 = algún worktree NO SE PUDO MIRAR (gana).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HORAS_POR_DEFECTO = 72;
export const SIN_EMPUJAR = 'SIN-EMPUJAR';
export const SUCIO = 'SUCIO';
export const SUCIO_ANTIGUO = 'SUCIO-ANTIGUO';
export const LIMPIO = 'LIMPIO';
export const NO_PUDE_MIRAR = 'NO-PUDE-MIRAR';

function gitReal(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { status: r.error ? null : r.status, stdout: r.stdout || '' };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Decisiones puras
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Las rutas de `git worktree list --porcelain`. Devuelve null si la salida no se entiende. */
export function rutasDeWorktrees(porcelana) {
  if (typeof porcelana !== 'string') return null;
  const rutas = porcelana.split(/\r?\n/).filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9).trim());
  return rutas.length ? rutas : null;
}

/**
 * Las entradas de `git status --porcelain -z`: [{codigo, ruta}]. Con `-z` las rutas no llevan
 * comillas ni escapes, y un renombrado trae la ruta de origen como entrada aparte (se salta).
 */
export function entradasDeStatus(salidaZ) {
  const trozos = String(salidaZ).split('\0');
  const out = [];
  for (let i = 0; i < trozos.length; i++) {
    const t = trozos[i];
    if (t.length < 4) continue;
    const codigo = t.slice(0, 2);
    out.push({ codigo, ruta: t.slice(3) });
    if (codigo[0] === 'R' || codigo[0] === 'C') i++; // la ruta de origen del renombrado
  }
  return out;
}

/**
 * Clasifica UN worktree. Pura: todo lo que necesita llega por argumento.
 *
 * @param {{sinEmpujar:number|null, modificados:number, sinSeguir:number,
 *          ultimoToqueMs:number|null, ahoraMs:number, ventanaMs:number}} m
 */
export function clasificar({ sinEmpujar, modificados, sinSeguir, ultimoToqueMs, ahoraMs, ventanaMs }) {
  if (!Number.isInteger(sinEmpujar) || sinEmpujar < 0) return NO_PUDE_MIRAR;
  if (sinEmpujar > 0) return SIN_EMPUJAR;
  if (modificados + sinSeguir === 0) return LIMPIO;
  // Sucio pero sin fecha legible: no se puede decir que sea viejo, así que se LISTA.
  if (!Number.isFinite(ultimoToqueMs)) return SUCIO;
  return ahoraMs - ultimoToqueMs <= ventanaMs ? SUCIO : SUCIO_ANTIGUO;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Medida de un worktree (solo lectura)
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El mtime más reciente de las rutas sucias. Una ruta que ya no existe (borrado) no aporta fecha. */
function ultimoToque(raiz, entradas) {
  let max = null;
  for (const { ruta } of entradas) {
    try {
      const ms = fs.statSync(path.join(raiz, ruta)).mtimeMs;
      if (max === null || ms > max) max = ms;
    } catch { /* borrado o ilegible: no da fecha, y la decisión lo trata como «sin fecha» */ }
  }
  return max;
}

export function medirWorktree(ruta, { git = gitReal, ahoraMs = Date.now(), ventanaMs } = {}) {
  const base = { worktree: path.basename(ruta), ruta };
  if (!fs.existsSync(ruta)) return { ...base, estado: NO_PUDE_MIRAR, motivo: 'la ruta no existe en disco' };

  const st = git(ruta, ['status', '--porcelain', '-z', '--untracked-files=normal']);
  if (st.status !== 0) return { ...base, estado: NO_PUDE_MIRAR, motivo: 'git status falló' };
  const entradas = entradasDeStatus(st.stdout);
  const sinSeguir = entradas.filter((e) => e.codigo === '??').length;
  const modificados = entradas.length - sinSeguir;

  const rl = git(ruta, ['rev-list', '--count', 'HEAD', '--not', '--remotes']);
  const n = rl.status === 0 ? Number(String(rl.stdout).trim()) : NaN;
  const sinEmpujar = Number.isInteger(n) ? n : null;

  const rama = git(ruta, ['branch', '--show-current']);
  const log = git(ruta, ['log', '-1', '--format=%cI']);
  const toque = entradas.length ? ultimoToque(ruta, entradas) : null;
  const estado = clasificar({ sinEmpujar, modificados, sinSeguir, ultimoToqueMs: toque, ahoraMs, ventanaMs });
  return {
    ...base,
    estado,
    ...(estado === NO_PUDE_MIRAR ? { motivo: 'git rev-list no devolvió un número' } : {}),
    rama: rama.status === 0 && rama.stdout.trim() ? rama.stdout.trim() : '(detached)',
    sinEmpujar, modificados, sinSeguir,
    ultimoCommit: log.status === 0 ? log.stdout.trim() : null,
    ultimoToque: toque === null ? null : new Date(toque).toISOString(),
  };
}

/** El censo entero. Si ni siquiera se pueden listar los worktrees, eso es NO-PUDE-MIRAR del todo. */
export function censo({ repo, git = gitReal, ahoraMs = Date.now(), ventanaMs }) {
  const wl = git(repo, ['worktree', 'list', '--porcelain']);
  const rutas = wl.status === 0 ? rutasDeWorktrees(wl.stdout) : null;
  if (!rutas) return { ok: false, motivo: `no se pudo listar los worktrees de ${repo}`, filas: [] };
  const filas = rutas.map((r) => medirWorktree(r, { git, ahoraMs, ventanaMs }));
  return { ok: true, filas };
}

export function resumen({ ok, motivo, filas }, horas) {
  if (!ok) return { codigo: 2, texto: `🔴 NO PUDE MIRAR: ${motivo}. Esto NO es «sin huérfanos».` };
  const de = (e) => filas.filter((f) => f.estado === e);
  const sinEmpujar = de(SIN_EMPUJAR), sucios = de(SUCIO), antiguos = de(SUCIO_ANTIGUO), noPude = de(NO_PUDE_MIRAR);
  const l = [];
  l.push(`censo de huérfanos · ${filas.length} worktrees mirados · ${sinEmpujar.length} con commits SIN EMPUJAR · ` +
    `${sucios.length} sucios recientes (<${horas} h) · ${antiguos.length} sucios antiguos (no listados) · ` +
    `${noPude.length} NO PUDE MIRAR`);
  if (sinEmpujar.length) {
    l.push('', '🔴 COMMITS QUE NO ESTÁN EN NINGÚN REMOTO (se listan siempre):');
    for (const f of [...sinEmpujar].sort((a, b) => String(b.ultimoCommit).localeCompare(String(a.ultimoCommit)))) {
      l.push(`   ${f.worktree} · ${f.rama} · ${f.sinEmpujar} commit(s) · último ${f.ultimoCommit ?? '?'}` +
        (f.modificados + f.sinSeguir ? ` · además ${f.modificados} modificado(s), ${f.sinSeguir} sin seguir` : ''));
    }
  }
  if (sucios.length) {
    l.push('', `🟡 CAMBIOS SIN COMMITEAR tocados en las últimas ${horas} h:`);
    for (const f of [...sucios].sort((a, b) => String(b.ultimoToque).localeCompare(String(a.ultimoToque)))) {
      l.push(`   ${f.worktree} · ${f.rama} · ${f.modificados} modificado(s), ${f.sinSeguir} sin seguir · tocado ${f.ultimoToque ?? '(sin fecha legible)'}`);
    }
  }
  if (noPude.length) {
    l.push('', '🔴 NO PUDE MIRAR (no cuentan como limpios):');
    for (const f of noPude) l.push(`   ${f.worktree} · ${f.motivo}`);
  }
  if (!sinEmpujar.length && !sucios.length && !noPude.length) l.push('✅ nada que salvar en la ventana.');
  const codigo = noPude.length ? 2 : (sinEmpujar.length || sucios.length) ? 1 : 0;
  return { codigo, texto: l.join('\n') };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CLI
// ═════════════════════════════════════════════════════════════════════════════════════════════

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opcion = (n) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : null; };
  const horasTxt = opcion('horas');
  const horas = horasTxt === null ? HORAS_POR_DEFECTO : Number(horasTxt);
  if (!(horas > 0)) {
    console.error(`--horas tiene que ser un número positivo (llegó «${horasTxt}»)`);
    process.exit(2);
  }
  const repo = opcion('repo') || process.cwd();
  const c = censo({ repo, ventanaMs: horas * 3600 * 1000 });
  const r = resumen(c, horas);
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ cuando: new Date().toISOString(), horas, codigo: r.codigo, ...c }, null, 2) + '\n');
  } else {
    process.stdout.write(r.texto + '\n');
  }
  process.exit(r.codigo);
}
