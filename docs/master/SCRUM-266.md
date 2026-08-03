# SCRUM-266 · TTL-DESATADO: la vigencia de un turno la decide el compromiso, no una suposición

**Fecha:** 3-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `9550f1b3dcc86a671036453372319440ea99003d` · 2026-08-03T20:05:00+02:00
**Tanda:** 1156 tests, 1089 pass, 0 fail, 67 skipped

> ⚠️ **Ticket de Javier (carril B).** Esta rama queda lista y **no se pide merge**: es su carril y
> no está. Ver el comentario en SCRUM-266 con qué se hizo y por qué, igual que con sus PRs 259 y 260.

## El defecto

El runner **deriva** su TTL —`ttlParaTanda(GATED_CHILD_TIMEOUT_MS)` = `max(45, GATED + 10)`— y
`turno-staging.mjs` **suponía 45 fijos**, tanto en `estado` como en `tomar`.

Con `GATED_CHILD_TIMEOUT_MS=60` el runner sostiene su turno con TTL **70**: entre el minuto 45 y
el 70 el turno está **vigente para quien lo tiene y rancio para quien lo consulta**. La ventana es
exactamente **`GATED + 10 − 45`**.

### Y es peor de lo que decía el enunciado: `tomar` no informaba mal, RECLAMABA

`adquirirLock` decidía con ese mismo TTL supuesto:

```js
if (lock && !estaRancio(lock, ahoraMs, ttlMs))   // ttlMs = 45 desde el CLI
```

Un turno de 50 minutos caía al `else` y **se lo llevaba**. Sin preguntar, sin `exit 5` y sin dejar
rastro, mientras la otra tanda seguía escribiendo en la misma base. **Es el fallo que SCRUM-188
existe para impedir, ocurriendo por dentro de la herramienta que debía protegerlo.** Rozó el
2-ago-2026: es lo que Javier estuvo a punto de hacer.

### Y `estado` se contradecía en la misma pantalla

El título salía de `estaRancio` (45 supuestos) y la señal de vida de abajo, del compromiso
publicado por SCRUM-249. Con GATED a 60 y un turno de 50 minutos, la salida decía
**«⏳ Turno RANCIO (se reclama solo)»** y dos líneas después **«Señal de vida: VIVO»**. Quien lo
leyera no tenía forma de saber a cuál hacer caso. Una herramienta que se contradice a sí misma es
peor que una que calla.

## La decisión, y por qué NO se le pasa el TTL al CLI

Lo obvio sería que `estado` y `tomar` calculasen `ttlParaTanda(GATED_CHILD_TIMEOUT_MS)`. Se
descartó: **el CLI leería SU variable de entorno para adivinar el TTL con el que OTRA máquina tomó
el turno.** Si quien corre la tanda tiene GATED a 60 y quien consulta no la tiene puesta, vuelve a
fallar — y en silencio. Es adivinar con más pasos.

**El dato correcto ya está publicado desde SCRUM-249:** el dueño declara hasta cuándo va a dar
señales, y eso se compara contra el reloj de la BASE, que es el mismo para todas las máquinas. No
hay que deducir el TTL de nadie.

`decidirVigencia()` es **la única función que decide**, y la usan los tres sitios. Por eso ya no
puede haber dos respuestas distintas en la misma pantalla.

1. **Con compromiso, manda el compromiso.**
2. **Sin compromiso** (turno anterior a SCRUM-249, o contexto ilegible u huérfano) se cae al TTL —
   pero la respuesta lleva `base: 'ttl-supuesto'`, y **`tomar` lo dice al reclamar** en vez de
   hacerlo en silencio.
3. **El 45 deja de decidir en dos sitios.** `TTL_POR_DEFECTO_MS` sigue siendo el **suelo** del TTL
   derivado; ya no es además «lo que el CLI supone». Que ambos conceptos compartieran constante es
   **por qué uno cambió y el otro no**.

## Lo que se midió

* `turno-staging.mjs:105` (`estado`) y `:119` (`tomar`) usaban `TTL_POR_DEFECTO_MS` a pelo;
  `test-staging-gated.mjs:208` usa `ttlParaTanda(TIMEOUT_MAYOR_MS)`.
* Umbral exacto de la ventana: `GATED + 10 > 45` → **aparece a partir de GATED > 35**, y con
  GATED=35 el derivado es exactamente el suelo. Fijado en el test.
* **Acoplamiento con SCRUM-265, confirmado por la fórmula:** las dos salidas de 265 dejan GATED por
  encima de 35 como régimen normal, así que **convierten esta ventana de ocasional en permanente**.
  Arreglar 265 primero no la empeoraría un poco: la haría el estado habitual. De ahí el orden.

## Verificado en rojo

* **`adquirirLock` vuelve a decidir con `estaRancio`** → cae «`tomar` ya NO se lo lleva»: con el
  arreglo revertido, se lleva el turno de la tanda viva. Es el rojo que demuestra la gravedad.
* **El CLI vuelve a juzgar con `estaRancio`** → cae el guard estructural. Mientras el CLI llame a
  esa función puede volver a haber dos juicios sobre lo mismo, así que se prohíbe ahí y se lee
  **sin comentarios** (este fichero la nombra para explicarla).

Las dos inyecciones revertidas, `scripts/` limpio.

## Lo que NO cubre

* **Un turno anterior a SCRUM-249 sigue teniendo ventana.** No es evitable sin inventar el TTL
  ajeno, que es justo lo que este ticket quita. **El conjunto se vacía solo** en cuanto todos los
  turnos vivos se tomen con código actual; mientras tanto, `tomar` avisa en vez de callar.
* **No cambia el TTL ni la política de reclamación.** Un turno realmente caducado se sigue
  reclamando solo. Lo que cambia es **con qué se decide que lo está**.
* **No toca `GATED_CHILD_TIMEOUT_MS` ni el régimen de timeouts**: eso es SCRUM-265.
* **No verifica contra staging real.** Los tests corren con doble inyectado, sin BD ni turno; la
  aritmética de la ventana sí queda fijada contra las funciones reales.

## Ficheros

* `scripts/_staging-lock.mjs` — `decidirVigencia()` nueva; `adquirirLock` lee el contexto **antes**
  de decidir y devuelve `vigencia` / `vigenciaPrevia`.
* `scripts/turno-staging.mjs` — `estado` con una sola decisión y su veredicto; `tomar` declara con
  qué reclamó; retirado el import inerte de `estaRancio`.
* `tests/scrum266-ttl-desatado.test.mjs` (6, sin gate).
