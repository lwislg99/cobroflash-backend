// tests/scrum409-fixtures-sin-merchant-demo.test.mjs — SCRUM-409 · fixtures fuera del merchant demo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL DEFECTO
//
// El merchant 1 es el DEMO, y el producto se comporta distinto con él: `whatsappPolicy` corta por
// `DEMO_MERCHANT_ID`, el PDF lleva marca de agua, la pasarela se desvía. Un fixture que use ese id
// **desactiva comprobaciones sin tocar el guard**, y el test sigue verde diciendo otra cosa.
//
// Aquí el id del demo solo puede aparecer en los ficheros que PRUEBAN ese comportamiento — y esa
// lista **se deriva**, no se escribe: son los que importan `isDemoMerchant` / `DEMO_MERCHANT_ID` /
// `DEMO_SAFE_NUMBERS`, o los que lo declaran a la vista con la marca de abajo.
//
// ⚠️ POR QUÉ HAY DOS SEÑALES Y NO UNA — lo aprendí rompiendo tres tests.
//
// La primera versión derivaba la lista SOLO de los imports, y `scrum207-conciliacion` no importa
// nada del demo: clasifica documentos con un mapa de merchants y su fila 6 **es el cubo del demo**.
// Al cambiarle el id, el test cayó. La derivación por import es necesaria pero no suficiente, así
// que existe una segunda señal EXPLÍCITA y visible en la propia línea:
//
//     merchantId: 1,  // MERCHANT DEMO A PROPOSITO (SCRUM-409): <por qué>
//
// No es una allowlist muda: va pegada al sitio, dice por qué, y quien la lea ve que es deliberada.
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-509 · EL DETECTOR ESTABA ATADO A LA FORMA, Y COBRÓ PEAJE TRES VECES
//
// Era una expresión regular sobre el TEXTO (`merchantId:\s*1\b`, línea a línea, quitando lo que
// hubiera detrás de `//`). Eso no mide el hecho «este fixture usa el merchant demo»: mide «en esta
// línea hay unos caracteres». Los tres saltos, todos medidos con el guard puesto:
//
//   · `merchantId: 1.5` — el `\b` casa entre `1` y `.`, así que leía el PREFIJO y no el VALOR.
//     Un merchant 1.5 no es el demo, y no existe.
//   · `merchantId: 1` DENTRO DE UNA CADENA — la fuente sintética con la que otro guard se
//     autoprueba. Ahí no hay ningún merchant: hay un texto que habla de uno.
//   · 🔴 Y el que tenía la tanda EN ROJO al empezar este ticket: **un COMENTARIO**. El despojo
//     `linea.replace(/\/\/.*$/, '')` no funciona cuando el fichero tiene finales CRLF —`$` sin
//     flag `m` no casa antes de un `\r`—, así que el comentario entero se analizaba como código.
//     Saltaba sobre la línea de `scrum508` que EXPLICA que este guard salta. Medido, no deducido.
//
// AHORA MIRA EL HECHO, por AST: una PROPIEDAD `merchantId` cuyo VALOR es 1, en el código. Un
// comentario no es una propiedad; una cadena tampoco; y `1.5` no vale 1. Los tres desaparecen sin
// una sola excepción escrita a mano — que es la diferencia entre estrechar y aflojar.
//
// ⚠️ NO se relaja nada: lo que el guard caza sigue siendo lo mismo, y hay un control positivo que
// lo enumera uno a uno (`LOS QUE TIENE QUE SEGUIR CAZANDO`).
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 SCRUM-510 · Y EL MISMO DEFECTO SEGUÍA VIVO EN LA EXENCIÓN, LIBRANDO A 16 FICHEROS
//
// SCRUM-509 ató el DETECTOR al hecho y dejó la EXENCIÓN atada a la forma: un fichero quedaba
// exento si su TEXTO contenía una señal —`texto.includes('isDemoMerchant')`—, **aunque fuese en un
// comentario**. Medido sobre los 538 ficheros de este directorio: **18 exentos por mención contra
// 2 que la usan de verdad**. Dieciséis librados de mirarlos gratis.
//
// Y no era teórico. De esos 16, DOS clavaban el merchant demo:
//
//   scrum290-adicional.test.mjs:79          const REQ = { …, merchantId: 1, … }
//   scrum290-endpoint-convertir.test.mjs:88 const REQ = (id = 1) => ({ …, merchantId: 1, … })
//
// 🔴 Y la exención se la había dado **el propio comentario que explicaba que evitaban el demo**.
// El segundo lo dice con todas las letras: «la primera versión de este fichero tenía ese `id: 1` y
// por eso el caso del justificante salía 201: el dato de prueba tapaba la comprobación, no el
// código». Arreglaron el merchant de la BD (`id: 7`), dejaron el `req` en 1, y el guard los libró
// por haberlo contado. Los dos arreglados en este mismo commit.
//
// AHORA LA EXENCIÓN MIRA EL USO: la señal tiene que aparecer como IDENTIFICADOR en el AST. Un
// comentario no es un identificador; una cadena tampoco. **Cero exenciones escritas a mano**: de
// los 16 que la pierden, 14 no tenían ningún uso del demo —ni se enteran— y los 2 restantes eran
// hallazgos de verdad. Si hubiera hecho falta exentar a mano a los 16, la señal estaría mal
// elegida y eso sería una decisión del asesor, no de este ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const DIR = path.resolve(import.meta.dirname);
const DEMO_ID = 1;
const SENALES_IMPORT = ['isDemoMerchant', 'DEMO_MERCHANT_ID', 'DEMO_SAFE_NUMBERS', 'demoMerchant'];
const MARCA = 'MERCHANT DEMO A PROPOSITO';

// ⚠️ ESTE FICHERO SE EXCLUYE DE SÍ MISMO. Nombra `DEMO_MERCHANT_ID` para poder derivar la lista,
// así que se auto-eximiría — la trampa de auto-referencia de siempre: un guard que se caza (o se
// perdona) a sí mismo en el texto que explica la regla.
const YO = path.basename(new URL(import.meta.url).pathname);
const ficheros = fs.readdirSync(DIR).filter((f) => /\.(mjs|js)$/.test(f) && f !== YO);

/**
 * Ocurrencias del merchant DEMO en un fixture, POR EL HECHO: una propiedad `merchantId` cuyo VALOR
 * es 1, escrita en el código.
 *
 * Devuelve `null` si el fichero no se puede analizar — nunca una lista vacía: «no hay usos» y «no
 * supe leerlo» tienen que salir por líneas distintas, y el SUELO de abajo lo comprueba.
 */
function usosDelDemo(texto, nombre = 'fixture.mjs') {
  let sf;
  try {
    sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  } catch {
    return null;
  }
  const lineas = texto.split('\n');
  const out = [];
  (function rec(n) {
    if (ts.isPropertyAssignment(n)) {
      // La clave, tanto `merchantId:` como `'merchantId':`.
      const clave = (ts.isIdentifier(n.name) || ts.isStringLiteralLike(n.name)) ? n.name.text : null;
      // 🔴 EL VALOR, no el prefijo: `1.5` no vale 1, y `1.0` sí — porque ése SÍ es el demo.
      if (clave === 'merchantId' && ts.isNumericLiteral(n.initializer)
        && Number(n.initializer.text) === DEMO_ID) {
        const i = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
        out.push({ linea: i + 1, texto: (lineas[i] ?? '').trim(), marcada: (lineas[i] ?? '').includes(MARCA) });
      }
    }
    ts.forEachChild(n, rec);
  })(sf);
  return out;
}

/**
 * ¿Este fichero USA el mecanismo del demo? — SCRUM-510.
 *
 * El HECHO es que la señal aparezca como IDENTIFICADOR en el código: importada, llamada o leída.
 * Un comentario que la nombre no es usarla, y una cadena tampoco. Devuelve `null` si el fichero no
 * se puede analizar, para que el suelo lo separe de «no la usa».
 */
function usaElMecanismoDelDemo(texto, nombre) {
  let sf;
  try {
    sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  } catch {
    return null;
  }
  let usa = false;
  (function rec(n) {
    if (usa) return;
    if (ts.isIdentifier(n) && SENALES_IMPORT.includes(n.text)) { usa = true; return; }
    ts.forEachChild(n, rec);
  })(sf);
  return usa;
}

const analisis = ficheros.map((f) => {
  const texto = fs.readFileSync(path.join(DIR, f), 'utf8');
  return {
    fichero: f,
    usos: usosDelDemo(texto, f),
    // La lista de «prueba el demo» es DERIVADA, y desde SCRUM-510 sale del USO real —no de que el
    // nombre aparezca escrito—, que es el mismo criterio que ya aplica el detector de arriba.
    pruebaElDemo: usaElMecanismoDelDemo(texto, f),
    // Se conserva para el censo: cuántos quedaban exentos con el criterio VIEJO.
    loMenciona: SENALES_IMPORT.some((s) => texto.includes(s)),
  };
});
const ilegibles = analisis
  .filter((a) => a.usos === null || a.pruebaElDemo === null)
  .map((a) => a.fichero);

// ── SUELO ────────────────────────────────────────────────────────────────────────────────────

test('SCRUM-409 · SUELO: hay ficheros de test que auditar', () => {
  assert.ok(ficheros.length >= 100,
    `🔴 solo se han encontrado ${ficheros.length} ficheros de test. «Ningún fixture con el demo» y ` +
    '«no supe mirar» dan la misma bandeja: si el detector no lee el directorio, no mide nada.');
});

test('SCRUM-409 · SUELO: todos los ficheros se pueden ANALIZAR, o el guard se declara ciego', () => {
  // 🔴 El detector nuevo lee un AST. Un fichero que no parsee devolvería «cero usos», que es
  // indistinguible de «este fichero está limpio» — y así es como un guard deja de vigilar sin que
  // nadie se entere. Se separan por líneas distintas a propósito.
  assert.deepEqual(ilegibles, [],
    `🔴 HAY FICHEROS QUE EL DETECTOR NO SABE LEER:\n   ${ilegibles.join('\n   ')}\n\n` +
    '  No están limpios: están SIN MIRAR. Arregla el analizador antes de creerte el verde.');
});

test('SCRUM-409 · SUELO + AUTOPRUEBA: el detector ve el HECHO y DISCRIMINA los tres falsos positivos', () => {
  // 🔴 Primero se demuestra que sabe ver; después que sabe NO ver. Sin la primera mitad, «cero
  // usos» podría significar que el reconocedor está roto.
  const usos = usosDelDemo('const x = { merchantId: 1, nombre: "x" };');
  assert.equal(usos.length, 1, '🔴 el detector no ve un `merchantId: 1` evidente.');
  assert.equal(usos[0].marcada, false);
  assert.equal(usosDelDemo("const x = { 'merchantId': 1 };").length, 1,
    '🔴 el detector se escapa si la clave va entre comillas.');
  assert.equal(usosDelDemo('const x = { merchantId: 1.0 };').length, 1,
    '🔴 `1.0` SÍ es el merchant demo: el detector tiene que mirar el valor, no cómo está escrito.');

  // ── LOS TRES QUE COBRABAN PEAJE, medidos en el PASO 0 de SCRUM-509 ──────────────────────
  assert.deepEqual(usosDelDemo('const x = { merchantId: 1.5, nota: "no es el demo" };'), [],
    '🔴 EL PREFIJO OTRA VEZ: `1.5` no vale 1, y el merchant 1.5 no existe. Un detector que lee los ' +
    'primeros caracteres de un número no mide el hecho, mide la forma.');
  assert.deepEqual(usosDelDemo('const fuente = "const x = { merchantId: 1 };";'), [],
    '🔴 FUENTE SINTÉTICA: dentro de una cadena no hay ningún merchant, hay un texto que habla de ' +
    'uno. Es lo que usan otros guards para autoprobarse, y este los castigaba por ello.');
  assert.deepEqual(usosDelDemo('  // el guard lee un `merchantId: 1` y salta.\r\n'), [],
    '🔴 UN COMENTARIO, y encima con final CRLF — que es el caso REAL que tenía la tanda en rojo: el ' +
    'despojo por regex no funcionaba con `\\r` y el comentario se analizaba como código.');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────────

test('SCRUM-510 · SUELO + AUTOPRUEBA: la exención mira el USO, y DISCRIMINA la mención', () => {
  // 🔴 Primero se demuestra que sabe ver el uso; después que sabe NO ver la mención. Sin la
  // primera mitad, «cero exentos» podría significar que el reconocedor está roto.
  assert.equal(usaElMecanismoDelDemo("import { isDemoMerchant } from '../dist/x.js';", 'a.mjs'), true,
    '🔴 la exención no reconoce una importación de la señal: dejaría sin exención a quien SÍ prueba el demo.');
  assert.equal(usaElMecanismoDelDemo('if (isDemoMerchant(m)) return;', 'a.mjs'), true,
    '🔴 no reconoce una llamada a la señal.');
  assert.equal(usaElMecanismoDelDemo('const x = DEMO_MERCHANT_ID;', 'a.mjs'), true,
    '🔴 no reconoce la lectura de la constante.');

  // ── Y LO QUE YA NO EXIME, que es el ticket ──────────────────────────────────────────────
  assert.equal(usaElMecanismoDelDemo('// ojo: `isDemoMerchant` es id === 1, aquí usamos otro\n', 'a.mjs'), false,
    '🔴 UN COMENTARIO SIGUE EXIMIENDO. Es el defecto entero: el fichero queda libre de mirarse por ' +
    'haber nombrado la señal, y encima suele ser el comentario que explica que EVITA el demo.');
  assert.equal(usaElMecanismoDelDemo('const t = "isDemoMerchant";', 'a.mjs'), false,
    '🔴 una cadena con el nombre dentro sigue eximiendo: mencionar no es usar.');
  assert.equal(usaElMecanismoDelDemo('const otro = 1;', 'a.mjs'), false);
});

test('SCRUM-510 · 🔴 EL CENSO CUADRA, y dice cuántos eximía de más el criterio viejo', (t) => {
  const total = analisis.length;
  const porUso = analisis.filter((a) => a.pruebaElDemo);
  const porMencion = analisis.filter((a) => a.loMenciona);
  const deMas = porMencion.filter((a) => !a.pruebaElDemo);
  t.diagnostic(`total ${total} · exentos por USO ${porUso.length} · lo mencionan ${porMencion.length} · ` +
    `eximía de más ${deMas.length}`);

  // 🔴 SUELO: si el censo de exentos devuelve cero, el guard vigila un caso que no existe y su
  // verde no significa nada. Cero y «no supe mirar» por líneas distintas.
  assert.ok(porUso.length > 0,
    '🔴 NINGÚN fichero usa el mecanismo del demo. O el reconocedor está ciego, o ya nadie prueba ' +
    'ese comportamiento — y entonces esta exención sobra. Compruébalo antes de creerlo.');

  // 🔴 LAS CATEGORÍAS SUMAN SU TOTAL. Un censo cuyas partes no suman no es un censo.
  assert.equal(porUso.length + analisis.filter((a) => !a.pruebaElDemo).length, total,
    '🔴 exentos + no exentos ≠ total: el censo se está dejando ficheros por el camino.');
  assert.equal(porMencion.length, porUso.length + deMas.length,
    '🔴 los que mencionan no son los que usan más los que eximía de más: las categorías no cierran.');

  // Usar implica mencionar. Si esto se rompe, uno de los dos instrumentos miente.
  const usanSinMencionar = porUso.filter((a) => !a.loMenciona).map((a) => a.fichero);
  assert.deepEqual(usanSinMencionar, [],
    `🔴 HAY FICHEROS QUE USAN LA SEÑAL SIN MENCIONARLA: ${usanSinMencionar.join(', ')}. Es ` +
    'imposible por construcción, así que uno de los dos instrumentos está midiendo mal.');
});

test('SCRUM-409 · 🔴 CONTROL POSITIVO: sigue cazando TODO lo que cazaba, uno a uno', () => {
  // 🔴 EL TEST QUE DECIDE SI SCRUM-509 ES UN ARREGLO O UN APAGÓN. «Ya no da falsos positivos» y
  // «ya no vigila» son el mismo verde, así que aquí se enumera lo que el guard existe para cazar y
  // se comprueba que CADA UNO sigue cayendo con el detector nuevo puesto.
  //
  // El defecto: un fixture que asigna el merchant 1 desactiva comprobaciones sin tocar ningún
  // guard —`whatsappPolicy` corta por su id, el PDF lleva marca de agua, la pasarela se desvía— y
  // el test sigue verde midiendo otra cosa. Estas son las formas en que eso se escribe.
  const DEBE_CAZAR = [
    ['objeto literal, la forma normal', 'const f = { merchantId: 1, name: "x" };'],
    ['clave entrecomillada', "const f = { 'merchantId': 1 };"],
    ['escrito como decimal exacto', 'const f = { merchantId: 1.0 };'],
    ['anidado dentro de otro objeto', 'const f = { where: { merchantId: 1 } };'],
    ['dentro de un array de fixtures', 'const f = [{ merchantId: 1 }, { merchantId: 7 }];'],
    ['en el argumento de una llamada', 'crearCobro({ merchantId: 1, total: "10.00" });'],
    ['dentro de una función de fábrica', 'const mk = () => ({ merchantId: 1 });'],
    ['en una respuesta simulada', 'red({ json: async () => ({ merchantId: 1 }) });'],
  ];
  const ciegos = DEBE_CAZAR.filter(([, fuente]) => (usosDelDemo(fuente) ?? []).length === 0)
    .map(([que]) => que);
  assert.deepEqual(ciegos, [],
    `🔴 EL GUARD HA DEJADO DE CAZAR ESTAS FORMAS: ${ciegos.join(' · ')}.\n\n` +
    '  Eso NO es haber quitado un falso positivo: es haber apagado el guard por la puerta de atrás.\n' +
    '  Un fixture con el merchant demo desactiva comprobaciones sin tocar nada, y el test se queda\n' +
    '  verde midiendo otra cosa. Si hace falta perder alguna de estas formas, es decisión del\n' +
    '  asesor y va con su motivo escrito — no un efecto colateral de estrechar el detector.');

  // Y el SUELO del propio control positivo: la lista no puede vaciarse para ponerlo verde.
  assert.ok(DEBE_CAZAR.length >= 8,
    `🔴 la lista de lo que hay que cazar tiene ${DEBE_CAZAR.length} casos. Vaciarla haría este ` +
    'control trivialmente cierto, que es la forma barata de aflojar un guard sin que se note.');
});

test('SCRUM-409 · ningún fixture usa el merchant DEMO salvo donde se prueba el demo', () => {
  const infractores = [];
  for (const a of analisis) {
    if (a.pruebaElDemo) continue;               // derivado: importa el mecanismo del demo
    for (const u of a.usos) {
      if (u.marcada) continue;                  // declarado a la vista, con su motivo
      infractores.push(`${a.fichero}:${u.linea}  ${u.texto.slice(0, 70)}`);
    }
  }

  assert.deepEqual(infractores, [],
    `🔴 FIXTURES CON EL MERCHANT DEMO (id ${DEMO_ID}):\n   ${infractores.join('\n   ')}\n\n` +
    '  El demo NO se comporta como un merchant normal: la política de WhatsApp corta por su id, el\n' +
    '  PDF lleva marca de agua y la pasarela se desvía. Un fixture ahí DESACTIVA comprobaciones sin\n' +
    '  tocar ningún guard, y el test sigue verde midiendo otra cosa.\n\n' +
    '  Usa un id inventado (7, 71…). Si de verdad estás probando el comportamiento DEMO, o importas\n' +
    `  su mecanismo, o marcas la línea: \`// ${MARCA} (SCRUM-409): <por qué>\`.`);
});

test('SCRUM-409 · la lista de exentos es DERIVADA, y hoy tiene a quien eximir', (t) => {
  const derivados = analisis.filter((a) => a.pruebaElDemo && a.usos.length > 0).map((a) => a.fichero);
  const marcados = analisis.filter((a) => !a.pruebaElDemo && a.usos.some((u) => u.marcada)).map((a) => a.fichero);
  t.diagnostic(`exentos por import: ${derivados.join(', ') || '—'} · por marca explícita: ${marcados.join(', ') || '—'}`);

  assert.ok(derivados.length + marcados.length > 0,
    '🔴 no hay NINGÚN fichero exento. Si de verdad ya nadie prueba el comportamiento demo, este ' +
    'guard vigila un caso que no existe — y entonces su verde no significa nada. Compruébalo antes ' +
    'de creerlo.');
});
