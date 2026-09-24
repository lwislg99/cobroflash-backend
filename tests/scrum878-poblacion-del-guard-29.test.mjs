// tests/scrum878-poblacion-del-guard-29.test.mjs — SCRUM-878
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UN GUARD CUYA POBLACIÓN SON LAS RUTAS PRODUCE CEROS QUE SÓLO HABLAN DE LAS RUTAS
//
// `scrum124-r29-no-borrado-facturas` vigila la regla 29 —una factura emitida no se edita ni se
// borra— y lo hace enumerando **rutas** bajo `/admin/invoices` con `app.router.stack` +
// `getAdminMounts`. Es lo correcto para lo que mide, y no mide lo que la regla dice.
//
// Si alguien escribe sobre una factura emitida **desde un servicio**, ese guard no da rojo: da
// SILENCIO. Y el silencio se lee igual que un verde.
//
// ⛔ ESTE FICHERO MIDE Y PROPONE. No toca el camino de emisión (regla 38) ni cambia el guard de
//    SCRUM-124. Lo que hace es poner su POBLACIÓN encima de la mesa, con las dos cifras siempre:
//    cuántas escrituras hay y cuántas de ellas puede ver.
//
// 🔴 EL CENSO NO ES NUEVO: se reusa `escriturasDeModelo` (`tests/_censo-escrituras-albaran.mjs`,
//    SCRUM-462), generalizado en este ticket. Escribir un segundo censo del mismo hecho es lo que
//    ese fichero advierte en su propia cabecera — se desincronizan en cuanto uno mejore.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { escriturasDeModelo } from './_censo-escrituras-albaran.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Verbos que pueden EDITAR una factura ya existente. `create` queda fuera a propósito: crear una
// factura es EMITIRLA, no editarla, y su población ya la censa `_bocas-de-emision.mjs` (SCRUM-778).
const VERBOS = ['update', 'updateMany', 'delete', 'deleteMany'];
const CENSO = escriturasDeModelo(RAIZ, { modelo: 'invoice', verbos: VERBOS });

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA CLASIFICACIÓN · DERIVADA de la huella, no opinada
//
// La huella de VeriFactu es una lista CERRADA de ocho campos, y está en el código
// (`computeVeriFactuHash`): NIF · NumSerieFactura · FechaExpedicion · TipoFactura · CuotaTotal ·
// ImporteTotal · Huella anterior · FechaHoraHusoGenRegistro. De ahí salen las dos listas de abajo:
// lo que ENTRA en la huella (o la alimenta) es contenido fiscal; lo que no, es ficha.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Contenido FISCAL: entra en la huella o la alimenta. Editarlo es incumplir la regla 29. */
const FISCAL = new Set([
  'number', 'total', 'type', 'currency', 'lines', 'issuedAt', 'createdAt',
  'suplidos', 'discountGlobalAmount', 'retentionPct', 'retentionAmount',
  'rectifiesId', 'rectifiesNumber', 'merchantId', 'customerId',
  // Los datos congelados del documento: lo que el papel DICE.
  'customerName', 'customerLegalName', 'customerTaxId', 'customerEmail', 'customerPhone',
  'merchantName', 'merchantLegalName', 'merchantTaxId', 'merchantAddress',
  'merchantLogoUrl', 'merchantPhone', 'merchantEmail',
]);

/** SELLADO: la cadena VeriFactu. No es «editar una factura»: es emitirla, y lo gobiernan 205/207. */
const SELLADO = new Set([
  'vfHash', 'vfPrevHash', 'vfTimestamp', 'vfEstado', 'qrData',
  'vfAnulHash', 'vfAnulPrevHash', 'vfAnulTimestamp',
]);

/** FICHA y PUNTEROS: lo que se sabe DESPUÉS de emitir. La regla 29 los permite explícitamente. */
const FICHA = new Set([
  'status', 'paidAt', 'paidVia', 'chargeId', 'pdfUrl', 'tags',
  'reminder7SentAt', 'reminder14SentAt', 'sentAt', 'stageLabel',
]);

/**
 * Los campos que toca una escritura, del literal y de lo resuelto indirectamente.
 *
 * 🔴 SE PARSEA, NO SE REGEXEA, y esto lo enseñó el propio banco al salir en rojo. La primera
 * versión buscaba `campo:` — y **la propiedad abreviada no lleva dos puntos**. Resultado: las tres
 * escrituras escritas así —`{ chargeId }`, `{ qrData }`, `{ status, paidAt, ...campoMetodo }`—
 * salían «ilegibles» y caían en NO CLASIFICADO. Del lado malo, que es lo correcto, pero **una de
 * ellas era literalmente el control VERDE que el ticket exige**: `{ chargeId }`. El censo habría
 * publicado como «no sé leerla» justo el caso que tenía que saber leer.
 */
function camposDe(e) {
  const texto = String(e.data || '').trim();
  const del = [];
  if (texto.startsWith('{')) {
    const sf = ts.createSourceFile('d.ts', `const x = ${texto}`, ts.ScriptTarget.Latest, true);
    const ver = (n) => {
      if (ts.isPropertyAssignment(n) && n.name) del.push(n.name.getText(sf));
      // `{ chargeId }` — la forma que se escapó.
      else if (ts.isShorthandPropertyAssignment(n)) del.push(n.name.getText(sf));
      ts.forEachChild(n, ver);
    };
    ts.forEachChild(sf, ver);
  }
  const ind = String(e.indirecto || '').trim().split(/\s+/).filter(Boolean);
  return [...new Set([...del, ...ind])].filter((c) => c !== 'where' && c !== 'data' && c !== 'select');
}

/**
 * 🔴 UN SPREAD QUE NO SE PUEDE SEGUIR NO SE DA POR BUENO — y esto lo destapó revisar a mano.
 *
 * `invoiceAdmin.ts` escribe, al marcar pagada, `{ status, paidAt, ...campoMetodo }`. El censo sabe seguir un
 * spread cuando el objeto se rellena con asignaciones (`x.campo = …`), pero aquí `campoMetodo`
 * viene de una **llamada a función**, y eso no lo atraviesa. Resultado: el clasificador leía
 * `status, paidAt`, los dos de ficha, y dictaba FICHA **sin haber visto lo que el spread mete**.
 *
 * Información parcial haciéndose pasar por completa es peor que un «no lo sé»: el «no lo sé» va al
 * lado malo y alguien lo mira. Así que un spread sin resolver manda a NO CLASIFICADO, salvo que
 * esté DECLARADO aquí con lo que se midió de él.
 */
const SPREADS_DECLARADOS = new Map([
  ['campoMetodo', '`campoPaidViaAlMarcar`, en `metodoDeCobro.ts`, declara su retorno en el TIPO: '
    + '`{ paidVia?: string | null }`. Sólo puede meter `paidVia`, que es FICHA. Medido 17-sep-2026.'],
]);

/** Los `...ident` del `data:` que el censo NO ha conseguido resolver. */
function spreadsSinResolver(e) {
  const ids = [...String(e.data || '').matchAll(/\.\.\.(\w+)/g)].map((m) => m[1]);
  const resueltos = new Set(String(e.indirecto || '').trim().split(/\s+/).filter(Boolean));
  // Si el spread aportó campos, `indirecto` los trae. Si no aportó ninguno, o no se pudo seguir.
  return ids.filter((id) => resueltos.size === 0);
}

function clasifica(e) {
  const campos = camposDe(e);
  const abiertos = spreadsSinResolver(e).filter((id) => !SPREADS_DECLARADOS.has(id));
  if (abiertos.length) {
    return { clase: 'NO_CLASIFICADO', campos,
      motivo: 'spread(s) que el censo no sabe seguir: ...' + abiertos.join(', ...') };
  }
  // Una escritura sin campos legibles NO se da por buena: va a NO CLASIFICADO, del lado malo.
  if (campos.length === 0) return { clase: 'NO_CLASIFICADO', campos, motivo: 'el `data:` no deja leer ningún campo' };
  const fiscales = campos.filter((c) => FISCAL.has(c));
  if (fiscales.length) return { clase: 'FISCAL', campos, motivo: 'toca ' + fiscales.join(', ') };
  const desconocidos = campos.filter((c) => !SELLADO.has(c) && !FICHA.has(c));
  if (desconocidos.length) return { clase: 'NO_CLASIFICADO', campos, motivo: 'campo(s) sin clasificar: ' + desconocidos.join(', ') };
  if (campos.some((c) => SELLADO.has(c))) return { clase: 'SELLADO', campos, motivo: '' };
  return { clase: 'FICHA', campos, motivo: '' };
}

const CLASIFICADAS = CENSO.escrituras.map((e) => ({ ...e, ...clasifica(e) }));
/** Los ficheros de RUTAS que el guard de SCRUM-124 enumera. */
const esRutaDeFacturas = (f) => /invoicesAdmin\.routes\.ts$|invoice\.routes\.ts$/.test(f);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-878 · SUELO: si el censo ve 0 escrituras sobre Invoice, es CIEGO', () => {
  assert.ok(CENSO.escrituras.length >= 10,
    `🔴 CIEGO: el censo sólo ve ${CENSO.escrituras.length} escrituras sobre \`Invoice\` en `
    + `${CENSO.ficheros} ficheros. El producto cobra, sella y marca pagado: si de verdad hubiera `
    + 'menos de diez, el censo se ha roto. Un cero sin población es una frase, no una medición.');
  assert.ok(CENSO.ficheros >= 100,
    `🔴 CIEGO: sólo se han mirado ${CENSO.ficheros} ficheros .ts. El barrido no está llegando a src/.`);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA POBLACIÓN · las DOS cifras, siempre
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-878 · 🔴 LA POBLACIÓN: cuántas escrituras hay y cuántas puede ver el guard de la 29', (t) => {
  const total = CLASIFICADAS.length;
  const enRutas = CLASIFICADAS.filter((e) => esRutaDeFacturas(e.fichero));
  const enServicios = CLASIFICADAS.filter((e) => !esRutaDeFacturas(e.fichero));

  t.diagnostic(`escrituras sobre Invoice: ${total} · en ficheros de RUTA: ${enRutas.length} `
    + `· en SERVICIOS y lib: ${enServicios.length}`);
  for (const e of CLASIFICADAS) {
    t.diagnostic(`  [${e.clase}] ${e.fichero}:${e.linea} — ${e.campos.join(', ') || '(ilegible)'}`);
  }

  // 🔴 LA AFIRMACIÓN QUE ES EL TICKET: el guard de SCRUM-124 no mira NINGUNA de estas escrituras.
  // Su población son declaraciones de ruta (método + camino) contra una lista blanca; lo que la
  // ruta ESCRIBE no entra en su pregunta. Así que su cobertura sobre esta población es CERO —
  // incluidas las que viven dentro de las rutas que sí enumera.
  assert.ok(enServicios.length > 0,
    '🔴 si no hubiera ni una escritura fuera de las rutas, el ticket no tendría objeto. Que las '
    + 'haya es la mitad medible de lo que S6 dijo: el guard no las ve.');

  assert.ok(total >= enRutas.length + enServicios.length,
    '🔴 las partes no suman el total: el reparto no se puede leer.');
  assert.equal(enRutas.length + enServicios.length, total, '🔴 el reparto no cuadra');
});

test('SCRUM-878 · 🔴 CLASIFICADAS: contenido fiscal vs ficha, y lo dudoso del LADO MALO', (t) => {
  const por = (c) => CLASIFICADAS.filter((e) => e.clase === c);
  const fiscal = por('FISCAL'), sellado = por('SELLADO'), ficha = por('FICHA'), sinClasificar = por('NO_CLASIFICADO');

  t.diagnostic(`FISCAL=${fiscal.length} · SELLADO=${sellado.length} · FICHA=${ficha.length} `
    + `· NO_CLASIFICADO=${sinClasificar.length}`);
  for (const e of [...fiscal, ...sinClasificar]) {
    t.diagnostic(`  🔴 ${e.clase} ${e.fichero}:${e.linea} — ${e.motivo}`);
  }

  assert.equal(fiscal.length + sellado.length + ficha.length + sinClasificar.length, CLASIFICADAS.length,
    '🔴 las cuatro clases no suman el total: un reparto que no suma no es un reparto.');

  // Lo que NO se puede clasificar cuenta del lado malo, y se dice en voz alta en vez de esconderse
  // en un «0 problemas». Si esto sube, alguien ha escrito un `data:` que el censo no sabe leer.
  assert.ok(sinClasificar.length <= 0,
    `🔴 hay ${sinClasificar.length} escritura(s) que NO se pueden clasificar:\n`
    + sinClasificar.map((e) => `    · ${e.fichero}:${e.linea} — ${e.motivo}`).join('\n')
    + '\n\n  Van del LADO MALO a propósito. O se le enseña al censo a leer ese `data:`, o se '
    + 'declara aquí a sabiendas. Un «no lo sé» contado como «está bien» es por donde un censo '
    + 'deja de ver.');
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LOS DOS CONTROLES QUE EXIGE EL TICKET, sobre fuente SINTÉTICA
// ═══════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-878 · ✅ VERDE REAL: `invoice.update({ data: { chargeId } })` NO salta', () => {
  const real = CLASIFICADAS.find((e) => e.fichero.includes('invoiceWhatsApp.service.ts'));
  assert.ok(real, '🔴 CIEGO: no encuentro la escritura de `chargeId` que el ticket cita. Sin ella, '
    + 'este control no está midiendo el caso que dice.');
  assert.deepEqual(real.campos, ['chargeId'], `🔴 esa escritura toca ${real.campos.join(', ')}`);
  assert.equal(real.clase, 'FICHA',
    `🔴 se ha clasificado como ${real.clase}. Un PUNTERO AL COBRO no es contenido fiscal: si esto `
    + 'saltara, el guard ampliado nacería ruidoso, y un guard ruidoso se acaba desactivando.');
});

test('SCRUM-878 · 🔴 ROJO REAL: una escritura DE SERVICIO que toca contenido fiscal SÍ se caza', () => {
  // No se toca el árbol: se clasifica una escritura fabricada, con la misma función que clasifica
  // las reales. Es el mismo criterio, no uno paralelo.
  const fabricada = { fichero: 'src/modules/billing/domain/loQueSea.service.ts', linea: 1,
    data: "{ total: nuevoTotal, lines: nuevasLineas }", indirecto: '' };
  const r = clasifica(fabricada);
  assert.equal(r.clase, 'FISCAL',
    `🔴 una escritura de servicio que cambia \`total\` y \`lines\` se ha clasificado como ${r.clase}. `
    + 'Eso es exactamente lo que la regla 29 prohíbe y lo que el guard de rutas no puede ver.');

  // Y por la vía indirecta, que es la que se le escapó al censo del albarán en SCRUM-361:
  const porSpread = clasifica({ fichero: 'x.ts', linea: 1, data: '{ ...patch }', indirecto: ' number' });
  assert.equal(porSpread.clase, 'FISCAL',
    '🔴 una escritura que llega al número de factura por un `...spread` se ha colado. Es el defecto '
    + 'medido en SCRUM-361: mirando sólo el literal, la única escritura que toca contenido salía '
    + 'clasificada como metadatos.');
});

test('SCRUM-878 · 🔴 MUTACIÓN: la sustitución CUENTA 1, o no hubo mutación', () => {
  // La mutación se aplica sobre la ENTRADA del clasificador, no sobre el árbol: se cambia un campo
  // de ficha por uno fiscal y se comprueba que (a) el texto cambió de verdad y (b) el veredicto
  // cambia con él. Una mutación que no entra da «no cae nada» y se lee como cobertura.
  const antes = '{ chargeId }';
  const despues = antes.replace('chargeId', 'total');
  assert.notEqual(despues, antes, '🔴 la mutación NO ENTRÓ: el texto es idéntico');
  assert.equal((antes.match(/chargeId/g) || []).length, 1,
    '🔴 la sustitución no cuenta 1: o hay más de una ocurrencia o no hay ninguna, y en los dos '
    + 'casos la mutación no dice lo que cree decir.');

  assert.equal(clasifica({ data: antes, indirecto: '' }).clase, 'FICHA');
  assert.equal(clasifica({ data: despues, indirecto: '' }).clase, 'FISCAL',
    '🔴 cambiar `chargeId` por `total` no cambia el veredicto: el clasificador no distingue '
    + 'contenido fiscal de puntero, y entonces ninguna de las cifras de arriba significa nada.');
});

test('SCRUM-878 · 🔴 un spread que el censo NO sabe seguir manda a NO CLASIFICADO', () => {
  // El control que impide que el parrafo de arriba sea una promesa: una escritura con un spread
  // desconocido NO puede salir clasificada por los campos que si se leen.
  const r = clasifica({ data: '{ status, paidAt, ...loQueSea }', indirecto: '' });
  assert.equal(r.clase, 'NO_CLASIFICADO',
    `🔴 se ha clasificado como ${r.clase} leyendo solo \`status\` y \`paidAt\` — sin haber visto lo `
    + 'que mete `...loQueSea`. Informacion parcial haciendose pasar por completa es peor que un '
    + '«no lo se»: el «no lo se» va al lado malo y alguien lo mira.');

  // Y el declarado SI pasa, porque su contenido esta medido y escrito.
  const d = clasifica({ data: '{ status, paidAt, ...campoMetodo }', indirecto: '' });
  assert.equal(d.clase, 'FICHA',
    '🔴 el spread DECLARADO deberia pasar: su motivo esta escrito y su tipo de retorno medido. '
    + 'Si no pasa, la lista de declarados no esta sirviendo para nada.');
});

test('SCRUM-878 · 🔴 los spreads DECLARADOS son exactamente los medidos, y llevan su motivo', () => {
  assert.equal(SPREADS_DECLARADOS.size, 1,
    `🔴 hay ${SPREADS_DECLARADOS.size} spreads declarados y se midio 1. Esta lista no crece sin `
    + 'que alguien mida el retorno de la funcion que hay detras.');
  for (const [id, motivo] of SPREADS_DECLARADOS) {
    // 🔴 POR CONTENIDO, NO POR LINEA — y lo pidio un guard. La primera version exigia `fichero.ts:329`
    // y `scrum710b` («los anclajes por NUMERO DE LINEA no crecen») se puso rojo: un ancla atada a
    // la 329 cae el dia que alguien mueva la funcion a la 341, y entonces lo que se toca para
    // volver al verde es la declaracion. Se exige la FUNCION y el FICHERO, que no se mueven.
    assert.ok(motivo.length > 60 && /`[A-Za-z]\w*`/.test(motivo) && /`[\w./-]+\.ts`/.test(motivo),
      `🔴 «${id}» se declara sin decir QUE FUNCION y en QUE FICHERO se midio. Una declaracion sin `
      + 'su sitio es una promesa — y el sitio es un nombre, no un numero de linea.');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FASE b (SCRUM-878b) · EL CERROJO: «FISCAL NO PASA DE 0»
//
// La fase a midió y dejó escrito, en su propia entrada, lo que NO había hecho: *«convertir este
// censo en trinquete»*. Lo dejó como decisión de producto porque una R1 implementada EDITANDO
// daría rojo.
//
// 🔴 QUIÉN AUTORIZA ESTO, DICHO SIN ADORNOS — y se dice porque la primera versión de este bloque
// escribió aquí «el fundador decide que sí se pone». **Eso era falso.** SCRUM-878 tiene CERO
// comentarios en Jira (medido el 17-sep-2026, `comment.total = 0`) y el enunciado del ticket dice,
// literal, que *mide y propone*. Ninguna firma respalda este trinquete, y una autorización
// inventada en un comentario es peor que el trinquete que pretendía justificar.
//
// Lo que SÍ lo autoriza es otra cosa, y es comprobable:
//
//   · **Regla 38** — un guard que sólo LEE el camino de emisión se hace SIN pedir GO. Éste sólo
//     lee: no modifica ni una línea de `src/`. El STOP es MODIFICARLO, y no se modifica.
//   · **Regla 29**, firmada por el fundador en el máster (Parte I) — «una factura emitida JAMÁS se
//     edita ni borra». El cerrojo no inventa una regla nueva: le pone el MECANISMO a una que ya
//     estaba firmada. Una prohibición sin mecanismo es una frase.
//
// Y la reserva de la fase a queda contestada, no ignorada: una rectificativa se EMITE como
// documento nuevo, no editando la anterior. Si algún día una R1 necesita editar, ese rojo es la
// conversación que hay que tener — no un obstáculo que rodear ampliando la lista de campos.
//
// 🔒 Un trinquete en cero no prohíbe el futuro: obliga a que el futuro pase por una DECISIÓN en
// vez de por un descuido.
//
// Si el fundador no lo quiere, quitarlo es BORRAR UN TEST: el censo y su clasificación siguen
// midiendo igual, y la fase a no depende de este bloque.
//
// ⛔ Este bloque NO toca el camino de emisión (regla 38): clasifica lo que ya está escrito y no
// modifica ni una línea de `src/`. Y no toca `scrum124` ni su lista blanca.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * La acusación del cerrojo. Vive en UNA función a propósito: el control de aquí abajo comprueba
 * el texto que de verdad se emite, no una copia suya que podría decir otra cosa.
 */
function acusacion(escrituras) {
  return escrituras.map((e) => `    · ${e.fichero}:${e.linea} — ${e.motivo}`).join('\n');
}

test('SCRUM-878b · 🔒 EL CERROJO: ninguna escritura sobre Invoice toca contenido FISCAL', () => {
  const fiscales = CLASIFICADAS.filter((e) => e.clase === 'FISCAL');

  // 🔴 SUELO ANTES DEL VEREDICTO: un cerrojo sobre una población vacía siempre está en verde.
  assert.ok(CENSO.escrituras.length > 0,
    '🔴 CIEGO: el censo no ve NINGUNA escritura sobre Invoice en todo `src/`. «0 escrituras que '
    + 'tocan lo fiscal» y «no he sabido mirar» se leen igual, y una de las dos lecturas es falsa.');

  assert.deepEqual(fiscales.map((e) => `${e.fichero}:${e.linea}`), [],
    '🔴 HAY ESCRITURAS QUE EDITAN CONTENIDO FISCAL DE UNA FACTURA EMITIDA:\n'
    + acusacion(fiscales)
    + '\n\n  La regla 29 no lo permite: una factura emitida no se edita. Una rectificativa se\n'
    + '  EMITE como documento nuevo (R1) y una anulación deja su propio registro — ninguna de\n'
    + '  las dos reescribe la anterior.\n\n'
    + '  🔴 SI ESTO SALE ROJO PORQUE UNA R1 NECESITA EDITAR, ESA ES LA CONVERSACIÓN QUE HAY QUE\n'
    + '  TENER CON EL FUNDADOR — no algo que rodear ampliando la lista de campos permitidos.\n'
    + '  El trinquete está en 0 para que el futuro pase por una decisión y no por un descuido.');
});

test('SCRUM-878b · 🔴 CONTROL DEL CERROJO: acusa nombrando FICHERO y LÍNEA, y la mutación CUENTA 1', () => {
  // Se toma una escritura REAL de la población —no una inventada— y se le cambia UN campo de
  // ficha por uno fiscal. Así el control mide sobre la forma que el árbol tiene de verdad.
  const origen = CLASIFICADAS.find((e) => e.clase === 'FICHA' && /chargeId/.test(e.data));
  assert.ok(origen,
    '🔴 no hay ninguna escritura de FICHA con `chargeId` en la población: el control no puede '
    + 'montarse sobre un caso real y no se monta sobre uno inventado.');

  const veces = (origen.data.match(/chargeId/g) || []).length;
  assert.equal(veces, 1,
    `🔴 LA MUTACIÓN NO PUEDE ENTRAR: «chargeId» aparece ${veces} veces en \`${origen.data}\` y `
    + 'debe aparecer exactamente 1. Una mutación que no entra y un cerrojo que no detecta dan la '
    + 'misma salida.');

  const mutada = { ...origen, data: origen.data.replace('chargeId', 'total') };
  assert.notEqual(mutada.data, origen.data, '🔴 la sustitución no ha cambiado el texto: no mutó.');

  const r = clasifica(mutada);
  assert.equal(r.clase, 'FISCAL',
    `🔴 cambiar \`chargeId\` por \`total\` en una escritura REAL no la convierte en FISCAL `
    + `(sale ${r.clase}). El cerrojo no se dispararía ante el defecto que dice vigilar.`);

  // 🔴 Y LO QUE EL ENCARGO EXIGE: que la acusación diga DÓNDE. Un rojo que no da fichero y línea
  // manda a buscar por todo `src/`, y eso es lo que hace que un guard se apague.
  const texto = acusacion([{ ...mutada, ...r }]);
  assert.ok(texto.includes(origen.fichero),
    `🔴 la acusación no nombra el FICHERO (\`${origen.fichero}\`). Se comprueba por SUBCADENA y no
     con una expresión construida al vuelo: escapar una ruta a mano es justo donde se cuela el
     error, y aquí lo que se mide es el texto, no la habilidad para escaparlo.`);
  assert.ok(texto.includes(`:${origen.linea}`),
    `🔴 la acusación no nombra la LÍNEA (\`${origen.linea}\`).`);
});

test('SCRUM-878b · ✅ VERDE REAL DEL CERROJO: el puntero al cobro NO lo dispara', () => {
  // La otra mitad, sin la cual el cerrojo diría «toda escritura es sospechosa» y se desactivaría
  // en una semana. `chargeId` es un puntero al cobro: se sabe DESPUÉS de emitir y la 29 lo permite.
  const r = clasifica({ fichero: 'x.ts', linea: 1, data: '{ chargeId }', indirecto: '' });
  assert.equal(r.clase, 'FICHA',
    `🔴 \`invoice.update({ data: { chargeId } })\` sale como ${r.clase}. Un puntero al cobro no es `
    + 'contenido fiscal, y un cerrojo que lo acusa se apaga en una semana — con razón.');
  assert.deepEqual(acusacion([]), '',
    '🔴 la acusación no está vacía con cero acusados: el cerrojo imprimiría un rojo sin nadie dentro.');
});
