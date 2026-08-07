# SCRUM-388 · El censo del trabajo que está en `main` sin entrada en Jira

**Fecha:** 7-ago-2026 · **Carril:** S3 · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T19:13:03+01:00
**Tanda:** 2216 tests · 2142 pass · **0 fail** · 73 gateados

> **Esto MIDE, no arregla Jira.** No toca ningún ticket y no lee Jira: primero tiene que saber
> medir `main`.

## 🔴 EL PUNTO CIEGO, declarado: mide MECANISMO SIN CONECTAR, no COBERTURA DEL ENUNCIADO

**Un ticket al que se le construyó la mitad EN SILENCIO, y se conectó esa mitad, sale ENTERO.**

No es un defecto a medias: es el límite exacto de lo que este censo puede saber. La pregunta que
contesta es *«¿queda trabajo aquí?»* —la que se hace antes de asignar— y la contesta mirando si hay
mecanismo en `main` que todavía no hace nada. **Lo que NO mide es si lo entregado cubre el
enunciado del ticket**, porque eso exige leer el enunciado y compararlo con el código, y eso hoy
**no lo mide nadie**.

Queda escrito para que nadie lea un `ENTERO` como «no hay nada que revisar aquí».

Y la virtud que compensa el límite, que es la razón de elegir esta señal: **funciona sin saber qué
decidió el fundador**. En SCRUM-298 el alcance se recortó por decisión suya, y el censo acierta sin
tener que enterarse de esa decisión.

## Por qué existe: nos mordió TRES veces en un día, de tres formas distintas

| Caso | Lo que pasó |
|---|---|
| **SCRUM-298** (A8) | entregado en `main` (`7f9220d`, Luis, 7-ago 11:52) mientras Jira decía «Tareas por hacer» |
| **SCRUM-293 / 294** (A2/A3) | entrega **parcial**, mergeada y declarada: dominio con tests, **sin llamadores**, sin UI |
| **SCRUM-354** (A9) | **nada** construido — y una nota afirmaba que estaba cerrado |

## 🔴 LA REGLA VERTEBRAL: LA EVIDENCIA TIENE QUE NOMBRAR EL TICKET

Un commit que cite `SCRUM-N` **en su asunto**, un `docs/master/SCRUM-N.md`, una rama `scrum-N-…`.
Y nada más.

**«Hay un mecanismo que se parece» NO ES EVIDENCIA**, y no es una cautela teórica: es exactamente
cómo se dio A9 por cerrada. Alguien encontró el ciclo de mantenimientos —modelo con periodicidad,
cron diario, anti-spam, botones— y le pareció el mismo mecanismo. Pero eso es **A15/MANT-1**
(`d9fbd3c`, **6-JULIO**), construido **un mes antes de que el ticket A9 existiera** (creado el
5-ago). Comparten el modelo `MaintenancePlan` y **no comparten el objeto**: A15 propone
PRESUPUESTOS al profesional; A9 pide emitir FACTURAS solo, generar trabajos y avisar al cliente.

> **Encontrar un mecanismo que se parece no es encontrar el ticket.** El parecido es la forma que
> tiene un censo de mentir en la dirección cómoda: la que dice que no hay trabajo pendiente.

## Tres veredictos, y la señal que los separa NO es la que parecía

`ENTERO` · `PARCIAL` · `NADA`. «Parcial» no es un matiz: aplanarlo miente en las dos direcciones —
como «hecho» esconde trabajo pendiente; como «nada» tira una entrega medida y declarada.

🔴 **Y aquí hay una premisa del encargo que no se sostuvo al medirla.** La señal de PARCIAL parecía
que iba a ser la frase «ENTREGA PARCIAL» del `docs/master`. **No sirve: los docs de 293, 294 y
también el de 298 llevan los tres esa frase**, y 298 es el que está entregado del todo.

Lo que de verdad los separa es si **queda mecanismo construido y sin conectar**:

* **PARCIAL** → hay código en `main` que todavía no hace nada para el usuario (293 y 294 dejan el
  cálculo aislado esperando campos de schema).
* **ENTERO** → lo entregado está en uso; lo que falta se declaró fuera de alcance con motivo (298
  redujo el alcance por decisión del fundador, y la visibilidad que entregó está conectada).

La lista de marcas (`MARCAS_SIN_CONECTAR`) es **corta y declarada** a propósito: ampliarla a base de
sinónimos la volvería un detector de tono, y entonces cualquier entrega prudente saldría PARCIAL.

## Dos falsos positivos cazados antes de dar el mecanismo por bueno

Los dos habrían hecho justo el daño que el ticket quiere evitar — **atribuir a un ticket trabajo que
no es suyo**:

1. **Ramas por número suelto.** Buscar «el número aparece por ahí» le daba a **SCRUM-2** cinco ramas
   ajenas: `…-rebasada-2`, `…-rebasada-2`, `codeowners-zona-roja-v2`. El `2` era un sufijo de
   reintento o de versión. Arreglado exigiendo la **convención de la casa**: `^scrum-N(-|$)`.
2. **Commits por el CUERPO.** `58d7753 docs(master): SCRUM-8 …` menciona otro ticket en su cuerpo, y
   aceptarlo hacía que **SCRUM-2 saliera ENTERO**. Una referencia cruzada dice «esto tiene que ver
   con aquello», no «aquello se construyó aquí». Ahora solo cuenta el **asunto**.

> Este censo se equivoca **hacia «falta trabajo»**, nunca hacia «ya está hecho». Si una entrega cita
> el ticket solo en el cuerpo, sale como no vista — y es preferible.

## Y el lector tenía que saber leer su propia fuente

En `SCRUM-294.md` la frase «sin llamadores» **cruza dos líneas de blockquote**. Colapsar espacios
sin quitar el `>` deja `…probado y sin > llamadores`, y el buscador daba **CERO sobre un fichero que
sí lo dice** — ENTERO a una entrega que se declara incompleta. Por eso `normalizar()` hace **dos**
pasos, y hay test con hermano positivo que comprueba que el caso reproduce el defecto.

## Verificado en rojo — 7 mutaciones, inyección comprobada en disco

| Qué se rompe | Qué cae |
|---|---|
| **R4** · la búsqueda por número en los commits | 🔴 «SCRUM-298 ha perdido la fuente «commits» (le quedan: [docs/master, ramas])» |
| se acepta evidencia del cuerpo del commit | 🔴 «SCRUM-2 sale «ENTERO» heredando evidencia de un ticket vecino: commits=58d7753» |
| las ramas vuelven a casar el número suelto | 🔴 «…ramas=origin/codeowners-zona-roja-v2, …» |
| el normalizador deja de quitar el `>` | 🔴 «el normalizador no lee frases que cruzan un blockquote» |
| se vacía la lista de marcas | 🔴 nada saldría PARCIAL |
| se pierde la frontera del número | 🔴 «SCRUM-2 sale «PARCIAL» heredando evidencia…» |
| el suelo deja de mirar `docs/master` | 🔴 «con `docs/master` presente pero con 3 entradas, el suelo no se queja del umbral» |

> ⚠️ **La séptima salió VERDE al primer intento, y era un hueco de verdad.** El único test que
> ejercitaba el suelo usaba un directorio **inexistente**, así que caía por el `catch` de «no se
> pudo leer» y **el umbral de entradas no lo vigilaba nadie**: se podía desactivar entero con la
> suite en verde. Se añadió el test que faltaba —`docs/master` que EXISTE pero está casi vacío— y
> entonces sí cae. *Cuando una prueba de rojo sale verde, la primera hipótesis es «caso mal
> elegido», no «guard de sobra».*

## Limitaciones, declaradas

* **No lee Jira.** El veredicto dice qué hay en `main`; cruzarlo con el estado del ticket es de
  quien lea el informe. Se puede añadir, pero primero tenía que saber medir `main`.
* **Las ramas salen de `refs/remotes/origin/`**, no de `git ls-remote`: es rápido y sin red, pero
  refleja el **último `fetch`**. Se declara en vez de fingir que es el remoto en vivo.
## 🔴 CORREGIDO ANTES DE MERGEAR: el banco fijaba el estado actual

La primera versión de este fichero decía que si mañana aparecía `docs/master/SCRUM-354.md` el test
de A9 caería «a propósito». **Estaba mal, y choca de frente con una regla de la casa:**

> **Un test que fija el estado actual convierte un defecto en un requisito.**

Ese test habría caído **el día que alguien construyera A9 haciendo el trabajo BIEN**, y quien lo
encontrase tendría delante un test exigiéndole que A9 siga sin empezar. Es lo mismo que ya nos pasó
con el test que falló cuando el import se **arregló**.

Separado en dos, con nombres que lo dicen:

| Fichero | Qué sostiene | Puede caducar |
|---|---|---|
| `scrum388-censo-mecanismo.test.mjs` | que el censo sabe **clasificar**, contra un repositorio **sintético** (`_censo-fixture.mjs`) con los cuatro casos reproducidos | **no** |
| `scrum388-centinela-main.test.mjs` | que el mecanismo **sigue sabiendo leer este repositorio** | solo si cambia cómo se lee el repo |

**Comprobado de verdad, no razonado:** se creó `docs/master/SCRUM-354.md` a mano —simulando que
alguien construye A9— y **los dos ficheros siguieron VERDES**. Con la versión anterior, el banco
habría caído.

### El centinela NO fija ningún veredicto, y ésa es la decisión

Se planteó que vigilara los veredictos de los cuatro tickets reales. **No lo hace**, porque eso es
otra vez fijar el estado actual con otro nombre. Lo que comprueba es que **cada fuente sigue
encontrando evidencia en alguna parte** del rango 280-400: si un buscador se rompe —o cambia la
convención de ramas, o el ticket deja de ir en el asunto del commit, o `docs/master/` se mueve— eso
sale. Que alguien construya un ticket que antes no tenía nada **no lo pone rojo**: es una buena
noticia, y una buena noticia no puede romper la suite.

Su mensaje de fallo dice literalmente **«RE-MIDE, NO ARREGLES EL TEST»** y nombra la fuente que dejó
de responder. Ajustar el umbral para que vuelva a pasar sería apagar la alarma en vez de mirar el
fuego.

## Limitaciones que quedan

* **No lee Jira.** El veredicto dice qué hay en `main`; cruzarlo con el estado del ticket es de
  quien lea el informe.
* **Las ramas salen de `refs/remotes/origin/`**, no de `git ls-remote`: rápido y sin red, pero
  refleja el **último `fetch`**. Se declara en vez de fingir que es el remoto en vivo.

Ficheros: `tests/_censo-tickets.mjs` (el mecanismo) · `tests/_censo-fixture.mjs` (el repositorio
sintético) · `tests/scrum388-censo-mecanismo.test.mjs` (13) ·
`tests/scrum388-centinela-main.test.mjs` (3).
