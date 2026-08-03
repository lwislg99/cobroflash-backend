# SCRUM-266 · TTL-DESATADO: la vigencia de un turno la decide el compromiso, no una suposición

**Fecha:** 3-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `9550f1b3dcc86a671036453372319440ea99003d` · 2026-08-03T20:05:00+02:00
**Tanda:** 1156 tests, 1089 pass, 0 fail, 67 skipped

> ⚠️ **Ticket de Javier (carril B).** La rama quedó lista sin pedir merge —es su carril y no
> está—; **la mergeó el fundador el 3-ago** porque el defecto estaba vivo con una tanda corriendo.
> Ver el comentario en SCRUM-266 con qué se hizo y por qué, igual que con sus PRs 259 y 260.
>
> **Tiene un SEGUNDO tramo**, al final de esta entrada: el guard que dejó este ticket protegía
> UNO de los diez consumidores del turno, y quedaba otro decidiendo por su cuenta.

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

---

## Segundo tramo · el guard protegía UNO de los diez consumidores

**Medido contra:** `origin/main` = `dd61eb09b7a22121217c19dbbdd2ec13ab939873` · 2026-08-03T20:16:27+02:00
**Tanda:** 1158 tests, 1091 pass, 0 fail, 67 skipped

La sesión 4 preguntó si `decidirVigencia()` era de verdad la única que decide **tras el merge**, y
la respuesta medida en `main` (no en la rama) fue **no**:

* `scripts/turno-staging.mjs:110` → `decidirVigencia` ✅ *(la línea 105 que se citaba es la
  numeración de ANTES de este ticket)*
* `scripts/_staging-lock.mjs:601` → el `estaRancio` de dentro de `decidirVigencia`: el fallback
  declarado, no un segundo juez ✅
* **`tests/_staging-db.mjs:152` → `estaRancio(lockVivo, ahoraMs)`, con el TTL por defecto** ❌

El «otro runner sin override» sí estaba cubierto: pasa su `ttlMs` a `adquirirLock`, que ya decide
con el juez, así que su TTL solo pesa cuando no hay compromiso.

### El defecto que quedaba, y su signo

Ese sitio es el **AVISO de turno ajeno** para el gateado suelto (`QA_DB_TEST=1 node --test …`),
el camino que no pasa por el runner. Avisa, nunca bloquea. Y ahí el defecto de este ticket
aparece **con el signo invertido**: con el TTL derivado por encima de los 45 supuestos, un turno
**vivo** de 50 minutos se daba por rancio y **el aviso no salía**. Donde `tomar` reclamaba de más,
el aviso avisaba de menos — y quien corría un test suelto se ponía a crear y borrar merchants
sobre la base de una tanda en marcha sin enterarse.

### Por qué se escapó: el guard enumeraba

El guard que dejó este ticket decía, en texto y sin comentarios:

```js
assert.doesNotMatch(fuenteDeTurnoStaging, /estaRancio\s*\(/)
```

Correcto, e insuficiente por lo mismo: **protege el sitio que ya se había arreglado**. Medido con
el barrido nuevo, los consumidores del turno son **diez**; ese guard cubría **uno**. Una lista de
sitios protegidos se satisface dejando de enumerar, y el siguiente consumidor nace fuera.

### La regla, y por qué no es «prohibido importar `estaRancio`»

Prohibir el import tumbaría el test unitario de `scrum188`, que la prueba como lo que es —una
función con su aritmética—, y obligaría a una excepción. La diferencia real no es quién importa,
es **qué se hace con el resultado**:

* llega a un `assert`, a un log, a un objeto → **se observa**, legítimo
* llega al control de flujo → **decide**, prohibido

Eso se ve en el AST, así que no hay que preguntar de qué fichero se trata. `scrum188` pasa y
`_staging-db.mjs` caía **sin que ninguno de los dos esté en una lista**. La población sale igual
de la estructura: quien importa del decisor es consumidor, lo sepa el guard o no.

Se detectan **dos formas**, porque sin la segunda la regla se esquiva con una línea de más —la
peor clase de regla, la que castiga escribirlo claro—:

* `directa` — `if (… && !estaRancio(x, t))`
* `variable` — `const rancio = estaRancio(x, t); if (rancio) …`

### El arreglo

El aviso lee el compromiso publicado en **la misma consulta** que ya hacía (la sonda se desconecta
justo después) y decide con `decidirVigencia`. La lectura es **best-effort con su propio `catch`**:
si falla, el contexto queda a `null`, el juez cae al TTL supuesto y el aviso se comporta
exactamente como antes de este arreglo. Es la misma razón por la que un sufijo ilegible del
marcador tampoco puede tumbar esta barrera: **lo que hay al otro lado de un fallo aquí es
`QA_DB_TEST=1` contra producción.** El arreglo no puede empeorar el peor caso.

### Verificado en rojo

* **Sin inyectar nada:** el defecto estaba vivo en `main`, así que el guard nace rojo señalando
  `tests/_staging-db.mjs:152 (forma: directa)`. El suelo, en verde, con 196 ms de recorrido.
* **La forma `variable`, inyectada:** `const rancio = estaRancio(…)` + `if (… && !rancio …)` →
  cae señalando la línea y la forma. Verificado que la inyección se aplicó y que compila
  (`node --check`) antes de creerme el rojo. Revertida; árbol limpio.
* **Y un tercer test para que «arreglarlo» no pueda ser «borrarlo»:** la barrera tiene que seguir
  preguntando al juez. Sin él, el guard se satisface eliminando el aviso entero.

### Lo que NO cubre

* **El seguimiento del valor se queda en el fichero.** Si alguien devuelve `estaRancio(...)` desde
  una función y decide con el resultado en otro módulo, el barrido no lo ve. Cubrirlo pediría
  análisis entre ficheros, y el defecto real —y su forma esquivable— viven en la misma función.
* **No se corrió la tanda gateada.** Estos tests no tocan BD ni turno; el aviso en sí solo se
  observa contra staging real, y el turno lo tenía otra sesión.

### Ficheros

* `tests/_decisor-turno.mjs` (nuevo) — población derivada + detección de decisiones, por AST.
* `tests/_staging-db.mjs` — el aviso pregunta al juez; lectura del contexto best-effort.
* `tests/scrum266-ttl-desatado.test.mjs` — el guard de texto de un fichero se sustituye por el
  barrido, más el suelo y el test de que el aviso sigue existiendo (6 → 8, sin gate).
