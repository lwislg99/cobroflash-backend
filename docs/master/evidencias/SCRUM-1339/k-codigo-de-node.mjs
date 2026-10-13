// docs/master/evidencias/SCRUM-1339/k-codigo-de-node.mjs — SCRUM-1339k · ¿DE DÓNDE SALE 65.536?
//
// Imprime, del node QUE ESTÁ CORRIENDO (no de la documentación), los trozos de su código por los
// que pasa el informe del hijo antes de `process.exit()`, y el valor EJECUTADO de la marca de agua.
// Misma técnica que `evidencias/SCRUM-1405/codigo-de-node.mjs`.
//
//   node --no-deprecation k-codigo-de-node.mjs
//
// Cada ancla que no se encuentra sale en rojo: un trozo que no aparece no se lee como «no está».
import stream from 'node:stream';

const fuentes = process.binding('natives');
let rojos = 0;
function trozo(modulo, ancla, antes, despues) {
  const texto = fuentes[modulo];
  if (!texto) { rojos += 1; return [`🔴 este node no trae el módulo ${modulo}`]; }
  const lineas = texto.split('\n');
  const i = lineas.findIndex((l) => l.includes(ancla));
  if (i === -1) { rojos += 1; return [`🔴 ${modulo}: no encuentro «${ancla}» (${lineas.length} líneas leídas)`]; }
  return lineas.slice(Math.max(0, i - antes), i + despues + 1).map((l, k) => `${String(Math.max(0, i - antes) + k + 1).padStart(5)}  ${l}`);
}

console.log(`node ${process.version} · ${process.platform} · ${process.arch} · módulos internos legibles: ${Object.keys(fuentes).length}`);

console.log('\n① EJECUTADO: la marca de agua por defecto de un flujo de bytes');
console.log(`   stream.getDefaultHighWaterMark(false) = ${stream.getDefaultHighWaterMark(false)}`);
console.log(`   process.stdout.writableHighWaterMark  = ${process.stdout.writableHighWaterMark} · tipo de la salida de ESTE proceso: ${process.stdout._type}`);
console.log('   y en el código (lib/internal/streams/state.js):');
console.log(trozo('internal/streams/state', 'let defaultHighWaterMarkBytes', 2, 2).join('\n'));

console.log('\n② lib/internal/test_runner/test.js — qué espera la rama de forceExit antes de process.exit()');
console.log(trozo('internal/test_runner/test', '} else if (this.config.forceExit) {', 0, 24).join('\n'));

console.log('\n③ lib/internal/streams/readable.js — `pipe`: si el destino devuelve false, la fuente se para');
console.log(trozo('internal/streams/readable', 'const ret = dest.write(chunk);', 3, 12).join('\n'));

console.log('\n④ lib/internal/streams/writable.js — cuándo `write` devuelve false');
console.log(trozo('internal/streams/writable', 'const ret = state.length < state.highWaterMark', 2, 6).join('\n'));

console.log('\n⑤ lib/net.js — la salida estándar sólo se pone bloqueante en Windows');
console.log(trozo('net', 'Make stdout and stderr blocking on Windows', 2, 7).join('\n'));

console.log('\n⑥ lib/internal/test_runner/reporter/v8-serializer.js — un mensaje por evento');
console.log(trozo('internal/test_runner/reporter/v8-serializer', 'yield serializedMessage', 12, 2).join('\n'));

console.log(`\nANCLAS NO ENCONTRADAS: ${rojos}`);
console.log(`EXIT=${rojos ? 3 : 0}`);
process.exit(rojos ? 3 : 0);
