#!/usr/bin/env node
// docs/master/evidencias/scrum1389/cuantas-veces.mjs — SCRUM-1389
//
// LA PREGUNTA: ¿cuántas veces ha salido en el check obligatorio un FICHERO caído a nivel de proceso
// (y no un caso), y de ésas cuántas son «el proceso no se creó» o «murió por debajo de JavaScript»?
//
// Sólo LEE: los logs de los pasos en rojo de cada corrida roja del workflow `ci.yml`
// (`gh run view <id> --log-failed`). No escribe en el repositorio ni relanza nada.
//
// QUÉ BUSCA, y de dónde sale cada marca (medido con el banco de al lado, node v24.18.0):
//   · `test at <ruta>.test.mjs:1:1` ............ la entrada de FICHERO en «failing tests» de `spec`
//   · `exitCode: N` / `signal: X` ............... el YAML del TAP que imprime «Por qué cayó» (sólo fichero)
//   · `spawn … E…` .............................. el proceso NO SE CREÓ
//   · las tres frases del lector de huellas ..... lo que la casa ya dijo de ese rojo
//
// LÍMITES, declarados:
//   · `--log-failed` trae sólo los pasos en rojo. Si la tanda cayó y «Por qué cayó» salió 0 (sale
//     siempre 0), su YAML NO está en lo que se lee aquí: el `exitCode` sólo se ve si el paso rojo lo
//     imprime. Por eso la cuenta de `exitCode` es un SUELO, no el total.
//   · GitHub borra logs viejos; una corrida sin log se cuenta aparte como SIN LOG, no como «0».
//   · La lista de corridas tiene tope (el que se le pasa a `gh run list`): la ventana se declara.
//
// USO:  node docs/master/evidencias/scrum1389/cuantas-veces.mjs <runs.json> <salida.jsonl>
//       (<runs.json> = `gh run list --workflow ci.yml --status failure --limit N --json databaseId,createdAt,headBranch,event,headSha`)
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [rutaRuns, rutaSalida] = process.argv.slice(2);
const runs = JSON.parse(fs.readFileSync(rutaRuns, 'utf8')).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const REPO = 'lwislg99/cobroflash-backend';
const OBLIGATORIO = 'build + tests';

const pedir = (id) => new Promise((resolver) => {
  const h = spawn('gh', ['run', 'view', String(id), '--repo', REPO, '--log-failed'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const trozos = []; let err = '';
  h.stdout.on('data', (t) => trozos.push(t));
  h.stderr.on('data', (t) => { err += t; });
  h.on('error', (e) => resolver({ codigo: -1, texto: '', err: String(e.message) }));
  h.on('close', (codigo) => resolver({ codigo, texto: Buffer.concat(trozos).toString('utf8'), err: err.trim().slice(0, 200) }));
});

function leer(texto) {
  const lineas = texto.split(/\r?\n/);
  const delObligatorio = lineas.filter((l) => l.startsWith(OBLIGATORIO));
  const cuerpo = (l) => l.split('\t').slice(2).join('\t').replace(/^\S+Z /, '');
  const ficheros = new Set(); const exitCodes = []; const senales = []; const spawns = []; const huellas = [];
  let fail = null; let seccion = false; const casosRojos = new Set();
  for (const cruda of delObligatorio) {
    const l = cuerpo(cruda).replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '');
    let m;
    if (/✖ failing tests:/.test(l)) seccion = true;
    if ((m = /^test at (\S+):(\d+):(\d+)\s*$/.exec(l))) {
      if (/\.test\.[cm]?js$/.test(m[1]) && m[2] === '1' && m[3] === '1') ficheros.add(m[1]);
      else casosRojos.add(m[1] + ':' + m[2]);
    }
    if ((m = /^\s*exitCode: (\d+)\s*$/.exec(l))) exitCodes.push(Number(m[1]));
    if ((m = /^\s*signal: '?(SIG[A-Z0-9]+)'?\s*$/.exec(l))) senales.push(m[1]);
    if (/\bspawn\b.*\bE[A-Z]{3,}\b/.test(l) && !/spawnargs/.test(l)) spawns.push(l.trim().slice(0, 160));
    if ((m = /(FICHERO CAÍDO SIN CASO CAÍDO|MURIÓ EL PROCESO, NO FALLÓ UN TEST|NO HABÍA RED) · (\S+)/.exec(l))) huellas.push(m[1] + ' · ' + m[2]);
    if ((m = /^ℹ fail (\d+)\s*$/.exec(l))) fail = Number(m[1]);
  }
  return { lineasDelObligatorio: delObligatorio.length, vistaLaSeccion: seccion, fail, ficheros: [...ficheros], casosRojos: casosRojos.size, exitCodes, senales, spawns, huellas };
}

const salida = fs.createWriteStream(rutaSalida);
let i = 0; let hechos = 0;
async function obrero() {
  while (i < runs.length) {
    const run = runs[i]; i += 1;
    const r = await pedir(run.databaseId);
    const fila = { id: run.databaseId, creado: run.createdAt, rama: run.headBranch, evento: run.event, gh: r.codigo, bytes: r.texto.length,
      ...(r.codigo === 0 && r.texto.length > 0 ? leer(r.texto) : { sinLog: r.err || 'salida vacía' }) };
    salida.write(JSON.stringify(fila) + '\n');
    hechos += 1;
    if (hechos % 25 === 0) console.log('leídas ' + hechos + ' de ' + runs.length);
  }
}
await Promise.all([obrero(), obrero(), obrero(), obrero()]);
await new Promise((r) => salida.end(r));
console.log('POBLACIÓN=' + runs.length + ' corridas rojas de ci.yml · de ' + runs[0].createdAt + ' a ' + runs[runs.length - 1].createdAt + ' · LEÍDAS=' + hechos);
