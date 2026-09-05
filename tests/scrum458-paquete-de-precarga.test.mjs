// tests/scrum458-paquete-de-precarga.test.mjs — SCRUM-458 (H1 · fase 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: el fundador decidió que **no se crean albaranes sin red, solo se firman**. Si el
// albarán no bajó, **no hay nada que firmar**. Esto ya no cuesta comodidad: cuesta el trabajo del
// profesional.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  motivosDePrecarga, whereDePrecarga, ventanaDePrecarga, construirPaquetePrecarga,
  albaranParaFirmar, ESTADO_CERRADO, ALBARAN_FIRMABLE,
  PRECARGA_LISTA, PRECARGA_NO_SE_PUDO, PRECARGA_DIAS_ATRAS,
} from '../dist/modules/jobs/domain/precarga.service.js';
import { JOB_STATES } from '../dist/modules/jobs/domain/job.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = new Date('2026-08-10T18:00:00.000Z');
const dias = (n) => new Date(AHORA.getTime() + n * 24 * 3600 * 1000);

/** Un Prisma de mentira: devuelve lo que se le da y REGISTRA con qué `where` se le preguntó. */
function prismaFalso({ jobs = [], albaranes = [], clientes = [], revienta = null } = {}) {
  const reg = { where: {} };
  const tabla = (nombre, filas) => ({
    findMany: async ({ where }) => {
      reg.where[nombre] = where;
      if (revienta === nombre) throw new Error(`la base no contestó (${nombre})`);
      return filas.filter((f) => {
        // Se respeta el filtro por merchant, que es lo que este banco tiene que poder medir.
        if (where.merchantId !== undefined && f.merchantId !== where.merchantId) return false;
        if (where.jobId && where.jobId.in && !where.jobId.in.includes(f.jobId)) return false;
        if (where.estado !== undefined && f.estado !== where.estado) return false;
        if (where.id && where.id.in && !where.id.in.includes(f.id)) return false;
        return true;
      });
    },
  });
  return { reg, job: tabla('job', jobs), albaran: tabla('albaran', albaranes), customer: tabla('customer', clientes) };
}

const JOB = (o) => ({
  id: 1, merchantId: 7, customerId: 100, titulo: 'Baño Los Olivos',
  status: 'en_curso', scheduledAt: null, updatedAt: AHORA, ...o,
});
const ALB = (o) => ({
  id: 10, merchantId: 7, jobId: 1, numero: 'ALB-2026-001', estado: ALBARAN_FIRMABLE,
  fecha: AHORA, fechaEntrega: null, lugarEntrega: null, modoValoracion: 'SIN_VALORAR',
  lineas: [{ concepto: 'Sustituir bajante', cantidad: 1, unidad: 'ud' }], notas: null, ...o,
});
const CLI = (o) => ({ id: 100, merchantId: 7, name: 'Comunidad Los Olivos', ...o });

// ═══ ① EL CONTROL POSITIVO: las DOS poblaciones, cada una UNA vez ════════════════════════

test('SCRUM-458 · el paquete trae el agendado de hoy Y el no cerrado de hace 5 días', async () => {
  const p = prismaFalso({
    jobs: [
      JOB({ id: 1, status: 'agendado', scheduledAt: AHORA, updatedAt: dias(-30) }),   // solo ①
      JOB({ id: 2, status: 'en_curso', scheduledAt: null, updatedAt: dias(-5) }),      // solo ②
    ],
    albaranes: [ALB({ id: 10, jobId: 1 }), ALB({ id: 20, jobId: 2, numero: 'ALB-2026-002' })],
    clientes: [CLI({})],
  });
  const r = await construirPaquetePrecarga(7, AHORA, p);

  assert.equal(r.estado, PRECARGA_LISTA, `🔴 el paquete no se pudo construir: ${r.motivo}`);
  assert.deepEqual(r.albaranes.map((a) => a.id).sort(), [10, 20],
    `🔴 el paquete no trae los dos albaranes: ${JSON.stringify(r.albaranes.map((a) => a.id))}. Uno ` +
    'de los dos profesionales se va al sótano sin nada que firmar.');
  assert.equal(r.trabajos.agendados, 1, '🔴 no se ha contado el trabajo AGENDADO.');
  assert.equal(r.trabajos.recientes, 1, '🔴 no se ha contado el trabajo NO CERRADO reciente.');
  // 🔴 El caso que prueba que NO es una cascada: el agendado de mañana lleva un mes sin tocarse,
  // así que la población ② no lo coge. Si alguien colapsara las dos, este trabajo desaparecería.
  assert.deepEqual(motivosDePrecarga(JOB({ scheduledAt: AHORA, updatedAt: dias(-30) }), AHORA), ['agendado'],
    '🔴 un trabajo agendado para hoy pero sin tocar en un mes ha dejado de entrar por la agenda.');
});

test('SCRUM-458 · un trabajo en LAS DOS poblaciones se precarga UNA sola vez', async () => {
  // Se solapan a propósito: agendado para mañana Y modificado ayer.
  const p = prismaFalso({
    jobs: [JOB({ id: 1, status: 'agendado', scheduledAt: dias(1), updatedAt: dias(-1) })],
    albaranes: [ALB({ id: 10, jobId: 1 })],
    clientes: [CLI({})],
  });
  const r = await construirPaquetePrecarga(7, AHORA, p);

  assert.equal(r.trabajos.enAmbas, 1,
    '🔴 este trabajo tenía que caer en LAS DOS poblaciones; si no, el test no mide la ' +
    'deduplicación. Son dos poblaciones que se solapan y ése es el caso.');
  assert.equal(r.trabajos.total, 1, `🔴 el trabajo se ha contado ${r.trabajos.total} veces.`);
  assert.equal(r.albaranes.length, 1,
    `🔴 el albarán se ha precargado ${r.albaranes.length} veces. Duplicar no es inofensivo: ` +
    'ocupa cuota del móvil y pinta dos veces el mismo documento en una lista donde hay que ' +
    'elegir cuál firmar.');
});

// ═══ ② CONTROL NEGATIVO — sin esto, «unión» acaba significando «todo» ════════════════════

test('SCRUM-458 · lo de dentro de un mes y lo de hace dos meses NO entran', async () => {
  const p = prismaFalso({
    jobs: [
      JOB({ id: 1, status: 'agendado', scheduledAt: dias(30), updatedAt: dias(-30) }),
      JOB({ id: 2, status: 'en_curso', scheduledAt: null, updatedAt: dias(-60) }),
    ],
    albaranes: [ALB({ id: 10, jobId: 1 }), ALB({ id: 20, jobId: 2 })],
    clientes: [CLI({})],
  });
  const r = await construirPaquetePrecarga(7, AHORA, p);

  // Control positivo DENTRO: el banco SÍ tenía trabajos y albaranes que dar. Si no, «no entra
  // nada» sería cierto sin significar nada.
  assert.equal(r.estado, PRECARGA_LISTA);
  assert.deepEqual(motivosDePrecarga(JOB({ scheduledAt: dias(30), updatedAt: dias(-30) }), AHORA), [],
    '🔴 un trabajo agendado para dentro de un mes entra en el paquete. Eso no es precarga: es ' +
    'bajarse la agenda entera al móvil, con los datos de todos esos clientes dentro.');
  assert.deepEqual(motivosDePrecarga(JOB({ updatedAt: dias(-60) }), AHORA), [],
    '🔴 un trabajo sin tocar en dos meses sigue entrando por «reciente».');
  const v = ventanaDePrecarga(AHORA);
  assert.equal(Math.round((AHORA - v.desdeReciente) / 86400000), PRECARGA_DIAS_ATRAS,
    '🔴 la ventana hacia atrás no son los días que dice la constante.');
});

// ═══ ③ AISLAMIENTO POR MERCHANT — lo peor que puede fallar aquí ══════════════════════════

test('SCRUM-458 · el paquete de un profesional NO trae NADA de otro', async () => {
  const dosProfesionales = () => prismaFalso({
    jobs: [
      JOB({ id: 1, merchantId: 7, customerId: 100 }),
      JOB({ id: 2, merchantId: 99, customerId: 200, titulo: 'Obra del vecino' }),
    ],
    albaranes: [
      ALB({ id: 10, merchantId: 7, jobId: 1 }),
      ALB({ id: 99, merchantId: 99, jobId: 2, numero: 'ALB-AJENO' }),
    ],
    clientes: [CLI({ id: 100, merchantId: 7 }), CLI({ id: 200, merchantId: 99, name: 'Cliente ajeno' })],
  });
  const p = dosProfesionales();
  const r = await construirPaquetePrecarga(7, AHORA, p);

  // 🔴 EL HERMANO POSITIVO, y sin él la negación de abajo no vale nada (SCRUM-237): se pide el
  // paquete DEL OTRO profesional con el MISMO fixture. Si «ALB-AJENO» no apareciera ahí, «no
  // aparece en el de 7» sería cierto porque ese dato no existe en ningún sitio, no porque esté
  // aislado.
  //
  // ⚠️ Va en OTRA instancia del banco a propósito: el registro de `where` es del banco, y pedir el
  // paquete ajeno con el mismo lo pisaba — la comprobación por mecanismo de abajo leía el
  // `merchantId` de la llamada hermana y caía sola. (Rojo del test, no del producto.)
  const ajeno = JSON.stringify(await construirPaquetePrecarga(99, AHORA, dosProfesionales()));
  // Y LOS TRES tokens, uno a uno: si solo se respaldara el primero, los otros dos podrían no
  // existir en ningún sitio y su ausencia abajo no significaría nada. Son tres datos distintos —
  // el número del documento, el nombre del cliente y el título del trabajo— y los tres tienen que
  // ser alcanzables para que «no están en el paquete de 7» sea una afirmación.
  assert.ok(/ALB-AJENO/.test(ajeno),
    '🔴 SUELO: el albarán del otro profesional no aparece ni en SU PROPIO paquete.');
  assert.ok(/Cliente ajeno/.test(ajeno),
    '🔴 SUELO: el nombre del cliente del otro profesional no aparece ni en SU PROPIO paquete.');
  assert.ok(/Obra del vecino/.test(ajeno),
    '🔴 SUELO: el título del trabajo del otro profesional no aparece ni en SU PROPIO paquete.');

  assert.equal(r.albaranes.length, 1,
    `🔴 el paquete trae ${r.albaranes.length} albaranes: ${JSON.stringify(r.albaranes.map((a) => a.numero))}.`);
  const texto = JSON.stringify(r);
  assert.ok(!/ALB-AJENO|Cliente ajeno|Obra del vecino/.test(texto),
    `🔴 en el paquete de un profesional hay datos de OTRO: ${texto}. Es lo peor que puede fallar ` +
    'aquí: ese móvil se comparte en la furgoneta.');
  // Y por el MECANISMO, no solo por el resultado: las TRES consultas filtran por merchant. Un
  // resultado limpio con un `where` sin filtrar es una coincidencia del fixture, no una garantía.
  for (const tabla of ['job', 'albaran', 'customer']) {
    assert.equal(p.reg.where[tabla]?.merchantId, 7,
      `🔴 la consulta de \`${tabla}\` NO filtra por merchant (${JSON.stringify(p.reg.where[tabla])}). ` +
      'Hoy sale bien por cómo está el fixture; mañana no.');
  }
});

// ═══ ④ EL SUELO: vacío NO es lo mismo que no se supo ═════════════════════════════════════

test('SCRUM-458 · si la consulta no se puede ejecutar, NO devuelve lista vacía', async () => {
  const p = prismaFalso({ jobs: [JOB({})], albaranes: [ALB({})], clientes: [CLI({})], revienta: 'job' });
  const r = await construirPaquetePrecarga(7, AHORA, p);

  assert.equal(r.estado, PRECARGA_NO_SE_PUDO,
    '🔴 la consulta falló y el paquete dice estar LISTO con cero albaranes. «No había nada» y «no ' +
    'supe mirar» dejan al profesional EXACTAMENTE IGUAL: en el sótano, sin albarán, creyendo que ' +
    'iba preparado. Tienen que distinguirse.');
  assert.ok(r.motivo, '🔴 se declara NO_SE_PUDO sin decir por qué: nadie puede actuar sobre eso.');
  assert.deepEqual(r.albaranes, [], '🔴 un paquete que no se pudo construir no puede traer nada.');
});

test('SCRUM-458 · vacío DE VERDAD se distingue de no haber podido mirar', async () => {
  const r = await construirPaquetePrecarga(7, AHORA, prismaFalso({}));
  assert.equal(r.estado, PRECARGA_LISTA,
    '🔴 un merchant sin nada que precargar sale como fallo. Entonces el estado no distingue nada.');
  assert.equal(r.motivo, undefined, '🔴 un paquete vacío legítimo no lleva motivo de fallo.');
});

// ═══ ⑤ EL GUARD DE LOS ESTADOS: la inclusión se decide, no se hereda ═════════════════════

test('SCRUM-458 · si aparece un estado de Job nuevo, este test lo NOMBRA', async () => {
  // 🔴 La población ② se escribe NEGADA (`!= 'cerrado'`) a propósito: enumerar los cuatro dejaría
  // fuera EN SILENCIO cualquier estado nuevo, y un fontanero se quedaría en un sótano sin nada que
  // firmar. Negado entra solo — pero «entra solo» no puede ser «entra sin que nadie se entere».
  const CONOCIDOS = ['pendiente_agendar', 'agendado', 'en_curso', 'terminado', 'cerrado'];
  const nuevos = JOB_STATES.filter((s) => !CONOCIDOS.includes(s));
  assert.deepEqual(nuevos, [],
    `🔴 hay estados de Job que nadie ha decidido si se precargan: ${nuevos.join(', ')}. Con la ` +
    'condición negada ENTRAN SOLOS en la población de «no cerrados», que es el lado seguro — pero ' +
    'la inclusión se decide, no se hereda. Revísalo y añádelo a la lista de conocidos.');
  // SUELO: si la lista de estados se vaciara, «no hay nuevos» sería cierto y no diría nada.
  assert.equal(JOB_STATES.length, CONOCIDOS.length,
    `🔴 SUELO: la FSM tiene ${JOB_STATES.length} estados y este guard conoce ${CONOCIDOS.length}.`);
  assert.ok(JOB_STATES.includes(ESTADO_CERRADO),
    `🔴 SUELO: \`${ESTADO_CERRADO}\` ya no es un estado de la FSM, así que la condición negada de ` +
    'la precarga no está excluyendo nada.');
  // Y que la condición sea NEGADA, no una lista: es la mitad de la decisión.
  const w = whereDePrecarga(7, AHORA);
  assert.deepEqual(w.OR[1].status, { not: ESTADO_CERRADO },
    `🔴 la población de «no cerrados» ha dejado de escribirse negada: ${JSON.stringify(w.OR[1].status)}. ` +
    'Enumerar los estados deja fuera en silencio al que se añada mañana.');
});

test('SCRUM-458 · la consulta y la clasificación NO pueden divergir', async () => {
  // Derivan de las mismas constantes, pero «derivan de lo mismo» no es «hacen lo mismo».
  const casos = [
    { nombre: 'agendado hoy', job: JOB({ scheduledAt: AHORA, updatedAt: dias(-30) }), entra: true },
    { nombre: 'agendado mañana', job: JOB({ scheduledAt: dias(1), updatedAt: dias(-30) }), entra: true },
    { nombre: 'agendado en un mes', job: JOB({ scheduledAt: dias(30), updatedAt: dias(-30) }), entra: false },
    { nombre: 'no cerrado de ayer', job: JOB({ scheduledAt: null, updatedAt: dias(-1) }), entra: true },
    { nombre: 'no cerrado de hace 2 meses', job: JOB({ scheduledAt: null, updatedAt: dias(-60) }), entra: false },
    { nombre: 'CERRADO de ayer', job: JOB({ status: ESTADO_CERRADO, updatedAt: dias(-1) }), entra: false },
    { nombre: 'CERRADO pero agendado hoy', job: JOB({ status: ESTADO_CERRADO, scheduledAt: AHORA }), entra: true },
  ];
  const w = whereDePrecarga(7, AHORA);
  const porElWhere = (j) => w.OR.some((c) => {
    if (c.scheduledAt) return j.scheduledAt && j.scheduledAt >= c.scheduledAt.gte && j.scheduledAt < c.scheduledAt.lt;
    return j.status !== c.status.not && j.updatedAt >= c.updatedAt.gte;
  });
  for (const c of casos) {
    const porElCriterio = motivosDePrecarga(c.job, AHORA).length > 0;
    assert.equal(porElCriterio, c.entra, `🔴 «${c.nombre}»: el criterio dice ${porElCriterio}, se esperaba ${c.entra}.`);
    assert.equal(porElWhere(c.job), c.entra,
      `🔴 «${c.nombre}»: la CONSULTA y el CRITERIO no coinciden. El paquete traería una cosa y la ` +
      'clasificación contaría otra, y nadie se enteraría hasta que un pro se quede sin firmar.');
  }
});

// ═══ ⑥ MINIMIZACIÓN: solo los firmables, y solo lo que hace falta ════════════════════════

test('SCRUM-458 · solo bajan los albaranes `emitido` — los demás no se pueden firmar', async () => {
  const p = prismaFalso({
    jobs: [JOB({ id: 1 })],
    albaranes: [
      ALB({ id: 10, estado: 'borrador', numero: 'ALB-BORRADOR' }),
      ALB({ id: 11, estado: ALBARAN_FIRMABLE, numero: 'ALB-EMITIDO' }),
      ALB({ id: 12, estado: 'firmado', numero: 'ALB-FIRMADO' }),
    ],
    clientes: [CLI({})],
  });
  const r = await construirPaquetePrecarga(7, AHORA, p);

  assert.deepEqual(r.albaranes.map((a) => a.numero), ['ALB-EMITIDO'],
    `🔴 el paquete trae ${JSON.stringify(r.albaranes.map((a) => a.numero))}. La FSM del albarán ` +
    'solo permite `emitido → firmado`: un borrador NO se puede firmar sin pasar por el servidor y ' +
    'un firmado no tiene nada que firmar. Bajar cualquiera de los dos es bajar datos personales ' +
    'que no sirven para nada (art. 32).');
});

test('SCRUM-458 · el albarán baja con lo justo para firmar, y NADA más', async () => {
  const precargado = albaranParaFirmar(
    ALB({}), 'Baño Los Olivos', 'Comunidad Los Olivos',
  );
  // Sin líneas, la pantalla de firma es un hueco que invita a firmar algo que no se ha cargado.
  assert.ok(Array.isArray(precargado.lineas) && precargado.lineas.length > 0,
    '🔴 el albarán baja SIN SUS LÍNEAS: es una pantalla vacía que invita a firmar lo que no se ve.');
  assert.equal(precargado.clienteNombre, 'Comunidad Los Olivos',
    '🔴 sin el nombre del cliente no se sabe de quién es el albarán, y firmar el equivocado en una ' +
    'obra es un error caro.');

  // 🔴 Lo que NO puede viajar. Cada uno con su motivo en el servicio.
  const PROHIBIDOS = ['phone', 'email', 'taxId', 'legalName', 'evidenciaFirma', 'signatureUrl',
    'firmaToken', 'pdfUrl', 'portalToken'];
  const presentes = PROHIBIDOS.filter((k) => k in precargado);
  assert.deepEqual(presentes, [],
    `🔴 el paquete baja campos que NO hacen falta para firmar: ${presentes.join(', ')}. Esto va a ` +
    'un aparato que se pierde, se vende o se comparte en la furgoneta: cada campo tiene que poder ' +
    'justificarse con «sin esto no se puede firmar» (art. 32).');
  // SUELO del control anterior: si el objeto fuera vacío, «no hay prohibidos» sería trivial.
  assert.ok(Object.keys(precargado).length >= 8,
    `🔴 SUELO: el albarán precargado solo tiene ${Object.keys(precargado).length} campos.`);
});

// ═══ ⑦ EL CRITERIO VIVE EN UN SITIO ══════════════════════════════════════════════════════

test('SCRUM-458 · el criterio no se ha repartido por el producto', async () => {
  // El fundador dijo al decidirlo que esto «quizás pueda cambiar». Cambiarlo tiene que ser cambiar
  // UN sitio, así que ningún otro fichero puede tener su propia idea de qué se precarga.
  // ⚠️ QUÉ SE BUSCA, Y POR QUÉ NO `status: { not: 'cerrado' }`. Ése fue mi primer criterio y NACIÓ
  // ROJO señalando a `metrics.service.ts` y `teamOverview.service.ts`, que lo usan para lo suyo y
  // no tienen nada que ver con la precarga. Es un idioma genérico de Prisma, no este criterio. Un
  // escáner que da ruido acaba relajado hasta quedarse ciego (la lección de SCRUM-451), así que se
  // busca lo que de verdad sería una copia: que OTRO fichero **declare** algo del servicio.
  //
  // Y la lista de nombres NO se escribe a mano: se DERIVA de los `export` del propio servicio, para
  // que un nombre nuevo quede vigilado sin que nadie se acuerde de venir aquí.
  const RUTA = 'src/modules/jobs/domain/precarga.service.ts';
  const fuente = fs.readFileSync(path.join(RAIZ, RUTA), 'utf8');
  const nombres = [...fuente.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
  // SUELO, por separado: si no se extrae ningún nombre, «no hay copias» sería cierto y no diría nada.
  assert.ok(nombres.length >= 8,
    `🔴 SUELO: solo se han extraído ${nombres.length} nombres exportados de \`${RUTA}\`. El escáner ` +
    'no está mirando lo que dice mirar.');

  const dir = path.join(RAIZ, 'src');
  const sospechosos = [];
  // SUELO (SCRUM-719): aquí no hay un ancla común —se barre `src` entero—, así que el respaldo
  // es la SALIDA del filtro: un `.ts` de este repo que se quede sin código tras quitar
  // comentarios no existe. Si aparece uno, la negación de abajo es cierta por vacía sobre él.
  let ficherosBarridos = 0;
  const sinCodigo = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { anda(f); continue; }
      const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
      if (!f.endsWith('.ts') || rel === RUTA) continue;
      const bruto = fs.readFileSync(f, 'utf8');
      const codigo = soloEjecutable(bruto);
      ficherosBarridos += 1;
      // Se compara la ENTRADA con la SALIDA, no se mira sola la salida: `src` tiene 7 ficheros
      // `.ts` de CERO BYTES (medido: `src/api/routes.ts`, `src/core/http/types.ts`, cinco mas).
      // Un fichero vacio en disco y un fichero VACIADO por el filtro son hechos distintos, y
      // solo el segundo deja hueca la negacion de abajo.
      if (bruto.trim() && !codigo.trim()) sinCodigo.push(rel);
      for (const n of nombres) {
        // DECLARAR, no usar: importarlo es exactamente lo que se quiere que hagan.
        if (new RegExp(`(const|let|var|function)\\s+${n}\\b`).test(codigo)) sospechosos.push(`${rel} → ${n}`);
      }
    }
  })(dir);
  assert.ok(ficherosBarridos > 100,
    `🔴 ESCÁNER CIEGO: solo ${ficherosBarridos} ficheros .ts barridos en \`src\``);
  assert.deepEqual(sinCodigo, [],
    `🔴 ESCÁNER CIEGO: ${sinCodigo.length} fichero(s) se quedaron SIN CÓDIGO tras filtrar `
    + `comentarios: ${sinCodigo.slice(0, 5).join(', ')}. La negación sobre ésos es hueca.`);

  assert.deepEqual(sospechosos, [],
    `🔴 el criterio de precarga ha empezado a vivir también en: ${sospechosos.join(', ')}. Vive en ` +
    '`precarga.service.ts` y en ningún otro sitio: el fundador dijo que esto «quizás pueda cambiar», ' +
    'y cambiarlo tiene que ser cambiar UN sitio.');
});
