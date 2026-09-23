// scripts/vigia-sesiones-jv.mjs — SCRUM-1000
//
// QUÉ HACE: lee `sesion.mjs estado` (SIN modificarlo) y, si hay una sesión de fondo MUERTA o
// BLOQUEADA que no se conocía ya, escribe UN issue de GitHub (creado una vez, reescrito cada
// pasada) y comenta SOLO cuando la lista empeora — mismo patrón que
// `.github/workflows/vigia-atascados.yml` para PR atascados, aplicado a sesiones.
//
// POR QUÉ EXISTE, medido (SCRUM-1000, 23-sep-2026): `sesion.mjs estado` ya distingue MUERTA y
// BLOQUEADA (SCRUM-1026), pero es PULL — solo contesta si alguien pregunta. El propio registro de
// SCRUM-1026 declara sin construir «un aviso ACTIVO»: «se deja para que el orquestador decida si la
// quiere y de qué tamaño». Esta pieza es esa decisión, para el equipo de Javier, ejecutada como
// tarea programada de Windows (fuera de este repo: `schtasks /create`, documentado en el registro
// del ticket, NO ejecutado por esta sesión — crear una tarea programada nueva es una acción de
// sistema que no se autoriza sola).
//
// 🔴 NO TOCA `scripts/equipo/` (compartido con el equipo de Luis): solo LEE la salida de la copia
// YA INSTALADA de `sesion.mjs` (`node <INST>/sesion.mjs estado`), como un proceso aparte. Si esa
// copia está ALTERADA o vieja, `sesion.mjs` ya falla cerrado por su propia puerta de integridad;
// este script no la repite.
//
// La `gh` usada es la de la máquina (`C:/Program Files/GitHub CLI/gh.exe`, fuera del PATH).

import { spawnSync } from 'node:child_process';

export const TITULO = '[vigía-jv] sesiones muertas o bloqueadas';
const MARCA = 'vigia-sesiones-jv:ids';

/**
 * De `sesion.mjs estado` (ya parseado), la lista PLANA de lo que hay que vigilar: las BLOQUEADAS
 * con `avisar:true` (SCRUM-1026: ya superaron el umbral) y las MUERTA de `restos`. Cada entrada,
 * normalizada, con un `id` estable para poder comparar entre pasadas.
 *
 * @param {{bloqueadas?:object[], restos?:object[]}} estado
 * @returns {{id:string, nombre:string, clase:'BLOQUEADA'|'MUERTA', motivo:string}[]}
 */
export function sesionesQueAvisan(estado) {
  const bloqueadas = Array.isArray(estado?.bloqueadas) ? estado.bloqueadas : [];
  const restos = Array.isArray(estado?.restos) ? estado.restos : [];
  const lista = [];
  for (const b of bloqueadas) {
    if (!b?.avisar) continue;
    lista.push({ id: String(b.id), nombre: String(b.nombre ?? '?'), clase: 'BLOQUEADA', motivo: `espera ${b.waitingFor || 'algo interactivo'}` });
  }
  for (const r of restos) {
    if (r?.clasificacion !== 'MUERTA') continue;
    lista.push({ id: String(r.id), nombre: String(r.nombre ?? '?'), clase: 'MUERTA', motivo: String(r.porque ?? 'sin motivo') });
  }
  return lista;
}

/**
 * Compara la lista de HOY contra los `id` ya conocidos (los que trajo el issue la pasada
 * anterior). Empeora si hay algún `id` NUEVO — el mismo `id` repetido no vuelve a avisar (ya se
 * dijo una vez y nadie lo ha resuelto ni relanzado).
 *
 * @param {{antes:string[], ahora:{id:string}[]}} e
 */
export function queEmpeora({ antes, ahora }) {
  const conocidos = new Set(antes ?? []);
  const nuevos = ahora.filter((s) => !conocidos.has(s.id));
  return { empeora: nuevos.length > 0, nuevos };
}

/** El cuerpo del issue: la lista de hoy entera + la marca con los `id` para la próxima pasada. */
export function componerCuerpo(lista) {
  const ids = lista.map((s) => s.id);
  const filas = lista.length
    ? lista.map((s) => `- **${s.clase}** · \`${s.nombre}\` (${s.id}) — ${s.motivo}`).join('\n')
    : '_Ninguna sesión muerta ni bloqueada en esta pasada._';
  return `Sesiones de fondo del equipo de Javier (jv-*), vigiladas por \`scripts/vigia-sesiones-jv.mjs\` (SCRUM-1000). Detecta, no arregla: relanzar es del orquestador (\`sesion.mjs relevar\`/\`lanzar\`).\n\n${filas}\n\n<!-- ${MARCA} ${JSON.stringify(ids)} -->\n`;
}

/** Lee la marca de un cuerpo de issue anterior. Cuerpo sin marca ⇒ memoria vacía de verdad. */
export function leerMarca(cuerpo) {
  const m = String(cuerpo ?? '').match(new RegExp(`<!-- ${MARCA} (.*) -->`));
  if (!m) return [];
  try {
    const v = JSON.parse(m[1]);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function ejecutar(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ?? null };
}

async function main() {
  const instDir = process.argv[2] || process.env.YAQU_INST || 'C:/Users/Javier Pereira/AppData/Local/yaqu-equipo';
  const repo = process.argv[3] || process.env.YAQU_REPO || 'lwislg99/cobroflash-backend';
  const gh = process.env.YAQU_GH || 'C:/Program Files/GitHub CLI/gh.exe';

  const est = ejecutar('node', [`${instDir}/sesion.mjs`, 'estado']);
  if (est.status !== 0 || !est.stdout.trim()) {
    console.log(JSON.stringify({ veredicto: 'NO-PUDE-MIRAR', motivo: 'sesion.mjs estado no devolvió salida', stderr: est.stderr.slice(-400) }));
    process.exitCode = 2;
    return;
  }
  let estado;
  try { estado = JSON.parse(est.stdout.trim().split('\n').at(-1)); } catch {
    console.log(JSON.stringify({ veredicto: 'NO-PUDE-MIRAR', motivo: 'sesion.mjs estado no devolvió JSON válido' }));
    process.exitCode = 2;
    return;
  }

  const ahora = sesionesQueAvisan(estado);

  const buscar = ejecutar(gh, ['issue', 'list', '--repo', repo, '--state', 'open', '--search', `${TITULO} in:title`, '--json', 'number,title']);
  if (buscar.status !== 0) {
    console.log(JSON.stringify({ veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo buscar el issue', stderr: buscar.stderr.slice(-400) }));
    process.exitCode = 2;
    return;
  }
  let num = null;
  let antes = [];
  try {
    const filas = JSON.parse(buscar.stdout || '[]');
    const fila = filas.find((f) => f.title === TITULO);
    if (fila) {
      num = fila.number;
      const ver = ejecutar(gh, ['issue', 'view', String(num), '--repo', repo, '--json', 'body']);
      if (ver.status === 0) {
        try { antes = leerMarca(JSON.parse(ver.stdout).body); } catch { antes = []; }
      }
    }
  } catch { /* filas vacías, num sigue null */ }

  const { empeora, nuevos } = queEmpeora({ antes, ahora });
  const cuerpo = componerCuerpo(ahora);

  if (num === null) {
    if (ahora.length === 0) {
      console.log(JSON.stringify({ veredicto: 'SIN-NOVEDAD', ahora: [], nota: 'nada que vigilar; no se crea issue' }));
      return;
    }
    const crear = ejecutar(gh, ['issue', 'create', '--repo', repo, '--title', TITULO, '--body', cuerpo]);
    console.log(JSON.stringify({ veredicto: crear.status === 0 ? 'ISSUE-CREADO' : 'NO-PUDE-MIRAR', ahora, salida: crear.stdout.trim() || crear.stderr.trim() }));
    process.exitCode = crear.status === 0 ? 0 : 2;
    return;
  }

  const editar = ejecutar(gh, ['issue', 'edit', String(num), '--repo', repo, '--body', cuerpo]);
  if (editar.status !== 0) {
    console.log(JSON.stringify({ veredicto: 'NO-PUDE-MIRAR', motivo: 'no se pudo reescribir el issue', stderr: editar.stderr.slice(-400) }));
    process.exitCode = 2;
    return;
  }
  if (empeora) {
    const aviso = `**Empeora:**\n${nuevos.map((s) => `- **${s.clase}** · \`${s.nombre}\` (${s.id}) — ${s.motivo}`).join('\n')}`;
    const comentar = ejecutar(gh, ['issue', 'comment', String(num), '--repo', repo, '--body', aviso]);
    console.log(JSON.stringify({ veredicto: comentar.status === 0 ? 'EMPEORA' : 'EMPEORA-SIN-AVISO', issue: num, nuevos, salida: comentar.status === 0 ? undefined : comentar.stderr.slice(-400) }));
    process.exitCode = comentar.status === 0 ? 0 : 2;
    return;
  }
  console.log(JSON.stringify({ veredicto: 'SIN-CAMBIOS-A-PEOR', issue: num, ahora }));
}

if (process.argv[1] && process.argv[1].endsWith('vigia-sesiones-jv.mjs')) {
  main();
}
