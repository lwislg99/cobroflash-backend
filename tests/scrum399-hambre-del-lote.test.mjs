// tests/scrum399-hambre-del-lote.test.mjs — SCRUM-399
//
// EL PLAN EN OPT-OUT QUE SE COMÍA UN HUECO DEL LOTE.
//
// El cron coge `orderBy: nextDueAt asc, take: 50` y el opt-out se filtraba DENTRO del bucle. Un
// plan sin canal **nunca se reprograma** —y es correcto: es lo que hace cierto el «si vuelve, se
// retoma» de SCRUM-394— así que su `nextDueAt` se queda en el pasado para siempre y `asc` lo pone
// EN CABEZA. Se comía un hueco todos los días, por delante de los demás. Con 50 así, el cron no
// llegaba a ningún plan bueno, y ese fallo también era mudo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA TRAMPA, QUE ES LO QUE HACE ESTE TICKET DIFÍCIL
//
// Si los planes sin canal simplemente dejaran de entrar, **desaparecería el sitio donde SCRUM-394
// registra su aviso**: para poder decir que un plan está parado hay que verlo. Por eso son DOS
// lotes y no un filtro — y por eso R2 vigila que el aviso siga ocurriendo.
import test from 'node:test';
import { soloEjecutable } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { seleccionarLotes, TOPE_LOTE, avisarPlanSinCanal } from '../dist/modules/maintenance/domain/maintenance.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE_P = 'src/modules/maintenance/domain/maintenance.service.ts';
const FUENTE = fs.readFileSync(path.join(RAIZ, FUENTE_P), 'utf8');
const AYER = new Date('2026-08-06T10:00:00Z');
const HOY = new Date('2026-08-07T10:00:00Z');

/**
 * Doble de prisma con planes y clientes en memoria. Implementa lo que el ciclo usa de verdad:
 * `notIn`/`in` sobre `customerId`, el filtro de vencidos, el orden por `nextDueAt` y el `take`.
 */
function prismaDoble({ planes, clientes }) {
  const consultas = [];
  return {
    consultas,
    db: {
      customer: {
        async findMany({ where }) {
          // Devuelve `merchantId` porque la consulta lo pide: es la RED multi-tenant que exige
          // SCRUM-243. Un doble que no da lo que se le pide prueba una consulta que no existe.
          return clientes.filter((c) => c.waOptOut === where.waOptOut)
            .map((c) => ({ id: c.id, merchantId: c.merchantId ?? 7 }));
        },
      },
      maintenancePlan: {
        async findMany({ where, orderBy, take }) {
          consultas.push({ where, orderBy, take });
          let out = planes.filter((p) => p.active === where.active && p.nextDueAt <= where.nextDueAt.lte);
          if (where.customerId?.notIn) out = out.filter((p) => !where.customerId.notIn.includes(p.customerId));
          if (where.customerId?.in) out = out.filter((p) => where.customerId.in.includes(p.customerId));
          // 🔴 HONRA EL `orderBy` QUE LE PIDEN, y esto se descubrió en una prueba de rojo que salió
          // VERDE. El doble ordenaba SIEMPRE por `nextDueAt asc` por su cuenta, así que cambiar el
          // orden en el código no movía nada: R3 estaba comprobando el doble, no el ciclo. Un doble
          // que arregla lo que el código pide mal es un doble que esconde el defecto.
          const campo = Object.keys(orderBy)[0];
          const dir = orderBy[campo] === 'desc' ? -1 : 1;
          out = [...out].sort((a, b) => (a[campo] < b[campo] ? -1 : a[campo] > b[campo] ? 1 : 0) * dir);
          return out.slice(0, take);
        },
      },
    },
  };
}

/** 60 planes en opt-out (vencidos hace mucho, así que van EN CABEZA) + 10 buenos vencidos. */
function escenarioHambre() {
  const clientes = [];
  const planes = [];
  for (let i = 1; i <= 60; i++) {
    clientes.push({ id: i, waOptOut: true });
    // Vencidos hace mucho: `asc` los coloca delante de todo.
    planes.push({ id: i, merchantId: 7, customerId: i, active: true, nextDueAt: new Date('2026-01-01'), lastProposedAt: null });
  }
  for (let i = 61; i <= 70; i++) {
    clientes.push({ id: i, waOptOut: false });
    planes.push({ id: i, merchantId: 7, customerId: i, active: true, nextDueAt: AYER, lastProposedAt: null });
  }
  return { clientes, planes };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R6 · SUELO — va PRIMERO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-399 · R6 SUELO: si el lote sale vacío existiendo planes vencidos, esto FALLA', () => {
  // «Ninguno vencido» y «no supe mirar» dan la misma bandeja vacía. Si el doble no devolviera
  // nada, todos los asserts de abajo pasarían contando ceros.
  const { clientes, planes } = escenarioHambre();
  assert.equal(planes.length, 70, '🔴 el escenario no tiene los 70 planes: no probaría el hambre');
  assert.equal(clientes.filter((c) => c.waOptOut).length, 60, '🔴 no hay 60 en opt-out');
  const { db } = prismaDoble({ clientes, planes });
  return seleccionarLotes(HOY, { prisma: db }).then(({ aProponer, sinCanalVencidos }) => {
    assert.ok(aProponer.length + sinCanalVencidos.length > 0,
      '🔴 EL LOTE SALE VACÍO habiendo 70 planes vencidos. Eso no es «no hay trabajo»: es que el ' +
      'selector no supo mirar, y las dos cosas producen la misma bandeja.');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R1 · EL TEST · los 10 buenos se procesan
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-399 · R1: con 60 en opt-out por delante, LOS 10 BUENOS entran en el lote', async () => {
  const { clientes, planes } = escenarioHambre();
  const { db } = prismaDoble({ clientes, planes });
  const { aProponer } = await seleccionarLotes(HOY, { prisma: db });

  const ids = aProponer.map((p) => p.id).sort((a, b) => a - b);
  assert.deepEqual(ids, [61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
    `🔴 EL HAMBRE DEL LOTE: los 60 planes en opt-out se han comido los huecos y solo entran ` +
    `${aProponer.length} de los 10 buenos. Con \`take: ${TOPE_LOTE}\` y \`nextDueAt asc\`, los que ` +
    'nunca se reprograman van SIEMPRE en cabeza — y el cron no llega a los que sí se pueden proponer.');
  assert.equal(aProponer.filter((p) => p.customerId <= 60).length, 0,
    '🔴 hay planes sin canal dentro del lote de trabajo: el filtro no está en la consulta');
});

test('SCRUM-399 · R1: y SIN el arreglo, el mismo escenario deja fuera a los 10', async () => {
  // 🔴 LA MITAD QUE DEMUESTRA ALGO. Sin esto, R1 podría estar verde porque el escenario es fácil.
  // Aquí se reproduce la consulta ANTERIOR —un solo lote, sin excluir a los sin canal— sobre los
  // MISMOS datos, y se comprueba que entonces no entra ni uno de los buenos.
  const { clientes, planes } = escenarioHambre();
  const { db } = prismaDoble({ clientes, planes });
  const comoAntes = await db.maintenancePlan.findMany({
    where: { active: true, nextDueAt: { lte: HOY } },
    orderBy: { nextDueAt: 'asc' },
    take: TOPE_LOTE,
  });
  const buenosAntes = comoAntes.filter((p) => p.customerId > 60);
  assert.equal(buenosAntes.length, 0,
    '🔴 el escenario ya no reproduce el defecto: con la consulta ANTIGUA entran ' +
    `${buenosAntes.length} planes buenos, así que R1 estaría pasando sin demostrar nada.`);
  assert.equal(comoAntes.length, TOPE_LOTE, '🔴 el lote antiguo no se llena: el caso no es el del hambre');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R2 · SCRUM-394 SIGUE FUNCIONANDO · el aviso conserva su sitio
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-399 · R2: los planes sin canal SIGUEN VIÉNDOSE, en su propio lote', async () => {
  // La trampa del ticket: si desaparecieran del bucle, desaparecería el sitio donde SCRUM-394
  // registra el aviso. Para poder decir que un plan está parado hay que verlo.
  const { clientes, planes } = escenarioHambre();
  const { db } = prismaDoble({ clientes, planes });
  const { sinCanalVencidos } = await seleccionarLotes(HOY, { prisma: db });
  assert.equal(sinCanalVencidos.length, Math.min(60, TOPE_LOTE),
    `🔴 los planes sin canal han desaparecido del ciclo (${sinCanalVencidos.length}). Sin recorrido ` +
    'propio no hay dónde avisar, y SCRUM-394 se queda sin sitio: el plan vuelve a pararse en silencio.');
  assert.ok(sinCanalVencidos.every((p) => p.customerId <= 60), '🔴 el lote de los mudos trae planes que sí tienen canal');
});

test('SCRUM-399 · MULTI-TENANT: un plan cuyo cliente es de OTRO merchant no entra en los mudos', async () => {
  // 🔴 REGRESIÓN CAZADA POR EL GUARD DE SCRUM-243, no por mí. El bucle comprobaba
  // `customer.merchantId !== plan.merchantId` antes de tocar nada, y el recorrido nuevo se la había
  // saltado: habría escrito un `CustomerEvent` en la ficha de un cliente ajeno — contarle a un
  // profesional algo de un cliente que no es suyo.
  const clientes = [{ id: 1, merchantId: 7, waOptOut: true }, { id: 2, merchantId: 2, waOptOut: true }];
  const planes = [
    { id: 10, merchantId: 7, customerId: 1, active: true, nextDueAt: AYER, lastProposedAt: null },
    // Dato roto: plan del merchant 1 apuntando a un cliente del merchant 2.
    { id: 11, merchantId: 7, customerId: 2, active: true, nextDueAt: AYER, lastProposedAt: null },
  ];
  const { db } = prismaDoble({ clientes, planes });
  const { sinCanalVencidos } = await seleccionarLotes(HOY, { prisma: db });
  assert.deepEqual(sinCanalVencidos.map((p) => p.id), [10],
    '🔴 un plan que apunta a un cliente de OTRO merchant ha entrado en el lote de los mudos. El ' +
    'siguiente paso es registrarle un aviso en la ficha de ese cliente ajeno: fuga entre tenants ' +
    'por la puerta de atrás.');
});

test('SCRUM-399 · R2: el aviso sigue siendo UNA VEZ POR EPISODIO, no una por pasada', async () => {
  const registrados = [];
  const deps = {
    async existeEventoDePlan(m, c, type, planId) { return registrados.some((e) => e.type === type && e.meta?.planId === planId); },
    async recordCustomerEvent(e) { registrados.push(e); },
  };
  const plan = { id: 1, merchantId: 7, lastProposedAt: null };
  await avisarPlanSinCanal(plan, 1, deps);
  await avisarPlanSinCanal(plan, 1, deps);
  await avisarPlanSinCanal(plan, 1, deps);
  assert.equal(registrados.length, 1,
    `🔴 tras tres pasadas hay ${registrados.length} avisos. SCRUM-399 no puede haber roto el «una vez ` +
    'por episodio» de SCRUM-394 al mover dónde se recorren los planes.');
});

test('SCRUM-399 · R2: el CABLEADO — el recorrido nuevo llama al aviso de verdad', () => {
  // La lección del R1 verde de SCRUM-394: un test que llama a la función directamente no prueba
  // que alguien la llame. Se mira el AST del recorrido, no que el nombre aparezca en el fichero
  // (aparece en su propia definición, y un `grep` se cazaría a sí mismo).
  const sf = ts.createSourceFile(FUENTE_P, FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let recorrido = null;
  const visita = (n) => {
    if (ts.isForOfStatement(n) && /sinCanalVencidos/.test(n.expression.getText(sf))) recorrido = n.statement;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(recorrido, '🔴 ESCÁNER CIEGO: no encuentro el recorrido `for (… of sinCanalVencidos)`');
  let llama = false;
  const busca = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'avisarPlanSinCanal') llama = true;
    ts.forEachChild(n, busca);
  };
  busca(recorrido);
  assert.ok(llama,
    '🔴 el recorrido de los planes sin canal existe pero NO llama a `avisarPlanSinCanal`. El lote ya ' +
    'no pasa hambre y a cambio el plan vuelve a pararse en silencio: se habría cambiado un defecto ' +
    'mudo por otro.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R3 · LA REANUDACIÓN · la propiedad que se defendió en SCRUM-394
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-399 · R3: si el cliente VUELVE, su plan entra en el lote siguiente Y EN CABEZA', async () => {
  const { clientes, planes } = escenarioHambre();
  // El cliente 1 vuelve: su plan lleva vencido desde enero, así que tiene que ir el primero.
  clientes.find((c) => c.id === 1).waOptOut = false;
  const { db } = prismaDoble({ clientes, planes });
  const { aProponer, sinCanalVencidos } = await seleccionarLotes(HOY, { prisma: db });

  assert.equal(aProponer[0]?.customerId, 1,
    `🔴 el cliente que vuelve NO entra en cabeza (entró ${aProponer[0]?.customerId}). Su plan nunca se ` +
    'reprogramó justamente para esto: `nextDueAt` sigue en el pasado y `asc` tiene que ponerlo el ' +
    'primero. Si se perdió, SCRUM-399 ha roto la reanudación que SCRUM-394 defendió.');
  assert.ok(!sinCanalVencidos.some((p) => p.customerId === 1), '🔴 sigue contado como mudo después de volver');
  assert.ok(aProponer.length >= 11, '🔴 al volver uno, el lote de trabajo tiene que crecer');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R4 · CONTROL POSITIVO · sin opt-outs, todo como antes
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-399 · R4: sin ningún opt-out, el lote se comporta EXACTAMENTE como hoy', async () => {
  const clientes = [];
  const planes = [];
  for (let i = 1; i <= 70; i++) {
    clientes.push({ id: i, waOptOut: false });
    planes.push({ id: i, merchantId: 7, customerId: i, active: true, nextDueAt: AYER, lastProposedAt: null });
  }
  const { db, consultas } = prismaDoble({ clientes, planes });
  const { aProponer, sinCanalVencidos } = await seleccionarLotes(HOY, { prisma: db });

  assert.equal(aProponer.length, TOPE_LOTE, `🔴 el lote trae ${aProponer.length} y el tope es ${TOPE_LOTE}`);
  assert.deepEqual(sinCanalVencidos, [], '🔴 sin opt-outs no puede haber lote de mudos');
  // 🔴 Y SIN CLÁUSULA VACÍA. Un `notIn: []` es justo donde un motor puede decidir por su cuenta que
  // no pasa nadie, y eso vaciaría el lote entero en el caso más común de todos.
  const conFiltro = consultas.filter((c) => c.where.customerId !== undefined);
  assert.deepEqual(conFiltro, [],
    '🔴 se está mandando un filtro de `customerId` sin tener a nadie que excluir. `notIn: []` es una ' +
    'cláusula vacía viajando a la base: el día que el motor la interprete como «ninguno», el lote se ' +
    'queda a cero en el caso NORMAL, que es el que nadie prueba.');
  assert.equal(consultas.length, 1, '🔴 sin opt-outs sobra la segunda consulta: no hay mudos que buscar');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R5 · ROJO POR EL MECANISMO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-399 · R5: el opt-out se decide EN LA CONSULTA, no dentro del bucle', () => {
  // Si alguien devuelve el filtro al bucle, el lote vuelve a pasar hambre — y en silencio, porque
  // el resultado sigue siendo «se procesaron 50 planes». Se mira por AST: el `where` del selector
  // tiene que acotar por `customerId`, y el bloque del bucle NO puede volver a ser un filtro.
  const sf = ts.createSourceFile(FUENTE_P, FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let selector = null;
  const visita = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'seleccionarLotes') selector = n;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(selector, '🔴 ESCÁNER CIEGO: no encuentro `seleccionarLotes`. Si se renombró, ARREGLA EL ESCÁNER.');
  const cuerpo = soloEjecutable(selector.getText(sf));
  assert.match(cuerpo, /customerId:\s*\{\s*notIn/,
    '🔴 EL HAMBRE DEL LOTE HA VUELTO: la consulta ya no excluye a los planes sin canal. Volverán a ' +
    'ocupar los primeros huecos de los ' + TOPE_LOTE + ' todos los días —porque nunca se ' +
    'reprograman y el orden es `nextDueAt asc`— y el cron dejará de llegar a los planes buenos, ' +
    'sin que nada lo diga.');
  assert.match(cuerpo, /customerId:\s*\{\s*in:/,
    '🔴 ha desaparecido el lote de los mudos: sin él no hay dónde registrar el aviso de SCRUM-394');
});
