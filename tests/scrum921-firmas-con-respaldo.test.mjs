// tests/scrum921-firmas-con-respaldo.test.mjs — SCRUM-921
//
// LA VÍCTIMA: una autorización que no existe, escrita en el árbol por una sesión.
//
// El 17-sep-2026 un bloque de test decía, literal, «el fundador decide que sí se pone» sobre
// SCRUM-878. Ese ticket tiene `comment.total = 0` en Jira —comprobado hoy, 17-sep-2026— y su
// enunciado sólo pide medir y proponer. La frase no la escribió el fundador: la escribió una
// sesión, y desde entonces estaba ahí pareciendo una firma. La confesó S4 y ya está corregida.
//
// ── POR QUÉ ESTO NECESITA UN GUARD Y NO UNA ADVERTENCIA ──────────────────────────────────────
// Un trinquete se discute. Un rojo se discute. Un `[PENDIENTE microcopy]` se discute — todos
// ellos PIDEN algo. Una frase que dice «esto ya está firmado» no pide nada: cierra la
// conversación. Es el único artefacto del árbol que se autovalida.
//
//     🔒 Una prohibición sin mecanismo es una frase; una autorización sin firma es peor,
//        porque además parece un mecanismo.
//
// ── QUÉ EXIGE ESTE GUARD, Y QUÉ NO ──────────────────────────────────────────────────────────
// NO comprueba que la autorización sea CIERTA: eso no lo puede saber un test, y creerse capaz
// sería el mismo error con otra cara. Comprueba que sea **RASTREABLE** — que diga dónde consta.
// Es el criterio que SCRUM-387 ya dejó firmado para `src/` y `public/`, aplicado a la población
// que aquel no mira (`tests/`, `scripts/`, `docs/`) y al léxico que aquel no reconoce.
//
// 🔴 Y ÉSA ES LA MEDICIÓN QUE JUSTIFICA ESTE FICHERO: el caso conocido se le escapó a SCRUM-387
// por DOS ejes a la vez, no por uno.
//     · vivía en `tests/`, y `SCRUM-387` sólo recorre `['src', 'public']`;
//     · decía «el fundador DECIDE», y su marca es `aprobad[oa]s? por el fundador`.
// Arreglar un solo eje no lo habría cazado. Por eso no se toca aquel guard: se complementa.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { censarFirmas, clasificarLinea, bloqueContiguo } from './_censo-firmas-autorizacion.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

// ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────────
// Afirmaciones con la MARCA CANÓNICA de firma («aprobado/autorizado/firmado por el fundador, el
// asesor o el orquestador») que NO dicen dónde consta la decisión. Medido el 17-sep-2026 sobre
// `origin/main` `5f7b994e`: 27.
//
// Sólo puede BAJAR, y bajarlo obliga a tocar esta línea: así la mejora queda escrita. NO se
// arreglan aquí (regla 30 y punto ③ del ticket): reescribir una atribución de aprobación es
// afirmar algo sobre el fundador que esta sesión no sabe, y BORRARLA perdería la decisión si
// resulta que era real y estaba mal registrada. Se congelan, se cuentan y se listan en
// `docs/master/SCRUM-921.md`.
export const SIN_PROCEDENCIA = 27;

const MARCA_CANONICA = /(aprobad|autorizad|firmad|validad|refrendad)[oa]s?\s+por\s+(el\s+)?(fundador|asesor|orquestador)/i;

/** El censo se corre UNA vez: recorre el árbol entero, y eso no sale gratis. */
let CENSO;
const censo = () => (CENSO ??= censarFirmas(RAIZ));
const canonicas = () => censo().candidatos.filter((c) => MARCA_CANONICA.test(c.texto));

/** Un caso suelto, por el MISMO clasificador que el árbol. Si corriera por otro, no controlaría nada. */
const caso = (texto, fichero = 'tests/caso.mjs') => clasificarLinea(texto, { fichero, lineas: [texto], i: 0 });

test('SCRUM-921 · SUELO: el censo ve afirmaciones de autorización de verdad', () => {
  const { poblacion, bruto, candidatos } = censo();

  // Un CERO nunca significa «está limpio»: significa «no he mirado».
  assert.ok(poblacion.ficherosLeidos > 2000,
    `🔴 CIEGO: sólo ${poblacion.ficherosLeidos} ficheros leídos de ${poblacion.ficherosSeguidos} seguidos.`);
  assert.ok(poblacion.lineasLeidas > 400_000,
    `🔴 CIEGO: sólo ${poblacion.lineasLeidas} líneas leídas.`);
  assert.ok(bruto.length > 0, '🔴 CIEGO: 0 apariciones en todo el árbol. El instrumento no ve nada.');
  assert.ok(candidatos.length > 0, '🔴 CIEGO: 0 candidatos tras los descartes.');
  assert.ok(canonicas().length > 0, '🔴 CIEGO: 0 afirmaciones con la marca canónica de firma.');
});

test('SCRUM-921 · CONTROL POSITIVO: el caso conocido sale, y por el eje correcto', () => {
  // El literal exacto que S4 confesó. Nunca llegó a commitearse (`git log -S` lo encuentra en un
  // solo commit: el que lo corrige), así que el control se hace con el caso, no con el árbol.
  const conocido = caso('// el fundador decide que sí se pone');

  assert.ok(conocido, '🔴 el caso conocido de SCRUM-878b NO lo ve el censo.');
  assert.ok(conocido.formas.includes('agente+verbo'),
    `🔴 lo ve, pero por el eje equivocado: ${JSON.stringify(conocido.formas)}. Tiene que entrar por AFIRMAR una autorización.`);
  assert.equal(conocido.procedencia, false,
    '🔴 el caso conocido sale CON procedencia, y no la tenía: el guard lo habría dejado pasar.');
  assert.equal(conocido.motivo, undefined,
    `🔴 el caso conocido se DESCARTA por «${conocido.motivo}». Un descarte que se come el caso que motivó el ticket es un guard apagado.`);
});

test('SCRUM-921 · CONTROL NEGATIVO: citar una decisión CON su id de Jira sale limpio', () => {
  // Es el que tenía que salir verde. Si un instrumento acusa también a quien hace las cosas
  // bien, no distingue nada y acaba apagado. Literal de `docs/microcopy/`, que es la forma que
  // el README de ese directorio fija como correcta.
  const bienPuesta = caso('**Aprobado por el fundador** el 4-sep-2026, en **SCRUM-605** (DOC-15).');
  assert.ok(bienPuesta, 'el censo debe VER la afirmación (verla no es acusarla).');
  assert.equal(bienPuesta.procedencia, true,
    '🔴 una firma que dice su ticket sale como no rastreable: el instrumento acusa a todo el mundo.');

  // La firma DELEGADA de SCRUM-861, con su número de comentario, también es rastreable.
  const delegada = caso('**Aprobado por el orquestador por delegación del fundador** el 16-sep-2026 — SCRUM-861 comentario 15002.');
  assert.equal(delegada.procedencia, true, '🔴 la firma delegada de SCRUM-861 sale como no rastreable.');

  // Y el caso REAL del árbol, no sólo el de laboratorio: el registro de microcopy de SCRUM-651,
  // cuya firma SÍ está verificada en Jira (comentario 14229, 2-sep-2026, aprueba el vocabulario
  // cerrado y sus tres valores). Comprobado a mano el 17-sep-2026.
  const reales = canonicas().filter((c) => c.fichero.startsWith('docs/microcopy/'));
  assert.ok(reales.length > 0, '🔴 CIEGO: el censo no ve ninguna firma en docs/microcopy/.');
  const sinProcedencia = reales.filter((c) => !c.procedencia);
  assert.deepEqual(sinProcedencia.map((c) => `${c.fichero}:${c.linea}`), [],
    '🔴 hay registros de microcopy —el mecanismo que SÍ funciona— marcados como no rastreables.');
});

test('SCRUM-921 · la palabra no basta: una NORMA no es una afirmación', () => {
  // «fundador» aparece 3.656 veces en el árbol. Contar esa palabra no cuenta autorizaciones.
  assert.equal(caso('// sin firma del fundador no se toca este fichero')?.motivo, 'norma-no-afirmacion');
  assert.equal(caso('// hace falta el OK del fundador antes de desplegar')?.motivo, 'norma-no-afirmacion');
  assert.equal(caso('// ¿lo aprobó el fundador, o lo escribió una sesión?')?.motivo, 'norma-no-afirmacion');

  // Y lo que no tiene FORMA de autorización no entra siquiera: ni siquiera es candidato.
  assert.equal(caso('// el fundador usa un iPhone y el panel se le ve mal'), null);
  assert.equal(caso("const albaranFirmado = await prisma.albaran.findFirst({ where: { estado: 'firmado' } });"), null);
  assert.equal(caso('// la plantilla fue aprobada por Meta el 3-jul-2026'), null,
    'un agente EXTERNO como autorizante no casa ninguna forma: no llega ni al descarte.');

  // El descarte de agente externo sólo es alcanzable por las formas que no exigen agente interno.
  assert.equal(caso('// el cambio entró con el OK de Meta, no con el del fundador')?.motivo, 'agente-externo');
  // La firma del PRODUCTO es otra cosa: el cliente firma albaranes, y eso no autoriza cambios.
  assert.equal(caso('// con el visto bueno del técnico, el albarán ya firmado no se reabre')?.motivo, 'firma-del-producto');
});

test('SCRUM-921 · un tercero en la frase NO tapa una autorización del fundador', () => {
  // El defecto propio que más cerca estuvo de publicarse: el descarte de agente externo miraba
  // si la línea NOMBRABA a un tercero, en vez de mirar quién autoriza. Se comía cuatro líneas de
  // `docs/MIGRATIONS_PENDING.md` del tipo «db push contra Railway, autorizado por el fundador»,
  // que es de lo más serio que puede afirmar este árbol.
  const real = caso('`prisma db push` aplicado contra Railway, **autorizado por el fundador** (GO explícito tras el preview)');
  assert.ok(real, '🔴 una autorización de `db push` desaparece del censo por nombrar a Railway.');
  assert.equal(real.motivo, undefined, `🔴 descartada por «${real.motivo}»: el tercero de la frase tapa al fundador.`);

  // Y el caso vivo del árbol, no sólo el de laboratorio.
  const enMigraciones = censo().candidatos.filter(
    (c) => c.fichero === 'docs/MIGRATIONS_PENDING.md' && /autorizad[oa]s?\s+por\s+el\s+fundador/i.test(c.texto));
  assert.ok(enMigraciones.length >= 3,
    `🔴 sólo ${enMigraciones.length} autorizaciones de migración vistas en docs/MIGRATIONS_PENDING.md; el censo vuelve a estar ciego ahí.`);
});

test('SCRUM-921 · el bloque contiguo, no una ventana de N líneas', () => {
  // La versión 1 del censo (17-sep-2026) miraba ±3 líneas y declaró 26 marcas «sin procedencia»;
  // 24 tenían su ticket a más de tres líneas, dentro del mismo comentario. Una ventana fija es
  // una tolerancia disfrazada, y en la dirección mala fabrica acusaciones.
  const lineas = [
    '/**',
    ' * El rótulo, APROBADO por el fundador el 5-ago-2026.',
    ' *',
    ' * El motivo y el ticket están más abajo, que es donde los escribe la casa:',
    ' * SCRUM-300, con la captura.',
    ' */',
  ];
  const conBloque = clasificarLinea(lineas[1], { fichero: 'src/x.ts', linea: 2, lineas, i: 1 });
  assert.equal(conBloque.procedencia, true,
    '🔴 la procedencia está en el mismo bloque de comentario y el censo no la ve: vuelve a cortar por línea en blanco de JSDoc.');

  // Una línea EN BLANCO de verdad sí separa: lo de después es otro párrafo y ya no respalda.
  const otras = [' * APROBADO por el fundador el 5-ago-2026.', '', 'SCRUM-300'];
  assert.equal(bloqueContiguo(otras, 0).texto, ' * APROBADO por el fundador el 5-ago-2026.');
});

test('SCRUM-921 · el trinquete no sube: una firma nueva nace diciendo dónde consta', () => {
  const sin = canonicas().filter((c) => !c.procedencia);
  assert.ok(sin.length <= SIN_PROCEDENCIA,
    `🔴 ${sin.length} afirmaciones de firma sin decir dónde constan, y el trinquete está en ${SIN_PROCEDENCIA}.\n`
    + 'Una afirmación de autorización NUEVA lleva su `SCRUM-<n>` o su `docs/…` en el mismo bloque.\n'
    + 'Las nuevas:\n'
    + sin.map((c) => `    ${c.fichero}:${c.linea}  ${c.texto.slice(0, 110)}`).join('\n'));
});

test('SCRUM-921 · el trinquete tampoco baja en silencio: la mejora se escribe', () => {
  const sin = canonicas().filter((c) => !c.procedencia);
  assert.ok(sin.length >= SIN_PROCEDENCIA,
    `🔴 quedan ${sin.length} y el trinquete dice ${SIN_PROCEDENCIA}. Si se ha arreglado alguna, BÁJALO aquí.\n`
    + 'Y si ha bajado sin que nadie arregle nada, el que se ha roto es el censo: una bajada tiene\n'
    + 'la forma de una mejora, y es como se descubrió que SCRUM-387 llevaba ocho marcas ciegas.');
});
