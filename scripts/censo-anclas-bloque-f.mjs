#!/usr/bin/env node
// scripts/censo-anclas-bloque-f.mjs — SCRUM-551
//
// SCRUM-558 · el ancla exige DOS condiciones, no una:
//     ① que el simbolo EXISTA        (SCRUM-551)
//     ② que el usuario pueda LLEGAR  (SCRUM-558)
// La segunda nacio de una frase que paso la primera en verde y era falsa igualmente: el
// mantenimiento de climatizacion esta construido y el cron lo dispara, pero nace detras de un
// flag apagado que el merchant NO puede encender. CONSTRUIDO no es ALCANZABLE. Detalle y
// limites del detector, en el bloque de alcanzabilidad de mas abajo.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTE GUARD EXISTE Y TODAVIA NO VIGILA — Y NO ENGANCHARLO ES UNA DECISION, NO UN OLVIDO
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// NO esta enganchado a `pretest` A PROPOSITO. Con los textos como estan HOY este censo da
// ROJO por las afirmaciones sin ancla que encuentra abajo, y ese rojo es CORRECTO: son
// promesas que el producto no cumple. Pero engancharlo hoy bloquearia el CI de TODO EL MUNDO
// por unos textos que ni siquiera estan publicados (las dos secciones van `hidden`).
//
// Se engancha cuando S3 haya reescrito los textos (punto 4 de SCRUM-551, que NO es de este
// PR). Mientras tanto se ejecuta a mano: `npm run censo:anclas-f`.
//
// ⚠️ Un guard que existe y no corre no protege de nada: lo unico que impide que esto se
// olvide es que el rojo esta MEDIDO y escrito en la entrega, y que `package.json` lo declara
// —con su test que lo comprueba—, asi que borrarlo se ve en el diff.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// POR QUE, Y DE DONDE SALE LA REGLA
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// SCRUM-332 (F5) llevaba una regla dura —«UNA FILA SIN ANCLA NO SE ESCRIBE»— y funciono: la
// sesion que escribio la comparativa DESCARTO la fila del cobro con tarjeta porque las reglas
// 18 y 23 lo condicionan a Stripe Connect activo por merchant.
//
// A F4 y a F6 esa regla no se les puso, y la landing acabo prometiendo cosas que no existen.
// El art. 5 LCD (actos de engaño) no distingue entre una tabla y una tarjeta de gremio.
//
// SE REUTILIZA EL MECANISMO DE F5, no se monta un segundo: el ancla es `fichero::simbolo` y
// tiene que EXISTIR en el arbol. No es un estado de Jira —esta sesion no tiene acceso a Jira,
// y un estado que no se puede medir desde el repo no es un ancla, es una promesa sobre otra
// promesa—. Un simbolo que esta en el codigo se comprueba; «Finalizada» en un tablero, no.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// COMO SE DERIVA EL CENSO (y por que no hay lista escrita a mano de textos)
// ═════════════════════════════════════════════════════════════════════════════════════════
//
// La poblacion sale del HTML: TODO elemento de texto dentro de una seccion marcada
// `data-microcopy="PENDIENTE_FUNDADOR"`. Hoy son dos, `#heroe-f4` (F4) y `#gremios` (F6), y
// se descubren por el atributo — si mañana hay una tercera, entra sola.
//
// La correspondencia se exige EN LAS DOS DIRECCIONES, igual que en F5:
//   · unidad en el HTML sin entrada aqui  → 🔴 (nadie ha dicho que sostiene esa frase)
//   · entrada aqui sin unidad en el HTML  → 🔴 (un ancla no puede quedar cubriendo un texto
//     que ya no existe)
//
// Y el TEXTO se guarda con el ancla: si S3 reescribe una frase, el ancla que la sostenia deja
// de valer automaticamente y hay que volver a declararla. Es lo contrario de lo que paso en
// F4 y F6, donde el texto se escribio y nadie volvio a mirar.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const LANDING = 'public/index.html';

/**
 * 🔴 SCRUM-557 · EL ALCANCE SALE DE LA IDENTIDAD DE LAS SECCIONES, NO DE SU MARCADOR.
 *
 * La primera version descubria las secciones por `data-microcopy="PENDIENTE_FUNDADOR"`, y ese
 * atributo hacia DOS trabajos a la vez: marcar que un texto no esta aprobado, y definir el
 * alcance de este censo. La consecuencia se ve al enunciarla: **el dia que se aprueba un texto
 * y se retira el marcador, ese texto SALE DEL CENSO**. Aprobar apagaba la vigilancia sobre lo
 * aprobado — justo cuando pasa a ser publicable.
 *
 * No es hipotetico: el fundador aprobo los 37 textos el 20-ago-2026, y registrar esa aprobacion
 * consiste en retirar los 17 marcadores de `#heroe-f4` y `#gremios`. Con el mecanismo viejo,
 * ese commit habria dejado 17 anclas huerfanas y las tres frases sin ancla sin vigilar.
 *
 * Ahora una seccion deja de censarse cuando **DEJA DE EXISTIR**, no cuando alguien la aprueba:
 * el alcance es esta lista de IDs, y cada id censado tiene que estar en el HTML.
 *
 * ⚠️ LOS DOS MARCADORES NO SE FUSIONAN, y se midio antes de decidirlo (SCRUM-557 punto 1):
 *   · `data-microcopy="PENDIENTE_FUNDADOR"` — sin aprobar Y la seccion va `hidden`, con test
 *     en las dos direcciones (`scrum549`). Retirarlo ES registrar la aprobacion.
 *   · `data-propuesta="microcopy-sin-aprobar"` — el de `#comparativa`, misma idea y otra
 *     grafia.
 * Los dos son marcadores de APROBACION, y por eso ninguno vale como alcance. Unificar su
 * vocabulario es otro trabajo: aqui solo se deja de depender de ellos.
 */
export const SECCIONES_BLOQUE_F = {
  'heroe-f4': { censada: true },
  'gremios': { censada: true },
  // Sus 20 unidades NUNCA han pasado por ESTE censo (SCRUM-555). Meterlas hoy exigiria 20
  // entradas nuevas en el registro y dejaria main en rojo, que es lo que este ticket viene a
  // quitar. Queda DECLARADO fuera, con su ticket: un hueco escrito no es un hueco escondido.
  // ⚠️ FUERA DE ESTE CENSO NO ES SIN VIGILAR, y el matiz importa porque la linea de arriba se
  // leia como un hueco. `#comparativa` la cubre F5: `tests/scrum332-comparativa-anclas.test.mjs`
  // ancla FILA A FILA y exige la correspondencia en LOS DOS SENTIDOS —ninguna fila sin ancla y
  // ningun ancla sin fila—, mas el caso de que el comprobador sepa fallar. Medido el 20-ago-2026:
  // 5 tests, 5 en verde. Lo que le falta a esta seccion es entrar en el registro de PROMESAS de
  // aqui, no vigilancia.
  'comparativa': { censada: false, motivo: 'la cubre F5 fila a fila (scrum332); lo que falta es su entrada en ESTE registro → SCRUM-555' },
  // 🔴 SCRUM-557 punto 2 · SALE, y sale POR EL CRITERIO, no por retirarle el atributo a mano.
  // El criterio: este censo vigila el texto del bloque F que esta EN PROPUESTA; `#contacto-publico`
  // es el canal de contacto de F7 y su copy no es una propuesta del bloque F. Su marcador se
  // queda donde esta — retirarlo seria registrar una aprobacion, y eso no es de este ticket.
  // ⚠️ DISCREPANCIA DECLARADA: el comentario de SCRUM-549 en el HTML dice que sus textos SIGUEN
  // sin aprobar (F7-1 a F7-4), mientras que el encargo lo da por aprobado el 20-ago. No se
  // resuelve aqui: en los dos casos SALE de este censo, pero quien lo lea debe saber que las
  // dos fuentes no dicen lo mismo.
  'contacto-publico': { censada: false, motivo: 'F7: canal de contacto, no texto del bloque F en propuesta' },
};

/** Los dos marcadores de aprobacion que hay hoy en la landing. Ninguno define el alcance. */
export const MARCADORES_DE_APROBACION = [
  /data-microcopy="PENDIENTE_FUNDADOR"/,
  /data-propuesta="microcopy-sin-aprobar"/,
];

/** Lo que un texto de propuesta puede declarar. */
export const SIN_CAPACIDAD = 'SIN_CAPACIDAD'; // no afirma que el producto haga nada
export const SIN_ANCLA = 'SIN_ANCLA';         // afirma una capacidad que HOY no existe

/**
 * El registro. Cada unidad de texto de una seccion de propuesta declara qué la sostiene.
 *
 * `anclas`: lista de `fichero::simbolo`, o `SIN_CAPACIDAD`, o `SIN_ANCLA` con su `promete`.
 * `texto`:  la frase tal cual estaba al declararla. Si cambia, el ancla caduca y hay que
 *           volver a mirarla — que es justo lo que no se hizo en F4 y F6.
 */
export const ANCLAS_F = {
  // ── F4 · el heroe ──────────────────────────────────────────────────────────────────────
  'heroe-f4/h1#1': {
    texto: 'Del presupuesto al cobro, sin salir de WhatsApp.',
    anclas: ['src/integrations/whatsapp.ts::sendWhatsAppTemplate'],
  },
  'heroe-f4/p#1': {
    texto: 'Crea el presupuesto en 30 segundos, tu cliente lo firma desde el móvil y te paga — con tarjeta, Bizum o transferencia. No hace falta que te fíes: haz tú el recorrido completo antes de dar tu correo.',
    anclas: SIN_ANCLA,
    // 🔴 F4-3. «con tarjeta» es EXACTAMENTE lo que F5 descarto: reglas 18 y 23 — tarjeta real
    // solo con Stripe Connect activo en ESE merchant, y `PAYMENTS_CONNECT_ENABLED` esta en
    // `false` («OFF hasta CONNECT-1», `src/core/flags.ts`). Bizum va igual: `BIZUM_MANUAL_ENABLED`
    // y `BIZUM_AUTO_ENABLED`, las dos en `false`. De los tres medios que promete la frase, el
    // unico disponible hoy para un merchant real es la transferencia.
    promete: 'CONNECT-1 (PAYMENTS_CONNECT_ENABLED) y C1-4 (BIZUM_MANUAL_ENABLED) — reglas 18 y 23',
  },
  'heroe-f4/p#2': {
    texto: '14 días gratis Sin tarjeta',
    anclas: ['src/modules/auth/domain/auth.service.ts::planExpiresAt'],
  },

  // ── F6 · los gremios ───────────────────────────────────────────────────────────────────
  'gremios/h2#1': { texto: 'El recorrido es el mismo. El trabajo, no.', anclas: SIN_CAPACIDAD },
  'gremios/p#1': { texto: 'Busca el tuyo — así es un día normal con YaQu en la mano.', anclas: SIN_CAPACIDAD },

  'gremios[fontaneria]/h3#1': { texto: 'Fontanería', anclas: SIN_CAPACIDAD },
  'gremios[fontaneria]/p#1': {
    texto: 'Presupuestas un desatasco desde la furgoneta, el cliente firma en su móvil y cobras al terminar — sin volver a casa a hacer papeles.',
    anclas: ['src/modules/quotes/app/routes/quotes.routes.ts::signatureData'],
  },

  'gremios[electricidad]/h3#1': { texto: 'Electricidad', anclas: SIN_CAPACIDAD },
  'gremios[electricidad]/p#1': {
    texto: 'Cambias un cuadro y aparecen dos puntos de luz más. Añades las líneas en la misma escalera, el cliente acepta en el momento y no se quedan sin cobrar.',
    anclas: SIN_ANCLA,
    // 🔴 F6-8. El presupuesto ADICIONAL depende del ROL (`Quote.esAdicional`), y ese campo esta
    // declarado en el schema como PENDIENTE del fundador: `jobId` dice a que trabajo pertenece
    // pero NO si es el original o un adicional, asi que el rol no se puede deducir. El propio
    // `prisma/schema.prisma` lo escribe al lado del campo, citando SCRUM-195.
    promete: 'SCRUM-195 — la mitad pendiente (Quote.esAdicional, schema del fundador)',
  },

  'gremios[reformas]/h3#1': { texto: 'Reformas', anclas: SIN_CAPACIDAD },
  'gremios[reformas]/p#1': {
    texto: 'Una obra de tres semanas y cuatro pagos. Cobras por tramos según avanza y cada parte firmado queda con su fecha.',
    // Las dos mitades de la frase, cada una con su mecanismo: el reparto por tramos y la
    // transicion emitido→firmado del albaran, que es lo que le pone fecha a «cada parte».
    anclas: [
      'src/modules/invoicing/domain/invoiceLines.service.ts::stageLines',
      'src/modules/jobs/domain/albaran.service.ts::canTransitionAlbaran',
    ],
  },

  'gremios[climatizacion]/h3#1': { texto: 'Climatización', anclas: SIN_CAPACIDAD },
  'gremios[climatizacion]/p#1': {
    texto: 'Revisas la caldera antes del invierno. El presupuesto sale de la sala de máquinas y la revisión del año que viene queda anotada sola.',
    // ⚠️ ANCLADA, y con un matiz que se declara en vez de esconderse: el mecanismo EXISTE y lo
    // dispara el cron de verdad (no es una funcion suelta que nadie llama). Lo que gobierna si
    // corre para un merchant concreto es `MAINTENANCE_ENABLED`, que es OPT-IN del merchant, no
    // un «sin construir». Es distinto del caso de la tarjeta, donde la bandera esta OFF porque
    // el mecanismo no esta hecho. Queda anotado para que el fundador lo mire.
    anclas: [
      'src/modules/maintenance/domain/maintenance.service.ts::runMaintenanceProposals',
      'src/core/cron/cron.ts::runMaintenanceProposals',
    ],
    // 🔴 SCRUM-558 · LA PUERTA. El ancla de arriba es CIERTA y se queda: el simbolo existe y el
    // cron lo dispara. Lo que faltaba era la segunda condicion — que el usuario pueda llegar.
    // Medido el 20-ago-2026: `MAINTENANCE_ENABLED` nace en `false` (tabla P), `registerMerchant`
    // no escribe `flags`, con el flag apagado la ruta da 404, el cron salta el plan con motivo
    // `flag_off` y al aceptar el presupuesto ni se ofrece el interruptor. Y el merchant tampoco
    // puede encenderlo: escribir `merchants.flags` es accion manual (SCRUM-207).
    tras: [{
      flag: 'MAINTENANCE_ENABLED',
      porDefecto: false,
      motivo: 'opt-in del merchant que el merchant NO puede activar (SCRUM-207: merchants.flags '
        + 'se escribe a mano). No es «sin construir»: es construido y sin camino.',
    }],
  },

  'gremios[cerrajeria]/h3#1': { texto: 'Cerrajería', anclas: SIN_CAPACIDAD },
  'gremios[cerrajeria]/p#1': {
    texto: 'Una apertura a las dos de la mañana. Presupuestas en el portal, el cliente firma en su móvil y cobras antes de recoger la herramienta.',
    anclas: ['src/modules/quotes/app/routes/quotes.routes.ts::signatureData'],
  },

  'gremios[pintura]/h3#1': { texto: 'Pintura', anclas: SIN_CAPACIDAD },
  'gremios[pintura]/p#1': {
    texto: 'Mides el piso y mandas el presupuesto antes de bajar la escalera. La señal entra antes de que compres la pintura.',
    anclas: SIN_ANCLA,
    // 🔴 F6-16. Lo verifico el asesor en Jira el 20-ago: promete SCRUM-142, «Accion del
    // fundador», bloqueado por el dictamen P1.
    // ⚠️ MATIZ MEDIDO EN EL CODIGO, que el informe recoge y que el fundador tiene que arbitrar:
    // COBRAR una señal si existe (el plan de tramos reparte y el primer tramo es la señal);
    // lo que SCRUM-142 tiene bloqueado es EMITIR la factura de anticipo. Si la frase se lee
    // como «el dinero entra», el mecanismo esta; si se lee como «con su factura», no.
    promete: 'SCRUM-142 — emisión del anticipo, bloqueada por el dictamen P1',
  },
};

/**
 * Marcas de que un texto AFIRMA UNA CAPACIDAD del producto.
 *
 * NO deciden el veredicto —eso lo decide el registro—, sirven de contraste: una unidad
 * declarada `SIN_CAPACIDAD` que lleve una de estas dentro es 🔴. Sin eso, `SIN_CAPACIDAD`
 * seria una puerta de escape para colar cualquier promesa sin ancla, y una puerta que existe
 * se acaba usando.
 */
export const MARCAS_CAPACIDAD = [
  /\bcobras?\b/i, /\bpaga\b/i, /\btarjeta\b/i, /\bbizum\b/i, /\btransferencia\b/i,
  /\bseñal\b/i, /\btramos?\b/i, /\bfirma(?:do)?\b/i, /\bacepta\b/i,
  /\bqueda anotad/i, /\bcaduca\b/i, /\bañades\b/i, /\bpresupuestas?\b/i,
];


/* ════════════════════════════════════════════════════════════════════════════════════════
   SCRUM-558 · LA SEGUNDA CONDICIÓN: QUE EL USUARIO PUEDA LLEGAR AL SÍMBOLO

   El censo preguntaba «¿existe el símbolo?». Y existir no es alcanzable.

   El caso que lo destapó, `gremios[climatizacion]/p#1` («la revisión del año que viene queda
   anotada sola»), tenía su ancla BIEN puesta: `runMaintenanceProposals` existe y lo dispara el
   cron de verdad. Y aun así la frase es falsa para todo merchant nuevo, porque
   `MAINTENANCE_ENABLED` nace en `false` y sin ese flag la ruta da 404, el cron salta el plan y
   ni siquiera se le ofrece el interruptor. Encenderlo es escribir `merchants.flags` a mano.

   Es «apagado ≠ no construido» del revés: CONSTRUIDO ≠ ALCANZABLE. Las tres que el censo ya
   cazaba se cazaron porque NO tenían ancla. Ésta la tenía, y es igual de falsa.

   ⚠️ Y NO se generaliza a «detrás de un flag = mentira». Lo que decide es el VALOR. La tabla P
   tiene hoy un flag encendido por defecto (`WHATSAPP_TEMPLATES_ENABLED: true`); una frase
   detrás de él sería perfectamente cierta. Por eso aquí se LEE el valor en vez de suponerlo.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export const TABLA_P = 'src/core/flags.ts';

/** Lo que necesita ser cierto para que «el default de la tabla» describa a un merchant nuevo. */
export const ALTA_DE_MERCHANT = 'src/modules/auth/domain/auth.service.ts';

/**
 * Los defaults de la tabla P, LEÍDOS de `src/core/flags.ts`.
 *
 * 🔴 EL SUELO ESTÁ AQUÍ, Y ES EL CARO. Si este parser no consigue leer la tabla, la respuesta
 *    NO puede ser «doy el flag por encendido y sigo»: eso convierte cada fallo de lectura en un
 *    aprobado silencioso, justo para las frases que más caro salen si son falsas. Devuelve
 *    `{ ok: false, motivo }` y el censo lo canta como NO SUPE MIRAR.
 *
 * Se lee del FUENTE y no de `dist/`: `dist/` puede estar viejo, y un default caducado se lee
 * igual de bien que uno vigente.
 */
export function defaultsDeLaTablaP(raiz) {
  const abs = path.join(raiz, TABLA_P);
  if (!fs.existsSync(abs)) return { ok: false, motivo: `no existe ${TABLA_P}` };
  const src = fs.readFileSync(abs, 'utf8');

  const ini = src.indexOf('export const FLAG_DEFAULTS = {');
  if (ini < 0) return { ok: false, motivo: `no encuentro \`export const FLAG_DEFAULTS = {\` en ${TABLA_P}` };
  const fin = src.indexOf('} as const;', ini);
  if (fin < 0) return { ok: false, motivo: `encuentro FLAG_DEFAULTS pero no su cierre \`} as const;\` en ${TABLA_P}` };

  // Los comentarios se quitan ANTES de buscar. Media tabla lleva explicación al lado, y una
  // línea comentada que mencione un flag contaría como declaración.
  const cuerpo = src.slice(ini, fin)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

  const tabla = {};
  for (const m of cuerpo.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*(true|false)\s*,/gm)) {
    tabla[m[1]] = m[2] === 'true';
  }

  // Control del parser: la tabla real ronda la docena. Si salen cuatro, no es que haya cuatro:
  // es que el formato cambió y estoy leyendo mal. Un parser que devuelve poco y no se queja es
  // indistinguible de uno que funciona.
  const n = Object.keys(tabla).length;
  if (n < 8) {
    return { ok: false, motivo: `sólo he sabido leer ${n} flags de ${TABLA_P}. La tabla P tiene más: el formato ha cambiado y este parser está leyendo mal` };
  }
  return { ok: true, tabla };
}

/**
 * Los flags que vigila el FICHERO de un ancla, derivados de sus llamadas a `isFlagEnabled`.
 *
 * 🔴 LO QUE ESTO NO VE, Y SE DICE CON ESAS PALABRAS: mira el fichero del ancla y nada más. Una
 *    puerta que viva sólo en la ruta que expone el símbolo —y las hay: `maintenance.routes.ts`
 *    devuelve 404 con el flag apagado— no aparece aquí. Por eso la puerta se DECLARA en el
 *    registro y esto es sólo la red que caza al que se olvide de declararla, no la medida de
 *    la que sale el veredicto.
 *
 *    Se probó primero por MÓDULO en vez de por fichero, y se descartó MIDIENDO: `src/modules/
 *    invoicing` comprueba `INVOICING_ES_ENABLED` y `SIF_ENABLED`, los dos apagados, y habría
 *    marcado como inalcanzable el ancla de reformas (`invoiceLines.service.ts::stageLines`),
 *    que no está detrás de ningún flag. Un detector que grita de más se acaba ignorando.
 */
export function flagsQueVigilaElFichero(rel, raiz) {
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, 'utf8');
  return [...new Set([...src.matchAll(/isFlagEnabled\(\s*'([A-Z][A-Z0-9_]*)'/g)].map((m) => m[1]))];
}

/**
 * La premisa de la que cuelga todo lo anterior: que un merchant nuevo NO lleve override propio,
 * y por tanto le aplique el default de la tabla.
 *
 * Medido el 20-ago-2026: `registerMerchant` crea la fila sin tocar `flags` (la palabra no
 * aparece ni una vez en el fichero). El día que el alta empiece a escribir flags, «el default
 * de la tabla» deja de describir a un merchant nuevo y todo este razonamiento cambia de
 * sentido — así que se vigila, en vez de darse por hecho para siempre.
 */
export function elAltaNoEscribeFlags(raiz) {
  const abs = path.join(raiz, ALTA_DE_MERCHANT);
  if (!fs.existsSync(abs)) return { ok: false, motivo: `no existe ${ALTA_DE_MERCHANT}` };
  const src = fs.readFileSync(abs, 'utf8');
  if (!src.includes('registerMerchant')) {
    return { ok: false, motivo: `${ALTA_DE_MERCHANT} ya no contiene \`registerMerchant\`: el alta se ha movido y no sé dónde mirar` };
  }
  if (/\bflags\b/.test(src)) {
    return { ok: false, motivo: `${ALTA_DE_MERCHANT} menciona \`flags\`. Si el alta escribe overrides, el default de la tabla P ya NO describe a un merchant nuevo y la alcanzabilidad de abajo está medida sobre una premisa falsa` };
  }
  return { ok: true };
}

/**
 * El veredicto de alcanzabilidad de UNA unidad anclada.
 *
 * Devuelve la lista de problemas. Vacía = un merchant nuevo llega a lo que la frase promete.
 */
export function alcanzabilidad(id, reg, raiz, tablaP) {
  const problemas = [];
  const declarados = Array.isArray(reg.tras) ? reg.tras : [];

  for (const p of declarados) {
    if (!p || typeof p.flag !== 'string') {
      problemas.push(`${id} — PUERTA MAL DECLARADA\n      → una entrada de \`tras\` sin \`flag\`. Declarar a medias no declara.`);
      continue;
    }
    // SUELO: no saber leer el valor NO es «está encendido».
    if (!tablaP.ok) {
      problemas.push(`${id} — 🔴 NO SUPE MIRAR la puerta \`${p.flag}\`\n      ${tablaP.motivo}\n`
        + '      → sin el valor por defecto no se puede decir si un merchant nuevo llega. NO se '
        + 'da por encendido: asumir encendido es el fallo caro.');
      continue;
    }
    if (!(p.flag in tablaP.tabla)) {
      problemas.push(`${id} — 🔴 NO SUPE MIRAR la puerta \`${p.flag}\`\n`
        + `      → el registro declara ese flag y la tabla P de ${TABLA_P} no lo tiene. O lo han `
        + 'renombrado, o nunca existió. En ninguno de los dos casos se da por encendido.');
      continue;
    }
    const real = tablaP.tabla[p.flag];
    if (typeof p.porDefecto === 'boolean' && p.porDefecto !== real) {
      problemas.push(`${id} — EL VALOR DECLARADO CADUCÓ (\`${p.flag}\`)\n`
        + `      el registro dice ${p.porDefecto}, la tabla P dice ${real}\n`
        + '      → alguien movió el default y aquí sigue la foto vieja. Vuelve a mirar la frase '
        + 'con el valor de hoy antes de tocar este número.');
      continue;
    }
    if (real === false) {
      problemas.push(`${id} — 🔴 ANCLADA PERO INALCANZABLE (\`${p.flag}\` = false)\n`
        + `      texto: «${String(reg.texto).slice(0, 120)}»\n`
        + `      motivo: ${p.motivo || '(sin declarar)'}\n`
        + '      → el símbolo existe; lo que no existe es el camino del usuario hasta él. La '
        + 'frase es falsa para un merchant nuevo.');
    }
  }

  // LA RED: una puerta que está en el código y NO en el registro.
  const yaDeclarados = new Set(declarados.map((p) => p && p.flag));
  for (const a of reg.anclas) {
    const rel = String(a).split('::')[0];
    for (const flag of flagsQueVigilaElFichero(rel, raiz)) {
      if (yaDeclarados.has(flag)) continue;
      problemas.push(`${id} — PUERTA SIN DECLARAR (\`${flag}\` en ${rel})\n`
        + '      → el fichero del ancla comprueba ese flag y el registro no lo dice. Mira su '
        + 'valor por defecto y decláralo en `tras` con su motivo, aunque esté encendido: lo que '
        + 'no está escrito, la próxima vez no se mira.');
    }
  }
  return problemas;
}

const limpiar = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Las secciones del bloque F que este censo vigila, buscadas POR SU ID.
 *
 * ⚠️ La etiqueta se busca tolerando atributos y en varias lineas: `#contacto-publico` abre su
 * `<section>` repartido en seis lineas, y `#heroe-f4` lleva la `class` ANTES del `id`. Asumir
 * que la etiqueta viene desnuda o en una sola linea es el defecto de SCRUM-553.
 */
export function bloquesDePropuesta(html) {
  const out = [];
  for (const [id, cfg] of Object.entries(SECCIONES_BLOQUE_F)) {
    if (!cfg.censada) continue;
    const re = new RegExp(`<section[^>]{0,400}?\\bid="${id}"[\\s\\S]{0,400}?>`);
    const m = re.exec(html);
    if (!m) { out.push({ id, cuerpo: null, ausente: true }); continue; }
    const fin = html.indexOf('</section>', m.index);
    out.push({ id, cuerpo: html.slice(m.index, fin === -1 ? html.length : fin) });
  }
  return out;
}

/**
 * Secciones que llevan un marcador de aprobacion y NO estan declaradas en el alcance.
 *
 * Es la red de seguridad: el dia que alguien marque una seccion nueva —como paso con
 * `#contacto-publico` en SCRUM-549— el censo NO la traga en silencio ni la ignora en silencio:
 * obliga a decidir si entra o sale, y a escribirlo.
 */
export function seccionesMarcadasSinDeclarar(html) {
  const out = [];
  for (const m of html.matchAll(/<section([^>]{0,400}?|[\s\S]{0,400}?)>/g)) {
    const abre = m[0];
    if (!MARCADORES_DE_APROBACION.some((re) => re.test(abre))) continue;
    const id = /\bid="([^"]+)"/.exec(abre)?.[1] || '(sin-id)';
    if (!(id in SECCIONES_BLOQUE_F)) out.push(id);
  }
  return [...new Set(out)];
}

/** Toda unidad de texto visible dentro de las secciones de propuesta. */
export function unidades(html) {
  const out = [];
  for (const b of bloquesDePropuesta(html)) {
    if (!b.cuerpo) continue; // ausente: lo denuncia `censar`
    const cuenta = {};
    for (const m of b.cuerpo.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const texto = limpiar(m[2]);
      if (!texto) continue;
      // ¿de qué tarjeta viene? — el último `data-gremio` que quedó por detrás
      const gremio = [...b.cuerpo.slice(0, m.index).matchAll(/data-gremio="([^"]+)"/g)].pop()?.[1] || '';
      const clave = `${b.id}${gremio ? `[${gremio}]` : ''}/${m[1]}`;
      cuenta[clave] = (cuenta[clave] || 0) + 1;
      out.push({ id: `${clave}#${cuenta[clave]}`, texto, bloque: b.id, gremio });
    }
  }
  return out;
}

/** ¿Existe `fichero::simbolo`? El fichero tiene que estar Y contener el símbolo. */
export function anclaViva(ancla, raiz) {
  const [rel, simbolo] = String(ancla).split('::');
  if (!rel || !simbolo) return { viva: false, motivo: `ancla mal formada: «${ancla}» (falta ::)` };
  const abs = path.join(raiz, rel);
  if (!fs.existsSync(abs)) return { viva: false, motivo: `no existe el fichero ${rel}` };
  if (!fs.readFileSync(abs, 'utf8').includes(simbolo)) {
    return { viva: false, motivo: `${rel} ya no contiene «${simbolo}»` };
  }
  return { viva: true };
}

/**
 * `registro` se puede inyectar. No es un adorno: la rama que castiga declarar `SIN_CAPACIDAD`
 * una frase que SI afirma una capacidad solo se alcanza con un registro mal declarado, y sin
 * poder inyectarlo esa rama no la ejercitaria nadie — se podria borrar entera con la suite en
 * verde, que es justo el hueco que SCRUM-388 documenta.
 */
export function censar({ html, raiz, registro = ANCLAS_F }) {
  const us = unidades(html);
  const problemas = [];
  const sinAncla = [];
  const inalcanzables = [];

  // SCRUM-558 · se lee UNA vez y se le pasa a cada unidad. Si no se pudo leer, cada unidad con
  // puerta declarada lo dira por su nombre en vez de dar el flag por encendido.
  const tablaP = defaultsDeLaTablaP(raiz);

  // Y la premisa de la que cuelga leer el default: que el alta no escriba overrides.
  const alta = elAltaNoEscribeFlags(raiz);
  if (!alta.ok) {
    problemas.push('LA PREMISA DE LA ALCANZABILIDAD SE HA MOVIDO\n      ' + alta.motivo + '\n'
      + '      → mientras esto no se resuelva, «default de la tabla P» y «lo que tiene un '
      + 'merchant nuevo» han dejado de ser lo mismo.');
  }

  // 🔴 SCRUM-557 · UNA SECCION DEJA DE CENSARSE CUANDO DEJA DE EXISTIR, no cuando se aprueba.
  //    Si esta declarada `censada` y no aparece en el HTML, es rojo: o se retiro de verdad —y
  //    entonces hay que retirarla tambien de `SECCIONES_BLOQUE_F` y sus anclas— o alguien le
  //    cambio el id y el censo se ha quedado mirando al vacio sin decirlo.
  const bloques = bloquesDePropuesta(html);

  // 🔴 CEGUERA: si NINGUNA de las secciones censadas existe, no es que el bloque F esté limpio —
  //    es que no se ha podido mirar. Los dos dan «0 unidades» y significan lo contrario, así que
  //    se distinguen aquí y no se dejan al llamante.
  if (bloques.length > 0 && bloques.every((b) => b.ausente)) {
    return {
      ok: false, ciego: true, unidades: 0, sinAncla: [], inalcanzables: [],
      salida: '🔴 CIEGO: ninguna de las secciones declaradas del bloque F ('
        + bloques.map((b) => '#' + b.id).join(', ') + ') está en el HTML. O el fichero no es la '
        + 'landing, o les han cambiado el id a todas. Un cero de unidades aquí se leería como '
        + '«ninguna promesa sin ancla», que es la conclusión más cara.',
    };
  }

  for (const b of bloques) {
    if (b.ausente) {
      problemas.push(`SECCION DECLARADA QUE NO EXISTE: #${b.id}\n`
        + '      → o le han cambiado el id (arréglalo en `SECCIONES_BLOQUE_F`), o se retiró la '
        + 'sección (y entonces retira también sus anclas: un ancla sin sección no describe nada).');
    }
  }

  // 🔴 LA RED DE SEGURIDAD. El dia que alguien marque una seccion nueva —como paso con
  //    `#contacto-publico` en SCRUM-549— el censo no la traga ni la ignora en silencio.
  for (const id of seccionesMarcadasSinDeclarar(html)) {
    problemas.push(`SECCION MARCADA Y SIN DECLARAR: #${id}\n`
      + '      → lleva un marcador de aprobación y no está en `SECCIONES_BLOQUE_F`. Decide si '
      + 'entra al censo o no, y ESCRÍBELO con su motivo. No decidir es dejarla sin vigilar.');
  }

  // SUELO: si no se ve ninguna unidad, el cero de abajo es ceguera y no limpieza.
  if (us.length === 0 && problemas.length === 0) {
    return {
      ok: false, ciego: true, unidades: 0, sinAncla, inalcanzables: [],
      salida: '🔴 CIEGO: no se ha encontrado NI UNA unidad de texto en secciones '
        + '`data-microcopy="PENDIENTE_FUNDADOR"`. O el atributo cambió, o el extractor se rompió. '
        + 'Un cero aquí se leería como «no hay ninguna promesa sin ancla», que es la conclusión '
        + 'más cara que puede dar este fichero.',
    };
  }

  for (const u of us) {
    const reg = registro[u.id];
    if (!reg) {
      problemas.push(`${u.id} — SIN DECLARAR\n      texto: «${u.texto.slice(0, 120)}»\n`
        + '      → nadie ha dicho qué mecanismo sostiene esta frase. Decláralo en `ANCLAS_F`.');
      continue;
    }
    if (reg.texto !== u.texto) {
      problemas.push(`${u.id} — EL TEXTO CAMBIÓ y su ancla caducó\n      ahora: «${u.texto.slice(0, 120)}»\n`
        + `      antes: «${String(reg.texto).slice(0, 120)}»\n`
        + '      → una frase nueva necesita que alguien vuelva a mirar qué la sostiene.');
      continue;
    }
    if (reg.anclas === SIN_CAPACIDAD) {
      const marca = MARCAS_CAPACIDAD.find((re) => re.test(u.texto));
      if (marca) {
        problemas.push(`${u.id} — declarada SIN_CAPACIDAD y afirma una\n      texto: «${u.texto.slice(0, 120)}»\n`
          + `      → contiene ${marca}. \`SIN_CAPACIDAD\` no es una puerta de escape.`);
      }
      continue;
    }
    if (reg.anclas === SIN_ANCLA) {
      sinAncla.push({ id: u.id, texto: u.texto, promete: reg.promete || '(sin declarar)' });
      problemas.push(`${u.id} — 🔴 AFIRMA UNA CAPACIDAD SIN ANCLA\n      texto: «${u.texto}»\n`
        + `      promete: ${reg.promete || '(sin declarar)'}`);
      continue;
    }
    for (const a of reg.anclas) {
      const v = anclaViva(a, raiz);
      if (!v.viva) {
        problemas.push(`${u.id} — ANCLA MUERTA (${a})\n      ${v.motivo}\n`
          + '      → o el mecanismo se movió (actualiza el ancla), o se retiró (y entonces la frase '
          + 'ya no es cierta y hay que retirarla).');
      }
    }

    // 🔴 SCRUM-558 · LA SEGUNDA CONDICION. El simbolo existe; ¿llega el usuario hasta el?
    const pa = alcanzabilidad(u.id, reg, raiz, tablaP);
    if (pa.length) {
      problemas.push(...pa);
      if (pa.some((p) => p.includes('INALCANZABLE'))) {
        inalcanzables.push({ id: u.id, texto: u.texto, tras: reg.tras });
      }
    }
  }

  // La otra dirección: un ancla que ya no cubre ninguna unidad.
  const vistos = new Set(us.map((u) => u.id));
  for (const id of Object.keys(registro)) {
    if (!vistos.has(id)) {
      problemas.push(`${id} — ANCLA SIN TEXTO\n      → está declarada aquí y no hay ninguna unidad `
        + 'con ese id en el HTML. Retírala: un ancla que sobrevive a su frase deja de describir nada.');
    }
  }

  return {
    ok: problemas.length === 0,
    ciego: false,
    unidades: us.length,
    sinAncla,
    inalcanzables,
    salida: [
      `unidades de texto en secciones de propuesta: ${us.length}`,
      `bloques: ${bloquesDePropuesta(html).map((b) => b.id).join(', ')}`,
      ...(problemas.length ? ['', '🔴 PROBLEMAS:', ...problemas.map((p) => '   · ' + p)] : ['', '✅ todas las unidades tienen su ancla viva.']),
    ].join('\n'),
  };
}

export function censarEnDisco(raiz = process.cwd()) {
  return censar({ html: fs.readFileSync(path.join(raiz, LANDING), 'utf8'), raiz });
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
// `pathToFileURL` y no comparar rutas a mano: en Windows `import.meta.url` trae `/C:/…` y
// cualquier comparacion de cadenas falla en silencio — el CLI no se ejecutaria y nadie lo notaria.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const r = censarEnDisco(process.cwd());
  console.log(r.salida);
  if (!r.ok) {
    console.log('\n🔴 Este censo NO está enganchado a `pretest` todavía (ver la cabecera).');
    console.log('   El rojo de arriba es CORRECTO y lo reescribe S3 en el punto 4 de SCRUM-551.');
    process.exit(1);
  }
}
