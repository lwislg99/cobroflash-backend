// tests/scrum291-series-huecos.test.mjs — SCRUM-291 (A4) · ④ la serie es inmutable · ① los huecos.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ EL DEFECTO VIVO
//
// El prefijo de serie es editable desde Configuración (`settingsView.js:490` → `PUT
// /admin/merchant`) y **nada comprobaba si ya había facturas emitidas**: `invalidPrefijoSerie`
// solo mira el charset que admite la AEAT (SCRUM-217) y `merchantAdmin.ts` no consultaba
// `Invoice` ni una vez. Un merchant con 40 facturas `2026-CF-001…040` cambiaba el prefijo a
// `FAC` y la siguiente salía `2026-FAC-041`: mismo año, misma serie, dos prefijos, y la
// correlatividad rota sin vuelta atrás (una factura emitida no se edita, regla 29).
//
// ① Y el detector de huecos dice QUÉ NÚMEROS FALTAN. El competidor pone dos avisos en gris; un
// aviso que no comprueba nada solo reparte la culpa.
//
// ⚠️ REGLA 38: nada de esto toca el camino de emisión. Un guard de abajo lo comprueba —
// `invoiceNumber.service.ts` tiene que seguir byte-idéntico a `main`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const { numerosDeLaSerie, bloqueoCambioDeSerie } = await import('../dist/core/validation/fiscalInput.js');
const { huecosDeLaSerie, MAX_SEQ_BARRIDO } = await import('../dist/modules/invoicing/domain/huecosSerie.js');
const { formatInvoiceNumber } = await import('../dist/modules/invoicing/domain/invoiceNumber.service.js');

const AÑO = 2026;
/** Números REALES, compuestos con la misma función que los compondría el emisor. */
const num = (seq, rect = false) => formatInvoiceNumber('CF', AÑO, seq, rect);

// ═════════════════════════════════════════════════════════════════════════════════════════
// ④ · LA SERIE NO SE TOCA UNA VEZ EMPEZADA
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-291 ④ · con facturas emitidas, cambiar el prefijo se BLOQUEA', () => {
  const emitidas = [num(1), num(2), num(3)];
  const r = bloqueoCambioDeSerie({
    prefijoActual: 'CF', prefijoNuevo: 'FAC', numerosDeLaSerie: emitidas,
  });

  assert.equal(r.bloqueado, true,
    '🔴 se deja cambiar el prefijo con facturas ya emitidas. La siguiente saldría con OTRO\n' +
    '  prefijo en el mismo año y la misma serie: la correlatividad que exige la AEAT se rompe,\n' +
    '  y no hay vuelta atrás porque una factura emitida no se edita (regla 29).');
  assert.equal(r.emitidas, 3, 'y se dice CUÁNTAS hay, no solo que las hay');
  assert.equal(r.ejemplo, num(3),
    '🔴 no se devuelve el último número emitido. Sin él, el profesional no puede ver el salto ' +
    'que se le está evitando.');
});

test('SCRUM-291 ④ · sin facturas emitidas, el cambio SÍ se permite', () => {
  // La otra cara. Sin esto, el arreglo puede haber bloqueado a todo el mundo —incluido quien
  // acaba de darse de alta y todavía no ha facturado— y nadie se entera hasta que lo intente.
  const r = bloqueoCambioDeSerie({ prefijoActual: 'CF', prefijoNuevo: 'FAC', numerosDeLaSerie: [] });
  assert.equal(r.bloqueado, false,
    '🔴 se bloquea el cambio a alguien que NO ha emitido nada. La serie no ha empezado: cambiarla ' +
    'no rompe ninguna correlatividad, y negárselo es impedirle configurar su propio negocio.');
});

test('SCRUM-291 ④ · reenviar el MISMO prefijo no es tocar la serie', () => {
  // El formulario de Configuración manda el prefijo en CADA guardado. Si el guard mirase solo
  // «hay facturas», un merchant con facturas no podría volver a guardar su dirección nunca más.
  const emitidas = [num(1), num(2)];
  assert.equal(
    bloqueoCambioDeSerie({ prefijoActual: 'CF', prefijoNuevo: 'CF', numerosDeLaSerie: emitidas }).bloqueado,
    false,
    '🔴 se bloquea un guardado que NO cambia el prefijo. Con eso, quien ya factura no puede tocar ' +
    'ningún otro campo de Configuración.');
  assert.equal(
    bloqueoCambioDeSerie({ prefijoActual: 'CF', prefijoNuevo: '  CF  ', numerosDeLaSerie: emitidas }).bloqueado,
    false, 'ni con espacios alrededor: es el mismo prefijo');
});

test('SCRUM-291 ④ · los JUSTIFICANTES no cuentan como serie empezada', () => {
  // Un `J-…` no va en la serie fiscal ni en VeriFactu. Contarlo bloquearía el cambio de prefijo
  // a quien todavía no ha emitido ni una factura — le negaríamos configurar la serie por culpa
  // de documentos que no están en ella.
  const soloJustificantes = ['J-20260105-abc', 'J-20260106-def'];
  const deLaSerie = numerosDeLaSerie(soloJustificantes, AÑO);
  assert.deepEqual(deLaSerie, [],
    '🔴 un justificante se está contando como parte de la serie fiscal.');
  assert.equal(
    bloqueoCambioDeSerie({ prefijoActual: 'CF', prefijoNuevo: 'FAC', numerosDeLaSerie: deLaSerie }).bloqueado,
    false);
});

test('SCRUM-291 ④ · una serie de OTRO año no bloquea la del año en curso', () => {
  // Una serie cerrada ya no admite números nuevos, así que cambiar el prefijo no la parte.
  const delAñoPasado = [formatInvoiceNumber('CF', AÑO - 1, 1), formatInvoiceNumber('CF', AÑO - 1, 2)];
  assert.deepEqual(numerosDeLaSerie(delAñoPasado, AÑO), [],
    '🔴 se están contando facturas de un año cerrado como si fueran de la serie en curso.');
});

test('SCRUM-291 ④ · el mensaje del bloqueo es el APROBADO, literal', () => {
  // Aprobado por el fundador el 5-ago-2026. Sustituye al assert de «va marcado como pendiente»,
  // retirado EN EL MISMO COMMIT que quita la marca — que es lo que convierte «aprobado» en un
  // hecho comprobable y no en el recuerdo de alguien.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/system/merchantAdmin.ts'), 'utf8');

  assert.match(src, /TIT_SERIE_YA_EMITIDA = 'Esta serie ya tiene facturas emitidas'/,
    '🔴 el título aprobado del bloqueo ha cambiado.');
  assert.match(src, /Su numeración tiene que seguir siendo correlativa, así que no se puede cambiar/,
    '🔴 el cuerpo aprobado del bloqueo ha cambiado.');
  assert.match(src, /Escríbenos por WhatsApp y lo vemos contigo/,
    '🔴 la salida que se le ofrece al usuario ha cambiado. Si es porque YA existe «crear una serie\n' +
    '  nueva», entonces toca la OTRA variante aprobada — y eso se MIDE, no se supone.');
  assert.doesNotMatch(src, /PENDIENTE microcopy/,
    '🔴 vuelve a haber una marca de pendiente sobre un texto que ya está aprobado.');
});

test('SCRUM-291 ④ · la variante aplicada sigue siendo la que corresponde', () => {
  // ⚠️ EL TEXTO ELEGIDO DEPENDE DE UN HECHO DEL PRODUCTO, no de un gusto. La microcopy aprobada
  // traía DOS variantes: una que remite a «crea una serie nueva» y otra a WhatsApp. Se midió que
  // esa acción NO EXISTE —sin modelo `Serie` en el esquema, sin ruta que la cree, sin nada en el
  // front— y por eso se aplicó la de WhatsApp.
  //
  // Mandar al usuario a un botón inexistente convierte un bloqueo explicado en un callejón sin
  // salida: exactamente el defecto de SCRUM-338. Si algún día las series existen, este test cae y
  // obliga a cambiar el copy, en vez de dejar al profesional con la peor de las dos salidas.
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  assert.doesNotMatch(schema, /^model Serie/m,
    '🔴 ya existe un modelo de series: «crea una serie nueva» puede ser ahora una acción real, y\n' +
    '  el mensaje del bloqueo tiene que pasar a la OTRA variante aprobada.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ① · LOS HUECOS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-291 ① · SUELO: sin facturas del merchant, el detector NO dice «todo bien»', () => {
  // «No hay huecos» y «no supe mirar» son el mismo número, y por eso quien llame a esto tiene
  // que poder distinguirlos. El detector devuelve `emitidos`, y con 0 su veredicto no vale.
  const r = huecosDeLaSerie([], 'CF', AÑO);
  assert.equal(r.emitidos, 0,
    '🔴 el detector inventa emitidos donde no los hay');
  assert.equal(r.ultimoSeq, 0);
  assert.deepEqual(r.huecos, [],
    '🔴 con cero facturas se reportan huecos: son números que la serie aún no ha alcanzado, no ' +
    'huecos. Sería una alarma inventada.');
  // El suelo real: quien consuma esto DEBE mirar `emitidos` antes de creerse `huecos: []`.
  assert.ok(Object.prototype.hasOwnProperty.call(r, 'emitidos'),
    '🔴 el resultado no dice cuántas miró. Sin ese número, «sin huecos» es indistinguible de ' +
    '«no encontré ninguna factura», y las dos cosas se leen como tranquilidad.');
});

test('SCRUM-291 ① · una serie correlativa no tiene huecos', () => {
  const r = huecosDeLaSerie([num(1), num(2), num(3), num(4)], 'CF', AÑO);
  assert.equal(r.emitidos, 4);
  assert.equal(r.ultimoSeq, 4);
  assert.deepEqual(r.huecos, [], '🔴 se inventan huecos en una serie perfectamente correlativa');
  assert.deepEqual(r.ajenos, []);
});

test('SCRUM-291 ① · dice QUÉ números faltan, con su nombre', () => {
  // El punto entero del ticket: no un aviso en gris, sino los números.
  const r = huecosDeLaSerie([num(1), num(2), num(5), num(6)], 'CF', AÑO);
  assert.equal(r.emitidos, 4);
  assert.equal(r.ultimoSeq, 6);
  assert.deepEqual(r.huecos, [num(3), num(4)],
    '🔴 no se nombran los números que faltan. Decir «hay huecos» sin decir cuáles es el aviso en ' +
    'gris del competidor: no ayuda a arreglarlo.');
});

test('SCRUM-291 ① · lo que la serie aún no ha alcanzado NO es un hueco', () => {
  const r = huecosDeLaSerie([num(1), num(2)], 'CF', AÑO);
  assert.deepEqual(r.huecos, [],
    '🔴 se reporta como hueco un número futuro. Eso es una alarma inventada, y la primera que ' +
    'hace que se dejen de leer las de verdad.');
});

test('SCRUM-291 ① · las rectificativas se miran APARTE', () => {
  // R1 lleva contador propio (`nextRectInvoiceNumber`). Mezclarlas con las ordinarias inventaría
  // huecos en las dos series a la vez.
  const mezcla = [num(1), num(2), num(1, true)];
  const ordinaria = huecosDeLaSerie(mezcla.filter((n) => !n.includes('-R-')), 'CF', AÑO, false);
  const rect = huecosDeLaSerie(mezcla.filter((n) => n.includes('-R-')), 'CF', AÑO, true);

  assert.deepEqual(ordinaria.huecos, [], '🔴 la R1 está inventando un hueco en la serie ordinaria');
  assert.equal(rect.emitidos, 1);
  assert.deepEqual(rect.huecos, []);
});

test('SCRUM-291 ① · un número de OTRO prefijo sale reportado como ajeno, no ignorado', () => {
  // Éste es el daño que ④ impide hacia adelante, visto hacia atrás: si alguien ya cambió el
  // prefijo con facturas emitidas, sus números viejos no casan con nada. No se tiran en
  // silencio — se dicen.
  const conPrefijoViejo = formatInvoiceNumber('OLD', AÑO, 1);
  const r = huecosDeLaSerie([conPrefijoViejo, num(1), num(2)], 'CF', AÑO);

  assert.deepEqual(r.ajenos, [conPrefijoViejo],
    '🔴 un número emitido con otro prefijo se está descartando en silencio. Es justo la señal de ' +
    'que la serie ya se partió alguna vez, y es lo que hay que ver.');
  assert.equal(r.emitidos, 3, 'y se sigue contando: no desaparece de la cuenta');
  assert.ok(r.truncado, 'el barrido llegó al tope buscando lo que no podía casar, y lo DECLARA');
  assert.deepEqual(r.huecos, [],
    '🔴 con el barrido truncado se están reportando miles de huecos falsos por encima del último ' +
    'emitido real.');
});

test('SCRUM-291 ① · los esperados se componen con la MISMA función, no con una copia del formato', () => {
  // La decisión que sostiene todo: si esto parseara el número con una expresión regular propia,
  // esa expresión sería una copia del formato y se quedaría vieja el día que el formato cambie
  // (el bloque de series que aún espera GO). Un censo viejo no avisa: tranquiliza.
  const src = fs.readFileSync(path.join(RAIZ, 'src/modules/invoicing/domain/huecosSerie.ts'), 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // SCRUM-306 (C7): el detector se generalizó con un parámetro `componer`, para que los ALBARANES
  // reutilicen este mismo barrido en vez de escribir un segundo. Con eso `formatInvoiceNumber` ya
  // no aparece LLAMADO dentro del bucle: aparece como valor POR DEFECTO del parámetro.
  //
  // El invariante que este test protege no ha cambiado —el detector compone, no parsea—, pero la
  // forma sí, y el assert miraba la forma. Se comprueba ahora lo que de verdad importa, y es más
  // fuerte que antes: que el defecto del compositor sea exactamente `formatInvoiceNumber`. Si
  // alguien lo cambiara por otra función, las llamadas de factura empezarían a componer con otra
  // cosa **sin tocar ni una de sus líneas**.
  assert.match(codigo, /=\s*formatInvoiceNumber\s*,/,
    '🔴 el detector ya no compone con `formatInvoiceNumber` por defecto: las llamadas de factura ' +
    'compondrían con otra función sin cambiar ni una de sus líneas.');
  assert.match(codigo, /const esperado = componer\(/,
    '🔴 el bucle ya no usa el compositor recibido: o volvió a fijar una función, o compone por su cuenta.');
  assert.doesNotMatch(codigo, /padStart|\\d\{3\}|match\(|\.split\('-'\)/,
    '🔴 el detector ha empezado a PARSEAR o a componer el formato por su cuenta. Eso es una copia ' +
    'del formato, y una copia se queda vieja sin avisar.');
  assert.ok(MAX_SEQ_BARRIDO >= 1000,
    '🔴 el tope del barrido se ha quedado por debajo de lo razonable para un año de facturación.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// REGLA 38 · el camino de emisión no se ha tocado
// ═════════════════════════════════════════════════════════════════════════════════════════

// La referencia de este guard es un HASH CONGELADO EN EL REPO, no `origin/main`.
//
// La primera versión comparaba con `git diff --stat origin/main`. Falla en CI, y por una razón que
// no es un detalle: **CI no tiene `origin/main` fetcheado**, así que el guard no podía obtener su
// referencia. Como falla al no poder mirar, dejaba el PR en rojo — comportamiento correcto, pero
// inservible.
//
// ⚠️ LO QUE NO SE HIZO, Y ERA LA TENTACIÓN: que el guard se salte la comprobación cuando no
// encuentra la referencia. Ése es el verde hueco exacto — «no pude comparar» se leería igual que
// «comparé y estaba intacto», justo en el guard que protege el camino de emisión.
//
// La referencia pasa a vivir DENTRO del repo: el sha256 del contenido. Sin red, sin git, sin
// remoto; igual en un portátil que en CI. Y si el fichero no se puede leer, FALLA diciendo qué no
// pudo obtener. Nunca pasa por no poder mirar.
//
// NORMALIZANDO LOS FINALES DE LÍNEA, y no es cosmético: este repo escribe CRLF en Windows y CI
// hace checkout con LF. Hashear los bytes crudos daría un rojo por el sistema operativo, y un
// guard que grita sin motivo se acaba desactivando — que es como se pierde el que sí importaba.
const EMISOR = 'src/modules/invoicing/domain/invoiceNumber.service.ts';
const EMISOR_SHA256 = 'fb0d6216f96bb1e3a8cae6989be06baaab8190c598a647938dd106be06d696bd';

test('SCRUM-291 · el camino de emisión sigue INTACTO (regla 38)', () => {
  // El fundador puso el límite y esto lo COMPRUEBA en vez de prometerlo. Si algún día hace falta
  // tocar ese fichero, se pide GO con el diff delante — y este rojo es el recordatorio.
  let contenido;
  try {
    contenido = fs.readFileSync(path.join(RAIZ, EMISOR), 'utf8');
  } catch (e) {
    // No poder leer NO es «está bien». Se dice qué falló y se cae.
    assert.fail(
      `🔴 no se pudo leer ${EMISOR} (${e && e.code ? e.code : e}).\n\n`
      + '  Este guard no puede confirmar nada sin su referencia, y un guard que no puede mirar no\n'
      + '  sale verde: «no pude comprobarlo» y «lo comprobé y está bien» no pueden dar el mismo\n'
      + '  resultado, y menos en el fichero que sostiene la numeración fiscal.');
  }

  const sha = createHash('sha256').update(contenido.replace(/\r\n/g, '\n')).digest('hex');
  assert.equal(sha, EMISOR_SHA256,
    `🔴 ${EMISOR} ha cambiado.\n\n`
    + `  esperado: ${EMISOR_SHA256}\n`
    + `  leído:    ${sha}\n\n`
    + '  Ahí viven `allocateInvoiceNumber` y su `pg_advisory_xact_lock`, que son lo ÚNICO que hoy\n'
    + '  impide un hueco REAL en la numeración: reserva y creación en la MISMA transacción\n'
    + '  (SCRUM-219/234). Tocarlo exige GO del fundador con el diff delante (regla 38).\n\n'
    + '  Si el GO existe y el cambio es deliberado, actualiza el hash EN EL MISMO COMMIT que lo\n'
    + '  cambia: es lo que deja el permiso escrito en el diff en vez de en la memoria de alguien.');
});
