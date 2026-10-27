// SCRUM-1395 (J4c) · EXPOSICION: que PR abiertos anaden o tocan un test que llama al filtro
// sin forma con suelo. Solo lee (gh + git show sobre los objetos ya traidos por fetch).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2];
const { soloCodigo } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_solo-codigo.mjs')).href);
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const prs = JSON.parse(sh('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,headRefName,headRefOid,isDraft']));
console.log(`POBLACION: ${prs.length} PR abiertos`);
let ciegos = 0; let expuestos = 0;
for (const pr of prs) {
  let ficheros;
  try {
    ficheros = JSON.parse(sh('gh', ['pr', 'view', String(pr.number), '--json', 'files'])).files;
  } catch (e) { ciegos++; console.log(`#${pr.number} CIEGO (no pude listar sus ficheros)`); continue; }
  const tests = ficheros.filter((f) => /^tests\/.*\.test\.mjs$/.test(f.path));
  const hallazgos = [];
  let sinLeer = 0;
  for (const t of tests) {
    let texto;
    try { texto = sh('git', ['show', `${pr.headRefOid}:${t.path}`]); } catch { sinLeer++; continue; } // borrado, o el objeto no esta traido
    const codigo = soloCodigo(texto, t.path);
    const solo = (codigo.match(/\bsoloEjecutable\s*\(/g) || []).length;
    const leerSin = (codigo.match(/\bleerFuente\s*\(/g) || []).length - (codigo.match(/\bleerFuente\s*\([^)]*ancla/g) || []).length;
    let enMain = true;
    try { sh('git', ['cat-file', '-e', `origin/main:${t.path}`]); } catch { enMain = false; }
    if (solo || leerSin) hallazgos.push(`${t.path} · soloEjecutable x${solo} · leerFuente sin ancla x${leerSin} · ${enMain ? 'YA EXISTE en main' : 'NUEVO'}`);
  }
  const nuevos = hallazgos.filter((h) => h.endsWith('NUEVO'));
  if (nuevos.length) expuestos++;
  if (sinLeer) ciegos++;
  console.log(`#${pr.number} ${pr.headRefName}${pr.isDraft ? ' (borrador)' : ''} · ${ficheros.length} ficheros · ${tests.length} tests tocados · ${sinLeer} sin leer · con filtro sin suelo: ${hallazgos.length} (${nuevos.length} NUEVOS)`);
  for (const h of hallazgos) console.log(`     ${h}`);
}
console.log(`\nPR con algun test NUEVO que llama al filtro sin suelo: ${expuestos} · PR con algo sin poder mirar: ${ciegos}`);
console.log('EXIT=0');
