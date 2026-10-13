// Coteja cada cita de las ancladas contra lo que devolvio Jira (fichero de la busqueda JQL).
import fs from 'node:fs';
const [, , fJira, fAnc] = process.argv;
const bytes = fs.statSync(fJira).size;
const j = JSON.parse(fs.readFileSync(fJira, 'utf8'));
const nodos = j.issues.nodes;
const T = new Map();
for (const n of nodos) {
  const c = n.fields.comment || {};
  T.set(n.key, { resumen: n.fields.summary, total: c.total, ids: new Map((c.comments || []).map((x) => [String(x.id), x])) });
}
console.log(`fichero Jira: ${bytes} B · tickets devueltos: ${nodos.length} · hasNextPage=${j.issues.pageInfo && j.issues.pageInfo.hasNextPage}`);
for (const [k, t] of T) console.log(`  ${k} · comentarios devueltos ${t.ids.size} de total ${t.total}${t.ids.size !== t.total ? '  <-- INCOMPLETO' : ''}`);

const estado = (ticket, id) => {
  const t = T.get(ticket);
  if (!t) return 'TICKET-NO-DEVUELTO';
  if (t.ids.has(String(id))) return 'EXISTE';
  if (t.ids.size !== t.total) return 'NO-SE-PUEDE-SABER (comentarios incompletos)';
  return 'TICKET-SI · COMENTARIO-NO';
};
const dondeVive = (id) => [...T].filter(([, t]) => t.ids.has(String(id))).map(([k]) => k);

const anc = JSON.parse(fs.readFileSync(fAnc, 'utf8'));
console.log(`\nANCLADAS segun porNivel(): ${anc.porNivel.anclado} · listadas: ${anc.ancladas.length}`);
let citas = 0; const pares = new Set(); const malas = [];
for (const a of anc.ancladas) {
  console.log(`\n${a.donde}`);
  for (const c of a.citas) {
    citas += 1; pares.add(`${c.ticket}/${c.comentario}`);
    const e = estado(c.ticket, c.comentario);
    if (e !== 'EXISTE') malas.push(`${a.donde} ${c.ticket}/${c.comentario} ${e}`);
    const x = T.get(c.ticket)?.ids.get(c.comentario);
    console.log(`   [estricta] ${c.ticket} / ${c.comentario} -> ${e}${x ? ` · ${x.created} · ${String(typeof x.body === 'string' ? x.body : JSON.stringify(x.body)).length} ch` : ''}`);
  }
  const vistas = new Set(a.citas.map((c) => c.comentario));
  for (const id of a.idsSondaAncha.filter((i) => !vistas.has(i))) {
    console.log(`   [solo sonda ancha] comentario ${id} -> vive en: ${dondeVive(id).join(',') || 'NINGUNO de los tickets bajados'}`);
  }
}
console.log(`\ncitas estrictas: ${citas} · pares distintos: ${pares.size} · NO existentes: ${malas.length}`);
for (const m of malas) console.log('   🔴 ' + m);

console.log('\nCONTROLES');
console.log('  positivo (SCRUM-1511 / 18924, leido por mi en el ticket):', estado('SCRUM-1511', '18924'));
console.log('  positivo (SCRUM-1511 / 18903):', estado('SCRUM-1511', '18903'));
console.log('  cruzado: comentario real en ticket AJENO (SCRUM-1252 / 18924):', estado('SCRUM-1252', '18924'));
console.log('  cruzado: (SCRUM-915 / 17726, que es de 1252):', estado('SCRUM-915', '17726'));
const maxId = Math.max(...[...T.values()].flatMap((t) => [...t.ids.keys()].map(Number)));
console.log(`  cero: id derivado = mayor id bajado (${maxId}) + 100000 en SCRUM-1511:`, estado('SCRUM-1511', String(maxId + 100000)));
for (const k of process.argv.slice(4)) console.log(`  ticket no pedido (${k}):`, estado(k, '1'));
