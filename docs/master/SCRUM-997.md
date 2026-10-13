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
