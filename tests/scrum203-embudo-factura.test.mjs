// SCRUM-203 (EMBUDO-1 · FISCAL, sin gate: corre en `npm test`, no toca BD ni red).
//
// NINGUNA creación de factura fuera de `allocateInvoiceNumber()`.
//
// De dónde sale: el recon de SCRUM-200 afirma que 7 sitios crean facturas y que «los 7 pasan
// SIN EXCEPCIÓN» por el embudo. Sobre esa frase se apoya todo el plan del semáforo fiscal, y
// hoy nada la ata: es cierta el día que se escribió y falsa el día que alguien añada el camino
// 8 — en silencio. Patrón conocido de la casa: *prohibición sin mecanismo*.
//
// Este test NO construye el freno fiscal. Construye la garantía de que el freno, cuando exista,
// no tendrá puerta lateral. Un freno solo protege si no hay otro camino: si el número de una
// factura no sale del embudo, la validación que mañana se cuelgue del embudo no se ejecuta para
// esa factura, y lo que queda no es un freno — es la sensación de un freno.
//
// POR QUÉ MIRA EL NÚMERO Y NO LA VECINDAD. La comprobación fácil sería «¿aparece
// `allocateInvoiceNumber` cerca del `create`?». No sirve: deja pasar el caso que de verdad
// duele, que es el pequeño — un `create` que convive con una llamada al embudo en la misma
// función pero cuyo `number` viene de otro sitio. Ese es exactamente el aviso del incidente
// #12 de ERRORES_ASESOR (probar un guard fiscal con un caso tan grande que cae FUERA del
// mecanismo que se vigila, y leer el verde como tranquilidad). Aquí la regla es de PROCEDENCIA:
// el valor del campo `number` tiene que venir, por declaración, de `allocateInvoiceNumber()`.
// El caso pequeño está probado abajo, en la autoprueba del guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analizarFuente, analizarArbol, ubicacion, EMBUDO } from './_embudo-factura.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const ubic = (c) => ubicacion(c, RAIZ);
const listar = (cs) => cs.map((c) => `\n    · ${ubic(c)} [${c.forma}] → ${c.motivo}`).join('');

// ── 1 · EL EMBUDO EN `src/` ───────────────────────────────────────────────────────────────

/**
 * LISTA DE EXCEPCIONES DE `src/` — **VACÍA, y esa es la afirmación del ticket.**
 *
 * No está vacía por descuido: se ejecutó el analizador contra el árbol y los 7 sitios pasan por
 * el embudo (censo abajo). Si alguna vez hace falta meter algo aquí, no es un trámite: es
 * declarar que existe una factura cuyo número no lo asigna el único asignador del backend, y
 * eso hay que justificarlo LÍNEA A LÍNEA delante del fundador antes de escribirlo.
 */
const EXCEPCIONES_SRC = [];

test('SCRUM-203 · ninguna creación de factura en src/ se salta el embudo', () => {
  const creaciones = analizarArbol(path.join(RAIZ, 'src'));

  // Guarda de presencia: si el analizador se queda ciego (cambia el árbol, se rompe el parser,
  // se mueve `src/`), el assert de abajo pasaría en vacío sin haber mirado nada. Verde falso
  // del peor tipo, porque se lee igual que «todo bien».
  assert.ok(
    creaciones.length > 0,
    '🔴 ANALIZADOR CIEGO: cero creaciones de factura en src/. Antes de creerte el verde de este ' +
      'test, comprueba que `src/` sigue donde estaba y que Prisma se sigue llamando igual — un ' +
      'analizador que no encuentra nada no ha comprobado nada.',
  );

  const fugas = creaciones.filter((c) => c.motivo && !EXCEPCIONES_SRC.includes(ubic(c)));
  assert.deepEqual(
    fugas.map(ubic),
    [],
    `🔴 EMBUDO ROTO: hay creación de facturas en src/ que NO pasa por ${EMBUDO}():${listar(fugas)}\n\n` +
      `  Toda factura toma su número de ${EMBUDO}() (invoiceNumber.service.ts), dentro de la\n` +
      '  MISMA transacción que la crea. Ahí es donde vive hoy el gate V0-0 y donde irán los\n' +
      '  frenos fiscales: un camino que lo esquiva no los ejecuta.\n\n' +
      '  Si crees que tu caso es legítimo, NO lo metas en EXCEPCIONES_SRC sin hablarlo: sería\n' +
      '  declarar una factura cuyo número no asigna el único asignador del backend.',
  );
});

/**
 * CENSO — el ratchet contra el mapa de SCRUM-200.
 *
 * Va por FICHERO y cantidad, no por `fichero:línea`: anclar a la línea haría rojo el guard
 * fiscal cada vez que alguien añade un import diez líneas más arriba, y un guard que grita sin
 * motivo se acaba puenteando igual que uno que no grita nunca (lección de SCRUM-182). Por
 * fichero+cantidad, un camino nuevo sigue saliendo rojo, que es lo que se vigila; el mensaje
 * del fallo sí da la línea exacta.
 */
const CENSO_SRC = {
  'src/lib/invoicing.ts': 1,                                          // charge pagado → factura
  'src/modules/invoicing/domain/invoicing.service.ts': 1,             // emitInvoice(): el compartido
  'src/modules/jobs/app/routes/jobs.routes.ts': 1,                    // tramo de trabajo
  'src/modules/quotes/app/routes/quotes.routes.ts': 1,                // tramo al aceptar presupuesto
  'src/modules/system/app/routes/invoicesAdmin.routes.ts': 1,         // rectificativa (R1)
  'src/modules/system/app/routes/quotesAdmin.routes.ts': 2,           // tramo admin + documento entero
};

test('SCRUM-203 · el censo de creaciones de src/ cuadra con el mapa de SCRUM-200', () => {
  const censo = {};
  for (const c of analizarArbol(path.join(RAIZ, 'src'))) {
    const f = ubic(c).split(':')[0];
    censo[f] = (censo[f] ?? 0) + 1;
  }

  assert.deepEqual(
    censo,
    CENSO_SRC,
    '🔴 El mapa de caminos de emisión ya no cuadra con el código.\n\n' +
      `  Esperado (SCRUM-200, ${Object.values(CENSO_SRC).reduce((a, b) => a + b, 0)} sitios):\n` +
      Object.entries(CENSO_SRC).map(([f, n]) => `    ${f} ×${n}`).join('\n') +
      '\n  Encontrado:\n' +
      Object.entries(censo).map(([f, n]) => `    ${f} ×${n}`).join('\n') +
      '\n\n  Si el camino nuevo es legítimo y pasa por el embudo, actualiza CENSO_SRC aquí Y el\n' +
      '  inventario de SCRUM-200 — el ticket existe justo para que las dos listas no se separen.',
  );
});

// ── 2 · LAS SEMILLAS (`scripts/`) ─────────────────────────────────────────────────────────
//
// El ticket acota el recorrido a `src/`. Se incluye `scripts/` porque al ejecutar el
// analizador aparecieron ahí DOS creaciones con el número fabricado a mano, y un embudo que se
// vigila solo en `src/` mientras la puerta de al lado sigue abierta es precisamente lo que este
// ticket viene a evitar. No se arreglan aquí (es una semilla de demo, otro dominio y otro
// ticket): se CONGELAN, para que la lista no crezca en silencio.

/**
 * EXCEPCIONES DE `scripts/` — justificadas, y ninguna toca producción.
 *
 * `scripts/seed-demo.mjs` (×2, hoy líneas 158 y 214): siembra el merchant de demostración con
 * números literales `AAAA-FG-NNN`. No pasa por el embudo y NO avanza el contador del merchant,
 * así que la serie del demo queda descuadrada respecto a `nextInvoiceNumber`. Se congela en vez
 * de arreglarse porque tocar la semilla del demo no es parte de este ticket — va en **SCRUM-204**,
 * que además tiene que decidir algo de producto (el embudo devolvería `J-` en el demo, no
 * `AAAA-FG-NNN`). Queda escrito, con su motivo, y cualquier fuga NUEVA aquí sale roja.
 *
 * Al arreglarlo, la entrada se BORRA, no se pone a 0: el assert compara por igualdad exacta.
 * (`scripts/seed-video.mjs` sí usa el embudo: no necesita excepción.)
 */
const EXCEPCIONES_SCRIPTS = { 'scripts/seed-demo.mjs': 2 };

test('SCRUM-203 · las semillas no abren caminos nuevos fuera del embudo', () => {
  const creaciones = analizarArbol(path.join(RAIZ, 'scripts'));
  assert.ok(creaciones.length > 0, '🔴 ANALIZADOR CIEGO sobre scripts/: cero creaciones encontradas.');

  const fugas = {};
  for (const c of creaciones.filter((x) => x.motivo)) {
    const f = ubic(c).split(':')[0];
    fugas[f] = (fugas[f] ?? 0) + 1;
  }

  assert.deepEqual(
    fugas,
    EXCEPCIONES_SCRIPTS,
    '🔴 Las fugas conocidas de scripts/ ya no son las de la lista:' +
      listar(creaciones.filter((c) => c.motivo)) +
      '\n\n  Una fuga NUEVA en una semilla se arregla usando el embudo, no ampliando la lista.',
  );
});

// ── 3 · AUTOPRUEBA DEL GUARD ──────────────────────────────────────────────────────────────
//
// Un guard que nunca se ha visto en rojo no es un guard, es una decoración. Estos casos son la
// prueba permanente de que este sabe distinguir; el rojo manual del ticket (inyectar el camino
// 8 en el árbol de verdad y verlo caer) se hizo además una vez, y queda en el PR.

const conFuga = (codigo) => analizarFuente(codigo, 'prueba.ts').filter((c) => c.motivo);
const todas = (codigo) => analizarFuente(codigo, 'prueba.ts');

test('SCRUM-203 (autoprueba) · el camino 8 sin embudo cae', () => {
  const fugas = conFuga(`
    async function emitirAtajo(tx, merchantId) {
      return tx.invoice.create({ data: { merchantId, number: 'FAC-0001', total: '10.00' } });
    }
  `);
  assert.equal(fugas.length, 1);
  assert.match(fugas[0].motivo, /a mano/);
});

test('SCRUM-203 (autoprueba) · EL CASO PEQUEÑO: llama al embudo y aun así usa otro número', () => {
  // ERRORES_ASESOR #12: el caso de prueba tiene que caer DENTRO del mecanismo que se vigila.
  // Aquí `allocateInvoiceNumber` está en la MISMA función y a UNA línea del create — cualquier
  // guard de vecindad o de grep daría verde. La factura, sin embargo, se sella con otro número.
  const fugas = conFuga(`
    async function emitir(tx, merchantId) {
      const numero = await allocateInvoiceNumber(tx, merchantId);
      const provisional = 'BORRADOR-1';
      return tx.invoice.create({ data: { merchantId, number: provisional, total: '10.00' } });
    }
  `);
  assert.equal(fugas.length, 1, '🔴 el guard es de vecindad, no de procedencia: no vale');
  assert.match(fugas[0].motivo, /provisional/);
});

test('SCRUM-203 (autoprueba) · crear sin campo `number` también cae', () => {
  assert.equal(conFuga('tx.invoice.create({ data: { merchantId: 1, total: "10.00" } });').length, 1);
});

test('SCRUM-203 (autoprueba) · las puertas laterales: anidado, createMany, upsert y SQL crudo', () => {
  // Ninguna de las cuatro escribe `invoice.create` en el fuente. Son las que se olvidan.
  const anidado = conFuga('await tx.customer.update({ where: { id }, data: { Invoice: { create: { number: "X" } } } });');
  assert.equal(anidado.length, 1, '🔴 ciego a la escritura anidada por relación');

  assert.equal(conFuga('await tx.invoice.createMany({ data: filas });').length, 1);
  assert.equal(conFuga('await tx.invoice.upsert({ where: { id }, create: { number: "X" }, update: {} });').length, 1);
  assert.equal(
    conFuga('await tx.$executeRawUnsafe(`INSERT INTO "Invoice" (number) VALUES (\'X\')`);').length,
    1,
    '🔴 ciego al INSERT en crudo',
  );
});

test('SCRUM-203 (autoprueba) · el patrón bueno NO da falso positivo', () => {
  // Las dos formas que usa el repo: variable con nombre propio, y propiedad abreviada.
  const bueno = todas(`
    async function porVariable(tx, merchantId) {
      const invoiceNumber = await allocateInvoiceNumber(tx, merchantId);
      return tx.invoice.create({ data: { merchantId, number: invoiceNumber, total: '1.00' } });
    }
    async function porAbreviada(tx, merchantId) {
      const number = await allocateInvoiceNumber(tx, merchantId);
      return tx.invoice.create({ data: { merchantId, number, total: '1.00' } });
    }
  `);
  assert.equal(bueno.length, 2, 'deberían detectarse las dos creaciones');
  assert.deepEqual(bueno.map((c) => c.motivo), [null, null], '🔴 falso positivo sobre el patrón correcto');
});

test('SCRUM-203 (autoprueba) · ni `createdAt` ni un comentario disparan el guard', () => {
  // Las dos trampas clásicas de los guards de texto de esta casa, cerradas por construcción:
  // `\.create` casa `createdAt` con un grep ingenuo, y el literal prohibido vive justo en el
  // comentario que explica la prohibición (SCRUM-176/168/3/193, cuatro veces).
  assert.deepEqual(
    todas(`
      // PROHIBIDO: nunca escribas tx.invoice.create({ data: { number: 'FAC-1' } }) fuera del embudo.
      const cuando = factura.createdAt;
      const otro = invoice.createdAt;
    `),
    [],
  );
});
