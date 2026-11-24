// tests/scrum1506d-cerradura-falla-cerrada.test.mjs — SCRUM-1506d (pieza ③ de SCRUM-1506, decisión c.22577)
//
// Sin gate, sin BD, sin red. La cerradura de carril (`.claude/hooks/carril.mjs`) FALLA CERRADA: dentro del
// repo de YaQu, una edición sin identidad (ni mesa ni nombre que diga un puesto), con la mesa rota, o con un
// error del propio hook, se PARA (salida 2) con el cómo identificarse. Hasta hoy salía 0 sin mirar, y un
// error interno salía 1, que Claude Code trata como «sigue» (sólo el 2 bloquea).
//
//   ① sin identidad → para, en un fichero con dueño y en uno sin fila, y el mensaje dice cómo identificarse;
//   ② mesa rota con un nombre válido → para (antes pasaba leyendo sólo el nombre);
//   ③ un error dentro del hook → 2, no 1;
//   ④ CONTROLES POSITIVOS — la cura no tumba al equipo: cada puesto con fila (S0…S5 por `sesion-N`, J1…J6
//      por `jv-jN`) edita un fichero SUYO y pasa; una mesa con su nombre pasa; `orquestador` pasa; y sin
//      identidad siguen pasando LEER y editar FUERA del repo (la memoria, los temporales);
//   ⑤ lo ajeno sigue parándose, con su mensaje de siempre.
// Población declarada en ④: cuántos puestos, cuáles sin fichero.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reglaDe } from '../scripts/_carriles.mjs';
import { ficherosDelRepo } from '../scripts/carriles.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Vuelve el «sin identidad, sale sin mirar» de SCRUM-1506.
    fichero: '.claude/hooks/carril.mjs',
    de: '  if (!id.puesto) bloquear(sinIdentidad(id));',
    a: '  if (!id.puesto) return;',
    cae: 'SCRUM-1506d ① ·',
  },
  {
    // La mesa rota deja de ser un error y se lee sólo el nombre.
    fichero: '.claude/hooks/carril.mjs',
    de: '  if (id.carpetaRota) bloquear(sinIdentidad(id));',
    a: '  if (false) bloquear(sinIdentidad(id));',
    cae: 'SCRUM-1506d ② ·',
  },
  {
    // Un error del hook vuelve a salir 1 (Claude Code lo deja pasar).
    fichero: '.claude/hooks/carril.mjs',
    de: '    catch (e) { bloquear(',
    a: '    catch (e) { throw e; bloquear(',
    cae: 'SCRUM-1506d ③ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'carril.mjs');
const MAPA = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'carriles.json'), 'utf8'));
const DE_J1 = path.join(RAIZ, 'public/dashboard/js/invoicesView.js');
const DE_S2 = path.join(RAIZ, 'public/dashboard/js/homeView.js');
const SIN_FILA = path.join(RAIZ, 'tests/scrum1506d-cerradura-falla-cerrada.test.mjs');

// Los `node` hijos NO heredan el entorno de la tanda (SCRUM-1349).
const entorno = { ...process.env };
delete entorno.FORCE_COLOR; delete entorno.NODE_OPTIONS; delete entorno.NODE_TEST_CONTEXT;

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'yaqu-1506d-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

/** Carpeta de arranque de juguete: con mesa (`.yaqu-puesto.json`, o `crudo`) o sin ella, y transcript con el nombre. */
function sesion(t, { nombre = null, mesa = undefined, crudo = undefined } = {}) {
  const dir = tmp(t);
  if (crudo !== undefined) fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), crudo);
  else if (mesa !== undefined) fs.writeFileSync(path.join(dir, '.yaqu-puesto.json'), JSON.stringify(mesa));
  const transcript = path.join(dir, 't.jsonl');
  fs.writeFileSync(transcript, nombre ? JSON.stringify({ type: 'agent-name', agentName: nombre }) + '\n' : '');
  return { dir, transcript };
}

function cerradura(s, fichero, herramienta = 'Edit') {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: herramienta, tool_input: { file_path: fichero }, transcript_path: s.transcript, cwd: s.dir }),
    env: { ...entorno, CLAUDE_PROJECT_DIR: s.dir },
    encoding: 'utf8',
  });
  return { codigo: r.status, err: r.stderr };
}

test('SCRUM-1506d ① · sin identidad, la cerradura PARA dentro del repo y dice cómo identificarse', (t) => {
  for (const nombre of ['cobroflash-backend-41', 'jv-j9z', null]) {
    for (const fichero of [DE_J1, SIN_FILA]) {
      const r = cerradura(sesion(t, { nombre }), fichero);
      assert.equal(r.codigo, 2, `«${nombre}» sin mesa, editando ${path.relative(RAIZ, fichero)}: ${r.err}`);
      assert.match(r.err, /SIN IDENTIDAD/);
      assert.match(r.err, /\/rename/, 'el mensaje dice cómo identificarse por el nombre');
      assert.match(r.err, /\.yaqu-puesto\.json/, 'y por la mesa');
    }
  }
});

test('SCRUM-1506d ② · una mesa ROTA no se salta leyendo sólo el nombre', (t) => {
  for (const crudo of ['{no es json', '{"puesto":"S9"}', '{"puesto":"S2","nombre":""}']) {
    const r = cerradura(sesion(t, { nombre: 'sesion-2', crudo }), DE_S2);
    assert.equal(r.codigo, 2, `mesa ${crudo} con sesion-2 en su propio fichero: ${r.err}`);
    assert.match(r.err, /roto/);
  }
});

test('SCRUM-1506d ③ · un error dentro del hook PARA (2), no deja pasar (1)', (t) => {
  const s = sesion(t, { nombre: 'sesion-5' });
  const r = spawnSync(process.execPath, [HOOK], {
    // `file_path` que no es texto: `path.resolve` lanza dentro de la cerradura.
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 123 }, transcript_path: s.transcript, cwd: s.dir }),
    env: { ...entorno, CLAUDE_PROJECT_DIR: s.dir },
    encoding: 'utf8',
  });
  assert.equal(r.status, 2, `salida ${r.status}: ${r.stderr}`);
  assert.match(r.stderr, /NO-PUDE-MIRAR/);
});

test('SCRUM-1506d ④ · CONTROLES POSITIVOS: cada puesto edita lo suyo, y sin identidad se lee y se edita fuera', (t) => {
  // Un fichero real por puesto, sacado del mapa (no supuesto).
  const conFila = [...new Set(MAPA.reglas.filter((r) => r.puesto && r.tipo !== 'contenedor').map((r) => r.puesto))].sort();
  const suyo = {};
  for (const f of ficherosDelRepo(RAIZ)) {
    const r = reglaDe(f, MAPA);
    if (r && r.puesto && r.tipo !== 'contenedor' && !suyo[r.puesto]) suyo[r.puesto] = f;
    if (conFila.every((p) => suyo[p])) break; // ya hay uno de cada: el resto no cambia el control
  }
  for (const p of ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']) assert.ok(suyo[p], `${p} sin fichero propio: el control no mira al equipo de Luis entero`);
  const vistos = [];
  for (const p of conFila) {
    if (!suyo[p]) continue;
    const nombre = p.startsWith('S') ? `sesion-${p[1]}` : `jv-j${p[1]}`;
    const r = cerradura(sesion(t, { nombre }), path.join(RAIZ, suyo[p]));
    assert.equal(r.codigo, 0, `${nombre} editando ${suyo[p]} (suyo): ${r.err}`);
    vistos.push(p);
  }
  // Con mesa y su nombre: pasa (la mesa real de S3 se llama así).
  assert.equal(cerradura(sesion(t, { nombre: 'sesion-3', mesa: { puesto: 'S3', nombre: 'sesion-3' } }), path.join(RAIZ, suyo.S3)).codigo, 0);
  // La mesa sin nombre y una sesión con el suyo: el equipo de Luis no necesita --nombre.
  assert.equal(cerradura(sesion(t, { nombre: 'sesion-2', mesa: { puesto: 'S2' } }), DE_S2).codigo, 0);
  // El orquestador no tiene carril.
  assert.equal(cerradura(sesion(t, { nombre: 'orquestador' }), DE_J1).codigo, 0);
  // Sin identidad: leer no es editar, y fuera del repo no es de nadie.
  const nadie = sesion(t, { nombre: 'cobroflash-backend-41' });
  assert.equal(cerradura(nadie, DE_J1, 'Read').codigo, 0, 'leer no es editar');
  const fuera = path.join(tmp(t), 'nota.md');
  const r = cerradura(nadie, fuera);
  assert.equal(r.codigo, 0, `fuera del repo: ${r.err}`);
  const sinFichero = conFila.filter((p) => !suyo[p]);
  assert.ok(vistos.length >= 6, `población: ${vistos.length}`);
  console.log(`# población: ${vistos.length} puestos editando lo suyo (${vistos.join(' ')}) · con fila y sin fichero: ${sinFichero.join(' ') || 'ninguno'}`);
});

test('SCRUM-1506d ⑤ · y lo ajeno se sigue parando, con su mensaje', (t) => {
  const r = cerradura(sesion(t, { nombre: 'jv-j1' }), DE_S2);
  assert.equal(r.codigo, 2);
  assert.match(r.err, /es de S2\b.*tú eres J1/);
  const s = cerradura(sesion(t, { nombre: 'sesion-2' }), DE_J1);
  assert.equal(s.codigo, 2);
  assert.match(s.err, /es de J1\b.*tú eres S2/);
});
