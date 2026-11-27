// scripts/equipo/sin-version.mjs — SCRUM-1874 (C) · el cotejo de ronda del orquestador
//
//   node scripts/equipo/sin-version.mjs --lista <tickets-con-version.txt> [--todas]
//
// Cruza lo que está ESPERANDO (PR abiertos + ramas sin mergear) contra la lista de tickets que en
// Jira tienen versión, y nombra lo que no la tiene:
//
//     PR #3471 (scrum-1870) sin versión declarada, edad 2 d
//
// ── LA LISTA LA DA EL ORQUESTADOR, NO ESTE SCRIPT ────────────────────────────────────────────────
// Sin secretos: el CI no tiene token de Jira y no se le da (decisión de SCRUM-1874, opción B
// descartada mientras las etiquetas no sean la verdad). El orquestador la genera de Jira en su
// ronda y la pasa por fichero. Formato: una línea por ticket, la clave primero y, si quiere, la
// versión detrás (`SCRUM-1835 1.1`); líneas vacías y `#` se ignoran. Una lista VACÍA no da «todos
// sin versión»: sale 2, porque sería la lista la que falla, no los PR.
//
// ── LO QUE REUSA ─────────────────────────────────────────────────────────────────────────────────
// · Las ramas sin mergear: `instantanea()` + `alcanzabilidadDe()` + `INTOCABLES`, lo mismo que
//   `npm run ramas:sin-mergear` (SCRUM-637/804), con su SUELO. No se clasifica por segunda vez.
// · El número de una rama: `numeroDeRama` (`scripts/_numero-de-rama.mjs`), el del censo.
// · La declaración del registro (D): `juzgarRegistro` de `version-declarada.mjs`. Es una columna
//   de AYUDA («el registro sí dice 1.1»), no decide: lo que manda aquí es la lista de Jira.
//
// Sólo LEE. Salidas: 0 informe hecho (haya o no sin versión) · 2 no pude mirar (sin lista, sin
// `gh`, o el suelo de ramas). Sin `gh` NO se informa sólo de ramas: un PR abierto cuya rama se
// borró del remoto no saldría, y el informe parecería completo.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { instantanea, alcanzabilidadDe, PREFIJO_ORIGIN } from '../_censo-alcanzabilidad.mjs';
import { INTOCABLES, edadEnDias, suelo } from '../verificacion-s5/ramas-sin-mergear.mjs';
import { numeroDeRama } from '../_numero-de-rama.mjs';
import { juzgarRegistro, leerVersionEnCurso } from './version-declarada.mjs';

/** La lista del orquestador → `Map<número, versión|''>`. Una línea sin clave SCRUM-N es un error, no se salta. */
export function leerLista(texto) {
  const tickets = new Map();
  const errores = [];
  String(texto ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((l, i) => {
    const s = l.trim();
    if (!s || s.startsWith('#')) return;
    const m = /^SCRUM-0*(\d+)\b\s*(.*)$/i.exec(s);
    if (!m) { errores.push(`línea ${i + 1}: «${s.slice(0, 60)}» no empieza por una clave SCRUM-N`); return; }
    tickets.set(Number(m[1]), m[2].trim());
  });
  return { tickets, errores };
}

/** `2,4 d` / `5 h`: con menos de un día, en horas (la mediana de un PR aquí son 27 min). `null` → `?`. */
export function edadLegible(fechaIso, ahora) {
  const t = Date.parse(String(fechaIso || ''));
  if (!Number.isFinite(t)) return '?';
  const h = (ahora.getTime() - t) / 3600000;
  return h < 24 ? `${Math.max(0, Math.floor(h))} h` : `${edadEnDias(fechaIso, ahora)} d`;
}

/**
 * EL COTEJO, puro. `prs`: [{ numero, rama, creado }] · `ramas`: [{ rama, fecha }] ·
 * `conVersion`: Map de la lista. Una rama con PR abierto sale UNA vez, como PR.
 * Devuelve `{ sinVersion, conVersion, sinNumero }`, cada fila { pr, rama, ticket, fecha }.
 */
export function cotejar({ prs, ramas, conVersion }) {
  const porRama = new Map();
  for (const p of prs) porRama.set(p.rama, { pr: p.numero, rama: p.rama, fecha: p.creado });
  for (const r of ramas) if (!porRama.has(r.rama)) porRama.set(r.rama, { pr: null, rama: r.rama, fecha: r.fecha });
  const out = { sinVersion: [], conVersion: [], sinNumero: [] };
  for (const f of [...porRama.values()].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.rama.localeCompare(b.rama))) {
    const ticket = numeroDeRama(f.rama);
    const fila = { ...f, ticket };
    if (ticket === null) out.sinNumero.push(fila);
    else if (conVersion.has(ticket)) out.conVersion.push({ ...fila, version: conVersion.get(ticket) });
    else out.sinVersion.push(fila);
  }
  return out;
}

/** La línea del informe, con la forma que pidió el orquestador. */
export function lineaSinVersion(f, ahora) {
  const quien = f.pr ? `PR #${f.pr}` : `rama ${f.rama}`;
  return `${quien} (scrum-${f.ticket}) sin versión declarada, edad ${edadLegible(f.fecha, ahora)}`;
}

function localizarGh() {
  const candidatos = [process.env.GH_BIN, 'C:\\Program Files\\GitHub CLI\\gh.exe', 'gh'].filter(Boolean);
  for (const c of candidatos) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch { /* siguiente */ }
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const iLista = argv.indexOf('--lista');
  const todas = argv.includes('--todas');
  const ciego = (motivo) => { console.log(`🔴 NO PUDE MIRAR · ${motivo}`); process.exit(2); };
  if (iLista < 0 || !argv[iLista + 1]) ciego('falta `--lista <fichero>` (los tickets que en Jira tienen versión; lo genera el orquestador).');

  let texto;
  try { texto = fs.readFileSync(argv[iLista + 1], 'utf8'); } catch { ciego(`no puedo leer ${argv[iLista + 1]}`); }
  const { tickets, errores } = leerLista(texto);
  if (errores.length) ciego(`la lista tiene ${errores.length} línea(s) ilegible(s): ${errores.slice(0, 3).join(' · ')}`);
  if (!tickets.size) ciego('la lista no trae NINGÚN ticket: todo saldría «sin versión» y sería la lista la que falla.');

  const gh = localizarGh();
  if (!gh) ciego('no encuentro `gh` (ni GH_BIN, ni la ruta de Windows, ni el PATH): sin él no veo los PR abiertos.');
  let prs;
  try {
    prs = JSON.parse(execFileSync(gh, ['pr', 'list', '--state', 'open', '--limit', '1000', '--json', 'number,headRefName,createdAt'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
      .map((p) => ({ numero: p.number, rama: p.headRefName, creado: p.createdAt }));
  } catch (e) { ciego(`\`gh pr list\` no contestó (${String(e.message).split('\n')[0]})`); }

  const inst = instantanea({ raiz: process.cwd() });
  const alcanzable = inst.incapaz ? () => null : alcanzabilidadDe(inst);
  const fuera = inst.ramas.filter((r) => !INTOCABLES.has(r.nombre) && alcanzable(r.nombre) === false);
  const piso = suelo({ incapaz: inst.incapaz, totalRefs: inst.ramas.length, sinMergear: fuera.length });
  if (piso.ciego) ciego(piso.motivo);
  const fechas = new Map();
  try {
    const salida = execFileSync('git', ['for-each-ref', '--format=%(refname)%09%(committerdate:iso8601-strict)', PREFIJO_ORIGIN], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const l of salida.split(/\r?\n/)) { const [ref, f] = l.split('\t'); if (ref && f) fechas.set(ref.trim(), f.trim()); }
  } catch { /* sin fechas: la edad sale «?» por fila */ }
  const ramas = fuera.map((r) => ({ rama: r.nombre, fecha: fechas.get(r.refname) || null }));

  const ahora = new Date();
  const r = cotejar({ prs, ramas, conVersion: tickets });
  const enCurso = leerVersionEnCurso(process.cwd());
  const delRegistro = (f) => {
    try {
      const t = execFileSync('git', ['show', `origin/${f.rama}:docs/master/SCRUM-${f.ticket}.md`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (enCurso.error) return 'registro: (sin versión en curso legible)';
      const v = juzgarRegistro(t, enCurso.version);
      return v.ok ? `el registro SÍ declara (${v.como})` : `registro: ${v.motivo}`;
    } catch { return `sin docs/master/SCRUM-${f.ticket}.md en origin/${f.rama}`; }
  };

  console.log(`SIN VERSIÓN (SCRUM-1874) · origin/main = ${inst.sha.slice(0, 8)} · ${prs.length} PR abiertos · ${fuera.length} ramas sin mergear · lista: ${tickets.size} tickets con versión`);
  console.log(`  sin versión ${r.sinVersion.length} · con versión ${r.conVersion.length} · sin número de ticket ${r.sinNumero.length}\n`);
  // Los PR primero: son lo que entra en `main` en minutos. Las ramas sin PR suelen ser viejas y
  // tapaban los PR (ensayo del 27-nov: 99 sin versión, los once primeros de 120+ días).
  const conPr = r.sinVersion.filter((f) => f.pr);
  const sinPr = r.sinVersion.filter((f) => !f.pr);
  console.log(`PR ABIERTOS sin versión · ${conPr.length}`);
  for (const f of conPr) console.log(`${lineaSinVersion(f, ahora)}   · ${delRegistro(f)}`);
  if (!conPr.length) console.log('(ninguno)');
  console.log(`\nRAMAS SIN PR sin versión · ${sinPr.length} (la más vieja primero)`);
  for (const f of sinPr) console.log(`${lineaSinVersion(f, ahora)}   · ${delRegistro(f)}`);
  if (!sinPr.length) console.log('(ninguna)');
  if (r.sinNumero.length) {
    console.log(`\nSIN NÚMERO · ${r.sinNumero.length} — su rama no da ticket (numeroDeRama), así que no se puede cotejar:`);
    for (const f of r.sinNumero) console.log(`  ${f.pr ? `PR #${f.pr} ` : ''}${f.rama}, edad ${edadLegible(f.fecha, ahora)}`);
  }
  if (todas && r.conVersion.length) {
    console.log(`\nCON VERSIÓN · ${r.conVersion.length}`);
    for (const f of r.conVersion) console.log(`  ${f.pr ? `PR #${f.pr}` : `rama ${f.rama}`} (scrum-${f.ticket}) · ${f.version || '(la lista no dice cuál)'}`);
  }
  console.log('\nSólo lectura. La lista manda; la columna del registro es de ayuda (D, `version-declarada.mjs`).');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
