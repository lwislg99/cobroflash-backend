// docs/master/evidencias/SCRUM-1509h/mutar.mjs — ¿qué pieza del límite de entrantes TRABAJA?
//
// Uso (desde la raíz, con `dist/` recién compilado): node docs/master/evidencias/SCRUM-1509h/mutar.mjs
//
// SIN LISTA PROPIA (SCRUM-1387). Las mutaciones son las MUTACIONES_QUE_ME_TUMBAN de
// `tests/scrum1509h-veinte-entrantes-por-hora.test.mjs`, leídas con el lector del meta-guard (por AST,
// sin ejecutar el test). Cada una se aplica al TEXTO del fuente en memoria, se compila con el compilador
// y las opciones del proyecto (`emitirDesdeFuente`, SCRUM-763) y se escribe SÓLO en su `.js` de `dist/`;
// el fuente no se toca. Después se corre el test y se devuelve el `.js` a sus bytes (sha256 antes =
// sha256 después, o sale con 3).
//
// Veredicto por fila: la BASE sin mutar tiene que salir verde; cada mutación, con su caso `cae` en rojo.
// Una sustitución que no casa UNA vez, o una tanda sin recuento, es CIEGA (sale 2).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mutacionesDeclaradas } from '../../../../scripts/meta-guard-mutaciones.mjs';
import { destinoEnDist, emitirDesdeFuente } from '../../../../scripts/frontera-dist.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TEST = 'tests/scrum1509h-veinte-entrantes-por-hora.test.mjs';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const suyas = mutacionesDeclaradas(fs.readFileSync(path.join(RAIZ, TEST), 'utf8'), TEST);
if (suyas.length === 0) { console.log(`CIEGO: no leo ninguna mutación declarada en ${TEST}`); process.exit(2); }

// Un hijo de `node --test` hereda el contexto del padre si lo hay: se le quita (SCRUM-1308).
const entorno = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete entorno[k];

function correr() {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', TEST],
    { cwd: RAIZ, env: entorno, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const num = (re) => Number((re.exec(r.stdout) || [])[1]);
  const total = num(/^# tests (\d+)/m); const pasan = num(/^# pass (\d+)/m); const caen = num(/^# fail (\d+)/m);
  // Ancladas al inicio del caso: un nombre puede llevar dentro la palabra de otro (cicatriz ③).
  const caidos = [...r.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  const ciega = !Number.isFinite(total) || total === 0 || pasan + caen !== total;
  return { total, pasan, caen, caidos, ciega, estado: r.status };
}

let ciegas = 0; let noCuadran = 0;
const base = correr();
if (base.ciega) { console.log(`CIEGA   BASE sin mutar: sin recuento (salida ${base.estado})`); process.exit(2); }
const baseOk = base.caen === 0;
if (!baseOk) noCuadran += 1;
console.log(`${baseOk ? 'cuadra ' : 'ROJO   '} BASE sin mutar · esperado verde · ${base.caen} de ${base.total} caen`);

for (const m of suyas) {
  const destino = destinoEnDist(m.fichero, RAIZ);
  const fuente = fs.readFileSync(path.join(RAIZ, m.fichero), 'utf8');
  const veces = fuente.split(m.de).length - 1;
  if (!destino || veces !== 1) { console.log(`CIEGA   ${m.fichero}: «${m.de}» casa ${veces} veces (tiene que ser 1) · destino ${destino}`); ciegas += 1; continue; }
  const absDist = path.join(RAIZ, destino);
  const original = fs.readFileSync(absDist); const antes = sha(original);
  let r;
  try {
    fs.writeFileSync(absDist, emitirDesdeFuente(path.join(RAIZ, m.fichero), fuente.replace(m.de, m.a), RAIZ));
    r = correr();
  } finally {
    fs.writeFileSync(absDist, original);
    if (sha(fs.readFileSync(absDist)) !== antes) { console.log(`DIST ALTERADO: ${destino} no volvió a sus bytes`); process.exit(3); }
  }
  if (r.ciega) { console.log(`CIEGA   «${m.de}» → «${m.a}»: sin recuento (salida ${r.estado})`); ciegas += 1; continue; }
  const cayoElSuyo = r.caidos.some((n) => n.includes(m.cae));
  if (!cayoElSuyo) noCuadran += 1;
  console.log(`${cayoElSuyo ? 'cuadra ' : 'ROJO   '} «${m.de}» → «${m.a}» · tiene que caer «${m.cae}» · ${r.caen} de ${r.total} caen${cayoElSuyo ? '' : ' (y el suyo NO)'}`);
}
console.log(`mutaciones declaradas: ${suyas.length} · ciegas ${ciegas} · no cuadran ${noCuadran}`);
process.exit(ciegas ? 2 : noCuadran ? 1 : 0);
