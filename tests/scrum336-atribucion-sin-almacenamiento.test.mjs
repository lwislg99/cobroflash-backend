// SCRUM-336 · LA ATRIBUCIÓN VIAJA EN LA URL, Y NADIE VUELVE A ESCRIBIR EN EL NAVEGADOR DEL
// VISITANTE SIN QUE ESTO SE PONGA ROJO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO QUE CIERRA
//
// La landing y la página de precios escribían `localStorage` (`yaqu_ref`, `yaqu_src`) al aterrizar,
// **incondicionalmente**, sin banner y sin forma de rechazarlo (ePrivacy art. 5.3). Se retiró la
// escritura y la atribución pasa a viajar en la URL hasta el registro.
//
// ⚠️ LO QUE NO SE PODÍA HACER, Y ESTUVO A PUNTO DE HACERSE: borrar los datos sin más. La medición
// previa encontró que **los dos tenían dueño**: `yaqu_ref` paga un mes gratis al referidor
// (`referral.service.ts`) y `yaqu_src` es lo que agrupa el embudo por canal
// (`metrics.service.ts::getPlatformFunnel`). Borrarlos habría cambiado un problema legal por uno
// económico. Por eso esto no es una eliminación: es un CAMBIO DE MECANISMO.
//
// LO QUE SE PIERDE Y SE DECLARA, no se disimula: el **first-touch multi-visita**. Quien aterriza
// hoy y vuelve en tres días sin parámetros queda sin atribuir. La atribución pasa de «sobrevive
// días» a «sobrevive la navegación en curso». Recuperarlo es del banner (SCRUM-329).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS LADOS QUE VIGILA
//
//   ① QUE NO VUELVA A ESCRIBIRSE. Censo derivado de TODA la superficie pública. No es «que no
//      vuelva `yaqu_src`»: es que no vuelva NINGÚN almacenamiento persistente no imprescindible,
//      con otra clave o con otra tecnología (`cookie` incluida).
//   ② QUE LA ATRIBUCIÓN SIGA LLEGANDO. Si ① fuera lo único, la forma más fácil de tenerlo verde
//      sería romper la atribución del todo — y nadie se enteraría hasta que un referidor reclamara
//      su mes gratis.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  censarAlmacenamiento, censarEnlacesAlRegistro, PANEL,
} from './_censo-almacenamiento-publico.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLICO = path.join(RAIZ, 'public');
const SCRIPT_ATRIBUCION = 'public/js/atribucion.js';

const accesos = censarAlmacenamiento(PUBLICO, RAIZ);
const enlaces = censarEnlacesAlRegistro(PUBLICO, RAIZ);

const enElPanel = accesos.filter((a) => a.enElPanel);
const enLaSuperficiePublica = accesos.filter((a) => !a.enElPanel);

/**
 * Almacenamiento DECLARADO como imprescindible en la superficie pública. Vacío hoy, y esa es la
 * respuesta correcta: nada de lo que había lo era.
 *
 * Existe la puerta —con motivo obligatorio— porque el día que llegue el banner (SCRUM-329) habrá
 * que guardar **la propia decisión del visitante**, y eso sí es imprescindible: sin ella habría que
 * volver a preguntar en cada página. Que entre por aquí y se vea en el diff.
 */
const IMPRESCINDIBLE_DECLARADO = {};

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-336 · SUELO: el detector VE almacenamiento donde lo hay (control positivo)', () => {
  // Sin esto, el guard de abajo pasaría en verde con el detector roto: «cero escrituras en la
  // superficie pública» y «no supe mirar» dan el mismo verde y significan lo contrario. El control
  // positivo es el PANEL, que sí usa almacenamiento legítimamente y no es de este ticket.
  assert.ok(enElPanel.length > 0,
    `🔴 el censo no ve NI UN acceso a almacenamiento en ${PANEL}, donde con toda seguridad los hay. ` +
    'El detector está ciego (¿cambió la extensión de los ficheros? ¿el AST ya no reconoce la ' +
    'llamada?), así que el verde de la superficie pública no significaría nada.');

  assert.ok(enlaces.length > 0,
    '🔴 el censo no encuentra NINGÚN enlace a /register.html en la superficie pública. O la página ' +
    'de registro se llama de otra forma, o el censo mira donde no es: sin enlaces, la comprobación ' +
    'de que la atribución viaja por la URL no comprueba nada.');
});

// ── ① QUE NO VUELVA A ESCRIBIRSE ─────────────────────────────────────────────────────────

test('SCRUM-336 · la superficie pública no guarda NADA en el navegador del visitante', () => {
  const sinDeclarar = enLaSuperficiePublica
    .filter((a) => !(a.id in IMPRESCINDIBLE_DECLARADO))
    .map((a) => `${a.fichero}:${a.linea}  ${a.almacen}.${a.op}('${a.clave}')`);

  assert.deepEqual(sinDeclarar, [],
    '🔴 HAY ALMACENAMIENTO EN EL NAVEGADOR EN LA SUPERFICIE PÚBLICA:\n    ' + sinDeclarar.join('\n    ') +
    '\n\n  El art. 5.3 de ePrivacy exige consentimiento PREVIO para almacenar —o leer— información\n' +
    '  en el equipo del visitante cuando no es imprescindible para el servicio que ha pedido. Hoy\n' +
    '  no hay banner (eso es SCRUM-329), así que aquí no puede haber nada.\n\n' +
    '  · Si lo que necesitas es atribución: NO la guardes. Viaja en la URL — `js/atribucion.js`\n' +
    '    propaga los parámetros a los enlaces del registro, y el registro los lee de la URL.\n' +
    '  · Si de verdad es imprescindible para el servicio pedido, decláralo en\n' +
    '    IMPRESCINDIBLE_DECLARADO con su motivo, para que la excepción se vea en el diff.\n\n' +
    '  Ojo: LEER también cuenta. El artículo habla de almacenar «o acceder a» información ya\n' +
    '  almacenada, así que un `getItem` de cortesía no es más inocente que un `setItem`.');
});

test('SCRUM-336 · el panel NO entra en el censo (trampa de la casa)', () => {
  // El panel es la app después de identificarse: su almacenamiento es otra conversación. Si esta
  // separación se rompiera, el guard empezaría a gritar por preferencias de vista y acabaría
  // puenteado — que es como mueren los guards que gritan sin motivo.
  const colados = enLaSuperficiePublica.filter((a) => a.fichero.startsWith(PANEL));
  assert.deepEqual(colados, [], '🔴 el filtro del panel no está separando lo que debe');
  assert.ok(enElPanel.every((a) => a.fichero.startsWith(PANEL)),
    '🔴 hay accesos marcados como del panel que no están en el panel');
});

// ── ② QUE LA ATRIBUCIÓN SIGA LLEGANDO ────────────────────────────────────────────────────

/**
 * Carga el script REAL con un DOM de mentira y le da los enlaces REALES de una página del repo.
 * No es una maqueta del comportamiento: es el fichero que se sirve, ejecutándose.
 */
function enlaceFalso(href) {
  let valor = href;
  const el = {
    getAttribute: () => valor,
    setAttribute: (_, v) => { valor = v; },
    get href() { return valor; },
    // El manejador de respaldo filtra con `closest`: un enlace se devuelve a sí mismo si encaja.
    closest: (sel) => {
      const m = /^a\[href\^="(.+)"\]$/.exec(sel);
      return m && valor.indexOf(m[1]) === 0 ? el : null;
    },
  };
  return el;
}

function ejecutarAtribucion({ search = '', referrer = '', hostname = 'yaqu.app', hrefs }) {
  const codigo = fs.readFileSync(path.join(RAIZ, SCRIPT_ATRIBUCION), 'utf8');

  const enlacesFalsos = hrefs.map(enlaceFalso);
  const oyentes = [];

  const documento = {
    readyState: 'complete',
    referrer,
    querySelectorAll: (sel) => (sel.includes('/register.html') ? enlacesFalsos : []),
    addEventListener: (tipo, fn, captura) => oyentes.push({ tipo, fn, captura }),
  };
  const ventana = { location: { search, hostname }, document: documento, addEventListener: () => {} };

  new Function('window', 'document', codigo)(ventana, documento);

  /**
   * Dispara el manejador de respaldo sobre un elemento, como haría el navegador al pulsar.
   * ⚠️ Lo que se ejercita es el MANEJADOR REAL con su filtro `closest`; lo que NO se reproduce es
   * la propagación del navegador (el recorrido de captura). Declarado en el informe.
   */
  const pulsar = (tipo, elemento) => {
    const encontrados = oyentes.filter((o) => o.tipo === tipo && o.captura === true);
    for (const o of encontrados) o.fn({ target: elemento });
    return encontrados.length;
  };

  return { api: ventana.yaquAtribucion, resultado: enlacesFalsos.map((e) => e.href), pulsar, oyentes };
}

/** Los enlaces al registro que tiene DE VERDAD una página del repo. */
function hrefsRealesDe(fichero) {
  return censarEnlacesAlRegistro(PUBLICO, RAIZ)
    .filter((e) => e.fichero === fichero)
    .map((e) => e.destino);
}

test('SCRUM-336 · LA CARA QUE PAGA: un ?ref= en la landing llega al registro por la URL', () => {
  const hrefs = hrefsRealesDe('public/index.html');
  assert.ok(hrefs.length > 0, '🔴 la landing no tiene enlaces al registro: el caso no se está probando');

  const { resultado } = ejecutarAtribucion({ search: '?ref=JAVI123', hrefs });

  const sinRef = resultado.filter((h) => !h.includes('ref=JAVI123'));
  assert.deepEqual(sinRef, [],
    '🔴 HAY CTA DE LA LANDING QUE PIERDEN EL CÓDIGO DE REFERIDO:\n    ' + sinRef.join('\n    ') +
    '\n\n  Esto no es un dato de marketing: `Merchant.referredBy` paga UN MES GRATIS al referidor\n' +
    '  cuando el referido paga (`referral.service.ts`). Si el código no llega al registro, dejamos\n' +
    '  de pagar recompensas ganadas y no lo detecta nadie hasta que alguien reclame.');
});

test('SCRUM-336 · LA CARA DEL EMBUDO: las UTM llegan al registro por la URL', () => {
  const hrefs = hrefsRealesDe('public/index.html');
  const { resultado } = ejecutarAtribucion({
    search: '?utm_source=google&utm_medium=cpc&utm_campaign=verano',
    hrefs,
  });

  const incompletos = resultado.filter(
    (h) => !(h.includes('utm_source=google') && h.includes('utm_medium=cpc') && h.includes('utm_campaign=verano')),
  );
  assert.deepEqual(incompletos, [],
    '🔴 HAY CTA QUE PIERDEN LAS UTM:\n    ' + incompletos.join('\n    ') +
    '\n\n  `Merchant.acquisitionSource` es lo que agrupa el embudo por canal en `getPlatformFunnel`\n' +
    '  («¿qué canal trae altas que ACABAN cobrando?»). Sin esto, todas las altas futuras caen en\n' +
    '  «directo/sin dato» y el único embudo de negocio que hay deja de responder su pregunta.');
});

test('SCRUM-336 · el canal orgánico no se pierde: el referrer viaja como utm_source', () => {
  // Antes, llegar desde Google SIN UTM se guardaba como `referrer:google.com`. Ese valor se
  // conserva, pero ahora viaja en la URL con el nombre que el registro YA sabe leer, así que el
  // dato que acaba en la base es EL MISMO y `register.html` no ha tenido que cambiar.
  const { api } = ejecutarAtribucion({ hrefs: [] });
  assert.equal(api.utmDesdeReferrer('', 'https://www.google.com/search?q=yaqu', 'yaqu.app'),
    'referrer:google.com', '🔴 el canal orgánico ya no se deriva del referrer');

  // Y no se pisa una UTM real, ni se atribuye la navegación interna del propio sitio.
  assert.equal(api.utmDesdeReferrer('?utm_source=google', 'https://otra.com', 'yaqu.app'), null,
    '🔴 el referrer estaría pisando una UTM real');
  assert.equal(api.utmDesdeReferrer('', 'https://yaqu.app/precios', 'yaqu.app'), null,
    '🔴 se estaría atribuyendo a sí mismo el tráfico interno');
});

test('SCRUM-336 · el registro lee la URL y NO tiene ya ningún respaldo de almacenamiento', () => {
  const registro = fs.readFileSync(path.join(RAIZ, 'public/register.html'), 'utf8');

  // Derivado del censo, no de leer el fichero a ojo.
  const enRegistro = accesos.filter((a) => a.fichero === 'public/register.html');
  assert.deepEqual(enRegistro, [],
    '🔴 el registro vuelve a leer almacenamiento del navegador:\n    ' +
    enRegistro.map((a) => `${a.linea}: ${a.almacen}.${a.op}('${a.clave}')`).join('\n    ') +
    '\n\n  La URL es la única fuente desde SCRUM-336.');

  // Y sigue mandando lo que el backend espera: `ref` (referidos) y `source` (embudo).
  assert.match(registro, /ref:\s*refCode/,
    '🔴 el registro ya no manda `ref`: `resolveReferrer` no recibiría el código y no habría referidor');
  assert.match(registro, /source:\s*acquisitionSource/,
    '🔴 el registro ya no manda `source`: `Merchant.acquisitionSource` quedaría vacío y el embudo ciego');
});

// ── EL CTA QUE LA DEMO INYECTA DESPUÉS DE CARGAR ─────────────────────────────────────────
//
// Es el camino del visitante que juega con «Pruébalo tú» y luego se registra: el embudo que la
// propia landing empuja. Ese CTA no existe cuando el script hace su pasada
// (`js/landing-demo.js` lo añade después), así que lo único que lo protege es el manejador de
// respaldo. Y si falla, falla MUDO: los otros ocho enlaces sí llevan la atribución, el guard
// seguiría verde, y la factura la paga un referidor que no cobra su mes.

test('SCRUM-336 · un CTA inyectado DESPUÉS recibe la atribución al pulsarlo', () => {
  // Ni un solo enlace al cargar: se inyecta luego, como hace la demo.
  const { pulsar } = ejecutarAtribucion({ search: '?ref=JAVI123&utm_source=google', hrefs: [] });

  const inyectado = enlaceFalso('/register.html');
  const manejadores = pulsar('click', inyectado);

  assert.ok(manejadores > 0,
    '🔴 el script no registró NINGÚN manejador de respaldo en fase de captura. Sin él, el CTA que ' +
    'la demo inyecta después de cargar navega sin atribución y nadie se entera.');

  assert.match(inyectado.href, /ref=JAVI123/,
    '🔴 EL CTA INYECTADO POR LA DEMO PIERDE EL CÓDIGO DE REFERIDO.\n\n' +
    '  Es el fallo mudo con factura: los ocho enlaces del DOM inicial sí propagan, así que todo\n' +
    '  parece bien, y el referidor que trajo a ese usuario no cobra su mes gratis.');
  assert.match(inyectado.href, /utm_source=google/,
    '🔴 el CTA inyectado pierde la UTM: esa alta cae en «directo/sin dato» en el embudo');
});

test('SCRUM-336 · y el clic con la rueda (auxclick) tampoco lo pierde', () => {
  // Abrir en otra pestaña con la rueda NO dispara `click`. Sin `auxclick`, esa navegación
  // perdería la atribución en silencio — y es una forma normal de abrir un CTA.
  const { pulsar } = ejecutarAtribucion({ search: '?ref=JAVI123', hrefs: [] });
  const inyectado = enlaceFalso('/register.html');

  assert.ok(pulsar('auxclick', inyectado) > 0,
    '🔴 no hay manejador para `auxclick`: el clic con la rueda perdería la atribución');
  assert.match(inyectado.href, /ref=JAVI123/,
    '🔴 abrir el CTA con la rueda pierde el código de referido');
});

test('SCRUM-336 · CONTROL NEGATIVO del respaldo: un enlace EXTERNO inyectado no recibe nada', () => {
  const { pulsar } = ejecutarAtribucion({ search: '?ref=JAVI123', hrefs: [] });

  const externo = enlaceFalso('https://otra.com/register.html');
  pulsar('click', externo);
  assert.equal(externo.href, 'https://otra.com/register.html',
    '🔴 el respaldo está reescribiendo un enlace EXTERNO: la atribución se filtraría a terceros');

  const interno = enlaceFalso('/precios.html');
  pulsar('click', interno);
  assert.equal(interno.href, '/precios.html',
    '🔴 el respaldo está tocando enlaces que no van al registro');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────

test('SCRUM-336 · CONTROL NEGATIVO: no toca lo que no es suyo ni pisa lo que ya venía', () => {
  const { api } = ejecutarAtribucion({ hrefs: [] });
  const d = api.destinoConAtribucion;

  assert.equal(d('/precios.html', '?ref=X'), '/precios.html',
    '🔴 está reescribiendo enlaces que no van al registro');
  assert.equal(d('https://otra.com/register.html', '?ref=X'), 'https://otra.com/register.html',
    '🔴 está reescribiendo un enlace EXTERNO: la atribución se estaría filtrando a terceros');
  assert.equal(d('/register.html?ref=YA_VENIA', '?ref=OTRO'), '/register.html?ref=YA_VENIA',
    '🔴 está pisando un `ref` que el enlace ya traía escrito');
  assert.equal(d('/register.html', ''), '/register.html',
    '🔴 está inventando parámetros cuando la página no trae ninguno');
  assert.equal(d('/register.html#form', '?ref=X'), '/register.html?ref=X#form',
    '🔴 el hash tiene que quedar DESPUÉS de la query, o el enlace deja de anclar');
});
