# SCRUM-1329 · una cita firmada puede ser larga; la prosa, no

**Medido contra:** `origin/main` = `a5b62893c7616ddd19626afe5921eec67c691e9e` · 2026-10-01T03:37:57Z (J2e, equipo de Javier)

A9: aviso → cicatriz J2 «conté frases cortando también en dos puntos y punto y coma, y la medición dijo «ninguna frase firmada pasa de 160» cuando había dos» — no se pudo comprobar: qué es una frase lo decide el cortador que se escribe para cada medición, y no hay instrumento común que fijar

**Decisión:** encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`), por su ficha
de relevo del 1-oct-2026. No hay firma del fundador ni hace falta: no cambia ningún texto que vea
el usuario, ningún estado y ningún envío. Se toca un guard de `guards:entrada`, y por eso el ticket
pedía las cuatro cosas de abajo y en ese orden.

## ① Qué vigila `scrum514` de verdad

`tests/scrum514-aprobado-y-aplicado.test.mjs` comprueba que **todo texto aprobado está pintado**:
saca los textos de las fichas de `docs/microcopy/` y del registro congelado, y busca cada uno, tal
cual, en `src/` y `public/`.

El «más de 160» no es esa regla. Es un **control del extractor**: que entre los textos que se
cruzan no se haya colado una nota del registro, prosa que nadie pinta. Nació el 4-sep-2026 (commit
`8ad16a89`), cuando el cruce con todas las citas del registro daba 13 «sin aplicar» y unas 11 eran
notas. La longitud y la negrita de Markdown son la forma barata de reconocer una nota.

El motivo sigue siendo válido. Lo que falla es el sustituto: la longitud no distingue una nota de
una frase larga que el fundador firmó y que sí está en la pantalla.

Y una cosa más que salió al leerlo: de una ficha, `scrum514` sólo lee las citas que van bajo un
encabezado que contenga «Texto aprobado», en singular.

## ② La población

Instrumentos en `tests/banco-scrum1329/` (`medir-citas.mjs`, `medir-secciones.mjs`,
`medir-frases.mjs`), sólo lectura.

| qué | cuántos | sobre |
|---|---|---|
| citas de más de 160 caracteres | 4 | 251 citas en 101 fichas |
| celdas de más de 160 en el registro congelado | 0 | 148 literales |
| frases de más de 160 **en una sola frase** | 2 | 290 frases de las fichas, más 163 del congelado (la más larga, 111) |

No es prevención: hay dos frases firmadas de más de 160, y las dos pasan hoy **sin que el guard las
mire**.

- `2026-09-30-SCRUM-1126-fusion-direcciones-de-obra.md`, 197 caracteres en una frase. Lleva huecos
  (`{fusionado}`), y las plantillas salen del cruce antes de llegar al control de longitud.
- `2026-09-28-SCRUM-1247-rotulo-ia.md`, una cita de 276 con una frase de 164. Está pintada tal cual
  en `public/dashboard/js/aiQuoteAssistant.js`, pero su encabezado es «Textos aprobados, literales»,
  en plural, y `scrum514` no lee esa sección.

Las otras dos citas largas son las de `2026-09-17-SCRUM-887-descuento-global-varios-iva-facturar.md`
(171 y 181, dos frases cada una). Ahí el rodeo fue a propósito y está escrito en la ficha: las
frases completas van bajo «Frases aprobadas, completas» y bajo «Texto aprobado» van sus partes
fijas. La parte común mide 149.

La de SCRUM-1258 entró en `main` mientras se hacía este ticket, partida en dos líneas de cita.
Juntas miden **205** caracteres. El ticket dice 196; no es lo que mide el literal.

### Lo que no cruza `scrum514`, medido

| sección de la cita | citas | sin huecos | pintadas tal cual | no pintadas |
|---|---|---|---|---|
| «Texto aprobado…» (la que se cruza) | 110 | 108 | 102 | 6 |
| otro encabezado que parece de textos aprobados | 106 | 90 | 79 | 11 |
| el resto (historia, notas, «qué había antes») | 32 | 31 | 4 | 27 |

Los 106 de la segunda fila van bajo nueve títulos distintos: «Los literales, tal cual se pintan»
(45), «Textos aprobados, literales» (23), «Formato aprobado, literal» (15) y seis más. Sus 11 no
pintadas, por el nombre de la ficha y el principio de la cita: ocho son ejemplos de textos que el
código compone («3 fotos», «1 parte firmado de 1 cliente»), dos son las frases completas de
SCRUM-887, y una es la de SCRUM-1124 (159 caracteres), que **sí** está en
`src/modules/jobs/domain/jobDireccion.ts` pero partida con `+`, así que el cruce literal no la
encuentra. Sólo esa última la he ido a buscar al código; de las otras diez no he comprobado que el
texto llegue a la pantalla. Esto no se toca aquí: meter esas secciones en el cruce cambia la
población de un guard de entrada y saldría rojo por los ejemplos. Queda dicho al orquestador.

## ③ La distinción

Una cita de más de 160 deja de ser prosa si se cumplen **las tres** cosas, y las tres se comprueban
leyendo ficheros:

1. su ficha lleva una firma que cuenta. Lo decide el lector de siempre
   (`tests/_microcopy-aprobada.mjs`): la del fundador, o la delegada con la delegación vigente;
2. la línea de esa firma nombra el comentario de Jira. En la misma línea, que es el criterio que
   SCRUM-861 ya puso para la firma delegada;
3. el texto está pintado tal cual en el código. Es lo que una nota no cumple nunca, y es lo que de
   verdad separa una cita de una nota dentro de una ficha firmada.

Si falta alguna, el guard cae y dice cuál: «NO SÉ si es una cita firmada o prosa». El umbral sigue
en 160 y la negrita sigue siendo prosa siempre.

Lo que **no** comprueba: que el comentario citado contenga ese texto. Un test no lee Jira.

La convención queda escrita al final de `docs/microcopy/README.md`.

## ④ El rojo primero

Commit `5b875aec2869a66b2b73c912e15d60136de3fd0a`: el extractor ya devuelve la procedencia y admite
fichas fabricadas, pero el criterio es el viejo. 14 casos, 9 pasan, 5 caen. El del ticket cae con
`pasa de 160 caracteres (205)`.

Con el criterio nuevo: 17 casos, 17 pasan, 0 saltados.

Los controles que lo separan de relajar el guard, todos con una ficha fabricada en un directorio
temporal y comprobando antes que la cita llegó al extractor:

- una nota larga dentro de una ficha firmada y con comentario: cae, no está pintada;
- el mismo literal de SCRUM-1258 en una ficha sin firma: cae, aunque esté en el código;
- firmado por quien no puede aprobar: cae;
- firmado, pintado y sin comentario en la línea de la firma: cae;
- el comentario nombrado en otra línea de la ficha: cae;
- una celda larga del registro congelado: cae;
- negrita de Markdown, con firma y pintada: cae;
- 160 caracteres sin firma pasan y 161 caen, y el umbral vale 160.

Con el árbol real: puesta la ficha de SCRUM-1247 bajo «Texto aprobado» (un cambio de una línea,
deshecho después), el criterio viejo cae con `pasa de 160 caracteres (276)` y el nuevo pasa.

Mutaciones (`tests/banco-scrum1329/mutar.mjs`): 9 de 9 tumban su caso, base verde antes y después,
y el fichero restaurado por contenido.

## Lo que queda fuera

- Las 106 citas de secciones que `scrum514` no lee. Arriba.
- `textosAprobados()` no mira si la firma de la ficha cuenta para las citas de 160 o menos. Hoy las
  101 fichas cuentan, así que no cambia nada; no lo he tocado.
- Las fichas de SCRUM-1247 y SCRUM-1258 se quedan como están. Son de otros puestos.

## Mis errores

- Conté frases cortando también en `:` y `;`, y la primera medición dijo que ninguna frase firmada
  pasaba de 160. Eran dos. Lo vi al repetir la cuenta cortando sólo en punto, interrogación,
  exclamación y puntos suspensivos. No llegó a ningún informe.
- Escribí una guarda redundante (`deFicha &&` en la firma) que habría dejado una mutación muda. La
  quité antes de correr el banco.

## Verificación

- `node --test tests/scrum514-aprobado-y-aplicado.test.mjs`
- `node tests/banco-scrum1329/mutar.mjs`
- `npm run guards:entrada`
