// tests/scrum601-copy-del-documento-vs-flag.test.mjs — SCRUM-601 (DOC-11)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL COPY DEL DOCUMENTO, ¿ES FUNCIÓN DEL FLAG O ESTÁ ESCRITO A PELO?
//
// LA VÍCTIMA, medida y reproducible sin BD (ver `tests/scrum601-*` y el parte del ticket):
// para un merchant ES real —`country: 'ES'`, sin override— con `INVOICING_ES_ENABLED` en su
// valor por defecto:
//
//     isFlagEnabled            → false
//     getEmissionMode          → 'receipt'
//     modoDocumentoSuelto      → 'justificante'
//
// El botón de la pantalla de Facturas SÍ lo sigue: dice «+ Nuevo justificante»
// (`invoicesView.js`, elegido por `window.appDocumentoSuelto`). El modal que ese botón ABRE, no:
// su título es «Nueva factura» y su botón primario «Emitir factura», los dos escritos a pelo.
//
// O sea que el profesional pulsa un botón que le promete un justificante y se le abre una
// ventana que le dice que va a emitir una factura. En la MISMA pantalla y en el MISMO gesto.
//
// ⚠️ ESTE TICKET MIDE, NO TOCA (regla 30: el microcopy lo firma el asesor). Aquí no se cambia ni
// un literal: se deja el defecto ATADO para que no pueda crecer en silencio, y el arreglo va en
// su propio ticket con el texto ya firmado.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portadoresDelFlag, censoCopy, NOMBRE_FLAG, SEMILLA_FLAG, SEMILLA_TIPO } from './_censo-copy-vs-flag.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Se calcula UNA vez: cada cierre recorre 355 ficheros y no cambia entre aserciones.
const cierre = portadoresDelFlag(RAIZ, SEMILLA_FLAG);
const cierreTipo = portadoresDelFlag(RAIZ, SEMILLA_TIPO);
const censo = censoCopy(RAIZ, cierre.portadores, cierreTipo.portadores);

/**
 * EL VEREDICTO, ANCLADO. Medido el 6-sep-2026 sobre `main` = 7f8c48d8.
 *
 *   ① FLAG — el texto lo elige, EN CÓDIGO, una condición que baja del flag.
 *   ② TIPO — lo elige el `type` del documento ya emitido. La dependencia es real pero pasa por
 *            una fila de `invoices`: ningún cierre estático puede encadenarla al flag.
 *   ③ A PELO — nada lo elige. Con el flag OFF dirá «factura» a quien emite justificantes.
 *
 * Se anclan los TRES y se exige que SUMEN. Un censo cuyas partes no suman no es un censo, y
 * anclar sólo el total dejaría pasar un trasvase silencioso entre categorías — que es
 * exactamente cómo este defecto se disolvería sin que nadie lo viera.
 */
const VEREDICTO_AL_MEDIR = { flag: 2, tipo: 7, aPelo: 153 };

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1 · EL INSTRUMENTO VE — controles de respuesta conocida, y también de la VÍA
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-601 · el cierre del flag recorre la cadena entera, y por la vía correcta', () => {
  assert.ok(cierre.ficheros > 300, `población: ${cierre.ficheros} ficheros → NO MEDIBLE`);
  assert.ok(cierre.definiciones > 1000, `población: ${cierre.definiciones} definiciones → NO MEDIBLE`);
  assert.equal(cierre.ficheroArranque, 'src/app.ts',
    'no se ha localizado el fichero que sirve `/admin/me`. Sin él no hay puente back→front y ' +
    'todo literal del front saldría «no depende» por ceguera, no por medida.');

  // 🔴 SE COMPRUEBA LA VÍA, NO SÓLO LA PERTENENCIA. La primera versión de este cierre usaba el
  // nombre pelado y daba 5261 portadores: `modoDocumentoSuelto` salía portador «vía merchant»,
  // o sea acertaba la respuesta conocida POR EL MOTIVO EQUIVOCADO. Un control positivo que puede
  // pasar por casualidad no es un control.
  const CADENA = [
    ['EXPORT::getEmissionMode', NOMBRE_FLAG],
    ['EXPORT::modoDocumentoSuelto', 'EXPORT::getEmissionMode'],
    ['WIRE::documentoSuelto', 'EXPORT::modoDocumentoSuelto'],
    ['WINDOW::appDocumentoSuelto', 'WIRE::documentoSuelto'],
  ];
  for (const [clave, viaEsperada] of CADENA) {
    const p = cierre.portadores.get(clave);
    assert.ok(p, `CIERRE CIEGO: no ve \`${clave}\`, que es un eslabón conocido de la cadena del flag.`);
    assert.equal(p.via, viaEsperada,
      `\`${clave}\` sale portador por «${p.via}» y la cadena real pasa por «${viaEsperada}». ` +
      'Acertar la pertenencia por otra vía es el falso positivo que ya se cazó una vez aquí.');
  }

  // Y el cable tiene que ser ESTRECHO: si vuelve a ensancharse, el censo se llena de portadores
  // falsos y todo saldría «depende del flag» — que es cómo este defecto se escondería solo.
  assert.ok(cierre.cables.length <= 20,
    `el puente back→front tiene ${cierre.cables.length} claves y eso es demasiado ancho: ` +
    `${JSON.stringify(cierre.cables.slice(0, 30))}`);
});

test('SCRUM-601 · el censo distingue DEPENDER DEL FLAG de estar en un ternario cualquiera', () => {
  assert.ok(censo.literales > 10000, `población: ${censo.literales} literales → NO MEDIBLE`);
  assert.ok(censo.visibles.length > 0, 'cero literales visibles con la diana: el censo no está mirando');

  const en = (f, l) => censo.visibles.filter((v) => v.fichero === f && v.linea === l);

  // POSITIVO, del árbol real: el rótulo del botón SÍ deriva del flag.
  const boton = en('public/dashboard/js/invoicesView.js', 221);
  assert.equal(boton.length, 1, 'no se encuentra el rótulo «+ Nuevo justificante» donde se midió');
  assert.equal(boton[0].texto, '+ Nuevo justificante');
  assert.equal(boton[0].dependeDelFlag, true,
    'el censo no ve que «+ Nuevo justificante» lo elige `window.appDocumentoSuelto`. Con el ' +
    'positivo caído, un «ninguno depende» significaría «no supe mirar».');
  assert.equal(boton[0].via, 'WINDOW::appDocumentoSuelto');

  // NEGATIVO, del árbol real: el título del modal NO deriva, y está en la misma pantalla.
  const modal = en('public/dashboard/js/nuevaFacturaModal.js', 52);
  assert.equal(modal.length, 1, 'no se encuentra el título del modal donde se midió');
  assert.equal(modal[0].texto, 'Nueva factura');
  assert.equal(modal[0].dependeDelFlag, false);
});

test('SCRUM-601 · EL VEREDICTO: las tres categorías, ancladas, y SUMAN', () => {
  const flag = censo.visibles.filter((v) => v.dependeDelFlag);
  const tipo = censo.visibles.filter((v) => v.derivaDelTipo);
  const aPelo = censo.visibles.filter((v) => !v.dependeDelFlag && !v.derivaDelTipo);

  assert.equal(flag.length + tipo.length + aPelo.length, censo.visibles.length,
    'las categorías no suman el total: un censo cuyas partes no suman no es un censo');

  assert.deepEqual(
    { flag: flag.length, tipo: tipo.length, aPelo: aPelo.length },
    VEREDICTO_AL_MEDIR,
    'El reparto de literales visibles ha cambiado. NO actualices el número sin mirar cuál se ' +
    'movió y por qué: si uno pasó de «a pelo» a «flag», es un arreglo y hay que celebrarlo ' +
    'borrándolo de PENDIENTES_DE_FIRMA; si pasó al revés, es una regresión de copy.\n' +
    `  ① flag=${flag.length}  ② tipo=${tipo.length}  ③ a pelo=${aPelo.length}`);

  // Y que el reparto NO sea trivial: si todo cayera en un solo cubo, el censo no discrimina.
  assert.ok(flag.length > 0 && tipo.length > 0 && aPelo.length > 0,
    'alguna categoría está vacía: el censo no está separando, está clasificando todo igual');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2 · LO QUE NO SABE LEER, LO DICE
// ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * Sumideros visibles cuyo valor mezcla literales con partes DINÁMICAS: el texto final no se
 * puede afirmar desde el fuente. NO son un fallo del árbol ni se aprueban — son el límite del
 * instrumento, y va escrito con su número para que crecer sea visible.
 *
 * Medido el 6-sep-2026 sobre `main` = 7f8c48d8.
 */
const NO_LEGIBLES_AL_MEDIR = 33;

test('SCRUM-601 · el censo DECLARA lo que no sabe leer, y esa lista no crece sola', () => {
  const n = censo.noLegibles.length;
  assert.ok(n > 0,
    'CERO construcciones no legibles sobre 19.968 literales es increíble: un censo que nunca ' +
    'tropieza no está leyendo. «No hay» y «no supe mirar» se escriben igual.');
  assert.ok(n <= NO_LEGIBLES_AL_MEDIR,
    `las construcciones que el censo NO sabe leer han pasado de ${NO_LEGIBLES_AL_MEDIR} a ${n}. ` +
    'Cada una es un literal visible cuyo texto final no se puede afirmar desde el fuente: ' +
    'míralas a mano y vuelve a anclar el número.\n  ' +
    censo.noLegibles.slice(0, 12).map((v) => `${v.fichero}:${v.linea} ${JSON.stringify(v.texto).slice(0, 50)}`).join('\n  '));
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3 · 🔴 EL ROJO QUE DECIDE — la contradicción DENTRO DE UN MISMO GESTO
// ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * EL FLUJO DE LA FACTURA SUELTA: el botón de la pantalla de Facturas y el modal que abre.
 * Un solo gesto del profesional, dos ficheros.
 *
 * 🔴 LOS TRES RÓTULOS INCUMPLIDORES, DECLARADOS UNO A UNO — no un número. Están escritos a pelo
 * y con el flag OFF le dicen «factura» a quien emite justificantes. NO SE ARREGLAN AQUÍ: el
 * microcopy lo firma el asesor (regla 30) y este ticket MIDE. Se atan para que no crezcan.
 *
 * El día que uno de ellos pase a derivar del flag, este test cae pidiendo que se borre de la
 * lista — así el arreglo no puede entrar sin dejar constancia. Y si aparece un CUARTO rótulo a
 * pelo en el flujo, también cae.
 */
const PENDIENTES_DE_FIRMA = [
  { fichero: 'public/dashboard/js/nuevaFacturaModal.js', linea: 29, texto: 'Emitir factura' },
  { fichero: 'public/dashboard/js/nuevaFacturaModal.js', linea: 43, texto: 'Crear una factura nueva' },
  { fichero: 'public/dashboard/js/nuevaFacturaModal.js', linea: 52, texto: 'Nueva factura' },
  { fichero: 'public/dashboard/js/nuevaFacturaModal.js', linea: 84, texto: 'Cliente al que facturas' },
  { fichero: 'public/dashboard/js/nuevaFacturaModal.js', linea: 215, texto: 'Factura emitida' },
  { fichero: 'public/dashboard/js/nuevaFacturaModal.js', linea: 220, texto: 'No hemos podido emitir la factura. Inténtalo otra vez.' },
];

test('SCRUM-601 · 🔴 el flujo de la factura suelta NO habla con una sola voz (defecto ATADO)', () => {
  const FLUJO = 'public/dashboard/js/nuevaFacturaModal.js';

  // Premisa: el botón que ABRE este modal sí deriva del flag. Si dejara de hacerlo, la
  // contradicción desaparecería por el lado malo y este test tiene que enterarse.
  const boton = censo.visibles.find((v) => v.fichero === 'public/dashboard/js/invoicesView.js' && v.linea === 221);
  assert.ok(boton && boton.dependeDelFlag,
    'el rótulo del botón ha dejado de derivar del flag: ya no hay «uno sí y otro no», hay «ninguno».');

  const aPelo = censo.visibles
    .filter((v) => v.fichero === FLUJO && !v.dependeDelFlag)
    .map((v) => ({ fichero: v.fichero, linea: v.linea, texto: v.texto }));

  const clave = (x) => `${x.fichero}:${x.linea}:${x.texto}`;
  const declarados = new Set(PENDIENTES_DE_FIRMA.map(clave));
  const nuevos = aPelo.filter((x) => !declarados.has(clave(x)));
  const arreglados = PENDIENTES_DE_FIRMA.filter((x) => !aPelo.some((y) => clave(y) === clave(x)));

  assert.deepEqual(nuevos, [],
    '🔴 RÓTULO NUEVO ESCRITO A PELO en el flujo de la factura suelta. Con `INVOICING_ES_ENABLED` ' +
    'en su valor por defecto, un merchant ES real emite JUSTIFICANTES y este texto le dirá ' +
    '«factura». No lo arregles por tu cuenta: el microcopy lo firma el asesor (regla 30).\n  ' +
    nuevos.map(clave).join('\n  '));

  assert.deepEqual(arreglados, [],
    '🟢 Uno de los rótulos declarados YA DERIVA DEL FLAG. Bórralo de `PENDIENTES_DE_FIRMA` en el ' +
    'mismo commit que lo arregla, para que la lista siga diciendo la verdad:\n  ' +
    arreglados.map(clave).join('\n  '));
});
