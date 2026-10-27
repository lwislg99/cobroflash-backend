// ¿La frase de un jefe es un turno escrito por una PERSONA en el chat de su orquestador? Sólo lectura.
//
// En Jira el jefe y su orquestador firman con la misma cuenta, así que una cita en un comentario no
// distingue quién la escribió. La transcripción sí: cada turno `user` lleva `origin.kind`, y vale
// "human" sólo en lo que tecleó una persona (un resultado de herramienta o un mensaje de otra
// sesión no lo llevan).
//
// Uso: node firma-en-origen.mjs <prefijo del jsonl del orquestador> <trozo> [<trozo> …]
//   Imprime ENTERO cada turno humano que contenga alguno de los trozos (sin distinguir mayúsculas),
//   con su línea y su hora. La hora es la del reloj de la máquina, que puede ir adelantado.
//   Lee `~/.claude/projects` de la máquina donde corre: en otra máquina no encuentra nada, y lo dice
//   con su población (0 jsonl).
// Salida: 0 = encontró algún turno humano con un trozo · 1 = ninguno · 2 = no pudo mirar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [prefijo, ...trozos] = process.argv.slice(2);
if (!prefijo || trozos.length === 0) {
  console.log('uso: node firma-en-origen.mjs <prefijo del jsonl> <trozo> [<trozo> …]');
  console.log('EXIT=2');
  process.exit(2);
}
const base = path.join(os.homedir(), '.claude', 'projects');
let carpetas;
try {
  carpetas = fs.readdirSync(base);
} catch (e) {
  console.log(`NO PUDE MIRAR: no pude leer ${base} (${e.code || e.message})`);
  console.log('EXIT=2');
  process.exit(2);
}
let ficheros = 0;
let humanos = 0;
let hallados = 0;
for (const d of carpetas) {
  let lista;
  try { lista = fs.readdirSync(path.join(base, d)); } catch { continue; }
  for (const f of lista) {
    if (!f.startsWith(prefijo) || !f.endsWith('.jsonl')) continue;
    ficheros++;
    const lineas = fs.readFileSync(path.join(base, d, f), 'utf8').split('\n');
    lineas.forEach((ln, i) => {
      let o;
      try { o = JSON.parse(ln); } catch { return; }
      if (!o || o.type !== 'user' || !o.origin || o.origin.kind !== 'human') return;
      humanos++;
      const c = o.message && o.message.content;
      const texto = typeof c === 'string'
        ? c
        : Array.isArray(c) ? c.filter((x) => x.type === 'text').map((x) => x.text).join('\n') : '';
      const bajo = texto.toLowerCase();
      if (!trozos.some((t) => bajo.includes(t.toLowerCase()))) return;
      hallados++;
      console.log(`--- ${f.slice(0, 8)} · línea ${i + 1} · ${o.timestamp} (reloj de la máquina) · ${texto.length} caracteres`);
      console.log(texto);
      console.log('');
    });
  }
}
console.log(`POBLACIÓN · ${ficheros} jsonl «${prefijo}*» · ${humanos} turnos humanos · ${hallados} con alguno de los trozos`);
const salida = ficheros === 0 ? 2 : hallados > 0 ? 0 : 1;
if (ficheros === 0) console.log('NO PUDE MIRAR: ningún jsonl con ese prefijo en esta máquina');
console.log(`EXIT=${salida}`);
process.exit(salida);
