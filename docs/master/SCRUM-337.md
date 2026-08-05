# SCRUM-337 · GUARD: un correo que promete una consecuencia y el código que la ejecuta no pueden divergir en silencio

**Fecha:** 5-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `0d049878d61e0d3bbfe9d4033d2778007f15b0b0` · 2026-08-05T04:17:45+01:00

> **Esta tarea entrega SOLO una de las dos mitades del ticket.** La otra —qué debe decir el texto,
> o si hay que ampliar el bloqueo— es decisión del fundador y **no se ha tocado**: ni una palabra
> de microcopy (regla 30), ni una línea del gate. Lo entregado es el mecanismo que impide que
> vuelva a pasar sin que nadie se entere.

---

## El defecto, reconfirmado hoy por contenido (no repetido por fe)

El árbol se ha movido desde D0 (SCRUM-310), así que las dos caras se han vuelto a derivar enteras.

**Cara A — lo que el producto DICE.** `src/modules/messaging/domain/lifecycle.service.ts`:

| Aviso | Línea | Lo que promete (literal) |
| --- | --- | --- |
| **día 3** | `:114` | «Carga tu catálogo de servicios **(lo tienes precargado por oficio)**.» |
| **día 7** | `:129` | «Tu prueba de YaQu expira en unos 7 días.» |
| **día 12** | `:140` | «Si no, **perderías el acceso a tu panel** (tus datos se guardan).» |

Y la derivación encuentra **cinco** avisos donde el ticket nombra tres: el evaluador diario manda
además `trialExpired` (`:151`) e `inactive` (`:166`), que también le hablan al usuario del final de
la prueba y **nadie los había mirado**. Esa es la diferencia entre derivar y enumerar.

**Cara B — lo que el producto HACE al vencer.** El bloqueo es `requireActivePlan`
(`src/core/http/authMiddleware.ts:55-74` → 403 `trial_expired` + redirect a `/dashboard/#plans`).
Derivado del AST de todo `src/`, **4 montajes de 95 rutas de escritura**, y **cero `.use(...)`**:

| Montaje | Fichero:línea |
| --- | --- |
| `POST /quote/create` | `src/app.ts:257` |
| `POST /admin/quotes/:id/send-whatsapp` | `src/app.ts:333` |
| `POST /:id/enviar-whatsapp` (albaranes) | `src/modules/jobs/app/routes/albaranes.routes.ts:571` |
| `POST /:id/enviar-para-firmar` (albaranes) | `src/modules/jobs/app/routes/albaranes.routes.ts:588` |

**Coinciden exactamente los 4 sitios y los 95 de D0.** Al vencer la prueba **el panel no se
pierde**: lo único que caduca es crear presupuestos y enviar por WhatsApp presupuestos y albaranes.

**Y el del día 3**, medido: `getTradeCatalog` devuelve **`[]`** para un oficio sin catálogo —«otro»
está declarado como tal en el propio fichero— (`src/core/data/tradeCatalogs.ts:136`, `:138-141`), y
la precarga exige un `trade` no vacío o responde `trade_required`
(`src/modules/products/app/routes/products.routes.ts:26-31`). O sea: la frase del correo es
**condicional** y el correo la afirma **sin condición**.

---

## Lo entregado: el guard, y qué invariante fija exactamente

`tests/scrum337-aviso-atado-al-bloqueo.test.mjs` + el derivador `tests/_censo-aviso-vs-bloqueo.mjs`.
Corre en `npm test`, sin gate.

**No fija cuál de las dos caras es la correcta. Fija que no puedan moverse por separado.** Congela
el **estado de la pregunta**, no su respuesta:

* **`NO_ATADO`** — el fundador ya ha declarado que el aviso promete algo que el árbol no ejecuta.
  Hoy: `day12` (SCRUM-337) y `day3` (SCRUM-338). Lleva ticket obligatorio: una deuda sin nombre es
  indistinguible de un olvido.
* **`SIN_DECIDIR`** — nadie ha dictaminado si se corresponden. Hoy: `day7`, `trialExpired`,
  `inactive`. **Declarar una pregunta abierta es correcto; clasificarla yo sería invadir la mitad
  del fundador.**
* **`ATADO`** — correspondencia verificada. **Hoy está vacío, y eso es el hallazgo, no un hueco
  por rellenar.**

Los seis asserts:

1. **SUELO ①** — el censo ve el evaluador diario y empareja cada aviso con su bloque; si no, falla.
2. **SUELO ②** — el censo ve el gate y ≥50 rutas de escritura; si no, falla.
3. **Cobertura bidireccional** — todo aviso derivado está clasificado **y** toda clasificación
   existe en el árbol. Un correo nuevo mañana = rojo hasta que alguien diga si promete algo.
4. **Si cambia lo que el correo DICE** (huella del bloque: condición + asunto + cuerpo + botón),
   rojo → obliga a mirar el bloqueo.
5. **Si cambia lo que el producto HACE** (censo de montajes por identidad), rojo → obliga a mirar
   los correos.
6. **Ratchet** — el censo de `NO_ATADO` no crece, y si baja hay que anotarlo (mismo mecanismo que
   el censo heredado de SCRUM-267): que el guard falle por una **mejora** es deliberado.

**Nada escrito a mano.** Las cuatro rutas gateadas **no** están en el test: salen del AST.
Escribirlas habría sido crear la enésima lista sin guard — y ya hay al menos una más en el repo
(`tests/_merchant-fixture.mjs:176` las nombra a mano).

**Por qué la huella y no el texto.** Un guard que mirase la palabra («que no diga panel») sería un
guard de TEXTO: se cazaría a sí mismo en el comentario que explica la prohibición —el fichero la
contiene— y se esquivaría reformulando. Y sobre todo, **no me corresponde leer el texto**. La huella
solo sabe decir «cambió / no cambió», que es todo lo que hace falta para forzar la revisión y todo
lo que se puede afirmar sin tocar microcopy ajena.

---

## Verificado en rojo — sobre los ficheros REALES, sin inyectar

Cada caso edita el artefacto de verdad, corre el guard y restaura con `git checkout`. Árbol
comprobado limpio al terminar.

| Caso | Edición real | Resultado | ¿Cae el assert que debe? |
| --- | --- | --- | --- |
| **R1** · cambia el aviso del día 12 | `age >= 12` → `age >= 13` en `lifecycle.service.ts` | 🔴 **ROJO** (5/1) | sí — «si cambia lo que el correo DICE» |
| **R2** · se desmonta el gate | quitar `requireActivePlan` de `app.post('/quote/create', …)` | 🔴 **ROJO** (5/1) | sí — «si cambia lo que el producto HACE» |
| **R3** · derivación ciega | renombrar `runLifecycleEmails` | 🔴 **ROJO** (4/2) | sí — SUELO ① |
| **N1** · control negativo | reindentar dentro del bloque del día 12 | 🟢 **VERDE** | — |
| **N2** · control negativo | comentario nuevo fuera de los bloques de aviso | 🟢 **VERDE** | — |

**R1 se hizo sobre la CONDICIÓN, no sobre el texto, a propósito:** alterar la microcopy —aunque
fuera un segundo y con `git checkout` detrás— no es mío (regla 30). El assert es el mismo y la
huella cubre el bloque entero, así que un cambio de texto dispara por el mismo camino.

**Los dos controles negativos existen porque el modo de morir de un guard así es el ruido:** si un
`prettier` pusiera en rojo los cinco avisos con un mensaje sobre promesas incumplidas, el siguiente
lo puentea. Por eso la huella **normaliza espacios** — el reindentado (N1) pasa en verde.

---

## Lo que NO cubre — y la mitad que sigue siendo del fundador

* 🔴 **NO arregla la divergencia.** Hoy el día 12 sigue diciendo que se pierde el panel y el panel
  no se pierde. Las dos salidas —corregir el texto (microcopy, regla 30) o ampliar el bloqueo
  (cambia el comportamiento de **todas** las cuentas en prueba)— son del fundador. Un test que
  eligiera una estaría fijando por accidente la respuesta a una pregunta que nadie ha contestado.
* **Los tres `SIN_DECIDIR` siguen sin decidir.** `day7`, `trialExpired` e `inactive` están
  declarados como pregunta abierta, no como correctos.
* **El guard no lee el texto**, así que no detecta que un correo NUEVO prometa algo falso: detecta
  que **existe** y obliga a clasificarlo. La clasificación la pone una persona.
* **Solo cubre los avisos del evaluador diario.** `sendWelcomeEmail` y `sendFirstPaymentEmail`
  quedan fuera porque los mandan otras funciones — el límite lo pone la estructura, no una lista.
  Si alguien decide que también hacen promesas, es ampliar el derivador.
* **No se ha ejecutado ningún envío real** ni se ha mirado producción.
* No se ha tocado `prisma/schema.prisma`, ni el gate, ni Jira.

## Ficheros

* `tests/_censo-aviso-vs-bloqueo.mjs` — **nuevo.** Los dos censos derivados (AST).
* `tests/scrum337-aviso-atado-al-bloqueo.test.mjs` — **nuevo.** El guard (6 asserts).
* `docs/master/SCRUM-337.md` — este registro.

**Cero ficheros de producto modificados.**
