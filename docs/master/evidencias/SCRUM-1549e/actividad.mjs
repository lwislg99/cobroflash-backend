// Actividad del equipo por hora (UTC según el reloj de la máquina, que va adelantado unos minutos):
// sesiones distintas con al menos un turno de asistente y turnos totales, por hora, en los días dados.
// Población declarada: todos los .jsonl de la raíz modificados desde el primer día pedido.
import fs from 'node:fs';
import path from 'node:path';
const [raiz, ...dias] = process.argv.slice(2);
const desde = new Date(dias[0] + 'T00:00:00Z');
const ficheros = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'subagents') andar(p); }
    else if (e.name.endsWith('.jsonl') && fs.statSync(p).mtime >= desde) ficheros.push(p);
  }
})(raiz);
const tabla = {}; // dia -> hora -> {ses:Set, turnos}
for (const f of ficheros) {
  const ses = path.basename(f, '.jsonl').slice(0, 8);
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l.includes('"type":"assistant"')) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.type !== 'assistant' || !o.timestamp) continue;
    const d = o.timestamp.slice(0, 10), h = o.timestamp.slice(11, 13);
    if (!dias.includes(d)) continue;
    const c = ((tabla[d] ??= {})[h] ??= { ses: new Set(), turnos: 0 });
    c.ses.add(ses); c.turnos++;
  }
}
console.log(`población: ${ficheros.length} jsonl (sin subagentes) modificados desde ${dias[0]}`);
console.log('hora  ' + dias.map((d) => d.slice(5).padEnd(16)).join(''));
for (let h = 6; h < 20; h++) {
  const hh = String(h).padStart(2, '0');
  console.log(hh + 'Z   ' + dias.map((d) => { const c = tabla[d]?.[hh]; return (c ? `${c.ses.size} ses ${c.turnos} t` : '-').padEnd(16); }).join(''));
}
