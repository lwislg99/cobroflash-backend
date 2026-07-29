const fs = require('fs');
const path = require('path');
let libxmljs;
try { libxmljs = require('libxmljs2'); }
catch (e) { console.log('EL BINDING NATIVO NO CARGA: ' + String(e).split('\n')[0]); process.exit(2); }
console.log('binding nativo cargado OK');

const dir = path.resolve('xsd-local');
const xsd = libxmljs.parseXml(fs.readFileSync(path.join(dir, 'SuministroLR.xsd'), 'utf8'),
  { baseUrl: dir + path.sep });

for (const f of ['valido.xml', 'invalido.xml']) {
  const doc = libxmljs.parseXml(fs.readFileSync(f, 'utf8'));
  const ok = doc.validate(xsd);
  console.log('--- ' + f + ' ---');
  console.log('  valid: ' + ok);
  for (const e of (doc.validationErrors || [])) console.log('  ' + String(e.message).trim());
  console.log('');
}
