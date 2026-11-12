// docs/master/evidencias/SCRUM-1566/d2-cuantos-shim.cjs — SCRUM-1566 tramo (e), J1, 30-oct-2026
// `d-cuantos-cambian.cjs` (S1) compara contra `totalCanonico`, la variante 1 de D. Este shim hace que
// compare contra la variante 2 sin tocar el fichero de S1. Se carga con --require DESPUÉS de sonda-e.cjs.
const path = require('node:path');
const s = require(path.join(__dirname, 'sonda-d.cjs'));
s.totalCanonico = s.totalDeLoQueSeFactura;
