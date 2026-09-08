// tests/scrum637-un-numero-una-regla.test.mjs — SCRUM-637
//
// Sin gate y sin red: lee `docs/YAQU_MASTER.md`.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 QUÉ IMPIDE ESTO, Y POR QUÉ GIT NO BASTA
//
// El 8-sep-2026 `main` y esta rama añadieron reglas a la Parte I **el mismo fin de semana**:
// `main` las 39, 40 y 41 (las tres que hereda una ejecución que nadie revisa, del 7-sep) y la
// rama una regla nueva numerada **también 39** (del 8-sep).
//
// 🔴 LO QUE HIZO GIT ES EL DEFECTO ENTERO: marcó UN conflicto —la cabecera, `(1-39)` contra
// `(1-41)`— y **unió los dos cuerpos en silencio**. Las cuatro reglas quedaron en el fichero, con
// DOS numeradas 39, y el único conflicto visible era la línea trivial. Un merge así se resuelve
// eligiendo una cabecera y se commitea con la colisión dentro, porque nadie mira el cuerpo.
//
// Es la cuarta forma del punto único de escritura compartido que este árbol lleva catalogando
// (SCRUM-662, 670, 709, 720): dos trabajos independientes escribiendo en el mismo sitio. Aquí no
// se cierra partiendo el fichero —la Parte I es una lista y tiene que serlo— sino haciendo que la
// colisión NO PUEDA pasar en verde.
//
// ── LAS DOS CONDICIONES VAN EN DOS TESTS, Y NO ES ESTILO ──────────────────────────────────
// Son independientes: se puede tener la cabecera correcta con un número duplicado (fue el estado
// exacto tras el automerge) y se puede tener numeración limpia con la cabecera desfasada (fue el
// estado de `main`, que decía «1-37» teniendo 38). Con un solo `assert` que las mezclara, una
// mutación sobre cualquiera de las dos quedaría tapada por la otra.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(RAIZ, 'docs/YAQU_MASTER.md');

/**
 * El CUERPO de la Parte I, acotado entre su encabezado y el de la Parte J.
 *
 * 🔴 Se acota a propósito: el máster tiene ~1900 líneas y está lleno de `N)` que no son reglas
 * —enumeraciones dentro de las entradas del registry, referencias a artículos—. Un escáner sobre
 * el fichero entero daría números inventados y este guard sería ruido.
 */
export function parteI(texto = fs.readFileSync(MASTER, 'utf8')) {
  const lineas = texto.split('\n');
  const ini = lineas.findIndex((l) => /^# PARTE I\b/.test(l));
  const fin = lineas.findIndex((l, i) => i > ini && /^# PARTE J\b/.test(l));
  return { ini, fin, texto: ini < 0 ? '' : lineas.slice(ini, fin < 0 ? lineas.length : fin).join('\n') };
}

/**
 * Los números de regla DECLARADOS en el cuerpo, en orden de aparición.
 *
 * 🔴 LA PRIMERA VERSIÓN DE ESTO ESTABA MAL Y HABRÍA HECHO INSERVIBLES LOS DOS GUARDS DE ABAJO.
 * Anclaba en `N) **` —número, paréntesis y título en negrita— porque así se escriben las reglas
 * 37-42. Pero las **1 a 36 van en párrafo corrido**, sin negrita
 * (`**Técnicas heredadas:** 1) NUNCA n8n — … 2) Multi-tenant: …`), así que capturaba SIETE de
 * cuarenta y dos. Con ese conjunto, «ninguna regla comparte número» era cierto sobre un 17 % del
 * cuerpo y una colisión entre la 12 y la 12 habría pasado en verde.
 *
 * Lo destapó la aserción ⑤ al acusar de rotas citas a las reglas 1, 9, 24 y 30, que existen desde
 * siempre: cuando el analizador y el árbol discrepan, el roto es el analizador.
 *
 * Ahora se captura `N)` y se descartan los DOS falsos positivos que trae este cuerpo, los dos
 * medidos, no supuestos:
 *   · precedido de dígito o guion → `(SCRUM-637):` contiene «37)» y es un número de TICKET;
 *   · precedido de «regla »/«reglas » → es una CITA dentro del texto de otra regla (la 41 cita
 *     a la 37), no una declaración.
 */
export function numerosDeRegla(cuerpo) {
  const re = /(?<![0-9A-Za-zÀ-ÿ-])(?<!regla )(?<!reglas )(\d{1,2})\)/g;
  return [...cuerpo.matchAll(re)].map((m) => Number(m[1]));
}

/** Lo que la cabecera DICE que hay: el `N` de «REGLAS (1-N; cerradas)». */
export function topeDeLaCabecera(cuerpo) {
  const m = cuerpo.match(/^# PARTE I — REGLAS \(1-(\d+); cerradas\)/m);
  return m ? Number(m[1]) : null;
}

// ═══ ① SUELO — sin esto, las dos condiciones serían ciertas sobre la nada ═════════════════

test('SCRUM-637 · 🔴 SUELO: el escáner VE la Parte I y sus reglas', () => {
  const { ini, texto } = parteI();
  assert.ok(ini >= 0, '🔴 no encuentro el encabezado `# PARTE I` en el máster: ¿se renombró?');
  const nums = numerosDeRegla(texto);
  assert.ok(nums.length >= 40,
    `🔴 ESCÁNER CIEGO: sólo veo ${nums.length} reglas en el cuerpo de la Parte I, y hay más de 40.\n`
    + '   Con un conjunto parcial, «ninguna comparte número» sería cierto sobre el trozo que el\n'
    + '   escáner alcanza a ver — que es exactamente el estado en que nació este fichero: anclaba\n'
    + '   en `N) **` y capturaba 7 de 42, porque las 1-36 van sin negrita.');

  // 🔴 Y LA COBERTURA SE COMPRUEBA CONTRA UNA RESPUESTA CONOCIDA, no contra un mínimo: la Parte I
  // está numerada de 1 a N sin saltos. Si falta un número intermedio, el extractor se ha vuelto a
  // dejar una familia de reglas fuera y hay que arreglarlo A ÉL, no bajar la exigencia.
  const maximo = Math.max(...nums);
  const faltan = [];
  for (let i = 1; i <= maximo; i++) if (!nums.includes(i)) faltan.push(i);
  assert.deepEqual(faltan, [],
    `🔴 EL EXTRACTOR SE DEJA REGLAS: no ve la(s) ${faltan.join(', ')} pese a llegar hasta la ${maximo}.\n`
    + '   La Parte I va de 1 a N sin huecos; un hueco aquí es del analizador, no del máster.\n'
    + `   Números vistos: ${[...nums].sort((a, b) => a - b).join(' ')}`);
  assert.ok(topeDeLaCabecera(texto) !== null,
    '🔴 la cabecera ya no tiene la forma «REGLAS (1-N; cerradas)»: el guard ② no puede leer el tope.');
});

// ═══ ② UN NÚMERO, UNA REGLA ══════════════════════════════════════════════════════════════

test('SCRUM-637 · 🔴 ninguna regla comparte número con otra', () => {
  const nums = numerosDeRegla(parteI().texto);
  const vistos = new Map();
  const repetidos = [];
  for (const n of nums) {
    vistos.set(n, (vistos.get(n) || 0) + 1);
    if (vistos.get(n) === 2) repetidos.push(n);
  }
  assert.deepEqual(repetidos, [],
    `🔴 HAY DOS REGLAS CON EL MISMO NÚMERO: ${repetidos.join(', ')}.\n\n`
    + '   Así quedó la Parte I tras el automerge del 8-sep-2026, y GIT NO LO MARCÓ: unió los dos\n'
    + '   cuerpos y sólo conflictó la cabecera. Una regla que comparte número con otra no se puede\n'
    + '   citar: «regla 39» deja de identificar nada, y las citas existentes empiezan a apuntar a\n'
    + '   la que no era.\n\n'
    + '   Se arregla RENUMERANDO la última en entrar —las anteriores ya están firmadas y citadas—\n'
    + '   y actualizando sus citas. Nunca borrando una de las dos.\n'
    + `   Números leídos, en orden: ${nums.join(' ')}`);
});

// ═══ ③ LA CABECERA SE MIDE, NO SE CALCULA ════════════════════════════════════════════════

test('SCRUM-637 · 🔴 la cabecera «(1-N)» coincide con el número más alto del cuerpo', () => {
  const cuerpo = parteI().texto;
  const nums = numerosDeRegla(cuerpo);
  const maximo = Math.max(...nums);
  const tope = topeDeLaCabecera(cuerpo);
  assert.equal(tope, maximo,
    `🔴 LA CABECERA MIENTE: dice «1-${tope}» y la regla más alta del cuerpo es la ${maximo}.\n\n`
    + '   No es cosmético: esa cabecera es lo que lee quien va a añadir la siguiente regla, así que\n'
    + '   una cabecera baja INVITA a reusar un número que ya existe — que es como nacen las\n'
    + '   colisiones que vigila el guard de arriba. Ya pasó: decía «1-37» habiendo 38 reglas.\n\n'
    + '   El número se MIDE sobre el cuerpo, no se calcula de memoria.\n'
    + `   Números leídos, en orden: ${nums.join(' ')}`);
});

// ═══ ④ CONTROL NEGATIVO — los dos guards saben decir que NO ══════════════════════════════

test('SCRUM-637 · ✅ CONTROL NEGATIVO: los dos detectores cazan lo que persiguen', () => {
  // Sin esto, «no hay duplicados» y «el detector no mira» dan el mismo verde. Se ejercitan las
  // funciones puras sobre un máster de mentira, sin tocar el de verdad.
  const conDuplicado = [
    '# PARTE I — REGLAS (1-42; cerradas)',
    '**Proceso:** 41) **Una regla.** texto',
    '**Proceso:** 42) **Otra regla.** texto',
    '**Proceso:** 42) **Y otra con el MISMO número.** texto',
    '# PARTE J — OTRA COSA',
  ].join('\n');
  const cuerpoDup = parteI(conDuplicado).texto;
  const numsDup = numerosDeRegla(cuerpoDup);
  assert.deepEqual(numsDup, [41, 42, 42], `🔴 el escáner lee ${numsDup.join(' ')} en vez de 41 42 42.`);

  const cabezaBaja = [
    '# PARTE I — REGLAS (1-39; cerradas)',
    '**Proceso:** 42) **La última.** texto',
    '# PARTE J — OTRA COSA',
  ].join('\n');
  const cuerpoBajo = parteI(cabezaBaja).texto;
  assert.equal(topeDeLaCabecera(cuerpoBajo), 39, '🔴 no lee el tope de la cabecera.');
  assert.notEqual(topeDeLaCabecera(cuerpoBajo), Math.max(...numerosDeRegla(cuerpoBajo)),
    '🔴 una cabecera desfasada NO se detecta: el guard ③ no distinguiría nada.');
});

// ═══ ⑤ NINGUNA CITA NOMBRA UN NÚMERO QUE NO EXISTE ═══════════════════════════════════════

/** Los `.md` de `docs/` más `CLAUDE.md`. El máster se excluye: es la FUENTE, no una cita. */
function documentosQueCitan() {
  const fuera = [];
  const anda = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.endsWith('.md') && p !== MASTER) fuera.push(p);
    }
  };
  anda(path.join(RAIZ, 'docs'));
  fuera.push(path.join(RAIZ, 'CLAUDE.md'));
  return fuera;
}

test('SCRUM-637 · 🔴 ninguna cita «regla N» nombra un número que no existe en la Parte I', () => {
  // 🔴 EL DAÑO QUE ESTE TICKET SE HIZO A SÍ MISMO. Trece ficheros de `docs/master/` citaban
  // «(regla 39)» desde el 4-sep, cuando la Parte I llegaba a la 38: citas ROTAS, que chillan si
  // alguien las sigue. La unión del 8-sep creó una regla 39 de verdad y las convirtió en citas
  // que apuntan a OTRA regla — y ésas no chillan nunca. Se retiraron; esto impide que vuelvan.
  //
  // ⚠️ Lo que este guard SÍ caza: un número que no existe. Lo que NO puede cazar: una cita a un
  // número que existe pero es el equivocado — para eso no hay señal automática, y por eso las
  // quince se resolvieron RETIRANDO el número en vez de dejarlo apuntando a la regla de al lado.
  const existentes = new Set(numerosDeRegla(parteI().texto));
  assert.ok(existentes.size >= 4, '🔴 SUELO: no leo reglas del máster; lo de abajo no mide nada.');

  const rotas = [];
  for (const doc of documentosQueCitan()) {
    const lineas = fs.readFileSync(doc, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(/\bregla\s+(\d{1,3})\b/gi)) {
        const n = Number(m[1]);
        if (!existentes.has(n)) {
          rotas.push(`${path.relative(RAIZ, doc).replace(/\\/g, '/')}:${i + 1} → regla ${n}`);
        }
      }
    });
  }
  assert.deepEqual(rotas, [],
    '🔴 HAY CITAS A REGLAS QUE NO EXISTEN EN LA PARTE I:\n'
    + rotas.map((r) => '       ' + r).join('\n')
    + '\n\n   Una cita a un número inexistente es una cita rota: quien la sigue no encuentra nada.\n'
    + '   Y es la antesala del defecto peor — el día que alguien cree esa regla, la cita pasa a\n'
    + '   apuntar a algo que no tiene nada que ver, y entonces ya no chilla. Pasó el 8-sep-2026\n'
    + '   con quince citas a «regla 39».\n'
    + `   Números que SÍ existen hoy: ${[...existentes].sort((a, b) => a - b).join(' ')}`);
});

// ═══ ⑥ LAS CUATRO REGLAS DE LA COLISIÓN SIGUEN AHÍ, Y NINGUNA PERDIÓ SU TEXTO ════════════

test('SCRUM-637 · 🔴 la unión conservó LAS CUATRO reglas del choque', () => {
  // Renumerar es lo barato; perder una regla en el merge es lo caro. Se ancla por CONTENIDO —el
  // texto de cada una— y no por su número, que es justamente lo que este ticket movió.
  const cuerpo = parteI().texto;
  const lasCuatro = [
    ['main 39', 'Ningún texto que vea el usuario se escribe sin firma del fundador'],
    ['main 40', 'El camino de emisión fiscal se lee, no se modifica'],
    ['main 41', 'Un guard en rojo se arregla cambiando el CÓDIGO'],
    ['rama → 42', 'UN TICKET NO SE CIERRA MIENTRAS SU RAMA SIGA SIN MERGEAR'],
  ];
  for (const [quien, literal] of lasCuatro) {
    assert.ok(cuerpo.includes(literal),
      `🔴 SE HA PERDIDO LA REGLA DE ${quien} en la unión: no encuentro «${literal}».\n`
      + '   El conflicto se resuelve por UNIÓN: las cuatro se quedan y sólo cambia UN número.');
  }
  // Y la que se renumeró tiene el 42, no otro: si volviera al 39 chocaría con la de `main`.
  assert.match(cuerpo, /42\) \*\*UN TICKET NO SE CIERRA MIENTRAS SU RAMA SIGA SIN MERGEAR\.\*\*/,
    '🔴 la regla de esta rama ya no es la 42. Es la última en entrar: las 39/40/41 de `main` están\n'
    + '   firmadas, citadas en `CLAUDE.md` y mergeadas, así que la que se mueve es ésta.');
});
