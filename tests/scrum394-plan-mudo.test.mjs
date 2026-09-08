// tests/scrum394-plan-mudo.test.mjs — SCRUM-394
//
// EL PLAN DE MANTENIMIENTO QUE SE PARABA EN SILENCIO.
//
// El cron comprueba `customer.waOptOut` para decidir si propone, y la propuesta **no va al
// cliente: va al PROFESIONAL**. Si el cliente se dio de baja de WhatsApp, el plan dejaba de
// proponerse al profesional —que no es quien se dio de baja— y el único rastro era el `skipped`
// del log del cron, que él no ve jamás. «Todavía no le toca» y «se paró por el opt-out de otro»
// producían exactamente la misma bandeja vacía.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE **NO** SE ARREGLÓ, Y ES DELIBERADO
//
// El `continue` sin tocar el plan NO es el defecto. Se estudió reprogramar `nextDueAt` como hace
// la rama del cooldown, y no encaja: el cooldown caduca solo (`last + 90d` es calculable) y el
// opt-out caduca cuando el cliente vuelve, que es impredecible. Y sobre todo, reprogramar rompería
// el «si vuelve, se retoma» que hoy es cierto PRECISAMENTE porque `nextDueAt` se queda en el
// pasado. Eso lo fija R5.
import test from 'node:test';
import { ejecutableDe } from './_guard-texto.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { avisarPlanSinCanal } from '../dist/modules/maintenance/domain/maintenance.service.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FUENTE_P = 'src/modules/maintenance/domain/maintenance.service.ts';
const FUENTE = fs.readFileSync(path.join(RAIZ, FUENTE_P), 'utf8');

/** Doble de las dos dependencias. Guarda lo registrado para poder mirarlo. */
function dobles({ yaAvisado = false } = {}) {
  const registrados = [];
  const consultas = [];
  return {
    registrados,
    consultas,
    deps: {
      async existeEventoDePlan(merchantId, customerId, type, planId, desde) {
        consultas.push({ merchantId, customerId, type, planId, desde });
        // El doble simula la tabla: si ya se registró uno de ese tipo para ese plan, existe.
        if (yaAvisado) return true;
        return registrados.some((e) => e.type === type && e.meta?.planId === planId);
      },
      async recordCustomerEvent(e) { registrados.push(e); },
    },
  };
}

const PLAN = { id: 7, merchantId: 3, lastProposedAt: null };
const CLIENTE = 42;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R6 · SUELO — va PRIMERO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · R6 SUELO: el doble registra de verdad, o lo de abajo mide sobre nada', () => {
  // «Ninguno vencido» y «no supe mirar» dan la misma bandeja vacía. Si el doble no registrara,
  // todos los asserts de abajo verían cero eventos y algunos pasarían por el motivo equivocado.
  const { deps, registrados } = dobles();
  assert.equal(typeof deps.recordCustomerEvent, 'function');
  assert.equal(typeof deps.existeEventoDePlan, 'function');
  assert.equal(registrados.length, 0, '🔴 el doble arranca sucio: las cuentas de abajo no valdrían');
  assert.equal(typeof avisarPlanSinCanal, 'function',
    '🔴 no se pudo importar `avisarPlanSinCanal` de dist/: el test estaría midiendo un módulo que no existe');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R1 · EL TEST · no desaparece en silencio
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · R1: un plan con cliente en opt-out deja un evento LEGIBLE, no un log', () => {
  const { deps, registrados } = dobles();
  return avisarPlanSinCanal(PLAN, CLIENTE, deps).then((registro) => {
    assert.equal(registro, true, '🔴 no registró nada: el plan seguiría parándose en silencio');
    assert.equal(registrados.length, 1, `🔴 esperaba UN evento y hay ${registrados.length}`);
    const ev = registrados[0];
    assert.equal(ev.merchantId, PLAN.merchantId);
    assert.equal(ev.customerId, CLIENTE, '🔴 el evento tiene que colgar del cliente: es su ficha');
    assert.equal(ev.meta?.planId, PLAN.id,
      '🔴 sin `planId` en meta, dos planes del mismo cliente comparten episodio y uno se queda mudo');
    assert.ok(ev.title && ev.detail,
      '🔴 un evento sin título ni detalle es tan mudo como el log del cron que vino a sustituir');
    // Y lo que hace que sea LEGIBLE de verdad: `title` y `detail` son lo que pinta la ficha
    // (`customerDetailView.js:160-161`), servidos por `listCustomerEvents`.
    assert.match(ev.detail, /WhatsApp/,
      '🔴 el detalle no dice por qué no se propuso, que es la mitad del ticket');
  });
});

test('SCRUM-394 · R1: y el BUCLE la llama — sin esto, todo lo demás prueba código muerto', () => {
  // 🔴 HUECO MEDIDO Y CERRADO. Los tests de arriba ejercitan `avisarPlanSinCanal` directamente, así
  // que **borrar la llamada del bucle los dejaba a todos en verde** y el plan volvía a pararse en
  // silencio. Lo destapó una prueba de rojo que salió VERDE.
  //
  // Por AST y DENTRO del bloque del opt-out: que la función se nombre en el fichero no basta —se
  // nombra en su propia definición, y un `grep` se cazaría a sí mismo.
  // ⚠️ EL CABLEADO SE MUDÓ EN SCRUM-399, y este test con él. Antes la llamada vivía dentro de
  // `if (customer.waOptOut)`; ahora el opt-out se decide EN LA CONSULTA (los planes sin canal se
  // comían un hueco del lote todos los días) y el aviso se registra recorriendo `sinCanalVencidos`.
  //
  // Lo que se vigila NO ha cambiado —que alguien llame de verdad al aviso—, solo dónde. Y sigue
  // pudiendo caer: si se borra la llamada, esto se pone rojo igual.
  const sf = ts.createSourceFile(FUENTE_P, FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let recorrido = null;
  const visita = (n) => {
    if (ts.isForOfStatement(n) && /sinCanalVencidos/.test(n.expression.getText(sf))) recorrido = n.statement;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(recorrido,
    '🔴 ESCÁNER CIEGO: no encuentro el recorrido `for (… of sinCanalVencidos)`. Si se renombró o se ' +
    'quitó, ARREGLA EL ESCÁNER — y comprueba antes que el aviso sigue teniendo dónde registrarse.');

  let llama = false;
  const buscaLlamada = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'avisarPlanSinCanal') llama = true;
    ts.forEachChild(n, buscaLlamada);
  };
  buscaLlamada(recorrido);
  assert.ok(llama,
    '🔴 el recorrido de los planes sin canal YA NO LLAMA a `avisarPlanSinCanal`. El plan vuelve a ' +
    'pararse en silencio, que es literalmente el defecto de SCRUM-394 — y los tests de la función ' +
    'seguirían verdes, porque estarían probando código que ya no ejecuta nadie.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R2 · LA CONDICIÓN NUEVA · una vez por EPISODIO, no una por ejecución
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · R2: tres ejecuciones del cron en el mismo episodio dejan UN evento', async () => {
  const { deps, registrados } = dobles();
  const r1 = await avisarPlanSinCanal(PLAN, CLIENTE, deps);
  const r2 = await avisarPlanSinCanal(PLAN, CLIENTE, deps);
  const r3 = await avisarPlanSinCanal(PLAN, CLIENTE, deps);
  assert.deepEqual([r1, r2, r3], [true, false, false],
    '🔴 el aviso se repite en cada pasada: un cron DIARIO llenaría la ficha del cliente de entradas idénticas');
  assert.equal(registrados.length, 1,
    `🔴 tras tres ejecuciones hay ${registrados.length} eventos. Es spam de otra clase, y lo paga el ` +
    'profesional: una ficha llena de líneas iguales deja de leerse.');
});

test('SCRUM-394 · R2: dos planes del MISMO cliente son dos episodios distintos', () => {
  // El `planId` de `meta` es lo que los separa. Sin él, el segundo plan se quedaría mudo por
  // culpa del aviso del primero — el mismo silencio, movido de sitio.
  const { deps, registrados } = dobles();
  const otro = { ...PLAN, id: 8 };
  return avisarPlanSinCanal(PLAN, CLIENTE, deps)
    .then(() => avisarPlanSinCanal(otro, CLIENTE, deps))
    .then((segundo) => {
      assert.equal(segundo, true, '🔴 el segundo plan del mismo cliente no avisó: hereda el episodio del primero');
      assert.deepEqual(registrados.map((e) => e.meta.planId), [7, 8]);
    });
});

test('SCRUM-394 · R2: el episodio se delimita con `lastProposedAt`, no «desde siempre»', async () => {
  // Cuando el cliente vuelve, el plan se propone y `lastProposedAt` avanza. Un opt-out POSTERIOR
  // es otro episodio y tiene que volver a avisar: si la consulta no llevara esa fecha, el
  // profesional solo se enteraría la primera vez en la vida del plan.
  const { deps, consultas } = dobles();
  const conPropuesta = { ...PLAN, lastProposedAt: new Date('2026-08-01T10:00:00Z') };
  await avisarPlanSinCanal(conPropuesta, CLIENTE, deps);
  assert.equal(consultas.length, 1);
  assert.deepEqual(consultas[0].desde, conPropuesta.lastProposedAt,
    '🔴 la consulta del episodio no acota por `lastProposedAt`: un plan solo avisaría UNA vez en toda su vida, ' +
    'aunque el cliente se diera de baja tres veces en tres años.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R3 · CONTROL POSITIVO · el camino que sí propone, intacto
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · R3: el mecanismo de propuesta sigue EXACTAMENTE como estaba', () => {
  // Es lo que se rompe sin querer al tocar la rama de al lado. Se comprueba sobre la fuente: el
  // borrador, su `createdVia`, el checkpoint de reintento y el evento de propuesta siguen ahí.
  for (const [ancla, queEs] of [
    ["createdVia: 'maintenance'", 'la marca del borrador que crea el ciclo'],
    ["type: 'maintenance_proposed'", 'el evento que se registra cuando SÍ se propone'],
    ['allocateQuoteNumber', 'la numeración del borrador'],
    ['nextDueAt: new Date(now.getTime() + PROPOSAL_COOLDOWN_DAYS * DAY_MS)', 'el checkpoint de reintento'],
  ]) {
    assert.ok(FUENTE.includes(ancla), `🔴 ha desaparecido ${queEs} (\`${ancla}\`): el mecanismo de propuesta se ha movido`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R4 · LA VECINA · el cooldown no se toca
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · R4: la rama del cooldown SIGUE reprogramando, y sigue siendo la única', () => {
  // Se toca su hermana, y no se la puede mover. El cooldown SÍ reprograma porque su motivo caduca
  // solo; el opt-out no. Que sigan siendo distintas es la mitad del ticket.
  assert.ok(FUENTE.includes('const resumeAt = new Date(last.getTime() + PROPOSAL_COOLDOWN_DAYS * DAY_MS);'),
    '🔴 la rama del cooldown ya no calcula su `resumeAt`');
  assert.ok(FUENTE.includes('data: { nextDueAt: resumeAt }'),
    '🔴 la rama del cooldown ya no reprograma el plan');
  assert.ok(FUENTE.includes('customer_cooldown_90d'), '🔴 ha desaparecido el motivo del cooldown');
});

test('SCRUM-394 · R4: la rama del OPT-OUT no reprograma nada — por AST, no por lectura', () => {
  // 🔴 EL CONTROL QUE SOSTIENE R5. Si alguien «arregla» esto reprogramando, el «si vuelve, se
  // retoma» deja de ser cierto Y la microcopy pasa a mentir («el mantenimiento sigue vivo»).
  // Se mira el AST del bloque `if (customer.waOptOut)`, no el texto: los comentarios de arriba
  // hablan de `nextDueAt` a propósito y un `grep` se cazaría a sí mismo.
  const sf = ts.createSourceFile(FUENTE_P, FUENTE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let bloque = null;
  const visita = (n) => {
    if (ts.isIfStatement(n) && /customer\.waOptOut/.test(n.expression.getText(sf))) bloque = n.thenStatement;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(bloque, '🔴 ESCÁNER CIEGO: no encuentro el bloque `if (customer.waOptOut)`. Si se renombró, ARREGLA EL ESCÁNER.');
  // SUELO (SCRUM-719): el `assert.ok(bloque)` de arriba prueba que el AST ENCONTRÓ la rama —
  // un paso antes de la ceguera. Esto prueba que su texto sobrevive al filtro: la rama
  // apunta lo que se salta, y si eso desaparece no es que ya no toque `nextDueAt`, es que
  // estoy leyendo otra cosa.
  const cuerpo = ejecutableDe(bloque.getText(sf), { ancla: 'skipped.push', donde: 'rama waOptOut' });
  assert.doesNotMatch(cuerpo, /nextDueAt/,
    '🔴 la rama del opt-out ha empezado a tocar `nextDueAt`. Eso rompe «si vuelve, se retoma» (R5) y ' +
    'deja la microcopy mintiendo: dice «el mantenimiento sigue vivo» y solo es cierto si NO se reprograma.');
  assert.doesNotMatch(cuerpo, /active/,
    '🔴 la rama del opt-out ha empezado a tocar `active`: un plan pausado no lo reactiva nadie, y el ' +
    'cliente puede volver mañana.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// R5 · LA PROPIEDAD QUE SE DEFENDIÓ · si el cliente vuelve, se retoma
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · R5: un plan en opt-out cuyo cliente VUELVE se propone al día siguiente', () => {
  // Ésta es la prueba de que NO reprogramar fue lo correcto, y se sostiene sobre dos hechos del
  // código, no sobre una opinión:
  //
  //   1. el recorrido recoge todo plan `active` con `nextDueAt <= now`;
  //   2. la rama del opt-out no toca ni `nextDueAt` ni `active` (R4, por AST).
  //
  // Luego el plan sigue entrando en el lote cada día, y el día que `waOptOut` pasa a false ya no
  // entra por esa rama: se propone. Si se reprogramara a +N días, dormiría hasta entonces.
  // (SCRUM-399 movió esta condición a la constante `vencidos` de `seleccionarLotes`, que es la que
  // comparten los dos lotes. La propiedad es la misma: el recorrido sigue recogiendo por
  // `nextDueAt <= now`, que es de lo que depende la reanudación.)
  assert.ok(FUENTE.includes('const vencidos = { active: true, nextDueAt: { lte: now } };'),
    '🔴 el recorrido ya no recoge los planes vencidos por `nextDueAt <= now`: la reanudación automática ' +
    'dependía justo de eso');
  // Y la simulación del ciclo completo, con el doble: dos días en opt-out (un solo aviso) y al
  // tercero el cliente vuelve → esta rama ya no se ejecuta y no hay avisos nuevos.
  const { deps, registrados } = dobles();
  const ciclo = async () => {
    await avisarPlanSinCanal(PLAN, CLIENTE, deps);   // día 1: en opt-out
    await avisarPlanSinCanal(PLAN, CLIENTE, deps);   // día 2: sigue en opt-out
    // día 3: el cliente vuelve → el bucle NO entra en esta rama, así que no se llama.
    return registrados.length;
  };
  return ciclo().then((n) => {
    assert.equal(n, 1, `🔴 tras dos días en opt-out hay ${n} avisos, y el plan tiene que quedar listo para retomarse`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// MICROCOPY · aprobada, con su procedencia y sus afirmaciones medidas
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-394 · la microcopy es la APROBADA, palabra por palabra', () => {
  // Aprobada por el fundador el 7-ago-2026. Cambiar una coma exige aprobación nueva (regla 30):
  // este texto le dice a un profesional por qué su plan no se ha propuesto.
  assert.ok(FUENTE.includes("const TITULO_SIN_CANAL = 'Mantenimiento no propuesto';"),
    '🔴 el título ha cambiado y no consta aprobación nueva');
  assert.ok(FUENTE.includes('Este cliente no recibe mensajes de WhatsApp. El mantenimiento sigue vivo: si quieres '),
    '🔴 el detalle ha cambiado y no consta aprobación nueva');
  assert.ok(FUENTE.includes("+ 'proponérselo, tendrás que llegar a él por otra vía.'"),
    '🔴 el cierre del detalle ha cambiado y no consta aprobación nueva');
});
