#!/usr/bin/env node
// SCRUM-1295 · Cerradura de CARRIL (PreToolUse). Una sesión con puesto no edita un fichero de otro
// puesto: salida 2, con el dueño, la fila de docs/equipo/dos-equipos.md que lo dice y cómo se declara
// una excepción (§3.4). El mapa es `.claude/carriles.json`, GENERADO de la tabla (scripts/carriles.mjs).
//
// QUÉ PUESTO ES LA SESIÓN — dos sondas independientes (medido el 29-sep, claude 2.1.284):
//   · la CARPETA de arranque: `<CLAUDE_PROJECT_DIR>/.yaqu-puesto.json`, que escribe
//     `scripts/carriles.mjs mesa` en la mesa fija del puesto (no va a git);
//   · el NOMBRE (`-n`): el hook NO lo recibe por stdin ni por entorno, pero sí `transcript_path`, y el
//     transcript lleva `{"type":"agent-name",…}` desde la primera llamada, también en subagentes.
// Si las dos dicen puestos distintos, la discrepancia ES el dato: se para.
//
// Con `--exigir-identidad` (se arma en settings.json SOLO al migrar a mesas fijas; hoy pararía a
// todas): sin identidad, o con una carpeta rota, no se edita ni se ejecuta nada.
//
// LÍMITE declarado: esto ve Edit/Write/NotebookEdit. Una escritura por Bash/PowerShell no pasa por
// aquí; el carril de esas la sigue cuidando la revisión.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reglaDe, excepcionPara, puestoDeNombre, nombreDelTranscript, FUENTE } from '../../scripts/_carriles.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EDICION = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const bloquear = (msg) => { process.stderr.write(msg + '\n'); process.exit(2); };

// `nombre` lo pasa quien YA lo tiene (SessionStart recibe `session_title`); si no, sale del transcript.
// Las dos sondas se leen AQUÍ y solo aquí: una segunda copia de «qué puesto dice este nombre» es una
// segunda traducción, y con dos traducciones la discrepancia es ruido (choque con SCRUM-1298).
export function identidad({ proyecto, transcript, nombre = null }) {
  let carpeta = null;
  let carpetaRota = null;
  let esperado = null; // el nombre con el que quien lanza dijo que lanzaría (mesa --nombre)
  const f = proyecto ? path.join(proyecto, '.yaqu-puesto.json') : null;
  if (f && fs.existsSync(f)) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const p = j.puesto;
      if (!/^(S[0-5]|J[1-6]|ORQ)$/.test(p)) carpetaRota = `puesto «${p}» no válido`;
      else if (j.nombre !== undefined && (typeof j.nombre !== 'string' || !j.nombre.trim())) carpetaRota = 'campo «nombre» vacío o que no es texto';
      else { carpeta = p; esperado = j.nombre ?? null; }
    } catch (e) { carpetaRota = e.message; }
  }
  try { if (!nombre && transcript) nombre = nombreDelTranscript(fs.readFileSync(transcript, 'utf8')); } catch { /* sin transcript aún */ }
  const porNombre = puestoDeNombre(nombre, carpeta ? { puesto: carpeta, nombre: esperado } : null);
  return { carpeta, carpetaRota, nombre, porNombre, puesto: carpeta ?? porNombre, discrepa: Boolean(carpeta && porNombre && carpeta !== porNombre) };
}

function raizDelRepo(fichero) {
  let d = path.dirname(path.resolve(fichero));
  for (;;) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    const arriba = path.dirname(d);
    if (arriba === d) return null;
    d = arriba;
  }
}

function principal(s, exigir) {
  const id = identidad({ proyecto: process.env.CLAUDE_PROJECT_DIR || s.cwd, transcript: s.transcript_path });
  if (id.discrepa) bloquear(`⛔ Identidad en DISCREPANCIA: tu carpeta dice ${id.carpeta} y tu nombre de sesión «${id.nombre}» dice ${id.porNombre}. La discrepancia ES el dato: no elijas una; para y avisa al orquestador.`);
  if (exigir && (id.carpetaRota || !id.puesto)) bloquear(`⛔ SIN IDENTIDAD: ${id.carpetaRota ? `el .yaqu-puesto.json de tu carpeta está roto (${id.carpetaRota})` : 'ni tu carpeta (.yaqu-puesto.json) ni tu nombre de sesión dicen qué puesto eres'}. O sabes quién eres, o no trabajas: para y avisa. Se arregla lanzando desde la mesa del puesto (sesion.mjs).`);
  if (!EDICION.has(s.tool_name)) return;
  const fichero = s.tool_input?.file_path ?? s.tool_input?.notebook_path;
  if (!fichero || !id.puesto || id.puesto === 'ORQ') return;
  const raiz = raizDelRepo(fichero);
  if (!raiz || !fs.existsSync(path.join(raiz, FUENTE))) return; // fuera del repo de YaQu: no es de nadie
  const rel = path.relative(raiz, path.resolve(fichero)).split(path.sep).join('/');
  let mapa;
  try { mapa = JSON.parse(fs.readFileSync(path.join(AQUI, '..', 'carriles.json'), 'utf8')); }
  catch (e) { bloquear(`⛔ Cerradura de carril SIN MAPA (.claude/carriles.json: ${e.message}). NO-PUDE-MIRAR no es un permiso: regenera con \`node scripts/carriles.mjs generar\`.`); }
  const r = reglaDe(rel, mapa);
  if (!r || !r.puesto || r.tipo === 'contenedor' || r.puesto === id.puesto) return;
  if (excepcionPara(rel, id.puesto, mapa)) return;
  const quien = id.carpeta ? `tu carpeta dice ${id.carpeta}` : `tu nombre de sesión «${id.nombre}» dice ${id.porNombre}`;
  const area = mapa.titulos?.[r.puesto] ? ` — ${mapa.titulos[r.puesto]}` : '';
  bloquear(`🔒 Carril: \`${rel}\` es de ${r.puesto}${area}, y tú eres ${id.puesto} (${quien}).
   Lo dice ${FUENTE}:${r.linea} (dueño «${r.dueno}», patrón \`${r.patron}\`).
   No se construye en terreno ajeno: se pide al dueño por Jira (${FUENTE} §5), o lo dices al orquestador.
   Si el cruce es legítimo, se declara en §3.4 con su motivo y ticket, y se regenera (node scripts/carriles.mjs generar).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let d = '';
  process.stdin.on('data', (c) => { d += c; });
  process.stdin.on('end', () => {
    let s;
    try { s = JSON.parse(d.replace(/^﻿/, '') || '{}'); } catch { bloquear('⛔ Cerradura de carril: stdin no es JSON. NO-PUDE-MIRAR.'); }
    principal(s, process.argv.includes('--exigir-identidad'));
    process.exit(0);
  });
}
