// tests/scrum820-estados-en-castellano.test.mjs — SCRUM-820
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA VÍCTIMA: el fontanero que abre Presupuestos y lee DRAFT, SENT, ACCEPTED y REJECTED.
//
// Doce de doce filas en inglés, y la app contradiciéndose a sí misma: el MISMO presupuesto salía
// «Aceptado» en Inicio y ACCEPTED en la lista. Medido con las dos pantallas pintadas y el mismo
// dato: **discrepaban los SEIS estados**, no cuatro.
//
// ── EL DEFECTO DE FONDO NO ERA LA TRADUCCIÓN QUE FALTABA ─────────────────────────────────────
// `buildStatusPill` traducía DOS estados y dejaba caer los otros cuatro a `st.toUpperCase()`.
// Pero el diccionario español YA EXISTÍA CUATRO VECES en el mismo directorio —`customerDetailView`,
// `globalSearch`, `homeView` y el medio-mapa de `quotesListView`— y cada copia traducía un
// subconjunto distinto. La contradicción no era un olvido: **era que nadie leía del mismo sitio.**
//
// Así que esto no vigila «que haya traducción»: vigila que haya UNA SOLA, y que las pantallas
// lean de ella. Un guard que sólo comprobara los seis rótulos pasaría en verde el día que alguien
// escriba la quinta copia — que es exactamente cómo llegamos aquí.
//
// ── LO QUE ESTE GUARD NO CUBRE, dicho aquí y no en una nota al pie ───────────────────────────
// Los mapas de `customerDetailView.js` y `globalSearch.js` SIGUEN VIVOS y no se tocan en este
// ticket: mezclan estados de presupuesto con estados de FACTURA (`paid`, `pending`) y separarlos
// es otro carril. Están CENSADOS abajo: mientras estén ahí, no pueden crecer ni cambiar de
// número sin que alguien lo afirme.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_JS = path.join(RAIZ, 'public', 'dashboard', 'js');

/** La pieza, EJECUTADA. Más fuerte que buscar su forma en el fuente con un regex. */
function pieza() {
  const ctx = cargarDashboard(RAIZ).ctx;
  return ctx.quoteStatusMeta || (ctx.window && ctx.window.quoteStatusMeta);
}

/** Los seis estados del presupuesto, con el rótulo que el fundador tiene firmado o en producción. */
const ESPERADO = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Caducado',
  // El literal que la PROPIA lista usa en su filtro: se filtra y se lee lo mismo.
  pending_approval: 'Pendiente de aprobación',
};

test('SCRUM-820 · SUELO: la pieza existe y se puede ejecutar', () => {
  const f = pieza();
  assert.equal(typeof f, 'function',
    '🔴 CIEGO: no encuentro `quoteStatusMeta` en el dashboard cargado. Sin la pieza, todo lo de '
    + 'abajo pasaría en verde sin haber comprobado nada.');
});

test('SCRUM-820 · los SEIS estados salen en castellano, no en inglés crudo', () => {
  const f = pieza();
  const malos = [];
  for (const [st, label] of Object.entries(ESPERADO)) {
    const meta = f(st);
    if (!meta || meta.label !== label) malos.push(`${st} → ${JSON.stringify(meta && meta.label)} (esperado «${label}»)`);
    // Y el que decide de verdad: que no salga el identificador, en ninguna forma.
    if (meta && String(meta.label).toLowerCase() === st) malos.push(`${st} → devuelve el IDENTIFICADOR`);
  }
  assert.deepEqual(malos, [],
    '🔴 un estado de presupuesto no sale con su rótulo aprobado:\n     ' + malos.join('\n     '));
});

test('SCRUM-820 · cada estado trae su clase de píldora, y son las de la casa', () => {
  const f = pieza();
  const CLASES = new Set(['status-pill-draft', 'status-pill-pending', 'status-pill-accepted',
    'status-pill-rejected', 'status-pill-approval']);
  for (const st of Object.keys(ESPERADO)) {
    const c = f(st).pillClass;
    assert.ok(CLASES.has(c),
      `🔴 «${st}» pinta la clase «${c}», que no es ninguna de las cinco de la hoja. El color es el `
      + 'segundo canal de DESIGN.md: una clase inventada no existe en el CSS y la píldora sale desnuda.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL NEGATIVO: lo desconocido no se vuelca crudo
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-820 · 🔴 un estado SIN mapear no le escupe el identificador al usuario', () => {
  const f = pieza();
  // Tres formas del mismo caso: el estado que alguien añada mañana, uno vacío y uno nulo.
  for (const st of ['pending_signature_v2', '', null, undefined]) {
    const meta = f(st);
    assert.ok(meta && typeof meta.label === 'string' && meta.label.length > 0,
      `🔴 «${st}» no devuelve rótulo: la píldora saldría vacía.`);
    assert.equal(String(meta.label).toLowerCase().includes('pending_signature_v2'), false,
      '🔴 SE PINTA EL IDENTIFICADOR INTERNO. Nunca se le vuelca a la cara del usuario un código '
      + 'de la base de datos: no le dice nada y le enseña las tripas del producto.');
    assert.equal(/^[a-z_]+$/.test(String(meta.label)), false,
      '🔴 el rótulo tiene forma de identificador (minúsculas y guiones bajos).');
  }
  // Y lo que la lección de SCRUM-153 exige: que NO se disfrace del más inocente.
  assert.notEqual(f('pending_signature_v2').label, ESPERADO.accepted,
    '🔴 un estado desconocido se está pintando como «Aceptado». Un estado que no se reconoce '
    + 'disfrazado del más favorable es peor que uno crudo: el pro toma decisiones con eso.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA COHERENCIA POR CONSTRUCCIÓN: una sola copia, y censo de las que quedan
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Ficheros del dashboard que traducen ELLOS MISMOS un estado de presupuesto.
 *
 * El barrido busca el par que define un diccionario de estados —una clave `accepted` con un
 * valor de texto en castellano— sobre el código SIN COMENTARIOS: si no, este mismo fichero y los
 * párrafos que explican el defecto contarían como copias. Es la trampa de auto-referencia que en
 * esta casa ya ha mordido cuatro veces.
 */
function copiasDelDiccionario() {
  const fuera = new Set(['api.js']); // la pieza oficial: ahí es donde TIENE que estar
  const copias = [];
  for (const f of fs.readdirSync(DIR_JS).filter((n) => n.endsWith('.js'))) {
    if (fuera.has(f)) continue;
    const codigo = soloCodigo(fs.readFileSync(path.join(DIR_JS, f), 'utf8'));
    const n = [...codigo.matchAll(/accepted\s*:\s*['"](Aceptad[oa])['"]/g)].length;
    if (n) copias.push([f, n]);
  }
  return copias;
}

// Medido el 7-sep-2026 sobre `origin/main` con este mismo barrido. NO se ponen a 0: la entrada
// se BORRA cuando el fichero deja de traducir por su cuenta (criterio de SCRUM-402/424/405).
const CENSO_DE_COPIAS = Object.freeze({
  // Mezcla estados de presupuesto y de FACTURA (`paid`, `pending`) en el mismo diccionario.
  // Separarlos es otro carril y no se toca aquí (regla 9); queda vigilado para que no crezca.
  'customerDetailView.js': 1,
  // Ídem: el buscador global pinta presupuestos, facturas y trabajos con un solo mapa.
  'globalSearch.js': 1,
  // 🔴 LA QUINTA COPIA — ENTRADA BORRADA el 8-sep-2026, no puesta a 0 (su propio criterio, y el
  // de SCRUM-402/424/405): `teamView.js` ya NO traduce por su cuenta. Sus literales —que eran los
  // buenos: «Caducado» masculino y «Pendiente de aprobación» entero— se llevaron a la pieza, y con
  // ellos sus dos estados derivados del cobro. Ahora lee de `quoteStatusMeta` como las demás.
});

test('SCRUM-820 · SUELO: el barrido de copias VE las que sabemos que hay', () => {
  const copias = copiasDelDiccionario();
  // 🔴 EL SUELO SE DERIVA DEL CENSO, NO ES UN NÚMERO A MANO (8-sep-2026, encima de d03b1950).
  //
  // Era `>= 3` fijo, y cayó al cerrar la copia de `teamView.js`: quedaban dos. Bajar el 3 a un 2
  // habría sido ajustar el guard al código —lo que esta casa tiene prohibido—, así que se ata a lo
  // ÚNICO que sabe cuántas debería haber: **el propio censo declarado**. Ahora el suelo baja solo
  // cuando alguien BORRA una entrada a conciencia, y sigue cazando lo que existía para cazar: un
  // barrido que deja de ver.
  //
  // El `>= 1` de después no es redundante: si algún día el censo se vaciara, un suelo de cero
  // dejaría pasar un instrumento completamente roto sin decir nada.
  const declaradas = Object.keys(CENSO_DE_COPIAS).length;
  assert.ok(declaradas >= 1,
    '🔴 el censo está vacío: este guard ya no tiene contra qué medir. Si de verdad no queda ni una '
    + 'copia, lo que hay que revisar es si este barrido sigue teniendo sentido, no darlo por bueno.');
  assert.ok(copias.length >= declaradas,
    `🔴 CIEGO: el barrido encuentra ${copias.length} copias del diccionario y el censo declara `
    + `${declaradas}. Si sale menos, el instrumento está roto — no es que se hayan limpiado solas, `
    + 'y el cero de las demás no significaría nada.');
});

test('SCRUM-820 · 🔴 nadie estrena una copia NUEVA del diccionario de estados', () => {
  const copias = copiasDelDiccionario();
  const problemas = [];
  for (const [f, n] of copias) {
    const techo = CENSO_DE_COPIAS[f];
    if (techo === undefined) {
      problemas.push(`${f} traduce estados por su cuenta y NO estaba en el censo (${n}).\n`
        + '       Lee de `window.quoteStatusMeta` (api.js) en vez de escribir la quinta copia:\n'
        + '       es el defecto que este ticket cierra, no una variante de él.');
    } else if (n > techo) {
      problemas.push(`${f} pasa de ${techo} a ${n} copias. El censo sólo baja.`);
    }
  }
  for (const f of Object.keys(CENSO_DE_COPIAS)) {
    if (!copias.some(([g]) => g === f)) {
      problemas.push(`ENTRADA CADUCA: ${f} ya no traduce por su cuenta. BÓRRALA del censo — no la `
        + 'pongas a 0: mientras esté, ese fichero puede volver a crecer sin caer.');
    }
  }
  assert.deepEqual(problemas, [],
    '🔴 el diccionario de estados vuelve a estar repartido:\n     ' + problemas.join('\n     '));
});

test('SCRUM-820 · 🔴 las pantallas del ticket LEEN de la pieza, no traducen', () => {
  // Éste es el que ata el arreglo: si mañana alguien vuelve a escribir el ternario en la lista,
  // los tests de arriba seguirían verdes (la pieza estaría bien) y la pantalla volvería a mentir.
  for (const f of ['quotesListView.js', 'homeView.js']) {
    const codigo = soloCodigo(fs.readFileSync(path.join(DIR_JS, f), 'utf8'));
    assert.match(codigo, /quoteStatusMeta\s*\(/,
      `🔴 «${f}» ya no lee de \`quoteStatusMeta\`. Si vuelve a decidir el rótulo por su cuenta, `
      + 'vuelve la contradicción entre pantallas — que es el defecto, no la traducción que falta.');
    assert.equal(/toUpperCase\(\)\s*;?\s*\/\/\s*A16\.2/.test(codigo), false,
      `🔴 ha vuelto el volcado en mayúsculas a «${f}».`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// AÑADIDO ENCIMA DE d03b1950 — lo que el barrido por AST encontró y esta rama no cubría
//
// Todo lo de arriba es de `d03b1950` y no se ha tocado. Lo de aquí abajo cierra tres huecos que
// se midieron DESPUÉS, sobre esta misma rama ya mergeada con `main`:
//
//   ① `quotesDetailView.js` seguía con el `st.toUpperCase()` COPIADO. La lista decía «Aceptado» y
//      la ficha a la que se llega pinchándola, `ACCEPTED`. El defecto no estaba cerrado: estaba
//      movido un clic, y justo al sitio donde el jefe mira para decidir.
//   ② `teamView.js` seguía con la quinta copia viva. Era además **la que tenía los literales
//      buenos** —«Caducado» masculino, «Pendiente de aprobación» entero—, así que mientras
//      estuviera ahí, la pieza y la referencia eran dos cosas distintas.
//   ③ La pieza no cubría `paid` ni `pending`, que **el servidor sí manda**: `listQuotesAdmin`
//      (`quoteAdmin.ts:79-91`) los deriva del cobro, y esa es la ruta de la LISTA
//      (`quotesAdmin.routes.ts:65`). Un presupuesto cobrado se pintaba «—».
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Los DOS estados que el servidor DERIVA del cobro. No son del schema: los calcula la ruta. */
const DERIVADOS = { paid: 'Pagado', pending: 'Pendiente' };

/** Monta una vista de verdad y devuelve el texto de sus píldoras de estado. */
async function pildorasDe(nombreVista, datos, ...args) {
  const banco = cargarDashboard(RAIZ, { datos });
  const r = await pintarVista(banco, nombreVista, ...args);
  const textos = todos(r.contenedor)
    .filter((n) => String(n.className || '').includes('status-pill'))
    .map((n) => String(n.textContent || '').trim())
    .filter(Boolean);
  return { r, textos, todoElTexto: todos(r.contenedor).map((n) => String(n.textContent || '')).join(' | ') };
}

test('SCRUM-820 · 🔴 los DOS estados DERIVADOS del cobro no caen al respaldo', () => {
  const f = pieza();
  for (const [st, label] of Object.entries(DERIVADOS)) {
    assert.equal(f(st).label, label,
      `🔴 «${st}» cae al respaldo y se pinta «${f(st).label}». El servidor SÍ manda este estado: `
      + '`listQuotesAdmin` lo deriva del cobro para la lista y para la ficha de un miembro. '
      + 'Pintar «—» ahí no es prudencia: es perder el dato — «pagado» y «no lo reconozco» acaban '
      + 'diciendo lo mismo en pantalla.');
  }
  // Y en masculino, por el MISMO criterio que decidió «Caducado» y no «Caducada»: un presupuesto
  // es masculino; la que es «Pagada» es la factura.
  assert.equal(f('paid').label, 'Pagado', '🔴 «Pagada» es la forma de la FACTURA.');
});

test('SCRUM-820 · 🔴 SUELO: las TRES pantallas montan y pintan su píldora', async () => {
  const uno = [{ id: 1, number: 1, status: 'accepted', customerName: 'Ana Ruiz', total: '100.00',
    totalAmount: '100.00', currency: 'EUR', quoteNumber: 1, customer: 'Ana Ruiz',
    createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }];

  const lista = await pildorasDe('renderQuotesListView', uno);
  assert.equal(lista.r.error, null, `🔴 la lista revienta: ${lista.r.error && lista.r.error.message}`);
  assert.ok(lista.textos.length >= 1,
    '🔴 CIEGO: no veo ni una píldora en la lista. Sin verlas, «ninguna en inglés» no dice nada.');

  const detalle = await pildorasDe('renderQuoteDetailView', { ...uno[0], lines: [], items: [] }, 1);
  assert.equal(detalle.r.error, null, `🔴 la ficha revienta: ${detalle.r.error && detalle.r.error.message}`);
  assert.ok(detalle.textos.length >= 1,
    '🔴 CIEGO: no veo ninguna píldora en la ficha del presupuesto — que es donde estaba el hueco ①.');
});

test('SCRUM-820 · ✅ COHERENCIA: lista, DETALLE e Inicio dicen lo MISMO en los seis estados', async () => {
  const f = pieza();
  const tabla = [];

  for (const st of Object.keys(ESPERADO)) {
    const uno = { id: 1, number: 1, status: st, customerName: 'Ana Ruiz', total: '100.00',
      totalAmount: '100.00', currency: 'EUR', quoteNumber: 1, customer: 'Ana Ruiz', lines: [], items: [],
      createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' };

    const lista = await pildorasDe('renderQuotesListView', [uno]);
    const detalle = await pildorasDe('renderQuoteDetailView', uno, 1);
    tabla.push({ st, lista: lista.textos[0] || '(nada)', detalle: detalle.textos[0] || '(nada)', pieza: f(st).label });
  }

  // 🔴 LA TABLA QUE DECIDE. Antes: Inicio decía «Aceptado» y la lista `ACCEPTED` — y en `expired` y
  // `pending_approval` era Inicio quien volcaba el crudo. `d03b1950` cerró esas dos; el DETALLE
  // seguía diciendo `ACCEPTED` mientras la lista ya decía «Aceptado».
  const malas = tabla.filter((f2) => !(f2.lista === f2.detalle && f2.detalle === f2.pieza));
  assert.deepEqual(malas, [],
    '🔴 dos pantallas dicen cosas distintas del MISMO presupuesto:\n     '
    + tabla.map((r) => `${r.st}: lista=«${r.lista}» detalle=«${r.detalle}» pieza=«${r.pieza}»`).join('\n     '));

  // Inicio lee de la misma pieza — comprobado sobre el código, porque su feed no pinta `.status-pill`.
  const home = soloCodigo(fs.readFileSync(path.join(DIR_JS, 'homeView.js'), 'utf8'));
  assert.match(home, /quoteStatusMeta\s*\(/, '🔴 Inicio ha dejado de leer de la pieza.');
});

test('SCRUM-820 · ✅ NEGATIVO: un estado desconocido no se pinta crudo en NINGUNA de las tres', async () => {
  const raro = 'ESTADO_FUTURO_V2';
  const uno = { id: 1, number: 1, status: raro, customerName: 'Ana Ruiz', total: '100.00',
    totalAmount: '100.00', currency: 'EUR', quoteNumber: 1, customer: 'Ana Ruiz', lines: [], items: [],
    createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' };

  const lista = await pildorasDe('renderQuotesListView', [uno]);
  assert.equal(lista.todoElTexto.includes(raro), false,
    '🔴 la LISTA vuelca el identificador interno de un estado desconocido.');

  const detalle = await pildorasDe('renderQuoteDetailView', uno, 1);
  assert.equal(detalle.todoElTexto.includes(raro), false,
    '🔴 la FICHA vuelca el identificador interno de un estado desconocido.');

  // Y la pieza, que es de donde salen las tres.
  assert.equal(String(pieza()(raro).label).includes(raro), false,
    '🔴 la pieza devuelve el identificador.');
});

test('SCRUM-820 · 🔴 el DETALLE y EQUIPO también LEEN de la pieza, no traducen', () => {
  // El guard de arriba ata `quotesListView` y `homeView`. Estas dos son las que faltaban: el
  // detalle tenía el ternario copiado y `teamView` su propio diccionario.
  for (const f of ['quotesDetailView.js', 'teamView.js']) {
    const codigo = soloCodigo(fs.readFileSync(path.join(DIR_JS, f), 'utf8'));
    assert.match(codigo, /quoteStatusMeta\s*\(/,
      `🔴 «${f}» no lee de \`quoteStatusMeta\`. Mientras decida el rótulo por su cuenta, vuelve la `
      + 'contradicción entre pantallas — que es el defecto, no la traducción que falta.');
    assert.equal(/\bst\.toUpperCase\(\)/.test(codigo), false,
      `🔴 ha vuelto el volcado en mayúsculas a «${f}».`);
  }
});
