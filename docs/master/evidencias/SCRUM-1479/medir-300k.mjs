// SCRUM-1479 · ¿300k cae entre «ya entregó» y «se muere»? Sólo LEE los transcritos del día.
// uso: node medir-300k.mjs <árbol> [horas=30]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arbol = process.argv[2];
const horas = Number(process.argv[3] || 30);
const G = await import(pathToFileURL(path.join(arbol, 'scripts', 'equipo', 'gasto-arranque.mjs')).href);
const dirJobs = path.join(os.homedir(), '.claude', 'jobs');
const PUSH = /\bgit\b[^\n|;&]*\bpush\b/;
const UMBRALES = [200000, 300000, 400000, 500000];

function analizar(turnos, entradas) {
  // id de mensaje → ¿lleva un `git push`?
  const conPush = new Set();
  for (const o of entradas) {
    if (!o || o.type !== 'assistant' || !o.message || !Array.isArray(o.message.content)) continue;
    for (const b of o.message.content) {
      if (b && b.type === 'tool_use' && b.input && typeof b.input.command === 'string' && PUSH.test(b.input.command)) {
        conPush.add(o.message.id || o.uuid);
      }
    }
  }
  const us = turnos.map((t) => t.U);
  const pushes = turnos.map((t, i) => (conPush.has(t.id) ? i : -1)).filter((i) => i >= 0);
  let compactaciones = 0;
  for (let i = 1; i < us.length; i++) if (us[i] < us[i - 1] * 0.6 && us[i - 1] > 150000) compactaciones++;
  const porUmbral = {};
  for (const x of UMBRALES) {
    const cruce = us.findIndex((u) => u > x);
    if (cruce === -1) { porUmbral[x] = { cruza: false }; continue; }
    const antes = pushes.filter((i) => i < cruce).length;
    const despues = pushes.find((i) => i >= cruce);
    porUmbral[x] = {
      cruza: true, turnoDeCruce: cruce + 1, pushesAntes: antes,
      ctxEnPrimerPushDespues: despues === undefined ? null : us[despues],
      turnosHastaEsePush: despues === undefined ? null : despues - cruce,
    };
  }
  return {
    N: us.length, fin: us[us.length - 1], max: Math.max(...us), compactaciones,
    nPushes: pushes.length, ctxPrimerPush: pushes.length ? us[pushes[0]] : null,
    ultimoMs: Date.parse(turnos[turnos.length - 1].ts || ''), porUmbral,
  };
}

const cen = G.censarSesiones({ dirJobs, ahoraMs: Date.now(), horas, minTurnos: 1, analizar });
if (!cen.ok) { console.log(`NO PUDE MIRAR: ${cen.motivo}`); process.exit(2); }
const estadoDe = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dirJobs, dir, 'state.json'), 'utf8').replace(/^﻿/, '')).state; } catch { return '?'; } };
const todas = cen.sesiones.map((s) => ({ nombre: s.nombre, estado: estadoDe(s.dir), ...s.datos }));
const equipo = todas.filter((s) => /^(s\d|orq|j\d)/i.test(s.nombre));
const k = (n) => (n === null || n === undefined ? '   —' : `${Math.round(n / 1000)}k`.padStart(4));
const med = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const ahora = Date.now();

console.log(`POBLACIÓN · ${cen.pob.states} state.json · ${cen.pob.activas} con actividad en ${horas} h · ${todas.length} con turnos · ${equipo.length} con nombre de puesto · líneas rotas ${cen.rotas} · jsonl ilegibles ${cen.pob.jsonlIlegibles}`);
console.log('nombre         estado   turnos  fin   max  comp pushes 1erPush | cruza300→ turno · pushes antes · ctx en el 1er push después (turnos)');
for (const s of equipo.sort((a, b) => b.max - a.max)) {
  const c = s.porUmbral[300000];
  const parada = Math.round((ahora - s.ultimoMs) / 60000);
  console.log(`${s.nombre.padEnd(14)} ${String(s.estado).padEnd(8)} ${String(s.N).padStart(5)} ${k(s.fin)} ${k(s.max)} ${String(s.compactaciones).padStart(4)} ${String(s.nPushes).padStart(5)}  ${k(s.ctxPrimerPush)}  | `
    + (c.cruza ? `t${c.turnoDeCruce} · ${c.pushesAntes} · ${c.ctxEnPrimerPushDespues === null ? `NINGUNO (acabó en ${k(s.fin).trim()}, parada ${parada} min)` : `${k(c.ctxEnPrimerPushDespues).trim()} (+${c.turnosHastaEsePush})`}` : 'no'));
}

console.log('\n── LA PREGUNTA, por umbral (sesiones con nombre de puesto) ──');
const conPush = equipo.filter((s) => s.nPushes > 0);
console.log(`sesiones: ${equipo.length} · con algún push: ${conPush.length} · sin ninguno: ${equipo.length - conPush.length}`);
console.log(`contexto en el PRIMER push: mediana ${k(med(conPush.map((s) => s.ctxPrimerPush)))} · mín ${k(Math.min(...conPush.map((s) => s.ctxPrimerPush)))} · máx ${k(Math.max(...conPush.map((s) => s.ctxPrimerPush)))}`);
console.log(`contexto FINAL (último turno): mediana ${k(med(equipo.map((s) => s.fin)))} · MÁXIMO del día por sesión: mediana ${k(med(equipo.map((s) => s.max)))}`);
for (const x of UMBRALES) {
  const cr = equipo.filter((s) => s.porUmbral[x].cruza);
  const sinEntregaAntes = cr.filter((s) => s.porUmbral[x].pushesAntes === 0);
  const conPushDespues = cr.filter((s) => s.porUmbral[x].ctxEnPrimerPushDespues !== null);
  const quietas = cr.filter((s) => s.porUmbral[x].ctxEnPrimerPushDespues === null && ahora - s.ultimoMs > 60 * 60000);
  console.log(`${x / 1000}k · lo cruzan ${cr.length} de ${equipo.length} · de ellas SIN ningún push antes de cruzarlo: ${sinEntregaAntes.length} · con un push DESPUÉS (ahí saltaría el relevo): ${conPushDespues.length}, a mediana ${k(med(conPushDespues.map((s) => s.porUmbral[x].ctxEnPrimerPushDespues)))} y máx ${k(Math.max(0, ...conPushDespues.map((s) => s.porUmbral[x].ctxEnPrimerPushDespues)))} · lo cruzaron y se pararon (>60 min) SIN otro push: ${quietas.length}`);
}
console.log('\n── FINALES de las sesiones PARADAS más de 60 min (dónde acaban, en tramos de contexto) ──');
const paradas = equipo.filter((s) => ahora - s.ultimoMs > 60 * 60000);
const tramos = [[0, 200], [200, 300], [300, 400], [400, 500], [500, 800], [800, 2000]];
for (const [a, b] of tramos) console.log(`  ${String(a).padStart(3)}–${String(b).padEnd(4)}k: ${paradas.filter((s) => s.fin >= a * 1000 && s.fin < b * 1000).length}`);
console.log(`  (paradas: ${paradas.length} de ${equipo.length} · con alguna compactación en el día: ${equipo.filter((s) => s.compactaciones > 0).length})`);
