#!/usr/bin/env node
// docs/master/evidencias/SCRUM-1339/m-vecinos.mjs — SCRUM-1339m
//
// El cero DERIVADO de los dieciocho: si en el job de #2303 se perdió el informe de 18 casos y nada
// más, un job vecino sobre un árbol que declara los mismos tests y sale «0 ausentes» tiene que
// traer en su TAP exactamente 18 líneas de test más. La cifra sale de la anotación que la señal
// deja en cada run (la línea de registro), no de ningún log.
//
//   node m-vecinos.mjs <PR> [<PR> …]          (necesita `gh` autenticado; sólo lee)
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const REPO = 'lwislg99/cobroflash-backend';
const OBLIGATORIO = 'build + tests (con banco desechable)';
const m = await import(pathToFileURL(path.resolve(import.meta.dirname, '..', '..', '..', '..', 'scripts', '_senal-de-nombres.mjs')).href);

const gh = (args) => {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
};

const prs = process.argv.slice(2);
console.log(`POBLACIÓN · ${prs.length} PR pedidos: ${prs.join(', ')} · check leído por nombre: «${OBLIGATORIO}»`);
console.log('pr\thead\tjob\tconclusion\tmedible\tausentes\tficheros_con_ausentes\tdeclarados\ttap_tests\ttap_tests-declarados');
let leidos = 0;
for (const n of prs) {
  const pr = gh(['pr', 'view', n, '--repo', REPO, '--json', 'headRefOid,statusCheckRollup']);
  const check = pr?.statusCheckRollup?.find((c) => c.name === OBLIGATORIO);
  if (!check) { console.log(`${n}\t${pr?.headRefOid?.slice(0, 10) ?? '?'}\t?\tNO PUDE LEER el check`); continue; }
  const job = /\/job\/(\d+)/.exec(check.detailsUrl)?.[1];
  const estado = check.status !== 'COMPLETED' ? `(${check.status}: CORRIENDO o EN COLA)` : check.conclusion;
  const notas = gh(['api', `repos/${REPO}/check-runs/${job}/annotations?per_page=100`]) ?? [];
  const reg = notas.map((a) => m.registroDesdeLinea(a.message)).find(Boolean);
  if (!reg) { console.log(`${n}\t${pr.headRefOid.slice(0, 10)}\t${job}\t${estado}\tSIN REGISTRO de la señal (${notas.length} anotaciones)`); continue; }
  leidos++;
  console.log([n, pr.headRefOid.slice(0, 10), job, estado, reg.medible ? 'si' : 'no', reg.ausentes, reg.ficherosConAusentes, reg.declarados, reg.tapTests, reg.tapTests - reg.declarados].join('\t'));
}
console.log(`LEÍDOS con registro: ${leidos} de ${prs.length}`);
console.log('EXIT=0');
