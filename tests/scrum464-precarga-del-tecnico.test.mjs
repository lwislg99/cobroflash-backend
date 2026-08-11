// tests/scrum464-precarga-del-tecnico.test.mjs — SCRUM-464 (H1 · fase 4)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: un merchant con equipo. El dueño está en la oficina; **el que baja al sótano es el
// operario**. Con la precarga admin-only, el profesional que de verdad necesita el albarán delante
// era justo el que no lo llevaba: H1 resolvía el problema para la persona equivocada.
//
// 🔴 Y VA FILTRADA. Darle el merchant entero era trivial y era **lo peor por RGPD**: el móvil de
// cada técnico llevaría la cartera completa del negocio. La minimización importa MÁS en el móvil de
// un técnico, no menos — es el aparato que más manos toca y sobre el que menos control tiene el
// dueño.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  construirPaquetePrecarga, whereDePrecarga, condicionDelTecnico, esDelTecnico,
  PRECARGA_LISTA, PRECARGA_NO_SE_PUDO,
} from '../dist/modules/jobs/domain/precarga.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = new Date('2026-08-11T10:00:00.000Z');

const ANA = 11;   // técnica
const BRUNO = 22; // técnico

/** Prisma de mentira que APLICA el `where` de verdad, incluido el `AND` anidado del filtro. */
function prismaFalso({ jobs = [], albaranes = [], clientes = [], revienta = null } = {}) {
  const reg = { where: {} };
  const casaCond = (f, c) => {
    if (c.merchantId !== undefined && f.merchantId !== c.merchantId) return false;
    if (c.OR && !c.OR.some((sub) => casaCond(f, sub))) return false;
    if (c.AND && !c.AND.every((sub) => casaCond(f, sub))) return false;
    if (c.assignedUserId !== undefined && f.assignedUserId !== c.assignedUserId) return false;
    if (c.operarioId !== undefined && f.operarioId !== c.operarioId) return false;
    if (c.status && c.status.not !== undefined && f.status === c.status.not) return false;
    if (c.updatedAt && c.updatedAt.gte && !(f.updatedAt >= c.updatedAt.gte)) return false;
    if (c.scheduledAt) {
      if (!f.scheduledAt) return false;
      if (!(f.scheduledAt >= c.scheduledAt.gte && f.scheduledAt < c.scheduledAt.lt)) return false;
    }
    if (c.jobId && c.jobId.in && !c.jobId.in.includes(f.jobId)) return false;
    if (c.estado !== undefined && f.estado !== c.estado) return false;
    if (c.id && c.id.in && !c.id.in.includes(f.id)) return false;
    return true;
  };
  const tabla = (nombre, filas) => ({
    findMany: async ({ where }) => {
      reg.where[nombre] = where;
      if (revienta === nombre) throw new Error(`la base no contestó (${nombre})`);
      return filas.filter((f) => casaCond(f, where));
    },
  });
  return { reg, job: tabla('job', jobs), albaran: tabla('albaran', albaranes), customer: tabla('customer', clientes) };
}

const JOB = (o) => ({
  id: 1, merchantId: 7, customerId: 100, titulo: 'Trabajo',
  status: 'en_curso', scheduledAt: null, updatedAt: AHORA,
  assignedUserId: null, operarioId: null, ...o,
});
const ALB = (o) => ({
  id: 10, merchantId: 7, jobId: 1, numero: 'ALB-001', estado: 'emitido',
  fecha: AHORA, fechaEntrega: null, lugarEntrega: null, modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'x', cantidad: 1, unidad: 'ud' }], notas: null, ...o,
});
const CLI = (o) => ({ id: 100, merchantId: 7, name: 'Cliente', ...o });

/** El escenario del ticket: un dueño que reparte, y dos técnicos. */
function equipo() {
  return prismaFalso({
    jobs: [
      // Los DOS de Ana, uno por cada camino: uno se lo asignó el dueño (que lo creó, así que
      // `operarioId` es null) y el otro lo creó ella misma en obra.
      JOB({ id: 1, assignedUserId: ANA, operarioId: null, titulo: 'Bajante Los Olivos' }),
      JOB({ id: 2, assignedUserId: null, operarioId: ANA, titulo: 'Caldera de Ana' }),
      // Y el de Bruno, que Ana no puede llevar de ninguna manera.
      JOB({ id: 3, assignedUserId: BRUNO, operarioId: BRUNO, titulo: 'Obra de Bruno' }),
      // Y uno del dueño, sin nadie detrás.
      JOB({ id: 4, assignedUserId: null, operarioId: null, titulo: 'Cosa del dueño' }),
    ],
    albaranes: [
      ALB({ id: 10, jobId: 1, numero: 'ALB-ANA-ASIGNADO' }),
      ALB({ id: 20, jobId: 2, numero: 'ALB-ANA-PROPIO' }),
      ALB({ id: 30, jobId: 3, numero: 'ALB-DE-BRUNO' }),
      ALB({ id: 40, jobId: 4, numero: 'ALB-DEL-DUENO' }),
    ],
    clientes: [CLI({})],
  });
}

// ═══ ① CONTROL POSITIVO: la técnica recibe SUS DOS, por los dos caminos ══════════════════

test('SCRUM-464 · una técnica con dos trabajos suyos recibe ESOS DOS, con sus albaranes', async () => {
  const r = await construirPaquetePrecarga(7, AHORA, equipo(), ANA);

  assert.equal(r.estado, PRECARGA_LISTA, `🔴 no se pudo construir: ${r.motivo}`);
  assert.deepEqual([...r.albaranes.map((a) => a.numero)].sort(), ['ALB-ANA-ASIGNADO', 'ALB-ANA-PROPIO'],
    `🔴 la técnica recibe ${JSON.stringify(r.albaranes.map((a) => a.numero))}. Tenía que llevarse ` +
    'los dos suyos: el que le ASIGNARON y el que CREÓ ella. Si falta el asignado, la unión ha ' +
    'degenerado a `operarioId` y la víctima de este ticket se queda sin nada en el sótano.');
});

// ═══ ② EL CONTROL NEGATIVO QUE IMPORTA, CON SU POSITIVO DENTRO ═══════════════════════════

test('SCRUM-464 · la técnica A no obtiene NADA de B, ni pidiéndolo', async () => {
  const deAna = await construirPaquetePrecarga(7, AHORA, equipo(), ANA);

  // 🔴 EL HERMANO POSITIVO (regla de SCRUM-237): se pide el paquete de B COMO B y se comprueba que
  // lo suyo SÍ está ahí. Sin esto, «no aparece nada de Bruno» sería cierto porque ese albarán no
  // existe en ningún sitio, no porque esté aislado.
  const deBruno = await construirPaquetePrecarga(7, AHORA, equipo(), BRUNO);
  assert.ok(/ALB-DE-BRUNO/.test(JSON.stringify(deBruno)),
    '🔴 SUELO: el albarán de Bruno no aparece ni en SU PROPIO paquete, así que el fixture no tiene ' +
    'nada que aislar y la comprobación de abajo sería un verde vacío.');
  assert.ok(/Obra de Bruno/.test(JSON.stringify(deBruno)),
    '🔴 SUELO: el título del trabajo de Bruno no llega ni a su propio paquete.');

  const texto = JSON.stringify(deAna);
  assert.ok(!/ALB-DE-BRUNO/.test(texto),
    `🔴 UN TÉCNICO ESTÁ RECIBIENDO TRABAJOS QUE NO SON SUYOS: en el paquete de Ana hay un albarán ` +
    `de Bruno. ${texto}`);
  assert.ok(!/Obra de Bruno/.test(texto),
    '🔴 UN TÉCNICO ESTÁ RECIBIENDO TRABAJOS QUE NO SON SUYOS: el título del trabajo de Bruno viaja ' +
    'en el paquete de Ana.');
  // Y su hermano positivo, por el mismo motivo: el albarán del dueño TIENE que existir y ser
  // alcanzable —lo es en el paquete del dueño— para que «no está en el de Ana» signifique algo.
  const delDueno = await construirPaquetePrecarga(7, AHORA, equipo());
  assert.ok(/ALB-DEL-DUENO/.test(JSON.stringify(delDueno)),
    '🔴 SUELO: el albarán del dueño no aparece ni en el paquete del dueño.');
  assert.ok(!/ALB-DEL-DUENO/.test(texto),
    '🔴 la técnica se lleva un albarán de un trabajo que no ha tocado nadie del equipo. La unión ' +
    'es «o lo creó él, o se lo asignaron», no «todo lo que hay».');
});

// ═══ ③ EL DUEÑO NO CAMBIA — lo más fácil de romper sin darse cuenta ══════════════════════

test('SCRUM-464 · REGRESIÓN: el dueño sigue recibiendo TODO lo del merchant', async () => {
  const r = await construirPaquetePrecarga(7, AHORA, equipo());
  assert.deepEqual([...r.albaranes.map((a) => a.numero)].sort(),
    ['ALB-ANA-ASIGNADO', 'ALB-ANA-PROPIO', 'ALB-DEL-DUENO', 'ALB-DE-BRUNO'].sort(),
    `🔴 el dueño ha dejado de recibir todo: ${JSON.stringify(r.albaranes.map((a) => a.numero))}.`);
});

test('SCRUM-464 · REGRESIÓN: sin técnico, el `where` es EXACTAMENTE el de antes', () => {
  // El contraste consulta-vs-criterio de SCRUM-458 depende de esta forma. Si cambia, aquel test
  // dejaría de medir lo que dice medir aunque siguiera verde.
  const w = whereDePrecarga(7, AHORA);
  assert.equal(w.AND, undefined,
    `🔴 el paquete del dueño ha ganado un \`AND\`: ${JSON.stringify(w)}. La forma tenía que quedarse igual.`);
  assert.equal(Array.isArray(w.OR) && w.OR.length, 2, '🔴 han cambiado las dos poblaciones del dueño.');
  // Y con técnico sí cambia, o «no cambió» sería cierto porque el filtro no existe.
  const wt = whereDePrecarga(7, AHORA, ANA);
  assert.ok(Array.isArray(wt.AND) && wt.AND.length === 2,
    `🔴 con técnico el \`where\` no filtra nada: ${JSON.stringify(wt)}.`);
});

// ═══ ④ LA CONSULTA Y EL CRITERIO, otra vez: no pueden divergir ═══════════════════════════

test('SCRUM-464 · lo devuelto es DE VERDAD suyo, comprobado campo a campo', async () => {
  // Mirar solo el resultado aprobaría también a un filtro que no filtra si el fixture acompañara.
  // Aquí se comprueba cada trabajo devuelto contra el criterio puro.
  const p = equipo();
  const r = await construirPaquetePrecarga(7, AHORA, p, ANA);
  assert.ok(r.albaranes.length > 0, '🔴 SUELO: sin nada devuelto, «todo es suyo» es trivial.');

  const w = p.reg.where.job;
  assert.deepEqual(w.AND[1], condicionDelTecnico(ANA),
    `🔴 la consulta no lleva la condición del técnico: ${JSON.stringify(w.AND && w.AND[1])}.`);
  for (const caso of [
    { job: { assignedUserId: ANA, operarioId: null }, suyo: true },
    { job: { assignedUserId: null, operarioId: ANA }, suyo: true },
    { job: { assignedUserId: BRUNO, operarioId: BRUNO }, suyo: false },
    { job: { assignedUserId: null, operarioId: null }, suyo: false },
  ]) {
    assert.equal(esDelTecnico(caso.job, ANA), caso.suyo,
      `🔴 el criterio dice ${esDelTecnico(caso.job, ANA)} para ${JSON.stringify(caso.job)}.`);
  }
});

// ═══ ⑤ SUELO: TRES estados, también para el técnico ══════════════════════════════════════

test('SCRUM-464 · una técnica SIN trabajos asignados produce «no había nada», no un fallo', async () => {
  const SIN_NADA = 33;
  const r = await construirPaquetePrecarga(7, AHORA, equipo(), SIN_NADA);
  assert.equal(r.estado, PRECARGA_LISTA,
    `🔴 una técnica sin trabajos sale como fallo: ${JSON.stringify(r)}. «No había nada» y «no supe ` +
    'mirar» lo dejan igual en el sótano, y por eso tienen que salir por puertas distintas.');
  assert.deepEqual(r.albaranes, []);
  assert.equal(r.motivo, undefined, '🔴 un paquete vacío legítimo no lleva motivo de fallo.');
});

test('SCRUM-464 · y si la consulta no se puede ejecutar, sigue saliendo por la otra puerta', async () => {
  const p = prismaFalso({ jobs: [JOB({ operarioId: ANA })], revienta: 'job' });
  const r = await construirPaquetePrecarga(7, AHORA, p, ANA);
  assert.equal(r.estado, PRECARGA_NO_SE_PUDO, '🔴 el fallo se cuenta como «no había nada».');
  assert.ok(r.motivo);
});

// ═══ ⑥ EL AISLAMIENTO ENTRE MERCHANTS NO SE RELAJA — esto añade una capa, no sustituye ═══

test('SCRUM-464 · el filtro por técnico NO sustituye al filtro por merchant', async () => {
  const p = prismaFalso({
    jobs: [
      JOB({ id: 1, merchantId: 7, operarioId: ANA, titulo: 'Lo de Ana aquí' }),
      // Mismo id de miembro, OTRO merchant. Un `teamMemberId` es único por tabla, pero el filtro
      // no puede apoyarse en eso: si mañana se colara un id repetido, el merchant tiene que parar.
      JOB({ id: 2, merchantId: 99, operarioId: ANA, titulo: 'Lo de OTRO negocio' }),
    ],
    albaranes: [
      ALB({ id: 10, merchantId: 7, jobId: 1, numero: 'ALB-MIO' }),
      ALB({ id: 20, merchantId: 99, jobId: 2, numero: 'ALB-DE-OTRO-NEGOCIO' }),
    ],
    clientes: [CLI({ id: 100, merchantId: 7 }), CLI({ id: 100, merchantId: 99, name: 'Cliente ajeno' })],
  });
  const r = await construirPaquetePrecarga(7, AHORA, p, ANA);

  assert.deepEqual(r.albaranes.map((a) => a.numero), ['ALB-MIO'],
    `🔴 ${JSON.stringify(r.albaranes.map((a) => a.numero))}: el filtro por técnico se ha comido al ` +
    'de merchant. Esto AÑADE una capa, no sustituye la de abajo.');
  // Y por el MECANISMO: las tres consultas siguen llevando `merchantId`.
  for (const tabla of ['job', 'albaran', 'customer']) {
    assert.equal(p.reg.where[tabla]?.merchantId, 7,
      `🔴 la consulta de \`${tabla}\` ha dejado de filtrar por merchant: ${JSON.stringify(p.reg.where[tabla])}.`);
  }
});

// ═══ ⑦ LA RUTA: el rol se pregunta con la allowlist, no con una denylist ═════════════════

test('SCRUM-464 · la ruta resuelve el rol con `seesAllJobs`, no comparando con «tecnico»', () => {
  const fuente = fs.readFileSync(
    path.join(RAIZ, 'src/modules/jobs/app/routes/precargaAdmin.routes.ts'), 'utf8',
  );
  const codigo = fuente.replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, '');

  assert.ok(/seesAllJobs\(/.test(codigo),
    '🔴 la ruta no usa la allowlist de la casa. Con una denylist, un rol NUEVO se llevaría el ' +
    'merchant entero al móvil — es exactamente el defecto de SCRUM-147.');
  // ⚠️ SE BUSCA LA COMPARACIÓN, NO LA PALABRA. Buscar `'tecnico'` a secas nació rojo señalando la
  // ANOTACIÓN DE TIPO (`userRole: 'admin' | 'tecnico'`), que no decide nada. Un escáner que da ruido
  // acaba relajado hasta quedarse ciego (SCRUM-451), así que se busca lo que sí sería la denylist.
  const comparaciones = codigo.match(/[!=]==?\s*['"]tecnico['"]|['"]tecnico['"]\s*[!=]==?/g) || [];
  assert.deepEqual(comparaciones, [],
    `🔴 la ruta COMPARA con el literal «tecnico» (${comparaciones.join(', ')}): eso es la denylist ` +
    'que `roleCapabilities` existe para eliminar, y con ella un rol nuevo se lleva el merchant entero.');
  assert.ok(!/requireRole\(/.test(codigo),
    '🔴 la ruta sigue con `requireRole`: entonces el operario, que es el que baja al sótano, sigue ' +
    'sin llevarse nada.');
  // Y el fail-closed del caso imposible, que es lo que impide que el fallo se abra hacia el lado malo.
  assert.ok(/teamMemberId == null|teamMemberId === null/.test(codigo),
    '🔴 no hay guarda para un no-admin sin `teamMemberId`: ahí `soloDelTecnico` sería `null` y eso ' +
    'significa EL MERCHANT ENTERO. El fallo se abriría hacia el lado malo, y en silencio.');
});
