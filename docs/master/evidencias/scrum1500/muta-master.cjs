const fs = require('fs');
const [, , origen, destino] = process.argv;
let t = fs.readFileSync(origen, 'utf8');
const a1 = '`borrador → emitido → firmado`. borrador/emitido = editable';
const a2 = '**QuoteRequest:** `new → seen → converted(quoteId) | discarded(reason)`.';
if (!t.includes(a1) || !t.includes(a2)) { console.log('LA MUTACION NO CASA'); process.exit(1); }
t = t.replace(a1, '`borrador → emitido`. borrador/emitido = editable').replace(a2, '**QuoteRequest:** `pending → read → done`.');
fs.writeFileSync(destino, t);
console.log('mutado: bytes ' + fs.statSync(origen).size + ' -> ' + fs.statSync(destino).size);
