# SCRUM-1418 · Las sesiones que se pararon y nunca volvieron: ¿entregaron, o se lo llevaron?

**Medido contra:** `origin/main` = `a096c7faf486e7ca4332c16f95344dc06220bbab` · 2026-10-02T12:10:13Z

A9: comprobación → `tests/scrum1418-sesiones-que-no-volvieron.test.mjs`

Carril S0 (`scripts/` de verificación, `tests/`, `docs/`). Sale de la medida de SCRUM-1414 y reusa su
lector (`scripts/espera-del-equipo.mjs`): esta rama nace de la de 1414.

`node scripts/sesiones-que-no-volvieron.mjs [--sin-arboles] [--control-si <sesión>] [--control-no <sesión>]`

**Este script no borra, no empuja y no rescata nada.** Mide. Qué se hace con lo que encuentra lo reparte
el orquestador.

## El método, y por qué no es el del encargo

El encargo proponía «entregó si hay un traspaso escrito después de su `createdAt`», llamando al latido.
No sirve para una serie: el traspaso es UN fichero por puesto que se reutiliza, y solo existe su fecha de
hoy. Toda sesión anterior a la última escritura saldría «entregó», la escribiera ella o la siguiente. El
latido lo sabe y solo juzga las sesiones de las últimas horas; ahí sigue siendo el instrumento.

| mitad | qué mira | dato |
|---|---|---|
| 1 · la sesión | SU transcripción: una llamada `Write`/`Edit` a un `*traspaso*.md` | estructurado, y suyo |
| 2 · el repositorio | ramas locales que no están en `origin` y cuyo contenido cambiaría `main`; árboles con cambios sin comitear | git, comprobable por cualquiera |

## Medido: 17-sep → 2-oct-2026

Población: 259 trabajos, 245 sesiones de puesto con línea de tiempo. 173 se pararon y no volvieron. Las
otras 72 acabaron su línea de tiempo en «working» (siguen vivas, o murieron trabajando): **no están miradas**.

Controles, sobre dos sesiones reales: `s0-1oct` sale ENTREGÓ y `s0-1octb` sale NO ENTREGÓ, como se sabe que fue.

### Mitad 1 · la sesión

| | sesiones |
|---|---|
| ENTREGÓ AL CERRAR | 151 |
| ENTREGÓ Y SIGUIÓ (entre 1 y 5 ediciones o commits después del último traspaso) | 6 |
| **NO ENTREGÓ** | **16** |
| NO SUPE | 0 |

Las 16 que no entregaron, por tandas:

| cuándo se pararon (UTC) | sesiones | lo que se sabe |
|---|---|---|
| 17-sep 20:27–20:32 | sesion-0 a sesion-5 (6) | las seis a la vez. El primer día de la serie; no he mirado si entonces existía la norma del traspaso |
| 22-sep | s0-22a, s5-22b | — |
| 25-sep | s2-25a, s0-25c, s4-25b | — |
| 28-sep | s4-28a | — |
| **1-oct 14:10** | s0-1octb, s1-1octe, s3-1octf, s5-1octd (4) | las cuatro en el mismo minuto: la parada en seco por el límite semanal |

10 de las 16 son dos paradas colectivas. Una sesión a la que se le corta la cuota no puede escribir su
traspaso: no es un descuido suyo.

### Mitad 2 · el repositorio

1.098 ramas locales miradas: 1.034 en `main`, 37 en `origin`, 2 solo locales sin contenido nuevo, 0 sin poder mirar.

**26 ramas tienen commits que no están en `origin` y cuyo contenido cambiaría `main`.**

**A · En `origin` hay una rama con ese nombre y va POR DETRÁS de la local (2).** Ninguna de las dos tiene
PR, ni abierto ni cerrado (`gh pr list --head`, 2-oct).

| rama | último commit | commits | ficheros | fusionarla | la nombran |
|---|---|---|---|---|---|
| `scrum-240-sobre-duplicado-rebasada` | 3-ago | 2 | 6, entre ellos `src/modules/fiscal/verifactu/registro.builder.ts` | choca | sin sesión conocida |
| `scrum-418-puerta-de-produccion` | 11-ago | 2 | 4: `CLAUDE.md`, `src/core/db/prisma.ts`, `src/core/db/puertaDeProduccion.ts`… | entra limpia | s5-21d, s5d-20, s5-21g |

**B · No están en `origin` (24).**

| rama | último commit | commits | ficheros | fusionarla | la nombran |
|---|---|---|---|---|---|
| `scrum-27-pagos-flex` | 10-jul | 2 | 9 (`prisma/schema.prisma` entre ellos) | choca | — |
| `scrum-34-tramos-ux` | 11-jul | 2 | 8 | choca | — |
| `scrum-39-magic-link-log` | 12-jul | 1 | 1: `src/modules/auth/domain/auth.service.ts` | choca | — |
| `scrum-42-seed-id1-y-suite` | 12-jul | 1 | 2 | choca | — |
| `scrum-54-collect-rest-role` | 15-jul | 1 | 4 | choca | — |
| `scrum-78-qa-determinismo` | 22-jul | 1 | 1: `tests/pdfs.test.mjs` | choca | — |
| `scrum-114-enviar-para-firmar-ok-false` | 23-jul | 1 | 2 tests | entra limpia | — |
| `ci-prueba-en-rojo` | 27-jul | 1 | 1: `tests/zz-ci-prueba-rojo.test.mjs` | entra limpia | — |
| `scrum-209-desglose-conforme` | 29-jul | 2 | 13 | choca | — |
| `scrum-234-carrera-numeracion-rebasada` | 2-ago | 5 | 9 (numeración de facturas y albaranes) | choca | — |
| `scrum-272-criterio-referencial` | 2-ago | 1 | 3 | choca | — |
| `scrum-240-sobre-duplicado` | 2-ago | 2 | 6 | choca | — |
| `scrum-225-lista-a-mano` | 3-ago | 2 | 4 | choca | — |
| `scrum-240-sobre-duplicado-rebasada-3` | 3-ago | 3 | 7 | choca | — |
| `scrum-312-importador-clientes` | 5-ago | 1 | 2: `importarClientes.service.ts` y su test | entra limpia | — |
| `scrum-300-campos-albaran` | 6-ago | 5 | 18 | choca | — |
| `scrum-804b-el-barrido-de-la-42` | 24-sep | 1 | 2 | choca | s5-24c, s5-24b, s3-24b, s3-24a |
| `scrum-1132-notas-cliente-pantalla` | 25-sep | 1 | 2: `customerDetailView.js` y su registro | choca | s2-26a, s2-25f |
| `scrum-938-arregla-censo-lista-fixture` | 26-sep | 1 | 1: su registro | entra limpia | s3-26a |
| `scrum-1100c-el-resumen-explica-el-corte` | 27-sep | 1 | 1: su registro | entra limpia | s3-27a, s3-26b |
| `scrum-1093h-censo-guard-fecha-zona` | 27-sep | 1 | 1 test | choca | s3-27a |
| `scrum-1230b-anadir-al-parte-LOCAL` | 28-sep | 1 | 2: `parteDetailView.js` y un test | choca | s4-29a, s4-28e |
| `scrum-1415-nombres-construidos-a-literal` | 2-oct | 4 | 14 | entra limpia | s3-2octb (trabajo de hoy, en curso) |
| `scrum-1418-sesiones-que-no-volvieron` | 2-oct | — | — | — | s0-2oct (esta rama, antes de empujarla) |

Quitando las dos de hoy, que son trabajo en curso: **24 ramas con trabajo que nunca llegó al servidor**,
16 de julio y agosto y 6 de septiembre, más las 2 del grupo A.

**El caso completo — una sesión que NO ENTREGÓ y que nombra una rama que no está en `origin`: ninguno.**
Las seis ramas de septiembre las nombran sesiones que sí escribieron su traspaso.

**Árboles de trabajo:** 312 mirados, 0 sin poder mirar. 46 solo tienen ficheros del arnés
(`.claude/settings.local.json`, `.playwright-mcp/`). **15 tienen cambios sin comitear que son trabajo**; de
ellos, 4 son de sesiones de hoy (`s1-1379b`, `wt-s3-1412`, `wt-s5-1364`, este mismo) y el checkout
compartido lleva 44 ficheros. La lista completa sale en cada pasada.

## Lo que NO se puede decir con esto

- **«Choca» no es «trabajo perdido».** 19 de las 26 chocan al fusionarlas hoy. Eso pasa también cuando su
  trabajo entró por otra rama y `main` siguió cambiando esas líneas. Solo leyéndolas se sabe cuánto
  aportan. **No las he leído.** Las 7 que entran limpias sí cambiarían `main`.
- **El ticket sale del NOMBRE de la rama.** No he mirado en Jira si cada ticket está cerrado, ni si otra
  rama del mismo ticket llevó el trabajo.
- **Las ramas de julio y agosto no tienen sesión conocida** porque las transcripciones empiezan el 17-sep.
  No se atribuyen a nadie, tampoco a un equipo.
- **«Entregó» es «escribió un traspaso», no «el traspaso era bueno».**
- **Las 72 sesiones que acabaron en «working» no están miradas.** Una que murió trabajando no tuvo ocasión
  de entregar, y esta medida no la ve.
- **Solo ve esta máquina.** Lo que haya en la del equipo de Javier no está.

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Población declarada: cuántas sesiones de puesto se miran, cuántas son «colas» (se pararon y no volvieron), la ventana, y cuántas quedan fuera y por qué. | `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` («la medida entera») |
| Tres cubos, y el tercero no es ninguno de los otros dos: ENTREGÓ (su transcripción tiene una escritura a un fichero de traspaso) · NO ENTREGÓ (transcripción leída entera y sin esa escritura) · NO SUPE (sin transcripción, ilegible, o cortada). NO SUPE se cuenta aparte y se nombra. | `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` («los cuatro cubos», «LEER el traspaso») |
| Control positivo y negativo sobre casos reales con nombre: una sesión que se sabe que escribió su traspaso sale ENTREGÓ, y una que se sabe que no, NO ENTREGÓ. Si el control no sale, la pasada sale 2. | `scripts/sesiones-que-no-volvieron.mjs` (`CONTROL_SI`, `CONTROL_NO`) · `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` («los controles prueban al lector») |
| Lo que quedó sin empujar, medido sobre el repositorio y no sobre lo que la sesión dijo: ramas locales que no están en `origin` y cuyo contenido cambiaría `main` (por contenido, no por ancestría), con sus commits y ficheros; y árboles de trabajo con cambios sin comitear. Con población: cuántas ramas locales y cuántos árboles se miraron. | `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` («el censo de ramas», «la medida entera») · `docs/master/SCRUM-1418.md` («Mitad 2») |
| Fail-closed: si git no se deja leer, o un árbol no se puede mirar, se dice y no cuenta como «limpio». Sale 2 si no pudo medir. | `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` («fail-closed») |
| No se atribuye lo que no se puede atribuir: si una rama local no se puede asignar a una sesión, sale como «sin sesión conocida», no repartida a ojo. | `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` («la medida entera»: la atribución es por nombre entero) |
| Tests con transcripciones y repositorios fabricados, probados en rojo. | `tests/scrum1418-sesiones-que-no-volvieron.test.mjs` · «Probado en rojo», abajo |
| No se borra, no se empuja y no se rescata nada. El ticket mide. Qué se hace con lo encontrado lo decide el orquestador. | `scripts/sesiones-que-no-volvieron.mjs` (solo órdenes de lectura de git) |

## Probado en rojo

Trece mutaciones sobre el script, con la base sin mutar en verde. Doce tumbaron el test a la primera:
leer el traspaso cuenta como escribirlo · vale lo que diga cualquier entrada · una transcripción cortada
se da por buena · no cuenta desde el último traspaso · tocar la memoria cuenta como seguir · un zombi sale
acusado · una rama ya empujada sale acusada · la fusión que no contesta no es ciega · los controles no
tumban la pasada · atribuye por subcadena del nombre · el ruido del arnés cuenta como trabajo · un árbol
sin mirar se calla. La decimotercera, abajo.

## Mis errores

1. **Una mutación sobrevivió: «un control que sale NO SUPE vale».** Mi test probaba ese caso con el
   control del «sí», donde NO SUPE ya fallaba por otro lado. Con el control del «no», una sesión sin
   transcripción pasaba por «no entregó». → comprobación: el caso usa ahora el control del «no» con una
   sesión sin transcripción y exige salida 2.
2. **La primera pasada dio 110 sesiones «entregó y siguió»** y eran casi todas una edición del índice de la
   memoria después del traspaso, que es parte de entregar. Lo vi porque «entre 1 y 3 ediciones, mediana 1»
   en 110 sesiones era demasiado igual. Eran 6. → comprobación: el caso «tocar el índice de la memoria
   después es parte de entregar».
3. **La primera lista de árboles dio 60 «con cambios sin comitear»** y 46 eran ficheros que deja el arnés.
   Lo vi porque casi todos decían «1 fichero». → comprobación: `RUIDO_DEL_ARNES` es una lista declarada de
   dos entradas, y el test exige que lo que no esté en ella cuente como trabajo.
4. **Escribí «las otras 72 siguen trabajando».** No lo sé: acabaron en «working», y eso es estar viva o
   haber muerto trabajando. Corregido en la salida antes de empujar.
5. **Empujé el primer commit de esta rama con `guards:entrada` en ROJO.** Encadené guards, commit y push
   en una sola orden, y el push no dependía de la salida de los guards. Dos hallazgos: una negación sin
   respaldo en mi test (`scrum237`) y el script comparando contra una referencia móvil sin declararlo
   (`scrum723`). Arreglados en el commit siguiente: el test lleva su positivo, y el script recibe la punta
   ya congelada por `instantanea()` de SCRUM-753 e imprime el sha contra el que midió. → comprobación: no
   hay test que pueda exigir el orden de mis órdenes; queda como aviso, y la cura es no encadenar el push
   detrás de un guard con `;`.

## Leídas: las seis ramas que entran limpias (2-oct, por encargo del orquestador)

Leído contra la punta `de59fe731c623f8797142dc6a877f998a1056f68`. El juez es el diff de cada rama desde
que se separó, y lo que `main` tiene hoy en esos ficheros; no el estado del ticket. Ninguna se fusionó,
ni en local. `scrum-1415` (de una sesión viva) y `scrum-240-sobre-duplicado-rebasada` (camino de emisión,
y choca) no se abrieron.

| rama | veredicto | la evidencia |
|---|---|---|
| `scrum-114-enviar-para-firmar-ok-false` | **YA ESTÁ** | Añade `process.env.WHATSAPP_DRY_RUN = '1'` a dos tests. `main` ya lo tiene: `tests/scrum47-enviar-albaran-wa.test.mjs:23` y `tests/scrum49-firma-remota.test.mjs:24`. Lo único que no está son sus dos comentarios |
| `scrum-938-arregla-censo-lista-fixture` | **YA ESTÁ** | Una sola cosa: el ancla de `docs/master/SCRUM-938.md` con el sha completo. `main` ya la tiene con el sha de 40 |
| `scrum-1100c-el-resumen-explica-el-corte` | **YA ESTÁ** | Una sola cosa: el formato del ancla de SCRUM-1100c en `docs/master/SCRUM-1100.md`. `main` ya la tiene bien formada (línea 260) |
| `ci-prueba-en-rojo` | **BASURA** | Un fichero, `tests/zz-ci-prueba-rojo.test.mjs`, que se declara a sí mismo «FICHERO DE PRUEBA — NO MERGEAR»: un fallo inyectado para ver el check en rojo (SCRUM-154). Su propio texto dice que se borra en cuanto se compruebe |
| `scrum-312-importador-clientes` | **APORTA** · pequeño (30 líneas, 2 ficheros) | **El defecto que arregla sigue vivo en `main`:** `src/modules/system/domain/importarClientes.service.ts:342` pone `String(e?.message ?? e).slice(0, 120)` como motivo del rechazo, o sea que el profesional lee el error de la base en crudo. La rama lo manda al log, pone un texto fijo y trae su test, con el positivo de la negación. En `main` no está ni el texto ni el test |
| `scrum-418-puerta-de-produccion` | **APORTA** · mediano (243 líneas, 4 ficheros) | `src/core/db/puertaDeProduccion.ts` NO existe en `main`, ni su test, ni la llamada en `src/core/db/prisma.ts`. Es una puerta en el punto de conexión: si el host es el de producción y falta una variable declarada, no conecta |

Tres avisos sobre las dos que aportan:

- **`scrum-312`: el texto que pone es de usuario** («No hemos podido guardar esta fila.»). El commit dice
  «copy aprobada (regla 30)»; no he encontrado esa frase en `docs/microcopy/` ni en ningún otro sitio de
  `main`. Sin la firma delante es regla 39. Y el fichero es del carril de J2 (`dos-equipos.md` §3.1).
- **`scrum-418`: su trabajo SÍ está en `origin`.** La rama de `origin` está en `5057179d`, el commit con
  la puerta; la local solo le saca un merge de `main`. «Va por detrás» era cierto y no había trabajo sin
  empujar. Lo que no tiene es PR.
- **`scrum-418` no se puede fusionar sin más:** exige una variable nueva en Railway de producción
  (`YAQU_DESTINO_PRODUCCION`); sin ella producción no conectaría. Y su commit afirma algo que contradice
  a `CLAUDE.md`: que el 11-ago, de 199 árboles, 11 tenían un fichero de entorno apuntando a producción.
  `CLAUDE.md` sigue diciendo «ninguno apunta a producción», medido el 10-ago sobre cuatro árboles. No lo
  he vuelto a medir: son ficheros con credenciales. Es decisión del fundador.

De las seis: tres ya están, una es basura, dos aportan. De las 19 que chocan no he leído ninguna.

## Una lista declarada de un guard, tocada: se dice

`tests/scrum723-guard-contra-su-base.test.mjs` lleva una entrada nueva en `INDIRECTAS_DECLARADAS` para
`scripts/sesiones-que-no-volvieron.mjs`, con su motivo y quién la retira. Es el camino que el propio guard
indica («o compara contra su punto de partida, o se declara aquí con el motivo») y el mismo caso que la
criba de SCRUM-1372, que está justo encima. No se quitó ninguna entrada ni se cambió el detector. Antes de
declararlo quité lo que sí era arreglable en el código: las tres llamadas a git contra la referencia móvil.
