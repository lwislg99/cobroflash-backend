// Ejecuta la función PURA de invoicesView.js (sin DOM): qué texto sale con escritura OK, recarga fallida y 0 marcadas.
const path = require('node:path');
const m = require(path.join(process.argv[2], 'public/dashboard/js/invoicesView.js'));
const casos = [
  { escrituraOk: true, recargaOk: false, marcadas: 0 },
  { escrituraOk: true, recargaOk: false, marcadas: 3 },
  { escrituraOk: true, recargaOk: true, marcadas: 0 },
];
for (const c of casos) console.log(JSON.stringify(c), '->', JSON.stringify(m.resultadoMarcadoEnBloque(c)));
