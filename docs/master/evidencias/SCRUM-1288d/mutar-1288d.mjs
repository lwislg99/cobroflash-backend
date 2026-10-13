// Los tres rojos de SCRUM-1288d, sobre src/ (nunca dist/): cada mutación exige casar UNA vez dentro de
// SU función, imprime su numstat y se restaura con git. Exige árbol limpio al empezar.
// Uso, desde la raíz del árbol:  node <ruta>/mutar-1288d.mjs
//   M1 · «Pago recibido»: el ASUNTO vuelve a pegar el importe a la moneda
//   M2 · «Pago recibido»: el CUERPO vuelve a pegar el importe a la moneda
//   M3 · «Presupuesto aceptado»: la fila «Total» vuelve a pegar el total a la moneda
// En las tres tiene que caer el trinquete del censo («ninguna identidad RETIRADA ha vuelto a aparecer»).
// El rojo del test que lee el correo (`scrum1288d`, contra dist/) no va aquí: es `rojo-antes.txt`.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const entorno = { ...process.env };
for (const v of ['FORCE_COLOR', 'NODE_OPTIONS', 'QA_DB_TEST', 'LIBRO_PG_URL']) delete entorno[v];
const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8' });
const sucio = () => git('status', '--porcelain').stdout.trim();
if (sucio()) { console.error('🔴 el árbol no está limpio: no se muta nada'); process.exit(2); }

const FICHERO = 'src/modules/messaging/domain/merchantNotifications.ts';
const MUTACIONES = [
  { id: 'M1', que: '«Pago recibido»: el asunto vuelve a pegar el importe a la moneda', funcion: 'sendMerchantPaymentEmail',
    busca: 'Pago recibido: ${importe} de', pon: 'Pago recibido: ${amount} ${currency} de' },
  { id: 'M2', que: '«Pago recibido»: el cuerpo vuelve a pegar el importe a la moneda', funcion: 'sendMerchantPaymentEmail',
    busca: '">${importe}</span>', pon: '">${amount} ${currency}</span>' },
  { id: 'M3', que: '«Presupuesto aceptado»: la fila «Total» vuelve a pegar el total a la moneda', funcion: 'sendMerchantQuoteAcceptedEmail',
    busca: '${formatMoneyEs(total, currency)}', pon: '${total} ${currency}' },
];
console.log(`POBLACION · ${MUTACIONES.length} mutaciones · HEAD ${git('rev-parse', 'HEAD').stdout.trim()}`);

function tests(ficheros) {
  const tap = path.join(os.tmpdir(), `mut1288d-${process.pid}-${Date.now()}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...ficheros], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const l = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  if (fs.existsSync(tap)) fs.unlinkSync(tap);
  const n = (k) => Number((l.find((x) => x.startsWith(`# ${k} `)) || '').split(' ')[2] ?? NaN);
  const caidos = l.filter((x) => /^not ok \d+ - /.test(x)).map((x) => x.replace(/^not ok \d+ - /, '').slice(0, 110));
  return { salida: r.status, tests: n('tests'), fail: n('fail'), caidos };
}

// El trozo del fichero que es ESA función: de su `export async function` al siguiente (o al final).
// La fila «Total» de dos correos es idéntica letra por letra; sin acotar, M3 mutaría el del técnico.
function mutar({ funcion, busca, pon }) {
  const ruta = path.join(RAIZ, FICHERO);
  const t = fs.readFileSync(ruta, 'utf8');
  const cabecera = `export async function ${funcion}(`;
  if (t.split(cabecera).length - 1 !== 1) { console.log(`  CIEGO: no hay UNA \`${funcion}\` en ${FICHERO}`); return false; }
  const desde = t.indexOf(cabecera);
  const siguiente = t.indexOf('export async function ', desde + cabecera.length);
  const hasta = siguiente === -1 ? t.length : siguiente;
  const cuerpo = t.slice(desde, hasta);
  const veces = cuerpo.split(busca).length - 1;
  if (veces !== 1) { console.log(`  CIEGO: «${busca}» casa ${veces} veces dentro de \`${funcion}\``); return false; }
  fs.writeFileSync(ruta, t.slice(0, desde) + cuerpo.replace(busca, () => pon) + t.slice(hasta));
  console.log(`  numstat: ${git('diff', '--numstat').stdout.trim()}`);
  return true;
}
function restaurar() {
  git('restore', '--source=HEAD', '--staged', '--worktree', '.');
  console.log(`  restaurado · git status: [${sucio()}]`);
}
const TRINQUETE = ['tests/scrum1288b-el-importe-pegado-a-la-moneda.test.mjs', 'tests/scrum1452-gemelo-crudo.test.mjs'];

const base = tests(TRINQUETE);
console.log(`BASE (antes) · trinquete: ${base.tests} tests · ${base.fail} caídos · salida ${base.salida}`);
if (base.fail !== 0 || !(base.tests > 0)) { console.error('🔴 la base no está verde: no se muta nada'); process.exit(2); }

// Cada mutación acaba en una de TRES. Una pasada sin recuento no es un VERDE: es no haber mirado.
const cuenta = { ROJO: 0, VERDE: 0, CIEGO: 0 };
for (const m of MUTACIONES) {
  console.log(`${m.id} · ${m.que}`);
  if (!mutar(m)) { cuenta.CIEGO++; continue; }
  const r = tests(TRINQUETE);
  let sale;
  if (!(r.tests > 0) || Number.isNaN(r.fail)) sale = 'CIEGO';
  else if (r.fail > 0) sale = 'ROJO';
  else sale = 'VERDE';
  cuenta[sale]++;
  console.log(`  ${sale} · ${r.tests} tests · ${r.fail} caídos · ${r.caidos.join(' || ')}`);
  restaurar();
}

const fin = tests(TRINQUETE);
console.log(`BASE (después) · trinquete: ${fin.tests} tests · ${fin.fail} caídos · salida ${fin.salida}`);
const baseRota = fin.fail !== 0 || !(fin.tests > 0);
console.log(`RECUENTO · ${MUTACIONES.length} mutaciones · ${cuenta.ROJO} ROJO · ${cuenta.VERDE} VERDE · ${cuenta.CIEGO} CIEGO`);
const salida = cuenta.VERDE || cuenta.CIEGO || baseRota ? 1 : 0;
console.log(`EXIT=${salida}`);
process.exit(salida);
