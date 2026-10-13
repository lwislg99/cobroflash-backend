// docs/evidencias/scrum1408/rojo-primero.mjs — SCRUM-1408
//
// VER CAER el guard con una violación de verdad, sobre el árbol de verdad, y dejarlo como estaba.
//
//   node docs/evidencias/scrum1408/rojo-primero.mjs
//
// Cada inyección escribe en `src/`, lanza el test en un proceso aparte y RESTAURA en un `finally`.
// Al final se comprueba por contenido (sha256) que `src/` quedó idéntico, y que la base sin
// inyectar pasa antes y después. No se comitea nada de lo inyectado.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..');
const TEST = 'tests/scrum1408-asignar-no-es-un-permiso.test.mjs';
const MODULO = 'src/core/documentos/asignacionDeDocumento.ts';

const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, rel))).digest('hex');

// El entorno del hijo se construye a mano: sin el contexto de un `node --test` de fuera ni color.
const entorno = { ...process.env };
for (const k of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'FORCE_COLOR']) delete entorno[k];

function pasada() {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: RAIZ, encoding: 'utf8', env: entorno });
  const tap = r.stdout || '';
  const n = (clave) => Number((tap.match(new RegExp(`^# ${clave} (\\d+)$`, 'm')) || [])[1] ?? NaN);
  const caen = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  return { salida: r.status, tests: n('tests'), pass: n('pass'), fail: n('fail'), caen };
}

const INYECCIONES = [
  {
    nombre: 'I1 · un «¿puede?» exportado en el módulo',
    cae: 'SCRUM-1408 · A:',
    fichero: MODULO,
    texto: (antes) => `${antes}\nexport function puedeEditarElDocumento(rol: string): boolean { return rol === 'admin'; }\n`,
  },
  {
    nombre: 'I2 · una función del módulo pasa a contestar sí o no (mismo nombre, mismo export)',
    cae: 'SCRUM-1408 · A:',
    fichero: MODULO,
    texto: (antes) => antes.replace('): Promise<Array<{ id: number; name: string }>> {', '): Promise<boolean> {'),
  },
  {
    nombre: 'I3 · un tercer fichero filtra por la relación `asignados`',
    cae: 'SCRUM-1408 · B:',
    fichero: 'src/core/documentos/zzInyeccion1408.ts',
    texto: () => 'export const whereDeEscritura = (persona: number) => ({ asignados: { some: { teamMemberId: persona } } });\n',
  },
  {
    nombre: 'I4 · un fichero lejano lee la tabla puente por su modelo',
    cae: 'SCRUM-1408 · B:',
    fichero: 'src/modules/expenses/zzInyeccion1408.ts',
    texto: () => 'export const lee = (prisma: any, id: number) => prisma.quoteAssignee.findMany({ where: { teamMemberId: id } });\n',
  },
];

const shaAntes = sha(MODULO);
const filas = [];
let mal = 0;

const base = pasada();
filas.push(`BASE antes  · salida ${base.salida} · tests ${base.tests} · pass ${base.pass} · fail ${base.fail}`);
if (base.salida !== 0 || !(base.tests > 0) || base.fail !== 0) { console.log(filas.join('\n')); console.log('🔴 CIEGO: la base no está verde; ninguna inyección vale'); process.exit(2); }

for (const iny of INYECCIONES) {
  const abs = path.join(RAIZ, iny.fichero);
  const existia = fs.existsSync(abs);
  const antes = existia ? fs.readFileSync(abs, 'utf8') : '';
  const despues = iny.texto(antes);
  let r;
  try {
    if (despues === antes) { filas.push(`${iny.nombre} · 🔴 CIEGA: la inyección no cambió el fichero`); mal++; continue; }
    fs.writeFileSync(abs, despues);
    r = pasada();
  } finally {
    if (existia) fs.writeFileSync(abs, antes); else fs.rmSync(abs, { force: true });
  }
  const cazada = r.salida !== 0 && r.fail === 1 && r.caen.length === 1 && r.caen[0].startsWith(iny.cae);
  if (!cazada) mal++;
  filas.push(`${iny.nombre} · ${cazada ? 'CAE' : '🔴 NO CAE como debía'} · salida ${r.salida} · tests ${r.tests} · fail ${r.fail} · cae: ${r.caen.join(' | ') || '(nada)'}`);
}

const fin = pasada();
filas.push(`BASE después · salida ${fin.salida} · tests ${fin.tests} · pass ${fin.pass} · fail ${fin.fail}`);
const intacto = sha(MODULO) === shaAntes && INYECCIONES.every((i) => i.fichero === MODULO || !fs.existsSync(path.join(RAIZ, i.fichero)));
filas.push(`ÁRBOL · ${intacto ? 'intacto' : '🔴 NO quedó como estaba'} · sha256 de ${MODULO}: ${sha(MODULO)}`);
if (fin.salida !== 0 || !intacto) mal++;

console.log(filas.join('\n'));
console.log(`POBLACIÓN: ${INYECCIONES.length} inyecciones · ${INYECCIONES.length - mal < 0 ? 0 : INYECCIONES.length - mal} como debían · EXIT=${mal ? 1 : 0}`);
process.exit(mal ? 1 : 0);
