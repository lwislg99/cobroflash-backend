// tests/scrum475-ignoran-el-resultado.test.mjs — SCRUM-475 (los ocho que ignoraban el resultado)
//
// SIETE AVISOS QUE PERDÍAN EL FALLO POR EL CANAL DEL VALOR. Sin gate: AST + funciones puras. Ni BD,
// ni red.
//
// ── LA VÍCTIMA ────────────────────────────────────────────────────────────────────────────
// Un profesional activa el plan Pro y no recibe el correo que lo confirma. Otro se registra y no
// recibe el enlace con el que entrar a la cuenta que acaba de crear. Un tercero deja de recibir su
// resumen de los lunes. En los tres casos **el sistema cree que se lo dijo** y no hay ni una línea
// que diga lo contrario: el resumen semanal no tiene pantalla donde se vea su ausencia.
//
// ── 🔴 Y EL PEOR, QUE NO ERA UN AVISO PERDIDO SINO UNO PERDIDO PARA SIEMPRE ───────────────
// En el ciclo de vida el patrón era `await sendEmail(...)` como sentencia suelta y `markSent(...)`
// en la línea siguiente. Cuando `sendEmail` DEVUELVE el fallo sin lanzar —el correo del merchant sin
// `@`—, la ejecución seguía y `markSent` escribía `day3: 1`. El merchant no lo recibe nunca, el
// sistema cree que sí, **y no se reintenta jamás porque `alreadySent` ya dice que se mandó.**
// Es la mentira exacta que SCRUM-475 fase 1 se negó a introducir, viva por el otro canal.
//
// ── EL CRITERIO, QUE ES LA MITAD DEL TICKET ───────────────────────────────────────────────
// Un fallo viaja por DOS canales: LANZA (excepción) y DEVUELVE (valor). `enviarCorreo` no lanza
// nunca, así que para sus llamadores «¿hay catch?» no significa nada. Los ocho de este ticket
// perdían el fallo por el segundo. Y un `try` **solo ve la excepción de lo que se espera con
// `await`** — sin esa regla, cualquier `fire-and-forget` dentro de una ruta con `try/catch` sale
// «bien atendido» para siempre (SCRUM-477 §5).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
  censarLlamadores, nombresDeEmisor, canalDeFallo, seUsaElResultado, emisorasDiferidas, RAIZ,
} from './_censo-correo.mjs';
import {
  AVISOS, registroDeAviso, conConstancia, dejarConstancia, parteNuevo, resumenDelParte,
} from '../dist/modules/messaging/domain/avisoConstancia.js';
import { avisosSinProgramar } from '../dist/core/cron/cron.js';

const EMISORES = nombresDeEmisor();
const LLAMADORES = censarLlamadores(EMISORES);

/**
 * LOS OCHO, con fichero, emisor y QUÉ AVISO se pierde en cada uno. Medido el 12-ago-2026 contra
 * `origin/main` = `1117b313`, con el instrumento de `main` (`tests/_censo-correo.mjs`).
 *
 * `fuera: true` es el del ENLACE MÁGICO pedido desde la pantalla de login. NO se toca, y el motivo
 * no es que sea difícil: `POST /auth/login` contesta un texto a un usuario **sin sesión**
 * («Si el email está registrado recibirás el enlace en breve»), y decirle ahí que el correo no salió
 * es microcopy que aprueba el asesor (regla 30). Además revelaría que su email existe, que es
 * justamente lo que esa respuesta genérica evita. Queda NOMBRADO, no escondido.
 */
const LOS_OCHO = [
  { fichero: 'src/core/cron/cron.ts',                        emisor: 'sendWeeklyDigests',     aviso: 'resumen_semanal' },
  { fichero: 'src/core/cron/cron.ts',                        emisor: 'runLifecycleEmails',    aviso: 'ciclo_de_vida' },
  { fichero: 'src/index.ts',                                 emisor: 'startCronJobs',         aviso: 'resumen_semanal' },
  { fichero: 'src/modules/auth/domain/auth.service.ts',      emisor: 'requestMagicLink',      aviso: 'enlace_de_acceso' },
  { fichero: 'src/modules/auth/domain/auth.service.ts',      emisor: 'requestMagicLink',      aviso: 'enlace_de_acceso' },
  { fichero: 'src/modules/auth/domain/auth.service.ts',      emisor: 'sendWelcomeEmail',      aviso: 'bienvenida' },
  { fichero: 'src/modules/billing/app/routes/stripe.routes.ts', emisor: 'sendFirstPaymentEmail', aviso: 'primer_pago' },
  { fichero: 'src/modules/auth/app/routes/auth.routes.ts',   emisor: 'requestMagicLink',      aviso: 'enlace_de_acceso', fuera: true },
];

/** Lo que ve alguien cuando el guard cae: la RUTA y QUÉ AVISO se pierde. Sin esto no es un aviso. */
function mensajeDeAvisoPerdido(perdidos) {
  return perdidos
    .map((p) => {
      const conocido = LOS_OCHO.find((o) => o.fichero === p.fichero && o.emisor === p.emisor);
      return `${p.fichero}:${p.linea}  ${p.emisor}  → se pierde el aviso «${conocido?.aviso ?? 'SIN CLASIFICAR'}»`;
    })
    .join('\n    ');
}

/** Captura lo que se escribe en `console.error` mientras corre `fn`. */
async function capturandoLog(fn) {
  const original = console.error;
  const lineas = [];
  console.error = (...args) => lineas.push(args.join(' '));
  try { await fn(); } finally { console.error = original; }
  return lineas;
}

// ── 0 · 🔴 AUTOPRUEBA · el detector se prueba ANTES de creerse su número ───────────────────

test('SCRUM-475 · 🔴 AUTOPRUEBA: el criterio distingue «se mira el resultado» de «se tira», sobre fuente sintético', () => {
  // «Cero que ignoran el resultado» y «mi detector no reconoce el patrón» salen por la misma línea y
  // significan lo contrario. `seUsaElResultado` es el criterio del que depende TODO el recuento de
  // abajo, así que primero demuestra que sabe clasificar sobre un fuente de mentira.
  const veredicto = (fuente) => {
    const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
    let visto = null;
    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'emisor') {
        visto = seUsaElResultado(n);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    assert.notEqual(visto, null, `🔴 el detector NO VE la llamada en: ${fuente.trim()}`);
    return visto;
  };

  // Se TIRA el resultado — las cuatro formas que tenían los ocho de este ticket.
  assert.equal(veredicto('async function f() { await emisor(1); }'), false,
    '🔴 no reconoce el descarte más común: `await emisor(...)` como SENTENCIA SUELTA. Con esto roto, '
    + 'los ocho de este ticket habrían salido como «alguien se entera».');
  assert.equal(veredicto('function f() { emisor(1); }'), false,
    '🔴 no reconoce una llamada suelta sin `await`.');
  assert.equal(veredicto('function f() { emisor(1).catch(() => {}); }'), false,
    '🔴 un `.catch(() => {})` cuenta como mirar el resultado, y es lo contrario: el `catch` NUNCA '
    + 'recibe el valor. Éste es el criterio que SCRUM-477 tuvo que añadir.');
  assert.equal(veredicto('function f() { emisor(1).catch((e) => log(e)); }'), false,
    '🔴 un `.catch(e => …)` recibe el ERROR, no el valor: el fallo DEVUELTO sigue perdido.');

  // Se MIRA — las formas con las que se han arreglado los siete.
  assert.equal(veredicto('async function f() { const r = await emisor(1); return r; }'), true,
    '🔴 marca como tirado un resultado que se asigna: entonces clasifica al azar y el 7 de abajo no '
    + 'significa nada.');
  assert.equal(veredicto('async function f() { conConstancia("a", "b", emisor(1)); }'), true,
    '🔴 no ve que el valor se ENTREGA a otra función. Es la forma de los cuatro de SCRUM-477 y de '
    + 'dos de los siete de este ticket.');
  assert.equal(veredicto('async function f() { dejarConstancia("a", "b", await emisor(1)); }'), true,
    '🔴 no ve el resultado entregado como argumento tras un `await`: es la forma del enlace de acceso.');
  assert.equal(veredicto('function f() { emisor(1).then((r) => usar(r)); }'), true,
    '🔴 un `.then(r => …)` con parámetro SÍ consume el valor.');
});

// ── 1 · 🔴 SUELO · el censo tiene que VER a los ocho antes de opinar sobre ellos ───────────

test('SCRUM-475 · 🔴 SUELO: el censo VE las ocho llamadas, o su número no significa nada', () => {
  // Medido el 12-ago-2026 contra `origin/main` = 1117b313: 17 emisores derivados · 31 llamadas.
  assert.ok(EMISORES.length >= 17,
    `🔴 la lista DERIVADA de emisores trae ${EMISORES.length} nombres y eran DIECISIETE. Con menos, `
    + 'el censo mira a menos sitios y su silencio no vale nada — que es EXACTAMENTE cómo se '
    + 'perdieron los cuatro mudos al unificar el emisor (SCRUM-475 fase 2).');
  assert.ok(LLAMADORES.length >= 31,
    `🔴 el censo encuentra ${LLAMADORES.length} llamadas a un emisor y eran TREINTA Y UNA. Con la `
    + 'propagación encerrada en un fichero salían 14 — el mismo árbol, menos de la mitad.');

  // 🔴 Y LAS OCHO, UNA A UNA. Esto es lo que impide que la bajada de 8 a 1 sea un censo ciego: si
  // el detector dejara de ver una llamada, aquí falta — no «mejora».
  for (const uno of LOS_OCHO) {
    const vistas = LLAMADORES.filter((l) => l.fichero === uno.fichero && l.emisor === uno.emisor);
    assert.ok(vistas.length >= 1,
      `🔴 EL CENSO YA NO VE \`${uno.emisor}\` en ${uno.fichero}.\n\n`
      + `  Era uno de los ocho que perdían el fallo, y su aviso es «${uno.aviso}». Si ha dejado de\n`
      + '  aparecer, «ninguno pierde el fallo» significa «no supe mirar»: el mismo verde con el\n'
      + '  significado contrario. Ya pasó una vez y el número cayó a cero solo.');
  }

  // Y el canal se sigue clasificando: si todo saliera del mismo cubo, el criterio no existiría.
  const canales = canalDeFallo();
  assert.equal(canales.get('enviarCorreo'), 'devuelve',
    '🔴 `enviarCorreo` no sale como `devuelve`, y es el emisor que motivó todo el criterio: captura '
    + 'dentro y devuelve `{ enviado:false }`, así que preguntarle «¿hay catch?» no significa nada.');
  assert.equal(canales.get('requestMagicLink'), 'devuelve',
    '🔴 `requestMagicLink` ha pasado a LANZAR. Eso cambiaría la respuesta de `POST /auth/login` a un '
    + 'usuario sin sesión (su `try/catch` contesta 500), que es microcopy del asesor (regla 30).');
});

// ── 1-bis · 🔴 ENVOLTORIO DE PROGRAMACIÓN vs EMISOR EN EL CAMINO DEL CORREO ────────────────

test('SCRUM-475 · 🔴 el censo SEPARA lo que envía al llamarlo de lo que solo lo deja programado', () => {
  // POR QUÉ ESTA SEPARACIÓN NO ES UN DETALLE: `nombresDeEmisor()` marca emisora a toda función que
  // ALCANCE al proveedor, y con eso `ignora-resultado: 8` sumaba dos cosas distintas. Tirar el
  // resultado de `sendWelcomeEmail` pierde el fallo de un correo; tirar el de `startCronJobs` no
  // pierde ninguno —no manda nada al llamarlo, registra callbacks—. Un censo que los cuenta juntos
  // ya no significa «ocho avisos pierden su fallo».
  const diferidas = emisorasDiferidas();

  assert.deepEqual([...diferidas].sort(), ['startCronJobs'],
    `🔴 ha cambiado QUIÉN envía al llamarlo: diferidas = ${[...diferidas].sort().join(', ') || '(ninguna)'}.\n\n`
    + '  Medido el 12-ago-2026 contra `origin/main` = 1117b313: de los 17 emisores derivados, uno\n'
    + '  solo —`startCronJobs`— llega al proveedor ÚNICAMENTE por dentro de un callback programado.\n'
    + '  Si aparece otro, hay un envío nuevo que ocurre más tarde y su fallo se pierde en otro sitio;\n'
    + '  si desaparece éste, el criterio ha dejado de derivarse y volvemos a contar peras con manzanas.');

  // Y los que SÍ envían al llamarlos siguen ahí: sin este aserto, «una sola diferida» lo cumpliría
  // un clasificador que marcara todo como inmediato.
  for (const nombre of ['sendWelcomeEmail', 'sendFirstPaymentEmail', 'requestMagicLink',
                        'sendWeeklyDigests', 'runLifecycleEmails']) {
    assert.ok(!diferidas.has(nombre),
      `🔴 \`${nombre}\` sale como DIFERIDO y no lo es: el envío ocurre dentro de la llamada, así que `
      + 'tirar su resultado SÍ pierde el fallo de un correo. Clasificarlo aparte lo sacaría del '
      + 'trinquete sin haberlo arreglado.');
  }
});

test('SCRUM-475 · 🔴 AUTOPRUEBA del criterio «envía ahora o lo deja programado»', () => {
  // El criterio de arriba decide qué sale del trinquete, así que tiene que demostrarse sobre fuente
  // sintético ANTES de creerse su lista. Se prueba la pieza que decide: ¿está la llamada dentro de
  // un callback que ejecutará otro más tarde?
  const dentroDeProgramador = (fuente) => {
    const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
    let visto = null;
    const raiz = sf;
    const visitar = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'mandar') {
        // Réplica del criterio del censo: ¿se cruza un callback pasado a un programador al subir?
        let diferida = false;
        for (let p = n.parent; p && p !== raiz; p = p.parent) {
          if (!(ts.isArrowFunction(p) || ts.isFunctionExpression(p))) continue;
          const llamada = p.parent;
          if (!llamada || !ts.isCallExpression(llamada) || !llamada.arguments.includes(p)) continue;
          const nombre = ts.isPropertyAccessExpression(llamada.expression) ? llamada.expression.name.text
            : (ts.isIdentifier(llamada.expression) ? llamada.expression.text : '');
          if (['schedule', 'setTimeout', 'setInterval', 'setImmediate'].includes(nombre)) { diferida = true; break; }
        }
        visto = diferida;
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
    assert.notEqual(visto, null, `🔴 el detector NO VE la llamada en: ${fuente.trim()}`);
    return visto;
  };

  assert.equal(dentroDeProgramador('function f(){ cron.schedule("0 9 * * 1", async () => { await mandar(); }); }'), true,
    '🔴 el detector NO reconoce un envío que solo ocurre cuando el cron lo dispare: entonces '
    + '`startCronJobs` saldría como emisor inmediato y su llamador seguiría contándose como si '
    + 'perdiera el fallo de un correo.');
  assert.equal(dentroDeProgramador('function f(){ mandar(); }'), false,
    '🔴 el detector marca como diferido un envío que ocurre AL LLAMAR: así se saca del trinquete '
    + 'cualquier aviso sin haberlo arreglado, que es el peor fallo posible en este criterio.');
  assert.equal(dentroDeProgramador('function f(){ const cb = async () => { await mandar(); }; cb(); }'), false,
    '🔴 una función que se define y se LLAMA no está diferida: solo lo está la que se ENTREGA a un '
    + 'programador para que la ejecute más tarde.');
});

// ── 2 · 🔴 EL GUARD · ninguno de los siete pierde el fallo, y el rojo NOMBRA ruta y aviso ──

test('SCRUM-475 · 🔴 los siete MIRAN el resultado, y el rojo dice qué aviso se pierde', () => {
  // 🔴 ASERTO POSITIVO: `mira-resultado`, NO «que no sea ignora-resultado». Y esto lo destapó un
  // VERDE FALSO, no una relectura: la primera versión de este guard buscaba `ignora-resultado` y
  // `traga-mudo`, igual que el de SCRUM-477. Se probó EN ROJO devolviendo `stripe.routes.ts` a
  // `sendFirstPaymentEmail(merchantId);` a secas — el defecto exacto que este ticket quita — y el
  // guard **pasó en verde**.
  //
  // El motivo: al arreglarlos, dos de estos emisores dejaron de tener su `.catch()` inline y pasaron
  // de canal `devuelve` a canal `lanza`. Y `censarLlamadores` solo etiqueta `ignora-resultado`
  // cuando el canal es `devuelve`; con `lanza` y sin `catch` alrededor, la misma llamada tirada sale
  // **`sube`** («alguien arriba se entera»), que aquí es mentira: un fire-and-forget sin `.catch` de
  // un emisor que lanza no lo recoge nadie — es una promesa rechazada sin manejador, que en Node
  // tumba el proceso— y el fallo DEVUELTO se sigue perdiendo entero.
  //
  // La lección es la de la casa otra vez: **arreglar el sitio cambió la categoría por la que se le
  // vigilaba**, y un guard escrito en negativo se quedó mirando un cubo por el que la regresión ya
  // no pasa. Exigir el veredicto BUENO no tiene ese agujero: cierra `sube`, `traga-log` y `avisa` de
  // una vez, sin tener que enumerar las formas de fallar.
  const fallan = [];
  for (const uno of LOS_OCHO.filter((o) => !o.fuera)) {
    const vistas = LLAMADORES.filter((l) => l.fichero === uno.fichero && l.emisor === uno.emisor);
    for (const v of vistas) if (v.veredicto !== 'mira-resultado') fallan.push(v);
  }

  assert.deepEqual(fallan, [],
    '🔴 HAY AVISOS QUE VUELVEN A PERDER SU FALLO:\n    ' + mensajeDeAvisoPerdido(fallan) + '\n\n'
    + `  Veredicto visto: ${fallan.map((f) => f.veredicto).join(', ') || '—'}. Tiene que ser \`mira-resultado\`.\n\n`
    + '  Alguien ha dejado de mirar lo que devuelve un envío. `enviarCorreo` NO LANZA: devuelve\n'
    + '  `{ enviado:false, constancia }`, así que sin mirar el valor el fallo no deja nada — no hay\n'
    + '  excepción que ningún `catch` pueda ver. Y si el emisor SÍ lanza, tirar la llamada sin\n'
    + '  `.catch` no es «sube»: es una promesa rechazada que nadie maneja.\n\n'
    + '  Pásalo por `conConstancia(<aviso>, <destinatario>, <envío>)` si es fire-and-forget, o por\n'
    + '  `dejarConstancia(<aviso>, <destinatario>, <resultado>)` si ya tienes el resultado en la mano.');

  // CONTROL POSITIVO del mensaje: el rojo que se acaba de exigir vacío tiene que NOMBRAR la ruta y
  // el aviso cuando hay algo que nombrar. Un guard cuyo mensaje no se ha visto nunca no está probado.
  const sintetico = mensajeDeAvisoPerdido([
    { fichero: 'src/core/cron/cron.ts', linea: 110, emisor: 'sendWeeklyDigests' },
  ]);
  assert.match(sintetico, /src\/core\/cron\/cron\.ts:110/,
    '🔴 el mensaje del guard no nombra la RUTA: entonces el que lo lea no sabe dónde mirar.');
  assert.match(sintetico, /resumen_semanal/,
    '🔴 el mensaje del guard no dice QUÉ AVISO se pierde. «Algo no se registra» no permite decidir '
    + 'nada; «el resumen semanal no sale» sí.');
});

test('SCRUM-475 · 🔴 EL TRINQUETE: queda UNO, es el del enlace mágico, y cero es SOSPECHA', () => {
  const perdidos = LLAMADORES.filter((l) => l.veredicto === 'ignora-resultado' || l.veredicto === 'traga-mudo');
  const detalle = mensajeDeAvisoPerdido(perdidos);

  // 🔴 EL SUELO, Y VA PRIMERO: cero NO es mejor que uno. El único que puede quedar está declarado
  // fuera de este ticket, así que si desaparece es que el censo dejó de verlo o que alguien tocó una
  // superficie que necesita al asesor. Las dos cosas hay que mirarlas, no celebrarlas.
  assert.ok(perdidos.length >= 1,
    '🔴 EL CENSO ENCUENTRA CERO SITIOS QUE PIERDEN EL FALLO, Y TIENE QUE QUEDAR UNO.\n\n'
    + '  El del enlace mágico de `POST /auth/login` se dejó fuera A PROPÓSITO (regla 30: la\n'
    + '  respuesta que ve un usuario sin sesión es microcopy del asesor). Si ya no sale:\n'
    + '    · o el censo ha dejado de ver esa llamada —«cero» y «no supe mirar» por la misma línea—,\n'
    + '    · o alguien la ha arreglado tocando esa respuesta, y eso necesitaba GO.\n'
    + '  Mídelo antes de subir el trinquete.');

  assert.equal(perdidos.length, 1,
    `🔴 el censo da ${perdidos.length} sitios que pierden el fallo y tiene que quedar 1:\n    ${detalle}\n\n`
    + '  Eran DOCE con el criterio completo (SCRUM-477): cuatro se arreglaron allí y siete aquí.\n'
    + '  Si SUBE, alguien ha escrito un envío nuevo cuyo fallo no mira nadie: nómbralo y pásalo por\n'
    + '  `conConstancia`. Si BAJA, comprueba PRIMERO que no sea el censo el que dejó de ver.');

  assert.deepEqual(
    perdidos.map((p) => `${p.fichero} ${p.emisor}`),
    ['src/modules/auth/app/routes/auth.routes.ts requestMagicLink'],
    `🔴 el que queda NO es el que se declaró fuera:\n    ${detalle}\n\n`
    + '  El único admitido es el enlace mágico de la pantalla de login. Cualquier otro es una\n'
    + '  regresión, y el recuento solo no lo vería.');
});

// ── 3 · 🔴 EL TEST QUE DECIDE · cada uno de los siete, si falla, DEJA RASTRO ───────────────

test('SCRUM-475 · 🔴 el «bienvenido a Pro» que no sale deja rastro, con QUÉ aviso y PARA QUIÉN', async () => {
  // `stripe.routes.ts` → `conConstancia('primer_pago', …)`. El profesional ha pagado y tiene el plan
  // activo; si el correo no sale, él no sabe que se activó y nosotros creemos que se lo dijimos.
  const lineas = await capturandoLog(() => new Promise((listo) => {
    conConstancia('primer_pago', 'juan@fontaneria.example', Promise.resolve({
      enviado: false,
      motivo: 'fallo_envio',
      constancia: { estado: 'fallo_envio', idProveedor: null, motivo: 'ENOTFOUND: api.resend.com' },
    }));
    setTimeout(listo, 0);
  }));
  assert.equal(lineas.length, 1, '🔴 un «bienvenido a Pro» perdido no deja nada.');
  const r = JSON.parse(lineas[0].replace('[aviso] ', ''));
  assert.equal(r.aviso, 'primer_pago', '🔴 el rastro no dice QUÉ aviso se perdió.');
  assert.equal(r.motivo, 'ENOTFOUND: api.resend.com', '🔴 se ha perdido el motivo.');
  assert.ok(!r.destinatario.includes('juan'), `🔴 el correo va en claro: «${r.destinatario}»`);
  assert.match(r.destinatario, /fontaneria\.example$/,
    '🔴 el enmascarado se ha comido el dominio: entonces el rastro no permite ni acercarse a QUIÉN '
    + 'se quedó sin aviso. Enmascarar no es borrar.');
});

test('SCRUM-475 · 🔴 el ENLACE DE ACCESO que no sale deja rastro — y el «no hubo envío» NO lo finge', async () => {
  // `auth.service.ts` ×2 → `dejarConstancia('enlace_de_acceso', …)`. Sin este correo, el que acaba
  // de registrarse tiene una cuenta y ninguna forma de entrar en ella.
  const lineas = await capturandoLog(() => {
    dejarConstancia('enlace_de_acceso', 'nuevo@obra.example', {
      enviado: false, motivo: 'sin_transporte',
      constancia: { estado: 'fallo_envio', idProveedor: null, motivo: 'sin_transporte: no hay transporte configurado' },
    });
  });
  assert.equal(lineas.length, 1, '🔴 un enlace de acceso perdido no deja rastro.');
  assert.match(lineas[0], /sin_transporte/);
  assert.match(lineas[0], /enlace_de_acceso/);

  // 🔴 Y EL CASO QUE NO SE PUEDE INVENTAR: `requestMagicLink` devuelve `null` cuando el email NO
  // ESTÁ REGISTRADO. Ahí no hubo envío, así que no hay fallo del que dejar constancia — anotar uno
  // sería fabricar un intento que no existió, justo la clase de dato que este carril viene quitando.
  const nada = await capturandoLog(() => {
    assert.equal(dejarConstancia('enlace_de_acceso', 'fantasma@nadie.example', null), null,
      '🔴 se fabrica constancia de un envío que no se intentó.');
  });
  assert.deepEqual(nada, [], `🔴 un «no hubo envío» está escribiendo en el log: ${nada.join(' | ')}`);
});

test('SCRUM-475 · 🔴 los avisos del CRON dejan rastro, y su parte llega arriba', () => {
  // `cron.ts:110` y `cron.ts:125`. Antes eran `Promise<void>`: el fallo de cada merchant moría en un
  // `console.error` en prosa dentro del bucle y al cron no llegaba NADA que pudiera mirar.
  const parte = parteNuevo();
  parte.intentados = 3;
  parte.entregados = 2;
  parte.perdidos.push(registroDeAviso('resumen_semanal', 'ana@electricidad.example', {
    enviado: false, motivo: 'sin_destino',
    constancia: { estado: 'fallo_envio', idProveedor: null, motivo: 'sin_destino: destinatario vacío' },
  }));

  const resumen = resumenDelParte(parte);
  assert.match(resumen, /1 de 3/, `🔴 el parte no dice CUÁNTOS se perdieron de cuántos: «${resumen}»`);
  assert.match(resumen, /resumen_semanal/, '🔴 el parte no dice QUÉ aviso se perdió.');
  assert.match(resumen, /sin_destino/, '🔴 el parte no dice POR QUÉ.');
  assert.match(resumen, /electricidad\.example/,
    '🔴 el parte no permite acercarse a QUIÉN se quedó sin su resumen semanal.');
  assert.ok(!resumen.includes('ana@'), `🔴 el correo va en claro en el parte: «${resumen}»`);

  // CONTROL POSITIVO: una tanda sin pérdidas no produce línea. Un mecanismo que también registra
  // los aciertos llena el log de ruido y acaba desactivado — y con él se va el registro de los fallos.
  assert.equal(resumenDelParte(parteNuevo()), null,
    '🔴 una tanda en la que todo salió bien está escribiendo un aviso de fallo.');
});

test('SCRUM-475 · 🔴 un job que no queda programado deja constancia de qué aviso no saldrá', () => {
  // `index.ts:38`. Este caso NO es como los otros siete y se declara: `startCronJobs` devolvía
  // `void`, así que «nadie mira el resultado» era cierto y VACÍO. Lo que se perdía era otra cosa —
  // su última línea AFIRMABA seis jobs registrados sin haber medido ninguno—.
  assert.deepEqual(avisosSinProgramar([]), ['resumen_semanal', 'ciclo_de_vida'],
    '🔴 con CERO jobs montados, el detector no nombra ningún aviso perdido. Entonces el día que '
    + 'alguien borre un `cron.schedule` el arranque seguirá callado y esos correos no saldrán nunca.');

  assert.deepEqual(avisosSinProgramar(['digest semanal (lunes 9:00)']), ['ciclo_de_vida'],
    '🔴 no distingue CUÁL falta: nombrar los dos siempre, o ninguno, es no medir.');

  // CONTROL POSITIVO: con lo que el cron monta de verdad, no sobra ni falta nada. Se lee del árbol,
  // no de una lista escrita aquí — una lista a mano volvería a ser la afirmación que esto quita.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/core/cron/cron.ts'), 'utf8');
  const montados = [...fuente.matchAll(/programar\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(montados.length >= 6,
    `🔴 solo se leen ${montados.length} jobs montados en cron.ts y son SEIS: el detector no está `
    + 'mirando donde cree, así que el control positivo de abajo no probaría nada.');
  assert.deepEqual(avisosSinProgramar(montados), [],
    `🔴 con los jobs que el cron monta de verdad (${montados.join(', ')}) el detector dice que falta `
    + 'alguno: o el nombre del job ha cambiado y `avisosSinProgramar` mira un prefijo que ya no '
    + 'existe —y entonces avisaría en cada arranque hasta que alguien lo silenciara—, o el job se ha '
    + 'ido de verdad.');
});

// ── 4 · 🔴 LO PEOR QUE HABÍA: `markSent` marcaba como enviado lo que no salió ──────────────

/**
 * Cada `markSent(...)` de un fichero, y si LA DECISIÓN DE MARCARLO DEPENDE DEL ENVÍO.
 *
 * 🔴 CÓMO SE MIDE, Y POR QUÉ NO POR LA PALABRA `enviado`. La primera versión de este detector
 * exigía que el `if` envolvente mencionara `enviado`, y se puso ROJA sobre código CORRECTO: los
 * cinco avisos del evaluador diario delegan la decisión en `anotarEnvio(parte, correo, r)`, que
 * recibe el resultado y devuelve si se puede marcar. El código estaba bien; el detector estaba
 * atado a la FORMA (una palabra) en vez de al HECHO, que es el defecto que esta casa lleva nueve
 * variantes cazando — y me lo hice a mí mismo.
 *
 * El hecho es: **la condición tiene que USAR la variable donde cayó el resultado del envío.** Da
 * igual si la lee (`r.enviado`) o si se la pasa a alguien que decide (`anotarEnvio(..., r)`), y da
 * igual cómo se llame la variable. Lo que no pasa es un `markSent` que corre sin mirar el envío.
 */
function marcadosSinComprobar(fuente) {
  const sf = ts.createSourceFile('x.ts', fuente, ts.ScriptTarget.Latest, true);
  const out = [];
  const identificadores = (n) => {
    const vistos = new Set();
    (function walk(m) {
      if (ts.isIdentifier(m)) vistos.add(m.text);
      ts.forEachChild(m, walk);
    })(n);
    return vistos;
  };
  const visitar = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'markSent') {
      // ① el `if` MÁS CERCANO que envuelve a este `markSent`
      let envolvente = null;
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isIfStatement(p) && p.thenStatement.getStart(sf) <= n.getStart(sf)
            && n.getEnd() <= p.thenStatement.getEnd()) { envolvente = p; break; }
      }
      // ② la variable donde cayó el resultado del envío, ANTES de ese `if`, en su mismo bloque
      // ⚠️ Se ancla en el `markSent`, NO en el `if`: así el mensaje puede decir «envío visto: r»
      // cuando el envío existe y la condición simplemente no lo mira, que es más útil que «NINGUNO».
      let variableDelEnvio = null;
      const ancla = n;
      for (let p = ancla.parent; p; p = p.parent) {
        if (!ts.isBlock(p) && !ts.isSourceFile(p)) continue;
        for (const st of p.statements) {
          if (st.getEnd() > ancla.getStart(sf)) break;
          if (!ts.isVariableStatement(st)) continue;
          for (const d of st.declarationList.declarations) {
            if (d.initializer && /\bsendEmail\s*\(/.test(d.initializer.getText(sf)) && ts.isIdentifier(d.name)) {
              variableDelEnvio = d.name.text;
            }
          }
        }
        if (variableDelEnvio) break;
      }
      const usados = envolvente ? identificadores(envolvente.expression) : new Set();
      out.push({
        linea: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        condicionado: !!(envolvente && variableDelEnvio && usados.has(variableDelEnvio)),
        variableDelEnvio,
      });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return out;
}

test('SCRUM-475 · 🔴 AUTOPRUEBA del detector de `markSent`, antes de creerse su cero', () => {
  const malo = marcadosSinComprobar('async function f(){ await sendEmail(a); await markSent(1,2,"day3"); }');
  assert.equal(malo.length, 1, '🔴 el detector no ve ni la llamada a `markSent`.');
  assert.equal(malo[0].condicionado, false,
    '🔴 el detector NO RECONOCE el defecto exacto de este ticket: `sendEmail` y `markSent` en líneas '
    + 'seguidas, sin comprobar nada. Con esto roto el cero de abajo saldría verde sobre el fallo.');

  const leido = marcadosSinComprobar('async function f(){ const r = await sendEmail(a); if (r.enviado) await markSent(1,2,"day3"); }');
  assert.equal(leido[0].condicionado, true,
    '🔴 el detector marca como defectuoso un `markSent` que SÍ comprueba que el correo salió: '
    + 'entonces clasifica al azar.');

  // Y DELEGAR la decisión también vale: lo que importa es que el resultado del envío entre en ella.
  const delegado = marcadosSinComprobar('async function f(){ const env = await sendEmail(a); if (anotarEnvio(p, c, env)) await markSent(1,2,"day3"); }');
  assert.equal(delegado[0].condicionado, true,
    '🔴 el detector exige leer `.enviado` a la vista. Eso es atarse a la FORMA: pasar el resultado a '
    + 'quien decide es igual de válido, y rechazarlo obliga a escribir peor código para pasar el guard.');

  // Un `if` que condiciona por OTRA cosa NO vale: el resultado del envío no entra en la decisión.
  const otraCosa = marcadosSinComprobar('async function f(){ const r = await sendEmail(a); if (hoyEsLunes) await markSent(1,2,"day3"); }');
  assert.equal(otraCosa[0].condicionado, false,
    '🔴 cualquier `if` cuenta como comprobación: el detector se conforma con que HAYA condición en '
    + 'vez de exigir que dependa del envío.');

  // Y un `if` sin envío ninguno detrás tampoco: no se puede afirmar que dependa de lo que no hay.
  const sinEnvio = marcadosSinComprobar('async function f(){ if (algo) await markSent(1,2,"day3"); }');
  assert.equal(sinEnvio[0].condicionado, false,
    '🔴 se da por bueno un `markSent` sin ningún envío del que depender: el detector estaría '
    + 'afirmando una dependencia que no puede ver.');
});

test('SCRUM-475 · 🔴 ningún aviso del ciclo de vida se marca ENVIADO sin haber salido', () => {
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/modules/messaging/domain/lifecycle.service.ts'), 'utf8');
  const marcados = marcadosSinComprobar(fuente);

  assert.ok(marcados.length >= 7,
    `🔴 ESCÁNER CIEGO: solo se ven ${marcados.length} llamadas a \`markSent\` en lifecycle y hay 7 `
    + '(los cinco del evaluador diario, la bienvenida y el primer pago). Con cero, el aserto de '
    + 'abajo se cumpliría solo.');

  const sinComprobar = marcados.filter((m) => !m.condicionado)
    .map((m) => `línea ${m.linea} (envío visto: ${m.variableDelEnvio ?? 'NINGUNO'})`);
  assert.deepEqual(sinComprobar, [],
    `🔴 UN AVISO SE MARCA COMO ENVIADO SIN COMPROBAR QUE SALIÓ (${sinComprobar.join(', ')}).\n\n`
    + '  Es el defecto más caro de este ticket, y no viajaba por el canal que todos vigilaban:\n'
    + '  `sendEmail` DEVUELVE `sin_destino` sin lanzar cuando el correo del merchant no tiene `@`,\n'
    + '  así que el `catch` de fuera no se disparaba, la ejecución seguía y `markSent` escribía\n'
    + '  `day3: 1`. El merchant no lo recibe NUNCA, el sistema cree que sí, y no se reintenta jamás\n'
    + '  porque `alreadySent` ya dice que se mandó.\n\n'
    + '  Pon el `markSent` dentro de un `if (r.enviado)` y deja constancia en la otra rama.');
});

// ── 5 · 🔴 CONTROL NEGATIVO · un aviso roto NO puede tumbar la operación que lo dispara ────

test('SCRUM-475 · 🔴 CONTROL NEGATIVO: un aviso que revienta no tumba el registro ni la activación', async () => {
  // El `catch` de las rutas nunca sobró: sobraba que estuviera VACÍO. La cuenta ya está creada y el
  // plan ya está activo cuando esto corre; que el correo falle no puede deshacerlo ni devolver un
  // error a Stripe, que reintentaría el webhook.
  let siguio = false;
  await capturandoLog(async () => {
    const devuelto = conConstancia('bienvenida', 'a@b.example',
      Promise.reject(new Error('el proveedor está caído')));
    assert.equal(devuelto, undefined,
      '🔴 `conConstancia` devuelve algo esperable. Si devolviera una promesa, alguien acabaría '
      + 'poniéndole `await` y un correo caído tumbaría el registro de una cuenta que YA existe.');
    siguio = true;
    await new Promise((r) => setTimeout(r, 0));
  });
  assert.ok(siguio, '🔴 la operación se ha interrumpido por un aviso que no salió.');

  // Y el otro envoltorio tampoco puede tumbar nada: es síncrono y no lanza ni con basura dentro.
  await capturandoLog(() => {
    assert.doesNotThrow(() => dejarConstancia('bienvenida', '', { error: null }),
      '🔴 `dejarConstancia` lanza con un error vacío. Se llama en el camino del registro y del '
      + 'arranque: si lanza, tumba justo lo que viene a vigilar.');
  });
});

test('SCRUM-475 · 🔴 el aviso que SÍ sale no paga peaje: ni línea, ni fricción', async () => {
  const lineas = await capturandoLog(() => new Promise((listo) => {
    conConstancia('primer_pago', 'juan@fontaneria.example', Promise.resolve({
      enviado: true, via: 'resend',
      acuse: { id: 'm-1', crudo: {} },
      constancia: { estado: 'aceptado_sin_confirmacion', idProveedor: 'm-1', motivo: null },
    }));
    setTimeout(listo, 0);
  }));
  assert.deepEqual(lineas, [], `🔴 un aviso que salió bien escribe en el log: ${lineas.join(' | ')}`);
  assert.equal(registroDeAviso('bienvenida', 'x@y.example', {
    enviado: true, constancia: { estado: 'aceptado_sin_confirmacion', idProveedor: 'm-1', motivo: null },
  }), null, '🔴 se fabrica registro de un envío que salió bien.');
});

// ── 6 · el vocabulario sigue CERRADO ──────────────────────────────────────────────────────

test('SCRUM-475 · los cinco avisos nuevos están NOMBRADOS en el conjunto cerrado', () => {
  for (const aviso of ['bienvenida', 'primer_pago', 'enlace_de_acceso', 'resumen_semanal', 'ciclo_de_vida']) {
    assert.ok(AVISOS.includes(aviso),
      `🔴 «${aviso}» no está en AVISOS. Un aviso que no pasa por el conjunto cerrado nace con el `
      + 'defecto que este carril cierra: nadie sabe que existe hasta que se pierde.');
  }
  // Y los tres de SCRUM-477 siguen: ampliar no es sustituir.
  for (const aviso of ['pago_recibido', 'presupuesto_aceptado', 'presupuesto_aprobado_tecnico']) {
    assert.ok(AVISOS.includes(aviso), `🔴 se ha perdido «${aviso}», que era de SCRUM-477.`);
  }
});
