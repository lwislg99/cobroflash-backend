# SCRUM-556 · El proceso aborta, no es un test que falla — ¿deja tests sin ejecutar?

**Medido contra:** `origin/main` = `55a29711eeb6d8ef5785fe9c4d3f227932041877` · 2026-08-20T10:25:09+01:00

> ⚠️ Esa hora es el **committer date del primer commit del trabajo**, no una lectura de reloj —
> mismo criterio R14 que las demás entradas.

**Alcance:** sólo medición. **No se ha tocado ningún test, ni el script `test`, ni la
concurrencia.** Este documento es la lista con la que el fundador decide qué corregir.

---

## LA RESPUESTA, que es lo que decide el tamaño del problema

# 🟢 NO. El abort NO deja tests sin ejecutar.

Los cuatro números, uno al lado del otro, misma tanda y misma configuración
(`node --test --test-force-exit`, 490 ficheros):

| | total | pass | fail | skip |
|---|---|---|---|---|
| **CON abort** | **3792** | 3713 | 2 | 77 |
| **SIN abort** | **3791** | 3713 | 1 | 77 |

**`pass` idéntico. `skip` idéntico.** El total sube exactamente 1, y ese 1 es **el fichero
contado como test fallido** — no un subtest perdido.

Y comprobado uno a uno sobre los **siete** subtests del fichero que aborta:

| CON abort | SIN abort | subtest |
|---|---|---|
| ok | ok | SUELO: el censo de CTA VE botones antes de decir que estan bien |
| ok | ok | ningun CTA lleva a un 404 ni a una pagina vacia |
| ok | ok | toda ancla apunta a una seccion que existe en su pagina |
| ok | ok | todo enlace de WhatsApp lleva un numero al que se puede escribir |
| ok | ok | todo `mailto:` publica una direccion con forma de direccion |
| ok | ok | el CTA que promete EMPEZAR lleva al alta, no al acceso |
| ok | ok | CONTROL NEGATIVO: el analizador no acusa a lo legitimo, y si acusa a lo malo |

**Subtests sin ejecutar por el abort: 0 de 7.**

> **No hay verdes por omisión.** El abort ocurre DESPUÉS de que los siete hayan corrido y
> reportado; lo que revienta es el cierre del proceso. El daño es **un rojo con ruido**, no
> cobertura perdida. Que es la diferencia entre un incordio y un agujero.

---

## La causa ya estaba escrita en el repo, y no en un sitio raro

`tests/scrum100-webhooks-fail-closed.test.mjs:50-57`, desde SCRUM-100:

> *«`fetch` (undici) descartado a propósito — encontrado depurando este mismo test. Con 3+
> peticiones sobre el mismo `app.listen(0)`, sus conexiones (aun con `Connection: close`)
> dejaban el proceso en un estado que, bajo `--test-force-exit` en Windows, terminaba en un
> crash nativo de libuv (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) — **los
> resultados salían todos en verde, pero el fichero se marcaba como fallido igual**. `node:http`
> con `agent:false` (sin pool de conexiones) no lo reproduce en ninguna combinación probada.»*

Tres cosas de ahí:

1. **La causa está identificada desde entonces:** doble cierre de un handle en libuv, disparado
   por el pool de conexiones de undici contra un `app.listen(0)`.
2. **El daño también:** «todos en verde, pero el fichero fallido». **Esta medición lo confirma de
   forma independiente**, con los cuatro números y los siete subtests — no se da por bueno
   porque lo diga un comentario.
3. **El remedio ya existe y está probado:** `node:http` con `agent: false`.

Y `tests/scrum334-destino-de-los-cta.test.mjs` reproduce el patrón exacto: `app.listen(0)`
(`:35`) y `await fetch(...)` en bucle (`:100`).

## 🔴 `--test-force-exit` NO es el disparador. Medido, y contra la hipótesis de partida

Era el sospechoso de primera fila: forzar la salida mientras libuv cierra handles parecía el
escenario. **Se midió sin quitarlo del script `test`** (invocación ad hoc, cinco pasadas):

| configuración | pasadas con abort |
|---|---|
| CON `--test-force-exit` | **5 de 6** |
| SIN `--test-force-exit` | **3 de 5** |

**Sigue abortando sin él.** Puede agravarlo, pero no lo causa, así que **quitarlo no arreglaría
nada** — y se queda donde está. (El comentario de SCRUM-100 lo nombra porque en 2026-ene era la
combinación que tenían delante, no como causa única.)

## ¿Es sólo `scrum334`? Sí hoy — pero el patrón lo comparten 31 ficheros

**Ficheros que abortaron alguna vez en 11 pasadas: uno.** Siempre el mismo, siempre
`exitCode 3221226505` (`0xC0000409`), `signal ~`.

**Ficheros con el patrón causante** (`app.listen(0)` **y** `await fetch(`): **31**.

```
albaran · pdfs · scrum120 · scrum127 · scrum131 · scrum17 · scrum170 · scrum171a · scrum178
scrum22 · scrum221 · scrum24 · scrum25-export-zip · scrum25-exports · scrum329 · scrum334
scrum47 · scrum49 · scrum51 · scrum57 · scrum58 · scrum66 · scrum68 · scrum72 · scrum73
scrum74 · scrum82 · scrum85 · scrum90 · scrum92 · tenancy-permisos
```

Que hoy sólo caiga uno no es una propiedad de ese fichero: es una carrera. **La población en
riesgo son 31**, y el remedio (`node:http` con `agent:false`) está probado desde SCRUM-100.

## ⬜ El rojo de CI de SCRUM-539 NO queda explicado por esto

Era tentador darlo por cerrado. **No lo está, y hay dos motivos medidos:**

1. **`scrum388-censo-mecanismo.test.mjs` no tiene el patrón:** cero `fetch(`, cero `app.listen`.
   Se alimenta de `repoFixture()` (un repo git temporal), como ya midió S1.
2. **La aserción es de libuv EN WINDOWS** y `0xC0000409` es un código de Windows. En
   `ubuntu-latest` un abort de libuv se vería como `signal: SIGABRT`, no como ese exitCode.

Comparten **la forma en el log** —`'test failed'` sin subtest, que es lo que SCRUM-552 explicó—
pero no hay ninguna medición que los una. **Ese episodio sigue abierto.**

## Lo que NO se pudo medir, con esas palabras

- **Nada de esto está medido en `ubuntu-latest`.** Todo es Windows. Si el abort existe en CI, no
  se sabe con qué firma.
- **No se ha probado el remedio en `scrum334`.** Este ticket era de medición; cambiar `fetch`
  por `node:http` es una corrección y merece su propio ticket, con su rojo por el mecanismo.

## ⚠️ Dos instrumentos míos que dieron números falsos, y se dicen para que nadie los repita

Los dos contaban «subtests por fichero», y los dos estaban mal:

1. Emparejar `ok N - …` con `location:` usando `[\s\S]*?` **cruza líneas** y coge el `location`
   de otro bloque. Daba 0 subtests para un fichero que tiene 7.
2. Parsear por bloques tampoco vale, y el motivo es del formato: **en el TAP de node los
   subtests que PASAN no llevan `location`** — sólo lo llevan los fallos y los ficheros.
   **Agrupar subtests por fichero es imposible con el TAP.**

Lo que sí funciona, y es como está medida la tabla de arriba: **contar los siete subtests por su
NOMBRE**, que es único. El primer número que dieron esos contadores («1 con abort · 0 sin
abort») era ruido, no un hallazgo.

## Fuera de carril, una línea

- `tests/scrum551-anclas-bloque-f.test.mjs` estaba **en rojo en main** al empezar esta medición
  (trabajo de S1); no se tocó, y main lo arregló después con SCRUM-557.
