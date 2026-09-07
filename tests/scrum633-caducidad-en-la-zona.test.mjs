// tests/scrum633-caducidad-en-la-zona.test.mjs — SCRUM-633
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LA CADUCIDAD, EN EL CALENDARIO DEL NEGOCIO — Y LOS CINCO SITIOS A LA VEZ.
//
// El día de caducidad se calculaba con `toISOString().slice(0, 10)`, que da el día en **UTC**.
// Medido sobre 2026 con dos métodos independientes, para un profesional en Madrid:
//
//     09:00 y 12:00 →   0 de 365      01:00 → 210 de 365
//     23:30         →  30 de 365      00:30 → 335 de 365
//
// 🔴 NO ES «EL CAMBIO DE HORA». Quien lea eso buscará dos días al año. Es que UTC y la hora local
// son dos calendarios distintos casi todas las noches. (El 23:30 sí es cambio de hora: los +30
// días son 24 h fijas y en la ventana previa a cada cambio la hora local se desplaza.)
//
// ── 🔴 EL FILO: LOS CINCO FALLABAN EN EL MISMO SENTIDO, ASÍ QUE COINCIDÍAN ───────────────────
//
// Un test de «① da el día correcto» no prueba nada: los cinco podrían haber quedado
// desincronizados y ese test seguiría verde. Lo que hay abajo compara **la cadena entera** —lo que
// el pro VE, lo que se GUARDA, y lo que el cliente LEE— y cae si uno se arregla solo.
//
// ── LOS CINCO, Y EL QUE NO ES ──────────────────────────────────────────────────────────────
//
//   ① `quotesView.js` — el default del formulario          🔧 arreglado
//   ② `quotesView.js` — el `min` del selector              🔧 arreglado
//   ③ `quotesView.js` — lo que se guarda                   ✔ ya era correcto (instante local)
//   ④ landing `:345`  — «Válido hasta el…»                 🔧 arreglado
//   ⑤ landing `:470`  — la página de «caducado»            🔧 arreglado (lo contaba nadie)
//   —  el cron `expire.service.ts`                          ✔ FUERA: compara INSTANTES, y un
//      instante no tiene zona. Y sigue siendo correcto PRECISAMENTE porque ③ guarda el instante
//      bueno: si ③ estuviera mal, el cron caducaría a deshora.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const require_ = createRequire(import.meta.url);

/** La pieza del NAVEGADOR, la de verdad. */
const F = require_(path.join(RAIZ, 'public/dashboard/js/quoteCaducidad.js'));
/** El sitio único del SERVIDOR (SCRUM-643). */
const S = await import('../dist/core/zonaDelMerchant.js');

const MADRID = { timezone: 'Europe/Madrid' };

/** Lo que hacía ① ANTES. Sin esto, «ahora da el día bueno» no se contrasta con nada. */
const COMO_ESTABA = (ahora, dias) => new Date(ahora.getTime() + dias * 86400000).toISOString().slice(0, 10);

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-633 · SUELO: las dos mitades responden, y DISTINGUEN entre zonas', () => {
  for (const k of ['ZONA_POR_DEFECTO', 'zonaValida', 'zonaDelMerchant', 'diaNaturalEn', 'diaPorDefecto']) {
    assert.ok(F[k] !== undefined, `🔴 la pieza del front no exporta \`${k}\``);
  }
  for (const k of ['ZONA_POR_DEFECTO', 'zonaDelMerchant', 'diaNaturalEn', 'finDelDiaEn']) {
    assert.ok(S[k] !== undefined, `🔴 el sitio único no exporta \`${k}\``);
  }
  // Si diera el mismo día en cualquier zona, todo lo de abajo mediría una función muda.
  const instante = new Date('2026-07-14T22:30:00Z'); // 00:30 en Madrid, 22:30 en UTC
  assert.notEqual(F.diaNaturalEn(instante, 'Europe/Madrid'), F.diaNaturalEn(instante, 'UTC'),
    '🔴 la pieza da el mismo día en Madrid y en UTC: no está mirando la zona.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS GEMELAS · por COMPORTAMIENTO, no por texto
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-633 · GEMELAS: navegador y servidor dan el MISMO día natural', () => {
  // 🔴 POR COMPORTAMIENTO Y NO POR TEXTO. Dos redacciones distintas de la misma regla son
  // correctas, y dos idénticas pueden estar las dos mal; un guard de texto habría nacido mudo.
  const ZONAS = ['Europe/Madrid', 'Atlantic/Canary', 'UTC', 'America/Mexico_City', 'Pacific/Auckland', 'Asia/Tokyo'];
  const INSTANTES = [
    '2026-01-14T23:30:00Z', '2026-07-14T22:30:00Z', '2026-07-15T08:00:00Z',
    '2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z',   // el cambio de hora de primavera
    '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z',   // el de otoño
    '2026-12-31T23:30:00Z', '2026-06-30T22:00:00Z',
  ];
  let comparados = 0;
  for (const z of ZONAS) {
    for (const i of INSTANTES) {
      const t = new Date(i);
      assert.equal(F.diaNaturalEn(t, z), S.diaNaturalEn(t, z),
        `🔴 DIVERGEN en ${z} con ${i}: navegador «${F.diaNaturalEn(t, z)}» vs servidor «${S.diaNaturalEn(t, z)}».`);
      comparados++;
    }
  }
  assert.ok(comparados >= 50, `🔴 SUELO: sólo ${comparados} comparaciones; un verde así no dice nada.`);
});

test('SCRUM-633 · GEMELAS: y la regla del NULO es la misma en las dos', () => {
  for (const raro of [null, undefined, {}, { timezone: null }, { timezone: '' }, { timezone: '   ' }, { timezone: 'No/Existe' }]) {
    assert.equal(F.zonaDelMerchant(raro), S.zonaDelMerchant(raro),
      `🔴 con ${JSON.stringify(raro)} las dos mitades resuelven zonas distintas.`);
    assert.equal(F.zonaDelMerchant(raro), 'UTC');
  }
  assert.equal(F.ZONA_POR_DEFECTO, S.ZONA_POR_DEFECTO);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA CADENA · los cinco entre sí
// ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * La cadena entera, ejecutada: ① el día que ve el pro → ③ el instante que se guarda → ④/⑤ el día
 * que lee el cliente.
 *
 * ③ se reproduce como lo hace el navegador (`new Date(dia + "T23:59:59")` en SU zona) y ④/⑤ como
 * lo hace la landing (`toLocaleDateString` con `timeZone` de `zonaDelMerchant`).
 */
function cadena(merchant, ahora, zonaDelNavegador) {
  const zona = S.zonaDelMerchant(merchant);
  const diaQueVeElPro = F.diaPorDefecto(merchant, 30, ahora);
  // ③ · el instante 23:59:59 del día elegido, en la zona del NAVEGADOR
  const guardado = S.finDelDiaEn(diaQueVeElPro, zonaDelNavegador);
  // ④ y ⑤ · lo que se imprime en la landing
  const diaQueLeeElCliente = new Intl.DateTimeFormat('sv-SE', { timeZone: zona }).format(guardado);
  return { zona, diaQueVeElPro, guardado, diaQueLeeElCliente };
}

test('SCRUM-633 · 🔴 EL QUE DECIDE: los cinco dicen el MISMO día, y es el bueno', () => {
  // A las 00:30 es donde los cinco coincidían EN EL DÍA EQUIVOCADO. Ahora coinciden en el bueno.
  for (const [etiqueta, iso, esperado] of [
    ['00:30 verano', '2026-07-14T22:30:00Z', '2026-08-14'],
    ['00:30 invierno', '2026-01-14T23:30:00Z', '2026-02-14'],
    ['01:00 verano', '2026-07-14T23:00:00Z', '2026-08-14'],
  ]) {
    const c = cadena(MADRID, new Date(iso), 'Europe/Madrid');
    assert.equal(c.diaQueVeElPro, esperado,
      `🔴 [${etiqueta}] el pro ve «${c.diaQueVeElPro}» y en su calendario son 30 días desde hoy: ${esperado}.`);
    assert.equal(c.diaQueLeeElCliente, c.diaQueVeElPro,
      `🔴 [${etiqueta}] EL PRO VE «${c.diaQueVeElPro}» Y EL CLIENTE LEE «${c.diaQueLeeElCliente}». Una `
      + 'caducidad en la que el formulario dice un día y el papel del cliente otro es PEOR que la '
      + 'que estaba mal en los cinco a la vez.');
  }
});

test('SCRUM-633 · 🔴 el defecto EXISTÍA: la forma vieja rompe la cadena a las 00:30', () => {
  // Sin esto, el verde de arriba no demuestra que se haya arreglado nada.
  const ahora = new Date('2026-07-14T22:30:00Z');   // 00:30 del 15 de julio en Madrid
  const viejo = COMO_ESTABA(ahora, 30);
  assert.equal(viejo, '2026-08-13',
    '🔴 la forma vieja ya no reproduce el defecto: este test no compara nada.');
  assert.notEqual(viejo, F.diaPorDefecto(MADRID, 30, ahora),
    '🔴 la vieja y la nueva dan lo MISMO: o el arreglo no está, o se está midiendo una hora que ya '
    + 'coincidía — que es la trampa de este ticket.');
});

test('SCRUM-633 · CONTROL NEGATIVO: a las 10:00, donde nunca falló, nada cambia', () => {
  const ahora = new Date('2026-07-15T08:00:00Z');   // 10:00 en Madrid
  assert.equal(F.diaPorDefecto(MADRID, 30, ahora), COMO_ESTABA(ahora, 30),
    '🔴 a las 10:00 el día ha CAMBIADO respecto a lo que se calculaba antes. Este ticket sólo '
    + 'corrige las horas en que UTC y la hora local caen en días distintos.');
  const c = cadena(MADRID, ahora, 'Europe/Madrid');
  assert.equal(c.diaQueLeeElCliente, c.diaQueVeElPro, '🔴 la cadena se ha roto en un caso que ya iba bien');
});

test('SCRUM-633 · CONTROL NEGATIVO: un merchant SIN zona sigue viendo lo de siempre', () => {
  // La decisión A del fundador: `null` → UTC, que es exactamente lo que el sistema hacía antes de
  // existir la columna. ⚠️ COINCIDE con la zona del contenedor, pero NO se deriva de ella: es una
  // constante declarada. Para este merchant el arreglo no cambia NADA, y eso es la decisión
  // funcionando, no un hueco.
  const sinZona = { timezone: null };
  for (const iso of ['2026-07-14T22:30:00Z', '2026-01-14T23:30:00Z', '2026-07-15T08:00:00Z']) {
    const ahora = new Date(iso);
    assert.equal(F.diaPorDefecto(sinZona, 30, ahora), COMO_ESTABA(ahora, 30),
      `🔴 con ${iso} el merchant SIN zona ve un día distinto del de antes. La decisión A dice que no `
      + 'puede ver ningún cambio que no haya pedido.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL HUECO DECLARADO DE ③ · el empleado que viaja
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-633 · 🔴 HUECO DECLARADO: si el navegador NO está en la zona del negocio, ③ desincroniza', () => {
  // ③ construye `23:59:59` con `new Date(dia + "T23:59:59")`, que se interpreta en la zona del
  // DISPOSITIVO. Con el pro en la misma zona que su negocio —el caso normal— es correcto. Con un
  // empleado viajando, el instante guardado cae en el día siguiente del calendario del negocio.
  //
  // El asesor dijo explícitamente que ③ NO SE TOCA en este ticket. Se fija aquí el comportamiento
  // REAL para que sea visible y no derive en silencio: si alguien lo arregla, este test cae y le
  // dice que ya no es un hueco.
  const ahora = new Date('2026-07-14T22:30:00Z');
  const enCasa = cadena(MADRID, ahora, 'Europe/Madrid');
  const viajando = cadena(MADRID, ahora, 'America/Mexico_City');

  assert.equal(enCasa.diaQueLeeElCliente, enCasa.diaQueVeElPro, '🔴 SUELO: el caso normal ya no cuadra');
  // 🔴 SCRUM-750 · ESTE ASERTO HABLA DEL VALOR POR DEFECTO, Y AHORA LO DICE.
  //
  // Hasta el 5-sep-2026 el mensaje decía «① ya depende del dispositivo» a secas. Era cierto de lo
  // que mide —`cadena()` llama a `diaPorDefecto` y a nada más—, pero ① tiene DOS escritores: el
  // valor por defecto y los tres ATAJOS de SCRUM-605, que entonces sí calculaban en la zona del
  // navegador. Un rótulo que abarca más de lo que el aserto mide se lee como cobertura que no
  // existe: no era una afirmación falsa, era un hueco con un cartel demasiado grande.
  //
  // El otro escritor lo cubre `scrum750-los-dos-calendarios`, que barre las dos salidas en
  // procesos arrancados en otra zona y exige que coincidan.
  assert.equal(viajando.diaQueVeElPro, enCasa.diaQueVeElPro,
    '🔴 el VALOR POR DEFECTO de ① ya depende del dispositivo, y no debería: la zona la pone el '
    + 'merchant. (El otro escritor de ①, los atajos, lo mide `scrum750-los-dos-calendarios`.)');
  assert.notEqual(viajando.diaQueLeeElCliente, viajando.diaQueVeElPro,
    '🔴 el hueco de ③ ha DEJADO de existir. Si es que se ha arreglado, bien: quita este test y '
    + 'apúntalo. Lo que no puede es cambiar sin que nadie lo mire.');
  assert.equal(viajando.diaQueLeeElCliente, '2026-08-15',
    '🔴 el desfase del hueco ha cambiado de tamaño.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LOS ESLABONES · que la zona LLEGUE, que es donde se pierde
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-633 · 🔴 los TRES `select` traen la zona — el eslabón que más fácil se pierde', () => {
  const perfil = soloCodigo(leer('src/modules/system/merchantAdmin.ts'));
  assert.ok(perfil.includes('timezone: true'),
    '🔴 `getMerchantProfile` no pide `timezone`. El `select` es explícito: lo que no esté ahí NO '
    + 'SALE, aunque esté en la columna — y el navegador volvería a calcular en UTC. Es la misma '
    + 'advertencia que dejó SCRUM-579 con la dirección de facturación.');

  const app = soloCodigo(leer('src/app.ts'));
  assert.match(app, /brandAccentColor,\s*timezone\s*\}\s*=\s*merchant/,
    '🔴 la lista REDUCIDA del técnico no trae `timezone`. Un técnico crea presupuestos: sin la zona '
    + 'vería una caducidad distinta de la que rige el documento — el mismo defecto, para un rol.');
  assert.match(app, /res\.json\(\{[^)]*timezone[^)]*\}\)/,
    '🔴 la lista del técnico la lee pero no la devuelve.');

  const landing = soloCodigo(leer('src/modules/system/app/routes/quoteDecisionLanding.routes.ts'));
  assert.match(landing, /merchant:\s*\{\s*select:\s*\{[^}]*timezone:\s*true/,
    '🔴 la landing no carga `timezone`: sus DOS impresiones saldrían en la zona del contenedor.');
});

test('SCRUM-633 · las CUATRO impresiones de la landing llevan `timeZone` explícito', () => {
  // 🔴 CUATRO, NO DOS. El encargo contaba dos —«Válido hasta el…» y la página de caducado— y este
  // censo encontró **dos más**: la fecha de ACEPTACIÓN y la de RECHAZO, en la misma página y con el
  // mismo defecto. Entran las cuatro juntas por el mismo motivo por el que los cinco sitios entran
  // juntos: dejar dos fuera imprimiría unas fechas en el calendario del negocio y otras en el de la
  // máquina, dentro de la MISMA página. Eso es peor que tenerlas todas mal a la vez.
  const src = soloCodigo(leer('src/modules/system/app/routes/quoteDecisionLanding.routes.ts'));
  const usos = [...src.matchAll(/toLocaleDateString\s*\(/g)];
  assert.equal(usos.length, 4,
    `🔴 hay ${usos.length} \`toLocaleDateString\` en la landing y se midieron CUATRO. Si aparece una `
    + 'quinta, tiene que pasar por la zona igual — o el cliente leerá dos calendarios en la misma '
    + 'página.');
  const conZona = [...src.matchAll(/timeZone:\s*zonaDelMerchant\(/g)];
  assert.equal(conZona.length, 4,
    `🔴 sólo ${conZona.length} de las 4 impresiones pasan la zona del merchant. Sin \`timeZone\`, `
    + '`toLocaleDateString` usa la del PROCESO — y nadie la fija en el despliegue.');
});

test('SCRUM-633 · el formulario ya no calcula el día en UTC, y en DOS tiempos', () => {
  // ⚠️ ESTE TEST SE VOLVIÓ TAUTOLÓGICO Y SE ARREGLÓ: comprobaba
  // `diaPorDefecto(currentMerchant, 30)` y siguió verde después de sacar esa llamada del
  // formulario — porque la misma cadena aparece dentro de `refrescarCaducidad`. Medía el refresco
  // creyendo que medía el pintado. Ahora se comprueban LOS DOS TIEMPOS por separado.
  const vista = soloCodigo(leer('public/dashboard/js/quotesView.js'));

  // ① al CONSTRUIR: sin `currentMerchant`, que aún no existe (está en la zona muerta de su `let`).
  assert.match(vista, /const diaPintadoPorDefecto = window\.quoteCaducidad\.diaPorDefecto\(null, 30\)/,
    '🔴 el default del formulario no se pinta con la zona por defecto. Leer `currentMerchant` aquí '
    + 'revienta la pantalla entera: se declara 550 líneas más abajo.');
  assert.match(vista, /validInput\.min = window\.quoteCaducidad\.diaPorDefecto\(null, 1\)/,
    '🔴 el `min` del selector no se pinta con la zona por defecto');

  // ② al LLEGAR el merchant: se recalcula con SU zona, y sólo si nadie ha elegido otra fecha.
  const iRefresco = vista.indexOf('function refrescarCaducidad(');
  assert.notEqual(iRefresco, -1,
    '🔴 no existe `refrescarCaducidad`: el formulario se quedaría con la zona por defecto para '
    + 'siempre, o sea con el defecto entero.');
  const cuerpo = vista.slice(iRefresco, iRefresco + 700);
  assert.match(cuerpo, /validInput\.value = window\.quoteCaducidad\.diaPorDefecto\(currentMerchant, 30\)/,
    '🔴 el refresco no recalcula el valor con la zona del merchant');
  assert.match(cuerpo, /validInput\.min = window\.quoteCaducidad\.diaPorDefecto\(currentMerchant, 1\)/,
    '🔴 el refresco no recalcula el `min` con la zona del merchant');
  assert.match(cuerpo, /if \(validInput\.value === diaPintadoPorDefecto\)/,
    '🔴 el refresco pisa el valor SIN comprobar que nadie lo haya cambiado. Pisar una fecha elegida '
    + 'a mano sería cambiar el documento por detrás, que es peor que el desfase de un día.');

  // ③ y que alguien lo LLAME cuando el merchant llega — «mencionar no es hacer».
  assert.match(vista, /__refrescarCaducidadDelPresupuesto\(\)/,
    '🔴 `refrescarCaducidad` existe y nadie la llama: la zona del merchant no llegaría nunca al '
    + 'formulario y el arreglo sería decorativo.');

  assert.equal((vista.match(/toISOString\(\)\.slice\(0, 10\)/g) || []).length, 0,
    '🔴 queda algún `toISOString().slice(0, 10)` en la vista: es exactamente el defecto.');
});

test('SCRUM-633 · el CRON queda fuera, y por escrito: compara INSTANTES', () => {
  const cron = soloCodigo(leer('src/modules/quotes/domain/expire.service.ts'));
  assert.match(cron, /getTime\(\)\s*<\s*Date\.now\(\)/,
    '🔴 el cron ha dejado de comparar instantes. Un instante no tiene zona; un DÍA sí. Si esto pasa '
    + 'a comparar días, entra en «los cinco juntos» y hay que decidir en qué zona.');
  assert.doesNotMatch(cron, /toISOString\(\)\.slice|toLocaleDateString/,
    '🔴 el cron ha empezado a formatear fechas: eso lo mete en este ticket.');
});

test('SCRUM-633 · la pieza se carga ANTES que la vista, y el service worker la cachea', () => {
  const html = leer('public/dashboard/index.html');
  const iPieza = html.indexOf('js/quoteCaducidad.js');
  const iVista = html.indexOf('js/quotesView.js');
  assert.ok(iPieza !== -1, '🔴 `quoteCaducidad.js` no está en el índice: la vista daría error');
  assert.ok(iPieza < iVista, '🔴 la pieza se carga DESPUÉS de la vista');
  assert.match(leer('public/sw.js'), /\/dashboard\/js\/quoteCaducidad\.js/,
    '🔴 el service worker no la cachea');
});
