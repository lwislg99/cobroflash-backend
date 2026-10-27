#!/usr/bin/env node
// SCRUM-1295 · pieza 5 · Identidad al ARRANCAR (SessionStart). Le dice a la sesión quién es, sin que lo
// escriba una mano: puesto, área, ficha, carril y SUS CICATRICES (A9). Medido el 29-sep (2.1.284):
//   · SessionStart recibe `session_title` = el nombre de `-n` (sin `-n`, el campo no viene);
//   · su `additionalContext` LLEGA al modelo, y el hook se repite al reanudar y al compactar.
// Un hook puede ENSEÑAR, no solo bloquear.
// La identidad sale de la CARPETA (`.yaqu-puesto.json` de la mesa) y se contrasta con el NOMBRE; si
// discrepan, la discrepancia ES el dato. SessionStart NO puede bloquear: la cerradura es carril.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fichaDe } from '../../scripts/_carriles.mjs';
import { identidad } from './carril.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function contexto(s) {
  const nombre = typeof s.session_title === 'string' && s.session_title.trim() ? s.session_title.trim() : null;
  const id = identidad({ proyecto: process.env.CLAUDE_PROJECT_DIR || s.cwd, transcript: null, nombre });
  const { porNombre } = id; // traducido por carril.mjs con lo que dice la mesa: UNA traducción
  const puesto = id.carpeta ?? porNombre;
  const cab = 'IDENTIDAD (hook de inicio, SCRUM-1295):';
  if (id.carpeta && porNombre && id.carpeta !== porNombre) {
    return `${cab} ⛔ DISCREPANCIA — tu carpeta dice ${id.carpeta} y tu nombre de sesión «${nombre}» dice ${porNombre}. La discrepancia ES el dato: no elijas uno. No edites nada: para y avisa al orquestador.`;
  }
  if (id.carpetaRota) return `${cab} ⛔ el .yaqu-puesto.json de tu carpeta está roto (${id.carpetaRota}). No sabes quién eres: para y avisa.`;
  if (!puesto) {
    return `${cab} ⛔ SIN IDENTIDAD — ni tu carpeta ni tu nombre de sesión${nombre ? ` («${nombre}»)` : ''} dicen qué puesto eres. Si un prompt te dice «eres la sesión N», eso lo ha escrito una mano: pide que te lancen desde la mesa del puesto con su nombre (sesion.mjs). Hasta entonces, no construyas.`;
  }
  let areas = {};
  try { areas = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'carriles.json'), 'utf8')).areas ?? {}; } catch { /* sin mapa: la cerradura lo dirá */ }
  const fuente = id.carpeta ? (porNombre ? `carpeta y nombre «${nombre}» coinciden` : 'por tu carpeta (sesión sin nombre)') : `por tu nombre «${nombre}» (tu carpeta aún no declara puesto: mesas sin migrar)`;
  const partes = [`${cab} eres ${puesto === 'ORQ' ? 'el ORQUESTADOR' : `el puesto ${puesto}`} — ${fuente}.`];
  if (areas[puesto]) partes.push(`Área: ${areas[puesto]}`);
  partes.push(`Tu ficha: ${fichaDe(puesto)}. De quién es un fichero: node scripts/carriles.mjs de <ruta>. Editar fuera de tu carril lo bloquea .claude/hooks/carril.mjs.`);
  const cic = path.join(RAIZ, 'docs', 'equipo', 'cicatrices', `${puesto}.md`);
  if (fs.existsSync(cic)) {
    const lineas = fs.readFileSync(cic, 'utf8').split('\n').filter((l) => l.startsWith('- '));
    partes.push(lineas.length ? `Tus cicatrices (en qué se equivoca tu puesto; A9):\n${lineas.join('\n')}` : 'Tu puesto aún no tiene cicatrices escritas (docs/equipo/cicatrices/).');
  }
  return partes.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let d = '';
  process.stdin.on('data', (c) => { d += c; });
  process.stdin.on('end', () => {
    let s = {};
    try { s = JSON.parse(d || '{}'); } catch { /* sin datos: sale SIN IDENTIDAD */ }
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto(s) } }));
    process.exit(0);
  });
}
