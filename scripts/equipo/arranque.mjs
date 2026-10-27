// SCRUM-1298b · EL ÁRBOL DONDE ARRANCAN LAS SESIONES: ¿trae lo que `main` ya trae? Lo usa el latido (sección ARRANQUE).
//
// POR QUÉ EXISTE. Una sesión carga sus normas y sus hooks de la carpeta donde ARRANCA, no de `main`. El
// 9-oct-2026 esa carpeta (el checkout compartido) iba 2.582 commits por detrás y declaraba 1 de los 5 hooks de
// `main`: la cerradura de carril, la identidad y los dos del latido estaban mergeados desde el 6-oct y no
// corrían en NINGUNA sesión. El encargo de cada tanda decía «el candado BLOQUEA de verdad»; se midió a mano
// cuatro veces (SCRUM-1298 c.18587, c.18716, c.19042, c.19080) y ningún instrumento lo decía.
//
// QUÉ AVISA, y por qué el umbral NO es un número de commits. `main` recibe unos 30 merges al día: «va 40 por
// detrás» es verdad a media tarde de cualquier día y no dice si a quien arranca le falta algo. Lo que se
// compara es lo que una sesión CARGA AL ARRANCAR: `CLAUDE.md`, lo que `CLAUDE.md` importa con `@`, y `.claude/`
// (hooks, reglas, mapa de carriles, skills, settings). Si UNA de esas piezas es distinta en `main`, avisa. Y los
// hooks se cuentan aparte, leyendo el `settings.json` que hay EN DISCO, porque eso es lo que de verdad se carga.
// Los commits por detrás van siempre en la población, como dato.
//
// CONTRA QUÉ. Contra la punta de `main` EN EL REMOTO, preguntada en ese momento (`ls-remote`) y congelada en
// un sha: todo lo demás se mide contra ESE objeto. No contra la copia local de la referencia, que es de cuando
// alguien trajo por última vez: una copia vieja daría «al día» a un árbol que no lo está. Sin red, la sección
// dice que NO PUDO MIRAR.
//
// SÓLO LEE. No cambia de rama, no trae nada al árbol de trabajo y no arregla: da la orden y la ejecuta una
// persona con el equipo parado, porque cambiar de rama bajo una sesión viva le cambia los ficheros en la mano.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SHA = /^[0-9a-f]{40}$/;

/** Los hooks que declara un `settings.json`, uno por renglón: «evento · a qué herramientas · orden». */
export function ordenesDe(json) {
  const out = [];
  for (const [evento, grupos] of Object.entries((json && json.hooks) || {})) {
    for (const g of Array.isArray(grupos) ? grupos : []) {
      for (const h of Array.isArray(g.hooks) ? g.hooks : []) out.push(`${evento} · ${g.matcher || '*'} · ${h.command}`);
    }
  }
  return out.sort();
}

/** Lo que `CLAUDE.md` importa: un renglón que es sólo `@ruta`. */
export function importadosPor(claudeMd) {
  return String(claudeMd || '').replace(/\r\n/g, '\n').split('\n').map((l) => /^@(\S+)\s*$/.exec(l.trim())).filter(Boolean).map((m) => m[1]);
}

const corto = (s) => String(s).slice(0, 8);

/**
 * @param {{
 *   arbol:string, rama:string|null, head:string, punta:string, detras:number, delante:number,
 *   hooksEnDisco:string[], hooksDeMain:string[], distintas:string[], motivo?:string,
 * }|undefined|null} m  lo que devuelve `medirArranque`
 */
export function seccionArranque(m) {
  const ciega = (motivo) => ({ nombre: 'ARRANQUE', pudo: false, motivo, alertas: [], poblacion: null });
  if (!m) return ciega('no pude medir el árbol donde arrancan las sesiones: NO SÉ si cargan las normas y los hooks de main');
  if (m.motivo) return ciega(`${m.motivo}: NO SÉ si quien arranca${m.arbol ? ` en ${m.arbol}` : ''} carga las normas y los hooks de main`);
  // Fail-closed: un `main` que no declara ningún hook no es «los carga todos», es que no supe leerlo.
  if (!Array.isArray(m.hooksDeMain) || m.hooksDeMain.length === 0) return ciega('main no declara ningún hook en `.claude/settings.json`, o no supe leerlo: con cero de cero no puedo decir «los carga todos»');
  const faltan = m.hooksDeMain.filter((o) => !m.hooksEnDisco.includes(o));
  const cargados = m.hooksDeMain.length - faltan.length;
  const donde = `${m.arbol} (${m.rama ? `rama \`${m.rama}\`` : 'HEAD suelto'}, ${corto(m.head)})`;
  const poblacion = `las sesiones arrancan en ${donde} · ${m.detras} commit(s) por detrás de la punta de main (${corto(m.punta)}, preguntada ahora al remoto)${m.delante ? ` y ${m.delante} por delante` : ''} · carga ${cargados} de ${m.hooksDeMain.length} hooks de main · ${m.distintas.length} pieza(s) de arranque distintas de las de main (CLAUDE.md, lo que importa y .claude/)`;
  const alertas = [];
  if (faltan.length || m.distintas.length) {
    const orden = m.rama === 'main' && m.delante === 0
      ? `git -C "${m.arbol}" merge --ff-only origin/main  (falla cerrado si algo choca)`
      : 'el salto a main con rescate: docs/master/SCRUM-1298.md, «El salto del checkout compartido»';
    alertas.push({
      arbol: m.arbol,
      linea: `${donde} · quien arranca ahí NO recibe lo que main ya trae: `
        + [
          faltan.length ? `${faltan.length} hook(s) que no corren para nadie (${faltan.join(' | ')})` : '',
          m.distintas.length ? `${m.distintas.length} pieza(s) de arranque viejas o ausentes (${m.distintas.slice(0, 4).join(', ')}${m.distintas.length > 4 ? ' …' : ''})` : '',
        ].filter(Boolean).join(' · ')
        + ` · va ${m.detras} commit(s) por detrás · se arregla con el equipo PARADO (cambia los ficheros bajo quien esté trabajando ahí): ${orden}`,
    });
  }
  return { nombre: 'ARRANQUE', pudo: true, alertas, poblacion };
}

function gitDe(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
}

/**
 * Lo único que toca el mundo. El árbol donde arrancan las sesiones es el PRINCIPAL del repositorio (el primero
 * de `git worktree list`): ahí se lanzan hoy las seis. Cuando arranquen en mesas, esto tendrá que medirlas a ellas.
 * @param {{raiz:string, remoto?:string, rama?:string, git?:(cwd:string, args:string[])=>string}} e
 */
export function medirArranque({ raiz, remoto = 'origin', rama = 'main', git = gitDe }) {
  let arbol;
  try {
    const primero = /^worktree (.+)$/m.exec(git(raiz, ['worktree', 'list', '--porcelain']));
    if (!primero) return { motivo: '`git worktree list` no dice cuál es el árbol principal' };
    arbol = path.resolve(primero[1].trim());
  } catch (e) { return { motivo: `no pude preguntar a git por el árbol principal (${String(e.message).split('\n')[0]})` }; }
  const sin = (que, e) => ({ arbol, motivo: `${que} (${String((e && e.message) || e).split('\n')[0]})` });
  // La punta, preguntada AL REMOTO y congelada. `ls-remote` no escribe ninguna referencia.
  let punta;
  try {
    punta = (git(arbol, ['ls-remote', remoto, `refs/heads/${rama}`]).split(/\s+/)[0] || '').trim();
    if (!SHA.test(punta)) return { arbol, motivo: `el remoto no contestó la punta de ${rama}` };
  } catch (e) { return sin(`no pude preguntar al remoto por la punta de ${rama}`, e); }
  try { git(arbol, ['cat-file', '-e', `${punta}^{commit}`]); } catch {
    // El commit aún no está en este disco: se trae (sólo objetos y la referencia remota; el árbol de trabajo no se toca).
    try { git(arbol, ['fetch', '--quiet', remoto, rama]); git(arbol, ['cat-file', '-e', `${punta}^{commit}`]); } catch (e) { return sin(`la punta ${corto(punta)} no está en este disco y no pude traerla`, e); }
  }
  try {
    const head = git(arbol, ['rev-parse', 'HEAD']).trim();
    let ramaDelArbol = null;
    try { ramaDelArbol = git(arbol, ['symbolic-ref', '--short', '-q', 'HEAD']).trim() || null; } catch { /* HEAD suelto */ }
    const detras = Number(git(arbol, ['rev-list', '--count', `${head}..${punta}`]).trim());
    const delante = Number(git(arbol, ['rev-list', '--count', `${punta}..${head}`]).trim());
    const hooksDeMain = ordenesDe(JSON.parse(git(arbol, ['show', `${punta}:.claude/settings.json`])));
    // Lo que hay EN DISCO es lo que se carga. Que el fichero no exista es un dato (cero hooks), no una ceguera.
    const enDisco = path.join(arbol, '.claude', 'settings.json');
    const hooksEnDisco = fs.existsSync(enDisco) ? ordenesDe(JSON.parse(fs.readFileSync(enDisco, 'utf8').replace(/^﻿/, ''))) : [];
    const piezas = ['CLAUDE.md', '.claude', ...importadosPor(git(arbol, ['show', `${punta}:CLAUDE.md`]))];
    const distintas = git(arbol, ['diff', '--name-only', head, punta, '--', ...piezas]).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!Number.isFinite(detras) || !Number.isFinite(delante)) return { arbol, motivo: 'git no devolvió un número al contar los commits' };
    return { arbol, rama: ramaDelArbol, head, punta, detras, delante, hooksEnDisco, hooksDeMain, distintas };
  } catch (e) { return sin('no pude comparar el árbol con la punta', e); }
}
