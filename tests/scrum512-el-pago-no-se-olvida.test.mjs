// SCRUM-512 · EL PRODUCTO NO OLVIDA QUE ALGUIEN PAGÓ.
//
// Sin gate: lee el código fuente y simula la secuencia. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO, MEDIDO EL 19-AGO-2026 (no deducido del ticket, que era de hace seis días)
//
// Cuando un merchant cancela, el webhook de Stripe lo devuelve a `trial` desde DOS sitios:
//
//   `src/modules/billing/app/routes/stripe.routes.ts:138`  customer.subscription.updated
//                                                          (st === 'canceled' | 'incomplete_expired')
//   `src/modules/billing/app/routes/stripe.routes.ts:151`  customer.subscription.deleted
//
// y los dos escriben LO MISMO:
//
//     { plan: 'trial', subscriptionStatus: 'canceled', stripeSubscriptionId: null, planExpiresAt: null }
//
// Los cuatro campos que decían que esa persona había comprado algo quedan a cero o a `null`. Y
// `subscriptionStatus: 'canceled'` **no distingue**: `stripe.routes.ts` escribe ese mismo valor
// para `incomplete_expired`, o sea para quien NUNCA llegó a pagar. Después de cancelar, un
// fundador que pagó nueve meses y alguien cuyo primer cobro ni cuajó son **la misma fila**.
//
// ⚠️ ESTO NO ES UNA POSTURA SOBRE LA ESCASEZ, y el test no la toma. Qué cuenta como plaza
// ocupada lo decide `PLAZA_OCUPADA` en `src/modules/billing/domain/founding.ts`, y ahí no se
// toca ni una letra: sigue exigiendo `{ plan: 'founding', subscriptionStatus: 'active' }`. La
// pregunta «¿la plaza la ocupa quien pagó alguna vez o quien está pagando ahora?» es del
// fundador y sigue abierta. Lo que este test vigila es anterior a esa pregunta y no depende de
// su respuesta: **que el hecho de haber pagado siga estando escrito en algún sitio**. Sin eso,
// la decisión que se tome no se podrá aplicar, porque el dato ya no existirá.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL RASTRO QUE SE VIGILA, Y POR QUÉ ES ÉSTE Y NO OTRO
//
// No se inventa uno nuevo: se adopta el que ya está razonado en `docs/master/SCRUM-409.md`
// fase 5 — `lifecycleEmailsSent.firstPayment`, «la marca que nada borra nunca». Los otros
// candidatos están descartados allí y se ha vuelto a comprobar hoy sobre `origin/main`:
//
//   · `stripeCustomerId`     se escribe ANTES de pagar, al abrir el checkout
//                            (`subscriptions.routes.ts:116`) — tenerlo no prueba que pagara.
//   · `stripeSubscriptionId` la cancelación lo pone a `null` — se borra justo cuando hace falta.
//   · `subscriptionStatus`   `'canceled'` vale para quien pagó y para `incomplete_expired`.
//   · `plan`                 la cancelación lo devuelve a `'trial'`.
//
// 🔴 Y POR QUÉ NO SE ARREGLA CONSERVANDO `plan` AL CANCELAR, que era la vía obvia. Medido hoy:
// `plan` GOBIERNA PERMISOS. Lo leen `getEntitlements(merchant?.plan)` (`team.routes.ts:74`),
// la cuenta de referidos activos (`referral.service.ts:53`, `plan !== 'trial'`) y los correos
// de ciclo de vida (`lifecycle.service.ts:183`, `isTrial`). Dejar `plan: 'founding'` en quien
// canceló no registraría un hecho: **regalaría el producto**. Un rastro de contabilidad no
// puede vivir en el campo que abre las puertas.
//
// ⚠️ EL LÍMITE DEL PROXY, ESCRITO COMO EXIGE EL PRECEDENTE — y es más estrecho de lo que
// SCRUM-409 dejó anotado. `markSent(…, 'firstPayment')` corre **sólo si el correo SALIÓ**
// (`if (r.enviado)`), y `enviarCorreo` se niega a contar como enviado el transporte de mentira:
// sin `RESEND_API_KEY` y sin `SMTP_URL` devuelve no-enviado a propósito (SCRUM-406). Luego en
// un entorno sin correo configurado **el pago no deja rastro ninguno**. En producción, con
// Resend configurado, lo deja. Esto NO lo cierra este ticket: se declara, se vigila lo que hay,
// y queda como hueco nombrado en `docs/master/SCRUM-512.md`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_STRIPE = 'src/modules/billing/app/routes/stripe.routes.ts';
const RUTA_LIFECYCLE = 'src/modules/messaging/domain/lifecycle.service.ts';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/** El campo donde vive el rastro. Un solo sitio, para que no se escriba a mano en cada assert. */
const RASTRO = 'lifecycleEmailsSent';
/** La clave dentro de ese JSON que significa «pagó». */
const CLAVE_PAGO = 'firstPayment';

// ── EL EXTRACTOR ─────────────────────────────────────────────────────────────────────────
//
// Se lee el fuente y se BALANCEAN LLAVES, no se casa una expresión regular contra la línea. Un
// `grep` por línea daría falso negativo el día que alguien reparta el objeto en varias —que es
// reformateo, no un cambio de conducta— y el test se apagaría solo sin que nadie lo notara.

/** El texto del objeto que empieza en `desde` (que debe ser un `{`), llaves balanceadas. */
function bloque(fuente, desde) {
  let prof = 0;
  for (let i = desde; i < fuente.length; i++) {
    if (fuente[i] === '{') prof += 1;
    else if (fuente[i] === '}') { prof -= 1; if (prof === 0) return fuente.slice(desde, i + 1); }
  }
  return null; // sin cerrar: lo caza el suelo
}

/** Las claves de PRIMER NIVEL de un objeto literal, en orden. */
function clavesDe(texto) {
  const out = [];
  let prof = 0;
  const re = /([{}]|([A-Za-z_$][\w$]*)\s*:)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    if (m[1] === '{') { prof += 1; continue; }
    if (m[1] === '}') { prof -= 1; continue; }
    if (prof === 1) out.push(m[2]);
  }
  return out;
}

/** Todos los `prisma.merchant.update({...})` del fuente, con su línea y su bloque `data`. */
function actualizacionesDeMerchant(fuente) {
  const MARCA = 'prisma.merchant.update(';
  const out = [];
  let i = 0;
  while ((i = fuente.indexOf(MARCA, i)) !== -1) {
    const abre = fuente.indexOf('{', i + MARCA.length);
    const cuerpo = abre === -1 ? null : bloque(fuente, abre);
    if (!cuerpo) { i += MARCA.length; continue; }
    const iData = cuerpo.indexOf('data:');
    const abreData = iData === -1 ? -1 : cuerpo.indexOf('{', iData);
    const data = abreData === -1 ? null : bloque(cuerpo, abreData);
    out.push({
      linea: fuente.slice(0, i).split('\n').length,
      data,
      claves: data ? clavesDe(data) : [],
    });
    i = abre + cuerpo.length;
  }
  return out;
}

/** Las actualizaciones que dejan al merchant CANCELADO. Es el camino que este test recorre. */
function cancelaciones(fuente) {
  return actualizacionesDeMerchant(fuente)
    .filter((u) => u.data && /subscriptionStatus\s*:\s*'canceled'/.test(u.data));
}

// ── LA SIMULACIÓN ────────────────────────────────────────────────────────────────────────
//
// La fila se lleva en memoria y los cambios se aplican con las CLAVES EXTRAÍDAS DEL FUENTE, no
// con un objeto copiado aquí. Ésa es la diferencia entre probar el código y probar la copia: si
// mañana alguien añade `lifecycleEmailsSent` a esos `data`, la simulación lo aplica y el test
// cae. Con el objeto copiado a mano, el test seguiría verde para siempre.

/** Un merchant con nombre y número, para que el rojo pueda ACUSAR a alguien concreto. */
function merchantQuePago() {
  return {
    id: 4242,
    name: 'Fontanería Pereira',
    plan: 'founding',
    subscriptionStatus: 'active',
    stripeCustomerId: 'cus_test4242',
    stripeSubscriptionId: 'sub_test4242',
    planExpiresAt: '2026-09-19T00:00:00Z',
    // Todavía no ha pagado: el rastro se pone en `pagar()`.
    [RASTRO]: { welcome: 1 },
  };
}

/**
 * Lo que le pasa a la fila cuando el primer pago se confirma.
 *
 * Reproduce `markSent` de `lifecycle.service.ts`: FUSIONA sobre lo que hubiera
 * (`{ ...(current || {}), [key]: 1 }`) en vez de sustituir. Que siga siendo así lo comprueba el
 * SUELO de abajo contra el fuente real — sin esa comprobación, esta función sería una opinión.
 */
function pagar(fila) {
  return { ...fila, [RASTRO]: { ...(fila[RASTRO] || {}), [CLAVE_PAGO]: 1 } };
}

/** Aplica a la fila las claves que el fuente escribe en esa cancelación. */
function cancelar(fila, u) {
  const despues = { ...fila };
  for (const k of u.claves) {
    // El valor da igual para lo que se vigila: lo que decide si el rastro sobrevive es si la
    // cancelación ESCRIBE su clave o no la toca.
    despues[k] = /:\s*null/.test(u.data) && k !== 'plan' ? null : `<escrito en :${u.linea}>`;
  }
  return despues;
}

/** ¿Consta que este merchant pagó alguna vez? */
const constaQuePago = (fila) => Boolean(fila[RASTRO] && fila[RASTRO][CLAVE_PAGO]);

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · «no hay defecto» y «no supe mirar» dan el mismo verde. Aquí se separan.
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-512 · SUELO: el extractor VE los caminos de cancelación antes de opinar', () => {
  const fuente = leer(RUTA_STRIPE);
  const todas = actualizacionesDeMerchant(fuente);
  const cancela = cancelaciones(fuente);

  assert.ok(todas.length >= 4,
    `🔴 CIEGO: solo se han encontrado ${todas.length} \`prisma.merchant.update\` en `
    + `${RUTA_STRIPE}, y el webhook tiene cinco (activación, active, past_due y las dos `
    + 'cancelaciones). El extractor balancea llaves; si el fichero se ha reorganizado, lo que '
    + 'viene debajo no está midiendo el código, está midiendo lo que supo leer.');

  assert.ok(cancela.length >= 2,
    `🔴 CIEGO, QUE NO ES «YA NO SE CANCELA»: se han encontrado ${cancela.length} caminos que `
    + `dejan al merchant en \`subscriptionStatus: 'canceled'\`, y el 19-ago-2026 había DOS `
    + `(${RUTA_STRIPE}:138 desde customer.subscription.updated y :151 desde `
    + 'customer.subscription.deleted).\n\n'
    + '  Con cero caminos encontrados, el test de supervivencia de abajo no recorrería nada y\n'
    + '  pasaría en verde sobre la nada — que es la forma más cara de aprobar este fichero.');

  // Y que el `data` se haya parseado de verdad: una lista de claves vacía también «cuadra».
  for (const u of cancela) {
    assert.ok(u.claves.includes('plan') && u.claves.includes('subscriptionStatus'),
      `🔴 CIEGO: la cancelación de ${RUTA_STRIPE}:${u.linea} se ha parseado como `
      + `[${u.claves.join(', ') || 'nada'}], y tiene que llevar al menos \`plan\` y `
      + '`subscriptionStatus`. El extractor no está leyendo el objeto que cree.');
  }
});

test('SCRUM-512 · SUELO: el rastro se sigue escribiendo donde este test cree', () => {
  const fuente = leer(RUTA_LIFECYCLE);

  assert.match(fuente, new RegExp(`markSent\\([^)]*'${CLAVE_PAGO}'\\)`),
    `🔴 CIEGO: ya no hay ningún \`markSent(…, '${CLAVE_PAGO}')\` en ${RUTA_LIFECYCLE}. El rastro `
    + 'que este test vigila ha dejado de escribirse, o ha cambiado de nombre. Vigilar la '
    + 'supervivencia de una marca que ya nadie pone es un verde que no significa nada.');

  // 🔴 Y que FUSIONA en vez de sustituir. Si `markSent` pasara a escribir `{ [key]: 1 }` a
  // secas, cada correo borraría la marca del anterior y el rastro del pago moriría por dentro
  // sin que ninguna cancelación lo tocara. `pagar()` de arriba copia esta forma; esto es lo que
  // impide que la copia se separe del original en silencio.
  assert.match(fuente, /\.\.\.\(\(current \|\| \{\}\)/,
    `🔴 \`markSent\` ya no fusiona sobre lo que hubiera en \`${RASTRO}\`. La simulación de este `
    + 'test (`pagar()`) reproduce esa fusión, así que si el original cambia hay que cambiarla — '
    + 'y sobre todo hay que MIRAR si el rastro del pago sigue sobreviviendo a los demás correos.');

  // El LÍMITE del proxy, comprobado y no sólo escrito: se marca únicamente si el correo salió.
  assert.match(fuente, /if \(r\.enviado\) await markSent\(m\.id, m\.lifecycleEmailsSent, 'firstPayment'\)/,
    `🔴 ha cambiado la condición bajo la que se escribe el rastro del pago. Estaba declarado como `
    + 'su LÍMITE: `markSent` corre sólo `if (r.enviado)`, así que sin correo configurado el pago '
    + 'no deja rastro. Si esto ha cambiado, el límite escrito en `docs/master/SCRUM-512.md` ya no '
    + 'es cierto y hay que rehacerlo — a mejor, probablemente, pero rehacerlo.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL CONTROL POSITIVO · y su negativo, que es lo que le da valor
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-512 · CONTROL: quien paga queda registrado, y quien no, no', () => {
  const antes = merchantQuePago();
  assert.equal(constaQuePago(antes), false,
    '🔴 el detector dice que ya consta el pago ANTES de pagar. Si diera siempre «sí», el test '
    + 'de supervivencia de abajo pasaría con el rastro borrado y con él intacto: no distinguiría '
    + 'nada.');

  const despues = pagar(antes);
  assert.equal(constaQuePago(despues), true,
    `🔴 tras el primer pago NO consta que «${antes.name}» (merchant ${antes.id}) haya pagado. `
    + `El rastro es \`${RASTRO}.${CLAVE_PAGO}\` y quedó: ${JSON.stringify(despues[RASTRO])}`);

  // Y que no se haya llevado por delante lo que ya había: `welcome` sigue.
  assert.equal(despues[RASTRO].welcome, 1,
    `🔴 registrar el pago ha BORRADO las otras marcas de \`${RASTRO}\`. Fusiona, no sustituye.`);

  // El negativo: quien nunca pagó no tiene el rastro, pase lo que pase con el resto de la fila.
  const nuncaPago = { ...merchantQuePago(), plan: 'trial', subscriptionStatus: 'canceled' };
  assert.equal(constaQuePago(nuncaPago), false,
    '🔴 un merchant que NUNCA pagó consta como que pagó. Ése es el caso de `incomplete_expired`: '
    + '`stripe.routes.ts` le escribe el mismo `canceled` que a quien sí pagó, y si el rastro no '
    + 'los distinguiera no serviría para nada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE ES EL TICKET · la secuencia entera, que es lo único que demuestra que SOBREVIVE
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-512 · 🔴 SECUENCIA: paga → CANCELA → el rastro del pago SIGUE AHÍ', () => {
  const fuente = leer(RUTA_STRIPE);
  const cancela = cancelaciones(fuente);
  const pagado = pagar(merchantQuePago());

  // 🔴 EL CONTROL POSITIVO VA AQUÍ DENTRO, antes de cancelar nada. Si `pagar()` dejara de
  // escribir el rastro, el bucle de abajo fallaría igual — pero acusando a la cancelación de
  // haber borrado algo que nunca llegó a existir. Un rojo con el diagnóstico cambiado cuesta más
  // que no tener rojo: manda a quien lo lea a mirar el fichero equivocado.
  assert.equal(constaQuePago(pagado), true,
    `🔴 el control positivo de este mismo caso no se sostiene: «${pagado.name}» (merchant `
    + `${pagado.id}) acaba de pagar y NO consta. Lo que falla es la simulación, NO la `
    + `cancelación — no vayas a ${RUTA_STRIPE} a buscar un defecto que no está ahí.`);

  // Probar sólo la escritura no demuestra nada: lo que hay que ver es que aguanta el camino
  // completo, y por CADA una de las dos puertas de cancelación, no por la primera que pille.
  for (const u of cancela) {
    const despues = cancelar(pagado, u);

    assert.equal(constaQuePago(despues), true,
      `🔴 «${pagado.name}» (merchant ${pagado.id}) PAGÓ, y después de la cancelación de\n`
      + `  ${RUTA_STRIPE}:${u.linea} el producto ya no lo sabe.\n\n`
      + `  esa cancelación escribe: ${u.claves.join(', ')}\n`
      + `  y entre ellas está \`${RASTRO}\`, que es donde vivía la única prueba de que pagó.\n\n`
      + '  Eso no es «se le retira el plan»: eso es que un fundador que estuvo pagando y alguien\n'
      + '  cuyo primer cobro ni cuajó (`incomplete_expired`, que recibe este mismo `canceled`)\n'
      + '  pasan a ser LA MISMA FILA. Cualquier decisión posterior sobre quién ocupó una plaza\n'
      + '  se vuelve imposible de aplicar, porque el dato ya no existe.\n\n'
      + `  Si borrar ese campo aquí es deliberado, hace falta OTRO sitio donde conste el pago\n`
      + '  antes de quitarlo de éste — y cambiarlo en `docs/master/SCRUM-512.md`.');

    // El plan SÍ se retira, y tiene que seguir haciéndolo: lo contrario sería regalar el
    // producto a quien canceló, porque `plan` gobierna `getEntitlements` (team.routes.ts:74).
    assert.notEqual(despues.plan, 'founding',
      `🔴 la cancelación de ${RUTA_STRIPE}:${u.linea} ha dejado el plan de pago puesto. `
      + '`plan` abre las puertas del producto: conservarlo no registra un hecho, regala acceso. '
      + 'El rastro del pago va en un campo que no gobierna permisos, y por eso va donde va.');
  }
});

test('SCRUM-512 · el censo de la cancelación CUADRA: escrito + intacto = la fila entera', () => {
  const fuente = leer(RUTA_STRIPE);
  const cancela = cancelaciones(fuente);
  const pagado = pagar(merchantQuePago());
  const campos = Object.keys(pagado);

  for (const u of cancela) {
    const escritos = campos.filter((k) => u.claves.includes(k));
    const intactos = campos.filter((k) => !u.claves.includes(k));

    assert.equal(escritos.length + intactos.length, campos.length,
      `🔴 el censo de ${RUTA_STRIPE}:${u.linea} no cuadra: ${escritos.length} escritos + `
      + `${intactos.length} intactos ≠ ${campos.length} campos de la fila. Un censo cuyas `
      + 'categorías no suman su total no es un censo, y las cifras de los mensajes de arriba '
      + 'estarían contando poblaciones distintas.');

    // Y que la partición no sea trivial por ninguno de los dos lados: si «escritos» saliera
    // vacío, la simulación no aplicaría nada y la supervivencia sería verde por no hacer nada.
    assert.ok(escritos.length > 0,
      `🔴 la cancelación de :${u.linea} no escribe NINGÚN campo de la fila simulada `
      + `(escribe: ${u.claves.join(', ') || 'nada'}). La secuencia de arriba no está probando `
      + 'una cancelación: está probando que no pasa nada, que siempre sale bien.');

    // ⚠️ AQUÍ NO SE COMPRUEBA que `lifecycleEmailsSent` quede intacto, y la omisión es
    // deliberada: de eso responde el caso de la SECUENCIA, y sólo él. Estaba puesto y se quitó
    // — hacía que los dos casos cayeran por el mismo hecho, y entonces ninguno de los dos rojos
    // dice ya qué se rompió. Este caso responde de una cosa: que la partición del censo sea
    // real y sume. Si falla éste, lo roto es el instrumento; si falla el otro, lo roto es el
    // producto.
  }
});
