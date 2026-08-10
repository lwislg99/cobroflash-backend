// scripts/_prisma-sync.mjs — SCRUM-429 · regenerar el cliente SOLO donde hacerlo no rompe a nadie.
//
// ── EL DEFECTO, Y SON DOS CAUSAS ────────────────────────────────────────────────────────────
// `prisma/schema.prisma` viaja con la rama; el cliente generado NO. De ahí salen dos formas de que
// diverjan, y hasta SCRUM-429 solo se nombraba la segunda:
//
//   (A) **tu propio cambio de rama.** Cambias de rama o mergeas main, el schema gana una columna, y
//       tu cliente se queda viejo sin que nadie más haya tocado nada. Le pasó seis veces a este
//       proyecto, y la sexta se diagnosticó mal precisamente por eso.
//   (B) **otro worktree**, cuando `node_modules` es un JUNCTION al de otro: el cliente es de todos
//       y manda quien regenere el último.
//
// ── POR QUÉ ESTO EXISTE, Y POR QUÉ NO REGENERA SIEMPRE ─────────────────────────────────────
// Regenerar es barato (~240 ms medido) y arregla la (A) sin que nadie se acuerde. **Pero con un
// `node_modules` compartido, regenerar arregla el tuyo y ROMPE el de quien esté corriendo tests en
// ese momento** — que es exactamente el daño que este ticket vino a quitar.
//
// Así que el automatismo **se condiciona a que el cliente sea PRIVADO**, y eso **se deriva, no se
// supone**: `lstat().isSymbolicLink()` distingue un junction de un directorio real (verificado en
// Windows: el junction sale `true`). Si es compartido, aquí no se toca nada y se explica por qué.
//
// ⚠️ ESTO NO SUSTITUYE AL GUARD. `_prisma-client-guard.mjs` sigue corriendo detrás, y por eso el
// día que este automatismo se deshaga nos enteramos por él y no por una medición corrompida.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { comprobarCliente } from './_prisma-client-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = path.join(RAIZ, 'node_modules');

/**
 * ¿El cliente generado es MÍO, o lo comparto con otros worktrees?
 *
 * Devuelve `null` cuando no se puede saber — y quien llame **no puede tratar eso como «es mío»**:
 * regenerar sobre un compartido creyéndolo propio es el daño que esto evita.
 */
export function clienteEsPrivado(rutaNodeModules = NODE_MODULES) {
  try {
    return !fs.lstatSync(rutaNodeModules).isSymbolicLink();
  } catch {
    return null; // no existe o no se pudo mirar: no se decide por omisión
  }
}

function regenerar() {
  // El binario LOCAL, no `npx`: `npx prisma` se baja `prisma@latest` cuando falta el local y
  // genera desde otra versión (SCRUM-385). Aquí eso sería cambiar un problema por otro peor.
  // El JS de prisma, con el node que ya está corriendo. Ni `npx` —que se baja `prisma@latest`
  // cuando falta el local y genera desde otra versión (SCRUM-385)— ni el `.cmd` de `.bin`, que en
  // Windows exige `shell: true` y eso arrastra un aviso de deprecación por los argumentos sin
  // escapar. Así no hay shell, no hay descarga y la versión es la del proyecto.
  const cli = path.join(RAIZ, 'node_modules', 'prisma', 'build', 'index.js');
  const r = spawnSync(process.execPath, [cli, 'generate'], { cwd: RAIZ, encoding: 'utf8' });
  return { ok: r.status === 0, detalle: (r.stderr || r.error?.message || '').trim().slice(0, 300) };
}

export async function sincronizar() {
  const antes = await comprobarCliente();
  if (antes.ok) return { estado: 'ya-cuadraba' };

  const privado = clienteEsPrivado();
  if (privado !== true) {
    return {
      estado: 'compartido',
      mensaje: [
        '',
        '🔴 EL CLIENTE DE PRISMA NO CUADRA CON schema.prisma, Y NO SE REGENERA SOLO.',
        '',
        privado === null
          ? '   No se ha podido determinar si `node_modules` es propio o un junction.'
          : '   Tu `node_modules` es un JUNCTION: el cliente lo compartes con otros worktrees.',
        '',
        '   Regenerarlo arreglaría el tuyo y ROMPERÍA el de quien esté corriendo tests ahora mismo,',
        '   que es justo el daño que SCRUM-429 vino a quitar. Por eso aquí no se toca nada.',
        '',
        '   Dos salidas:',
        '     · aislar este worktree (una vez, y ya no vuelve a pasar) — ver docs/master/SCRUM-429.md;',
        '     · o avisar a las otras sesiones y regenerar a mano:  npm run prisma:generate',
        '',
      ].join('\n'),
    };
  }

  const gen = regenerar();
  if (!gen.ok) return { estado: 'fallo-al-generar', mensaje: `[prisma] no se pudo regenerar: ${gen.detalle || '(sin detalle)'}` };

  // ⚠️ AQUÍ NO SE VUELVE A COMPROBAR, y la primera versión sí lo hacía — mal.
  //
  // `comprobarCliente` lee el cliente con un `import()` dinámico, y Node **cachea el módulo**: tras
  // regenerar, la segunda lectura devolvía el cliente VIEJO y este script decía «sigue
  // divergiendo» con el cliente ya arreglado. Lo cazó el propio escenario de la causa (A): el
  // fichero tenía marca nueva y el guard, en su proceso, daba verde.
  //
  // Quien juzga es el guard, que corre DETRÁS en `pretest` y en un proceso propio. Es además lo
  // correcto por otro motivo: así el veredicto lo sigue dando el mismo mecanismo de siempre, y no
  // una copia dentro del automatismo que podría divergir de él.
  return { estado: 'regenerado' };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('_prisma-sync.mjs')) {
  const r = await sincronizar();
  if (r.estado === 'regenerado') {
    console.log('[prisma] el cliente estaba viejo para esta rama y se ha regenerado solo.');
  } else if (r.estado !== 'ya-cuadraba') {
    console.error(r.mensaje || `[prisma] no se pudo sincronizar el cliente (${r.estado}).`);
    process.exit(1);
  }
}
