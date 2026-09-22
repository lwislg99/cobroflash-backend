// tests/scrum961b-el-nif-que-no-cuela.test.mjs — SCRUM-961b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// EL EMPAREJAMIENTO POR NIF DECIDE DE QUIÉN CUELGA UN GASTO, Y ESO ES DINERO IMPUTADO.
//
// Palabras del fundador al partir SCRUM-961: «el emparejamiento por NIF decide si un gasto acaba
// colgado del proveedor equivocado, y eso es dinero mal imputado, que es peor que un campo mal
// leído». Un importe mal leído se ve al mirarlo; un gasto colgado del proveedor de al lado cuadra
// en pantalla y sale mal en el libro de recibidas.
//
// Sin red, sin base y sin cuota de Gemini: `leerTicket` recibe sus dos dependencias por parámetro
// (`completar` y `cliente`), así que el banco entero corre con dobles. **Ni una línea de `src/`
// existe por este fichero**: no se ha exportado nada ni se ha cambiado ninguna firma para poder
// mirar (la trampa de SCRUM-411 y de la ficha de esta sesión).
//
// ── 🔴 LO QUE ESTE FICHERO SOSTIENE, Y EL ORDEN NO ES CASUAL ─────────────────────────────────
//
//   ① NEGATIVO · un NIF que NO EXISTE no se engancha a NADIE. Con fichas delante, no con la base
//      vacía: «no hay a quién engancharse» y «había a quién y no se enganchó» son cosas distintas.
//   ② NEGATIVO · un NIF PARECIDO no cuela. Doce formas de parecerse, una por línea.
//   ③ POSITIVO · el que SÍ es, casa — aunque venga con guiones, espacios y en minúsculas.
//   ④ ESTRUCTURAL · el banco JUZGA el NIF en TODOS los casos que lo llevan puesto.
//
// ── ⚠️ ① Y ② NACIERON VERDES, Y SE DICE ─────────────────────────────────────────────────────
//
// El emparejamiento de `lecturaTicket.ts:334` YA es igualdad exacta sobre NIF normalizado, así que
// ① y ② pasaron a la primera. Un control que nace verde no ha demostrado nada todavía: lo que los
// hace valer son las MUTACIONES del expediente (`docs/master/SCRUM-961.md`), inyectadas de verdad
// en `src/`, donde se ve cuál cae con cuál. Aquí quedan como TRINQUETE: hoy no hay defecto, y el
// día que alguien cambie el `===` por un `startsWith` —o traiga un emparejador «listo» por nombre—
// esto lo dice antes de que un euro se cuelgue del proveedor de al lado.
//
// ④ SÍ estaba rojo el 20-sep, y es el punto 4 del encargo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const L = await import('../dist/modules/expenses/domain/lecturaTicket.js');

const AHORA = new Date('2026-09-18T10:00:00Z');
const IMAGEN = { mimeType: 'image/jpeg', data: 'QUJD' };
const MERCHANT = 55;

// CIF con su control comprobado a mano en `nifEspanol.ts` (control 1). Es el mismo literal que usa
// `scrum912`: si uno de los dos se cambiara por un NIF inválido, la lectura se descartaría antes de
// llegar al emparejamiento y los dos ficheros se quedarían verdes midiendo el descarte.
const NIF_DEL_TICKET = 'A58818501';
// Otro CIF VÁLIDO y distinto: hace falta uno válido para el caso «existe, pero no es el del ticket».
const NIF_DE_OTRO = 'B00000000';

function clienteCon(fichas) {
  const consultas = [];
  return { consultas, provider: { findMany: async (args) => { consultas.push(args); return fichas; } } };
}
const completarCon = (objeto) => async () => ({ texto: JSON.stringify(objeto), modelo: 'modelo-doble' });

/** Una lectura mínima que llega entera al emparejamiento, con el NIF que se le diga. */
const lecturaCon = (nif) => ({ concepto: 'Codos de cobre', total: 12.1, fecha: '2026-09-17', nifProveedor: nif });

const leerCon = (fichas, nif = NIF_DEL_TICKET) => {
  const cliente = clienteCon(fichas);
  return L.leerTicket({ merchantId: MERCHANT, imagen: IMAGEN, ahora: AHORA },
    { completar: completarCon(lecturaCon(nif)), cliente }).then((r) => ({ r, cliente }));
};

test('SCRUM-961b · 🔴 ① un NIF que NO EXISTE no se engancha a NADIE — y había a quién', async () => {
  // 🔴 EL SUELO DE ESTE CONTROL ES LA POBLACIÓN. Con la base vacía, «no se ha enganchado a nadie»
  // es cierto por no haber nadie, y el control saldría verde con el emparejador ROTO. Por eso el
  // merchant tiene tres proveedores con NIF, y ninguno es el del ticket.
  const fichas = [
    { id: 7, taxId: NIF_DE_OTRO },
    { id: 8, taxId: '12345678Z' },
    { id: 9, taxId: 'X1234567L' },
  ];
  const { r, cliente } = await leerCon(fichas);

  assert.equal(r.propuesta.nifProveedor, NIF_DEL_TICKET,
    '🔴 NO PUDE MIRAR: el NIF del ticket no ha llegado a la propuesta, así que el emparejamiento '
    + 'ni se ha intentado y lo de abajo saldría verde sin medir nada');
  assert.equal(cliente.consultas.length, 1, '🔴 NO PUDE MIRAR: no se ha consultado la base');
  assert.ok(fichas.length > 0, '🔴 NO PUDE MIRAR: sin fichas delante esto no distingue nada');

  assert.equal(r.propuesta.providerId, null,
    `🔴 un NIF que no existe (${NIF_DEL_TICKET}) se ha enganchado a un proveedor: el gasto acaba `
    + 'colgado de quien no es, y eso es dinero mal imputado');

  // ✅ CONTROL POSITIVO EN LA MISMA BASE: con estas MISMAS fichas, el NIF de una de ellas SÍ
  // engancha. Sin esto, el `null` de arriba podría ser un emparejador que no engancha nunca.
  const { r: bis } = await leerCon(fichas, NIF_DE_OTRO);
  assert.equal(bis.propuesta.providerId, 7,
    '🔴 NO PUDE MIRAR: sobre las MISMAS fichas, un NIF que SÍ está tampoco engancha. Entonces el '
    + '«no se engancha a nadie» de arriba no prueba nada: no engancha nunca.');
});

test('SCRUM-961b · 🔴 ② un NIF PARECIDO no cuela — doce formas de parecerse', async () => {
  // Cada fila es UNA ficha, sola delante del mismo NIF del ticket (`A58818501`). Sola a propósito:
  // con varias, un `null` podría venir del desempate (`casan.length === 1`) en vez de la
  // comparación, que es lo que aquí se juzga.
  //
  // ⚠️ El `taxId` de la ficha NO pasa por el validador —`POST /admin/expenses` lo escribe sin
  // validar (`expenses.service.ts`)—, así que estas formas son las que de verdad puede haber
  // guardadas, no hipótesis.
  const PARECIDOS = [
    'A58818502',   // el dígito de control, uno arriba
    'A58818500',   // el dígito de control, uno abajo
    'A58818511',   // un dígito del medio cambiado
    'A58817501',   // otro dígito del medio cambiado
    'B58818501',   // otra letra de entidad
    'A5881850',    // un carácter menos
    'A588185012',  // un carácter más, por detrás
    '0A58818501',  // un carácter más, por delante
    '58818501',    // sin la letra de entidad
    'A58818501X',  // el bueno con un sufijo pegado
    'ESA58818501', // el bueno con el prefijo intracomunitario
    'A588185',     // un prefijo del bueno
  ];

  const colados = [];
  for (const taxId of PARECIDOS) {
    const { r } = await leerCon([{ id: 100, taxId }]);
    if (r.propuesta.providerId !== null) colados.push(`${taxId} → providerId ${r.propuesta.providerId}`);
  }
  assert.deepEqual(colados, [],
    `🔴 hay NIF PARECIDOS que se enganchan al proveedor con el NIF ${NIF_DEL_TICKET}:\n   · `
    + colados.join('\n   · ')
    + '\n  Un gasto colgado del proveedor de al lado cuadra en pantalla y sale mal en el libro.');

  // ④ SUELO: doce `null` también los da un emparejador que no engancha NUNCA. El positivo va en el
  // mismo test, con la misma maquinaria, para que no puedan divergir.
  const { r: exacto } = await leerCon([{ id: 100, taxId: NIF_DEL_TICKET }]);
  assert.equal(exacto.propuesta.providerId, 100,
    '🔴 NO PUDE MIRAR: ni el NIF EXACTO engancha, así que los doce `null` de arriba no dicen que '
    + 'los parecidos se rechacen — dicen que no se engancha nunca.');
});

test('SCRUM-961b · ✅ ③ el que SÍ es casa aunque venga con guiones, espacios y en minúsculas', async () => {
  // Los dos lados se normalizan (`normalizarNif`): el leído al sanear, y el de la ficha al
  // comparar. Si alguien quitara la normalización de UN lado, esto cae y ② seguiría verde — son
  // controles distintos, no el mismo dos veces.
  const { r, cliente } = await leerCon([{ id: 42, taxId: '  a-5881.8501 ' }]);
  assert.equal(r.propuesta.providerId, 42,
    '🔴 una ficha guardada con guiones/espacios/minúsculas no casa con el mismo NIF del ticket: el '
    + 'profesional tiene el proveedor dado de alta y no se le engancha');

  // Y la consulta, que es donde vive la regla 2. Se mira el `where` ENTERO y no sólo el merchant:
  // el doble devuelve lo que le den, así que lo único que protege al vecino es lo que se le pide a
  // la base. `taxId: { not: null }` entra aquí porque sin él la consulta se trae todas las fichas
  // del merchant para nada — y porque una ficha sin NIF no puede casar con ninguno.
  assert.deepEqual(cliente.consultas[0].where, { merchantId: MERCHANT, taxId: { not: null } },
    '🔴 la búsqueda de proveedor ha cambiado de `where`: si pierde `merchantId` se puede enganchar '
    + 'el proveedor de OTRO negocio (regla 2)');
});

test('SCRUM-961b · 🔴 ④ el banco JUZGA el NIF en TODOS los casos que lo llevan puesto', async () => {
  // El punto 4 del encargo: «que el banco JUZGUE el NIF en todos los casos, no sólo en algunos —
  // hoy hay un caso que lo rellena y no lo mira».
  //
  // Un test que hace leer un ticket CON NIF y no dice nada del proveedor deja el emparejamiento
  // corriendo sin juez: si un día engancha al que no es, ese test sigue verde. Aquí no se cuenta
  // cuántos hay (una cifra escrita a mano caduca): se exige que no quede NINGUNO.
  // Sólo `scrum912`: es el banco que hace leer tickets llamando a `leerTicket(` directamente. Este
  // fichero pasa por su propio `leerCon(...)`, así que un barrido por el nombre de la función no lo
  // vería — y se dice en vez de apuntarse un banco que no se está mirando.
  const BANCOS = ['scrum912-leer-ticket-gasto.test.mjs'];
  const mudos = [];
  const vistos = [];
  let bloquesMirados = 0;

  for (const nombre of BANCOS) {
    const ruta = path.join(import.meta.dirname, nombre);
    // Sin comentarios: si no, la PROSA que explica esta regla la cumpliría por nombrar
    // `providerId`, y el guard se daría por bueno a sí mismo (la trampa de la ficha de esta casa).
    const fuente = fs.readFileSync(ruta, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    for (const bloque of fuente.split(/\ntest\(/).slice(1)) {
      const titulo = (/^['"`](.*?)['"`]/.exec(bloque) || [, '(sin título)'])[1];
      // Sólo los que HACEN leer un ticket y llegan a tener propuesta que juzgar.
      if (!/leerTicket\(/.test(bloque)) continue;
      if (/rejects|assert\.throws/.test(bloque)) continue;      // no hay propuesta: hubo error
      // ⚠️ AQUÍ HABÍA UN FILTRO DE MÁS, y el suelo lo cazó: excluir el bloque entero por contener
      // `nifProveedor: null` se llevaba por delante el test del proveedor de `scrum912`, que tiene
      // TRES casos y sólo uno sin NIF. De 5 bloques quedaba 1. Un filtro que mira el bloque entero
      // no puede hablar de un caso suyo — así que no se filtra: todo bloque que haga leer un
      // ticket y llegue a una propuesta tiene que decir algo del proveedor, también cuando lo que
      // tiene que decir es «sin NIF no se engancha nadie».
      bloquesMirados += 1;
      vistos.push(titulo);
      if (!/providerId/.test(bloque)) mudos.push(`${nombre} · ${titulo}`);
    }
  }

  // ④ SUELO. Y NO ES UNA CIFRA: un «al menos N» escrito a mano caduca el día que el banco crece o
  // adelgaza, y este mismo control ya me lo enseñó —lo puse en 4, la realidad eran 2, y el suelo
  // saltó acusando al instrumento de ciego cuando el ciego era el umbral. El suelo es un CONTROL
  // POSITIVO anclado a un bloque que existe y que SÍ juzga: si el barrido no lo encuentra, no está
  // leyendo el fichero, y entonces «no hay mudos» es cierto por no haber mirado.
  const QUE_SI_JUZGA = 'el proveedor se propone solo si su NIF casa con UNA ficha del merchant';
  assert.ok(vistos.some((t) => t.includes(QUE_SI_JUZGA)),
    `🔴 NO PUDE MIRAR: el barrido no ha encontrado «${QUE_SI_JUZGA}», que es un bloque que existe y `
    + `que sí juzga el proveedor. He visto ${bloquesMirados}: ${vistos.join(' | ') || '(ninguno)'}. `
    + 'O el fichero ha cambiado de nombre, o los tests ya no se declaran con `test(`.');
  assert.equal(mudos.includes(`${BANCOS[0]} · ${QUE_SI_JUZGA}`), false,
    '🔴 el control positivo sale como mudo: el barrido marca como «no juzga» a uno que sí juzga, '
    + 'así que la lista de mudos de abajo no vale.');

  assert.deepEqual(mudos, [],
    '🔴 hay tests que hacen leer un ticket CON NIF y no dicen nada del proveedor que se engancha:\n   · '
    + mudos.join('\n   · ')
    + '\n  El emparejamiento corre ahí sin juez: el día que enganche al que no es, siguen verdes.');
});
