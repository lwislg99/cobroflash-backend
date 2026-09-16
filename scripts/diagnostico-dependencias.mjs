// scripts/diagnostico-dependencias.mjs — SCRUM-351
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ¿QUÉ ÁRBOL TIENE LAS DEPENDENCIAS AL DÍA? — POR ÁRBOL, Y AHORA
//
// El repo ya tenía las DOS mitades de esta respuesta, cada una por su lado:
//
//   · `scripts/topologia-node-modules.mjs` sabe **qué árboles hay** y **de dónde sale** el
//     `node_modules` de cada uno (propio, enlazado o resuelto hacia arriba).
//   · `tests/_desfase-node-modules.mjs` sabe comparar **lock contra instalado**… en el árbol
//     donde corre.
//
// Nadie las había juntado, y por eso la pregunta que costó cinco rojos esta semana —«¿es este
// árbol el que miente?»— no se podía contestar sin ir árbol por árbol a mano.
//
// 🔴 POR QUÉ IMPORTA, con el caso real: cinco rojos de `main` resultaron ser `fake-indexeddb`
// ausente de un `node_modules` viejo. **Un árbol al día con dependencias viejas miente MEJOR que
// un árbol viejo**, porque el defecto está en lo que FALTA, y lo que falta no aparece en ningún
// diff. Por eso el arreglo no es documentación: es poder preguntarlo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE ESTE SCRIPT NO HACE, Y NO ES PRUDENCIA: ES EL ENCARGO
//
// **No arregla nada.** No ejecuta `npm`, no escribe un byte, no borra un enlace. Solo lee. El
// arreglo lo ejecuta el fundador, porque **hay sesiones corriendo dentro de esos árboles** y un
// `npm ci` ajeno a mitad de una tanda la rompe sin que nadie sepa por qué.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DOS INSTRUMENTOS ANTES DE DECIR «AL DÍA», y son los del comparador que ya existía:
//
//   ① PRESENCIA — cada dependencia directa del lock, ¿está instalada? (el caso `fake-indexeddb`)
//   ② VERSIÓN   — la instalada, ¿es la que el lock resuelve? (el caso que la presencia no ve)
//
// Un árbol es «al día» solo si pasa LOS DOS. Y si no se puede mirar, eso **sale en la lista** como
// `no legible`: «no supe mirar» y «está al día» son el mismo verde con significados opuestos.
//
// ⚠️ EL DETALLE QUE SORPRENDE, y por eso se imprime: **compartir el `node_modules` NO significa
// tener el mismo veredicto.** Cada árbol se compara contra SU PROPIO `package-lock.json`, y dos
// worktrees en ramas distintas tienen locks distintos. Dos árboles enlazados al mismo directorio
// pueden salir uno «al día» y otro «desfasado», y los dos veredictos son correctos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { worktreesDelRepo, resolverNodeModules } from './topologia-node-modules.mjs';
import { exigidasPorElLock } from '../tests/_desfase-node-modules.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(AQUI, '..');

/**
 * Los árboles a mirar: los worktrees que git declara MÁS los hermanos del checkout principal que
 * parezcan un árbol de este repo (tienen `package.json`).
 *
 * Los hermanos entran porque `git worktree list` **no ve** las copias sueltas ni los worktrees
 * retirados a medias — y son justo los que se quedan con dependencias viejas y nadie mira. Es un
 * hueco declarado del censo de topología; aquí se cubre por derivación, sin lista a mano.
 */
export function arbolesAMirar(cwd = RAIZ_REPO) {
  const vistos = new Map();
  const meter = (ruta, origen) => {
    const abs = path.resolve(ruta);
    if (!vistos.has(abs)) vistos.set(abs, { raiz: abs, origen });
  };

  // `worktreesDelRepo` devuelve `{ok, raices}` o `{ok:false, motivo}` — cero worktrees es un fallo
  // de lectura para él, no un «no hay». Si no pudo mirar, se sigue con los hermanos del disco y el
  // motivo sale en el informe: quedarse sin lista tiene que verse, no convertirse en «cero árboles».
  const w = worktreesDelRepo(cwd);
  if (w.ok) for (const raiz of w.raices) meter(raiz, 'git worktree');
  else vistos.set('__git__', { raiz: '(git worktree list)', origen: 'git', ilegible: w.motivo });

  // Hermanos del checkout principal (…/cobroFlash/*), que es donde viven los `wt-*`.
  const padre = path.dirname(RAIZ_REPO);
  try {
    for (const e of fs.readdirSync(padre, { withFileTypes: true })) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const cand = path.join(padre, e.name);
      if (fs.existsSync(path.join(cand, 'package.json'))) meter(cand, 'hermano en disco');
    }
  } catch {
    // Que no se pueda listar el directorio padre no puede tumbar el diagnóstico de los demás:
    // se refleja abajo en el recuento de orígenes, no en un cero silencioso.
  }
  return [...vistos.values()];
}

/**
 * La versión instalada de un paquete, RESOLVIENDO COMO NODE: se busca en el `node_modules` más
 * cercano y, **si no está ahí, se sigue subiendo por los ancestros**.
 *
 * 🔴 ESTO ERA UN FALSO POSITIVO MÍO, y lo enseñó la primera pasada. Cinco árboles de
 * `.claude/worktrees/` salieron «desfasado» con **25 de 25 dependencias ausentes** — un número
 * absurdo que delataba al instrumento, no al árbol: tienen un `node_modules` PROPIO Y VACÍO, y yo
 * me paraba en él. Node no se para: la resolución es POR PAQUETE, así que una carpeta vacía no
 * impide encontrar el paquete en el padre. Como esos árboles viven DENTRO del repo, funcionan.
 *
 * La versión anterior habría mandado a alguien a reinstalar cinco árboles que están bien.
 */
export function versionResuelta(raizArbol, nombre) {
  let dir = path.resolve(raizArbol);
  for (;;) {
    try {
      const f = path.join(dir, 'node_modules', ...nombre.split('/'), 'package.json');
      return { version: JSON.parse(fs.readFileSync(f, 'utf8')).version, desde: path.join(dir, 'node_modules') };
    } catch { /* no está en este nivel: se sube, como hace Node */ }
    const padre = path.dirname(dir);
    if (padre === dir) return { version: null, desde: null };
    dir = padre;
  }
}

/**
 * El veredicto de UN árbol: su lock contra el `node_modules` que ESE árbol usa de verdad
 * (propio, enlazado o resuelto hacia arriba — lo dice la topología, no se supone).
 */
export function diagnosticarArbol(entrada) {
  const { raiz, origen } = entrada;
  // Si ni siquiera se pudo obtener la lista, eso ES una fila del informe.
  if (entrada.ilegible) return { raiz, origen, via: '?', usa: null, veredicto: 'no legible', motivo: entrada.ilegible };
  const topo = resolverNodeModules(raiz);
  const base = { raiz, origen, via: topo.via, usa: topo.real || null };

  if (topo.ciego) return { ...base, veredicto: 'no legible', motivo: topo.ciego };
  if (topo.via === 'ninguno') return { ...base, veredicto: 'sin dependencias', motivo: 'no hay `node_modules` que mirar' };

  const exigidas = exigidasPorElLock(raiz);
  if (exigidas === null) return { ...base, veredicto: 'no legible', motivo: 'sin `package-lock.json` o `package.json`' };
  if (exigidas.size === 0) return { ...base, veredicto: 'no legible', motivo: 'el lock no declara ni una dependencia directa' };

  const faltan = [];
  const distintas = [];
  for (const [nombre, pide] of exigidas) {
    const { version: tengo } = versionResuelta(raiz, nombre);
    if (tengo === null) faltan.push(nombre);              // ① presencia
    else if (tengo !== pide) distintas.push({ nombre, tengo, pide }); // ② versión
  }
  return {
    ...base,
    veredicto: faltan.length || distintas.length ? 'desfasado' : 'al dia',
    miradas: exigidas.size,
    faltan,
    distintas,
  };
}

/**
 * 🔴 AUTOPRUEBA — el detector se prueba a sí mismo ANTES de que nadie se crea su cero.
 *
 * Anoche un guard de este repo cantó «0 avisos rotos» porque un refactor correcto lo había dejado
 * ciego, no porque estuvieran arreglados. Y a mí me pasó la versión contraria en la primera pasada
 * de este mismo script. La regla que sale de las dos: **si un recuento baja, es sospecha, no
 * mejora** — así que aquí el cero solo se publica si el comparador demuestra, en el momento, que
 * sabe distinguir un árbol al día de uno desfasado.
 *
 * Se hace sobre dos árboles de mentira en el TEMPORAL del sistema. No se toca ningún worktree.
 */
export function autoprueba() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-351-autoprueba-'));
  const construir = (nombre, instalar) => {
    const dir = path.join(base, nombre);
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { alfa: '^1.0.0' } }));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/alfa': { version: '1.2.3' } } }));
    if (instalar) {
      fs.mkdirSync(path.join(dir, 'node_modules', 'alfa'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node_modules', 'alfa', 'package.json'), JSON.stringify({ version: instalar }));
    }
    return dir;
  };
  try {
    const alDia = diagnosticarArbol({ raiz: construir('completo', '1.2.3'), origen: 'autoprueba' }).veredicto;
    const falta = diagnosticarArbol({ raiz: construir('sin-alfa', null), origen: 'autoprueba' }).veredicto;
    const otra = diagnosticarArbol({ raiz: construir('otra-version', '0.9.0'), origen: 'autoprueba' }).veredicto;
    if (alDia !== 'al dia' || falta !== 'desfasado' || otra !== 'desfasado') {
      return { ok: false, motivo: `el comparador no distingue (completo=${alDia}, falta=${falta}, version=${otra})` };
    }
    return { ok: true };
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

export function diagnostico(cwd = RAIZ_REPO) {
  return arbolesAMirar(cwd).map(diagnosticarArbol);
}

export function informe(filas) {
  // 🔴 LA MÁQUINA Y LA HORA VAN EN EL INFORME, y es la lección de SCRUM-476: dos censos de este
  // repo dieron «91 junctions» y «cero junctions» y los dos eran ciertos — en HOSTS distintos.
  // Un recuento que no dice de qué población habla se lee como el estado del proyecto.
  const l = ['', `Host: ${os.hostname()} · ${new Date().toISOString()}`, `Árboles mirados: ${filas.length}`, ''];
  const orden = { desfasado: 0, 'no legible': 1, 'sin dependencias': 2, 'al dia': 3 };
  for (const f of [...filas].sort((a, b) => (orden[a.veredicto] - orden[b.veredicto]) || a.raiz.localeCompare(b.raiz))) {
    const marca = { desfasado: '🔴', 'no legible': '⚠️ ', 'sin dependencias': '· ', 'al dia': '✅' }[f.veredicto];
    l.push(`${marca} ${f.veredicto.toUpperCase().padEnd(16)} ${f.raiz}`);
    l.push(`     via=${f.via}${f.usa && f.usa !== path.join(f.raiz, 'node_modules') ? ` → ${f.usa}` : ''}  (${f.origen})`);
    if (f.motivo) l.push(`     ${f.motivo}`);
    if (f.faltan?.length) l.push(`     faltan ${f.faltan.length}/${f.miradas}: ${f.faltan.slice(0, 6).join(', ')}${f.faltan.length > 6 ? '…' : ''}`);
    if (f.distintas?.length) {
      l.push(`     versión distinta ${f.distintas.length}: `
        + f.distintas.slice(0, 4).map((d) => `${d.nombre} tengo ${d.tengo}, pide ${d.pide}`).join(' · ')
        + (f.distintas.length > 4 ? '…' : ''));
    }
  }
  const cuenta = (v) => filas.filter((f) => f.veredicto === v).length;
  l.push('', `al día: ${cuenta('al dia')} · desfasados: ${cuenta('desfasado')} · `
    + `sin dependencias: ${cuenta('sin dependencias')} · NO LEGIBLES: ${cuenta('no legible')}`, '');
  l.push('Esto NO arregla nada y no ejecuta `npm`: hay sesiones trabajando dentro de esos árboles.');
  l.push('El arreglo de un árbol ajeno lo ejecuta su sesión o el fundador — nunca desde aquí.');
  return l.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Primero el detector se prueba a sí mismo. Un cero de un detector ciego es peor que no medir.
  const auto = autoprueba();
  if (!auto.ok) {
    console.log(`\n🔴 CIEGO — NO SE PUBLICA NINGÚN RECUENTO: ${auto.motivo}.\n\n`
      + '  El comparador no ha sabido distinguir un árbol al día de uno desfasado sobre árboles de\n'
      + '  prueba cuya respuesta se conoce. Cualquier número de abajo sería inventado, así que no hay\n'
      + '  números de abajo.\n');
    process.exit(1);
  }
  const filas = diagnostico();
  console.log(informe(filas));
  // Sale 1 SOLO si no se pudo mirar algún árbol. Un árbol desfasado es un HALLAZGO, no un fallo
  // de este comando: informar es exactamente lo que se le pide.
  process.exit(filas.some((f) => f.veredicto === 'no legible') ? 1 : 0);
}
