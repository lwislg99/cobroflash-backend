// SCRUM-267 · UNA ENTRADA DEL REGISTRO DECLARA CONTRA QUÉ `main` SE MIDIÓ, Y A QUÉ HORA.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LOS DOS INCIDENTES QUE LO ORIGINAN, el mismo día
//
//   · Javier **paró** ante una contradicción entre Jira y el máster: uno decía «hecho y en main»
//     y el otro «por hacer». Hizo lo correcto —no avanzar sobre una afirmación que no podía
//     comprobar— pero no tenía forma de saber cuál de los dos estaba desactualizado.
//   · Una medición **CORRECTA** de otra sesión caducó **en una hora**, porque `main` se movió
//     tres veces mientras trabajaba. El dato no estaba mal: estaba viejo, y nada en el texto lo
//     decía.
//
// El segundo es el que define el diseño. **El problema no es medir mal: es que una medición buena
// no lleva fecha de caducidad encima.** Con cuatro sesiones mergeando, `main` cambia varias veces
// por hora — este mismo ticket vio la base moverse entre el `fetch` y el `worktree add`.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ EL ANCLA VA EN EL ENCABEZADO Y NO JUNTO A LA AFIRMACIÓN
//
// La alternativa era detectar la afirmación —buscar «está en main», «mergeado», «ya entró»— y
// exigir un ancla cerca. Se descartó por dos motivos, los dos medidos en este repo:
//
//   ① Sería un **guard de TEXTO**, y un guard de texto se caza a sí mismo: el fichero que explica
//      la prohibición contiene las frases que persigue. Ha mordido cinco veces
//      (SCRUM-176/168/3/193 y el propio 254).
//   ② Y se **esquiva reformulando**. Una regla que depende de cómo escribas la frase no es una
//      regla.
//
// Exigirlo en TODAS las entradas es estructural: la comprobación es «¿el encabezado tiene este
// campo?», no «¿la prosa afirma algo?». Y no es burocracia añadida — **toda entrada se produce
// contra algún `main`**, así que declarar la base siempre significa algo. Lo que cambia es que
// deja de ser costumbre y pasa a ser mecanismo.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// SHA DE 40 Y HORA CON HUSO, y las dos exigencias tienen su incidente detrás
//
//   · **40 hex, no abreviado.** `1bb0b5e` aparece en tres ramas distintas de este repo esta misma
//     semana: un sha corto identifica un commit igual de mal que un número de PR identifica un
//     ticket (R12). Si el ancla no distingue, no ancla.
//   · **Fecha Y HORA con huso.** Sin hora, el ancla no distingue «medido hace cinco minutos» de
//     «medido esta mañana» — que es exactamente la diferencia que costó la vuelta. ISO-8601 con
//     desplazamiento para que no dependa de dónde esté quien lo lee.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE GUARD NO VIVE DENTRO DEL DE SCRUM-273
//
// Responden preguntas distintas: 273 vigila **dónde** se escribe el registro; éste, **qué lleva
// dentro** cada entrada. Un rojo de «falta el ancla» aterrizando en un fichero llamado
// *registro-por-fichero* obliga a quien lo lee a averiguar cuál de las dos reglas rompió;
// separados, el nombre del test es el diagnóstico.
//
// Y la razón que decide: 273 guarda un **censo congelado** de las entradas que quedaron en el
// máster. Colgarle una propiedad nueva haría que ese fichero cambiase por motivos que no tienen
// que ver con el censo — **la misma mezcla de lo estable con lo que cambia a menudo que causó
// SCRUM-273**, repetida dentro del propio arreglo.
//
// ⚠️ COSTE ACEPTADO Y DICHO: dos ficheros recorren `docs/master/`. Si ese directorio se mueve,
// hay dos sitios que tocar. Extraer un helper compartido para seis líneas sería un tercer fichero
// y no compensa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_REGISTRO = path.join(RAIZ, 'docs', 'master');
const README = path.join(DIR_REGISTRO, 'README.md');

/**
 * El ancla: `**Medido contra:** \`origin/main\` = \`<40 hex>\` · <ISO-8601 con huso>`
 *
 * Anclado al principio de línea y con los dos campos OBLIGATORIOS. El huso admite `Z` o `±HH:MM`
 * porque las dos formas son ISO-8601 válidas y no ambiguas.
 */
const RE_ANCLA = /^\*\*Medido contra:\*\*\s+`origin\/main`\s*=\s*`([0-9a-f]{40})`\s*·\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))\s*$/m;

/** Las entradas del registro (no el README, que no es una entrada). */
function entradas() {
  if (!fs.existsSync(DIR_REGISTRO)) return [];
  return fs.readdirSync(DIR_REGISTRO)
    .filter((f) => /^SCRUM-\d+\.md$/.test(f))
    .map((f) => ({ nombre: f, texto: fs.readFileSync(path.join(DIR_REGISTRO, f), 'utf8') }));
}

// ── EL TROCEADOR (SCRUM-516) ─────────────────────────────────────────────────────────────
//
// 🔴 POR QUÉ ESTE GUARD PASA A MIRAR ENTRADA POR ENTRADA, Y NO EL FICHERO.
//
// Hasta el 17-ago-2026 este guard leía el fichero ENTERO y `RE_ANCLA` lleva `/m`: bastaba con que
// UNA línea en cualquier parte llevara un ancla buena. Medido rompiendo un verde a propósito: una
// sesión abrevió su sha a 7 caracteres y **los cuatro guards seguían dando 17/17**, porque las
// anclas de las dos entradas anteriores del mismo fichero ya lo satisfacían.
//
//   >>> Un ancla mal escrita en un apéndice no la veía nadie. <<<
//
// Y lo grave es la INTERACCIÓN, no este guard suelto: SCRUM-273 obliga a un fichero por ticket, así
// que un registro nuevo sobre un ticket viejo **va como apéndice al final** — justo donde este
// guard era ciego. El que obliga a un nombre correcto conducía el trabajo al punto ciego del otro.
// Ninguno estaba mal por separado; juntos abrían el hueco.
//
// ── EL DELIMITADOR, MEDIDO ANTES DE APOYARSE EN ÉL ───────────────────────────────────────
//
// El candidato propuesto era `---` + `# SCRUM-<n> · …`. **Medido sobre los 226 ficheros reales, NO
// es estable**, y por eso NO se usa tal cual:
//
//   · `---` delante del apéndice: **7 apéndices no lo llevan** (SCRUM-244, 328 ×3, 406, 420, 447).
//     Exigirlo daría 7 rojos que no son fallos de ancla. **No se exige.**
//   · el `·` del título: **8 encabezados usan otra cosa** — `# SCRUM-374` a secas, `# SCRUM-415 —
//     …`, `# SCRUM-16 / 142 · …`. **No se exige.**
//   · el número del encabezado ≠ el del fichero: **1 caso real** (`SCRUM-441.md:420` encabeza
//     `# SCRUM-496`). Es asunto del guard de nombres (273), no de éste. **No se exige.**
//
// Lo que SÍ resultó estable es `^# SCRUM-<n>` como principio de entrada: lo llevan los 226
// ficheros y las 317 entradas. **Con una trampa real y medida:** `SCRUM-480.md` tiene dos `#
// SCRUM-` DENTRO de un bloque cercado ``` — troceando por texto plano inventaría dos entradas
// fantasma. Por eso el troceador lleva la cuenta de los cercados y los salta.
//
// El delimitador es, por tanto, **`^# SCRUM-\d+` fuera de bloque cercado**, y nada más.

/** ¿Qué líneas caen dentro de un bloque cercado ``` o ~~~? */
function lineasEnCodigo(lineas) {
  const dentro = new Array(lineas.length).fill(false);
  let abierto = false;
  for (let i = 0; i < lineas.length; i++) {
    if (/^\s*(```|~~~)/.test(lineas[i])) { abierto = !abierto; dentro[i] = true; continue; }
    dentro[i] = abierto;
  }
  return dentro;
}

/**
 * Trocea el texto de un fichero de registro en sus ENTRADAS.
 *
 * La primera empieza en la línea 0 —no en su encabezado— para que **nada quede fuera de alguna
 * entrada**: si un fichero llevara preámbulo antes del primer `#`, trocear desde el encabezado lo
 * dejaría sin vigilar, que es el defecto que este ticket viene a cerrar, en pequeño.
 *
 * Devuelve `[]` si no encuentra ningún encabezado. Ese caso lo trata el SUELO como CEGUERA, nunca
 * como «no hay entradas sin ancla».
 */
export function trocearEntradas(texto) {
  const lineas = texto.split('\n');
  const enCodigo = lineasEnCodigo(lineas);
  const cortes = [];
  for (let i = 0; i < lineas.length; i++) {
    if (/^# SCRUM-\d+/.test(lineas[i]) && !enCodigo[i]) cortes.push(i);
  }
  if (!cortes.length) return [];
  return cortes.map((ini, k) => {
    const desde = k === 0 ? 0 : ini;
    const hasta = k + 1 < cortes.length ? cortes[k + 1] : lineas.length;
    return {
      indice: k + 1,                       // 1-based: los apéndices se añaden AL FINAL, así que no corre
      linea: ini + 1,                      // 1-based, para el mensaje de error
      titulo: lineas[ini].slice(0, 80),
      cuerpo: lineas.slice(desde, hasta).join('\n'),
    };
  });
}

/** Todas las entradas del registro, con su fichero. La unidad que vigila este guard. */
function entradasTroceadas() {
  return entradas().flatMap((f) => trocearEntradas(f.texto).map((e) => ({ ...e, fichero: f.nombre, clave: `${f.nombre}#${e.indice}` })));
}

/** Devuelve el motivo por el que un texto NO lleva ancla válida, o `null` si la lleva. */
export function motivoSinAncla(texto) {
  if (!/^\*\*Medido contra:\*\*/m.test(texto)) return 'no declara «Medido contra»';
  const m = RE_ANCLA.exec(texto);
  if (!m) {
    // Diagnóstico útil: distinguir el sha corto de la hora ausente ahorra el viaje de vuelta.
    const linea = (/^\*\*Medido contra:\*\*.*$/m.exec(texto) || [''])[0];
    if (/`[0-9a-f]{7,39}`/.test(linea)) return 'el sha está ABREVIADO (hacen falta las 40 posiciones)';
    if (!/\d{2}:\d{2}/.test(linea)) return 'falta la HORA (la fecha sola no dice si caducó)';
    return `el ancla no tiene la forma esperada: ${JSON.stringify(linea)}`;
  }
  return null;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────

test('SCRUM-267 · ① el validador reconoce un ancla buena y las tres formas de mala', () => {
  const bueno = '**Medido contra:** `origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T18:20:00+02:00';
  assert.equal(motivoSinAncla(`# X\n\n${bueno}\n`), null, '🔴 no reconoce un ancla correcta');

  // Y con `Z`, que también es ISO válido.
  assert.equal(motivoSinAncla('**Medido contra:** `origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T16:20:00Z'),
    null, '🔴 rechaza el huso en Z, que es ISO-8601 igual de válido');

  assert.match(motivoSinAncla('# X\n\nsin nada\n'), /no declara/,
    '🔴 no detecta la ausencia del campo');
  assert.match(motivoSinAncla('**Medido contra:** `origin/main` = `745955b` · 2026-08-03T18:20:00+02:00'), /ABREVIADO/,
    '🔴 acepta un sha corto. `1bb0b5e` aparece en tres ramas distintas de este repo: si el ancla ' +
    'no distingue commits, no ancla nada.');
  assert.match(motivoSinAncla('**Medido contra:** `origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03'), /HORA/,
    '🔴 acepta una fecha sin hora. El incidente que originó el ticket fue una medición CORRECTA ' +
    'que caducó en una hora: sin hora, el ancla no distingue eso de una recién hecha.');
});

test('SCRUM-267 · ② el barrido encuentra entradas de verdad', () => {
  // Sin esto, el guard de abajo pasaría en verde con el directorio vacío o renombrado: cero
  // entradas sin ancla y cero entradas es la misma respuesta.
  const e = entradas();
  assert.ok(e.length > 0,
    '🔴 no se ha encontrado NINGUNA entrada en docs/master/. El verde del guard de abajo no ' +
    'significaría «todas llevan ancla», sino «no se miró». Revisa que el directorio existe y que ' +
    'los ficheros siguen `SCRUM-<n>.md`.');
});

// ── EL CENSO HEREDADO ────────────────────────────────────────────────────────────────────
//
// Entradas que YA existían en `docs/master/` cuando este guard entró, escritas cuando el formato
// declarado en el README **todavía no incluía el campo**. Quien las escribió hizo lo correcto
// según la documentación vigente: exigirles una regla que no estaba escrita sería castigar a
// quien siguió el README.
//
// ⚠️ ESTO NO ES UNA ALLOWLIST, y la distinción es exactamente la que separa un censo que se
// cierra de uno que crece:
//
//   ① **NO PUEDE CRECER.** Cualquier fichero de `docs/master/` que no esté aquí necesita ancla o
//      es rojo. El conjunto queda CERRADO en el mismo commit que lo crea — no hay forma de
//      añadirse a él después, porque añadirse es editar este fichero y eso se ve en el diff.
//   ② **SI EL NÚMERO BAJA, TAMBIÉN FALLA.** Igual que el ratchet de SCRUM-243 y el censo de
//      SCRUM-273: cuando alguien le ponga su ancla a una de éstas, el guard le obliga a
//      actualizar el número, y la mejora queda ANOTADA en vez de pasar desapercibida.
//
// El motivo es uno solo y es verdadero para las tres: no es una excepción concedida, es una fecha.
//
// NO SE VAN A RELLENAR, y es decisión del fundador con su razón escrita: el ancla sirve para saber
// si una afirmación sobre `main` ha caducado, y **nadie relee la entrada de un ticket ya cerrado
// para decidir nada**. Su valor es PROSPECTIVO. Hacer que tres sesiones paren para reconstruir
// mediciones que nadie va a consultar sería coste sin beneficio — y reconstruirlas sería
// inventarlas, que es peor que no tenerlas.
// SCRUM-244 SALIO del censo el 10-ago-2026: su seccion 1(b) trae el campo `Medido contra:`, asi
// que el fichero ya tiene ancla y el guard lo canto solo. Quedan DOS. Este apunte es el requisito
// del propio guard: si bajar fuese silencioso, el censo declararia tres excepciones habiendo dos.
// ── SCRUM-516 · LAS EXENTAS, POR LISTA NOMINAL Y CERRADA ─────────────────────────────────
//
// 🔴 ESTO NO ES BAJAR EL LISTÓN: **`RE_ANCLA` no se ha tocado.** Lo que cambia es la UNIDAD que se
// mira (entrada, no fichero). Al mirar por entrada aparecieron 31 entradas que el guard nunca había
// mirado — no son regresiones nuevas, son las que llevaban ahí desde siempre tapadas por el ancla
// buena de la primera entrada de su fichero.
//
// Medido el 19-ago-2026 contra `origin/main` = `d59d5cd97546e394bdb027dea59c9cb6ba1f587b`:
// 226 ficheros · 317 entradas · 286 con ancla · 31 sin ella. **El fundador decidió qué hacer con
// esas 31, y la decisión se aplicó: 4 arregladas, 27 exentas.**
//
// ── EL PRINCIPIO QUE DECIDE, y va en las dos direcciones ─────────────────────────────────
//
//   **Un ancla que nadie midió NO SE ESCRIBE NUNCA.** Reconstruir contra qué `main` se midió algo
//   hace meses es FABRICAR una medición — justo lo que este guard existe para impedir. Vaciar la
//   lista inventando anclas sería usar la barrera para producir el daño que previene.
//
//   Y su reverso, para que no sea la salida fácil: **lo que SÍ se puede recuperar sin inventar, SE
//   RECUPERA.** Eximir un dato que existe y sólo está mal escrito no es prudencia, es pereza con
//   coartada.
//
// ── LAS 4 QUE SE ARREGLARON (ya no están en esta lista) ──────────────────────────────────
//
//   · `397#4` y `397#5` — la fecha iba entre backticks. El dato estaba completo y sobraban dos
//     caracteres: se quitaron. No se tocó ni el sha ni la hora.
//   · `290#2` (`22d8e84`) y `447#2` (`8a57b9cd`) — sha abreviado, EXPANDIDO. Completar un prefijo
//     no inventa nada, pero sólo vale si resuelve a un commit real y único, así que se comprobó
//     antes: `git rev-parse --disambiguate` devuelve **1 solo objeto** para cada uno, `cat-file -t`
//     dice **commit**, y los dos son **ancestros de `origin/main`** — que es justo lo que el ancla
//     afirmaba. Si alguno hubiera salido ambiguo o inexistente, se habría quedado exento.
//
// ── POR QUÉ LAS 27 RESTANTES NO SE PUEDEN ARREGLAR ──────────────────────────────────────
//
//   · **23 no declaran «Medido contra» en absoluto.** El dato NO EXISTE; no está mal escrito.
//     Escribirlo ahora sería inventarlo.
//   · **4 lo declaran SIN HORA** (`268#2`, `273#2`, `406#2`, `409#2`). La fecha está, la hora no se
//     tomó. ⚠️ **La hora del commit que las escribió NO es la hora de la medición** — usarla sería
//     inventar con apariencia de precisión, que es la peor de las dos formas de inventar.
//
// ── CÓMO SE EXIME, y esto es lo que decide si el arreglo dura ────────────────────────────
//
//   ⛔ NO por umbral. NO por fecha de corte. NO por una regla «las anteriores a X pasan». Un umbral
//      es un trinquete calibrado al número cómodo, y autoriza la copia número 28.
//   ✅ Por LISTA EXPLÍCITA, entrada a entrada, con `fichero#índice` y motivo.
//
//   🔴 Y LA PROPIEDAD QUE LA CONVIERTE EN TRINQUETE DE VERDAD: **esta lista NO PUEDE CRECER.** Hay
//   un test (`las exentas son EXACTAMENTE éstas`) que falla si aparece una entrada sin ancla que no
//   esté aquí. Añadir una sólo se puede haciendo editar este objeto, y eso se ve en el diff — que
//   es exactamente la diferencia entre un censo que se cierra y una allowlist que crece sola.
const SIN_DATO = 'no declara «Medido contra» — el dato NO EXISTE, no está mal escrito: escribirlo ahora sería inventarlo';
const SIN_HORA = 'declara la fecha pero NO la hora, y la hora no se tomó — la del commit que la escribió no es la de la medición';
const ANTERIOR_AL_GUARD = 'anterior a SCRUM-267 — el formato existía sin el campo';

const HEREDADAS_SIN_ANCLA = {
  'SCRUM-231.md#1': ANTERIOR_AL_GUARD,
  'SCRUM-264.md#1': ANTERIOR_AL_GUARD,

  // Sin «Medido contra» (23 con las dos de arriba incluidas más abajo por fichero)
  'SCRUM-242.md#2': SIN_DATO,
  'SCRUM-242.md#3': SIN_DATO,
  'SCRUM-242.md#4': SIN_DATO,
  'SCRUM-244.md#1': SIN_DATO,
  'SCRUM-244.md#2': SIN_DATO,
  'SCRUM-244.md#3': SIN_DATO,
  'SCRUM-244.md#4': SIN_DATO,
  'SCRUM-244.md#5': SIN_DATO,
  'SCRUM-244.md#7': SIN_DATO,
  'SCRUM-313.md#2': SIN_DATO,
  'SCRUM-328.md#2': SIN_DATO,
  'SCRUM-328.md#3': SIN_DATO,
  'SCRUM-328.md#4': SIN_DATO,
  'SCRUM-328.md#5': SIN_DATO,
  'SCRUM-397.md#2': SIN_DATO,
  'SCRUM-397.md#3': SIN_DATO,
  'SCRUM-445.md#2': SIN_DATO,
  'SCRUM-446.md#2': SIN_DATO,
  'SCRUM-446.md#3': SIN_DATO,
  'SCRUM-467.md#2': SIN_DATO,
  'SCRUM-485.md#2': SIN_DATO,

  // Con fecha pero sin hora
  'SCRUM-268.md#2': SIN_HORA,
  'SCRUM-273.md#2': SIN_HORA,
  'SCRUM-406.md#2': SIN_HORA,
  'SCRUM-409.md#2': SIN_HORA,
};

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-267 · toda entrada NUEVA del registro declara contra qué main se midió, y cuándo', () => {
  // SCRUM-516: se recorre ENTRADA POR ENTRADA. Antes se leía el fichero entero y, con `/m`, un
  // ancla buena en la primera entrada tapaba una rota en el apéndice — el hueco por el que se
  // coló un sha de 7 caracteres el 17-ago-2026 con los cuatro guards en 17/17.
  const sinAncla = entradasTroceadas()
    .map((e) => ({ clave: e.clave, linea: e.linea, titulo: e.titulo, motivo: motivoSinAncla(e.cuerpo) }))
    .filter((e) => e.motivo && !(e.clave in HEREDADAS_SIN_ANCLA))
    .map((e) => `${e.clave} (línea ${e.linea}) — ${e.motivo}\n        ${e.titulo}`);

  assert.deepEqual(sinAncla, [],
    '🔴 HAY ENTRADAS DEL REGISTRO SIN ANCLA DE MEDICIÓN:\n    ' + sinAncla.join('\n    ') +
    '\n\n  Una entrada que afirma algo sobre el estado del repo sin decir contra qué `main` lo\n' +
    '  comprobó no se puede verificar después: quien la lee no sabe si sigue siendo cierta.\n\n' +
    '  Pasó dos veces el mismo día. Javier PARÓ ante una contradicción entre Jira y el máster sin\n' +
    '  forma de saber cuál estaba viejo; y una medición CORRECTA caducó en una hora porque `main`\n' +
    '  se movió tres veces. El problema no es medir mal: es que una medición buena no lleva su\n' +
    '  fecha de caducidad encima.\n\n' +
    '  Añade al encabezado, con el sha COMPLETO (40) y hora con huso:\n' +
    '    **Medido contra:** `origin/main` = `<sha40>` · <ISO-8601>\n\n' +
    '  El sha corto no vale: `1bb0b5e` aparece en tres ramas distintas de este repo esta semana.\n\n  Y NO ES EL UNICO que vigila una entrada del registro: son CUATRO, y cada sesion los ha\n  ido descubriendo EN ROJO despues de empujar. Compruebalos todos antes con\n  `npm run guards:entrada` (segundos: no compila ni toca la base).');
});

// ── SCRUM-516 · EL CONTROL QUE DECIDE ────────────────────────────────────────────────────

test('SCRUM-267 · 🔴 un APÉNDICE con el ancla rota cae, aunque las entradas previas estén bien', () => {
  // ÉSTE es el caso que el 17-ago-2026 pasaba en verde, y es el motivo entero de SCRUM-516.
  // Se construye el fichero sintético con la MISMA forma que produce SCRUM-273: primera entrada
  // impecable, apéndice al final separado por `---`, y en el apéndice el sha ABREVIADO.
  const buena = '`origin/main` = `745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T18:20:00+02:00';
  const fichero = [
    '# SCRUM-999 · la primera entrada, impecable', '',
    `**Medido contra:** ${buena}`, '', 'cuerpo.', '',
    '---', '',
    '# SCRUM-999 · el apéndice, con el sha ABREVIADO', '',
    '**Medido contra:** `origin/main` = `745955b` · 2026-08-03T18:20:00+02:00', '', 'cuerpo.',
  ].join('\n');

  // (a) Como lo miraba el guard viejo —el fichero entero— el apéndice roto NO se ve.
  assert.equal(motivoSinAncla(fichero), null,
    '🔴 la premisa de SCRUM-516 ha dejado de ser cierta: el fichero entero ya NO pasa. Si el '
    + 'defecto se arregló por otra vía, este control sobra y hay que rehacerlo, no relajarlo.');

  // (b) Troceado por entradas, el apéndice cae Y SE DICE CUÁL.
  const trozos = trocearEntradas(fichero);
  assert.equal(trozos.length, 2, '🔴 el troceador no ve las dos entradas del fichero sintético.');
  assert.equal(motivoSinAncla(trozos[0].cuerpo), null, '🔴 acusa a la primera entrada, que está bien.');
  assert.match(motivoSinAncla(trozos[1].cuerpo), /ABREVIADO/,
    '🔴 EL APÉNDICE CON EL ANCLA ROTA SIGUE PASANDO.\n\n'
    + '  Es exactamente lo que se midió el 17-ago-2026: un sha de 7 caracteres en la tercera\n'
    + '  entrada de un fichero, y los cuatro guards en 17/17. Sin este control, SCRUM-516 no\n'
    + '  ha arreglado nada.');
});

test('SCRUM-267 · 🔴 SUELO: el troceador VE entradas, y sabe saltar los bloques cercados', () => {
  // ① Que troceando el repo real salgan entradas. Cero entradas y cero entradas sin ancla son la
  //    misma respuesta, y una de las dos es ceguera.
  const todas = entradasTroceadas();
  assert.ok(todas.length > 0,
    '🔴 el troceo del registro ha devuelto CERO entradas. El verde del guard de arriba no diría '
    + '«todas llevan ancla», diría «no se supo mirar». Un cero aquí es ceguera, no salud.');
  assert.ok(todas.length >= entradas().length,
    `🔴 hay ${todas.length} entradas para ${entradas().length} ficheros: el troceador está `
    + 'perdiendo ficheros enteros. Cada fichero aporta AL MENOS una entrada.');

  // ② Que no invente: un `# SCRUM-` dentro de un bloque cercado NO es una entrada. Hay dos casos
  //    reales en `SCRUM-480.md`, así que esto no es una hipótesis de laboratorio.
  const conCercado = ['# SCRUM-1 · de verdad', '', '**Medido contra:** `origin/main` = '
    + '`745955bae433854c960ccf276cce755a8b61bd6d` · 2026-08-03T18:20:00+02:00', '',
    '```', '# SCRUM-2 · esto es un EJEMPLO dentro de un bloque, no una entrada', '```', ''].join('\n');
  assert.equal(trocearEntradas(conCercado).length, 1,
    '🔴 el troceador cuenta como entrada un `# SCRUM-` que vive DENTRO de un bloque cercado. '
    + 'Inventaría entradas fantasma —sin ancla, porque no son entradas— y el guard acusaría a '
    + 'quien pegó un ejemplo en su registro.');

  // ③ Que sepa decir que NO ve nada, en vez de devolver algo.
  assert.deepEqual(trocearEntradas('sin ningun encabezado\n'), [],
    '🔴 el troceador devuelve entradas donde no hay encabezado. Si se inventa una, el guard mide '
    + 'un trozo que nadie escribió.');
});

test('SCRUM-267 · 🔴 LAS EXENTAS SON EXACTAMENTE ÉSTAS: la lista no puede crecer', () => {
  // 🔴 EL TRINQUETE. Sin esto, la lista de exentas es una allowlist: la entrada 28 se añade sola
  // el día que alguien escriba un apéndice sin ancla y le moleste el rojo.
  //
  // La decisión del fundador (19-ago-2026) fue eximir 27 POR LISTA NOMINAL, no por umbral ni por
  // fecha de corte: «un umbral es un trinquete calibrado al número cómodo, y autoriza la copia
  // número 28». Este test es lo que hace que esa decisión signifique algo — para meter una entrada
  // más hay que EDITAR `HEREDADAS_SIN_ANCLA`, y eso se ve en el diff.
  const sinAncla = entradasTroceadas().filter((e) => motivoSinAncla(e.cuerpo)).map((e) => e.clave);
  const exentas = Object.keys(HEREDADAS_SIN_ANCLA);

  const nuevas = sinAncla.filter((c) => !exentas.includes(c));
  assert.deepEqual(nuevas, [],
    '🔴 HAY ENTRADAS SIN ANCLA QUE NO ESTÁN EN LA LISTA DE EXENTAS:\n    ' + nuevas.join('\n    ') +
    '\n\n  La lista de exentas está CERRADA desde el 19-ago-2026. No se amplía: se arregla la\n' +
    '  entrada nueva poniéndole su ancla, que para una entrada NUEVA siempre se puede porque\n' +
    '  la mides tú al escribirla.\n\n' +
    '  Y no vale «es igual que las otras 27»: aquéllas están exentas porque su dato NO EXISTE y\n' +
    '  reconstruirlo sería inventarlo. La tuya no tiene ese problema — todavía no la has medido.');

  // Y al revés: una exenta que ya no lo necesita tiene que salir, o el censo miente sobre sí mismo.
  const sobran = exentas.filter((c) => !sinAncla.includes(c));
  assert.deepEqual(sobran, [],
    '🔴 LA LISTA DE EXENTAS NOMBRA ENTRADAS QUE YA NO LO NECESITAN:\n    ' + sobran.join('\n    ') +
    '\n\n  O tienen ya su ancla, o han dejado de existir. En los dos casos hay que quitarlas de\n' +
    '  `HEREDADAS_SIN_ANCLA`: un censo que se describe a sí mismo mal deja de medir nada, y el\n' +
    '  número que declara —27— dejaría de ser comprobable.');
});

test('SCRUM-267 · 🔴 los números CUADRAN: con ancla + sin ancla + eximidas = el total', () => {
  // Un censo cuyas partes no suman no es un censo. Si el troceador perdiera entradas por el
  // camino, los tres números seguirían siendo plausibles por separado.
  const todas = entradasTroceadas();
  const conAncla = todas.filter((e) => !motivoSinAncla(e.cuerpo));
  const sinAncla = todas.filter((e) => motivoSinAncla(e.cuerpo));
  const eximidas = sinAncla.filter((e) => e.clave in HEREDADAS_SIN_ANCLA);
  const acusadas = sinAncla.filter((e) => !(e.clave in HEREDADAS_SIN_ANCLA));

  assert.equal(conAncla.length + sinAncla.length, todas.length,
    '🔴 «con ancla» + «sin ancla» no suman el total troceado.');
  assert.equal(eximidas.length + acusadas.length, sinAncla.length,
    '🔴 «eximidas» + «acusadas» no suman las que no llevan ancla.');
  assert.equal(acusadas.length, 0,
    `🔴 quedan ${acusadas.length} entradas acusadas y el guard de arriba debería haberlas cazado.`);

  // 🔴 EL NÚMERO DECLARADO, COMPROBADO — no derivado por resta. Tras la decisión del 19-ago-2026
  // (4 arregladas, 27 exentas) el censo tiene que valer 27 y CUADRAR con el total troceado. Si
  // alguien arregla otra entrada, esto cae y le obliga a bajar el número aquí: una mejora que pasa
  // desapercibida es cómo un censo acaba declarando 27 cuando quedan 20.
  assert.equal(eximidas.length, 27,
    `🔴 el censo declara 27 exentas y se han medido ${eximidas.length}.\n\n`
    + '  Si has ARREGLADO una entrada, enhorabuena: bájalo aquí y quítala de '
    + '`HEREDADAS_SIN_ANCLA`.\n  Si has AÑADIDO una, no es el sitio — una entrada nueva se mide '
    + 'al escribirla.');
  assert.equal(conAncla.length + eximidas.length, todas.length,
    '🔴 «con ancla» + «exentas» no suman el total de entradas troceadas. O el troceador pierde '
    + 'entradas, o hay una acusada suelta que nadie está viendo.');
});

test('SCRUM-267 · el censo heredado no crece, y si BAJA hay que anotarlo', () => {
  const porClave = new Map(entradasTroceadas().map((e) => [e.clave, e]));

  // (a) Ninguna del censo puede haber desaparecido sin que se note: si alguien borra la entrada
  //     en vez de ponerle el ancla, el censo se quedaria describiendo un fichero que no existe.
  const fantasmas = Object.keys(HEREDADAS_SIN_ANCLA).filter((n) => !porClave.has(n));
  assert.deepEqual(fantasmas, [],
    '🔴 el censo nombra entradas que ya no existen en docs/master/:\n    ' + fantasmas.join('\n    ') +
    '\n\n  Un censo que describe ficheros ausentes deja de medir nada. Quítalas de aquí.');

  // (b) Y si alguna YA tiene su ancla, el número tiene que bajar en el censo. Sin esto, la mejora
  //     pasaría desapercibida y el censo seguiría diciendo que hay tres cuando quedan dos.
  const yaConAncla = Object.keys(HEREDADAS_SIN_ANCLA)
    .filter((n) => porClave.has(n) && !motivoSinAncla(porClave.get(n).cuerpo));

  assert.deepEqual(yaConAncla, [],
    '🔴 ESTAS ENTRADAS DEL CENSO YA TIENEN SU ANCLA:\n    ' + yaConAncla.join('\n    ') +
    '\n\n  Buena noticia, y el censo tiene que reflejarla: quítalas de `HEREDADAS_SIN_ANCLA`.\n\n' +
    '  Que el guard falle por una MEJORA es deliberado, y es la propiedad que separa este censo\n' +
    '  de una allowlist: si bajar fuese silencioso, el censo seguiría declarando tres excepciones\n' +
    '  cuando quedan dos, y nadie sabría nunca cuándo se vació del todo.');
});

test('SCRUM-267 · el formato declarado en el README incluye el ancla', () => {
  // Un formato documentado que NO menciona lo que el guard exige es una trampa para el
  // siguiente: escribe su entrada siguiendo el README, y la suite le dice que está mal.
  const readme = fs.readFileSync(README, 'utf8');
  assert.match(readme, /\*\*Medido contra:\*\*/,
    '🔴 el README de docs/master/ describe el formato de una entrada y NO incluye el ancla que ' +
    'este guard exige. Quien lo siga al pie de la letra escribirá una entrada que sale roja — y ' +
    'la culpa será del formato, no suya.');
});
