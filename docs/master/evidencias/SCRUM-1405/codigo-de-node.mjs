// docs/master/evidencias/SCRUM-1405/codigo-de-node.mjs — SCRUM-1405
//
// Imprime, del node QUE ESTÁ CORRIENDO (no de la documentación ni de otra versión), los dos trozos
// de su código que la hipótesis de SCRUM-1405 nombra:
//   ① la rama de `forceExit` del corredor de tests: qué espera antes de `process.exit()`;
//   ② dónde pone bloqueante la tubería de la salida estándar, y en qué plataforma.
// Se lanza con `node --no-deprecation` (lee los fuentes internos con process.binding('natives')).
const fuentes = process.binding('natives');

function trozo(modulo, ancla, antes, despues) {
  const texto = fuentes[modulo];
  if (!texto) return [`🔴 este node no trae el módulo ${modulo}`];
  const lineas = texto.split('\n');
  const i = lineas.findIndex((l) => l.includes(ancla));
  if (i === -1) return [`🔴 ${modulo}: no encuentro «${ancla}» (${lineas.length} líneas leídas) — el código ha cambiado`];
  return lineas.slice(Math.max(0, i - antes), i + despues + 1).map((l, k) => `${String(Math.max(0, i - antes) + k + 1).padStart(5)}  ${l}`);
}

console.log(`node ${process.version} · ${process.platform} · ${process.arch}`);
console.log('\n① lib/internal/test_runner/test.js — la rama de forceExit');
console.log(trozo('internal/test_runner/test', '} else if (this.config.forceExit) {', 0, 25).join('\n'));
console.log('\n② lib/net.js — la tubería de stdout/stderr sólo es bloqueante en Windows');
console.log(trozo('net', 'Make stdout and stderr blocking on Windows', 2, 7).join('\n'));
console.log('\n③ lib/internal/test_runner/runner.js — el flag se le pasa a cada hijo');
console.log(trozo('internal/test_runner/runner', "ArrayPrototypePush(runArgs, '--test-force-exit')", 1, 1).join('\n'));
