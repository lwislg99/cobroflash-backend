// tests/scrum586-forma-de-pago-por-cliente.test.mjs — SCRUM-586 (CONT-13)
//
// Sin gate: piezas puras y banco de vistas. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS FORMAS DE PAGO PACTADAS CON EL CLIENTE, PROPUESTAS — NUNCA APLICADAS SOLAS
//
// LA VÍCTIMA: el administrador de fincas que no paga con tarjeta jamás, y el profesional que
// tiene que ACORDARSE de desmarcarla en cada documento. El día que se le olvida, el cliente ve un
// botón que su gestoría no va a pulsar y el cobro se queda esperando.
//
// ── 🔴 LOS TRES CONTROLES QUE DECIDEN ESTÁN LOS PRIMEROS ────────────────────────────────────
// ① Un cliente SIN nada pactado tiene que dejar el documento EXACTAMENTE como está hoy: las tres
//    casillas marcadas y ninguna tira.
// ② Un cliente CON formas pactadas trae el documento con ellas PROPUESTAS — y el profesional las
//    cambia sin que el cliente se altere.
// ③ Y el que cierra la decisión del fundador: **si alguien convierte la propuesta en aplicación
//    silenciosa, esto CAE**. No por el texto: por ALCANZABILIDAD sobre el AST. Es la frontera que
//    un futuro «pulido» tiraría sin enterarse, porque en el diff no parece nada.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ejecutableDe } from './_guard-texto.mjs';
import { cargarDashboard, pintarVista, todos, datosDeMuestra } from './_banco-vistas.mjs';
import { scriptsDeLaPagina, rutaDelDashboard, cegueraDelExtractor } from './_scripts-de-la-pagina.mjs';
// 🔴 EL LECTOR OFICIAL DE MUTACIONES, importado y no reescrito. Ver el bloque ⑨: el meta-guard
// tiene cuatro defectos conocidos, y la respuesta a eso NO es escribir aquí un segundo lector.
import { mutacionesDeclaradas } from '../scripts/meta-guard-mutaciones.mjs';
import { ocurrenciasEnElRepositorio } from './_ancla-en-el-repositorio.mjs'; // SCRUM-796

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(import.meta.url);
const P = require_(path.join(RAIZ, 'public/dashboard/js/formaDePagoPorDefecto.js'));

const QUOTES_VIEW = path.join(RAIZ, 'public/dashboard/js/quotesView.js');
const ESTE_FICHERO = path.join(RAIZ, 'tests/scrum586-forma-de-pago-por-cliente.test.mjs');

/** Un cliente con lo pactado puesto. El resto de campos son los que trae la lista de verdad. */
const cliente = (metodos) => ({
  id: 7, name: 'Administración Fincas Soler', phone: '34000000586',
  payMethodsPorDefecto: metodos,
});
/** Las clases de un nodo como LISTA. Un `includes` sobre la cadena confunde padre e hijo. */
const clases = (n) => String((n && n.className) || '').split(/\s+/).filter(Boolean);
/** El documento de hoy nace con LAS TRES marcadas: es el estado del que se parte siempre. */
const LAS_TRES = ['card', 'bizum', 'transfer'];

// ═══ ① EL CLIENTE SIN NADA PACTADO: NADA CAMBIA ══════════════════════════════════════════

test('SCRUM-586 · 🔴 un cliente SIN formas pactadas deja el documento COMO ESTÁ HOY', () => {
  for (const sin of [null, undefined, '']) {
    assert.equal(P.propuestaPara(cliente(sin)), null,
      `🔴 con \`payMethodsPorDefecto = ${JSON.stringify(sin)}\` se está proponiendo algo. «No se `
      + 'pactó nada» se acaba de convertir en un acuerdo que nadie hizo.');
    assert.equal(P.hayPropuesta(cliente(sin)), false);
    assert.deepEqual(P.aplicarA(LAS_TRES, P.propuestaPara(cliente(sin))), LAS_TRES,
      '🔴 la selección ha cambiado para un cliente sin acuerdo: el documento acaba de perder '
      + 'formas de cobro que el profesional no quitó.');
    assert.equal(P.alcanceDe(LAS_TRES, P.propuestaPara(cliente(sin))), 0);
  }
  // Y el selector vacío —ningún cliente elegido— tampoco propone.
  assert.equal(P.propuestaPara(null), null);
  assert.equal(P.propuestaPara(undefined), null);
});

test('SCRUM-586 · 🔴 la lista VACÍA no es un acuerdo: es un dato roto', () => {
  // Aquí está la diferencia con el `0 %` del 587, y merece quedar escrita. Allí «se pactó un 0 %»
  // era legítimo y no movía dinero. Aquí «se pactó que NO HAY ninguna forma de pago» sería un
  // documento que el cliente no puede pagar — el servidor ya lo dice con su `.min(1)` y el editor
  // ya trata `sel.length === 0` como «todas». Así que `[]` se lee como «no consta».
  assert.equal(P.propuestaPara(cliente([])), null,
    '🔴 una lista vacía se está proponiendo. Aceptarla dejaría el documento sin NINGUNA forma de '
    + 'pago, que es la única selección que el producto no permite en ningún otro sitio.');
  assert.deepEqual(P.aplicarA(LAS_TRES, P.propuestaPara(cliente([]))), LAS_TRES);
});

test('SCRUM-586 · 🔴 un valor ILEGIBLE no es una propuesta más pequeña: no hay propuesta', () => {
  // 🔴 ÉSTA ES LA REGLA QUE PROTEGE EL COBRO. Un cliente con `['bizum','paypal']` NO se convierte
  // en «sólo bizum»: eso sería RESTAR una opción de cobro por un valor que no entendemos, y restar
  // es exactamente el daño que el fundador nombró al decidir que esto se propone y no se aplica.
  // Mismo criterio que el 587 con un porcentaje ilegible.
  for (const roto of [['bizum', 'paypal'], ['paypal'], ['card', 42], [{ card: true }], 'transfer', 7]) {
    assert.equal(P.propuestaPara(cliente(roto)), null,
      `🔴 con \`${JSON.stringify(roto)}\` ha salido una propuesta. Lo que no se puede leer entero `
      + 'no se propone en trozos: el trozo que falta es una forma de cobro menos.');
  }
});

// ═══ ② EL CLIENTE CON ACUERDO: SE PROPONE, Y EL CLIENTE NO SE ALTERA ═════════════════════

test('SCRUM-586 · 🔴 EL CONTROL QUE DECIDE: lo pactado llega PROPUESTO, en orden de catálogo', () => {
  assert.deepEqual(P.propuestaPara(cliente(['bizum', 'transfer'])), ['bizum', 'transfer']);
  assert.equal(P.hayPropuesta(cliente(['bizum', 'transfer'])), true);
  assert.deepEqual(P.aplicarA(LAS_TRES, ['bizum', 'transfer']), ['bizum', 'transfer'],
    '🔴 aceptar la propuesta no ha dejado las casillas en lo pactado.');
  assert.equal(P.alcanceDe(LAS_TRES, ['bizum', 'transfer']), 1,
    '🔴 el alcance no cuadra: de las tres marcadas a bizum+transferencia cambia UNA casilla.');

  // ORDEN DE CATÁLOGO y no el de la columna: el JSON puede venir en cualquier orden y el texto de
  // la tira tiene que salir siempre igual. Y los duplicados de la columna no llegan a la pantalla.
  assert.deepEqual(P.propuestaPara(cliente(['transfer', 'bizum'])), ['bizum', 'transfer'],
    '🔴 el orden del dato manda sobre el del catálogo: la tira diría cosas distintas para el mismo '
    + 'acuerdo según cómo se guardó.');
  assert.deepEqual(P.propuestaPara(cliente(['bizum', 'bizum'])), ['bizum']);
});

test('SCRUM-586 · 🔴 el profesional cambia lo propuesto y EL CLIENTE NO SE ALTERA', () => {
  // El objeto del cliente es la fila que la lista trajo. Si `aplicarA` o `propuestaPara` lo
  // tocaran, el acuerdo cambiaría por editar un documento — y nadie lo habría pedido.
  const c = cliente(['bizum']);
  const antes = JSON.stringify(c);
  const seleccion = LAS_TRES.slice();

  const propuesta = P.propuestaPara(c);
  const despues = P.aplicarA(seleccion, propuesta);
  // El profesional cambia de idea y vuelve a marcar la tarjeta: eso es SUYO, del documento.
  despues.push('card');

  assert.equal(JSON.stringify(c), antes,
    '🔴 el cliente se ha alterado al proponer o al aplicar. Un valor por defecto que se reescribe '
    + 'solo convierte «lo que pactamos» en «lo del último presupuesto».');
  assert.deepEqual(seleccion, LAS_TRES,
    '🔴 `aplicarA` ha MUTADO la selección que recibió en vez de devolver una nueva.');
  assert.deepEqual(propuesta, ['bizum'],
    '🔴 la propuesta se ha movido cuando el profesional cambió el documento.');
});

test('SCRUM-586 · 🔴 un pacto de LAS TRES consta, y aun así no propone nada', () => {
  // Es el `0 %` del 587 con otra cara: el documento YA nace con las tres, así que no hay nada que
  // ofrecer. Y no es cosmética — decide que la tira no reaparezca para ofrecerle «vuelve a marcar
  // la tarjeta» al profesional que acaba de desmarcarla a mano.
  const c = cliente(['card', 'bizum', 'transfer']);
  assert.deepEqual(P.propuestaPara(c), LAS_TRES, '🔴 un acuerdo explícito de las tres no consta.');
  assert.equal(P.hayPropuesta(c), false,
    '🔴 se propondría un acuerdo que no cambia ni una casilla: la tira saldría a estorbar.');
});

// ═══ ③ 🔴 LA FRONTERA: APLICAR SÓLO SE ALCANZA DESDE EL CLIC ═════════════════════════════

/** Todas las apariciones del identificador, MENOS su propia declaración. */
function referenciasA(sf, nombre) {
  const out = [];
  const v = (n) => {
    if (ts.isIdentifier(n) && n.text === nombre) {
      const esSuDeclaracion = n.parent && ts.isFunctionDeclaration(n.parent) && n.parent.name === n;
      if (!esSuDeclaracion) out.push(n);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  return out;
}

/** ¿Este nodo vive dentro de un `addEventListener("click", …)`? Por ANCESTROS, no por cercanía. */
function dentroDeUnClic(nodo) {
  let n = nodo.parent;
  while (n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'addEventListener'
      && n.arguments.length >= 1 && ts.isStringLiteralLike(n.arguments[0])
      && n.arguments[0].text === 'click') return true;
    n = n.parent;
  }
  return false;
}

function astDelEditor(ancla) {
  const fuente = ejecutableDe(fs.readFileSync(QUOTES_VIEW, 'utf8'), { donde: 'quotesView.js', ancla });
  return ts.createSourceFile('quotesView.js', fuente, ts.ScriptTarget.Latest, true);
}

test('SCRUM-586 · 🔴 EL QUE CIERRA LA DECISIÓN: aplicar NO se alcanza fuera de un clic', () => {
  // 🔴 Esto es lo que un futuro «pulido» tiraría sin enterarse: fusionar «proponer» y «aplicar» en
  // una llamada cómoda no parece nada en el diff, y convierte el ticket en lo contrario de lo que
  // el fundador decidió. Se mide por ALCANZABILIDAD y no por la presencia de una llamada directa:
  // meter la aplicación detrás de una función intermedia caería igual.
  const sf = astDelEditor('aceptarPropuestaDeFormaDePago');
  const refs = referenciasA(sf, 'aceptarPropuestaDeFormaDePago');

  // SUELO: sin referencias, este guard aprobaría la nada — y lo haría en verde para siempre.
  assert.ok(refs.length >= 1,
    '🔴 GUARD CIEGO: no hay ni una referencia a `aceptarPropuestaDeFormaDePago` en el editor. O el '
    + 'enganche no está, o la función se ha renombrado y este control lleva rato mirando al vacío.');

  const fuera = refs.filter((r) => !dentroDeUnClic(r));
  assert.deepEqual(fuera.map((r) => sf.getLineAndCharacterOfPosition(r.getStart(sf)).line + 1), [],
    '🔴 SE APLICA SIN CLIC. Hay una referencia a `aceptarPropuestaDeFormaDePago` fuera de un '
    + '`addEventListener("click", …)`, en la(s) línea(s) de arriba. Las formas de pago del cliente '
    + 'se estarían aplicando solas, y aplicar RESTA opciones de cobro: si el cliente sólo tiene '
    + 'transferencia y el profesional no se fija, el cobro se retrasa entero. El fundador decidió '
    + 'el 5-sep-2026 que esto SE PROPONE.');

  // 🔴 CONTROL POSITIVO DEL DETECTOR, y no es adorno: si `dentroDeUnClic` devolviera `true` para
  // todo, el `deepEqual` de arriba pasaría siempre. `refrescarPropuestaDeFormaDePago` SÍ se llama
  // desde sitios que no son un clic, así que tiene que haber al menos uno que el detector rechace.
  const refresco = referenciasA(sf, 'refrescarPropuestaDeFormaDePago');
  assert.ok(refresco.some((r) => !dentroDeUnClic(r)),
    '🔴 DETECTOR ROTO: `dentroDeUnClic` no rechaza NINGUNA referencia al refresco, que se llama al '
    + 'cambiar de cliente y al restaurar el borrador. Está diciendo que sí a todo.');
});

test('SCRUM-586 · 🔴 la REGLA no se ha copiado al editor: la decisión sigue en la pieza pura', () => {
  // Una copia de «qué se propone» dentro de `quotesView.js` es el modo de que dentro de seis meses
  // una de las dos se quede atrás. El editor puede LEER la decisión, no tomarla.
  const sf = astDelEditor('formaDePagoPorDefecto');
  const usadas = [];
  const v = (n) => {
    if (ts.isPropertyAccessExpression(n)
      && ['aplicarA', 'alcanceDe', 'propuestaPara', 'hayPropuesta'].includes(n.name.text)) {
      usadas.push(n.name.text);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  assert.ok(usadas.includes('propuestaPara') && usadas.includes('aplicarA'),
    '🔴 el editor no usa `propuestaPara`/`aplicarA` de la pieza: está decidiendo con una regla '
    + `suya. Lo que usa hoy: ${JSON.stringify([...new Set(usadas)])}`);
});

// ═══ ④ EL CATÁLOGO ESTÁ DUPLICADO, Y ÉSTE ES EL GUARD QUE SE PAGA POR ELLO ═══════════════

test('SCRUM-586 · 🔴 las TRES grafías del catálogo dicen lo mismo, y en el mismo orden', () => {
  // `['card','bizum','transfer']` vive en `schemas.ts` (dos veces), en el `pmDefs` del editor y
  // aquí. La cuarta copia es forzosa —este fichero es JS de navegador y no puede importar el TS del
  // servidor— y es el escalón 3 del reparto de la casa: duplicar CON GUARD. Éste es el guard.
  //
  // La población se busca por «bizum», que es lo distintivo: `z.enum(['bank','card','mp'])` de
  // `method_preference` también lleva «card» y NO es este catálogo. Buscar por «card» habría
  // metido en el censo una lista que no tiene nada que ver y el guard fallaría por lo que no es.
  const schemas = fs.readFileSync(path.join(RAIZ, 'src/core/validation/schemas.ts'), 'utf8');
  const sfTs = ts.createSourceFile('schemas.ts', schemas, ts.ScriptTarget.Latest, true);
  const enums = [];
  const v = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'enum' && n.arguments.length === 1
      && ts.isArrayLiteralExpression(n.arguments[0])) {
      const vals = n.arguments[0].elements
        .filter((e) => ts.isStringLiteralLike(e)).map((e) => e.text);
      if (vals.includes('bizum')) enums.push(vals);
    }
    ts.forEachChild(n, v);
  };
  v(sfTs);
  assert.ok(enums.length >= 2,
    `🔴 GUARD CIEGO: encontré ${enums.length} \`z.enum\` con «bizum» en \`schemas.ts\` y son al `
    + 'menos DOS (el del presupuesto y el del cobro). Si el barrido no los ve, este control no '
    + 'está comparando nada.');

  const pmDefs = (() => {
    const sfJs = astDelEditor('pmDefs');
    let keys = null;
    const w = (n) => {
      if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.name.text === 'pmDefs'
        && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
        keys = n.initializer.elements.map((el) => {
          if (!ts.isObjectLiteralExpression(el)) return null;
          const p = el.properties.find((x) => ts.isPropertyAssignment(x) && x.name
            && x.name.getText(sfJs).replace(/['"]/g, '') === 'key');
          return p && ts.isStringLiteralLike(p.initializer) ? p.initializer.text : null;
        });
      }
      ts.forEachChild(n, w);
    };
    w(sfJs);
    return keys;
  })();
  assert.ok(Array.isArray(pmDefs) && pmDefs.length > 0 && pmDefs.every(Boolean),
    `🔴 GUARD CIEGO: no consigo leer las claves de \`pmDefs\` en el editor (leí ${JSON.stringify(pmDefs)}).`);

  for (const e of enums) {
    assert.deepEqual(e, P.METODOS,
      `🔴 un \`z.enum\` del servidor dice ${JSON.stringify(e)} y la pieza dice `
      + `${JSON.stringify(P.METODOS)}. La cuarta copia se ha quedado atrás: una forma de pago que `
      + 'el servidor acepta, esta pieza la considera ilegible y DESCARTA LA PROPUESTA ENTERA — en '
      + 'silencio, porque un cliente sin propuesta se ve igual que un cliente sin acuerdo.');
  }
  assert.deepEqual(pmDefs, P.METODOS,
    `🔴 las casillas del editor son ${JSON.stringify(pmDefs)} y la pieza propone sobre `
    + `${JSON.stringify(P.METODOS)}. La propuesta apuntaría a una casilla que no existe.`);
});

// ═══ ⑤ LA SUPERFICIE: LA TIRA QUE PROPONE ════════════════════════════════════════════════

/** El banco con un merchant y una lista de clientes de verdad. `datosDeMuestra` para lo demás. */
function banco({ merchant = { id: 1, name: 'Fontanería Soler', iban: 'ES7620770024003102575766' }, clientes = [] } = {}) {
  return cargarDashboard(RAIZ, {
    datos: (url) => {
      const u = String(url || '');
      if (/\/admin\/merchant/.test(u)) return merchant;
      if (/\/admin\/customers/.test(u)) return clientes;
      return datosDeMuestra(u);
    },
  });
}
const tiraDe = (r) => todos(r.contenedor).filter((n) => clases(n).includes('quote-propuesta-pago'));
/**
 * 🔴 LAS CASILLAS DE FORMA DE PAGO, Y POR QUÉ NO BASTA CON LA CLASE.
 *
 * `pay-methods-row` NO es exclusiva de las formas de pago: el bloque «Datos del cliente en el
 * documento» (A20.4) REUTILIZA esa clase y la de su título. Medido: en el editor montado hay DOS
 * filas con esa clase y SIETE casillas, no tres. Filtrar sólo por la clase daba 7 y el primer
 * `assert` de este fichero lo cazó — si hubiera pedido «al menos 3», habría medido las casillas
 * equivocadas en silencio.
 *
 * El ancla que sí distingue es ESTRUCTURAL y sale de la decisión de colocación del ticket: la
 * tira se pinta pegada a lo que propone cambiar, así que la fila de formas de pago es la ÚLTIMA
 * que aparece ANTES de la tira. Sin microcopy de por medio, que además está sin firmar.
 *
 * (Hallazgo de otro carril, se reporta y no se arregla aquí — regla 37: una clase que se llama
 * como un control y la usa otro es una trampa para el siguiente que mida esta pantalla.)
 */
const casillasDe = (r) => {
  const nodos = todos(r.contenedor);
  const iTira = nodos.findIndex((n) => clases(n).includes('quote-propuesta-pago'));
  if (iTira < 0) return [];
  const previas = nodos.filter((n, i) => i < iTira && clases(n).includes('pay-methods-row'));
  const fila = previas[previas.length - 1];
  return fila ? todos(fila).filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox') : [];
};

test('SCRUM-586 · 🔴 la tira se PINTA en el editor, OCULTA, y reutiliza el componente de la casa', async () => {
  const r = await pintarVista(banco(), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor ha dejado de montarse: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  assert.ok(nodos.length > 50,
    `🔴 BANCO CIEGO: la vista montó ${nodos.length} nodos. Una pantalla vacía y un banco roto dan `
    + 'el mismo verde, y entonces «la tira no está» no significaría nada.');

  // POR CLASE EXACTA, NO POR SUBCADENA: el `<span>` interior se llama `quote-propuesta-pago__texto`
  // y contiene el nombre del padre. Es el defecto que esta casa persigue desde SCRUM-349.
  const tira = tiraDe(r);
  assert.equal(tira.length, 1,
    `🔴 hay ${tira.length} tiras y tiene que haber UNA. Cero = el ticket no llega a la pantalla; `
    + 'dos = un merge la ha duplicado y el profesional vería dos veces la misma oferta.');
  assert.equal(tira[0].hidden, true,
    '🔴 la tira nace VISIBLE: se le está proponiendo un acuerdo a un cliente que no tiene ninguno.');
  assert.match(String(tira[0].className), /\balert\b/, '🔴 no reutiliza el componente `.alert`');
  assert.match(String(tira[0].className), /\binfo\b/,
    '🔴 la tira no es `info`: un acuerdo que el profesional pactó no es un aviso de que algo va mal.');
});

test('SCRUM-586 · ✅ CONTROL NEGATIVO: sin cliente elegido, las TRES casillas siguen marcadas', async () => {
  const r = await pintarVista(banco({ clientes: [cliente(['bizum'])] }), 'renderQuotesView');
  assert.equal(r.error, null);
  const cajas = casillasDe(r);
  assert.equal(cajas.length, 3,
    `🔴 GUARD CIEGO: encontré ${cajas.length} casillas de forma de pago y son TRES.`);
  assert.deepEqual(cajas.map((c) => c.checked), [true, true, true],
    '🔴 el documento ya no nace con las tres marcadas. Este ticket NO puede cambiar el estado de '
    + 'partida: sólo propone cuando hay un cliente elegido con algo pactado.');
  assert.equal(tiraDe(r)[0].hidden, true,
    '🔴 la tira sale sin que nadie haya elegido cliente: eso es proponer en el vacío.');
});

test('SCRUM-586 · 🔴 EL CONTROL DE PUNTA A PUNTA: se elige cliente, se PROPONE, se acepta y el cliente NO se altera', async () => {
  // 🔴 ESTE ES EL CONTROL QUE DECIDE EL TICKET, y por eso se hace sobre la pantalla montada y no
  // sólo sobre la pieza pura: lo que hay que demostrar es que el profesional VE la propuesta y que
  // aceptarla cambia el DOCUMENTO y nada más.
  const c = cliente(['bizum', 'transfer']);
  const clienteAntes = JSON.stringify(c);
  const r = await pintarVista(banco({ clientes: [c] }), 'renderQuotesView');
  assert.equal(r.error, null, `🔴 el editor no monta: ${r.error && r.error.message}`);

  const tira = tiraDe(r)[0];
  const cajas = casillasDe(r);
  assert.equal(cajas.length, 3, `🔴 GUARD CIEGO: ${cajas.length} casillas en vez de tres.`);
  // ANTES de elegir cliente: las tres marcadas y sin tira. Es el estado de hoy.
  assert.deepEqual(cajas.map((x) => x.checked), [true, true, true]);
  assert.equal(tira.hidden, true);

  // El profesional elige al cliente. Se dispara el MISMO evento que el navegador.
  const selector = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id');
  assert.ok(selector, '🔴 GUARD CIEGO: no encuentro el selector de cliente.');
  selector.value = String(c.id);
  selector.disparar('change');

  // ── ② LO PACTADO LLEGA PROPUESTO ────────────────────────────────────────────────────────
  assert.equal(tira.hidden, false,
    '🔴 elegido un cliente con formas de pago pactadas, la tira NO aparece: la propuesta no llega '
    + 'a la pantalla y el ticket no existe para el profesional.');
  const textoTira = todos(tira).map((n) => String(n.textContent || '')).join(' ');
  assert.match(textoTira, /Bizum/, '🔴 la tira no dice QUÉ se pactó: sin el dato no deja decidir.');
  assert.match(textoTira, /Transferencia/);
  assert.doesNotMatch(textoTira, /Tarjeta/,
    '🔴 la tira ofrece tarjeta y el cliente no la tiene pactada: está proponiendo otra cosa.');

  // 🔴 Y NO SE HA APLICADO SOLA. Ésta es la mitad que el fundador decidió el 5-sep-2026.
  assert.deepEqual(cajas.map((x) => x.checked), [true, true, true],
    '🔴 LAS CASILLAS YA HAN CAMBIADO SIN QUE NADIE PULSE NADA. Se está aplicando en silencio, y '
    + 'aplicar RESTA opciones de cobro: el profesional enviaría el documento sin enterarse de que '
    + 'le falta la tarjeta.');

  // ── EL PROFESIONAL ACEPTA ───────────────────────────────────────────────────────────────
  const boton = todos(tira).find((n) => n.tagName === 'BUTTON');
  assert.ok(boton, '🔴 la tira no tiene botón: no hay forma de aceptar la propuesta.');
  boton.click();

  assert.deepEqual(cajas.map((x) => x.checked), [false, true, true],
    '🔴 aceptar la propuesta no ha dejado marcadas exactamente las formas pactadas.');
  assert.equal(tira.hidden, true,
    '🔴 la tira sigue visible tras aceptarla: ya no queda nada que proponer.');

  // ── ③ Y EL PROFESIONAL PUEDE CAMBIARLAS SIN QUE EL CLIENTE SE ALTERE ────────────────────
  // Vuelve a marcar la tarjeta a mano, que es su derecho: es ESTE documento, no el acuerdo.
  cajas[0].checked = true;
  cajas[0].disparar('change');
  assert.equal(JSON.stringify(c), clienteAntes,
    '🔴 EL CLIENTE SE HA ALTERADO desde el editor. «Lo que pactamos» se acaba de convertir en «lo '
    + 'del último presupuesto», y nadie ha pedido cambiar el acuerdo.');
  assert.deepEqual(cajas.map((x) => x.checked), [true, true, true],
    '🔴 el editor ha deshecho el cambio manual del profesional.');
});

test('SCRUM-586 · ✅ el texto de la tira es el FIRMADO, literal', async () => {
  // Firmado por el ASESOR el 6-sep-2026, CON LA CAJA MEDIDA delante (929 y 390 px, en navegador,
  // con los literales extraídos del fuente por AST). Se compara ENTERO y con `===`: un `includes`
  // dejaría colar «Formas de pago pactadas hoy» o «formas de pago pactadas» sin que nada cayera, y
  // microcopy aprobada que deriva sola es microcopy que deja de estarlo.
  const vista = fs.readFileSync(QUOTES_VIEW, 'utf8');
  const m = ejecutableDe(vista, { donde: 'quotesView.js', ancla: 'FORMA_DE_PAGO_ROTULO_TIRA' })
    .match(/const FORMA_DE_PAGO_ROTULO_TIRA = "([^"]*)";/);
  assert.ok(m, '🔴 el texto firmado ya no vive en una sola constante: se ha vuelto a escribir a mano.');
  assert.equal(m[1], 'Formas de pago pactadas',
    `🔴 el texto firmado ha cambiado: ahora dice «${m[1]}». «Pactadas» no es un sinónimo elegido a `
    + 'gusto: es la palabra que el fundador ya firmó en «Descuento pactado (%)», en el modal de '
    + 'cliente, y de la que ésta se derivó.');

  // Y SE PINTA. Un literal firmado que nadie usa es un texto aprobado que no llega a nadie.
  const c = cliente(['bizum', 'transfer']);
  const r = await pintarVista(banco({ clientes: [c] }), 'renderQuotesView');
  const selector = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id');
  assert.ok(selector, '🔴 GUARD CIEGO: no encuentro el selector de cliente.');
  selector.value = String(c.id);
  selector.disparar('change');
  const texto = todos(tiraDe(r)[0]).find((n) => clases(n).includes('quote-propuesta-pago__texto'));
  assert.ok(texto, '🔴 GUARD CIEGO: no encuentro el `<span>` del texto de la tira.');
  assert.ok(String(texto.textContent).startsWith(m[1] + ' · '),
    `🔴 la tira pinta «${texto.textContent}» y tenía que empezar por el literal firmado más su `
    + 'separador. O no se usa la constante, o alguien ha cambiado la composición.');
  assert.doesNotMatch(String(texto.textContent), /\[PENDIENTE/,
    '🔴 el texto de la tira SIGUE con marcador después de haberse firmado. La firma y la retirada '
    + 'del marcador van en el MISMO commit: un PR que llega a `main` con el marcador puesto deja '
    + 'la pantalla diciendo que su propio texto está sin aprobar.');
});

test('SCRUM-586 · 🔴 el rótulo del BOTÓN sigue sin firmar, con la grafía que el censo CUENTA', async () => {
  // 🔴 QUÉ VIGILA ESTO AHORA. Antes vigilaba los DOS textos de la tira; el 6-sep-2026 el asesor
  // firmó el del texto y aquí queda sólo el del BOTÓN, que NO estaba entre los tres literales
  // firmados. No se relaja el control: se estrecha al hueco que de verdad sigue abierto.
  const r = await pintarVista(banco(), 'renderQuotesView');
  const tira = tiraDe(r)[0];
  assert.ok(tira, '🔴 no hay tira que mirar');
  const boton = todos(tira).find((n) => n.tagName === 'BUTTON');
  assert.ok(boton, '🔴 GUARD CIEGO: la tira no tiene botón.');
  assert.match(String(boton.textContent), /\[PENDIENTE/,
    '🔴 el rótulo del botón NO lleva marcador, o lleva una grafía que el censo del 402 no cuenta '
    + '(cuenta `[PENDIENTE`). Si se ha firmado, hay que bajar `FORMA_DE_PAGO_SIN_APROBAR` y la '
    + 'entrada del trinquete EN EL MISMO COMMIT; si no, un marcador invisible se queda dormido.');
  const dentro = todos(tira).map((n) => String(n.textContent || '')).join(' | ');
  assert.doesNotMatch(dentro, /forma de pago habitual|como siempre|aplicar formas/i,
    '🔴 se ha inventado microcopy oficial (regla 30). El texto lo firma el asesor.');
});

test('SCRUM-586 · 🔴 la firma del ASESOR **no** va a `docs/microcopy/`', () => {
  // Ese directorio es el registro del FUNDADOR y `constaAprobado()` lo barre (SCRUM-726): meter
  // ahí una aprobación del asesor la haría pasar por la suya. Su sitio es la entrada de máster.
  const dir = path.join(RAIZ, 'docs/microcopy');
  const registros = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  assert.ok(registros.length > 0,
    '🔴 GUARD CIEGO: `docs/microcopy/` está vacío o no existe, así que «no hay ninguno del 586» '
    + 'sería cierto por no haber mirado nada.');
  assert.equal(registros.some((f) => f.includes('586')), false,
    '🔴 hay un registro de SCRUM-586 en `docs/microcopy/`. Esta aprobación es del ASESOR: su sitio '
    + 'es `docs/master/SCRUM-586.md`.');

  // Y la entrada de máster SÍ lo registra: si no, la firma no consta en ningún sitio.
  const entrada = fs.readFileSync(path.join(RAIZ, 'docs/master/SCRUM-586.md'), 'utf8');
  assert.match(entrada, /Formas de pago pactadas/,
    '🔴 el texto firmado no consta en la entrada de máster, que es donde vive esta aprobación.');
});

test('SCRUM-586 · 🔴 el CONTADOR de ranuras sin firmar dice cuántas hay en ESTA pantalla', () => {
  // Distingue «sin marcador» de «firmado por el fundador» (SCRUM-726). Si mañana entra un tercer
  // texto sin firma en la tira y esto sigue en 2, el hueco deja de estar declarado.
  const vista = fs.readFileSync(QUOTES_VIEW, 'utf8');
  const m = ejecutableDe(vista, { donde: 'quotesView.js', ancla: 'FORMA_DE_PAGO_SIN_APROBAR' })
    .match(/const FORMA_DE_PAGO_SIN_APROBAR = (\d+);/);
  assert.ok(m, '🔴 no hay contador de ranuras sin firmar: «sin marcador» se leería como «aprobado».');
  // 6-sep-2026 · DOS → UNA: el asesor firmó el texto de la tira; el botón sigue sin firmar. El
  // contador NO baja a 0 y por eso sigue sirviendo: «ya no veo marcador» no es «está aprobado».
  assert.equal(Number(m[1]), 1,
    `🔴 el contador dice ${m[1]} y la ranura sin firma de la tira es UNA: el rótulo del botón. `
    + 'El texto se firmó el 6-sep-2026 y su marcador se retiró en el mismo commit.');

  // Y que el número CUADRE con lo que se pinta de verdad: un contador que nadie contrasta es una
  // cifra escrita a mano.
  //
  // 🔴 SE CUENTA POR IDENTIDAD, NO POR FICHERO. La primera versión contaba los literales con
  // marcador de `quotesView.js` entero y le salían CUATRO: los dos de esta tira más los dos de la
  // tira del 587, que vive en el mismo fichero. Habría acusado a mi contador de mentir por contar
  // los textos de otro ticket. Se cuentan las asignaciones a los DOS nodos de ESTA tira.
  const sf = astDelEditor('propuestaPago');
  const NODOS = ['propuestaPagoTexto', 'propuestaPagoBtn'];
  let conMarcador = 0;
  const w = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression)
      && NODOS.includes(n.left.expression.text) && n.left.name.text === 'textContent') {
      const izq = ts.isBinaryExpression(n.right) ? n.right.left : n.right;
      if (ts.isStringLiteralLike(izq) && izq.text.includes('[PENDIENTE')) conMarcador++;
    }
    ts.forEachChild(n, w);
  };
  w(sf);
  assert.equal(conMarcador, Number(m[1]),
    `🔴 el contador dice ${m[1]} y los nodos de ESTA tira pintan ${conMarcador} literales con `
    + 'marcador. Uno de los dos miente, y el que se lee al firmar es el contador.');

  // ⚠️ Y el del 587 se queda donde estaba: este ticket no añade textos a `customersView.js`.
  const clientes = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/customersView.js'), 'utf8');
  const d = clientes.match(/const DTO_POR_DEFECTO_SIN_APROBAR = (\d+);/);
  assert.ok(d, '🔴 GUARD CIEGO: no encuentro el contador del 587.');
  assert.equal(Number(d[1]), 1,
    `🔴 el contador del 587 está en ${d[1]} y debía quedarse en 1: los candidatos del CLIENTE de `
    + 'este ticket NO están en el código (su campo no existe), así que no pueden haberlo movido.');
});

// ═══ ⑥ LA HONESTIDAD DE LAS CASILLAS NO SE DESHACE DESDE AQUÍ ════════════════════════════

test('SCRUM-586 · 🔴 sin IBAN NO se propone transferencia, aunque esté pactada', async () => {
  // `loadInitialData` desmarca y DESACTIVA la transferencia cuando el merchant no tiene IBAN
  // («checkboxes de métodos HONESTOS»), para no ofrecer algo que no va a salir. Si la tira
  // propusiera transferencia igual, este ticket desharía esa honestidad desde otra pantalla:
  // `selectedPayMethods` lee `.checked` y NO mira `disabled`, así que el método viajaría en el
  // payload y el cliente vería una forma de pago que su profesional no tiene configurada.
  const c = cliente(['transfer']);
  const r = await pintarVista(
    banco({ merchant: { id: 1, name: 'Sin banco', iban: '' }, clientes: [c] }),
    'renderQuotesView');
  assert.equal(r.error, null);
  const cajas = casillasDe(r);
  assert.equal(cajas.length, 3, '🔴 GUARD CIEGO: no encuentro las tres casillas.');
  // SUELO ①: si la transferencia NO está desactivada, este test no está midiendo su caso.
  assert.equal(cajas[2].disabled, true,
    '🔴 SUELO CAÍDO: con el merchant sin IBAN la transferencia debería estar DESACTIVADA. Sin eso, '
    + 'lo de abajo pasaría por no haber caso, no por estar bien resuelto.');

  // 🔴 SUELO ②, Y ÉSTE LO ENSEÑÓ LA MUTACIÓN. La primera versión de este test montaba la vista y
  // miraba la tira SIN ELEGIR CLIENTE — y así el refresco nunca tenía a quién mirar, con lo que la
  // tira salía oculta pasara lo que pasara. Salió MUDO en `meta:mutaciones`: la mutación que quita
  // el recorte no lo tumbaba. El rojo que no sale acusa al CASO, no al detector.
  const selector = todos(r.contenedor).find((n) => n.tagName === 'SELECT' && n.name === 'customer_id');
  assert.ok(selector, '🔴 GUARD CIEGO: no encuentro el selector de cliente.');
  selector.value = String(c.id);
  selector.disparar('change');

  assert.equal(tiraDe(r)[0].hidden, true,
    '🔴 se está proponiendo transferencia a un merchant que no puede cobrar por transferencia. '
    + 'Aceptar esa propuesta dejaría el documento SIN NINGUNA forma de pago marcada: '
    + '`selectedPayMethods` lee `.checked` y no mira `disabled`, así que el método viajaría igual.');
});

// ═══ ⑦ EL MÓDULO LLEGA A LA PÁGINA, Y EN ORDEN ═══════════════════════════════════════════

test('SCRUM-586 · 🔴 la pieza se carga en la página y ANTES de quien la consume', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public/dashboard/index.html'), 'utf8');
  const res = scriptsDeLaPagina(html);
  assert.equal(cegueraDelExtractor(res, 20, 'el índice del dashboard'), null);
  const orden = res.clasicos.map((s) => rutaDelDashboard(s).replace(/^js\//, ''));
  const i = (n) => orden.indexOf(n);
  assert.ok(i('formaDePagoPorDefecto.js') >= 0,
    '🔴 la pieza no se carga en la página: es código muerto y la tira nunca se llenaría.');
  assert.ok(i('formaDePagoPorDefecto.js') < i('quotesView.js'),
    '🔴 la pieza se carga DESPUÉS del editor. `window.formaDePagoPorDefecto` no existiría al '
    + 'montarse, la tira no aparecería JAMÁS — y la tanda seguiría verde, porque el editor está '
    + 'escrito para aguantar que la pieza falte.');

  // Y en el service worker: sin esto, la app instalada se queda con la versión de antes del
  // ticket y la tira no existe fuera de línea.
  const sw = fs.readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8');
  assert.match(sw, /formaDePagoPorDefecto\.js/,
    '🔴 la pieza no está en el SHELL del service worker.');
});

// ═══ ⑧ `payMethods` NO VIAJA AL PDF — CENSO DERIVADO, CON SUELO ══════════════════════════

test('SCRUM-586 · ✅ `payMethods` NO llega al PDF: los documentos emitidos no se ven afectados', () => {
  // La población son los campos del modelo `Quote` LEÍDOS del esquema, no una lista a mano. El
  // SUELO son los que SÍ aparecen: si saliera 0, el «no aparece» de `payMethods` significaría
  // «no supe mirar» y se escribe igual que «no está».
  const schema = fs.readFileSync(path.join(RAIZ, 'prisma/schema.prisma'), 'utf8');
  const modelo = schema.match(/^model Quote \{$([\s\S]*?)^\}$/m);
  assert.ok(modelo, '🔴 GUARD CIEGO: no encuentro `model Quote` en el esquema.');
  const campos = modelo[1].split('\n').map((l) => l.trim())
    .filter((t) => t && !t.startsWith('//') && !t.startsWith('@@'))
    .map((t) => (t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+\S/) || [])[1]).filter(Boolean);
  assert.ok(campos.includes('payMethods'),
    '🔴 `payMethods` ya no está en el modelo `Quote`: el cero de abajo no sería un cero.');

  const FICHEROS = [
    'src/lib/pdf.ts',
    'src/modules/invoicing/infra/pdf/pdf.service.ts',
    'src/modules/invoicing/infra/pdf/conceptoLinea.ts',
    'src/modules/quotes/domain/presupuestoParaPdf.ts',
    'src/modules/jobs/infra/albaranPdf.service.ts',
  ];
  const textos = FICHEROS.map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  const aparece = (c) => textos.some((t) => new RegExp('\\b' + c + '\\b').test(t));
  const vistos = campos.filter(aparece);
  assert.ok(vistos.length >= 10,
    `🔴 SUELO CAÍDO: sólo ${vistos.length} campos de \`Quote\` aparecen en el camino del PDF. `
    + 'Con el censo así de ciego, «`payMethods` no aparece» no dice nada.');
  assert.equal(aparece('payMethods'), false,
    '🔴 `payMethods` ha entrado en el camino del PDF. Este ticket cambia el valor POR DEFECTO de '
    + 'un documento nuevo; si además viajara al papel, tocaría el camino de emisión y esto pasa a '
    + 'ser STOP de fundador (regla 38).');
});

// ═══ ⑨ LAS MUTACIONES, DERIVADAS DEL LECTOR OFICIAL ══════════════════════════════════════

test('SCRUM-586 · 🔴 el LECTOR OFICIAL del meta-guard VE mis mutaciones, y las ve enteras', () => {
  // 🔴 POR QUÉ ESTE TEST EXISTE. El meta-guard de SCRUM-745 tiene cuatro defectos conocidos, y uno
  // —SCRUM-757— es que IGNORA EN SILENCIO una declaración con forma propia: `mutacionesDeclaradas`
  // sólo acepta literales de cadena (`textoDe` devuelve `null` para todo lo demás) y sólo se queda
  // con los objetos que traen `fichero`, `de`, `a` y `cae`. Una plantilla, una concatenación o una
  // clave que falte hacen que la mutación DESAPAREZCA del censo sin una línea que lo diga: el
  // meta-guard saldría verde por no tener nada que ejecutar.
  //
  // Así que no se comprueba la declaración leyéndola aquí con un segundo lector —eso mediría mi
  // lector, no el suyo—: SE LE PREGUNTA A ÉL.
  const vistas = mutacionesDeclaradas(fs.readFileSync(ESTE_FICHERO, 'utf8'), path.basename(ESTE_FICHERO));
  assert.equal(vistas.length, MUTACIONES_QUE_ME_TUMBAN.length,
    `🔴 declaro ${MUTACIONES_QUE_ME_TUMBAN.length} mutaciones y el lector oficial ve `
    + `${vistas.length}. Las que no ve NO SE EJECUTAN, y el meta-guard saldría verde sin haber `
    + 'tumbado nada. Casi siempre es una plantilla o una concatenación donde hace falta un literal.');
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    const suya = vistas.find((x) => x.cae === m.cae);
    assert.ok(suya, `🔴 el lector oficial no ve la mutación «${m.cae}».`);
    assert.equal(suya.de, m.de, `🔴 el lector lee otro \`de\` para «${m.cae}».`);
    assert.equal(suya.a, m.a, `🔴 el lector lee otro \`a\` para «${m.cae}».`);
  }
});

test('SCRUM-586 · 🔴 cada mutación declara un texto que EXISTE, una sola vez, en su fichero', () => {
  // Sin esto, una mutación cuyo `de` ya no está en el árbol no muta nada: el guard corre limpio,
  // no cae, y el meta-guard lo llama MUDO acusando al guard de un defecto que es de la declaración.
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    const ruta = path.join(RAIZ, m.fichero);
    assert.ok(fs.existsSync(ruta), `🔴 la mutación «${m.cae}» nombra un fichero que no existe: ${m.fichero}`);
    // 🔴 SCRUM-796 · se cuenta en el fuente del REPOSITORIO, no en el fichero que el arnés está
    // reescribiendo: leído del disco, esto da 0 mientras la mutación está puesta y caía siempre.
    const oc = ocurrenciasEnElRepositorio(m, RAIZ);
    assert.ok(oc.medible, `🔴 CIEGO: no puedo contar el ancla de «${m.cae}» — ${oc.motivo}`);
    assert.equal(oc.veces, 1,
      `🔴 el texto de la mutación «${m.cae}» aparece ${oc.veces} veces en `
      + `${m.fichero} (${oc.origen}) y tiene que aparecer UNA. Con cero no muta nada; con dos muta de más.`);
    assert.notEqual(m.de, m.a, `🔴 la mutación «${m.cae}» no cambia nada.`);
  }
});

test('SCRUM-586 · 🔴 cada mutación nombra un test QUE EXISTE en este fichero', () => {
  // El defecto de SCRUM-748: una declaración que nombra un test renombrado o borrado sale CIEGA y
  // el meta-guard no puede juzgar nada. Se comprueba aquí, donde sí se sabe cómo se llaman.
  const fuente = fs.readFileSync(ESTE_FICHERO, 'utf8');
  const nombres = [...fuente.matchAll(/^test\('([^']+)'/gm)].map((m) => m[1]);
  assert.ok(nombres.length > 5,
    `🔴 GUARD CIEGO: sólo leo ${nombres.length} nombres de test en mi propio fichero.`);
  for (const m of MUTACIONES_QUE_ME_TUMBAN) {
    assert.ok(nombres.some((n) => n.includes(m.cae)),
      `🔴 la mutación dice que cae «${m.cae}» y ningún test de este fichero se llama así. El `
      + 'meta-guard lo declararía CIEGO y nadie sabría que esta mutación no se está probando.');
  }
});

/**
 * 🔴 LAS MUTACIONES QUE TIENEN QUE TUMBARME (contrato de SCRUM-745).
 *
 * Cada una imita EL DEFECTO CONCRETO que el test de al lado promete cazar. Van al final del
 * fichero a propósito: se leen por AST sin importar el módulo, así que su sitio no cambia nada
 * para el meta-guard, y aquí no estorban a la lectura de los controles.
 */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // ① LA DECISIÓN DEL FUNDADOR, convertida en aplicación silenciosa: el refresco —que corre al
    // elegir cliente— pasa a aplicar. Es EXACTAMENTE el «pulido» contra el que se escribió el
    // guard de alcanzabilidad, y en el diff no parece nada.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '      propuestaPagoWrap.hidden = false;',
    a: '      propuestaPagoWrap.hidden = false; aceptarPropuestaDeFormaDePago();',
    cae: 'EL QUE CIERRA LA DECISIÓN: aplicar NO se alcanza fuera de un clic',
  },
  {
    // ② El valor ilegible deja de descartar la propuesta y se filtra en silencio: un cliente con
    // `['bizum','paypal']` pasaría a proponer «sólo bizum», que es RESTAR una opción de cobro por
    // un dato que no se entendió.
    fichero: 'public/dashboard/js/formaDePagoPorDefecto.js',
    de: '      if (METODOS.indexOf(v) < 0) return null;     // fuera de catálogo: ilegible',
    a: '      if (METODOS.indexOf(v) < 0) continue;',
    cae: 'un valor ILEGIBLE no es una propuesta más pequeña: no hay propuesta',
  },
  {
    // ③ La tira deja de recortar lo pactado a lo que el merchant PUEDE ofrecer: con un merchant
    // sin IBAN, se propondría transferencia y aceptarla dejaría el documento sin ninguna forma de
    // pago marcada.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '      const propuesta = propuestaOfrecible(M.propuestaPara(cliente));',
    a: '      const propuesta = M.propuestaPara(cliente);',
    cae: 'sin IBAN NO se propone transferencia, aunque esté pactada',
  },
  {
    // ④ Un pacto de LAS TRES vuelve a contar como propuesta. No cambia ni una casilla, así que la
    // tira saldría a ofrecer lo que el documento ya tiene — y reaparecería justo después de que el
    // profesional desmarcara algo a mano.
    fichero: 'public/dashboard/js/formaDePagoPorDefecto.js',
    de: '    return p !== null && p.length < METODOS.length;',
    a: '    return p !== null;',
    cae: 'un pacto de LAS TRES consta, y aun así no propone nada',
  },
  {
    // ⑤ 6-sep-2026 · el texto FIRMADO deriva solo. Vuelve a «por defecto», que es exactamente la
    // palabra que el asesor descartó por no ser la del dominio. Microcopy aprobada que se mueve
    // sin que nadie lo note es microcopy que deja de estar aprobada.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '    const FORMA_DE_PAGO_ROTULO_TIRA = "Formas de pago pactadas";',
    a: '    const FORMA_DE_PAGO_ROTULO_TIRA = "Formas de pago por defecto";',
    cae: 'el texto de la tira es el FIRMADO, literal',
  },
  {
    // ⑥ 6-sep-2026 · al botón le quitan el marcador SIN firmarlo. Es el defecto que SCRUM-726
    // cerró un nivel más arriba: un hueco sin firma que deja de verse pasa por aprobado.
    fichero: 'public/dashboard/js/quotesView.js',
    de: '    propuestaPagoBtn.textContent = "[PENDIENTE microcopy oficial]";',
    a: '    propuestaPagoBtn.textContent = "Usar estas formas de pago";',
    cae: 'el rótulo del BOTÓN sigue sin firmar, con la grafía que el censo CUENTA',
  },
];
