const t = require('fs').readFileSync(process.argv[2], 'utf8');
const i = t.indexOf('{\n "etiqueta"');
if (i < 0) { console.log('CIEGO: sin JSON'); process.exit(2); }
const j = JSON.parse(t.slice(i));
console.log(j.etiqueta, 'exclusion1536d=' + j.exclusion1536d, 'pasos=' + j.pasos.length);
for (const p of j.pasos) {
  console.log([p.paso, p.status ?? '', p.creado ?? '', p.error ?? '', p.country ?? '',
    p['getEmissionMode · flag=false'] ?? '', (p.cuerpo || '').slice(0, 100)].join(' | '));
}
