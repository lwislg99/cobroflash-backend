// scripts/tanda-con-veredicto.mjs — SCRUM-858b · UNA TANDA SIN VEREDICTO NUNCA SALE EN VERDE.
//
// Uso (el script `test` de package.json):
//     node scripts/tanda-con-veredicto.mjs node --test --test-force-exit tests/*.test.mjs
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL DEFECTO (SCRUM-858, 15-sep-2026): dos tandas se quedaron 161 y 257 minutos SIN ESCRIBIR UN
// BYTE y sin línea de resumen. Una tanda así no da rojo: no da nada, y lo que queda encima de la
// mesa es una salida parcial con «0 fallos hasta aquí». Es la forma más barata de fabricar un verde.
//
// Lo medido el 17-sep-2026 (docs/master/SCRUM-858.md): el cuelgue NO se reproduce en 5 pasadas
// completas + 5 `npm test`. El silencio SANO más largo es el de `scrum601`, un censo que tarda
// 2–2,5 min A NIVEL DE MÓDULO mientras el reporter retiene la salida por orden de fichero (195 s
// como máximo medido). Esto no arregla un cuelgue que no se ha visto: impide que vuelva a pasar
// EN SILENCIO.
//
// 🔴 POR QUÉ UN ENVOLTORIO Y NO UN `--import`: medido con Node 24.8, con `node --test --import=…` y
// con `NODE_OPTIONS=--import`, el módulo SOLO se carga en los procesos HIJO, nunca en el padre que
// imprime el resumen. El vigilante tiene que estar FUERA de la tanda.
//
// Lo que hace, y nada más:
//   · lanza la orden que recibe, SIN shell (el patrón lo expande `node --test` o la shell de npm);
//   · pasa su salida estándar y de error TAL CUAL, byte a byte;
//   · SILENCIO: si en `TANDA_SILENCIO_MAX_MIN` minutos (15 por defecto) no escribe nada, lo dice,
//     para SOLO su árbol y sale con 3;
//   · SIN RESUMEN: si sale con 0 pero por la salida estándar no ha pasado la línea de recuento
//     (`ℹ tests N` del spec o `# tests N` del TAP), sale con 4. Un cero sin recuento no es un
//     veredicto: es un proceso que se ha ido;
//   · en cualquier otro caso sale con EL MISMO código que la tanda (un rojo sigue siendo rojo);
//   · SIGINT/SIGTERM se reenvían al hijo.
//
// ⚠️ El tope es de SILENCIO, no de duración: una tanda larga que va escribiendo no se toca. 15 min
// es 4,6× el peor silencio sano medido; bajarlo convierte esto en el rojo intermitente de SCRUM-852.
// ═════════════════════════════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

const [orden, ...args] = process.argv.slice(2);
if (!orden) {
  process.stderr.write('uso: node scripts/tanda-con-veredicto.mjs <orden> [argumentos…]\n');
  process.exit(2);
}

const pedido = Number(process.env.TANDA_SILENCIO_MAX_MIN);
const TOPE_MIN = Number.isFinite(pedido) && pedido > 0 ? pedido : 15;
const TOPE_MS = TOPE_MIN * 60_000;
const RESUMEN = /(^|\n)\s*(ℹ|#) tests \d+/;

// 🔴 SCRUM-928: el recuento hay que leerlo SIN color. Medido el 17-sep-2026, el reporter pinta la
// línea entera —`ESC[34m` DELANTE del glifo y `ESC[39m` detrás del número—, y el `\s*` de `RESUMEN`
// no se traga un ESC. Con `FORCE_COLOR` en el entorno (las sesiones de fondo arrancaban con un 3
// heredado), una tanda SANA que salía 0 se leía como «sin resumen» y salía con 4: un verde
// convertido en rojo, y para cualquiera que use `npm test`.
//   · Se limpia para LEER. Lo que se IMPRIME sigue pasando tal cual, byte a byte (858b lo exige).
//   · Se quitan las secuencias CSI completas, no sólo las de color: un reporter que mueva el cursor
//     partiría el ancla igual, y aquí no hay nada que ganar siendo más estrecho.
//   · Lo que NO cambia: el umbral ni lo que se exige. Un recuento a medias («tests» sin número)
//     sigue sin valer, y una tanda que de verdad no lo emite sigue saliendo con 4.
const CSI = /\u001B\[[0-9;?]*[ -\/]*[@-~]/g;
const sinColor = (s) => s.replace(CSI, '');

// `node` se resuelve al MISMO binario que corre esto: sin shell no hay PATH de npm que valga.
const ejecutable = orden === 'node' ? process.execPath : orden;
const posix = process.platform !== 'win32';
const hijo = spawn(ejecutable, args, { stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true, detached: posix });

let ultimaEscritura = Date.now();
let cola = '';
let conResumen = false;
const decodificador = new StringDecoder('utf8');

hijo.stdout.on('data', (trozo) => {
  ultimaEscritura = Date.now();
  process.stdout.write(trozo);
  cola = (cola + decodificador.write(trozo)).slice(-4000);
  if (!conResumen && RESUMEN.test(sinColor(cola))) conResumen = true;
});
hijo.stderr.on('data', (trozo) => {
  ultimaEscritura = Date.now();
  process.stderr.write(trozo);
});

let parado = false;
const vigia = setInterval(() => {
  const callado = Date.now() - ultimaEscritura;
  if (callado < TOPE_MS || parado) return;
  parado = true;
  const ultimo = (cola.match(/[^\n]*\S[^\n]*\n?$/) || [''])[0].trim().slice(0, 200);
  process.stderr.write(
    `\n🔴 TANDA SIN VEREDICTO (SCRUM-858): ${Math.round(callado / 1000)} s sin escribir nada `
    + `(tope ${TOPE_MIN} min, TANDA_SILENCIO_MAX_MIN).\n   Lo último que llegó: «${ultimo || '(nada)'}»\n`
    + '   La salida se retiene por orden de fichero: el que no ha terminado es el SIGUIENTE a ése.\n'
    + '   Esto NO es un verde: se para el árbol propio y se sale con 3.\n',
  );
  pararArbol();
  process.exit(3);
}, Math.min(15_000, Math.max(500, TOPE_MS / 6)));

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => { try { posix ? process.kill(-hijo.pid, senal) : hijo.kill(senal); } catch { /* ya no está */ } });
}

hijo.on('error', (e) => {
  clearInterval(vigia);
  process.stderr.write(`\n🔴 TANDA SIN VEREDICTO (SCRUM-858): no se pudo lanzar «${orden}»: ${e.message}\n`);
  process.exit(2);
});

hijo.on('close', (codigo, senal) => {
  clearInterval(vigia);
  if (parado) return;
  if (codigo === 0 && !conResumen) {
    process.stderr.write(
      '\n🔴 TANDA SIN RESUMEN (SCRUM-858): la tanda ha salido con 0, pero por la salida estándar no ha '
      + 'pasado ninguna línea de recuento (`ℹ tests N` / `# tests N`). Un cero sin recuento no es un '
      + 'veredicto. Se sale con 4.\n',
    );
    process.exitCode = 4;
    return;
  }
  // Un hijo muerto por señal no tiene código: eso tampoco es un verde.
  process.exitCode = codigo ?? 1;
  if (codigo === null) process.stderr.write(`\n🔴 la tanda terminó por la señal ${senal}.\n`);
});

/** Para SOLO el árbol del hijo. Nunca `node` a secas: hay otras sesiones en la máquina. */
function pararArbol() {
  try {
    if (posix) process.kill(-hijo.pid, 'SIGKILL');
    else spawnSync('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch { /* si ya no está, no hay nada que parar; el 3 sigue siendo la salida */ }
}
