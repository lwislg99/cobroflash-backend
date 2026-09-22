// ¿En qué se van los tokens? Se lee del `usage` de los transcripts de Claude Code, no se estima.
//
//   node scripts/medir-tokens.mjs --desde 2026-09-13T12:49:04Z --hasta 2026-09-16T12:49:05Z
//
// Sin `--hasta` mide hasta ahora, y entonces el número se mueve con cada turno: para citar una
// cifra se da la VENTANA FIJA con la que salió (A19 de docs/equipo/00-normas-comunes.md).
// `--raiz` cambia la carpeta de transcripts (por defecto ~/.claude/projects, todos los proyectos).
//
// ── LO QUE SE CUENTA ─────────────────────────────────────────────────────────────────────────
// Cada respuesta trae `message.usage` con cuatro cifras: entrada sin caché, caché creada, caché
// leída y salida. UNA respuesta ocupa VARIAS líneas del .jsonl cuando lleva texto y herramientas,
// y todas repiten el mismo `usage`: se DEDUPLICA por `message.id` o el total sale multiplicado.
// La salida declara cuántas repeticiones descartó, que es la población de ese filtro.
//
// ── ARRASTRE Y ARRANQUE ──────────────────────────────────────────────────────────────────────
// · arrastre = caché LEÍDA: la conversación entera que cada turno vuelve a mandar.
// · turno de caché fría = el que ESCRIBE más de 200k de caché de golpe: arrancar o reanudar una
//   conversación grande con la caché caducada, que reescribe el contexto entero. El umbral es una
//   tolerancia y se declara: con «crea más de lo que lee» salen 46 turnos y el 82,7 % en la misma
//   ventana del 16-sep, frente a 39 y 80,7 % con 200k. La conclusión no cambia; la cifra, sí.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

function argumento(nombre) {
  const i = process.argv.indexOf('--' + nombre);
  return i === -1 ? undefined : process.argv[i + 1];
}
const raiz = argumento('raiz') || path.join(os.homedir(), '.claude', 'projects');
const desde = argumento('desde') ? Date.parse(argumento('desde')) : 0;
const hasta = argumento('hasta') ? Date.parse(argumento('hasta')) : Date.now();
if (Number.isNaN(desde) || Number.isNaN(hasta)) {
  console.error('fecha ilegible: --desde/--hasta van en ISO, p. ej. 2026-09-13T12:49:00Z');
  process.exit(2);
}

async function turnosDe(fichero) {
  const vistos = new Set();
  const turnos = [];
  let repetidos = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(fichero), crlfDelay: Infinity });
  for await (const linea of rl) {
    let e;
    try { e = JSON.parse(linea); } catch { continue; }
    const u = e.type === 'assistant' && e.message && e.message.usage;
    if (!u) continue;
    const id = e.message.id || e.requestId || e.uuid;
    if (vistos.has(id)) { repetidos++; continue; }
    vistos.add(id);
    const ts = Date.parse(e.timestamp);
    if (!(ts >= desde && ts < hasta)) continue;
    turnos.push({
      ts,
      entrada: u.input_tokens || 0,
      creada: u.cache_creation_input_tokens || 0,
      leida: u.cache_read_input_tokens || 0,
      salida: u.output_tokens || 0,
    });
  }
  return { turnos, repetidos };
}

const ficheros = [];
for (const proyecto of fs.readdirSync(raiz)) {
  const dir = path.join(raiz, proyecto);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.jsonl')) ficheros.push(path.join(dir, f));
}

const turnos = [];
let repetidos = 0;
let repetidosDentro = 0;
let conversaciones = 0;
for (const f of ficheros) {
  const r = await turnosDe(f);
  repetidos += r.repetidos;
  if (r.turnos.length) { conversaciones++; repetidosDentro += r.repetidos; }
  turnos.push(...r.turnos);
}

const sumar = (lista, campo) => lista.reduce((n, t) => n + t[campo], 0);
const entrada = sumar(turnos, 'entrada');
const creada = sumar(turnos, 'creada');
const leida = sumar(turnos, 'leida');
const salida = sumar(turnos, 'salida');
const total = entrada + creada + leida + salida;
const M = (n) => (n / 1e6).toFixed(2) + 'M';
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '—') + ' %';

console.log('ventana ' + new Date(desde).toISOString() + ' → ' + new Date(hasta).toISOString());
console.log('población: ' + ficheros.length + ' transcripts leídos · ' + conversaciones + ' con turnos en la ventana · '
  + turnos.length + ' turnos · ' + repetidosDentro + ' repeticiones de message.id descartadas en esas conversaciones ('
  + repetidos + ' en todas)');
if (!turnos.length) {
  console.log('CERO turnos: no es «no se gasta», es «no he visto nada» — revisa --raiz y la ventana');
  process.exit(1);
}
const extremos = turnos.map((t) => t.ts).sort((a, b) => a - b);
console.log('primer turno ' + new Date(extremos[0]).toISOString() + ' · último ' + new Date(extremos.at(-1)).toISOString()
  + ' (la ventana es la que pides; lo medido es lo que cae dentro)');
console.log('');
console.log('total ' + M(total));
console.log('  caché LEÍDA (arrastre) .. ' + M(leida) + ' · ' + pct(leida, total));
console.log('  caché creada ............ ' + M(creada) + ' · ' + pct(creada, total));
console.log('  salida .................. ' + M(salida) + ' · ' + pct(salida, total));
console.log('  entrada sin caché ....... ' + M(entrada) + ' · ' + pct(entrada, total));

console.log('');
console.log('arrastre por tamaño del contexto (caché leída del turno):');
for (const [a, b] of [[0, 100e3], [100e3, 300e3], [300e3, 600e3], [600e3, 900e3], [900e3, Infinity]]) {
  const tramo = turnos.filter((t) => t.leida >= a && t.leida < b);
  const l = sumar(tramo, 'leida');
  console.log('  ' + (a / 1e3 + 'k–' + (b === Infinity ? '…' : b / 1e3 + 'k')).padEnd(11)
    + String(tramo.length).padStart(5) + ' turnos · ' + M(l) + ' · ' + pct(l, leida) + ' del arrastre');
}

const frios = turnos.filter((t) => t.creada > 200e3);
const creadaFria = sumar(frios, 'creada');
console.log('');
console.log('turnos de caché fría (escriben >200k de caché): ' + frios.length + ' de ' + turnos.length
  + ' (' + pct(frios.length, turnos.length) + ') · escriben ' + M(creadaFria) + ' = ' + pct(creadaFria, creada)
  + ' de la caché creada · ' + (frios.length ? Math.round(creadaFria / frios.length / 1e3) + 'k cada uno' : '—'));
