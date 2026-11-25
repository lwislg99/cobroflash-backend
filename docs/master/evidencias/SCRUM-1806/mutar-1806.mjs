// SCRUM-1806 · driver de una vez: dos mutaciones de `tipoDestinatarioPendiente.js:58` contra
// `tests/scrum615-pedir-tipo-destinatario.test.mjs`, con `correr` + `aplicarUna` del meta-guard.
// Uso: node docs/master/evidencias/SCRUM-1806/mutar-1806.mjs <raiz-del-worktree>
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [raiz] = process.argv.slice(2);
const mg = await import(pathToFileURL(path.join(raiz, 'scripts', 'meta-guard-mutaciones.mjs')).href);
const GUARD = 'scrum615-pedir-tipo-destinatario.test.mjs';
const FICHERO = 'public/dashboard/js/tipoDestinatarioPendiente.js';
const DE = "  var ETIQUETA = '¿Factura como empresa o autónomo (IVA)?';\n";
const MUTACIONES = [
  { fichero: FICHERO, de: DE, a: "  var ETIQUETA = 'Tipo de cliente';\n", cae: 'los cuatro textos del campo son los que YA existen, letra a letra' },
  { fichero: FICHERO, de: DE, a: "  var ETIQUETA = '¿Factura como empresa o autónomo?';\n", cae: 'los cuatro textos del campo son los que YA existen, letra a letra' },
];
const limpia = await mg.correr(GUARD);
console.log(`base limpia: ${limpia.pasados.length} pasados, ${limpia.caidos.length} caídos, ${limpia.saltados.length} saltados`);
let caen = 0;
for (const mut of MUTACIONES) {
  const r = await mg.aplicarUna(mut, GUARD, limpia);
  console.log(`${r.ok ? 'CAE ' : 'NO CAE'} · ${JSON.stringify(mut.a.trim())}${r.ok ? '' : ` · ${r.mudo || r.ciego || r.muerto}`}`);
  if (r.ok) caen += 1;
}
console.log(`RESULTADO: ${caen} de ${MUTACIONES.length} caen`);
process.exit(caen === MUTACIONES.length ? 0 : 1);
