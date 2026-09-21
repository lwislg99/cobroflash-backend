// Barrido de los sumarios del BOE (API de datos abiertos) buscando disposiciones sobre registro de jornada.
// Uso: node barrido-boe.mjs AAAA-MM-DD AAAA-MM-DD  -> escribe JSON con poblacion, controles y hallazgos.
import fs from 'node:fs';
const [desde, hasta, salida] = process.argv.slice(2);
const dias = [];
for (let d = new Date(desde + 'T00:00:00Z'); d <= new Date(hasta + 'T00:00:00Z'); d = new Date(d.getTime() + 864e5)) dias.push(d.toISOString().slice(0, 10));

function recoger(nodo, acc) {
  if (Array.isArray(nodo)) { nodo.forEach((n) => recoger(n, acc)); return acc; }
  if (nodo && typeof nodo === 'object') {
    if (typeof nodo.titulo === 'string' && typeof nodo.identificador === 'string') acc.push({ id: nodo.identificador, titulo: nodo.titulo });
    for (const v of Object.values(nodo)) if (v && typeof v === 'object') recoger(v, acc);
  }
  return acc;
}

const RE_REGISTRO = /registro\s+(diario\s+)?(de\s+la\s+)?(jornada|horario)|control\s+horario|registro\s+de\s+jornada/i;
const RE_JORNADA = /jornada/i;
const res = { desde, hasta, dias_pedidos: dias.length, sumarios_ok: 0, sin_boe_404: 0, errores: [], items: 0, con_jornada: 0, hallazgos: [], control: null };

async function uno(dia) {
  const u = `https://www.boe.es/datosabiertos/api/boe/sumario/${dia.replace(/-/g, '')}`;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(u, { headers: { accept: 'application/json' } });
      if (r.status === 404) { res.sin_boe_404++; return; }
      if (!r.ok) { if (intento === 2) res.errores.push(`${dia} ${r.status}`); continue; }
      const j = await r.json();
      const its = recoger(j, []);
      res.sumarios_ok++;
      res.items += its.length;
      for (const it of its) {
        if (RE_JORNADA.test(it.titulo)) res.con_jornada++;
        if (RE_REGISTRO.test(it.titulo)) res.hallazgos.push({ dia, ...it });
        if (it.id === 'BOE-A-2026-8287') res.control = { dia, ...it };
      }
      return;
    } catch (e) { if (intento === 2) res.errores.push(`${dia} ${e.message}`); }
  }
}

const cola = [...dias];
await Promise.all(Array.from({ length: 4 }, async () => { while (cola.length) await uno(cola.shift()); }));
res.hallazgos.sort((a, b) => a.dia.localeCompare(b.dia));
fs.writeFileSync(salida, JSON.stringify(res, null, 2));
console.log(JSON.stringify({ ...res, hallazgos: res.hallazgos.length }, null, 1));
