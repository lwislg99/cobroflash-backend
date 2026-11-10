// pasadas.mjs — corre UN fichero N veces con banco.mjs (PGlite nuevo por pasada) y cruza, por pasada,
// el veredicto del caso de base con el diagnóstico «el token de A EMPIEZA / no empieza por su id».
// Uso: node pasadas.mjs <raiz> <tests/f.test.mjs> <N> <etiqueta>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [raiz, fichero, nTxt, etiqueta] = process.argv.slice(2);
const N = Number(nTxt);
const aqui = path.dirname((await import('node:url')).fileURLToPath(import.meta.url));
const CASO = 'SCRUM-85: /pay/card, /pay/bizum, /pay/invoice cierran el IDOR';
const tabla = { 'EMPIEZA': { ok: 0, 'not ok': 0, otro: 0 }, 'no empieza': { ok: 0, 'not ok': 0, otro: 0 }, 'SIN DIAGNOSTICO': { ok: 0, 'not ok': 0, otro: 0 } };
let ciegas = 0;
for (let i = 1; i <= N; i++) {
  const salida = path.join(aqui, `p-${etiqueta}.json`);
  fs.rmSync(salida, { force: true });
  spawnSync(process.execPath, [path.join(aqui, 'banco.mjs'), raiz, path.join(aqui, 'ddl.sql'), salida, fichero], { cwd: aqui, encoding: 'utf8' });
  const tap = path.join(aqui, `tap-${path.basename(fichero)}.tap`);
  const texto = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  const r = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, 'utf8'))[0] : null;
  const nombre = r && Object.keys(r.casos).find((k) => k.startsWith(CASO));
  if (!nombre) { ciegas++; console.log(`pasada ${i}: CIEGA`); continue; }
  const m = /SCRUM-1599j: el token de A (EMPIEZA|no empieza) por su id/.exec(texto);
  const clase = m ? m[1] : 'SIN DIAGNOSTICO';
  const v = r.casos[nombre];
  tabla[clase][v in tabla[clase] ? v : 'otro']++;
  if (clase !== 'no empieza' || v !== 'ok') { const e = [...texto.matchAll(/^\s+error: (.*)$/gm)].map((x) => x[1]).join(' | '); console.log(`pasada ${i}: token ${clase} · caso ${v} · errores=${e}`); }
}
console.log(`[${etiqueta}] N=${N} · ciegas=${ciegas}`);
for (const [k, v] of Object.entries(tabla)) console.log(`  token ${k}: ok=${v.ok} not_ok=${v['not ok']} otro=${v.otro}`);
const suma = Object.values(tabla).reduce((a, v) => a + v.ok + v['not ok'] + v.otro, 0);
console.log(`  suma=${suma} + ciegas=${ciegas} = ${suma + ciegas} (${suma + ciegas === N ? 'SUMA' : 'NO SUMA'})`);
