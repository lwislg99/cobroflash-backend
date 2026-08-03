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

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-267 · toda entrada del registro declara contra qué main se midió, y cuándo', () => {
  const sinAncla = entradas()
    .map((e) => ({ nombre: e.nombre, motivo: motivoSinAncla(e.texto) }))
    .filter((e) => e.motivo)
    .map((e) => `${e.nombre} — ${e.motivo}`);

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
    '  El sha corto no vale: `1bb0b5e` aparece en tres ramas distintas de este repo esta semana.');
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
