// tests/scrum508-los-cinco-dejan-fila.test.mjs — SCRUM-508
//
// LOS CINCO EMISORES QUE FALTABAN DEJAN FILA. Sin gate, sin base de datos y sin red: el censo es AST
// sobre `src/` y el cliente de Prisma se inyecta.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// `email_messages` ya se escribía, pero **solo desde `email.service`**. La tabla iba a estar MEDIO
// LLENA, y quien la consultara creería estar viendo todos los envíos.
//
// 🔴 Una constancia parcial que no dice que es parcial es peor que no tenerla.
//
// ── QUÉ SE HEREDA DE SCRUM-501 Y NO SE REINVENTA ──────────────────────────────────────────
// La forma de la escritura (`provider_id` nulo si no hay id, fechas de Prisma, sin backfill), la
// invariante —no lanza y no se cuelga— y que la columna `error` no guarda direcciones en claro. Los
// cinco pasan por el MISMO camino, y eso se demuestra por AST: si alguno escribiera su fila por su
// cuenta sería una SEGUNDA FORMA, y el día que cambie qué se escribe habría que acordarse de todos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  censarLlamadas, censarLlamadasDeTexto, censarEscritores, emisoresConFila, emisoresSinFila,
  REPOSITORIO, RAIZ,
} from './_censo-emisores-con-fila.mjs';
import { registrarEnvio, CLASES_DE_CORREO } from '../dist/modules/messaging/domain/registroDeEnvios.js';
import { constanciaDeEnvio, constanciaDeFallo } from '../dist/modules/messaging/domain/constanciaCorreo.js';

const LLAMADAS = censarLlamadas();

/**
 * LOS SEIS EMISORES DEL ÁRBOL, con su clase de correo y de dónde vino cada uno.
 *
 * 🔴 «DE DÓNDE VINO» NO ES ADORNO: un censo que sube tiene que decir de dónde vino lo que subió,
 * igual que uno que baja tiene que decir a dónde fue. Sin esa mitad, «se ha cableado» y «el censo ha
 * cambiado de criterio» dan el mismo 6.
 */
const LOS_SEIS = [
  { fichero: 'src/modules/messaging/domain/email.service.ts', desde: 'SCRUM-501',
    clases: [CLASES_DE_CORREO.factura, CLASES_DE_CORREO.justificante, CLASES_DE_CORREO.presupuesto] },
  { fichero: 'src/modules/auth/domain/auth.service.ts', desde: 'SCRUM-508',
    clases: [CLASES_DE_CORREO.enlaceDeAcceso, CLASES_DE_CORREO.invitacion] },
  { fichero: 'src/modules/messaging/domain/lifecycle.service.ts', desde: 'SCRUM-508',
    clases: [CLASES_DE_CORREO.cicloDeVida] },
  { fichero: 'src/modules/messaging/domain/weeklyDigest.service.ts', desde: 'SCRUM-508',
    clases: [CLASES_DE_CORREO.resumenSemanal] },
  { fichero: 'src/modules/messaging/domain/merchantNotifications.ts', desde: 'SCRUM-508',
    clases: [CLASES_DE_CORREO.avisoAlProfesional] },
  { fichero: 'src/modules/system/app/routes/soporteAdmin.routes.ts', desde: 'SCRUM-508',
    clases: [CLASES_DE_CORREO.soporte] },
];

const CONTEXTO = Object.freeze({ merchantId: 7, kind: CLASES_DE_CORREO.cicloDeVida });

function clienteEspia({ revienta = false } = {}) {
  const escrituras = [];
  return {
    escrituras,
    emailMessage: {
      create: async (args) => {
        escrituras.push(args);
        if (revienta) throw new Error('la base dice que no');
        return { id: 2002 };
      },
    },
  };
}

// ── 0 · 🔴 AUTOPRUEBA · el censo se prueba ANTES de creerse su número ───────────────────────

test('SCRUM-508 · 🔴 AUTOPRUEBA: el censo distingue una llamada CON contexto de una SIN él', () => {
  // «Los seis dejan fila» y «mi detector no reconoce el contexto» salen por la misma línea. Se le da
  // fuente sintético y se comprueba que clasifica, ANTES de mirar el árbol.
  const ve = (fuente) => censarLlamadasDeTexto(fuente).map((l) => (l.conRegistro ? 'CON' : (l.indirecto ? 'INDIRECTO' : 'SIN')));

  // 7 y no 1: el guard de SCRUM-409 lee un `merchantId: 1` como el merchant DEMO y salta.
  assert.deepEqual(ve('await enviarCorreo({ to, subject, html, registro: { merchantId: 7, kind: "digest" } });'), ['CON'],
    '🔴 el censo NO VE un contexto que está puesto: con esto roto, el 6 de abajo no significa nada.');
  assert.deepEqual(ve('await enviarCorreo({ to, subject, html, origen: "x" });'), ['SIN'],
    '🔴 el censo da por buena una llamada SIN contexto. Entonces «los seis dejan fila» sería mentira '
    + 'y la tabla seguiría medio llena.');
  assert.deepEqual(ve('await enviarPorResend({ to, registro });'), ['CON'],
    '🔴 no reconoce la forma abreviada `registro` — es la misma propiedad.');

  // 🔴 EL CASO QUE NO SE PUEDE AFIRMAR, y se dice en vez de suponerse: si el objeto llega por
  // variable o por spread, el AST no puede ver dentro. `INDIRECTO` no es «CON»: es «no lo sé».
  assert.deepEqual(ve('await enviarCorreo(correo);'), ['INDIRECTO'],
    '🔴 una llamada cuyo objeto viene de una variable se está clasificando como si el AST pudiera '
    + 'verlo. Un censo que adivina no vale: tiene que decir que no sabe.');
  assert.deepEqual(ve('await enviarCorreo({ ...correo, origen: "x" });'), ['INDIRECTO'],
    '🔴 un `...spread` puede traer el contexto o no, y el AST no puede saberlo.');

  // CONTROL NEGATIVO: lo que no es una llamada al emisor no entra en el censo.
  assert.deepEqual(ve('await otraCosa({ to, registro: {} });'), [],
    '🔴 el censo cuenta llamadas que no son del emisor único: cuenta otra cosa.');
  assert.deepEqual(ve('// enviarCorreo({ to, registro: {} }) — solo un comentario'), [],
    '🔴 el censo lee COMENTARIOS como llamadas. Este carril está lleno de comentarios que nombran '
    + 'lo que vigilan: por eso es AST y no `grep`.');
});

// ── 1 · 🔴 SUELO · si el censo no ve nada, se declara ciego ─────────────────────────────────

test('SCRUM-508 · 🔴 SUELO: el censo VE las llamadas del árbol, o su cero no vale', () => {
  assert.ok(LLAMADAS.length >= 7,
    `🔴 ESCÁNER CIEGO: el censo ve ${LLAMADAS.length} llamadas al emisor único en \`src/\` y hay `
    + 'SIETE (medido el 13-ago-2026: dos en `email.service` y una en cada uno de los otros cinco). '
    + 'Con menos, «todas llevan contexto» significa «no supe mirar».');

  // Y las categorías SUMAN el total: un censo cuyas partes no suman no es un censo.
  const con = LLAMADAS.filter((l) => l.conRegistro).length;
  const indirectas = LLAMADAS.filter((l) => l.indirecto).length;
  const sin = LLAMADAS.filter((l) => !l.conRegistro && !l.indirecto).length;
  assert.equal(con + indirectas + sin, LLAMADAS.length,
    `🔴 las categorías suman ${con + indirectas + sin} y el total es ${LLAMADAS.length}: el censo `
    + 'pierde llamadas por el camino, así que ninguno de sus números significa nada.');
});

// ── 2 · 🔴 EL CENSO PASA DE 1 A 6, Y DICE DE DÓNDE VINO CADA UNO ────────────────────────────

test('SCRUM-508 · 🔴 los SEIS emisores dejan fila, y cada uno declara de dónde vino', () => {
  const conFila = emisoresConFila(LLAMADAS);
  const sinFila = emisoresSinFila(LLAMADAS);

  assert.deepEqual(sinFila, [],
    '🔴 HAY EMISORES QUE MANDAN CORREO SIN DEJAR FILA:\n    ' + sinFila.join('\n    ') + '\n\n'
    + '  Su correo SALE igual — esto no rompe nada — pero la tabla queda MEDIO LLENA, y quien la\n'
    + '  consulte creerá estar viendo todos los envíos. Una constancia parcial que no dice que es\n'
    + '  parcial es peor que no tenerla.\n\n'
    + '  Pásale `registro: { merchantId, kind }` a la llamada del emisor. Sin `merchantId` no hay\n'
    + '  fila: la columna es NOT NULL e inventar un merchant sería peor que no tenerla.');

  assert.deepEqual(conFila, LOS_SEIS.map((s) => s.fichero).sort(),
    `🔴 han cambiado CUÁLES dejan fila:\n    ${conFila.join('\n    ')}\n\n`
    + '  El recuento solo no lo vería. Vuelve a medir cuál entró, cuál salió y por qué.');

  // 🔴 DE DÓNDE VINO CADA UNO. `email.service` ya estaba (SCRUM-501); los otros CINCO son de este
  // ticket. Sin esta mitad, «se ha cableado» y «el censo cambió de criterio» dan el mismo 6.
  const deAyer = LOS_SEIS.filter((s) => s.desde === 'SCRUM-501');
  const deHoy = LOS_SEIS.filter((s) => s.desde === 'SCRUM-508');
  assert.equal(deAyer.length, 1, '🔴 el censo de partida no era 1: vuelve a medirlo antes de sumar.');
  assert.equal(deHoy.length, 5, `🔴 este ticket cablea ${deHoy.length} y los que faltaban eran CINCO.`);
  assert.equal(deAyer.length + deHoy.length, conFila.length,
    '🔴 el 1 de partida más los 5 nuevos no dan los que hay: alguien entró por otro sitio.');

  // Cada uno con SU clase, y ninguna repetida entre emisores distintos: si dos emisores compartieran
  // `kind`, la pregunta «¿se le envió el digest?» no se podría contestar.
  const todas = LOS_SEIS.flatMap((s) => s.clases);
  assert.equal(new Set(todas).size, todas.length,
    `🔴 dos emisores comparten clase de correo: ${todas.join(', ')}`);
});

test('SCRUM-508 · 🔴 la fila se escribe por UN SOLO camino, no por seis parecidos', () => {
  // Si un emisor escribiera su fila por su cuenta, la tabla se llenaría igual y el ticket parecería
  // hecho. Sería una SEGUNDA FORMA: el día que cambie qué se escribe —una columna, el enmascarado
  // del `error`, el plazo— habría que acordarse de todos, y el que se olvide no dará error.
  const escritores = censarEscritores();

  assert.ok(escritores.length >= 1,
    '🔴 ESCÁNER CIEGO: el censo no encuentra NINGUNA escritura en `email_messages`. Si de verdad no '
    + 'hay ninguna, la tabla está vacía y este ticket no ha hecho nada; y si hay y no las ve, el '
    + 'aserto de abajo pasaría en verde sobre seis formas distintas.');

  assert.deepEqual(escritores.map((e) => e.fichero), [REPOSITORIO],
    '🔴 HAY MÁS DE UN CAMINO PARA ESCRIBIR LA FILA:\n    '
    + escritores.map((e) => `${e.fichero}:${e.linea} (${e.operacion})`).join('\n    ') + '\n\n'
    + '  Es el defecto que SCRUM-475 cerró con el emisor único, un nivel más abajo: seis sitios\n'
    + '  escribiendo lo mismo son seis que hay que recordar cuando cambie qué se escribe.\n'
    + `  Todo pasa por \`registrarEnvio\` en ${REPOSITORIO}.`);
});

// ── 3 · 🔴 CONTROL POSITIVO · cada clase escribe UNA fila con su `kind` ─────────────────────

test('SCRUM-508 · 🔴 cada clase de correo escribe EXACTAMENTE UNA fila, con su `kind`', async () => {
  // Exactamente una: dos es tan defecto como cero — el webhook actualizaría una y dejaría la otra
  // mintiendo. Se recorren las NUEVE clases del vocabulario cerrado.
  for (const [nombre, kind] of Object.entries(CLASES_DE_CORREO)) {
    const cliente = clienteEspia();
    const r = await registrarEnvio({
      contexto: { merchantId: 7, kind }, to: 'ana@obra.example',
      constancia: constanciaDeEnvio({ id: `resend-${kind}` }), cliente,
    });
    assert.equal(r.escrita, true, `🔴 «${nombre}» no escribe fila: ${r.motivo}`);
    assert.equal(cliente.escrituras.length, 1,
      `🔴 «${nombre}» escribe ${cliente.escrituras.length} filas para UN envío.`);
    assert.equal(cliente.escrituras[0].data.kind, kind,
      `🔴 «${nombre}» escribe otro \`kind\`: ${cliente.escrituras[0].data.kind}`);
    assert.equal(cliente.escrituras[0].data.providerId, `resend-${kind}`,
      `🔴 «${nombre}» pierde el \`provider_id\`, que es lo único con lo que el receptor la encuentra.`);
  }
});

test('SCRUM-508 · el vocabulario de clases es CERRADO y no se repite ningún valor', () => {
  const valores = Object.values(CLASES_DE_CORREO);
  assert.equal(new Set(valores).size, valores.length,
    `🔴 dos claves del vocabulario valen lo mismo: ${valores.join(', ')}`);
  assert.ok(valores.length >= 9,
    `🔴 el vocabulario trae ${valores.length} clases y son NUEVE (medido el 13-ago-2026).`);
  // Y está congelado: un `kind` nuevo se nombra ahí, no se cuela como literal en un emisor.
  assert.ok(Object.isFrozen(CLASES_DE_CORREO), '🔴 el vocabulario no está congelado.');
});

// ── 4 · 🔴 CONTROL NEGATIVO · la invariante de 501, VUELTA A PROBAR ─────────────────────────

test('SCRUM-508 · 🔴 si la escritura revienta, NINGUNO de los seis deja de mandar su correo', async () => {
  // La misma invariante de SCRUM-501, y se vuelve a probar en vez de citarla: ahora hay cinco
  // emisores más colgando de ella, y una invariante que solo se probó una vez no cubre a los nuevos.
  for (const [nombre, kind] of Object.entries(CLASES_DE_CORREO)) {
    const cliente = clienteEspia({ revienta: true });
    let devuelto;
    await assert.doesNotReject(async () => {
      devuelto = await registrarEnvio({
        contexto: { merchantId: 7, kind }, to: 'ana@obra.example',
        constancia: constanciaDeEnvio({ id: 'x' }), cliente,
      });
    }, `🔴 «${nombre}»: la escritura LANZA y tumbaría el envío que observa. El correo sale y el `
     + 'llamador recibe una excepción como si no hubiera salido.');
    assert.deepEqual(devuelto, { escrita: false, motivo: 'fallo_escritura' },
      `🔴 «${nombre}» no distingue «no consta» de «consta».`);
  }
});

// ── 5 · 🔴 RGPD · ninguno de los seis mete una dirección en un texto libre ──────────────────

test('SCRUM-508 · 🔴 ninguna clase deja la dirección en la columna `error`', async () => {
  // Es el defecto que destapó mi propio test en SCRUM-501: el mensaje del proveedor trae el
  // destinatario dentro, y el guard de RGPD vigila COLUMNAS, no CONTENIDOS. Se comprueba para las
  // NUEVE clases, porque cada emisor tiene su propio mensaje de error.
  const CORREO = 'ana@obra.example';
  for (const [nombre, kind] of Object.entries(CLASES_DE_CORREO)) {
    const cliente = clienteEspia();
    await registrarEnvio({
      contexto: { merchantId: 7, kind }, to: CORREO,
      constancia: constanciaDeFallo({ message: `550 no such user ${CORREO}` }), cliente,
    });
    const fila = cliente.escrituras[0].data;
    const enClaro = Object.entries(fila)
      .filter(([, v]) => typeof v === 'string' && v.includes(CORREO))
      .map(([k]) => k);
    assert.deepEqual(enClaro, ['toEmail'],
      `🔴 «${nombre}» deja la dirección en ${enClaro.join(', ')}. Solo \`toEmail\` está cubierta por `
      + '`CAMPOS_PERSONALES` (SCRUM-497): cualquier otra copia sobreviviría a una supresión del '
      + 'art. 17, y el guard no la vería porque vigila columnas y no contenidos.');
  }
});

// ── 6 · la semántica de fallo de los cinco NO ha cambiado ───────────────────────────────────

test('SCRUM-508 · 🔴 los emisores SIGUEN LANZANDO cuando el correo no sale', () => {
  // Cablear el contexto no podía convertir un `throw` en un `return` silencioso: sus llamadores
  // detectan el fallo por la EXCEPCIÓN, y en `lifecycle` de eso depende que `markSent` no marque un
  // envío que no existió. Es el mismo aserto que hace el guard de la fase 1, y se repite aquí porque
  // este ticket TOCÓ la firma de esos `sendEmail`.
  for (const f of ['messaging/domain/lifecycle.service', 'messaging/domain/weeklyDigest.service',
                   'messaging/domain/merchantNotifications', 'auth/domain/auth.service']) {
    const t = fs.readFileSync(path.join(RAIZ, `src/modules/${f}.ts`), 'utf8');
    assert.match(t, /if \(!r\.enviado\) throw new Error/,
      `🔴 ${f} ha dejado de lanzar cuando el correo no sale. Al cablear el registro se ha cambiado su `
      + 'semántica de fallo: sus llamadores dependen de la excepción para registrarlo, y en '
      + '`lifecycle` además para no marcar como enviado un correo que no salió.');
  }
});
