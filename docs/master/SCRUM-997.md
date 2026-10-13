# SCRUM-997b · El ticket es del equipo de Luis y no se toca: lo que sí baja a terreno nuestro es el aviso del flag

**Medido contra:** `origin/main` = `9308125e7c7885fb9568fcd633ad8dc1fa021eba` · 2026-10-13T12:57:08Z

A9: aviso → cicatriz J5 «Leer que no cubrimos forales ni Canarias como una regla del producto: ninguna puerta lo impide, el único freno es `INVOICING_ES_ENABLED` en OFF (`getEmissionMode`, 14 llamadas: OFF 7 de 7 `receipt`, ON 7 de 7 `fiscal`, forales incluidos; medido por jv-j5j, SCRUM-1536 c.19355), y hay que resolverlo antes de encenderlo para España» — no se pudo comprobar: el flag se enciende por variable de entorno o por comercio en la base, fuera del repositorio, y la puerta que lo impediría es camino de emisión (regla 40) y está sin decidir

13-oct-2026 · **J5** (sesión `jv-j5k`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
común del 13-oct. Carril J5 (fiscal). Este PR toca DOS ficheros: `docs/equipo/cicatrices/J5.md` (una línea
añadida al final) y este registro. No se ha tocado `docs/equipo/limites-del-fundador.md`, ni `src/`, ni
`prisma/schema.prisma`, ni ningún test, ni el valor de ningún flag, ni ningún texto que vea el usuario.

## Por qué este registro lleva el número de un ticket que no es nuestro

El encargo era escribir en `docs/equipo/limites-del-fundador.md` tres decisiones del fundador sobre
territorio. Antes de editar se leyó de quién era:

| qué | dónde se leyó | qué dice |
|---|---|---|
| etiquetas de SCRUM-997 | Jira, 13-oct-2026 | `equipo-luis` + `area-orquestador` · «Tareas por hacer», sin asignar |
| título de SCRUM-997 | Jira | empieza por «PARA EL ORQUESTADOR DE LUIS» |
| dueño del fichero | `docs/equipo/dos-equipos.md:162` | orquestador de Luis; «El de Javier propone por Jira» |

SCRUM-997 es la petición que el orquestador de Javier le hizo al equipo de Luis el 21-sep-2026 por el canal
correcto (`dos-equipos.md` §5.1). **No se ha editado el fichero ni se ha tocado el ticket.** El orquestador
de Javier dejó el 13-oct un comentario en SCRUM-997 con lo que falta; su número no lo ha leído esta sesión.
La rama se llama `scrum-997b-…` porque así nació el encargo; el registro va donde manda el nombre de la rama.

## La premisa, medida

`docs/equipo/limites-del-fundador.md` en `origin/main` @ `9308125e7`: 184 líneas, 11.753 B.

- Cero líneas para cada una de trece búsquedas, sin distinguir mayúsculas: `foral`, `Pa[ií]s Vasco`,
  `Navarra`, `Canarias`, `IGIC`, `TicketBAI`, `Batuz`, `regiones`, `territori`, `997`, `998`, `1497`,
  `INVOICING_ES_ENABLED`.
- Control positivo: «La credencial de staging que quedó expuesta **NO se rota**» sale en la línea 23.
- Leídas las 15 cabeceras del fichero: ninguna trata de a quién se vende.
- De paso: tampoco está la segunda decisión que pide SCRUM-997 c.16373 (la delegación de Javier del
  22-sep en su orquestador). Cero líneas para `22-sep`, `delego` y `legales ni fiscales`.

La premisa se sostiene: la decisión del 21-sep no está en ese fichero. Lo que cambia es de quién es el hueco.

## Lo que entra en este PR, y de dónde sale

Una línea en las cicatrices de J5 (la del `A9:` de arriba). **Ningún dato de esa línea lo ha medido esta
sesión:** las 14 llamadas a `getEmissionMode` y sus resultados son de jv-j5j, en SCRUM-1536 c.19355 §3,
leído entero el 13-oct. Su guion y su salida viven en la rama `scrum-1536-forales-y-canarias` (PR #2377,
abierto al escribir esto), no en `main`.

Lo único que esta sesión leyó por su cuenta, para escribir el motivo de «sin comprobación»:
`src/core/flags.ts:6-11` (precedencia comercio > país > entorno > valor por defecto) y `:16`
(`INVOICING_ES_ENABLED: false`). Leído, no ejecutado.

## Lo que queda escrito aquí y NO en la cicatriz (una cicatriz es una línea)

Todo de SCRUM-1536 c.19355, citado y no vuelto a medir:

- La función lee `country`, `email`, `flags` e `id`. No lee la provincia ni el domicilio fiscal.
- La regla 33 del máster («Onboarding bloquea facturación ES a domicilios forales») está declarada y
  ninguna puerta lee la respuesta al domicilio foral. El texto propuesto en el enunciado de SCRUM-997 la
  da por mecanismo («la regla 33 ya bloquea»): antes de copiarlo a ningún sitio hay que resolver ese choque.
- Canarias sí está dentro del RD 1007/2023 (art. 1.3 del Reglamento, consolidado): es el mismo sistema
  con IGIC, y nuestro emisor rechaza los cinco tipos propios del IGIC.
- Lo foral va por domicilio fiscal, no por la provincia donde se trabaja.
- Las tres decisiones del fundador y dónde viven hoy: 21-sep (enunciado de SCRUM-997), 23-sep
  (SCRUM-998 c.16609, citado en c.19355 §2) y 7-oct (SCRUM-1497, citado en c.19355 §2).

## Lo que NO se ha medido

- SCRUM-998 c.16609 y SCRUM-1497 no se han abierto: sus fechas y literales se conocen por c.19355.
- Ninguna de las mediciones de jv-j5j se ha reproducido, ni la del BOE.
- La normativa foral (TicketBAI, Batuz, Navarra) sigue sin medir por nadie.
- Ninguna base, nada en yaqu.app, ninguna tanda completa: este PR no toca código.
- Un test que se ponga rojo si cambia el valor por defecto de `flags.ts:16` es posible y no se ha escrito:
  vería una de las tres vías de encendido, y qué debe exigir es decisión de un jefe.

## Errores de esta sesión

- La primera lectura de SCRUM-997 se pidió sin la descripción; hizo falta una segunda llamada.
- La búsqueda de ramas por «997» casó con dos SHA que contienen esos dígitos, no con nombres. Se
  descartaron leyéndolos, y el control siguiente se ancló al nombre de la ref.
- El recuento del fichero se lanzó en el mismo turno que la lectura de etiquetas, no después.
- En el primer aviso al orquestador se dijo que el texto de SCRUM-997 «choca» con la medición sin haber
  leído c.19355; leído después, el choque es el que se describe arriba.

| lo pedido | dónde se ve |
|---|---|
| leer etiquetas y carril antes de tocar | este registro, tabla de arriba |
| verificar la premisa con control positivo | «La premisa, medida» |
| escribir las tres decisiones en `limites-del-fundador.md` | NO HECHO → es del orquestador de Luis; pedido en SCRUM-997 |
| el aviso del flag, donde lo lea quien construya | `docs/equipo/cicatrices/J5.md`, última línea |

# SCRUM-997c · Las cuatro fuentes y las dos delegaciones, escritas en `limites-del-fundador.md` con su mecanismo al lado

**Medido contra:** `origin/main` = `cf0a4cb7eb8613d394f98bc3134ba9a89896839c` · 2026-10-13T14:03:04Z

A9: aviso → cicatriz S0 «Guardé la salida de una sonda con la tubería de PowerShell: la primera vez la sonda no había arrancado y el fichero de salida tenía 1 byte, y la segunda los caracteres que no son ASCII llegaron rotos. La salida de una sonda la escribe la propia sonda, y se cuentan sus bytes antes de citarla» — no se pudo comprobar: es de cómo se lanza un guion desde la consola, y eso no pasa por ningún guard del repositorio

13-oct-2026 · **S0** (sesión `s0-13octe`, equipo de Luis). [Escrito por la sesión, no por Luis ni por su orquestador.]

**Carril.** `docs/equipo/limites-del-fundador.md` es del orquestador de Luis (`dos-equipos.md` §3.3). La
excepción la escribió él en la primera línea del encargo de esta tanda (13-oct-2026): la S0 edita los ficheros
de normas que SCRUM-997 necesita, y sólo lo que el ticket nombra. Este PR toca ese fichero, este registro,
`docs/equipo/cicatrices/S0.md`, `docs/equipo/afirmaciones-verificadas.md` y dos sondas con una salida en
`docs/master/evidencias/SCRUM-997/`. No toca `src/`, `public/`, `prisma/`, ningún test, ningún flag ni ningún
texto que vea el usuario.

## Lo pedido → dónde se ve

Los seis puntos son los de SCRUM-997 c.19389, repetidos en c.19420.

| lo pedido | dónde se ve |
|---|---|
| 1 · la regla 33, como norma | `docs/equipo/limites-del-fundador.md`, sección «Forales y Canarias…», fila 1 de la tabla |
| 2 · 21-sep, no se vende en País Vasco ni Navarra | misma tabla, fila 2 |
| 3 · 7-oct, Canarias | misma tabla, fila 4 |
| 4 · 23-sep, no se hace nada hoy | misma tabla, fila 3 |
| 5 · el estado del mecanismo | misma sección, «El estado del mecanismo, medido el 13-oct-2026» |
| 6 · la delegación del 22-sep (c.16373) | sección «Delegación permanente», debajo de la del 25-sep |
| de cada una, qué es y si algo la cumple | columnas «Qué es» y «¿La cumple algo?»; en la delegación, sus tres viñetas |
| el nombre de quien decidió, no el cargo | las cuatro filas; la del 7-oct dice de dónde sale el nombre y que no está comprobado en origen |
| no copiar el texto del enunciado | no se ha copiado: la frase «la regla 33 ya bloquea» no está en el fichero |
| ni puerta ni flag | `git diff --stat origin/main...HEAD`: ningún fichero de `src/` ni de `prisma/` |

## Lo medido por esta sesión

- **Las cuatro fuentes, leídas enteras:** el máster (regla 33 y las líneas de «Gate foral» y de la Parte M),
  el enunciado de SCRUM-1497, SCRUM-998 c.16609 y SCRUM-1536 c.19355, más el enunciado y los cinco
  comentarios de SCRUM-997 y el enunciado de SCRUM-1121.
- **«IGIC» en el máster: 0 líneas.** Control: «TicketBAI», 5.
- **`getEmissionMode`, 35 llamadas** (7 comercios fabricados por 5 combinaciones del flag), con un espía de
  propiedades y cuatro controles: `docs/master/evidencias/SCRUM-997/sonda-997.cjs` y su salida al lado.
  Sin variable ni valor propio, 7 de 7 `receipt`. Con la variable en `true`, 7 de 7 `fiscal`. Con el valor
  del comercio en `true` y sin variable, 7 de 7 `fiscal`. Con el valor del comercio en `false` y la variable
  en `true`, 7 de 7 `receipt`. Leídas: `country`, `email`, `flags`, `id`. Corre contra `dist/`, compilado de
  `f3090b1c3`; `src/core/flags.ts` y `emission.service.ts` no cambian entre ese commit y el del ancla.
  Coincide con las 14 llamadas de jv-j5j; su guion no se ha usado (vive en el PR #2377, sin mergear).
- **Quién lee `domicilioFiscalForal`:** buscado en `src/`, `prisma/` y `public/`. Sale en el esquema, en la
  validación, en una lectura de la consola del equipo y en la pantalla de Configuración. En ninguna puerta.
- **Qué línea sostiene la firma delegada:** `docs/master/evidencias/SCRUM-997/vigencia.mjs`. Sin ninguna
  línea que nombre a Javier, `delegacionVigente` da `true`; sin la viñeta de Luis, `false`.

## Lo que el ticket daba por cierto y la medición matiza

- **«La autoridad del orquestador de Javier para firmar microcopy vive sólo en un comentario de Jira»**
  (c.19381 y c.19389). No del todo: la delegación del 25-sep (SCRUM-1121, «te lo delego») está en el fichero
  desde ese día (commit `978a24966d472f6ecd8a1b2755a0bd6af566270b`). La que vivía sólo en Jira es la del
  22-sep, que es otra y dice otra cosa. Las tres búsquedas de c.19381 dan 0 con razón, y ninguna busca
  «Javier», que es como se ve la del 25-sep.
- **«El flag se enciende por tres vías: por comercio, por país o por variable de entorno»** (c.19389). El
  país no enciende nada: un comercio de MX da `fiscal` sin pasar por el flag, aunque lleve el valor en
  `false`. Los tres sitios son el valor del comercio, la variable y el valor por defecto del código.
- **«No se bloquea el alta», como si fuera el literal del 23-sep.** c.16609 no lleva palabras de Javier: lo
  redacta su orquestador y dice «NO se hace nada hoy». Así se ha escrito.
- c.19355 cita `prisma/schema.prisma:57`; hoy la columna está en la línea 61. En el fichero de límites se
  cita por el nombre de la columna.

## Lo que NO se ha medido

- Ninguna base. No se sabe si hay algún comercio con el flag encendido en su fila, ni con «Sí» en el
  domicilio foral, ni qué vale la variable en producción.
- El chat donde Javier dijo lo del 7-oct y lo del 13-oct: está en otra máquina. SCRUM-1522 c.19294 no se
  ha abierto.
- La lectura del BOE y el rechazo de los tipos del IGIC son de jv-j5j y de J4c: se citan, no se repiten.
- Nada en yaqu.app: este PR no cambia nada que se vea.
- La tanda completa: no hay código tocado. Corridos los guards de entrada y los tests que leen estos
  ficheros (la lista, en el comentario de entrega del ticket).

## De paso, de otro carril: se dice y no se arregla

El oráculo de microcopy no tiene con qué distinguir la firma delegada del orquestador de Javier de la del de
Luis: las dos escriben la misma frase y las dos dependen de la viñeta de Luis. Si Javier retirase su
delegación, sus firmas delegadas seguirían contando. Es del carril de microcopy.

## Errores de esta sesión

- La sonda no arrancó la primera vez que corrió desde el árbol (raíz relativa) y el fichero de salida quedó
  en 1 byte. Lo enseñó el recuento de bytes, no el código de salida de la orden, que encadenaba más cosas.
- En el primer borrador de la tabla escribí «el alta no pregunta el territorio»: desde el PR #2374 el alta
  por consola recibe una provincia, para la zona horaria. Corregido antes del primer commit.

| lo pedido | dónde se ve |
|---|---|
| los seis puntos, con qué es cada uno y si algo lo cumple | `docs/equipo/limites-del-fundador.md` (tabla de arriba, fila a fila) |
| la medición del flag, repetida o citada como ajena | repetida: `docs/master/evidencias/SCRUM-997/sonda-997.cjs` |
| visto en yaqu.app | NO APLICA: no cambia nada que se sirva |

La pieza del oráculo de microcopy que salió de esta medición (rama `scrum-997d-el-oraculo-declara-lo-que-no-comprueba`,
PR #2400) tiene ticket propio, SCRUM-1546, y su registro está en `docs/master/SCRUM-1546.md`.
