# SCRUM-618 · LEER-EL-CI: la premisa era falsa — el repositorio es público y siempre se pudo mirar

**Fecha:** 15-sep-2026 · **Carril:** proceso / instrumentos · **Gate:** fuera de `npm test` (hace red)
**Medido contra:** `origin/main` = `cae27c2e6dc1482db0567a8561ebeb6863c996b8` · 2026-09-15T16:05:57+01:00
**Tanda:** 6748 tests, 6638 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 811 ficheros · 354 s · exit 0 — con tope duro, medida DESPUÉS del último cambio.

> **El trabajo no era construir un puente: era comprobar si el río existía.**

## 🔴 El hallazgo, y es toda la entrega

SCRUM-618 se sostiene sobre una frase escrita el 24-ago-2026:

> «`gh` no está instalado… **El repositorio es privado**, así que tampoco se alcanza por web.»

De ahí salía todo lo demás: las dos vueltas por cada arreglo de CI, el fundador copiando logs a
mano para que el asesor los pegara en un encargo, y la frase que da título al ticket — *un CI que
nunca se ha visto rojo no se distingue de uno que no vigila nada*.

**Medido contra la API pública, sin credenciales de ningún tipo:**

```
GET /repos/lwislg99/cobroflash-backend   →   "private": false, "visibility": "public"
```

**El repositorio es PÚBLICO.** No hace falta token, ni artefacto, ni procedimiento nuevo.

### Y el árbol ya lo decía — nadie había cruzado las dos frases

El comentario de SCRUM-836, del 9-sep, razona el coste de la CI así: *«Hoy la CI cuesta 0 €.
Actions es gratis en repositorios **públicos**»*, y habla de *«el día que el repositorio pase a
privado»*. Esa afirmación y la del 618 llevaban **tres semanas conviviendo** y sólo una podía ser
cierta. Ninguna de las dos estaba mal medida: **nadie las puso una al lado de la otra.**

## Lo que SÍ se puede leer, medido endpoint a endpoint

El comentario del ticket es explícito en que un `pass/fail` no habría servido de nada. Esto es lo
que llega sin autenticar:

| dato que pedía el caso de SCRUM-617 | ¿llega? |
| --- | --- |
| veredicto **por job**, no el global | ✅ |
| **tiempos** de cada job (la curva que apunta a la causa) | ✅ |
| **entorno**: `runner_name` y `labels` | ✅ |
| el **step exacto** que falló, con su número | ✅ |
| **anotaciones** del check: nivel, mensaje y código de salida | ✅ |
| el **texto del log** completo | 🔴 **403 anónimo** |

**Coste, también medido** (`/rate_limit`): API anónima, **60 peticiones/hora**, ~4 por
diagnóstico — unos 15 diagnósticos por hora. **No hay credencial que pedir ni que guardar**, así
que esto no entra en la regla de credenciales que el ticket marcaba como decisión del fundador.

## La respuesta a la pregunta del título, con un número

*«Un CI que nunca se ha visto rojo no se distingue de uno que no vigila nada.»*

```
GET /actions/runs?status=failure   →   total_count: 313
GET /actions/runs                  →   total_count: 4257
```

**Este CI se ha visto rojo 313 veces sobre 4257 runs.** No es un CI que no vigile. Y ahora esa
pregunta se contesta en una petición en vez de suponerse.

## Lo construido

`npm run ci:rama [rama]` — lee el CI de una rama sin credenciales y sin `gh`. Ejecutado contra un
rojo real (`scrum-505-el-guard-que-mira-dentro`):

```
── CI · failure · 2026-09-15T14:46:28Z
   ✔  build + tests (con banco desechable)  332s  [ubuntu-latest · GitHub Actions 1000007193]
   🔴 meta-guard · los guards caen cuando deben  433s  [ubuntu-latest · GitHub Actions 1000007194]
        step 7: Cada guard cae con la mutación que declara
        failure: Process completed with exit code 2.
```

Eso es el caso de SCRUM-617 resuelto: **qué job, cuánto tardó, en qué entorno, qué step y con qué
mensaje** — y el `exit code 2` del meta-guard es precisamente su `SALIDA_CIEGO`.

⛔ **Lo que NO hace, y es deliberado:** no abre PRs, no escribe, no mergea, no instala `gh` y no
maneja ninguna credencial. Sólo LEE. Las cuatro prohibiciones del ticket siguen intactas.

## El hueco que queda, declarado

`GET /actions/jobs/<id>/logs` devuelve **403** anónimo. La anotación del check trae el mensaje y el
código de salida —que para el caso que abrió este ticket habría bastado—, pero un `AssertionError`
con su diff vive en el log y ahí no se llega.

**Cómo se cierra sin credenciales, si algún día molesta:** que el job que quiera ser diagnosticable
desde fuera **emita su veredicto como anotación** (`::error::…`), que es pública. Es la salida (2)
que el propio ticket contemplaba —*«que el workflow escriba su resultado»*— y sale gratis. Queda
**PROPUESTA y no aplicada**: tocar los workflows no es lo que este ticket pedía.

## Verificado en rojo

* 🔴 **EL QUE DECIDE** · con el run real en rojo, nombra **el job**, su **step 7**, sus **433 s** y
  su **entorno**. Un veredicto global no distinguía cuál de los cinco.
* ✅ **POSITIVO** · con todos los jobs en verde no acusa a nadie, y los cuenta: «detecta rojos» y
  «acusa siempre» darían el mismo resultado sin esto.
* 🔴 **«en marcha» NO es «verde»** · un job con `conclusion: null` va a su propio cubo. Contarlo
  como éxito es exactamente el verde falso que el ticket viene a nombrar.
* 🔴 **SUELO** · sin jobs no inventa veredicto, y con **cero runs** el script sale **CIEGO (2)**,
  no verde: vacío y no-medido se leen igual y significan lo contrario.
* **Y el control cazó un defecto propio antes de entregar:** el filtro de «en marcha» comparaba
  `f.status` cuando la fila expone `f.estado`, así que daba **todos** los jobs como en marcha. Un
  cubo que se llena siempre no separa nada.

⚠️ **Y una anécdota que vale como lección:** leer este mismo script con `| head` devolvía **exit
1** sin haber ningún rojo. Sin tubería, **exit 0**. Es SCRUM-850 aplicándose al instrumento que
acababa de escribirse.

## ⚠️ Lo que este trabajo NO puede sujetar

Que el repositorio **siga** siendo público es un hecho de GitHub, no del árbol: comprobarlo exige
red, y el test de la tanda no la toca. Si algún día pasa a privado, `ci:rama` empezará a dar
`404`/`403` y **lo dirá como CIEGO** — que es el modo correcto de fallar. Queda dicho porque un
lector podría creer que esa propiedad está sujeta por un test, y no lo está.

## Censo pedido: otros recuentos con la misma forma (regla 9 — nombrados, no arreglados)

Barrido por AST sobre `tests/*.mjs` y `scripts/*.mjs`: **82 enteros declarados** con nombre de
recuento, en **59 ficheros**. Pero meterlos en el mismo saco sería un censo malo:

| clase | cuántos | ¿colisiona como el recuento de SCRIPTS_DEL_DASHBOARD? |
| --- | --- | --- |
| **holgados** (`SUELO_`, `MINIMO_`, `MAX_`, `MARGEN_`) | **59** | **No.** Un umbral no se toca cuando el árbol crece; sólo si baja. |
| **exactos** | **23** | Sí — y de ésos, ~13 son recuentos del árbol de verdad. |

Los que tienen la forma exacta: `SIN_MESSAGE = 29`, `CON_PROPIO_HOY = 91`, `SIN_NADA = 33`,
`SIN_PROCEDENCIA = 17`, `TOPE_FILTRAN_A_MANO = 39`, `TOPE_LEEN_EL_ENTORNO = 15`,
`CAMINOS_ESPERADOS = 7`, `CIEGAN_HOY = 7`, `CON_CR = 3`… El resto de los 23 son **falsos
positivos** del barrido (ids de fixture como `ALBARAN_ID = 42`, importes como `TOTAL = 1018`,
códigos de salida). **Hay patrón y se nombra; no se arregla aquí.**

## Lo que NO cubre

* **No se ha tocado SCRUM-663**: está cerrado como duplicado de SCRUM-662 por el fundador el
  02-sep, y **verificado por contenido**, no por Jira — `SCRIPTS_DEL_DASHBOARD` ya es una lista
  congelada, y `contrastarScripts()` la compara contra el índice real devolviendo qué **sobra** y
  qué **falta**, nombrado. La decisión explícita se conserva y aun así hay red.
* Los puntos 2 y 3 del alcance (**replicar el runner en local**, **escribir el procedimiento de las
  dos vueltas**) **dejan de hacer falta** para el caso que originó el ticket: ya no hay dos
  vueltas. Si alguien necesita el texto del log, la salida es la anotación propuesta arriba.

## Ficheros

* `scripts/ci-de-la-rama.mjs` — el lector, con su hueco declarado en una constante exportada.
* `tests/scrum618-leer-el-ci.test.mjs` — la red que sí corre siempre, contra respuestas capturadas
  de la API real, sin tocar la red.
* `package.json` — `ci:rama`, con su `//` explicando qué mide y qué no.
