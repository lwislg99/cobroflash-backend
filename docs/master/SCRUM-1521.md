# SCRUM-1521 · Punto ①: se retira `e2e-critico` y lo que prometía en su nombre

**Medido contra:** `origin/main` = `0472952cd2c54e1c336170fa502ca902e6fda8cf` · 2026-10-13T00:15:56Z

A9: comprobación → `tests/scrum183-consola-e2e.test.mjs`

13-oct-2026 · **J3** (sesión `jv-j3`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J3. Las decisiones se leyeron en Jira, SCRUM-1521: c.19145 y c.19152.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (no reconoce `jv-j3`, SCRUM-1498); se siguió,
como manda la ficha común del 13-oct. Se escribe en dos contenedores de la S0 porque sus propios guards lo
piden en el mismo PR (abajo, «Lo que arrastró»), y en `docs/legal/` con la autorización de c.19152.

## La decisión

«OK retira.» — el fundador, 13-oct-2026, transcrito en c.19145. Autoriza retirar el guion
`scripts/e2e-critico.mjs` y su orden de `npm`.

**El motivo, con las palabras del encargo:** un recorrido de «¿despliego tranquilo?» que lleva once semanas
sin correr no da tranquilidad, la simula. Medido la semana pasada (SCRUM-1515): nada lo lanzaba
automáticamente —`.github` 0, `.claude` 0, ningún guion de `package.json` lo encadenaba, ningún test lo
ejecutaba—, último cambio el 2-ago-2026 y última ejecución que consta el 28-jul-2026. Y desde que se cerró
el alta pública ya no podía correr: creaba su merchant efímero por esa ruta.

## Paré antes de borrar, y por qué

Antes de tocar nada miré el ancla legal que c.19145 mandaba mirar. `docs/legal/AUDITLOG_FISCAL_CONTRATO.md`,
fila «Limpieza de staging» de la tabla de consumidores del AuditLog, citaba la línea 305 del guion con «Lo
borra (mantenimiento)». **Era cierto:** esa línea era el `auditLog.deleteMany` de la limpieza del merchant
efímero. Borrar el guion dejaba un documento legal citando un fichero inexistente. Paré y lo subí (c.19146)
junto con dos cosas que la decisión no nombraba: el máster y el oyente de la consola.

Las respuestas están en c.19152:

- **Documento legal:** «Sí» del fundador a tocarlo, y se **tacha con nota fechada**; no se borra ni se
  mueven líneas. La fila fue verdad, y quien la lea dentro de un año tiene que ver que lo fue y cuándo
  dejó de serlo.
- **Máster:** autorizado en principio, **texto pendiente de firma. NO TOCADO.**
- **`scripts/_console-guard.mjs`:** se queda (decide el orquestador), declarado como sin consumidor.

## Qué cambia

- **Retirados:** el guion y su entrada en `package.json`. La orden de `npm` da `Missing script` (salida 1):
  deja de existir, no «falla distinto». `npm run` lista 98 guiones y ninguno con «e2e».
- **`docs/QA_MASTER.md`, «Estándar de cierre»:** se quita la tercera orden del bloque y en su sitio queda
  una nota fechada que dice qué había, por qué se retiró y que hoy nada de ese estándar recorre la cadena
  de dinero de punta a punta en un navegador. El §1 («E2E crítico», la lista MANUAL de casillas) no se ha
  tocado: no es el guion.
- **`docs/legal/AUDITLOG_FISCAL_CONTRATO.md:130`:** la cita, tachada, con su nota. La fila conserva su otra
  cita, así que sigue diciendo algo.
- **`scripts/_anclas-sin-testigo.congelado.mjs`:** fuera el par del documento legal con el guion. El
  conjunto sólo encoge, y `scrum525d` lo exige en el mismo commit.
- **`tests/scrum258`:** el residuo de identificadores sueltos pasa de dos a vacío. Los dos vivían en el
  guion. No se arregló el análisis: desapareció el fichero, y así queda escrito encima de la constante.
- **`tests/scrum183`:** se va el caso que leía el guion para exigir que tuviera el guard enchufado; el
  comportamiento que comprobaba ya no existe. Los siete casos que prueban QUÉ cuenta como fallo se quedan
  igual. Entra uno nuevo (abajo).
- **Tres comentarios** que lo nombraban como existente (`tests/scrum262`, `tests/scrum132`,
  `scripts/pasada-real-etiquetas-del-documento.mjs`): ahora dicen que se retiró.

## El oyente de la consola: se queda, y la condición no cabía donde se dijo

c.19152 pide declararlo en `scripts/_sin-consumir-declarados.json`. **No se puede, y lo medí en vez de
razonarlo:** ese censo sólo recorre `src/` y `public/`; con una fila fabricada para el ayudante,
`tests/scrum1185` cae en «una pieza declarada que YA SE CONSUME sale de la lista». Además es contenedor de
la S0. La declaración va donde sí se sostiene:

- en la cabecera del propio `_console-guard.mjs`, con motivo y fecha;
- y en un caso nuevo de `tests/scrum183`, que **mide** que nadie lo importa salvo su test. El día que
  alguien lo enchufe, cae y dice qué notas hay que quitar. Sin eso, la declaración sería otra frase que
  caduca sin que nadie la lea.

**Lo que se pierde, dicho sin adornar:** desde hoy ningún recorrido escucha errores de JavaScript de
página. Tampoco lo hacía de hecho desde el 28-jul.

## Lo que arrastró y no estaba en el encargo

`tests/scrum1480f` cayó: de los 225 guiones de la foto del 9-oct quedaban 224 sin fila. Su mensaje manda
bajar `suelo.quedan` «en este mismo PR» si se ha borrado uno; es lo que se ha hecho (225 → 224) en
`scripts/_sin-fila-declarados.json`. No es ajustar un número a mano: es el recuento que el guard recalcula
y exige declarar.

## Visto en rojo

Cuatro mutaciones sobre el árbol ya cambiado, restaurado después (el `git diff` de antes y de después da el
mismo sha256):

| Qué se hizo | Se esperaba | Salió |
|---|---|---|
| Cita tachada, par congelado SIN quitar | rojo | `scrum525d` 1 caído de 8 (el trinquete) |
| Cita SIN tachar, par puesto, guion borrado | verde | `scrum525d` 8 de 8 |
| Fila del ayudante en `_sin-consumir-declarados.json` | rojo | `scrum1185` 1 caído de 11 |
| Un importador fabricado de `_console-guard.mjs` | rojo | `scrum183` 1 caído de 8 (el caso nuevo) |

🔴 **La segunda fila es un agujero, y no lo he arreglado:** si se borra un fichero que un documento de
`docs/legal/` cita **sin testigo**, ningún test cae. El censo lo cuenta entre los que «no resuelven» y lo
imprime; nada lo exige. Hoy lo paró una persona leyendo, no un guard. Hay 81 coordenadas sin testigo en
`docs/legal/` (salida de `scrum525d` en esta rama).

## El recuento

Instrumento: los ficheros seguidos por git, línea a línea, patrón `e2e[-:]critico`. Positivo **sembrado**
(un fichero fabricado fuera del árbol con dos líneas): las ve; sin la siembra dice CIEGO y sale 2. Control
de cero (el patrón con una letra cambiada): 0.

| | Ficheros | Líneas | Fuera de `docs/` | Población |
|---|---|---|---|---|
| Antes, `0472952cd` | 25 | 38 | 8 ficheros, 12 líneas | 6.029 |
| Después, esta rama | 22 | 31 | 6 ficheros, 6 líneas | 6.028 |

El encargo decía 22 y 35: era mi medición de la semana pasada. Los tres ficheros de más se crearon el 8 y
el 9-oct (este registro vecino de SCRUM-1515 y dos evidencias de SCRUM-1480); que la diferencia sea
exactamente ésa lo deduzco de las fechas, no repetí la medición vieja.

**El «después» no es cero, y no debe serlo.** Las 31 que quedan:

- **6 fuera de `docs/`, todas notas de la retirada:** la cabecera del ayudante, los tres comentarios, y las
  notas de `scrum183` y `scrum258`.
- **1 tachada:** la del documento legal.
- **4 del máster, sin tocar.** La 820 afirma en presente que el guion «existe y está probado»: **hoy es
  falsa** y espera el texto firmado. Las otras tres son historia de SCRUM-183.
- **20 de historia fechada** (registros de `docs/master/`, evidencias, `SPRINT_DEMO_READY_EXT3.md`,
  `asuntos-jira.tsv`): no se reescriben.

Este registro nombra al guion y por tanto se suma al recuento: la tabla de arriba se midió ANTES de escribirlo. Con él dentro son 23 ficheros y 33 líneas.

## Dicho y NO arreglado

1. **`docs/YAQU_MASTER.md:820`** — arriba. Pendiente de la firma del texto.
2. **`src/core/http/publicAccessDeclarations.ts:114`** (punto ② del ticket, carril S1, equipo de Luis): sin
   tocar. La decisión no lo cubre.
3. **La otra cita de la misma fila legal, `clean-staging-tests.mjs:78`, ya estaba desfasada:** la 78 es hoy
   un `return;` y el borrado del AuditLog está en la 175. No es consecuencia de esta retirada y c.19152
   manda no arreglarla aquí. Tampoco lleva testigo, así que nada la caza.
4. **No hay recorrido que sustituya al retirado.** La decisión no lo autoriza; si hace falta, se propone.
5. **`docs/QA_MASTER.md` §1** sigue pidiendo a mano «Registro + onboarding completos (merchant nuevo)» con
   el alta pública cerrada. Leído, no decidido: no es este ticket.

## Una cosa de SCRUM-1515 que se cierra aquí

La aceptación 3 de SCRUM-1515 —el login completo en producción, que dejé sin hacer en Jira c.18996 porque
pedía un correo real— queda cerrada: el fundador ha entrado en yaqu.app y puede entrar (dicho por el
orquestador en el encargo del 13-oct; no lo he comprobado yo).

## Mis errores

- **Di por bueno el recuento del ticket sin volver a medirlo hasta que mi propio instrumento dio otro.**
  Era mío y tenía cinco días. Lo cazó el censo, no yo leyendo.
- **En c.19146 afirmé «ningún test cae» habiéndolo sólo leído**, y lo dije así. Lo ejecuté después: era
  cierto (segunda fila de la tabla).
- **No vi venir el rojo de `scrum1480f`.** Mi barrido buscaba el NOMBRE del guion; ese guard cuenta
  ficheros y no nombra ninguno. Lo cazó correr los guards vecinos antes de la tanda.
