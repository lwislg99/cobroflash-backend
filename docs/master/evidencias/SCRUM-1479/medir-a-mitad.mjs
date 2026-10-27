// SCRUM-1479 · el SEGUNDO número de la A19 («se releva YA, aunque sea a mitad de una entrega»). Sólo LEE.
// Pregunta: con la norma de 300k «al entregar» ya puesta, ¿hasta dónde sube una sesión ENTRE que cruza 300k y
// su siguiente push (que es donde se relevaría)? Ese pico es lo que corta el número de «a mitad».
// «Entrega» = un `git push` (sustituto: un push no es una entrega verificada).
// uso: node medir-a-mitad.mjs <árbol> [horas=30]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arbol = process.argv[2];
const horas = Number(process.argv[3] || 30);
const G = await import(pathToFileURL(path.join(arbol, 'scripts', 'equipo', 'gasto-arranque.mjs')).href);
const S = await import(pathToFileURL(path.join(arbol, 'scripts', 'equipo', 'sesion.mjs')).href);
const dirJobs = path.join(os.homedir(), '.claude', 'jobs');
const PUSH = /\bgit\b[^\n|;&]*\bpush\b/;
const AL_ENTREGAR = S.UMBRAL_CONTEXTO;
const CANDIDATOS = [350, 400, 425, 450, 475, 500, 550, 600].map((x) => x * 1000);

function analizar(turnos, entradas) {
  const conPush = new Set();
  for (const o of entradas) {
    if (!o || o.type !== 'assistant' || !o.message || !Array.isArray(o.message.content)) continue;
    for (const b of o.message.content) {
      if (b && b.type === 'tool_use' && b.input && typeof b.input.command === 'string' && PUSH.test(b.input.command)) conPush.add(o.message.id || o.uuid);
    }
  }
  const us = turnos.map((t) => t.U);
  const pushes = turnos.map((t, i) => (conPush.has(t.id) ? i : -1)).filter((i) => i >= 0);
  let compactaciones = 0;
  for (let i = 1; i < us.length; i++) if (us[i] < us[i - 1] * 0.6 && us[i - 1] > 150000) compactaciones++;
  const cruce = us.findIndex((u) => u > AL_ENTREGAR);
  let tramo = null;
  if (cruce !== -1) {
    const p = pushes.find((i) => i >= cruce);
    const hasta = p === undefined ? us.length - 1 : p;
    const trozo = us.slice(cruce, hasta + 1);
    tramo = { entrego: p !== undefined, ctxAlEntregar: p === undefined ? null : us[p], pico: Math.max(...trozo), turnos: trozo.length, us: trozo };
  }
  // Crecimiento entre un push y el siguiente (todos los pares, a cualquier tamaño).
  const saltos = [];
  for (let i = 1; i < pushes.length; i++) if (us[pushes[i]] > us[pushes[i - 1]]) saltos.push(us[pushes[i]] - us[pushes[i - 1]]);
  return { N: us.length, fin: us[us.length - 1], max: Math.max(...us), compactaciones, nPushes: pushes.length, tramo, saltos, ultimoMs: Date.parse(turnos[turnos.length - 1].ts || '') };
}

const cen = G.censarSesiones({ dirJobs, ahoraMs: Date.now(), horas, minTurnos: 1, analizar });
if (!cen.ok) { console.log(`NO PUDE MIRAR: ${cen.motivo}`); process.exit(2); }
const estadoDe = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dirJobs, dir, 'state.json'), 'utf8').replace(new RegExp(String.fromCharCode(94, 65279)), '')).state; } catch { return '?'; } };
const todas = cen.sesiones.map((s) => ({ nombre: s.nombre, estado: estadoDe(s.dir), ...s.datos }));
const equipo = todas.filter((s) => /^(s\d|orq|j\d)/i.test(s.nombre));
const k = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${Math.round(n / 1000)}k`);
const cuantil = (a, q) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * (b.length - 1) + 0.5))] : null; };
const ahora = Date.now();

console.log(`POBLACIÓN · ${cen.pob.states} state.json · ${cen.pob.activas} con actividad en ${horas} h · ${todas.length} con turnos · ${equipo.length} con nombre de puesto · líneas rotas ${cen.rotas} · jsonl ilegibles ${cen.pob.jsonlIlegibles} · umbral «al entregar» leído del código: ${k(AL_ENTREGAR)}`);
const cruzan = equipo.filter((s) => s.tramo);
const entregan = cruzan.filter((s) => s.tramo.entrego);
const noEntregan = cruzan.filter((s) => !s.tramo.entrego);
console.log(`\n── 1 · EL TRAMO «a mitad»: desde que cruza ${k(AL_ENTREGAR)} hasta su siguiente push (ahí la releva la norma de «al entregar») ──`);
console.log(`cruzan ${k(AL_ENTREGAR)}: ${cruzan.length} de ${equipo.length} · llegan a otro push: ${entregan.length} · no vuelven a empujar: ${noEntregan.length}`);
console.log('nombre         estado   pico-del-tramo  entregó-a  turnos  fin   max  comp');
for (const s of cruzan.sort((a, b) => b.tramo.pico - a.tramo.pico)) {
  console.log(`${s.nombre.padEnd(14)} ${String(s.estado).padEnd(8)} ${k(s.tramo.pico).padStart(8)}       ${(s.tramo.entrego ? k(s.tramo.ctxAlEntregar) : 'NO').padStart(6)}   ${String(s.tramo.turnos).padStart(5)}  ${k(s.fin).padStart(4)} ${k(s.max).padStart(5)}  ${s.compactaciones}`);
}
console.log(`pico del tramo, las que SÍ entregaron: mediana ${k(cuantil(entregan.map((s) => s.tramo.pico), 0.5))} · p90 ${k(cuantil(entregan.map((s) => s.tramo.pico), 0.9))} · máx ${k(Math.max(...entregan.map((s) => s.tramo.pico)))}`);
console.log(`pico del tramo, las que NO volvieron a empujar: mediana ${k(cuantil(noEntregan.map((s) => s.tramo.pico), 0.5))} · máx ${k(Math.max(0, ...noEntregan.map((s) => s.tramo.pico)))} · estados: ${Object.entries(noEntregan.reduce((a, s) => ({ ...a, [s.estado]: (a[s.estado] || 0) + 1 }), {})).map(([e, n]) => `${n} ${e}`).join(', ')}`);

console.log('\n── 2 · QUÉ HARÍA CADA NÚMERO de «a mitad» sobre esas sesiones ──');
console.log('número  cortaría  …que SÍ iban a entregar (entrega perdida a mitad)  …que NO volvieron a empujar (arrastre ahorrado)  Σ contexto por encima, en el tramo');
for (const x of CANDIDATOS) {
  const corta = cruzan.filter((s) => s.tramo.pico > x);
  const si = corta.filter((s) => s.tramo.entrego); const no = corta.filter((s) => !s.tramo.entrego);
  // Lo que se deja de arrastrar: los turnos del tramo DESPUÉS del primero que pasa de x.
  const suma = corta.reduce((a, s) => { const i = s.tramo.us.findIndex((u) => u > x); return a + s.tramo.us.slice(i + 1).reduce((p, u) => p + u, 0); }, 0);
  const leFaltaba = si.map((s) => { const i = s.tramo.us.findIndex((u) => u > x); return s.tramo.us.length - 1 - i; });
  console.log(`${k(x).padStart(5)}   ${String(corta.length).padStart(4)}      ${String(si.length).padStart(3)}${si.length ? ` (les faltaban ${leFaltaba.sort((a, b) => a - b).join(', ')} turnos; entregaron a ${si.map((s) => k(s.tramo.ctxAlEntregar)).join(', ')})` : ''}   ·   ${no.length}${no.length ? ` (${no.map((s) => `${s.nombre} ${k(s.fin)} ${s.estado}`).join(', ')})` : ''}   ·   ${(suma / 1e6).toFixed(1)} M`);
}

console.log('\n── 3 · ¿HAY UN TECHO donde las sesiones «mueren»? Último turno de las PARADAS más de 60 min, por estado ──');
const paradas = equipo.filter((s) => ahora - s.ultimoMs > 60 * 60000);
const tramos = [[0, 200], [200, 300], [300, 350], [350, 400], [400, 450], [450, 500], [500, 800], [800, 2000]];
const estados = [...new Set(paradas.map((s) => s.estado))].sort();
console.log(`tramo       ${estados.map((e) => e.padStart(8)).join(' ')}   total`);
for (const [a, b] of tramos) {
  const en = paradas.filter((s) => s.fin >= a * 1000 && s.fin < b * 1000);
  console.log(`${`${a}–${b}k`.padEnd(11)} ${estados.map((e) => String(en.filter((s) => s.estado === e).length).padStart(8)).join(' ')}   ${String(en.length).padStart(5)}`);
}
console.log(`paradas: ${paradas.length} de ${equipo.length} · con alguna compactación: ${equipo.filter((s) => s.compactaciones > 0).length}`);
const sobre400 = equipo.filter((s) => s.max > 400000);
console.log(`pasaron de 400k: ${sobre400.length} · de ellas siguieron y pasaron de 450k: ${sobre400.filter((s) => s.max > 450000).length} · de 500k: ${sobre400.filter((s) => s.max > 500000).length}`);
console.log(`las que acabaron entre 380k y 425k: ${paradas.filter((s) => s.fin >= 380000 && s.fin <= 425000).map((s) => `${s.nombre} ${k(s.fin)} ${s.estado} (${s.nPushes} push)`).join(' · ') || 'ninguna'}`);

console.log('\n── 4 · CUÁNTO CRECE una sesión entre un push y el siguiente (todos los pares) ──');
const saltos = equipo.flatMap((s) => s.saltos);
console.log(`${saltos.length} pares · mediana ${k(cuantil(saltos, 0.5))} · p90 ${k(cuantil(saltos, 0.9))} · máx ${k(Math.max(0, ...saltos))} → una que entrega justo bajo ${k(AL_ENTREGAR)} y hace UNA entrega más acaba hacia ${k(AL_ENTREGAR + (cuantil(saltos, 0.5) || 0))} (mediana) · ${k(AL_ENTREGAR + (cuantil(saltos, 0.9) || 0))} (p90) · ${k(AL_ENTREGAR + Math.max(0, ...saltos))} (máx)`);
console.log('EXIT=0');
