// docs/master/evidencias/scrum1344/exposicion.mjs — SCRUM-1344
//
// A QUIÉN LE CAE ESTE GUARD EL DÍA QUE ENTRA. CI prueba el MERGE, no la rama: un PR abierto que
// trae un arnés sobre un router de /admin sin `reqDeSesion` saldrá rojo en cuanto esto esté en main.
//
//     node docs/master/evidencias/scrum1344/exposicion.mjs
//
// Para cada PR ABIERTO (los dos equipos), mira los `.mjs` de `tests/` que añade o modifica respecto
// a su punto de partida de main y los pasa por el MISMO analizador que usa el guard. Dice:
//   · los que el guard rechazaría (sin rol, rol a mano en un fichero nuevo, sin sesión o sin juzgar
//     en un fichero que no está en las listas);
//   · los que tocan un arnés que este PR migra (ahí lo que hay es riesgo de CONFLICTO, no de rojo).
// Requiere `git fetch origin` reciente y `gh`. Solo lee.
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..', '..');
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const git = (...a) => sh('git', a);
const { analizarFuente, clasificar, censoDeArneses, CLASES } = await import(pathToFileURL(path.join(RAIZ, 'tests', '_censo-arneses-de-router.mjs')).href);

const censo = await censoDeArneses(RAIZ);
const claseHoy = new Map();
for (const [clase, filas] of censo.porClase) for (const x of filas) claseHoy.set(x.fichero, clase);
const migrados = new Set(git('diff', '--name-only', '--diff-filter=M', 'origin/main', 'HEAD', '--', 'tests').split('\n').filter(Boolean));

const prs = JSON.parse(sh('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,headRefName,headRefOid,isDraft,title']));
console.log(`origin/main=${git('rev-parse', 'origin/main').trim()} · HEAD=${git('rev-parse', 'HEAD').trim()}`);
console.log(`POBLACION=${prs.length} PR abiertos · ${migrados.size} ficheros de tests/ que este árbol modifica`);

let expuestos = 0;
let conConflicto = 0;
let ciegos = 0;
for (const pr of prs.sort((a, b) => a.number - b.number)) {
  let cambios;
  try {
    cambios = git('diff', '--name-status', `origin/main...${pr.headRefOid}`, '--', 'tests').split('\n').filter(Boolean).map((l) => l.split('\t'));
  } catch {
    ciegos++;
    console.log(`#${pr.number} ${pr.headRefName} · CIEGO: no tengo su commit ${pr.headRefOid.slice(0, 8)} (¿falta un fetch?)`);
    continue;
  }
  const rojos = [];
  const choques = [];
  for (const [estado, ...resto] of cambios) {
    const f = resto[resto.length - 1];
    if (!/^tests\/[^/]+\.mjs$/.test(f) || estado.startsWith('D')) continue;
    if (migrados.has(f)) choques.push(f);
    const nombre = f.slice('tests/'.length);
    const c = clasificar(analizarFuente(nombre, git('show', `${pr.headRefOid}:${f}`)), censo.mapa);
    if (!c.clase || [CLASES.ARNES, CLASES.PUBLICO, CLASES.APP, CLASES.SIN_RESOLVER].includes(c.clase)) continue; // clases que el guard no exige declarar
    // Las clases de lista cerrada solo caen si el fichero NO está ya en esa clase en este árbol.
    if (c.clase !== CLASES.K && claseHoy.get(nombre) === c.clase) continue;
    rojos.push(`${nombre} → ${c.clase}${c.clase === CLASES.K ? ` (línea ${c.sitios.map((s) => s.linea).join(', ')})` : ''}${estado.startsWith('A') ? ' · fichero NUEVO' : ' · fichero modificado'}`);
  }
  if (rojos.length) expuestos++;
  if (choques.length) conConflicto++;
  console.log(`#${pr.number} ${pr.headRefName}${pr.isDraft ? ' (borrador)' : ''} · ${cambios.length} cambios en tests/ · caería: ${rojos.length} · toca arneses migrados: ${choques.length}`);
  for (const r of rojos) console.log(`     🔴 ${r}`);
  for (const c of choques) console.log(`     ⚠️ toca ${c}`);
}
console.log(`RESULTADO: ${prs.length} PR mirados · ${expuestos} con algún arnés que el guard rechazaría · ${conConflicto} que tocan un arnés migrado · ${ciegos} ciegos`);
console.log(`EXIT=${ciegos ? 1 : 0}`);
process.exit(ciegos ? 1 : 0);
