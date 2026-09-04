// tests/scrum622-desconocido-no-es-verde.test.mjs — SCRUM-622
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// «NO LO SÉ» NO SE PINTA DE VERDE
//
// El encargo señalaba `|| SEMAFORO_META.verde` (en `invoicesView.js`) y pedía medir PRIMERO si
// se alcanza. Se midió, y la respuesta tiene dos mitades que conviene no mezclar:
//
//   · **Ése NO se alcanza hoy.** Cuatro caminos comprobados y cerrados (ver más abajo). Por eso
//     NO se toca: taparlo bien exige un rótulo para «no lo sé», que es microcopy y posiblemente
//     un estado — decisión del fundador, no mía.
//   · **El censo destapó otro de la misma forma que SÍ tenía la barrera floja:** el color del
//     toast (`api.js`), donde `colors[kind] || colors.ok` pintaba de VERDE cualquier `kind` que
//     no fuese `ok|warn|error`. Ahí bastaba un `'Error'` con mayúscula para que un fallo se
//     viese como un éxito, y **ya había condicionado código**: `productsView.js` renunció a
//     `'info'` por esto y lo dejó escrito. Ése SÍ se arregla.
//
// ⚠️ Y una corrección, porque el camino corto casi me hace firmar un hallazgo falso: al ejecutar
// la expresión del color AISLADA concluí que `homeView.js:1281` —`showToast(msg, true)`— pintaba
// un fallo de WhatsApp en verde. **Es falso:** `api.js` normaliza `true → 'warn'` DOS LÍNEAS
// ANTES del `||`. Medir un trozo fuera de su camino da un resultado que parece un hallazgo. Por
// eso los tests de abajo llaman a la función ENTERA, no a su interior.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { redesBenignas } from './_censo-redes-benignas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// `api.js` es un script clásico: se evalúa con un `window` de mentira, igual que
// `quoteAtajosVencimiento.js` en SCRUM-605. No se toca el banco de vistas.
const front = {};
new Function('window', leer('public/dashboard/js/api.js'))(front);

const VERDE_DE_EXITO = 'var(--brand, #16a34a)';
const AMBAR = '#b45309';
const ROJO = '#b91c1c';

// ─────────────────────────────────────────────────────────────────────────────────────────
// SUELO
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-622 · SUELO: `api.js` carga y publica la decisión del color', () => {
  assert.equal(typeof front.colorDeToast, 'function',
    '🔴 CIEGO: `api.js` no ha publicado `colorDeToast`. Sin eso, todo lo de abajo mide un `window` vacío.');
  assert.equal(front.colorDeToast('ok'), VERDE_DE_EXITO,
    '🔴 el verde de éxito ha cambiado de valor: las comparaciones de abajo dejarían de significar nada.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 EL ANTES Y EL DESPUÉS, sobre los mismos `kind`
// ─────────────────────────────────────────────────────────────────────────────────────────

/** La red VIEJA, tal cual estaba, para poder comparar contra ella. */
function comoAntes(kind) {
  const colors = { ok: VERDE_DE_EXITO, warn: AMBAR, error: ROJO };
  if (kind === true) kind = 'warn';
  return colors[kind] || colors.ok;
}

const DESCONOCIDOS = ['exito', 'success', 'info', 'Error', 'ERROR', 'ko', '', 'aviso', null, 0, false, 42];

test('SCRUM-622 · 🔴 ANTES: un `kind` que el código NO reconoce se pintaba de VERDE', () => {
  for (const k of DESCONOCIDOS) {
    assert.equal(comoAntes(k), VERDE_DE_EXITO,
      `🔴 mi reproducción del comportamiento viejo ya no da verde para ${JSON.stringify(k)}: entonces `
      + 'no estoy comparando contra lo que había y el «después» de abajo no prueba nada.');
  }
});

test('SCRUM-622 · 🔴 DESPUÉS: el mismo `kind` desconocido YA NO se pinta de verde', () => {
  for (const k of DESCONOCIDOS) {
    const c = front.colorDeToast(k);
    assert.notEqual(c, VERDE_DE_EXITO,
      `🔴 ${JSON.stringify(k)} sigue saliendo con el VERDE DE ÉXITO. Decirle al profesional que todo `
      + 'ha ido bien cuando el código no sabe qué ha pasado es la equivocación CARA: no cuesta lo '
      + 'mismo que decirle que mire.');
    assert.equal(c, AMBAR,
      `🔴 ${JSON.stringify(k)} sale ${c} y debería ser ámbar. Ni verde (mentiría diciendo que todo va `
      + 'bien) ni rojo (mentiría diciendo que ha fallado): un `kind` desconocido no afirma ninguna '
      + 'de las dos cosas.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// ✅ EL CONTROL NEGATIVO, QUE ES EL QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-622 · ✅ lo que HOY sale verde con razón sigue saliendo verde, y lo demás igual', () => {
  // Si esto cambia, se ha movido el criterio en vez de tapar el hueco.
  const CONOCIDOS = ['ok', 'warn', 'error', true];
  for (const k of CONOCIDOS) {
    assert.equal(front.colorDeToast(k), comoAntes(k),
      `🔴 \`${JSON.stringify(k)}\` ya no da el color de siempre. El arreglo tenía que ser INVISIBLE `
      + 'para las llamadas que hoy aciertan.');
  }
  // Y el valor por defecto de la firma, que es el caso más transitado: 36 llamadas sin 2.º
  // argumento (medido por AST). Tienen que seguir en verde.
  assert.equal(front.colorDeToast('ok'), VERDE_DE_EXITO,
    '🔴 el default de `showToast(msg, kind = "ok")` ha dejado de ser verde: eso son 36 avisos de '
    + '«hecho» que pasarían a ámbar sin que nadie lo haya decidido.');
});

test('SCRUM-622 · ✅ la compatibilidad de `showToast(msg, true)` NO se ha tocado', () => {
  // `homeView.js:1281` la usa. Es la línea que casi doy por defectuosa midiendo fuera de camino.
  assert.equal(front.colorDeToast(true), AMBAR,
    '🔴 `true` ya no se normaliza a `warn`: esa compatibilidad estaba escrita y tiene un llamador vivo.');
  const home = leer('public/dashboard/js/homeView.js');
  assert.equal(home.split('showToast(sendResult.message || `${qCap} creado. Envío WhatsApp pendiente.`, true);').length - 1, 1,
    'CARACTERIZACIÓN: el llamador con `true` sigue ahí. Si desaparece, la rama de compatibilidad de '
    + '`colorDeToast` se queda sin usuarios y se puede retirar — con su decisión escrita, no de paso.');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// EL CENSO · ¿cuántas redes de éstas quedan?
// ─────────────────────────────────────────────────────────────────────────────────────────
const FUERA = new Set(['node_modules', 'dist', '.git', 'coverage', 'tests', '.claude', '.agents']);

function censarArbol() {
  const encontradas = [];
  let ficheros = 0;
  (function anda(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (FUERA.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { anda(p); continue; }
      if (!['.js', '.ts', '.mjs'].includes(path.extname(e.name)) || e.name.includes('.min.')) continue;
      ficheros++;
      for (const h of redesBenignas(fs.readFileSync(p, 'utf8'), e.name)) {
        // 🔴 SCRUM-710 · LA IDENTIDAD Y LA POSICIÓN, SEPARADAS.
        //
        // Aquí se componía `fichero:LÍNEA  texto` y esa cadena se comparaba entera contra la
        // excepción. Un número de línea es una POSICIÓN: doce líneas añadidas por encima en
        // SCRUM-599 desplazaron esta red de la 520 a la 532 y el guard cayó SIN QUE CAMBIARA
        // NADA DE LO QUE VIGILA. Se re-ancló a mano y el defecto de forma seguía ahí.
        //
        // `id` es lo que la red ES —el fichero y la expresión— y es con lo que se compara.
        // `linea` es dónde está HOY y sólo se enseña, para poder ir a mirarla.
        const ruta = path.relative(RAIZ, p).split(path.sep).join('/');
        encontradas.push({ id: `${ruta}  ${h.texto}`, ruta, linea: h.linea, texto: h.texto });
      }
    }
  })(RAIZ);
  return { ficheros, encontradas };
}

test('SCRUM-622 · 🔴 EL CENSO: queda UNA red benigna, y es la que espera decisión', () => {
  const { ficheros, encontradas } = censarArbol();
  assert.ok(ficheros > 300,
    `🔴 CIEGO: solo he barrido ${ficheros} ficheros. Un barrido que no encuentra árbol devuelve un `
    + 'cero que se lee como «no hay ninguna».');
  // 🔴 SE COMPARA POR IDENTIDAD, NO POR POSICIÓN (SCRUM-710). La línea va en el MENSAJE —para
  // poder ir a mirarla— pero NO en la comparación: editar el fichero por encima no puede tumbar
  // un guard que vigila otra cosa. Lo que se exige NO se relaja: sigue siendo la lista EXACTA, y
  // una red duplicada da dos entradas iguales y también cae.
  const dondeEstanHoy = encontradas.map((h) => `${h.ruta}:${h.linea}`).join(' · ') || '(ninguna)';
  // ── 🔴 SCRUM-748 (4-sep-2026) · LA ENTRADA SE BORRA, Y AQUÍ VA SU DECISIÓN ────────────────
  //
  // Este censo declaraba UNA red benigna —`SEMAFORO_META[grupo.semaforo] || SEMAFORO_META.verde`
  // en `invoicesView.js`— y dejaba escrito qué hacer si bajaba a cero: **borrar la entrada CON su
  // decisión, no relajar el test**. Eso es lo que ha pasado, y ésta es la decisión.
  //
  // SE ARREGLÓ. `metaDelSemaforo` sustituye al `||`: un estado que no esté en el mapa ya no se
  // disfraza del más inocente, se pinta con marcador y con su código a la vista. Medido antes:
  // `sin_datos`, un estado nuevo, `''`, `undefined` y `null` pintaban los CINCO «AL DÍA».
  //
  // ⚠️ LO QUE 622 DEJÓ ABIERTO ERA EL RÓTULO, y sigue abierto: el texto de «no lo sé» es
  // microcopy sin firmar, así que va con `[PENDIENTE microcopy oficial]` y `invoicesView.js`
  // ENTRA en el censo de SCRUM-402 con 1. El CUARTO ESTADO tampoco se ha construido — es del
  // fundador (regla 27). Lo que este ticket cierra es la MENTIRA, no la decisión de producto.
  //
  // La lista queda VACÍA a propósito, y eso es lo correcto: `redesBenignas` sigue barriendo el
  // árbol entero, así que una red nueva en cualquier fichero cae aquí con nombre. Una lista vacía
  // es la única creíble — una que nace poblada enseña a poblarla (SCRUM-211).
  assert.deepEqual(encontradas.map((h) => h.id), [],
    '🔴 EL CENSO NO CUADRA. Ha SUBIDO: alguien ha escrito una red que convierte «no lo sé» en '
    + '«todo bien». La de `invoicesView.js` se retiró en SCRUM-748 y la lista quedó vacía; si '
    + 'vuelve a haber una, es nueva y hay que mirarla, no añadirla aquí.'
    + `\n  Dónde están hoy: ${dondeEstanHoy}.`);
});

test('SCRUM-622 · CONTROL del detector: ve las cuatro formas y no se cuela con las que no lo son', () => {
  // Sin esto, un detector que devolviera siempre `[]` pasaría el censo de arriba.
  const n = (s, f = 'x.js') => redesBenignas(s, f).length;
  assert.equal(n('const m = T[k] || META.verde;'), 1, '🔴 no ve `|| META.verde`');
  assert.equal(n("const s = x ?? 'verde';"), 1, '🔴 no ve `?? "verde"`');
  assert.equal(n("const s = c ? a : 'verde';"), 1, '🔴 no ve la rama por defecto de un ternario');
  assert.equal(n("switch(x){default: return 'verde';}"), 1, '🔴 no ve `default: return "verde"`');
  assert.equal(n("const m = T[k] || META['verde'];"), 1, '🔴 no ve la forma con corchetes');
  assert.equal(n('const m = T[k] || colors.ok;'), 1, '🔴 no ve `ok` como benigno');
  // Y los que NO son la trampa:
  assert.equal(n('// const m = T[k] || META.verde;\nconst z = 1;'), 0,
    '🔴 cuenta un COMENTARIO: es justo el caso que obliga a usar AST — `tipoDestinatarioPendiente.js` '
    + 'lleva ese literal en una nota.');
  assert.equal(n('const m = T[k] || META.rojo;'), 0, '🔴 cuenta una red al estado CARO, que no es el defecto');
  assert.equal(n('const m = T[k] || null;'), 0, '🔴 cuenta una red a `null`, que no afirma nada');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ EL DEL SEMÁFORO NO SE TOCA: HOY NO SE ALCANZA — y aquí están las cuatro razones,
// cada una atada, para que el día que deje de ser verdad este fichero lo diga.
// ─────────────────────────────────────────────────────────────────────────────────────────
test('SCRUM-622 · ① el productor del semáforo es un union CERRADO de tres', () => {
  const src = leer('src/modules/jobs/domain/pendientesFacturar.service.ts');
  const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let miembros = null;
  (function rec(n) {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'Semaforo' && ts.isUnionTypeNode(n.type)) {
      miembros = n.type.types.map((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteralLike(t.literal) ? t.literal.text : '?'));
    }
    ts.forEachChild(n, rec);
  })(sf);
  assert.deepEqual(miembros, ['verde', 'ambar', 'rojo'],
    '🔴 el tipo `Semaforo` ha cambiado. Si ahora admite un cuarto valor —o cualquiera—, el '
    + '`|| SEMAFORO_META.verde` de `invoicesView.js` PASA A SER ALCANZABLE y hay que arreglarlo '
    + 'antes de seguir: sin eso, el estado nuevo se le pinta al profesional como «AL DÍA».');
});

test('SCRUM-622 · ② `calcularSemaforo` no devuelve nada fuera de esos tres', async () => {
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // 🔴 ESTE TEST CAYÓ EN CI, Y TENÍA RAZÓN. Lo que cazó no era un semáforo roto: era que
  // SCRUM-643 le cambió la FIRMA a `calcularSemaforo` —el límite pasó de ser un `Date` a ser un
  // DÍA `YYYY-MM-DD`, más la zona del merchant— y este barrido se quedó pasándole `Date`s.
  //
  // Y la consecuencia es exactamente lo que este fichero vigila: la función no supo leer la
  // entrada y devolvió **`'verde'` las 801 veces**. Un llamador que no se actualiza a una firma
  // nueva es, resulta, la forma REAL en que se alcanza el «no lo sé pintado de al día».
  //
  // Se comprobó cuál de los dos mundos era ANTES de tocar nada, llamando a la función
  // directamente con casos que en `main` daban rojo y ámbar: los cinco siguen dando lo mismo.
  // La función está bien; las fixtures estaban viejas. **Se arreglan las fixtures para que
  // vuelvan a alcanzar los tres estados — NO se relaja la aserción**, que es lo que convertiría
  // un trinquete en decoración.
  // ─────────────────────────────────────────────────────────────────────────────────────────
  const { calcularSemaforo } = await import('../dist/modules/jobs/domain/pendientesFacturar.service.js');
  const { diaNaturalEn } = await import('../dist/core/zonaDelMerchant.js');
  const MADRID = 'Europe/Madrid';
  const vistos = new Set();
  const hoy = new Date(Date.UTC(2026, 6, 10, 10, 0)); // 12:00 en Madrid
  for (let d = -400; d <= 400; d += 1) {
    const limite = diaNaturalEn(new Date(hoy.getTime() + d * 86_400_000), MADRID);
    vistos.add(calcularSemaforo(limite, hoy, MADRID));
  }
  // Incluida la fecha ILEGIBLE, que es el borde que más se parece a un «no lo sé».
  vistos.add(calcularSemaforo('no es una fecha', hoy, MADRID));
  assert.deepEqual([...vistos].sort(), ['ambar', 'rojo', 'verde'],
    `🔴 \`calcularSemaforo\` ha devuelto algo fuera de los tres: ${JSON.stringify([...vistos])}. Eso `
    + 'hace alcanzable el `||` de la vista.');
  // Y el SUELO del propio barrido, dicho aparte: 801 días alrededor de hoy tienen que alcanzar
  // LOS TRES estados. La aserción de arriba compara el conjunto ordenado, así que ya caería si
  // faltara alguno — pero deja el motivo en un `deepEqual` que se lee como «devolvió algo raro»,
  // y lo que pasó fue justo lo contrario: dejó de alcanzar. Contarlo lo dice con su nombre.
  assert.equal(vistos.size, 3,
    `🔴 el barrido sólo alcanza ${vistos.size} estado(s): ha dejado de cubrir los tres y ya no `
    + 'prueba lo que dice su nombre.');
});

test('SCRUM-622 · 🔴 la LECCIÓN del rojo anterior: una entrada que no se sabe leer da VERDE', () => {
  // No es teoría: acaba de pasar en este mismo fichero. Se deja fijado porque es la evidencia de
  // que el «no lo sé → al día» se alcanza por la puerta más corriente que hay —un llamador con
  // la firma vieja—, y no sólo por una fecha corrupta en la base.
  //
  // NO se arregla aquí: no hay un cuarto estado y elegir uno de los tres es decisión del
  // fundador (reglas 27 y 30). Es SCRUM-648.
  return import('../dist/modules/jobs/domain/pendientesFacturar.service.js').then(({ calcularSemaforo }) => {
    const hoy = new Date(Date.UTC(2026, 6, 10, 10, 0));
    const MADRID = 'Europe/Madrid';
    // Lo que hacía el barrido viejo: pasar un `Date` donde ahora se espera `YYYY-MM-DD`.
    assert.equal(calcularSemaforo(new Date(Date.UTC(2026, 6, 9)), hoy, MADRID), 'verde',
      'CARACTERIZACIÓN: un `Date` donde se espera un día se lee como ilegible y sale VERDE — '
      + 'aunque ese día esté VENCIDO. Si esto cambia, alguien ha decidido qué se pinta cuando no '
      + 'se sabe: bien, pero que conste con su decisión.');
    // Y el contraste que lo hace significativo: el MISMO día, como cadena, sale rojo.
    assert.equal(calcularSemaforo('2026-07-09', hoy, MADRID), 'rojo',
      '🔴 el mismo día en el formato correcto debería salir rojo: si no, el problema no es de formato');
  });
});

test('SCRUM-622 · ③ el service worker NO cachea `/admin/`: no puede servir una respuesta vieja', () => {
  const sw = leer('public/sw.js');
  assert.equal(sw.split("if (url.pathname.startsWith('/admin/')").length - 1, 1,
    '🔴 ha cambiado la rama que deja `/admin/` fuera del caché. Si el SW empieza a cachear esa ruta, '
    + 'una respuesta guardada por una versión ANTERIOR podría llegar sin `semaforo` — y entonces el '
    + '`||` se alcanza y pinta «AL DÍA».');
});

test('SCRUM-622 · ④ el `fetch` de la bandeja LANZA si la respuesta no es buena', () => {
  const vista = leer('public/dashboard/js/invoicesView.js');
  assert.equal(vista.split("if (!res.ok) throw new Error('Error cargando pendientes de facturar');").length - 1, 1,
    '🔴 `fetchPendientesFacturar` ya no lanza ante una respuesta mala. Si pasa a devolver algo por '
    + 'defecto, ese algo puede traer grupos sin `semaforo` y el `||` se alcanza.');
  // 🔴 SCRUM-748 · LA CARACTERIZACIÓN SE INVIERTE, Y ÉSTA ES SU DECISIÓN.
  //
  // Aquí se exigía que el `|| SEMAFORO_META.verde` SIGUIERA AHÍ, y se decía por qué: «no se toca
  // porque hoy no se alcanza y porque taparlo exige un rótulo para "no lo sé" — microcopy, y
  // posiblemente un estado, que decide el fundador. Si esto falla es que alguien lo cambió: bien,
  // pero QUE CONSTE CON SU DECISIÓN».
  //
  // Consta. El fundador lo encargó (SCRUM-748) y la parte que le tocaba decidir sigue siendo suya:
  // el rótulo va con `[PENDIENTE microcopy oficial]` hasta que lo firme, y el cuarto estado NO se
  // ha construido (regla 27). Lo que se ha cerrado es la MENTIRA, no la decisión de producto.
  //
  // Ahora se exige lo contrario. 🔴 Y SE MIRA EL CÓDIGO, NO EL TEXTO: el comentario que explica
  // el arreglo CITA la expresión retirada —tiene que citarla para explicarse—, así que un
  // `split` sobre el fuente se caza a sí mismo. Es la trampa de auto-referencia de SCRUM-203, y
  // me mordió al escribir esto. Por AST los comentarios no son nodos, así que la inmunidad es
  // estructural y no una excepción escrita a mano.
  const sf = ts.createSourceFile('v.js', vista, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let redes = 0;
  let usaElDecisor = 0;
  const v = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken
        && ts.isElementAccessExpression(n.left)
        && n.left.expression.getText(sf) === 'SEMAFORO_META'
        && ts.isPropertyAccessExpression(n.right)
        && n.right.expression.getText(sf) === 'SEMAFORO_META') redes += 1;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)
        && n.expression.text === 'metaDelSemaforo') usaElDecisor += 1;
    ts.forEachChild(n, v);
  };
  v(sf);

  assert.equal(redes, 0,
    '🔴 HA VUELTO el `|| SEMAFORO_META.verde` que SCRUM-748 retiró. Un estado desconocido volvería '
    + 'a pintarse «AL DÍA» — y el día que exista un cuarto estado, ése es exactamente el que se '
    + 'convertiría en la mentira que venía a evitar.');
  assert.ok(usaElDecisor >= 1,
    '🔴 la vista ya no LLAMA a `metaDelSemaforo`: el arreglo de SCRUM-748 se ha ido.');
});
