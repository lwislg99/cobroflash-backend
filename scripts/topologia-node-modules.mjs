// scripts/topologia-node-modules.mjs — SCRUM-351
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ¿LOS WORKTREES COMPARTEN `node_modules`, O NO?  — CONTESTADO EN EL MOMENTO, NO CITADO
//
// Durante meses el repo AFIRMABA que sí, por junction, y de esa afirmación salía la regla que
// todas las sesiones aplicábamos: «quien regenera el cliente de Prisma regenera para todos», y
// por tanto no se regenera. Cobró en las dos direcciones:
//   · se desaconsejó un `npm install` por miedo a romper la tanda de otras sesiones — miedo
//     infundado, porque no había nada compartido (SCRUM-461);
//   · y una sesión arrancó con cuatro `ERR_MODULE_NOT_FOUND` y estuvo a punto de no arreglarlo
//     por respetar una restricción que no aplicaba.
//
// SCRUM-461 corrigió la frase. Esto es lo otro: **el método**. Porque una frase corregida hoy
// vuelve a ser una premisa falsa en cuanto alguien recree un worktree, cambie de máquina o
// instale de otra forma — que es exactamente cómo llegamos aquí. La respuesta no se escribe:
// se deriva del sistema de ficheros cada vez que hace falta.
//
// Y no es teórico que caduque: la cabecera de `tests/scrum471-node-modules-al-dia.test.mjs`
// declara, con fecha de ayer, «200 árboles · 91 de ellos por junction». Hoy `git worktree list`
// da CUATRO y en el disco no queda ni un `wt-*`. Un número medido ayer ya no describe hoy.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// QUÉ SE MIDE, Y POR QUÉ ASÍ
//
// La pregunta de verdad no es «¿hay un junction?». Es **«¿dos worktrees acaban usando el mismo
// directorio?»**, y a eso se llega por TRES caminos distintos que hay que cubrir de una vez:
//
//   ① `node_modules` PROPIO         → un directorio real dentro del worktree.
//   ② `node_modules` ENLAZADO       → junction de Windows o symlink: la carpeta está, pero
//                                     `realpath` sale al destino de otro.
//   ③ `node_modules` AUSENTE        → **el peor, porque no se ve**: Node resuelve hacia ARRIBA
//                                     y usa el del padre. No hay enlace que inspeccionar, así
//                                     que un método que solo mire `lstat` lo declara «propio»
//                                     o «no existe» y falla en silencio.
//
// Los tres se contestan con la MISMA operación: resolver a qué directorio REAL llega cada
// worktree y agrupar por ese destino. **Comparten los que caen en el mismo destino.** Nada de
// enumerar mecanismos —la familia de listas que envejecen (SCRUM-199)—: si mañana aparece un
// cuarto montaje, `realpath` lo resuelve igual y el agrupamiento no cambia.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL SUELO, Y ES LA MITAD DEL TICKET
//
// **Un fallo de lectura NO es «son independientes».** Si `lstat` o `realpath` no pueden con un
// árbol, ese árbol sale como CIEGO y el veredicto global lo dice. Confundir «no supe mirar» con
// una respuesta es literalmente el fallo que este fichero viene a matar: un junction roto —el
// enlace está, el destino lo borró alguien (pasó dos veces aquí, `docs/ERRORES_ASESOR.md`)—
// resuelve a nada, y llamarlo «propio» invitaría a regenerar sobre un montaje que no se conoce.
//
// LO QUE ESTO **NO** MIRA, declarado y no descubierto en un rojo:
//   · Árboles que NO estén en `git worktree list`. Copias sueltas y worktrees retirados a medias
//     no son worktrees, y barrer el disco entero costaría el segundo que hace que un guard se
//     desactive. Si te preocupa uno concreto, pásalo:  --arbol <ruta>
//   · Si el contenido de dos `node_modules` distintos es EQUIVALENTE. Eso es otra propiedad
//     (`tests/_desfase-node-modules.mjs`, SCRUM-471) y se responde con el lock, no con rutas.
// ─────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Clave de agrupamiento. En Windows el sistema de ficheros no distingue mayúsculas. */
function clave(rutaReal) {
  return process.platform === 'win32' ? rutaReal.toLowerCase() : rutaReal;
}

/**
 * Las raíces de los worktrees, según git. Es la fuente autorizada de «qué es un worktree»;
 * inventar el listado mirando el disco sería volver a suponer.
 *
 * @returns {{ok: true, raices: string[]} | {ok: false, motivo: string}}
 */
export function worktreesDelRepo(cwd = process.cwd()) {
  const r = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd, encoding: 'utf8' });
  if (r.error) return { ok: false, motivo: `no se ha podido ejecutar git: ${r.error.message}` };
  if (r.status !== 0) return { ok: false, motivo: `git ha fallado: ${(r.stderr || '').trim() || `código ${r.status}`}` };
  const raices = [...String(r.stdout).matchAll(/^worktree (.+)$/gm)].map((m) => m[1].trim());
  // CERO worktrees no es un repo sin worktrees: el árbol donde corres YA es uno. Es un fallo de
  // lectura, y sale por la puerta de «no supe mirar», no por la de «no comparte nadie».
  if (raices.length === 0) return { ok: false, motivo: 'git no ha listado ni un worktree (el árbol donde corres ya sería uno)' };
  return { ok: true, raices };
}

/**
 * A qué directorio REAL de `node_modules` llega este árbol, y por qué camino.
 *
 * Sube por los ancestros igual que hace Node al resolver un `require`, así que cubre el caso ③
 * —la carpeta ni siquiera está y se usa la del padre— que no deja ningún enlace que delate nada.
 *
 * @returns {{raiz: string, via: 'propio'|'enlace'|'ascendente'|'ninguno', real: string|null}
 *          | {raiz: string, ciego: string}}
 */
export function resolverNodeModules(raiz) {
  let dir = path.resolve(raiz);
  for (;;) {
    const nm = path.join(dir, 'node_modules');
    let st;
    try {
      st = fs.lstatSync(nm);
    } catch (err) {
      // ENOENT es la única ausencia legítima: aquí no hay, se sigue subiendo. Cualquier otro
      // error (EACCES, ENOTDIR, EIO, EPERM…) es NO PODER MIRAR, y eso no se traga en silencio.
      if (err.code === 'ENOENT') {
        const padre = path.dirname(dir);
        if (padre === dir) return { raiz, via: 'ninguno', real: null };
        dir = padre;
        continue;
      }
      return { raiz, ciego: `no se ha podido leer \`${nm}\`: ${err.code || err.message}` };
    }

    let real;
    try {
      // `.native` para que Windows devuelva la ruta canónica (nombre largo y caja de verdad):
      // dos rutas al mismo sitio tienen que salir IGUALES o el agrupamiento no vale nada.
      real = fs.realpathSync.native(nm);
    } catch (err) {
      // El enlace ESTÁ pero no lleva a ningún sitio: un junction cuyo destino borró alguien.
      // «Propio» sería la respuesta más cara posible aquí.
      return { raiz, ciego: `\`${nm}\` existe pero no se puede resolver: ${err.code || err.message}` };
    }

    // Si lo encontrado NO está en la raíz del worktree, la vía es la ascendente y punto: que el
    // `node_modules` del ancestro sea a su vez un enlace no cambia nada de lo que este árbol hace
    // —no tiene ninguno propio—, y `real` ya dice el destino de verdad.
    if (dir !== path.resolve(raiz)) return { raiz, via: 'ascendente', real };
    return { raiz, via: st.isSymbolicLink() ? 'enlace' : 'propio', real };
  }
}

/**
 * La topología completa: quién comparte con quién.
 *
 * @param {{raices?: string[], cwd?: string}} opciones  `raices` permite medir árboles que no son
 *        worktrees (o de mentira, en los tests) sin pasar por git.
 * @returns {{ok: false, motivo: string} | {ok: true, arboles, grupos, comparten, ciegos, sinDependencias}}
 */
export function topologia({ raices, cwd = process.cwd() } = {}) {
  let lista = raices;
  if (!lista) {
    const wt = worktreesDelRepo(cwd);
    if (!wt.ok) return { ok: false, motivo: wt.motivo };
    lista = wt.raices;
  }
  if (lista.length === 0) return { ok: false, motivo: 'no se ha pasado ni un árbol que medir' };

  const arboles = lista.map(resolverNodeModules);
  const ciegos = arboles.filter((a) => a.ciego);
  const sinDependencias = arboles.filter((a) => a.via === 'ninguno');

  const grupos = new Map(); // clave(real) → {real, raices:[]}
  for (const a of arboles) {
    if (a.ciego || a.real === null) continue;
    const k = clave(a.real);
    if (!grupos.has(k)) grupos.set(k, { real: a.real, raices: [] });
    grupos.get(k).raices.push(a.raiz);
  }
  const comparten = [...grupos.values()].filter((g) => g.raices.length > 1);

  return { ok: true, arboles, grupos: [...grupos.values()], comparten, ciegos, sinDependencias };
}

const VIA = {
  propio: 'directorio propio',
  enlace: 'ENLACE (junction o symlink)',
  ascendente: 'ninguno propio → resuelve HACIA ARRIBA',
  ninguno: 'no hay `node_modules` en ningún ancestro',
};

/** El veredicto, en palabras. Nunca dice «independientes» sobre un árbol que no se supo leer. */
export function veredicto(t) {
  if (!t.ok) {
    return [
      '',
      '🔴 NO SUPE MIRAR: no se puede decir si los worktrees comparten `node_modules`.',
      '',
      `   ${t.motivo}.`,
      '',
      '   Esto NO es «son independientes». Tratar un fallo de lectura como respuesta es el error',
      '   que este comprobador existe para no repetir.',
      '',
    ].join('\n');
  }

  const l = ['', `Árboles medidos: ${t.arboles.length}`, ''];
  for (const a of t.arboles) {
    l.push(a.ciego ? `   🔴 ${a.raiz}\n        NO SUPE MIRAR — ${a.ciego}` : `   · ${a.raiz}\n        ${VIA[a.via]}${a.real ? `\n        → ${a.real}` : ''}`);
  }
  l.push('');

  if (t.comparten.length) {
    l.push('🔗 COMPARTEN. Quien regenere el cliente de Prisma en uno, lo regenera para los demás:');
    for (const g of t.comparten) {
      l.push(`   → ${g.real}`);
      for (const r of g.raices) l.push(`        · ${r}`);
    }
    l.push('');
  } else if (t.ciegos.length === 0) {
    l.push('✔ NO COMPARTEN: cada árbol llega a un `node_modules` distinto.');
    l.push('   Regenerar el cliente de Prisma en el tuyo no toca el de nadie.');
    l.push('');
  } else {
    // 🔴 CON UN SOLO ÁRBOL CIEGO NO SE DICE «no comparten». Sería una afirmación sobre un
    // conjunto que incluye a alguien a quien no se ha mirado — el mismo cambiazo, otra vez.
    l.push('⚠️ Entre los árboles que SÍ se han podido mirar no hay dos que compartan.');
    l.push('   Esto NO es «no comparten»: falta(n) por medir los marcados arriba.');
    l.push('');
  }

  if (t.sinDependencias.length) {
    l.push(`⚠️ ${t.sinDependencias.length} árbol(es) sin \`node_modules\` en ningún ancestro: ahí no hay dependencias que compartir (ni con las que correr).`);
    l.push('');
  }
  if (t.ciegos.length) {
    l.push(`🔴 ${t.ciegos.length} árbol(es) NO SE HAN PODIDO MIRAR (arriba, marcados). El veredicto de arriba NO los incluye.`);
    l.push('');
  }
  return l.join('\n');
}

// Uso:  node scripts/topologia-node-modules.mjs [--arbol <ruta>]…
//
// Salida 1 SOLO cuando no se ha podido mirar. Compartir es una configuración legítima, no un
// fallo: el binario no está para prohibirla, está para que nadie tenga que suponerla.
function esInvocacionDirecta(metaUrl, argv1) {
  if (!argv1) return false;
  try {
    return fileURLToPath(metaUrl) === path.resolve(argv1);
  } catch {
    return false;
  }
}

if (esInvocacionDirecta(import.meta.url, process.argv[1])) {
  const extra = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--arbol' && process.argv[i + 1]) extra.push(process.argv[++i]);
  }
  const wt = worktreesDelRepo();
  const t = topologia({ raices: wt.ok ? [...wt.raices, ...extra] : extra.length ? extra : undefined });
  const texto = veredicto(t);
  if (!t.ok || t.ciegos.length) {
    console.error(texto);
    process.exit(1);
  }
  console.log(texto);
}
